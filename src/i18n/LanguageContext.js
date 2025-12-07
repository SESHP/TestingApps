// Language Context for managing language state
import React, { createContext, useState, useContext, useEffect } from 'react';
import { translations } from './translations';

const LanguageContext = createContext();

const STORAGE_KEY = 'app_language';

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Try to load from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (saved === 'ru' || saved === 'en')) {
      return saved;
    }

    // Default to Russian
    return 'ru';
  });

  useEffect(() => {
    // Save to localStorage when language changes
    localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'ru' ? 'en' : 'ru');
  };

  const t = (key) => {
    return translations[language][key] || key;
  };

  const getPluralForm = (count, baseKey) => {
    if (language === 'en') {
      return count === 1 ? t(`${baseKey}_one`) : t(`${baseKey}_many`);
    }

    // Russian plural rules
    const cases = [2, 0, 1, 1, 1, 2];
    const titles = [t(`${baseKey}_one`), t(`${baseKey}_few`), t(`${baseKey}_many`)];

    return titles[
      (count % 100 > 4 && count % 100 < 20)
        ? 2
        : cases[Math.min(count % 10, 5)]
    ];
  };

  const value = {
    language,
    setLanguage,
    toggleLanguage,
    t,
    getPluralForm
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within LanguageProvider');
  }
  return context;
};
