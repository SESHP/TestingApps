// backend/middleware/auth.js
// Middleware для аутентификации API запросов

const { validateTelegramData } = require('../utils/telegramAuth');

/**
 * Middleware для проверки аутентификации пользователя
 * Проверяет Telegram WebApp initData в заголовке запроса
 */
function authenticateUser(req, res, next) {
  // Получаем initData из заголовка
  const initData = req.headers['x-telegram-init-data'] || req.body.initData;
  const botToken = process.env.BOT_TOKEN;

  // В production обязательно требуем BOT_TOKEN
  if (process.env.NODE_ENV === 'production' && !botToken) {
    console.error('❌ BOT_TOKEN not configured in production');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Валидируем данные Telegram
  const userData = validateTelegramData(initData, botToken);

  if (!userData) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired Telegram authentication data'
    });
  }

  // Добавляем проверенные данные пользователя в request
  req.user = userData;
  req.userId = userData.id;

  next();
}

/**
 * Опциональная аутентификация - не блокирует запрос, но добавляет user если данные валидны
 * Полезно для публичных endpoints которые могут работать и без авторизации
 */
function optionalAuth(req, res, next) {
  const initData = req.headers['x-telegram-init-data'] || req.body.initData;
  const botToken = process.env.BOT_TOKEN;

  if (initData) {
    const userData = validateTelegramData(initData, botToken);
    if (userData) {
      req.user = userData;
      req.userId = userData.id;
    }
  }

  next();
}

/**
 * Проверка что userId в параметрах совпадает с аутентифицированным пользователем
 * Использовать ПОСЛЕ authenticateUser
 */
function requireOwnUser(req, res, next) {
  const paramUserId = req.params.userId || req.params.telegramId;
  const authenticatedUserId = String(req.userId);

  if (String(paramUserId) !== authenticatedUserId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access your own data'
    });
  }

  next();
}

/**
 * Проверка участия в сделке
 * Использовать для endpoints связанных со сделками
 */
async function requireDealParticipant(pool) {
  return async (req, res, next) => {
    const dealId = req.params.dealId || req.body.dealId;
    const userId = req.userId;

    if (!dealId) {
      return res.status(400).json({ error: 'Deal ID required' });
    }

    try {
      const result = await pool.query(
        'SELECT * FROM deals WHERE id = $1 AND (creator_id = $2 OR participant_id = $2)',
        [dealId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You are not a participant of this deal'
        });
      }

      req.deal = result.rows[0];
      next();
    } catch (error) {
      console.error('Error checking deal participant:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}

module.exports = {
  authenticateUser,
  optionalAuth,
  requireOwnUser,
  requireDealParticipant
};
