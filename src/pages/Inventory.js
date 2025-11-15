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
      
      // Проверяем, какой URL использовать (dev или prod)
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const response = await fetch(`${apiUrl}/api/gifts?fromId=${telegramUserId}&withdrawn=false`);
      
      if (!response.ok) {
        throw new Error(`Ошибка загрузки: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Сервер вернул неверный формат данных');
      }
      
      const data = await response.json();
      setGifts(data.gifts || []);
      
    } catch (err) {
      console.error('Ошибка загрузки подарков:', err);
      
      // В dev режиме показываем тестовые данные
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Dev режим: показываем тестовые данные');
        setGifts([
          {
            id: 1,
            giftId: 'test_1',
            giftTitle: 'Delicious Cake',
            model: 'Classic',
            background: 'Gradient',
            symbol: 'Star',
            fromId: telegramUserId,
            receivedAt: new Date().toISOString(),
            isWithdrawn: false
          }
        ]);
        setError('⚠️ Backend недоступен. Показываются тестовые данные.');
      } else {
        setError(`Не удалось загрузить подарки: ${err.message}`);
        setGifts([]);
      }
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAndDisplayGift();
    return () => {
      if (lottieInstance.current) {
        lottieInstance.current.destroy();
      }
    };
  }, [gift.id]);

  const loadAndDisplayGift = async () => {
    if (!gift.raw_data?.gift) return;

    const giftData = gift.raw_data.gift;
    const apiUrl = process.env.REACT_APP_API_URL || '';

    // Ищем модель в атрибутах
    const attributes = giftData.attributes || [];
    const modelAttr = attributes.find(attr => attr.className === 'StarGiftAttributeModel');

    if (!modelAttr?.document) return;

    const doc = modelAttr.document;

    // Если это Lottie (TGS)
    if (doc.mimeType === 'application/x-tgsticker' && lottieRef.current) {
      try {
        setLoading(true);
        
        // Формируем путь к файлу
        const filename = `${doc.id}.json`;
        const url = `${apiUrl}/uploads/gifts/${filename}`;
        
        const response = await fetch(url);
        if (response.ok) {
          const animationData = await response.json();
          
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
        }
      } catch (err) {
        console.error('Ошибка загрузки Lottie:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const renderGiftPreview = () => {
    if (!gift.raw_data?.gift) {
      return <div className="gift-preview"><div className="gift-placeholder">?</div></div>;
    }

    const giftData = gift.raw_data.gift;
    const attributes = giftData.attributes || [];
    
    // Получаем атрибуты
    const backdropAttr = attributes.find(attr => attr.className === 'StarGiftAttributeBackdrop');
    const patternAttr = attributes.find(attr => attr.className === 'StarGiftAttributePattern');
    const modelAttr = attributes.find(attr => attr.className === 'StarGiftAttributeModel');

    // Фон
    const backgroundStyle = backdropAttr ? {
      background: `radial-gradient(circle at center, ${formatColor(backdropAttr.centerColor)} 0%, ${formatColor(backdropAttr.edgeColor)} 100%)`
    } : {
      background: 'linear-gradient(135deg, rgba(242, 125, 0, 0.15) 0%, rgba(242, 125, 0, 0.05) 100%)'
    };

    const apiUrl = process.env.REACT_APP_API_URL || '';

    return (
      <div className="gift-preview gift-card-full" style={backgroundStyle}>
        {/* Паттерн */}
        {patternAttr?.document && (
          <div 
            className="gift-pattern-overlay"
            style={{
              backgroundImage: `url(${apiUrl}/uploads/gifts/${patternAttr.document.id}.webp)`,
              opacity: 0.1
            }}
          />
        )}
        
        {/* Модель */}
        {modelAttr?.document && (
          <>
            {modelAttr.document.mimeType === 'application/x-tgsticker' ? (
              <div ref={lottieRef} className="gift-lottie-preview" />
            ) : (
              <img 
                src={`${apiUrl}/uploads/gifts/${modelAttr.document.id}.webp`}
                alt={gift.giftTitle}
                className="gift-static-img"
              />
            )}
          </>
        )}
      </div>
    );
  };

  const formatColor = (colorInt) => {
    if (!colorInt) return '#000000';
    const hex = (colorInt >>> 0).toString(16).padStart(6, '0');
    return `#${hex}`;
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAndDisplayGift();
    return () => {
      if (lottieInstance.current) {
        lottieInstance.current.destroy();
      }
    };
  }, [gift.id]);

  const loadAndDisplayGift = async () => {
    if (!gift.raw_data?.gift) return;

    const giftData = gift.raw_data.gift;
    const apiUrl = process.env.REACT_APP_API_URL || '';

    // Ищем модель
    const attributes = giftData.attributes || [];
    const modelAttr = attributes.find(attr => attr.className === 'StarGiftAttributeModel');

    if (!modelAttr?.document) return;

    const doc = modelAttr.document;

    // Если это Lottie
    if (doc.mimeType === 'application/x-tgsticker' && lottieRef.current) {
      try {
        setLoading(true);
        
        const filename = `${doc.id}.json`;
        const url = `${apiUrl}/uploads/gifts/${filename}`;
        
        const response = await fetch(url);
        if (response.ok) {
          const animationData = await response.json();
          
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
        }
      } catch (err) {
        console.error('Ошибка загрузки Lottie:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const formatColor = (colorInt) => {
    if (!colorInt) return '#000000';
    const hex = (colorInt >>> 0).toString(16).padStart(6, '0');
    return `#${hex}`;
  };

  const renderMainContent = () => {
    if (!gift.raw_data?.gift) {
      return (
        <div className="modal-gift-container">
          <div className="modal-gift-placeholder">?</div>
        </div>
      );
    }

    const giftData = gift.raw_data.gift;
    const attributes = giftData.attributes || [];
    
    const backdropAttr = attributes.find(attr => attr.className === 'StarGiftAttributeBackdrop');
    const patternAttr = attributes.find(attr => attr.className === 'StarGiftAttributePattern');
    const modelAttr = attributes.find(attr => attr.className === 'StarGiftAttributeModel');

    const backgroundStyle = backdropAttr ? {
      background: `radial-gradient(circle at center, ${formatColor(backdropAttr.centerColor)} 0%, ${formatColor(backdropAttr.edgeColor)} 100%)`
    } : {
      background: 'linear-gradient(135deg, rgba(242, 125, 0, 0.2) 0%, rgba(242, 125, 0, 0.1) 100%)'
    };

    const apiUrl = process.env.REACT_APP_API_URL || '';

    return (
      <div className="modal-gift-container" style={backgroundStyle}>
        {/* Паттерн */}
        {patternAttr?.document && (
          <div 
            className="modal-pattern-overlay"
            style={{
              backgroundImage: `url(${apiUrl}/uploads/gifts/${patternAttr.document.id}.webp)`,
              opacity: 0.12
            }}
          />
        )}
        
        {/* Модель */}
        {modelAttr?.document && (
          <>
            {modelAttr.document.mimeType === 'application/x-tgsticker' ? (
              <div ref={lottieRef} className="modal-gift-lottie" />
            ) : (
              <img 
                src={`${apiUrl}/uploads/gifts/${modelAttr.document.id}.webp`}
                alt={gift.giftTitle}
                className="modal-gift-image"
              />
            )}
          </>
        )}
      </div>
    );
  };

  const attributes = gift.raw_data?.gift?.attributes || [];
  const modelAttr = attributes.find(attr => attr.className === 'StarGiftAttributeModel');
  const backdropAttr = attributes.find(attr => attr.className === 'StarGiftAttributeBackdrop');
  const patternAttr = attributes.find(attr => attr.className === 'StarGiftAttributePattern');

  const isCollectible = modelAttr || backdropAttr || patternAttr;

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

          {modelAttr && (
            <div className="modal-attr">
              <span className="modal-attr-label">Модель:</span>
              <span className="modal-attr-value">{modelAttr.name}</span>
              {modelAttr.rarityPermille && (
                <span className="modal-attr-rarity">
                  {(modelAttr.rarityPermille / 10).toFixed(1)}%
                </span>
              )}
            </div>
          )}

          {backdropAttr && (
            <div className="modal-attr">
              <span className="modal-attr-label">Фон:</span>
              <span className="modal-attr-value">{backdropAttr.name}</span>
              {backdropAttr.rarityPermille && (
                <span className="modal-attr-rarity">
                  {(backdropAttr.rarityPermille / 10).toFixed(1)}%
                </span>
              )}
            </div>
          )}

          {patternAttr && (
            <div className="modal-attr">
              <span className="modal-attr-label">Паттерн:</span>
              <span className="modal-attr-value">{patternAttr.name}</span>
              {patternAttr.rarityPermille && (
                <span className="modal-attr-rarity">
                  {(patternAttr.rarityPermille / 10).toFixed(1)}%
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