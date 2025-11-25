import React, { useState, useEffect } from 'react';
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
  const [selectedGift, setSelectedGift] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Инициализация пользователя
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
      if (tgUser) {
        setUser({
          id: tgUser.id,
          firstName: tgUser.first_name,
          username: tgUser.username
        });
      }
    }
  }, []);

  // Инициализация WebSocket
  useEffect(() => {
    console.log('🔌 Подключение к WebSocket:', API_URL);
    const newSocket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('✅ WebSocket подключен:', newSocket.id);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Ошибка подключения WebSocket:', error);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ WebSocket отключен');
    });

    setSocket(newSocket);
    
    return () => {
      console.log('🔌 Закрытие WebSocket соединения');
      newSocket.close();
    };
  }, []);

  // Слушатели WebSocket для текущей сделки
  useEffect(() => {
    if (!socket || !currentDeal) return;

    console.log('🔌 Настройка слушателей WebSocket для сделки:', currentDeal.id);

    // Обновление состояния сделки
    socket.on('deal-state', (deal) => {
      console.log('📋 Получено состояние сделки:', deal);
      setCurrentDeal(deal);
    });

    // Участник присоединился
    socket.on('participant-joined', (data) => {
      console.log('✅ Участник присоединился:', data);
      
      setCurrentDeal(prev => ({
        ...prev,
        participant_id: data.participantId,
        status: 'active'
      }));
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showPopup({
          title: '✅ Участник присоединился!',
          message: 'Теперь вы можете добавлять подарки для обмена',
          buttons: [{ type: 'ok' }]
        });
      } else {
        alert('✅ Участник присоединился! Теперь можно добавлять подарки.');
      }
    });

    // Обновление подарков
    socket.on('gifts-updated', (data) => {
      console.log('🎁 Подарки обновлены:', data);
      setDealGifts(data.gifts || {});
    });

    // Обновление подтверждений
    socket.on('confirmation-updated', (data) => {
      console.log('✅ Подтверждение обновлено:', data);
      setCurrentDeal(prev => ({
        ...prev,
        creator_confirmed: data.creatorConfirmed,
        participant_confirmed: data.participantConfirmed
      }));
    });

    // Сделка завершена
    socket.on('deal-completed', (data) => {
      console.log('🎉 Сделка завершена:', data);
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(data.message || '🎉 Обмен успешно завершен!', () => {
          setScreen('main');
          setCurrentDeal(null);
          setDealGifts({});
          loadMyGifts();
        });
      } else {
        alert(data.message || '🎉 Обмен успешно завершен!');
        setScreen('main');
        setCurrentDeal(null);
        setDealGifts({});
        loadMyGifts();
      }
    });

    // Сделка отменена
    socket.on('deal-cancelled', (data) => {
      console.log('❌ Сделка отменена:', data);
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('Сделка была отменена', () => {
          setScreen('main');
          setCurrentDeal(null);
          setDealGifts({});
        });
      } else {
        alert('Сделка была отменена');
        setScreen('main');
        setCurrentDeal(null);
        setDealGifts({});
      }
    });

    // Ошибка
    socket.on('error', (data) => {
      console.error('❌ Ошибка WebSocket:', data);
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(data.message || 'Произошла ошибка');
      } else {
        alert(data.message || 'Произошла ошибка');
      }
    });

    // Очистка слушателей
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

  // Загрузка подарков пользователя
  const loadMyGifts = async () => {
    if (!user) return;

    try {
      const response = await fetch(`${API_URL}/api/gifts/${user.id}`);
      const data = await response.json();
      
      if (data.success) {
        // Фильтруем только невыведенные подарки
        const availableGifts = data.gifts.filter(g => !g.is_withdrawn);
        setMyGifts(availableGifts);
        console.log('✅ Загружено подарков:', availableGifts.length);
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки подарков:', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadMyGifts();
    }
  }, [user]);

  // Создание новой сделки
  const handleCreateDeal = async () => {
    if (!user) {
      alert('Ошибка: пользователь не определен');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/deals/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId: user.id })
      });

      const data = await response.json();
      
      if (data.success) {
        setCurrentDeal(data.deal);
        setScreen('deal');
        
        const inviteCode = data.deal.invite_code;
        
        // Копируем код в буфер обмена
        if (navigator.clipboard) {
          navigator.clipboard.writeText(inviteCode).catch(err => {
            console.error('Ошибка копирования:', err);
          });
        }
        
        // Показываем уведомление
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.showPopup({
            title: '✅ Сделка создана!',
            message: `Код для обмена: ${inviteCode}\n\nКод скопирован в буфер обмена. Отправьте его другому пользователю.`,
            buttons: [{ type: 'ok' }]
          });
        } else {
          alert(`Код для обмена: ${inviteCode}\n\nКод скопирован в буфер обмена!`);
        }
        
        // Подключаемся к сделке через WebSocket
        socket.emit('join-deal', { dealId: data.deal.id, userId: user.id });
      }
    } catch (error) {
      console.error('❌ Ошибка создания сделки:', error);
      alert('Не удалось создать сделку');
    }
  };

  // Присоединение к существующей сделке
  const handleJoinDeal = async () => {
    if (!user || !inviteCodeInput.trim()) {
      alert('Введите код обмена');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/deals/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          inviteCode: inviteCodeInput.trim().toUpperCase(), 
          participantId: user.id 
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setCurrentDeal(data.deal);
        setScreen('deal');
        setInviteCodeInput('');
        
        // Подключаемся к сделке через WebSocket
        socket.emit('join-deal', { dealId: data.deal.id, userId: user.id });
        
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.showPopup({
            title: '✅ Присоединились к обмену!',
            message: 'Добавьте свои подарки для обмена',
            buttons: [{ type: 'ok' }]
          });
        }
      } else {
        alert(data.error || 'Не удалось присоединиться к сделке');
      }
    } catch (error) {
      console.error('❌ Ошибка присоединения к сделке:', error);
      alert('Не удалось присоединиться к сделке');
    }
  };

  // Добавление подарка в сделку
  const handleAddGift = (gift) => {
    setSelectedGift(gift);
    setShowAddModal(true);
  };

  const confirmAddGift = () => {
    if (!socket || !currentDeal || !selectedGift) return;

    console.log('➕ Добавление подарка в сделку:', selectedGift.id);
    
    socket.emit('add-gift-to-deal', {
      dealId: currentDeal.id,
      userId: user.id,
      giftId: selectedGift.id
    });

    setShowAddModal(false);
    setSelectedGift(null);
  };

  // Удаление подарка из сделки
  const handleRemoveGift = (giftId) => {
    if (!socket || !currentDeal) return;

    console.log('➖ Удаление подарка из сделки:', giftId);
    
    socket.emit('remove-gift-from-deal', {
      dealId: currentDeal.id,
      userId: user.id,
      giftId: giftId
    });
  };

  // Подтверждение обмена
  const handleConfirmDeal = () => {
    if (!socket || !currentDeal) return;

    const myGiftsInDeal = dealGifts[user.id] || [];
    const otherUserId = currentDeal.creator_id === user.id 
      ? currentDeal.participant_id 
      : currentDeal.creator_id;
    const otherGiftsInDeal = dealGifts[otherUserId] || [];

    if (myGiftsInDeal.length === 0 || otherGiftsInDeal.length === 0) {
      alert('Оба участника должны добавить хотя бы один подарок');
      return;
    }

    console.log('✅ Подтверждение обмена');
    
    socket.emit('confirm-deal', {
      dealId: currentDeal.id,
      userId: user.id
    });
  };

  // Отмена сделки
  const handleCancelDeal = () => {
    if (!socket || !currentDeal) return;

    if (window.confirm('Вы уверены, что хотите отменить обмен?')) {
      console.log('❌ Отмена сделки');
      
      socket.emit('cancel-deal', {
        dealId: currentDeal.id,
        userId: user.id
      });
    }
  };

  // Компонент мини-карточки подарка в окне участника
  const GiftCardMini = ({ gift, onRemove, canRemove }) => {
    const [lottieContainer, setLottieContainer] = useState(null);

    useEffect(() => {
      if (!lottieContainer || !gift.rawData) return;

      let lottieInstance = null;

      const loadLottie = async () => {
        try {
          const rawData = typeof gift.rawData === 'string' 
            ? JSON.parse(gift.rawData) 
            : gift.rawData;

          const modelAttr = rawData.attributes?.find(a => a._ === 'StarGiftAttributeModel');
          
          if (modelAttr?.document?.id) {
            const lottieUrl = `${API_URL}/api/telegram/file/${modelAttr.document.id}`;
            const response = await fetch(lottieUrl);
            const lottieData = await response.json();

            lottieInstance = lottie.loadAnimation({
              container: lottieContainer,
              renderer: 'svg',
              loop: true,
              autoplay: true,
              animationData: lottieData
            });
          }
        } catch (error) {
          console.error('Ошибка загрузки Lottie:', error);
        }
      };

      loadLottie();

      return () => {
        if (lottieInstance) {
          lottieInstance.destroy();
        }
      };
    }, [lottieContainer, gift]);

    return (
      <div className="gift-card-mini">
        <div className="gift-preview-mini" ref={setLottieContainer}></div>
        <div className="gift-info-mini">
          <div className="gift-title-mini">{gift.giftTitle}</div>
          <div className="gift-model-mini">{gift.model}</div>
        </div>
        {canRemove && (
          <button 
            className="remove-gift-btn"
            onClick={() => onRemove(gift.id)}
          >
            ✕
          </button>
        )}
      </div>
    );
  };

  // Компонент карточки подарка в инвентаре
  const GiftCardInventory = ({ gift, onClick, disabled }) => {
    const [lottieContainer, setLottieContainer] = useState(null);

    useEffect(() => {
      if (!lottieContainer || !gift.raw_data) return;

      let lottieInstance = null;

      const loadLottie = async () => {
        try {
          const rawData = typeof gift.raw_data === 'string' 
            ? JSON.parse(gift.raw_data) 
            : gift.raw_data;

          const modelAttr = rawData.attributes?.find(a => a._ === 'StarGiftAttributeModel');
          
          if (modelAttr?.document?.id) {
            const lottieUrl = `${API_URL}/api/telegram/file/${modelAttr.document.id}`;
            const response = await fetch(lottieUrl);
            const lottieData = await response.json();

            lottieInstance = lottie.loadAnimation({
              container: lottieContainer,
              renderer: 'svg',
              loop: true,
              autoplay: true,
              animationData: lottieData
            });
          }
        } catch (error) {
          console.error('Ошибка загрузки Lottie:', error);
        }
      };

      loadLottie();

      return () => {
        if (lottieInstance) {
          lottieInstance.destroy();
        }
      };
    }, [lottieContainer, gift]);

    return (
      <div 
        className={`gift-card-inventory ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && onClick(gift)}
      >
        <div className="gift-preview-inventory" ref={setLottieContainer}></div>
        <div className="gift-title-inventory">{gift.gift_title}</div>
      </div>
    );
  };

  // Рендер главного экрана
  if (screen === 'main') {
    return (
      <div className="guarantee-container">
        <div className="guarantee-header">
          <h1 className="guarantee-title">🤝 Гарант-сервис</h1>
          <p className="guarantee-subtitle">Безопасный обмен подарками</p>
        </div>

        <div className="guarantee-actions">
          <button className="guarantee-btn primary" onClick={handleCreateDeal}>
            ➕ Создать обмен
          </button>

          <div className="join-deal-section">
            <input
              type="text"
              className="invite-code-input"
              placeholder="Введите код обмена"
              value={inviteCodeInput}
              onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
              maxLength={8}
            />
            <button className="guarantee-btn secondary" onClick={handleJoinDeal}>
              🔗 Присоединиться
            </button>
          </div>
        </div>

        <div className="guarantee-info">
          <h3>Как это работает:</h3>
          <ol>
            <li>Создайте обмен и получите уникальный код</li>
            <li>Отправьте код другому пользователю</li>
            <li>Оба добавляете подарки для обмена</li>
            <li>Подтверждаете обмен</li>
            <li>Подарки автоматически меняются владельцами</li>
          </ol>
        </div>
      </div>
    );
  }

  // Рендер экрана активной сделки
  if (screen === 'deal' && currentDeal) {
    const myGiftsInDeal = dealGifts[user.id] || [];
    const otherUserId = currentDeal.creator_id === user.id 
      ? currentDeal.participant_id 
      : currentDeal.creator_id;
    const otherGiftsInDeal = dealGifts[otherUserId] || [];

    const isCreator = currentDeal.creator_id === user.id;
    const myConfirmed = isCreator ? currentDeal.creator_confirmed : currentDeal.participant_confirmed;
    const otherConfirmed = isCreator ? currentDeal.participant_confirmed : currentDeal.creator_confirmed;

    // Фильтруем подарки - не показываем те, что уже добавлены
    const addedGiftIds = myGiftsInDeal.map(g => g.id);
    const availableGifts = myGifts.filter(g => !addedGiftIds.includes(g.id));

    return (
      <div className="guarantee-container">
        {/* Баннер с кодом приглашения */}
        {currentDeal.status === 'waiting' && isCreator && (
          <div className="invite-code-banner">
            <div className="invite-code-header">
              <span className="invite-icon">🔗</span>
              <span>Код для обмена</span>
            </div>
            <div className="invite-code-display">
              {currentDeal.invite_code}
            </div>
            <button 
              className="copy-code-btn"
              onClick={() => {
                const code = currentDeal.invite_code;
                
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(code)
                    .then(() => {
                      if (window.Telegram?.WebApp) {
                        window.Telegram.WebApp.showPopup({
                          title: '✅ Скопировано!',
                          message: 'Код скопирован в буфер обмена',
                          buttons: [{ type: 'ok' }]
                        });
                      } else {
                        alert('Код скопирован!');
                      }
                    })
                    .catch(err => console.error('Ошибка копирования:', err));
                }
              }}
            >
              📋 Скопировать код
            </button>
            <p className="invite-hint">
              Отправьте этот код другому пользователю для начала обмена
            </p>
          </div>
        )}

        {/* Окна участников */}
        <div className="deal-windows">
          {/* Мое окно */}
          <div className="deal-window my-window">
            <div className="window-header">
              <span className="participant-name">Вы</span>
              {myConfirmed && (
                <span className="confirmed-badge">✓ Подтверждено</span>
              )}
            </div>
            <div className="window-gifts">
              {myGiftsInDeal.length === 0 ? (
                <div className="empty-gifts">Добавьте подарки из инвентаря</div>
              ) : (
                myGiftsInDeal.map(gift => (
                  <GiftCardMini 
                    key={gift.id} 
                    gift={gift} 
                    onRemove={handleRemoveGift}
                    canRemove={!myConfirmed}
                  />
                ))
              )}
            </div>
          </div>

          {/* Окно другого участника */}
          <div className="deal-window other-window">
            <div className="window-header">
              <span className="participant-name">
                {currentDeal.status === 'waiting' ? 'Ожидание...' : 'Участник'}
              </span>
              {otherConfirmed && (
                <span className="confirmed-badge">✓ Подтверждено</span>
              )}
            </div>
            <div className="window-gifts">
              {currentDeal.status === 'waiting' ? (
                <div className="empty-gifts">Ожидание участника...</div>
              ) : otherGiftsInDeal.length === 0 ? (
                <div className="empty-gifts">Участник еще не добавил подарки</div>
              ) : (
                otherGiftsInDeal.map(gift => (
                  <GiftCardMini 
                    key={gift.id} 
                    gift={gift} 
                    canRemove={false}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Инвентарь */}
        {currentDeal.status === 'active' && !myConfirmed && (
          <div className="inventory-section">
            <h3 className="inventory-title">Ваши подарки ({availableGifts.length})</h3>
            <div className="inventory-grid">
              {availableGifts.map(gift => (
                <GiftCardInventory
                  key={gift.id}
                  gift={gift}
                  onClick={handleAddGift}
                  disabled={false}
                />
              ))}
            </div>
          </div>
        )}

        {/* Кнопки управления */}
        <div className="deal-controls">
          <button 
            className="deal-btn cancel"
            onClick={handleCancelDeal}
            disabled={myConfirmed}
          >
            ❌ Отменить обмен
          </button>

          {currentDeal.status === 'active' && (
            <button 
              className="deal-btn confirm"
              onClick={handleConfirmDeal}
              disabled={myConfirmed || myGiftsInDeal.length === 0}
            >
              {myConfirmed ? '✓ Вы подтвердили' : '✅ Подтвердить обмен'}
            </button>
          )}
        </div>

        {/* Модальное окно подтверждения добавления подарка */}
        {showAddModal && selectedGift && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Добавить подарок в обмен?</h3>
              <p className="gift-name">{selectedGift.gift_title}</p>
              <p className="gift-model">{selectedGift.model}</p>
              <div className="modal-buttons">
                <button className="modal-btn cancel" onClick={() => setShowAddModal(false)}>
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

  return null;
}

export default Guarantee;