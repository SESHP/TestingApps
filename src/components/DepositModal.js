import React, { useState } from 'react';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { Address, toNano } from '@ton/core';
import './DepositModal.css';

function DepositModal({ isOpen, onClose, onSuccess }) {
  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Введите корректную сумму');
      return;
    }

    if (!userAddress) {
      alert('Сначала подключите кошелек');
      return;
    }

    setIsLoading(true);

    try {
      // Адрес вашего кошелька для приема платежей
      const YOUR_WALLET_ADDRESS = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
      
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 60 * 5, // 5 минут
        messages: [
          {
            address: YOUR_WALLET_ADDRESS,
            amount: toNano(amount).toString(), // Конвертация в nanotons
            payload: btoa(JSON.stringify({
              userId: window.Telegram?.WebApp?.initDataUnsafe?.user?.id,
              type: 'deposit'
            }))
          }
        ]
      };

      const result = await tonConnectUI.sendTransaction(transaction);
      
      console.log('Транзакция отправлена:', result);
      
      // Отправляем на бэкенд для обработки
      await processDeposit(result, amount);
      
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Ошибка депозита:', error);
      alert('Ошибка при отправке транзакции');
    } finally {
      setIsLoading(false);
    }
  };

  const processDeposit = async (txResult, amount) => {
    // Здесь отправляем данные на бэкенд
    const response = await fetch(`${process.env.REACT_APP_API_URL}/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: window.Telegram?.WebApp?.initDataUnsafe?.user?.id,
        amount: amount,
        txHash: txResult.boc,
        address: userAddress
      })
    });

    return response.json();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Пополнить баланс</h2>
        
        {!userAddress ? (
          <div>
            <p>Подключите кошелек для пополнения</p>
            <button onClick={() => tonConnectUI.openModal()}>
              Подключить кошелек
            </button>
          </div>
        ) : (
          <div>
            <p>Кошелек подключен: {userAddress.slice(0, 6)}...{userAddress.slice(-4)}</p>
            
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Сумма в TON"
              min="0.1"
              step="0.1"
            />
            
            <button 
              onClick={handleDeposit}
              disabled={isLoading}
            >
              {isLoading ? 'Отправка...' : `Пополнить ${amount || '0'} TON`}
            </button>
          </div>
        )}
        
        <button onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
}

export default DepositModal;