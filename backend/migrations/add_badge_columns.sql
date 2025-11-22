-- backend/migrations/add_badge_columns.sql
-- Миграция: Добавление системы плашек и комиссий

-- Добавляем новые колонки в таблицу users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS badge_status VARCHAR(20) DEFAULT 'GUEST',
ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 2) DEFAULT 4.00,
ADD COLUMN IF NOT EXISTS stars_balance DECIMAL(18, 2) DEFAULT 0;

-- Добавляем дополнительные поля для расчета плашек
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_whale BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS telegram_audience INTEGER DEFAULT 0;

-- Создаем CHECK constraint для валидации badge_status
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_badge_status'
    ) THEN
        ALTER TABLE users 
        ADD CONSTRAINT check_badge_status 
        CHECK (badge_status IN ('DADDY', 'INFL', 'RESIDENT', 'JOKER', 'GUEST', 'SCAM'));
    END IF;
END $$;

-- Создаем CHECK constraint для валидации commission_rate
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_commission_rate'
    ) THEN
        ALTER TABLE users 
        ADD CONSTRAINT check_commission_rate 
        CHECK (commission_rate >= 0 AND commission_rate <= 100);
    END IF;
END $$;

-- Создаем индекс для badge_status (для быстрого поиска по статусу)
CREATE INDEX IF NOT EXISTS idx_users_badge_status ON users(badge_status);

-- Создаем функцию для автоматического расчета плашки
CREATE OR REPLACE FUNCTION calculate_user_badge(
    p_total_deals INTEGER,
    p_rating DECIMAL,
    p_is_whale BOOLEAN,
    p_telegram_audience INTEGER
) RETURNS TABLE(badge VARCHAR(20), commission DECIMAL(5, 2)) AS $$
BEGIN
    -- DADDY - киты, инвесторы или большая аудитория
    IF p_is_whale OR p_telegram_audience > 500000 THEN
        RETURN QUERY SELECT 'DADDY'::VARCHAR, 0.1::DECIMAL;
        RETURN;
    END IF;

    -- INFL - влиятельные пользователи
    IF p_telegram_audience > 70000 THEN
        RETURN QUERY SELECT 'INFL'::VARCHAR, 0.5::DECIMAL;
        RETURN;
    END IF;

    -- SCAM - низкий рейтинг
    IF p_total_deals > 5 AND p_rating < 1 THEN
        RETURN QUERY SELECT 'SCAM'::VARCHAR, 20.0::DECIMAL;
        RETURN;
    END IF;

    -- RESIDENT - активные резиденты
    IF p_total_deals > 70 AND p_rating > 4.5 THEN
        RETURN QUERY SELECT 'RESIDENT'::VARCHAR, 1.0::DECIMAL;
        RETURN;
    END IF;

    -- JOKER - опытные трейдеры
    IF p_total_deals > 30 AND p_rating > 4 THEN
        RETURN QUERY SELECT 'JOKER'::VARCHAR, 2.0::DECIMAL;
        RETURN;
    END IF;

    -- GUEST - базовый статус
    IF p_rating >= 3.5 THEN
        RETURN QUERY SELECT 'GUEST'::VARCHAR, 4.0::DECIMAL;
        RETURN;
    END IF;

    -- По умолчанию GUEST
    RETURN QUERY SELECT 'GUEST'::VARCHAR, 4.0::DECIMAL;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер для автоматического обновления плашки при изменении данных
CREATE OR REPLACE FUNCTION update_user_badge()
RETURNS TRIGGER AS $$
DECLARE
    badge_result RECORD;
BEGIN
    -- Вычисляем плашку
    SELECT * INTO badge_result 
    FROM calculate_user_badge(
        NEW.total_deals,
        NEW.rating,
        NEW.is_whale,
        NEW.telegram_audience
    );

    -- Обновляем поля
    NEW.badge_status := badge_result.badge;
    NEW.commission_rate := badge_result.commission;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер (если не существует)
DROP TRIGGER IF EXISTS trigger_update_user_badge ON users;
CREATE TRIGGER trigger_update_user_badge
    BEFORE INSERT OR UPDATE OF total_deals, rating, is_whale, telegram_audience
    ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_user_badge();

-- Обновляем существующих пользователей - вычисляем их плашки
UPDATE users
SET 
    badge_status = badge_calc.badge,
    commission_rate = badge_calc.commission
FROM (
    SELECT 
        telegram_id,
        (calculate_user_badge(total_deals, rating, is_whale, telegram_audience)).badge,
        (calculate_user_badge(total_deals, rating, is_whale, telegram_audience)).commission
    FROM users
) AS badge_calc
WHERE users.telegram_id = badge_calc.telegram_id;

-- Комментарии к новым полям
COMMENT ON COLUMN users.badge_status IS 'Статус пользователя: DADDY, INFL, RESIDENT, JOKER, GUEST, SCAM';
COMMENT ON COLUMN users.commission_rate IS 'Процент комиссии пользователя (0.1-20%)';
COMMENT ON COLUMN users.stars_balance IS 'Баланс пользователя в Telegram Stars';
COMMENT ON COLUMN users.is_whale IS 'Является ли пользователь китом/инвестором';
COMMENT ON COLUMN users.telegram_audience IS 'Размер аудитории в Telegram';

-- Вывод информации об успешной миграции
SELECT 
    'Миграция успешно выполнена!' as message,
    COUNT(*) as total_users,
    COUNT(CASE WHEN badge_status = 'DADDY' THEN 1 END) as daddy_count,
    COUNT(CASE WHEN badge_status = 'INFL' THEN 1 END) as infl_count,
    COUNT(CASE WHEN badge_status = 'RESIDENT' THEN 1 END) as resident_count,
    COUNT(CASE WHEN badge_status = 'JOKER' THEN 1 END) as joker_count,
    COUNT(CASE WHEN badge_status = 'GUEST' THEN 1 END) as guest_count,
    COUNT(CASE WHEN badge_status = 'SCAM' THEN 1 END) as scam_count
FROM users;
