using System.Text;
using System.Text.Json;

namespace Decatron.Core.Helpers;

/// <summary>Local navigation carried by signed Twitch state or server-side OAuth state.</summary>
public sealed record LoginReturn(string Origin, string Path)
{
    private const string Prefix = "login-return:";
    private static readonly HashSet<string> Origins = new(StringComparer.OrdinalIgnoreCase)
    {
        "https://decatron.net", "https://www.decatron.net",
        "https://twitch.decatron.net", "https://kick.decatron.net"
    };

    public static string? LocalPath(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 8192 || value.Any(char.IsControl) || value.Contains('\\')) return null;
        var path = value.StartsWith('/') ? value : "/" + value;
        var route = path.Split('?', '#')[0];
        string decoded;
        try { decoded = Uri.UnescapeDataString(route); } catch { return null; }
        if (decoded.Contains('%') || decoded.Contains('\\') || decoded.Contains(':') || decoded.Any(char.IsControl)
            || decoded.StartsWith("//") || decoded.Split('/').Any(s => s is "." or "..")
            || decoded.Equals("/login", StringComparison.OrdinalIgnoreCase)
            || decoded.StartsWith("/login/", StringComparison.OrdinalIgnoreCase)
            || decoded.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)) return null;
        return path;
    }

    public static LoginReturn? Create(string origin, string? path)
        => Origins.Contains(origin.TrimEnd('/'))
            ? new LoginReturn(origin.TrimEnd('/').ToLowerInvariant(), LocalPath(path) ?? "/dashboard") : null;

    public string Encode() => Prefix + Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(this)));

    public static LoginReturn? Decode(string? value)
    {
        if (value is null || !value.StartsWith(Prefix, StringComparison.Ordinal) || value.Length > 16384) return null;
        try
        {
            var result = JsonSerializer.Deserialize<LoginReturn>(Convert.FromBase64String(value[Prefix.Length..]));
            return result is not null && !string.IsNullOrEmpty(result.Origin) && !string.IsNullOrEmpty(result.Path) && Origins.Contains(result.Origin) && LocalPath(result.Path) == result.Path ? result : null;
        }
        catch (Exception ex) when (ex is FormatException or JsonException or ArgumentException) { return null; }
    }

    public string Query => "&redirect=" + Uri.EscapeDataString(Path);
}
