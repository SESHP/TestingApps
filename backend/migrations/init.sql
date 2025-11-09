-- backend/migrations/init.sql
-- Инициализация базы данных TON Guarantee

-- Удаляем таблицы если существуют (для чистой установки)
DROP TABLE IF EXISTS referrals CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Создание таблицы пользователей
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    referral_code VARCHAR(8) UNIQUE NOT NULL,
    referred_by BIGINT,
    balance DECIMAL(18, 8) DEFAULT 0,
    total_deals INTEGER DEFAULT 0,
    rating DECIMAL(3, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_referred_by FOREIGN KEY (referred_by) 
        REFERENCES users(telegram_id) ON DELETE SET NULL
);

-- Индексы для users
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_referral_code ON users(referral_code);
CREATE INDEX idx_users_referred_by ON users(referred_by);

-- Создание таблицы рефералов
CREATE TABLE referrals (
    id SERIAL PRIMARY KEY,
    referrer_id BIGINT NOT NULL,
    referred_id BIGINT NOT NULL,
    earned_amount DECIMAL(18, 8) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_referrer FOREIGN KEY (referrer_id) 
        REFERENCES users(telegram_id) ON DELETE CASCADE,
    CONSTRAINT fk_referred FOREIGN KEY (referred_id) 
        REFERENCES users(telegram_id) ON DELETE CASCADE,
    CONSTRAINT unique_referral UNIQUE(referrer_id, referred_id),
    CONSTRAINT no_self_referral CHECK (referrer_id != referred_id)
);

-- Индексы для referrals
CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_referred ON referrals(referred_id);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для обновления updated_at в таблице users
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Комментарии к таблицам
COMMENT ON TABLE users IS 'Таблица пользователей TON Guarantee';
COMMENT ON TABLE referrals IS 'Таблица реферальных связей';

-- Комментарии к полям users
COMMENT ON COLUMN users.telegram_id IS 'ID пользователя из Telegram';
COMMENT ON COLUMN users.referral_code IS 'Уникальный реферальный код пользователя';
COMMENT ON COLUMN users.referred_by IS 'ID реферера (кто пригласил)';
COMMENT ON COLUMN users.balance IS 'Баланс пользователя в TON';
COMMENT ON COLUMN users.total_deals IS 'Общее количество сделок';
COMMENT ON COLUMN users.rating IS 'Рейтинг пользователя от 0 до 5';

-- Комментарии к полям referrals
COMMENT ON COLUMN referrals.referrer_id IS 'ID пользователя который пригласил';
COMMENT ON COLUMN referrals.referred_id IS 'ID приглашенного пользователя';
COMMENT ON COLUMN referrals.earned_amount IS 'Сумма заработанная с этого реферала';

-- Тестовые данные (опционально, для разработки)
-- Раскомментируйте если нужны тестовые данные

-- INSERT INTO users (telegram_id, username, first_name, last_name, referral_code, balance, total_deals, rating)
-- VALUES 
--     (111111111, 'user1', 'Test', 'User1', 'ABC12345', 100.5, 10, 4.8),
--     (222222222, 'user2', 'Test', 'User2', 'DEF67890', 50.25, 5, 4.5),
--     (333333333, 'user3', 'Test', 'User3', 'GHI11111', 25.10, 3, 4.2);

-- UPDATE users SET referred_by = 111111111 WHERE telegram_id = 222222222;
-- UPDATE users SET referred_by = 111111111 WHERE telegram_id = 333333333;

-- INSERT INTO referrals (referrer_id, referred_id, earned_amount)
-- VALUES 
--     (111111111, 222222222, 2.5),
--     (111111111, 333333333, 1.25);

-- Вывод информации об успешном создании
SELECT 'База данных успешно инициализирована!' as message;