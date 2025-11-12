// backend/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

const app = express();
let PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Настройка PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER || 'buzeoff',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'alged_ref_db',
  password: process.env.DB_PASSWORD || 'olhseS05!',
  port: process.env.DB_PORT || 5432,
});

// ============ DATABASE INITIALIZATION ============

async function initDatabase() {
  const client = await pool.connect();
  try {
    // Создание таблицы пользователей
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        referral_code VARCHAR(8) UNIQUE NOT NULL,
        referred_by BIGINT,
        balance DECIMAL(18, 8) DEFAULT 0,
        total_deals INTEGER DEFAULT 0,
        rating DECIMAL(3, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (referred_by) REFERENCES users(telegram_id) ON DELETE SET NULL
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)
    `);

    // Создание таблицы рефералов
    await client.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_id BIGINT NOT NULL,
        referred_id BIGINT NOT NULL,
        earned_amount DECIMAL(18, 8) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (referrer_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
        FOREIGN KEY (referred_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
        UNIQUE(referrer_id, referred_id)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id)
    `);

    // Создание таблицы подарков
    await client.query(`
      CREATE TABLE IF NOT EXISTS gifts (
        id SERIAL PRIMARY KEY,
        gift_title VARCHAR(255) NOT NULL,
        model VARCHAR(255),
        background VARCHAR(255),
        symbol VARCHAR(255),
        from_id VARCHAR(255) NOT NULL,
        from_user_info JSONB,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        raw_data JSONB
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_gifts_from_id ON gifts(from_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_gifts_received_at ON gifts(received_at DESC)
    `);

    console.log('✅ База данных PostgreSQL инициализирована');
  } catch (error) {
    console.error('❌ Ошибка инициализации базы данных:', error);
    throw error;
  } finally {
    client.release();
  }
}

// ============ UTILITY FUNCTIONS ============

function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function generateUniqueReferralCode() {
  let code;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    code = generateReferralCode();
    const result = await pool.query(
      'SELECT id FROM users WHERE referral_code = $1',
      [code]
    );
    isUnique = result.rows.length === 0;
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Не удалось сгенерировать уникальный реферальный код');
  }

  return code;
}

function validateTelegramData(initData) {
  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (userStr) {
      return JSON.parse(decodeURIComponent(userStr));
    }
  } catch (error) {
    console.error('Ошибка валидации:', error);
  }
  return null;
}

function getTestUserData(referralCode = null) {
  if (referralCode) {
    return {
      id: Math.floor(Math.random() * 1000000000),
      first_name: 'Invited',
      last_name: 'User',
      username: `invited_${Date.now()}`
    };
  } else {
    return {
      id: 999999999,
      first_name: 'Test',
      last_name: 'User',
      username: 'test_main_user'
    };
  }
}

// ============ TELEGRAM GIFT TRACKING ============

