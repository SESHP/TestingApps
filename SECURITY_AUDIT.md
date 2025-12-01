# Отчет по аудиту безопасности

**Дата проведения:** 2025-12-01
**Статус:** 🔴 КРИТИЧЕСКИЙ
**Найдено уязвимостей:** 19 (5 критических, 5 высокого приоритета, 5 среднего, 4 низкого)

---

## 🔴 КРИТИЧЕСКИЕ УЯЗВИМОСТИ (требуют немедленного исправления)

### 1. Захардкоженный пароль базы данных
**Локация:** `backend/server.js:44`
**Код:**
```javascript
password: process.env.DB_PASSWORD || 'olhseS05!'
```

**Описание:** Пароль от PostgreSQL указан прямо в исходном коде в качестве fallback значения.

**Риск:**
- Полная компрометация базы данных
- Доступ к персональным данным пользователей
- Возможность изменения/удаления данных

**Решение:**
```javascript
// Удалить fallback и требовать обязательную переменную окружения
if (!process.env.DB_PASSWORD) {
  throw new Error('DB_PASSWORD environment variable is required');
}
password: process.env.DB_PASSWORD
```

---

### 2. Отсутствие валидации Telegram WebApp данных
**Локация:** `backend/server.js:191-202`
**Код:**
```javascript
function validateTelegramData(initData) {
  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (userStr) {
      return JSON.parse(decodeURIComponent(userStr));
    }
  } catch (error) {
    console.error('Ошибка валидации:', error);
  }
  return null;
}
```

**Описание:** Функция только парсит данные, но НЕ ПРОВЕРЯЕТ HMAC подпись от Telegram. Любой атакующий может подделать данные пользователя.

**Риск:**
- Авторизация под любым пользователем
- Кража аккаунтов
- Манипуляция балансами и рефералами

**Решение:**
```javascript
const crypto = require('crypto');

function validateTelegramData(initData, botToken) {
  if (!initData) return null;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    // Сортируем параметры
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Вычисляем HMAC
    const secretKey = crypto.createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const calculatedHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Проверяем подпись
    if (calculatedHash !== hash) {
      console.error('❌ Invalid Telegram data signature');
      return null;
    }

    // Проверяем время (не старше 1 часа)
    const authDate = parseInt(params.get('auth_date'));
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - authDate > 3600) {
      console.error('❌ Telegram data expired');
      return null;
    }

    const userStr = params.get('user');
    if (userStr) {
      return JSON.parse(decodeURIComponent(userStr));
    }
  } catch (error) {
    console.error('Ошибка валидации:', error);
  }
  return null;
}
```

---

### 3. Полное отсутствие аутентификации на API endpoints
**Локация:** Все файлы бэкенда

**Описание:** Ни один API endpoint не проверяет, что запрос действительно от авторизованного пользователя.

**Уязвимые endpoints:**
- `POST /api/user/init` - можно создать пользователей с любым telegram_id
- `POST /api/deals/create` - можно создавать сделки от имени любого
- `POST /api/gifts/:id/withdraw` - можно помечать любые подарки как выведенные
- `GET /api/user/:telegramId/referrals` - можно получить данные любого пользователя
- `POST /api/user/:telegramId/badge-params` - можно изменять параметры плашек любого пользователя
- `POST /api/stars/create-invoice` - можно создавать инвойсы от имени любого
- И все остальные endpoints

**Риск:**
- Полная компрометация системы
- Кража данных пользователей
- Манипуляция счетами
- Кража подарков
- Изменение рейтингов и статусов

**Решение:**
Создать middleware для аутентификации:

```javascript
// backend/middleware/auth.js
const crypto = require('crypto');

function authenticateUser(req, res, next) {
  const initData = req.headers['x-telegram-init-data'];
  const botToken = process.env.BOT_TOKEN;

  if (!initData || !botToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userData = validateTelegramData(initData, botToken);
  if (!userData) {
    return res.status(401).json({ error: 'Invalid authentication data' });
  }

  // Добавляем данные пользователя в request
  req.user = userData;
  next();
}

module.exports = { authenticateUser };
```

