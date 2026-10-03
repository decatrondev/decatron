using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
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
    /// <remarks>En modo revisión <see cref="Pending"/> trae lo que quedó esperando y <see cref="Position"/> su lugar en la bandeja.</remarks>
    public sealed record SongAddResult(SongRequestQueueItem? Item, int Position, SongTrack? Track, string? ErrorKey, SongRequestPending? Pending = null)
    {
        public bool Success => Item != null || Pending != null;
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

        // ── Modos rápidos (fase 5) ───────────────────────────────────────────

        public static readonly string[] Modes = { "open", "playlists", "review", "closed" };

        /// <summary>El modo que resulta de pedidos abiertos, revisión y "solo desde playlists".</summary>
        public static string ModeOf(SongRequestConfig config, SongRequestSettings settings) =>
            !config.RequestsOpen ? "closed"
            : settings.RequestReview ? "review"
            : settings.RequestSource == "playlists" ? "playlists"
            : "open";

        /// <summary>
        /// Cambia al instante pedidos abiertos, revisión y de dónde se puede pedir (lo que no venga no se toca).
        /// Van aparte del guardado del dashboard para que un !srmode del chat no lo pise un Guardar.
        /// </summary>
        public async Task SetRequestModeAsync(SongRequestConfig config, bool? open, bool? review, string? source, CancellationToken ct = default)
        {
            var settings = ParseSettings(config);
            if (open.HasValue) config.RequestsOpen = open.Value;
            if (review.HasValue) settings.RequestReview = review.Value;
            if (source is "any" or "playlists") settings.RequestSource = source;
            config.Settings = JsonSerializer.Serialize(settings);
            config.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            await NotifyAsync(config, ct);
        }

        /// <summary>Uno de los cuatro modos: abiertos, solo playlist, solo revisión o cerrado.</summary>
        public Task SetModeAsync(SongRequestConfig config, string mode, CancellationToken ct = default) => mode switch
        {
            "open" => SetRequestModeAsync(config, true, false, "any", ct),
            "playlists" => SetRequestModeAsync(config, true, false, "playlists", ct),
            "review" => SetRequestModeAsync(config, true, true, "any", ct),
            "closed" => SetRequestModeAsync(config, false, null, null, ct),
            _ => throw new ArgumentOutOfRangeException(nameof(mode))
        };

        public async Task SetVolumeAsync(SongRequestConfig config, int volume, CancellationToken ct = default)
        {
            config.Volume = Math.Clamp(volume, 0, 100);
            config.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            await NotifyAsync(config, ct);
        }

        /// <summary>
        /// El reproductor muestra el video (y apaga la portada) o la portada (y apaga el video). Toca solo
        /// esos dos elementos del diseño guardado; lo que falte lo completa el overlay con sus valores por defecto.
        /// </summary>
        /// <returns>false si ya estaba así.</returns>
        public async Task<bool> SetVideoModeAsync(SongRequestConfig config, bool video, CancellationToken ct = default)
        {
            // Un diseño ilegible no se pisa con uno vacío: se deja como está
            JsonObject? root;
            try { root = JsonNode.Parse(string.IsNullOrWhiteSpace(config.OverlayConfig) ? "{}" : config.OverlayConfig) as JsonObject; }
            catch (JsonException) { return false; }
            if (root == null)
                return false;

            var player = Child(root, "player");
            var elements = Child(player, "elements");
            var videoEl = Child(elements, "video");
            var coverEl = Child(elements, "cover");
            if (Enabled(videoEl) == video && Enabled(coverEl) == !video)
                return false;

            videoEl["enabled"] = video;
            coverEl["enabled"] = !video;
            config.OverlayConfig = root.ToJsonString();
            config.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            await NotifyConfigChangedAsync(config, ct);
            return true;

            static JsonObject Child(JsonObject parent, string name)
            {
                if (parent[name] is JsonObject existing)
                    return existing;
                var created = new JsonObject();
                parent[name] = created;
                return created;
            }

            static bool? Enabled(JsonObject element) =>
                element["enabled"] is JsonValue value && value.TryGetValue<bool>(out var enabled) ? enabled : null;
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
        /// <param name="review">El pedido queda en la bandeja de pendientes en vez de entrar a la cola (fase 3).</param>
        /// <param name="replyChannel">A qué chat avisar cuando se decida (solo con <paramref name="review"/>).</param>
        /// <param name="knownTrack">La canción ya está resuelta (viene de una playlist del canal): no se parsea ni se consulta nada. Mismos límites, vetos y revisión que un !sr.</param>
        public async Task<SongAddResult> AddAsync(
            SongRequestConfig config, SongRequester requester, string input, bool unlimited, CancellationToken ct = default,
            bool review = false, string? replyChannel = null, SongTrack? knownTrack = null)
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

                // Lo que espera aprobación también cuenta para el límite: si no, la bandeja se llena de lo mismo
                var mine = await queued.CountAsync(q => q.RequestedPlatform == requester.Platform && q.RequestedByLogin == login, ct);
                if (review)
                    mine += await PendingQueue(userId).CountAsync(p => p.RequestedPlatform == requester.Platform && p.RequestedByLogin == login, ct);
                if (settings.MaxPerUser > 0 && mine >= settings.MaxPerUser)
                    return SongAddResult.Fail("user_limit");

                // Por hora: lo pedido en la última hora, esté esperando, en la cola o ya haya sonado
                if (settings.MaxPerUserPerHour > 0)
                {
                    var since = DateTime.UtcNow.AddHours(-1);
                    var lastHour = await _db.SongRequestQueue.CountAsync(q => q.UserId == userId && q.RequestedPlatform == requester.Platform && q.RequestedByLogin == login && q.CreatedAt >= since, ct)
                        + await _db.SongRequestHistory.CountAsync(h => h.UserId == userId && h.RequestedPlatform == requester.Platform && h.RequestedByLogin == login && h.RequestedAt >= since, ct)
                        + await _db.SongRequestPending.CountAsync(p => p.UserId == userId && p.PlaylistId == null && p.RequestedPlatform == requester.Platform && p.RequestedByLogin == login && p.CreatedAt >= since, ct);
                    if (lastHour >= settings.MaxPerUserPerHour)
                        return SongAddResult.Fail("hour_limit");
                }
            }
            if (review && await _db.SongRequestPending.CountAsync(p => p.UserId == userId, ct) >= MaxPending)
                return SongAddResult.Fail("pending_full");

            // !sr #12: la canción 12 de la playlist que suena (fase 4); no hace falta resolver nada
            SongTrack track;
            TrackInfo? origin = null;
            var number = knownTrack == null ? ParsePlaylistNumber(input) : null;
            if (knownTrack != null)
            {
                track = knownTrack;
            }
            else if (number != null)
            {
                var playlist = await GetRequestPlaylistAsync(config, ct);
                if (playlist == null)
                    return SongAddResult.Fail("pl_no_active");
                var items = await GetOrderedItemsAsync(playlist, ct, includeTrack: true);
                if (number < 1 || number > items.Count || items[number.Value - 1].Track == null)
                    return SongAddResult.Fail("pl_number_invalid");
                // La lista viene sin seguimiento: con esa instancia, guardar el pedido intentaba crear la canción de nuevo
                track = await _db.SongTracks.FirstAsync(t => t.Id == items[number.Value - 1].TrackId, ct);
            }
            else
            {
                var resolved = await _resolver.ResolveAsync(input, ct);
                if (!resolved.Success)
                    return SongAddResult.Fail(ErrorKeyFor(resolved.Error));
                track = resolved.Track!;
                origin = resolved.Origin;

                // Modo "solo desde playlists": la canción tiene que estar en una playlist curada del canal
                if (!unlimited && settings.RequestSource == "playlists" && !await InCuratedPlaylistAsync(userId, track.Id, ct))
                    return SongAddResult.Fail("only_playlists", track);
            }

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

            if (review)
            {
                if (await PendingQueue(userId).AnyAsync(p => p.TrackId == track.Id, ct))
                    return SongAddResult.Fail("already_pending", track);
                var pending = new SongRequestPending
                {
                    UserId = userId,
                    TrackId = track.Id,
                    Track = track,
                    RequestedPlatform = requester.Platform,
                    RequestedById = requester.Id,
                    RequestedByLogin = login,
                    RequestedByName = string.IsNullOrWhiteSpace(requester.DisplayName) ? requester.Login : requester.DisplayName,
                    ReplyChannel = replyChannel,
                    OriginSource = origin?.Origin,
                    OriginUrl = origin?.Url,
                    OriginTitle = origin?.Title,
                    OriginArtist = origin?.Artist,
                    OriginThumbnailUrl = origin?.ThumbnailUrl,
                    CreatedAt = DateTime.UtcNow
                };
                _db.SongRequestPending.Add(pending);
                await _db.SaveChangesAsync(ct);
                var waiting = await PendingQueue(userId).CountAsync(p => p.Id <= pending.Id, ct);
                await NotifyAsync(config, ct);
                return new SongAddResult(null, waiting, track, null, pending);
            }

            var lastPosition = await queued.MaxAsync(q => (int?)q.Position, ct) ?? 0;
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

        /// <summary>Tope de la bandeja de pendientes por canal (cola y playlists juntas).</summary>
        public const int MaxPending = 100;

        /// <summary>Los pedidos a la cola que esperan aprobación, del más viejo al más nuevo.</summary>
        public IQueryable<SongRequestPending> PendingQueue(long userId) =>
            _db.SongRequestPending.Where(p => p.UserId == userId && p.PlaylistId == null).OrderBy(p => p.Id);

        /// <summary>
        /// Un pedido aprobado entra al final de la cola, a nombre de quien lo pidió. Los límites ya se
        /// revisaron al pedirlo; solo se evita que entre dos veces.
        /// </summary>
        public async Task<(SongRequestQueueItem? Item, int Position, string? ErrorKey)> EnqueueApprovedAsync(SongRequestConfig config, SongRequestPending pending, CancellationToken ct = default)
        {
            var userId = config.UserId;
            if (await _db.SongRequestQueue.AnyAsync(q => q.UserId == userId && q.TrackId == pending.TrackId, ct))
                return (null, 0, "already_queued");

            var queued = _db.SongRequestQueue.Where(q => q.UserId == userId && q.Status == "queued");
            var lastPosition = await queued.MaxAsync(q => (int?)q.Position, ct) ?? 0;
            var item = new SongRequestQueueItem
            {
                UserId = userId,
                TrackId = pending.TrackId,
                Position = lastPosition + 1,
                Status = "queued",
                RequestedPlatform = pending.RequestedPlatform,
                RequestedById = pending.RequestedById,
                RequestedByLogin = pending.RequestedByLogin,
                RequestedByName = pending.RequestedByName,
                OriginSource = pending.OriginSource,
                OriginUrl = pending.OriginUrl,
                OriginTitle = pending.OriginTitle,
                OriginArtist = pending.OriginArtist,
                OriginThumbnailUrl = pending.OriginThumbnailUrl,
                CreatedAt = DateTime.UtcNow
            };
            _db.SongRequestQueue.Add(item);
            await _db.SaveChangesAsync(ct);
            var position = await queued.CountAsync(q => q.Position < item.Position || (q.Position == item.Position && q.Id <= item.Id), ct);
            return (item, position, null);
        }

        /// <summary>
        /// Los filtros del canal. Devuelve la clave del mensaje de rechazo, o null si pasa.
        /// <paramref name="checkRepeat"/>: "no repetir" solo tiene sentido para la cola, no para una playlist.
        /// </summary>
        public async Task<string?> CheckFiltersAsync(long userId, SongRequestSettings settings, SongTrack track, CancellationToken ct, bool checkRepeat = true)
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

            if (checkRepeat && settings.NoRepeatMinutes > 0)
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
                PlayedAt = DateTime.UtcNow,
                RequestedAt = current.CreatedAt
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

        // ── Playlists sonando (fase 4) ───────────────────────────────────────

        private static readonly System.Text.RegularExpressions.Regex PlaylistNumberRegex = new(@"^#\s*(\d{1,5})$");

        /// <summary>"#12" o "# 12" → 12. Cualquier otra cosa → null (es un link o un nombre).</summary>
        public static int? ParsePlaylistNumber(string input)
        {
            var m = PlaylistNumberRegex.Match(input.Trim());
            return m.Success ? int.Parse(m.Groups[1].Value) : null;
        }

        /// <summary>
        /// La playlist de fondo: la que suena con la cola vacía (SONG_REQUEST_PUBLIC_PLAYLISTS_PLAN.md, fase 0b).
        /// Una o ninguna; "respaldo" y "puesta a sonar" pasaron a ser lo mismo.
        /// </summary>
        public async Task<SongRequestPlaylist?> GetPlayingPlaylistAsync(SongRequestConfig config, CancellationToken ct = default) =>
            config.ActivePlaylistId == null
                ? null
                : await _db.SongRequestPlaylists.FirstOrDefaultAsync(p => p.Id == config.ActivePlaylistId && p.UserId == config.UserId, ct);

        /// <summary>De cuál cuenta !sr #n: la playlist de fondo.</summary>
        public async Task<SongRequestPlaylist?> GetRequestPlaylistAsync(SongRequestConfig config, CancellationToken ct = default) =>
            config.ActivePlaylistId == null
                ? null
                : await _db.SongRequestPlaylists.AsNoTracking().FirstOrDefaultAsync(p => p.Id == config.ActivePlaylistId && p.UserId == config.UserId, ct);

        /// <summary>
        /// Las canciones en el orden de la playlist: manual, o más votadas primero. Es el mismo orden al sonar,
        /// en !sr #n y en la página pública, así el número que ve el viewer es el que pide.
        /// </summary>
        public async Task<List<SongRequestPlaylistItem>> GetOrderedItemsAsync(SongRequestPlaylist playlist, CancellationToken ct = default, bool includeTrack = false)
        {
            var query = _db.SongRequestPlaylistItems.AsNoTracking().Where(i => i.PlaylistId == playlist.Id);
            if (includeTrack)
                query = query.Include(i => i.Track);
            return playlist.SortByVotes
                ? await query.OrderByDescending(i => _db.SongRequestPlaylistVotes.Count(v => v.ItemId == i.Id)).ThenBy(i => i.Position).ThenBy(i => i.Id).ToListAsync(ct)
                : await query.OrderBy(i => i.Position).ThenBy(i => i.Id).ToListAsync(ct);
        }

        /// <summary>
        /// Está en una playlist curada: de solo streamer y mods, o con revisión. Las abiertas no cuentan: si no,
        /// con !pladd cualquiera se saltearía el modo "solo desde playlists".
        /// </summary>
        private Task<bool> InCuratedPlaylistAsync(long userId, long trackId, CancellationToken ct) =>
            _db.SongRequestPlaylistItems.AnyAsync(i => i.UserId == userId && i.TrackId == trackId
                && _db.SongRequestPlaylists.Any(p => p.Id == i.PlaylistId && p.Contribution != SongRequestPlaylistContribution.Open), ct);

        /// <summary>
        /// Cambia la playlist de fondo (null = ninguna: con la cola vacía no suena nada). Si sonaba una de la
        /// playlist, se cambia ya; un pedido que esté sonando no se corta.
        /// </summary>
        public async Task<bool> SetActivePlaylistAsync(SongRequestConfig config, long? playlistId, CancellationToken ct = default)
        {
            if (playlistId != null && !await _db.SongRequestPlaylists.AnyAsync(p => p.Id == playlistId && p.UserId == config.UserId, ct))
                return false;
            config.ActivePlaylistId = playlistId;
            config.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            var current = await _db.SongRequestQueue.AsNoTracking().FirstOrDefaultAsync(q => q.UserId == config.UserId && q.Status == "playing", ct);
            if (current?.RequestedPlatform == SongRequestPlatforms.Fallback)
                await AdvanceAsync(config, "skipped", ct);
            else if (current == null)
                await StartNextIfIdleAsync(config, ct);
            await NotifyAsync(config, ct);
            return true;
        }

        /// <summary>
        /// La próxima de la playlist de fondo que pidió !plplay #n (canal → playlist y canción). Se usa una vez:
        /// ya, si sonaba la playlist, o cuando terminen los pedidos. Vive en memoria: tras un reinicio sigue el orden normal.
        /// </summary>
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<long, (long PlaylistId, long ItemId)> _jumps = new();

        public enum JumpResult { Now, AfterRequests, NoPlayer, Invalid }

        /// <summary>
        /// !plplay [playlist] #n: la canción n de esa playlist suena ya (o al terminar los pedidos). Si la playlist no
        /// era la de fondo, pasa a serlo.
        /// </summary>
        public async Task<(JumpResult Result, SongTrack? Track)> JumpToAsync(SongRequestConfig config, SongRequestPlaylist playlist, int number, CancellationToken ct = default)
        {
            var items = await GetOrderedItemsAsync(playlist, ct, includeTrack: true);
            if (number < 1 || number > items.Count || items[number - 1].Track == null)
                return (JumpResult.Invalid, null);
            var item = items[number - 1];
            _jumps[config.UserId] = (playlist.Id, item.Id);

            if (config.ActivePlaylistId != playlist.Id)
            {
                await SetActivePlaylistAsync(config, playlist.Id, ct);
            }
            else
            {
                var current = await _db.SongRequestQueue.AsNoTracking().FirstOrDefaultAsync(q => q.UserId == config.UserId && q.Status == "playing", ct);
                if (current?.RequestedPlatform == SongRequestPlatforms.Fallback)
                    await AdvanceAsync(config, "skipped", ct);
                else if (current == null)
                    await StartNextIfIdleAsync(config, ct);
            }

            var playing = await _db.SongRequestQueue.AsNoTracking().FirstOrDefaultAsync(q => q.UserId == config.UserId && q.Status == "playing", ct);
            if (playing?.RequestedPlatform == SongRequestPlatforms.Fallback && playing.TrackId == item.TrackId)
                return (JumpResult.Now, item.Track);
            // Sin reproductor abierto no arranca nada: queda para cuando suene
            if (playing == null && !_players.HasPlayer(config.ChannelName.ToLowerInvariant()))
                return (JumpResult.NoPlayer, item.Track);
            return (JumpResult.AfterRequests, item.Track);
        }

        /// <summary>!plnext: la siguiente de la playlist de fondo. false si lo que suena no es de la playlist.</summary>
        public async Task<bool> NextInPlaylistAsync(SongRequestConfig config, CancellationToken ct = default)
        {
            var current = await _db.SongRequestQueue.AsNoTracking().FirstOrDefaultAsync(q => q.UserId == config.UserId && q.Status == "playing", ct);
            if (current?.RequestedPlatform != SongRequestPlatforms.Fallback)
                return false;
            await AdvanceAsync(config, "skipped", ct);
            return true;
        }

        /// <summary>!plshuffle: al azar o en orden. null = la cambia al revés de como estaba.</summary>
        public async Task<bool?> SetShuffleAsync(SongRequestConfig config, bool? shuffle, CancellationToken ct = default)
        {
            var playlist = await GetPlayingPlaylistAsync(config, ct);
            if (playlist == null)
                return null;
            playlist.Shuffle = shuffle ?? !playlist.Shuffle;
            playlist.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            return playlist.Shuffle;
        }

        /// <summary>
        /// Para !pl: la playlist de fondo, cuántas canciones tiene y el número de la que suena (null si ahora suena
        /// un pedido o nada de la playlist).
        /// </summary>
        public async Task<(SongRequestPlaylist Playlist, int Count, int? Number)?> GetBackgroundStatusAsync(SongRequestConfig config, CancellationToken ct = default)
        {
            var playlist = await GetRequestPlaylistAsync(config, ct);
            if (playlist == null)
                return null;
            var items = await GetOrderedItemsAsync(playlist, ct);
            var current = await _db.SongRequestQueue.AsNoTracking().FirstOrDefaultAsync(q => q.UserId == config.UserId && q.Status == "playing", ct);
            int? number = null;
            if (current?.RequestedPlatform == SongRequestPlatforms.Fallback)
            {
                var index = items.FindIndex(i => i.TrackId == current.TrackId);
                number = index >= 0 ? index + 1 : null;
            }
            return (playlist, items.Count, number);
        }

        /// <summary>Agrega a la cola, ya sonando, la próxima de la playlist de fondo. false si no hay.</summary>
        private async Task<bool> StartFallbackAsync(SongRequestConfig config, CancellationToken ct)
        {
            var playlist = await GetPlayingPlaylistAsync(config, ct);
            if (playlist == null)
                return false;
            var ordered = await GetOrderedItemsAsync(playlist, ct);
            var items = ordered.Select(i => i.TrackId).ToList();
            if (items.Count == 0)
                return false;

            int index;
            // !plplay #n: esa va primero; en orden, la que sigue es la de después
            var jumpIndex = _jumps.TryRemove(config.UserId, out var jump) && jump.PlaylistId == playlist.Id
                ? ordered.FindIndex(i => i.Id == jump.ItemId)
                : -1;
            if (jumpIndex >= 0)
            {
                index = jumpIndex;
                if (!playlist.Shuffle)
                    playlist.Cursor = index + 1;
            }
            else if (playlist.Shuffle)
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
                index = ((playlist.Cursor % items.Count) + items.Count) % items.Count;
                playlist.Cursor = index + 1;
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

        /// <summary>Sube el pedido de esa posición (1 = el próximo) al primer lugar de la cola.</summary>
        public async Task<SongRequestQueueItem?> PromoteAtPositionAsync(SongRequestConfig config, int position, CancellationToken ct = default)
        {
            if (position < 1)
                return null;
            var items = await QueuedQuery(config.UserId).ToListAsync(ct);
            if (position > items.Count)
                return null;
            await PromoteAsync(config, items, items[position - 1], ct);
            return items[0];
        }

        /// <summary>Lo mismo desde el dashboard, por id.</summary>
        public async Task<SongRequestQueueItem?> PromoteByIdAsync(SongRequestConfig config, long itemId, CancellationToken ct = default)
        {
            var items = await QueuedQuery(config.UserId).ToListAsync(ct);
            var item = items.FirstOrDefault(q => q.Id == itemId);
            if (item == null)
                return null;
            await PromoteAsync(config, items, item, ct);
            return item;
        }

        private async Task PromoteAsync(SongRequestConfig config, List<SongRequestQueueItem> items, SongRequestQueueItem item, CancellationToken ct)
        {
            items.Remove(item);
            items.Insert(0, item);
            for (var i = 0; i < items.Count; i++)
                items[i].Position = i + 1;
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

        public Task<bool> IsBannedAsync(long userId, string type, string value, CancellationToken ct) =>
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
                // El reproductor pide la siguiente con la cola vacía si hay playlist de fondo
                fallbackEnabled = config.ActivePlaylistId != null,
                activePlaylistId = config.ActivePlaylistId,
                requestReview = settings.RequestReview,
                requestSource = settings.RequestSource,
                mode = ModeOf(config, settings),
                allowWebRequests = settings.AllowWebRequests,
                // La playlist de fondo, solo si es pública: /sr enlaza "Escuchar esta playlist" (las de solo enlace o privadas no se anuncian)
                activePlaylist = await GetPublicActivePlaylistAsync(config, ct),
                // Cuántos esperan aprobación (cola y playlists): el dashboard recarga la bandeja cuando cambia
                pendingCount = await _db.SongRequestPending.CountAsync(p => p.UserId == config.UserId, ct),
                playerConnected = _players.HasPlayer(config.ChannelName.ToLowerInvariant()),
                current = current == null ? null : ToDto(current, 0),
                queue = queued.Select((q, i) => ToDto(q, i + 1)).ToList(),
                totalDurationSeconds = queued.Sum(q => q.Track?.DurationSeconds ?? 0)
            };
        }

        private async Task<object?> GetPublicActivePlaylistAsync(SongRequestConfig config, CancellationToken ct)
        {
            if (config.ActivePlaylistId == null)
                return null;
            return await _db.SongRequestPlaylists.AsNoTracking()
                .Where(p => p.Id == config.ActivePlaylistId && p.Visibility == SongRequestPlaylistVisibility.Public)
                .Select(p => new { code = p.ShareCode, name = p.Name })
                .FirstOrDefaultAsync(ct);
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

        public const string PlaylistsChangedEvent = "SongRequestPlaylistsChanged";

        /// <summary>Cambió el contenido de alguna playlist del canal: las vistas de playlist la vuelven a pedir sin cortar lo que suena.</summary>
        public async Task NotifyPlaylistsAsync(long userId, CancellationToken ct = default)
        {
            try
            {
                var channel = await _db.SongRequestConfigs.AsNoTracking().Where(c => c.UserId == userId).Select(c => c.ChannelName).FirstOrDefaultAsync(ct);
                if (channel != null)
                    await _hub.Clients.Group(SongRequestHub.Group(channel)).SendAsync(PlaylistsChangedEvent, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[SongRequest] No se pudo avisar el cambio de playlists del usuario {UserId}", userId);
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
