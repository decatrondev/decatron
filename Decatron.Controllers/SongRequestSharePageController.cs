using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models.SongRequest;
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
    /// La vista previa al compartir (Discord, X, WhatsApp…) de /sr/{canal} y /sr/{canal}/p/{código}
    /// (.dev/plans/SONG_REQUEST_PUBLIC_PLAYLISTS_PLAN.md, fase 3). Nginx manda estas dos rutas acá: se devuelve el
    /// index.html de la app con las meta tags de la página; el navegador carga la app igual que siempre.
    /// Una privada, inexistente o de un canal apagado devuelve las meta tags generales (no revela que existe).
    /// Si este backend está caído, nginx sirve el index.html estático.
    /// </summary>
    [AllowAnonymous]
    [ApiExplorerSettings(IgnoreApi = true)]
    public class SongRequestSharePageController : Controller
    {
        private static readonly TimeSpan MetaTtl = TimeSpan.FromSeconds(60);
        private static readonly Regex HeadTags = new(
            @"[ \t]*<title>.*?</title>[ \t]*\r?\n?|[ \t]*<meta\s+(?:name=""description""|property=""og:[a-z:_]+""|name=""twitter:[a-z:_]+"")[^>]*>[ \t]*\r?\n?",
            RegexOptions.Compiled | RegexOptions.Singleline | RegexOptions.IgnoreCase);

        private readonly DecatronDbContext _db;
        private readonly IWebHostEnvironment _env;
        private readonly IMemoryCache _cache;
        private readonly string _baseUrl;

        public SongRequestSharePageController(DecatronDbContext db, IWebHostEnvironment env, IMemoryCache cache, IConfiguration configuration)
        {
            _db = db;
            _env = env;
            _cache = cache;
            _baseUrl = (configuration["SongRequest:PublicBaseUrl"] ?? "https://decatron.net").TrimEnd('/');
        }

        private sealed record ShareMeta(string Title, string Description, string Url, string? Image, bool LargeImage);

        [HttpGet("sr/{channel}")]
        public Task<IActionResult> Channel(string channel, CancellationToken ct) => ServeAsync(channel, null, ct);

        [HttpGet("sr/{channel}/p/{code}")]
        public Task<IActionResult> Playlist(string channel, string code, CancellationToken ct) => ServeAsync(channel, code, ct);

        private async Task<IActionResult> ServeAsync(string channel, string? code, CancellationToken ct)
        {
            var indexPath = Path.Combine(_env.ContentRootPath, "ClientApp", "dist", "index.html");
            if (!System.IO.File.Exists(indexPath))
                return NotFound();

            ShareMeta? meta = null;
            try
            {
                var key = $"sr-share:{channel.ToLowerInvariant()}:{code?.ToLowerInvariant()}";
                if (!_cache.TryGetValue(key, out meta))
                {
                    meta = await BuildMetaAsync(channel.Trim().ToLowerInvariant(), code, ct);
                    _cache.Set(key, meta, MetaTtl);
                }
            }
            catch (Exception)
            {
                // Sin base o con un fallo cualquiera, la página igual carga con las meta tags generales
                meta = null;
            }

            var html = await System.IO.File.ReadAllTextAsync(indexPath, ct);
            if (meta != null)
                html = Inject(html, meta);

            Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
            return Content(html, "text/html; charset=utf-8", Encoding.UTF8);
        }

        private async Task<ShareMeta?> BuildMetaAsync(string channel, string? code, CancellationToken ct)
        {
            // Un canal solo de Kick tiene login "kick_<id>": su cola se encuentra por el nombre guardado en la config
            var config = await _db.SongRequestConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.ChannelName == channel, ct);
            if (config == null || !config.Enabled)
                return null;
            var user = await _db.Users.AsNoTracking()
                .Where(u => u.Id == config.UserId && u.IsActive)
                .Select(u => new
                {
                    DisplayName = u.KickId != null ? (u.KickUsername ?? u.DisplayName) : u.DisplayName,
                    Avatar = u.KickId != null ? (u.KickProfilePic ?? u.ProfileImageUrl) : u.ProfileImageUrl,
                    u.PreferredLanguage
                })
                .FirstOrDefaultAsync(ct);
            if (user == null)
                return null;

            var english = user.PreferredLanguage != null && user.PreferredLanguage.StartsWith("en", StringComparison.OrdinalIgnoreCase);
            var name = string.IsNullOrWhiteSpace(user.DisplayName) ? channel : user.DisplayName;
            var channelUrl = $"{_baseUrl}/sr/{channel}";

            if (code == null)
            {
                var playlists = await _db.SongRequestPlaylists.AsNoTracking()
                    .CountAsync(p => p.UserId == config.UserId && p.Visibility == SongRequestPlaylistVisibility.Public, ct);
                var description = english
                    ? $"Live song queue{(playlists > 0 ? $" and {playlists} public playlist{(playlists == 1 ? "" : "s")}" : "")} — request your song on {name}'s stream."
                    : $"Cola de canciones en vivo{(playlists > 0 ? $" y {playlists} playlist{(playlists == 1 ? "" : "s")} pública{(playlists == 1 ? "" : "s")}" : "")} — pide tu canción en el stream de {name}.";
                return new ShareMeta($"{name} — Song Request", description, channelUrl, user.Avatar, LargeImage: false);
            }

            var clean = code.Trim().ToLowerInvariant();
            if (clean.Length is 0 or > 16)
                return null;
            var playlist = await _db.SongRequestPlaylists.AsNoTracking()
                .Where(p => p.UserId == config.UserId && p.ShareCode == clean
                    && (p.Visibility == SongRequestPlaylistVisibility.Public || p.Visibility == SongRequestPlaylistVisibility.Unlisted))
                .Select(p => new { p.Id, p.Name })
                .FirstOrDefaultAsync(ct);
            if (playlist == null)
                return null;

            var count = await _db.SongRequestPlaylistItems.CountAsync(i => i.PlaylistId == playlist.Id, ct);
            var first = await _db.SongRequestPlaylistItems.AsNoTracking()
                .Where(i => i.PlaylistId == playlist.Id)
                .OrderBy(i => i.Position).ThenBy(i => i.Id)
                .Select(i => new { i.Track!.Source, i.Track.SourceId, i.Track.ThumbnailUrl })
                .FirstOrDefaultAsync(ct);
            // hqdefault existe en todos los videos; la miniatura guardada puede ser maxresdefault, que no siempre existe
            var cover = first == null ? null
                : first.Source == "youtube" && !string.IsNullOrEmpty(first.SourceId) ? $"https://i.ytimg.com/vi/{first.SourceId}/hqdefault.jpg"
                : first.ThumbnailUrl;

            var text = english
                ? $"{count} song{(count == 1 ? "" : "s")} · listen to it for free"
                : $"{count} canción{(count == 1 ? "" : "es")} · escúchala gratis";
            var title = english ? $"{playlist.Name} — {name}'s playlist" : $"{playlist.Name} — playlist de {name}";
            return new ShareMeta(title, text, $"{channelUrl}/p/{clean}", cover ?? user.Avatar, LargeImage: cover != null);
        }

        /// <summary>Cambia el título y las meta tags del index.html de la app por las de esta página.</summary>
        private static string Inject(string html, ShareMeta meta)
        {
            // Solo se escapa lo que rompe el HTML: las tildes y los emojis van tal cual en UTF-8
            static string E(string value) => value.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;").Replace("'", "&#39;");
            var sb = new StringBuilder();
            sb.AppendLine($"    <title>{E(meta.Title)}</title>");
            sb.AppendLine($"    <meta name=\"description\" content=\"{E(meta.Description)}\" />");
            sb.AppendLine("    <meta property=\"og:site_name\" content=\"Decatron\" />");
            sb.AppendLine("    <meta property=\"og:type\" content=\"website\" />");
            sb.AppendLine($"    <meta property=\"og:title\" content=\"{E(meta.Title)}\" />");
            sb.AppendLine($"    <meta property=\"og:description\" content=\"{E(meta.Description)}\" />");
            sb.AppendLine($"    <meta property=\"og:url\" content=\"{E(meta.Url)}\" />");
            sb.AppendLine($"    <meta name=\"twitter:card\" content=\"{(meta.Image != null && meta.LargeImage ? "summary_large_image" : "summary")}\" />");
            sb.AppendLine($"    <meta name=\"twitter:title\" content=\"{E(meta.Title)}\" />");
            sb.AppendLine($"    <meta name=\"twitter:description\" content=\"{E(meta.Description)}\" />");
            if (!string.IsNullOrEmpty(meta.Image))
            {
                sb.AppendLine($"    <meta property=\"og:image\" content=\"{E(meta.Image)}\" />");
                sb.AppendLine($"    <meta name=\"twitter:image\" content=\"{E(meta.Image)}\" />");
            }

            var stripped = HeadTags.Replace(html, "");
            var close = stripped.IndexOf("</head>", StringComparison.OrdinalIgnoreCase);
            return close < 0 ? stripped : stripped.Insert(close, sb.ToString());
        }
    }
}
