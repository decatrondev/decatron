using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models.SongRequest;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.SongRequest
{
    /// <summary>
    /// Resultado de resolver un pedido. <see cref="Track"/> ya está guardado en song_request_tracks.
    /// <see cref="Origin"/> viene cuando el link era de otro servicio (Spotify…) y se buscó en la fuente.
    /// </summary>
    public sealed record SongResolveResult(SongTrack? Track, TrackInfo? Origin, SongResolveError Error)
    {
        public bool Success => Error == SongResolveError.None && Track != null;
        public static SongResolveResult Fail(SongResolveError error, TrackInfo? origin = null) => new(null, origin, error);
    }

    /// <summary>
    /// Punto de entrada del módulo: link o texto → canción reproducible.
    /// Elige el resolutor por el link, busca en la fuente cuando hace falta, valida que se pueda
    /// reproducir en el overlay y guarda el resultado como caché.
    /// Los filtros del canal (duración, vistas, vetos) no van acá: son de la fase 3 y se aplican después.
    /// </summary>
    public sealed class SongResolverService
    {
        public const string DefaultSourceKey = YouTubeTrackSource.SourceKey;

        /// <summary>Cuánto se confía en una fila guardada con datos completos.</summary>
        private static readonly TimeSpan TrackTtl = TimeSpan.FromDays(3);
        /// <summary>Filas sin duración (vinieron de oEmbed): se reintenta pronto con yt-dlp.</summary>
        private static readonly TimeSpan PartialTrackTtl = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan SearchCacheTtl = TimeSpan.FromHours(6);

        private readonly DecatronDbContext _db;
        private readonly IEnumerable<ITrackResolver> _resolvers;
        private readonly IEnumerable<ITrackSource> _sources;
        private readonly IMemoryCache _cache;
        private readonly ILogger<SongResolverService> _logger;

        public SongResolverService(
            DecatronDbContext db,
            IEnumerable<ITrackResolver> resolvers,
            IEnumerable<ITrackSource> sources,
            IMemoryCache cache,
            ILogger<SongResolverService> logger)
        {
            _db = db;
            _resolvers = resolvers;
            _sources = sources;
            _cache = cache;
            _logger = logger;
        }

        public ITrackSource? GetSource(string key) => _sources.FirstOrDefault(s => s.Key == key);

        /// <summary>Lo que escribió el viewer después de !sr, o lo que se pegó en el dashboard.</summary>
        public async Task<SongResolveResult> ResolveAsync(string input, CancellationToken ct = default)
        {
            input = input.Trim();
            if (input.Length == 0)
                return SongResolveResult.Fail(SongResolveError.NoMatch);

            var url = TryParseUrl(input);
            if (url == null)
                return await SearchAndGetAsync(DefaultSourceKey, input, null, null, ct);

            var resolver = _resolvers.FirstOrDefault(r => r.CanHandle(url));
            if (resolver == null)
                return SongResolveResult.Fail(SongResolveError.Unsupported);

            var resolved = await resolver.ResolveAsync(url, ct);
            if (resolved.Info == null)
                return SongResolveResult.Fail(resolved.Error);

            var info = resolved.Info;

            // El resolutor ya sabe el id en la fuente (link de YouTube)
            if (info.SourceKey != null && info.SourceId != null)
            {
                var direct = await GetTrackAsync(info.SourceKey, info.SourceId, ct);
                return direct.Track != null
                    ? Validate(direct.Track, null)
                    : SongResolveResult.Fail(direct.Error);
            }

            // Link de otro servicio (Spotify…): buscar la misma canción en la fuente
            var query = BuildSearchQuery(info);
            return await SearchAndGetAsync(DefaultSourceKey, query, info.DurationSeconds, info, ct);
        }

        /// <summary>
        /// Para el descargador (fase 5): qué URL se le pasa a yt-dlp en la PC del streamer.
        /// YouTube y cualquier otro sitio van tal cual (yt-dlp soporta cientos); Spotify (sin audio propio)
        /// y el texto se convierten en la canción de YouTube, igual que en !sr.
        /// </summary>
        public async Task<(string? Url, TrackInfo? Origin, SongResolveError Error)> ResolveDownloadUrlAsync(string input, CancellationToken ct = default)
        {
            input = input.Trim();
            var url = TryParseUrl(input);
            if (url != null)
            {
                var resolver = _resolvers.FirstOrDefault(r => r.CanHandle(url));
                if (resolver == null || resolver is ITrackSource)
                    return (url.ToString(), null, SongResolveError.None);
            }

            var resolved = await ResolveAsync(input, ct);
            if (!resolved.Success)
                return (null, resolved.Origin, resolved.Error);
            var source = GetSource(resolved.Track!.Source);
            return (source == null ? null : source.GetPublicUrl(resolved.Track.SourceId), resolved.Origin, SongResolveError.None);
        }

        private async Task<SongResolveResult> SearchAndGetAsync(
            string sourceKey, string query, int? expectedDuration, TrackInfo? origin, CancellationToken ct)
        {
            var source = GetSource(sourceKey);
            if (source == null)
                return SongResolveResult.Fail(SongResolveError.Unsupported, origin);

            var cacheKey = $"songrequest:search:{sourceKey}:{expectedDuration}:{query.ToLowerInvariant()}";
            if (!_cache.TryGetValue(cacheKey, out string? sourceId) || sourceId == null)
            {
                var search = await source.SearchAsync(query, expectedDuration, ct);
                if (search.SourceId == null)
                    return SongResolveResult.Fail(search.Error, origin);
                sourceId = search.SourceId;
                _cache.Set(cacheKey, sourceId, SearchCacheTtl);
            }

            var found = await GetTrackAsync(sourceKey, sourceId, ct);
            return found.Track != null
                ? Validate(found.Track, origin)
                : SongResolveResult.Fail(found.Error, origin);
        }

        /// <summary>
        /// La fila guardada si sigue vigente; si no, la pide a la fuente y la guarda.
        /// Si la fuente falla por bloqueo o error propio, se usa la fila vieja antes que rechazar el pedido.
        /// </summary>
        public async Task<SourceTrackResult> GetTrackAsync(string sourceKey, string sourceId, CancellationToken ct = default)
        {
            var source = GetSource(sourceKey);
            if (source == null)
                return SourceTrackResult.Fail(SongResolveError.Unsupported);

            var existing = await _db.SongTracks
                .FirstOrDefaultAsync(t => t.Source == sourceKey && t.SourceId == sourceId, ct);

            if (existing != null && IsFresh(existing))
                return SourceTrackResult.Ok(existing);

            var fetched = await source.GetAsync(sourceId, ct);
            if (fetched.Track == null)
            {
                if (existing != null && fetched.Error is SongResolveError.Blocked or SongResolveError.Failed)
                {
                    _logger.LogInformation("[SongRequest] {Source}:{Id} no se pudo refrescar ({Error}); se usa la copia guardada",
                        sourceKey, sourceId, fetched.Error);
                    return SourceTrackResult.Ok(existing);
                }
                return fetched;
            }

            // Una respuesta parcial (oEmbed) no pisa datos completos que ya teníamos
            if (existing != null && fetched.Track.DurationSeconds == null && existing.DurationSeconds != null)
                return SourceTrackResult.Ok(existing);

            return SourceTrackResult.Ok(await SaveAsync(existing, fetched.Track, ct));
        }

        /// <summary>
        /// Guarda varias canciones de una vez (importar una playlist). Las que ya existen se reutilizan tal cual.
        /// Devuelve las filas guardadas en el mismo orden.
        /// </summary>
        public async Task<List<SongTrack>> UpsertTracksAsync(IReadOnlyList<SongTrack> tracks, CancellationToken ct = default)
        {
            if (tracks.Count == 0)
                return new List<SongTrack>();

            var source = tracks[0].Source;
            var ids = tracks.Select(t => t.SourceId).Distinct().ToList();
            var existing = await _db.SongTracks
                .Where(t => t.Source == source && ids.Contains(t.SourceId))
                .ToDictionaryAsync(t => t.SourceId, ct);

            var now = DateTime.UtcNow;
            foreach (var t in tracks)
            {
                if (existing.ContainsKey(t.SourceId))
                    continue;
                t.ResolvedAt = now;
                t.CreatedAt = now;
                _db.SongTracks.Add(t);
                existing[t.SourceId] = t;
            }
            await _db.SaveChangesAsync(ct);
            return ids.Select(id => existing[id]).ToList();
        }

        private static bool IsFresh(SongTrack track)
        {
            var ttl = track.DurationSeconds == null ? PartialTrackTtl : TrackTtl;
            return DateTime.UtcNow - track.ResolvedAt < ttl;
        }

        private async Task<SongTrack> SaveAsync(SongTrack? existing, SongTrack fetched, CancellationToken ct)
        {
            var now = DateTime.UtcNow;
            if (existing == null)
            {
                fetched.ResolvedAt = now;
                fetched.CreatedAt = now;
                _db.SongTracks.Add(fetched);
                try
                {
                    await _db.SaveChangesAsync(ct);
                    return fetched;
                }
                catch (DbUpdateException)
                {
                    // Otro pedido de la misma canción la guardó al mismo tiempo
                    _db.Entry(fetched).State = EntityState.Detached;
                    var winner = await _db.SongTracks
                        .FirstOrDefaultAsync(t => t.Source == fetched.Source && t.SourceId == fetched.SourceId, ct);
                    if (winner != null)
                        return winner;
                    throw;
                }
            }

            existing.Title = fetched.Title;
            existing.Artist = fetched.Artist;
            existing.AuthorId = fetched.AuthorId ?? existing.AuthorId;
            existing.DurationSeconds = fetched.DurationSeconds;
            existing.ViewCount = fetched.ViewCount ?? existing.ViewCount;
            existing.ThumbnailUrl = fetched.ThumbnailUrl ?? existing.ThumbnailUrl;
            existing.Availability = fetched.Availability;
            existing.LiveStatus = fetched.LiveStatus;
            existing.IsEmbeddable = fetched.IsEmbeddable;
            existing.AgeRestricted = fetched.AgeRestricted;
            existing.ResolvedAt = now;
            await _db.SaveChangesAsync(ct);
            return existing;
        }

        /// <summary>Lo que impide reproducirla en el overlay, sin importar la config del canal.</summary>
        private static SongResolveResult Validate(SongTrack track, TrackInfo? origin)
        {
            if (track.Availability is "private" or "needs_auth" or "premium_only" or "subscriber_only")
                return SongResolveResult.Fail(SongResolveError.Private, origin);
            if (track.LiveStatus == "is_live")
                return SongResolveResult.Fail(SongResolveError.Live, origin);
            if (track.LiveStatus == "is_upcoming")
                return SongResolveResult.Fail(SongResolveError.Upcoming, origin);
            if (!track.IsEmbeddable)
                return SongResolveResult.Fail(SongResolveError.NotEmbeddable, origin);
            if (track.AgeRestricted)
                return SongResolveResult.Fail(SongResolveError.AgeRestricted, origin);
            return new SongResolveResult(track, origin, SongResolveError.None);
        }

        /// <summary>
        /// "Artista - Título" para buscar en la fuente. Solo el primer artista, y sin los agregados que
        /// Spotify pone después de " - " ("Remastered 2011", "Radio Edit"…) y que YouTube no usa.
        /// </summary>
        private static string BuildSearchQuery(TrackInfo info)
        {
            var title = info.Title;
            var dash = title.IndexOf(" - ", StringComparison.Ordinal);
            if (dash > 0)
                title = title[..dash];
            var artist = info.Artist.Split(',')[0].Trim();
            return string.IsNullOrWhiteSpace(artist) ? title : $"{artist} - {title}";
        }

        /// <summary>Acepta links con o sin https:// ("youtu.be/xxx", "www.youtube.com/..."). El resto es texto.</summary>
        private static Uri? TryParseUrl(string input)
        {
            if (input.Contains(' '))
                return null;

            // spotify:track:ID (el "copiar URI" de la app de escritorio)
            if (input.StartsWith("spotify:track:", StringComparison.OrdinalIgnoreCase))
                input = "https://open.spotify.com/track/" + input["spotify:track:".Length..];

            var candidate = input;
            if (!candidate.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
                && !candidate.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                // Sin esquema solo cuenta como link si parece un dominio con ruta
                var slash = candidate.IndexOf('/');
                var host = slash > 0 ? candidate[..slash] : candidate;
                if (!host.Contains('.') || slash < 0)
                    return null;
                candidate = "https://" + candidate;
            }

            return Uri.TryCreate(candidate, UriKind.Absolute, out var uri)
                   && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
                ? uri
                : null;
        }
    }
}
