using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace Decatron.Core.Helpers;

/// <summary>Un enlace de la página: una red de la lista fija (Kind = clave de la red) o un enlace libre (Kind = "custom", con título).</summary>
/// <summary>Size: tamaño del enlace en las plantillas que lo usan (Inventario: casilla 1×1, 2×1 o 2×2; Póster: chico, mediano o grande). Las demás lo ignoran.</summary>
public sealed record PersonalPageLink(string Id = "", string Kind = "", string Url = "", string Title = "", bool Visible = true, string Size = "normal");

/// <summary>
/// Contenido de la página personal (borrador o publicado). Es común a todas las plantillas: la plantilla solo decide
/// cómo se dibuja, así que cambiar de plantilla no pierde nada. Avatar vacío = la foto del canal en Twitch/Kick.
/// </summary>
public sealed record PersonalPageContent(
    string DisplayName = "",
    string Bio = "",
    string AvatarUrl = "",
    string Template = "scene",
    string Theme = "dark",
    string Accent = "#5B8CFF",
    string Font = "archivo",
    List<PersonalPageLink>? Links = null);

/// <summary>Una red de la lista fija: hosts válidos y si es un sitio para adultos (lo usa la subfase 5.2).</summary>
public sealed record PersonalPagePlatform(string Key, string Name, string[] Hosts, bool Adult = false);

/// <summary>Reglas puras de la página personal (sin red, sin base, reloj por parámetro). Plan: .dev/plans/pagina-personal/PLAN.md §9.</summary>
public static class PersonalPageRules
{
    public const int HandleMin = 3;
    public const int HandleMax = 25;
    public const int DisplayNameMax = 50;
    public const int BioMax = 300;
    public const int TitleMax = 60;
    public const int UrlMax = 500;
    /// <summary>Tope técnico contra abuso, no de plan: los topes por tier llegan en la subfase 5.4.</summary>
    public const int LinksMax = 100;
    public static readonly TimeSpan HandleCooldown = TimeSpan.FromDays(30);
    public static readonly TimeSpan RedirectWindow = TimeSpan.FromDays(30);

    /// <summary>Escena, Credencial, Canal de TV, Inventario y Póster (maquetas en .dev/plans/pagina-personal/maquetas/).</summary>
    public static readonly string[] Templates = { "scene", "badge", "channel", "inventory", "poster" };
    public static readonly string[] LinkSizes = { "normal", "wide", "big" };
    public static readonly string[] Themes = { "dark", "light" };
    public static readonly string[] Fonts = { "archivo", "instrument-sans", "chivo", "saira", "big-shoulders", "source-sans-3", "atkinson", "literata" };

    public static readonly IReadOnlyList<PersonalPagePlatform> Platforms = new[]
    {
        new PersonalPagePlatform("twitch", "Twitch", new[] { "twitch.tv", "www.twitch.tv", "m.twitch.tv" }),
        new PersonalPagePlatform("kick", "Kick", new[] { "kick.com", "www.kick.com" }),
        new PersonalPagePlatform("youtube", "YouTube", new[] { "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be" }),
        new PersonalPagePlatform("tiktok", "TikTok", new[] { "tiktok.com", "www.tiktok.com" }),
        new PersonalPagePlatform("instagram", "Instagram", new[] { "instagram.com", "www.instagram.com" }),
        new PersonalPagePlatform("x", "X", new[] { "x.com", "www.x.com", "twitter.com", "www.twitter.com" }),
        new PersonalPagePlatform("discord", "Discord", new[] { "discord.gg", "discord.com", "www.discord.com" }),
        new PersonalPagePlatform("facebook", "Facebook", new[] { "facebook.com", "www.facebook.com", "m.facebook.com", "fb.com" }),
        new PersonalPagePlatform("threads", "Threads", new[] { "threads.net", "www.threads.net", "threads.com", "www.threads.com" }),
        new PersonalPagePlatform("bluesky", "Bluesky", new[] { "bsky.app" }),
        new PersonalPagePlatform("onlyfans", "OnlyFans", new[] { "onlyfans.com", "www.onlyfans.com" }, Adult: true),
        new PersonalPagePlatform("fansly", "Fansly", new[] { "fansly.com", "www.fansly.com" }, Adult: true),
    };

