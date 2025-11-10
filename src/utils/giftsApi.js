// src/utils/giftsApi.js

/**
 * API для работы с подарками
 * 
 * ВАЖНО: Для работы этого функционала необходимо:
 * 1. Backend API для получения подарков из Telegram
 * 2. Парсинг подарков, отправленных на аккаунт @FNPK3
 * 3. Связка подарков с Telegram ID отправителя
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/**
 * Получить подарки конкретного пользователя
 * @param {string} telegramUserId - ID пользователя в Telegram
 * @returns {Promise<Array>} Массив подарков пользователя
 */
export const getUserGifts = async (telegramUserId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gifts/${telegramUserId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.gifts || [];
  } catch (error) {
    console.error('Ошибка получения подарков:', error);
    throw error;
  }
};

/**
 * Обновить список подарков пользователя
 * Запускает парсинг подарков на стороне сервера
 * @param {string} telegramUserId - ID пользователя в Telegram
 * @returns {Promise<Object>} Результат обновления
 */
export const refreshUserGifts = async (telegramUserId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gifts/refresh/${telegramUserId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка обновления подарков:', error);
    throw error;
  }
};

/**
 * Получить информацию о конкретном подарке
 * @param {string} giftId - ID подарка
 * @returns {Promise<Object>} Информация о подарке
 */
export const getGiftDetails = async (giftId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gifts/details/${giftId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка получения деталей подарка:', error);
    throw error;
  }
};

/**
 * Проверить, принадлежит ли подарок пользователю
 * Дополнительная проверка безопасности на клиенте
 * @param {string} giftId - ID подарка
 * @param {string} telegramUserId - ID пользователя
 * @returns {Promise<boolean>}
 */
export const verifyGiftOwnership = async (giftId, telegramUserId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gifts/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        giftId,
        telegramUserId,
      }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.isOwner || false;
  } catch (error) {
    console.error('Ошибка проверки владельца подарка:', error);
    return false;
  }
};