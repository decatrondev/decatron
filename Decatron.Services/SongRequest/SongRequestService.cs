using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models.SongRequest;
using Decatron.Data;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.SongRequest
{
    /// <summary>Quién pidió la canción.</summary>
    public sealed record SongRequester(string Platform, string? Id, string Login, string DisplayName);

    /// <summary>
    /// Resultado de un pedido. Si falló, <see cref="ErrorKey"/> es la clave del mensaje del chat
    /// (bot-messages → songrequest) y <see cref="Track"/> puede venir para nombrar la canción.
    /// </summary>
    public sealed record SongAddResult(SongRequestQueueItem? Item, int Position, SongTrack? Track, string? ErrorKey)
    {
        public bool Success => Item != null;
        public static SongAddResult Fail(string errorKey, SongTrack? track = null) => new(null, 0, track, errorKey);
    }

    /// <summary>Plataforma de los pedidos que pone la playlist de respaldo (no los pidió nadie).</summary>
    public static class SongRequestPlatforms
    {
        public const string Fallback = "fallback";
        public const string Dashboard = "dashboard";
    }

    /// <summary>
    /// La cola de un canal: agregar, quitar, saltar, abrir/cerrar, pausar y vetar.
    /// Cada cambio se avisa por SignalR al overlay y a la cola pública.
    ///
    /// Quién reproduce: el reproductor (fase 2) toma la primera de la cola cuando no suena nada.
    /// Saltar termina la actual y pasa directo a la siguiente.
    /// </summary>
    public sealed class SongRequestService
    {
        public const string UpdatedEvent = "SongRequestUpdated";
        public const string ConfigChangedEvent = "SongRequestConfigChanged";

        private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

        private readonly DecatronDbContext _db;
        private readonly SongResolverService _resolver;
        private readonly IHubContext<SongRequestHub> _hub;
        private readonly SongRequestPlayerRegistry _players;
        private readonly IConfiguration _configuration;
        private readonly ILogger<SongRequestService> _logger;

        public SongRequestService(
            DecatronDbContext db,
            SongResolverService resolver,
            IHubContext<SongRequestHub> hub,
            SongRequestPlayerRegistry players,
            IConfiguration configuration,
            ILogger<SongRequestService> logger)
        {
            _db = db;
            _resolver = resolver;
            _hub = hub;
            _players = players;
            _configuration = configuration;
            _logger = logger;
        }

        public string PublicQueueUrl(string channelLogin) =>
            $"{(_configuration["SongRequest:PublicBaseUrl"] ?? "https://decatron.net").TrimEnd('/')}/sr/{channelLogin.ToLowerInvariant()}";

        // ── Config ───────────────────────────────────────────────────────────

        public Task<SongRequestConfig?> GetConfigAsync(long userId, CancellationToken ct = default) =>
            _db.SongRequestConfigs.FirstOrDefaultAsync(c => c.UserId == userId, ct);

        /// <summary>
        /// De qué canal es la cola. Un canal de Kick vinculado (misma cuenta) a uno de Twitch usa la
        /// cola del de Twitch: una sola cola, un solo reproductor y una sola config para los dos chats.
        /// Un canal de Kick sin Twitch vinculado tiene la suya.
        /// </summary>
        public async Task<long> GetQueueOwnerIdAsync(long userId, CancellationToken ct = default)
        {
            var row = await _db.Users.AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => new { u.Login, u.KickId, u.AccountId })
                .FirstOrDefaultAsync(ct);
            // Un canal de Kick es su propia fila con login "kick_<id>" (ver KickAuthController)
            if (row?.KickId == null || row.AccountId == null || row.Login != $"kick_{row.KickId}")
                return userId;

            var twitchId = await _db.Users.AsNoTracking()
                .Where(u => u.AccountId == row.AccountId && u.IsActive && u.KickId == null
                            && u.TwitchId != null && u.TwitchId != "")
                .OrderBy(u => u.Id)
                .Select(u => (long?)u.Id)
                .FirstOrDefaultAsync(ct);
            return twitchId ?? userId;
        }

        /// <summary>De qué chats llegan pedidos a la cola de este canal (ver <see cref="GetQueueOwnerIdAsync"/>).</summary>
        public async Task<string[]> GetQueuePlatformsAsync(long ownerId, CancellationToken ct = default)
        {
            var owner = await _db.Users.AsNoTracking()
                .Where(u => u.Id == ownerId)
                .Select(u => new { u.KickId, u.AccountId })
                .FirstOrDefaultAsync(ct);
            if (owner == null)
                return Array.Empty<string>();
            if (owner.KickId != null)
                return new[] { "kick" };

            var kickLinked = owner.AccountId != null && await _db.Users.AsNoTracking()
                .AnyAsync(u => u.AccountId == owner.AccountId && u.IsActive && u.KickId != null, ct);
            return kickLinked ? new[] { "twitch", "kick" } : new[] { "twitch" };
        }

        public async Task<SongRequestConfig> GetOrCreateConfigAsync(long userId, string channelLogin, CancellationToken ct = default)
        {
            var config = await GetConfigAsync(userId, ct);
            if (config != null)
                return config;

            config = new SongRequestConfig
            {
                UserId = userId,
                ChannelName = channelLogin.ToLowerInvariant(),
                Settings = JsonSerializer.Serialize(new SongRequestSettings())
            };
            _db.SongRequestConfigs.Add(config);
            await _db.SaveChangesAsync(ct);
            return config;
        }

        public static SongRequestSettings ParseSettings(SongRequestConfig? config)
        {
            if (config == null || string.IsNullOrWhiteSpace(config.Settings))
                return new SongRequestSettings();
            try
            {
                return JsonSerializer.Deserialize<SongRequestSettings>(config.Settings, JsonOptions) ?? new SongRequestSettings();
            }
            catch (JsonException)
            {
                return new SongRequestSettings();
            }
        }

        public async Task SetOpenAsync(SongRequestConfig config, bool open, CancellationToken ct = default)
        {
            config.RequestsOpen = open;
            config.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            await NotifyAsync(config, ct);
        }

        public async Task SetPausedAsync(SongRequestConfig config, bool paused, CancellationToken ct = default)
        {
            config.IsPaused = paused;
            config.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            await NotifyAsync(config, ct);
        }

        public async Task SetVolumeAsync(SongRequestConfig config, int volume, CancellationToken ct = default)
        {
            config.Volume = Math.Clamp(volume, 0, 100);
            config.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            await NotifyAsync(config, ct);
        }

        /// <summary>La clave de la URL del reproductor; se crea la primera vez que se pide.</summary>
        public async Task<string> GetOrCreatePlayerKeyAsync(SongRequestConfig config, bool regenerate = false, CancellationToken ct = default)
        {
            if (!regenerate && !string.IsNullOrEmpty(config.PlayerKey))
                return config.PlayerKey;

            config.PlayerKey = Convert.ToHexString(RandomNumberGenerator.GetBytes(20)).ToLowerInvariant();
            config.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            return config.PlayerKey;
        }

        // ── Pedidos ──────────────────────────────────────────────────────────

        /// <summary>
        /// Resuelve y agrega a la cola. <paramref name="unlimited"/> = el streamer (o control_total):
        /// no le aplican el límite por usuario ni el de la cola.
        /// </summary>
        public async Task<SongAddResult> AddAsync(
            SongRequestConfig config, SongRequester requester, string input, bool unlimited, CancellationToken ct = default)
        {
            var settings = ParseSettings(config);
            var userId = config.UserId;
            var login = requester.Login.ToLowerInvariant();

            if (await IsBannedAsync(userId, "user", $"{requester.Platform}:{login}", ct))
                return SongAddResult.Fail("banned_user");

            // Límites antes de resolver: resolver cuesta segundos y llamadas a YouTube
            var queued = _db.SongRequestQueue.Where(q => q.UserId == userId && q.Status == "queued");
            if (!unlimited)
            {
                if (settings.MaxQueueSize > 0 && await queued.CountAsync(ct) >= settings.MaxQueueSize)
                    return SongAddResult.Fail("queue_full");

                if (settings.MaxPerUser > 0 && await queued.CountAsync(q =>
                        q.RequestedPlatform == requester.Platform && q.RequestedByLogin == login, ct) >= settings.MaxPerUser)
                    return SongAddResult.Fail("user_limit");
            }

            var resolved = await _resolver.ResolveAsync(input, ct);
            if (!resolved.Success)
                return SongAddResult.Fail(ErrorKeyFor(resolved.Error));

            var track = resolved.Track!;
            if (await IsBannedAsync(userId, "track", $"{track.Source}:{track.SourceId}", ct))
                return SongAddResult.Fail("banned_track", track);
            if (track.AuthorId != null && await IsBannedAsync(userId, "author", $"{track.Source}:{track.AuthorId}", ct))
                return SongAddResult.Fail("banned_author", track);

            var alreadyIn = await _db.SongRequestQueue.AnyAsync(q => q.UserId == userId && q.TrackId == track.Id, ct);
            if (alreadyIn)
                return SongAddResult.Fail("already_queued", track);

            if (!unlimited)
            {
                var filtered = await CheckFiltersAsync(userId, settings, track, ct);
                if (filtered != null)
                    return SongAddResult.Fail(filtered, track);
            }

            var lastPosition = await queued.MaxAsync(q => (int?)q.Position, ct) ?? 0;
            var origin = resolved.Origin;
            var item = new SongRequestQueueItem
            {
                UserId = userId,
                TrackId = track.Id,
                Track = track,
                Position = lastPosition + 1,
                Status = "queued",
                RequestedPlatform = requester.Platform,
                RequestedById = requester.Id,
                RequestedByLogin = login,
                RequestedByName = string.IsNullOrWhiteSpace(requester.DisplayName) ? requester.Login : requester.DisplayName,
                OriginSource = origin?.Origin,
                OriginUrl = origin?.Url,
                OriginTitle = origin?.Title,
                OriginArtist = origin?.Artist,
                OriginThumbnailUrl = origin?.ThumbnailUrl,
                CreatedAt = DateTime.UtcNow
            };
            _db.SongRequestQueue.Add(item);
            await _db.SaveChangesAsync(ct);

            var position = await queued.CountAsync(q => q.Position < item.Position || (q.Position == item.Position && q.Id <= item.Id), ct);
            await NotifyAsync(config, ct);
            return new SongAddResult(item, position, track, null);
        }

        /// <summary>Los filtros del canal. Devuelve la clave del mensaje de rechazo, o null si pasa.</summary>
        private async Task<string?> CheckFiltersAsync(long userId, SongRequestSettings settings, SongTrack track, CancellationToken ct)
        {
            if (settings.MaxDurationSeconds > 0)
            {
                if (track.DurationSeconds == null)
                {
                    if (!settings.AllowUnknownDuration)
                        return "unknown_duration";
                }
                else if (track.DurationSeconds > settings.MaxDurationSeconds)
                {
                    return "too_long";
                }
            }

            if (settings.MinViews > 0 && track.ViewCount != null && track.ViewCount < settings.MinViews)
                return "too_few_views";

            if (settings.NoRepeatMinutes > 0)
            {
                var since = DateTime.UtcNow.AddMinutes(-settings.NoRepeatMinutes);
                var recent = await _db.SongRequestHistory.AnyAsync(h => h.UserId == userId && h.TrackId == track.Id
                    && h.PlayedAt >= since && h.RequestedPlatform != SongRequestPlatforms.Fallback, ct);
                if (recent)
                    return "recently_played";
            }
            return null;
        }

        /// <summary>!wrongsong: el último pedido del usuario que todavía no sonó.</summary>
        public async Task<SongRequestQueueItem?> RemoveLastByUserAsync(SongRequestConfig config, string platform, string login, CancellationToken ct = default)
        {
            login = login.ToLowerInvariant();
            var item = await _db.SongRequestQueue.Include(q => q.Track)
                .Where(q => q.UserId == config.UserId && q.Status == "queued"
                            && q.RequestedPlatform == platform && q.RequestedByLogin == login)
                .OrderByDescending(q => q.Position).ThenByDescending(q => q.Id)
                .FirstOrDefaultAsync(ct);
            if (item == null)
                return null;

            await RemoveAsync(config, item, ct);
            return item;
        }

        /// <summary>Quita el pedido en la posición visible (1 = la próxima).</summary>
        public async Task<SongRequestQueueItem?> RemoveAtPositionAsync(SongRequestConfig config, int position, CancellationToken ct = default)
        {
            if (position < 1)
                return null;
            var item = await QueuedQuery(config.UserId).Skip(position - 1).FirstOrDefaultAsync(ct);
            if (item == null)
                return null;

            await RemoveAsync(config, item, ct);
            return item;
        }

        private async Task RemoveAsync(SongRequestConfig config, SongRequestQueueItem item, CancellationToken ct)
        {
            _db.SongRequestQueue.Remove(item);
            await _db.SaveChangesAsync(ct);
            await NotifyAsync(config, ct);
        }

        /// <summary>
        /// Termina la que suena (va al historial con <paramref name="endReason"/>) y pone la siguiente.
        /// Devuelve la que terminó, o null si no sonaba nada.
        /// </summary>
        public async Task<SongRequestQueueItem?> AdvanceAsync(SongRequestConfig config, string endReason, CancellationToken ct = default)
        {
            var current = await _db.SongRequestQueue.Include(q => q.Track)
                .FirstOrDefaultAsync(q => q.UserId == config.UserId && q.Status == "playing", ct);
            if (current == null)
                return null;

            _db.SongRequestHistory.Add(new SongRequestHistoryItem
            {
                UserId = config.UserId,
                TrackId = current.TrackId,
                RequestedPlatform = current.RequestedPlatform,
                RequestedByLogin = current.RequestedByLogin,
                RequestedByName = current.RequestedByName,
                OriginSource = current.OriginSource,
                OriginUrl = current.OriginUrl,
                EndReason = endReason,
                PlayedAt = DateTime.UtcNow
            });
            _db.SongRequestQueue.Remove(current);

            var next = await QueuedQuery(config.UserId).FirstOrDefaultAsync(ct);
            if (next != null)
                next.Status = "playing";
            else if (_players.HasPlayer(config.ChannelName.ToLowerInvariant()))
                await StartFallbackAsync(config, ct); // sin pedidos: sigue la playlist de respaldo (solo si hay quien la suene)

            await _db.SaveChangesAsync(ct);
            await NotifyAsync(config, ct);
            return current;
        }

        /// <summary>Para el reproductor: solo avanza si <paramref name="itemId"/> sigue siendo la actual (evita saltar dos).</summary>
        public async Task AdvanceIfCurrentAsync(SongRequestConfig config, long itemId, string endReason, CancellationToken ct = default)
        {
            var isCurrent = await _db.SongRequestQueue.AnyAsync(q => q.Id == itemId && q.UserId == config.UserId && q.Status == "playing", ct);
            if (isCurrent)
                await AdvanceAsync(config, endReason, ct);
        }

        /// <summary>Si no suena nada, la primera de la cola pasa a sonar; con la cola vacía, la playlist de respaldo.</summary>
        public async Task StartNextIfIdleAsync(SongRequestConfig config, CancellationToken ct = default)
        {
            if (await _db.SongRequestQueue.AnyAsync(q => q.UserId == config.UserId && q.Status == "playing", ct))
                return;
            var next = await QueuedQuery(config.UserId).FirstOrDefaultAsync(ct);
            if (next != null)
                next.Status = "playing";
            else if (!await StartFallbackAsync(config, ct))
                return;
            await _db.SaveChangesAsync(ct);
            await NotifyAsync(config, ct);
        }

        /// <summary>Agrega a la cola, ya sonando, la próxima de la playlist de respaldo. false si no hay.</summary>
        private async Task<bool> StartFallbackAsync(SongRequestConfig config, CancellationToken ct)
        {
            var settings = ParseSettings(config);
            if (!settings.FallbackEnabled)
                return false;

            var items = await _db.SongRequestFallback.Where(f => f.UserId == config.UserId)
                .OrderBy(f => f.Position).ThenBy(f => f.Id)
                .Select(f => f.TrackId).ToListAsync(ct);
            if (items.Count == 0)
                return false;

            int index;
            if (settings.FallbackShuffle)
            {
                // Al azar, sin repetir la que acaba de sonar
                var last = await _db.SongRequestHistory.Where(h => h.UserId == config.UserId)
                    .OrderByDescending(h => h.PlayedAt).Select(h => (long?)h.TrackId).FirstOrDefaultAsync(ct);
                index = Random.Shared.Next(items.Count);
                if (items.Count > 1 && items[index] == last)
                    index = (index + 1) % items.Count;
            }
            else
            {
                index = ((config.FallbackCursor % items.Count) + items.Count) % items.Count;
                config.FallbackCursor = index + 1;
            }

            _db.SongRequestQueue.Add(new SongRequestQueueItem
            {
                UserId = config.UserId,
                TrackId = items[index],
                Position = 0,
                Status = "playing",
                RequestedPlatform = SongRequestPlatforms.Fallback,
                RequestedByLogin = config.ChannelName,
                RequestedByName = config.ChannelName,
                CreatedAt = DateTime.UtcNow
            });
            return true;
        }

        /// <summary>Nuevo orden de la cola desde el dashboard. Los ids que no vengan quedan al final en su orden.</summary>
        public async Task ReorderAsync(SongRequestConfig config, IReadOnlyList<long> orderedIds, CancellationToken ct = default)
        {
            var items = await QueuedQuery(config.UserId).ToListAsync(ct);
            var rank = orderedIds.Select((id, i) => (id, i)).ToDictionary(x => x.id, x => x.i);
            var ordered = items
                .OrderBy(q => rank.TryGetValue(q.Id, out var r) ? r : int.MaxValue)
                .ThenBy(q => q.Position).ThenBy(q => q.Id)
                .ToList();
            for (var i = 0; i < ordered.Count; i++)
                ordered[i].Position = i + 1;
            await _db.SaveChangesAsync(ct);
            await NotifyAsync(config, ct);
        }

        public async Task<SongRequestQueueItem?> RemoveByIdAsync(SongRequestConfig config, long itemId, CancellationToken ct = default)
        {
            var item = await _db.SongRequestQueue.Include(q => q.Track)
                .FirstOrDefaultAsync(q => q.Id == itemId && q.UserId == config.UserId && q.Status == "queued", ct);
            if (item == null)
                return null;
            await RemoveAsync(config, item, ct);
            return item;
        }

        public Task<SongRequestQueueItem?> GetItemAsync(long userId, long itemId, CancellationToken ct = default) =>
            _db.SongRequestQueue.Include(q => q.Track).FirstOrDefaultAsync(q => q.Id == itemId && q.UserId == userId, ct);

        public Task<SongRequestQueueItem?> GetCurrentAsync(long userId, CancellationToken ct = default) =>
            _db.SongRequestQueue.Include(q => q.Track).AsNoTracking()
                .FirstOrDefaultAsync(q => q.UserId == userId && q.Status == "playing", ct);

        public Task<List<SongRequestQueueItem>> GetQueuedAsync(long userId, int take = 500, CancellationToken ct = default) =>
            QueuedQuery(userId).AsNoTracking().Take(take).ToListAsync(ct);

        private IQueryable<SongRequestQueueItem> QueuedQuery(long userId) =>
            _db.SongRequestQueue.Include(q => q.Track)
                .Where(q => q.UserId == userId && q.Status == "queued")
                .OrderBy(q => q.Position).ThenBy(q => q.Id);

        // ── Vetos ────────────────────────────────────────────────────────────

        private Task<bool> IsBannedAsync(long userId, string type, string value, CancellationToken ct) =>
            _db.SongRequestBans.AnyAsync(b => b.UserId == userId && b.BanType == type && b.Value == value, ct);

        /// <returns>false si ya estaba vetado.</returns>
        public async Task<bool> BanAsync(long userId, string type, string value, string label, string? createdBy, CancellationToken ct = default)
        {
            if (await IsBannedAsync(userId, type, value, ct))
                return false;

            _db.SongRequestBans.Add(new SongRequestBan
            {
                UserId = userId,
                BanType = type,
                Value = value,
                Label = label.Length > 300 ? label[..300] : label,
                CreatedBy = createdBy,
                CreatedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync(ct);
            return true;
        }

        /// <summary>Al vetar a un usuario se van también sus pedidos pendientes.</summary>
        public async Task<int> RemoveAllByUserAsync(SongRequestConfig config, string platform, string login, CancellationToken ct = default)
        {
            login = login.ToLowerInvariant();
            var items = await _db.SongRequestQueue
                .Where(q => q.UserId == config.UserId && q.Status == "queued"
                            && q.RequestedPlatform == platform && q.RequestedByLogin == login)
                .ToListAsync(ct);
            if (items.Count == 0)
                return 0;

            _db.SongRequestQueue.RemoveRange(items);
            await _db.SaveChangesAsync(ct);
            await NotifyAsync(config, ct);
            return items.Count;
        }

        // ── Estado público ───────────────────────────────────────────────────

        /// <summary>Lo que ven la cola pública y los overlays. Sin ids de plataforma de los viewers.</summary>
        public async Task<object> BuildSnapshotAsync(SongRequestConfig config, CancellationToken ct = default)
        {
            var current = await GetCurrentAsync(config.UserId, ct);
            var queued = await GetQueuedAsync(config.UserId, ct: ct);
            var settings = ParseSettings(config);
            return new
            {
                channel = config.ChannelName,
                enabled = config.Enabled,
                requestsOpen = config.RequestsOpen,
                paused = config.IsPaused,
                volume = config.Volume,
                // El reproductor corta al llegar aquí las canciones de duración desconocida (0 = no corta)
                maxDurationSeconds = settings.MaxDurationSeconds > 0 && settings.AllowUnknownDuration ? settings.MaxDurationSeconds : 0,
                fallbackEnabled = settings.FallbackEnabled,
                playerConnected = _players.HasPlayer(config.ChannelName.ToLowerInvariant()),
                current = current == null ? null : ToDto(current, 0),
                queue = queued.Select((q, i) => ToDto(q, i + 1)).ToList(),
                totalDurationSeconds = queued.Sum(q => q.Track?.DurationSeconds ?? 0)
            };
        }

        private object ToDto(SongRequestQueueItem item, int position)
        {
            var track = item.Track;
            return new
            {
                id = item.Id,
                position,
                source = track?.Source,
                sourceId = track?.SourceId,
                url = track == null ? null : _resolver.GetSource(track.Source)?.GetPublicUrl(track.SourceId),
                title = item.OriginTitle ?? track?.Title ?? "",
                artist = item.OriginArtist ?? track?.Artist ?? "",
                durationSeconds = track?.DurationSeconds,
                thumbnailUrl = item.OriginThumbnailUrl ?? track?.ThumbnailUrl,
                requestedBy = item.RequestedByName,
                requestedByLogin = item.RequestedByLogin,
                platform = item.RequestedPlatform,
                isFallback = item.RequestedPlatform == SongRequestPlatforms.Fallback,
                originSource = item.OriginSource,
                originUrl = item.OriginUrl
            };
        }

        public async Task NotifyAsync(SongRequestConfig config, CancellationToken ct = default)
        {
            try
            {
                var snapshot = await BuildSnapshotAsync(config, ct);
                await _hub.Clients.Group(SongRequestHub.Group(config.ChannelName)).SendAsync(UpdatedEvent, snapshot, ct);
            }
            catch (Exception ex)
            {
                // Un aviso que no llega no puede tirar el pedido: el overlay y la página se ponen al día al recargar
                _logger.LogWarning(ex, "[SongRequest] No se pudo avisar el cambio de cola de {Channel}", config.ChannelName);
            }
        }

        /// <summary>El diseño cambió: los overlays lo vuelven a pedir.</summary>
        public async Task NotifyConfigChangedAsync(SongRequestConfig config, CancellationToken ct = default)
        {
            try
            {
                await _hub.Clients.Group(SongRequestHub.Group(config.ChannelName)).SendAsync(ConfigChangedEvent, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[SongRequest] No se pudo avisar el cambio de diseño de {Channel}", config.ChannelName);
            }
        }

        public static string ErrorKeyFor(SongResolveError error) => error switch
        {
            SongResolveError.Unsupported => "unsupported",
            SongResolveError.InvalidLink => "invalid_link",
            SongResolveError.NotFound => "not_found",
            SongResolveError.Private => "private",
            SongResolveError.Live => "live",
            SongResolveError.Upcoming => "upcoming",
            SongResolveError.NotEmbeddable => "not_embeddable",
            SongResolveError.AgeRestricted => "age_restricted",
            SongResolveError.PreviewOnly => "preview_only",
            SongResolveError.NoMatch => "no_match",
            _ => "failed"
        };
    }
}
