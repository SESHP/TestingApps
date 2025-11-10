// backend/server.js

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');

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

// Инициализация базы данных
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

    // Создание индекса для telegram_id
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)
    `);

    // Создание индекса для referral_code
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

    // Создание индексов для referrals
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id)
    `);

    console.log('✅ База данных PostgreSQL инициализирована');
  } catch (error) {
    console.error('❌ Ошибка инициализации базы данных:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Инициализация Telegram клиента
 */
let telegramClient;
async function initTelegramClient() {
  const session = new StringSession(SESSION_STRING);
  
  telegramClient = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
  });

  await telegramClient.connect();
  console.log('✅ Telegram клиент подключен');
}

/**
 * Парсинг подарков из аккаунта @FNPK3
 * 
 * ВАЖНО: Для получения подарков нужно:
 * 1. Использовать Telegram Bot API или MTProto
 * 2. Получить доступ к аккаунту @FNPK3 (через бота или user account)
 * 3. Извлечь информацию о подарках и отправителях
 */
async function parseGiftsFromAccount(targetUsername = 'FNPK3') {
  try {
    if (!telegramClient) {
      throw new Error('Telegram клиент не инициализирован');
    }

    // Получаем информацию о пользователе @FNPK3
    const targetUser = await telegramClient.getEntity(targetUsername);
    
    // Получаем подарки (gifts) через Telegram API
    // ВАЖНО: Этот метод зависит от доступных API методов
    // Может потребоваться использование специальных методов для gifts
    
    const gifts = await telegramClient.invoke(
      new Api.payments.GetStarsGifts({
        userId: targetUser.id,
      })
    );

    // Парсим подарки и группируем по отправителям
    const parsedGifts = [];
    
    for (const gift of gifts) {
      const senderId = gift.fromId?.userId?.toString();
      
      if (senderId) {
        parsedGifts.push({
          id: gift.id,
          name: gift.gift?.title || 'Подарок',
          image: gift.gift?.sticker || '🎁',
          date: new Date(gift.date * 1000).toISOString(),
          sender: senderId,
          rawData: gift, // Храним оригинальные данные
        });
      }
    }

    // Группируем подарки по отправителям
    const groupedGifts = new Map();
    
    for (const gift of parsedGifts) {
      const userId = gift.sender;
      
      if (!groupedGifts.has(userId)) {
        groupedGifts.set(userId, []);
      }
      
      groupedGifts.get(userId).push(gift);
    }

    // Обновляем базу данных
    groupedGifts.forEach((userGifts, userId) => {
      giftsDatabase.set(userId, userGifts);
    });

    return parsedGifts;
  } catch (error) {
    console.error('Ошибка парсинга подарков:', error);
    throw error;
  }
}


// Генерация уникального реферального кода
function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// Проверка уникальности реферального кода
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

