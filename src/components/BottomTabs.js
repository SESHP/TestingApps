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
      icon: 'profile'
    },
    {
      path: '/inventory',
      label: 'Инвентарь',
      icon: 'inventory'
    },
    {
      path: '/guarantee',
      label: 'Гарант',
      icon: 'guarantee'
    }
  ];

  const renderIcon = (iconType, isActive) => {
    const color = isActive ? '#F27D00' : 'rgba(255, 255, 255, 0.5)';
    
    switch(iconType) {
      case 'profile':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 21C20 19.6044 20 18.9067 19.8278 18.3389C19.44 17.0605 18.4395 16.06 17.1611 15.6722C16.5933 15.5 15.8956 15.5 14.5 15.5H9.5C8.10444 15.5 7.40665 15.5 6.83886 15.6722C5.56045 16.06 4.56004 17.0605 4.17224 18.3389C4 18.9067 4 19.6044 4 21M16.5 7.5C16.5 9.98528 14.4853 12 12 12C9.51472 12 7.5 9.98528 7.5 7.5C7.5 5.01472 9.51472 3 12 3C14.4853 3 16.5 5.01472 16.5 7.5Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'inventory':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 3H14C14 4.10457 13.1046 5 12 5C10.8954 5 10 4.10457 10 3Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 8H21V18C21 19.1046 20.1046 20 19 20H5C3.89543 20 3 19.1046 3 18V8Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 8C3 6.89543 3.89543 6 5 6H19C20.1046 6 21 6.89543 21 8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'guarantee':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L4 6V12C4 16.5 7 20.5 12 22C17 20.5 20 16.5 20 12V6L12 2Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 12L11 14L15 10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bottom-tabs">
      {tabs.map((tab) => (
        <Link
          key={tab.path}
          to={tab.path}
          className={`tab-item ${location.pathname === tab.path ? 'active' : ''}`}
          onClick={handleTabClick}
        >
          <div className="tab-icon">
            {renderIcon(tab.icon, location.pathname === tab.path)}
          </div>
          <div className="tab-label">{tab.label}</div>
        </Link>
      ))}
    </div>
  );
};

export default BottomTabs;