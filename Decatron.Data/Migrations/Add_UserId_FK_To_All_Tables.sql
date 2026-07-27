-- Migration: Add user_id FK to all tables that use channel_name/username/channel_login as streamer identifier
-- This is Phase 1 of the ChannelName → UserId migration.
-- user_id is NULLABLE during transition. Phase 4 will make it NOT NULL.

-- ============================================================
-- GROUP A: Tables with 'channel_name' column (streamer identifier)
-- ============================================================

-- custom_commands
ALTER TABLE custom_commands ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE custom_commands t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE custom_commands DROP CONSTRAINT IF EXISTS fk_custom_commands_user_id;
ALTER TABLE custom_commands ADD CONSTRAINT fk_custom_commands_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_custom_commands_user_id ON custom_commands(user_id);

-- timers
ALTER TABLE timers ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE timers t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE timers DROP CONSTRAINT IF EXISTS fk_timers_user_id;
ALTER TABLE timers ADD CONSTRAINT fk_timers_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_timers_user_id ON timers(user_id);

-- micro_game_commands
ALTER TABLE micro_game_commands ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE micro_game_commands t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE micro_game_commands DROP CONSTRAINT IF EXISTS fk_micro_game_commands_user_id;
ALTER TABLE micro_game_commands ADD CONSTRAINT fk_micro_game_commands_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_micro_game_commands_user_id ON micro_game_commands(user_id);

-- command_counters
ALTER TABLE command_counters ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE command_counters t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE command_counters DROP CONSTRAINT IF EXISTS fk_command_counters_user_id;
ALTER TABLE command_counters ADD CONSTRAINT fk_command_counters_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_command_counters_user_id ON command_counters(user_id);

-- command_uses
ALTER TABLE command_uses ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE command_uses t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE command_uses DROP CONSTRAINT IF EXISTS fk_command_uses_user_id;
ALTER TABLE command_uses ADD CONSTRAINT fk_command_uses_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_command_uses_user_id ON command_uses(user_id);

-- timer_media_files
ALTER TABLE timer_media_files ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE timer_media_files t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE timer_media_files DROP CONSTRAINT IF EXISTS fk_timer_media_files_user_id;
ALTER TABLE timer_media_files ADD CONSTRAINT fk_timer_media_files_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_timer_media_files_user_id ON timer_media_files(user_id);

-- timer_sessions
ALTER TABLE timer_sessions ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE timer_sessions t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE timer_sessions DROP CONSTRAINT IF EXISTS fk_timer_sessions_user_id;
ALTER TABLE timer_sessions ADD CONSTRAINT fk_timer_sessions_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_timer_sessions_user_id ON timer_sessions(user_id);

-- timer_states
ALTER TABLE timer_states ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE timer_states t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE timer_states DROP CONSTRAINT IF EXISTS fk_timer_states_user_id;
ALTER TABLE timer_states ADD CONSTRAINT fk_timer_states_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_timer_states_user_id ON timer_states(user_id);

-- timer_session_backups
ALTER TABLE timer_session_backups ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE timer_session_backups t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE timer_session_backups DROP CONSTRAINT IF EXISTS fk_timer_session_backups_user_id;
ALTER TABLE timer_session_backups ADD CONSTRAINT fk_timer_session_backups_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_timer_session_backups_user_id ON timer_session_backups(user_id);

-- timer_configs_backup_tiers
ALTER TABLE timer_configs_backup_tiers ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE timer_configs_backup_tiers t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE timer_configs_backup_tiers DROP CONSTRAINT IF EXISTS fk_timer_configs_backup_tiers_user_id;
ALTER TABLE timer_configs_backup_tiers ADD CONSTRAINT fk_timer_configs_backup_tiers_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_timer_configs_backup_tiers_user_id ON timer_configs_backup_tiers(user_id);

-- raffles
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE raffles t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE raffles DROP CONSTRAINT IF EXISTS fk_raffles_user_id;
ALTER TABLE raffles ADD CONSTRAINT fk_raffles_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_raffles_user_id ON raffles(user_id);

-- shoutout_history
ALTER TABLE shoutout_history ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE shoutout_history t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE shoutout_history DROP CONSTRAINT IF EXISTS fk_shoutout_history_user_id;
ALTER TABLE shoutout_history ADD CONSTRAINT fk_shoutout_history_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_shoutout_history_user_id ON shoutout_history(user_id);

