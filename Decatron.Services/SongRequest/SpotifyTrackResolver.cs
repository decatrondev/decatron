using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.SongRequest
{
    /// <summary>
    /// Links de Spotify, sin cuenta ni API (.dev/plans/SONG_REQUEST_PLAN.md, fase 4).
    /// Solo lee QUÉ canción es: nombre, artistas, duración y portada salen de la página pública de
    /// embed (open.spotify.com/embed/track/ID). El audio nunca sale de Spotify (tiene DRM): la misma
    /// canción se busca en YouTube comparando la duración (lo hace SongResolverService).
    /// Si el embed falla, oEmbed da al menos el nombre y la portada.
    /// </summary>
    public sealed class SpotifyTrackResolver : ITrackResolver
    {
        public const string OriginKey = "spotify";

        private static readonly Regex TrackIdRegex = new("^[A-Za-z0-9]{22}$", RegexOptions.Compiled);
        private static readonly Regex TrackUrlInText = new(@"open\.spotify\.com/(?:intl-[a-z]{2}(?:-[A-Za-z]{2})?/)?track/([A-Za-z0-9]{22})", RegexOptions.Compiled);
        private static readonly Regex NextData = new(@"<script id=""__NEXT_DATA__"" type=""application/json"">(.+?)</script>", RegexOptions.Compiled | RegexOptions.Singleline);
        private static readonly TimeSpan CacheTtl = TimeSpan.FromDays(1);
        private const string UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IMemoryCache _cache;
        private readonly ILogger<SpotifyTrackResolver> _logger;

        public SpotifyTrackResolver(IHttpClientFactory httpClientFactory, IMemoryCache cache, ILogger<SpotifyTrackResolver> logger)
        {
            _httpClientFactory = httpClientFactory;
            _cache = cache;
            _logger = logger;
        }

        public string Key => OriginKey;

        public bool CanHandle(Uri url)
        {
            var host = url.Host.ToLowerInvariant();
            return host == "open.spotify.com" || host == "play.spotify.com"
                || host == "spotify.link" || host.EndsWith(".spotify.link") || host == "spotify.app.link";
        }

        public async Task<ResolverResult> ResolveAsync(Uri url, CancellationToken ct = default)
        {
            var id = ExtractTrackId(url) ?? await FollowShortLinkAsync(url, ct);
            if (id == null)
                return ResolverResult.Fail(SongResolveError.InvalidLink); // álbum, playlist, podcast…

            var cacheKey = $"songrequest:spotify:{id}";
            if (_cache.TryGetValue(cacheKey, out TrackInfo? cached) && cached != null)
                return ResolverResult.Ok(cached);

            var info = await FromEmbedAsync(id, ct) ?? await FromOEmbedAsync(id, ct);
            if (info == null)
                return ResolverResult.Fail(SongResolveError.NotFound);

            _cache.Set(cacheKey, info, CacheTtl);
            return ResolverResult.Ok(info);
        }

        /// <summary>open.spotify.com/track/ID, con o sin /intl-xx/.</summary>
        private static string? ExtractTrackId(Uri url)
        {
            if (!url.Host.EndsWith("spotify.com", StringComparison.OrdinalIgnoreCase))
                return null;
            var segments = url.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
            var i = Array.FindIndex(segments, s => s.Equals("track", StringComparison.OrdinalIgnoreCase));
            return i >= 0 && i + 1 < segments.Length && TrackIdRegex.IsMatch(segments[i + 1]) ? segments[i + 1] : null;
        }

        /// <summary>spotify.link/…: la redirección o el HTML traen el link completo del tema.</summary>
        private async Task<string?> FollowShortLinkAsync(Uri url, CancellationToken ct)
        {
            if (url.Host.EndsWith("spotify.com", StringComparison.OrdinalIgnoreCase))
                return null;
            try
            {
                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(8);
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.UserAgent.ParseAdd(UserAgent);
                using var response = await client.SendAsync(request, ct);
                var final = response.RequestMessage?.RequestUri;
                if (final != null && ExtractTrackId(final) is { } fromRedirect)
                    return fromRedirect;
                var body = await response.Content.ReadAsStringAsync(ct);
                var m = TrackUrlInText.Match(body);
                return m.Success ? m.Groups[1].Value : null;
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                _logger.LogWarning(ex, "[SongRequest] No se pudo seguir el link corto de Spotify {Url}", url);
                return null;
            }
        }

        private async Task<TrackInfo?> FromEmbedAsync(string id, CancellationToken ct)
        {
            try
            {
                var html = await GetStringAsync($"https://open.spotify.com/embed/track/{id}", ct);
                var m = html == null ? null : NextData.Match(html);
                if (m == null || !m.Success)
                    return null;

                using var doc = JsonDocument.Parse(m.Groups[1].Value);
                var entity = doc.RootElement.GetProperty("props").GetProperty("pageProps")
                    .GetProperty("state").GetProperty("data").GetProperty("entity");
                if (entity.TryGetProperty("type", out var type) && type.GetString() != "track")
                    return null;

                var title = Str(entity, "name") ?? Str(entity, "title") ?? "";
                var artists = entity.TryGetProperty("artists", out var arr) && arr.ValueKind == JsonValueKind.Array
                    ? arr.EnumerateArray().Select(a => Str(a, "name")).Where(n => !string.IsNullOrWhiteSpace(n)).ToList()
                    : new List<string?>();
                int? duration = entity.TryGetProperty("duration", out var d) && d.ValueKind == JsonValueKind.Number
                    ? (int)Math.Round(d.GetDouble() / 1000.0)
                    : null;

                string? image = null;
                if (entity.TryGetProperty("visualIdentity", out var vi) && vi.TryGetProperty("image", out var images) && images.ValueKind == JsonValueKind.Array)
                {
                    image = images.EnumerateArray()
                        .OrderByDescending(i => i.TryGetProperty("maxWidth", out var w) && w.ValueKind == JsonValueKind.Number ? w.GetInt32() : 0)
                        .Select(i => Str(i, "url")).FirstOrDefault(u => u != null);
                }

                if (string.IsNullOrWhiteSpace(title))
                    return null;
                return new TrackInfo(OriginKey, $"https://open.spotify.com/track/{id}", title, string.Join(", ", artists), duration, image);
            }
            catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException)
            {
                _logger.LogWarning(ex, "[SongRequest] El embed de Spotify cambió de formato ({Id})", id);
                return null;
            }
        }

        /// <summary>Respaldo: nombre y portada, sin artista ni duración (la búsqueda será menos precisa).</summary>
        private async Task<TrackInfo?> FromOEmbedAsync(string id, CancellationToken ct)
        {
            var json = await GetStringAsync("https://open.spotify.com/oembed?url=" + Uri.EscapeDataString($"https://open.spotify.com/track/{id}"), ct);
            if (json == null)
                return null;
            try
            {
                using var doc = JsonDocument.Parse(json);
                var title = Str(doc.RootElement, "title");
                return string.IsNullOrWhiteSpace(title) ? null
                    : new TrackInfo(OriginKey, $"https://open.spotify.com/track/{id}", title, "", null, Str(doc.RootElement, "thumbnail_url"));
            }
            catch (JsonException)
            {
                return null;
            }
        }

        private async Task<string?> GetStringAsync(string url, CancellationToken ct)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(8);
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.UserAgent.ParseAdd(UserAgent);
                using var response = await client.SendAsync(request, ct);
                if (response.StatusCode != HttpStatusCode.OK)
                    return null;
                return await response.Content.ReadAsStringAsync(ct);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                _logger.LogWarning(ex, "[SongRequest] Spotify no respondió ({Url})", url);
                return null;
            }
        }

        private static string? Str(JsonElement e, string name) =>
            e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;
    }
}
