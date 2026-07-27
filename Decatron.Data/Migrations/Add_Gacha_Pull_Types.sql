-- Migration: Gacha Pull Types + Coin Transfer + Milestones + Display Name
-- Date: 2026-04-06
-- Description: Adds pull type differentiation (donation vs coins), cumulative milestones,
--              and display name editing for gacha participants.

BEGIN;

-- =============================================================================
-- 1. gacha_participants — new fields
-- =============================================================================
ALTER TABLE gacha_participants
    ADD COLUMN IF NOT EXISTS coin_pulls_available integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS coins_spent_total integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cumulative_donation_progress numeric(18,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cumulative_coins_progress integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS display_name varchar(100) DEFAULT NULL;

-- =============================================================================
-- 2. gacha_rarity_configs — coin probability
-- =============================================================================
ALTER TABLE gacha_rarity_configs
    ADD COLUMN IF NOT EXISTS coin_probability numeric(5,2) DEFAULT NULL;

-- =============================================================================
-- 3. gacha_item_restrictions — pull type restrictions + milestones
-- =============================================================================
ALTER TABLE gacha_item_restrictions
    ADD COLUMN IF NOT EXISTS allowed_pull_types varchar(20) NOT NULL DEFAULT 'all',
    ADD COLUMN IF NOT EXISTS coin_min_spent integer DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS cumulative_donation_threshold numeric(18,2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS cumulative_coins_threshold integer DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS cumulative_guarantee boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS cumulative_probability numeric(5,2) DEFAULT NULL;

-- Constraint: allowed_pull_types must be one of the valid values
ALTER TABLE gacha_item_restrictions
    ADD CONSTRAINT chk_allowed_pull_types
    CHECK (allowed_pull_types IN ('all', 'donation_only', 'coins_only'));

-- =============================================================================
-- 4. gacha_preferences — coin probability override
-- =============================================================================
ALTER TABLE gacha_preferences
    ADD COLUMN IF NOT EXISTS coin_probability_override numeric(5,2) DEFAULT NULL;

-- =============================================================================
-- 5. gacha_rarity_restrictions — coin-specific intervals
-- =============================================================================
ALTER TABLE gacha_rarity_restrictions
    ADD COLUMN IF NOT EXISTS coin_pull_interval integer DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS coin_time_interval integer DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS coin_time_unit varchar(10) DEFAULT NULL;

-- =============================================================================
-- 6. gacha_pull_logs — pull type tracking
-- =============================================================================
ALTER TABLE gacha_pull_logs
    ADD COLUMN IF NOT EXISTS pull_type varchar(10) NOT NULL DEFAULT 'donation';

-- Constraint: pull_type must be donation or coins
ALTER TABLE gacha_pull_logs
    ADD CONSTRAINT chk_pull_type
    CHECK (pull_type IN ('donation', 'coins'));

COMMIT;
