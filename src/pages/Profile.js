// src/pages/Profile.js

import React, { useState, useEffect, useRef } from 'react';
import { getTelegramUser, getFullName, getInitData, hapticFeedback, notificationHaptic } from '../utils/telegramUtils';
import { initUser, getReferralStats } from '../utils/api';
import './Profile.css';
import tonIcon from '../assets/icons/ton-icon.svg';

function Profile() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [referralStats, setReferralStats] = useState({
    totalReferrals: 0,
    totalEarned: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [isDisabled, setIsDisabled] = useState(false);
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animationIdRef = useRef(null);
  const cooldownTimerRef = useRef(null);

  // Загрузка пользователя и инициализация
  useEffect(() => {
    const loadUser = async () => {
      try {
        const telegramUser = getTelegramUser();
        setUser(telegramUser);

        // Получаем referral code из URL если есть
        const urlParams = new URLSearchParams(window.location.search);
        const referralCode = urlParams.get('ref');

        // Инициализируем пользователя на бэкенде
        const initData = getInitData();
        const response = await initUser(initData, referralCode);

        setUserData(response.user);
        setReferralStats(response.referralStats);
      } catch (error) {
        console.error('Ошибка загрузки пользователя:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  // Копирование реферальной ссылки
  const handleCopyReferralLink = () => {
    if (!userData?.referralCode || isDisabled) return;

    const botUsername = process.env.REACT_APP_BOT_USERNAME || 'your_bot';
    const referralLink = `https://t.me/algeds_bot/app?startapp=${userData.referralCode}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(referralLink)
        .then(() => {
          // Блокируем кнопку сразу
          setIsDisabled(true);
          notificationHaptic('success');
          
          // Показываем галочку на 1.5 секунды
          setIsCopied(true);
          
          setTimeout(() => {
            // Убираем галочку и начинаем отсчет
            setIsCopied(false);
            setCooldown(5);
            
            // Запускаем таймер обратного отсчета
            cooldownTimerRef.current = setInterval(() => {
              setCooldown((prev) => {
                if (prev <= 1) {
                  clearInterval(cooldownTimerRef.current);
                  setIsDisabled(false);
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);
          }, 1500);
        })
        .catch(err => {
          console.error('Ошибка копирования:', err);
          setIsDisabled(false);
        });
    }
  };

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
    };
  }, []);

  // Анимация canvas
  useEffect(() => {
    if (isLoading) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    
    const setCanvasSize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    setCanvasSize();

    const particles = [];
    const numParticles = 30;

    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 5 + 1,
        speedX: (Math.random() - 0.5) * 1,
        speedY: (Math.random() - 0.5) * 1,
        angle: Math.random() * Math.PI * 2,
        angularVelocity: (Math.random() - 0.5) * 0.04,
        mass: 2,
        color: '#F27D00',
        alpha: 1,
      });
    }

    particlesRef.current = particles;

    function drawParticle(p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      ctx.shadowColor = p.color;
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.lineTo(-p.size, p.size);
      ctx.lineTo(p.size, p.size);
      ctx.closePath();

      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();

      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = p.alpha * 0.5;
      ctx.stroke();

      ctx.restore();
    }

    function checkCollisions() {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];

          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = (p1.size + p2.size) * 1.5;

          if (distance < minDistance && distance > 0) {
            const angle = Math.atan2(dy, dx);
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);

            const vx1 = p1.speedX * cos + p1.speedY * sin;
            const vy1 = p1.speedY * cos - p1.speedX * sin;
            const vx2 = p2.speedX * cos + p2.speedY * sin;
            const vy2 = p2.speedY * cos - p2.speedX * sin;

            p1.speedX = vx2 * cos - vy1 * sin;
            p1.speedY = vy1 * cos + vx2 * sin;
            p2.speedX = vx1 * cos - vy2 * sin;
            p2.speedY = vy2 * cos + vx1 * sin;

            const overlap = minDistance - distance;
            p1.x -= overlap * cos * 0.5;
            p1.y -= overlap * sin * 0.5;
            p2.x += overlap * cos * 0.5;
            p2.y += overlap * sin * 0.5;
          }
        }
      }
    }

    function update() {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.x += p.speedX;
        p.y += p.speedY;
        p.speedY += 0.0005;
        p.angle += p.angularVelocity;

        if (p.x - p.size < 0 || p.x + p.size > width) {
          p.speedX *= -0.9;
          p.x = Math.max(p.size, Math.min(width - p.size, p.x));
        }

        if (p.y - p.size < 0 || p.y + p.size > height) {
          p.speedY *= -0.9;
          p.y = Math.max(p.size, Math.min(height - p.size, p.y));
        }

        p.speedX *= 0.995;
        p.speedY *= 0.995;
      }

      checkCollisions();
    }

    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        drawParticle(particles[i]);
      }
    }

    function animate() {
      update();
      draw();
      animationIdRef.current = requestAnimationFrame(animate);
    }

    animate();

    const handleMouseMove = (e) => {
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      for (let i = 0; i < particlesRef.current.length; i++) {
        const p = particlesRef.current[i];
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 150 && dist > 0) {
          const force = (150 - dist) / 150;
          p.speedX += (dx / dist) * force * 0.2;
          p.speedY += (dy / dist) * force * 0.2;
        }
      }
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const touchX = touch.clientX;
        const touchY = touch.clientY;

        for (let i = 0; i < particlesRef.current.length; i++) {
          const p = particlesRef.current[i];
          const dx = p.x - touchX;
          const dy = p.y - touchY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 150 && dist > 0) {
            const force = (150 - dist) / 150;
            p.speedX += (dx / dist) * force * 0.2;
            p.speedY += (dy / dist) * force * 0.2;
          }
        }
      }
    };

    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        setCanvasSize();
        
        for (let i = 0; i < particlesRef.current.length; i++) {
          const p = particlesRef.current[i];
          p.x = Math.max(p.size, Math.min(width - p.size, p.x));
          p.y = Math.max(p.size, Math.min(height - p.size, p.y));
        }
      }, 100);
    };

    window.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationIdRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="profile-container">
        <div className="profile-content">
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <canvas ref={canvasRef} className="space-canvas" />
      <div className="profile-content">
        {/* Верхний бар */}
        <div className="profile-header">
          <div className="profile-header-left">
            {user && user.photoUrl ? (
              <img 
                src={user.photoUrl} 
                alt="Аватар" 
                className="profile-avatar"
              />
            ) : (
              <div className="profile-avatar-placeholder">
                👤
              </div>
            )}
            <div className="profile-header-text">
              <h2 className="profile-username">
                {user ? getFullName(user) : 'Гость'}
              </h2>
              {user && user.id && (
                <p className="profile-id">ID: {user.id}</p>
              )}
            </div>
          </div>

          <div className="profile-header-right">
            <div className="balance-container">
              <img 
                src={tonIcon} 
                alt="TON" 
                className="balance-icon-img"
              />
              <div className="balance-value">
                {userData?.balance?.toFixed(2) || '0.00'}
              </div>
            </div>
          </div>
        </div>

        {/* Статистика */}
        <div className="profile-stats">
          <div className="stat-item">
            <span className="stat-label">Сделок</span>
            <span className="stat-value">{userData?.totalDeals || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Рейтинг</span>
            <span className="stat-value">{userData?.rating?.toFixed(1) || '0.0'}</span>
          </div>
        </div>

        {/* Реферальная секция */}
        <div className="referral-section">
          <h3 className="referral-title">Реферальная программа</h3>
          <div className="referral-stats">
            <div className="referral-item">
              <span className="referral-label">Приглашено</span>
              <span className="referral-value">{referralStats.totalReferrals}</span>
            </div>
            <div className="referral-item">
              <span className="referral-label">Заработано TON</span>
              <span className="referral-value">{referralStats.totalEarned.toFixed(2)}</span>
            </div>
          </div>
          
          {/* Реферальный код */}
          {userData?.referralCode && (
            <div className="referral-code-container">
              <div className="referral-code-label">Ваш реферальный код:</div>
              <div 
                className={`referral-code-box ${isDisabled ? 'disabled' : ''}`} 
                onClick={handleCopyReferralLink}
              >
                <span className="referral-code">{userData.referralCode}</span>
                <button className={`copy-icon-btn ${isCopied ? 'copied' : ''} ${isDisabled ? 'disabled' : ''}`}>
                  {cooldown > 0 ? cooldown : (isCopied ? '✓' : '📋')}
                </button>
              </div>
            </div>
          )}

          <p className="referral-description">
            Пригласи друзей и получай 5% TON с каждой их сделки.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Profile;