-- follow_alert_history
ALTER TABLE follow_alert_history ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE follow_alert_history t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE follow_alert_history DROP CONSTRAINT IF EXISTS fk_follow_alert_history_user_id;
ALTER TABLE follow_alert_history ADD CONSTRAINT fk_follow_alert_history_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_follow_alert_history_user_id ON follow_alert_history(user_id);

-- tips_history
ALTER TABLE tips_history ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE tips_history t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE tips_history DROP CONSTRAINT IF EXISTS fk_tips_history_user_id;
ALTER TABLE tips_history ADD CONSTRAINT fk_tips_history_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_tips_history_user_id ON tips_history(user_id);

-- sound_alert_history
ALTER TABLE sound_alert_history ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE sound_alert_history t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE sound_alert_history DROP CONSTRAINT IF EXISTS fk_sound_alert_history_user_id;
ALTER TABLE sound_alert_history ADD CONSTRAINT fk_sound_alert_history_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_sound_alert_history_user_id ON sound_alert_history(user_id);

-- moderation_logs
ALTER TABLE moderation_logs ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE moderation_logs t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE moderation_logs DROP CONSTRAINT IF EXISTS fk_moderation_logs_user_id;
ALTER TABLE moderation_logs ADD CONSTRAINT fk_moderation_logs_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_user_id ON moderation_logs(user_id);

-- user_strikes
ALTER TABLE user_strikes ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE user_strikes t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE user_strikes DROP CONSTRAINT IF EXISTS fk_user_strikes_user_id;
ALTER TABLE user_strikes ADD CONSTRAINT fk_user_strikes_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_user_strikes_user_id ON user_strikes(user_id);

-- decatron_ai_channel_config
ALTER TABLE decatron_ai_channel_config ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE decatron_ai_channel_config t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE decatron_ai_channel_config DROP CONSTRAINT IF EXISTS fk_decatron_ai_channel_config_user_id;
ALTER TABLE decatron_ai_channel_config ADD CONSTRAINT fk_decatron_ai_channel_config_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_decatron_ai_channel_config_user_id ON decatron_ai_channel_config(user_id);

-- decatron_ai_channel_permissions
ALTER TABLE decatron_ai_channel_permissions ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE decatron_ai_channel_permissions t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE decatron_ai_channel_permissions DROP CONSTRAINT IF EXISTS fk_decatron_ai_channel_permissions_user_id;
ALTER TABLE decatron_ai_channel_permissions ADD CONSTRAINT fk_decatron_ai_channel_permissions_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_decatron_ai_channel_permissions_user_id ON decatron_ai_channel_permissions(user_id);

-- decatron_ai_usage
ALTER TABLE decatron_ai_usage ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE decatron_ai_usage t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE decatron_ai_usage DROP CONSTRAINT IF EXISTS fk_decatron_ai_usage_user_id;
ALTER TABLE decatron_ai_usage ADD CONSTRAINT fk_decatron_ai_usage_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_decatron_ai_usage_user_id ON decatron_ai_usage(user_id);

-- ============================================================
-- GROUP B: Tables with 'username' column (streamer identifier)
-- ============================================================

-- shoutout_configs
ALTER TABLE shoutout_configs ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE shoutout_configs t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.username) AND t.user_id IS NULL;
ALTER TABLE shoutout_configs DROP CONSTRAINT IF EXISTS fk_shoutout_configs_user_id;
ALTER TABLE shoutout_configs ADD CONSTRAINT fk_shoutout_configs_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_shoutout_configs_user_id ON shoutout_configs(user_id);

-- sound_alert_configs
ALTER TABLE sound_alert_configs ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE sound_alert_configs t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.username) AND t.user_id IS NULL;
ALTER TABLE sound_alert_configs DROP CONSTRAINT IF EXISTS fk_sound_alert_configs_user_id;
ALTER TABLE sound_alert_configs ADD CONSTRAINT fk_sound_alert_configs_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_sound_alert_configs_user_id ON sound_alert_configs(user_id);

-- sound_alert_files
ALTER TABLE sound_alert_files ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE sound_alert_files t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.username) AND t.user_id IS NULL;
ALTER TABLE sound_alert_files DROP CONSTRAINT IF EXISTS fk_sound_alert_files_user_id;
ALTER TABLE sound_alert_files ADD CONSTRAINT fk_sound_alert_files_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_sound_alert_files_user_id ON sound_alert_files(user_id);

-- ============================================================
-- GROUP C: Tables with 'channel_login' column
-- ============================================================

