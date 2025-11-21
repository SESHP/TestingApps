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

        {/* Закрепленный блок - текущий статус */}
        <div className="badge-modal-fixed">
          <h3 className="badge-modal-title">Ваш текущий статус</h3>
          <div className="badge-modal-current-badge">
            <Badge badgeType={currentBadge} size="large" />
          </div>
          <div className="badge-modal-description">
            <p className="badge-description-text">{badge.description}</p>
            <p className="badge-details-text">{badge.details}</p>
          </div>
          <div className="badge-commission-info">
            <div className="commission-item">
              <span className="commission-label">Ваша комиссия:</span>
              <span className="commission-value" style={{ color: badge.color }}>
                {badge.commission}%
              </span>
            </div>
          </div>
          <div className="badge-modal-divider"></div>
          <h4 className="badge-modal-subtitle">Все статусы</h4>
        </div>

        {/* Скроллящийся блок со списком статусов */}
        <div className="badge-modal-scrollable">
          <div className="badge-list">
            {Object.entries(BADGE_CONFIG).map(([key, badgeInfo]) => (
              <div 
                key={key} 
                className={`badge-list-item ${currentBadge === key ? 'current' : ''}`}
              >
                <div className="badge-list-left">
                  <div className="badge-list-top">
                    <Badge badgeType={key} size="small" />
                    {currentBadge === key && (
                      <div className="badge-current-indicator">
                        <span className="current-badge-text">Текущий</span>
                      </div>
                    )}
                  </div>
                  <p className="badge-list-requirements">{badgeInfo.requirements}</p>
                </div>
                <div className="badge-list-right">
                  <span className="badge-list-commission" style={{ color: badgeInfo.color }}>
                    {badgeInfo.commission}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BadgeModal;