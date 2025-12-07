// Language Switcher Component
import React from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { hapticFeedback } from '../utils/telegramUtils';
import './LanguageSwitcher.css';

const LanguageSwitcher = () => {
  const { language, toggleLanguage } = useTranslation();

  const handleToggle = () => {
    hapticFeedback('light');
    toggleLanguage();
  };

  return (
    <button className="language-switcher" onClick={handleToggle}>
      <div className={`language-option ${language === 'ru' ? 'active' : ''}`}>
        RU
      </div>
      <div className={`language-option ${language === 'en' ? 'active' : ''}`}>
        EN
      </div>
      <div className={`language-indicator ${language === 'en' ? 'right' : ''}`} />
    </button>
  );
};

export default LanguageSwitcher;
