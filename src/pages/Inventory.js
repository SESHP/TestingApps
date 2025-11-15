// src/pages/Inventory.js

import React, { useState, useEffect } from 'react';
import { getTelegramUser } from '../utils/telegramUtils';
import './Inventory.css';

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
      
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const response = await fetch(`${apiUrl}/api/gifts?fromId=${telegramUserId}&withdrawn=false`);
      
      if (!response.ok) {
        throw new Error(`Ошибка загрузки: ${response.status}`);
      }
      
      const data = await response.json();
      setGifts(data.gifts || []);
      
    } catch (err) {
      console.error('Ошибка загрузки подарков:', err);
      setError(`Не удалось загрузить подарки: ${err.message}`);
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
              Отправьте подарок на @FNPK3, чтобы он появился здесь
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

// Декодер PhotoPathSize в SVG (алгоритм из Telegram Web)
const decodeSvgPath = (bytes) => {
  if (!bytes || !bytes.data || bytes.data.length === 0) return '';
  
  const commands = [];
  let x = 0;
  let y = 0;
  
  for (let i = 0; i < bytes.data.length;) {
    const op = bytes.data[i++];
    
    // Определяем тип команды по старшим битам
    if (op === 0) {
      // Конец команд
      break;
    }
    
    // Читаем координаты (используем signed numbers)
    const readCoord = () => {
      if (i >= bytes.data.length) return 0;
      let value = bytes.data[i++];
      // Если значение > 127, это отрицательное число
      if (value > 127) value = value - 256;
      return value;
    };
    
    const dx = readCoord();
    const dy = readCoord();
    
    x += dx;
    y += dy;
    
    if (commands.length === 0) {
      commands.push(`M${x},${y}`);
    } else {
      // Используем кубические кривые Безье для сглаживания
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        commands.push(`L${x},${y}`);
      } else {
        commands.push(`L${x},${y}`);
      }
    }
  }
  
  return commands.join(' ');
};

// Компонент SVG из PhotoPathSize
const TelegramSvg = ({ thumbs, size = 120, color = 'currentColor', opacity = 1 }) => {
  if (!thumbs || !Array.isArray(thumbs)) return null;
  
  const pathThumb = thumbs.find(t => t.className === 'PhotoPathSize');
  if (!pathThumb?.bytes) return null;
  
  const pathData = decodeSvgPath(pathThumb.bytes);
  if (!pathData) return null;
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity }}
    >
      <path
        d={pathData}
        fill={color}
        fillOpacity={opacity}
      />
    </svg>
  );
};

// Компонент карточки подарка
const GiftCard = ({ gift, onClick }) => {
  const formatColor = (colorInt) => {
    if (!colorInt && colorInt !== 0) return '#000000';
    const hex = (colorInt >>> 0).toString(16).padStart(6, '0');
    return `#${hex}`;
  };

  const renderGiftPreview = () => {
    if (!gift.rawData?.gift) {
      return (
        <div className="gift-preview">
          <div className="gift-placeholder">🎁</div>
        </div>
      );
    }

    const giftData = gift.rawData.gift;
    const attributes = giftData.attributes || [];
    
    const backdropAttr = attributes.find(attr => attr.className === 'StarGiftAttributeBackdrop');
    const patternAttr = attributes.find(attr => attr.className === 'StarGiftAttributePattern');
    const modelAttr = attributes.find(attr => attr.className === 'StarGiftAttributeModel');

    // Фон
    const backgroundStyle = backdropAttr ? {
      background: `radial-gradient(circle at center, ${formatColor(backdropAttr.centerColor)} 0%, ${formatColor(backdropAttr.edgeColor)} 100%)`
    } : {
      background: '#1a1a1a'
    };

    const patternColor = backdropAttr ? formatColor(backdropAttr.patternColor) : '#ffffff';

    return (
      <div className="gift-preview" style={backgroundStyle}>
        {/* Паттерн */}
        {patternAttr?.document?.thumbs && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.15,
            pointerEvents: 'none'
          }}>
            <TelegramSvg 
              thumbs={patternAttr.document.thumbs}
              size={100}
              color={patternColor}
            />
          </div>
        )}
        
        {/* Модель */}
        {modelAttr?.document?.thumbs ? (
          <div style={{ position: 'relative', zIndex: 2 }}>
            <TelegramSvg 
              thumbs={modelAttr.document.thumbs}
              size={110}
              color="#ffffff"
            />
          </div>
        ) : (
          <div className="gift-placeholder">🎁</div>
        )}
      </div>
    );
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
  const formatColor = (colorInt) => {
    if (!colorInt && colorInt !== 0) return '#000000';
    const hex = (colorInt >>> 0).toString(16).padStart(6, '0');
    return `#${hex}`;
  };

  const renderMainContent = () => {
    if (!gift.rawData?.gift) {
      return (
        <div className="modal-gift-container">
          <div className="modal-gift-placeholder">🎁</div>
        </div>
      );
    }

    const giftData = gift.rawData.gift;
    const attributes = giftData.attributes || [];
    
    const backdropAttr = attributes.find(attr => attr.className === 'StarGiftAttributeBackdrop');
    const patternAttr = attributes.find(attr => attr.className === 'StarGiftAttributePattern');
    const modelAttr = attributes.find(attr => attr.className === 'StarGiftAttributeModel');

    const backgroundStyle = backdropAttr ? {
      background: `radial-gradient(circle at center, ${formatColor(backdropAttr.centerColor)} 0%, ${formatColor(backdropAttr.edgeColor)} 100%)`
    } : {
      background: '#1a1a1a'
    };

    const patternColor = backdropAttr ? formatColor(backdropAttr.patternColor) : '#ffffff';

    return (
      <div className="modal-gift-container" style={backgroundStyle}>
        {/* Паттерн */}
        {patternAttr?.document?.thumbs && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.12,
            pointerEvents: 'none'
          }}>
            <TelegramSvg 
              thumbs={patternAttr.document.thumbs}
              size={200}
              color={patternColor}
            />
          </div>
        )}
        
        {/* Модель */}
        {modelAttr?.document?.thumbs ? (
          <div style={{ position: 'relative', zIndex: 2 }}>
            <TelegramSvg 
              thumbs={modelAttr.document.thumbs}
              size={250}
              color="#ffffff"
            />
          </div>
        ) : (
          <div className="modal-gift-placeholder">🎁</div>
        )}
      </div>
    );
  };

  const attributes = gift.rawData?.gift?.attributes || [];
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