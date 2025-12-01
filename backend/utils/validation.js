// backend/utils/validation.js
// Валидация и санитизация входных данных

const validator = require('validator');

/**
 * Санитизация пользовательских данных от XSS
 */
function sanitizeUserData(userData) {
  if (!userData) return null;

  return {
    id: userData.id, // ID не санитизируем, это число
    first_name: validator.escape(String(userData.first_name || '')),
    last_name: validator.escape(String(userData.last_name || '')),
    username: validator.escape(String(userData.username || '')),
    photo_url: userData.photo_url ? validator.escape(String(userData.photo_url)) : null,
    is_bot: Boolean(userData.is_bot),
    is_premium: Boolean(userData.is_premium),
    language_code: userData.language_code || 'ru'
  };
}

/**
 * Валидация telegram ID
 */
function validateTelegramId(id) {
  if (!id) return false;

  const numId = parseInt(id);
  if (isNaN(numId)) return false;

  // Telegram ID должен быть положительным числом
  if (numId <= 0) return false;

  // Telegram ID обычно не превышает определенного лимита
  if (numId > 9999999999) return false;

  return true;
}

/**
 * Валидация реферального кода
 */
function validateReferralCode(code) {
  if (!code) return false;

  // Реферальный код должен быть 8 символов, только заглавные буквы и цифры
  const pattern = /^[A-F0-9]{8}$/;
  return pattern.test(code);
}

/**
 * Валидация invite кода для сделок
 */
function validateInviteCode(code) {
  if (!code) return false;

  // Invite код должен быть 8 символов, только заглавные буквы и цифры
  const pattern = /^[A-F0-9]{8}$/;
  return pattern.test(code);
}

/**
 * Валидация числовых параметров с диапазоном
 */
function validateNumber(value, min = -Infinity, max = Infinity) {
  const num = parseInt(value);

  if (isNaN(num)) return false;
  if (num < min || num > max) return false;

  return true;
}

/**
 * Валидация суммы Stars
 */
function validateStarsAmount(amount) {
  const num = parseInt(amount);

  if (isNaN(num)) return false;
  if (num <= 0) return false;
  if (num > 100000) return false; // Максимум 100k Stars за раз

  return true;
}

/**
 * Валидация gift ID
 */
function validateGiftId(id) {
  if (!id) return false;

  const numId = parseInt(id);
  if (isNaN(numId)) return false;
  if (numId <= 0) return false;

  return true;
}

/**
 * Валидация deal ID
 */
function validateDealId(id) {
  if (!id) return false;

  const numId = parseInt(id);
  if (isNaN(numId)) return false;
  if (numId <= 0) return false;

  return true;
}

/**
 * Санитизация строки для SQL (дополнительная защита)
 */
function sanitizeForSql(str) {
  if (!str) return '';

  // Убираем потенциально опасные символы
  return String(str).replace(/['";\\]/g, '');
}

/**
 * Валидация параметров пагинации
 */
function validatePagination(limit, offset) {
  const validLimit = validateNumber(limit, 1, 100);
  const validOffset = validateNumber(offset, 0, 999999);

  return {
    valid: validLimit && validOffset,
    limit: validLimit ? parseInt(limit) : 50,
    offset: validOffset ? parseInt(offset) : 0
  };
}

/**
 * Валидация boolean параметра
 */
function validateBoolean(value) {
  if (value === true || value === false) return true;
  if (value === 'true' || value === 'false') return true;
  return false;
}

/**
 * Парсинг boolean значения
 */
function parseBoolean(value) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
}

/**
 * Валидация параметров плашки
 */
function validateBadgeParams(isWhale, telegramAudience) {
  const errors = [];

  if (isWhale !== undefined && typeof isWhale !== 'boolean') {
    errors.push('isWhale must be boolean');
  }

  if (telegramAudience !== undefined) {
    const num = parseInt(telegramAudience);
    if (isNaN(num) || num < 0 || num > 100000000) {
      errors.push('telegramAudience must be a number between 0 and 100000000');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  sanitizeUserData,
  validateTelegramId,
  validateReferralCode,
  validateInviteCode,
  validateNumber,
  validateStarsAmount,
  validateGiftId,
  validateDealId,
  sanitizeForSql,
  validatePagination,
  validateBoolean,
  parseBoolean,
  validateBadgeParams
};