    /// <summary>
    /// Nombres que nadie puede tomar aunque no estén en la lista de admin: rutas de la app, palabras de sistema y
    /// marca. La lista editable de admin (personal_page_reserved_handles) se suma a esta.
    /// </summary>
    public static readonly HashSet<string> BuiltInReserved = new(StringComparer.Ordinal)
    {
        "admin", "administrador", "api", "app", "www", "mail", "email", "correo", "root", "system", "sistema", "soporte", "support",
        "help", "ayuda", "docs", "doc", "login", "logout", "registro", "register", "oauth", "auth", "panel", "dashboard", "overlay",
        "overlays", "embed", "sr", "sprites", "supporters", "tip", "tips", "donate", "torneos", "convocatorias", "commands", "emotes",
        "extension", "gacha", "multi", "translate", "privacidad", "terminos", "devoluciones", "libro-reclamaciones", "demo", "settings",
        "config", "decatron", "decatronbot", "decatronstreambot", "staff", "moderador", "moderator", "null", "undefined", "me", "yo",
        "static", "assets", "uploads", "hubs", "health", "status", "plataforma", "platform", "planes", "precios",
    };

    private static readonly Regex HandleShape = new("^[a-z0-9_-]+$", RegexOptions.Compiled);
    private static readonly Regex HexColor = new("^#[0-9a-fA-F]{6}$", RegexOptions.Compiled);
    private static readonly Regex LinkId = new("^[a-zA-Z0-9_-]{1,40}$", RegexOptions.Compiled);

    /// <summary>Minúsculas y sin espacios alrededor (no corrige el nombre: si trae caracteres raros, <see cref="HandleError"/> lo dice).</summary>
    public static string NormalizeHandle(string? handle) => (handle ?? "").Trim().TrimStart('@').ToLowerInvariant();

    /// <summary>null si el nombre (ya normalizado) es válido; si no, el código del problema: length, chars, edge o reserved.</summary>
    public static string? HandleError(string handle, ISet<string>? adminReserved = null)
    {
        if (handle.Length < HandleMin || handle.Length > HandleMax) return "length";
        if (!HandleShape.IsMatch(handle)) return "chars";
        if (handle[0] is '-' or '_' || handle[^1] is '-' or '_') return "edge";
        if (BuiltInReserved.Contains(handle) || (adminReserved?.Contains(handle) ?? false)) return "reserved";
        // Nombre provisional que se da a quien pierde el suyo por una apelación
        if (Regex.IsMatch(handle, "^pagina-[0-9]+$")) return "reserved";
        return null;
    }

    /// <summary>Sugerencia de nombre a partir del login del canal: se queda solo con lo válido y respeta el largo.</summary>
    public static string SuggestHandle(string? login)
    {
        var raw = new string(NormalizeHandle(login).Where(c => c is >= 'a' and <= 'z' or >= '0' and <= '9' or '_' or '-').ToArray()).Trim('_', '-');
        if (raw.Length > HandleMax) raw = raw[..HandleMax].Trim('_', '-');
        return raw;
    }

    /// <summary>Se puede cambiar el nombre: nunca se cambió (null) o pasaron 30 días desde el último cambio.</summary>
    public static bool CanChangeHandle(DateTimeOffset? lastChange, DateTimeOffset now) => lastChange == null || now - lastChange.Value >= HandleCooldown;

    /// <summary>Desde cuándo se puede volver a cambiar (null = ya se puede).</summary>
    public static DateTimeOffset? NextHandleChange(DateTimeOffset? lastChange, DateTimeOffset now) =>
        CanChangeHandle(lastChange, now) ? null : lastChange!.Value + HandleCooldown;

    /// <summary>Un nombre viejo redirige mientras no venza su ventana de 30 días.</summary>
    public static bool RedirectActive(DateTimeOffset validUntil, DateTimeOffset now) => now < validUntil;

    public static PersonalPagePlatform? Platform(string kind) => Platforms.FirstOrDefault(p => p.Key == kind);

