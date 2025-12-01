// backend/middleware/errorHandler.js
// Централизованная обработка ошибок

/**
 * Централизованный обработчик ошибок
 * Скрывает детали ошибок в production, логирует все
 */
function errorHandler(err, req, res, next) {
  // Логируем полную ошибку на сервере
  console.error('❌ Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.userId
  });

  // Определяем статус код
  const statusCode = err.statusCode || err.status || 500;

  // В production скрываем детали ошибок
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal server error'
    : err.message || 'An error occurred';

  // Отправляем ответ
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err.details
    })
  });
}

/**
 * Обработчик для 404 - маршрут не найден
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found'
  });
}

/**
 * Создание кастомной ошибки с статус кодом
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // Отличаем наши ошибки от системных

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Обработка необработанных ошибок в промисах
 */
function handleUnhandledRejection() {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    // В production можно отправить в систему мониторинга (Sentry и т.д.)
  });
}

/**
 * Обработка необработанных исключений
 */
function handleUncaughtException() {
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    // В production можно отправить в систему мониторинга

    // Graceful shutdown
    process.exit(1);
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
  AppError,
  handleUnhandledRejection,
  handleUncaughtException
};
