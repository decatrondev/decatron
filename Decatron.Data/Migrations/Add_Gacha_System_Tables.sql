-- ============================================================
-- GACHA SYSTEM - Migration Script
-- Creates all tables for the gacha/lootbox system
-- ============================================================

-- 1. Items (cards/prizes configured by streamers)
CREATE TABLE IF NOT EXISTS gacha_items (
    id SERIAL PRIMARY KEY,
    channel_name VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    rarity VARCHAR(50) NOT NULL DEFAULT 'common',
    image VARCHAR(500),
    available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gacha_items_channel ON gacha_items(channel_name);
CREATE INDEX IF NOT EXISTS idx_gacha_items_channel_rarity ON gacha_items(channel_name, rarity);

-- 2. Participants (viewers who donate and pull)
CREATE TABLE IF NOT EXISTS gacha_participants (
    id SERIAL PRIMARY KEY,
    channel_name VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    twitch_user_id VARCHAR(50),
    donation_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    effective_donation DECIMAL(10,2) NOT NULL DEFAULT 0,
    pulls INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_gacha_participant_channel_name UNIQUE (channel_name, name)
);

CREATE INDEX IF NOT EXISTS idx_gacha_participants_channel ON gacha_participants(channel_name);

-- 3. Inventory (items won by participants)
CREATE TABLE IF NOT EXISTS gacha_inventory (
    id SERIAL PRIMARY KEY,
    channel_name VARCHAR(100) NOT NULL,
    participant_id INTEGER NOT NULL REFERENCES gacha_participants(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES gacha_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    is_redeemed BOOLEAN NOT NULL DEFAULT FALSE,
    last_won_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gacha_inventory_channel ON gacha_inventory(channel_name);
CREATE INDEX IF NOT EXISTS idx_gacha_inventory_participant ON gacha_inventory(participant_id);
CREATE INDEX IF NOT EXISTS idx_gacha_inventory_item ON gacha_inventory(item_id);

-- 4. Rarity probability configuration per channel
CREATE TABLE IF NOT EXISTS gacha_rarity_configs (
    id SERIAL PRIMARY KEY,
    channel_name VARCHAR(100) NOT NULL,
    rarity VARCHAR(50) NOT NULL,
    probability DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_gacha_rarity_channel UNIQUE (channel_name, rarity)
);

-- 5. Item restrictions (min donation, quantity limits, cooldowns, unique)
CREATE TABLE IF NOT EXISTS gacha_item_restrictions (
    id SERIAL PRIMARY KEY,
    channel_name VARCHAR(100) NOT NULL,
    item_id INTEGER NOT NULL REFERENCES gacha_items(id) ON DELETE CASCADE,
    min_donation_required DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_quantity INTEGER,
    is_unique BOOLEAN NOT NULL DEFAULT FALSE,
    cooldown_period VARCHAR(50) NOT NULL DEFAULT 'none',
    cooldown_value INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_gacha_restriction_channel_item UNIQUE (channel_name, item_id)
);

-- 6. Preferences (probability overrides per item, global or per participant)
CREATE TABLE IF NOT EXISTS gacha_preferences (
    id SERIAL PRIMARY KEY,
    channel_name VARCHAR(100) NOT NULL,
    item_id INTEGER NOT NULL REFERENCES gacha_items(id) ON DELETE CASCADE,
    participant_id INTEGER REFERENCES gacha_participants(id) ON DELETE CASCADE,
    probability_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_gacha_preference_channel_item_participant UNIQUE (channel_name, item_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_gacha_preferences_channel ON gacha_preferences(channel_name);

-- 7. Rarity restrictions (pull intervals, time intervals between same rarity)
CREATE TABLE IF NOT EXISTS gacha_rarity_restrictions (
    id SERIAL PRIMARY KEY,
    channel_name VARCHAR(100) NOT NULL,
    item_id INTEGER REFERENCES gacha_items(id) ON DELETE CASCADE,
    participant_id INTEGER REFERENCES gacha_participants(id) ON DELETE CASCADE,
    rarity VARCHAR(50),
    pull_interval INTEGER,
    time_interval INTEGER,
    time_unit VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gacha_rarity_restrictions_channel ON gacha_rarity_restrictions(channel_name);

-- 8. Banners (visual banners for gacha page, max 5 per channel)
CREATE TABLE IF NOT EXISTS gacha_banners (
    id SERIAL PRIMARY KEY,
    channel_name VARCHAR(100) NOT NULL,
    banner_url VARCHAR(500) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gacha_banners_channel ON gacha_banners(channel_name);

-- 9. Overlay configuration per channel
CREATE TABLE IF NOT EXISTS gacha_overlay_configs (
    id SERIAL PRIMARY KEY,
    channel_name VARCHAR(100) NOT NULL,
    overlay_size VARCHAR(20) NOT NULL DEFAULT 'standard',
    custom_width INTEGER,
    custom_height INTEGER,
    animation_speed INTEGER NOT NULL DEFAULT 10,
    enable_debug BOOLEAN NOT NULL DEFAULT FALSE,
    enable_sounds BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_gacha_overlay_channel UNIQUE (channel_name)
);

-- 10. Pull logs (history of all pulls and donations)
CREATE TABLE IF NOT EXISTS gacha_pull_logs (
    id BIGSERIAL PRIMARY KEY,
    channel_name VARCHAR(100) NOT NULL,
    participant_id INTEGER NOT NULL REFERENCES gacha_participants(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES gacha_items(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL DEFAULT 'pull',
    amount DECIMAL(10,2),
    occurred_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gacha_pull_logs_channel ON gacha_pull_logs(channel_name);
CREATE INDEX IF NOT EXISTS idx_gacha_pull_logs_participant ON gacha_pull_logs(participant_id);
CREATE INDEX IF NOT EXISTS idx_gacha_pull_logs_date ON gacha_pull_logs(occurred_at);

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'gacha_%'
ORDER BY table_name;
