// src/components/BottomTabs.js

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { hapticFeedback } from '../utils/telegramUtils';
import './BottomTabs.css';

const BottomTabs = () => {
  const location = useLocation();
  
  const handleTabClick = () => {
    hapticFeedback('light'); // Вибрация при клике
  };

  const tabs = [
    {
      path: '/profile',
      label: 'Профиль',
      icon: '👤'
    },
    {
      path: '/guarantee',
      label: 'Гарант',
      icon: '🔒'
    }
  ];

  return (
    <div className="bottom-tabs">
      {tabs.map((tab) => (
        <Link
          key={tab.path}
          to={tab.path}
          className={`tab-item ${location.pathname === tab.path ? 'active' : ''}`}
          onClick={handleTabClick}
        >
          <div className="tab-icon">{tab.icon}</div>
          <div className="tab-label">{tab.label}</div>
        </Link>
      ))}
    </div>
  );
};

export default BottomTabs;