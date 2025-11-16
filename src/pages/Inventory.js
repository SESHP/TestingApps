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
        {/* <div className="inventory-header">
          <h1>Инвентарь</h1>
        </div> */}
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

// Компонент карточки подарка
// const GiftCard = ({ gift, onClick }) => {
//   const lottieRef = useRef(null);
//   const lottieInstance = useRef(null);

//   useEffect(() => {
//     loadLottie();
//     return () => {
//       if (lottieInstance.current) {
//         lottieInstance.current.destroy();
//       }
//     };
//   }, [gift.id]);

//   const loadLottie = async () => {
//     if (!gift.rawData?.gift || !lottieRef.current) return;

//     const attributes = gift.rawData.gift.attributes || [];
//     const modelAttr = attributes.find(attr => attr.className === 'StarGiftAttributeModel');
    
//     if (!modelAttr?.document) return;

//     const doc = modelAttr.document;
    
//     if (doc.mimeType === 'application/x-tgsticker') {
//       try {
//         const apiUrl = process.env.REACT_APP_API_URL || '';
//         const response = await fetch(`${apiUrl}/api/telegram/file/${doc.id}`);
        
//         if (response.ok) {
//           const animationData = await response.json();
          
//           if (lottieInstance.current) {
//             lottieInstance.current.destroy();
//           }
          
//           lottieInstance.current = lottie.loadAnimation({
//             container: lottieRef.current,
//             renderer: 'svg',
//             loop: true,
//             autoplay: true,
//             animationData: animationData
//           });
//         }
//       } catch (err) {
//         console.error('Ошибка загрузки Lottie:', err);
//       }
//     }
//   };

//   const formatColor = (colorInt) => {
//     if (!colorInt && colorInt !== 0) return '#000000';
//     const hex = (colorInt >>> 0).toString(16).padStart(6, '0');
//     return `#${hex}`;
//   };

//   const renderGiftPreview = () => {
//     if (!gift.rawData?.gift) {
//       return (
//         <div className="gift-preview">
//           <div className="gift-placeholder">🎁</div>
//         </div>
//       );
//     }

//     const giftData = gift.rawData.gift;
//     const attributes = giftData.attributes || [];
    
//     const backdropAttr = attributes.find(attr => attr.className === 'StarGiftAttributeBackdrop');

//     const backgroundStyle = backdropAttr ? {
//       background: `radial-gradient(circle at center, ${formatColor(backdropAttr.centerColor)} 0%, ${formatColor(backdropAttr.edgeColor)} 100%)`
//     } : {
//       background: '#1a1a1a'
//     };

//     return (
//       <div className="gift-preview" style={backgroundStyle}>
//         <div ref={lottieRef} className="gift-lottie-preview" />
//       </div>
//     );
//   };

//   return (
//     <div className="gift-card" onClick={onClick}>
//       {renderGiftPreview()}
//       <div className="gift-info">
//         <h3 className="gift-name">{gift.giftTitle}</h3>
//         {gift.model && gift.model !== 'Неизвестная модель' && (
//           <p className="gift-model">{gift.model}</p>
//         )}
//         <p className="gift-date">
//           {new Date(gift.receivedAt).toLocaleDateString('ru-RU', {
//             day: 'numeric',
//             month: 'short'
//           })}
//         </p>
//       </div>
//     </div>
//   );
// };



// Компонент модального окна
// const GiftModal = ({ gift, onClose }) => {
//   const lottieRef = useRef(null);
//   const lottieInstance = useRef(null);

//   useEffect(() => {
//     loadLottie();
//     return () => {
//       if (lottieInstance.current) {
//         lottieInstance.current.destroy();
//       }
//     };
//   }, [gift.id]);

//   const loadLottie = async () => {
//     if (!gift.rawData?.gift || !lottieRef.current) return;

//     const attributes = gift.rawData.gift.attributes || [];
//     const modelAttr = attributes.find(attr => attr.className === 'StarGiftAttributeModel');
    
//     if (!modelAttr?.document) return;

//     const doc = modelAttr.document;
    
//     if (doc.mimeType === 'application/x-tgsticker') {
//       try {
//         const apiUrl = process.env.REACT_APP_API_URL || '';
//         const response = await fetch(`${apiUrl}/api/telegram/file/${doc.id}`);
        
//         if (response.ok) {
//           const animationData = await response.json();
          
//           if (lottieInstance.current) {
//             lottieInstance.current.destroy();
//           }
          
