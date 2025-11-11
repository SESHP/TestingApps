// backend/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');
const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');

const app = express();
let PORT = process.env.PORT || 3001;

// Telegram конфигурация
const API_ID = parseInt(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH;
const SESSION_STRING = process.env.TELEGRAM_SESSION || '';

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

// Глобальный Telegram клиент
let telegramClient = null;

// База данных подарков (в памяти)
const giftsDatabase = new Map();

// ============ TELEGRAM CLIENT FUNCTIONS ============

/**
 * Инициализация Telegram клиента
 */
async function initTelegramClient() {
  if (!API_ID || !API_HASH) {
    throw new Error('API_ID и API_HASH должны быть заданы в .env');
  }

  const session = new StringSession(SESSION_STRING);
  
  telegramClient = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
  });

  await telegramClient.connect();
  
  const me = await telegramClient.getMe();
  console.log(`✅ Подключено как: ${me.firstName} ${me.lastName || ''}`);
  console.log(`📱 ID: ${me.id}\n`);
  
  return telegramClient;
}

/**
 * Получение информации об отправителе подарка
 */
async function getSenderInfo(senderId) {
  if (!senderId) return null;
  
  try {
    const sender = await telegramClient.getEntity(senderId);
    return sender;
  } catch (error) {
    console.error('Ошибка получения информации об отправителе:', error.message);
    return null;
  }
}

/**
 * Получение деталей подарка из каталога
 */
async function getGiftDetails(giftId) {
  try {
    const gifts = await telegramClient.invoke(
      new Api.payments.GetStarGifts({ hash: 0 })
    );
    return gifts.gifts?.find(g => g.id === giftId);
  } catch (error) {
    console.error('Ошибка получения деталей подарка:', error.message);
    return null;
  }
}

/**
 * Получение информации об уникальном подарке
 */
async function getUniqueGiftInfo(userId, messageId) {
  try {
    const userGifts = await telegramClient.invoke(
      new Api.payments.GetUserStarGifts({
        userId: userId,
        offset: '',
        limit: 100,
      })
    );
    const giftEntry = userGifts.gifts?.find(g => g.msgId === messageId);
    return giftEntry?.gift || null;
  } catch (error) {
    console.error('Ошибка получения уникального подарка:', error.message);
    return null;
  }
}

/**
 * Парсинг данных подарка
 */
function parseGiftData(message, senderInfo, giftDetails, uniqueGift) {
  const giftAction = message.action;
  
  const baseData = {
    messageId: message.id,
    receivedAt: new Date(message.date * 1000).toISOString(),
    message: message.message || null,
  };
  
  // Информация об отправителе
  const senderId = message.senderId?.value || message.fromId?.userId?.value;
  baseData.sender = senderId ? {
    id: senderId,
    firstName: senderInfo?.firstName || null,
    lastName: senderInfo?.lastName || null,
    username: senderInfo?.username || null,
    phone: senderInfo?.phone || null,
  } : {
    anonymous: true
  };
  
  // Тип подарка
  if (giftAction.className === 'MessageActionGiftPremium') {
    baseData.type = 'premium';
    baseData.gift = {
      months: giftAction.months,
      currency: giftAction.currency,
      amount: giftAction.amount,
    };
  } else if (giftAction.className === 'MessageActionStarGift') {
    baseData.type = 'star_gift';
    baseData.gift = {
      id: giftAction.gift?.id || null,
      stars: giftAction.stars || 0,
      convertStars: giftAction.convertStars || 0,
      saved: giftAction.saved || false,
    };
    
    // Детали из каталога
    if (giftDetails) {
      baseData.gift.availability = {
        remains: giftDetails.availabilityRemains,
        total: giftDetails.availabilityTotal,
      };
      baseData.gift.firstSale = new Date(giftDetails.firstSaleDate * 1000).toISOString();
      baseData.gift.lastSale = new Date(giftDetails.lastSaleDate * 1000).toISOString();
    }
    
    // Уникальный подарок
    if (giftAction.upgrade && uniqueGift) {
      baseData.unique = {
        title: uniqueGift.title || null,
        number: uniqueGift.num || null,
        ownerName: uniqueGift.ownerName || null,
        birthday: uniqueGift.birthday || null,
        model: {
          name: uniqueGift.model?.title || null,
          documentId: uniqueGift.model?.document?.id?.toString() || null,
        },
        backdrop: {
          name: uniqueGift.backdrop?.title || null,
          colors: {
            center: uniqueGift.backdrop?.centerColor ? 
              `#${uniqueGift.backdrop.centerColor.toString(16).padStart(6, '0')}` : null,
            edge: uniqueGift.backdrop?.edgeColor ? 
              `#${uniqueGift.backdrop.edgeColor.toString(16).padStart(6, '0')}` : null,
            pattern: uniqueGift.backdrop?.patternColor ? 
              `#${uniqueGift.backdrop.patternColor.toString(16).padStart(6, '0')}` : null,
            text: uniqueGift.backdrop?.textColor ? 
              `#${uniqueGift.backdrop.textColor.toString(16).padStart(6, '0')}` : null,
          }
        },
        pattern: {
          name: uniqueGift.pattern?.title || null,
          documentId: uniqueGift.pattern?.document?.id?.toString() || null,
        }
      };
    }
  }
  
  return baseData;
}