Применить к endpoints:
```javascript
const { authenticateUser } = require('./middleware/auth');

app.post('/api/user/init', authenticateUser, async (req, res) => {
  // Теперь можем доверять req.user
  const userData = req.user;
  // ...
});
```

---

### 4. WebSocket без аутентификации
**Локация:** `backend/guarantee-socket.js`
**Код:**
```javascript
socket.on('join-deal', async ({ dealId, userId }) => {
  // Никакой проверки что userId это действительно этот пользователь
  socket.join(`deal-${dealId}`);
  userSockets.set(userId.toString(), socket.id);
})
```

**Описание:** Любой пользователь может подключиться к WebSocket и указать любой userId в параметрах. Это позволяет:
- Присоединиться к чужим сделкам
- Добавлять/удалять подарки от имени других
- Подтверждать сделки за других пользователей
- Получать уведомления о чужих сделках

**Риск:**
- Кража подарков
- Манипуляция сделками
- Полный контроль над чужими обменами

**Решение:**
```javascript
// При подключении передавать initData
io.use((socket, next) => {
  const initData = socket.handshake.auth.initData;
  const botToken = process.env.BOT_TOKEN;

  const userData = validateTelegramData(initData, botToken);
  if (!userData) {
    return next(new Error('Authentication failed'));
  }

  socket.userId = userData.id;
  next();
});

// Использовать проверенный userId
socket.on('join-deal', async ({ dealId }) => {
  const userId = socket.userId; // Берем из аутентификации, а не из параметров

  // Проверяем что пользователь имеет право на эту сделку
  const deal = await pool.query(
    'SELECT * FROM deals WHERE id = $1 AND (creator_id = $2 OR participant_id = $2)',
    [dealId, userId]
  );

  if (deal.rows.length === 0) {
    socket.emit('error', { message: 'Access denied' });
    return;
  }

  socket.join(`deal-${dealId}`);
});
```

---

### 5. Небезопасная проверка владельца подарка
**Локация:** `backend/guarantee-socket.js:44-52`
**Код:**
```javascript
const giftCheck = await pool.query(
  `SELECT * FROM gifts WHERE id = $1 AND from_id = $2 AND is_withdrawn = FALSE`,
  [giftId, userId]
);
```

**Описание:** `userId` приходит от клиента через WebSocket и не проверяется. Атакующий может указать любой userId и добавить чужие подарки в свою сделку.

**Риск:**
- Кража подарков других пользователей
- Обмен чужими подарками

**Решение:**
```javascript
// Использовать аутентифицированный userId из socket
socket.on('add-gift-to-deal', async ({ dealId, giftId }) => {
  const userId = socket.userId; // Из аутентификации, а не из параметров

  console.log(`🎁 Добавление подарка ${giftId} в сделку ${dealId} от ${userId}`);

  // Теперь проверка надежна
  const giftCheck = await pool.query(
    `SELECT * FROM gifts WHERE id = $1 AND from_id = $2 AND is_withdrawn = FALSE`,
    [giftId, userId]
  );

  // ...
});
```

---

## 🟠 ВЫСОКИЙ ПРИОРИТЕТ

### 6. Отсутствие Rate Limiting
**Описание:** Нет ограничений на количество запросов от одного IP или пользователя.

**Риск:**
- DDoS атаки
- Брутфорс
- Спам регистрациями
- Перегрузка базы данных

**Решение:**
```javascript
const rateLimit = require('express-rate-limit');

// Общий лимит для всех API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // Максимум 100 запросов
  message: 'Слишком много запросов, попробуйте позже'
});

// Строгий лимит для критичных операций
const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 10, // Максимум 10 запросов
  message: 'Превышен лимит операций'
});

app.use('/api/', apiLimiter);
app.use('/api/deals/create', strictLimiter);
app.use('/api/gifts/withdraw', strictLimiter);
```

---

### 7. Недостаточная валидация входных данных
**Примеры уязвимостей:**

**7.1. backend/server.js:690**
```javascript
app.get('/api/user/:telegramId/referrals', async (req, res) => {
  const { telegramId } = req.params;
  // telegramId не проверяется - может быть любая строка
```

**7.2. backend/guarantee-api.js:68**
```javascript
const { inviteCode, participantId } = req.body;
// inviteCode не проверяется на формат (должен быть 8 символов hex)
```

