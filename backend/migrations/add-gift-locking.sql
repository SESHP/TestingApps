-- Migration: Add gift locking mechanism to prevent double-spending in deals
-- Date: 2025-12-01
-- Description: Adds locked_in_deal_id column to track which deal a gift is locked in

-- Add column for locking gifts to specific deals
ALTER TABLE gifts
ADD COLUMN IF NOT EXISTS locked_in_deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL;

-- Create index for faster lookups of locked gifts
CREATE INDEX IF NOT EXISTS idx_gifts_locked_deal
ON gifts(locked_in_deal_id)
WHERE locked_in_deal_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN gifts.locked_in_deal_id IS
'ID of the deal this gift is currently locked in. NULL if gift is not in any active deal.';

-- Verify the migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'gifts'
    AND column_name = 'locked_in_deal_id'
  ) THEN
    RAISE NOTICE 'Migration completed successfully: locked_in_deal_id column added';
  ELSE
    RAISE EXCEPTION 'Migration failed: locked_in_deal_id column not found';
  END IF;
END $$;
