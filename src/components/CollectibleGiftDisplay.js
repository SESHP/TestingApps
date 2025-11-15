// CollectibleGiftDisplay.jsx
// Улучшенный компонент для отображения коллекционных подарков

import React, { useState, useEffect, useRef } from 'react';
import lottie from 'lottie-web';
import './CollectibleGiftDisplay.css';

const CollectibleGiftDisplay = ({ 
  giftId, 
  size = 300, 
  showInfo = true,
  autoProcess = true 
}) => {
  const [giftData, setGiftData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  
  const mainLottieRef = useRef(null);
  const modelLottieRef = useRef(null);
  const patternLottieRef = useRef(null);
  
  const mainLottieInstance = useRef(null);
  const modelLottieInstance = useRef(null);
  const patternLottieInstance = useRef(null);

  // Загрузка данных о подарке
  useEffect(() => {
    const fetchGiftDetails = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/gifts/${giftId}/details`);
        
        if (!response.ok) {
          throw new Error('Не удалось загрузить данные подарка');
        }

        const data = await response.json();
        
        // Если подарок не обработан и включена автообработка
        if (!data.processed && autoProcess) {
          await processGift();
        } else {
          setGiftData(data);
        }
        
        setError(null);
      } catch (err) {
        console.error('Ошибка загрузки подарка:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (giftId) {
      fetchGiftDetails();
    }
  }, [giftId, autoProcess]);

  // Принудительная обработка подарка
  const processGift = async () => {
    try {
      setProcessing(true);
      const response = await fetch(`/api/gifts/${giftId}/process`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Не удалось обработать подарок');
      }

      const result = await response.json();
      
      // Перезагружаем данные
      const detailsResponse = await fetch(`/api/gifts/${giftId}/details`);
      const data = await detailsResponse.json();
      setGiftData(data);
      
    } catch (err) {
      console.error('Ошибка обработки подарка:', err);
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Инициализация Lottie анимаций
  useEffect(() => {
    if (!giftData?.processed) return;

    const loadLottie = async (url, containerRef, instanceRef) => {
      if (!containerRef.current) return;

      try {
        const response = await fetch(url);
        const animationData = await response.json();

        // Очищаем предыдущую анимацию
        if (instanceRef.current) {
          instanceRef.current.destroy();
        }

        instanceRef.current = lottie.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          animationData: animationData
        });
      } catch (err) {
        console.error('Ошибка загрузки Lottie:', err);
      }
    };

    // Загружаем основную анимацию
    const mainDoc = giftData.processed.mainDocument;
    if (mainDoc?.fileType === 'lottie' && mainDoc.file?.lottieJson?.url) {
      loadLottie(mainDoc.file.lottieJson.url, mainLottieRef, mainLottieInstance);
    }

    // Загружаем модель (для коллекционных)
    const model = giftData.processed.attributes?.model;
    if (model?.file?.lottieJson?.url) {
      loadLottie(model.file.lottieJson.url, modelLottieRef, modelLottieInstance);
    }

    // Загружаем паттерн (для коллекционных)
    const pattern = giftData.processed.attributes?.pattern;
    if (pattern?.file?.lottieJson?.url) {
      loadLottie(pattern.file.lottieJson.url, patternLottieRef, patternLottieInstance);
    }

    // Очистка при размонтировании
    return () => {
      if (mainLottieInstance.current) mainLottieInstance.current.destroy();
      if (modelLottieInstance.current) modelLottieInstance.current.destroy();
      if (patternLottieInstance.current) patternLottieInstance.current.destroy();
    };
  }, [giftData]);

  // Рендер основного контента подарка
  const renderMainContent = () => {
    if (!giftData?.processed?.mainDocument) return null;

    const mainDoc = giftData.processed.mainDocument;

    switch (mainDoc.fileType) {
      case 'static':
        return (
          <img
            src={mainDoc.file.url}
            alt={giftData.giftTitle}
            className="gift-static-image"
          />
        );

      case 'lottie':
        return (
          <div ref={mainLottieRef} className="gift-lottie-container" />
        );

      case 'video':
        return (
          <video
            src={mainDoc.file.url}
            autoPlay
            loop
            muted
            playsInline
            className="gift-video"
          />
        );

      default:
        return <div className="gift-unknown">Неизвестный формат</div>;
    }
  };

  // Рендер модели коллекционного подарка
  const renderModel = () => {
    const model = giftData?.processed?.attributes?.model;
    if (!model) return null;

    if (model.file?.lottieJson?.url) {
      return (
        <div ref={modelLottieRef} className="gift-model-container" />
      );
    }

    if (model.file?.url) {
      return (
        <img
          src={model.file.url}
          alt={model.name}
          className="gift-model-image"
        />
      );
    }

    return null;
  };

  // Рендер фона
  const renderBackdrop = () => {
    const backdrop = giftData?.processed?.attributes?.backdrop;
    if (!backdrop) return null;

    return (
      <div
        className="gift-backdrop"
        style={{
          background: `radial-gradient(circle at center, ${backdrop.centerColor} 0%, ${backdrop.edgeColor} 100%)`
        }}
      />
    );
  };

  // Рендер паттерна
  const renderPattern = () => {
    const pattern = giftData?.processed?.attributes?.pattern;
    if (!pattern) return null;

    if (pattern.file?.lottieJson?.url) {
      return (
        <div 
          ref={patternLottieRef} 
          className="gift-pattern-container"
          style={{ opacity: 0.15 }}
        />
      );
    }

    if (pattern.file?.url) {
      return (
        <div
          className="gift-pattern-image"
          style={{
            backgroundImage: `url(${pattern.file.url})`,
            opacity: 0.15
          }}
        />
      );
    }

    return null;
  };

  // Рендер информации о подарке
  const renderGiftInfo = () => {
    if (!showInfo || !giftData) return null;

    const attrs = giftData.processed?.attributes;
    const isCollectible = attrs?.model || attrs?.backdrop || attrs?.pattern;

    return (
      <div className="gift-info">
        <h3 className="gift-title">{giftData.giftTitle}</h3>
        
        {isCollectible && (
          <div className="gift-attributes">
            <div className="gift-badge collectible">Коллекционный</div>
            
            {attrs.model && (
              <div className="gift-attr">
                <span className="attr-label">Модель:</span>
                <span className="attr-value">{attrs.model.name}</span>
                {attrs.model.rarityPermille && (
                  <span className="attr-rarity">
                    {(attrs.model.rarityPermille / 10).toFixed(1)}%
                  </span>
                )}
              </div>
            )}
            
            {attrs.backdrop && (
              <div className="gift-attr">
                <span className="attr-label">Фон:</span>
                <span className="attr-value">{attrs.backdrop.name}</span>
                {attrs.backdrop.rarityPermille && (
                  <span className="attr-rarity">
                    {(attrs.backdrop.rarityPermille / 10).toFixed(1)}%
                  </span>
                )}
              </div>
            )}
            
            {attrs.pattern && (
              <div className="gift-attr">
                <span className="attr-label">Паттерн:</span>
                <span className="attr-value">{attrs.pattern.name}</span>
                {attrs.pattern.rarityPermille && (
                  <span className="attr-rarity">
                    {(attrs.pattern.rarityPermille / 10).toFixed(1)}%
                  </span>
                )}
              </div>
            )}
          </div>
        )}
        
        <div className="gift-meta">
          <div className="meta-item">
            <span className="meta-label">От:</span>
            <span className="meta-value">{giftData.fromId}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Получен:</span>
            <span className="meta-value">
              {new Date(giftData.receivedAt).toLocaleString('ru-RU')}
            </span>
          </div>
          {giftData.isWithdrawn && (
            <div className="meta-item withdrawn">
              <span className="meta-label">Выведен</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="gift-container" style={{ width: size, height: size }}>
        <div className="gift-loading">
          <div className="spinner"></div>
          <p>Загрузка подарка...</p>
        </div>
      </div>
    );
  }

  if (processing) {
    return (
      <div className="gift-container" style={{ width: size, height: size }}>
        <div className="gift-processing">
          <div className="spinner"></div>
          <p>Обработка файлов...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gift-container" style={{ width: size, height: size }}>
        <div className="gift-error">
          <p>❌ {error}</p>
          {!giftData?.processed && (
            <button onClick={processGift} className="btn-process">
              Обработать подарок
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="gift-display-wrapper">
      <div 
        className="gift-container" 
        style={{ width: size, height: size }}
      >
        {renderBackdrop()}
        {renderPattern()}
        <div className="gift-content">
          {renderModel()}
          {renderMainContent()}
        </div>
      </div>
      
      {renderGiftInfo()}
    </div>
  );
};

export default CollectibleGiftDisplay;