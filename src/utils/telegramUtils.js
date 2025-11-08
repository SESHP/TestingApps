// src/utils/telegramUtils.js

const tg = window.Telegram?.WebApp;

/**
 * Инициализация Telegram Mini App
 * Вызывать один раз при запуске приложения
 */
export function initTelegramApp() {
  if (tg) {
    // Сообщаем Telegram что приложение готово
    tg.ready();
    
    // Разворачиваем на весь экран
    tg.expand();
    
    // Устанавливаем цвета под наш дизайн
    tg.setHeaderColor('#000000');
    tg.setBackgroundColor('#000000');
    
    // Отключаем вертикальные свайпы (чтобы случайно не закрыть приложение)
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
      user: tg.initDataUnsafe?.user
    });
    
    return true;
  } else {
    console.warn('⚠️ Telegram WebApp SDK не найден. Режим разработки.');
    return false;
  }
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
      return tg.colorScheme || 'dark'; // 'light' или 'dark'
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
export const hapticFeedback = (type = 'medium') => {
  try {
    if (tg?.HapticFeedback) {
      // Типы: light, medium, heavy, rigid, soft
      tg.HapticFeedback.impactOccurred(type);
    }
  } catch (error) {
    console.error('Ошибка haptic feedback:', error);
  }
};

export function notificationHaptic(type = 'success') {
  if (tg?.HapticFeedback) {
    // Типы: error, success, warning
    tg.HapticFeedback.notificationOccurred(type);
  }
}

export function selectionHaptic() {
  if (tg?.HapticFeedback) {
    tg.HapticFeedback.selectionChanged();
  }
}

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
    const result = confirm(message);
    callback(result);
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