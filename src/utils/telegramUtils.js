// src/utils/telegramUtils.js

/**
 * Получить информацию о пользователе из Telegram
 * @returns {Object} Объект с данными пользователя или null, если не в Telegram
 */
export const getTelegramUser = () => {
  try {
    // Проверяем, доступна ли Telegram Web App API
    if (window.Telegram && window.Telegram.WebApp) {
      const initData = window.Telegram.WebApp.initDataUnsafe;
      
      if (initData && initData.user) {
        return {
          id: initData.user.id,
          firstName: initData.user.first_name,
          lastName: initData.user.last_name || '',
          username: initData.user.username || '',
          photoUrl: initData.user.photo_url || null,
          isBot: initData.user.is_bot || false,
          isPremium: initData.user.is_premium || false,
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Ошибка при получении пользователя Telegram:', error);
    return null;
  }
};

/**
 * Получить полное имя пользователя
 * @param {Object} user - Объект пользователя
 * @returns {String} Полное имя
 */
export const getFullName = (user) => {
  if (!user) return 'Гость';
  return `${user.firstName} ${user.lastName}`.trim();
};

/**
 * Получить текущую тему Telegram (светлая/тёмная)
 * @returns {String} 'light' или 'dark'
 */
export const getTelegramTheme = () => {
  try {
    if (window.Telegram && window.Telegram.WebApp) {
      return window.Telegram.WebApp.colorScheme; // 'light' или 'dark'
    }
  } catch (error) {
    console.error('Ошибка при получении темы:', error);
  }
  return 'light';
};

/**
 * Закрыть приложение (вернуться в Telegram)
 */
export const closeApp = () => {
  try {
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.close();
    }
  } catch (error) {
    console.error('Ошибка при закрытии приложения:', error);
  }
};

/**
 * Показать уведомление (haptic feedback - вибрация)
 * @param {String} type - 'impact', 'notification', 'selection'
 */
export const hapticFeedback = (type = 'impact') => {
  try {
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.HapticFeedback.impact({ intensity: 'medium' });
    }
  } catch (error) {
    console.error('Ошибка с haptic feedback:', error);
  }
};
