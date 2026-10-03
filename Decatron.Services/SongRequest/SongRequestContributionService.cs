using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models.SongRequest;
using Decatron.Core.Services.Moderation;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.SongRequest
{
    /// <summary>
    /// Quién agrega una canción a una playlist desde el chat (!pladd) o desde /sr/{canal}.
    /// RoleLevel: 0 everyone, 1 sub, 2 vip, 3 mod, 4 lead mod, 5 streamer. Privileged = streamer,
    /// control_total o mod: no pasan por los requisitos de la playlist.
    /// </summary>
    public sealed record SongRequestContributor(string Platform, string? Id, string Login, string DisplayName, int RoleLevel, bool Privileged);

    /// <summary>Resultado de un aporte: la clave del mensaje y los datos para armarlo.</summary>
    /// <remarks><see cref="Pending"/>: quedó en la bandeja de pendientes (playlist "con revisión").</remarks>
    public sealed record ContributionResult(string? ErrorKey, SongTrack? Track = null, SongRequestPlaylist? Playlist = null, Dictionary<string, string>? Vars = null, bool Pending = false)
    {
        public bool Success => ErrorKey == null;
    }

    /// <summary>
    /// Aportes de viewers a las playlists colaborativas (.dev/plans/SONG_REQUEST_PLAYLISTS_PLAN.md, fase 2).
    /// Se valida lo barato antes de resolver (resolver cuesta segundos y llamadas a YouTube).
    /// </summary>
    public sealed class SongRequestContributionService
    {
        public static readonly string[] RoleOrder = { "everyone", "subscriber", "vip", "moderator", "lead_moderator", "broadcaster" };

        /// <summary>Espera mínima entre intentos de un mismo viewer, aunque fallen: resolver no es gratis.</summary>
        private static readonly TimeSpan MinAttemptGap = TimeSpan.FromSeconds(5);
        private static readonly ConcurrentDictionary<string, DateTime> _lastAttempt = new();

        private readonly DecatronDbContext _db;
        private readonly SongResolverService _resolver;
        private readonly SongRequestService _songs;
        private readonly SongRequestLibraryService _library;
        private readonly IAccountAgeProvider _accountAge;

        public SongRequestContributionService(DecatronDbContext db, SongResolverService resolver, SongRequestService songs,
            SongRequestLibraryService library, IAccountAgeProvider accountAge)
        {
            _db = db;
            _resolver = resolver;
            _songs = songs;
            _library = library;
            _accountAge = accountAge;
        }

        public static SongRequestPlaylistRequirements ParseRequirements(string? json)
        {
            try { return JsonSerializer.Deserialize<SongRequestPlaylistRequirements>(string.IsNullOrWhiteSpace(json) ? "{}" : json) ?? new(); }
            catch (JsonException) { return new(); }
        }

        /// <summary>Normaliza lo que manda el dashboard. Devuelve la clave del error o null.</summary>
        public static string? Validate(SongRequestPlaylistRequirements r)
        {
            if (!RoleOrder.Contains(r.MinRole))
                return "invalid_role";
            r.MinAccountAgeDays = Math.Clamp(r.MinAccountAgeDays, 0, 3650);
            r.MinFollowAgeDays = Math.Clamp(r.MinFollowAgeDays, 0, 3650);
            r.MaxPerUser = Math.Clamp(r.MaxPerUser, 0, 1000);
            r.MaxFromViewers = Math.Clamp(r.MaxFromViewers, 0, 100_000);
            r.CooldownMinutes = Math.Clamp(r.CooldownMinutes, 0, 7 * 24 * 60);
            return null;
        }

        /// <summary>Las playlists en las que alguien del chat puede agregar (colaborativas, o todas si es privilegiado).</summary>
        public Task<List<SongRequestPlaylist>> GetWritablePlaylistsAsync(long ownerId, bool privileged, CancellationToken ct = default) =>
            _db.SongRequestPlaylists.AsNoTracking()
                .Where(p => p.UserId == ownerId && (privileged || p.Contribution == SongRequestPlaylistContribution.Open || p.Contribution == SongRequestPlaylistContribution.Review))
                .OrderByDescending(p => p.IsFallback).ThenBy(p => p.CreatedAt).ThenBy(p => p.Id)
                .ToListAsync(ct);

        /// <summary>
        /// !pladd: separa "nombre de la playlist" de "link o canción" buscando el nombre más largo que coincida
        /// al principio. Si hay una sola playlist posible, el nombre se puede omitir.
        /// </summary>
        public static (SongRequestPlaylist? Playlist, string Input) MatchPlaylist(IReadOnlyList<SongRequestPlaylist> playlists, string args)
        {
            var text = args.Trim();
            // Solo el nombre, sin canción: el comando responde cómo se usa
            var exact = playlists.FirstOrDefault(p => string.Equals(p.Name, text, StringComparison.OrdinalIgnoreCase));
            if (exact != null)
                return (exact, "");
            var match = playlists
                .Where(p => text.Length > p.Name.Length
                    && text.StartsWith(p.Name, StringComparison.OrdinalIgnoreCase)
                    && char.IsWhiteSpace(text[p.Name.Length]))
                .OrderByDescending(p => p.Name.Length)
                .FirstOrDefault();
            if (match != null)
                return (match, text[match.Name.Length..].Trim());
            return playlists.Count == 1 ? (playlists[0], text) : (null, text);
        }

        /// <summary>Los viewers de confianza del canal no pasan por revisión.</summary>
        public Task<bool> IsTrustedAsync(long ownerId, string platform, string login, CancellationToken ct = default) =>
            _db.SongRequestTrusted.AnyAsync(t => t.UserId == ownerId && t.Platform == platform && t.Login == login.ToLower(), ct);

        /// <param name="replyChannel">A qué chat avisar si queda pendiente y después se decide.</param>
        public async Task<ContributionResult> AddAsync(SongRequestConfig config, SongRequestPlaylist playlist, SongRequestContributor who, string input, CancellationToken ct = default, string? replyChannel = null)
        {
            var ownerId = config.UserId;
            var login = who.Login.ToLowerInvariant();
            var reqs = ParseRequirements(playlist.Requirements);

            if (!who.Privileged && !SongRequestPlaylistContribution.AcceptsViewers(playlist.Contribution))
                return new("pl_closed", Playlist: playlist);
            if (await _songs.IsBannedAsync(ownerId, "user", $"{who.Platform}:{login}", ct))
                return new("banned_user", Playlist: playlist);

            var throttleKey = $"{ownerId}:{who.Platform}:{login}";
            var now = DateTime.UtcNow;
            if (!who.Privileged && _lastAttempt.TryGetValue(throttleKey, out var last) && now - last < MinAttemptGap)
                return new("pl_slow_down", Playlist: playlist);
            _lastAttempt[throttleKey] = now;
            if (_lastAttempt.Count > 50_000) _lastAttempt.Clear();

            if (!who.Privileged)
            {
                var denied = await CheckRequirementsAsync(config, playlist, reqs, who, login, ct);
                if (denied != null)
                    return denied;
            }

            var review = !who.Privileged && playlist.Contribution == SongRequestPlaylistContribution.Review
                && !await IsTrustedAsync(ownerId, who.Platform, login, ct);
            if (review && await _db.SongRequestPending.CountAsync(p => p.UserId == ownerId, ct) >= SongRequestService.MaxPending)
                return new("pending_full", Playlist: playlist);

            var limits = await _library.GetLimitsAsync(ownerId);
            if (await _db.SongRequestPlaylistItems.CountAsync(i => i.PlaylistId == playlist.Id, ct) >= limits.MaxItemsPerPlaylist)
                return new("playlist_full", Playlist: playlist);

            var resolved = await _resolver.ResolveAsync(input, ct);
            if (!resolved.Success)
                return new(SongRequestService.ErrorKeyFor(resolved.Error), Playlist: playlist);

            var track = resolved.Track!;
            if (await _songs.IsBannedAsync(ownerId, "track", $"{track.Source}:{track.SourceId}", ct))
                return new("banned_track", track, playlist);
            if (track.AuthorId != null && await _songs.IsBannedAsync(ownerId, "author", $"{track.Source}:{track.AuthorId}", ct))
                return new("banned_author", track, playlist);
            if (await _db.SongRequestPlaylistItems.AnyAsync(i => i.PlaylistId == playlist.Id && i.TrackId == track.Id, ct))
                return new("already_in_playlist", track, playlist);
            if (await _db.SongRequestPending.AnyAsync(p => p.PlaylistId == playlist.Id && p.TrackId == track.Id, ct))
                return new("already_pending", track, playlist);
            if (!who.Privileged)
            {
                var filtered = await _songs.CheckFiltersAsync(ownerId, SongRequestService.ParseSettings(config), track, ct, checkRepeat: false);
                if (filtered != null)
                    return new(filtered, track, playlist);
            }

            if (review)
            {
                var origin = resolved.Origin;
                _db.SongRequestPending.Add(new SongRequestPending
                {
                    UserId = ownerId,
                    PlaylistId = playlist.Id,
                    TrackId = track.Id,
                    RequestedPlatform = who.Platform,
                    RequestedById = who.Id,
                    RequestedByLogin = login,
                    RequestedByName = string.IsNullOrWhiteSpace(who.DisplayName) ? who.Login : who.DisplayName,
                    ReplyChannel = replyChannel,
                    OriginSource = origin?.Origin,
                    OriginUrl = origin?.Url,
                    OriginTitle = origin?.Title,
                    OriginArtist = origin?.Artist,
                    OriginThumbnailUrl = origin?.ThumbnailUrl,
                    CreatedAt = now
                });
                await _db.SaveChangesAsync(ct);
                await _songs.NotifyAsync(config, ct);
                return new(null, track, playlist, Pending: true);
            }

            var lastPosition = await _db.SongRequestPlaylistItems.Where(i => i.PlaylistId == playlist.Id).MaxAsync(i => (int?)i.Position, ct) ?? 0;
            _db.SongRequestPlaylistItems.Add(new SongRequestPlaylistItem
            {
                PlaylistId = playlist.Id,
                UserId = ownerId,
                TrackId = track.Id,
                Position = lastPosition + 1,
                AddedByPlatform = who.Platform,
                AddedById = who.Id,
                AddedByLogin = login,
                AddedByName = string.IsNullOrWhiteSpace(who.DisplayName) ? who.Login : who.DisplayName,
                CreatedAt = now
            });
            await _db.SaveChangesAsync(ct);
            await _songs.NotifyPlaylistsAsync(ownerId, ct);
            return new(null, track, playlist);
        }

        private async Task<ContributionResult?> CheckRequirementsAsync(SongRequestConfig config, SongRequestPlaylist playlist,
            SongRequestPlaylistRequirements reqs, SongRequestContributor who, string login, CancellationToken ct)
        {
            var required = Array.IndexOf(RoleOrder, reqs.MinRole);
            if (required > 0 && who.RoleLevel < required)
                return new("pl_role", Playlist: playlist, Vars: new() { ["role"] = reqs.MinRole });

            // Antigüedad de cuenta y follow: solo se pueden verificar en Twitch
            if ((reqs.MinAccountAgeDays > 0 || reqs.MinFollowAgeDays > 0) && (who.Platform != "twitch" || string.IsNullOrEmpty(who.Id)))
                return new("pl_unverifiable", Playlist: playlist);

            if (reqs.MinAccountAgeDays > 0)
            {
                var createdAt = await _accountAge.GetCreatedAtAsync(who.Id!);
                if (createdAt == null || (DateTime.UtcNow - createdAt.Value).TotalDays < reqs.MinAccountAgeDays)
                    return new("pl_account_age", Playlist: playlist, Vars: new() { ["days"] = reqs.MinAccountAgeDays.ToString() });
            }

            if (reqs.MinFollowAgeDays > 0)
            {
                var broadcasterId = await _db.Users.AsNoTracking().Where(u => u.Id == config.UserId).Select(u => u.TwitchId).FirstOrDefaultAsync(ct);
                var followedAt = broadcasterId == null ? null : await _db.ChannelFollowers.AsNoTracking()
                    .Where(f => f.BroadcasterId == broadcasterId && f.UserId == who.Id && f.IsFollowing == 0)
                    .Select(f => (DateTime?)f.FollowedAt).FirstOrDefaultAsync(ct);
                if (followedAt == null || (DateTime.UtcNow - followedAt.Value).TotalDays < reqs.MinFollowAgeDays)
                    return new("pl_follow_age", Playlist: playlist, Vars: new() { ["days"] = reqs.MinFollowAgeDays.ToString() });
            }

            // Lo que tiene esperando aprobación en esta playlist cuenta igual que lo ya agregado
            var mine = _db.SongRequestPlaylistItems.Where(i => i.PlaylistId == playlist.Id && i.AddedByPlatform == who.Platform && i.AddedByLogin == login);
            var minePending = _db.SongRequestPending.Where(p => p.PlaylistId == playlist.Id && p.RequestedPlatform == who.Platform && p.RequestedByLogin == login);
            if (reqs.CooldownMinutes > 0)
            {
                var lastItem = await mine.MaxAsync(i => (DateTime?)i.CreatedAt, ct);
                var lastPending = await minePending.MaxAsync(p => (DateTime?)p.CreatedAt, ct);
                var lastAdded = lastItem > lastPending || lastPending == null ? lastItem : lastPending;
                if (lastAdded != null)
                {
                    var wait = lastAdded.Value.AddMinutes(reqs.CooldownMinutes) - DateTime.UtcNow;
                    if (wait > TimeSpan.Zero)
                        return new("pl_cooldown", Playlist: playlist, Vars: new() { ["minutes"] = Math.Max(1, (int)Math.Ceiling(wait.TotalMinutes)).ToString() });
                }
            }
            if (reqs.MaxPerUser > 0 && await mine.CountAsync(ct) + await minePending.CountAsync(ct) >= reqs.MaxPerUser)
                return new("pl_user_limit", Playlist: playlist, Vars: new() { ["max"] = reqs.MaxPerUser.ToString() });
            if (reqs.MaxFromViewers > 0 && await _db.SongRequestPlaylistItems.CountAsync(i => i.PlaylistId == playlist.Id && i.AddedByLogin != null, ct) >= reqs.MaxFromViewers)
                return new("pl_viewers_full", Playlist: playlist);
            return null;
        }
    }
}
