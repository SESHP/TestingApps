// auth.js
require('dotenv').config();

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession('');

(async () => {
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text('Введите номер телефона: '),
    password: async () => await input.text('Введите пароль (если есть): '),
    phoneCode: async () => await input.text('Введите код из Telegram: '),
    onError: (err) => console.log(err),
  });

  console.log('✅ Авторизация успешна!');
  console.log('📝 Ваш session string:');
  console.log(client.session.save());
  
  process.exit(0);
})();