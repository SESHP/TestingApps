require('dotenv').config();


const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');

// === КОНФИГУРАЦИЯ ===
const API_ID = parseInt(process.env.TELEGRAM_API_ID); // Твой api_id
const API_HASH = process.env.TELEGRAM_API_HASH; // Твой api_hash
const SESSION_STRING = process.env.TELEGRAM_SESSION; // Твоя session строка

const client = new TelegramClient(
  new StringSession(SESSION_STRING),
  API_ID,
  API_HASH,
  { connectionRetries: 5 }
);

// === 1. ОБРАБОТКА ВХОДЯЩИХ ПОДАРКОВ ===
async function handleIncomingGifts() {
  console.log('🎯 Начинаем отслеживать входящие подарки...\n');

  // Слушаем ВСЕ новые сообщения
  client.addEventHandler(async (event) => {
    try {
      const message = event.message;
      
      // Проверяем, что это сервисное сообщение (service message)
      if (!message.action) return;
      
      // ====== ВАРИАНТ 1: Обычный подарок (Gift) ======
      if (message.action.className === 'MessageActionGiftPremium') {
        console.log('\n🎁 ════ ПОЛУЧЕН ОБЫЧНЫЙ ПОДАРОК ════');
        
        // 1. Получаем ID отправителя
        const senderId = message.senderId?.value || message.fromId?.userId?.value;
        console.log(`👤 ID отправителя: ${senderId}`);
        
        // Получаем информацию о пользователе
        if (senderId) {
          const sender = await client.getEntity(senderId);
          console.log(`   Имя: ${sender.firstName || ''} ${sender.lastName || ''}`);
          console.log(`   Username: @${sender.username || 'нет'}`);
        }
        
        // 2. Данные подарка
        console.log(`\n💎 Данные подарка:`);
        console.log(`   Месяцев Premium: ${message.action.months}`);
        console.log(`   Валюта: ${message.action.currency || 'N/A'}`);
        console.log(`   Сумма: ${message.action.amount || 'N/A'}`);
        
        // Если есть текст с подарком
        if (message.message) {
          console.log(`   💬 Сообщение: "${message.message}"`);
        }
        
        console.log(`   📅 Дата: ${new Date(message.date * 1000).toLocaleString('ru-RU')}`);
        console.log('════════════════════════════════════\n');
      }
      
      // ====== ВАРИАНТ 2: Подарок со звездами (StarGift) ======
      if (message.action.className === 'MessageActionStarGift') {
        console.log('\n⭐ ════ ПОЛУЧЕН STAR GIFT ════');
        
        // 1. ID отправителя
        const senderId = message.senderId?.value || message.fromId?.userId?.value;
        console.log(`👤 ID отправителя: ${senderId}`);
        
        if (senderId) {
          const sender = await client.getEntity(senderId);
          console.log(`   Имя: ${sender.firstName || ''} ${sender.lastName || ''}`);
          console.log(`   Username: @${sender.username || 'нет'}`);
          console.log(`   Телефон: ${sender.phone || 'скрыт'}`);
        }
        
        // 2. Данные о подарке
        const giftAction = message.action;
        console.log(`\n🎁 Данные подарка:`);
        console.log(`   Gift ID: ${giftAction.gift?.id || 'N/A'}`);
        console.log(`   Стоимость в Stars: ${giftAction.stars || 0}`);
        console.log(`   Конвертируемый: ${giftAction.convertStars || 0} Stars`);
        
        // Проверяем, уникальный ли это подарок
        if (giftAction.upgrade) {
          console.log(`   ✨ УНИКАЛЬНЫЙ ПОДАРОК!`);
          console.log(`   Апгрейд ID: ${giftAction.upgrade}`);
        }
        
        // Сохранен ли в профиле
        console.log(`   Сохранен в профиле: ${giftAction.saved ? 'Да' : 'Нет'}`);
        
        // Текст с подарком
        if (message.message) {
          console.log(`   💬 Сообщение: "${message.message}"`);
        }
        
        console.log(`   📅 Дата: ${new Date(message.date * 1000).toLocaleString('ru-RU')}`);
        console.log('════════════════════════════════════\n');
        
        // 3. ПОЛУЧАЕМ ДЕТАЛЬНУЮ ИНФОРМАЦИЮ О ПОДАРКЕ
        if (giftAction.gift?.id) {
          await getGiftDetails(giftAction.gift.id, senderId, message.id);
        }
      }
      
    } catch (error) {
      console.error('❌ Ошибка обработки сообщения:', error.message);
    }
  }, new NewMessage({}));
}

