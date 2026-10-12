namespace Decatron.Services.Multiview
{
    /// <summary>Una línea de IRC de Twitch ya separada: etiquetas, comando, parámetros y texto final.</summary>
    public sealed record IrcLine(IReadOnlyDictionary<string, string> Tags, string? Prefix, string Command, string[] Params, string? Trailing)
    {
        public string Tag(string name) => Tags.TryGetValue(name, out var v) ? v : "";

        public static IrcLine? Parse(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;
            var rest = raw;
            var tags = new Dictionary<string, string>(StringComparer.Ordinal);

            if (rest[0] == '@')
            {
                var sp = rest.IndexOf(' ');
                if (sp < 0) return null;
                foreach (var pair in rest[1..sp].Split(';'))
                {
                    var eq = pair.IndexOf('=');
                    if (eq <= 0) continue;
                    tags[pair[..eq]] = Unescape(pair[(eq + 1)..]);
                }
                rest = rest[(sp + 1)..];
            }

            string? prefix = null;
            if (rest.Length > 0 && rest[0] == ':')
            {
                var sp = rest.IndexOf(' ');
                if (sp < 0) return null;
                prefix = rest[1..sp];
                rest = rest[(sp + 1)..];
            }

            string? trailing = null;
            var t = rest.IndexOf(" :", StringComparison.Ordinal);
            if (t >= 0) { trailing = rest[(t + 2)..]; rest = rest[..t]; }

            var parts = rest.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 0) return null;
            return new IrcLine(tags, prefix, parts[0], parts[1..], trailing);
        }

        // Los valores de las etiquetas escapan el espacio, el punto y coma, la barra y los saltos de línea.
        private static string Unescape(string v)
        {
            if (v.IndexOf('\\') < 0) return v;
            var sb = new System.Text.StringBuilder(v.Length);
            for (var i = 0; i < v.Length; i++)
            {
                if (v[i] != '\\' || i == v.Length - 1) { sb.Append(v[i]); continue; }
                i++;
                sb.Append(v[i] switch { 's' => ' ', ':' => ';', 'r' => '\r', 'n' => '\n', '\\' => '\\', var c => c });
            }
            return sb.ToString();
        }
    }
}
