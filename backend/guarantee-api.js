// backend/guarantee-api.js
// API эндпоинты для гарант-сервиса

const crypto = require('crypto');
const { validateTelegramData } = require('./utils/telegramAuth');
const { strictLimiter, readLimiter } = require('./middleware/rateLimiter');
const { AppError } = require('./middleware/errorHandler');
const { validateTelegramId, sanitizeUserData } = require('./utils/validation');

// Middleware для аутентификации в контексте guarantee API
function authenticateDealRequest(req, res, next) {
  try {
    const initData = req.headers['x-telegram-init-data'] || req.body.initData;
    const botToken = process.env.BOT_TOKEN;

    // ВАЛИДАЦИЯ: Проверяем наличие initData
    if (!initData) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing authentication data (initData required)'
      });
    }

    // ВАЛИДАЦИЯ: В production обязательно требуем BOT_TOKEN
    if (process.env.NODE_ENV === 'production' && !botToken) {
      console.error('❌ BOT_TOKEN not configured in production');
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Authentication service misconfigured'
      });
    }

    const userData = validateTelegramData(initData, botToken);

    if (!userData) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired Telegram authentication data'
      });
    }

    req.user = userData;
    req.userId = userData.id;
    next();
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
}

function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function generateUniqueInviteCode(pool) {
  let code;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    code = generateInviteCode();
    const result = await pool.query(
      'SELECT id FROM deals WHERE invite_code = $1',
      [code]
    );
    isUnique = result.rows.length === 0;
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Не удалось сгенерировать уникальный код');
  }

  return code;
}

function setupGuaranteeAPI(app, pool, io) {
  // Создание новой сделки
  // БЕЗОПАСНОСТЬ: Требуем аутентификацию + strict rate limiting
  app.post('/api/deals/create', strictLimiter, authenticateDealRequest, async (req, res) => {
    try {
      // БЕЗОПАСНОСТЬ: Используем userId из аутентификации, а не из body
      const creatorId = req.userId;

      const inviteCode = await generateUniqueInviteCode(pool);

      const result = await pool.query(
        `INSERT INTO deals (creator_id, invite_code, status)
         VALUES ($1, $2, 'waiting')
         RETURNING *`,
        [creatorId, inviteCode]
      );

      console.log(`✅ Сделка создана: ${result.rows[0].id}, код: ${inviteCode}`);

      res.json({
        success: true,
        deal: result.rows[0]
      });

    } catch (error) {
      console.error('❌ Ошибка создания сделки:', error);
      res.status(500).json({ error: 'Ошибка создания сделки' });
    }
  });

  // Присоединение к сделке
  // БЕЗОПАСНОСТЬ: Требуем аутентификацию + strict rate limiting
  app.post('/api/deals/join', strictLimiter, authenticateDealRequest, async (req, res) => {
    try {
      const { inviteCode } = req.body;
      // БЕЗОПАСНОСТЬ: Используем userId из аутентификации, а не из body
      const participantId = req.userId;

      // ВАЛИДАЦИЯ: Проверяем inviteCode
      if (!inviteCode || typeof inviteCode !== 'string' || inviteCode.length !== 8) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'inviteCode must be an 8-character string'
        });
      }

      // Ищем сделку по коду
      const dealResult = await pool.query(
        'SELECT * FROM deals WHERE invite_code = $1 AND status = $2',
        [inviteCode.toUpperCase(), 'waiting']
      );

      if (dealResult.rows.length === 0) {
        return res.status(404).json({ error: 'Сделка не найдена или уже активна' });
      }

      const deal = dealResult.rows[0];

      // Проверяем, что участник не создатель
      if (deal.creator_id === participantId) {
        return res.status(400).json({ error: 'Вы не можете присоединиться к своей сделке' });
      }

      // Обновляем сделку
      const updateResult = await pool.query(
        `UPDATE deals 
         SET participant_id = $1, status = 'active', updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [participantId, deal.id]
      );

      console.log(`✅ Участник ${participantId} присоединился к сделке ${deal.id}`);

      // ЭМИТИМ СОБЫТИЕ СОЗДАТЕЛЮ
      io.to(`deal-${deal.id}`).emit('participant-joined', {
        dealId: deal.id,
        participantId: participantId
      });

      res.json({
        success: true,
        deal: updateResult.rows[0]
      });

    } catch (error) {
      console.error('❌ Ошибка присоединения к сделке:', error);
      res.status(500).json({ error: 'Ошибка присоединения к сделке' });
    }
  });

  // Получить подарки в сделке
  app.get('/api/deals/:dealId/gifts', readLimiter, async (req, res) => {
    try {
      const { dealId } = req.params;

      // ВАЛИДАЦИЯ: Проверяем dealId
      const dealIdNum = parseInt(dealId);
      if (isNaN(dealIdNum) || dealIdNum <= 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'dealId must be a positive integer'
        });
      }

      const result = await pool.query(
        `SELECT dg.*, g.gift_title, g.model, g.background, g.symbol, g.raw_data
         FROM deal_gifts dg
         JOIN gifts g ON dg.gift_id = g.id
         WHERE dg.deal_id = $1
         ORDER BY dg.added_at ASC`,
        [dealId]
      );

      const gifts = {};
      for (const row of result.rows) {
        const userId = String(row.user_id); // Приводим к строке!
        if (!gifts[userId]) {
          gifts[userId] = [];
        }
        gifts[userId].push({
          id: row.gift_id,
          giftTitle: row.gift_title,
          model: row.model,
          background: row.background,
          symbol: row.symbol,
          raw_data: row.raw_data, // используем snake_case как в базе
          addedAt: row.added_at
        });
      }

      res.json({ gifts });

    } catch (error) {
      console.error('❌ Ошибка получения подарков сделки:', error);
      res.status(500).json({ error: 'Ошибка получения подарков' });
    }
  });

  // Получить информацию о сделке
  app.get('/api/deals/:dealId', readLimiter, async (req, res) => {
    try {
      const { dealId } = req.params;

      // ВАЛИДАЦИЯ: Проверяем dealId
      const dealIdNum = parseInt(dealId);
      if (isNaN(dealIdNum) || dealIdNum <= 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'dealId must be a positive integer'
        });
      }

      const result = await pool.query(
        'SELECT * FROM deals WHERE id = $1',
        [dealId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Сделка не найдена' });
      }

      res.json({ deal: result.rows[0] });

    } catch (error) {
      console.error('❌ Ошибка получения сделки:', error);
      res.status(500).json({ error: 'Ошибка получения сделки' });
    }
  });

  // Получить активные сделки пользователя
  app.get('/api/deals/user/:userId', readLimiter, async (req, res) => {
    try {
      const { userId } = req.params;

      // ВАЛИДАЦИЯ: Проверяем userId
      if (!validateTelegramId(userId)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'userId must be a valid Telegram user ID'
        });
      }

      const result = await pool.query(
        `SELECT * FROM deals 
         WHERE (creator_id = $1 OR participant_id = $1) 
         AND status IN ('waiting', 'active')
         ORDER BY created_at DESC`,
        [userId]
      );

      res.json({ deals: result.rows });

    } catch (error) {
      console.error('❌ Ошибка получения сделок пользователя:', error);
      res.status(500).json({ error: 'Ошибка получения сделок' });
    }
  });
}

module.exports = { setupGuaranteeAPI };