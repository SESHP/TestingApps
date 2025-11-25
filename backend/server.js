// backend/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const http = require('http');
const { Server } = require('socket.io');
const { initGuaranteeSocket } = require('./backend/guarantee-socket');
const { setupGuaranteeAPI } = require('./backend/guarantee-api');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});


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
        gift_id VARCHAR(255),
        gift_title VARCHAR(255) NOT NULL,
        model VARCHAR(255),
        background VARCHAR(255),
        symbol VARCHAR(255),
        from_id VARCHAR(255) NOT NULL,
        from_user_info JSONB,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_withdrawn BOOLEAN DEFAULT FALSE,
        withdrawn_at TIMESTAMP,
        withdrawn_to_id VARCHAR(255),
        lottie_url TEXT,
        raw_data JSONB
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_gifts_from_id ON gifts(from_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_gifts_received_at ON gifts(received_at DESC)
    `);

    // Миграция: добавление новых полей если их нет
    try {
      await client.query(`
        ALTER TABLE gifts
        ADD COLUMN IF NOT EXISTS gift_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS is_withdrawn BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS withdrawn_to_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS lottie_url TEXT
      `);
      console.log('✅ Миграция полей выполнена');
    } catch (migrationError) {
      console.log('⚠️  Поля уже существуют или ошибка миграции:', migrationError.message);
    }

    // Создание индексов после миграции
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_gifts_is_withdrawn ON gifts(is_withdrawn)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_gifts_gift_id ON gifts(gift_id)
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

// Функция для извлечения Lottie URL из подарка
function extractLottieUrl(gift) {
  try {
    // Проверяем наличие документа с лоттиками
    if (gift.document && gift.document.attributes) {
      for (const attr of gift.document.attributes) {
        if (attr.className === 'DocumentAttributeFilename' && attr.fileName) {
          if (attr.fileName.includes('lottie') || attr.fileName.endsWith('.json')) {
            // Можно попробовать получить URL или сохранить ID документа
            return `document_id:${gift.document.id}`;
          }
        }
      }
    }
    
    // Альтернативно: если есть прямая ссылка
    if (gift.document && gift.document.id) {
      return `document_id:${gift.document.id}`;
    }
  } catch (error) {
    console.error('Ошибка извлечения Lottie URL:', error);
  }
  return null;
}

// Функция для извлечения информации о полученном подарке (ВХОДЯЩИЕ)
function extractGiftInfo(update) {
  try {
    // Ищем messageService с messageActionStarGiftUnique
    if (
      update.className === "UpdateNewMessage" ||
      update.className === "UpdateNewChannelMessage"
    ) {
      const message = update.message;

      // ВАЖНО: Проверяем что это ВХОДЯЩЕЕ сообщение (out !== true)
      if (
        message.out !== true &&
        message.action &&
        message.action.className === "MessageActionStarGiftUnique"
      ) {
        const action = message.action;
        const gift = action.gift;

        // Основные данные подарка
        let giftTitle = "Подарок";
        let giftId = null;
        let model = "Неизвестная модель";
        let background = "Неизвестный фон";
        let symbol = "Неизвестный символ";
        let lottieUrl = null;

        // Если это starGiftUnique, извлекаем атрибуты
        if (gift.className === "StarGiftUnique") {
          giftTitle = gift.title || "Подарок";
          giftId = gift.id ? gift.id.toString() : null;
          
          // Извлекаем Lottie URL
          lottieUrl = extractLottieUrl(gift);

          if (gift.attributes) {
            for (const attr of gift.attributes) {
              if (attr.className === "StarGiftAttributeModel") {
                model = attr.name;
              } else if (attr.className === "StarGiftAttributeBackdrop") {
                background = attr.name;
              } else if (attr.className === "StarGiftAttributePattern") {
                symbol = attr.name;
              }
            }
          }
        } else if (gift.className === "StarGift") {
          giftTitle = gift.title || "Подарок";
          giftId = gift.id ? gift.id.toString() : null;
          lottieUrl = extractLottieUrl(gift);
        }

        // ИСПРАВЛЕНО: Получаем ID отправителя из message.fromId, а НЕ из action.from_id
        let fromId = "Неизвестный ID";

        // ИСПРАВЛЕНО: Получаем ID отправителя из message.peerId.userId
        
        if (message.peerId) {
          console.log('Зашел в цикл')
          console.log(`PeerID ${message.peerId}`)
          console.log(`PeerID.ClassName ${message.peerId.className}`)
          console.log(`PeerID.User ${message.peerId.userId}`)
          if (message.peerId.className === "PeerUser") {
            fromId = message.peerId.userId.toString();
          } else if (message.peerId.className === "PeerChannel") {
            fromId = message.peerId.channelId.toString();
          }
        }

        console.log(`📥 ВХОДЯЩИЙ подарок: ${giftTitle} (ID: ${giftId}) от пользователя ${fromId}`);

        return {
          giftId,
          giftTitle,
          model,
          background,
          symbol,
          fromId,
          lottieUrl,
          action,
          gift,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Ошибка при обработке входящего подарка:", error);
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


// Функция для извлечения информации об отправленном подарке (ИСХОДЯЩИЕ)
function extractSentGiftInfo(update) {
  try {
    // Ищем ИСХОДЯЩИЕ подарки (когда мы отправляем подарок обратно)
    if (
      update.className === "UpdateNewMessage" ||
      update.className === "UpdateNewChannelMessage"
    ) {
      const message = update.message;

      // ВАЖНО: Проверяем, что это ИСХОДЯЩЕЕ сообщение (out === true) с подарком
      if (
        message.out === true &&
        message.action &&
        message.action.className === "MessageActionStarGiftUnique"
      ) {
        const action = message.action;
        const gift = action.gift;

        // Основные данные подарка
        let giftTitle = "Подарок";
        let giftId = null;
        let model = "Неизвестная модель";
        let background = "Неизвестный фон";
        let symbol = "Неизвестный символ";

        if (gift.className === "StarGiftUnique") {
          giftTitle = gift.title || "Подарок";
          giftId = gift.id ? gift.id.toString() : null;

          if (gift.attributes) {
            for (const attr of gift.attributes) {
              if (attr.className === "StarGiftAttributeModel") {
                model = attr.name;
              } else if (attr.className === "StarGiftAttributeBackdrop") {
                background = attr.name;
              } else if (attr.className === "StarGiftAttributePattern") {
                symbol = attr.name;
              }
            }
          }
        } else if (gift.className === "StarGift") {
          giftTitle = gift.title || "Подарок";
          giftId = gift.id ? gift.id.toString() : null;
        }

        // Получатель подарка (куда отправляем)
        let toId = "Неизвестный ID";
        if (message.peerId) {
          if (message.peerId.className === "PeerUser") {
            toId = message.peerId.userId.toString();
          } else if (message.peerId.className === "PeerChannel") {
            toId = message.peerId.channelId.toString();
          }
        }

        console.log(`📤 ИСХОДЯЩИЙ подарок: ${giftTitle} (ID: ${giftId}) отправлен пользователю ${toId}`);

        return {
          giftId,
          giftTitle,
          model,
          background,
          symbol,
          toId,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Ошибка при обработке отправленного подарка:", error);
    return null;
  }
}

// Функция для сохранения полученного подарка в базу данных
// Функция для сохранения полученного подарка в базу данных
async function saveGiftToDatabase(giftInfo) {
  try {
    const result = await pool.query(
      `INSERT INTO gifts (gift_id, gift_title, model, background, symbol, from_id, lottie_url, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        giftInfo.giftId,
        giftInfo.giftTitle,
        giftInfo.model,
        giftInfo.background,
        giftInfo.symbol,
        giftInfo.fromId,
        giftInfo.lottieUrl,
        JSON.stringify({ action: giftInfo.action, gift: giftInfo.gift })
      ]
    );

    console.log(`✅ Подарок сохранен в БД: ${giftInfo.giftTitle} (Gift ID: ${giftInfo.giftId})`);
    
    // Сразу загружаем файлы
    if (giftService && giftInfo.gift) {
      console.log(`🔄 Начинаем загрузку файлов для подарка ${giftInfo.giftId}...`);
      try {
        const downloadedFiles = await giftService.processGiftFiles(giftInfo.gift);
        console.log(`✅ Файлы загружены:`, downloadedFiles);
      } catch (processError) {
        console.error('❌ Ошибка загрузки файлов:', processError);
      }
    } else {
      console.log('⚠️  GiftService недоступен или нет данных подарка');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Ошибка сохранения подарка в БД:', error);
    throw error;
  }
}

