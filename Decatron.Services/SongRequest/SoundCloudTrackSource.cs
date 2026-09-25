using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models.SongRequest;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.SongRequest
{
    /// <summary>
    /// SoundCloud es resolutor y fuente, como YouTube (.dev/plans/SONG_REQUEST_PLAN.md, fase 6): no se
    /// busca en YouTube, suena con el reproductor embebido de SoundCloud y el Desktop lo descarga con yt-dlp.
    /// A SoundCloud el server no está bloqueado, así que los datos salen de yt-dlp completo.
    ///
    /// El id guardado es la ruta del tema ("artista/tema", o "artista/tema/s-XXXX" si es privado con link):
    /// con eso se arma el link público, el reproductor lo abre y yt-dlp lo lee.
    /// Los temas de SoundCloud Go+ solo dejan escuchar 30 segundos fuera de la app: se rechazan al pedirlos.
    /// </summary>
    public sealed class SoundCloudTrackSource : ITrackResolver, ITrackSource
    {
        public const string SourceKey = "soundcloud";

        private static readonly TimeSpan GetTimeout = TimeSpan.FromSeconds(25);
        private static readonly TimeSpan SearchTimeout = TimeSpan.FromSeconds(25);
        private const int SearchCandidates = 5;
        private const int DurationToleranceSeconds = 8;
        private const string UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

        private static readonly Regex PathSegment = new("^[A-Za-z0-9_-]{1,100}$", RegexOptions.Compiled);
        private static readonly Regex SecretToken = new("^s-[A-Za-z0-9]{3,40}$", RegexOptions.Compiled);

        /// <summary>Primeros segmentos que son páginas de SoundCloud, no usuarios.</summary>
        private static readonly HashSet<string> ReservedFirst = new(StringComparer.OrdinalIgnoreCase)
        {
            "discover", "search", "stream", "you", "charts", "upload", "pages", "settings", "messages",
            "notifications", "tags", "feed", "people", "mobile", "terms-of-use", "jobs", "imprint", "popular"
        };

        /// <summary>Segundos segmentos que son secciones del perfil, no temas.</summary>
        private static readonly HashSet<string> ReservedSecond = new(StringComparer.OrdinalIgnoreCase)
        {
            "sets", "tracks", "likes", "reposts", "albums", "popular-tracks", "following", "followers",
            "comments", "spotlight", "toptracks", "recommended"
        };

        private readonly YtDlpRunner _ytDlp;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<SoundCloudTrackSource> _logger;

        public SoundCloudTrackSource(YtDlpRunner ytDlp, IHttpClientFactory httpClientFactory, ILogger<SoundCloudTrackSource> logger)
        {
            _ytDlp = ytDlp;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        public string Key => SourceKey;

        public string GetPublicUrl(string sourceId) => PublicUrl(sourceId);

        public static string PublicUrl(string sourceId) => $"https://soundcloud.com/{sourceId}";

        // ── Resolutor ────────────────────────────────────────────────────────

        public bool CanHandle(Uri url)
        {
            var host = url.Host.ToLowerInvariant();
            return host is "soundcloud.com" or "www.soundcloud.com" or "m.soundcloud.com" or "on.soundcloud.com" or "soundcloud.app.goo.gl";
        }

        public async Task<ResolverResult> ResolveAsync(Uri url, CancellationToken ct = default)
        {
            var host = url.Host.ToLowerInvariant();
            var id = host is "on.soundcloud.com" or "soundcloud.app.goo.gl"
                ? await FollowShortLinkAsync(url, ct)
                : ExtractTrackPath(url);
            if (id == null)
                return ResolverResult.Fail(SongResolveError.InvalidLink); // perfil, lista, página…

            // Los datos los trae GetAsync (con caché en la tabla); acá solo se identifica el tema
            return ResolverResult.Ok(new TrackInfo(SourceKey, PublicUrl(id), "", "", null, null, SourceKey, id));
        }

        /// <summary>soundcloud.com/artista/tema, con /s-XXXX si es privado con link. Todo lo demás no es un tema.</summary>
        public static string? ExtractTrackPath(Uri url)
        {
            var host = url.Host.ToLowerInvariant();
            if (host is not ("soundcloud.com" or "www.soundcloud.com" or "m.soundcloud.com"))
                return null;

            var segments = url.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length is < 2 or > 3)
                return null;
            if (!PathSegment.IsMatch(segments[0]) || !PathSegment.IsMatch(segments[1])
                || ReservedFirst.Contains(segments[0]) || ReservedSecond.Contains(segments[1]))
                return null;
            if (segments.Length == 3 && !SecretToken.IsMatch(segments[2]))
                return null;

            var user = segments[0].ToLowerInvariant();
            var track = segments[1].ToLowerInvariant();
            // El token privado distingue mayúsculas
            return segments.Length == 3 ? $"{user}/{track}/{segments[2]}" : $"{user}/{track}";
        }

        /// <summary>on.soundcloud.com/XXXX redirige al link completo del tema.</summary>
        private async Task<string?> FollowShortLinkAsync(Uri url, CancellationToken ct)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(8);
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.UserAgent.ParseAdd(UserAgent);
                using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
                var final = response.RequestMessage?.RequestUri;
                return final == null ? null : ExtractTrackPath(final);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                _logger.LogWarning(ex, "[SongRequest] No se pudo seguir el link corto de SoundCloud {Url}", url);
                return null;
            }
        }

        // ── Fuente ───────────────────────────────────────────────────────────

        public async Task<SourceTrackResult> GetAsync(string sourceId, CancellationToken ct = default)
        {
            if (!Uri.TryCreate(PublicUrl(sourceId), UriKind.Absolute, out var url) || ExtractTrackPath(url) == null)
                return SourceTrackResult.Fail(SongResolveError.InvalidLink);

            var result = await _ytDlp.RunAsync(new[]
            {
                "--dump-json", "--skip-download", "--no-playlist", "--no-warnings", "--", PublicUrl(sourceId)
            }, GetTimeout, ct);

            if (!result.Success)
            {
                var error = result.TimedOut ? SongResolveError.Failed : ClassifyError(result.Stderr);
                if (error == SongResolveError.Failed)
                    _logger.LogWarning("[SongRequest] yt-dlp falló para SoundCloud {Id}: {Stderr}", sourceId, Truncate(result.Stderr, 300));
                return SourceTrackResult.Fail(error);
            }

            try
            {
                return SourceTrackResult.Ok(ParseTrackJson(sourceId, result.Stdout));
            }
            catch (Exception ex) when (ex is JsonException or InvalidOperationException)
            {
                _logger.LogWarning(ex, "[SongRequest] No se pudo leer el JSON de yt-dlp para SoundCloud {Id}", sourceId);
                return SourceTrackResult.Fail(SongResolveError.Failed);
            }
        }

        /// <summary>
        /// Búsqueda en SoundCloud. Hoy !sr con texto busca en YouTube; esto queda para quien lo pida
        /// explícitamente. Salta los temas de 30 s (fragmentos de Go+).
        /// </summary>
        public async Task<SourceSearchResult> SearchAsync(string query, int? expectedDurationSeconds, CancellationToken ct = default)
        {
            query = query.Trim();
            if (query.Length == 0)
                return SourceSearchResult.Fail(SongResolveError.NoMatch);
            if (query.Length > 200)
                query = query[..200];

            var result = await _ytDlp.RunAsync(new[]
            {
                "--dump-json", "--flat-playlist", "--no-warnings", $"scsearch{SearchCandidates}:{query}"
            }, SearchTimeout, ct);
            if (!result.Success)
                return SourceSearchResult.Fail(SongResolveError.Failed);

            foreach (var line in result.Stdout.Split('\n', StringSplitOptions.RemoveEmptyEntries))
            {
                try
                {
                    using var doc = JsonDocument.Parse(line);
                    var root = doc.RootElement;
                    var duration = GetInt(root, "duration");
                    if (duration is not > 30)
                        continue;
                    if (expectedDurationSeconds is > 0 && Math.Abs(duration.Value - expectedDurationSeconds.Value) > DurationToleranceSeconds)
                        continue;
                    var page = GetString(root, "webpage_url");
                    if (page != null && Uri.TryCreate(page, UriKind.Absolute, out var uri) && ExtractTrackPath(uri) is { } path)
                        return SourceSearchResult.Ok(path);
                }
                catch (JsonException) { /* línea que no es JSON */ }
            }
            return SourceSearchResult.Fail(SongResolveError.NoMatch);
        }

        // ── Lectura de datos ─────────────────────────────────────────────────

        private static SongTrack ParseTrackJson(string sourceId, string json)
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            // Go+: todos los formatos son el fragmento de 30 s ("…_preview")
            var formats = root.TryGetProperty("formats", out var f) && f.ValueKind == JsonValueKind.Array
                ? f.EnumerateArray().Select(x => GetString(x, "format_id") ?? "").ToList()
                : new List<string>();
            var previewOnly = formats.Count > 0 && formats.All(id => id.Contains("preview", StringComparison.OrdinalIgnoreCase));

            return new SongTrack
            {
                Source = SourceKey,
                SourceId = sourceId,
                Title = Truncate(GetString(root, "title") ?? "", 300),
                Artist = Truncate(GetString(root, "artist") ?? GetString(root, "uploader") ?? "", 200),
                AuthorId = GetString(root, "uploader_id"),
                DurationSeconds = GetInt(root, "duration"),
                ViewCount = GetLong(root, "view_count"),
                ThumbnailUrl = SmallerArtwork(GetString(root, "thumbnail")),
                Availability = previewOnly ? SongResolverService.PreviewOnlyAvailability : null,
                LiveStatus = "not_live",
                IsEmbeddable = true
            };
        }

        /// <summary>yt-dlp da la portada "original" (puede pesar varios MB); la de 500 px alcanza.</summary>
        private static string? SmallerArtwork(string? url) =>
            url == null ? null : Regex.Replace(url, @"-original\.(jpg|png)$", "-t500x500.jpg");

        private static SongResolveError ClassifyError(string stderr)
        {
            var s = stderr.ToLowerInvariant();
            if (s.Contains("http error 404") || s.Contains("not found") || s.Contains("unable to download json metadata"))
                return SongResolveError.NotFound;
            if (s.Contains("geo") || s.Contains("not available in your country"))
                return SongResolveError.NotEmbeddable;
            if (s.Contains("drm"))
                return SongResolveError.PreviewOnly;
            if (s.Contains("http error 429") || s.Contains("too many requests"))
                return SongResolveError.Blocked;
            return SongResolveError.Failed;
        }

        private static string? GetString(JsonElement root, string name) =>
            root.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;

        private static int? GetInt(JsonElement root, string name) =>
            root.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.Number ? (int)Math.Round(p.GetDouble()) : null;

        private static long? GetLong(JsonElement root, string name) =>
            root.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.Number && p.TryGetInt64(out var v) ? v : null;

        private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];
    }
}