**7.3. backend/server.js:1689**
```javascript
const { userId, amount } = req.body;
if (!userId || !amount || amount <= 0) {
  // Проверяется только > 0, но нет максимума
```

**Риск:**
- Некорректная работа приложения
- Потенциальный DoS
- SQL инъекции (частично защищены параметризованными запросами)

**Решение:**
```javascript
// Использовать библиотеку валидации, например joi или express-validator
const { body, param, validationResult } = require('express-validator');

app.get('/api/user/:telegramId/referrals',
  param('telegramId').isInt().toInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // ...
  }
);

app.post('/api/deals/join',
  body('inviteCode').isString().isLength({ min: 8, max: 8 }).matches(/^[A-F0-9]{8}$/),
  body('participantId').isInt(),
  async (req, res) => {
    // ...
  }
);

app.post('/api/stars/create-invoice',
  body('amount').isInt({ min: 1, max: 10000 }),
  body('userId').isInt(),
  async (req, res) => {
    // ...
  }
);
```

---

### 8. CORS настроен слишком широко
**Локация:** `backend/server.js:28-35`
**Код:**
```javascript
cors: {
  origin: [
    'http://localhost:3000',
    'https://alged.vercel.app',
    'https://web.telegram.org'
  ],
  methods: ['GET', 'POST'],
  credentials: true
}
```

**Проблема:**
- `http://localhost:3000` должен быть только в development
- `https://web.telegram.org` слишком широкий домен

**Риск:**
- CSRF атаки
- Утечка данных через credentials
- Несанкционированный доступ в разработке

**Решение:**
```javascript
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ['https://alged.vercel.app']
  : ['http://localhost:3000', 'https://alged.vercel.app'];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});
```

---

### 9. Отсутствие HTTPS enforcement
**Описание:** Сервер принимает HTTP запросы без редиректа на HTTPS.

**Риск:**
- Man-in-the-middle атаки
- Перехват учетных данных
- Перехват session tokens

**Решение:**
```javascript
// Middleware для редиректа HTTP → HTTPS
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect('https://' + req.headers.host + req.url);
  }
  next();
});

// Добавить HSTS header
const helmet = require('helmet');
app.use(helmet.hsts({
  maxAge: 31536000,
  includeSubDomains: true,
  preload: true
}));
```

---

### 10. Логирование чувствительных данных
**Примеры:**

**10.1. backend/server.js:587**
```javascript
console.log('📥 Запрос инициализации:', {
  hasInitData: !!initData,
  referralCode: referralCode || 'none'
});
```

**10.2. Множество console.log с данными пользователей**
```javascript
console.log(`✅ Пользователь инициализирован:`, data);
```

**Риск:**
- Утечка персональных данных через логи
- Утечка токенов и паролей
- GDPR нарушения

**Решение:**
```javascript
// Создать безопасный логгер
const logger = {
  info: (message, data = {}) => {
    // Удаляем чувствительные поля
    const sanitized = { ...data };
    delete sanitized.initData;
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.session;

    console.log(message, sanitized);
  }
};

// Использовать
logger.info('Запрос инициализации:', {
  hasInitData: !!initData,
  referralCode: referralCode || 'none'
  // НЕ логируем сам initData
});
```

---

## 🟡 СРЕДНИЙ ПРИОРИТЕТ

### 11. Потенциальный XSS
**Локация:** `src/components/ReferralList.js:101-104`
**Код:**
```javascript
<div className="referral-name">
  {referral.firstName} {referral.lastName}
</div>
<div className="referral-username">@{referral.username}</div>
```

**Описание:** Хотя React автоматически экранирует вывод, данные приходят с бэкенда без валидации. Если в будущем добавится `dangerouslySetInnerHTML`, возможен XSS.

**Риск:**
- XSS атаки при использовании dangerouslySetInnerHTML
- Инъекция вредоносных скриптов

**Решение:**
```javascript
// На бэкенде валидировать и санитизировать имена
const validator = require('validator');

function sanitizeUserData(userData) {
  return {
    ...userData,
    first_name: validator.escape(userData.first_name || ''),
    last_name: validator.escape(userData.last_name || ''),
    username: validator.escape(userData.username || '')
  };
}
```

