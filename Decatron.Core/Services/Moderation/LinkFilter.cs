using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Decatron.Core.Models;

namespace Decatron.Core.Services.Moderation
{
    /// <summary>
    /// Configuración del filtro de links (moderation_filters.settings)
    /// </summary>
    public class LinkFilterSettings
    {
        /// <summary>Dominios que sí pasan (incluye subdominios). Vacío = no pasa ninguno.</summary>
        public List<string> AllowedDomains { get; set; } = new();
        public bool AllowSubscribers { get; set; }
        public bool AllowVips { get; set; }
        /// <summary>Detectar "dominio . com", "dominio(dot)com", "dominio[.]com"...</summary>
        public bool DetectObfuscated { get; set; } = true;
        /// <summary>Cuánto dura un !permit</summary>
        public int PermitSeconds { get; set; } = 60;
        /// <summary>El !permit se gasta con el primer mensaje con link</summary>
        public bool PermitSingleMessage { get; set; }

        private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

        public static LinkFilterSettings Parse(string? json)
        {
            LinkFilterSettings settings;
            try { settings = JsonSerializer.Deserialize<LinkFilterSettings>(string.IsNullOrWhiteSpace(json) ? "{}" : json, JsonOptions) ?? new(); }
            catch (JsonException) { settings = new(); }

            settings.AllowedDomains = settings.AllowedDomains
                .Select(LinkDetector.NormalizeDomain)
                .Where(d => d != null)
                .Select(d => d!)
                .Distinct()
                .ToList();
            settings.PermitSeconds = Math.Clamp(settings.PermitSeconds, 10, 3600);
            return settings;
        }
    }

    /// <summary>
    /// Links en el chat. Con el filtro encendido no pasa ninguno salvo los dominios
    /// permitidos, los roles autorizados o quien tenga un !permit vigente.
    /// </summary>
    public class LinkFilter : IModerationFilter
    {
        public const string FilterKey = "links";
        public string Key => FilterKey;

        public Task<FilterHit?> CheckAsync(ModerationMessage message, ModerationFilter config)
        {
            var settings = LinkFilterSettings.Parse(config.Settings);

            if ((settings.AllowSubscribers && message.IsSubscriber) || (settings.AllowVips && message.IsVip))
                return Task.FromResult<FilterHit?>(null);

            var blocked = LinkDetector.FindHosts(message.Text, settings.DetectObfuscated)
                .FirstOrDefault(host => !LinkDetector.IsAllowed(host, settings.AllowedDomains));
            if (blocked == null)
                return Task.FromResult<FilterHit?>(null);

            if (!string.IsNullOrEmpty(message.Username) && LinkPermits.TryUse(message.Channel, message.Username))
                return Task.FromResult<FilterHit?>(null);

            return Task.FromResult<FilterHit?>(new FilterHit
            {
                FilterKey = FilterKey,
                Severity = config.Severity,
                Detail = blocked,
                Reason = "Link no permitido",
                MinimumAction = "delete",
                DefaultMessage = "🔗 $(user), no se permiten links sin permiso de un moderador. Strike $(strike)/5"
            });
        }
    }

    /// <summary>
    /// Permisos de !permit vigentes. En memoria: duran segundos o minutos, un reinicio
    /// del bot solo obliga a pedir otro.
    /// </summary>
    public static class LinkPermits
    {
        private static readonly ConcurrentDictionary<string, (DateTime ExpiresAt, bool SingleMessage)> _permits = new();

        public static void Grant(string channel, string username, int seconds, bool singleMessage) =>
            _permits[Key(channel, username)] = (DateTime.UtcNow.AddSeconds(seconds), singleMessage);

        /// <summary>true si el usuario tiene permiso ahora; si era de un solo mensaje, se gasta.</summary>
        public static bool TryUse(string channel, string username)
        {
            var key = Key(channel, username);
            if (!_permits.TryGetValue(key, out var permit))
                return false;

            if (permit.ExpiresAt <= DateTime.UtcNow)
            {
                _permits.TryRemove(key, out _);
                return false;
            }

            if (permit.SingleMessage)
                _permits.TryRemove(key, out _);
            return true;
        }

        private static string Key(string channel, string username) =>
            $"{channel.ToLower()}:{username.TrimStart('@').ToLower()}";
    }

