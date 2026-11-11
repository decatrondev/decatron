using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace Decatron.Core.Helpers;

/// <summary>Un enlace de la página: una red de la lista fija (Kind = clave de la red) o un enlace libre (Kind = "custom", con título).</summary>
/// <summary>Size: tamaño del enlace en las plantillas que lo usan (Inventario: casilla 1×1, 2×1 o 2×2; Póster: chico, mediano o grande). Las demás lo ignoran.</summary>
/// <summary>Adult: el enlace lleva a contenido para mayores de 18 (lo marca el dueño o se fuerza por la red o el dominio, subfase 5.2).</summary>
public sealed record PersonalPageLink(string Id = "", string Kind = "", string Url = "", string Title = "", bool Visible = true, string Size = "normal", bool Adult = false);

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
    List<PersonalPageLink>? Links = null,
    bool Adult = false,
    PersonalPageScene? Scene = null);

/// <summary>
/// Una capa de la escena (subfase 5.3). Kind: photo, name, bio (una de cada una), sticker (imagen o GIF de la galería) o
/// text (texto libre). Posición y tamaño en unidades del lienzo (<see cref="PersonalPageRules.SceneWidth"/> ×
/// <see cref="PersonalPageRules.SceneHeight"/>), que se escala como un overlay. El orden de la lista es el orden de dibujo.
/// </summary>
public sealed record PersonalPageLayer(
    string Id = "", string Kind = "", int X = 0, int Y = 0, int Width = 100, int Height = 100, bool Visible = true,
    string MediaUrl = "", string Text = "", string Font = "", string Color = "", int Size = 0, string Align = "left");

/// <summary>
/// Cabecera de la plantilla Escena como lienzo por capas (subfase 5.3). Apagada = diseño clásico; las capas se guardan
/// igual, así que volver al clásico o cambiar de plantilla no las borra. Background: color, pattern o media (imagen,
/// GIF o video de la galería; el video va sin sonido).
/// </summary>
public sealed record PersonalPageScene(
    bool Enabled = false, string Background = "pattern", string BgColor = "", string BgMedia = "", List<PersonalPageLayer>? Layers = null);

/// <summary>Una red de la lista fija: hosts válidos y si es un sitio para adultos (sus enlaces van siempre como +18).</summary>
public sealed record PersonalPagePlatform(string Key, string Name, string[] Hosts, bool Adult = false);

