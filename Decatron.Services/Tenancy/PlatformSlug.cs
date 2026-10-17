using System.Text.RegularExpressions;

namespace Decatron.Services.Tenancy;

/// <summary>Reglas del subdominio de un tenant (slug.decatron.top). Única fuente; el formulario de registro espeja las mismas.</summary>
public static class PlatformSlug
{
    public const int MinLength = 3;
    public const int MaxLength = 30;

    // 3-30, a-z 0-9 y guion; sin guion al inicio/fin ni guiones dobles.
    private static readonly Regex Shape = new(@"^[a-z0-9](?:[a-z0-9]|-(?!-))*[a-z0-9]$", RegexOptions.Compiled);

    public static readonly System.Collections.Generic.HashSet<string> Reserved = new(System.StringComparer.Ordinal)
    {
        "www", "api", "admin", "mail", "app", "panel", "login", "registro", "signup", "status", "docs", "help", "support",
        "billing", "static", "assets", "cdn", "ns1", "ns2", "smtp", "imap", "pop", "ftp", "ssh", "blog", "dev", "test",
        "staging", "prueba", "decatron", "twitch", "kick", "discord", "youtube", "root", "owner", "system", "platform",
        "overlay", "overlays", "hub", "grafana", "internal", "sandbox", "demo-admin",
    };

    /// <summary>null si es válido; si no, el código del motivo: invalid | reserved.</summary>
    public static string? Check(string? slug)
    {
        if (string.IsNullOrEmpty(slug) || slug.Length < MinLength || slug.Length > MaxLength || !Shape.IsMatch(slug)) return "invalid";
        return Reserved.Contains(slug) ? "reserved" : null;
    }
}
