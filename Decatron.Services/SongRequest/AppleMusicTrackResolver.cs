using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.SongRequest
{
    /// <summary>
    /// Links de Apple Music (.dev/plans/SONG_REQUEST_PLAN.md, fase 6). Igual que Spotify: solo se lee QUÉ
    /// canción es y se busca la misma en YouTube por duración. Los datos salen de la búsqueda pública de
    /// iTunes (itunes.apple.com/lookup), que no pide cuenta ni clave.
    /// </summary>
    public sealed class AppleMusicTrackResolver : ITrackResolver
    {
        public const string OriginKey = "apple_music";

        private static readonly Regex IdRegex = new("^[0-9]{1,15}$", RegexOptions.Compiled);
        private static readonly Regex CountryRegex = new("^[a-z]{2}$", RegexOptions.Compiled);
        private static readonly TimeSpan CacheTtl = TimeSpan.FromDays(1);

        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IMemoryCache _cache;
        private readonly ILogger<AppleMusicTrackResolver> _logger;

        public AppleMusicTrackResolver(IHttpClientFactory httpClientFactory, IMemoryCache cache, ILogger<AppleMusicTrackResolver> logger)
        {
            _httpClientFactory = httpClientFactory;
            _cache = cache;
            _logger = logger;
        }

        public string Key => OriginKey;

        public bool CanHandle(Uri url)
        {
            var host = url.Host.ToLowerInvariant();
            return host is "music.apple.com" or "geo.music.apple.com" or "itunes.apple.com" or "geo.itunes.apple.com";
        }

        public async Task<ResolverResult> ResolveAsync(Uri url, CancellationToken ct = default)
        {
            var (id, country) = ExtractTrackId(url);
            if (id == null)
                return ResolverResult.Fail(SongResolveError.InvalidLink); // álbum entero, playlist, artista…

            var cacheKey = $"songrequest:apple:{id}";
            if (_cache.TryGetValue(cacheKey, out TrackInfo? cached) && cached != null)
                return ResolverResult.Ok(cached);

            var (info, error) = await LookupAsync(id, country, ct);
            if (info == null)
                return ResolverResult.Fail(error);

            _cache.Set(cacheKey, info, CacheTtl);
            return ResolverResult.Ok(info);
        }

        /// <summary>
        /// Un tema es /cc/song/nombre/ID, o un álbum con ?i=ID (el "compartir canción" de la app).
        /// Un álbum sin ?i= no es una canción.
        /// </summary>
        private static (string? Id, string Country) ExtractTrackId(Uri url)
        {
            var segments = url.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
            var country = segments.Length > 0 && CountryRegex.IsMatch(segments[0]) ? segments[0] : "us";

            var fromQuery = HttpUtility.ParseQueryString(url.Query)["i"];
            if (fromQuery != null)
                return (IdRegex.IsMatch(fromQuery) ? fromQuery : null, country);

            var song = Array.FindIndex(segments, s => s.Equals("song", StringComparison.OrdinalIgnoreCase));
            var last = segments.LastOrDefault();
            return song >= 0 && last != null && IdRegex.IsMatch(last) ? (last, country) : (null, country);
        }

        private async Task<(TrackInfo? Info, SongResolveError Error)> LookupAsync(string id, string country, CancellationToken ct)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(8);
                using var response = await client.GetAsync($"https://itunes.apple.com/lookup?id={id}&country={country}", ct);
                if (response.StatusCode != HttpStatusCode.OK)
                    return (null, SongResolveError.Failed);

                using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
                var track = doc.RootElement.TryGetProperty("results", out var results) && results.ValueKind == JsonValueKind.Array
                    ? results.EnumerateArray().FirstOrDefault(r => Str(r, "wrapperType") == "track")
                    : default;
                if (track.ValueKind != JsonValueKind.Object)
                    return (null, SongResolveError.NotFound);
                if (Str(track, "kind") is { } kind && kind != "song")
                    return (null, SongResolveError.InvalidLink); // video musical, podcast…

                var title = Str(track, "trackName");
                if (string.IsNullOrWhiteSpace(title))
                    return (null, SongResolveError.NotFound);

                int? duration = track.TryGetProperty("trackTimeMillis", out var ms) && ms.ValueKind == JsonValueKind.Number
                    ? (int)Math.Round(ms.GetDouble() / 1000.0)
                    : null;
                // La búsqueda da la portada de 100 px; el mismo link sirve en cualquier tamaño
                var artwork = Str(track, "artworkUrl100")?.Replace("100x100bb", "600x600bb");
                var link = StripTracking(Str(track, "trackViewUrl")) ?? $"https://music.apple.com/{country}/song/{id}";

                return (new TrackInfo(OriginKey, link, title, Str(track, "artistName") ?? "", duration, artwork), SongResolveError.None);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
            {
                _logger.LogWarning(ex, "[SongRequest] La búsqueda de iTunes no respondió ({Id})", id);
                return (null, SongResolveError.Failed);
            }
        }

        /// <summary>trackViewUrl trae "&amp;uo=4" (seguimiento de Apple): se quita para mostrarlo en el chat.</summary>
        private static string? StripTracking(string? url) =>
            url == null ? null : Regex.Replace(url, @"[?&]uo=\d+$", "");

        private static string? Str(JsonElement e, string name) =>
            e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;
    }
}