---

### 12. Отсутствие CSRF защиты
**Описание:** Нет CSRF токенов для POST/PUT/DELETE запросов.

**Риск:**
- CSRF атаки
- Несанкционированные действия от имени пользователя

**Решение:**
```javascript
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

// Применить ко всем изменяющим запросам
app.post('*', csrfProtection);
app.put('*', csrfProtection);
app.delete('*', csrfProtection);

// Или использовать SameSite cookies
app.use(cookieParser());
app.use(session({
  cookie: {
    sameSite: 'strict',
    secure: true,
    httpOnly: true
  }
}));
```

---

### 13. Динамическое построение SQL запросов
**Локация:** `backend/server.js:795-801`
**Код:**
```javascript
const conditions = [];
const params = [];

if (fromId) {
  conditions.push(`from_id = $${paramIndex}`);
  params.push(fromId);
}

const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
const query = `SELECT * FROM gifts ${whereClause} ...`;
```

**Описание:** Хотя используются параметризованные запросы (что хорошо), динамическое построение WHERE может стать опасным при изменении логики.

**Риск:**
- SQL инъекции при неправильном изменении кода в будущем
- Сложность поддержки и аудита

**Решение:**
```javascript
// Использовать query builder типа knex
const knex = require('knex')({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  }
});

// Безопасный query builder
app.get('/api/gifts', async (req, res) => {
  const { limit = 50, offset = 0, fromId, withdrawn } = req.query;

  let query = knex('gifts').select('*');

  if (fromId) {
    query = query.where('from_id', fromId);
  }

  if (withdrawn === 'true') {
    query = query.where('is_withdrawn', true);
  } else if (withdrawn === 'false') {
    query = query.where('is_withdrawn', false);
  }

  const gifts = await query
    .orderBy('received_at', 'desc')
    .limit(limit)
    .offset(offset);

  res.json({ gifts });
});
```

---

### 14. Отсутствие шифрования session strings
**Локация:** `backend/auth.js:26`
**Код:**
```javascript
console.log('📝 Ваш session string:');
console.log(client.session.save());
```

**Описание:** Telegram session строка выводится в plaintext в консоль и может храниться в переменной окружения без шифрования.

**Риск:**
- Если логи или .env файл скомпрометированы, атакующий получит полный доступ к Telegram аккаунту
- Кража аккаунта Telegram

**Решение:**
```javascript
const crypto = require('crypto');

// Шифрование session
function encryptSession(session, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(session, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Расшифровка
function decryptSession(encrypted, key) {
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedData = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// НЕ выводить в консоль!
console.log('✅ Session сохранен в переменную окружения (зашифрован)');
```

---

### 15. Error disclosure
**Примеры:**
```javascript
res.status(500).json({ error: 'Внутренняя ошибка сервера' });
// vs
res.status(500).json({ error: error.message }); // Плохо!
```

**Описание:** Во многих местах детальные ошибки возвращаются клиенту, раскрывая детали системы.

**Риск:**
- Раскрытие структуры базы данных
- Раскрытие путей к файлам
- Помощь атакующему в понимании системы

**Решение:**
```javascript
// Централизованный обработчик ошибок
app.use((err, req, res, next) => {
  // Логируем полную ошибку на сервере
  console.error('Error:', err);

  // Клиенту возвращаем только generic сообщение
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message; // В dev можно показывать детали

  res.status(statusCode).json({ error: message });
});
```

---

## 🟢 НИЗКИЙ ПРИОРИТЕТ

### 16. Отсутствие проверки размера payload
**Описание:** Нет ограничения на размер JSON body.

**Риск:**
- Memory exhaustion атаки
- DoS через большие payload

**Решение:**
```javascript
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));
```

---

### 17. Отсутствие аудит логирования
**Описание:** Нет специальных логов для критичных действий безопасности.

**Решение:**
```javascript
// Создать audit log для критичных действий
async function auditLog(action, userId, details) {
  await pool.query(
    `INSERT INTO audit_logs (action, user_id, details, ip_address, created_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
    [action, userId, JSON.stringify(details), req.ip]
  );
}

