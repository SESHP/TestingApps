// src/utils/telegramUtils.js

const tg = window.Telegram?.WebApp;

/**
 * Инициализация Telegram Mini App
 */
export function initTelegramApp() {
  if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#000000');
    tg.setBackgroundColor('#000000');
    
    if (tg.disableVerticalSwipes) {
      tg.disableVerticalSwipes();
    }
    
    console.log('✅ Telegram WebApp инициализирован:', {
      version: tg.version,
      platform: tg.platform,
      colorScheme: tg.colorScheme,
      isExpanded: tg.isExpanded,
      viewportHeight: tg.viewportHeight,
      viewportStableHeight: tg.viewportStableHeight,
      user: tg.initDataUnsafe?.user,
      start_param: tg.initDataUnsafe?.start_param // ВАЖНО: логируем start_param
    });
    
    return true;
  } else {
    console.warn('⚠️ Telegram WebApp SDK не найден. Режим разработки.');
    return false;
  }
}

/**
 * НОВАЯ ФУНКЦИЯ: Получить реферальный код из Telegram или URL
 */
export function getReferralCode() {
  // 1. Сначала пробуем получить из start_param (для Mini App)
  if (tg && tg.initDataUnsafe?.start_param) {
    const startParam = tg.initDataUnsafe.start_param;
    console.log('📌 Реферальный код из Telegram start_param:', startParam);
    return startParam;
  }
  
  // 2. Если нет, пробуем из URL параметра ?ref= (для браузера/разработки)
  const urlParams = new URLSearchParams(window.location.search);
  const refFromUrl = urlParams.get('ref');
  
  if (refFromUrl) {
    console.log('📌 Реферальный код из URL параметра:', refFromUrl);
    return refFromUrl;
  }
  
  console.log('ℹ️ Реферальный код не найден');
  return null;
}

/**
 * Получить информацию о пользователе из Telegram
 */
export const getTelegramUser = () => {
  try {
    if (tg && tg.initDataUnsafe?.user) {
      const user = tg.initDataUnsafe.user;
      return {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name || '',
        username: user.username || '',
        photoUrl: user.photo_url || null,
        isBot: user.is_bot || false,
        isPremium: user.is_premium || false,
        languageCode: user.language_code || 'ru'
      };
    }
    
    // Режим разработки - тестовые данные
    console.log('🧪 Dev mode: используем тестовые данные');
    return {
      id: 123456789,
      firstName: 'Test',
      lastName: 'User',
      username: 'testuser',
      photoUrl: null,
      isBot: false,
      isPremium: false,
      languageCode: 'ru'
    };
  } catch (error) {
    console.error('Ошибка при получении пользователя:', error);
    return null;
  }
};

/**
 * Получить полное имя пользователя
 */
export const getFullName = (user) => {
  if (!user) return 'Гость';
  
  const firstName = user.firstName || user.first_name || '';
  const lastName = user.lastName || user.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  
  return fullName || user.username || 'Пользователь';
};

/**
 * Проверить, запущено ли приложение в Telegram
 */
export function isTelegramApp() {
  return !!tg;
}

/**
 * Получить initData для отправки на бэкенд (для валидации)
 */
export function getInitData() {
  return tg?.initData || '';
}

/**
 * Получить текущую тему Telegram
 */
export const getTelegramTheme = () => {
  try {
    if (tg) {
      return tg.colorScheme || 'dark';
    }
  } catch (error) {
    console.error('Ошибка при получении темы:', error);
  }
  return 'dark';
};

/**
 * Получить theme params (цвета Telegram)
 */
export function getThemeParams() {
  return tg?.themeParams || {
    bg_color: '#000000',
    text_color: '#ffffff',
    hint_color: '#aaaaaa',
    link_color: '#F27D00',
    button_color: '#F27D00',
    button_text_color: '#ffffff',
    secondary_bg_color: '#1a1a1a'
  };
}

/**
 * Закрыть приложение (вернуться в Telegram)
 */
export const closeApp = () => {
  try {
    if (tg) {
      tg.close();
    }
  } catch (error) {
    console.error('Ошибка при закрытии:', error);
  }
};

/**
 * ГЛАВНАЯ КНОПКА (MainButton)
 */
export function showMainButton(text, onClick) {
  if (tg) {
    tg.MainButton.setText(text);
    tg.MainButton.onClick(onClick);
    tg.MainButton.show();
  }
}

export function hideMainButton() {
  if (tg) {
    tg.MainButton.hide();
  }
}

export function setMainButtonText(text) {
  if (tg) {
    tg.MainButton.setText(text);
  }
}

