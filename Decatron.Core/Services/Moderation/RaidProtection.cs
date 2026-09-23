using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Core.Models;

namespace Decatron.Core.Services.Moderation
{
    /// <summary>
    /// Qué hace el modo pánico y cuándo se dispara solo (moderation_panic.settings)
    /// </summary>
    public class PanicSettings
    {
        public int DurationMinutes { get; set; } = 10;

        // Qué aplica mientras dura
        public bool FollowersOnly { get; set; } = true;
        /// <summary>Minutos que hay que llevar siguiendo para escribir (0 = cualquier seguidor)</summary>
        public int FollowersMinutes { get; set; } = 10;
        public bool EmoteOnly { get; set; }
        public bool SubscribersOnly { get; set; }
        /// <summary>Segundos entre mensajes (0 = sin modo lento)</summary>
        public int SlowSeconds { get; set; }
        public bool ShieldMode { get; set; }
        /// <summary>Avisar en el chat al activarse y al apagarse</summary>
        public bool Announce { get; set; } = true;

        // Disparo automático (apagado por defecto)
        public bool AutoOnFollows { get; set; }
        public int FollowsThreshold { get; set; } = 20;
        public bool AutoOnNewAccounts { get; set; }
        public int NewAccountsThreshold { get; set; } = 5;
        /// <summary>Una cuenta es "nueva" si tiene menos de estos días</summary>
        public int NewAccountDays { get; set; } = 7;
        public int AutoWindowSeconds { get; set; } = 60;

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        public static PanicSettings Parse(string? json)
        {
            PanicSettings s;
            try { s = JsonSerializer.Deserialize<PanicSettings>(string.IsNullOrWhiteSpace(json) ? "{}" : json, JsonOptions) ?? new(); }
            catch (JsonException) { s = new(); }

            s.DurationMinutes = Math.Clamp(s.DurationMinutes, 1, 120);
            s.FollowersMinutes = Math.Clamp(s.FollowersMinutes, 0, 129600);
            s.SlowSeconds = s.SlowSeconds <= 0 ? 0 : Math.Clamp(s.SlowSeconds, 3, 120);
            s.FollowsThreshold = Math.Clamp(s.FollowsThreshold, 3, 1000);
            s.NewAccountsThreshold = Math.Clamp(s.NewAccountsThreshold, 2, 1000);
            s.NewAccountDays = Math.Clamp(s.NewAccountDays, 1, 365);
            s.AutoWindowSeconds = Math.Clamp(s.AutoWindowSeconds, 10, 600);
            return s;
        }

        public string Serialize() => JsonSerializer.Serialize(this, JsonOptions);
    }

    /// <summary>
    /// Canales con el pánico activo, en memoria (la fuente real es moderation_panic; esto evita
    /// ir a la base en cada mensaje). Lo mantiene PanicModeService.
    /// </summary>
    public static class PanicRegistry
    {
        private static readonly ConcurrentDictionary<string, DateTime> _active = new();

        public static void Set(string channel, DateTime endsAt) => _active[channel.ToLower()] = endsAt;
        public static void Clear(string channel) => _active.TryRemove(channel.ToLower(), out _);

        public static bool IsActive(string channel) =>
            _active.TryGetValue(channel.ToLower(), out var endsAt) && endsAt > DateTime.Now;
    }

    /// <summary>
    /// Fecha de creación de una cuenta de Twitch (la implementación va contra la API y cachea)
    /// </summary>
    public interface IAccountAgeProvider
    {
        Task<DateTime?> GetCreatedAtAsync(string twitchUserId);
    }

    // ───────────────────────── Cuentas nuevas ─────────────────────────

    public class AccountAgeSettings
    {
        public int MinDays { get; set; } = 7;
        /// <summary>Solo mientras el modo pánico está activo</summary>
        public bool OnlyDuringPanic { get; set; }
    }

    public class AccountAgeFilter : IModerationFilter
    {
        public const string FilterKey = "account_age";
        public string Key => FilterKey;

        private readonly IAccountAgeProvider _accounts;

        public AccountAgeFilter(IAccountAgeProvider accounts)
        {
            _accounts = accounts;
        }

        public async Task<FilterHit?> CheckAsync(ModerationMessage message, ModerationFilter config)
        {
            // Kick no informa la fecha de creación de las cuentas
            if (string.IsNullOrEmpty(message.ChatterUserId) || message.Platform != "twitch")
                return null;

            var settings = SpamFilter<AccountAgeSettings>.ParseSettings(config.Settings);
            if (settings.OnlyDuringPanic && !PanicRegistry.IsActive(message.Channel))
                return null;

            var createdAt = await _accounts.GetCreatedAtAsync(message.ChatterUserId);
            if (createdAt == null)
                return null;

            var days = (DateTime.UtcNow - createdAt.Value).TotalDays;
            if (days >= Math.Max(1, settings.MinDays))
                return null;

            var age = days < 1 ? $"{(int)(days * 24)} horas" : $"{(int)days} días";
            return new FilterHit
            {
                FilterKey = FilterKey,
                Severity = config.Severity,
                Detail = $"cuenta de {age}",
                Reason = "Cuenta demasiado nueva",
                MinimumAction = "delete",
                DefaultMessage = "🆕 $(user), tu cuenta es muy nueva para escribir en este chat."
            };
        }
    }

    // ───────────────────────── Frases de bots ─────────────────────────

    public class BotPhrasesSettings
    {
        /// <summary>null = la lista base</summary>
        public List<string>? Phrases { get; set; }
    }

    /// <summary>
    /// Frases típicas de los bots que venden viewers/seguidores. Compara sin espacios ni signos:
    /// "b e s t  viewers on" o "best-viewers-on" también cuentan.
    /// </summary>
    public class BotPhrasesFilter : IModerationFilter
    {
        public const string FilterKey = "bot_phrases";
        public string Key => FilterKey;

        public static readonly IReadOnlyList<string> DefaultPhrases = new[]
        {
            "wanna become famous",
            "buy followers",
            "followers, primes and viewers",
            "best viewers on",
            "cheap viewers on",
            "get viewers on",
            "viewers and followers on",
            "bigfollows",
            "dogehype",
            "streamboo",
        };

        // Frases que compactadas quedan muy cortas darían falsos positivos
        private const int MinCompactLength = 8;

        public Task<FilterHit?> CheckAsync(ModerationMessage message, ModerationFilter config)
        {
            var phrases = SpamFilter<BotPhrasesSettings>.ParseSettings(config.Settings).Phrases ?? DefaultPhrases.ToList();
            var text = Compact(message.Text);

            var match = phrases.FirstOrDefault(p =>
            {
                var compact = Compact(p);
                return compact.Length >= MinCompactLength && text.Contains(compact, StringComparison.Ordinal);
            });

            return Task.FromResult(match == null ? null : new FilterHit
            {
                FilterKey = FilterKey,
                Severity = config.Severity,
                Detail = match,
                Reason = "Spam de bot",
                MinimumAction = "delete",
                DefaultMessage = "🤖 $(user), nada de spam de bots en este chat."
            });
        }

        /// <summary>Solo letras y números, en minúsculas</summary>
        public static string Compact(string text)
        {
            var sb = new StringBuilder(text.Length);
            foreach (var c in text.ToLowerInvariant())
                if (char.IsLetterOrDigit(c)) sb.Append(c);
            return sb.ToString();
        }
    }
}
