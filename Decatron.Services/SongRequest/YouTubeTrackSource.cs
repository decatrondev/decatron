using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web;
using Decatron.Core.Models.SongRequest;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.SongRequest
{
    /// <summary>
    /// YouTube es resolutor (entiende sus links) y fuente (de ahí sale el audio) a la vez.
    /// Sin YouTube Data API. Dos caminos para los datos de un video:
    /// 1. yt-dlp completo: trae todo (si se puede embeber, restricción de edad…), pero YouTube
    ///    bloquea la IP del server con "confirm you're not a bot" (pasó en la primera prueba, 2026-09-25).
    /// 2. Sin reproductor: la búsqueda de YouTube por el id (no está bloqueada) da título, duración,
    ///    vistas y canal, y oEmbed dice si existe y se puede embeber.
    /// Cuando el 1 da bloqueo, se deja de intentar un rato y se usa directo el 2.
    /// </summary>
    public sealed class YouTubeTrackSource : ITrackResolver, ITrackSource
    {
        public const string SourceKey = "youtube";

        private static readonly TimeSpan GetTimeout = TimeSpan.FromSeconds(25);
        private static readonly TimeSpan SearchTimeout = TimeSpan.FromSeconds(25);
        private const int SearchCandidates = 5;
        /// <summary>Diferencia de duración aceptada al buscar la canción de otro servicio.</summary>
        private const int DurationToleranceSeconds = 5;
        /// <summary>Tras un bloqueo, cuánto tiempo no se intenta yt-dlp completo (cada intento son ~3 s perdidos).</summary>
        private static readonly TimeSpan BlockedCooldown = TimeSpan.FromMinutes(30);

        private DateTime _fullExtractionBlockedUntil = DateTime.MinValue;

        private static readonly Regex VideoIdRegex = new("^[A-Za-z0-9_-]{11}$", RegexOptions.Compiled);

        // Versiones que no son la canción original; se descartan al buscar la de otro servicio
        // salvo que la búsqueda misma las pida.
        private static readonly string[] AlternateVersionWords =
        {
            "cover", "karaoke", "live", "en vivo", "8d", "slowed", "sped up", "nightcore",
            "reverb", "remix", "instrumental", "tutorial", "reaction", "letra", "lyrics"
        };

        private readonly YtDlpRunner _ytDlp;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<YouTubeTrackSource> _logger;

        public YouTubeTrackSource(YtDlpRunner ytDlp, IHttpClientFactory httpClientFactory, ILogger<YouTubeTrackSource> logger)
        {
            _ytDlp = ytDlp;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        public string Key => SourceKey;

        public string GetPublicUrl(string sourceId) => $"https://youtu.be/{sourceId}";

        // ── Resolutor ────────────────────────────────────────────────────────

        public bool CanHandle(Uri url)
        {
            var host = url.Host.ToLowerInvariant();
            return host == "youtu.be"
                || host == "youtube.com" || host.EndsWith(".youtube.com")
                || host == "youtube-nocookie.com" || host.EndsWith(".youtube-nocookie.com");
        }

        public Task<ResolverResult> ResolveAsync(Uri url, CancellationToken ct = default)
        {
            var id = ExtractVideoId(url);
            if (id == null)
                return Task.FromResult(ResolverResult.Fail(SongResolveError.InvalidLink));

            // Los datos los trae GetAsync (con caché); acá solo se identifica el video.
            return Task.FromResult(ResolverResult.Ok(new TrackInfo(
                SourceKey, GetPublicUrl(id), "", "", null, null, SourceKey, id)));
        }

        /// <summary>
        /// watch?v=, youtu.be/, shorts/, live/, embed/, v/ y music.youtube.com.
        /// De un link con list= se toma solo el video.
        /// </summary>
        public static string? ExtractVideoId(Uri url)
        {
            var host = url.Host.ToLowerInvariant();
            var segments = url.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);

            string? candidate = null;
            if (host == "youtu.be")
            {
                candidate = segments.FirstOrDefault();
            }
            else if (segments.Length >= 2 && segments[0] is "shorts" or "live" or "embed" or "v" or "e")
            {
                candidate = segments[1];
            }
            else if (segments.Length >= 1 && segments[0] == "watch")
            {
                candidate = HttpUtility.ParseQueryString(url.Query)["v"];
            }

            return candidate != null && VideoIdRegex.IsMatch(candidate) ? candidate : null;
        }

        // ── Fuente ───────────────────────────────────────────────────────────

        public async Task<SourceTrackResult> GetAsync(string sourceId, CancellationToken ct = default)
        {
            if (!VideoIdRegex.IsMatch(sourceId))
                return SourceTrackResult.Fail(SongResolveError.InvalidLink);

            if (DateTime.UtcNow >= _fullExtractionBlockedUntil)
            {
                var result = await _ytDlp.RunAsync(new[]
                {
                    "--dump-json", "--skip-download", "--no-playlist", "--no-warnings",
                    "--", $"https://www.youtube.com/watch?v={sourceId}"
                }, GetTimeout, ct);

                if (result.Success)
                {
                    try
                    {
                        return SourceTrackResult.Ok(ParseVideoJson(sourceId, result.Stdout));
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "[SongRequest] No se pudo leer el JSON de yt-dlp para {VideoId}", sourceId);
                    }
                }
                else
                {
                    var error = result.TimedOut ? SongResolveError.Failed : ClassifyError(result.Stderr);
                    if (error is not (SongResolveError.Blocked or SongResolveError.Failed))
                        return SourceTrackResult.Fail(error);

                    if (error == SongResolveError.Blocked)
                    {
                        _fullExtractionBlockedUntil = DateTime.UtcNow + BlockedCooldown;
                        _logger.LogWarning("[SongRequest] YouTube bloqueó yt-dlp en el server; se usa búsqueda + oEmbed por {Minutes} min",
                            BlockedCooldown.TotalMinutes);
                    }
                    else
                    {
                        _logger.LogWarning("[SongRequest] yt-dlp falló para {VideoId}: {Stderr}", sourceId, Truncate(result.Stderr, 300));
                    }
                }
            }

            return await GetWithoutPlayerAsync(sourceId, ct);
        }

        /// <summary>
        /// Camino 2: búsqueda por id + oEmbed, en paralelo. No sabe de restricción de edad: si un video
        /// la tiene, el reproductor del overlay da error y se salta solo (fase 2).
        /// </summary>
        private async Task<SourceTrackResult> GetWithoutPlayerAsync(string sourceId, CancellationToken ct)
        {
            var oEmbedTask = GetOEmbedAsync(sourceId, ct);
            var searchTask = FindByIdInSearchAsync(sourceId, ct);
            await Task.WhenAll(oEmbedTask, searchTask);
            var (oEmbedStatus, oEmbed) = oEmbedTask.Result;
            var hit = searchTask.Result;

            // oEmbed: 400/404 = no existe; 401/403 = privado o no se puede embeber.
            // Para el overlay las dos últimas son lo mismo: no se puede reproducir.
            if (oEmbedStatus is HttpStatusCode.NotFound or HttpStatusCode.BadRequest)
                return SourceTrackResult.Fail(SongResolveError.NotFound);
            if (oEmbedStatus is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
                return SourceTrackResult.Fail(hit != null ? SongResolveError.NotEmbeddable : SongResolveError.Private);

            if (oEmbed == null && hit == null)
                return SourceTrackResult.Fail(SongResolveError.Blocked);

            // Los directos no suelen salir buscando el id; por el título sí, y sin duración
            if (hit == null && !string.IsNullOrWhiteSpace(oEmbed?.Title))
                hit = (await RunSearchAsync(oEmbed.Title, ct))?.FirstOrDefault(c => c.Id == sourceId);

            var channel = StripTopic(hit?.Channel ?? oEmbed?.Author ?? "");
            return SourceTrackResult.Ok(new SongTrack
            {
                Source = SourceKey,
                SourceId = sourceId,
                Title = Truncate(hit?.Title ?? oEmbed?.Title ?? "", 300),
                Artist = Truncate(channel, 200),
                AuthorId = hit?.ChannelId,
                DurationSeconds = hit?.DurationSeconds,
                ViewCount = hit?.ViewCount,
                ThumbnailUrl = oEmbed?.ThumbnailUrl ?? $"https://i.ytimg.com/vi/{sourceId}/hqdefault.jpg",
                // En la búsqueda plana, un video sin duración es una transmisión en vivo
                LiveStatus = hit == null ? null : hit.DurationSeconds is > 0 ? "not_live" : "is_live",
                // 401/403 ya se rechazó arriba; cualquier otra respuesta no dice que no se pueda
                IsEmbeddable = true
            });
        }

        /// <summary>
        /// Busca el id entre comillas: el video suele salir primero. Los no listados no salen en la
        /// búsqueda; entonces queda solo lo de oEmbed (sin duración, la fila caduca rápido).
        /// </summary>
        private async Task<SearchCandidate?> FindByIdInSearchAsync(string sourceId, CancellationToken ct)
        {
            var candidates = await RunSearchAsync($"\"{sourceId}\"", ct);
            return candidates?.FirstOrDefault(c => c.Id == sourceId);
        }

        public async Task<SourceSearchResult> SearchAsync(string query, int? expectedDurationSeconds, CancellationToken ct = default)
        {
            query = query.Trim();
            if (query.Length == 0)
                return SourceSearchResult.Fail(SongResolveError.NoMatch);
            if (query.Length > 200)
                query = query[..200];

            var candidates = await RunSearchAsync(query, ct);
            if (candidates == null)
                return SourceSearchResult.Fail(SongResolveError.Failed);

            var picked = PickCandidate(candidates, query, expectedDurationSeconds);
            return picked != null ? SourceSearchResult.Ok(picked.Id) : SourceSearchResult.Fail(SongResolveError.NoMatch);
        }

        /// <summary>Búsqueda plana (no pasa por el reproductor, así que el bloqueo no la afecta). null = falló.</summary>
        private async Task<List<SearchCandidate>?> RunSearchAsync(string query, CancellationToken ct)
        {
            var result = await _ytDlp.RunAsync(new[]
            {
                "--dump-json", "--skip-download", "--flat-playlist", "--no-warnings",
                $"ytsearch{SearchCandidates}:{query}"
            }, SearchTimeout, ct);

            if (!result.Success)
            {
                _logger.LogWarning("[SongRequest] Búsqueda en YouTube falló: {Stderr}",
                    result.TimedOut ? "timeout" : Truncate(result.Stderr, 300));
                return null;
            }

            var candidates = new List<SearchCandidate>();
            foreach (var line in result.Stdout.Split('\n', StringSplitOptions.RemoveEmptyEntries))
            {
                try
                {
                    using var doc = JsonDocument.Parse(line);
                    var root = doc.RootElement;
                    var id = GetString(root, "id");
                    if (id == null || !VideoIdRegex.IsMatch(id)) continue;
                    candidates.Add(new SearchCandidate(
                        id,
                        GetString(root, "title") ?? "",
                        GetString(root, "channel") ?? GetString(root, "uploader") ?? "",
                        GetString(root, "channel_id"),
                        GetInt(root, "duration"),
                        GetLong(root, "view_count")));
                }
                catch (JsonException)
                {
                    // línea que no es JSON (aviso de yt-dlp); se ignora
                }
            }
            return candidates;
        }

        private sealed record SearchCandidate(string Id, string Title, string Channel, string? ChannelId, int? DurationSeconds, long? ViewCount);

        private static SearchCandidate? PickCandidate(List<SearchCandidate> candidates, string query, int? expectedDuration)
        {
            // Sin duración en la búsqueda plana = en vivo o estreno: nunca sirve.
            var playable = candidates.Where(c => c.DurationSeconds is > 0).ToList();

            if (expectedDuration is not > 0)
                return playable.FirstOrDefault();

            var queryLower = query.ToLowerInvariant();
            return playable
                .Where(c => Math.Abs(c.DurationSeconds!.Value - expectedDuration.Value) <= DurationToleranceSeconds)
                .Where(c => !IsAlternateVersion(c.Title, queryLower))
                .OrderBy(c => c.Channel.EndsWith(" - Topic", StringComparison.OrdinalIgnoreCase) ? 0 : 1)
                .ThenBy(c => Math.Abs(c.DurationSeconds!.Value - expectedDuration.Value))
                .FirstOrDefault();
        }

        private static bool IsAlternateVersion(string title, string queryLower)
        {
            var titleLower = title.ToLowerInvariant();
            return AlternateVersionWords.Any(w =>
                ContainsWord(titleLower, w) && !ContainsWord(queryLower, w));
        }

        private static bool ContainsWord(string text, string word) =>
            Regex.IsMatch(text, $@"(^|[^\p{{L}}\p{{N}}]){Regex.Escape(word)}($|[^\p{{L}}\p{{N}}])");

        // ── Lectura de datos ─────────────────────────────────────────────────

        private static SongTrack ParseVideoJson(string sourceId, string json)
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var channel = StripTopic(GetString(root, "channel") ?? GetString(root, "uploader") ?? "");

            var ageLimit = GetInt(root, "age_limit") ?? 0;
            var embeddable = root.TryGetProperty("playable_in_embed", out var embedProp)
                             && embedProp.ValueKind == JsonValueKind.False
                ? false
                : true;

            return new SongTrack
            {
                Source = SourceKey,
                SourceId = sourceId,
                Title = Truncate(GetString(root, "title") ?? "", 300),
                Artist = Truncate(GetString(root, "artist")?.Split(',')[0].Trim() ?? channel, 200),
                AuthorId = GetString(root, "channel_id"),
                DurationSeconds = GetInt(root, "duration"),
                ViewCount = GetLong(root, "view_count"),
                ThumbnailUrl = GetString(root, "thumbnail") ?? $"https://i.ytimg.com/vi/{sourceId}/hqdefault.jpg",
                Availability = GetString(root, "availability"),
                LiveStatus = GetString(root, "live_status"),
                IsEmbeddable = embeddable,
                AgeRestricted = ageLimit >= 18
            };
        }

        private sealed record OEmbedData(string? Title, string? Author, string? ThumbnailUrl);

        /// <summary>Status null = no hubo respuesta (timeout, red): no dice nada del video.</summary>
        private async Task<(HttpStatusCode? Status, OEmbedData? Data)> GetOEmbedAsync(string sourceId, CancellationToken ct)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(8);
                var url = "https://www.youtube.com/oembed?format=json&url=" +
                          Uri.EscapeDataString($"https://www.youtube.com/watch?v={sourceId}");
                using var response = await client.GetAsync(url, ct);
                if (response.StatusCode != HttpStatusCode.OK)
                    return (response.StatusCode, null);

                using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
                var root = doc.RootElement;
                return (HttpStatusCode.OK, new OEmbedData(
                    GetString(root, "title"), GetString(root, "author_name"), GetString(root, "thumbnail_url")));
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
            {
                _logger.LogWarning(ex, "[SongRequest] oEmbed de YouTube falló para {VideoId}", sourceId);
                return (null, null);
            }
        }

        /// <summary>Los canales automáticos de YouTube Music se llaman "Artista - Topic".</summary>
        private static string StripTopic(string channel) =>
            channel.EndsWith(" - Topic", StringComparison.OrdinalIgnoreCase) ? channel[..^" - Topic".Length] : channel;

        /// <summary>Traduce el error de yt-dlp. El texto viene en inglés sin importar el idioma del server.</summary>
        private static SongResolveError ClassifyError(string stderr)
        {
            var s = stderr.ToLowerInvariant();
            if (s.Contains("not a bot") || s.Contains("http error 429") || s.Contains("too many requests"))
                return SongResolveError.Blocked;
            if (s.Contains("private video"))
                return SongResolveError.Private;
            if (s.Contains("confirm your age") || s.Contains("age-restricted") || s.Contains("inappropriate for some users"))
                return SongResolveError.AgeRestricted;
            if (s.Contains("live event will begin") || s.Contains("premieres in") || s.Contains("premiere will begin"))
                return SongResolveError.Upcoming;
            if (s.Contains("unavailable") || s.Contains("not available") || s.Contains("has been removed")
                || s.Contains("does not exist") || s.Contains("incomplete youtube id"))
                return SongResolveError.NotFound;
            return SongResolveError.Failed;
        }

        private static string? GetString(JsonElement root, string name) =>
            root.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;

        private static int? GetInt(JsonElement root, string name) =>
            root.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.Number
                ? (int)Math.Round(p.GetDouble())
                : null;

        private static long? GetLong(JsonElement root, string name) =>
            root.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.Number && p.TryGetInt64(out var v)
                ? v
                : null;

        private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];
    }
}
