using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Core.Interfaces;
using Decatron.Core.Services.Moderation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Services.Moderation
{
    /// <summary>
    /// Modo pánico: aplica en Twitch lo que el streamer eligió (solo seguidores, solo emotes,
    /// solo subs, modo lento, Shield Mode), guarda cómo estaba el chat y lo devuelve igual al
    /// apagarse. Se apaga solo al vencer (PanicModeBackgroundService) o a mano.
    /// </summary>
    public class PanicModeService
    {
        public record PanicState(bool Active, DateTime? StartedAt, DateTime? EndsAt, string? TriggeredBy, string? Reason);

        private readonly string _connectionString;
        private readonly TwitchApiService _twitch;
        private readonly IMessageSender _sender;
        private readonly IAccountAgeProvider _accounts;
        private readonly ILogger<PanicModeService> _logger;

        // Disparo automático: momentos de follows y de cuentas nuevas que escribieron, por canal
        private static readonly ConcurrentDictionary<string, Queue<DateTime>> _follows = new();
        private static readonly ConcurrentDictionary<string, Queue<DateTime>> _newAccounts = new();
        // Quién ya fue contado como cuenta nueva en cada canal (una vez por persona)
        private static readonly ConcurrentDictionary<string, DateTime> _seenNewAccount = new();

        public PanicModeService(IConfiguration configuration, TwitchApiService twitch, IMessageSender sender,
            IAccountAgeProvider accounts, ILogger<PanicModeService> logger)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
            _twitch = twitch;
            _sender = sender;
            _accounts = accounts;
            _logger = logger;
        }

        public async Task<(PanicSettings Settings, PanicState State)> GetAsync(string channel)
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand(@"
                SELECT settings::text, active, started_at, ends_at, triggered_by, reason
                FROM moderation_panic WHERE channel_name = @channel", conn);
            cmd.Parameters.AddWithValue("channel", channel.ToLower());

            await using var reader = await cmd.ExecuteReaderAsync();
            if (!await reader.ReadAsync())
                return (PanicSettings.Parse(null), new PanicState(false, null, null, null, null));

            return (PanicSettings.Parse(reader.GetString(0)), new PanicState(
                reader.GetBoolean(1),
                reader.IsDBNull(2) ? null : reader.GetDateTime(2),
                reader.IsDBNull(3) ? null : reader.GetDateTime(3),
                reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetString(5)));
        }

        public async Task SaveSettingsAsync(string channel, long channelUserId, PanicSettings settings)
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO moderation_panic (channel_name, user_id, settings, updated_at)
                VALUES (@channel, @userId, CAST(@settings AS jsonb), NOW())
                ON CONFLICT (channel_name) DO UPDATE SET settings = EXCLUDED.settings, updated_at = NOW()", conn);
            cmd.Parameters.AddWithValue("channel", channel.ToLower());
            cmd.Parameters.AddWithValue("userId", channelUserId);
            cmd.Parameters.AddWithValue("settings", settings.Serialize());
            await cmd.ExecuteNonQueryAsync();
        }

        /// <summary>
        /// Activa el pánico. Si ya estaba activo, solo extiende el tiempo. Devuelve cuándo termina.
        /// </summary>
        public async Task<DateTime?> ActivateAsync(string channel, long channelUserId, string triggeredBy, string reason)
        {
            channel = channel.ToLower();
            var (settings, state) = await GetAsync(channel);
            var endsAt = DateTime.Now.AddMinutes(settings.DurationMinutes);

            if (state.Active)
            {
                await ExecAsync("UPDATE moderation_panic SET ends_at = @endsAt, updated_at = NOW() WHERE channel_name = @channel",
                    ("channel", channel), ("endsAt", endsAt));
                PanicRegistry.Set(channel, endsAt);
                return endsAt;
            }

            // Con Shield Mode, Twitch aplica sus propios ajustes (los que el streamer eligió en las
            // herramientas de moderación) y al apagarlo devuelve el chat como estaba. Si además se
            // tocan los modos, el Shield los pisa y al apagarse "restaura" los del pánico: por eso
            // son excluyentes.
            // Sin Shield: guardar cómo estaba cada campo que se va a tocar, para devolverlo igual.
            var changes = new Dictionary<string, object?>();
            if (!settings.ShieldMode)
            {
                if (settings.FollowersOnly) { changes["follower_mode"] = true; changes["follower_mode_duration"] = settings.FollowersMinutes; }
                if (settings.EmoteOnly) changes["emote_mode"] = true;
                if (settings.SubscribersOnly) changes["subscriber_mode"] = true;
                if (settings.SlowSeconds > 0) { changes["slow_mode"] = true; changes["slow_mode_wait_time"] = settings.SlowSeconds; }
            }

            Dictionary<string, object?>? previous = null;
            if (changes.Count > 0)
            {
                var current = await _twitch.GetChatSettingsAsync(channel);
                if (current.HasValue)
                {
                    previous = changes.Keys.ToDictionary(k => k, k =>
                        current.Value.TryGetProperty(k, out var v) ? (object?)(v.ValueKind switch
                        {
                            JsonValueKind.True => true,
                            JsonValueKind.False => false,
                            JsonValueKind.Number => v.GetInt32(),
                            _ => null
                        }) : null);
                }
                await _twitch.UpdateChatSettingsAsync(channel, changes);
            }

            var shieldApplied = settings.ShieldMode && await _twitch.SetShieldModeAsync(channel, true);

            await using (var conn = new NpgsqlConnection(_connectionString))
            {
                await conn.OpenAsync();
                await using var cmd = new NpgsqlCommand(@"
                    INSERT INTO moderation_panic (channel_name, user_id, settings, active, started_at, ends_at, triggered_by, reason, previous_chat_settings, shield_applied, updated_at)
                    VALUES (@channel, @userId, CAST(@settings AS jsonb), TRUE, NOW(), @endsAt, @by, @reason, CAST(@previous AS jsonb), @shield, NOW())
                    ON CONFLICT (channel_name) DO UPDATE SET active = TRUE, started_at = NOW(), ends_at = @endsAt, triggered_by = @by,
                        reason = @reason, previous_chat_settings = CAST(@previous AS jsonb), shield_applied = @shield, updated_at = NOW()", conn);
                cmd.Parameters.AddWithValue("channel", channel);
                cmd.Parameters.AddWithValue("userId", channelUserId);
                cmd.Parameters.AddWithValue("settings", settings.Serialize());
                cmd.Parameters.AddWithValue("endsAt", endsAt);
                cmd.Parameters.AddWithValue("by", triggeredBy.ToLower());
                cmd.Parameters.AddWithValue("reason", reason.Length > 200 ? reason[..200] : reason);
                cmd.Parameters.AddWithValue("previous", previous == null ? (object)DBNull.Value : JsonSerializer.Serialize(previous));
                cmd.Parameters.AddWithValue("shield", shieldApplied);
                await cmd.ExecuteNonQueryAsync();
            }

            PanicRegistry.Set(channel, endsAt);
            _logger.LogWarning("[PÁNICO] Activado en {Channel} por {By} ({Reason}) hasta {EndsAt}", channel, triggeredBy, reason, endsAt);

            if (settings.Announce)
                await _sender.SendMessageAsync(channel, $"🚨 Modo pánico activado ({reason}). {Describe(settings)} Se desactiva solo en {settings.DurationMinutes} min.");

            return endsAt;
        }

        /// <summary>
        /// Apaga el pánico y devuelve el chat como estaba. false si no estaba activo.
        /// </summary>
        public async Task<bool> DeactivateAsync(string channel, string by)
        {
            channel = channel.ToLower();

            string? previousJson = null;
            bool shieldApplied = false, announce = true;
            await using (var conn = new NpgsqlConnection(_connectionString))
            {
                await conn.OpenAsync();
                // Tomar y apagar en un solo paso: si el job y un mod lo apagan a la vez, lo restaura uno solo
                await using var cmd = new NpgsqlCommand(@"
                    UPDATE moderation_panic SET active = FALSE, updated_at = NOW()
                    WHERE channel_name = @channel AND active
                    RETURNING previous_chat_settings::text, shield_applied, settings::text", conn);
                cmd.Parameters.AddWithValue("channel", channel);
                await using var reader = await cmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                {
                    PanicRegistry.Clear(channel);
                    return false;
                }
                previousJson = reader.IsDBNull(0) ? null : reader.GetString(0);
                shieldApplied = reader.GetBoolean(1);
                announce = PanicSettings.Parse(reader.GetString(2)).Announce;
            }

            PanicRegistry.Clear(channel);

            // Primero el Shield: si quedara activo, Twitch pisaría lo que se restaura
            if (shieldApplied)
                await _twitch.SetShieldModeAsync(channel, false);

            if (previousJson != null)
            {
                var previous = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(previousJson) ?? new();
                var restore = previous
                    .Where(kv => kv.Value.ValueKind is JsonValueKind.True or JsonValueKind.False or JsonValueKind.Number)
                    .ToDictionary(kv => kv.Key, kv => (object?)(kv.Value.ValueKind == JsonValueKind.Number ? kv.Value.GetInt32() : kv.Value.GetBoolean()));
                // Twitch rechaza la duración/espera si el modo queda apagado
                if (restore.TryGetValue("follower_mode", out var fm) && fm is false) restore.Remove("follower_mode_duration");
                if (restore.TryGetValue("slow_mode", out var sm) && sm is false) restore.Remove("slow_mode_wait_time");
                if (restore.Count > 0)
                    await _twitch.UpdateChatSettingsAsync(channel, restore);
            }

            _logger.LogWarning("[PÁNICO] Desactivado en {Channel} por {By}", channel, by);
            if (announce)
                await _sender.SendMessageAsync(channel, "✅ Modo pánico desactivado: el chat vuelve a la normalidad.");
            return true;
        }

        /// <summary>
        /// Canales con el pánico vencido (para el job que los apaga)
        /// </summary>
        public async Task<List<string>> GetExpiredAsync()
        {
            var list = new List<string>();
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand("SELECT channel_name FROM moderation_panic WHERE active AND ends_at <= NOW()", conn);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync()) list.Add(reader.GetString(0));
            return list;
        }

        /// <summary>
        /// Carga en memoria los pánicos activos (al arrancar el bot)
        /// </summary>
        public async Task LoadActiveAsync()
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand("SELECT channel_name, ends_at FROM moderation_panic WHERE active AND ends_at > NOW()", conn);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync()) PanicRegistry.Set(reader.GetString(0), reader.GetDateTime(1));
        }

        /// <summary>
        /// Un follow nuevo: si el canal tiene el disparo por follows y se pasa el umbral, activa el pánico.
        /// </summary>
        public async Task OnFollowAsync(string channel)
        {
            channel = channel.ToLower();
            if (PanicRegistry.IsActive(channel)) return;

            var (settings, _) = await GetCachedSettingsAsync(channel);
            if (!settings.AutoOnFollows) return;

            if (Hit(_follows, channel, settings.AutoWindowSeconds) >= settings.FollowsThreshold)
            {
                _follows.TryRemove(channel, out _);
                await ActivateAsync(channel, await ResolveChannelUserIdAsync(channel), "decatron", $"{settings.FollowsThreshold}+ follows en {settings.AutoWindowSeconds} s");
            }
        }

        /// <summary>
        /// Alguien escribió: si tiene cuenta nueva y el canal tiene ese disparo, cuenta para el umbral.
        /// </summary>
        public async Task OnChatAsync(string channel, string twitchUserId)
        {
            channel = channel.ToLower();
            if (string.IsNullOrEmpty(twitchUserId) || PanicRegistry.IsActive(channel)) return;

            var (settings, _) = await GetCachedSettingsAsync(channel);
            if (!settings.AutoOnNewAccounts) return;

            var key = $"{channel}:{twitchUserId}";
            if (_seenNewAccount.TryGetValue(key, out var seen) && DateTime.UtcNow - seen < TimeSpan.FromSeconds(settings.AutoWindowSeconds))
                return;

            var createdAt = await _accounts.GetCreatedAtAsync(twitchUserId);
            if (createdAt == null || (DateTime.UtcNow - createdAt.Value).TotalDays >= settings.NewAccountDays)
                return;

            _seenNewAccount[key] = DateTime.UtcNow;
            if (_seenNewAccount.Count > 50_000) _seenNewAccount.Clear();

            if (Hit(_newAccounts, channel, settings.AutoWindowSeconds) >= settings.NewAccountsThreshold)
            {
                _newAccounts.TryRemove(channel, out _);
                await ActivateAsync(channel, await ResolveChannelUserIdAsync(channel), "decatron", $"{settings.NewAccountsThreshold}+ cuentas nuevas escribiendo en {settings.AutoWindowSeconds} s");
            }
        }

        private async Task<(PanicSettings, bool)> GetCachedSettingsAsync(string channel)
        {
            if (ModerationCache.TryGet<PanicSettings>("panic", channel, out var cached) && cached != null)
                return (cached, true);
            var (settings, _) = await GetAsync(channel);
            ModerationCache.Set("panic", channel, settings);
            return (settings, false);
        }

        /// <summary>Registra un evento y devuelve cuántos hubo dentro de la ventana</summary>
        private static int Hit(ConcurrentDictionary<string, Queue<DateTime>> events, string channel, int windowSeconds)
        {
            var queue = events.GetOrAdd(channel, _ => new Queue<DateTime>());
            lock (queue)
            {
                var now = DateTime.UtcNow;
                queue.Enqueue(now);
                while (queue.Count > 0 && now - queue.Peek() > TimeSpan.FromSeconds(windowSeconds)) queue.Dequeue();
                return queue.Count;
            }
        }

        public static string Describe(PanicSettings s)
        {
            if (s.ShieldMode) return "Shield Mode activado.";
            var parts = new List<string>();
            if (s.FollowersOnly) parts.Add(s.FollowersMinutes > 0 ? $"solo seguidores de {s.FollowersMinutes} min" : "solo seguidores");
            if (s.EmoteOnly) parts.Add("solo emotes");
            if (s.SubscribersOnly) parts.Add("solo subs");
            if (s.SlowSeconds > 0) parts.Add($"modo lento de {s.SlowSeconds} s");
            return parts.Count == 0 ? "" : "Chat en " + string.Join(", ", parts) + ".";
        }

        private async Task<long> ResolveChannelUserIdAsync(string channel)
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand("SELECT user_id FROM moderation_panic WHERE channel_name = @channel", conn);
            cmd.Parameters.AddWithValue("channel", channel);
            return Convert.ToInt64(await cmd.ExecuteScalarAsync());
        }

        private async Task ExecAsync(string sql, params (string Name, object Value)[] args)
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, conn);
            foreach (var (name, value) in args) cmd.Parameters.AddWithValue(name, value);
            await cmd.ExecuteNonQueryAsync();
        }
    }
}
