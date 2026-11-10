using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Helpers;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;

namespace Decatron.Controllers
{
    /// <summary>
    /// Vista previa al compartir (Discord, X, WhatsApp…) de /convocatorias/fortnite-streamers y
    /// /torneos/{canal}/{edicion}. Mismo patrón que SongRequestSharePageController: nginx manda estas rutas acá,
    /// se devuelve el index.html de la app con las meta tags de la página y el navegador carga la app igual.
    /// Un torneo en borrador, inexistente o una convocatoria sin publicar devuelven las meta tags generales
    /// (no revela que existen). Si este backend cae, nginx sirve el index.html estático.
    /// </summary>
    [AllowAnonymous]
    [ApiExplorerSettings(IgnoreApi = true)]
    public class TournamentSharePageController : Controller
    {
        private static readonly TimeSpan MetaTtl = TimeSpan.FromSeconds(60);
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
        private static readonly Regex HeadTags = new(
            @"[ \t]*<title>.*?</title>[ \t]*\r?\n?|[ \t]*<meta\s+(?:name=""description""|property=""og:[a-z:_]+""|name=""twitter:[a-z:_]+"")[^>]*>[ \t]*\r?\n?",
            RegexOptions.Compiled | RegexOptions.Singleline | RegexOptions.IgnoreCase);

        private readonly DecatronDbContext _db;
        private readonly IWebHostEnvironment _env;
        private readonly IMemoryCache _cache;
        private readonly string _baseUrl;

        public TournamentSharePageController(DecatronDbContext db, IWebHostEnvironment env, IMemoryCache cache, IConfiguration configuration)
        {
            _db = db;
            _env = env;
            _cache = cache;
            _baseUrl = (configuration["SongRequest:PublicBaseUrl"] ?? "https://decatron.net").TrimEnd('/');
        }

        private sealed record ShareMeta(string Title, string Description, string Url, string? Image);

        [HttpGet("convocatorias/fortnite-streamers")]
        public Task<IActionResult> Call(CancellationToken ct) => ServeAsync("call", null, null, ct);

        [HttpGet("torneos/{channel}/{slug}")]
        public Task<IActionResult> Tournament(string channel, string slug, CancellationToken ct) => ServeAsync("t", channel, slug, ct);

        private async Task<IActionResult> ServeAsync(string kind, string? channel, string? slug, CancellationToken ct)
        {
            var indexPath = Path.Combine(_env.ContentRootPath, "ClientApp", "dist", "index.html");
            if (!System.IO.File.Exists(indexPath))
                return NotFound();

            ShareMeta? meta = null;
            try
            {
                var key = $"tour-share:{kind}:{channel?.ToLowerInvariant()}:{slug?.ToLowerInvariant()}";
                if (!_cache.TryGetValue(key, out meta))
                {
                    meta = kind == "call"
                        ? await BuildCallAsync(ct)
                        : await BuildTournamentAsync(channel!.Trim().ToLowerInvariant(), slug!.Trim().ToLowerInvariant(), ct);
                    _cache.Set(key, meta, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = MetaTtl });
                }
            }
            catch (Exception)
            {
                meta = null;
            }

            var html = await System.IO.File.ReadAllTextAsync(indexPath, ct);
            if (meta != null)
                html = Inject(html, meta);

            Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
            return Content(html, "text/html; charset=utf-8", Encoding.UTF8);
        }

        private string Absolute(string? url) =>
            string.IsNullOrWhiteSpace(url) ? "" : url.StartsWith("http", StringComparison.OrdinalIgnoreCase) ? url : _baseUrl + (url.StartsWith('/') ? url : "/" + url);

        private static string Trim(string value, int max)
        {
            value = Regex.Replace(value ?? "", @"\s+", " ").Trim();
            return value.Length <= max ? value : value[..(max - 1)].TrimEnd() + "…";
        }

