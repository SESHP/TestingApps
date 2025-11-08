// src/App.js

import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Profile from './pages/Profile';
import Guarantee from './pages/Guarantee';
import BottomTabs from './components/BottomTabs';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <Router>
        <Routes>
          <Route path="/" element={<Profile />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/guarantee" element={<Guarantee />} />
        </Routes>
        <BottomTabs />
      </Router>
    </div>
  );
}

export default App;
