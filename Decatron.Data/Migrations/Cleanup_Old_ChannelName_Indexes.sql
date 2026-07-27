-- Migration: Drop old channel_name-only unique indexes that now have user_id equivalents
-- The channel_name columns stay as denormalized cache, but the unique constraint moves to user_id

-- Composite unique indexes (replaced by user_id versions)
DROP INDEX IF EXISTS idx_channel_command;              -- custom_commands(channel_name, command_name) → uq_custom_commands_userid_cmd
DROP INDEX IF EXISTS idx_micro_channel_command;         -- micro_game_commands(channel_name, short_command) → uq_micro_game_userid_cmd
DROP INDEX IF EXISTS idx_counter_channel_command;       -- command_counters(channel_name, command_name) → uq_cmd_counters_userid_cmd
DROP INDEX IF EXISTS idx_uses_channel_command;           -- command_uses(channel_name, command_name) → uq_cmd_uses_userid_cmd
DROP INDEX IF EXISTS uq_gacha_participant_channel_name; -- gacha_participants(channel_name, name) → uq_gacha_participant_userid_name
DROP INDEX IF EXISTS uq_gacha_achievement_channel_code; -- gacha_achievements(channel_name, code) → uq_gacha_achievement_userid_code
DROP INDEX IF EXISTS uq_gacha_cmd_alias;                -- gacha_command_aliases(channel_name, alias) → uq_gacha_cmd_alias_userid
DROP INDEX IF EXISTS uq_gacha_cmd_config;               -- gacha_command_configs(channel_name, command) → uq_gacha_cmd_config_userid
DROP INDEX IF EXISTS uq_gacha_rarity_channel;           -- gacha_rarity_configs(channel_name, rarity) → uq_gacha_rarity_userid
DROP INDEX IF EXISTS uq_gacha_restriction_channel_item; -- gacha_item_restrictions(channel_name, item_id) → uq_gacha_restriction_userid_item
DROP INDEX IF EXISTS uq_gacha_preference_channel_item_participant; -- → uq_gacha_preference_userid_item_part
DROP INDEX IF EXISTS idx_user_strike_channel_user;      -- user_strikes(channel_name, username) → uq_user_strike_userid_username
DROP INDEX IF EXISTS idx_sound_alert_file_username_reward; -- → uq_sound_alert_file_userid_reward

-- Single-column unique indexes (replaced by user_id versions)
DROP INDEX IF EXISTS decatron_ai_channel_config_channel_name_key;      -- → uq_decatron_ai_config_userid
DROP INDEX IF EXISTS decatron_ai_channel_permissions_channel_name_key;  -- → uq_decatron_ai_permissions_userid
DROP INDEX IF EXISTS idx_sound_alert_config_username;                    -- → uq_sound_alert_configs_userid
DROP INDEX IF EXISTS uk_timer_state_channel;                             -- → uq_timer_states_userid
DROP INDEX IF EXISTS uq_gacha_integration_channel;                      -- → uq_gacha_integration_userid
DROP INDEX IF EXISTS uq_gacha_overlay_channel;                          -- → uq_gacha_overlay_userid
DROP INDEX IF EXISTS uq_gacha_sound_config_channel;                     -- → uq_gacha_sound_userid

-- Remove the WHERE user_id IS NOT NULL filter from new indexes (now that user_id is NOT NULL)
-- Recreate them without the filter for better performance
DROP INDEX IF EXISTS uq_custom_commands_userid_cmd;
CREATE UNIQUE INDEX uq_custom_commands_userid_cmd ON custom_commands(user_id, command_name);

DROP INDEX IF EXISTS uq_micro_game_userid_cmd;
CREATE UNIQUE INDEX uq_micro_game_userid_cmd ON micro_game_commands(user_id, short_command);

DROP INDEX IF EXISTS uq_cmd_counters_userid_cmd;
CREATE UNIQUE INDEX uq_cmd_counters_userid_cmd ON command_counters(user_id, command_name);

DROP INDEX IF EXISTS uq_cmd_uses_userid_cmd;
CREATE UNIQUE INDEX uq_cmd_uses_userid_cmd ON command_uses(user_id, command_name);

DROP INDEX IF EXISTS uq_gacha_participant_userid_name;
CREATE UNIQUE INDEX uq_gacha_participant_userid_name ON gacha_participants(user_id, name);

DROP INDEX IF EXISTS uq_gacha_achievement_userid_code;
CREATE UNIQUE INDEX uq_gacha_achievement_userid_code ON gacha_achievements(user_id, code) WHERE user_id IS NOT NULL;

DROP INDEX IF EXISTS uq_gacha_cmd_alias_userid;
CREATE UNIQUE INDEX uq_gacha_cmd_alias_userid ON gacha_command_aliases(user_id, alias);

DROP INDEX IF EXISTS uq_gacha_cmd_config_userid;
CREATE UNIQUE INDEX uq_gacha_cmd_config_userid ON gacha_command_configs(user_id, command);

DROP INDEX IF EXISTS uq_gacha_rarity_userid;
CREATE UNIQUE INDEX uq_gacha_rarity_userid ON gacha_rarity_configs(user_id, rarity);

DROP INDEX IF EXISTS uq_gacha_restriction_userid_item;
CREATE UNIQUE INDEX uq_gacha_restriction_userid_item ON gacha_item_restrictions(user_id, item_id);

DROP INDEX IF EXISTS uq_gacha_preference_userid_item_part;
CREATE UNIQUE INDEX uq_gacha_preference_userid_item_part ON gacha_preferences(user_id, item_id, participant_id);

DROP INDEX IF EXISTS uq_user_strike_userid_username;
CREATE UNIQUE INDEX uq_user_strike_userid_username ON user_strikes(user_id, username);

DROP INDEX IF EXISTS uq_sound_alert_file_userid_reward;
CREATE UNIQUE INDEX uq_sound_alert_file_userid_reward ON sound_alert_files(user_id, reward_id);

DROP INDEX IF EXISTS uq_shoutout_configs_userid;
CREATE UNIQUE INDEX uq_shoutout_configs_userid ON shoutout_configs(user_id);

DROP INDEX IF EXISTS uq_sound_alert_configs_userid;
CREATE UNIQUE INDEX uq_sound_alert_configs_userid ON sound_alert_configs(user_id);

DROP INDEX IF EXISTS uq_timer_states_userid;
CREATE UNIQUE INDEX uq_timer_states_userid ON timer_states(user_id);

DROP INDEX IF EXISTS uq_decatron_ai_config_userid;
CREATE UNIQUE INDEX uq_decatron_ai_config_userid ON decatron_ai_channel_config(user_id);

DROP INDEX IF EXISTS uq_decatron_ai_permissions_userid;
CREATE UNIQUE INDEX uq_decatron_ai_permissions_userid ON decatron_ai_channel_permissions(user_id);

DROP INDEX IF EXISTS uq_gacha_integration_userid;
CREATE UNIQUE INDEX uq_gacha_integration_userid ON gacha_integration_configs(user_id);

DROP INDEX IF EXISTS uq_gacha_overlay_userid;
CREATE UNIQUE INDEX uq_gacha_overlay_userid ON gacha_overlay_configs(user_id);

DROP INDEX IF EXISTS uq_gacha_sound_userid;
CREATE UNIQUE INDEX uq_gacha_sound_userid ON gacha_sound_configs(user_id);