//           lottieInstance.current = lottie.loadAnimation({
//             container: lottieRef.current,
//             renderer: 'svg',
//             loop: true,
//             autoplay: true,
//             animationData: animationData
//           });
//         }
//       } catch (err) {
//         console.error('Ошибка загрузки Lottie:', err);
//       }
//     }
//   };

//   const formatColor = (colorInt) => {
//     if (!colorInt && colorInt !== 0) return '#000000';
//     const hex = (colorInt >>> 0).toString(16).padStart(6, '0');
//     return `#${hex}`;
//   };

//   const renderMainContent = () => {
//     if (!gift.rawData?.gift) {
//       return (
//         <div className="modal-gift-container">
//           <div className="modal-gift-placeholder">🎁</div>
//         </div>
//       );
//     }

//     const giftData = gift.rawData.gift;
//     const attributes = giftData.attributes || [];
//     const backdropAttr = attributes.find(attr => attr.className === 'StarGiftAttributeBackdrop');

//     const backgroundStyle = backdropAttr ? {
//       background: `radial-gradient(circle at center, ${formatColor(backdropAttr.centerColor)} 0%, ${formatColor(backdropAttr.edgeColor)} 100%)`
//     } : {
//       background: '#1a1a1a'
//     };

//     return (
//       <div className="modal-gift-container" style={backgroundStyle}>
//         <div ref={lottieRef} className="modal-gift-lottie" />
//       </div>
//     );
//   };

//   const attributes = gift.rawData?.gift?.attributes || [];
//   const modelAttr = attributes.find(attr => attr.className === 'StarGiftAttributeModel');
//   const backdropAttr = attributes.find(attr => attr.className === 'StarGiftAttributeBackdrop');
//   const patternAttr = attributes.find(attr => attr.className === 'StarGiftAttributePattern');

//   const isCollectible = modelAttr || backdropAttr || patternAttr;

//   return (
//     <div className="gift-modal-overlay" onClick={onClose}>
//       <div className="gift-modal-content" onClick={(e) => e.stopPropagation()}>
//         <button className="modal-close" onClick={onClose}>✕</button>
        
//         {renderMainContent()}

//         <div className="modal-info">
//           <h2 className="modal-title">{gift.giftTitle}</h2>
          
//           {isCollectible && (
//             <div className="modal-badge collectible">Коллекционный</div>
//           )}

//           {modelAttr && (
//             <div className="modal-attr">
//               <span className="modal-attr-label">Модель:</span>
//               <span className="modal-attr-value">{modelAttr.name}</span>
//               {modelAttr.rarityPermille && (
//                 <span className="modal-attr-rarity">
//                   {(modelAttr.rarityPermille / 10).toFixed(1)}%
//                 </span>
//               )}
//             </div>
//           )}

//           {backdropAttr && (
//             <div className="modal-attr">
//               <span className="modal-attr-label">Фон:</span>
//               <span className="modal-attr-value">{backdropAttr.name}</span>
//               {backdropAttr.rarityPermille && (
//                 <span className="modal-attr-rarity">
//                   {(backdropAttr.rarityPermille / 10).toFixed(1)}%
//                 </span>
//               )}
//             </div>
//           )}

//           {patternAttr && (
//             <div className="modal-attr">
//               <span className="modal-attr-label">Паттерн:</span>
//               <span className="modal-attr-value">{patternAttr.name}</span>
//               {patternAttr.rarityPermille && (
//                 <span className="modal-attr-rarity">
//                   {(patternAttr.rarityPermille / 10).toFixed(1)}%
//                 </span>
//               )}
//             </div>
//           )}

//           <div className="modal-meta">
//             <div className="modal-meta-item">
//               <span className="modal-meta-label">От:</span>
//               <span className="modal-meta-value">{gift.fromId}</span>
//             </div>
//             <div className="modal-meta-item">
//               <span className="modal-meta-label">Получен:</span>
//               <span className="modal-meta-value">
//                 {new Date(gift.receivedAt).toLocaleString('ru-RU')}
//               </span>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// // Компонент карточки подарка
// const GiftCard = ({ gift, onClick }) => {
//   const modelLottieRef = useRef(null);
//   const patternLottieRef = useRef(null);
//   const modelInstance = useRef(null);
//   const patternInstance = useRef(null);

