using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Interfaces;
using Decatron.Core.Models.SongRequest;
using Decatron.Data;
using Decatron.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.SongRequest
{
    /// <summary>Qué pasó al decidir un pendiente. ErrorKey null = se hizo.</summary>
    public sealed record ReviewResult(string? ErrorKey, SongRequestPending? Pending = null, int Position = 0);

    /// <summary>
    /// La bandeja de pendientes y los viewers de confianza (.dev/plans/SONG_REQUEST_PLAYLISTS_PLAN.md, fase 3).
    /// Al decidir se avisa en el chat donde se pidió (si se pidió por chat o desde /sr con cuenta de ese chat).
    /// </summary>
    public sealed class SongRequestReviewService
    {
        private readonly DecatronDbContext _db;
        private readonly SongRequestService _songs;
        private readonly SongRequestLibraryService _library;
        private readonly SongResolverService _resolver;
        private readonly IMessageSender _sender;
        private readonly ICommandMessagesService _messages;
        private readonly ILogger<SongRequestReviewService> _logger;

        public SongRequestReviewService(DecatronDbContext db, SongRequestService songs, SongRequestLibraryService library, SongResolverService resolver,
            IMessageSender sender, ICommandMessagesService messages, ILogger<SongRequestReviewService> logger)
        {
            _db = db;
            _songs = songs;
            _library = library;
            _resolver = resolver;
            _sender = sender;
            _messages = messages;
            _logger = logger;
        }

        /// <summary>Todo lo que espera, del más viejo al más nuevo (así lo numeran !srapprove y !srreject).</summary>
        private IQueryable<SongRequestPending> Pending(long ownerId) =>
            _db.SongRequestPending.Include(p => p.Track).Where(p => p.UserId == ownerId).OrderBy(p => p.Id);

        public async Task<List<object>> ListAsync(long ownerId, CancellationToken ct = default)
        {
            var rows = await Pending(ownerId).AsNoTracking().ToListAsync(ct);
            var playlistIds = rows.Where(r => r.PlaylistId != null).Select(r => r.PlaylistId!.Value).Distinct().ToList();
            var names = await _db.SongRequestPlaylists.AsNoTracking().Where(p => playlistIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p.Name, ct);
            var trusted = (await _db.SongRequestTrusted.AsNoTracking().Where(t => t.UserId == ownerId)
                .Select(t => t.Platform + ":" + t.Login).ToListAsync(ct)).ToHashSet();

            return rows.Select((p, i) => (object)new
            {
                id = p.Id,
                number = i + 1,
                playlistId = p.PlaylistId,
                playlistName = p.PlaylistId == null ? null : names.GetValueOrDefault(p.PlaylistId.Value),
                title = p.OriginTitle ?? p.Track?.Title ?? "",
                artist = p.OriginArtist ?? p.Track?.Artist ?? "",
                url = p.OriginUrl ?? (p.Track == null ? null : _resolver.GetSource(p.Track.Source)?.GetPublicUrl(p.Track.SourceId)),
                thumbnailUrl = p.OriginThumbnailUrl ?? p.Track?.ThumbnailUrl,
                durationSeconds = p.Track?.DurationSeconds,
                requestedBy = p.RequestedByName,
                platform = p.RequestedPlatform,
                trusted = trusted.Contains(p.RequestedPlatform + ":" + p.RequestedByLogin),
                createdAt = p.CreatedAt
            }).ToList();
        }

        /// <summary>El pendiente número <paramref name="number"/> (1 = el más viejo), como lo cuentan los comandos del chat.</summary>
        public Task<SongRequestPending?> FindByNumberAsync(long ownerId, int number, CancellationToken ct = default) =>
            number < 1 ? Task.FromResult<SongRequestPending?>(null) : Pending(ownerId).Skip(number - 1).FirstOrDefaultAsync(ct);

        public Task<SongRequestPending?> FindAsync(long ownerId, long id, CancellationToken ct = default) =>
            _db.SongRequestPending.Include(p => p.Track).FirstOrDefaultAsync(p => p.Id == id && p.UserId == ownerId, ct);

        /// <summary>Aprueba: entra a la cola (o a su playlist) a nombre de quien lo pidió, y se avisa en su chat.</summary>
        public async Task<ReviewResult> ApproveAsync(SongRequestConfig config, SongRequestPending pending, CancellationToken ct = default)
        {
            int position = 0;
            string? error = null;
            SongRequestPlaylist? playlist = null;

            if (pending.PlaylistId == null)
            {
                var (item, pos, err) = await _songs.EnqueueApprovedAsync(config, pending, ct);
                position = pos;
                error = item == null ? err : null;
            }
            else
            {
                playlist = await _db.SongRequestPlaylists.AsNoTracking().FirstOrDefaultAsync(p => p.Id == pending.PlaylistId, ct);
                if (playlist == null)
                    error = "not_found";
                else if (await _db.SongRequestPlaylistItems.AnyAsync(i => i.PlaylistId == playlist.Id && i.TrackId == pending.TrackId, ct))
                    error = "already_in_playlist";
                else if (await _db.SongRequestPlaylistItems.CountAsync(i => i.PlaylistId == playlist.Id, ct) >= (await _library.GetLimitsAsync(config.UserId)).MaxItemsPerPlaylist)
                    error = "playlist_full";
                else
                {
                    var last = await _db.SongRequestPlaylistItems.Where(i => i.PlaylistId == playlist.Id).MaxAsync(i => (int?)i.Position, ct) ?? 0;
                    _db.SongRequestPlaylistItems.Add(new SongRequestPlaylistItem
                    {
                        PlaylistId = playlist.Id,
                        UserId = config.UserId,
                        TrackId = pending.TrackId,
                        Position = last + 1,
                        AddedByPlatform = pending.RequestedPlatform,
                        AddedById = pending.RequestedById,
                        AddedByLogin = pending.RequestedByLogin,
                        AddedByName = pending.RequestedByName,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            // Ya estaba donde iba: igual sale de la bandeja, no hay nada más que decidir
            _db.SongRequestPending.Remove(pending);
            await _db.SaveChangesAsync(ct);
            await _songs.NotifyAsync(config, ct);
            if (pending.PlaylistId != null)
                await _songs.NotifyPlaylistsAsync(config.UserId, ct);

            if (error is null or "already_queued" or "already_in_playlist")
            {
                var key = pending.PlaylistId == null ? "pending_approved" : "pl_pending_approved";
                await TellAsync(config, pending, key, new() { ["position"] = position.ToString(), ["playlist"] = playlist?.Name ?? "" });
            }
            return new ReviewResult(error, pending, position);
        }

        /// <param name="notify">false = se descarta en silencio (spam, trolls).</param>
        public async Task<ReviewResult> RejectAsync(SongRequestConfig config, SongRequestPending pending, bool notify, CancellationToken ct = default)
        {
            _db.SongRequestPending.Remove(pending);
            await _db.SaveChangesAsync(ct);
            await _songs.NotifyAsync(config, ct);
            if (notify)
                await TellAsync(config, pending, "pending_rejected", new());
            return new ReviewResult(null, pending);
        }

        /// <summary>Veta a quien lo pidió: se va todo lo suyo de la bandeja y de la cola.</summary>
        public async Task<ReviewResult> BanRequesterAsync(SongRequestConfig config, SongRequestPending pending, string? by, CancellationToken ct = default)
        {
            await _songs.BanAsync(config.UserId, "user", $"{pending.RequestedPlatform}:{pending.RequestedByLogin}", pending.RequestedByLogin, by, ct);
            await _db.SongRequestPending
                .Where(p => p.UserId == config.UserId && p.RequestedPlatform == pending.RequestedPlatform && p.RequestedByLogin == pending.RequestedByLogin)
                .ExecuteDeleteAsync(ct);
            await _songs.RemoveAllByUserAsync(config, pending.RequestedPlatform, pending.RequestedByLogin, ct);
            await _songs.NotifyAsync(config, ct);
            return new ReviewResult(null, pending);
        }

        /// <summary>Confía en quien lo pidió y aprueba lo que tenga esperando.</summary>
        public async Task<ReviewResult> TrustAndApproveAsync(SongRequestConfig config, SongRequestPending pending, string? by, CancellationToken ct = default)
        {
            await AddTrustedAsync(config.UserId, pending.RequestedPlatform, pending.RequestedByLogin, pending.RequestedByName, by, ct);
            var all = await Pending(config.UserId)
                .Where(p => p.RequestedPlatform == pending.RequestedPlatform && p.RequestedByLogin == pending.RequestedByLogin)
                .ToListAsync(ct);
            ReviewResult first = new(null, pending);
            foreach (var p in all)
            {
                var r = await ApproveAsync(config, p, ct);
                if (p.Id == pending.Id) first = r;
            }
            return first;
        }

        // ── Viewers de confianza ─────────────────────────────────────────────

        public async Task<List<object>> ListTrustedAsync(long ownerId, CancellationToken ct = default)
        {
            var rows = await _db.SongRequestTrusted.AsNoTracking().Where(t => t.UserId == ownerId)
                .OrderBy(t => t.DisplayName).ToListAsync(ct);
            return rows.Select(t => (object)new
            {
                id = t.Id, platform = t.Platform, login = t.Login, displayName = t.DisplayName, createdBy = t.CreatedBy, createdAt = t.CreatedAt
            }).ToList();
        }

        /// <returns>false si ya estaba.</returns>
        public async Task<bool> AddTrustedAsync(long ownerId, string platform, string login, string? displayName, string? by, CancellationToken ct = default)
        {
            var clean = login.Trim().TrimStart('@').ToLowerInvariant();
            if (await _db.SongRequestTrusted.AnyAsync(t => t.UserId == ownerId && t.Platform == platform && t.Login == clean, ct))
                return false;
            _db.SongRequestTrusted.Add(new SongRequestTrusted
            {
                UserId = ownerId,
                Platform = platform,
                Login = clean,
                DisplayName = string.IsNullOrWhiteSpace(displayName) ? clean : displayName.Trim(),
                CreatedBy = by,
                CreatedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync(ct);
            return true;
        }

        public async Task<bool> RemoveTrustedAsync(long ownerId, long id, CancellationToken ct = default) =>
            await _db.SongRequestTrusted.Where(t => t.Id == id && t.UserId == ownerId).ExecuteDeleteAsync(ct) > 0;

        // ── Avisos ───────────────────────────────────────────────────────────

        /// <summary>
        /// El chat donde avisar a un viewer que agregó desde /sr: el de Twitch por login, el de Kick por su
        /// id (lo que entiende el IMessageSender). Null si el canal no tiene cuenta en esa plataforma.
        /// </summary>
        public async Task<string?> ReplyChannelForAsync(SongRequestConfig config, string platform, CancellationToken ct = default)
        {
            if (platform != "kick")
                return config.ChannelName;
            var owner = await _db.Users.AsNoTracking().Where(u => u.Id == config.UserId).Select(u => new { u.KickId, u.AccountId }).FirstOrDefaultAsync(ct);
            if (owner?.KickId != null)
                return owner.KickId;
            if (owner?.AccountId == null)
                return null;
            return await _db.Users.AsNoTracking().Where(u => u.AccountId == owner.AccountId && u.KickId != null).Select(u => u.KickId).FirstOrDefaultAsync(ct);
        }

        private async Task TellAsync(SongRequestConfig config, SongRequestPending pending, string key, Dictionary<string, string> vars)
        {
            if (string.IsNullOrEmpty(pending.ReplyChannel))
                return;
            try
            {
                var template = await TemplateAsync(config, key);
                if (string.IsNullOrWhiteSpace(template))
                    return; // el streamer apagó ese mensaje
                var title = pending.OriginTitle ?? pending.Track?.Title ?? "";
                vars["title"] = title.Length <= 80 ? title : title[..79].TrimEnd() + "…";
                vars["requester"] = pending.RequestedByLogin;
                vars["user"] = pending.RequestedByLogin;
                var message = vars.Aggregate(template, (text, kv) => text.Replace("{" + kv.Key + "}", kv.Value));
                await _sender.SendMessageAsync(pending.ReplyChannel, message.Length <= 480 ? message : message[..479] + "…");
            }
            catch (Exception ex)
            {
                // Un aviso que no sale no puede deshacer la decisión
                _logger.LogWarning(ex, "[SongRequest] No se pudo avisar {Key} en {Channel}", key, pending.ReplyChannel);
            }
        }

        /// <summary>Lo que editó el streamer; si no, el mensaje por defecto en el idioma del canal.</summary>
        private async Task<string> TemplateAsync(SongRequestConfig config, string key)
        {
            if (SongRequestService.ParseSettings(config).Messages.TryGetValue(key, out var custom))
                return custom;
            var language = await _db.Users.AsNoTracking().Where(u => u.Id == config.UserId).Select(u => u.PreferredLanguage).FirstOrDefaultAsync() ?? "es";
            return _messages.GetMessage("songrequest", key, language);
        }
    }
}
