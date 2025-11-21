// src/components/Badge.js

import React from 'react';
import './Badge.css';

// Конфигурация всех плашек
export const BADGE_CONFIG = {
  DADDY: {
    name: 'DADDY',
    commission: 0.1,
    color: '#FFD700',
    gradient: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)',
    glow: 'rgba(255, 215, 0, 0.6)',
    description: 'Эксклюзивный статус для VIP-пользователей',
    details: 'Комиссия всего 0.1%. Уникальный реферальный код. Доступен для китов, инвесторов или владельцев каналов с аудиторией >500K подписчиков.',
    requirements: 'Кит, инвестор или аудитория >500K в Telegram'
  },
  INFL: {
    name: 'INFL',
    commission: 0.5,
    color: '#4FC3F7',
    gradient: 'linear-gradient(135deg, #4FC3F7 0%, #29B6F6 50%, #4FC3F7 100%)',
    glow: 'rgba(79, 195, 247, 0.6)',
    description: 'Статус для влиятельных пользователей',
    details: 'Комиссия 0.5%. Уникальный реферальный код. Для владельцев каналов с аудиторией более 70K подписчиков.',
    requirements: 'Аудитория >70K в Telegram'
  },
  RESIDENT: {
    name: 'RESIDENT',
    commission: 1,
    color: '#66BB6A',
    gradient: 'linear-gradient(135deg, #66BB6A 0%, #4CAF50 50%, #66BB6A 100%)',
    glow: 'rgba(102, 187, 106, 0.6)',
    description: 'Статус для активных резидентов',
    details: 'Комиссия 1%. Для пользователей с более чем 70 сделками за месяц и рейтингом выше 4.5.',
    requirements: '>70 сделок/месяц, рейтинг >4.5'
  },
  JOKER: {
    name: 'JOKER',
    commission: 2,
    color: '#F27D00',
    gradient: 'linear-gradient(135deg, #F27D00 0%, #FF8F00 50%, #F27D00 100%)',
    glow: 'rgba(242, 125, 0, 0.6)',
    description: 'Статус для опытных трейдеров',
    details: 'Комиссия 2%. Для пользователей с более чем 30 сделками и рейтингом выше 4.0.',
    requirements: '>30 сделок, рейтинг >4.0'
  },
  GUEST: {
    name: 'GUEST',
    commission: 4,
    color: '#FFFFFF',
    gradient: 'linear-gradient(135deg, #FFFFFF 0%, #E0E0E0 50%, #FFFFFF 100%)',
    glow: 'rgba(255, 255, 255, 0.6)',
    description: 'Стартовый статус для новичков',
    details: 'Комиссия 4%. Базовый статус для всех новых пользователей с рейтингом от 3.5.',
    requirements: 'Рейтинг ≥3.5'
  },
  SCAM: {
    name: 'SCAM',
    commission: 20,
    color: '#F44336',
    gradient: 'linear-gradient(135deg, #F44336 0%, #D32F2F 50%, #F44336 100%)',
    glow: 'rgba(244, 67, 54, 0.6)',
    description: 'Предупреждение о низком рейтинге',
    details: 'Комиссия 20%. Этот статус присваивается пользователям с низким рейтингом. Улучшите свою репутацию для снижения комиссии.',
    requirements: '>5 сделок, рейтинг <1.0'
  }
};

// Функция определения плашки на основе данных пользователя
export const calculateBadge = (userData) => {
  const { totalDeals = 0, rating = 0, isWhale = false, telegramAudience = 0 } = userData;

  // DADDY - киты, инвесторы или большая аудитория
  if (isWhale || telegramAudience > 500000) {
    return 'DADDY';
  }

  // INFL - влиятельные пользователи
  if (telegramAudience > 70000) {
    return 'INFL';
  }

  // SCAM - низкий рейтинг
  if (totalDeals > 5 && rating < 1) {
    return 'SCAM';
  }

  // RESIDENT - активные резиденты
  if (totalDeals > 70 && rating > 4.5) {
    return 'RESIDENT';
  }

  // JOKER - опытные трейдеры
  if (totalDeals > 30 && rating > 4) {
    return 'JOKER';
  }

  // GUEST - базовый статус
  if (rating >= 3.5) {
    return 'GUEST';
  }

  // По умолчанию GUEST
  return 'GUEST';
};

const Badge = ({ badgeType, onClick, size = 'medium' }) => {
  const badge = BADGE_CONFIG[badgeType];

  if (!badge) return null;

  return (
    <div 
      className={`badge badge-${size}`}
      onClick={onClick}
      style={{
        '--badge-color': badge.color,
        '--badge-gradient': badge.gradient,
        '--badge-glow': badge.glow
      }}
    >
      <span className="badge-name">{badge.name}</span>
    </div>
  );
};

export default Badge;