// Функция для извлечения информации о подарке
function extractGiftInfo(update) {
  try {
    // Ищем messageService с messageActionStarGiftUnique
    if (
      update.className === "UpdateNewMessage" ||
      update.className === "UpdateNewChannelMessage"
    ) {
      const message = update.message;

      if (
        message.action &&
        message.action.className === "MessageActionStarGiftUnique"
      ) {
        const action = message.action;
        const gift = action.gift;

        // Основные данные
        let giftTitle = "Подарок";
        let model = "Неизвестная модель";
        let background = "Неизвестный фон";
        let symbol = "Неизвестный символ";

        // Если это starGiftUnique, извлекаем атрибуты
        if (gift.className === "StarGiftUnique" && gift.attributes) {
          giftTitle = gift.title || "Подарок";

          for (const attr of gift.attributes) {
            if (attr.className === "StarGiftAttributeModel") {
              model = attr.name;
            } else if (attr.className === "StarGiftAttributeBackdrop") {
              background = attr.name;
            } else if (attr.className === "StarGiftAttributePattern") {
              symbol = attr.name;
            }
          }
        } else if (gift.className === "StarGift") {
          giftTitle = gift.title || "Подарок";
        }

        let fromId = "Неизвестный ID";
        if (gift.released_by) {
          if (gift.released_by.className === "PeerUser") {
            fromId = gift.released_by.userId.toString();
          } else if (gift.released_by.className === "PeerChannel") {
            fromId = gift.released_by.channelId.toString();
          }
        }

        return {
          giftTitle,
          model,
          background,
          symbol,
          fromId,
          action,
          gift,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Ошибка при обработке обновления:", error);
    return null;
  }
}

// Инициализация Telegram клиента
let telegramClient = null;

async function initTelegramClient() {
  try {
    const apiId = parseInt(process.env.TELEGRAM_API_ID);
    const apiHash = process.env.TELEGRAM_API_HASH;
    const session = new StringSession(process.env.TELEGRAM_SESSION || '');

    if (!apiId || !apiHash) {
      console.log('⚠️  Telegram API credentials не настроены. Отслеживание подарков отключено.');
      return null;
    }

    telegramClient = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 5,
    });

    await telegramClient.connect();

    if (!telegramClient.session.authKey) {
      console.log('⚠️  Требуется авторизация Telegram. Используйте отдельный скрипт для авторизации.');
      return null;
    }

    console.log('✅ Telegram клиент подключен');
    return telegramClient;
  } catch (error) {
    console.error('❌ Ошибка инициализации Telegram клиента:', error);
    return null;
  }
}

// Функция для сохранения подарка в базу данных
async function saveGiftToDatabase(giftInfo) {
  try {
    const result = await pool.query(
      `INSERT INTO gifts (gift_title, model, background, symbol, from_id, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        giftInfo.giftTitle,
        giftInfo.model,
        giftInfo.background,
        giftInfo.symbol,
        giftInfo.fromId,
        JSON.stringify({ action: giftInfo.action, gift: giftInfo.gift })
      ]
    );

    console.log(`🎁 Подарок сохранен: ${giftInfo.giftTitle} (${giftInfo.model} ${giftInfo.background} ${giftInfo.symbol}) от ${giftInfo.fromId}`);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Ошибка сохранения подарка в БД:', error);
    throw error;
  }
}

// Запуск отслеживания подарков
async function startGiftTracking() {
  const client = await initTelegramClient();

  if (!client) {
    console.log('⚠️  Отслеживание подарков не запущено');
    return;
  }

  // Слушаем обновления
  client.addEventHandler(async (update) => {
    const giftInfo = extractGiftInfo(update);

    if (giftInfo) {
      try {
        await saveGiftToDatabase(giftInfo);
      } catch (error) {
        console.error('Ошибка при обработке подарка:', error);
      }
    }
  });

  console.log('👂 Слушаю обновления (подарки)...');
}

// ============ API ENDPOINTS ============

// User initialization
app.post('/api/user/init', async (req, res) => {
  const client = await pool.connect();
  try {
    const { initData, referralCode } = req.body;

    console.log('📥 Запрос инициализации:', {
      hasInitData: !!initData,
      referralCode: referralCode || 'none'
    });

    let userData;
    if (initData && initData !== 'dev') {
      userData = validateTelegramData(initData);
    } else {
      userData = getTestUserData(referralCode);
    }

    if (!userData) {
      return res.status(400).json({ error: 'Неверные данные' });
    }

    await client.query('BEGIN');

    let userResult = await client.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [userData.id]
    );

    let user = userResult.rows[0];

    if (!user) {
      const newReferralCode = await generateUniqueReferralCode();

      let referrerId = null;
      if (referralCode) {
        const referrerResult = await client.query(
          'SELECT telegram_id FROM users WHERE referral_code = $1',
          [referralCode.toUpperCase()]
        );

        if (referrerResult.rows.length > 0) {
          referrerId = referrerResult.rows[0].telegram_id;
        }
      }

      const insertResult = await client.query(
        `INSERT INTO users (telegram_id, username, first_name, last_name, referral_code, referred_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userData.id, userData.username, userData.first_name, userData.last_name, newReferralCode, referrerId]
      );

      user = insertResult.rows[0];

      if (referrerId) {
        await client.query(
          'INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2)',
          [referrerId, userData.id]
        );
      }
    }

    const referralStatsResult = await client.query(
      `SELECT 
        COUNT(*) as total_referrals,
        COALESCE(SUM(earned_amount), 0) as total_earned
       FROM referrals 
       WHERE referrer_id = $1`,
      [user.telegram_id]
    );

    const referralStats = referralStatsResult.rows[0];

    await client.query('COMMIT');

    res.json({
      user: {
        id: user.telegram_id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        referralCode: user.referral_code,
        balance: parseFloat(user.balance),
        totalDeals: user.total_deals,
        rating: parseFloat(user.rating),
        referredBy: user.referred_by
      },
      referralStats: {
        totalReferrals: parseInt(referralStats.total_referrals) || 0,
        totalEarned: parseFloat(referralStats.total_earned) || 0
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка при инициализации пользователя:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    client.release();
  }
});

// Get user referrals
app.get('/api/user/:telegramId/referrals', async (req, res) => {
  try {
    const { telegramId } = req.params;

    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) as total_referrals,
        COALESCE(SUM(earned_amount), 0) as total_earned
       FROM referrals 
       WHERE referrer_id = $1`,
      [telegramId]
    );

    const referralsResult = await pool.query(
      `SELECT 
        u.telegram_id,
        u.username,
        u.first_name,
        u.last_name,
        r.earned_amount,
        r.created_at
       FROM referrals r
       JOIN users u ON r.referred_id = u.telegram_id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC`,
      [telegramId]
    );

    const stats = statsResult.rows[0];

    res.json({
      stats: {
        totalReferrals: parseInt(stats.total_referrals) || 0,
        totalEarned: parseFloat(stats.total_earned) || 0
      },
      referrals: referralsResult.rows.map(r => ({
        telegramId: r.telegram_id,
        username: r.username,
        firstName: r.first_name,
        lastName: r.last_name,
        earnedAmount: parseFloat(r.earned_amount),
        createdAt: r.created_at
      }))
    });

  } catch (error) {
    console.error('Ошибка при получении рефералов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Check referral code
app.get('/api/referral/check/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const result = await pool.query(
      'SELECT telegram_id, first_name, last_name, username FROM users WHERE referral_code = $1',
      [code]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      res.json({
        valid: true,
        referrer: {
          id: user.telegram_id,
          firstName: user.first_name,
          lastName: user.last_name,
          username: user.username
        }
      });
    } else {
      res.json({ valid: false });
    }

  } catch (error) {
    console.error('Ошибка при проверке кода:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Get all gifts
app.get('/api/gifts', async (req, res) => {
  try {
    const { limit = 50, offset = 0, fromId } = req.query;

    let query = `
      SELECT * FROM gifts
      ${fromId ? 'WHERE from_id = $1' : ''}
      ORDER BY received_at DESC
      LIMIT $${fromId ? 2 : 1} OFFSET $${fromId ? 3 : 2}
    `;

    const params = fromId
      ? [fromId, parseInt(limit), parseInt(offset)]
      : [parseInt(limit), parseInt(offset)];

    const result = await pool.query(query, params);

    const countQuery = fromId
      ? 'SELECT COUNT(*) FROM gifts WHERE from_id = $1'
      : 'SELECT COUNT(*) FROM gifts';

    const countParams = fromId ? [fromId] : [];
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      gifts: result.rows.map(gift => ({
        id: gift.id,
        giftTitle: gift.gift_title,
        model: gift.model,
        background: gift.background,
        symbol: gift.symbol,
        fromId: gift.from_id,
        receivedAt: gift.received_at,
        rawData: gift.raw_data
      })),
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Ошибка при получении подарков:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Get gift statistics
app.get('/api/gifts/stats', async (req, res) => {
  try {
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM gifts');

    const byUserResult = await pool.query(`
      SELECT from_id, COUNT(*) as count
      FROM gifts
      GROUP BY from_id
      ORDER BY count DESC
      LIMIT 10
    `);

    const byModelResult = await pool.query(`
      SELECT model, COUNT(*) as count
      FROM gifts
      WHERE model IS NOT NULL AND model != 'Неизвестная модель'
      GROUP BY model
      ORDER BY count DESC
    `);

    const recentResult = await pool.query(`
      SELECT * FROM gifts
      ORDER BY received_at DESC
      LIMIT 5
    `);

    res.json({
      total: parseInt(totalResult.rows[0].total),
      byUser: byUserResult.rows.map(row => ({
        fromId: row.from_id,
        count: parseInt(row.count)
      })),
      byModel: byModelResult.rows.map(row => ({
        model: row.model,
        count: parseInt(row.count)
      })),
      recent: recentResult.rows.map(gift => ({
        id: gift.id,
        giftTitle: gift.gift_title,
        model: gift.model,
        background: gift.background,
        symbol: gift.symbol,
        fromId: gift.from_id,
        receivedAt: gift.received_at
      }))
    });
  } catch (error) {
    console.error('Ошибка при получении статистики подарков:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Get gift by ID
app.get('/api/gifts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM gifts WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Подарок не найден' });
    }

    const gift = result.rows[0];
    res.json({
      id: gift.id,
      giftTitle: gift.gift_title,
      model: gift.model,
      background: gift.background,
      symbol: gift.symbol,
      fromId: gift.from_id,
      fromUserInfo: gift.from_user_info,
      receivedAt: gift.received_at,
      rawData: gift.raw_data
    });
  } catch (error) {
    console.error('Ошибка при получении подарка:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint - получение всех пользователей
app.get('/api/debug/users', async (req, res) => {
  try {
    const usersResult = await pool.query(`
      SELECT 
        u.telegram_id,
        u.first_name,
        u.last_name,
        u.username,
        u.referral_code,
        u.referred_by,
        u.created_at,
        COUNT(r.id) as referrals_count
      FROM users u
      LEFT JOIN referrals r ON u.telegram_id = r.referrer_id
      GROUP BY u.telegram_id
      ORDER BY u.created_at DESC
      LIMIT 20
    `);

    const referralsResult = await pool.query(`
      SELECT 
        r.*,
        u1.first_name as referrer_name,
        u2.first_name as referred_name
      FROM referrals r
      JOIN users u1 ON r.referrer_id = u1.telegram_id
      JOIN users u2 ON r.referred_id = u2.telegram_id
      ORDER BY r.created_at DESC
      LIMIT 20
    `);

    res.json({
      users: usersResult.rows,
      referrals: referralsResult.rows,
      counts: {
        totalUsers: usersResult.rows.length,
        totalReferrals: referralsResult.rows.length
      }
    });
  } catch (error) {
    console.error('Ошибка debug endpoint:', error);
    res.status(500).json({ error: 'Ошибка получения данных' });
  }
});

// ============ SERVER STARTUP ============

process.on('SIGTERM', async () => {
  console.log('SIGTERM получен, закрываем соединения...');
  if (telegramClient) {
    await telegramClient.disconnect();
  }
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT получен, закрываем соединения...');
  if (telegramClient) {
    await telegramClient.disconnect();
  }
  await pool.end();
  process.exit(0);
});

async function startServer() {
  try {
    console.log('🚀 Запуск сервера...\n');

    // Инициализация базы данных
    console.log('📊 Инициализация базы данных...');
    await initDatabase();

    // Запуск отслеживания подарков
    console.log('🎁 Запуск отслеживания подарков...');
    startGiftTracking().catch(err => {
      console.error('⚠️  Ошибка запуска отслеживания подарков:', err);
    });

    // Запуск Express сервера
    const server = app.listen(PORT, () => {
      console.log('═'.repeat(50));
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`🗄️  База данных: PostgreSQL`);
      console.log(`📡 Health check: http://localhost:${PORT}/health`);
      console.log('═'.repeat(50));
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️  Порт ${PORT} занят, пробуем ${PORT + 1}...`);
        PORT = PORT + 1;
        setTimeout(startServer, 1000);
      } else {
        console.error('❌ Ошибка запуска сервера:', err);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error('❌ Критическая ошибка запуска сервера:', error);
    process.exit(1);
  }
}

startServer();
