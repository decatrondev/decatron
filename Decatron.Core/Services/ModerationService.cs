using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Core.Models;
using Decatron.Core.Services.Moderation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Core.Services
{
    /// <summary>
    /// Cadena de moderación del chat: inmunidad → filtros encendidos → strikes → acción → log.
    /// Los filtros solo detectan; todo lo demás se resuelve acá, igual para todos.
    /// </summary>
    public class ModerationService
    {
        private readonly string _connectionString;
        private readonly ILogger<ModerationService> _logger;
        private readonly IReadOnlyList<IModerationFilter> _filters;

        // De la más leve a la más dura: sirve para "como mínimo timeout de 10 min" en severidad media
        private static readonly string[] ActionRank =
            { "warning", "delete", "timeout_30s", "timeout_1m", "timeout_5m", "timeout_10m", "timeout_30m", "timeout_1h", "ban" };

        public ModerationService(
            IConfiguration configuration,
            ILogger<ModerationService> logger,
            IEnumerable<IModerationFilter> filters)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
            _logger = logger;
            _filters = filters.ToList();
        }

        /// <summary>
        /// Claves de los filtros que existen, en el orden en que se evalúan
        /// </summary>
        public IReadOnlyList<string> FilterKeys => _filters.Select(f => f.Key).ToList();

        /// <summary>
        /// Modera un mensaje. Devuelve null si no hay que hacer nada.
        /// </summary>
        /// <param name="isDelegatedOwnerAsync">
        /// Si quien escribe tiene control_total del canal en el dashboard (cuenta como el streamer).
        /// Solo se consulta cuando un filtro saltó, para no pegarle a la base en cada mensaje.
        /// </param>
        public async Task<ModerationVerdict?> EvaluateAsync(ModerationMessage message, Func<Task<bool>>? isDelegatedOwnerAsync = null)
        {
            try
            {
                // Streamer, Lead Mod y mods: inmunes a todos los filtros
                if (message.IsBroadcaster || message.IsLeadModerator || message.IsModerator)
                    return null;

                var filterConfigs = await GetFilterConfigsAsync(message.Channel);
                var enabled = _filters
                    .Select(f => (Filter: f, Config: filterConfigs.FirstOrDefault(c => c.FilterKey == f.Key)))
                    .Where(x => x.Config != null && x.Config.Enabled)
                    .ToList();

                if (enabled.Count == 0)
                    return null;

                var config = await GetModerationConfigAsync(message.Channel) ?? new ModerationConfig { ChannelName = message.Channel.ToLower() };

                var (immune, escalamiento, reason) = ResolveImmunity(config, message);
                if (immune)
                {
                    _logger.LogDebug("[MODERACIÓN] {User} inmune en {Channel}: {Reason}", message.Username, message.Channel, reason);
                    return null;
                }

                // Se corren todos los filtros encendidos y gana el hit más grave
                FilterHit? hit = null;
                IModerationFilter? hitFilter = null;
                ModerationFilter? hitConfig = null;
                foreach (var (filter, filterConfig) in enabled)
                {
                    FilterHit? candidate;
                    try
                    {
                        candidate = await filter.CheckAsync(message, filterConfig!);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "[MODERACIÓN] El filtro {Filter} falló en {Channel}", filter.Key, message.Channel);
                        continue;
                    }

                    if (candidate != null && (hit == null || SeverityRank(candidate.Severity) > SeverityRank(hit.Severity)))
                    {
                        hit = candidate;
                        hitFilter = filter;
                        hitConfig = filterConfig;
                    }
                }

                if (hit == null)
                    return null;

                if (isDelegatedOwnerAsync != null && await isDelegatedOwnerAsync())
                {
                    _logger.LogDebug("[MODERACIÓN] {User} tiene control_total de {Channel}: inmune", message.Username, message.Channel);
                    return null;
                }

                var originalSeverity = hit.Severity;
                var severity = escalamiento ? ReduceSeverity(originalSeverity) : originalSeverity;

                _logger.LogWarning("[MODERACIÓN] {Filter} en [{Channel}] por [{User}]: '{Detail}' ({Severity}{Reduced})",
                    hit.FilterKey, message.Channel, message.Username, hit.Detail, originalSeverity,
                    severity != originalSeverity ? $" → {severity} por {reason}" : "");

                var (strikeLevel, action) = await ProcessStrikeAsync(config, hitConfig!.UserId, message, hit, severity);

                await hitFilter!.OnSanctionedAsync(hit);

                return new ModerationVerdict
                {
                    Hit = hit,
                    Action = action,
                    StrikeLevel = strikeLevel,
                    FilterMessage = hitConfig.Message ?? hit.DefaultMessage,
                    Config = config
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[MODERACIÓN] Error moderando mensaje de {User} en {Channel}", message.Username, message.Channel);
                return null;
            }
        }

        /// <summary>
        /// Prueba un mensaje contra todos los filtros (encendidos o no), sin sancionar ni sumar strikes.
        /// </summary>
        public async Task<List<(FilterHit Hit, bool Enabled)>> TestMessageAsync(string channel, string text)
        {
            var results = new List<(FilterHit, bool)>();
            var filterConfigs = await GetFilterConfigsAsync(channel);
            var message = new ModerationMessage { Channel = channel.ToLower(), Username = "", Text = text };

            foreach (var filter in _filters)
            {
                var filterConfig = filterConfigs.FirstOrDefault(c => c.FilterKey == filter.Key)
                    ?? new ModerationFilter { ChannelName = channel.ToLower(), FilterKey = filter.Key };
                var hit = await filter.CheckAsync(message, filterConfig);
                if (hit != null)
                    results.Add((hit, filterConfig.Enabled));
            }

            return results.OrderByDescending(r => SeverityRank(r.Item1.Severity)).ToList();
        }

        /// <summary>
        /// Acción que tocaría a un usuario sin inmunidad con el strike que se le sumaría ahora
        /// (strike 1 si no tiene). Solo para mostrar en "Probar mensaje".
        /// </summary>
        public static string PreviewAction(ModerationConfig config, string severity, string minimumAction = "warning") => severity switch
        {
            "severo" => "ban",
            "medio" => Harsher(Harsher(config.Strike1Action, minimumAction), "timeout_10m"),
            _ => Harsher(config.Strike1Action, minimumAction)
        };

        /// <summary>
        /// Fila de un filtro del canal (null si nunca se configuró = apagado)
        /// </summary>
        public async Task<ModerationFilter?> GetFilterAsync(string channelName, string filterKey) =>
            (await GetFilterConfigsAsync(channelName)).FirstOrDefault(f => f.FilterKey == filterKey);

        /// <summary>
        /// Configuración de moderación del canal (null si nunca la guardó)
        /// </summary>
        public async Task<ModerationConfig?> GetModerationConfigAsync(string channelName)
        {
            if (ModerationCache.TryGet<ModerationConfig>("config", channelName, out var cached))
                return cached;

            try
            {
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();

                await using var cmd = new NpgsqlCommand(@"
                    SELECT id, user_id, channel_name, vip_immunity, sub_immunity, whitelist_users::text,
                           warning_message, strike_expiration, strike1_action, strike2_action,
                           strike3_action, strike4_action, strike5_action, created_at, updated_at,
                           delete_message, timeout_message, ban_message, severo_message
                    FROM moderation_configs
                    WHERE channel_name = @channelName", conn);
                cmd.Parameters.AddWithValue("channelName", channelName.ToLower());

                ModerationConfig? config = null;
                await using var reader = await cmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    var defaults = new ModerationConfig();
                    config = new ModerationConfig
                    {
                        Id = reader.GetInt64(0),
                        UserId = reader.GetInt64(1),
                        ChannelName = reader.GetString(2),
                        VipImmunity = reader.GetString(3),
                        SubImmunity = reader.GetString(4),
                        WhitelistUsers = reader.GetString(5),
                        WarningMessage = reader.GetString(6),
                        StrikeExpiration = reader.GetString(7),
                        Strike1Action = reader.GetString(8),
                        Strike2Action = reader.GetString(9),
                        Strike3Action = reader.GetString(10),
                        Strike4Action = reader.GetString(11),
                        Strike5Action = reader.GetString(12),
                        CreatedAt = reader.GetDateTime(13),
                        UpdatedAt = reader.GetDateTime(14),
                        DeleteMessage = reader.IsDBNull(15) ? defaults.DeleteMessage : reader.GetString(15),
                        TimeoutMessage = reader.IsDBNull(16) ? defaults.TimeoutMessage : reader.GetString(16),
                        BanMessage = reader.IsDBNull(17) ? defaults.BanMessage : reader.GetString(17),
                        SeveroMessage = reader.IsDBNull(18) ? defaults.SeveroMessage : reader.GetString(18)
                    };
                }

                ModerationCache.Set("config", channelName, config);
                return config;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo configuración de moderación de {Channel}", channelName);
                return null;
            }
        }

        private async Task<List<ModerationFilter>> GetFilterConfigsAsync(string channelName)
        {
            if (ModerationCache.TryGet<List<ModerationFilter>>("filters", channelName, out var cached) && cached != null)
                return cached;

            var list = new List<ModerationFilter>();
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            await using var cmd = new NpgsqlCommand(@"
                SELECT id, user_id, channel_name, filter_key, enabled, severity, settings::text, message
                FROM moderation_filters
                WHERE channel_name = @channelName", conn);
            cmd.Parameters.AddWithValue("channelName", channelName.ToLower());

            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new ModerationFilter
                {
                    Id = reader.GetInt64(0),
                    UserId = reader.GetInt64(1),
                    ChannelName = reader.GetString(2),
                    FilterKey = reader.GetString(3),
                    Enabled = reader.GetBoolean(4),
                    Severity = reader.GetString(5),
                    Settings = reader.GetString(6),
                    Message = reader.IsDBNull(7) ? null : reader.GetString(7)
                });
            }

            ModerationCache.Set("filters", channelName, list);
            return list;
        }

        /// <summary>
        /// Whitelist y VIP/sub con inmunidad total quedan fuera; con escalamiento, la severidad baja un nivel.
        /// </summary>
        private static (bool immune, bool escalamiento, string reason) ResolveImmunity(ModerationConfig config, ModerationMessage message)
        {
            List<string> whitelist;
            try { whitelist = JsonSerializer.Deserialize<List<string>>(config.WhitelistUsers) ?? new(); }
            catch { whitelist = new(); }

            if (whitelist.Any(u => string.Equals(u, message.Username, StringComparison.OrdinalIgnoreCase)))
                return (true, false, "whitelist");

            if (message.IsVip)
            {
                if (config.VipImmunity == "total") return (true, false, "VIP con inmunidad total");
                if (config.VipImmunity == "escalamiento") return (false, true, "VIP con escalamiento");
            }

            if (message.IsSubscriber)
            {
                if (config.SubImmunity == "total") return (true, false, "sub con inmunidad total");
                if (config.SubImmunity == "escalamiento") return (false, true, "sub con escalamiento");
            }

            return (false, false, "sin inmunidad");
        }

        /// <summary>
        /// Suma el strike y devuelve la acción. Severo = ban directo sin strike; medio = strike
        /// con timeout de 10 min como mínimo; leve = la acción configurada para el strike.
        /// </summary>
        private async Task<(int strikeLevel, string action)> ProcessStrikeAsync(
            ModerationConfig config, long channelUserId, ModerationMessage message, FilterHit hit, string severity)
        {
            if (severity == "severo")
            {
                await LogModerationActionAsync(channelUserId, message, hit, severity, "ban", 0);
                return (0, "ban");
            }

            try
            {
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();

                var userStrike = await GetOrCreateUserStrikeAsync(conn, channelUserId, message.Channel, message.Username);

                // Los strikes bajan 1 nivel por cada período configurado sin infracciones
                var expirationTime = GetExpirationTimeSpan(config.StrikeExpiration);
                if (userStrike.StrikeLevel > 0 && expirationTime.HasValue)
                {
                    var periods = (int)((DateTime.Now - userStrike.LastInfractionAt).TotalMinutes / expirationTime.Value.TotalMinutes);
                    if (periods > 0)
                        userStrike.StrikeLevel = Math.Max(0, userStrike.StrikeLevel - periods);
                }

                userStrike.StrikeLevel = Math.Min(5, userStrike.StrikeLevel + 1);
                userStrike.LastInfractionAt = DateTime.Now;
                userStrike.ExpiresAt = expirationTime.HasValue ? DateTime.Now.Add(expirationTime.Value) : null;
                userStrike.UpdatedAt = DateTime.Now;

                await UpdateUserStrikeAsync(conn, userStrike);

                var action = Harsher(GetStrikeAction(config, userStrike.StrikeLevel), hit.MinimumAction);
                if (severity == "medio")
                    action = Harsher(action, "timeout_10m");

                await LogModerationActionAsync(channelUserId, message, hit, severity, action, userStrike.StrikeLevel);

                return (userStrike.StrikeLevel, action);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error procesando strike de {User} en {Channel}", message.Username, message.Channel);
                return (1, "warning");
            }
        }

        private async Task LogModerationActionAsync(
            long channelUserId, ModerationMessage message, FilterHit hit, string severity, string action, int strikeLevel)
        {
            try
            {
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();

                await using var cmd = new NpgsqlCommand(@"
                    INSERT INTO moderation_logs
                    (channel_name, user_id, username, detected_word, severity, action_taken, strike_level, full_message, filter_key, created_at)
                    VALUES (@channelName, @userId, @username, @detectedWord, @severity, @actionTaken, @strikeLevel, @fullMessage, @filterKey, @createdAt)", conn);
                cmd.Parameters.AddWithValue("channelName", message.Channel.ToLower());
                cmd.Parameters.AddWithValue("userId", channelUserId);
                cmd.Parameters.AddWithValue("username", message.Username.ToLower());
                cmd.Parameters.AddWithValue("detectedWord", Truncate(hit.Detail, 500));
                cmd.Parameters.AddWithValue("severity", severity);
                cmd.Parameters.AddWithValue("actionTaken", action);
                cmd.Parameters.AddWithValue("strikeLevel", strikeLevel);
                cmd.Parameters.AddWithValue("fullMessage", (object?)message.Text ?? DBNull.Value);
                cmd.Parameters.AddWithValue("filterKey", hit.FilterKey);
                cmd.Parameters.AddWithValue("createdAt", DateTime.Now);

                await cmd.ExecuteNonQueryAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error registrando log de moderación de {User} en {Channel}", message.Username, message.Channel);
            }
        }

        private static async Task<UserStrike> GetOrCreateUserStrikeAsync(NpgsqlConnection conn, long channelUserId, string channelName, string username)
        {
            // Crea la fila en 0 si no existe y la devuelve en una sola ida
            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO user_strikes (channel_name, user_id, username, strike_level, last_infraction_at, expires_at, created_at, updated_at)
                VALUES (@channelName, @userId, @username, 0, @now, NULL, @now, @now)
                ON CONFLICT (user_id, username) DO UPDATE SET channel_name = EXCLUDED.channel_name
                RETURNING id, channel_name, username, strike_level, last_infraction_at, expires_at, created_at, updated_at", conn);
            cmd.Parameters.AddWithValue("channelName", channelName.ToLower());
            cmd.Parameters.AddWithValue("userId", channelUserId);
            cmd.Parameters.AddWithValue("username", username.ToLower());
            cmd.Parameters.AddWithValue("now", DateTime.Now);

            await using var reader = await cmd.ExecuteReaderAsync();
            await reader.ReadAsync();
            return new UserStrike
            {
                Id = reader.GetInt64(0),
                ChannelName = reader.GetString(1),
                Username = reader.GetString(2),
                StrikeLevel = reader.GetInt32(3),
                LastInfractionAt = reader.GetDateTime(4),
                ExpiresAt = reader.IsDBNull(5) ? null : reader.GetDateTime(5),
                CreatedAt = reader.GetDateTime(6),
                UpdatedAt = reader.GetDateTime(7)
            };
        }

        private static async Task UpdateUserStrikeAsync(NpgsqlConnection conn, UserStrike userStrike)
        {
            await using var cmd = new NpgsqlCommand(@"
                UPDATE user_strikes
                SET strike_level = @strikeLevel,
                    last_infraction_at = @lastInfractionAt,
                    expires_at = @expiresAt,
                    updated_at = @updatedAt
                WHERE id = @id", conn);
            cmd.Parameters.AddWithValue("id", userStrike.Id);
            cmd.Parameters.AddWithValue("strikeLevel", userStrike.StrikeLevel);
            cmd.Parameters.AddWithValue("lastInfractionAt", userStrike.LastInfractionAt);
            cmd.Parameters.AddWithValue("expiresAt", (object?)userStrike.ExpiresAt ?? DBNull.Value);
            cmd.Parameters.AddWithValue("updatedAt", userStrike.UpdatedAt);
            await cmd.ExecuteNonQueryAsync();
        }

        private static TimeSpan? GetExpirationTimeSpan(string expiration) => expiration switch
        {
            "5min" => TimeSpan.FromMinutes(5),
            "10min" => TimeSpan.FromMinutes(10),
            "15min" => TimeSpan.FromMinutes(15),
            "30min" => TimeSpan.FromMinutes(30),
            "1hour" => TimeSpan.FromHours(1),
            "never" => null,
            _ => TimeSpan.FromMinutes(15)
        };

        private static string GetStrikeAction(ModerationConfig config, int strikeLevel) => strikeLevel switch
        {
            1 => config.Strike1Action,
            2 => config.Strike2Action,
            3 => config.Strike3Action,
            4 => config.Strike4Action,
            5 => config.Strike5Action,
            _ => "warning"
        };

        private static string Harsher(string a, string b) =>
            Array.IndexOf(ActionRank, a) >= Array.IndexOf(ActionRank, b) ? a : b;

        private static int SeverityRank(string severity) => severity switch
        {
            "severo" => 2,
            "medio" => 1,
            _ => 0
        };

        private static string ReduceSeverity(string severity) => severity switch
        {
            "severo" => "medio",
            "medio" => "leve",
            _ => "leve"
        };

        private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];
    }
}
