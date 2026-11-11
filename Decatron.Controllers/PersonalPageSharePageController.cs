using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Helpers;
using Decatron.Data;
using Decatron.Services.PersonalPages;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;

namespace Decatron.Controllers
{
    /// <summary>
    /// Vista previa al compartir decatron.net/@nombre (Discord, X, WhatsApp…). Mismo patrón que TournamentSharePageController:
    /// nginx manda la ruta acá, se devuelve el index.html con las meta tags y el navegador carga la app igual. Mientras las
    /// páginas no estén abiertas al público (PersonalPages:PublicOpen), o si la página no existe, está oculta o sin publicar,
    /// salen las meta tags generales (no revela nada). Una página +18 sale neutra (sin foto ni bio) y con noindex. Si este backend cae, nginx sirve el index.html estático.
    /// </summary>
    [AllowAnonymous]
    [ApiExplorerSettings(IgnoreApi = true)]
    public class PersonalPageSharePageController : Controller
    {
        private static readonly TimeSpan MetaTtl = TimeSpan.FromSeconds(60);
        private static readonly Regex HeadTags = new(
            @"[ \t]*<title>.*?</title>[ \t]*\r?\n?|[ \t]*<meta\s+(?:name=""description""|property=""og:[a-z:_]+""|name=""twitter:[a-z:_]+"")[^>]*>[ \t]*\r?\n?",
            RegexOptions.Compiled | RegexOptions.Singleline | RegexOptions.IgnoreCase);

        private readonly DecatronDbContext _db;
        private readonly IWebHostEnvironment _env;
        private readonly IMemoryCache _cache;
        private readonly IConfiguration _config;
        private readonly string _baseUrl;

        public PersonalPageSharePageController(DecatronDbContext db, IWebHostEnvironment env, IMemoryCache cache, IConfiguration configuration)
        {
            _db = db;
            _env = env;
            _cache = cache;
            _config = configuration;
            _baseUrl = (configuration["SongRequest:PublicBaseUrl"] ?? "https://decatron.net").TrimEnd('/');
        }

        private sealed record ShareMeta(string Title, string Description, string Url, string? Image, bool Adult = false);

        [HttpGet("@{handle}")]
        public async Task<IActionResult> Page(string handle, CancellationToken ct)
        {
            var indexPath = Path.Combine(_env.ContentRootPath, "ClientApp", "dist", "index.html");
            if (!System.IO.File.Exists(indexPath)) return NotFound();

            ShareMeta? meta = null;
            try
            {
                var normalized = PersonalPageRules.NormalizeHandle(handle);
                var key = $"pp-share:{normalized}";
                if (!_cache.TryGetValue(key, out meta))
                {
                    meta = await BuildAsync(normalized, ct);
                    _cache.Set(key, meta, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = MetaTtl });
                }
            }
            catch (Exception)
            {
                meta = null;
            }

            var html = await System.IO.File.ReadAllTextAsync(indexPath, ct);
            if (meta != null) html = Inject(html, meta);
            if (meta?.Adult == true) Response.Headers["X-Robots-Tag"] = "noindex, nofollow";
            Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
            return Content(html, "text/html; charset=utf-8", Encoding.UTF8);
        }

        private async Task<ShareMeta?> BuildAsync(string handle, CancellationToken ct)
        {
            if (!_config.GetValue<bool>("PersonalPages:PublicOpen")) return null;
            if (PersonalPageRules.HandleError(handle) is "length" or "chars" or "edge") return null;
            var page = await _db.PersonalPages.AsNoTracking()
                .Where(p => p.Handle == handle && p.Status == "active" && p.Published != null)
                .Select(p => new { p.Handle, p.Published, p.ChannelUserId, p.ForcedAdult })
                .FirstOrDefaultAsync(ct);
            if (page == null) return null;
            var content = PersonalPageService.Read(page.Published);
            // Página +18: vista previa neutra (sin foto, sin bio ni nombre propio) y sin indexar
            if (content.Adult || page.ForcedAdult)
                return new ShareMeta($"@{page.Handle}", "Página con enlaces para mayores de 18 años.", $"{_baseUrl}/@{page.Handle}", null, Adult: true);
            var name = string.IsNullOrWhiteSpace(content.DisplayName) ? $"@{page.Handle}" : content.DisplayName;
            var description = string.IsNullOrWhiteSpace(content.Bio) ? $"Redes y enlaces de {name}." : content.Bio;
            var image = content.AvatarUrl;
            if (string.IsNullOrWhiteSpace(image))
                image = await _db.Users.AsNoTracking().Where(u => u.Id == page.ChannelUserId)
                    .Select(u => string.IsNullOrEmpty(u.ProfileImageUrl) ? u.KickProfilePic : u.ProfileImageUrl).FirstOrDefaultAsync(ct);
            return new ShareMeta(Trim($"{name} (@{page.Handle})", 90), Trim(description, 200), $"{_baseUrl}/@{page.Handle}", Absolute(image));
        }

        private string? Absolute(string? url) =>
            string.IsNullOrWhiteSpace(url) ? null : url.StartsWith("http", StringComparison.OrdinalIgnoreCase) ? url : _baseUrl + (url.StartsWith('/') ? url : "/" + url);

        private static string Trim(string value, int max)
        {
            value = Regex.Replace(value ?? "", @"\s+", " ").Trim();
            return value.Length <= max ? value : value[..(max - 1)].TrimEnd() + "…";
        }

        private static string Inject(string html, ShareMeta meta)
        {
            static string E(string value) => value.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;").Replace("'", "&#39;");
            var hasImage = !string.IsNullOrEmpty(meta.Image);
            var sb = new StringBuilder();
            sb.AppendLine($"    <title>{E(meta.Title)}</title>");
            sb.AppendLine($"    <meta name=\"description\" content=\"{E(meta.Description)}\" />");
            if (meta.Adult) sb.AppendLine("    <meta name=\"robots\" content=\"noindex, nofollow\" />");
            sb.AppendLine("    <meta property=\"og:site_name\" content=\"Decatron\" />");
            sb.AppendLine("    <meta property=\"og:type\" content=\"profile\" />");
            sb.AppendLine($"    <meta property=\"og:title\" content=\"{E(meta.Title)}\" />");
            sb.AppendLine($"    <meta property=\"og:description\" content=\"{E(meta.Description)}\" />");
            sb.AppendLine($"    <meta property=\"og:url\" content=\"{E(meta.Url)}\" />");
            sb.AppendLine("    <meta name=\"twitter:card\" content=\"summary\" />");
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
