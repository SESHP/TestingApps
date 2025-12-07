// src/components/Badge.js

import React from 'react';
import './Badge.css';

// Badge configuration with translations handled via i18n
export const getBadgeConfig = (t) => ({
  DADDY: {
    name: 'DADDY',
    commission: 0.1,
    color: '#FFD700',
    gradient: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)',
    glow: 'rgba(255, 215, 0, 0.6)',
    description: t('badgeDADDYDescription'),
    details: t('badgeDADDYDetails'),
    requirements: t('badgeDADDYRequirements')
  },
  INFL: {
    name: 'INFL',
    commission: 0.5,
    color: '#4FC3F7',
    gradient: 'linear-gradient(135deg, #4FC3F7 0%, #29B6F6 50%, #4FC3F7 100%)',
    glow: 'rgba(79, 195, 247, 0.6)',
    description: t('badgeINFLDescription'),
    details: t('badgeINFLDetails'),
    requirements: t('badgeINFLRequirements')
  },
  RESIDENT: {
    name: 'RESIDENT',
    commission: 1,
    color: '#66BB6A',
    gradient: 'linear-gradient(135deg, #66BB6A 0%, #4CAF50 50%, #66BB6A 100%)',
    glow: 'rgba(102, 187, 106, 0.6)',
    description: t('badgeRESIDENTDescription'),
    details: t('badgeRESIDENTDetails'),
    requirements: t('badgeRESIDENTRequirements')
  },
  JOKER: {
    name: 'JOKER',
    commission: 2,
    color: '#F27D00',
    gradient: 'linear-gradient(135deg, #F27D00 0%, #FF8F00 50%, #F27D00 100%)',
    glow: 'rgba(242, 125, 0, 0.6)',
    description: t('badgeJOKERDescription'),
    details: t('badgeJOKERDetails'),
    requirements: t('badgeJOKERRequirements')
  },
  GUEST: {
    name: 'GUEST',
    commission: 4,
    color: '#FFFFFF',
    gradient: 'linear-gradient(135deg, #FFFFFF 0%, #E0E0E0 50%, #FFFFFF 100%)',
    glow: 'rgba(255, 255, 255, 0.6)',
    description: t('badgeGUESTDescription'),
    details: t('badgeGUESTDetails'),
    requirements: t('badgeGUESTRequirements')
  },
  SCAM: {
    name: 'SCAM',
    commission: 20,
    color: '#F44336',
    gradient: 'linear-gradient(135deg, #F44336 0%, #D32F2F 50%, #F44336 100%)',
    glow: 'rgba(244, 67, 54, 0.6)',
    description: t('badgeSCAMDescription'),
    details: t('badgeSCAMDetails'),
    requirements: t('badgeSCAMRequirements')
  }
});

// Legacy export for backwards compatibility
export const BADGE_CONFIG = {
  DADDY: {
    name: 'DADDY',
    commission: 0.1,
    color: '#FFD700',
    gradient: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)',
    glow: 'rgba(255, 215, 0, 0.6)'
  },
  INFL: {
    name: 'INFL',
    commission: 0.5,
    color: '#4FC3F7',
    gradient: 'linear-gradient(135deg, #4FC3F7 0%, #29B6F6 50%, #4FC3F7 100%)',
    glow: 'rgba(79, 195, 247, 0.6)'
  },
  RESIDENT: {
    name: 'RESIDENT',
    commission: 1,
    color: '#66BB6A',
    gradient: 'linear-gradient(135deg, #66BB6A 0%, #4CAF50 50%, #66BB6A 100%)',
    glow: 'rgba(102, 187, 106, 0.6)'
  },
  JOKER: {
    name: 'JOKER',
    commission: 2,
    color: '#F27D00',
    gradient: 'linear-gradient(135deg, #F27D00 0%, #FF8F00 50%, #F27D00 100%)',
    glow: 'rgba(242, 125, 0, 0.6)'
  },
  GUEST: {
    name: 'GUEST',
    commission: 4,
    color: '#FFFFFF',
    gradient: 'linear-gradient(135deg, #FFFFFF 0%, #E0E0E0 50%, #FFFFFF 100%)',
    glow: 'rgba(255, 255, 255, 0.6)'
  },
  SCAM: {
    name: 'SCAM',
    commission: 20,
    color: '#F44336',
    gradient: 'linear-gradient(135deg, #F44336 0%, #D32F2F 50%, #F44336 100%)',
    glow: 'rgba(244, 67, 54, 0.6)'
  }
};

export const calculateBadge = (userData) => {
  const { totalDeals = 0, rating = 0, isWhale = false, telegramAudience = 0 } = userData;

  if (isWhale || telegramAudience > 500000) {
    return 'DADDY';
  }

  if (telegramAudience > 70000) {
    return 'INFL';
  }

  if (totalDeals > 5 && rating < 1) {
    return 'SCAM';
  }

  if (totalDeals > 70 && rating > 4.5) {
    return 'RESIDENT';
  }

  if (totalDeals > 30 && rating > 4) {
    return 'JOKER';
  }

  if (rating >= 3.5) {
    return 'GUEST';
  }

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
