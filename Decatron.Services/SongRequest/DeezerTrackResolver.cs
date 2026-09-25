using System;
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
    /// Links de Deezer (.dev/plans/SONG_REQUEST_PLAN.md, fase 6). Igual que Spotify: solo se lee QUÉ
    /// canción es y se busca la misma en YouTube por duración. Los datos salen de la API pública de
    /// Deezer (api.deezer.com/track/ID), que no pide cuenta ni clave.
    /// </summary>
    public sealed class DeezerTrackResolver : ITrackResolver
    {
        public const string OriginKey = "deezer";

        private static readonly Regex TrackIdRegex = new("^[0-9]{1,15}$", RegexOptions.Compiled);
        private static readonly Regex TrackUrlInText = new(@"deezer\.com/(?:[a-z]{2}(?:-[a-z]{2})?/)?track/([0-9]{1,15})", RegexOptions.Compiled);
        private static readonly TimeSpan CacheTtl = TimeSpan.FromDays(1);
        private const string UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IMemoryCache _cache;
        private readonly ILogger<DeezerTrackResolver> _logger;

        public DeezerTrackResolver(IHttpClientFactory httpClientFactory, IMemoryCache cache, ILogger<DeezerTrackResolver> logger)
        {
            _httpClientFactory = httpClientFactory;
            _cache = cache;
            _logger = logger;
        }

        public string Key => OriginKey;

        public bool CanHandle(Uri url)
        {
            var host = url.Host.ToLowerInvariant();
            return host is "deezer.com" or "www.deezer.com" or "link.deezer.com" or "deezer.page.link" or "dzr.page.link";
        }

        public async Task<ResolverResult> ResolveAsync(Uri url, CancellationToken ct = default)
        {
            var id = IsShortLink(url) ? await FollowShortLinkAsync(url, ct) : ExtractTrackId(url);
            if (id == null)
                return ResolverResult.Fail(SongResolveError.InvalidLink); // álbum, playlist, artista…

            var cacheKey = $"songrequest:deezer:{id}";
            if (_cache.TryGetValue(cacheKey, out TrackInfo? cached) && cached != null)
                return ResolverResult.Ok(cached);

            var (info, error) = await FromApiAsync(id, ct);
            if (info == null)
                return ResolverResult.Fail(error);

            _cache.Set(cacheKey, info, CacheTtl);
            return ResolverResult.Ok(info);
        }

        private static bool IsShortLink(Uri url) => url.Host.ToLowerInvariant() is "link.deezer.com" or "deezer.page.link" or "dzr.page.link";

        /// <summary>deezer.com/track/ID o deezer.com/es/track/ID.</summary>
        private static string? ExtractTrackId(Uri url)
        {
            if (IsShortLink(url) || !url.Host.EndsWith("deezer.com", StringComparison.OrdinalIgnoreCase))
                return null;
            var segments = url.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
            var i = Array.FindIndex(segments, s => s.Equals("track", StringComparison.OrdinalIgnoreCase));
            return i >= 0 && i + 1 < segments.Length && TrackIdRegex.IsMatch(segments[i + 1]) ? segments[i + 1] : null;
        }

        /// <summary>link.deezer.com/s/… y deezer.page.link/…: la redirección o el HTML traen el link del tema.</summary>
        private async Task<string?> FollowShortLinkAsync(Uri url, CancellationToken ct)
        {
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
                _logger.LogWarning(ex, "[SongRequest] No se pudo seguir el link corto de Deezer {Url}", url);
                return null;
            }
        }

        private async Task<(TrackInfo? Info, SongResolveError Error)> FromApiAsync(string id, CancellationToken ct)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(8);
                using var response = await client.GetAsync($"https://api.deezer.com/track/{id}", ct);
                if (response.StatusCode != HttpStatusCode.OK)
                    return (null, SongResolveError.Failed);

                using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
                var root = doc.RootElement;
                // La API responde 200 con { "error": … } cuando el tema no existe
                if (root.TryGetProperty("error", out _))
                    return (null, SongResolveError.NotFound);

                // title_short no trae los agregados entre paréntesis ("Remastered 2011"), que YouTube no usa
                var title = Str(root, "title_short") ?? Str(root, "title");
                if (string.IsNullOrWhiteSpace(title))
                    return (null, SongResolveError.NotFound);

                var artist = root.TryGetProperty("artist", out var a) ? Str(a, "name") ?? "" : "";
                int? duration = root.TryGetProperty("duration", out var d) && d.ValueKind == JsonValueKind.Number ? d.GetInt32() : null;
                var cover = root.TryGetProperty("album", out var album)
                    ? new[] { "cover_xl", "cover_big", "cover_medium" }.Select(k => Str(album, k)).FirstOrDefault(u => u != null)
                    : null;
                var link = Str(root, "link") ?? $"https://www.deezer.com/track/{id}";

                return (new TrackInfo(OriginKey, link, title, artist, duration is > 0 ? duration : null, cover), SongResolveError.None);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
            {
                _logger.LogWarning(ex, "[SongRequest] La API de Deezer no respondió ({Id})", id);
                return (null, SongResolveError.Failed);
            }
        }

        private static string? Str(JsonElement e, string name) =>
            e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;
    }
}
