// src/components/DepositModal.js
import React, { useState } from 'react';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { Address, toNano } from '@ton/core';
import { hapticFeedback, notificationHaptic } from '../utils/telegramUtils';
import './DepositModal.css';
import tonIcon from '../assets/icons/ton-icon.svg';
import starsIcon from '../assets/icons/stars-icon.svg';

function DepositModal({ isOpen, onClose, onSuccess, selectedCurrency }) {
  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Быстрые суммы для пополнения
  const quickAmounts = selectedCurrency === 'ton' 
    ? ['0.5', '1', '2', '5', '10', '20']
    : ['100', '500', '1000', '2000', '5000', '10000'];

  const handleQuickAmount = (value) => {
    hapticFeedback('light');
    setAmount(value);
    setError('');
  };

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Введите корректную сумму');
      hapticFeedback('error');
      return;
    }

    if (!userAddress) {
      setError('Сначала подключите кошелек');
      hapticFeedback('error');
      return;
    }

    setIsLoading(true);
    setError('');
    hapticFeedback('medium');

    try {
      // Адрес вашего кошелька для приема платежей
      const YOUR_WALLET_ADDRESS = 'UQCSw5rlttXSk7415Ybhs5iAvZnEbEZx5PhEwzLMEwA-DPsQ';
      
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 60 * 5,
        messages: [
          {
            address: YOUR_WALLET_ADDRESS,
            amount: toNano(amount).toString(),
            payload: btoa(JSON.stringify({
              userId: window.Telegram?.WebApp?.initDataUnsafe?.user?.id,
              type: 'deposit',
              currency: selectedCurrency
            }))
          }
        ]
      };

      const result = await tonConnectUI.sendTransaction(transaction);
      
      console.log('✅ Транзакция отправлена:', result);
      
      // Отправляем на бэкенд
      await processDeposit(result, amount);
      
      notificationHaptic('success');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('❌ Ошибка депозита:', error);
      setError('Ошибка при отправке транзакции');
      hapticFeedback('error');
    } finally {
      setIsLoading(false);
    }
  };

  const processDeposit = async (txResult, amount) => {
    const response = await fetch(`${process.env.REACT_APP_API_URL}/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: window.Telegram?.WebApp?.initDataUnsafe?.user?.id,
        amount: amount,
        txHash: txResult.boc,
        address: userAddress,
        currency: selectedCurrency
      })
    });

    return response.json();
  };

  const handleConnectWallet = () => {
    hapticFeedback('medium');
    tonConnectUI.openModal();
  };

  if (!isOpen) return null;

  return (
    <div className="deposit-modal-overlay" onClick={onClose}>
      <div className="deposit-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Заголовок */}
        <div className="deposit-modal-header">
          <h2 className="deposit-modal-title">Пополнить баланс</h2>
          <button className="deposit-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Иконка валюты */}
        <div className="deposit-currency-icon">
          <img 
            src={selectedCurrency === 'ton' ? tonIcon : starsIcon} 
            alt={selectedCurrency} 
          />
        </div>

        {!userAddress ? (
          /* Подключение кошелька */
          <div className="deposit-wallet-connect">
            <p className="deposit-info-text">
              Для пополнения баланса необходимо подключить TON кошелек
            </p>
            <button 
              className="deposit-primary-btn"
              onClick={handleConnectWallet}
            >
              <span className="btn-icon">🔗</span>
              Подключить кошелек
            </button>
          </div>
        ) : (
          /* Форма депозита */
          <div className="deposit-form">
            {/* Адрес кошелька */}
            <div className="deposit-wallet-info">
              <span className="wallet-label">Кошелек подключен</span>
              <span className="wallet-address-short">
                {userAddress.slice(0, 8)}...{userAddress.slice(-6)}
              </span>
            </div>

            {/* Поле ввода суммы */}
            <div className="deposit-input-group">
              <label className="deposit-input-label">
                Сумма {selectedCurrency === 'ton' ? 'TON' : 'Stars'}
              </label>
              <div className="deposit-input-wrapper">
                <input
                  type="number"
                  className="deposit-amount-input"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError('');
                  }}
                  placeholder="0.00"
                  min="0"
                  step={selectedCurrency === 'ton' ? '0.1' : '1'}
                />
                <span className="deposit-currency-label">
                  {selectedCurrency === 'ton' ? 'TON' : '⭐'}
                </span>
              </div>
            </div>

            {/* Быстрые суммы */}
            <div className="deposit-quick-amounts">
              {quickAmounts.map((value) => (
                <button
                  key={value}
                  className={`quick-amount-chip ${amount === value ? 'active' : ''}`}
                  onClick={() => handleQuickAmount(value)}
                >
                  {value}
                </button>
              ))}
            </div>

            {/* Сообщение об ошибке */}
            {error && (
              <div className="deposit-error-message">
                {error}
              </div>
            )}

            {/* Кнопки действий */}
            <div className="deposit-actions">
              <button 
                className="deposit-secondary-btn"
                onClick={onClose}
              >
                Отмена
              </button>
              <button 
                className="deposit-primary-btn"
                onClick={handleDeposit}
                disabled={isLoading || !amount}
              >
                {isLoading ? (
                  <>
                    <span className="deposit-loading-spinner" />
                    Отправка...
                  </>
                ) : (
                  <>
                    <span className="btn-icon">✓</span>
                    Пополнить
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DepositModal;