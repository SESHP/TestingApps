// src/utils/api.js

import { getInitData } from './telegramUtils';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Вспомогательная функция для создания headers с аутентификацией
function getAuthHeaders() {
  const initData = getInitData();
  const finalInitData = initData || 'dev';

  console.log('🔐 getAuthHeaders:', {
    initDataLength: initData?.length,
    hasInitData: !!initData,
    finalInitData: finalInitData === 'dev' ? 'dev' : `${finalInitData.substring(0, 50)}...`,
    isTelegram: !!window.Telegram?.WebApp
  });

  return {
    'Content-Type': 'application/json',
    'x-telegram-init-data': finalInitData
  };
}

/**
 * Инициализация пользователя
 */
export async function initUser(initData, referralCode = null) {
  try {
    console.log('🔄 Инициализация пользователя с реф.кодом:', referralCode);

    const response = await fetch(`${API_URL}/api/user/init`, {
      method: 'POST',
      headers: getAuthHeaders(),
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
    const response = await fetch(`${API_URL}/api/user/${telegramId}/referrals`, {
      headers: getAuthHeaders()
    });

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
 * Создать новую сделку
 */
export async function createDeal(creatorId) {
  try {
    const response = await fetch(`${API_URL}/api/deals/create`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ creatorId })  // creatorId больше не используется на сервере
    });

    if (!response.ok) {
      throw new Error('Ошибка создания сделки');
    }

    return await response.json();
  } catch (error) {
    console.error('Ошибка API createDeal:', error);
    throw error;
  }
}

/**
 * Присоединиться к сделке
 */
export async function joinDeal(inviteCode, participantId) {
  try {
    const response = await fetch(`${API_URL}/api/deals/join`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ inviteCode })  // participantId больше не нужен
    });

    if (!response.ok) {
      throw new Error('Ошибка присоединения к сделке');
    }

    return await response.json();
  } catch (error) {
    console.error('Ошибка API joinDeal:', error);
    throw error;
  }
}

/**
 * Получить подарки в сделке
 */
export async function getDealGifts(dealId) {
  try {
    const response = await fetch(`${API_URL}/api/deals/${dealId}/gifts`);

    if (!response.ok) {
      throw new Error('Ошибка получения подарков сделки');
    }

    return await response.json();
  } catch (error) {
    console.error('Ошибка API getDealGifts:', error);
    throw error;
  }
}

/**
 * Получить информацию о сделке
 */
export async function getDealInfo(dealId) {
  try {
    const response = await fetch(`${API_URL}/api/deals/${dealId}`);

    if (!response.ok) {
      throw new Error('Ошибка получения информации о сделке');
    }

    return await response.json();
  } catch (error) {
    console.error('Ошибка API getDealInfo:', error);
    throw error;
  }
}

/**
 * Получить активные сделки пользователя
 */
export async function getUserDeals(userId) {
  try {
    const response = await fetch(`${API_URL}/api/deals/user/${userId}`);

    if (!response.ok) {
      throw new Error('Ошибка получения сделок пользователя');
    }

    return await response.json();
  } catch (error) {
    console.error('Ошибка API getUserDeals:', error);
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