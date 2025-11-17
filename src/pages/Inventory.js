// src/pages/Inventory.js

import React, { useState, useEffect, useRef } from 'react';
import { getTelegramUser } from '../utils/telegramUtils';
import './Inventory.css';
import lottie from 'lottie-web';

// Функция для склонения слова "подарок"
const getPluralForm = (count) => {
  const cases = [2, 0, 1, 1, 1, 2];
  const titles = ['Подарок', 'Подарка', 'Подарков'];
  
  return titles[
    (count % 100 > 4 && count % 100 < 20) 
      ? 2 
      : cases[Math.min(count % 10, 5)]
  ];
};

const Inventory = () => {
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null);
  const [selectedGift, setSelectedGift] = useState(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  
  const containerRef = useRef(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  useEffect(() => {
    initializeInventory();
  }, []);

  useEffect(() => {
    // Добавляем обработчики для pull-to-refresh
    const container = containerRef.current;
    if (!container) return;

    let touchStartY = 0;
    let isTouching = false;

    const handleTouchStart = (e) => {
      if (window.scrollY === 0 && container.scrollTop === 0) {
        touchStartY = e.touches[0].clientY;
        isTouching = true;
        startY.current = touchStartY;
        setIsPulling(false);
      }
    };

    const handleTouchMove = (e) => {
      if (!isTouching) return;
      
      const touchY = e.touches[0].clientY;
      const distance = touchY - touchStartY;
      
      if (distance > 0 && window.scrollY === 0) {
        setIsPulling(true);
        setPullDistance(Math.min(distance, 100));
        
        if (distance > 10) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = () => {
      if (isTouching && pullDistance > 60 && !refreshing) {
        handleRefresh();
      }
      isTouching = false;
      setIsPulling(false);
      setPullDistance(0);
      startY.current = 0;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, refreshing]);

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

  const handleWithdrawSuccess = () => {
    if (userId) {
      loadUserGifts(userId);
    }
    setSelectedGift(null);
  };

  if (loading) {
    return (
      <div className="inventory-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Загрузка подарков...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inventory-container" ref={containerRef}>
      {/* Liquid Glass плашка с счетчиком */}
      <div className="gift-counter">
        {gifts.length} {getPluralForm(gifts.length)}
      </div>

      {error && (
        <div className="error-card">
          <div className="error-icon">⚠️</div>
          <p className="error-text">{error}</p>
        </div>
      )}

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
          userId={userId}
          onWithdrawSuccess={handleWithdrawSuccess}
        />
      )}
    </div>
  );
};

// Компонент для паттерна в шахматном порядке
const PatternGrid = ({ patternAttr, size = 'small' }) => {
  const patternRefs = useRef([]);
  const instances = useRef([]);
  const apiUrl = process.env.REACT_APP_API_URL || '';

  useEffect(() => {
    loadPatterns();
    return () => {
      instances.current.forEach(inst => {
        if (inst) inst.destroy();
      });
    };
  }, [patternAttr]);

  const loadPatterns = async () => {
    if (!patternAttr?.document?.mimeType === 'application/x-tgsticker') return;

    try {
      const response = await fetch(`${apiUrl}/api/telegram/file/${patternAttr.document.id}`);
      if (!response.ok) return;
      
      const animationData = await response.json();

      patternRefs.current.forEach((ref, index) => {
        if (!ref) return;
        
        if (instances.current[index]) {
          instances.current[index].destroy();
        }

        instances.current[index] = lottie.loadAnimation({
          container: ref,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          animationData: animationData
        });
      });
    } catch (err) {
      console.error('Ошибка загрузки паттерна:', err);
    }
  };

  if (!patternAttr) return null;

  const isModal = size === 'large';
  
  // Создаем сетку в шахматном порядке
  const patterns = [];
  const gridSize = isModal ? 7 : 5;
  const step = 100 / (gridSize + 1);
  const centerRadius = isModal ? 35 : 30;
  const maxSize = isModal ? 25 : 20;
  const minSize = isModal ? 12 : 10;
  
  let patternIndex = 0;
  
  for (let row = 0; row <= gridSize; row++) {
    for (let col = 0; col <= gridSize; col++) {
      if ((row + col) % 2 !== 0) continue;
      
      const x = step * (col + 1);
      const y = step * (row + 1);
      
      const dx = x - 50;
      const dy = y - 50;
      const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
      
      if (distanceFromCenter < centerRadius) continue;
      
      const maxDistance = Math.sqrt(50 * 50 + 50 * 50);
      const normalizedDistance = (distanceFromCenter - centerRadius) / (maxDistance - centerRadius);
      const patternSize = maxSize - (maxSize - minSize) * normalizedDistance;
      
      patterns.push({
        id: patternIndex++,
        x: x,
        y: y,
        size: Math.max(minSize, Math.min(maxSize, patternSize))
      });
    }
  }

  return (
    <div className={isModal ? 'modal-pattern-grid' : 'gift-pattern-grid'}>
      {patterns.map((pattern) => (
        <div
          key={pattern.id}
          ref={el => patternRefs.current[pattern.id] = el}
          className={isModal ? 'modal-pattern-item' : 'pattern-item'}
          style={{
            left: `${pattern.x}%`,
            top: `${pattern.y}%`,
            width: `${pattern.size}px`,
            height: `${pattern.size}px`,
            transform: 'translate(-50%, -50%)'
          }}
        />
      ))}
    </div>
  );
};

// Компонент карточки подарка
const GiftCard = ({ gift, onClick }) => {
  const modelLottieRef = useRef(null);
  const modelInstance = useRef(null);

  useEffect(() => {
    loadModel();
    return () => {
      if (modelInstance.current) {
        modelInstance.current.destroy();
      }
    };
  }, [gift.id]);

  const loadModel = async () => {
    if (!gift.rawData?.gift || !modelLottieRef.current) return;

    const attributes = gift.rawData.gift.attributes || [];
    const apiUrl = process.env.REACT_APP_API_URL || '';
    
    const modelAttr = attributes.find(attr => attr.className === 'StarGiftAttributeModel');
    if (modelAttr?.document?.mimeType === 'application/x-tgsticker') {
      try {
        const response = await fetch(`${apiUrl}/api/telegram/file/${modelAttr.document.id}`);
        if (response.ok) {
          const animationData = await response.json();
          
          if (modelInstance.current) {
            modelInstance.current.destroy();
          }
          
          modelInstance.current = lottie.loadAnimation({
            container: modelLottieRef.current,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            animationData: animationData
          });
        }
      } catch (err) {
        console.error('Ошибка загрузки модели:', err);
      }
    }
  };

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
    
    const backgroundStyle = backdropAttr ? {
      background: `radial-gradient(circle at center, ${formatColor(backdropAttr.centerColor)} 0%, ${formatColor(backdropAttr.edgeColor)} 100%)`
    } : {
      background: '#1a1a1a'
    };

    return (
      <div className="gift-preview" style={backgroundStyle}>
        <PatternGrid patternAttr={patternAttr} size="small" />
        
        <div 
          ref={modelLottieRef} 
          className="gift-lottie-preview"
          style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            height: '100%'
          }}
        />
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
      </div>
    </div>
  );
};

// Компонент модального окна
const GiftModal = ({ gift, onClose, userId, onWithdrawSuccess }) => {
  const modelLottieRef = useRef(null);
  const modelInstance = useRef(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  useEffect(() => {
    loadModel();
    return () => {
      if (modelInstance.current) {
        modelInstance.current.destroy();
      }
    };
  }, [gift.id]);

  const loadModel = async () => {
    if (!gift.rawData?.gift || !modelLottieRef.current) return;

    const attributes = gift.rawData.gift.attributes || [];
    const apiUrl = process.env.REACT_APP_API_URL || '';
    
    const modelAttr = attributes.find(attr => attr.className === 'StarGiftAttributeModel');
    if (modelAttr?.document?.mimeType === 'application/x-tgsticker') {
      try {
        const response = await fetch(`${apiUrl}/api/telegram/file/${modelAttr.document.id}`);
        if (response.ok) {
          const animationData = await response.json();
          
          if (modelInstance.current) {
            modelInstance.current.destroy();
          }
          
          modelInstance.current = lottie.loadAnimation({
            container: modelLottieRef.current,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            animationData: animationData
          });
        }
      } catch (err) {
        console.error('Ошибка загрузки модели:', err);
      }
    }
  };


  const handleWithdraw = async () => {
  if (!userId || !gift.giftId) {
    setWithdrawError('Недостаточно данных для вывода');
    return;
  }

  try {
    setWithdrawing(true);
    setWithdrawError(null);

    const apiUrl = process.env.REACT_APP_API_URL || '';
    
    console.log('Отправка запроса:', {
      giftId: gift.giftId,
      toId: userId
    });
    
    const response = await fetch(`${apiUrl}/api/gifts/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        giftId: gift.giftId,
        toId: userId
      })
    });

    const result = await response.json();
    
    console.log('Ответ сервера:', {
      status: response.status,
      ok: response.ok,
      data: result
    });

    if (!response.ok) {
      throw new Error(result.error || result.details || 'Не удалось вывести подарок');
    }
    
    if (result.success) {
      setWithdrawSuccess(true);
      setTimeout(() => {
        onWithdrawSuccess();
      }, 1500);
    } else {
      throw new Error('Не удалось вывести подарок');
    }

  } catch (err) {
    console.error('Ошибка вывода подарка:', err);
    setWithdrawError(err.message || 'Не удалось вывести подарок');
  } finally {
    setWithdrawing(false);
  }
};


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

    const backgroundStyle = backdropAttr ? {
      background: `radial-gradient(circle at center, ${formatColor(backdropAttr.centerColor)} 0%, ${formatColor(backdropAttr.edgeColor)} 100%)`
    } : {
      background: '#1a1a1a'
    };

    return (
      <div className="modal-gift-container" style={backgroundStyle}>
        <PatternGrid patternAttr={patternAttr} size="large" />
        
        <div 
          ref={modelLottieRef} 
          className="modal-gift-lottie"
          style={{
            position: 'relative',
            zIndex: 2,
            width: '80%',
            height: '80%'
          }}
        />
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
          {/* Уведомление об ошибке */}
          {withdrawError && (
            <div className="withdraw-error">
              <span className="error-icon">⚠️</span>
              <span>{withdrawError}</span>
            </div>
          )}

          {/* Уведомление об успехе */}
          {withdrawSuccess && (
            <div className="withdraw-success">
              <span className="success-icon">✓</span>
              <span>Подарок успешно выведен!</span>
            </div>
          )}

          {/* Кнопка вывода */}
          <button 
            className="withdraw-button"
            onClick={handleWithdraw}
            disabled={withdrawing || withdrawSuccess}
          >
            {withdrawing ? (
              <>
                <div className="button-spinner"></div>
                <span>Вывод...</span>
              </>
            ) : withdrawSuccess ? (
              <>
                <span className="success-icon">✓</span>
                <span>Выведено</span>
              </>
            ) : (
              <>
                <span className="button-icon">💸</span>
                <span>Вывести подарок</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Inventory;