//   useEffect(() => {
//     loadLotties();
//     return () => {
//       if (modelInstance.current) {
//         modelInstance.current.destroy();
//       }
//       if (patternInstance.current) {
//         patternInstance.current.destroy();
//       }
//     };
//   }, [gift.id]);

//   const loadLotties = async () => {
//     if (!gift.rawData?.gift) return;

//     const attributes = gift.rawData.gift.attributes || [];
//     const apiUrl = process.env.REACT_APP_API_URL || '';
    
//     // Загружаем МОДЕЛЬ
//     const modelAttr = attributes.find(attr => attr.className === 'StarGiftAttributeModel');
//     if (modelAttr?.document?.mimeType === 'application/x-tgsticker' && modelLottieRef.current) {
//       try {
//         const response = await fetch(`${apiUrl}/api/telegram/file/${modelAttr.document.id}`);
//         if (response.ok) {
//           const animationData = await response.json();
          
//           if (modelInstance.current) {
//             modelInstance.current.destroy();
//           }
          
//           modelInstance.current = lottie.loadAnimation({
//             container: modelLottieRef.current,
//             renderer: 'svg',
//             loop: true,
//             autoplay: true,
//             animationData: animationData
//           });
//         }
//       } catch (err) {
//         console.error('Ошибка загрузки модели:', err);
//       }
//     }
    
//     // Загружаем ПАТТЕРН (символ)
//     const patternAttr = attributes.find(attr => attr.className === 'StarGiftAttributePattern');
//     if (patternAttr?.document?.mimeType === 'application/x-tgsticker' && patternLottieRef.current) {
//       try {
//         const response = await fetch(`${apiUrl}/api/telegram/file/${patternAttr.document.id}`);
//         if (response.ok) {
//           const animationData = await response.json();
          
//           if (patternInstance.current) {
//             patternInstance.current.destroy();
//           }
          
//           patternInstance.current = lottie.loadAnimation({
//             container: patternLottieRef.current,
//             renderer: 'svg',
//             loop: true,
//             autoplay: true,
//             animationData: animationData
//           });
//         }
//       } catch (err) {
//         console.error('Ошибка загрузки паттерна:', err);
//       }
//     }
//   };

//   const formatColor = (colorInt) => {
//     if (!colorInt && colorInt !== 0) return '#000000';
//     const hex = (colorInt >>> 0).toString(16).padStart(6, '0');
//     return `#${hex}`;
//   };

//   const renderGiftPreview = () => {
//     if (!gift.rawData?.gift) {
//       return (
//         <div className="gift-preview">
//           <div className="gift-placeholder">🎁</div>
//         </div>
//       );
//     }

//     const giftData = gift.rawData.gift;
//     const attributes = giftData.attributes || [];
//     const backdropAttr = attributes.find(attr => attr.className === 'StarGiftAttributeBackdrop');

//     const backgroundStyle = backdropAttr ? {
//       background: `radial-gradient(circle at center, ${formatColor(backdropAttr.centerColor)} 0%, ${formatColor(backdropAttr.edgeColor)} 100%)`
//     } : {
//       background: '#1a1a1a'
//     };

//     return (
//       <div className="gift-preview" style={backgroundStyle}>
//         {/* Паттерн (символ) на фоне */}
//         <div 
//           ref={patternLottieRef} 
//           className="gift-pattern-overlay"
//           style={{
//             position: 'absolute',
//             top: '50%',
//             left: '50%',
//             transform: 'translate(-50%, -50%)',
//             width: '80%',
//             height: '80%',
//             opacity: 0.2,
//             pointerEvents: 'none',
//             zIndex: 1
//           }}
//         />
        
//         {/* Модель поверх */}
//         <div 
//           ref={modelLottieRef} 
//           className="gift-lottie-preview"
//           style={{
//             position: 'relative',
//             zIndex: 2,
//             width: '100%',
//             height: '100%'
//           }}
//         />
//       </div>
//     );
//   };

//   return (
//     <div className="gift-card" onClick={onClick}>
//       {renderGiftPreview()}
//       <div className="gift-info">
//         <h3 className="gift-name">{gift.giftTitle}</h3>
//         {gift.model && gift.model !== 'Неизвестная модель' && (
//           <p className="gift-model">{gift.model}</p>
//         )}
//         <p className="gift-date">
//           {new Date(gift.receivedAt).toLocaleDateString('ru-RU', {
//             day: 'numeric',
//             month: 'short'
//           })}
//         </p>
//       </div>
//     </div>
//   );
// };

