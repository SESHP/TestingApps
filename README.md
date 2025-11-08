# TON Guarantee - Реферальная система

## 🚀 Установка и запуск

### Требования
- Node.js 16+ 
- PostgreSQL 13+
- npm или yarn

### 1. Настройка PostgreSQL

```bash
# Создайте базу данных
createdb ton_guarantee

# Или через psql
psql -U postgres
CREATE DATABASE ton_guarantee;
\q
```

### 2. Настройка Backend

```bash
# Перейдите в папку backend
cd backend

# Установите зависимости
npm install

# Скопируйте .env.example в .env
cp .env.example .env

# Отредактируйте .env и добавьте свои данные
nano .env
```

Пример `.env`:
```env
PORT=3001
DB_USER=postgres
DB_HOST=localhost
DB_NAME=ton_guarantee
DB_PASSWORD=your_password
DB_PORT=5432
```

```bash
# Запустите сервер
npm start

# Для разработки (с автоперезагрузкой)
npm run dev
```

Backend будет доступен на `http://localhost:3001`

### 3. Настройка Frontend

```bash
# Вернитесь в корневую папку
cd ..

# Установите зависимости (если еще не установлены)
npm install

# Скопируйте .env.example в .env
cp .env.example .env

# Отредактируйте .env
nano .env
```

Пример `.env`:
```env
REACT_APP_API_URL=http://localhost:3001
REACT_APP_BOT_USERNAME=your_bot_username
```

```bash
# Запустите React приложение
npm start
```

Frontend будет доступен на `http://localhost:3000`

## 📋 Структура проекта

```
ton-guarantee/
├── backend/
│   ├── server.js           # Основной файл сервера
│   ├── package.json        # Зависимости backend
│   └── .env               # Конфигурация (не в git)
├── src/
│   ├── pages/
│   │   ├── Profile.js     # Страница профиля с рефералами
│   │   └── Profile.css
│   ├── utils/
│   │   ├── api.js         # API клиент
│   │   └── telegramUtils.js
│   └── App.js
├── .env                   # Конфигурация frontend (не в git)
└── package.json
```

## 🔑 API Endpoints

### POST /api/user/init
Инициализация пользователя и получение реферального кода

**Body:**
```json
{
  "initData": "telegram_init_data_string",
  "referralCode": "ABC123" // опционально
}
```

**Response:**
```json
{
  "user": {
    "id": 123456789,
    "username": "testuser",
    "firstName": "Test",
    "lastName": "User",
    "referralCode": "XYZ789",
    "balance": 10.5,
    "totalDeals": 5,
    "rating": 4.8
  },
  "referralStats": {
    "totalReferrals": 3,
    "totalEarned": 1.5
  }
}
```

### GET /api/user/:telegramId/referrals
Получение статистики рефералов

**Response:**
```json
{
  "stats": {
    "totalReferrals": 3,
    "totalEarned": 1.5
  },
  "referrals": [
    {
      "telegramId": 987654321,
      "username": "friend1",
      "firstName": "Friend",
      "lastName": "One",
      "earnedAmount": 0.5,
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### GET /api/referral/check/:code
Проверка валидности реферального кода

**Response:**
```json
{
  "valid": true,
  "referrer": {
    "id": 123456789,
    "firstName": "Test",
    "lastName": "User",
    "username": "testuser"
  }
}
```

## 🗄️ Структура базы данных

### Таблица `users`
- `id` - Serial Primary Key
- `telegram_id` - BigInt (уникальный)
- `username` - Varchar(255)
- `first_name` - Varchar(255)
- `last_name` - Varchar(255)
- `referral_code` - Varchar(8) (уникальный)
- `referred_by` - BigInt (Foreign Key)
- `balance` - Decimal(18, 8)
- `total_deals` - Integer
- `rating` - Decimal(3, 2)
- `created_at` - Timestamp
- `updated_at` - Timestamp

### Таблица `referrals`
- `id` - Serial Primary Key
- `referrer_id` - BigInt (Foreign Key)
- `referred_id` - BigInt (Foreign Key)
- `earned_amount` - Decimal(18, 8)
- `created_at` - Timestamp

## 🎯 Как работает реферальная система

1. Каждый пользователь получает уникальный 8-символьный реферальный код при регистрации
2. Реферальная ссылка имеет формат: `https://t.me/your_bot?start=REFERRAL_CODE`
3. Когда новый пользователь переходит по ссылке, код сохраняется в URL параметре `ref`
4. При инициализации пользователя код передается на backend
5. Создается связь между реферером и рефералом в таблице `referrals`
6. При каждой сделке реферала, 5% комиссии идет рефереру

## 🔧 Дальнейшая разработка

- [ ] Добавить валидацию Telegram initData с использованием bot token
- [ ] Добавить механизм начисления реферальных вознаграждений
- [ ] Добавить историю реферальных начислений
- [ ] Добавить multi-level реферальную систему (2-3 уровня)
- [ ] Добавить админ панель для управления рефералами
- [ ] Добавить аналитику и статистику

## 📝 Лицензия

MIT