// === 2. ПОЛУЧЕНИЕ ДЕТАЛЬНОЙ ИНФОРМАЦИИ О ПОДАРКЕ ===
async function getGiftDetails(giftId, senderId, messageId) {
  try {
    console.log('📦 Загружаем детали подарка...\n');
    
    // Получаем информацию о всех доступных подарках
    const availableGifts = await client.invoke(
      new Api.payments.GetStarGifts({ hash: 0 })
    );
    
    // Ищем наш подарок по ID
    const giftInfo = availableGifts.gifts?.find(g => g.id === giftId);
    
    if (giftInfo) {
      console.log('🎨 ════ ДЕТАЛИ ПОДАРКА ════');
      console.log(`   ID: ${giftInfo.id}`);
      console.log(`   Стоимость: ${giftInfo.stars} Stars`);
      console.log(`   Доступность: ${giftInfo.availabilityRemains || 'Неограничено'}/${giftInfo.availabilityTotal || '∞'}`);
      console.log(`   Первая продажа: ${new Date(giftInfo.firstSaleDate * 1000).toLocaleDateString('ru-RU')}`);
      console.log(`   Последняя продажа: ${new Date(giftInfo.lastSaleDate * 1000).toLocaleDateString('ru-RU')}`);
      
      // Стикер подарка
      if (giftInfo.sticker) {
        console.log(`\n   📎 Стикер:`);
        console.log(`      Emoji: ${giftInfo.sticker.attributes?.find(a => a.className === 'DocumentAttributeSticker')?.alt || 'N/A'}`);
      }
      
      console.log('════════════════════════════════════\n');
    }
    
    // Получаем информацию о подарках пользователя (может быть уникальным)
    await getUserGiftInfo(senderId, messageId);
    
  } catch (error) {
    console.error('❌ Ошибка получения деталей:', error.message);
  }
}

