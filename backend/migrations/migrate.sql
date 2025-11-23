-- Добавляем новые колонки
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS badge_status VARCHAR(20) DEFAULT 'GUEST',
ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 2) DEFAULT 4.00,
ADD COLUMN IF NOT EXISTS stars_balance DECIMAL(18, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_whale BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS telegram_audience INTEGER DEFAULT 0;

-- Создаем CHECK constraint для badge_status
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

-- Создаем CHECK constraint для commission_rate
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

-- Создаем индекс
CREATE INDEX IF NOT EXISTS idx_users_badge_status ON users(badge_status);

-- Создаем функцию расчета плашки
CREATE OR REPLACE FUNCTION calculate_user_badge(
    p_total_deals INTEGER,
    p_rating DECIMAL,
    p_is_whale BOOLEAN,
    p_telegram_audience INTEGER
) RETURNS TABLE(badge VARCHAR(20), commission DECIMAL(5, 2)) AS $$
BEGIN
    IF p_is_whale OR p_telegram_audience > 500000 THEN
        RETURN QUERY SELECT 'DADDY'::VARCHAR, 0.1::DECIMAL;
        RETURN;
    END IF;
    IF p_telegram_audience > 70000 THEN
        RETURN QUERY SELECT 'INFL'::VARCHAR, 0.5::DECIMAL;
        RETURN;
    END IF;
    IF p_total_deals > 5 AND p_rating < 1 THEN
        RETURN QUERY SELECT 'SCAM'::VARCHAR, 20.0::DECIMAL;
        RETURN;
    END IF;
    IF p_total_deals > 70 AND p_rating > 4.5 THEN
        RETURN QUERY SELECT 'RESIDENT'::VARCHAR, 1.0::DECIMAL;
        RETURN;
    END IF;
    IF p_total_deals > 30 AND p_rating > 4 THEN
        RETURN QUERY SELECT 'JOKER'::VARCHAR, 2.0::DECIMAL;
        RETURN;
    END IF;
    IF p_rating >= 3.5 THEN
        RETURN QUERY SELECT 'GUEST'::VARCHAR, 4.0::DECIMAL;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'GUEST'::VARCHAR, 4.0::DECIMAL;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер
CREATE OR REPLACE FUNCTION update_user_badge()
RETURNS TRIGGER AS $$
DECLARE
    badge_result RECORD;
BEGIN
    SELECT * INTO badge_result 
    FROM calculate_user_badge(
        NEW.total_deals,
        NEW.rating,
        NEW.is_whale,
        NEW.telegram_audience
    );
    NEW.badge_status := badge_result.badge;
    NEW.commission_rate := badge_result.commission;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_badge ON users;
CREATE TRIGGER trigger_update_user_badge
    BEFORE INSERT OR UPDATE OF total_deals, rating, is_whale, telegram_audience
    ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_user_badge();

-- Обновляем существующих пользователей
UPDATE users
SET 
    badge_status = badge_calc.badge,
    commission_rate = badge_calc.commission
FROM (
    SELECT 
        telegram_id,
        (calculate_user_badge(
            COALESCE(total_deals, 0), 
            COALESCE(rating, 0), 
            COALESCE(is_whale, false), 
            COALESCE(telegram_audience, 0)
        )).badge,
        (calculate_user_badge(
            COALESCE(total_deals, 0), 
            COALESCE(rating, 0), 
            COALESCE(is_whale, false), 
            COALESCE(telegram_audience, 0)
        )).commission
    FROM users
) AS badge_calc
WHERE users.telegram_id = badge_calc.telegram_id;

-- Показываем результат
SELECT 
    '✅ Готово!' as message,
    COUNT(*) as total_users,
    COUNT(CASE WHEN badge_status = 'GUEST' THEN 1 END) as guest_count
FROM users;