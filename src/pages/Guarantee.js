// src/pages/Guarantee.js
import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import lottie from 'lottie-web';
import './Guarantee.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://testingapps-ncf8.onrender.com';

function Guarantee() {
  const [screen, setScreen] = useState('main');
  const [currentDeal, setCurrentDeal] = useState(null);
  const [dealGifts, setDealGifts] = useState({});
  const [socket, setSocket] = useState(null);
  const [myGifts, setMyGifts] = useState([]);
  const [user, setUser] = useState(null);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [selectedGift, setSelectedGift] = useState(null);

  // Инициализация пользователя
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();

      const telegramUser = tg.initDataUnsafe?.user;
      if (telegramUser) {
        setUser({
          id: telegramUser.id,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          username: telegramUser.username
        });
      }
    } else {
      setUser({
        id: 123456789,
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser'
      });
    }
  }, []);

  // Инициализация WebSocket
  useEffect(() => {
    console.log('🔌 Подключение к WebSocket:', API_URL);
    const newSocket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('✅ WebSocket подключен:', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ WebSocket отключен');
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Ошибка подключения WebSocket:', error);
    });

    setSocket(newSocket);

    return () => {
      console.log('🔌 Закрытие WebSocket соединения');
      newSocket.close();
    };
  }, []);

  // Слушатели WebSocket
  useEffect(() => {
    if (!socket || !currentDeal) return;

    console.log('🔌 Настройка слушателей WebSocket для сделки:', currentDeal.id);

    socket.on('deal-state', (deal) => {
      console.log('✅ Получено обновление сделки:', deal);
      setCurrentDeal(deal);
    });

    socket.on('participant-joined', (data) => {
      console.log('✅ Участник присоединился:', data);
      
      // Обновляем локальную сделку на active
      setCurrentDeal(prev => ({
        ...prev,
        participant_id: data.participantId,
        status: 'active'
      }));
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showPopup({
          title: '🎉 Участник присоединился!',
          message: 'Теперь можете добавлять подарки',
          buttons: [{ type: 'ok' }]
        });
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      } else {
        alert('🎉 Участник присоединился!');
      }
    });

    socket.on('gifts-updated', (data) => {
      console.log('🎁 Подарки обновлены:', data);
      setDealGifts(data.gifts || {});
    });

    socket.on('confirmation-updated', (data) => {
      console.log('✅ Подтверждение обновлено:', data);
      setCurrentDeal(prev => ({
        ...prev,
        creator_confirmed: data.creatorConfirmed,
        participant_confirmed: data.participantConfirmed
      }));
    });

    socket.on('deal-completed', (data) => {
      console.log('🎉 Сделка завершена:', data);
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showPopup({
          title: '🎉 Обмен завершен!',
          message: data.message || 'Подарки успешно обменены!',
          buttons: [{ type: 'ok' }]
        });
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      } else {
        alert(data.message || '🎉 Обмен успешно завершен!');
      }
      
      setScreen('main');
      setCurrentDeal(null);
      setDealGifts({});
    });

    socket.on('deal-cancelled', (data) => {
      console.log('❌ Сделка отменена:', data);
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showPopup({
          title: '❌ Сделка отменена',
          message: 'Обмен был отменен',
          buttons: [{ type: 'ok' }]
        });
      } else {
        alert('❌ Сделка была отменена');
      }
      
      setScreen('main');
      setCurrentDeal(null);
      setDealGifts({});
    });

    socket.on('error', (data) => {
      console.error('❌ Ошибка WebSocket:', data);
      alert(data.message || 'Произошла ошибка');
    });

    return () => {
      console.log('🔌 Отключение слушателей WebSocket');
      socket.off('deal-state');
      socket.off('participant-joined');
      socket.off('gifts-updated');
      socket.off('confirmation-updated');
      socket.off('deal-completed');
      socket.off('deal-cancelled');
      socket.off('error');
    };
  }, [socket, currentDeal]);

  // Загрузка подарков
  useEffect(() => {
    if (!user) return;

    const loadMyGifts = async () => {
      try {
        console.log('📦 Загрузка подарков пользователя:', user.id);
        const response = await fetch(`${API_URL}/api/gifts?fromId=${user.id}&withdrawn=false`);
        const data = await response.json();
        
        if (data.gifts) {
          console.log('✅ Загружено подарков:', data.gifts.length);
          setMyGifts(data.gifts);
        }
      } catch (error) {
        console.error('❌ Ошибка загрузки подарков:', error);
      }
    };

    loadMyGifts();
  }, [user]);

  const handleCreateDeal = async () => {
    if (!user) return;

    try {
      const response = await fetch(`${API_URL}/api/deals/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId: user.id })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Сделка создана:', data.deal);
        setCurrentDeal(data.deal);
        setScreen('deal');
        
        const inviteCode = data.deal.invite_code;
        
        if (navigator.clipboard) {
          navigator.clipboard.writeText(inviteCode).catch(err => console.error(err));
        }
        
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.showAlert(
            `Код обмена: ${inviteCode}\n\nКод скопирован в буфер обмена!`
          );
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        
        socket.emit('join-deal', { dealId: data.deal.id, userId: user.id });
      }
    } catch (error) {
      console.error('❌ Ошибка создания сделки:', error);
      alert('Не удалось создать сделку');
    }
  };

  const handleJoinDeal = async () => {
    if (!user || !inviteCodeInput.trim()) return;

    try {
      const response = await fetch(`${API_URL}/api/deals/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          inviteCode: inviteCodeInput.toUpperCase(),
          participantId: user.id 
        })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Присоединились к сделке:', data.deal);
        setCurrentDeal(data.deal);
        setScreen('deal');
        setInviteCodeInput('');
        
        socket.emit('join-deal', { dealId: data.deal.id, userId: user.id });
      } else {
        alert('Ошибка: ' + (data.error || 'Сделка не найдена'));
      }
    } catch (error) {
      console.error('❌ Ошибка присоединения:', error);
      alert('Не удалось присоединиться');
    }
  };

  const handleAddGift = (gift) => {
    setSelectedGift(gift);
    setShowGiftModal(true);
  };

  const confirmAddGift = () => {
    if (!selectedGift || !currentDeal || !socket) return;

    console.log('🎁 Добавление подарка:', selectedGift.id);
    
    socket.emit('add-gift-to-deal', {
      dealId: currentDeal.id,
      userId: user.id,
      giftId: selectedGift.id
    });

    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }

    setShowGiftModal(false);
    setSelectedGift(null);
  };

  const handleRemoveGift = (giftId) => {
    if (!currentDeal || !socket) return;

    socket.emit('remove-gift-from-deal', {
      dealId: currentDeal.id,
      userId: user.id,
      giftId: giftId
    });
  };

  const handleConfirmDeal = () => {
    if (!currentDeal || !socket) return;

    const myUserId = String(user.id);
    const myGiftsInDeal = dealGifts[myUserId] || [];
    const otherUserId = currentDeal.creator_id === user.id 
      ? currentDeal.participant_id 
      : currentDeal.creator_id;
    const otherUserIdStr = String(otherUserId);
    const otherGiftsInDeal = dealGifts[otherUserIdStr] || [];

    if (myGiftsInDeal.length === 0 || otherGiftsInDeal.length === 0) {
      alert('Оба участника должны добавить хотя бы один подарок');
      return;
    }

    socket.emit('confirm-deal', {
      dealId: currentDeal.id,
      userId: user.id
    });
  };

  const handleCancelDeal = () => {
    if (!currentDeal || !socket) return;

    if (window.confirm('Вы уверены?')) {
      socket.emit('cancel-deal', {
        dealId: currentDeal.id,
        userId: user.id
      });
    }
  };

  const handleCopyCode = () => {
    const code = currentDeal.invite_code;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code)
        .then(() => {
          if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.showPopup({
              title: '✅ Скопировано!',
              message: 'Код скопирован',
              buttons: [{ type: 'ok' }]
            });
          } else {
            alert('✅ Код скопирован!');
          }
        });
    }
  };

  // Компонент для рендера подарков с Lottie
  const GiftPreview = ({ gift, size = 'medium' }) => {
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
      const modelAttr = attributes.find(attr => attr.className === 'StarGiftAttributeModel');
      
      if (modelAttr?.document?.mimeType === 'application/x-tgsticker') {
        try {
          const response = await fetch(`${API_URL}/api/telegram/file/${modelAttr.document.id}`);
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

    if (!gift.rawData?.gift) {
      return (
        <div className={`gift-preview-placeholder ${size}`}>
          <span className="gift-symbol">🎁</span>
        </div>
      );
    }

    const giftData = gift.rawData.gift;
    const attributes = giftData.attributes || [];
    const backdropAttr = attributes.find(attr => attr.className === 'StarGiftAttributeBackdrop');
    
    const backgroundStyle = backdropAttr ? {
      background: `radial-gradient(circle at center, ${formatColor(backdropAttr.centerColor)} 0%, ${formatColor(backdropAttr.edgeColor)} 100%)`
    } : {
      background: '#1a1a1a'
    };

    return (
      <div className={`gift-preview-lottie ${size}`} style={backgroundStyle}>
        <div 
          ref={modelLottieRef} 
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

  const GiftCardInventory = ({ gift }) => {
    const myUserId = String(user.id);
    const isInDeal = dealGifts[myUserId]?.some(g => g.id === gift.id);
    
    return (
      <div 
        className={`gift-card-inventory ${isInDeal ? 'disabled' : ''}`}
        onClick={() => !isInDeal && handleAddGift(gift)}
      >
        <GiftPreview gift={gift} size="medium" />
        <div className="gift-card-title">{gift.giftTitle || gift.gift_title}</div>
        {isInDeal && <div className="gift-card-badge">✓</div>}
      </div>
    );
  };

  const GiftCardMini = ({ gift, canRemove, onRemove }) => {
    return (
      <div className="gift-card-mini">
        <div className="gift-mini-preview">
          <GiftPreview gift={gift} size="small" />
        </div>
        <div className="gift-mini-info">
          <div className="gift-mini-title">{gift.giftTitle || gift.gift_title}</div>
        </div>
        {canRemove && (
          <button 
            className="gift-remove-btn"
            onClick={() => onRemove(gift.id)}
          >
            ✕
          </button>
        )}
      </div>
    );
  };

  // Главный экран
  if (screen === 'main') {
    return (
      <div className="guarantee-container">
        <div className="guarantee-header">
          <h1 className="guarantee-title">🤝 Гарант-сервис</h1>
          <p className="guarantee-subtitle">Безопасный обмен подарками</p>
        </div>

        <div className="guarantee-actions">
          <button className="guarantee-btn create-btn" onClick={handleCreateDeal}>
            <span className="btn-icon">🎁</span>
            <span className="btn-text">Создать обмен</span>
          </button>

          <button className="guarantee-btn join-btn" onClick={() => setScreen('join')}>
            <span className="btn-icon">🔗</span>
            <span className="btn-text">Присоединиться</span>
          </button>
        </div>

        <div className="guarantee-info">
          <h3>Как это работает?</h3>
          <ol>
            <li>Создайте обмен и получите код</li>
            <li>Отправьте код другому пользователю</li>
            <li>Добавьте подарки в обмен</li>
            <li>Подтвердите обмен</li>
            <li>Получите новые подарки!</li>
          </ol>
        </div>
      </div>
    );
  }

  // Экран присоединения
  if (screen === 'join') {
    return (
      <div className="guarantee-container">
        <div className="guarantee-header">
          <h1 className="guarantee-title">🔗 Присоединиться</h1>
          <p className="guarantee-subtitle">Введите код обмена</p>
        </div>

        <div className="join-form">
          <input
            type="text"
            className="invite-code-input"
            placeholder="AB12CD34"
            value={inviteCodeInput}
            onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
            maxLength={8}
          />

          <button className="guarantee-btn join-btn" onClick={handleJoinDeal}>
            Присоединиться
          </button>

          <button className="guarantee-btn back-btn" onClick={() => setScreen('main')}>
            Назад
          </button>
        </div>
      </div>
    );
  }

  // Экран сделки
  if (screen === 'deal' && currentDeal) {
    const isCreator = currentDeal.creator_id === user.id;
    const otherUserId = isCreator ? currentDeal.participant_id : currentDeal.creator_id;
    
    // ФИКС: приводим к строке для сравнения с ключами dealGifts
    const myUserId = String(user.id);
    const otherUserIdStr = String(otherUserId);
    
    const myGiftsInDeal = dealGifts[myUserId] || [];
    const otherGiftsInDeal = dealGifts[otherUserIdStr] || [];
    const myConfirmed = isCreator ? currentDeal.creator_confirmed : currentDeal.participant_confirmed;
    const otherConfirmed = isCreator ? currentDeal.participant_confirmed : currentDeal.creator_confirmed;

    return (
      <div className="guarantee-container">
        <div className="guarantee-header">
          <h1 className="guarantee-title">🤝 Обмен</h1>
        </div>

        {/* Баннер с кодом */}
        {currentDeal.status === 'waiting' && isCreator && (
          <div className="invite-code-banner">
            <div className="invite-code-header">
              <span className="invite-icon">🔗</span>
              <span>Код для обмена</span>
            </div>
            <div className="invite-code-display">{currentDeal.invite_code}</div>
            <button className="copy-code-btn" onClick={handleCopyCode}>
              📋 Скопировать код
            </button>
            <p className="invite-hint">Отправьте этот код другому пользователю</p>
          </div>
        )}

        {/* Окна участников */}
        {currentDeal.status === 'active' && (
          <>
            <div className="deal-windows">
              {/* Мое окно */}
              <div className="participant-window my-window">
                <div className="window-header">
                  <span className="participant-name">Вы</span>
                  {myConfirmed && <span className="confirmed-badge">✓ Подтверждено</span>}
                </div>
                <div className="window-gifts">
                  {myGiftsInDeal.length === 0 ? (
                    <div className="empty-gifts">Добавьте подарки из инвентаря</div>
                  ) : (
                    myGiftsInDeal.map(gift => (
                      <GiftCardMini 
                        key={gift.id} 
                        gift={gift} 
                        canRemove={!myConfirmed}
                        onRemove={handleRemoveGift}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Окно участника */}
              <div className="participant-window other-window">
                <div className="window-header">
                  <span className="participant-name">Участник</span>
                  {otherConfirmed && <span className="confirmed-badge">✓ Подтверждено</span>}
                </div>
                <div className="window-gifts">
                  {otherGiftsInDeal.length === 0 ? (
                    <div className="empty-gifts">Ожидание подарков...</div>
                  ) : (
                    otherGiftsInDeal.map(gift => (
                      <GiftCardMini key={gift.id} gift={gift} canRemove={false} />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Инвентарь */}
            {!myConfirmed && (
              <div className="deal-inventory">
                <h3 className="inventory-title">Мой инвентарь</h3>
                <div className="inventory-grid">
                  {myGifts.length === 0 ? (
                    <div className="empty-inventory">У вас нет доступных подарков</div>
                  ) : (
                    myGifts.map(gift => (
                      <GiftCardInventory key={gift.id} gift={gift} />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Кнопки управления */}
            <div className="deal-actions">
              <button className="guarantee-btn cancel-btn" onClick={handleCancelDeal}>
                Отменить обмен
              </button>

              {!myConfirmed ? (
                <button 
                  className="guarantee-btn confirm-btn"
                  onClick={handleConfirmDeal}
                  disabled={myGiftsInDeal.length === 0 || otherGiftsInDeal.length === 0}
                >
                  Подтвердить обмен
                </button>
              ) : (
                <div className="waiting-message">Ожидание подтверждения...</div>
              )}
            </div>
          </>
        )}

        {/* Модальное окно */}
        {showGiftModal && selectedGift && (
          <div className="modal-overlay" onClick={() => setShowGiftModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Добавить подарок?</h3>
              <div className="modal-gift">
                <GiftPreview gift={selectedGift} size="large" />
                <p className="modal-gift-title">{selectedGift.giftTitle || selectedGift.gift_title}</p>
              </div>
              <div className="modal-actions">
                <button className="modal-btn cancel" onClick={() => setShowGiftModal(false)}>
                  Отмена
                </button>
                <button className="modal-btn confirm" onClick={confirmAddGift}>
                  Добавить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="guarantee-container">
      <div className="loading">Загрузка...</div>
    </div>
  );
}

export default Guarantee;