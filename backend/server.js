// backend/server.js

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;

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

// API: Получение или создание пользователя
app.post('/api/user/init', async (req, res) => {
  const client = await pool.connect();
  try {
    const { initData, referralCode } = req.body;
    
    // Валидация данных (в dev режиме можем использовать тестовые данные)
    let userData;
    if (initData && initData !== 'dev') {
      userData = validateTelegramData(initData);
    } else {
      // Тестовые данные для разработки
      userData = {
        id: Math.floor(Math.random() * 1000000000),
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser'
      };
    }

    if (!userData) {
      return res.status(400).json({ error: 'Неверные данные' });
    }

    await client.query('BEGIN');

    // Проверяем, существует ли пользователь
    let userResult = await client.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [userData.id]
    );

    let user = userResult.rows[0];

    if (!user) {
      // Создаем нового пользователя
      const newReferralCode = await generateUniqueReferralCode();
      
      // Проверяем реферальный код, если был передан
      let referrerId = null;
      if (referralCode) {
        const referrerResult = await client.query(
          'SELECT telegram_id FROM users WHERE referral_code = $1',
          [referralCode]
        );
        if (referrerResult.rows.length > 0) {
          referrerId = referrerResult.rows[0].telegram_id;
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

      // Если был реферер, создаем запись в таблице рефералов
      if (referrerId) {
        await client.query(
          'INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2)',
          [referrerId, userData.id]
        );
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

    res.json({
      user: {
        id: user.telegram_id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        referralCode: user.referral_code,
        balance: parseFloat(user.balance),
        totalDeals: user.total_deals,
        rating: parseFloat(user.rating)
      },
      referralStats: {
        totalReferrals: parseInt(referralStats.total_referrals) || 0,
        totalEarned: parseFloat(referralStats.total_earned) || 0
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при инициализации пользователя:', error);
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

// Обработка завершения работы
process.on('SIGTERM', async () => {
  console.log('SIGTERM получен, закрываем соединения...');
  await pool.end();
  process.exit(0);
});

// Запуск сервера
async function startServer() {
  try {
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`🗄️  База данных: PostgreSQL`);
      console.log(`📡 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Ошибка запуска сервера:', error);
    process.exit(1);
  }
}

startServer();