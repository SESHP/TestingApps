// src/contexts/ThemeContext.js

import React, { createContext, useState, useEffect } from 'react';

/**
 * Context для управления темой приложения
 */
export const ThemeContext = createContext();

/**
 * Provider компонент, который предоставляет тему всему приложению
 */
export function ThemeProvider({ children }) {
  // Определяем начальную тему: из localStorage или 'light'
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('app-theme');
    return savedTheme || 'light';
  });

  // Сохраняем выбранную тему в localStorage (чтобы помнила после перезагрузки)
  useEffect(() => {
    localStorage.setItem('app-theme', theme);
    
    // Применяем тему к документу
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Функция для переключения темы
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  // Значение, которое передаём в контекст
  const value = {
    theme,
    toggleTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Хук для использования темы в компонентах
 * Пример: const { theme, toggleTheme } = useTheme();
 */
export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme должен использоваться внутри ThemeProvider');
  }
  return context;
}