// // Компонент модального окна
// const GiftModal = ({ gift, onClose }) => {
//   const modelLottieRef = useRef(null);
//   const patternLottieRef = useRef(null);
//   const modelInstance = useRef(null);
//   const patternInstance = useRef(null);

//   useEffect(() => {
//     loadLotties();
//     return () => {
//       if (modelInstance.current) {
//         modelInstance.current.destroy();
//       }
//       if (patternInstance.current) {
//         patternInstance.current.destroy();
//       }
//     };
//   }, [gift.id]);

//   const loadLotties = async () => {
//     if (!gift.rawData?.gift) return;

//     const attributes = gift.rawData.gift.attributes || [];
//     const apiUrl = process.env.REACT_APP_API_URL || '';
    
//     // Загружаем МОДЕЛЬ
//     const modelAttr = attributes.find(attr => attr.className === 'StarGiftAttributeModel');
//     if (modelAttr?.document?.mimeType === 'application/x-tgsticker' && modelLottieRef.current) {
//       try {
//         const response = await fetch(`${apiUrl}/api/telegram/file/${modelAttr.document.id}`);
//         if (response.ok) {
//           const animationData = await response.json();
          
//           if (modelInstance.current) {
//             modelInstance.current.destroy();
//           }
          
//           modelInstance.current = lottie.loadAnimation({
//             container: modelLottieRef.current,
//             renderer: 'svg',
//             loop: true,
//             autoplay: true,
//             animationData: animationData
//           });
//         }
//       } catch (err) {
//         console.error('Ошибка загрузки модели:', err);
//       }
//     }
    
//     // Загружаем ПАТТЕРН (символ)
//     const patternAttr = attributes.find(attr => attr.className === 'StarGiftAttributePattern');
//     if (patternAttr?.document?.mimeType === 'application/x-tgsticker' && patternLottieRef.current) {
//       try {
//         const response = await fetch(`${apiUrl}/api/telegram/file/${patternAttr.document.id}`);
//         if (response.ok) {
//           const animationData = await response.json();
          
//           if (patternInstance.current) {
//             patternInstance.current.destroy();
//           }
          
//           patternInstance.current = lottie.loadAnimation({
//             container: patternLottieRef.current,
//             renderer: 'svg',
//             loop: true,
//             autoplay: true,
//             animationData: animationData
//           });
//         }
//       } catch (err) {
//         console.error('Ошибка загрузки паттерна:', err);
//       }
//     }
//   };

//   const formatColor = (colorInt) => {
//     if (!colorInt && colorInt !== 0) return '#000000';
//     const hex = (colorInt >>> 0).toString(16).padStart(6, '0');
//     return `#${hex}`;
//   };

//   const renderMainContent = () => {
//     if (!gift.rawData?.gift) {
//       return (
//         <div className="modal-gift-container">
//           <div className="modal-gift-placeholder">🎁</div>
//         </div>
//       );
//     }

//     const giftData = gift.rawData.gift;
//     const attributes = giftData.attributes || [];
//     const backdropAttr = attributes.find(attr => attr.className === 'StarGiftAttributeBackdrop');

//     const backgroundStyle = backdropAttr ? {
//       background: `radial-gradient(circle at center, ${formatColor(backdropAttr.centerColor)} 0%, ${formatColor(backdropAttr.edgeColor)} 100%)`
//     } : {
//       background: '#1a1a1a'
//     };

//     return (
//       <div className="modal-gift-container" style={backgroundStyle}>
//         {/* Паттерн на фоне */}
//         <div 
//           ref={patternLottieRef}
//           style={{
//             position: 'absolute',
//             top: '50%',
//             left: '50%',
//             transform: 'translate(-50%, -50%)',
//             width: '70%',
//             height: '70%',
//             opacity: 0.15,
//             pointerEvents: 'none',
//             zIndex: 1
//           }}
//         />
        
//         {/* Модель поверх */}
//         <div 
//           ref={modelLottieRef} 
//           className="modal-gift-lottie"
//           style={{
//             position: 'relative',
//             zIndex: 2,
//             width: '80%',
//             height: '80%'
//           }}
//         />
//       </div>
//     );
//   };

//   const attributes = gift.rawData?.gift?.attributes || [];
//   const modelAttr = attributes.find(attr => attr.className === 'StarGiftAttributeModel');
//   const backdropAttr = attributes.find(attr => attr.className === 'StarGiftAttributeBackdrop');
//   const patternAttr = attributes.find(attr => attr.className === 'StarGiftAttributePattern');

