-- Gamification System: XP Store
-- Phase 5D Store - 2026-04-02

-- Store items for sale
CREATE TABLE IF NOT EXISTS xp_store_items (
    id BIGSERIAL PRIMARY KEY,
    guild_id VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(300) NOT NULL DEFAULT '',
    icon VARCHAR(10) NOT NULL DEFAULT '🎁',
    cost INTEGER NOT NULL DEFAULT 100,
    item_type VARCHAR(30) NOT NULL DEFAULT 'custom',
    duration_hours INTEGER,
    max_stock INTEGER NOT NULL DEFAULT 0,
    current_stock INTEGER NOT NULL DEFAULT 0,
    role_id VARCHAR(30),
    channel_id VARCHAR(30),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_store_items_guild ON xp_store_items (guild_id, enabled);

-- Purchase history
CREATE TABLE IF NOT EXISTS xp_store_purchases (
    id BIGSERIAL PRIMARY KEY,
    guild_id VARCHAR(30) NOT NULL,
    user_id VARCHAR(30) NOT NULL,
    username VARCHAR(100) NOT NULL DEFAULT '',
    item_id BIGINT NOT NULL REFERENCES xp_store_items(id) ON DELETE CASCADE,
    cost_paid INTEGER NOT NULL,
    purchased_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_xp_store_purchases_guild ON xp_store_purchases (guild_id, user_id);
