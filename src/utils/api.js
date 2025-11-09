// src/utils/api.js

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

/**
 * Инициализация пользователя
 */
export async function initUser(initData, referralCode = null) {
  try {
    console.log('🔄 Инициализация пользователя с реф.кодом:', referralCode);
    
    const response = await fetch(`${API_URL}/api/user/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        initData: initData || 'dev',
        referralCode
      })
    });

    if (!response.ok) {
      throw new Error('Ошибка инициализации пользователя');
    }

    const data = await response.json();
    console.log('✅ Пользователь инициализирован:', data);
    
    return data;
  } catch (error) {
    console.error('Ошибка API initUser:', error);
    throw error;
  }
}

/**
 * Получение статистики рефералов
 */
export async function getReferralStats(telegramId) {
  try {
    const response = await fetch(`${API_URL}/api/user/${telegramId}/referrals`);

    if (!response.ok) {
      throw new Error('Ошибка получения статистики');
    }

    return await response.json();
  } catch (error) {
    console.error('Ошибка API getReferralStats:', error);
    throw error;
  }
}

/**
 * Проверка реферального кода
 */
export async function checkReferralCode(code) {
  try {
    const response = await fetch(`${API_URL}/api/referral/check/${code}`);

    if (!response.ok) {
      throw new Error('Ошибка проверки кода');
    }

    return await response.json();
  } catch (error) {
    console.error('Ошибка API checkReferralCode:', error);
    throw error;
  }
}

/**
 * Health check
 */
export async function healthCheck() {
  try {
    const response = await fetch(`${API_URL}/health`);
    return await response.json();
  } catch (error) {
    console.error('Ошибка API healthCheck:', error);
    return { status: 'ERROR' };
  }
}