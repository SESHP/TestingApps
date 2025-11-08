# 🚀 Деплой TON Guarantee на Production

## Варианты хостинга

### 1. Backend - Railway, Render или DigitalOcean
### 2. Frontend - Vercel или Netlify
### 3. База данных - Supabase, Railway PostgreSQL или Neon

---

## Вариант 1: Railway (Рекомендуется - самое простое)

### Backend + База данных

1. **Зарегистрируйтесь на Railway**
   - https://railway.app
   - Подключите GitHub аккаунт

2. **Создайте новый проект**
   ```
   New Project → Deploy from GitHub repo
   ```

3. **Добавьте PostgreSQL**
   ```
   Add Service → Database → PostgreSQL
   ```

4. **Настройте Backend**
   - В настройках сервиса добавьте переменные окружения:
   ```
   PORT=3001
   DB_USER=${{Postgres.PGUSER}}
   DB_HOST=${{Postgres.PGHOST}}
   DB_NAME=${{Postgres.PGDATABASE}}
   DB_PASSWORD=${{Postgres.PGPASSWORD}}
   DB_PORT=${{Postgres.PGPORT}}
   ```

5. **Деплой**
   - Railway автоматически задеплоит при push в GitHub
   - Скопируйте URL вашего backend (например: `https://your-app.railway.app`)

### Frontend на Vercel

1. **Зарегистрируйтесь на Vercel**
   - https://vercel.com
   - Подключите GitHub

2. **Импортируйте проект**
   ```
   New Project → Import Git Repository
   ```

3. **Настройте Environment Variables**
   ```
   REACT_APP_API_URL=https://your-backend.railway.app
   REACT_APP_BOT_USERNAME=your_bot_name
   ```

4. **Деплой**
   - Vercel автоматически задеплоит
   - Ваш фронтенд будет доступен по адресу `https://your-app.vercel.app`

---

## Вариант 2: DigitalOcean + Vercel

### Backend на DigitalOcean App Platform

1. **Создайте Droplet или используйте App Platform**
   - Выберите Ubuntu 22.04
   - Минимум 1GB RAM

2. **Подключитесь по SSH**
   ```bash
   ssh root@your_server_ip
   ```

3. **Установите Node.js и PostgreSQL**
   ```bash
   # Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   
   # PostgreSQL
   sudo apt install postgresql postgresql-contrib
   sudo systemctl start postgresql
   ```

4. **Создайте базу данных**
   ```bash
   sudo -u postgres psql
   CREATE DATABASE ton_guarantee;
   CREATE USER ton_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE ton_guarantee TO ton_user;
   \q
   ```

5. **Клонируйте репозиторий**
   ```bash
   cd /var/www
   git clone https://github.com/your-username/ton-guarantee.git
   cd ton-guarantee/backend
   npm install
   ```

6. **Создайте .env**
   ```bash
   nano .env
   ```
   
   Содержимое:
   ```
   PORT=3001
   DB_USER=ton_user
   DB_HOST=localhost
   DB_NAME=ton_guarantee
   DB_PASSWORD=secure_password
   DB_PORT=5432
   ```

7. **Запустите миграции**
   ```bash
   npm run migrate
   ```

8. **Настройте PM2 для автозапуска**
   ```bash
   npm install -g pm2
   pm2 start server.js --name ton-backend
   pm2 startup
   pm2 save
   ```

9. **Настройте Nginx**
   ```bash
   sudo apt install nginx
   sudo nano /etc/nginx/sites-available/ton-guarantee
   ```
   
   Содержимое:
   ```nginx
   server {
       listen 80;
       server_name api.yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   
   ```bash
   sudo ln -s /etc/nginx/sites-available/ton-guarantee /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

10. **Настройте SSL (Let's Encrypt)**
    ```bash
    sudo apt install certbot python3-certbot-nginx
    sudo certbot --nginx -d api.yourdomain.com
    ```

---

## Вариант 3: Docker Compose (Для любого VPS)

### Создайте docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ton_guarantee
      POSTGRES_USER: ton_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - ton-network

  backend:
    build: ./backend
    environment:
      PORT: 3001
      DB_USER: ton_user
      DB_HOST: postgres
      DB_NAME: ton_guarantee
      DB_PASSWORD: ${DB_PASSWORD}
      DB_PORT: 5432
    ports:
      - "3001:3001"
    depends_on:
      - postgres
    networks:
      - ton-network
    restart: unless-stopped

  frontend:
    build: .
    environment:
      REACT_APP_API_URL: http://localhost:3001
      REACT_APP_BOT_USERNAME: ${BOT_USERNAME}
    ports:
      - "3000:80"
    depends_on:
      - backend
    networks:
      - ton-network
    restart: unless-stopped

volumes:
  postgres_data:

networks:
  ton-network:
    driver: bridge
```

### Запуск

```bash
# Создайте .env файл с паролями
echo "DB_PASSWORD=your_secure_password" > .env
echo "BOT_USERNAME=your_bot" >> .env

# Запустите
docker-compose up -d

# Запустите миграции
docker-compose exec backend npm run migrate
```

---

## Настройка Telegram Bot

1. **Создайте бота через @BotFather**
   ```
   /newbot
   Имя: TON Guarantee
   Username: your_bot_name_bot
   ```

2. **Получите токен бота**

3. **Настройте Web App**
   ```
   /setmenubutton
   Выберите вашего бота
   URL: https://your-app.vercel.app
   ```

4. **Настройте команды**
   ```
   /setcommands
   start - Запустить приложение
   profile - Мой профиль
   referral - Реферальная ссылка
   ```

---

## Проверка после деплоя

1. **Backend Health Check**
   ```bash
   curl https://your-backend.railway.app/health
   ```

2. **Тест API**
   ```bash
   curl -X POST https://your-backend.railway.app/api/user/init \
     -H "Content-Type: application/json" \
     -d '{"initData":"dev"}'
   ```

3. **Frontend**
   - Откройте https://your-app.vercel.app
   - Проверьте работу реферальных ссылок

---

## Мониторинг

### Логи на Railway
```
View Logs → Backend Service
```

### Логи на DigitalOcean
```bash
pm2 logs ton-backend
journalctl -u nginx -f
```

### Мониторинг базы данных
```bash
# Railway
Railway Dashboard → PostgreSQL → Metrics

# DigitalOcean
sudo -u postgres psql
SELECT * FROM pg_stat_activity;
```

---

## Backup базы данных

```bash
# Создание backup
pg_dump -U ton_user -h localhost ton_guarantee > backup_$(date +%Y%m%d).sql

# Восстановление
psql -U ton_user -h localhost ton_guarantee < backup_20250108.sql
```

---

## Автоматизация деплоя через GitHub Actions

Создайте `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Deploy Backend to Railway
      run: railway up
      env:
        RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
    
    - name: Deploy Frontend to Vercel
      run: vercel --prod
      env:
        VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

---

## 🎉 Готово!

Ваше приложение теперь доступно на production!

- Frontend: `https://your-app.vercel.app`
- Backend: `https://your-backend.railway.app`
- Bot: `@your_bot_name_bot`