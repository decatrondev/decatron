using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models.SongRequest;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.SongRequest
{
    /// <summary>
    /// Lo que el canal guarda aparte de la cola (fase 3): historial, playlist de respaldo y listas negras.
    /// Plan: .dev/plans/SONG_REQUEST_PLAN.md
    /// </summary>
    public sealed class SongRequestLibraryService
    {
        /// <summary>Tope de la playlist de respaldo por canal.</summary>
        public const int MaxFallbackItems = 500;

        private readonly DecatronDbContext _db;
        private readonly SongResolverService _resolver;
        private readonly IEnumerable<IPlaylistSource> _playlists;

        public SongRequestLibraryService(DecatronDbContext db, SongResolverService resolver, IEnumerable<IPlaylistSource> playlists)
        {
            _db = db;
            _resolver = resolver;
            _playlists = playlists;
        }

        private object TrackDto(SongTrack? t) => t == null ? new { } : new
        {
            trackId = t.Id,
            source = t.Source,
            sourceId = t.SourceId,
            url = _resolver.GetSource(t.Source)?.GetPublicUrl(t.SourceId),
            title = t.Title,
            artist = t.Artist,
            durationSeconds = t.DurationSeconds,
            thumbnailUrl = t.ThumbnailUrl
        };

        // ── Historial ────────────────────────────────────────────────────────

        public async Task<object> GetHistoryAsync(long userId, int page, int pageSize, bool favoritesOnly, CancellationToken ct = default)
        {
            var query = _db.SongRequestHistory.AsNoTracking().Include(h => h.Track).Where(h => h.UserId == userId);
            if (favoritesOnly)
                query = query.Where(h => h.IsFavorite);

            var total = await query.CountAsync(ct);
            var rows = await query.OrderByDescending(h => h.PlayedAt)
                .Skip(Math.Max(0, page) * pageSize).Take(pageSize).ToListAsync(ct);
            return new
            {
                total,
                items = rows.Select(h => new
                {
                    id = h.Id,
                    track = TrackDto(h.Track),
                    requestedBy = h.RequestedByName,
                    platform = h.RequestedPlatform,
                    endReason = h.EndReason,
                    isFavorite = h.IsFavorite,
                    playedAt = h.PlayedAt
                })
            };
        }

        public async Task<bool> SetFavoriteAsync(long userId, long historyId, bool favorite, CancellationToken ct = default)
        {
            var row = await _db.SongRequestHistory.FirstOrDefaultAsync(h => h.Id == historyId && h.UserId == userId, ct);
            if (row == null)
                return false;
            row.IsFavorite = favorite;
            await _db.SaveChangesAsync(ct);
            return true;
        }

        public Task<SongRequestHistoryItem?> GetHistoryItemAsync(long userId, long historyId, CancellationToken ct = default) =>
            _db.SongRequestHistory.Include(h => h.Track).FirstOrDefaultAsync(h => h.Id == historyId && h.UserId == userId, ct);

        /// <summary>Borra el historial menos las favoritas.</summary>
        public Task<int> ClearHistoryAsync(long userId, CancellationToken ct = default) =>
            _db.SongRequestHistory.Where(h => h.UserId == userId && !h.IsFavorite).ExecuteDeleteAsync(ct);

        // ── Playlist de respaldo ─────────────────────────────────────────────

        public async Task<List<object>> GetFallbackAsync(long userId, CancellationToken ct = default)
        {
            var rows = await _db.SongRequestFallback.AsNoTracking().Include(f => f.Track)
                .Where(f => f.UserId == userId).OrderBy(f => f.Position).ThenBy(f => f.Id).ToListAsync(ct);
            return rows.Select(f => (object)new { id = f.Id, track = TrackDto(f.Track) }).ToList();
        }

        /// <returns>null si se agregó; si no, la clave del error (already_in_fallback, fallback_full, las del resolutor).</returns>
        public async Task<string?> AddToFallbackAsync(long userId, SongTrack track, CancellationToken ct = default)
        {
            if (await _db.SongRequestFallback.AnyAsync(f => f.UserId == userId && f.TrackId == track.Id, ct))
                return "already_in_fallback";
            var count = await _db.SongRequestFallback.CountAsync(f => f.UserId == userId, ct);
            if (count >= MaxFallbackItems)
                return "fallback_full";

            var last = await _db.SongRequestFallback.Where(f => f.UserId == userId).MaxAsync(f => (int?)f.Position, ct) ?? 0;
            _db.SongRequestFallback.Add(new SongRequestFallbackItem { UserId = userId, TrackId = track.Id, Position = last + 1, CreatedAt = DateTime.UtcNow });
            await _db.SaveChangesAsync(ct);
            return null;
        }

        /// <summary>Link o texto → se resuelve igual que !sr y se agrega.</summary>
        public async Task<string?> AddToFallbackAsync(long userId, string input, CancellationToken ct = default)
        {
            var resolved = await _resolver.ResolveAsync(input, ct);
            return resolved.Success
                ? await AddToFallbackAsync(userId, resolved.Track!, ct)
                : SongRequestService.ErrorKeyFor(resolved.Error);
        }

        /// <summary>Importa una playlist entera (YouTube). Devuelve cuántas se agregaron, o el error.</summary>
        public async Task<(int Added, int Skipped, string? Error)> ImportPlaylistAsync(long userId, string url, CancellationToken ct = default)
        {
            if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri))
                return (0, 0, "invalid_link");
            var source = _playlists.FirstOrDefault(p => p.CanHandlePlaylist(uri));
            if (source == null)
                return (0, 0, "not_a_playlist");

            var existingCount = await _db.SongRequestFallback.CountAsync(f => f.UserId == userId, ct);
            var room = MaxFallbackItems - existingCount;
            if (room <= 0)
                return (0, 0, "fallback_full");

            var (tracks, error) = await source.ListPlaylistAsync(uri, Math.Min(room + 50, MaxFallbackItems), ct);
            if (tracks.Count == 0)
                return (0, 0, SongRequestService.ErrorKeyFor(error));

            var saved = await _resolver.UpsertTracksAsync(tracks, ct);
            var already = (await _db.SongRequestFallback.Where(f => f.UserId == userId).Select(f => f.TrackId).ToListAsync(ct)).ToHashSet();
            var last = await _db.SongRequestFallback.Where(f => f.UserId == userId).MaxAsync(f => (int?)f.Position, ct) ?? 0;

            var added = 0;
            foreach (var t in saved)
            {
                if (added >= room || !already.Add(t.Id))
                    continue;
                _db.SongRequestFallback.Add(new SongRequestFallbackItem { UserId = userId, TrackId = t.Id, Position = last + ++added, CreatedAt = DateTime.UtcNow });
            }
            await _db.SaveChangesAsync(ct);
            return (added, saved.Count - added, null);
        }

        public async Task<bool> RemoveFromFallbackAsync(long userId, long id, CancellationToken ct = default) =>
            await _db.SongRequestFallback.Where(f => f.Id == id && f.UserId == userId).ExecuteDeleteAsync(ct) > 0;

        public Task<int> ClearFallbackAsync(long userId, CancellationToken ct = default) =>
            _db.SongRequestFallback.Where(f => f.UserId == userId).ExecuteDeleteAsync(ct);

        public async Task ReorderFallbackAsync(long userId, IReadOnlyList<long> orderedIds, CancellationToken ct = default)
        {
            var rows = await _db.SongRequestFallback.Where(f => f.UserId == userId).ToListAsync(ct);
            var rank = orderedIds.Select((id, i) => (id, i)).ToDictionary(x => x.id, x => x.i);
            var ordered = rows.OrderBy(f => rank.TryGetValue(f.Id, out var r) ? r : int.MaxValue).ThenBy(f => f.Position).ToList();
            for (var i = 0; i < ordered.Count; i++)
                ordered[i].Position = i + 1;
            await _db.SaveChangesAsync(ct);
        }

        // ── Listas negras ────────────────────────────────────────────────────

        public async Task<List<object>> GetBansAsync(long userId, CancellationToken ct = default)
        {
            var rows = await _db.SongRequestBans.AsNoTracking().Where(b => b.UserId == userId)
                .OrderByDescending(b => b.CreatedAt).ToListAsync(ct);
            return rows.Select(b => (object)new
            {
                id = b.Id, type = b.BanType, value = b.Value, label = b.Label, createdBy = b.CreatedBy, createdAt = b.CreatedAt
            }).ToList();
        }

        public async Task<bool> RemoveBanAsync(long userId, long id, CancellationToken ct = default) =>
            await _db.SongRequestBans.Where(b => b.Id == id && b.UserId == userId).ExecuteDeleteAsync(ct) > 0;
    }
}
