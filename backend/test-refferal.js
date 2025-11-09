// backend/test-referral.js
// Скрипт для тестирования реферальной системы

const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'http://localhost:3001';

async function testReferralSystem() {
  console.log('🧪 Начало тестирования реферальной системы\n');

  try {
    // Шаг 1: Создаем первого пользователя (реферер)
    console.log('📝 Шаг 1: Создание реферера...');
    const referrerResponse = await fetch(`${API_URL}/api/user/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: 'dev' })
    });
    
    const referrerData = await referrerResponse.json();
    console.log('✅ Реферер создан:', {
      id: referrerData.user.id,
      code: referrerData.user.referralCode,
      name: `${referrerData.user.firstName} ${referrerData.user.lastName}`
    });

    const referralCode = referrerData.user.referralCode;
    const referrerId = referrerData.user.id;

    // Шаг 2: Создаем второго пользователя с реферальным кодом
    console.log('\n📝 Шаг 2: Создание реферала с кодом:', referralCode);
    const referredResponse = await fetch(`${API_URL}/api/user/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        initData: 'dev',
        referralCode: referralCode 
      })
    });
    
    const referredData = await referredResponse.json();
    console.log('✅ Реферал создан:', {
      id: referredData.user.id,
      referredBy: referredData.user.referredBy,
      name: `${referredData.user.firstName} ${referredData.user.lastName}`
    });

    // Шаг 3: Проверяем статистику реферера
    console.log('\n📝 Шаг 3: Проверка статистики реферера...');
    const statsResponse = await fetch(`${API_URL}/api/user/${referrerId}/referrals`);
    const statsData = await statsResponse.json();
    
    console.log('✅ Статистика реферера:', {
      totalReferrals: statsData.stats.totalReferrals,
      totalEarned: statsData.stats.totalEarned,
      referrals: statsData.referrals.map(r => ({
        name: `${r.firstName} ${r.lastName}`,
        username: r.username
      }))
    });

    // Шаг 4: Проверяем валидацию реферального кода
    console.log('\n📝 Шаг 4: Проверка валидности кода...');
    const checkResponse = await fetch(`${API_URL}/api/referral/check/${referralCode}`);
    const checkData = await checkResponse.json();
    
    console.log('✅ Результат проверки:', checkData);

    // Итоги
    console.log('\n🎉 Тестирование завершено успешно!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Реферер: ${referrerData.user.firstName} (ID: ${referrerId})`);
    console.log(`Реферальный код: ${referralCode}`);
    console.log(`Приглашено: ${statsData.stats.totalReferrals} человек`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
    process.exit(1);
  }
}

// Запуск
testReferralSystem();