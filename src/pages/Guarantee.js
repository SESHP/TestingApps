// src/pages/Guarantee.js

import React from 'react';
import './Guarantee.css';

const Guarantee = () => {
  return (
    <div className="guarantee-container">
      <div className="guarantee-content">
        <div className="guarantee-header">
          <div className="guarantee-icon">🔒</div>
          <h1 className="guarantee-title">Гарант сервис</h1>
          <p className="guarantee-subtitle">
            Безопасные P2P сделки с TON
          </p>
        </div>

        <div className="guarantee-info">
          <div className="info-card">
            <div className="info-icon">✅</div>
            <h3>Безопасность</h3>
            <p>Все средства находятся в эскроу до завершения сделки</p>
          </div>

          <div className="info-card">
            <div className="info-icon">⚡</div>
            <h3>Быстро</h3>
            <p>Автоматическое подтверждение и выплата</p>
          </div>

          <div className="info-card">
            <div className="info-icon">💰</div>
            <h3>Выгодно</h3>
            <p>Минимальная комиссия 0.5% за сделку</p>
          </div>
        </div>

        <div className="coming-soon">
          <p>🚀 Скоро запуск</p>
        </div>
      </div>
    </div>
  );
};

export default Guarantee;