// src/components/ReferralList.js

import React, { useState, useEffect } from 'react';
import { getReferralStats } from '../utils/api';
import './ReferralList.css';

function ReferralList({ telegramId }) {
  const [referrals, setReferrals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadReferrals();
  }, [telegramId]);

  const loadReferrals = async () => {
    if (!telegramId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getReferralStats(telegramId);
      setReferrals(data.referrals || []);
    } catch (err) {
      console.error('Ошибка загрузки рефералов:', err);
      setError('Не удалось загрузить список рефералов');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="referral-list">
        <div className="referral-list-header">
          <h3>Мои рефералы</h3>
        </div>
        <div className="referral-list-loading">
          Загрузка...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="referral-list">
        <div className="referral-list-header">
          <h3>Мои рефералы</h3>
        </div>
        <div className="referral-list-error">
          {error}
        </div>
      </div>
    );
  }

  if (referrals.length === 0) {
    return (
      <div className="referral-list">
        <div className="referral-list-header">
          <h3>Мои рефералы</h3>
        </div>
        <div className="referral-list-empty">
          <div className="empty-icon">👥</div>
          <p>У вас пока нет рефералов</p>
          <p className="empty-hint">
            Поделитесь своей реферальной ссылкой, чтобы пригласить друзей
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="referral-list">
      <div className="referral-list-header">
        <h3>Мои рефералы</h3>
        <span className="referral-count">{referrals.length}</span>
      </div>

      <div className="referral-items">
        {referrals.map((referral, index) => (
          <div key={referral.telegramId || index} className="referral-list-item">
            <div className="referral-info">
              <div className="referral-avatar">
                {referral.firstName?.[0] || '?'}
              </div>
              <div className="referral-details">
                <div className="referral-name">
                  {referral.firstName} {referral.lastName}
                </div>
                {referral.username && (
                  <div className="referral-username">@{referral.username}</div>
                )}
                <div className="referral-date">
                  Присоединился: {formatDate(referral.createdAt)}
                </div>
              </div>
            </div>
            <div className="referral-earned">
              <div className="earned-amount">
                {referral.earnedAmount.toFixed(2)} TON
              </div>
              <div className="earned-label">Заработано</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ReferralList;