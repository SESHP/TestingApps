// src/utils/platformDetect.js

// src/utils/platformDetect.js

export const isMacOSDesktop = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();
  
  const isMac = platform.includes('mac');
  const isDesktop = !('ontouchstart' in window) && !navigator.maxTouchPoints;
  const isTelegram = window.Telegram?.WebApp?.platform === 'macos' || 
                     window.Telegram?.WebApp?.platform === 'tdesktop';
  
  return isMac && isDesktop && isTelegram;
};

// Применяем класс к body при загрузке
export const initPlatformDetection = () => {
  if (isMacOSDesktop()) {
    document.documentElement.classList.add('platform-macos-desktop');
    // Устанавливаем CSS переменные
    document.documentElement.style.setProperty('--glass-bg', 'rgba(30, 30, 40, 0.95)');
    document.documentElement.style.setProperty('--glass-bg-hover', 'rgba(40, 40, 50, 0.95)');
    document.documentElement.style.setProperty('--glass-item-bg', 'rgba(40, 40, 50, 0.9)');
    document.documentElement.style.setProperty('--glass-code-bg', 'rgba(242, 125, 0, 0.25)');
  } else {
    document.documentElement.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.08)');
    document.documentElement.style.setProperty('--glass-bg-hover', 'rgba(255, 255, 255, 0.12)');
    document.documentElement.style.setProperty('--glass-item-bg', 'rgba(255, 255, 255, 0.05)');
    document.documentElement.style.setProperty('--glass-code-bg', 'rgba(242, 125, 0, 0.15)');
  }
};

export const getPlatformClass = () => {
  if (isMacOSDesktop()) {
    return 'platform-macos-desktop';
  }
  return 'platform-default';
};