        private async Task<ShareMeta?> BuildCallAsync(CancellationToken ct)
        {
            var published = await _db.Set<TournamentCallPage>().AsNoTracking()
                .Where(p => p.Id == 1).Select(p => p.Published).SingleOrDefaultAsync(ct);
            if (published == null)
                return null;
            var content = JsonSerializer.Deserialize<TournamentCallContent>(published, Json);
            if (content == null)
                return null;
            // Quien comparte un enlace lo hace sobre todo en español; el texto en inglés va si el español está vacío
            var copy = !string.IsNullOrWhiteSpace(content.Es?.Title) ? content.Es! : content.En;
            if (copy == null || string.IsNullOrWhiteSpace(copy.Title))
                return null;
            return new ShareMeta(Trim(copy.Title, 90), Trim(copy.Summary, 200), $"{_baseUrl}/convocatorias/fortnite-streamers", Absolute(content.ImageUrl));
        }

        private async Task<ShareMeta?> BuildTournamentAsync(string channel, string slug, CancellationToken ct)
        {
            var userId = await _db.Users.AsNoTracking()
                .Where(u => u.Login.ToLower() == channel && u.IsActive).Select(u => (int?)u.Id).FirstOrDefaultAsync(ct);
            if (userId == null)
                return null;
            var edition = await _db.TournamentEditions.AsNoTracking()
                .Where(e => e.ChannelOwnerId == userId && e.Slug == slug && e.Status != "draft")
                .Select(e => new { e.Name, e.Game, e.Mode, e.Region, e.StartsAt, e.BannerUrl, e.LogoUrl, e.MetaTitle, e.MetaDescription })
                .FirstOrDefaultAsync(ct);
            if (edition == null)
                return null;

            var title = string.IsNullOrWhiteSpace(edition.MetaTitle) ? edition.Name : edition.MetaTitle!;
            string description;
            if (!string.IsNullOrWhiteSpace(edition.MetaDescription))
                description = edition.MetaDescription!;
            else
            {
                var when = edition.StartsAt.HasValue ? $" Comienza el {edition.StartsAt.Value:dd/MM/yyyy}." : "";
                var game = string.IsNullOrWhiteSpace(edition.Game) ? "" : " de " + char.ToUpperInvariant(edition.Game[0]) + edition.Game[1..];
                description = $"Torneo{game} en el canal de {channel}.{when} Inscripciones, reglas y premios.";
            }
            var image = Absolute(!string.IsNullOrWhiteSpace(edition.BannerUrl) ? edition.BannerUrl : edition.LogoUrl);
            return new ShareMeta(Trim(title, 90), Trim(description, 200), $"{_baseUrl}/torneos/{channel}/{slug}", image);
        }

        private static string Inject(string html, ShareMeta meta)
        {
            static string E(string value) => value.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;").Replace("'", "&#39;");
            var hasImage = !string.IsNullOrEmpty(meta.Image);
            var sb = new StringBuilder();
            sb.AppendLine($"    <title>{E(meta.Title)}</title>");
            sb.AppendLine($"    <meta name=\"description\" content=\"{E(meta.Description)}\" />");
            sb.AppendLine("    <meta property=\"og:site_name\" content=\"Decatron\" />");
            sb.AppendLine("    <meta property=\"og:type\" content=\"website\" />");
            sb.AppendLine($"    <meta property=\"og:title\" content=\"{E(meta.Title)}\" />");
            sb.AppendLine($"    <meta property=\"og:description\" content=\"{E(meta.Description)}\" />");
            sb.AppendLine($"    <meta property=\"og:url\" content=\"{E(meta.Url)}\" />");
            sb.AppendLine($"    <meta name=\"twitter:card\" content=\"{(hasImage ? "summary_large_image" : "summary")}\" />");
            sb.AppendLine($"    <meta name=\"twitter:title\" content=\"{E(meta.Title)}\" />");
            sb.AppendLine($"    <meta name=\"twitter:description\" content=\"{E(meta.Description)}\" />");
            if (hasImage)
            {
                sb.AppendLine($"    <meta property=\"og:image\" content=\"{E(meta.Image!)}\" />");
                sb.AppendLine($"    <meta name=\"twitter:image\" content=\"{E(meta.Image!)}\" />");
            }

            var stripped = HeadTags.Replace(html, "");
            var close = stripped.IndexOf("</head>", StringComparison.OrdinalIgnoreCase);
            return close < 0 ? stripped : stripped.Insert(close, sb.ToString());
        }
    }
}
