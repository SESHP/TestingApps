// backend/middleware/rateLimiter.js
// Rate limiting для защиты от DDoS и брутфорса

const rateLimit = require('express-rate-limit');

/**
 * Общий лимит для всех API запросов
 * 100 запросов за 15 минут с одного IP
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // Максимум 100 запросов
  message: {
    error: 'Too many requests',
    message: 'Слишком много запросов с вашего IP, попробуйте позже'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Ключ для идентификации клиента (по IP)
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  }
});

/**
 * Строгий лимит для критичных операций
 * 10 запросов за час - для создания сделок, вывода подарков и т.д.
 */
const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 10, // Максимум 10 запросов
  message: {
    error: 'Too many operations',
    message: 'Превышен лимит операций. Попробуйте через час'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Для аутентифицированных запросов используем userId
    if (req.userId) {
      return `user-${req.userId}`;
    }
    return req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  }
});

/**
 * Лимит для авторизации
 * 5 попыток за 15 минут
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // Максимум 5 попыток
  message: {
    error: 'Too many authentication attempts',
    message: 'Слишком много попыток авторизации. Подождите 15 минут'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Блокируем по IP для защиты от брутфорса
  skipSuccessfulRequests: true // Не считаем успешные запросы
});

/**
 * Умеренный лимит для чтения данных
 * 200 запросов за 15 минут
 */
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 200, // Максимум 200 запросов
  message: {
    error: 'Too many requests',
    message: 'Слишком много запросов, попробуйте позже'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Лимит для WebSocket подключений
 * 5 подключений за минуту с одного IP
 */
const websocketLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 5, // Максимум 5 подключений
  message: {
    error: 'Too many WebSocket connections',
    message: 'Слишком много попыток подключения WebSocket'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  generalLimiter,
  strictLimiter,
  authLimiter,
  readLimiter,
  websocketLimiter
};
