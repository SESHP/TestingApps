// src/components/DepositModal.js
import React, { useState, useEffect } from 'react';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { toNano } from '@ton/core';
import { hapticFeedback, notificationHaptic, getTelegramUser } from '../utils/telegramUtils';
import { getPlatformClass } from '../utils/platformDetect';
import { useTranslation } from '../i18n/LanguageContext';
import './DepositModal.css';
import tonIcon from '../assets/icons/ton-icon.svg';
import starsIcon from '../assets/icons/stars-icon.svg';

function DepositModal({ isOpen, onClose, onSuccess, selectedCurrency }) {
  const { t } = useTranslation();
  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [platformClass, setPlatformClass] = useState('');

  useEffect(() => {
    setPlatformClass(getPlatformClass());
  }, []);

  const quickAmounts = selectedCurrency === 'ton'
    ? ['0.5', '1', '2', '5', '10', '20']
    : ['25', '50', '100', '500', '1000', '2000'];

  const handleQuickAmount = (value) => {
    hapticFeedback('light');
    setAmount(value);
    setError('');
  };

  const handleTonDeposit = async () => {
    if (!userAddress) {
      setError(t('connectWalletFirst'));
      notificationHaptic('error');
      return;
    }

    setIsLoading(true);
    setError('');
    hapticFeedback('light');

    try {
      const YOUR_WALLET_ADDRESS = 'UQCSw5rlttXSk7415Ybhs5iAvZnEbEZx5PhEwzLMEwA-DPsQ';

      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 60 * 5,
        messages: [
          {
            address: YOUR_WALLET_ADDRESS,
            amount: toNano(amount).toString(),
          }
        ]
      };

      const result = await tonConnectUI.sendTransaction(transaction);

      console.log('✅ TON транзакция отправлена:', result);

      await processTonDeposit(result, amount);

      notificationHaptic('success');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('❌ Ошибка TON депозита:', error);
      setError(t('transactionError'));
      notificationHaptic('error');
    } finally {
      setIsLoading(false);
    }
  };

  const processTonDeposit = async (txResult, amount) => {
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
        currency: 'ton'
      })
    });

    return response.json();
  };

  const handleStarsDeposit = async () => {
    setIsLoading(true);
    setError('');
    hapticFeedback('light');

    try {
      const telegramUser = getTelegramUser();

      if (!telegramUser || !telegramUser.id) {
        setError(t('paymentCreationError'));
        notificationHaptic('error');
        setIsLoading(false);
        return;
      }

      console.log('🌟 Создание Stars invoice для пользователя:', telegramUser.id);

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/stars/create-invoice`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: telegramUser.id,
            amount: parseInt(amount)
          })
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || t('paymentCreationError'));
      }

      console.log('✅ Invoice создан:', data.invoiceLink);

      const tg = window.Telegram?.WebApp;
      if (!tg) {
        throw new Error(t('paymentCreationError'));
      }

      tg.openInvoice(data.invoiceLink, (status) => {
        console.log('💳 Статус оплаты Stars:', status);

        if (status === 'paid') {
          console.log('✅ Оплата Stars успешна!');
          notificationHaptic('success');

          setTimeout(() => {
            onSuccess?.();
            onClose();
          }, 1000);
        } else if (status === 'cancelled') {
          console.log('❌ Оплата отменена');
          setError(t('paymentCancelled'));
          notificationHaptic('error');
        } else if (status === 'failed') {
          console.log('❌ Оплата не удалась');
          setError(t('paymentError'));
          notificationHaptic('error');
        }

        setIsLoading(false);
      });

    } catch (error) {
      console.error('❌ Ошибка Stars депозита:', error);
      setError(error.message || t('paymentCreationError'));
      notificationHaptic('error');
      setIsLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError(t('enterValidAmount'));
      notificationHaptic('error');
      return;
    }

    if (selectedCurrency === 'ton') {
      if (!userAddress) {
        setError(t('connectWalletFirst'));
        notificationHaptic('error');
        return;
      }
      await handleTonDeposit();
    } else {
      await handleStarsDeposit();
    }
  };

  const handleConnectWallet = () => {
    hapticFeedback('light');
    tonConnectUI.openModal();
  };

  if (!isOpen) return null;

  const needsWallet = selectedCurrency === 'ton' && !userAddress;

  return (
    <div className={`deposit-modal-overlay ${platformClass}`} onClick={onClose}>
      <div className={`deposit-modal-content ${platformClass}`} onClick={(e) => e.stopPropagation()}>
        <div className="deposit-modal-header">
          <h2 className="deposit-modal-title">{t('depositBalanceTitle')}</h2>
          <button className="deposit-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="deposit-currency-icon">
          <img
            src={selectedCurrency === 'ton' ? tonIcon : starsIcon}
            alt={selectedCurrency}
          />
        </div>

        {needsWallet ? (
          <div className="deposit-wallet-connect">
            <p className="deposit-info-text">
              {t('depositInfo')}
            </p>
            <button
              className={`deposit-primary-btn ${platformClass}`}
              onClick={handleConnectWallet}
            >
              <span className="btn-icon">🔗</span>
              {t('connectWallet')}
            </button>
          </div>
        ) : (
          <div className="deposit-form">
            {selectedCurrency === 'ton' && userAddress && (
              <div className={`deposit-wallet-info ${platformClass}`}>
                <span className="wallet-label">{t('walletConnected')}</span>
                <span className="wallet-address-short">
                  {userAddress.slice(0, 8)}...{userAddress.slice(-6)}
                </span>
              </div>
            )}

            <div className="deposit-input-group">
              <label className="deposit-input-label">
                {selectedCurrency === 'ton' ? t('amountTON') : t('amountStars')}
              </label>
              <div className="deposit-input-wrapper">
                <input
                  type="number"
                  className={`deposit-amount-input ${platformClass}`}
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

            <div className="deposit-quick-amounts">
              {quickAmounts.map((value) => (
                <button
                  key={value}
                  className={`quick-amount-chip ${amount === value ? 'active' : ''} ${platformClass}`}
                  onClick={() => handleQuickAmount(value)}
                >
                  {value}
                </button>
              ))}
            </div>

            {error && (
              <div className={`deposit-error-message ${platformClass}`}>
                {error}
              </div>
            )}

            <div className="deposit-actions">
              <button
                className={`deposit-secondary-btn ${platformClass}`}
                onClick={onClose}
              >
                {t('cancel')}
              </button>
              <button
                className={`deposit-primary-btn ${platformClass}`}
                onClick={handleDeposit}
                disabled={isLoading || !amount}
              >
                {isLoading ? (
                  <>
                    <span className="deposit-loading-spinner" />
                    {t('sending')}
                  </>
                ) : (
                  <>
                    <span className="btn-icon">✓</span>
                    {t('deposit')}
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
