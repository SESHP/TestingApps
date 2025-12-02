// src/pages/Guarantee.js
import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import lottie from 'lottie-web';
import './Guarantee.css';
import moneyAnimation from '../assets/icons/Money.json';
import { getInitData } from '../utils/telegramUtils';
import { createDeal, joinDeal } from '../utils/api';

const API_URL = process.env.REACT_APP_API_URL || 'https://testingapps-ncf8.onrender.com';

// ✅ КЛЮЧ ДЛЯ СОХРАНЕНИЯ СОСТОЯНИЯ
const DEAL_STATE_KEY = 'guarantee_active_deal';

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
  const [participantUser, setParticipantUser] = useState(null);
  const [verificationStage, setVerificationStage] = useState(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const isRestoringRef = useRef(false);

  // ✅ СОХРАНЕНИЕ СОСТОЯНИЯ СДЕЛКИ В LOCALSTORAGE
  useEffect(() => {
    if (currentDeal) {
      console.log('💾 Сохранение состояния сделки:', currentDeal.id);
      localStorage.setItem(DEAL_STATE_KEY, JSON.stringify({
        dealId: currentDeal.id,
        timestamp: Date.now()
      }));
    } else {
      // Удаляем только если явно очищаем сделку (не при размонтировании)
      const savedDeal = localStorage.getItem(DEAL_STATE_KEY);
      if (savedDeal && screen === 'main') {
        console.log('🗑️ Очистка сохраненной сделки');
        localStorage.removeItem(DEAL_STATE_KEY);
      }
    }
  }, [currentDeal, screen]);

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
          username: telegramUser.username,
          photoUrl: telegramUser.photo_url
        });
      }

      const initData = getInitData();
      console.log('🔍 Guarantee.js Debug Info:', {
        hasWebApp: !!window.Telegram?.WebApp,
        hasTgObject: !!window.Telegram,
        platform: tg.platform,
        version: tg.version,
        initDataLength: initData?.length || 0,
        initDataPreview: initData ? initData.substring(0, 50) + '...' : 'empty',
        hasUser: !!telegramUser
      });
    } else {
      setUser({
        id: 123456789,
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser'
      });
      console.warn('⚠️ Telegram WebApp not found - using test user');
    }
  }, []);

  // ✅ ФУНКЦИЯ ВОССТАНОВЛЕНИЯ СОСТОЯНИЯ СДЕЛКИ
  const restoreDealState = async (dealId) => {
    if (isRestoringRef.current) {
      console.log('⏸️ Восстановление уже выполняется, пропускаем...');
      return false;
    }

    try {
      isRestoringRef.current = true;
      console.log('🔄 Восстановление состояния сделки:', dealId);
      
      // Загружаем информацию о сделке
      const dealResponse = await fetch(`${API_URL}/api/deals/${dealId}`);
      const dealData = await dealResponse.json();
      
      if (dealData.deal) {
        // Проверяем, что сделка еще активна
        if (dealData.deal.status === 'completed' || dealData.deal.status === 'cancelled') {
          console.log('⚠️ Сделка завершена или отменена, очищаем состояние');
          localStorage.removeItem(DEAL_STATE_KEY);
          setScreen('main');
          setCurrentDeal(null);
          setDealGifts({});
          setParticipantUser(null);
          setVerificationStage(false);
          isRestoringRef.current = false;
          return false;
        }

        console.log('✅ Состояние сделки восстановлено:', dealData.deal);
        setCurrentDeal(dealData.deal);
        setScreen('deal');
        
        // Определяем стадию верификации
        if (dealData.deal.status === 'verification') {
          setVerificationStage(true);
        } else {
          setVerificationStage(false);
        }
        
        // Загружаем подарки сделки
        const giftsResponse = await fetch(`${API_URL}/api/deals/${dealId}/gifts`);
        const giftsData = await giftsResponse.json();
        if (giftsData.gifts) {
          setDealGifts(giftsData.gifts);
        }
        
        // Загружаем информацию о втором участнике
        if (dealData.deal.status !== 'waiting') {
          const isCreator = dealData.deal.creator_id === user.id;
          const otherUserId = isCreator 
            ? dealData.deal.participant_id 
            : dealData.deal.creator_id;
          
          if (otherUserId) {
            const userResponse = await fetch(`${API_URL}/api/users/${otherUserId}`);
            const userData = await userResponse.json();
            if (userData.user) {
              setParticipantUser(userData.user);
            }
          }
        }
        
        isRestoringRef.current = false;
        return true;
      }
      
      isRestoringRef.current = false;
      return false;
    } catch (error) {
      console.error('❌ Ошибка восстановления состояния сделки:', error);
      isRestoringRef.current = false;
      return false;
    }
  };

  // ✅ ВОССТАНОВЛЕНИЕ СОСТОЯНИЯ ПРИ ЗАГРУЗКЕ КОМПОНЕНТА
  useEffect(() => {
    if (!user) return;

    const savedDealState = localStorage.getItem(DEAL_STATE_KEY);
    if (savedDealState) {
      try {
        const { dealId, timestamp } = JSON.parse(savedDealState);
        
        // Проверяем, что состояние не старее 24 часов
        const hoursSinceUpdate = (Date.now() - timestamp) / (1000 * 60 * 60);
        
        if (hoursSinceUpdate < 24) {
          console.log('🔄 Найдена сохраненная сделка, восстанавливаем:', dealId);
          restoreDealState(dealId);
        } else {
          console.log('⏰ Сохраненная сделка устарела, удаляем');
          localStorage.removeItem(DEAL_STATE_KEY);
        }
      } catch (error) {
        console.error('❌ Ошибка парсинга сохраненного состояния:', error);
        localStorage.removeItem(DEAL_STATE_KEY);
      }
    }
  }, [user]);

  // Загрузка информации о втором участнике
  useEffect(() => {
    const loadParticipantInfo = async () => {
      if (!currentDeal || !user) return;
      if (currentDeal.status === 'waiting') return;
      if (participantUser) return; // Уже загружен

      const isCreator = currentDeal.creator_id === user.id;
      const otherUserId = isCreator 
        ? currentDeal.participant_id 
        : currentDeal.creator_id;

      if (!otherUserId) return;

      try {
        const response = await fetch(`${API_URL}/api/users/${otherUserId}`);
        const data = await response.json();
        
        if (data.user) {
          setParticipantUser(data.user);
        }
      } catch (error) {
        console.error('❌ Ошибка запроса:', error);
      }
    };

    loadParticipantInfo();
  }, [currentDeal, user, participantUser]);

  // Загрузка сделки из URL при открытии
  useEffect(() => {
    const loadDealFromUrl = async () => {
      if (!user || !socket) return;
      if (currentDeal) return; // Уже есть активная сделка

      const tg = window.Telegram?.WebApp;
      const startParam = tg?.initDataUnsafe?.start_param;

      if (startParam && startParam.startsWith('deal_')) {
        const dealId = parseInt(startParam.replace('deal_', ''));
        
        try {
          console.log('🔍 Загрузка сделки из URL:', dealId);
          const restored = await restoreDealState(dealId);
          
          if (restored) {
            socket.emit('join-deal', { dealId: dealId });
          }
        } catch (error) {
          console.error('❌ Ошибка загрузки сделки:', error);
        }
      }
    };

    loadDealFromUrl();
  }, [user, socket]);

  // ✅ ОБРАБОТКА ВОССТАНОВЛЕНИЯ ПРИ ВОЗВРАЩЕНИИ НА ВКЛАДКУ
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ Вкладка стала активной');
        
        // Проверяем сохраненное состояние
        const savedDealState = localStorage.getItem(DEAL_STATE_KEY);
        if (savedDealState) {
          try {
            const { dealId } = JSON.parse(savedDealState);
            console.log('🔄 Восстанавливаем сделку:', dealId);
            
            // Проверяем соединение
            if (socket && !socket.connected) {
              console.log('🔄 Переподключение WebSocket...');
              socket.connect();
              
              // Ждем подключения
              await new Promise((resolve) => {
                const checkConnection = setInterval(() => {
                  if (socket.connected) {
                    clearInterval(checkConnection);
                    resolve();
                  }
                }, 100);
                
                // Timeout через 5 секунд
                setTimeout(() => {
                  clearInterval(checkConnection);
                  resolve();
                }, 5000);
              });
            }
            
            // Восстанавливаем состояние
            const restored = await restoreDealState(dealId);
            
            if (restored && socket && socket.connected) {
              // Переприсоединяемся к комнате сделки
              socket.emit('join-deal', { dealId: dealId });
            }
          } catch (error) {
            console.error('❌ Ошибка восстановления при возвращении на вкладку:', error);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [socket]);

  // Инициализация WebSocket
  useEffect(() => {
    console.log('🔌 Подключение к WebSocket:', API_URL);

    const initData = getInitData();

    const newSocket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      auth: {
        initData: initData || 'dev'
      }
    });

    newSocket.on('connect', async () => {
      console.log('✅ WebSocket подключен:', newSocket.id);
      reconnectAttempts.current = 0;
      
      // ✅ ВОССТАНАВЛИВАЕМ СОСТОЯНИЕ ПРИ RECONNECT
      const savedDealState = localStorage.getItem(DEAL_STATE_KEY);
      if (savedDealState) {
        try {
          const { dealId } = JSON.parse(savedDealState);
          console.log('🔄 Восстановление после переподключения:', dealId);
          
          const restored = await restoreDealState(dealId);
          if (restored) {
            newSocket.emit('join-deal', { dealId: dealId });
          }
        } catch (error) {
          console.error('❌ Ошибка восстановления при connect:', error);
        }
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ WebSocket отключен:', reason);
      
      if (reason === 'io server disconnect') {
        // Сервер отключил - пробуем переподключиться
        newSocket.connect();
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Ошибка подключения WebSocket:', error);
      reconnectAttempts.current++;
      
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.error('❌ Превышено максимальное количество попыток переподключения');
        showNotification('Ошибка подключения. Перезагрузите страницу.', 'error');
      }
    });

    newSocket.on('reconnect', async (attemptNumber) => {
      console.log('✅ WebSocket переподключен после попытки:', attemptNumber);
      reconnectAttempts.current = 0;
      
      // ✅ ВОССТАНАВЛИВАЕМ СОСТОЯНИЕ ПОСЛЕ УСПЕШНОГО RECONNECT
      const savedDealState = localStorage.getItem(DEAL_STATE_KEY);
      if (savedDealState) {
        try {
          const { dealId } = JSON.parse(savedDealState);
          console.log('🔄 Восстановление состояния после reconnect:', dealId);
          
          const restored = await restoreDealState(dealId);
          if (restored) {
            newSocket.emit('join-deal', { dealId: dealId });
          }
        } catch (error) {
          console.error('❌ Ошибка восстановления при reconnect:', error);
        }
      }
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 Попытка переподключения:', attemptNumber);
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('❌ Ошибка переподключения:', error);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ Не удалось переподключиться');
      showNotification('Не удалось восстановить соединение', 'error');
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

      setCurrentDeal(prev => ({
        ...prev,
        participant_id: data.participantId,
        status: 'active'
      }));

      const loadNewParticipant = async () => {
        try {
          console.log('📥 Загрузка информации о новом участнике:', data.participantId);
          const response = await fetch(`${API_URL}/api/users/${data.participantId}`);
          const userData = await response.json();
          
          if (userData.user) {
            console.log('✅ Получены данные нового участника:', userData.user);
            setParticipantUser(userData.user);
          }
        } catch (error) {
          console.error('❌ Ошибка загрузки участника:', error);
        }
      };

      loadNewParticipant();
      showNotification('🎉 Участник присоединился! Теперь можете добавлять подарки', 'success');
    });

    socket.on('gifts-updated', (data) => {
      console.log('🎁 Подарки обновлены:', data);
      setDealGifts(data.gifts || {});
    });

    socket.on('lock-updated', (data) => {
      console.log('🔒 Блокировка обновлена:', data);
      setCurrentDeal(prev => ({
        ...prev,
        creator_locked: data.creatorLocked,
        participant_locked: data.participantLocked
      }));
    });

    socket.on('verification-stage', () => {
      console.log('🔍 Переход к проверке');
      setVerificationStage(true);
      showNotification('Проверьте компоненты обмена', 'info');
    });

    socket.on('verification-cancelled', () => {
      console.log('↩️ Проверка отменена');
      setVerificationStage(false);
      setCurrentDeal(prev => ({
        ...prev,
        creator_locked: false,
        participant_locked: false,
        creator_confirmed: false,
        participant_confirmed: false
      }));
      showNotification('Обмен возвращен к редактированию', 'info');
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
      showNotification('🎉 ' + (data.message || 'Обмен успешно завершен!'), 'success');
      
      // Очищаем сохраненное состояние
      localStorage.removeItem(DEAL_STATE_KEY);
      
      setScreen('main');
      setCurrentDeal(null);
      setDealGifts({});
      setParticipantUser(null);
      setVerificationStage(false);
    });

    socket.on('deal-cancelled', (data) => {
      console.log('❌ Сделка отменена:', data);
      showNotification('❌ Обмен был отменен', 'error');
      
      // Очищаем сохраненное состояние
      localStorage.removeItem(DEAL_STATE_KEY);
      
      setScreen('main');
      setCurrentDeal(null);
      setDealGifts({});
      setParticipantUser(null);
      setVerificationStage(false);
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
      socket.off('lock-updated');
      socket.off('verification-stage');
      socket.off('verification-cancelled');
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

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);

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
      console.log('🔄 Creating deal for user:', user.id);
      const data = await createDeal(user.id);

      if (data.success) {
        console.log('✅ Сделка создана:', data.deal);
        setCurrentDeal(data.deal);
        setScreen('deal');

        const inviteCode = data.deal.invite_code;

        try {
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

        socket.emit('join-deal', { dealId: data.deal.id });
      }
    } catch (error) {
      console.error('❌ Ошибка создания сделки:', error);
      showNotification('Не удалось создать сделку', 'error');
    }
  };

  const handleJoinDeal = async () => {
    if (!user || !inviteCodeInput.trim()) return;

    try {
      console.log('🔄 Joining deal with code:', inviteCodeInput);
      const data = await joinDeal(inviteCodeInput.toUpperCase(), user.id);

      if (data.success) {
        console.log('✅ Присоединились к сделке:', data.deal);
        setCurrentDeal(data.deal);
        setScreen('deal');
        setInviteCodeInput('');

        socket.emit('join-deal', { dealId: data.deal.id });
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
      giftId: giftId
    });
  };

  const handleLockGifts = () => {
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

    socket.emit('lock-gifts', { dealId: currentDeal.id });
    showNotification('Подарки заблокированы', 'success');
  };

  const handleVerifyDeal = (approved) => {
    if (!socket) return;
    socket.emit('verify-deal', { dealId: currentDeal.id, approved });
  };

  const handleCancelDeal = () => {
    if (!currentDeal || !socket) return;

    socket.emit('cancel-deal', {
      dealId: currentDeal.id
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

  // Остальные компоненты остаются без изменений...
  // (HourglassLottie, GiftPreview, GiftCardInventory, GiftCardMini, ParticipantHeader)
  
  // Компонент с Lottie анимацией песочных часов
  const HourglassLottie = () => {
    const containerRef = useRef(null);
    const animInstance = useRef(null);

    useEffect(() => {
      if (!containerRef.current) return;

      animInstance.current = lottie.loadAnimation({
        container: containerRef.current,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: moneyAnimation
      });

      return () => {
        if (animInstance.current) {
          animInstance.current.destroy();
        }
      };
    }, []);

    return (
      <div
        ref={containerRef}
        style={{
          width: '140px',
          height: '140px',
          margin: '0 auto',
          filter: 'drop-shadow(0 4px 20px rgba(242, 125, 0, 0.5))'
        }}
      />
    );
  };

  // Компонент для рендера подарков с Lottie - с контролем анимации
  const GiftPreview = ({ gift, size = 'medium' }) => {
    const modelLottieRef = useRef(null);
    const modelInstance = useRef(null);
    const [isHovered, setIsHovered] = useState(false);
    const [hasPlayedOnce, setHasPlayedOnce] = useState(false);

    useEffect(() => {
      loadModel();
      return () => {
        if (modelInstance.current) {
          modelInstance.current.destroy();
        }
      };
    }, [gift.id]);

    // Контроль анимации при наведении
    useEffect(() => {
      if (!modelInstance.current) return;

      if (isHovered) {
        modelInstance.current.play();
      } else if (hasPlayedOnce) {
        modelInstance.current.pause();
      }
    }, [isHovered, hasPlayedOnce]);

    const loadModel = async () => {
      const giftData = gift.rawData?.gift || gift.raw_data?.gift;
      
      if (!giftData || !modelLottieRef.current) {
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
              loop: false,
              autoplay: true,
              animationData: animationData
            });

            modelInstance.current.addEventListener('complete', () => {
              setHasPlayedOnce(true);
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
        <div className={`gift-preview-placeholder gift-preview-${size}`}>
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
      <div 
        className={`gift-preview-lottie gift-preview-${size}`} 
        style={backgroundStyle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
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

  // Компонент для отображения информации об участнике
  const ParticipantHeader = ({ isMe, userData, confirmed }) => {
    const getInitials = (firstName, lastName) => {
      const first = firstName?.charAt(0) || '';
      const last = lastName?.charAt(0) || '';
      return (first + last).toUpperCase() || '?';
    };

    const displayName = userData?.firstName || 'Участник';
    const username = userData?.username ? `@${userData.username}` : '';
    const photoUrl = userData?.photoUrl;

    return (
      <div className="window-header">
        <div className="participant-info">
          <div className="participant-avatar">
            {photoUrl ? (
              <>
                <img 
                  src={photoUrl} 
                  alt={displayName}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <span style={{ position: 'absolute', zIndex: -1 }}>
                  {getInitials(userData?.firstName, userData?.lastName)}
                </span>
              </>
            ) : (
              <span>{getInitials(userData?.firstName, userData?.lastName)}</span>
            )}
          </div>
          <div className="participant-text">
            <div className="participant-name">{displayName}</div>
            {username && <div className="participant-username">{username}</div>}
          </div>
        </div>
        {confirmed && <span className="confirmed-badge">✓ Подтверждено</span>}
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
    const myUserId = String(user.id);
    const creatorId = String(currentDeal.creator_id);
    const participantId = String(currentDeal.participant_id);
    const isCreator = creatorId === myUserId;
    const otherUserId = isCreator ? participantId : creatorId;
    const otherUserIdStr = String(otherUserId);
    
    const myGiftsInDeal = dealGifts[myUserId] || [];
    const otherGiftsInDeal = dealGifts[otherUserIdStr] || [];
    
    const myLocked = isCreator ? currentDeal.creator_locked : currentDeal.participant_locked;
    const otherLocked = isCreator ? currentDeal.participant_locked : currentDeal.creator_locked;
    const myConfirmed = isCreator ? currentDeal.creator_confirmed : currentDeal.participant_confirmed;
    const otherConfirmed = isCreator ? currentDeal.participant_confirmed : currentDeal.creator_confirmed;

    return (
      <div className="guarantee-container">
        {currentDeal.status === 'waiting' && (
          <div className="waiting-participant-screen">
            <div className="waiting-animation">
              <HourglassLottie />
            </div>
            <h2 className="waiting-title">Ожидание участника<span className="animated-dots"></span></h2>

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

        {(currentDeal.status === 'active' || currentDeal.status === 'verification') && (
          <>
            <div className="deal-windows">
              <div className={`participant-window my-window ${verificationStage ? 'verification-mode' : ''}`}>
                <ParticipantHeader 
                  isMe={true}
                  userData={user}
                  confirmed={myConfirmed}
                />
                <div className="window-gifts">
                  {myGiftsInDeal.length === 0 ? (
                    <div className="empty-gifts">Добавьте подарки из инвентаря</div>
                  ) : (
                    myGiftsInDeal.map(gift => (
                      <GiftCardMini 
                        key={gift.id} 
                        gift={gift} 
                        canRemove={!myLocked && !verificationStage}
                        onRemove={handleRemoveGift}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className={`participant-window other-window ${verificationStage ? 'verification-mode' : ''}`}>
                <ParticipantHeader 
                  isMe={false}
                  userData={participantUser}
                  confirmed={otherConfirmed}
                />
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

            {!myLocked && !verificationStage && (
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

            {verificationStage ? (
              <div className="verification-section">
                <h3 className="verification-title">Проверьте компоненты обмена</h3>
                <div className="verification-actions">
                  <button 
                    className="guarantee-btn verify-error"
                    onClick={() => handleVerifyDeal(false)}
                  >
                    ❌ Есть ошибка
                  </button>
                  <button 
                    className="guarantee-btn verify-success"
                    onClick={() => handleVerifyDeal(true)}
                    disabled={myConfirmed}
                  >
                    {myConfirmed ? '⏳ Ожидание...' : '✓ Все верно'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="deal-actions">
                <button className="guarantee-btn cancel-btn" onClick={handleCancelDeal}>
                  Отменить обмен
                </button>
                
                {!myLocked ? (
                  <button 
                    className="guarantee-btn confirm-btn"
                    onClick={handleLockGifts}
                    disabled={myGiftsInDeal.length === 0 || otherGiftsInDeal.length === 0}
                  >
                    🔒 Заблокировать подарки
                  </button>
                ) : (
                  <div className="waiting-message">
                    {otherLocked ? '⏳ Переход к проверке...' : '⏳ Ожидание блокировки...'}
                  </div>
                )}
              </div>
            )}
          </>
        )}

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