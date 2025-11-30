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
  const [notifications, setNotifications] = useState([]);

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

  // Загрузка сделки из URL при открытии
  useEffect(() => {
    const loadDealFromUrl = async () => {
      if (!user || !socket) return;

      // Получаем dealId из URL параметров Telegram Mini App
      const tg = window.Telegram?.WebApp;
      const startParam = tg?.initDataUnsafe?.start_param;

      if (startParam && startParam.startsWith('deal_')) {
        const dealId = parseInt(startParam.replace('deal_', ''));
        
        try {
          console.log('🔍 Загрузка сделки из URL:', dealId);
          const response = await fetch(`${API_URL}/api/deals/${dealId}`);
          const data = await response.json();
          
          if (data.deal) {
            console.log('✅ Сделка загружена:', data.deal);
            setCurrentDeal(data.deal);
            setScreen('deal');
            
            // ВАЖНО: Подключаемся к WebSocket комнате
            socket.emit('join-deal', { dealId: data.deal.id, userId: user.id });
            
            // Загружаем подарки сделки
            const giftsResponse = await fetch(`${API_URL}/api/deals/${dealId}/gifts`);
            const giftsData = await giftsResponse.json();
            if (giftsData.gifts) {
              setDealGifts(giftsData.gifts);
            }
          }
        } catch (error) {
          console.error('❌ Ошибка загрузки сделки:', error);
        }
      }
    };

    loadDealFromUrl();
  }, [user, socket]);

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

      showNotification('🎉 Участник присоединился! Теперь можете добавлять подарки', 'success');
    });

    socket.on('gifts-updated', (data) => {
      console.log('🎁 Подарки обновлены:', data);
      console.log('🎁 Структура подарков:', JSON.stringify(data.gifts, null, 2));
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

      showNotification('🎉 ' + (data.message || 'Обмен успешно завершен! Подарки обменены'), 'success');

      setScreen('main');
      setCurrentDeal(null);
      setDealGifts({});
    });

    socket.on('deal-cancelled', (data) => {
      console.log('❌ Сделка отменена:', data);

      showNotification('❌ Обмен был отменен', 'error');

      setScreen('main');
      setCurrentDeal(null);
      setDealGifts({});
    });

    socket.on('error', (data) => {
      console.error('❌ Ошибка WebSocket:', data);
      showNotification(data.message || 'Произошла ошибка', 'error');
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

  // Функция для показа уведомлений
  const showNotification = (message, type = 'info') => {
    const id = Date.now();
    const notification = { id, message, type };
    setNotifications(prev => [...prev, notification]);

    // Автоматически убираем уведомление через 4 секунды
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);

    // Haptic feedback для Telegram
    if (window.Telegram?.WebApp) {
      if (type === 'success') {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      } else if (type === 'error') {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
      } else {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
      }
    }
  };

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

        // Автоматически копируем код - используем более надежный способ
        try {
          // Создаем временный input элемент
          const tempInput = document.createElement('input');
          tempInput.value = inviteCode;
          tempInput.style.position = 'fixed';
          tempInput.style.opacity = '0';
          document.body.appendChild(tempInput);
          tempInput.select();
          tempInput.setSelectionRange(0, 99999);

          const successful = document.execCommand('copy');
          document.body.removeChild(tempInput);

          if (successful) {
            console.log('✅ Код автоматически скопирован:', inviteCode);
            showNotification('Код приглашения скопирован!', 'success');
          } else {
            // Fallback на современный API
            navigator.clipboard.writeText(inviteCode)
              .then(() => {
                console.log('✅ Код скопирован через clipboard API');
                showNotification('Код приглашения скопирован!', 'success');
              })
              .catch(() => {
                showNotification('Код: ' + inviteCode, 'info');
              });
          }
        } catch (err) {
          console.error('❌ Ошибка автокопирования:', err);
          showNotification('Код: ' + inviteCode, 'info');
        }

        socket.emit('join-deal', { dealId: data.deal.id, userId: user.id });
      }
    } catch (error) {
      console.error('❌ Ошибка создания сделки:', error);
      showNotification('Не удалось создать сделку', 'error');
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
        showNotification('Успешно присоединились к обмену!', 'success');
      } else {
        showNotification(data.error || 'Сделка не найдена', 'error');
      }
    } catch (error) {
      console.error('❌ Ошибка присоединения:', error);
      showNotification('Не удалось присоединиться', 'error');
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
      showNotification('Оба участника должны добавить хотя бы один подарок', 'error');
      return;
    }

    // СРАЗУ ОБНОВЛЯЕМ ЛОКАЛЬНОЕ СОСТОЯНИЕ
    const isCreator = String(currentDeal.creator_id) === myUserId;
    setCurrentDeal(prev => ({
      ...prev,
      creator_confirmed: isCreator ? true : prev.creator_confirmed,
      participant_confirmed: !isCreator ? true : prev.participant_confirmed
    }));

    socket.emit('confirm-deal', {
      dealId: currentDeal.id,
      userId: user.id
    });

    showNotification('Ваше подтверждение отправлено', 'success');
  };

  const handleCancelDeal = () => {
    if (!currentDeal || !socket) return;

    // Вместо confirm используем прямую отмену
    socket.emit('cancel-deal', {
      dealId: currentDeal.id,
      userId: user.id
    });
  };

  const handleCopyCode = () => {
    const code = currentDeal.invite_code;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(code)
        .then(() => {
          showNotification('✅ Код скопирован в буфер обмена!', 'success');
        })
        .catch(() => {
          showNotification('Не удалось скопировать код', 'error');
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
      // Проверяем откуда пришел gift - из myGifts или из dealGifts
      const giftData = gift.rawData?.gift || gift.raw_data?.gift;
      
      if (!giftData || !modelLottieRef.current) {
        console.log('⚠️ Нет rawData для подарка:', gift.id);
        return;
      }

      const attributes = giftData.attributes || [];
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

    const giftData = gift.rawData?.gift || gift.raw_data?.gift;
    
    if (!giftData) {
      return (
        <div className={`gift-preview-placeholder ${size}`}>
          <span className="gift-symbol">🎁</span>
        </div>
      );
    }

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
        <div className="guarantee-header-main">
          <h1 className="guarantee-title-main">Гарант-сервис</h1>
          <p className="guarantee-subtitle-main">Безопасный обмен подарками</p>
        </div>

        <div className="guarantee-actions-main">
          <button className="guarantee-btn-main primary" onClick={handleCreateDeal}>
            <span className="btn-text-main">Создать обмен</span>
            <span className="btn-arrow">→</span>
          </button>

          <button className="guarantee-btn-main secondary" onClick={() => setScreen('join')}>
            <span className="btn-text-main">Присоединиться к обмену</span>
            <span className="btn-arrow">→</span>
          </button>
        </div>

        <div className="guarantee-features">
          <div className="feature-item">
            <div className="feature-number">1</div>
            <div className="feature-content">
              <h3 className="feature-title">Создайте обмен</h3>
              <p className="feature-description">Получите уникальный код для приглашения</p>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-number">2</div>
            <div className="feature-content">
              <h3 className="feature-title">Пригласите участника</h3>
              <p className="feature-description">Отправьте код другому пользователю</p>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-number">3</div>
            <div className="feature-content">
              <h3 className="feature-title">Добавьте подарки</h3>
              <p className="feature-description">Выберите подарки для обмена из инвентаря</p>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-number">4</div>
            <div className="feature-content">
              <h3 className="feature-title">Подтвердите обмен</h3>
              <p className="feature-description">Оба участника подтверждают условия</p>
            </div>
          </div>
        </div>

        {/* Уведомления */}
        <div className="notifications-container">
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={`notification notification-${notification.type}`}
            >
              <div className="notification-content">
                {notification.message}
              </div>
            </div>
          ))}
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

        {/* Уведомления */}
        <div className="notifications-container">
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={`notification notification-${notification.type}`}
            >
              <div className="notification-content">
                {notification.message}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Экран сделки
  if (screen === 'deal' && currentDeal) {
    // ФИКС: приводим ID к строке для сравнения
    const myUserId = String(user.id);
    const creatorId = String(currentDeal.creator_id);
    const participantId = String(currentDeal.participant_id);

    const isCreator = creatorId === myUserId;
    const otherUserId = isCreator ? participantId : creatorId;
    const otherUserIdStr = String(otherUserId);
    
    console.log('👤 Мой ID:', myUserId, 'Тип:', typeof myUserId);
    console.log('👤 ID другого:', otherUserIdStr, 'Тип:', typeof otherUserIdStr);
    console.log('📦 Ключи в dealGifts:', Object.keys(dealGifts));
    console.log('📦 dealGifts полностью:', dealGifts);
    
    const myGiftsInDeal = dealGifts[myUserId] || [];
    const otherGiftsInDeal = dealGifts[otherUserIdStr] || [];
    
    console.log('🎁 Мои подарки в сделке:', myGiftsInDeal.length);
    console.log('🎁 Подарки другого:', otherGiftsInDeal.length);
    
    const myConfirmed = isCreator ? currentDeal.creator_confirmed : currentDeal.participant_confirmed;
    const otherConfirmed = isCreator ? currentDeal.participant_confirmed : currentDeal.creator_confirmed;

    return (
      <div className="guarantee-container">
        <div className="guarantee-header">
          <h1 className="guarantee-title">Обмен</h1>
        </div>

        {/* Экран ожидания участника */}
        {currentDeal.status === 'waiting' && (
          <div className="waiting-participant-screen">
            <div className="waiting-animation">
              <div className="pulse-icon">👤</div>
            </div>
            <h2 className="waiting-title">Ожидание участника...</h2>

            {/* КОД ПРИГЛАШЕНИЯ ВСТРОЕН ПРЯМО СЮДА */}
            {isCreator && (
              <div className="invite-code-inline" onClick={handleCopyCode}>
                <div className="invite-code-label">Код приглашения</div>
                <div className="invite-code-value">{currentDeal.invite_code}</div>
                <div className="invite-code-tap">Нажмите, чтобы скопировать</div>
              </div>
            )}

            <p className="waiting-description">
              {isCreator
                ? 'Отправьте этот код другому пользователю. Как только он присоединится, вы сможете начать обмен.'
                : 'Ожидание подключения к обмену...'}
            </p>

            <div className="waiting-steps">
              <div className="waiting-step completed">
                <span className="step-icon">✓</span>
                <span className="step-text">Обмен создан</span>
              </div>
              <div className="waiting-step pending">
                <span className="step-icon">⏳</span>
                <span className="step-text">Ожидание участника</span>
              </div>
              <div className="waiting-step pending">
                <span className="step-icon">○</span>
                <span className="step-text">Добавление подарков</span>
              </div>
              <div className="waiting-step pending">
                <span className="step-icon">○</span>
                <span className="step-text">Подтверждение обмена</span>
              </div>
            </div>
            <button className="guarantee-btn cancel-btn" onClick={handleCancelDeal}>
              Отменить обмен
            </button>
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

        {/* Уведомления */}
        <div className="notifications-container">
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={`notification notification-${notification.type}`}
            >
              <div className="notification-content">
                {notification.message}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="guarantee-container">
      <div className="loading">Загрузка...</div>

      {/* Уведомления */}
      <div className="notifications-container">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`notification notification-${notification.type}`}
          >
            <div className="notification-content">
              {notification.message}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Guarantee;