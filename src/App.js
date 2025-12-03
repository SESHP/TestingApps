// src/App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { tonConnectOptions } from './utils/tonConnect';
import { initTelegramApp } from './utils/telegramUtils';
import Profile from './pages/Profile';
import Inventory from './pages/Inventory';
import Guarantee from './pages/Guarantee';
import BottomTabs from './components/BottomTabs';
import LoadingScreen from './components/LoadingScreen';
import './App.css';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Инициализация Telegram Mini App при загрузке приложения
    const isTelegram = initTelegramApp();
    
    if (isTelegram) {
      console.log('✅ Приложение запущено в Telegram');
    } else {
      console.log('🌐 Приложение запущено в браузере (режим разработки)');
    }
  }, []);

  const handleLoadComplete = () => {
    setIsLoading(false);
  };

  return (
    <TonConnectUIProvider manifestUrl={tonConnectOptions.manifestUrl}>
      {isLoading && <LoadingScreen onLoadComplete={handleLoadComplete} />}
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