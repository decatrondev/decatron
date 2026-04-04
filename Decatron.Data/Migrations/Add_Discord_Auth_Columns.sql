-- Migration: Add Discord authentication columns to users table
-- Date: 2026-04-03
-- Purpose: Support Discord OAuth login alongside Twitch

-- Discord identity
ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_avatar TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_email TEXT;

-- Discord OAuth tokens
ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_token_expiration TIMESTAMP;

-- Auth provider tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'twitch';

-- Make twitch_id nullable (Discord-only users won't have it)
ALTER TABLE users ALTER COLUMN twitch_id DROP NOT NULL;
ALTER TABLE users ALTER COLUMN login DROP NOT NULL;

-- Indexes for Discord lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id) WHERE discord_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);
