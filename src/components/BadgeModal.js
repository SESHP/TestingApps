// src/components/BadgeModal.js

import React from 'react';
import './BadgeModal.css';
import Badge, { BADGE_CONFIG } from './Badge';

const BadgeModal = ({ isOpen, onClose, currentBadge, userData }) => {
  if (!isOpen) return null;

  const badge = BADGE_CONFIG[currentBadge];

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="badge-modal-overlay" onClick={handleOverlayClick}>
      <div className="badge-modal">
        {/* Кнопка закрытия */}
        <button className="badge-modal-close" onClick={onClose}>
          ✕
        </button>

        {/* Текущая плашка пользователя */}
        <div className="badge-modal-current">
          <h3 className="badge-modal-title">Ваш текущий статус</h3>
          <div className="badge-modal-current-badge">
            <Badge badgeType={currentBadge} size="large" />
          </div>
          <div className="badge-modal-description">
            <p className="badge-description-text">{badge.description}</p>
            <p className="badge-details-text">{badge.details}</p>
          </div>

          {/* Информация о комиссии */}
          <div className="badge-commission-info">
            <div className="commission-item">
              <span className="commission-label">Ваша комиссия:</span>
              <span className="commission-value" style={{ color: badge.color }}>
                {badge.commission}%
              </span>
            </div>
          </div>
        </div>

        {/* Разделитель */}
        <div className="badge-modal-divider"></div>

        {/* Все доступные плашки */}
        <div className="badge-modal-all">
          <h4 className="badge-modal-subtitle">Все статусы</h4>
          <div className="badge-list">
            {Object.entries(BADGE_CONFIG).map(([key, badgeInfo]) => (
              <div 
                key={key} 
                className={`badge-list-item ${currentBadge === key ? 'current' : ''}`}
              >
                <div className="badge-list-badge">
                  <Badge badgeType={key} size="small" />
                </div>
                <div className="badge-list-info">
                  <div className="badge-list-header">
                    <span className="badge-list-name">{badgeInfo.name}</span>
                    <span className="badge-list-commission" style={{ color: badgeInfo.color }}>
                      {badgeInfo.commission}%
                    </span>
                  </div>
                  <p className="badge-list-requirements">{badgeInfo.requirements}</p>
                </div>
                {currentBadge === key && (
                  <div className="badge-current-indicator">
                    <span className="current-badge-text">Текущий</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Информация о прогрессе */}
        <div className="badge-modal-progress">
          <div className="progress-stats">
            <div className="progress-stat">
              <span className="progress-label">Сделок:</span>
              <span className="progress-value">{userData?.totalDeals || 0}</span>
            </div>
            <div className="progress-stat">
              <span className="progress-label">Рейтинг:</span>
              <span className="progress-value">{userData?.rating?.toFixed(1) || '0.0'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BadgeModal;