-- game_history
ALTER TABLE game_history ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE game_history t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_login) AND t.user_id IS NULL;
ALTER TABLE game_history DROP CONSTRAINT IF EXISTS fk_game_history_user_id;
ALTER TABLE game_history ADD CONSTRAINT fk_game_history_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_game_history_user_id ON game_history(user_id);

-- title_history
ALTER TABLE title_history ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE title_history t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_login) AND t.user_id IS NULL;
ALTER TABLE title_history DROP CONSTRAINT IF EXISTS fk_title_history_user_id;
ALTER TABLE title_history ADD CONSTRAINT fk_title_history_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_title_history_user_id ON title_history(user_id);

-- ============================================================
-- GROUP D: Gacha system (all use channel_name)
-- ============================================================

-- gacha_items
ALTER TABLE gacha_items ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE gacha_items t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE gacha_items DROP CONSTRAINT IF EXISTS fk_gacha_items_user_id;
ALTER TABLE gacha_items ADD CONSTRAINT fk_gacha_items_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_gacha_items_user_id ON gacha_items(user_id);

-- gacha_inventory
ALTER TABLE gacha_inventory ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE gacha_inventory t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE gacha_inventory DROP CONSTRAINT IF EXISTS fk_gacha_inventory_user_id;
ALTER TABLE gacha_inventory ADD CONSTRAINT fk_gacha_inventory_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_gacha_inventory_user_id ON gacha_inventory(user_id);

-- gacha_banners
ALTER TABLE gacha_banners ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE gacha_banners t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE gacha_banners DROP CONSTRAINT IF EXISTS fk_gacha_banners_user_id;
ALTER TABLE gacha_banners ADD CONSTRAINT fk_gacha_banners_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_gacha_banners_user_id ON gacha_banners(user_id);

-- gacha_participants
ALTER TABLE gacha_participants ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE gacha_participants t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE gacha_participants DROP CONSTRAINT IF EXISTS fk_gacha_participants_user_id;
ALTER TABLE gacha_participants ADD CONSTRAINT fk_gacha_participants_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_gacha_participants_user_id ON gacha_participants(user_id);

-- gacha_achievements
ALTER TABLE gacha_achievements ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE gacha_achievements t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE gacha_achievements DROP CONSTRAINT IF EXISTS fk_gacha_achievements_user_id;
ALTER TABLE gacha_achievements ADD CONSTRAINT fk_gacha_achievements_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_gacha_achievements_user_id ON gacha_achievements(user_id);

-- gacha_item_restrictions
ALTER TABLE gacha_item_restrictions ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE gacha_item_restrictions t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE gacha_item_restrictions DROP CONSTRAINT IF EXISTS fk_gacha_item_restrictions_user_id;
ALTER TABLE gacha_item_restrictions ADD CONSTRAINT fk_gacha_item_restrictions_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_gacha_item_restrictions_user_id ON gacha_item_restrictions(user_id);

-- gacha_pull_logs
ALTER TABLE gacha_pull_logs ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE gacha_pull_logs t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE gacha_pull_logs DROP CONSTRAINT IF EXISTS fk_gacha_pull_logs_user_id;
ALTER TABLE gacha_pull_logs ADD CONSTRAINT fk_gacha_pull_logs_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_gacha_pull_logs_user_id ON gacha_pull_logs(user_id);

-- gacha_rarity_configs
ALTER TABLE gacha_rarity_configs ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE gacha_rarity_configs t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE gacha_rarity_configs DROP CONSTRAINT IF EXISTS fk_gacha_rarity_configs_user_id;
ALTER TABLE gacha_rarity_configs ADD CONSTRAINT fk_gacha_rarity_configs_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_gacha_rarity_configs_user_id ON gacha_rarity_configs(user_id);

-- gacha_rarity_restrictions
ALTER TABLE gacha_rarity_restrictions ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE gacha_rarity_restrictions t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE gacha_rarity_restrictions DROP CONSTRAINT IF EXISTS fk_gacha_rarity_restrictions_user_id;
ALTER TABLE gacha_rarity_restrictions ADD CONSTRAINT fk_gacha_rarity_restrictions_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_gacha_rarity_restrictions_user_id ON gacha_rarity_restrictions(user_id);

-- gacha_command_configs
ALTER TABLE gacha_command_configs ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE gacha_command_configs t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE gacha_command_configs DROP CONSTRAINT IF EXISTS fk_gacha_command_configs_user_id;
ALTER TABLE gacha_command_configs ADD CONSTRAINT fk_gacha_command_configs_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_gacha_command_configs_user_id ON gacha_command_configs(user_id);