/// <summary>
/// Dominios que maneja admin (subfase 5.2): «adult» obliga a marcar +18 los enlaces que van ahí; «blocked» (estafas o enlaces
/// peligrosos) no se puede guardar y deja de mostrarse en la página pública. Se suman a las listas fijas de las reglas.
/// </summary>
public sealed record PersonalPageDomainPolicy(IReadOnlySet<string> Adult, IReadOnlySet<string> Blocked)
{
    public static readonly PersonalPageDomainPolicy Empty = new(new HashSet<string>(), new HashSet<string>());
}

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
    public const int ReportDetailMax = 1000;
    /// <summary>Denuncias por persona en 24 horas (freno contra abuso; el limitador por IP va aparte).</summary>
    public const int ReportsPerDay = 10;
    public const int DomainNoteMax = 300;

    // ---------- Escena por capas (5.3) ----------
    /// <summary>Lienzo de la escena: proporción 4:5, se escala igual que un overlay en celular y escritorio.</summary>
    public const int SceneWidth = 1080;
    public const int SceneHeight = 1350;
    /// <summary>Topes técnicos contra abuso, no de plan (decisión 2026-11-11).</summary>
    public const int SceneStickersMax = 20;
    public const int SceneTextsMax = 10;
    public const int LayerTextMax = 120;
    public static readonly string[] LayerKinds = { "photo", "name", "bio", "sticker", "text" };
    public static readonly string[] SceneBackgrounds = { "color", "pattern", "media" };
    public static readonly string[] LayerAligns = { "left", "center", "right" };

    public static readonly string[] ReportReasons = { "adult_unmarked", "scam", "impersonation", "hate", "copyright", "other" };
    /// <summary>Lo que admin puede hacer con una denuncia.</summary>
    public static readonly string[] ReportActions = { "dismiss", "hide", "force_adult", "block_domain" };
    public static readonly string[] DomainKinds = { "adult", "blocked" };

    /// <summary>
    /// Acortadores de enlaces: no se aceptan en enlaces propios porque esconden el destino real y se saltarían las listas
    /// de +18 y de estafas (decisión 2026-11-10).
    /// </summary>
    public static readonly HashSet<string> Shorteners = new(StringComparer.Ordinal)
    {
        "bit.ly", "bitly.com", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "v.gd", "buff.ly", "cutt.ly", "rebrand.ly", "shorturl.at",
        "tiny.cc", "s.id", "rb.gy", "t.ly", "bl.ink", "shorte.st", "adf.ly", "ouo.io", "lnkd.in", "trib.al", "soo.gd", "clck.ru", "qr.ae",
        "short.io", "tiny.one", "u.to", "x.gd", "y2u.be", "1url.com", "chilp.it", "shrtco.de",
    };

    /// <summary>Sitios para adultos conocidos: sus enlaces van siempre como +18 aunque el dueño no los marque. Admin suma más.</summary>
    public static readonly HashSet<string> BuiltInAdultDomains = new(StringComparer.Ordinal)
    {
        "onlyfans.com", "fansly.com", "fanvue.com", "fancentro.com", "loyalfans.com", "justfor.fans", "manyvids.com", "clips4sale.com",
        "admireme.vip", "pornhub.com", "xvideos.com", "xnxx.com", "xhamster.com", "redtube.com", "youporn.com", "chaturbate.com",
        "stripchat.com", "bongacams.com", "cam4.com", "camsoda.com", "myfreecams.com", "livejasmin.com", "fapello.com", "fansone.co",
    };

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

    /// <summary>Host en minúsculas (punycode) de una URL absoluta, o vacío.</summary>
    public static string HostOf(string? url) =>
        Uri.TryCreate(url ?? "", UriKind.Absolute, out var uri) ? uri.IdnHost.ToLowerInvariant().TrimEnd('.') : "";

    /// <summary>El host es el dominio o un subdominio suyo (m.pornhub.com cae en pornhub.com; notpornhub.com no).</summary>
    public static bool DomainMatches(string host, string domain) =>
        host.Length > 0 && domain.Length > 0 && (host == domain || host.EndsWith("." + domain, StringComparison.Ordinal));

    private static bool InSet(string host, IEnumerable<string> domains) => domains.Any(d => DomainMatches(host, d));

    public static bool IsShortener(string host) => InSet(host, Shorteners);

    public static bool IsBlocked(string url, PersonalPageDomainPolicy policy) => InSet(HostOf(url), policy.Blocked);

    /// <summary>El enlace es +18 sí o sí: red para adultos, sitio conocido o dominio que admin marcó como adulto.</summary>
    public static bool ForcedAdult(PersonalPageLink link, PersonalPageDomainPolicy policy)
    {
        if (Platform(link.Kind)?.Adult == true) return true;
        var host = HostOf(link.Url);
        return InSet(host, BuiltInAdultDomains) || InSet(host, policy.Adult);
    }

    /// <summary>Hosts de las redes de la lista fija que no son para adultos: admin no puede bloquearlos ni marcarlos como adultos enteros.</summary>
    public static bool IsProtectedHost(string domain) =>
        domain is "decatron.net" or "decatron.top" || domain.EndsWith(".decatron.net") ||
        Platforms.Where(p => !p.Adult).SelectMany(p => p.Hosts).Any(h => h == domain || DomainMatches(h, domain));

    /// <summary>
    /// Dominio que escribe admin, normalizado: acepta «https://www.sitio.com/ruta» y deja «sitio.com». null si no es un dominio válido.
    /// </summary>
    public static string? NormalizeDomain(string? input)
    {
        var raw = (input ?? "").Trim().ToLowerInvariant();
        if (raw.Length == 0 || raw.Length > 260) return null;
        if (!raw.Contains("://")) raw = "https://" + raw;
        if (!Uri.TryCreate(raw, UriKind.Absolute, out var uri) || !string.IsNullOrEmpty(uri.UserInfo)) return null;
        var host = uri.IdnHost.ToLowerInvariant().TrimEnd('.');
        if (host.StartsWith("www.")) host = host[4..];
        return Regex.IsMatch(host, "^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$") ? host : null;
    }

    /// <summary>
    /// Marca como +18 lo que tiene que serlo (red, dominio o página forzada por admin). Se aplica al guardar y otra vez al
    /// mostrar, porque admin puede agregar dominios después.
    /// </summary>
    public static PersonalPageContent ApplyForced(PersonalPageContent c, PersonalPageDomainPolicy policy, bool pageForced) => c with
    {
        Adult = c.Adult || pageForced,
        Links = (c.Links ?? new()).Select(l => ForcedAdult(l, policy) ? l with { Adult = true } : l).ToList(),
    };

    /// <summary>Lo que ve el visitante: enlaces visibles, sin los de dominios bloqueados y con el +18 forzado aplicado.</summary>
    public static PersonalPageContent PublicView(PersonalPageContent c, PersonalPageDomainPolicy policy, bool pageForced)
    {
        var forced = ApplyForced(c, policy, pageForced);
        return forced with { Links = forced.Links!.Where(l => l.Visible && !IsBlocked(l.Url, policy)).ToList() };
    }

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
        Scene = c.Scene == null ? null : NormalizeScene(c.Scene),
    };

    private static PersonalPageScene NormalizeScene(PersonalPageScene s) => s with
    {
        Background = (s.Background ?? "").Trim().ToLowerInvariant(),
        BgColor = (s.BgColor ?? "").Trim().ToUpperInvariant(),
        BgMedia = (s.BgMedia ?? "").Trim(),
        Layers = (s.Layers ?? new()).Select(l => l with
        {
            Id = (l.Id ?? "").Trim(),
            Kind = (l.Kind ?? "").Trim().ToLowerInvariant(),
            MediaUrl = (l.MediaUrl ?? "").Trim(),
            Text = Clean(l.Text),
            Font = (l.Font ?? "").Trim().ToLowerInvariant(),
            Color = (l.Color ?? "").Trim().ToUpperInvariant(),
            Align = string.IsNullOrWhiteSpace(l.Align) ? "left" : l.Align.Trim().ToLowerInvariant(),
        }).ToList(),
    };

    /// <summary>
    /// Errores de la escena (vacío = válida). gallery: URL pública → tipo (image, gif, video) de los archivos de la galería
    /// del canal; null = no se revisan los archivos (pruebas de forma). Códigos: scene_background, scene_bg_color,
    /// scene_bg_media, scene_layers_count, layer_id:i, layer_kind:i, layer_repeated:i, layer_rect:i, layer_media:i,
    /// layer_text:i, layer_font:i, layer_color:i, layer_size:i, layer_align:i, scene_stickers_count, scene_texts_count.
    /// </summary>
    public static List<string> SceneErrors(PersonalPageScene s, IReadOnlyDictionary<string, string>? gallery)
    {
        var errors = new List<string>();
        if (!SceneBackgrounds.Contains(s.Background)) errors.Add("scene_background");
        if (s.BgColor.Length > 0 && !HexColor.IsMatch(s.BgColor)) errors.Add("scene_bg_color");
        if (s.Background == "media" && !GalleryOk(s.BgMedia, gallery, "image", "gif", "video")) errors.Add("scene_bg_media");
        var layers = s.Layers ?? new();
        if (layers.Count > SceneStickersMax + SceneTextsMax + 3) { errors.Add("scene_layers_count"); return errors; }
        if (layers.Count(l => l.Kind == "sticker") > SceneStickersMax) errors.Add("scene_stickers_count");
        if (layers.Count(l => l.Kind == "text") > SceneTextsMax) errors.Add("scene_texts_count");
        var ids = new HashSet<string>();
        var singles = new HashSet<string>();
        for (var i = 0; i < layers.Count; i++)
        {
            var l = layers[i];
            if (!LinkId.IsMatch(l.Id) || !ids.Add(l.Id)) { errors.Add($"layer_id:{i}"); continue; }
            if (!LayerKinds.Contains(l.Kind)) { errors.Add($"layer_kind:{i}"); continue; }
            if (l.Kind is "photo" or "name" or "bio" && !singles.Add(l.Kind)) errors.Add($"layer_repeated:{i}");
            // Puede salir en parte del lienzo (se recorta), pero no perderse lejos ni ser enorme
            if (l.Width < 8 || l.Height < 8 || l.Width > SceneWidth * 2 || l.Height > SceneHeight * 2 ||
                l.X < -l.Width || l.Y < -l.Height || l.X > SceneWidth || l.Y > SceneHeight)
                errors.Add($"layer_rect:{i}");
            if (l.Kind == "sticker" && !GalleryOk(l.MediaUrl, gallery, "image", "gif")) errors.Add($"layer_media:{i}");
            if (l.Kind == "text" && (l.Text.Length == 0 || l.Text.Length > LayerTextMax)) errors.Add($"layer_text:{i}");
            if (l.Font.Length > 0 && !Fonts.Contains(l.Font)) errors.Add($"layer_font:{i}");
            if (l.Color.Length > 0 && !HexColor.IsMatch(l.Color)) errors.Add($"layer_color:{i}");
            if (l.Size != 0 && (l.Size < 8 || l.Size > 400)) errors.Add($"layer_size:{i}");
            if (!LayerAligns.Contains(l.Align)) errors.Add($"layer_align:{i}");
        }
        return errors;
    }

    /// <summary>La URL es de un archivo de la galería del canal y de uno de los tipos pedidos (sin galería = solo la forma).</summary>
    private static bool GalleryOk(string url, IReadOnlyDictionary<string, string>? gallery, params string[] types)
    {
        if (string.IsNullOrEmpty(url) || url.Length > UrlMax || !url.StartsWith('/') || url.StartsWith("//") || url.Contains("..")) return false;
        return gallery == null || (gallery.TryGetValue(url, out var type) && types.Contains(type));
    }

    /// <summary>
    /// Escena que ve el visitante: sin capas ocultas y sin archivos que ya no están en la galería (se borraron después);
    /// si el fondo era un archivo borrado, vuelve al patrón.
    /// </summary>
    public static PersonalPageScene? SceneView(PersonalPageScene? s, IReadOnlyDictionary<string, string> gallery)
    {
        if (s == null) return null;
        var bgOk = s.Background != "media" || GalleryOk(s.BgMedia, gallery, "image", "gif", "video");
        return s with
        {
            Background = bgOk ? s.Background : "pattern",
            BgMedia = bgOk ? s.BgMedia : "",
            Layers = (s.Layers ?? new()).Where(l => l.Visible && (l.Kind != "sticker" || GalleryOk(l.MediaUrl, gallery, "image", "gif"))).ToList(),
        };
    }

    /// <summary>Archivos de la escena que ya no están en la galería (para avisar en el panel).</summary>
    public static List<string> MissingSceneMedia(PersonalPageScene? s, IReadOnlyDictionary<string, string> gallery)
    {
        var missing = new List<string>();
        if (s == null) return missing;
        if (s.Background == "media" && s.BgMedia.Length > 0 && !gallery.ContainsKey(s.BgMedia)) missing.Add(s.BgMedia);
        missing.AddRange((s.Layers ?? new()).Where(l => l.Kind == "sticker" && l.MediaUrl.Length > 0 && !gallery.ContainsKey(l.MediaUrl)).Select(l => l.MediaUrl));
        return missing.Distinct().ToList();
    }


    /// <summary>
    /// Errores del contenido ya normalizado, como códigos estables que el panel traduce (vacío = válido). Un borrador puede
    /// guardarse a medias; para publicar se exige además un nombre visible.
    /// </summary>
    public static List<string> Errors(PersonalPageContent c, bool forPublish, PersonalPageDomainPolicy? policy = null, IReadOnlyDictionary<string, string>? gallery = null)
    {
        policy ??= PersonalPageDomainPolicy.Empty;
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
                else if (IsShortener(HostOf(l.Url))) errors.Add($"link_shortener:{i}");
            }
            else
            {
                var platform = Platform(l.Kind);
                if (platform == null) { errors.Add($"link_kind:{i}"); continue; }
                if (l.Title.Length > TitleMax) errors.Add($"link_title:{i}");
                if (!SafeUrl(l.Url, platform)) errors.Add($"link_url:{i}");
            }
            if (SafeUrl(l.Url) && IsBlocked(l.Url, policy)) errors.Add($"link_blocked:{i}");
        }
        if (c.Scene != null) errors.AddRange(SceneErrors(c.Scene, gallery));
        return errors;
    }

    /// <summary>Contenido inicial de una página nueva: nombre del canal, su foto, plantilla Escena oscura y el acento dado.</summary>
    public static PersonalPageContent Initial(string displayName, string accent) =>
        new(DisplayName: Clean(displayName).Length > DisplayNameMax ? Clean(displayName)[..DisplayNameMax] : Clean(displayName),
            Accent: HexColor.IsMatch(accent) ? accent.ToUpperInvariant() : "#5B8CFF",
            Links: new());
}
