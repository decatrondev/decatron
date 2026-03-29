using Decatron.Data;
using Decatron.Core.Interfaces;
using Decatron.Services;
using Decatron.Attributes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text;
using Npgsql;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/analytics")]
    [Authorize]
    public class AnalyticsController : ControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly IPermissionService _permissionService;
        private readonly ILogger<AnalyticsController> _logger;

        public AnalyticsController(
            DecatronDbContext dbContext,
            IPermissionService permissionService,
            ILogger<AnalyticsController> logger)
        {
            _dbContext = dbContext;
            _permissionService = permissionService;
            _logger = logger;
        }

        private long GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(userIdClaim, out var userId))
                return userId;
            throw new UnauthorizedAccessException("User not found");
        }

        private long GetChannelOwnerId()
        {
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
            {
                return sessionId;
            }

            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
            {
                return channelOwnerId;
            }

            return GetUserId();
        }

        // Get channel_name (login) from user_id
        private async Task<string?> GetChannelName(long userId)
        {
            var user = await _dbContext.Users.FindAsync(userId);
            return user?.Login;
        }

        // Get max allowed days based on user tier
        private async Task<int> GetMaxDaysForTier(long userId)
        {
            try
            {
                var connection = _dbContext.Database.GetDbConnection();
                if (connection.State != System.Data.ConnectionState.Open)
                    await connection.OpenAsync();

                using var cmd = connection.CreateCommand();
                cmd.CommandText = @"
                    SELECT tier FROM user_subscription_tiers
                    WHERE user_id = @userId
                    AND (tier_expires_at IS NULL OR tier_expires_at > NOW())
                    LIMIT 1";
                cmd.Parameters.Add(new NpgsqlParameter("@userId", userId));

                var tier = await cmd.ExecuteScalarAsync() as string;

                return tier switch
                {
                    "admin" => 365 * 10,
                    "premium" => 365 * 10,
                    "supporter" => 180,
                    _ => 30
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Analytics] Error getting tier for user {UserId}", userId);
                return 30;
            }
        }

        [HttpGet]
        [RequirePermission("analytics", "moderation")]
        public async Task<IActionResult> GetAnalytics([FromQuery] DateTime from, [FromQuery] DateTime to)
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();

                // Check permission
                if (userId != channelOwnerId)
                {
                    if (!await _permissionService.HasPermissionLevelAsync(userId, channelOwnerId, "moderation"))
                    {
                        return StatusCode(403, new { success = false, message = "No tienes permisos para ver analytics" });
                    }
                }

                // Get channel name (login) for queries
                var channelName = await GetChannelName(channelOwnerId);
                if (string.IsNullOrEmpty(channelName))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                // Validate date range based on tier
                var maxDays = await GetMaxDaysForTier(channelOwnerId);
                var requestedDays = (to - from).Days;

                if (requestedDays > maxDays)
                {
                    from = to.AddDays(-maxDays);
                    _logger.LogInformation($"[Analytics] Date range limited to {maxDays} days for channel {channelName}");
                }

                // Ensure dates are in UTC
                from = DateTime.SpecifyKind(from, DateTimeKind.Utc);
                to = DateTime.SpecifyKind(to.Date.AddDays(1).AddSeconds(-1), DateTimeKind.Utc);

                // Get user's Twitch ID for followers query
                var user = await _dbContext.Users.FindAsync(channelOwnerId);
                var twitchId = user?.TwitchId ?? "";

                var analytics = new
                {
                    overview = await GetOverviewData(channelName, from, to),
                    timerEvents = await GetTimerEvents(channelName, from, to),
                    moderation = await GetModerationLogs(channelName, from, to),
                    streamHistory = await GetStreamHistory(channelName, from, to),
                    activity = await GetActivityData(channelName, twitchId, from, to),
                    chatMessages = await GetChatMessages(channelName, from, to),
                    meta = new
                    {
                        from,
                        to,
                        maxDaysAllowed = maxDays,
                        channelName
                    }
                };

                return Ok(analytics);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Analytics] Error getting analytics");
                return StatusCode(500, new { success = false, message = "Error al obtener analytics" });
            }
        }

        private async Task<object> GetOverviewData(string channelName, DateTime from, DateTime to)
        {
            var connection = _dbContext.Database.GetDbConnection();
            if (connection.State != System.Data.ConnectionState.Open)
                await connection.OpenAsync();

            // Timer events count and time added
            int totalTimerEvents = 0;
            int totalTimeAdded = 0;

            using (var cmd = connection.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT COUNT(*)::int, COALESCE(SUM(time_added), 0)::int
                    FROM timer_event_logs
                    WHERE channel_name = @channelName AND occurred_at BETWEEN @from AND @to";
                cmd.Parameters.Add(new NpgsqlParameter("@channelName", channelName));
                cmd.Parameters.Add(new NpgsqlParameter("@from", from));
                cmd.Parameters.Add(new NpgsqlParameter("@to", to));

                using var reader = await cmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    totalTimerEvents = reader.GetInt32(0);
                    totalTimeAdded = reader.GetInt32(1);
                }
            }

            // Moderation count
            int moderationCount = 0;
            using (var cmd = connection.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT COUNT(*)::int
                    FROM moderation_logs
                    WHERE channel_name = @channelName AND created_at BETWEEN @from AND @to";
                cmd.Parameters.Add(new NpgsqlParameter("@channelName", channelName));
                cmd.Parameters.Add(new NpgsqlParameter("@from", from));
                cmd.Parameters.Add(new NpgsqlParameter("@to", to));

                var result = await cmd.ExecuteScalarAsync();
                moderationCount = result != null ? Convert.ToInt32(result) : 0;
            }

            // Game changes count
            int gameChangesCount = 0;
            using (var cmd = connection.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT COUNT(*)::int
                    FROM game_history
                    WHERE channel_login = @channelName AND changed_at BETWEEN @from AND @to";
                cmd.Parameters.Add(new NpgsqlParameter("@channelName", channelName));
                cmd.Parameters.Add(new NpgsqlParameter("@from", from));
                cmd.Parameters.Add(new NpgsqlParameter("@to", to));

                var result = await cmd.ExecuteScalarAsync();
                gameChangesCount = result != null ? Convert.ToInt32(result) : 0;
            }

            // Top event types
            var topEventTypes = new List<object>();
            using (var cmd = connection.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT event_type, COUNT(*)::int as count
                    FROM timer_event_logs
                    WHERE channel_name = @channelName AND occurred_at BETWEEN @from AND @to
                    GROUP BY event_type
                    ORDER BY count DESC
                    LIMIT 5";
                cmd.Parameters.Add(new NpgsqlParameter("@channelName", channelName));
                cmd.Parameters.Add(new NpgsqlParameter("@from", from));
                cmd.Parameters.Add(new NpgsqlParameter("@to", to));

                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    topEventTypes.Add(new { type = reader.GetString(0), count = reader.GetInt32(1) });
                }
            }

            // Events per day
            var eventsPerDay = new List<object>();
            using (var cmd = connection.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT DATE(occurred_at) as date, COUNT(*)::int as count
                    FROM timer_event_logs
                    WHERE channel_name = @channelName AND occurred_at BETWEEN @from AND @to
                    GROUP BY DATE(occurred_at)
                    ORDER BY date";
                cmd.Parameters.Add(new NpgsqlParameter("@channelName", channelName));
                cmd.Parameters.Add(new NpgsqlParameter("@from", from));
                cmd.Parameters.Add(new NpgsqlParameter("@to", to));

                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    eventsPerDay.Add(new
                    {
                        date = reader.GetDateTime(0).ToString("yyyy-MM-dd"),
                        count = reader.GetInt32(1)
                    });
                }
            }

            return new
            {
                totalTimerEvents,
                totalTimeAdded,
                totalModerationActions = moderationCount,
                totalGameChanges = gameChangesCount,
                topEventTypes,
                eventsPerDay
            };
        }

        private async Task<List<object>> GetTimerEvents(string channelName, DateTime from, DateTime to)
        {
            var events = new List<object>();
            var connection = _dbContext.Database.GetDbConnection();
            if (connection.State != System.Data.ConnectionState.Open)
                await connection.OpenAsync();

            using var cmd = connection.CreateCommand();
            cmd.CommandText = @"
                SELECT id, event_type, username, time_added, details, occurred_at
                FROM timer_event_logs
                WHERE channel_name = @channelName AND occurred_at BETWEEN @from AND @to
                ORDER BY occurred_at DESC
                LIMIT 200";
            cmd.Parameters.Add(new NpgsqlParameter("@channelName", channelName));
            cmd.Parameters.Add(new NpgsqlParameter("@from", from));
            cmd.Parameters.Add(new NpgsqlParameter("@to", to));

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                events.Add(new
                {
                    id = reader.GetInt32(0),
                    eventType = reader.GetString(1),
                    username = reader.GetString(2),
                    timeAdded = reader.GetInt32(3),
                    details = reader.IsDBNull(4) ? null : reader.GetString(4),
                    occurredAt = reader.GetDateTime(5)
                });
            }

            return events;
        }

        private async Task<List<object>> GetModerationLogs(string channelName, DateTime from, DateTime to)
        {
            var logs = new List<object>();
            var connection = _dbContext.Database.GetDbConnection();
            if (connection.State != System.Data.ConnectionState.Open)
                await connection.OpenAsync();

            using var cmd = connection.CreateCommand();
            cmd.CommandText = @"
                SELECT id, username, detected_word, severity, action_taken, strike_level, created_at
                FROM moderation_logs
                WHERE channel_name = @channelName AND created_at BETWEEN @from AND @to
                ORDER BY created_at DESC
                LIMIT 200";
            cmd.Parameters.Add(new NpgsqlParameter("@channelName", channelName));
            cmd.Parameters.Add(new NpgsqlParameter("@from", from));
            cmd.Parameters.Add(new NpgsqlParameter("@to", to));

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                logs.Add(new
                {
                    id = reader.GetInt64(0),
                    username = reader.GetString(1),
                    detectedWord = reader.GetString(2),
                    severity = reader.GetString(3),
                    actionTaken = reader.GetString(4),
                    strikeLevel = reader.GetInt32(5),
                    createdAt = reader.GetDateTime(6)
                });
            }

            return logs;
        }

        private async Task<object> GetStreamHistory(string channelName, DateTime from, DateTime to)
        {
            var gameChanges = new List<object>();
            var titleChanges = new List<object>();
            var connection = _dbContext.Database.GetDbConnection();
            if (connection.State != System.Data.ConnectionState.Open)
                await connection.OpenAsync();

            // Game changes
            using (var cmd = connection.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT ""Id"", category_name, changed_by, changed_at
                    FROM game_history
                    WHERE channel_login = @channelName AND changed_at BETWEEN @from AND @to
                    ORDER BY changed_at DESC
                    LIMIT 100";
                cmd.Parameters.Add(new NpgsqlParameter("@channelName", channelName));
                cmd.Parameters.Add(new NpgsqlParameter("@from", from));
                cmd.Parameters.Add(new NpgsqlParameter("@to", to));

                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    gameChanges.Add(new
                    {
                        id = reader.GetInt64(0),
                        categoryName = reader.GetString(1),
                        changedBy = reader.GetString(2),
                        changedAt = reader.GetDateTime(3)
                    });
                }
            }

            // Title changes
            using (var cmd = connection.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT id, title, changed_by, changed_at
                    FROM title_history
                    WHERE channel_login = @channelName AND changed_at BETWEEN @from AND @to
                    ORDER BY changed_at DESC
                    LIMIT 100";
                cmd.Parameters.Add(new NpgsqlParameter("@channelName", channelName));
                cmd.Parameters.Add(new NpgsqlParameter("@from", from));
                cmd.Parameters.Add(new NpgsqlParameter("@to", to));

                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    titleChanges.Add(new
                    {
                        id = reader.GetInt64(0),
                        title = reader.GetString(1),
                        changedBy = reader.GetString(2),
                        changedAt = reader.GetDateTime(3)
                    });
                }
            }

            return new { games = gameChanges, titles = titleChanges };
        }

        private async Task<object> GetActivityData(string channelName, string twitchId, DateTime from, DateTime to)
        {
            var followers = new List<object>();
            var tips = new List<object>();
            var topTippers = new List<object>();

            var connection = _dbContext.Database.GetDbConnection();
            if (connection.State != System.Data.ConnectionState.Open)
                await connection.OpenAsync();

            // Followers per day
            using (var cmd = connection.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT DATE(followed_at) as date, COUNT(*)::int as count
                    FROM channel_followers
                    WHERE broadcaster_id = @twitchId AND followed_at BETWEEN @from AND @to
                    GROUP BY DATE(followed_at)
                    ORDER BY date";
                cmd.Parameters.Add(new NpgsqlParameter("@twitchId", twitchId));
                cmd.Parameters.Add(new NpgsqlParameter("@from", from));
                cmd.Parameters.Add(new NpgsqlParameter("@to", to));

                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    followers.Add(new
                    {
                        date = reader.GetDateTime(0).ToString("yyyy-MM-dd"),
                        count = reader.GetInt32(1)
                    });
                }
            }

            // Tips per day
            using (var cmd = connection.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT DATE(donated_at) as date, COALESCE(SUM(amount), 0)::decimal as amount
                    FROM tips_history
                    WHERE channel_name = @channelName AND donated_at BETWEEN @from AND @to AND status = 'completed'
                    GROUP BY DATE(donated_at)
                    ORDER BY date";
                cmd.Parameters.Add(new NpgsqlParameter("@channelName", channelName));
                cmd.Parameters.Add(new NpgsqlParameter("@from", from));
                cmd.Parameters.Add(new NpgsqlParameter("@to", to));

                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    tips.Add(new
                    {
                        date = reader.GetDateTime(0).ToString("yyyy-MM-dd"),
                        amount = reader.GetDecimal(1)
                    });
                }
            }

            // Top tippers
            using (var cmd = connection.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT donor_name, SUM(amount)::decimal as total
                    FROM tips_history
                    WHERE channel_name = @channelName AND donated_at BETWEEN @from AND @to AND status = 'completed'
                    GROUP BY donor_name
                    ORDER BY total DESC
                    LIMIT 10";
                cmd.Parameters.Add(new NpgsqlParameter("@channelName", channelName));
                cmd.Parameters.Add(new NpgsqlParameter("@from", from));
                cmd.Parameters.Add(new NpgsqlParameter("@to", to));

                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    topTippers.Add(new
                    {
                        name = reader.GetString(0),
                        value = reader.GetDecimal(1)
                    });
                }
            }

            return new { followers, tips, topTippers };
        }

        private async Task<List<object>> GetChatMessages(string channelName, DateTime from, DateTime to)
        {
            var messages = new List<object>();
            var connection = _dbContext.Database.GetDbConnection();
            if (connection.State != System.Data.ConnectionState.Open)
                await connection.OpenAsync();

            using var cmd = connection.CreateCommand();
            cmd.CommandText = @"
                SELECT ""Id"", username, user_id, message, timestamp
                FROM chat_messages
                WHERE channel = @channelName AND timestamp BETWEEN @from AND @to
                ORDER BY timestamp DESC
                LIMIT 500";
            cmd.Parameters.Add(new NpgsqlParameter("@channelName", channelName));
            cmd.Parameters.Add(new NpgsqlParameter("@from", from));
            cmd.Parameters.Add(new NpgsqlParameter("@to", to));

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                messages.Add(new
                {
                    id = reader.GetInt64(0),
                    username = reader.GetString(1),
                    userId = reader.IsDBNull(2) ? null : reader.GetString(2),
                    message = reader.GetString(3),
                    timestamp = reader.GetDateTime(4)
                });
            }

            return messages;
        }

        [HttpGet("export")]
        [RequirePermission("analytics_export", "control_total")]
        public async Task<IActionResult> ExportCSV([FromQuery] DateTime from, [FromQuery] DateTime to, [FromQuery] string type = "all")
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();

                // Check permission
                if (userId != channelOwnerId)
                {
                    if (!await _permissionService.HasPermissionLevelAsync(userId, channelOwnerId, "control_total"))
                    {
                        return StatusCode(403, new { success = false, message = "No tienes permisos para exportar analytics" });
                    }
                }

                var channelName = await GetChannelName(channelOwnerId);
                if (string.IsNullOrEmpty(channelName))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var maxDays = await GetMaxDaysForTier(channelOwnerId);
                var requestedDays = (to - from).Days;

                if (requestedDays > maxDays)
                {
                    from = to.AddDays(-maxDays);
                }

                from = DateTime.SpecifyKind(from, DateTimeKind.Utc);
                to = DateTime.SpecifyKind(to.Date.AddDays(1).AddSeconds(-1), DateTimeKind.Utc);

                var csv = new StringBuilder();

                var connection = _dbContext.Database.GetDbConnection();
                if (connection.State != System.Data.ConnectionState.Open)
                    await connection.OpenAsync();

                if (type == "all" || type == "timer_events")
                {
                    csv.AppendLine("=== TIMER EVENTS ===");
                    csv.AppendLine("Date,Event Type,Username,Time Added (seconds),Details");

                    using var cmd = connection.CreateCommand();
                    cmd.CommandText = @"
                        SELECT occurred_at, event_type, username, time_added, details
                        FROM timer_event_logs
                        WHERE channel_name = @channelName AND occurred_at BETWEEN @from AND @to
                        ORDER BY occurred_at DESC";
                    cmd.Parameters.Add(new NpgsqlParameter("@channelName", channelName));
                    cmd.Parameters.Add(new NpgsqlParameter("@from", from));
                    cmd.Parameters.Add(new NpgsqlParameter("@to", to));

                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        csv.AppendLine($"{reader.GetDateTime(0):yyyy-MM-dd HH:mm:ss},{EscapeCsv(reader.GetString(1))},{EscapeCsv(reader.GetString(2))},{reader.GetInt32(3)},{EscapeCsv(reader.IsDBNull(4) ? "" : reader.GetString(4))}");
                    }
                    csv.AppendLine();
                }

                if (type == "all" || type == "moderation")
                {
                    csv.AppendLine("=== MODERATION LOGS ===");
                    csv.AppendLine("Date,Username,Detected Word,Severity,Action,Strike Level");

                    using var cmd = connection.CreateCommand();
                    cmd.CommandText = @"
                        SELECT created_at, username, detected_word, severity, action_taken, strike_level
                        FROM moderation_logs
                        WHERE channel_name = @channelName AND created_at BETWEEN @from AND @to
                        ORDER BY created_at DESC";
                    cmd.Parameters.Add(new NpgsqlParameter("@channelName", channelName));
                    cmd.Parameters.Add(new NpgsqlParameter("@from", from));
                    cmd.Parameters.Add(new NpgsqlParameter("@to", to));

                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        csv.AppendLine($"{reader.GetDateTime(0):yyyy-MM-dd HH:mm:ss},{EscapeCsv(reader.GetString(1))},{EscapeCsv(reader.GetString(2))},{reader.GetString(3)},{reader.GetString(4)},{reader.GetInt32(5)}");
                    }
                    csv.AppendLine();
                }

                if (type == "all" || type == "chat")
                {
                    csv.AppendLine("=== CHAT MESSAGES ===");
                    csv.AppendLine("Date,Username,User ID,Message");

                    using var cmd = connection.CreateCommand();
                    cmd.CommandText = @"
                        SELECT timestamp, username, user_id, message
                        FROM chat_messages
                        WHERE channel = @channelName AND timestamp BETWEEN @from AND @to
                        ORDER BY timestamp DESC";
                    cmd.Parameters.Add(new NpgsqlParameter("@channelName", channelName));
                    cmd.Parameters.Add(new NpgsqlParameter("@from", from));
                    cmd.Parameters.Add(new NpgsqlParameter("@to", to));

                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        csv.AppendLine($"{reader.GetDateTime(0):yyyy-MM-dd HH:mm:ss},{EscapeCsv(reader.GetString(1))},{EscapeCsv(reader.IsDBNull(2) ? "" : reader.GetString(2))},{EscapeCsv(reader.GetString(3))}");
                    }
                    csv.AppendLine();
                }

                var fileName = $"analytics_{channelName}_{from:yyyyMMdd}_{to:yyyyMMdd}.csv";
                return File(Encoding.UTF8.GetBytes(csv.ToString()), "text/csv", fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Analytics] Error exporting CSV");
                return StatusCode(500, new { success = false, message = "Error al exportar analytics" });
            }
        }

        private static string EscapeCsv(string? value)
        {
            if (string.IsNullOrEmpty(value)) return "";
            if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
            {
                return $"\"{value.Replace("\"", "\"\"")}\"";
            }
            return value;
        }
    }
}
