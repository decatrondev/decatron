-- Migration: Add username_history table
-- Tracks when streamers change their Twitch username
-- The TwitchId never changes, but the Login (username) can change at any time

CREATE TABLE IF NOT EXISTS username_history (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    old_login VARCHAR(100) NOT NULL,
    new_login VARCHAR(100) NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    detected_by VARCHAR(50) NOT NULL DEFAULT 'auth'  -- 'auth', 'periodic_sync', 'manual'
);

CREATE INDEX IF NOT EXISTS idx_username_history_user_id ON username_history(user_id);
CREATE INDEX IF NOT EXISTS idx_username_history_old_login ON username_history(old_login);
CREATE INDEX IF NOT EXISTS idx_username_history_changed_at ON username_history(changed_at DESC);
