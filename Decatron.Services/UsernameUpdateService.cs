using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    public class UsernameUpdateService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<UsernameUpdateService> _logger;

        public UsernameUpdateService(
            IServiceProvider serviceProvider,
            ILogger<UsernameUpdateService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        /// <summary>
        /// Detects if a user's login changed and propagates the update across all tables.
        /// Returns true if a change was detected and applied.
        /// </summary>
        /// <param name="updateUserTable">If true, also updates users.login directly. Set to false when the caller handles it (e.g. AuthService).</param>
        public async Task<bool> DetectAndPropagateAsync(long userId, string currentDbLogin, string newTwitchLogin, string detectedBy = "auth", bool updateUserTable = false)
        {
            var newLoginLower = newTwitchLogin.ToLower();

            if (currentDbLogin.Equals(newLoginLower, StringComparison.OrdinalIgnoreCase))
                return false;

            _logger.LogInformation(
                "Username change detected for user {UserId}: '{OldLogin}' → '{NewLogin}' (detected by: {DetectedBy})",
                userId, currentDbLogin, newLoginLower, detectedBy);

            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            await using var transaction = await db.Database.BeginTransactionAsync();
            try
            {
                // 1. Save to history
                db.UsernameHistory.Add(new UsernameHistory
                {
                    UserId = userId,
                    OldLogin = currentDbLogin,
                    NewLogin = newLoginLower,
                    ChangedAt = DateTime.UtcNow,
                    DetectedBy = detectedBy
                });
                await db.SaveChangesAsync();

                // 2. Propagate to all tables
                await PropagateChannelNameAsync(db, userId, currentDbLogin, newLoginLower, updateUserTable);

                await transaction.CommitAsync();

                _logger.LogInformation(
                    "Username change propagated successfully for user {UserId}: '{OldLogin}' → '{NewLogin}'",
                    userId, currentDbLogin, newLoginLower);

                // Rejoin bot to the new channel name
                try
                {
                    var botService = _serviceProvider.GetService<TwitchBotService>();
                    if (botService != null)
                    {
                        botService.LeaveChannel(currentDbLogin);
                        botService.JoinChannel(newLoginLower);
                        _logger.LogInformation("Bot reconnected: left '{OldChannel}', joined '{NewChannel}'",
                            currentDbLogin, newLoginLower);
                    }
                }
                catch (Exception botEx)
                {
                    _logger.LogWarning(botEx, "Could not reconnect bot for channel rename, will fix on next restart");
                }

                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex,
                    "Failed to propagate username change for user {UserId}: '{OldLogin}' → '{NewLogin}'",
                    userId, currentDbLogin, newLoginLower);
                throw;
            }
        }

        /// <summary>
        /// Updates channel_name/username/channel_login across all tables.
        /// For tables WITH user_id: updates by user_id (reliable).
        /// For tables WITHOUT user_id: updates by old channel_name string (best effort until Phase 1 migration).
        /// </summary>
        private async Task PropagateChannelNameAsync(DecatronDbContext db, long userId, string oldLogin, string newLogin, bool updateUserTable = false)
        {
            // Update ALL tables by BOTH user_id AND old channel_name string.
            // This catches rows where user_id might be wrong (e.g. created by admin).
            var allTables = new (string table, string column)[]
            {
                ("timer_configs", "channel_name"),
                ("scripted_commands", "channel_name"),
                ("moderation_configs", "channel_name"),
                ("banned_words", "channel_name"),
                ("follow_alert_configs", "channel_name"),
                ("event_alerts_configs", "channel_name"),
                ("tips_configs", "channel_name"),
                ("now_playing_configs", "channel_name"),
                ("timer_event_cooldowns", "channel_name"),
                ("custom_commands", "channel_name"),
                ("timers", "channel_name"),
                ("micro_game_commands", "channel_name"),
                ("command_counters", "channel_name"),
                ("command_uses", "channel_name"),
                ("shoutout_history", "channel_name"),
                ("follow_alert_history", "channel_name"),
                ("tips_history", "channel_name"),
                ("sound_alert_history", "channel_name"),
                ("timer_media_files", "channel_name"),
                ("timer_sessions", "channel_name"),
                ("timer_states", "channel_name"),
                ("timer_session_backups", "channel_name"),
                ("timer_configs_backup_tiers", "channel_name"),
                ("raffles", "channel_name"),
                ("decatron_ai_channel_config", "channel_name"),
                ("decatron_ai_channel_permissions", "channel_name"),
                ("decatron_ai_usage", "channel_name"),
                ("moderation_logs", "channel_name"),
                ("user_strikes", "channel_name"),
                ("gacha_items", "channel_name"),
                ("gacha_inventory", "channel_name"),
                ("gacha_banners", "channel_name"),
                ("gacha_participants", "channel_name"),
                ("gacha_achievements", "channel_name"),
                ("gacha_item_restrictions", "channel_name"),
                ("gacha_pull_logs", "channel_name"),
                ("gacha_rarity_configs", "channel_name"),
                ("gacha_command_configs", "channel_name"),
                ("gacha_command_aliases", "channel_name"),
                ("gacha_sound_configs", "channel_name"),
                ("gacha_integration_configs", "channel_name"),
                ("gacha_overlay_configs", "channel_name"),
                ("gacha_preferences", "channel_name"),
                ("gacha_rarity_restrictions", "channel_name"),
            };

            foreach (var (table, column) in allTables)
            {
                // Update by user_id OR by old channel_name (covers mismatched user_id rows)
                var rows = await db.Database.ExecuteSqlRawAsync(
                    $"UPDATE {table} SET {column} = {{0}}, user_id = {{2}} WHERE user_id = {{2}} OR LOWER({column}) = LOWER({{1}})",
                    newLogin, oldLogin, userId);

                if (rows > 0)
                    _logger.LogDebug("Updated {Rows} rows in {Table}", rows, table);
            }

            // Tables with 'username' column
            var tablesWithUsername = new (string table, string column)[]
            {
                ("sound_alert_configs", "username"),
                ("sound_alert_files", "username"),
                ("shoutout_configs", "username"),
            };

            foreach (var (table, column) in tablesWithUsername)
            {
                var rows = await db.Database.ExecuteSqlRawAsync(
                    $"UPDATE {table} SET {column} = {{0}}, user_id = {{2}} WHERE user_id = {{2}} OR LOWER({column}) = LOWER({{1}})",
                    newLogin, oldLogin, userId);

                if (rows > 0)
                    _logger.LogDebug("Updated {Rows} rows in {Table}", rows, table);
            }

            // Tables with 'channel_login' column
            var tablesWithChannelLogin = new (string table, string column)[]
            {
                ("game_history", "channel_login"),
                ("title_history", "channel_login"),
            };

            foreach (var (table, column) in tablesWithChannelLogin)
            {
                var rows = await db.Database.ExecuteSqlRawAsync(
                    $"UPDATE {table} SET {column} = {{0}}, user_id = {{2}} WHERE user_id = {{2}} OR LOWER({column}) = LOWER({{1}})",
                    newLogin, oldLogin, userId);

                if (rows > 0)
                    _logger.LogDebug("Updated {Rows} rows in {Table}", rows, table);
            }

            // Update users.login directly when called from background services
            if (updateUserTable)
            {
                await db.Database.ExecuteSqlRawAsync(
                    "UPDATE users SET login = {0}, updated_at = {1} WHERE id = {2}",
                    newLogin, DateTime.UtcNow, userId);
            }
        }
    }
}