// Валидация Telegram initData (упрощенная версия)
function validateTelegramData(initData) {
  // В реальном приложении здесь должна быть проверка подписи
  // используя bot token и crypto
  // Для разработки просто парсим данные
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

// Генерация стабильного тестового ID на основе времени запуска сессии
const DEV_SESSION_ID = Math.floor(Date.now() / 10000); // Меняется каждые ~3 часа

function getTestUserData(referralCode = null) {
  // Для тестирования: если есть реферальный код, создаем нового пользователя
  // Иначе используем стабильный ID для основного тестового пользователя
  if (referralCode) {
    return {
      id: Math.floor(Math.random() * 1000000000),
      first_name: 'Invited',
      last_name: 'User',
      username: `invited_${Date.now()}`
    };
  } else {
    return {
      id: 999999999, // Фиксированный ID для главного тестового пользователя
      first_name: 'Test',
      last_name: 'User',
      username: 'test_main_user'
    };
  }
}

// API: Получение или создание пользователя
app.post('/api/user/init', async (req, res) => {
  const client = await pool.connect();
  try {
    const { initData, referralCode } = req.body;
    
    console.log('📥 Запрос инициализации:', { 
      hasInitData: !!initData, 
      referralCode: referralCode || 'none' 
    });
    
    // Валидация данных (в dev режиме можем использовать тестовые данные)
    let userData;
    if (initData && initData !== 'dev') {
      userData = validateTelegramData(initData);
    } else {
      // Тестовые данные для разработки
      userData = getTestUserData(referralCode);
    }

    if (!userData) {
      return res.status(400).json({ error: 'Неверные данные' });
    }

    console.log('👤 Пользователь для обработки:', {
      id: userData.id,
      name: `${userData.first_name} ${userData.last_name}`,
      hasReferralCode: !!referralCode
    });

    await client.query('BEGIN');

    // Проверяем, существует ли пользователь
    let userResult = await client.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [userData.id]
    );

    let user = userResult.rows[0];

    if (!user) {
      console.log('🆕 Создание нового пользователя:', userData.id);
      
      // Создаем нового пользователя
      const newReferralCode = await generateUniqueReferralCode();
      
      // Проверяем реферальный код, если был передан
      let referrerId = null;
      if (referralCode) {
        console.log('🔍 Поиск реферера с кодом:', referralCode);
        
        const referrerResult = await client.query(
          'SELECT telegram_id, first_name, last_name FROM users WHERE referral_code = $1',
          [referralCode.toUpperCase()]
        );
        
        if (referrerResult.rows.length > 0) {
          referrerId = referrerResult.rows[0].telegram_id;
          console.log('✅ Найден реферер:', {
            id: referrerId,
            name: `${referrerResult.rows[0].first_name} ${referrerResult.rows[0].last_name}`
          });
        } else {
          console.log('⚠️ Реферер не найден для кода:', referralCode);
        }
      }

      // Вставляем пользователя
      const insertResult = await client.query(
        `INSERT INTO users (telegram_id, username, first_name, last_name, referral_code, referred_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userData.id, userData.username, userData.first_name, userData.last_name, newReferralCode, referrerId]
      );

      user = insertResult.rows[0];
      console.log('✅ Пользователь создан:', {
        telegram_id: user.telegram_id,
        referral_code: user.referral_code,
        referred_by: user.referred_by
      });

      // Если был реферер, создаем запись в таблице рефералов
      if (referrerId) {
        await client.query(
          'INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2)',
          [referrerId, userData.id]
        );
        console.log('✅ Реферальная связь создана:', { referrerId, referredId: userData.id });
      }
    } else {
      console.log('👤 Существующий пользователь:', user.telegram_id);
      
      // Если пользователь уже существует, но пришел реферальный код
      // и у него еще нет реферера - обновляем
      if (referralCode && !user.referred_by) {
        console.log('🔄 Попытка обновить реферера для существующего пользователя...');
        
        const referrerResult = await client.query(
          'SELECT telegram_id, first_name, last_name FROM users WHERE referral_code = $1',
          [referralCode.toUpperCase()]
        );
        
        if (referrerResult.rows.length > 0) {
          const referrerId = referrerResult.rows[0].telegram_id;
          
          // Обновляем referred_by
          await client.query(
            'UPDATE users SET referred_by = $1 WHERE telegram_id = $2',
            [referrerId, user.telegram_id]
          );
          
          // Создаем связь в referrals
          await client.query(
            'INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [referrerId, user.telegram_id]
          );
          
          user.referred_by = referrerId;
          console.log('✅ Реферер обновлен для существующего пользователя');
        }
      }
    }

    // Получаем статистику рефералов
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

    console.log('✅ Инициализация завершена:', {
      user_id: user.telegram_id,
      referrals: referralStats.total_referrals
    });

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

// API: Получение статистики рефералов
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

// API: Проверка реферального кода
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Debug endpoint - получение всех пользователей (только для разработки)
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

// ============ API ENDPOINTS ============

/**
 * GET /api/gifts/:telegramUserId
 * Получить все подарки конкретного пользователя
 */
app.get('/api/gifts/:telegramUserId', async (req, res) => {
  try {
    const { telegramUserId } = req.params;
    
    // Проверяем, есть ли подарки пользователя в базе
    const userGifts = giftsDatabase.get(telegramUserId) || [];
    
    res.json({
      success: true,
      gifts: userGifts,
      count: userGifts.length,
    });
  } catch (error) {
    console.error('Ошибка получения подарков:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения подарков',
    });
  }
});

/**
 * POST /api/gifts/refresh/:telegramUserId
 * Обновить список подарков (запустить парсинг)
 */
app.post('/api/gifts/refresh/:telegramUserId', async (req, res) => {
  try {
    const { telegramUserId } = req.params;
    
    // Запускаем парсинг подарков
    await parseGiftsFromAccount();
    
    // Получаем обновленный список подарков пользователя
    const userGifts = giftsDatabase.get(telegramUserId) || [];
    
    res.json({
      success: true,
      gifts: userGifts,
      count: userGifts.length,
      message: 'Подарки обновлены',
    });
  } catch (error) {
    console.error('Ошибка обновления подарков:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка обновления подарков',
    });
  }
});

/**
 * POST /api/gifts/verify
 * Проверить владельца подарка
 */
app.post('/api/gifts/verify', async (req, res) => {
  try {
    const { giftId, telegramUserId } = req.body;
    
    const userGifts = giftsDatabase.get(telegramUserId) || [];
    const isOwner = userGifts.some(gift => gift.id === giftId);
    
    res.json({
      success: true,
      isOwner,
    });
  } catch (error) {
    console.error('Ошибка проверки владельца:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка проверки владельца',
    });
  }
});

/**
 * GET /api/gifts/details/:giftId
 * Получить детали конкретного подарка
 */
app.get('/api/gifts/details/:giftId', async (req, res) => {
  try {
    const { giftId } = req.params;
    
    // Ищем подарок во всей базе
    let foundGift = null;
    
    for (const [userId, gifts] of giftsDatabase.entries()) {
      const gift = gifts.find(g => g.id === giftId);
      if (gift) {
        foundGift = { ...gift, ownerId: userId };
        break;
      }
    }
    
    if (!foundGift) {
      return res.status(404).json({
        success: false,
        error: 'Подарок не найден',
      });
    }
    
    res.json({
      success: true,
      gift: foundGift,
    });
  } catch (error) {
    console.error('Ошибка получения деталей подарка:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения деталей подарка',
    });
  }
});



// Обработка завершения работы
process.on('SIGTERM', async () => {
  console.log('SIGTERM получен, закрываем соединения...');
  await pool.end();
  process.exit(0);
});




// Запуск сервера с автоматическим выбором порта
async function startServer() {
  try {
    await initDatabase();
    await initTelegramClient();
    
    console.log('🔄 Запуск первоначального парсинга подарков...');
    await parseGiftsFromAccount();
    console.log('✅ Первоначальный парсинг завершен');
    
    // Периодическое обновление (каждые 5 минут)
    setInterval(async () => {
      console.log('🔄 Периодическое обновление подарков...');
      try {
        await parseGiftsFromAccount();
        console.log('✅ Подарки обновлены');
      } catch (error) {
        console.error('❌ Ошибка периодического обновления:', error);
      }
    }, 5 * 60 * 1000);
    

    const server = app.listen(PORT, () => {
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`🗄️  База данных: PostgreSQL`);
      console.log(`📡 Health check: http://localhost:${PORT}/health`);
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
    console.error('❌ Ошибка запуска сервера:', error);
    process.exit(1);
  }
}

startServer();