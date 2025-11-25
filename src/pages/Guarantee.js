// src/pages/Guarantee.js

import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getTelegramUser, hapticFeedback, notificationHaptic } from '../utils/telegramUtils';
import './Guarantee.css';
import lottie from 'lottie-web';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const Guarantee = () => {
  const [user, setUser] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('main'); // 'main', 'create', 'join', 'deal'
  const [inviteCode, setInviteCode] = useState('');
  const [currentDeal, setCurrentDeal] = useState(null);
  const [myGifts, setMyGifts] = useState([]);
  const [dealGifts, setDealGifts] = useState({ creator: [], participant: [] });
  const [myConfirmed, setMyConfirmed] = useState(false);
  const [otherConfirmed, setOtherConfirmed] = useState(false);
  const [selectedGiftForAdd, setSelectedGiftForAdd] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const socketRef = useRef(null);

  useEffect(() => {
    const telegramUser = getTelegramUser();
    setUser(telegramUser);

    // Подключаем WebSocket
    socketRef.current = io(API_URL);

    socketRef.current.on('connect', () => {
      console.log('✅ WebSocket подключен');
    });

    socketRef.current.on('deal-state', (deal) => {
      console.log('📡 Получено состояние сделки:', deal);
      setCurrentDeal(deal);
      loadDealGifts(deal.id);
    });

    socketRef.current.on('gifts-updated', ({ gifts }) => {
      console.log('🎁 Подарки обновлены:', gifts);
      setDealGifts({
        creator: gifts[currentDeal?.creator_id] || [],
        participant: gifts[currentDeal?.participant_id] || []
      });
    });

    socketRef.current.on('confirmation-updated', ({ creatorConfirmed, participantConfirmed }) => {
      console.log('✅ Подтверждения обновлены:', { creatorConfirmed, participantConfirmed });
      
      if (currentDeal) {
        if (user.id === currentDeal.creator_id) {
          setMyConfirmed(creatorConfirmed);
          setOtherConfirmed(participantConfirmed);
        } else {
          setMyConfirmed(participantConfirmed);
          setOtherConfirmed(creatorConfirmed);
        }
      }
    });

    socketRef.current.on('deal-completed', ({ message }) => {
      notificationHaptic('success');
      alert(message);
      setCurrentScreen('main');
      setCurrentDeal(null);
    });

    socketRef.current.on('deal-cancelled', ({ cancelledBy }) => {
      notificationHaptic('error');
      alert(`Сделка отменена ${cancelledBy === user.id ? 'вами' : 'другим участником'}`);
      setCurrentScreen('main');
      setCurrentDeal(null);
    });

    socketRef.current.on('error', ({ message }) => {
      notificationHaptic('error');
      setError(message);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (currentDeal && user) {
      socketRef.current.emit('join-deal', {
        dealId: currentDeal.id,
        userId: user.id
      });
      
      loadMyGifts();
      loadDealGifts(currentDeal.id);
    }
  }, [currentDeal, user]);

  const loadMyGifts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/gifts?fromId=${user.id}&withdrawn=false`);
      const data = await response.json();
      setMyGifts(data.gifts || []);
    } catch (error) {
      console.error('Ошибка загрузки подарков:', error);
    }
  };

  const loadDealGifts = async (dealId) => {
    try {
      const response = await fetch(`${API_URL}/api/deals/${dealId}/gifts`);
      const data = await response.json();
      
      if (currentDeal) {
        setDealGifts({
          creator: data.gifts[currentDeal.creator_id] || [],
          participant: data.gifts[currentDeal.participant_id] || []
        });
      }
    } catch (error) {
      console.error('Ошибка загрузки подарков сделки:', error);
    }
  };

  const handleCreateDeal = async () => {
    try {
      setIsLoading(true);
      hapticFeedback('medium');

      const response = await fetch(`${API_URL}/api/deals/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId: user.id })
      });

      const data = await response.json();
      
      if (data.success) {
        setCurrentDeal(data.deal);
        setCurrentScreen('deal');
        notificationHaptic('success');
      }
    } catch (error) {
      console.error('Ошибка создания сделки:', error);
      setError('Не удалось создать сделку');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinDeal = async () => {
    try {
      setIsLoading(true);
      hapticFeedback('medium');

      const response = await fetch(`${API_URL}/api/deals/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode: inviteCode.toUpperCase(),
          participantId: user.id
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setCurrentDeal(data.deal);
        setCurrentScreen('deal');
        notificationHaptic('success');
      } else {
        setError(data.error || 'Не удалось присоединиться к сделке');
      }
    } catch (error) {
      console.error('Ошибка присоединения к сделке:', error);
      setError('Не удалось присоединиться к сделке');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddGiftToDeal = (gift) => {
    setSelectedGiftForAdd(gift);
  };

  const confirmAddGift = () => {
    if (selectedGiftForAdd && currentDeal) {
      hapticFeedback('light');
      socketRef.current.emit('add-gift-to-deal', {
        dealId: currentDeal.id,
        userId: user.id,
        giftId: selectedGiftForAdd.id
      });
      setSelectedGiftForAdd(null);
    }
  };

  const handleRemoveGift = (giftId) => {
    if (currentDeal) {
      hapticFeedback('light');
      socketRef.current.emit('remove-gift-from-deal', {
        dealId: currentDeal.id,
        userId: user.id,
        giftId
      });
    }
  };

  const handleConfirmDeal = () => {
    if (currentDeal && !myConfirmed) {
      hapticFeedback('medium');
      socketRef.current.emit('confirm-deal', {
        dealId: currentDeal.id,
        userId: user.id
      });
      setMyConfirmed(true);
    }
  };

  const handleCancelDeal = () => {
    if (currentDeal) {
      hapticFeedback('medium');
      socketRef.current.emit('cancel-deal', {
        dealId: currentDeal.id,
        userId: user.id
      });
    }
  };

  const copyInviteCode = () => {
    if (currentDeal?.invite_code) {
      navigator.clipboard.writeText(currentDeal.invite_code);
      notificationHaptic('success');
      alert('Код скопирован!');
    }
  };

  // Рендер главного экрана
  if (currentScreen === 'main') {
    return (
      <div className="guarantee-container">
        <div className="guarantee-content">
          <div className="guarantee-header">
            <div className="guarantee-icon">🔒</div>
            <h1 className="guarantee-title">Гарант сервис</h1>
            <p className="guarantee-subtitle">
              Безопасный обмен подарками
            </p>
          </div>

          <div className="guarantee-actions">
            <button
              className="guarantee-btn primary"
              onClick={() => setCurrentScreen('create')}
            >
              <span className="btn-icon">✨</span>
              Создать сделку
            </button>

            <button
              className="guarantee-btn secondary"
              onClick={() => setCurrentScreen('join')}
            >
              <span className="btn-icon">🔗</span>
              Присоединиться к сделке
            </button>
          </div>

          <div className="guarantee-info">
            <div className="info-card">
              <div className="info-icon">✅</div>
              <h3>Безопасность</h3>
              <p>Обмен происходит только после подтверждения обоих участников</p>
            </div>

            <div className="info-card">
              <div className="info-icon">⚡</div>
              <h3>Реальное время</h3>
              <p>Видите действия другого участника моментально</p>
            </div>

            <div className="info-card">
              <div className="info-icon">💰</div>
              <h3>Прозрачность</h3>
              <p>Полный контроль над процессом обмена</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Рендер экрана создания сделки
  if (currentScreen === 'create') {
    return (
      <div className="guarantee-container">
        <div className="guarantee-content">
          <button className="back-btn" onClick={() => setCurrentScreen('main')}>
            ← Назад
          </button>

          <div className="guarantee-header">
            <div className="guarantee-icon">✨</div>
            <h1 className="guarantee-title">Создать сделку</h1>
          </div>

          <div className="create-deal-info">
            <p>После создания сделки вы получите код приглашения, который нужно отправить другому участнику</p>
          </div>

          <button
            className="guarantee-btn primary large"
            onClick={handleCreateDeal}
            disabled={isLoading}
          >
            {isLoading ? 'Создание...' : 'Создать сделку'}
          </button>
        </div>
      </div>
    );
  }

  // Рендер экрана присоединения
  if (currentScreen === 'join') {
    return (
      <div className="guarantee-container">
        <div className="guarantee-content">
          <button className="back-btn" onClick={() => setCurrentScreen('main')}>
            ← Назад
          </button>

          <div className="guarantee-header">
            <div className="guarantee-icon">🔗</div>
            <h1 className="guarantee-title">Присоединиться</h1>
          </div>

          <div className="join-deal-form">
            <label className="input-label">Код приглашения:</label>
            <input
              type="text"
              className="invite-code-input"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="Введите код"
              maxLength={8}
            />

            {error && <div className="error-message">{error}</div>}

            <button
              className="guarantee-btn primary large"
              onClick={handleJoinDeal}
              disabled={isLoading || inviteCode.length < 8}
            >
              {isLoading ? 'Подключение...' : 'Присоединиться'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Рендер экрана активной сделки
  if (currentScreen === 'deal' && currentDeal) {
    const isCreator = user.id === currentDeal.creator_id;
    const myGiftsInDeal = isCreator ? dealGifts.creator : dealGifts.participant;
    const otherGiftsInDeal = isCreator ? dealGifts.participant : dealGifts.creator;

    return (
      <div className="guarantee-container deal-active">
        {/* Код приглашения (только для создателя до присоединения участника) */}
        {isCreator && !currentDeal.participant_id && (
          <div className="invite-code-banner">
            <div className="banner-content">
              <span>Код приглашения:</span>
              <div className="code-display" onClick={copyInviteCode}>
                {currentDeal.invite_code}
                <span className="copy-hint">📋 Нажмите чтобы скопировать</span>
              </div>
            </div>
          </div>
        )}

        {/* Верхние окна участников */}
        <div className="deal-participants">
          {/* Мое окно */}
          <div className="participant-window my-window">
            <div className="window-header">
              <span className="participant-name">Вы</span>
              {myConfirmed && <span className="confirmed-badge">✓ Подтверждено</span>}
            </div>
            <div className="window-gifts">
              {myGiftsInDeal.length === 0 ? (
                <div className="empty-gifts">Подарки не добавлены</div>
              ) : (
                myGiftsInDeal.map(gift => (
                  <GiftCardMini
                    key={gift.id}
                    gift={gift}
                    onRemove={() => handleRemoveGift(gift.id)}
                    canRemove={!myConfirmed}
                  />
                ))
              )}
            </div>
          </div>

          {/* Окно другого участника */}
          <div className="participant-window other-window">
            <div className="window-header">
              <span className="participant-name">
                {currentDeal.participant_id ? 'Участник' : 'Ожидание...'}
              </span>
              {otherConfirmed && <span className="confirmed-badge">✓ Подтверждено</span>}
            </div>
            <div className="window-gifts">
              {otherGiftsInDeal.length === 0 ? (
                <div className="empty-gifts">
                  {currentDeal.participant_id ? 'Подарки не добавлены' : 'Ожидание участника...'}
                </div>
              ) : (
                otherGiftsInDeal.map(gift => (
                  <GiftCardMini key={gift.id} gift={gift} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Инвентарь */}
        <div className="deal-inventory">
          <div className="inventory-header">
            <h3>Мой инвентарь</h3>
            <span className="gifts-count">{myGifts.length} подарков</span>
          </div>
          <div className="inventory-grid">
            {myGifts.map(gift => (
              <GiftCardInventory
                key={gift.id}
                gift={gift}
                onClick={() => handleAddGiftToDeal(gift)}
                disabled={myConfirmed || myGiftsInDeal.some(g => g.id === gift.id)}
              />
            ))}
          </div>
        </div>

        {/* Кнопки управления */}
        <div className="deal-controls">
          <button
            className="control-btn cancel"
            onClick={handleCancelDeal}
            disabled={myConfirmed && otherConfirmed}
          >
            Отменить сделку
          </button>

          <button
            className="control-btn confirm"
            onClick={handleConfirmDeal}
            disabled={myConfirmed || myGiftsInDeal.length === 0}
          >
            {myConfirmed ? '✓ Подтверждено' : 'Подтвердить обмен'}
          </button>
        </div>

        {/* Модальное окно подтверждения добавления */}
        {selectedGiftForAdd && (
          <div className="modal-overlay" onClick={() => setSelectedGiftForAdd(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Добавить подарок в сделку?</h3>
              <div className="modal-gift-info">
                <p><strong>{selectedGiftForAdd.gift_title}</strong></p>
                <p>Модель: {selectedGiftForAdd.model}</p>
              </div>
              <div className="modal-actions">
                <button
                  className="modal-btn cancel"
                  onClick={() => setSelectedGiftForAdd(null)}
                >
                  Отмена
                </button>
                <button
                  className="modal-btn confirm"
                  onClick={confirmAddGift}
                >
                  Подтвердить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

// Компонент мини-карточки подарка в окне участника
const GiftCardMini = ({ gift, onRemove, canRemove }) => {
  return (
    <div className="gift-card-mini">
      <div className="gift-preview-mini">
        <GiftPreviewLottie gift={gift} size="small" />
      </div>
      <div className="gift-info-mini">
        <div className="gift-title-mini">{gift.giftTitle}</div>
        <div className="gift-model-mini">{gift.model}</div>
      </div>
      {canRemove && (
        <button className="remove-gift-btn" onClick={onRemove}>
          ✕
        </button>
      )}
    </div>
  );
};

// Компонент карточки подарка в инвентаре
const GiftCardInventory = ({ gift, onClick, disabled }) => {
  return (
    <div
      className={`gift-card-inventory ${disabled ? 'disabled' : ''}`}
      onClick={!disabled ? onClick : undefined}
    >
      <div className="gift-preview-inventory">
        <GiftPreviewLottie gift={gift} size="medium" />
      </div>
      <div className="gift-info-inventory">
        <div className="gift-title-inventory">{gift.gift_title}</div>
      </div>
    </div>
  );
};

// Компонент превью подарка с Lottie
const GiftPreviewLottie = ({ gift, size }) => {
  const lottieRef = useRef(null);
  const lottieInstance = useRef(null);

  useEffect(() => {
    loadLottie();
    return () => {
      if (lottieInstance.current) {
        lottieInstance.current.destroy();
      }
    };
  }, [gift.id]);

  const loadLottie = async () => {
    if (!gift.rawData?.gift || !lottieRef.current) return;

    const attributes = gift.rawData.gift.attributes || [];
    const modelAttr = attributes.find(attr => attr.className === 'StarGiftAttributeModel');

    if (modelAttr?.document?.mimeType === 'application/x-tgsticker') {
      try {
        const response = await fetch(`${API_URL}/api/telegram/file/${modelAttr.document.id}`);
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
      }
    }
  };

  const formatColor = (colorInt) => {
    if (!colorInt && colorInt !== 0) return '#000000';
    const hex = (colorInt >>> 0).toString(16).padStart(6, '0');
    return `#${hex}`;
  };

  const attributes = gift.rawData?.gift?.attributes || [];
  const backdropAttr = attributes.find(attr => attr.className === 'StarGiftAttributeBackdrop');

  const backgroundStyle = backdropAttr ? {
    background: `radial-gradient(circle at center, ${formatColor(backdropAttr.centerColor)} 0%, ${formatColor(backdropAttr.edgeColor)} 100%)`
  } : {
    background: '#1a1a1a'
  };

  return (
    <div className={`gift-lottie-preview size-${size}`} style={backgroundStyle}>
      <div ref={lottieRef} className="lottie-container" />
    </div>
  );
};

export default Guarantee;