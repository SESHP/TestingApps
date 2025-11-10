// src/pages/Inventory.js

import React, { useState, useEffect } from 'react';
import { getTelegramUser } from '../utils/telegramUtils';
import './Inventory.css';

const Inventory = () => {
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    // Получаем ID пользователя из Telegram
    const user = getTelegramUser();
    if (user && user.id) {
      setUserId(user.id);
      loadUserGifts(user.id);
    } else {
      // Для тестирования в браузере
      setUserId('test_user');
      loadUserGifts('test_user');
    }
  }, []);

  const loadUserGifts = async (telegramUserId) => {
    try {
      setLoading(true);
      
      // TODO: Здесь будет запрос к вашему backend API
      // Пример: const response = await fetch(`/api/gifts/${telegramUserId}`);
      // const data = await response.json();
      // setGifts(data.gifts);
      
      // Временные тестовые данные (удалить после подключения API)
      const mockGifts = [
        {
          id: 1,
          name: 'Delicious Cake',
          image: '🎂',
          date: '2024-11-10',
          sender: 'User123'
        },
        {
          id: 2,
          name: 'Star',
          image: '⭐',
          date: '2024-11-09',
          sender: 'User456'
        }
      ];
      
      // Имитация загрузки
      setTimeout(() => {
        setGifts(mockGifts);
        setLoading(false);
      }, 1000);
      
    } catch (error) {
      console.error('Ошибка загрузки подарков:', error);
      setLoading(false);
    }
  };

  const refreshGifts = () => {
    if (userId) {
      loadUserGifts(userId);
    }
  };

  if (loading) {
    return (
      <div className="inventory-container">
        <div className="inventory-header">
          <h1>Инвентарь</h1>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Загрузка подарков...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inventory-container">
      <div className="inventory-header">
        <h1>Инвентарь</h1>
        <button className="refresh-button" onClick={refreshGifts}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 10C21 10 18.995 7.26822 17.3662 5.63824C15.7373 4.00827 13.4864 3 11 3C6.02944 3 2 7.02944 2 12C2 16.9706 6.02944 21 11 21C15.1031 21 18.5649 18.2543 19.6482 14.5M21 10V4M21 10H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Обновить
        </button>
      </div>

      <div className="info-card-gift">
        <div className="info-icon-gift">ℹ️</div>
        <div className="info-content-gift">
          <p className="info-text-gift">
            Для добавления подарка в инвентарь необходимо отправить его на аккаунт{' '}
            <a href="https://t.me/FNPK3" target="_blank" rel="noopener noreferrer" className="username-link">
              @FNPK3
            </a>
          </p>
        </div>
      </div>

      <div className="inventory-stats">
        <div className="stat-item">
          <span className="stat-value">{gifts.length}</span>
          <span className="stat-label">Всего подарков</span>
        </div>
      </div>

      <div className="inventory-content">
        {gifts.length === 0 ? (
          <div className="inventory-empty">
            <div className="empty-icon">🎁</div>
            <p className="empty-text">Ваш инвентарь пуст</p>
            <p className="empty-subtext">
              Отправьте подарок на @FNPK3, чтобы он появился здесь
            </p>
          </div>
        ) : (
          <div className="gifts-grid">
            {gifts.map((gift) => (
              <div key={gift.id} className="gift-card">
                <div className="gift-image">{gift.image}</div>
                <div className="gift-info">
                  <h3 className="gift-name">{gift.name}</h3>
                  <p className="gift-date">{new Date(gift.date).toLocaleDateString('ru-RU')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Inventory;