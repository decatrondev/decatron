-- Gamification System: XP/Levels Core Tables
-- Phase 5A - 2026-04-01

-- XP config per guild (server)
CREATE TABLE IF NOT EXISTS xp_configs (
    id BIGSERIAL PRIMARY KEY,
    guild_id VARCHAR(30) NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    difficulty_preset VARCHAR(20) NOT NULL DEFAULT 'normal',
    custom_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    xp_min INTEGER NOT NULL DEFAULT 15,
    xp_max INTEGER NOT NULL DEFAULT 25,
    cooldown_seconds INTEGER NOT NULL DEFAULT 60,
    max_xp_per_hour INTEGER NOT NULL DEFAULT 500,
    min_message_length INTEGER NOT NULL DEFAULT 5,
    excluded_channels JSONB NOT NULL DEFAULT '[]',
    night_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    night_mode_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    levelup_channel_id VARCHAR(30),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- User XP per guild (server)
CREATE TABLE IF NOT EXISTS user_xp (
    id BIGSERIAL PRIMARY KEY,
    guild_id VARCHAR(30) NOT NULL,
    user_id VARCHAR(30) NOT NULL,
    username VARCHAR(100) NOT NULL DEFAULT '',
    avatar_url VARCHAR(500),
    xp BIGINT NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 0,
    total_messages BIGINT NOT NULL DEFAULT 0,
    voice_minutes BIGINT NOT NULL DEFAULT 0,
    last_xp_at TIMESTAMP,
    streak_days INTEGER NOT NULL DEFAULT 0,
    last_active_date DATE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_xp_guild_user UNIQUE (guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_xp_leaderboard ON user_xp (guild_id, level DESC, xp DESC);
CREATE INDEX IF NOT EXISTS idx_user_xp_user_id ON user_xp (user_id);

-- User XP global (Decatron platform)
CREATE TABLE IF NOT EXISTS user_xp_global (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(30) NOT NULL UNIQUE,
    xp BIGINT NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 0,
    total_servers_active INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- XP transaction log (audit + future graphs)
CREATE TABLE IF NOT EXISTS xp_transactions (
    id BIGSERIAL PRIMARY KEY,
    guild_id VARCHAR(30) NOT NULL,
    user_id VARCHAR(30) NOT NULL,
    xp_amount INTEGER NOT NULL,
    source VARCHAR(30) NOT NULL DEFAULT 'message',
    description VARCHAR(200),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_guild ON xp_transactions (guild_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_created ON xp_transactions (created_at DESC);
