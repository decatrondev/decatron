using System.Globalization;
using System.Text.RegularExpressions;

namespace Decatron.Core.Models.ClipCommand
{
    /// <summary>
    /// Lee lo que viene después de <c>!clip</c>: <c>20</c>, <c>20s</c>, <c>20 sec</c>, <c>20 título</c> o solo <c>título</c>.
    /// Si el primer token no es un número, todo es título. No valida rangos: eso lo hace el servicio con la config del canal.
    /// </summary>
    public static class ClipArgsParser
    {
        public record Parsed(decimal? Duration, string? Title);

        private static readonly Regex NumberToken = new(
            @"^(?<n>\d+(?:[.,]\d+)?)(?<u>s|sec|secs|seg|segs|segundo|segundos|second|seconds)?$",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly Regex UnitToken = new(
            @"^(s|sec|secs|seg|segs|segundo|segundos|second|seconds)$",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        public static Parsed Parse(string? args)
        {
            var text = (args ?? "").Trim();
            if (text.Length == 0) return new Parsed(null, null);

            var parts = text.Split((char[]?)null, 2, System.StringSplitOptions.RemoveEmptyEntries);
            var m = NumberToken.Match(parts[0]);
            if (!m.Success) return new Parsed(null, text);

            var number = decimal.Parse(m.Groups["n"].Value.Replace(',', '.'), CultureInfo.InvariantCulture);
            var rest = parts.Length > 1 ? parts[1].Trim() : "";

            // "20 sec título": la palabra de unidad se come solo si el número no la traía pegada
            if (!m.Groups["u"].Success && rest.Length > 0)
            {
                var next = rest.Split((char[]?)null, 2, System.StringSplitOptions.RemoveEmptyEntries);
                if (UnitToken.IsMatch(next[0]))
                    rest = next.Length > 1 ? next[1].Trim() : "";
            }

            return new Parsed(number, rest.Length > 0 ? rest : null);
        }
    }
}