/**
 * Форматирование подарка для консоли
 */
function formatGiftForConsole(giftData) {
  let output = '\n' + '═'.repeat(50) + '\n';
  output += `🎁 ПОДАРОК ПОЛУЧЕН\n`;
  output += '═'.repeat(50) + '\n\n';
  
  // Отправитель
  if (giftData.sender.anonymous) {
    output += `👤 Отправитель: Аноним\n`;
  } else {
    output += `👤 Отправитель:\n`;
    output += `   ID: ${giftData.sender.id}\n`;
    output += `   Имя: ${giftData.sender.firstName} ${giftData.sender.lastName || ''}\n`;
    if (giftData.sender.username) {
      output += `   Username: @${giftData.sender.username}\n`;
    }
  }
  
  // Тип подарка
  output += `\n📦 Тип: ${giftData.type === 'premium' ? 'Telegram Premium' : 'Star Gift'}\n`;
  
  // Детали подарка
  if (giftData.type === 'premium') {
    output += `   Месяцев Premium: ${giftData.gift.months}\n`;
  } else {
    output += `   Gift ID: ${giftData.gift.id}\n`;
    output += `   Стоимость: ${giftData.gift.stars} Stars\n`;
    output += `   Конвертируемо: ${giftData.gift.convertStars} Stars\n`;
  }
  
  // Сообщение
  if (giftData.message) {
    output += `\n💬 Сообщение: "${giftData.message}"\n`;
  }
  
  // Уникальный подарок
  if (giftData.unique) {
    output += `\n✨ ════ УНИКАЛЬНЫЙ ПОДАРОК ════\n`;
    output += `   📛 Название: ${giftData.unique.title}\n`;
    output += `   🔢 Номер: #${giftData.unique.number}\n`;
    output += `\n   🏗️ Модель: ${giftData.unique.model.name}\n`;
    output += `   🎨 Фон: ${giftData.unique.backdrop.name}\n`;
    output += `      Центр: ${giftData.unique.backdrop.colors.center}\n`;
    output += `      Края: ${giftData.unique.backdrop.colors.edge}\n`;
    output += `   🔷 Узор: ${giftData.unique.pattern.name}\n`;
    output += `═`.repeat(50) + '\n';
  }
  
  output += `\n📅 Получено: ${new Date(giftData.receivedAt).toLocaleString('ru-RU')}\n`;
  output += '═'.repeat(50) + '\n';
  
  return output;
}

/**
 * Обработчик новых подарков (real-time listener)
 */
