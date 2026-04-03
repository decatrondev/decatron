-- Gamification System: Achievements + Seasonal Leaderboard
-- Phase 5C - 2026-04-02

-- Achievement definitions per guild
CREATE TABLE IF NOT EXISTS xp_achievements (
    id BIGSERIAL PRIMARY KEY,
    guild_id VARCHAR(30),
    achievement_key VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(300) NOT NULL DEFAULT '',
    icon VARCHAR(10) NOT NULL DEFAULT '🏆',
    condition_type VARCHAR(30) NOT NULL DEFAULT 'messages',
    condition_value INTEGER NOT NULL DEFAULT 1,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_achievements_guild ON xp_achievements (guild_id, achievement_key);

-- User unlocked achievements
CREATE TABLE IF NOT EXISTS user_achievements (
    id BIGSERIAL PRIMARY KEY,
    guild_id VARCHAR(30) NOT NULL,
    user_id VARCHAR(30) NOT NULL,
    achievement_id BIGINT NOT NULL REFERENCES xp_achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_achievement UNIQUE (guild_id, user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements (guild_id, user_id);

-- Seasonal (monthly) XP leaderboard
CREATE TABLE IF NOT EXISTS xp_seasonal (
    id BIGSERIAL PRIMARY KEY,
    guild_id VARCHAR(30) NOT NULL,
    user_id VARCHAR(30) NOT NULL,
    username VARCHAR(100) NOT NULL DEFAULT '',
    year_month VARCHAR(7) NOT NULL,
    xp_gained INTEGER NOT NULL DEFAULT 0,
    messages_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_xp_seasonal UNIQUE (guild_id, user_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_xp_seasonal_leaderboard ON xp_seasonal (guild_id, year_month, xp_gained DESC);