export function setMainButtonLoading(isLoading) {
  if (tg) {
    if (isLoading) {
      tg.MainButton.showProgress();
    } else {
      tg.MainButton.hideProgress();
    }
  }
}

/**
 * КНОПКА "НАЗАД" (BackButton)
 */
export function showBackButton(onClick) {
  if (tg) {
    tg.BackButton.onClick(onClick);
    tg.BackButton.show();
  }
}

export function hideBackButton() {
  if (tg) {
    tg.BackButton.hide();
  }
}

/**
 * ТАКТИЛЬНАЯ ОБРАТНАЯ СВЯЗЬ (Haptic Feedback)
 */
/**
 * Вызов тактильной обратной связи (вибрации)
 * @param {string} type - Тип обратной связи: 'light', 'medium', 'heavy', 'rigid', 'soft', 'error', 'success', 'warning'
 */
export const hapticFeedback = (type = 'light') => {
  try {
    const tg = window.Telegram?.WebApp;
    
    if (!tg || !tg.HapticFeedback) {
      console.log('HapticFeedback не доступен');
      return;
    }

    // Маппинг типов для разных методов
    const impactStyles = ['light', 'medium', 'heavy', 'rigid', 'soft'];
    const notificationTypes = ['error', 'success', 'warning'];

    if (impactStyles.includes(type)) {
      // Для impact используем только валидные стили
      tg.HapticFeedback.impactOccurred(type);
    } else if (notificationTypes.includes(type)) {
      // Для уведомлений используем notificationOccurred
      tg.HapticFeedback.notificationOccurred(type);
    } else {
      // По умолчанию light
      tg.HapticFeedback.impactOccurred('light');
    }
  } catch (error) {
    console.error('Ошибка haptic feedback:', error);
  }
};

/**
 * Вызов тактильной обратной связи для уведомлений
 * @param {string} type - Тип уведомления: 'error', 'success', 'warning'
 */
export const notificationHaptic = (type = 'success') => {
  try {
    const tg = window.Telegram?.WebApp;
    
    if (!tg || !tg.HapticFeedback) {
      console.log('HapticFeedback не доступен');
      return;
    }

    // Валидные типы для notificationOccurred
    const validTypes = ['error', 'success', 'warning'];
    const validType = validTypes.includes(type) ? type : 'success';

    tg.HapticFeedback.notificationOccurred(validType);
  } catch (error) {
    console.error('Ошибка notification haptic:', error);
  }
};

/**
 * ВСПЛЫВАЮЩИЕ ОКНА
 */
export function showAlert(message, callback) {
  if (tg) {
    tg.showAlert(message, callback);
  } else {
    alert(message);
    if (callback) callback();
  }
}

export function showConfirm(message, callback) {
  if (tg) {
    tg.showConfirm(message, callback);
  } else {
    console.log('showConfirm:', message);
    callback(true);
  }
}

export function showPopup(params, callback) {
  if (tg) {
    tg.showPopup(params, callback);
  }
}

/**
 * ССЫЛКИ
 */
export function openLink(url, options = {}) {
  if (tg) {
    tg.openLink(url, options);
  } else {
    window.open(url, '_blank');
  }
}

export function openTelegramLink(url) {
  if (tg) {
    tg.openTelegramLink(url);
  }
}

/**
 * ПОДЕЛИТЬСЯ
 */
export function shareUrl(url, text = '') {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  if (tg) {
    tg.openTelegramLink(shareUrl);
  }
}

/**
 * БУФЕР ОБМЕНА
 */
export function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(() => {
        notificationHaptic('success');
      })
      .catch(err => {
        console.error('Ошибка копирования:', err);
      });
  }
}

/**
 * СОБЫТИЯ
 */
export function onViewportChanged(callback) {
  if (tg) {
    tg.onEvent('viewportChanged', callback);
  }
}

export function onThemeChanged(callback) {
  if (tg) {
    tg.onEvent('themeChanged', callback);
  }
}

export function offEvent(eventType, callback) {
  if (tg) {
    tg.offEvent(eventType, callback);
  }
}

/**
 * ИНФОРМАЦИЯ О ПЛАТФОРМЕ
 */
export function getPlatform() {
  return tg?.platform || 'unknown';
}

export function getVersion() {
  return tg?.version || '0.0';
}

/**
 * КЛАВИАТУРА (для закрытия клавиатуры на мобильных)
 */
export function hideKeyboard() {
  if (document.activeElement) {
    document.activeElement.blur();
  }
}

export default tg;