// src/pages/Inventory.js

import React, { useState, useEffect, useRef } from 'react';
import { getTelegramUser } from '../utils/telegramUtils';
import './Inventory.css';
import lottie from 'lottie-web';

const Inventory = () => {
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null);
  const [selectedGift, setSelectedGift] = useState(null);

  useEffect(() => {
    initializeInventory();
  }, []);

  const initializeInventory = async () => {
    try {
      const user = getTelegramUser();
      const telegramUserId = user?.id?.toString() || 'test_user';
      
      setUserId(telegramUserId);
      await loadUserGifts(telegramUserId);
    } catch (err) {
      console.error('Ошибка инициализации инвентаря:', err);
      setError('Не удалось загрузить инвентарь');
      setLoading(false);
    }
  };

  const loadUserGifts = async (telegramUserId) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/gifts?fromId=${telegramUserId}&withdrawn=false`);
      
      if (!response.ok) {
        throw new Error('Ошибка загрузки подарков');
      }
      
      const data = await response.json();
      setGifts(data.gifts || []);
      
    } catch (err) {
      console.error('Ошибка загрузки подарков:', err);
      setError('Не удалось загрузить подарки');
      setGifts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!userId || refreshing) return;
    setRefreshing(true);
    await loadUserGifts(userId);
    setRefreshing(false);
  };

  const handleGiftClick = (gift) => {
    setSelectedGift(gift);
  };

  const handleCloseModal = () => {
    setSelectedGift(null);
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
        <button 
          className="refresh-button" 
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className={refreshing ? 'spinning' : ''}
          >
            <path 
              d="M21 10C21 10 18.995 7.26822 17.3662 5.63824C15.7373 4.00827 13.4864 3 11 3C6.02944 3 2 7.02944 2 12C2 16.9706 6.02944 21 11 21C15.1031 21 18.5649 18.2543 19.6482 14.5M21 10V4M21 10H15" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
          {refreshing ? 'Обновление...' : 'Обновить'}
        </button>
      </div>

      <div className="info-card-gift">
        <div className="info-icon-gift">ℹ️</div>
        <div className="info-content-gift">
          <p className="info-text-gift">
            Для добавления подарка в инвентарь необходимо отправить его на аккаунт{' '}
            <a 
              href="https://t.me/FNPK3" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="username-link"
            >
              @FNPK3
            </a>
          </p>
          <p className="info-subtext">
            После отправки нажмите кнопку "Обновить" для синхронизации
          </p>
        </div>
      </div>

      {error && (
        <div className="error-card">
          <div className="error-icon">⚠️</div>
          <p className="error-text">{error}</p>
        </div>
      )}

      <div className="inventory-stats">
        <div className="stat-item">
          <span className="stat-value">{gifts.length}</span>
          <span className="stat-label">Всего подарков</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {gifts.filter(g => {
              const giftDate = new Date(g.receivedAt);
              const today = new Date();
              return giftDate.toDateString() === today.toDateString();
            }).length}
          </span>
          <span className="stat-label">Сегодня</span>
        </div>
      </div>

      <div className="inventory-content">
        {gifts.length === 0 ? (
          <div className="inventory-empty">
            <div className="empty-icon">🎁</div>
            <p className="empty-text">Ваш инвентарь пуст</p>
            <p className="empty-subtext">
              Отправьте подарок на @FNPK3, чтобы он появится здесь
            </p>
          </div>
        ) : (
          <div className="gifts-grid">
            {gifts.map((gift) => (
              <GiftCard 
                key={gift.id} 
                gift={gift} 
                onClick={() => handleGiftClick(gift)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedGift && (
        <GiftModal 
          gift={selectedGift} 
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

// Компонент карточки подарка
const GiftCard = ({ gift, onClick }) => {
  const lottieRef = useRef(null);
  const lottieInstance = useRef(null);
  const [giftDetails, setGiftDetails] = useState(null);

  useEffect(() => {
    loadGiftDetails();
    return () => {
      if (lottieInstance.current) {
        lottieInstance.current.destroy();
      }
    };
  }, [gift.id]);

  const loadGiftDetails = async () => {
    try {
      const response = await fetch(`/api/gifts/${gift.id}/details`);
      if (response.ok) {
        const data = await response.json();
        setGiftDetails(data);
      }
    } catch (err) {
      console.error('Ошибка загрузки деталей подарка:', err);
    }
  };

  useEffect(() => {
    if (!giftDetails?.processed?.mainDocument) return;

    const mainDoc = giftDetails.processed.mainDocument;
    
    if (mainDoc.fileType === 'lottie' && mainDoc.file?.lottieJson?.url && lottieRef.current) {
      fetch(mainDoc.file.lottieJson.url)
        .then(res => res.json())
        .then(animationData => {
          if (lottieInstance.current) {
            lottieInstance.current.destroy();
          }
          lottieInstance.current = lottie.loadAnimation({
            container: lottieRef.current,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            animationData: animationData
          });
        })
        .catch(err => console.error('Ошибка загрузки Lottie:', err));
    }
  }, [giftDetails]);

  const renderGiftPreview = () => {
    if (!giftDetails?.processed?.mainDocument) {
      return <div className="gift-placeholder">🎁</div>;
    }

    const mainDoc = giftDetails.processed.mainDocument;
    const backdrop = giftDetails.processed.attributes?.backdrop;

    const cardStyle = backdrop ? {
      background: `radial-gradient(circle at center, ${backdrop.centerColor} 0%, ${backdrop.edgeColor} 100%)`
    } : {};

    if (mainDoc.fileType === 'static') {
      return (
        <div className="gift-preview" style={cardStyle}>
          <img src={mainDoc.file.url} alt={gift.giftTitle} className="gift-static-img" />
        </div>
      );
    }

    if (mainDoc.fileType === 'lottie') {
      return (
        <div className="gift-preview" style={cardStyle}>
          <div ref={lottieRef} className="gift-lottie-preview" />
        </div>
      );
    }

    if (mainDoc.fileType === 'video') {
      return (
        <div className="gift-preview" style={cardStyle}>
          <video 
            src={mainDoc.file.url} 
            autoPlay 
            loop 
            muted 
            playsInline
            className="gift-video-preview"
          />
        </div>
      );
    }

    return <div className="gift-placeholder">🎁</div>;
  };

  return (
    <div className="gift-card" onClick={onClick}>
      {renderGiftPreview()}
      <div className="gift-info">
        <h3 className="gift-name">{gift.giftTitle}</h3>
        {gift.model && gift.model !== 'Неизвестная модель' && (
          <p className="gift-model">{gift.model}</p>
        )}
        <p className="gift-date">
          {new Date(gift.receivedAt).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short'
          })}
        </p>
      </div>
    </div>
  );
};

// Компонент модального окна
const GiftModal = ({ gift, onClose }) => {
  const lottieRef = useRef(null);
  const lottieInstance = useRef(null);
  const [giftDetails, setGiftDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGiftDetails();
    return () => {
      if (lottieInstance.current) {
        lottieInstance.current.destroy();
      }
    };
  }, [gift.id]);

  const loadGiftDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/gifts/${gift.id}/details`);
      if (response.ok) {
        const data = await response.json();
        setGiftDetails(data);
      }
    } catch (err) {
      console.error('Ошибка загрузки деталей:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!giftDetails?.processed?.mainDocument) return;

    const mainDoc = giftDetails.processed.mainDocument;
    
    if (mainDoc.fileType === 'lottie' && mainDoc.file?.lottieJson?.url && lottieRef.current) {
      fetch(mainDoc.file.lottieJson.url)
        .then(res => res.json())
        .then(animationData => {
          if (lottieInstance.current) {
            lottieInstance.current.destroy();
          }
          lottieInstance.current = lottie.loadAnimation({
            container: lottieRef.current,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            animationData: animationData
          });
        })
        .catch(err => console.error('Ошибка загрузки Lottie:', err));
    }
  }, [giftDetails]);

  const renderMainContent = () => {
    if (loading || !giftDetails?.processed?.mainDocument) {
      return <div className="modal-loading">Загрузка...</div>;
    }

    const mainDoc = giftDetails.processed.mainDocument;
    const backdrop = giftDetails.processed.attributes?.backdrop;

    const containerStyle = backdrop ? {
      background: `radial-gradient(circle at center, ${backdrop.centerColor} 0%, ${backdrop.edgeColor} 100%)`
    } : {};

    if (mainDoc.fileType === 'static') {
      return (
        <div className="modal-gift-container" style={containerStyle}>
          <img src={mainDoc.file.url} alt={gift.giftTitle} className="modal-gift-image" />
        </div>
      );
    }

    if (mainDoc.fileType === 'lottie') {
      return (
        <div className="modal-gift-container" style={containerStyle}>
          <div ref={lottieRef} className="modal-gift-lottie" />
        </div>
      );
    }

    if (mainDoc.fileType === 'video') {
      return (
        <div className="modal-gift-container" style={containerStyle}>
          <video 
            src={mainDoc.file.url} 
            autoPlay 
            loop 
            muted 
            playsInline
            className="modal-gift-video"
          />
        </div>
      );
    }

    return <div className="modal-gift-placeholder">🎁</div>;
  };

  const attrs = giftDetails?.processed?.attributes;
  const isCollectible = attrs?.model || attrs?.backdrop || attrs?.pattern;

  return (
    <div className="gift-modal-overlay" onClick={onClose}>
      <div className="gift-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        
        {renderMainContent()}

        <div className="modal-info">
          <h2 className="modal-title">{gift.giftTitle}</h2>
          
          {isCollectible && (
            <div className="modal-badge collectible">Коллекционный</div>
          )}

          {attrs?.model && (
            <div className="modal-attr">
              <span className="modal-attr-label">Модель:</span>
              <span className="modal-attr-value">{attrs.model.name}</span>
              {attrs.model.rarityPermille && (
                <span className="modal-attr-rarity">
                  {(attrs.model.rarityPermille / 10).toFixed(1)}%
                </span>
              )}
            </div>
          )}

          {attrs?.backdrop && (
            <div className="modal-attr">
              <span className="modal-attr-label">Фон:</span>
              <span className="modal-attr-value">{attrs.backdrop.name}</span>
              {attrs.backdrop.rarityPermille && (
                <span className="modal-attr-rarity">
                  {(attrs.backdrop.rarityPermille / 10).toFixed(1)}%
                </span>
              )}
            </div>
          )}

          {attrs?.pattern && (
            <div className="modal-attr">
              <span className="modal-attr-label">Паттерн:</span>
              <span className="modal-attr-value">{attrs.pattern.name}</span>
              {attrs.pattern.rarityPermille && (
                <span className="modal-attr-rarity">
                  {(attrs.pattern.rarityPermille / 10).toFixed(1)}%
                </span>
              )}
            </div>
          )}

          <div className="modal-meta">
            <div className="modal-meta-item">
              <span className="modal-meta-label">От:</span>
              <span className="modal-meta-value">{gift.fromId}</span>
            </div>
            <div className="modal-meta-item">
              <span className="modal-meta-label">Получен:</span>
              <span className="modal-meta-value">
                {new Date(gift.receivedAt).toLocaleString('ru-RU')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inventory;