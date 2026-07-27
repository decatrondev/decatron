-- Migration: Make user_id NOT NULL across all tables
-- First clean up orphaned rows (no matching user), then set NOT NULL

-- Clean orphaned rows
DELETE FROM sound_alert_history WHERE user_id IS NULL;
DELETE FROM follow_alert_history WHERE user_id IS NULL;

-- Verify no more NULLs exist (safety check - will fail if any remain)
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count FROM custom_commands WHERE user_id IS NULL;
    IF null_count > 0 THEN RAISE EXCEPTION 'custom_commands has % NULL user_ids', null_count; END IF;
    SELECT COUNT(*) INTO null_count FROM timers WHERE user_id IS NULL;
    IF null_count > 0 THEN RAISE EXCEPTION 'timers has % NULL user_ids', null_count; END IF;
    SELECT COUNT(*) INTO null_count FROM micro_game_commands WHERE user_id IS NULL;
    IF null_count > 0 THEN RAISE EXCEPTION 'micro_game_commands has % NULL user_ids', null_count; END IF;
    SELECT COUNT(*) INTO null_count FROM gacha_items WHERE user_id IS NULL;
    IF null_count > 0 THEN RAISE EXCEPTION 'gacha_items has % NULL user_ids', null_count; END IF;
    RAISE NOTICE 'All tables clean — proceeding with NOT NULL';
END $$;

-- Make user_id NOT NULL on all tables
ALTER TABLE custom_commands ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE timers ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE micro_game_commands ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE command_counters ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE command_uses ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE timer_media_files ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE timer_sessions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE timer_states ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE timer_session_backups ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE timer_configs_backup_tiers ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE raffles ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE shoutout_history ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE follow_alert_history ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE tips_history ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE sound_alert_history ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE moderation_logs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE user_strikes ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE decatron_ai_channel_config ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE decatron_ai_channel_permissions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE decatron_ai_usage ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE shoutout_configs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE sound_alert_configs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE sound_alert_files ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE game_history ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE title_history ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE gacha_items ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE gacha_inventory ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE gacha_banners ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE gacha_participants ALTER COLUMN user_id SET NOT NULL;
-- gacha_achievements: user_id stays NULLABLE (global achievements have no channel)
ALTER TABLE gacha_item_restrictions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE gacha_pull_logs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE gacha_rarity_configs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE gacha_rarity_restrictions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE gacha_command_configs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE gacha_command_aliases ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE gacha_sound_configs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE gacha_integration_configs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE gacha_overlay_configs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE gacha_preferences ALTER COLUMN user_id SET NOT NULL;
