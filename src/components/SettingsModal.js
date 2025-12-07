// src/components/SettingsModal.js
import React from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import './SettingsModal.css';

const SettingsModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="settings-modal-overlay" onClick={handleOverlayClick}>
      <div className="settings-modal">
        <div className="settings-header">
          <h2 className="settings-title">Настройки</h2>
          <button className="settings-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <div className="settings-item">
              <div className="settings-item-info">
                <div className="settings-item-label">Язык</div>
                <div className="settings-item-description">Выберите язык интерфейса</div>
              </div>
              <div className="settings-item-control">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
