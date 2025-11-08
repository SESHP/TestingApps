import React from 'react';
import { Link } from 'react-router-dom';

const BottomTabs = () => {
  return (
    <div style={{
      position: 'fixed', bottom: 0, width: '100%', background: '#fff',
      display: 'flex', justifyContent: 'space-around', padding: '10px', borderTop: '1px solid #ccc'
    }}>
      <Link to="/profile">Профиль</Link>
      <Link to="/guarantee">Гарант</Link>
    </div>
  );
};

export default BottomTabs;