    /// <summary>
    /// Enlace seguro: absoluto, solo https, sin usuario/clave, con host de verdad, largo razonable. Si se pasa una red,
    /// el host tiene que ser uno de los suyos (así «Instagram» no puede apuntar a cualquier sitio).
    /// </summary>
    public static bool SafeUrl(string? url, PersonalPagePlatform? platform = null)
    {
        if (string.IsNullOrWhiteSpace(url) || url.Length > UrlMax || url.Any(char.IsControl) || url.Any(char.IsWhiteSpace)) return false;
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) return false;
        if (uri.Scheme != Uri.UriSchemeHttps || !string.IsNullOrEmpty(uri.UserInfo) || !uri.IsDefaultPort) return false;
        var host = uri.IdnHost.ToLowerInvariant();
        if (!host.Contains('.') || host.EndsWith('.')) return false;
        if (platform != null && !platform.Hosts.Contains(host)) return false;
        return true;
    }

    /// <summary>Imagen propia (subida acá) o vacía. Las fotos externas solo se aceptan de los CDN de Twitch y Kick.</summary>
    public static bool SafeAvatar(string? url)
    {
        if (string.IsNullOrEmpty(url)) return true;
        if (Regex.IsMatch(url, "^/api/public/personal-pages/assets/[0-9]{1,18}/avatar-[0-9a-f]{32}\\.webp$")) return true;
        return SafeUrl(url) && Uri.TryCreate(url, UriKind.Absolute, out var u) && AllowedPhotoHost(u.IdnHost.ToLowerInvariant());
    }

    /// <summary>Hosts de fotos de perfil de los que el servidor puede leer la imagen (para sacar el color).</summary>
    public static bool AllowedPhotoHost(string host) => host == "static-cdn.jtvnw.net" || host == "files.kick.com" || host.EndsWith(".kick.com");

    /// <summary>Texto limpio: sin caracteres de control (salvo saltos de línea si se piden), espacios recortados.</summary>
    public static string Clean(string? text, bool multiline = false)
    {
        var chars = (text ?? "").Where(c => !char.IsControl(c) || (multiline && c == '\n')).ToArray();
        var value = new string(chars).Replace("\r", "").Trim();
        return multiline ? Regex.Replace(value, "\n{3,}", "\n\n") : value;
    }

    /// <summary>Normaliza el contenido que llega del editor (recorta, limpia, minúsculas en claves y color) sin validarlo.</summary>
    public static PersonalPageContent Normalize(PersonalPageContent c) => c with
    {
        DisplayName = Clean(c.DisplayName),
        Bio = Clean(c.Bio, multiline: true),
        AvatarUrl = (c.AvatarUrl ?? "").Trim(),
        Template = (c.Template ?? "").Trim().ToLowerInvariant(),
        Theme = (c.Theme ?? "").Trim().ToLowerInvariant(),
        Accent = (c.Accent ?? "").Trim().ToUpperInvariant(),
        Font = (c.Font ?? "").Trim().ToLowerInvariant(),
        Links = (c.Links ?? new()).Select(l => l with
        {
            Id = (l.Id ?? "").Trim(),
            Kind = (l.Kind ?? "").Trim().ToLowerInvariant(),
            Url = (l.Url ?? "").Trim(),
            Title = Clean(l.Title),
            Size = string.IsNullOrWhiteSpace(l.Size) ? "normal" : l.Size.Trim().ToLowerInvariant(),
        }).ToList(),
    };

    /// <summary>
    /// Errores del contenido ya normalizado, como códigos estables que el panel traduce (vacío = válido). Un borrador puede
    /// guardarse a medias; para publicar se exige además un nombre visible.
    /// </summary>
    public static List<string> Errors(PersonalPageContent c, bool forPublish)
    {
        var errors = new List<string>();
        if (c.DisplayName.Length > DisplayNameMax) errors.Add("display_name_length");
        if (forPublish && c.DisplayName.Length == 0) errors.Add("display_name_required");
        if (c.Bio.Length > BioMax) errors.Add("bio_length");
        if (!SafeAvatar(c.AvatarUrl)) errors.Add("avatar");
        if (!Templates.Contains(c.Template)) errors.Add("template");
        if (!Themes.Contains(c.Theme)) errors.Add("theme");
        if (!HexColor.IsMatch(c.Accent)) errors.Add("accent");
        if (!Fonts.Contains(c.Font)) errors.Add("font");
        var links = c.Links ?? new();
        if (links.Count > LinksMax) errors.Add("links_count");
        var ids = new HashSet<string>();
        for (var i = 0; i < links.Count && i < LinksMax; i++)
        {
            var l = links[i];
            if (!LinkId.IsMatch(l.Id) || !ids.Add(l.Id)) { errors.Add($"link_id:{i}"); continue; }
            if (!LinkSizes.Contains(l.Size)) errors.Add($"link_size:{i}");
            if (l.Kind == "custom")
            {
                if (l.Title.Length == 0 || l.Title.Length > TitleMax) errors.Add($"link_title:{i}");
                if (!SafeUrl(l.Url)) errors.Add($"link_url:{i}");
            }
            else
            {
                var platform = Platform(l.Kind);
                if (platform == null) { errors.Add($"link_kind:{i}"); continue; }
                if (l.Title.Length > TitleMax) errors.Add($"link_title:{i}");
                if (!SafeUrl(l.Url, platform)) errors.Add($"link_url:{i}");
            }
        }
        return errors;
    }

    /// <summary>Contenido inicial de una página nueva: nombre del canal, su foto, plantilla Escena oscura y el acento dado.</summary>
    public static PersonalPageContent Initial(string displayName, string accent) =>
        new(DisplayName: Clean(displayName).Length > DisplayNameMax ? Clean(displayName)[..DisplayNameMax] : Clean(displayName),
            Accent: HexColor.IsMatch(accent) ? accent.ToUpperInvariant() : "#5B8CFF",
            Links: new());
}
