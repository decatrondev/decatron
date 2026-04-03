-- Gamification System: XP Roles + Boosts
-- Phase 5B - 2026-04-01

-- XP roles per guild (level-based, accumulative)
CREATE TABLE IF NOT EXISTS xp_roles (
    id BIGSERIAL PRIMARY KEY,
    guild_id VARCHAR(30) NOT NULL,
    level_required INTEGER NOT NULL DEFAULT 1,
    role_name VARCHAR(100) NOT NULL,
    role_color VARCHAR(10) NOT NULL DEFAULT '#95a5a6',
    discord_role_id VARCHAR(30),
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_roles_guild_level ON xp_roles (guild_id, level_required);

-- XP boosts (temporary multipliers)
CREATE TABLE IF NOT EXISTS xp_boosts (
    id BIGSERIAL PRIMARY KEY,
    guild_id VARCHAR(30) NOT NULL,
    multiplier DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    activated_by_user_id VARCHAR(30) NOT NULL,
    activated_by_username VARCHAR(100) NOT NULL DEFAULT '',
    starts_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_boosts_guild_active ON xp_boosts (guild_id, is_active, expires_at);
