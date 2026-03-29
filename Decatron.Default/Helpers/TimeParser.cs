using System.Text.RegularExpressions;

namespace Decatron.Default.Helpers
{
    /// <summary>
    /// Parser de tiempo que acepta formatos humanos como "1h", "30m", "1h30m45s", etc.
    /// </summary>
    public static class TimeParser
    {
        /// <summary>
        /// Parsea un string de tiempo a segundos totales.
        /// Formatos soportados:
        /// - Solo número: "300" = 300 segundos
        /// - Con unidades: "5m" = 300 segundos, "1h" = 3600 segundos
        /// - Combinado: "1h30m" = 5400 segundos
        /// - Completo: "1h30m45s" = 5445 segundos
        /// - Con días: "1d12h" = 129600 segundos
        /// Unidades: d (días), h (horas), m (minutos), s (segundos)
        /// </summary>
        public static bool TryParseTimeToSeconds(string input, out int seconds)
        {
            seconds = 0;

            if (string.IsNullOrWhiteSpace(input))
            {
                return false;
            }

            input = input.Trim().ToLower();

            // Si es solo un número, asumimos segundos
            if (int.TryParse(input, out seconds))
            {
                return seconds > 0;
            }

            // Pattern para capturar d, h, m, s
            var pattern = @"(?:(\d+)\s*d)?(?:\s*(\d+)\s*h)?(?:\s*(\d+)\s*m)?(?:\s*(\d+)\s*s)?";
            var match = Regex.Match(input, pattern, RegexOptions.IgnoreCase);

            if (!match.Success)
            {
                return false;
            }

            var days = match.Groups[1].Success ? int.Parse(match.Groups[1].Value) : 0;
            var hours = match.Groups[2].Success ? int.Parse(match.Groups[2].Value) : 0;
            var minutes = match.Groups[3].Success ? int.Parse(match.Groups[3].Value) : 0;
            var secs = match.Groups[4].Success ? int.Parse(match.Groups[4].Value) : 0;

            // Si todos son 0, no es válido
            if (days == 0 && hours == 0 && minutes == 0 && secs == 0)
            {
                return false;
            }

            seconds = (days * 86400) + (hours * 3600) + (minutes * 60) + secs;
            return seconds > 0;
        }

        /// <summary>
        /// Formatea segundos a un string legible.
        /// Ejemplos: "5m 30s", "1h 30m", "2d 5h 30m"
        /// </summary>
        public static string FormatSeconds(int totalSeconds)
        {
            if (totalSeconds <= 0)
            {
                return "0s";
            }

            var parts = new List<string>();

            var days = totalSeconds / 86400;
            totalSeconds %= 86400;

            var hours = totalSeconds / 3600;
            totalSeconds %= 3600;

            var minutes = totalSeconds / 60;
            var seconds = totalSeconds % 60;

            if (days > 0) parts.Add($"{days}d");
            if (hours > 0) parts.Add($"{hours}h");
            if (minutes > 0) parts.Add($"{minutes}m");
            if (seconds > 0 || parts.Count == 0) parts.Add($"{seconds}s");

            return string.Join(" ", parts);
        }

        /// <summary>
        /// Detecta si el input es un comando de añadir tiempo.
        /// Soporta: "+1h", "add 1h", "añadir 30m"
        /// </summary>
        public static bool IsAddTimeCommand(string input, out string timeValue)
        {
            timeValue = string.Empty;

            if (string.IsNullOrWhiteSpace(input))
            {
                return false;
            }

            input = input.Trim();

            // Formato: +1h, +30m, etc.
            if (input.StartsWith("+"))
            {
                timeValue = input.Substring(1).Trim();
                return true;
            }

            // Formato: add 1h, añadir 30m, agregar 5m
            var addPattern = @"^(add|añadir|agregar)\s+(.+)$";
            var match = Regex.Match(input, addPattern, RegexOptions.IgnoreCase);
            if (match.Success)
            {
                timeValue = match.Groups[2].Value.Trim();
                return true;
            }

            return false;
        }

        /// <summary>
        /// Detecta si el input es un comando de remover tiempo.
        /// Soporta: "-30s", "remove 30s", "remover 1m", "quitar 45s"
        /// </summary>
        public static bool IsRemoveTimeCommand(string input, out string timeValue)
        {
            timeValue = string.Empty;

            if (string.IsNullOrWhiteSpace(input))
            {
                return false;
            }

            input = input.Trim();

            // Formato: -30s, -1m, etc.
            if (input.StartsWith("-"))
            {
                timeValue = input.Substring(1).Trim();
                return true;
            }

            // Formato: remove 30s, remover 1m, quitar 45s
            var removePattern = @"^(remove|remover|quitar)\s+(.+)$";
            var match = Regex.Match(input, removePattern, RegexOptions.IgnoreCase);
            if (match.Success)
            {
                timeValue = match.Groups[2].Value.Trim();
                return true;
            }

            return false;
        }
    }
}