-- gacha_command_aliases
ALTER TABLE gacha_command_aliases ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE gacha_command_aliases t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE gacha_command_aliases DROP CONSTRAINT IF EXISTS fk_gacha_command_aliases_user_id;
ALTER TABLE gacha_command_aliases ADD CONSTRAINT fk_gacha_command_aliases_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_gacha_command_aliases_user_id ON gacha_command_aliases(user_id);

-- gacha_sound_configs
ALTER TABLE gacha_sound_configs ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE gacha_sound_configs t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE gacha_sound_configs DROP CONSTRAINT IF EXISTS fk_gacha_sound_configs_user_id;
ALTER TABLE gacha_sound_configs ADD CONSTRAINT fk_gacha_sound_configs_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_gacha_sound_configs_user_id ON gacha_sound_configs(user_id);

-- gacha_integration_configs
ALTER TABLE gacha_integration_configs ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE gacha_integration_configs t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE gacha_integration_configs DROP CONSTRAINT IF EXISTS fk_gacha_integration_configs_user_id;
ALTER TABLE gacha_integration_configs ADD CONSTRAINT fk_gacha_integration_configs_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_gacha_integration_configs_user_id ON gacha_integration_configs(user_id);

-- gacha_overlay_configs
ALTER TABLE gacha_overlay_configs ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE gacha_overlay_configs t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE gacha_overlay_configs DROP CONSTRAINT IF EXISTS fk_gacha_overlay_configs_user_id;
ALTER TABLE gacha_overlay_configs ADD CONSTRAINT fk_gacha_overlay_configs_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_gacha_overlay_configs_user_id ON gacha_overlay_configs(user_id);

-- gacha_preferences
ALTER TABLE gacha_preferences ADD COLUMN IF NOT EXISTS user_id BIGINT;
UPDATE gacha_preferences t SET user_id = u.id FROM users u WHERE LOWER(u.login) = LOWER(t.channel_name) AND t.user_id IS NULL;
ALTER TABLE gacha_preferences DROP CONSTRAINT IF EXISTS fk_gacha_preferences_user_id;
ALTER TABLE gacha_preferences ADD CONSTRAINT fk_gacha_preferences_user_id FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_gacha_preferences_user_id ON gacha_preferences(user_id);

-- ============================================================
-- NEW COMPOSITE UNIQUE INDEXES (parallel to old channel_name-based ones)
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_commands_userid_cmd ON custom_commands(user_id, command_name) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_micro_game_userid_cmd ON micro_game_commands(user_id, short_command) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cmd_counters_userid_cmd ON command_counters(user_id, command_name) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cmd_uses_userid_cmd ON command_uses(user_id, command_name) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_gacha_participant_userid_name ON gacha_participants(user_id, name) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_gacha_achievement_userid_code ON gacha_achievements(user_id, code) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_gacha_cmd_alias_userid ON gacha_command_aliases(user_id, alias) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_gacha_cmd_config_userid ON gacha_command_configs(user_id, command) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_gacha_rarity_userid ON gacha_rarity_configs(user_id, rarity) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_gacha_restriction_userid_item ON gacha_item_restrictions(user_id, item_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_gacha_preference_userid_item_part ON gacha_preferences(user_id, item_id, participant_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_strike_userid_username ON user_strikes(user_id, username) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sound_alert_file_userid_reward ON sound_alert_files(user_id, reward_id) WHERE user_id IS NOT NULL;

-- Single-column unique (one config per streamer)
CREATE UNIQUE INDEX IF NOT EXISTS uq_shoutout_configs_userid ON shoutout_configs(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sound_alert_configs_userid ON sound_alert_configs(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_timer_states_userid ON timer_states(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_decatron_ai_config_userid ON decatron_ai_channel_config(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_decatron_ai_permissions_userid ON decatron_ai_channel_permissions(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_gacha_integration_userid ON gacha_integration_configs(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_gacha_overlay_userid ON gacha_overlay_configs(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_gacha_sound_userid ON gacha_sound_configs(user_id) WHERE user_id IS NOT NULL;

-- ============================================================
-- VALIDATION QUERY (run after migration to check orphans)
-- ============================================================
-- SELECT 'custom_commands' as tbl, COUNT(*) as nulls FROM custom_commands WHERE user_id IS NULL
-- UNION ALL SELECT 'timers', COUNT(*) FROM timers WHERE user_id IS NULL
-- ... etc