// Использовать
await auditLog('GIFT_WITHDRAWN', userId, { giftId, toId });
await auditLog('DEAL_CONFIRMED', userId, { dealId });
```

---

### 18. Небезопасное использование parseInt
**Примеры:**
```javascript
const limit = parseInt(req.query.limit); // Может быть NaN
```

**Решение:**
```javascript
const limit = parseInt(req.query.limit) || 50;
if (isNaN(limit) || limit < 1 || limit > 100) {
  return res.status(400).json({ error: 'Invalid limit' });
}
```

---

### 19. Отсутствие проверки типов файлов
**Локация:** `backend/gift-service.js`

**Описание:** При загрузке файлов из Telegram нет строгой проверки MIME types.

**Решение:**
```javascript
const ALLOWED_MIME_TYPES = [
  'application/x-tgsticker',
  'image/webp',
  'video/webm'
];

if (!ALLOWED_MIME_TYPES.includes(doc.mimeType)) {
  throw new Error('Invalid file type');
}
```

---

## 📊 СТАТИСТИКА

| Приоритет | Количество | Статус |
|-----------|------------|--------|
| 🔴 Критические | 5 | Требуют немедленного исправления |
| 🟠 Высокий | 5 | Исправить в течение недели |
| 🟡 Средний | 5 | Исправить в течение месяца |
| 🟢 Низкий | 4 | Исправить при возможности |
| **ВСЕГО** | **19** | |

**Общий уровень риска:** 🔴 **КРИТИЧЕСКИЙ**

---

## ✅ ЧТО СДЕЛАНО ХОРОШО

1. ✅ Использование параметризованных SQL запросов - хорошая защита от SQL Injection
2. ✅ React автоматически защищает от XSS при обычном рендеринге
3. ✅ Использование HTTPS в production (судя по API_URL)
4. ✅ Использование PostgreSQL транзакций для атомарности операций
5. ✅ Индексы в базе данных для производительности
6. ✅ WebSocket для real-time коммуникации
7. ✅ Использование environment variables для конфигурации

---

## 🎯 ПЛАН ДЕЙСТВИЙ

### Немедленно (в течение 24 часов):
1. ❗ Удалить захардкоженный пароль БД из server.js:44
2. ❗ Добавить валидацию Telegram WebApp HMAC подписи
3. ❗ Добавить middleware аутентификации на все API endpoints
4. ❗ Добавить аутентификацию для WebSocket соединений
5. ❗ Исправить проверку владельца подарков

### Высокий приоритет (в течение недели):
6. Установить rate limiting на все endpoints
7. Добавить валидацию всех входных данных
8. Ужесточить CORS политику
9. Добавить HTTPS enforcement и HSTS headers
10. Убрать логирование чувствительных данных

### Средний приоритет (в течение месяца):
11. Добавить санитизацию пользовательских данных
12. Внедрить CSRF защиту
13. Рефакторинг SQL запросов на query builder
14. Шифровать Telegram session strings
15. Централизованная обработка ошибок

### Низкий приоритет (при возможности):
16. Ограничить размер payload
17. Добавить audit logging
18. Улучшить обработку parseInt/parseFloat
19. Добавить проверку MIME types

---

## 🔧 РЕКОМЕНДУЕМЫЕ ИНСТРУМЕНТЫ

1. **Аутентификация:** passport.js, jsonwebtoken
2. **Валидация:** joi, express-validator
3. **Rate Limiting:** express-rate-limit
4. **Безопасность:** helmet.js
5. **CSRF:** csurf
6. **Query Builder:** knex.js
7. **Логирование:** winston, morgan
8. **Мониторинг:** Sentry для отслеживания ошибок

---

## 📝 ЗАКЛЮЧЕНИЕ

Приложение имеет **критические уязвимости безопасности**, которые требуют немедленного внимания. Основная проблема - **полное отсутствие аутентификации и авторизации**, что позволяет любому атакующему получить полный контроль над системой.

**Рекомендуется приостановить использование в production** до исправления критических уязвимостей (№1-5).

После исправления всех критических и высокоприоритетных уязвимостей, провести повторный аудит безопасности и penetration testing.

---

**Аудит провел:** Claude Code Security Audit
**Дата:** 2025-12-01
**Версия отчета:** 1.0