async function handleNewGift(message) {
  try {
    console.log('\n🎁 Получен новый подарок!');
    
    const giftAction = message.action;
    const senderId = message.senderId?.value || message.fromId?.userId?.value;
    
    // Получаем дополнительную информацию
    const senderInfo = await getSenderInfo(senderId);
    
    let giftDetails = null;
    let uniqueGift = null;
    
    if (giftAction.className === 'MessageActionStarGift') {
      giftDetails = await getGiftDetails(giftAction.gift?.id);
      
      if (giftAction.upgrade) {
        const me = await telegramClient.getMe();
        uniqueGift = await getUniqueGiftInfo(me.id, message.id);
      }
    }
    
    // Парсим данные подарка
    const giftData = parseGiftData(message, senderInfo, giftDetails, uniqueGift);
    
    // Сохраняем в базу данных
    const senderIdStr = senderId?.toString();
    if (senderIdStr) {
      if (!giftsDatabase.has(senderIdStr)) {
        giftsDatabase.set(senderIdStr, []);
      }
      giftsDatabase.get(senderIdStr).push(giftData);
    }
    
    // Выводим в консоль
    console.log(formatGiftForConsole(giftData));
    
    // Сохраняем в PostgreSQL (опционально)
    await saveGiftToDatabase(giftData);
    
  } catch (error) {
    console.error('❌ Ошибка обработки подарка:', error);
  }
}

/**
 * Добавление слушателя новых подарков
 */
function addGiftListener() {
  if (!telegramClient) {
    throw new Error('Telegram клиент не инициализирован');
  }
  
  telegramClient.addEventHandler(async (event) => {
    const message = event.message;
    
    if (!message.action) return;
    
    if (message.action.className === 'MessageActionGiftPremium' ||
        message.action.className === 'MessageActionStarGift') {
      await handleNewGift(message);
    }
  }, new NewMessage({}));
  
  console.log('✅ Слушатель подарков активирован');
}

/**
 * Парсинг истории подарков из аккаунта
 */
async function parseGiftsHistory(targetUsername = 'me') {
  try {
    if (!telegramClient) {
      throw new Error('Telegram клиент не инициализирован');
    }

    console.log(`🔍 Парсинг истории подарков для: ${targetUsername}`);
    
    // Получаем информацию о пользователе
    const targetUser = await telegramClient.getEntity(targetUsername);
    console.log(`📱 Найден пользователь: ${targetUser.firstName} (ID: ${targetUser.id})`);
    console.log('Вызов GetUserStarGifts...');

    console.log('Вызов GetUserStarGifts...');
    try {
    // Получаем все подарки пользователя
      const userGifts = await telegramClient.invoke(
        new Api.payments.GetUserStarGifts({
          userId: targetUser.id,
          offset: '',
          limit: 100,
    })); } catch (err) {
      console.error('Ошибка invoke:', err);
    }

    console.log(`📦 Найдено подарков: ${userGifts.gifts?.length || 0}`);
    
    const parsedGifts = [];
    
    if (userGifts.gifts) {
      for (const giftEntry of userGifts.gifts) {
        const senderId = giftEntry.fromId?.userId?.toString();
        
        if (senderId) {
          const giftData = {
            id: giftEntry.msgId,
            name: giftEntry.gift?.title || 'Star Gift',
            stars: giftEntry.gift?.stars || 0,
            date: new Date(giftEntry.date * 1000).toISOString(),
            sender: senderId,
            saved: giftEntry.gift?.saved || false,
            message: giftEntry.message?.message || null,
          };
          
          parsedGifts.push(giftData);
          
          // Сохраняем в базу
          if (!giftsDatabase.has(senderId)) {
            giftsDatabase.set(senderId, []);
          }
          giftsDatabase.get(senderId).push(giftData);
        }
      }
    }

    console.log(`✅ Обработано подарков: ${parsedGifts.length}`);
    return parsedGifts;
    
  } catch (error) {
    console.error('❌ Ошибка парсинга истории подарков:', error);
    throw error;
  }
}

/**
 * Сохранение подарка в PostgreSQL
 */
