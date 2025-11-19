// src/utils/platformDetect.js

export const isMacOSDesktop = () => {
  // Проверяем, что это Telegram Desktop на macOS
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();
  
  const isMac = platform.includes('mac');
  const isDesktop = !('ontouchstart' in window) && !navigator.maxTouchPoints;
  const isTelegram = window.Telegram?.WebApp?.platform === 'macos' || 
                     window.Telegram?.WebApp?.platform === 'tdesktop';
  
  return isMac && isDesktop && isTelegram;
};

export const getPlatformClass = () => {
  if (isMacOSDesktop()) {
    return 'platform-macos-desktop';
  }
  return 'platform-default';
};