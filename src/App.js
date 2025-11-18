// src/App.js
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { tonConnectOptions } from './utils/tonConnect';

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { initTelegramApp } from './utils/telegramUtils';
import Profile from './pages/Profile';
import Inventory from './pages/Inventory';
import Guarantee from './pages/Guarantee';
import BottomTabs from './components/BottomTabs';
import './App.css';

function App() {
  return (
    <TonConnectUIProvider manifestUrl={tonConnectOptions.manifestUrl}>
      useEffect(() => {
        // Инициализация Telegram Mini App при загрузке приложения
        const isTelegram = initTelegramApp();
        
        if (isTelegram) {
          console.log('✅ Приложение запущено в Telegram');
        } else {
          console.log('🌐 Приложение запущено в браузере (режим разработки)');
        }
      }, []);
      
        return (
          <div className="app-container">
            <Router>
              <Routes>
                <Route path="/" element={<Profile />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/guarantee" element={<Guarantee />} />
              </Routes>
              <BottomTabs />
            </Router>
          </div>
    </TonConnectUIProvider>
  );
}

export default App;