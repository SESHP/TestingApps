// backend/utils/telegramAuth.js
// Модуль для безопасной валидации данных Telegram WebApp

const crypto = require('crypto');

/**
 * Валидация данных Telegram WebApp с проверкой HMAC подписи
 * @param {string} initData - строка initData от Telegram
 * @param {string} botToken - токен бота
 * @returns {Object|null} - данные пользователя или null если валидация не прошла
 */
function validateTelegramWebAppData(initData, botToken) {
  if (!initData || !botToken) {
    console.error('❌ Missing initData or botToken');
    return null;
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash) {
      console.error('❌ No hash in initData');
      return null;
    }

    // Удаляем hash из параметров для проверки
    params.delete('hash');

    // Создаем строку для проверки (параметры отсортированы по ключу)
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Вычисляем secret key
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Вычисляем hash
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Проверяем подпись
    if (calculatedHash !== hash) {
      console.error('❌ Invalid Telegram WebApp signature');
      return null;
    }

    // Проверяем время (данные не старше 1 часа)
    const authDate = parseInt(params.get('auth_date'));
    if (isNaN(authDate)) {
      console.error('❌ Invalid auth_date');
      return null;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = currentTime - authDate;

    if (timeDiff > 3600) {
      console.error('❌ Telegram data expired (older than 1 hour)');
      return null;
    }

    // Извлекаем данные пользователя
    const userStr = params.get('user');
    if (userStr) {
      const userData = JSON.parse(decodeURIComponent(userStr));
      console.log('✅ Telegram WebApp data validated successfully');
      return userData;
    }

    console.error('❌ No user data in initData');
    return null;

  } catch (error) {
    console.error('❌ Error validating Telegram data:', error.message);
    return null;
  }
}

/**
 * Упрощенная валидация для режима разработки (БЕЗ ПРОВЕРКИ ПОДПИСИ!)
 * ИСПОЛЬЗОВАТЬ ТОЛЬКО В DEV РЕЖИМЕ!
 */
function validateTelegramDataDev(initData) {
  if (initData === 'dev') {
    console.warn('⚠️  DEV MODE: Using test user data');
    return {
      id: 999999999,
      first_name: 'Test',
      last_name: 'User',
      username: 'test_user'
    };
  }

  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (userStr) {
      return JSON.parse(decodeURIComponent(userStr));
    }
  } catch (error) {
    console.error('Error parsing dev data:', error);
  }

  return null;
}

/**
 * Основная функция валидации (выбирает режим в зависимости от окружения)
 */
function validateTelegramData(initData, botToken = null) {
  // В production ОБЯЗАТЕЛЬНО проверяем подпись
  if (process.env.NODE_ENV === 'production') {
    if (!botToken) {
      throw new Error('BOT_TOKEN is required in production');
    }
    return validateTelegramWebAppData(initData, botToken);
  }

  // В dev режиме можно использовать упрощенную валидацию
  // НО лучше всё равно проверять подпись если есть botToken
  if (botToken && initData !== 'dev') {
    return validateTelegramWebAppData(initData, botToken);
  }

  console.warn('⚠️  Running in dev mode without signature validation');
  return validateTelegramDataDev(initData);
}

module.exports = {
  validateTelegramData,
  validateTelegramWebAppData
};
