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
        /// How a table stores the login that has to be renamed. Determines which
        /// WHERE clause is safe to use, and whether user_id may be touched at all.
        /// </summary>
        private enum RenameScope
        {
            /// <summary>Column holds the channel owner's login AND the table has a bigint user_id FK to users.id.</summary>
            OwnerWithUserId,

            /// <summary>Column holds the channel owner's login but there is no usable users.id FK (user_id is a Twitch id, or absent).</summary>
            OwnerByNameOnly,

            /// <summary>Column holds a viewer's login (chatter, participant, moderated user). user_id here is a Twitch id — never touch it.</summary>
            ViewerName,
        }

        // Column holds the channel owner's login and user_id is a bigint FK to users.id.
        // Matched by user_id OR by the old login, so rows with a wrong user_id (e.g. created
        // by an admin) get repaired at the same time.
        private static readonly (string table, string column)[] OwnerTablesWithUserId =
        {
            ("timer_configs", "channel_name"),
            ("scripted_commands", "channel_name"),
            ("moderation_configs", "channel_name"),
            ("banned_words", "channel_name"),
            ("follow_alert_configs", "channel_name"),
            ("event_alerts_configs", "channel_name"),
            ("tips_configs", "channel_name"),
            ("now_playing_configs", "channel_name"),
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
            ("speak_chat_configs", "channel_name"),
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
            ("sound_alert_configs", "username"),
            ("sound_alert_files", "username"),
            ("shoutout_configs", "username"),
            ("system_admins", "username"),
            ("game_history", "channel_login"),
            ("title_history", "channel_login"),
        };

        // Column holds the channel owner's login, but user_id is a Twitch id (varchar) or the
        // table has no FK at all — matching or writing users.id here would be wrong.
        private static readonly (string table, string column)[] OwnerTablesByNameOnly =
        {
            ("timer_event_cooldowns", "channel_name"),
            ("timer_event_logs", "channel_name"),
            ("chat_messages", "channel"),
            ("discord_guild_configs", "channel_name"),
            ("discord_live_alerts", "channel_name"),
            ("discord_alert_messages", "channel_name"),
        };

        // Column holds a viewer's login. The renamed user may appear as a viewer in other
        // people's channels, so these are matched by the old login across the whole table.
        // Discord XP tables (user_xp, xp_seasonal, xp_store_purchases) are keyed by guild/Discord
        // id and hold Discord names, so they are deliberately left out.
        private static readonly (string table, string column)[] ViewerNameTables =
        {
            ("chat_messages", "username"),
            ("decatron_ai_usage", "username"),
            ("moderation_logs", "username"),
            ("user_strikes", "username"),
            ("timer_event_logs", "username"),
            ("stream_chat_activities", "username"),
            ("stream_watch_times", "username"),
            ("giveaway_participants", "username"),
            ("giveaway_blacklist", "username"),
            ("giveaway_winner_cooldowns", "username"),
            ("raffle_participants", "username"),
        };

        /// <summary>
        /// Updates every column that stores a login across all tables.
        /// Each statement runs inside its own savepoint: a table that fails (unknown column,
        /// unique violation, type mismatch) is logged and skipped instead of aborting the
        /// whole rename, which is what used to leave users half-renamed.
        /// </summary>
        private async Task PropagateChannelNameAsync(DecatronDbContext db, long userId, string oldLogin, string newLogin, bool updateUserTable = false)
        {
            var transaction = db.Database.CurrentTransaction
                ?? throw new InvalidOperationException("PropagateChannelNameAsync must run inside a transaction");

            var failed = 0;

            foreach (var (table, column) in OwnerTablesWithUserId)
            {
                failed += await RunScopedAsync(db, transaction, table, column, RenameScope.OwnerWithUserId, userId, oldLogin, newLogin);
            }

            foreach (var (table, column) in OwnerTablesByNameOnly)
            {
                failed += await RunScopedAsync(db, transaction, table, column, RenameScope.OwnerByNameOnly, userId, oldLogin, newLogin);
            }

            foreach (var (table, column) in ViewerNameTables)
            {
                failed += await RunScopedAsync(db, transaction, table, column, RenameScope.ViewerName, userId, oldLogin, newLogin);
            }

            if (failed > 0)
            {
                _logger.LogWarning(
                    "Username change for user {UserId} applied with {Failed} table(s) skipped — see errors above",
                    userId, failed);
            }

            // Update users.login directly when called from background services
            if (updateUserTable)
            {
                await db.Database.ExecuteSqlRawAsync(
                    "UPDATE users SET login = {0}, updated_at = {1} WHERE id = {2}",
                    newLogin, DateTime.UtcNow, userId);
            }
        }

        /// <summary>
        /// Runs one UPDATE behind a savepoint. Returns 1 if the table had to be skipped, 0 otherwise.
        /// </summary>
        private async Task<int> RunScopedAsync(
            DecatronDbContext db,
            Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction,
            string table,
            string column,
            RenameScope scope,
            long userId,
            string oldLogin,
            string newLogin)
        {
            var savepoint = $"rename_{table}_{column}";

            var sql = scope == RenameScope.OwnerWithUserId
                ? $"UPDATE {table} SET {column} = {{0}}, user_id = {{2}} WHERE user_id = {{2}} OR LOWER({column}) = LOWER({{1}})"
                : $"UPDATE {table} SET {column} = {{0}} WHERE LOWER({column}) = LOWER({{1}})";

            await transaction.CreateSavepointAsync(savepoint);
            try
            {
                var rows = await db.Database.ExecuteSqlRawAsync(sql, newLogin, oldLogin, userId);
                await transaction.ReleaseSavepointAsync(savepoint);

                if (rows > 0)
                    _logger.LogDebug("Updated {Rows} rows in {Table}.{Column}", rows, table, column);

                return 0;
            }
            catch (Exception ex)
            {
                await transaction.RollbackToSavepointAsync(savepoint);
                _logger.LogError(ex,
                    "Skipped {Table}.{Column} while renaming '{OldLogin}' → '{NewLogin}'",
                    table, column, oldLogin, newLogin);
                return 1;
            }
        }
    }
}
