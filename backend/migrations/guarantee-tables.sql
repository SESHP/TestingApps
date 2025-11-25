-- migrations/guarantee-tables.sql
-- Таблицы для гарант-сервиса

-- Таблица сделок
CREATE TABLE IF NOT EXISTS deals (
  id SERIAL PRIMARY KEY,
  creator_id VARCHAR(255) NOT NULL,
  participant_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'waiting', -- 'waiting', 'active', 'completed', 'cancelled'
  creator_confirmed BOOLEAN DEFAULT FALSE,
  participant_confirmed BOOLEAN DEFAULT FALSE,
  cancelled_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  invite_code VARCHAR(8) UNIQUE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deals_creator ON deals(creator_id);
CREATE INDEX IF NOT EXISTS idx_deals_participant ON deals(participant_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_invite_code ON deals(invite_code);

-- Таблица подарков в сделках
CREATE TABLE IF NOT EXISTS deal_gifts (
  id SERIAL PRIMARY KEY,
  deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  gift_id INTEGER NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(deal_id, gift_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_gifts_deal ON deal_gifts(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_gifts_user ON deal_gifts(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_gifts_gift ON deal_gifts(gift_id);