    /// <summary>
    /// Encuentra los dominios de los links de un mensaje, también los disfrazados.
    /// </summary>
    public static class LinkDetector
    {
        // Solo se reconoce como dominio lo que termina en un TLD real: así "3.5", "jaja.xd" o
        // "v1.2" no cuentan. Se dejan fuera ccTLD que son palabras comunes del chat (no, se).
        private const string Tlds =
            "com|net|org|info|biz|edu|gov|io|co|gg|tv|me|xyz|online|site|store|shop|live|link|app|dev|club|top|vip|win|" +
            "bid|click|space|website|tech|fun|pro|cloud|icu|buzz|lol|stream|chat|social|news|blog|page|world|today|" +
            "ru|su|ly|be|to|fm|us|uk|es|mx|ar|pe|cl|br|de|fr|it|nl|pl|cn|jp|kr|in|eu|cc|ws|gl|gd|bz|ai|id|ph|vn|tk|ml|" +
            "ga|cf|gq|pw|sh|st|so|im|ms|ec|uy|py|bo|ve|gt|cr|pa|do|pt|ca|au|nz|ch|at|ua|tr|gs|ac|am|nu|re|is";

        // TLD de spam típico: solo con estos se unen "dominio . com" o "dominio dot com",
        // para no convertir en link una frase como "fin. es que...".
        private const string ObfuscationTlds = "com|net|org|io|gg|tv|xyz|ru|ly|online|site|store|shop|live|link|app|club|top|info|co";

        private static readonly TimeSpan Timeout = TimeSpan.FromMilliseconds(100);

        private static readonly Regex SchemeUrl = new(@"\b(?:https?|ftp)://([^\s/:?#]+)", RegexOptions.IgnoreCase | RegexOptions.Compiled, Timeout);

        private static readonly Regex BareDomain = new(
            @"(?<![\w@.\-])((?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+(?:" + Tlds + @"))(?![a-z0-9\-])",
            RegexOptions.IgnoreCase | RegexOptions.Compiled, Timeout);

        // dominio(dot)com, dominio [.] com, dominio{punto}com
        private static readonly Regex BracketDot = new(@"\s*[\(\[\{<]\s*(?:dot|punto|\.)\s*[\)\]\}>]\s*", RegexOptions.IgnoreCase | RegexOptions.Compiled, Timeout);
        // dominio dot com, dominio punto com
        private static readonly Regex WordDot = new(@"\s+(?:dot|punto)\s+(?=(?:" + ObfuscationTlds + @")\b)", RegexOptions.IgnoreCase | RegexOptions.Compiled, Timeout);
        // dominio . com, dominio .com, dominio. com
        private static readonly Regex SpacedDot = new(@"(?<=[a-z0-9])\s*\.\s*(?=(?:" + ObfuscationTlds + @")\b)", RegexOptions.IgnoreCase | RegexOptions.Compiled, Timeout);

        public static List<string> FindHosts(string text, bool detectObfuscated)
        {
            var hosts = new List<string>();
            if (string.IsNullOrWhiteSpace(text))
                return hosts;

            try
            {
                foreach (Match m in SchemeUrl.Matches(text))
                    Add(hosts, m.Groups[1].Value);

                var candidates = new List<string> { text };
                if (detectObfuscated)
                {
                    var normalized = SpacedDot.Replace(WordDot.Replace(BracketDot.Replace(text, "."), "."), ".");
                    if (normalized != text)
                        candidates.Add(normalized);
                }

                foreach (var candidate in candidates)
                    foreach (Match m in BareDomain.Matches(candidate))
                        Add(hosts, m.Groups[1].Value);
            }
            catch (RegexMatchTimeoutException)
            {
                // Mensaje armado para colgar el regex: se trata como link
                hosts.Add("mensaje-sospechoso");
            }

            return hosts;
        }

        public static bool IsAllowed(string host, IEnumerable<string> allowedDomains) =>
            allowedDomains.Any(d => host == d || host.EndsWith("." + d, StringComparison.Ordinal));

        /// <summary>
        /// "https://www.YouTube.com/watch?v=x" → "youtube.com". null si no parece un dominio.
        /// </summary>
        public static string? NormalizeDomain(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return null;

            var d = value.Trim().ToLowerInvariant();
            var scheme = d.IndexOf("://", StringComparison.Ordinal);
            if (scheme >= 0) d = d[(scheme + 3)..];
            d = d.Split('/', '?', '#', ':')[0];
            if (d.StartsWith("*.")) d = d[2..];
            if (d.StartsWith("www.")) d = d[4..];
            d = d.Trim('.');

            return Regex.IsMatch(d, @"^(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$") ? d : null;
        }

        private static void Add(List<string> hosts, string raw)
        {
            var host = NormalizeDomain(raw);
            if (host != null && !hosts.Contains(host))
                hosts.Add(host);
        }
    }
}