async function saveGiftToDatabase(giftData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Создаем таблицу gifts если её нет
    await client.query(`
      CREATE TABLE IF NOT EXISTS gifts (
        id SERIAL PRIMARY KEY,
        message_id BIGINT,
        sender_id BIGINT,
        sender_username VARCHAR(255),
        gift_type VARCHAR(50),
        gift_data JSONB,
        received_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Вставляем подарок
    await client.query(
      `INSERT INTO gifts (message_id, sender_id, sender_username, gift_type, gift_data, received_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        giftData.messageId,
        giftData.sender.id || null,
        giftData.sender.username || null,
        giftData.type,
        JSON.stringify(giftData),
        giftData.receivedAt
      ]
    );
    
    await client.query('COMMIT');
    console.log('💾 Подарок сохранен в базу данных');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка сохранения подарка:', error);
  } finally {
    client.release();
  }
}

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

// ============ GIFTS API ENDPOINTS ============

/**
 * GET /api/gifts/:telegramUserId
 * Получить все подарки конкретного пользователя
 */
app.get('/api/gifts/:telegramUserId', async (req, res) => {
  try {
    const { telegramUserId } = req.params;
    
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
 * POST /api/gifts/refresh
 * Обновить список подарков (запустить парсинг истории)
 */
app.post('/api/gifts/refresh', async (req, res) => {
  try {
    console.log('🔄 Запуск обновления подарков...');
    
    await parseGiftsHistory();
    
    res.json({
      success: true,
      message: 'Подарки обновлены',
      totalGifts: Array.from(giftsDatabase.values()).flat().length
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
 * GET /api/gifts/all
 * Получить все подарки из базы
 */
app.get('/api/gifts/all', async (req, res) => {
  try {
    const allGifts = [];
    
    for (const [userId, gifts] of giftsDatabase.entries()) {
      gifts.forEach(gift => {
        allGifts.push({
          ...gift,
          ownerId: userId
        });
      });
    }
    
    res.json({
      success: true,
      gifts: allGifts,
      count: allGifts.length,
    });
  } catch (error) {
    console.error('Ошибка получения всех подарков:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения подарков',
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    telegramConnected: !!telegramClient,
    giftsCount: Array.from(giftsDatabase.values()).flat().length
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

// Debug endpoint - статистика подарков
app.get('/api/debug/gifts', (req, res) => {
  try {
    const stats = {
      totalUsers: giftsDatabase.size,
      totalGifts: Array.from(giftsDatabase.values()).flat().length,
      giftsByUser: {}
    };
    
    for (const [userId, gifts] of giftsDatabase.entries()) {
      stats.giftsByUser[userId] = gifts.length;
    }
    
    res.json(stats);
  } catch (error) {
    console.error('Ошибка получения статистики подарков:', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

// ============ SERVER STARTUP ============

// Обработка завершения работы
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

// Запуск сервера
async function startServer() {
  try {
    console.log('🚀 Запуск сервера...\n');
    
    // Инициализация базы данных
    console.log('📊 Инициализация базы данных...');
    await initDatabase();
    
    // Инициализация Telegram клиента
    console.log('📱 Инициализация Telegram клиента...');
    await initTelegramClient();
    
    // Добавление слушателя подарков
    console.log('👂 Добавление слушателя подарков...');
    addGiftListener();
    
    // Парсинг истории подарков
    console.log('🔄 Запуск первоначального парсинга подарков...');
    await parseGiftsHistory();
    console.log('✅ Первоначальный парсинг завершен\n');
    
    // Периодическое обновление (каждые 5 минут)
    setInterval(async () => {
      console.log('🔄 Периодическое обновление подарков...');
      try {
        await parseGiftsHistory();
        console.log('✅ Подарки обновлены');
      } catch (error) {
        console.error('❌ Ошибка периодического обновления:', error);
      }
    }, 5 * 60 * 1000);

    // Запуск Express сервера
    const server = app.listen(PORT, () => {
      console.log('═'.repeat(50));
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`🗄️  База данных: PostgreSQL`);
      console.log(`📱 Telegram: Подключен`);
      console.log(`📡 Health check: http://localhost:${PORT}/health`);
      console.log(`🎁 Подарков в базе: ${Array.from(giftsDatabase.values()).flat().length}`);
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