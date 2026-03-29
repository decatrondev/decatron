using System.Globalization;
using System.Text.Json;

namespace Decatron.Default.Helpers
{
    public class DisplayConfigDto
    {
        public bool ShowYears { get; set; } = true;
        public bool ShowMonths { get; set; } = true;
        public bool ShowWeeks { get; set; } = true;
        public bool ShowDays { get; set; } = true;
        public bool ShowHours { get; set; } = true;
        public bool ShowMinutes { get; set; } = true;
        public bool ShowSeconds { get; set; } = true;
    }

    public class InfoCommandConfigDto
    {
        public bool Enabled { get; set; } = true;
        public string Template { get; set; } = string.Empty;
        public int Cooldown { get; set; } = 30;
        /// <summary>
        /// Nivel mínimo para usar el comando. Jerarquía acumulativa:
        /// "everyone" → todos
        /// "subs"     → subs + VIPs + mods + broadcaster
        /// "vips"     → VIPs + mods + broadcaster
        /// "mods"     → mods + broadcaster
        /// </summary>
        public string PermissionLevel { get; set; } = "everyone";
        public string[] Blacklist { get; set; } = Array.Empty<string>();
        public string[] Whitelist { get; set; } = Array.Empty<string>();
    }

    /// <summary>
    /// Verifica permisos para comandos informativos del timer usando jerarquía acumulativa.
    /// </summary>
    public static class InfoCommandPermissions
    {
        /// <summary>
        /// Jerarquía (de más restrictivo a más permisivo):
        ///   mods → vips → subs → everyone
        /// Cada nivel incluye todos los superiores.
        /// Blacklist siempre bloquea; whitelist siempre permite (excepto si está en blacklist).
        /// </summary>
        public static bool HasAccess(
            string username,
            string channel,
            bool isBroadcaster,
            bool isModerator,
            bool isVip,
            bool isSubscriber,
            InfoCommandConfigDto? cfg)
        {
            // Blacklist tiene prioridad absoluta
            if (cfg?.Blacklist != null && cfg.Blacklist.Any(u => u.Equals(username, StringComparison.OrdinalIgnoreCase)))
                return false;

            // Broadcaster siempre puede
            if (isBroadcaster || username.Equals(channel, StringComparison.OrdinalIgnoreCase))
                return true;

            // Whitelist siempre puede (excepto blacklisted)
            if (cfg?.Whitelist != null && cfg.Whitelist.Any(u => u.Equals(username, StringComparison.OrdinalIgnoreCase)))
                return true;

            var level = cfg?.PermissionLevel ?? "everyone";

            return level switch
            {
                "mods"     => isModerator,
                "vips"     => isModerator || isVip,
                "subs"     => isModerator || isVip || isSubscriber,
                "everyone" => true,
                _          => true  // fallback permisivo
            };
        }
    }

    public static class TimerTimeFormatter
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNameCaseInsensitive = true
        };

        public static DisplayConfigDto? ParseDisplayConfig(string? json)
        {
            if (string.IsNullOrEmpty(json) || json == "{}")
                return null;
            try
            {
                return JsonSerializer.Deserialize<DisplayConfigDto>(json, _jsonOptions);
            }
            catch
            {
                return null;
            }
        }

        public static InfoCommandConfigDto? GetInfoCommandConfig(string? commandsConfigJson, string commandKey)
        {
            if (string.IsNullOrEmpty(commandsConfigJson) || commandsConfigJson == "{}")
                return null;
            try
            {
                using var doc = JsonDocument.Parse(commandsConfigJson);
                var root = doc.RootElement;
                foreach (var prop in root.EnumerateObject())
                {
                    if (string.Equals(prop.Name, commandKey, StringComparison.OrdinalIgnoreCase))
                    {
                        return JsonSerializer.Deserialize<InfoCommandConfigDto>(prop.Value.GetRawText(), _jsonOptions);
                    }
                }
                return null;
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// Formatea segundos a texto en español respetando la configuración de display del timer.
        /// Ejemplo: "2 días, 4 horas y 30 minutos"
        /// </summary>
        public static string FormatSecondsSpanish(long totalSeconds, DisplayConfigDto? displayConfig)
        {
            if (totalSeconds <= 0)
                return "0 segundos";

            var years = totalSeconds / (365L * 86400);
            var rem = totalSeconds % (365L * 86400);
            var months = rem / (30L * 86400);
            rem %= 30L * 86400;
            var weeks = rem / (7L * 86400);
            rem %= 7L * 86400;
            var days = rem / 86400;
            rem %= 86400;
            var hours = rem / 3600;
            rem %= 3600;
            var minutes = rem / 60;
            var seconds = rem % 60;

            bool showAll = displayConfig == null;

            var parts = new List<string>();
            if ((showAll || displayConfig!.ShowYears) && years > 0)
                parts.Add($"{years} {(years == 1 ? "año" : "años")}");
            if ((showAll || displayConfig!.ShowMonths) && months > 0)
                parts.Add($"{months} {(months == 1 ? "mes" : "meses")}");
            if ((showAll || displayConfig!.ShowWeeks) && weeks > 0)
                parts.Add($"{weeks} {(weeks == 1 ? "semana" : "semanas")}");
            if ((showAll || displayConfig!.ShowDays) && days > 0)
                parts.Add($"{days} {(days == 1 ? "día" : "días")}");
            if ((showAll || displayConfig!.ShowHours) && hours > 0)
                parts.Add($"{hours} {(hours == 1 ? "hora" : "horas")}");
            if ((showAll || displayConfig!.ShowMinutes) && minutes > 0)
                parts.Add($"{minutes} {(minutes == 1 ? "minuto" : "minutos")}");
            if ((showAll || displayConfig!.ShowSeconds) && seconds > 0)
                parts.Add($"{seconds} {(seconds == 1 ? "segundo" : "segundos")}");

            if (parts.Count == 0)
                return "menos de un segundo";
            if (parts.Count == 1)
                return parts[0];

            var lastPart = parts[^1];
            parts.RemoveAt(parts.Count - 1);
            return string.Join(", ", parts) + " y " + lastPart;
        }

        /// <summary>
        /// Devuelve (fecha, hora) formateados en español para el timezone del streamer.
        /// </summary>
        public static (string fecha, string hora) FormatDateTimeParts(DateTime utcDt, string timezone)
        {
            var culture = new CultureInfo("es-ES");
            try
            {
                var tz = TimeZoneInfo.FindSystemTimeZoneById(timezone);
                var local = TimeZoneInfo.ConvertTimeFromUtc(utcDt, tz);
                return (local.ToString("dddd d 'de' MMMM", culture), local.ToString("h:mm tt", culture));
            }
            catch
            {
                return (utcDt.ToString("dddd d 'de' MMMM", culture), utcDt.ToString("h:mm tt", culture));
            }
        }
    }
}
