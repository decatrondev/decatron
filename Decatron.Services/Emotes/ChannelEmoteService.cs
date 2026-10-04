using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services.ChatOverlay;
using Decatron.Core.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Decatron.Services.Emotes
{
    public enum EmoteRole { Viewer = 0, Listed = 1, Staff = 2, Owner = 3 }

    /// <summary>Resultado de una operación: un emote, o la clave del error para la interfaz</summary>
    public sealed record EmoteResult(string? Error, ChannelEmote? Emote = null)
    {
        public bool Success => Error == null;
        public static EmoteResult Fail(string error) => new(error);
    }

    /// <summary>
    /// Emotes propios de Decatron (fase 3): quién puede subir y si pasa por revisión, validación del nombre y de la
    /// imagen, límites por tier, revisión, y los archivos en disco. Un cambio invalida lo cacheado para que el
    /// overlay lo vea al instante. Plan: .dev/plans/CHAT_OVERLAY_EMOTES_PLAN.md, fase 3.
    /// </summary>
    public sealed class ChannelEmoteService
    {
        public static readonly string[] Modes = { "owner", "staff", "approval", "list" };
        private static readonly Regex ValidName = new(@"^[A-Za-z][A-Za-z0-9_]{1,24}$", RegexOptions.Compiled);
        private static readonly string[] LiveStatuses = { ChannelEmote.Pending, ChannelEmote.Approved, ChannelEmote.Hidden };

        /// <summary>Subidas por hora de una misma persona (los que administran el canal tienen más margen)</summary>
        private const int UploadsPerHour = 10;
        private const int StaffUploadsPerHour = 60;
        private static readonly ConcurrentDictionary<long, Queue<DateTime>> RecentUploads = new();

        private readonly DecatronDbContext _db;
        private readonly IPermissionService _permissions;
        private readonly EmoteCatalogService _catalog;
        private readonly IConfiguration _config;
        private readonly ILogger<ChannelEmoteService> _logger;

        public ChannelEmoteService(DecatronDbContext db, IPermissionService permissions, EmoteCatalogService catalog,
            IConfiguration config, ILogger<ChannelEmoteService> logger)
        {
            _db = db;
            _permissions = permissions;
            _catalog = catalog;
            _config = config;
            _logger = logger;
        }

        public string AssetsPath => _config["Emotes:AssetsPath"] ?? "/var/www/html/decatron/emote-assets";
        public string PublicBase => (_config["Emotes:PublicBase"] ?? "https://decatron.net").TrimEnd('/');

        public string UrlFor(ChannelEmote e, int scale) => $"{PublicBase}/uploads/emotes/{e.UserId}/{e.FileKey}/{scale}.webp";

        // ═══════════════════════════════════════════════════════════════
        // CONFIGURACIÓN
        // ═══════════════════════════════════════════════════════════════

        public async Task<ChannelEmoteSettings> GetSettingsAsync(long channelUserId) =>
            await _db.ChannelEmoteSettings.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == channelUserId)
            ?? new ChannelEmoteSettings { UserId = channelUserId };

        public async Task<string?> UpdateSettingsAsync(long channelUserId, string? mode, int? maxPendingPerUser)
        {
            if (mode != null && !Modes.Contains(mode)) return "invalid_mode";
            if (maxPendingPerUser is < 1 or > 50) return "invalid_pending";

            var row = await _db.ChannelEmoteSettings.FirstOrDefaultAsync(s => s.UserId == channelUserId);
            if (row == null)
            {
                row = new ChannelEmoteSettings { UserId = channelUserId };
                _db.ChannelEmoteSettings.Add(row);
            }
            if (mode != null) row.UploadMode = mode;
            if (maxPendingPerUser.HasValue) row.MaxPendingPerUser = maxPendingPerUser.Value;
            row.UpdatedAt = DateTime.Now;
            await _db.SaveChangesAsync();
            return null;
        }

        public Task<List<ChannelEmoteUploader>> GetUploadersAsync(long channelUserId) =>
            _db.ChannelEmoteUploaders.AsNoTracking().Where(u => u.UserId == channelUserId).OrderBy(u => u.Login).ToListAsync();

        public async Task<string?> AddUploaderAsync(long channelUserId, string platform, string login)
        {
            platform = platform.ToLowerInvariant();
            login = login.Trim().TrimStart('@').ToLowerInvariant();
            if (platform is not ("twitch" or "kick")) return "invalid_platform";
            if (!Regex.IsMatch(login, @"^[a-z0-9_]{1,40}$")) return "invalid_login";
            if (await _db.ChannelEmoteUploaders.CountAsync(u => u.UserId == channelUserId) >= 200) return "too_many_uploaders";
            if (await _db.ChannelEmoteUploaders.AnyAsync(u => u.UserId == channelUserId && u.Platform == platform && u.Login == login))
                return "uploader_exists";
            _db.ChannelEmoteUploaders.Add(new ChannelEmoteUploader { UserId = channelUserId, Platform = platform, Login = login });
            await _db.SaveChangesAsync();
            return null;
        }

        public async Task<bool> RemoveUploaderAsync(long channelUserId, long id)
        {
            var row = await _db.ChannelEmoteUploaders.FirstOrDefaultAsync(u => u.Id == id && u.UserId == channelUserId);
            if (row == null) return false;
            _db.ChannelEmoteUploaders.Remove(row);
            await _db.SaveChangesAsync();
            return true;
        }

        // ═══════════════════════════════════════════════════════════════
        // QUIÉN PUEDE SUBIR
        // ═══════════════════════════════════════════════════════════════

        public async Task<EmoteRole> ResolveRoleAsync(long channelUserId, long actorUserId)
        {
            if (actorUserId == channelUserId) return EmoteRole.Owner;

            var actor = await _db.Users.AsNoTracking().Where(u => u.Id == actorUserId)
                .Select(u => new { u.AccountId, u.Login, u.KickUsername }).FirstOrDefaultAsync();
            if (actor == null) return EmoteRole.Viewer;

            // La misma persona con su otra cuenta (Twitch y Kick vinculadas) cuenta como el streamer
            if (actor.AccountId != null)
            {
                var ownerAccount = await _db.Users.AsNoTracking().Where(u => u.Id == channelUserId).Select(u => u.AccountId).FirstOrDefaultAsync();
                if (ownerAccount != null && ownerAccount == actor.AccountId) return EmoteRole.Owner;
            }

            if (await _permissions.HasPermissionLevelAsync(actorUserId, channelUserId, "control_total")) return EmoteRole.Owner;
            if (await _permissions.HasPermissionLevelAsync(actorUserId, channelUserId, "moderation")) return EmoteRole.Staff;

            var twitch = (actor.Login ?? "").ToLowerInvariant();
            var kick = Decatron.Services.BotList.BotListService.NormalizeUsername("kick", actor.KickUsername ?? "");
            var listed = await _db.ChannelEmoteUploaders.AnyAsync(u => u.UserId == channelUserId
                && ((u.Platform == "twitch" && u.Login == twitch) || (kick != "" && u.Platform == "kick" && u.Login == kick)));
            return listed ? EmoteRole.Listed : EmoteRole.Viewer;
        }

        /// <summary>Qué puede hacer cada rol según el modo del canal: si puede subir y si lo suyo se aprueba solo</summary>
        public static (bool CanUpload, bool AutoApprove) Decide(string mode, EmoteRole role)
        {
            if (role == EmoteRole.Owner) return (true, true);
            return mode switch
            {
                "owner" => (false, false),
                "staff" => role == EmoteRole.Staff ? (true, true) : (false, false),
                "approval" => role is EmoteRole.Staff or EmoteRole.Listed ? (true, true) : (true, false),
                "list" => role is EmoteRole.Staff or EmoteRole.Listed ? (true, true) : (false, false),
                _ => (false, false)
            };
        }

        // ═══════════════════════════════════════════════════════════════
        // LECTURA
        // ═══════════════════════════════════════════════════════════════

        public async Task<(int Used, int Max, string Tier)> GetUsageAsync(long channelUserId)
        {
            var tier = await TierResolver.GetEffectiveTierAsync(_db, channelUserId);
            var used = await _db.ChannelEmotes.CountAsync(e => e.UserId == channelUserId && (e.Status == ChannelEmote.Approved || e.Status == ChannelEmote.Hidden));
            return (used, EmoteTierLimits.ForTier(tier).MaxEmotes, tier ?? "free");
        }

        public Task<List<ChannelEmote>> GetApprovedAsync(long channelUserId) =>
            _db.ChannelEmotes.AsNoTracking().Where(e => e.UserId == channelUserId && e.Status == ChannelEmote.Approved)
                .OrderBy(e => e.Name).ToListAsync();

        // ═══════════════════════════════════════════════════════════════
        // SUBIDA
        // ═══════════════════════════════════════════════════════════════

        public static string? ValidateName(string? name) =>
            string.IsNullOrWhiteSpace(name) || !ValidName.IsMatch(name.Trim()) ? "invalid_name" : null;

        private static bool RateLimited(long actorUserId, int perHour)
        {
            var queue = RecentUploads.GetOrAdd(actorUserId, _ => new Queue<DateTime>());
            lock (queue)
            {
                var cutoff = DateTime.UtcNow.AddHours(-1);
                while (queue.Count > 0 && queue.Peek() < cutoff) queue.Dequeue();
                if (queue.Count >= perHour) return true;
                queue.Enqueue(DateTime.UtcNow);
                return false;
            }
        }

        public async Task<EmoteResult> UploadAsync(long channelUserId, long actorUserId, string name, Stream file, bool zeroWidth, CancellationToken ct = default)
        {
            name = (name ?? "").Trim();
            if (ValidateName(name) != null) return EmoteResult.Fail("invalid_name");

            var settings = await GetSettingsAsync(channelUserId);
            var role = await ResolveRoleAsync(channelUserId, actorUserId);
            var (canUpload, autoApprove) = Decide(settings.UploadMode, role);
            if (!canUpload) return EmoteResult.Fail("not_allowed");

            if (RateLimited(actorUserId, role >= EmoteRole.Staff ? StaffUploadsPerHour : UploadsPerHour)) return EmoteResult.Fail("rate_limited");

            if (await _db.ChannelEmotes.AnyAsync(e => e.UserId == channelUserId && e.Name.ToLower() == name.ToLower() && LiveStatuses.Contains(e.Status), ct))
                return EmoteResult.Fail("name_taken");

            if (autoApprove)
            {
                var (used, max, _) = await GetUsageAsync(channelUserId);
                if (used >= max) return EmoteResult.Fail("limit_reached");
            }
            else
            {
                var pendingTotal = await _db.ChannelEmotes.CountAsync(e => e.UserId == channelUserId && e.Status == ChannelEmote.Pending, ct);
                if (pendingTotal >= EmoteTierLimits.MaxPendingPerChannel) return EmoteResult.Fail("channel_pending_full");
                var mine = await _db.ChannelEmotes.CountAsync(e => e.UserId == channelUserId && e.UploadedBy == actorUserId && e.Status == ChannelEmote.Pending, ct);
                if (mine >= settings.MaxPendingPerUser) return EmoteResult.Fail("too_many_pending");
            }

            ProcessedEmote processed;
            try { processed = await EmoteImageProcessor.ProcessAsync(file, ct); }
            catch (EmoteImageException ex) { return EmoteResult.Fail(ex.Code); }

            var actor = await _db.Users.AsNoTracking().Where(u => u.Id == actorUserId)
                .Select(u => new { u.DisplayName, u.Login, u.KickUsername }).FirstOrDefaultAsync(ct);
            var actorName = actor?.DisplayName ?? actor?.Login ?? actor?.KickUsername ?? "?";

            var fileKey = Guid.NewGuid().ToString("N");
            var dir = Path.Combine(AssetsPath, channelUserId.ToString(), fileKey);
            try
            {
                Directory.CreateDirectory(dir);
                foreach (var (scale, bytes) in processed.Files)
                    await File.WriteAllBytesAsync(Path.Combine(dir, $"{scale}.webp"), bytes, ct);

                var emote = new ChannelEmote
                {
                    UserId = channelUserId, Name = name, FileKey = fileKey, Animated = processed.Animated, ZeroWidth = zeroWidth,
                    Width = processed.Width, Height = processed.Height, Bytes = processed.TotalBytes,
                    Status = autoApprove ? ChannelEmote.Approved : ChannelEmote.Pending,
                    UploadedBy = actorUserId, UploadedByName = actorName,
                    ReviewedByName = autoApprove ? actorName : null, ReviewedAt = autoApprove ? DateTime.Now : null,
                };
                _db.ChannelEmotes.Add(emote);
                await _db.SaveChangesAsync(ct);
                if (autoApprove) _catalog.InvalidateOwn(channelUserId);
                return new EmoteResult(null, emote);
            }
            catch (DbUpdateException)
            {
                // Otro pedido ganó el mismo nombre al mismo tiempo
                TryDeleteDir(dir);
                return EmoteResult.Fail("name_taken");
            }
            catch
            {
                TryDeleteDir(dir);
                throw;
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // REVISIÓN Y CAMBIOS (los hace quien administra el canal)
        // ═══════════════════════════════════════════════════════════════

        private async Task<string> ActorNameAsync(long actorUserId) =>
            await _db.Users.AsNoTracking().Where(u => u.Id == actorUserId).Select(u => u.DisplayName ?? u.Login ?? u.KickUsername ?? "?").FirstOrDefaultAsync() ?? "?";

        public async Task<EmoteResult> ReviewAsync(long channelUserId, long actorUserId, long emoteId, bool approve, string? reason)
        {
            var e = await _db.ChannelEmotes.FirstOrDefaultAsync(x => x.Id == emoteId && x.UserId == channelUserId);
            if (e == null) return EmoteResult.Fail("not_found");
            if (e.Status != ChannelEmote.Pending) return EmoteResult.Fail("not_pending");

            if (approve)
            {
                var (used, max, _) = await GetUsageAsync(channelUserId);
                if (used >= max) return EmoteResult.Fail("limit_reached");
                e.Status = ChannelEmote.Approved;
                e.Reason = null;
            }
            else
            {
                e.Status = ChannelEmote.Rejected;
                e.Reason = Clip(reason);
            }
            e.ReviewedByName = await ActorNameAsync(actorUserId);
            e.ReviewedAt = DateTime.Now;
            e.UpdatedAt = DateTime.Now;
            await _db.SaveChangesAsync();

            if (!approve) TryDeleteDir(Path.Combine(AssetsPath, channelUserId.ToString(), e.FileKey));
            _catalog.InvalidateOwn(channelUserId);
            return new EmoteResult(null, e);
        }

        public async Task<(int Done, string? Error)> ReviewBatchAsync(long channelUserId, long actorUserId, IEnumerable<long> ids, bool approve, string? reason)
        {
            var done = 0;
            string? lastError = null;
            foreach (var id in ids.Distinct().Take(200))
            {
                var r = await ReviewAsync(channelUserId, actorUserId, id, approve, reason);
                if (r.Success) done++;
                else lastError = r.Error;
                // Sin lugar para aprobar más: no tiene sentido seguir
                if (r.Error == "limit_reached") break;
            }
            return (done, done == 0 ? lastError : null);
        }

        /// <summary>Cambia el nombre, el "encima del anterior" o muestra/oculta un emote ya aprobado</summary>
        public async Task<EmoteResult> UpdateAsync(long channelUserId, long emoteId, string? name, bool? zeroWidth, bool? visible)
        {
            var e = await _db.ChannelEmotes.FirstOrDefaultAsync(x => x.Id == emoteId && x.UserId == channelUserId);
            if (e == null || !LiveStatuses.Contains(e.Status)) return EmoteResult.Fail("not_found");

            if (name != null)
            {
                name = name.Trim();
                if (ValidateName(name) != null) return EmoteResult.Fail("invalid_name");
                if (!string.Equals(name, e.Name, StringComparison.Ordinal)
                    && await _db.ChannelEmotes.AnyAsync(x => x.UserId == channelUserId && x.Id != e.Id && x.Name.ToLower() == name.ToLower() && LiveStatuses.Contains(x.Status)))
                    return EmoteResult.Fail("name_taken");
                e.Name = name;
            }
            if (zeroWidth.HasValue) e.ZeroWidth = zeroWidth.Value;
            if (visible.HasValue)
            {
                if (e.Status == ChannelEmote.Pending) return EmoteResult.Fail("not_approved");
                e.Status = visible.Value ? ChannelEmote.Approved : ChannelEmote.Hidden;
            }
            e.UpdatedAt = DateTime.Now;
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateException) { return EmoteResult.Fail("name_taken"); }
            _catalog.InvalidateOwn(channelUserId);
            return new EmoteResult(null, e);
        }

        /// <summary>
        /// Borra los archivos. Si lo subió otra persona (que no sea el dueño del canal), la fila queda como "retirado"
        /// con el motivo para que esa persona se entere; si no, se borra del todo.
        /// </summary>
        public async Task<EmoteResult> DeleteAsync(long channelUserId, long actorUserId, long emoteId, string? reason)
        {
            var e = await _db.ChannelEmotes.FirstOrDefaultAsync(x => x.Id == emoteId && x.UserId == channelUserId);
            if (e == null) return EmoteResult.Fail("not_found");

            TryDeleteDir(Path.Combine(AssetsPath, channelUserId.ToString(), e.FileKey));
            if (e.UploadedBy == channelUserId || e.UploadedBy == actorUserId || e.Status is ChannelEmote.Rejected or ChannelEmote.Removed)
            {
                _db.ChannelEmotes.Remove(e);
            }
            else
            {
                e.Status = ChannelEmote.Removed;
                e.Reason = Clip(reason);
                e.ReviewedByName = await ActorNameAsync(actorUserId);
                e.ReviewedAt = DateTime.Now;
                e.UpdatedAt = DateTime.Now;
            }
            await _db.SaveChangesAsync();
            _catalog.InvalidateOwn(channelUserId);
            return new EmoteResult(null, e);
        }

        /// <summary>Quien subió un emote puede borrarlo (de cualquier estado); las filas retiradas o rechazadas solo las descarta</summary>
        public async Task<EmoteResult> DeleteOwnAsync(long channelUserId, long actorUserId, long emoteId)
        {
            var e = await _db.ChannelEmotes.FirstOrDefaultAsync(x => x.Id == emoteId && x.UserId == channelUserId && x.UploadedBy == actorUserId);
            if (e == null) return EmoteResult.Fail("not_found");
            TryDeleteDir(Path.Combine(AssetsPath, channelUserId.ToString(), e.FileKey));
            _db.ChannelEmotes.Remove(e);
            await _db.SaveChangesAsync();
            _catalog.InvalidateOwn(channelUserId);
            return new EmoteResult(null, e);
        }

        /// <summary>Quita del historial los emotes rechazados y retirados</summary>
        public async Task<int> PurgeHistoryAsync(long channelUserId) =>
            await _db.ChannelEmotes.Where(e => e.UserId == channelUserId && (e.Status == ChannelEmote.Rejected || e.Status == ChannelEmote.Removed)).ExecuteDeleteAsync();

        // ═══════════════════════════════════════════════════════════════
        // REPORTES
        // ═══════════════════════════════════════════════════════════════

        public async Task<string?> ReportAsync(long channelUserId, long reporterUserId, long emoteId, string? reason)
        {
            var e = await _db.ChannelEmotes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == emoteId && x.UserId == channelUserId && x.Status == ChannelEmote.Approved);
            if (e == null) return "not_found";
            if (await _db.ChannelEmoteReports.AnyAsync(r => r.EmoteId == emoteId && r.ReporterUserId == reporterUserId)) return null;
            _db.ChannelEmoteReports.Add(new ChannelEmoteReport { EmoteId = emoteId, ReporterUserId = reporterUserId, Reason = Clip(reason) });
            await _db.SaveChangesAsync();
            return null;
        }

        public async Task<int> DismissReportsAsync(long channelUserId, long emoteId)
        {
            var owns = await _db.ChannelEmotes.AnyAsync(e => e.Id == emoteId && e.UserId == channelUserId);
            return owns ? await _db.ChannelEmoteReports.Where(r => r.EmoteId == emoteId).ExecuteDeleteAsync() : 0;
        }

        // ═══════════════════════════════════════════════════════════════

        private static string? Clip(string? s)
        {
            s = s?.Trim();
            if (string.IsNullOrEmpty(s)) return null;
            return s.Length > 300 ? s[..300] : s;
        }

        private void TryDeleteDir(string dir)
        {
            try { if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true); }
            catch (Exception ex) { _logger.LogWarning(ex, "[Emotes] No se pudo borrar {Dir}", dir); }
        }
    }
}