//   const isCollectible = modelAttr || backdropAttr || patternAttr;

//   return (
//     <div className="gift-modal-overlay" onClick={onClose}>
//       <div className="gift-modal-content" onClick={(e) => e.stopPropagation()}>
//         <button className="modal-close" onClick={onClose}>✕</button>
        
//         {renderMainContent()}

//         <div className="modal-info">
//           <h2 className="modal-title">{gift.giftTitle}</h2>
          
//           {isCollectible && (
//             <div className="modal-badge collectible">Коллекционный</div>
//           )}

//           {modelAttr && (
//             <div className="modal-attr">
//               <span className="modal-attr-label">Модель:</span>
//               <span className="modal-attr-value">{modelAttr.name}</span>
//               {modelAttr.rarityPermille && (
//                 <span className="modal-attr-rarity">
//                   {(modelAttr.rarityPermille / 10).toFixed(1)}%
//                 </span>
//               )}
//             </div>
//           )}

//           {backdropAttr && (
//             <div className="modal-attr">
//               <span className="modal-attr-label">Фон:</span>
//               <span className="modal-attr-value">{backdropAttr.name}</span>
//               {backdropAttr.rarityPermille && (
//                 <span className="modal-attr-rarity">
//                   {(backdropAttr.rarityPermille / 10).toFixed(1)}%
//                 </span>
//               )}
//             </div>
//           )}

//           {patternAttr && (
//             <div className="modal-attr">
//               <span className="modal-attr-label">Паттерн:</span>
//               <span className="modal-attr-value">{patternAttr.name}</span>
//               {patternAttr.rarityPermille && (
//                 <span className="modal-attr-rarity">
//                   {(patternAttr.rarityPermille / 10).toFixed(1)}%
//                 </span>
//               )}
//             </div>
//           )}

//           <div className="modal-meta">
//             <div className="modal-meta-item">
//               <span className="modal-meta-label">От:</span>
//               <span className="modal-meta-value">{gift.fromId}</span>
//             </div>
//             <div className="modal-meta-item">
//               <span className="modal-meta-label">Получен:</span>
//               <span className="modal-meta-value">
//                 {new Date(gift.receivedAt).toLocaleString('ru-RU')}
//               </span>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };


// Компонент для паттерна по кругу
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
  const gridSize = isModal ? 7 : 5; // Количество клеток по вертикали/горизонтали
  const step = 100 / (gridSize + 1); // Шаг между паттернами
  const centerRadius = isModal ? 35 : 30; // Радиус зоны модели (в процентах)
  const maxSize = isModal ? 25 : 20; // Максимальный размер у модели
  const minSize = isModal ? 12 : 10; // Минимальный размер у края
  
  let patternIndex = 0;
  
  for (let row = 0; row <= gridSize; row++) {
    for (let col = 0; col <= gridSize; col++) {
      // Шахматный порядок: пропускаем каждую вторую клетку
      if ((row + col) % 2 !== 0) continue;
      
      const x = step * (col + 1);
      const y = step * (row + 1);
      
      // Расстояние от центра
      const dx = x - 50;
      const dy = y - 50;
      const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
      
      // Пропускаем если слишком близко к центру (где модель)
      if (distanceFromCenter < centerRadius) continue;
      
      // Вычисляем размер: чем дальше от центра, тем меньше
      const maxDistance = Math.sqrt(50 * 50 + 50 * 50); // Максимальное расстояние (до угла)
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

// Компонент карточки подарка (ОБНОВЛЕННЫЙ)
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

    const backgroundStyle = backdropAttr ? {
      background: `radial-gradient(circle at center, ${formatColor(backdropAttr.centerColor)} 0%, ${formatColor(backdropAttr.edgeColor)} 100%)`
    } : {
      background: '#1a1a1a'
    };

    return (
      <div className="gift-preview" style={backgroundStyle}>
        {/* Паттерн по кругу */}
        <PatternGrid patternAttr={patternAttr} size="small" />
        
        {/* Модель поверх */}
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

// Компонент модального окна (ОБНОВЛЕННЫЙ)
const GiftModal = ({ gift, onClose }) => {
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
        {/* Паттерн по кругу */}
        <PatternGrid patternAttr={patternAttr} size="large" />
        
        {/* Модель поверх */}
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

          {/* <div className="modal-meta">
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
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default Inventory;