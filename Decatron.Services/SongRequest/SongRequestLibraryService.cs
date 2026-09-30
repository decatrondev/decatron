using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Helpers;
using Decatron.Core.Models.SongRequest;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.SongRequest
{
    /// <summary>
    /// Lo que el canal guarda aparte de la cola: historial, playlists y listas negras.
    /// Planes: .dev/plans/SONG_REQUEST_PLAN.md (fase 3) y SONG_REQUEST_PLAYLISTS_PLAN.md (playlists y tiers).
    /// </summary>
    public sealed class SongRequestLibraryService
    {
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

        /// <summary>
        /// El historial que permite el plan: las favoritas se ven siempre; el resto, los últimos días del plan.
        /// No se borra nada: con un plan mayor vuelve a verse lo anterior.
        /// </summary>
        public async Task<object> GetHistoryAsync(long userId, int page, int pageSize, bool favoritesOnly, CancellationToken ct = default)
        {
            var limits = await GetLimitsAsync(userId);
            var query = _db.SongRequestHistory.AsNoTracking().Include(h => h.Track).Where(h => h.UserId == userId);
            if (favoritesOnly)
                query = query.Where(h => h.IsFavorite);
            else if (!limits.UnlimitedHistory)
            {
                var since = DateTime.UtcNow.AddDays(-limits.HistoryDays);
                query = query.Where(h => h.IsFavorite || h.PlayedAt >= since);
            }

            var total = await query.CountAsync(ct);
            var rows = await query.OrderByDescending(h => h.PlayedAt)
                .Skip(Math.Max(0, page) * pageSize).Take(pageSize).ToListAsync(ct);
            return new
            {
                total,
                historyDays = limits.UnlimitedHistory ? (int?)null : limits.HistoryDays,
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

        // ── Playlists ────────────────────────────────────────────────────────

        /// <summary>Los límites del plan del dueño del canal.</summary>
        public async Task<SongRequestTierLimits> GetLimitsAsync(long userId) =>
            SongRequestTierLimits.ForTier(await TierResolver.GetEffectiveTierAsync(_db, userId));

        private Task<SongRequestPlaylist?> FindPlaylistAsync(long userId, long playlistId, CancellationToken ct) =>
            _db.SongRequestPlaylists.FirstOrDefaultAsync(p => p.Id == playlistId && p.UserId == userId, ct);

        /// <summary>
        /// Las playlists del canal con cuántas canciones tiene cada una. Un canal nuevo arranca con su
        /// playlist de respaldo (los que ya existían la recibieron en la migración).
        /// </summary>
        public async Task<List<object>> GetPlaylistsAsync(long userId, CancellationToken ct = default)
        {
            if (!await _db.SongRequestPlaylists.AnyAsync(p => p.UserId == userId, ct))
            {
                var lang = await _db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => u.PreferredLanguage).FirstOrDefaultAsync(ct);
                _db.SongRequestPlaylists.Add(new SongRequestPlaylist
                {
                    UserId = userId,
                    Name = lang != null && lang.StartsWith("en", StringComparison.OrdinalIgnoreCase) ? "Fallback playlist" : "Playlist de respaldo",
                    IsFallback = true
                });
                await _db.SaveChangesAsync(ct);
            }

            var counts = await _db.SongRequestPlaylistItems.Where(i => i.UserId == userId)
                .GroupBy(i => i.PlaylistId).Select(g => new { g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Key, x => x.Count, ct);
            var rows = await _db.SongRequestPlaylists.AsNoTracking().Where(p => p.UserId == userId)
                .OrderByDescending(p => p.IsFallback).ThenBy(p => p.CreatedAt).ThenBy(p => p.Id).ToListAsync(ct);
            return rows.Select(p => (object)new
            {
                id = p.Id,
                name = p.Name,
                visibility = p.Visibility,
                contribution = p.Contribution,
                requirements = SongRequestContributionService.ParseRequirements(p.Requirements),
                isFallback = p.IsFallback,
                shuffle = p.Shuffle,
                count = counts.GetValueOrDefault(p.Id)
            }).ToList();
        }

        public const int MaxPlaylistName = 60;

        private static string? CleanName(string? name)
        {
            var clean = (name ?? "").Trim();
            return clean.Length is 0 or > MaxPlaylistName ? null : clean;
        }

        /// <returns>El id nuevo, o la clave del error (invalid_name, name_taken, playlists_limit).</returns>
        public async Task<(long? Id, string? Error)> CreatePlaylistAsync(long userId, string? name, CancellationToken ct = default)
        {
            var clean = CleanName(name);
            if (clean == null)
                return (null, "invalid_name");
            if (await _db.SongRequestPlaylists.AnyAsync(p => p.UserId == userId && p.Name.ToLower() == clean.ToLower(), ct))
                return (null, "name_taken");
            var limits = await GetLimitsAsync(userId);
            if (await _db.SongRequestPlaylists.CountAsync(p => p.UserId == userId, ct) >= limits.MaxPlaylists)
                return (null, "playlists_limit");

            var playlist = new SongRequestPlaylist { UserId = userId, Name = clean };
            _db.SongRequestPlaylists.Add(playlist);
            await _db.SaveChangesAsync(ct);
            return (playlist.Id, null);
        }

        public sealed class PlaylistChanges
        {
            public string? Name { get; set; }
            public string? Visibility { get; set; }
            public bool? Shuffle { get; set; }
            /// <summary>true la vuelve la de respaldo (la anterior deja de serlo).</summary>
            public bool? IsFallback { get; set; }
            /// <summary>owner | open.</summary>
            public string? Contribution { get; set; }
            public SongRequestPlaylistRequirements? Requirements { get; set; }
        }

        /// <returns>null si se guardó; si no, la clave del error (not_found, invalid_name, name_taken, invalid_visibility).</returns>
        public async Task<string?> UpdatePlaylistAsync(long userId, long playlistId, PlaylistChanges changes, CancellationToken ct = default)
        {
            var playlist = await FindPlaylistAsync(userId, playlistId, ct);
            if (playlist == null)
                return "not_found";

            if (changes.Name != null)
            {
                var clean = CleanName(changes.Name);
                if (clean == null)
                    return "invalid_name";
                if (await _db.SongRequestPlaylists.AnyAsync(p => p.UserId == userId && p.Id != playlistId && p.Name.ToLower() == clean.ToLower(), ct))
                    return "name_taken";
                playlist.Name = clean;
            }
            if (changes.Visibility != null)
            {
                if (!SongRequestPlaylistVisibility.IsValid(changes.Visibility))
                    return "invalid_visibility";
                playlist.Visibility = changes.Visibility;
            }
            if (changes.Shuffle.HasValue)
                playlist.Shuffle = changes.Shuffle.Value;
            if (changes.Contribution != null)
            {
                if (!SongRequestPlaylistContribution.IsValid(changes.Contribution))
                    return "invalid_contribution";
                playlist.Contribution = changes.Contribution;
            }
            if (changes.Requirements != null)
            {
                var error = SongRequestContributionService.Validate(changes.Requirements);
                if (error != null)
                    return error;
                playlist.Requirements = System.Text.Json.JsonSerializer.Serialize(changes.Requirements);
            }

            if (changes.IsFallback.HasValue && changes.IsFallback.Value != playlist.IsFallback)
            {
                // El índice único admite una sola de respaldo: primero se suelta la anterior
                if (changes.IsFallback.Value)
                {
                    await _db.SongRequestPlaylists.Where(p => p.UserId == userId && p.IsFallback && p.Id != playlistId)
                        .ExecuteUpdateAsync(u => u.SetProperty(p => p.IsFallback, false), ct);
                    playlist.Cursor = 0;
                }
                playlist.IsFallback = changes.IsFallback.Value;
            }

            playlist.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            return null;
        }

        /// <summary>Borra la playlist con sus canciones. Si era la de respaldo, no suena ninguna hasta elegir otra.</summary>
        public async Task<bool> DeletePlaylistAsync(long userId, long playlistId, CancellationToken ct = default) =>
            await _db.SongRequestPlaylists.Where(p => p.Id == playlistId && p.UserId == userId).ExecuteDeleteAsync(ct) > 0;

        public async Task<List<object>?> GetPlaylistItemsAsync(long userId, long playlistId, CancellationToken ct = default)
        {
            if (!await _db.SongRequestPlaylists.AnyAsync(p => p.Id == playlistId && p.UserId == userId, ct))
                return null;
            var rows = await _db.SongRequestPlaylistItems.AsNoTracking().Include(i => i.Track)
                .Where(i => i.PlaylistId == playlistId).OrderBy(i => i.Position).ThenBy(i => i.Id).ToListAsync(ct);
            return rows.Select(i => (object)new
            {
                id = i.Id,
                track = TrackDto(i.Track),
                addedBy = i.AddedByName,
                addedByPlatform = i.AddedByPlatform,
                addedAt = i.CreatedAt
            }).ToList();
        }

        /// <returns>null si se agregó; si no, la clave del error (not_found, already_in_playlist, playlist_full).</returns>
        public async Task<string?> AddToPlaylistAsync(long userId, long playlistId, SongTrack track, CancellationToken ct = default)
        {
            var playlist = await FindPlaylistAsync(userId, playlistId, ct);
            if (playlist == null)
                return "not_found";
            if (await _db.SongRequestPlaylistItems.AnyAsync(i => i.PlaylistId == playlistId && i.TrackId == track.Id, ct))
                return "already_in_playlist";
            var limits = await GetLimitsAsync(userId);
            if (await _db.SongRequestPlaylistItems.CountAsync(i => i.PlaylistId == playlistId, ct) >= limits.MaxItemsPerPlaylist)
                return "playlist_full";

            var last = await _db.SongRequestPlaylistItems.Where(i => i.PlaylistId == playlistId).MaxAsync(i => (int?)i.Position, ct) ?? 0;
            _db.SongRequestPlaylistItems.Add(new SongRequestPlaylistItem
            {
                PlaylistId = playlistId, UserId = userId, TrackId = track.Id, Position = last + 1, CreatedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync(ct);
            return null;
        }

        /// <summary>Link o texto → se resuelve igual que !sr y se agrega.</summary>
        public async Task<string?> AddToPlaylistAsync(long userId, long playlistId, string input, CancellationToken ct = default)
        {
            if (!await _db.SongRequestPlaylists.AnyAsync(p => p.Id == playlistId && p.UserId == userId, ct))
                return "not_found";
            var resolved = await _resolver.ResolveAsync(input, ct);
            return resolved.Success
                ? await AddToPlaylistAsync(userId, playlistId, resolved.Track!, ct)
                : SongRequestService.ErrorKeyFor(resolved.Error);
        }

        /// <summary>Importa una playlist entera (YouTube). Devuelve cuántas se agregaron, o el error.</summary>
        public async Task<(int Added, int Skipped, string? Error)> ImportPlaylistAsync(long userId, long playlistId, string url, CancellationToken ct = default)
        {
            if (!await _db.SongRequestPlaylists.AnyAsync(p => p.Id == playlistId && p.UserId == userId, ct))
                return (0, 0, "not_found");
            if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri))
                return (0, 0, "invalid_link");
            var source = _playlists.FirstOrDefault(p => p.CanHandlePlaylist(uri));
            if (source == null)
                return (0, 0, "not_a_playlist");

            var max = (await GetLimitsAsync(userId)).MaxItemsPerPlaylist;
            var existingCount = await _db.SongRequestPlaylistItems.CountAsync(i => i.PlaylistId == playlistId, ct);
            var room = max - existingCount;
            if (room <= 0)
                return (0, 0, "playlist_full");

            var (tracks, error) = await source.ListPlaylistAsync(uri, Math.Min(room + 50, max), ct);
            if (tracks.Count == 0)
                return (0, 0, SongRequestService.ErrorKeyFor(error));

            var saved = await _resolver.UpsertTracksAsync(tracks, ct);
            var already = (await _db.SongRequestPlaylistItems.Where(i => i.PlaylistId == playlistId).Select(i => i.TrackId).ToListAsync(ct)).ToHashSet();
            var last = await _db.SongRequestPlaylistItems.Where(i => i.PlaylistId == playlistId).MaxAsync(i => (int?)i.Position, ct) ?? 0;

            var added = 0;
            foreach (var t in saved)
            {
                if (added >= room || !already.Add(t.Id))
                    continue;
                _db.SongRequestPlaylistItems.Add(new SongRequestPlaylistItem
                {
                    PlaylistId = playlistId, UserId = userId, TrackId = t.Id, Position = last + ++added, CreatedAt = DateTime.UtcNow
                });
            }
            await _db.SaveChangesAsync(ct);
            return (added, saved.Count - added, null);
        }

        public async Task<bool> RemoveFromPlaylistAsync(long userId, long playlistId, long itemId, CancellationToken ct = default) =>
            await _db.SongRequestPlaylistItems.Where(i => i.Id == itemId && i.PlaylistId == playlistId && i.UserId == userId).ExecuteDeleteAsync(ct) > 0;

        public Task<int> ClearPlaylistAsync(long userId, long playlistId, CancellationToken ct = default) =>
            _db.SongRequestPlaylistItems.Where(i => i.PlaylistId == playlistId && i.UserId == userId).ExecuteDeleteAsync(ct);

        public async Task ReorderPlaylistAsync(long userId, long playlistId, IReadOnlyList<long> orderedIds, CancellationToken ct = default)
        {
            var rows = await _db.SongRequestPlaylistItems.Where(i => i.PlaylistId == playlistId && i.UserId == userId).ToListAsync(ct);
            var rank = orderedIds.Select((id, i) => (id, i)).ToDictionary(x => x.id, x => x.i);
            var ordered = rows.OrderBy(i => rank.TryGetValue(i.Id, out var r) ? r : int.MaxValue).ThenBy(i => i.Position).ToList();
            for (var i = 0; i < ordered.Count; i++)
                ordered[i].Position = i + 1;
            await _db.SaveChangesAsync(ct);
        }

        // ── Playlists públicas (/sr/{canal}) ─────────────────────────────────

        public async Task<List<object>> GetPublicPlaylistsAsync(long userId, CancellationToken ct = default)
        {
            var rows = await _db.SongRequestPlaylists.AsNoTracking()
                .Where(p => p.UserId == userId && p.Visibility == SongRequestPlaylistVisibility.Public)
                .OrderByDescending(p => p.IsFallback).ThenBy(p => p.CreatedAt).ThenBy(p => p.Id)
                .Select(p => new { p.Id, p.Name, p.Contribution, p.Requirements, Count = _db.SongRequestPlaylistItems.Count(i => i.PlaylistId == p.Id) })
                .ToListAsync(ct);
            return rows.Select(p => (object)new
            {
                id = p.Id,
                name = p.Name,
                count = p.Count,
                open = p.Contribution == SongRequestPlaylistContribution.Open,
                requirements = SongRequestContributionService.ParseRequirements(p.Requirements)
            }).ToList();
        }

        /// <returns>null si no existe o no es pública.</returns>
        public async Task<List<object>?> GetPublicPlaylistItemsAsync(long userId, long playlistId, CancellationToken ct = default)
        {
            if (!await _db.SongRequestPlaylists.AnyAsync(p => p.Id == playlistId && p.UserId == userId && p.Visibility == SongRequestPlaylistVisibility.Public, ct))
                return null;
            return await GetPlaylistItemsAsync(userId, playlistId, ct);
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