// ИСПРАВЛЕНО: Функция для пометки подарка как выведенного
async function markGiftAsWithdrawn(giftId, toId) {
  try {
    // Ищем подарок по gift_id (уникальный ID от Telegram)
    const result = await pool.query(
      `UPDATE gifts
       SET is_withdrawn = TRUE,
           withdrawn_at = CURRENT_TIMESTAMP,
           withdrawn_to_id = $2
       WHERE gift_id = $1 AND is_withdrawn = FALSE
       RETURNING *`,
      [giftId, toId]
    );

    if (result.rows.length > 0) {
      const gift = result.rows[0];
      console.log(`✅ Подарок помечен как выведенный: ${gift.gift_title} (Gift ID: ${giftId}) отправлен ${toId}`);
      return result.rows[0];
    } else {
      console.log(`⚠️  Подарок для вывода не найден или уже выведен: Gift ID ${giftId}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Ошибка пометки подарка как выведенного:', error);
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
    // ВХОДЯЩИЕ подарки - сохраняем в БД
    const giftInfo = extractGiftInfo(update);
    if (giftInfo) {
      try {
        await saveGiftToDatabase(giftInfo);
        
        // Автоматически обрабатываем подарок при получении
        if (giftService && giftInfo.gift) {
          try {
            const processed = await giftService.processGift(giftInfo.gift);
            console.log(`✅ Подарок автоматически обработан: ${processed.title}`);
            
            // Обновляем lottie_url в БД
            if (processed.mainDocument?.file?.lottieJson?.url) {
              await pool.query(
                'UPDATE gifts SET lottie_url = $1 WHERE gift_id = $2',
                [processed.mainDocument.file.lottieJson.url, giftInfo.giftId]
              );
            }
          } catch (processError) {
            console.error('⚠️  Ошибка автоматической обработки подарка:', processError);
          }
        }
      } catch (error) {
        console.error('Ошибка при сохранении подарка:', error);
      }
    }

    // ИСХОДЯЩИЕ подарки - только помечаем как выведенные
    const sentGiftInfo = extractSentGiftInfo(update);
    if (sentGiftInfo) {
      try {
        await markGiftAsWithdrawn(
          sentGiftInfo.giftId,
          sentGiftInfo.toId
        );
      } catch (error) {
        console.error('Ошибка при пометке отправленного подарка:', error);
      }
    }
  });

  console.log('👂 Слушаю обновления (входящие и исходящие подарки)...');
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
        starsBalance: parseFloat(user.stars_balance || 0),
        totalDeals: user.total_deals,
        rating: parseFloat(user.rating),
        referredBy: user.referred_by,
        badgeStatus: user.badge_status || 'GUEST',
        commissionRate: parseFloat(user.commission_rate || 4),
        isWhale: user.is_whale || false,
        telegramAudience: user.telegram_audience || 0
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
    const { limit = 50, offset = 0, fromId, withdrawn } = req.query;

    // Построение WHERE условий
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (fromId) {
      conditions.push(`from_id = $${paramIndex}`);
      params.push(fromId);
      paramIndex++;
    }

    // Фильтр по статусу вывода
    if (withdrawn === 'true') {
      conditions.push(`is_withdrawn = TRUE`);
    } else if (withdrawn === 'false') {
      conditions.push(`is_withdrawn = FALSE`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT * FROM gifts
      ${whereClause}
      ORDER BY received_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(parseInt(limit), parseInt(offset));
    const result = await pool.query(query, params);

    const countQuery = `SELECT COUNT(*) FROM gifts ${whereClause}`;
    const countParams = params.slice(0, paramIndex - 1);
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      gifts: result.rows.map(gift => ({
        id: gift.id,
        giftId: gift.gift_id,
        giftTitle: gift.gift_title,
        model: gift.model,
        background: gift.background,
        symbol: gift.symbol,
        fromId: gift.from_id,
        receivedAt: gift.received_at,
        isWithdrawn: gift.is_withdrawn,
        withdrawnAt: gift.withdrawn_at,
        withdrawnToId: gift.withdrawn_to_id,
        lottieUrl: gift.lottie_url,
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

    const activeResult = await pool.query('SELECT COUNT(*) as active FROM gifts WHERE is_withdrawn = FALSE');

    const withdrawnResult = await pool.query('SELECT COUNT(*) as withdrawn FROM gifts WHERE is_withdrawn = TRUE');

    const byUserResult = await pool.query(`
      SELECT from_id, COUNT(*) as count
      FROM gifts
      WHERE is_withdrawn = FALSE
      GROUP BY from_id
      ORDER BY count DESC
      LIMIT 10
    `);

    const byModelResult = await pool.query(`
      SELECT model, COUNT(*) as count
      FROM gifts
      WHERE model IS NOT NULL AND model != 'Неизвестная модель' AND is_withdrawn = FALSE
      GROUP BY model
      ORDER BY count DESC
    `);

    const recentResult = await pool.query(`
      SELECT * FROM gifts
      WHERE is_withdrawn = FALSE
      ORDER BY received_at DESC
      LIMIT 5
    `);

    res.json({
      total: parseInt(totalResult.rows[0].total),
      active: parseInt(activeResult.rows[0].active),
      withdrawn: parseInt(withdrawnResult.rows[0].withdrawn),
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
        giftId: gift.gift_id,
        giftTitle: gift.gift_title,
        model: gift.model,
        background: gift.background,
        symbol: gift.symbol,
        fromId: gift.from_id,
        receivedAt: gift.received_at,
        isWithdrawn: gift.is_withdrawn,
        lottieUrl: gift.lottie_url
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
      giftId: gift.gift_id,
      giftTitle: gift.gift_title,
      model: gift.model,
      background: gift.background,
      symbol: gift.symbol,
      fromId: gift.from_id,
      fromUserInfo: gift.from_user_info,
      receivedAt: gift.received_at,
      isWithdrawn: gift.is_withdrawn,
      withdrawnAt: gift.withdrawn_at,
      withdrawnToId: gift.withdrawn_to_id,
      lottieUrl: gift.lottie_url,
      rawData: gift.raw_data
    });
  } catch (error) {
    console.error('Ошибка при получении подарка:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Mark gift as withdrawn
app.post('/api/gifts/:id/withdraw', async (req, res) => {
  try {
    const { id } = req.params;
    const { toId } = req.body;

    const result = await pool.query(
      `UPDATE gifts
       SET is_withdrawn = TRUE,
           withdrawn_at = CURRENT_TIMESTAMP,
           withdrawn_to_id = $2
       WHERE id = $1 AND is_withdrawn = FALSE
       RETURNING *`,
      [id, toId || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Подарок не найден или уже выведен' });
    }

    const gift = result.rows[0];
    res.json({
      success: true,
      gift: {
        id: gift.id,
        giftId: gift.gift_id,
        giftTitle: gift.gift_title,
        model: gift.model,
        background: gift.background,
        symbol: gift.symbol,
        fromId: gift.from_id,
        isWithdrawn: gift.is_withdrawn,
        withdrawnAt: gift.withdrawn_at,
        withdrawnToId: gift.withdrawn_to_id
      }
    });
  } catch (error) {
    console.error('Ошибка при пометке подарка как выведенного:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Restore withdrawn gift (отмена вывода)
app.post('/api/gifts/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE gifts
       SET is_withdrawn = FALSE,
           withdrawn_at = NULL,
           withdrawn_to_id = NULL
       WHERE id = $1 AND is_withdrawn = TRUE
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Подарок не найден или не был выведен' });
    }

    const gift = result.rows[0];
    res.json({
      success: true,
      gift: {
        id: gift.id,
        giftId: gift.gift_id,
        giftTitle: gift.gift_title,
        model: gift.model,
        background: gift.background,
        symbol: gift.symbol,
        fromId: gift.from_id,
        isWithdrawn: gift.is_withdrawn
      }
    });
  } catch (error) {
    console.error('Ошибка при восстановлении подарка:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

app.use('/uploads/gifts', express.static('./uploads/gifts'));

// Получить детальную информацию о подарке с файлами
app.get('/api/gifts/:id/details', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM gifts WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Подарок не найден' });
    }

    const giftData = result.rows[0];

    // Если есть GiftService и raw_data, обрабатываем подарок
    if (giftService && giftData.raw_data && giftData.raw_data.gift) {
      try {
        const processed = await giftService.processGift(giftData.raw_data.gift);
        
        res.json({
          id: giftData.id,
          giftId: giftData.gift_id,
          giftTitle: giftData.gift_title,
          model: giftData.model,
          background: giftData.background,
          symbol: giftData.symbol,
          fromId: giftData.from_id,
          receivedAt: giftData.received_at,
          isWithdrawn: giftData.is_withdrawn,
          processed: {
            title: processed.title,
            mainDocument: processed.mainDocument,
            attributes: processed.attributes,
            files: processed.files
          }
        });
      } catch (processError) {
        console.error('Ошибка обработки подарка:', processError);
        // Возвращаем базовую информацию при ошибке
        res.json({
          id: giftData.id,
          giftId: giftData.gift_id,
          giftTitle: giftData.gift_title,
          model: giftData.model,
          background: giftData.background,
          symbol: giftData.symbol,
          fromId: giftData.from_id,
          receivedAt: giftData.received_at,
          isWithdrawn: giftData.is_withdrawn,
          error: 'Не удалось обработать файлы подарка'
        });
      }
    } else {
      // Возвращаем базовую информацию
      res.json({
        id: giftData.id,
        giftId: giftData.gift_id,
        giftTitle: giftData.gift_title,
        model: giftData.model,
        background: giftData.background,
        symbol: giftData.symbol,
        fromId: giftData.from_id,
        receivedAt: giftData.received_at,
        isWithdrawn: giftData.is_withdrawn
      });
    }
  } catch (error) {
    console.error('Ошибка при получении детальной информации о подарке:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Принудительная обработка подарка (загрузка файлов)
app.post('/api/gifts/:id/process', async (req, res) => {
  try {
    const { id } = req.params;

    if (!giftService) {
      return res.status(503).json({ error: 'GiftService не инициализирован' });
    }

    const result = await pool.query('SELECT * FROM gifts WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Подарок не найден' });
    }

    const giftData = result.rows[0];

    if (!giftData.raw_data || !giftData.raw_data.gift) {
      return res.status(400).json({ error: 'Нет данных для обработки подарка' });
    }

    // Обрабатываем подарок
    const processed = await giftService.processGift(giftData.raw_data.gift);

    // Обновляем lottie_url в БД
    if (processed.mainDocument?.file?.lottieJson?.url) {
      await pool.query(
        'UPDATE gifts SET lottie_url = $1 WHERE id = $2',
        [processed.mainDocument.file.lottieJson.url, id]
      );
    }

    res.json({
      success: true,
      processed: {
        title: processed.title,
        mainDocument: processed.mainDocument,
        attributes: processed.attributes,
        files: processed.files
      }
    });

  } catch (error) {
    console.error('Ошибка при обработке подарка:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Проксирование файлов из Telegram
// Проксирование файлов из Telegram
// app.get('/api/telegram/file/:docId', async (req, res) => {
//   try {
//     const { docId } = req.params;
    
//     console.log(`📥 Запрос файла: ${docId}`);
    
//     const result = await pool.query('SELECT raw_data FROM gifts');
    
//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'Подарки не найдены' });
//     }
    
//     let doc = null;
    
//     for (const row of result.rows) {
//       const giftData = row.raw_data?.gift;
//       if (!giftData || !giftData.attributes) continue;
      
//       for (const attr of giftData.attributes) {
//         if (attr.document && attr.document.id === docId) {
//           doc = attr.document;
//           break;
//         }
//       }
      
//       if (doc) break;
//     }
    
//     if (!doc) {
//       console.log(`❌ Документ ${docId} не найден`);
//       return res.status(404).json({ error: 'Документ не найден' });
//     }
    
//     console.log(`✅ Документ найден: ${doc.id}, MIME: ${doc.mimeType}`);
    
//     if (!telegramClient) {
//       return res.status(503).json({ error: 'Telegram client не подключен' });
//     }
    
//     const { Api } = require('telegram');
//     const zlib = require('zlib');
    
//     const inputDoc = new Api.InputDocument({
//       id: BigInt(doc.id),
//       accessHash: BigInt(doc.accessHash),
//       fileReference: Buffer.from(doc.fileReference.data)
//     });
    
//     console.log(`📥 Загрузка через MTProto...`);
    
//     const buffer = await telegramClient.downloadMedia(inputDoc, { workers: 1 });
    
//     if (!buffer) {
//       console.log(`❌ downloadMedia вернул null`);
//       return res.status(500).json({ error: 'Не удалось загрузить' });
//     }
    
//     console.log(`✅ Загружено ${buffer.length} байт`);
//     console.log(`📝 Первые байты: ${buffer.slice(0, 10).toString('hex')}`);
    
//     // Если это TGS
//     if (doc.mimeType === 'application/x-tgsticker') {
//       // Проверяем, это gzip или уже JSON
//       const isGzip = buffer[0] === 0x1f && buffer[1] === 0x8b;
      
//       console.log(`🔍 Это gzip? ${isGzip}`);
      
//       if (isGzip) {
//         // Распаковываем gzip
//         zlib.gunzip(buffer, (err, jsonBuffer) => {
//           if (err) {
//             console.error(`❌ Ошибка gunzip:`, err.message);
//             // Пробуем inflate
//             zlib.inflate(buffer, (err2, jsonBuffer2) => {
//               if (err2) {
//                 console.error(`❌ Ошибка inflate:`, err2.message);
//                 return res.status(500).json({ error: 'Ошибка распаковки' });
//               }
//               console.log(`✅ Распаковано через inflate: ${jsonBuffer2.length} байт`);
//               res.setHeader('Content-Type', 'application/json');
//               res.send(jsonBuffer2);
//             });
//           } else {
//             console.log(`✅ Распаковано через gunzip: ${jsonBuffer.length} байт`);
//             res.setHeader('Content-Type', 'application/json');
//             res.send(jsonBuffer);
//           }
//         });
//       } else {
//         // Уже JSON
//         console.log(`✅ Уже JSON, отправляем как есть`);
//         res.setHeader('Content-Type', 'application/json');
//         res.send(buffer);
//       }
//     } else if (doc.mimeType === 'image/webp') {
//       res.setHeader('Content-Type', 'image/webp');
//       res.send(buffer);
//     } else {
//       res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
//       res.send(buffer);
//     }
    
//   } catch (error) {
//     console.error('❌ Критическая ошибка:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// Проксирование файлов из Telegram
app.get('/api/telegram/file/:docId', async (req, res) => {
  try {
    const { docId } = req.params;
    
    console.log(`📥 Запрос файла: ${docId}`);
    
    const fs = require('fs');
    const path = require('path');
    const uploadsDir = './uploads/gifts';
    const jsonPath = path.join(uploadsDir, `${docId}.json`);
    
    if (fs.existsSync(jsonPath)) {
      console.log(`✅ Отдаем из кеша`);
      return res.sendFile(path.resolve(jsonPath));
    }
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const result = await pool.query('SELECT raw_data FROM gifts');
    
    let doc = null;
    
    for (const row of result.rows) {
      const giftData = row.raw_data?.gift;
      if (!giftData?.attributes) continue;
      
      for (const attr of giftData.attributes) {
        if (attr.document?.id === docId) {
          doc = attr.document;
          break;
        }
      }
      if (doc) break;
    }
    
    if (!doc) {
      return res.status(404).json({ error: 'Документ не найден' });
    }
    
    console.log(`✅ Документ найден`);
    
    if (!telegramClient) {
      return res.status(503).json({ error: 'Telegram client не подключен' });
    }
    
    const { Api } = require('telegram');
    
    try {
      console.log(`📥 Загрузка через upload.getFile...`);
      
      // Используем upload.getFile вместо downloadMedia
      const location = new Api.InputDocumentFileLocation({
        id: BigInt(doc.id),
        accessHash: BigInt(doc.accessHash),
        fileReference: Buffer.from(doc.fileReference.data),
        thumbSize: ''
      });
      
      // Скачиваем полный файл
      let chunks = [];
      let offset = 0;
      const limit = 1024 * 1024; // 1MB chunks
      
      while (true) {
        const result = await telegramClient.invoke(
          new Api.upload.GetFile({
            location: location,
            offset: BigInt(offset),
            limit: limit
          })
        );
        
        if (!result.bytes || result.bytes.length === 0) {
          break;
        }
        
        chunks.push(result.bytes);
        offset += result.bytes.length;
        
        console.log(`📦 Загружено: ${offset} байт`);
        
        // Если получили меньше чем limit, значит это последний chunk
        if (result.bytes.length < limit) {
          break;
        }
      }
      
      const fullBuffer = Buffer.concat(chunks);
      console.log(`✅ Всего загружено: ${fullBuffer.length} байт`);
      
      if (doc.mimeType === 'application/x-tgsticker') {
        const zlib = require('zlib');
        const { promisify } = require('util');
        const gunzipAsync = promisify(zlib.gunzip);
        
        // Распаковываем
        const jsonBuffer = await gunzipAsync(fullBuffer);
        const jsonString = jsonBuffer.toString('utf8');
        
        // Проверяем валидность
        const parsed = JSON.parse(jsonString);
        console.log(`✅ JSON валиден, размер: ${jsonString.length}`);
        
        // Сохраняем
        fs.writeFileSync(jsonPath, jsonString);
        
        res.setHeader('Content-Type', 'application/json');
        res.send(jsonString);
      } else {
        const filePath = path.join(uploadsDir, `${docId}.webp`);
        fs.writeFileSync(filePath, fullBuffer);
        res.setHeader('Content-Type', doc.mimeType);
        res.send(fullBuffer);
      }
      
    } catch (err) {
      console.error(`❌ Ошибка загрузки:`, err.message);
      return res.status(500).json({ error: err.message });
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить список всех обработанных файлов
app.get('/api/gifts/files/list', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const uploadsDir = './uploads/gifts';
    
    try {
      const files = await fs.readdir(uploadsDir);
      const fileStats = await Promise.all(
        files.map(async (filename) => {
          const filepath = path.join(uploadsDir, filename);
          const stats = await fs.stat(filepath);
          return {
            filename,
            size: stats.size,
            url: `/uploads/gifts/${filename}`,
            type: filename.endsWith('.webp') ? 'static' :
                  filename.endsWith('.tgs') ? 'lottie-compressed' :
                  filename.endsWith('.json') ? 'lottie-json' :
                  filename.endsWith('.webm') ? 'video' : 'unknown'
          };
        })
      );

      res.json({
        total: fileStats.length,
        files: fileStats
      });
    } catch (error) {
      res.json({
        total: 0,
        files: [],
        message: 'Директория пуста или не существует'
      });
    }
  } catch (error) {
    console.error('Ошибка при получении списка файлов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});


app.post('/api/gifts/withdraw', async (req, res) => {
  try {
    const { giftId, toId } = req.body;

    if (!giftId || !toId) {
      return res.status(400).json({ error: 'Нет giftId или toId' });
    }

    const result = await pool.query(
      'SELECT * FROM gifts WHERE gift_id = $1 AND is_withdrawn = FALSE',
      [giftId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Подарок не найден или уже выведен' });
    }

    const gift = result.rows[0];

    if (!telegramClient) {
      return res.status(503).json({ error: 'Telegram клиент не подключен' });
    }

    const { Api } = require('telegram');

    console.log(`📤 Вывод подарка ${giftId} → ${toId}`);

    const MY_ID = '6387280083';

    const dialogs = await telegramClient.invoke(
      new Api.messages.GetDialogs({
        offsetDate: 0,
        offsetId: 0,
        offsetPeer: new Api.InputPeerEmpty(),
        limit: 100,
        hash: BigInt(0)
      })
    );

    const recipient = dialogs.users.find(u => u.id.toString() === toId);
    if (!recipient) {
      return res.status(404).json({ error: 'Получатель не найден' });
    }

    const me = dialogs.users.find(u => u.id.toString() === MY_ID);
    if (!me) {
      return res.status(404).json({ error: 'Твой аккаунт не найден' });
    }

    const originalSender = dialogs.users.find(u => u.id.toString() === gift.from_id);
    if (!originalSender) {
      return res.status(404).json({ error: 'Оригинальный отправитель не найден' });
    }

    console.log(`✅ Получатель: ${recipient.id}, Отправитель (ты): ${me.id}`);

    const history = await telegramClient.invoke(
      new Api.messages.GetHistory({
        peer: new Api.InputPeerUser({
          userId: originalSender.id,
          accessHash: originalSender.accessHash
        }),
        offsetId: 0,
        offsetDate: 0,
        addOffset: 0,
        limit: 50,
        maxId: 0,
        minId: 0,
        hash: BigInt(0)
      })
    );

    console.log(`📜 Получено ${history.messages.length} сообщений`);

    let msgId = null;
    for (const msg of history.messages) {
      if (msg.action && 
          msg.action.className === 'MessageActionStarGiftUnique' &&
          msg.action.gift?.id?.toString() === giftId) {
        msgId = msg.id;
        console.log(`✅ Найден msgId: ${msgId}`);
        break;
      }
    }

    if (!msgId) {
      return res.status(400).json({ error: 'msgId не найден' });
    }

    const inputSavedGift = new Api.InputSavedStarGiftUser({
      userId: new Api.InputUser({
        userId: originalSender.id,
        accessHash: originalSender.accessHash
      }),
      msgId: msgId
    });

    const recipientPeer = new Api.InputPeerUser({
      userId: recipient.id,
      accessHash: recipient.accessHash
    });

    const invoice = new Api.InputInvoiceStarGiftTransfer({
      stargift: inputSavedGift,
      toId: recipientPeer
    });

    console.log(`💳 Запрос формы...`);

    const paymentForm = await telegramClient.invoke(
      new Api.payments.GetPaymentForm({
        invoice: invoice
      })
    );

    console.log(`💳 Оплата звездами через sendStarsForm...`);

    // Для звезд используем payments.sendStarsForm
    await telegramClient.invoke(
      new Api.payments.SendStarsForm({
        formId: paymentForm.formId,
        invoice: invoice
      })
    );

    console.log(`✅ Подарок передан`);

    await pool.query(
      `UPDATE gifts 
       SET is_withdrawn = TRUE, 
           withdrawn_at = CURRENT_TIMESTAMP, 
           withdrawn_to_id = $1 
       WHERE gift_id = $2`,
      [toId, giftId]
    );

    res.json({ success: true, giftId: giftId });

  } catch (error) {
    console.error('❌ Ошибка:', error);
    res.status(500).json({ 
      error: 'Ошибка вывода',
      details: error.message 
    });
  }
});


// Update user badge parameters (whale status, audience)
app.post('/api/user/:telegramId/badge-params', async (req, res) => {
  const client = await pool.connect();
  try {
    const { telegramId } = req.params;
    const { isWhale, telegramAudience } = req.body;

    // Проверяем существование пользователя
    const checkResult = await client.query(
      'SELECT telegram_id FROM users WHERE telegram_id = $1',
      [telegramId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Обновляем параметры (триггер автоматически пересчитает плашку)
    const updates = [];
    const values = [];
    let valueIndex = 1;

    if (typeof isWhale === 'boolean') {
      updates.push(`is_whale = $${valueIndex}`);
      values.push(isWhale);
      valueIndex++;
    }

    if (typeof telegramAudience === 'number') {
      updates.push(`telegram_audience = $${valueIndex}`);
      values.push(telegramAudience);
      valueIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Нет параметров для обновления' });
    }

    values.push(telegramId);
    const updateQuery = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE telegram_id = $${valueIndex}
      RETURNING badge_status, commission_rate, is_whale, telegram_audience
    `;

    const result = await client.query(updateQuery, values);
    const updatedUser = result.rows[0];

    res.json({
      success: true,
      user: {
        telegramId: parseInt(telegramId),
        badgeStatus: updatedUser.badge_status,
        commissionRate: parseFloat(updatedUser.commission_rate),
        isWhale: updatedUser.is_whale,
        telegramAudience: updatedUser.telegram_audience
      }
    });

  } catch (error) {
    console.error('Ошибка обновления параметров плашки:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    client.release();
  }
});

// Get badge statistics
app.get('/api/badges/stats', async (req, res) => {
  try {
    const statsResult = await pool.query(`
      SELECT 
        badge_status,
        COUNT(*) as user_count,
        AVG(commission_rate) as avg_commission,
        AVG(rating) as avg_rating,
        AVG(total_deals) as avg_deals,
        MIN(commission_rate) as min_commission,
        MAX(commission_rate) as max_commission
      FROM users
      GROUP BY badge_status
      ORDER BY 
        CASE badge_status
          WHEN 'DADDY' THEN 1
          WHEN 'INFL' THEN 2
          WHEN 'RESIDENT' THEN 3
          WHEN 'JOKER' THEN 4
          WHEN 'GUEST' THEN 5
          WHEN 'SCAM' THEN 6
          ELSE 99
        END;
    `);

    const totalUsers = await pool.query('SELECT COUNT(*) as total FROM users');

    res.json({
      total: parseInt(totalUsers.rows[0].total),
      badges: statsResult.rows.map(row => ({
        badge: row.badge_status,
        userCount: parseInt(row.user_count),
        avgCommission: parseFloat(row.avg_commission).toFixed(2),
        avgRating: parseFloat(row.avg_rating).toFixed(2),
        avgDeals: Math.round(parseFloat(row.avg_deals)),
        minCommission: parseFloat(row.min_commission),
        maxCommission: parseFloat(row.max_commission)
      }))
    });

  } catch (error) {
    console.error('Ошибка получения статистики плашек:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});


// ============ STARS PAYMENT ENDPOINTS ============

// Создание Stars invoice
app.post('/api/stars/create-invoice', async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Неверные параметры' });
    }

    // Проверяем пользователя
    const userResult = await pool.query(
      'SELECT telegram_id FROM users WHERE telegram_id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const BOT_TOKEN = process.env.BOT_TOKEN;
    if (!BOT_TOKEN) {
      return res.status(500).json({ error: 'BOT_TOKEN не настроен' });
    }

    // Создаем invoice через Bot API
    const invoiceData = {
      title: 'Пополнение Stars',
      description: `Пополнение баланса на ${amount} Stars`,
      payload: JSON.stringify({ 
        userId, 
        amount,
        type: 'stars_deposit',
        timestamp: Date.now()
      }),
      currency: 'XTR', // Специальная валюта для Stars
      prices: [
        {
          label: 'Stars',
          amount: parseInt(amount) // Цена в Stars (целое число)
        }
      ]
    };

    // Создаем invoice link
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
      }
    );

    const data = await response.json();

    if (!data.ok) {
      console.error('❌ Ошибка создания invoice:', data);
      return res.status(500).json({ 
        error: 'Ошибка создания платежа',
        details: data.description 
      });
    }

    console.log('✅ Stars invoice создан:', data.result);

    res.json({
      success: true,
      invoiceLink: data.result
    });

  } catch (error) {
    console.error('❌ Ошибка создания Stars invoice:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Webhook для обработки успешной оплаты Stars
app.post('/api/stars/webhook', async (req, res) => {
  const client = await pool.connect();
  try {
    const update = req.body;

    console.log('📥 Stars webhook получен:', JSON.stringify(update, null, 2));

    // Проверяем что это успешная оплата
    if (update.pre_checkout_query) {
      // Pre-checkout query - отвечаем OK
      const BOT_TOKEN = process.env.BOT_TOKEN;
      await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pre_checkout_query_id: update.pre_checkout_query.id,
            ok: true
          })
        }
      );
      
      return res.json({ ok: true });
    }

    if (update.message?.successful_payment) {
      const payment = update.message.successful_payment;
      const payload = JSON.parse(payment.invoice_payload);

      console.log('✅ Успешная оплата Stars:', {
        userId: payload.userId,
        amount: payload.amount,
        totalAmount: payment.total_amount
      });

      await client.query('BEGIN');

      // Обновляем баланс пользователя
      const result = await client.query(
        `UPDATE users 
         SET stars_balance = stars_balance + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE telegram_id = $2
         RETURNING stars_balance`,
        [payload.amount, payload.userId]
      );

      if (result.rows.length > 0) {
        console.log(`✅ Stars баланс обновлен для пользователя ${payload.userId}: +${payload.amount}`);
      }

      await client.query('COMMIT');

      return res.json({ ok: true });
    }

    res.json({ ok: true });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка обработки Stars webhook:', error);
    res.status(500).json({ error: 'Ошибка обработки платежа' });
  } finally {
    client.release();
  }
});

// Проверка статуса Stars баланса
app.get('/api/stars/balance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      'SELECT stars_balance FROM users WHERE telegram_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({
      userId: parseInt(userId),
      starsBalance: parseFloat(result.rows[0].stars_balance)
    });

  } catch (error) {
    console.error('Ошибка получения Stars баланса:', error);
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

    // Инициализация WebSocket
    initGuaranteeSocket(io, pool);

    // Инициализация API эндпоинтов
    setupGuaranteeAPI(app, pool);

    // Запуск Express сервера
    const server = server.listen(PORT, () => {
      console.log('═'.repeat(50));
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`🔌 WebSocket готов`);
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