// === 3. ПОЛУЧЕНИЕ ИНФОРМАЦИИ О ПОДАРКЕ ПОЛЬЗОВАТЕЛЯ (для уникальных) ===
async function getUserGiftInfo(userId, messageId) {
  try {
    // Получаем подарки конкретного пользователя
    const userGifts = await client.invoke(
      new Api.payments.GetUserStarGifts({
        userId: userId,
        offset: '',
        limit: 100,
      })
    );
    
    // Ищем подарок по ID сообщения
    const giftEntry = userGifts.gifts?.find(g => g.msgId === messageId);
    
    if (giftEntry && giftEntry.gift) {
      const gift = giftEntry.gift;
      
      console.log('✨ ════ УНИКАЛЬНЫЙ ПОДАРОК ════');
      
      // === НАЗВАНИЕ ===
      if (gift.title) {
        console.log(`   📛 Название: ${gift.title}`);
      }
      
      // === МОДЕЛЬ ===
      if (gift.model) {
        console.log(`\n   🏗️ МОДЕЛЬ:`);
        console.log(`      Имя модели: ${gift.model.title || 'N/A'}`);
        if (gift.model.document) {
          console.log(`      Document ID: ${gift.model.document.id}`);
        }
      }
      
      // === ФОН (BACKDROP) ===
      if (gift.backdrop) {
        console.log(`\n   🎨 ФОН:`);
        console.log(`      Название: ${gift.backdrop.title || 'N/A'}`);
        
        if (gift.backdrop.centerColor) {
          console.log(`      Цвет центра: #${gift.backdrop.centerColor.toString(16).padStart(6, '0')}`);
        }
        if (gift.backdrop.edgeColor) {
          console.log(`      Цвет краёв: #${gift.backdrop.edgeColor.toString(16).padStart(6, '0')}`);
        }
        if (gift.backdrop.patternColor) {
          console.log(`      Цвет паттерна: #${gift.backdrop.patternColor.toString(16).padStart(6, '0')}`);
        }
        if (gift.backdrop.textColor) {
          console.log(`      Цвет текста: #${gift.backdrop.textColor.toString(16).padStart(6, '0')}`);
        }
      }
      
      // === ПАТТЕРН (SYMBOL) ===
      if (gift.pattern) {
        console.log(`\n   🔷 УЗОР/ПАТТЕРН:`);
        console.log(`      Название: ${gift.pattern.title || 'N/A'}`);
        if (gift.pattern.document) {
          console.log(`      Document ID: ${gift.pattern.document.id}`);
        }
      }
      
      // === ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ ===
      if (gift.ownerName) {
        console.log(`\n   👤 Владелец: ${gift.ownerName}`);
      }
      
      if (gift.num) {
        console.log(`   🔢 Номер уникального подарка: #${gift.num}`);
      }
      
      if (gift.birthday) {
        console.log(`   🎂 День рождения владельца: ${gift.birthday}`);
      }
      
      console.log('════════════════════════════════════\n');
      
      // Сохраняем данные в JSON для дальнейшего использования
      const giftData = {
        messageId: messageId,
        senderId: userId,
        title: gift.title || null,
        model: {
          name: gift.model?.title || null,
          documentId: gift.model?.document?.id?.toString() || null,
        },
        backdrop: {
          name: gift.backdrop?.title || null,
          centerColor: gift.backdrop?.centerColor ? `#${gift.backdrop.centerColor.toString(16).padStart(6, '0')}` : null,
          edgeColor: gift.backdrop?.edgeColor ? `#${gift.backdrop.edgeColor.toString(16).padStart(6, '0')}` : null,
          patternColor: gift.backdrop?.patternColor ? `#${gift.backdrop.patternColor.toString(16).padStart(6, '0')}` : null,
          textColor: gift.backdrop?.textColor ? `#${gift.backdrop.textColor.toString(16).padStart(6, '0')}` : null,
        },
        pattern: {
          name: gift.pattern?.title || null,
          documentId: gift.pattern?.document?.id?.toString() || null,
        },
        number: gift.num || null,
        ownerName: gift.ownerName || null,
      };
      
      console.log('💾 Данные подарка (JSON):');
      console.log(JSON.stringify(giftData, null, 2));
      console.log('\n');
      
      return giftData;
    }
    
  } catch (error) {
    console.error('❌ Ошибка получения информации о подарке пользователя:', error.message);
  }
}

// === 4. ПОЛУЧЕНИЕ ИСТОРИИ ВСЕХ ПОЛУЧЕННЫХ ПОДАРКОВ ===
async function getAllMyGifts() {
  try {
    console.log('📜 Загружаем историю всех подарков...\n');
    
    const me = await client.getMe();
    const myGifts = await client.invoke(
      new Api.payments.GetUserStarGifts({
        userId: me,
        offset: '',
        limit: 100,
      })
    );
    
    console.log(`📊 Всего подарков: ${myGifts.count}\n`);
    
    myGifts.gifts?.forEach((giftEntry, index) => {
      console.log(`${index + 1}. Подарок от ${giftEntry.fromId ? 'пользователя ' + giftEntry.fromId : 'анонима'}`);
      console.log(`   Дата: ${new Date(giftEntry.date * 1000).toLocaleString('ru-RU')}`);
      console.log(`   Сохранён: ${giftEntry.saved ? 'Да' : 'Нет'}`);
      
      if (giftEntry.gift?.title) {
        console.log(`   ✨ Уникальный: ${giftEntry.gift.title}`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения истории:', error.message);
  }
}

// === ГЛАВНАЯ ФУНКЦИЯ ===
async function main() {
  try {
    console.log('🚀 Запуск Telegram клиента...\n');
    
    await client.connect();
    
    const me = await client.getMe();
    console.log(`✅ Подключено как: ${me.firstName} ${me.lastName || ''}`);
    console.log(`📱 ID: ${me.id}`);
    console.log(`👤 Username: @${me.username || 'нет'}\n`);
    
    // Опционально: показать историю подарков при запуске
    // await getAllMyGifts();
    
    // Начинаем слушать входящие подарки
    await handleIncomingGifts();
    
    console.log('✅ Бот запущен! Ожидаем входящие подарки...\n');
    console.log('Для остановки нажми Ctrl+C\n');
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  }
}

// Запускаем
main();

// Обработка выхода
process.on('SIGINT', async () => {
  console.log('\n\n👋 Остановка бота...');
  await client.disconnect();
  process.exit(0);
});