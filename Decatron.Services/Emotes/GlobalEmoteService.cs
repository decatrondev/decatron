using System.Text.RegularExpressions;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services.ChatOverlay;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Decatron.Services.Emotes
{
    /// <summary>
    /// Emotes globales de Decatron: el set de la plataforma, visible en todos los canales con la prioridad más baja.
    /// Los manejan los admins del sistema y las personas (usuario de Twitch) que el dueño autorice. Sin límites por tier.
    /// Reutiliza el procesador de imágenes de los emotes de canal.
    /// </summary>
    public sealed class GlobalEmoteService
    {
        private const int MaxEmotes = 500;
        private const int TrashDays = 30;
        /// <summary>Borrados por hora de una persona autorizada que no es admin (los borrados masivos los hace un admin)</summary>
        private const int ManagerDeletesPerHour = 10;
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, Queue<DateTime>> RecentDeletes = new();
        private readonly DecatronDbContext _db;
        private readonly EmoteCatalogService _catalog;
        private readonly IConfiguration _config;
        private readonly ILogger<GlobalEmoteService> _logger;

        public GlobalEmoteService(DecatronDbContext db, EmoteCatalogService catalog, IConfiguration config, ILogger<GlobalEmoteService> logger)
        {
            _db = db;
            _catalog = catalog;
            _config = config;
            _logger = logger;
        }

        private string AssetsPath => Path.Combine(_config["Emotes:AssetsPath"] ?? "/var/www/html/decatron/emote-assets", "global");
        private string PublicBase => (_config["Emotes:PublicBase"] ?? "https://decatron.net").TrimEnd('/');

        public string UrlFor(GlobalEmote e, int scale) => $"{PublicBase}/uploads/emotes/global/{e.FileKey}/{scale}.webp";

        /// <summary>owner | admin | manager | none, según el usuario de Twitch de quien pregunta</summary>
        public async Task<string> ResolveAccessAsync(string? login)
        {
            login = (login ?? "").Trim().ToLowerInvariant();
            if (login == "") return "none";
            var role = await _db.SystemAdmins.AsNoTracking().Where(a => a.Username.ToLower() == login).Select(a => a.Role).FirstOrDefaultAsync();
            if (role != null) return role == "owner" ? "owner" : "admin";
            return await _db.GlobalEmoteManagers.AnyAsync(m => m.Login == login) ? "manager" : "none";
        }

        /// <summary>Todos los emotes, papelera incluida. De paso borra del todo lo que lleva más de 30 días en la papelera</summary>
        public async Task<List<GlobalEmote>> ListAsync()
        {
            await PurgeExpiredAsync();
            return await _db.GlobalEmotes.AsNoTracking().OrderBy(e => e.Name).ToListAsync();
        }

        private async Task PurgeExpiredAsync()
        {
            var cutoff = DateTime.Now.AddDays(-TrashDays);
            var old = await _db.GlobalEmotes.Where(e => e.Status == GlobalEmote.Removed && e.RemovedAt != null && e.RemovedAt < cutoff).ToListAsync();
            if (old.Count == 0) return;
            _db.GlobalEmotes.RemoveRange(old);
            await _db.SaveChangesAsync();
            foreach (var e in old) TryDeleteDir(Path.Combine(AssetsPath, e.FileKey));
            await LogAsync("sistema", "purge", $"{old.Count} emote(s) con más de {TrashDays} días en la papelera");
        }

        private async Task LogAsync(string actor, string action, string? detail)
        {
            _db.GlobalEmoteLogs.Add(new GlobalEmoteLog { Actor = actor, Action = action, Detail = detail?.Length > 300 ? detail[..300] : detail });
            await _db.SaveChangesAsync();
        }

        public Task<List<GlobalEmoteLog>> GetLogAsync() =>
            _db.GlobalEmoteLogs.AsNoTracking().OrderByDescending(l => l.CreatedAt).ThenByDescending(l => l.Id).Take(300).ToListAsync();

        public Task<List<GlobalEmote>> ListApprovedAsync() =>
            _db.GlobalEmotes.AsNoTracking().Where(e => e.Status == GlobalEmote.Approved).OrderBy(e => e.Name).ToListAsync();

        /// <summary>Nombres de 7TV, BTTV y FFZ globales con los que chocaría este nombre (el nuestro queda tapado en el chat)</summary>
        public async Task<bool> CollidesAsync(string name) => (await _catalog.GetExternalGlobalNamesAsync()).Contains(name);

        public async Task<EmoteResult> UploadAsync(long actorUserId, string actor, string name, Stream file, bool zeroWidth, CancellationToken ct = default)
        {
            name = (name ?? "").Trim();
            if (ChannelEmoteService.ValidateName(name) != null) return EmoteResult.Fail("invalid_name");
            if (await _db.GlobalEmotes.AnyAsync(e => e.Status != GlobalEmote.Removed && e.Name.ToLower() == name.ToLower(), ct)) return EmoteResult.Fail("name_taken");
            if (await _db.GlobalEmotes.CountAsync(e => e.Status != GlobalEmote.Removed, ct) >= MaxEmotes) return EmoteResult.Fail("limit_reached");

            ProcessedEmote processed;
            try { processed = await EmoteImageProcessor.ProcessAsync(file, ct); }
            catch (EmoteImageException ex) { return EmoteResult.Fail(ex.Code); }

            var actorName = await ActorNameAsync(actorUserId);
            var fileKey = Guid.NewGuid().ToString("N");
            var dir = Path.Combine(AssetsPath, fileKey);
            try
            {
                Directory.CreateDirectory(dir);
                foreach (var (scale, bytes) in processed.Files)
                    await File.WriteAllBytesAsync(Path.Combine(dir, $"{scale}.webp"), bytes, ct);

                var row = new GlobalEmote
                {
                    Name = name, FileKey = fileKey, Animated = processed.Animated, ZeroWidth = zeroWidth,
                    Width = processed.Width, Height = processed.Height, Bytes = processed.TotalBytes,
                    UploadedBy = actorUserId, UploadedByName = actorName
                };
                _db.GlobalEmotes.Add(row);
                await _db.SaveChangesAsync(ct);
                _catalog.InvalidateGlobal();
                await LogAsync(actor, "upload", name);
                return new EmoteResult(null);
            }
            catch (DbUpdateException)
            {
                TryDeleteDir(dir);
                return EmoteResult.Fail("name_taken");
            }
            catch
            {
                TryDeleteDir(dir);
                throw;
            }
        }

        public async Task<string?> UpdateAsync(long id, string actor, string? name, bool? zeroWidth, bool? visible)
        {
            var e = await _db.GlobalEmotes.FirstOrDefaultAsync(x => x.Id == id && x.Status != GlobalEmote.Removed);
            if (e == null) return "not_found";
            var changes = new List<string>();
            if (name != null)
            {
                name = name.Trim();
                if (ChannelEmoteService.ValidateName(name) != null) return "invalid_name";
                if (await _db.GlobalEmotes.AnyAsync(x => x.Id != id && x.Status != GlobalEmote.Removed && x.Name.ToLower() == name.ToLower())) return "name_taken";
                if (name != e.Name) changes.Add($"nombre {e.Name} → {name}");
                e.Name = name;
            }
            if (zeroWidth.HasValue && zeroWidth.Value != e.ZeroWidth) { changes.Add(zeroWidth.Value ? "encima del anterior: sí" : "encima del anterior: no"); e.ZeroWidth = zeroWidth.Value; }
            if (visible.HasValue)
            {
                var status = visible.Value ? GlobalEmote.Approved : GlobalEmote.Hidden;
                if (status != e.Status) { changes.Add(visible.Value ? "mostrado" : "oculto"); e.Status = status; }
            }
            e.UpdatedAt = DateTime.Now;
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateException) { return "name_taken"; }
            _catalog.InvalidateGlobal();
            if (changes.Count > 0) await LogAsync(actor, "update", $"{e.Name}: {string.Join(", ", changes)}");
            return null;
        }

        /// <summary>Va a la papelera (archivos intactos, 30 días). Quien no es admin tiene un tope de borrados por hora</summary>
        public async Task<string?> DeleteAsync(long id, string actor, string access)
        {
            var e = await _db.GlobalEmotes.FirstOrDefaultAsync(x => x.Id == id && x.Status != GlobalEmote.Removed);
            if (e == null) return "not_found";
            if (access == "manager" && DeleteRateLimited(actor)) return "rate_limited";
            e.Status = GlobalEmote.Removed;
            e.RemovedAt = DateTime.Now;
            e.RemovedBy = actor;
            e.UpdatedAt = DateTime.Now;
            await _db.SaveChangesAsync();
            _catalog.InvalidateGlobal();
            await LogAsync(actor, "delete", e.Name);
            return null;
        }

        public async Task<string?> RestoreAsync(long id, string actor)
        {
            var e = await _db.GlobalEmotes.FirstOrDefaultAsync(x => x.Id == id && x.Status == GlobalEmote.Removed);
            if (e == null) return "not_found";
            if (await _db.GlobalEmotes.AnyAsync(x => x.Status != GlobalEmote.Removed && x.Name.ToLower() == e.Name.ToLower())) return "name_taken";
            e.Status = GlobalEmote.Approved;
            e.RemovedAt = null;
            e.RemovedBy = null;
            e.UpdatedAt = DateTime.Now;
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateException) { return "name_taken"; }
            _catalog.InvalidateGlobal();
            await LogAsync(actor, "restore", e.Name);
            return null;
        }

        /// <summary>Borra del todo un emote de la papelera (solo admins)</summary>
        public async Task<string?> PurgeAsync(long id, string actor)
        {
            var e = await _db.GlobalEmotes.FirstOrDefaultAsync(x => x.Id == id && x.Status == GlobalEmote.Removed);
            if (e == null) return "not_found";
            _db.GlobalEmotes.Remove(e);
            await _db.SaveChangesAsync();
            TryDeleteDir(Path.Combine(AssetsPath, e.FileKey));
            await LogAsync(actor, "purge", e.Name);
            return null;
        }

        private static bool DeleteRateLimited(string actor)
        {
            var queue = RecentDeletes.GetOrAdd(actor, _ => new Queue<DateTime>());
            lock (queue)
            {
                var cutoff = DateTime.UtcNow.AddHours(-1);
                while (queue.Count > 0 && queue.Peek() < cutoff) queue.Dequeue();
                if (queue.Count >= ManagerDeletesPerHour) return true;
                queue.Enqueue(DateTime.UtcNow);
                return false;
            }
        }

        // ── Solicitudes de acceso ────────────────────────────────────────────

        /// <summary>Tras un rechazo, la misma persona puede volver a pedir pasados estos días</summary>
        private const int RetryAfterRejectDays = 7;

        public Task<GlobalEmoteRequest?> GetMyRequestAsync(string login) =>
            _db.GlobalEmoteRequests.AsNoTracking().Where(r => r.Login == login.ToLower()).OrderByDescending(r => r.CreatedAt).FirstOrDefaultAsync();

        public async Task<string?> RequestAccessAsync(long userId, string login, string? message)
        {
            login = (login ?? "").Trim().ToLowerInvariant();
            if (login == "") return "not_allowed";
            if (await ResolveAccessAsync(login) != "none") return "already_has_access";
            var last = await GetMyRequestAsync(login);
            if (last?.Status == GlobalEmoteRequest.Pending) return "request_exists";
            if (last?.Status == GlobalEmoteRequest.Rejected && last.ResolvedAt > DateTime.Now.AddDays(-RetryAfterRejectDays)) return "rejected_recently";
            message = message?.Trim();
            if (string.IsNullOrEmpty(message)) message = null;
            else if (message.Length > 300) message = message[..300];
            _db.GlobalEmoteRequests.Add(new GlobalEmoteRequest { UserId = userId, Login = login, Message = message });
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateException) { return "request_exists"; }
            await LogAsync(login, "request", message);
            return null;
        }

        public Task<List<GlobalEmoteRequest>> ListPendingRequestsAsync() =>
            _db.GlobalEmoteRequests.AsNoTracking().Where(r => r.Status == GlobalEmoteRequest.Pending).OrderBy(r => r.CreatedAt).ToListAsync();

        /// <summary>El owner aprueba (la persona pasa a la lista de autorizadas) o rechaza una solicitud</summary>
        public async Task<string?> ResolveRequestAsync(long id, bool approve, string actor)
        {
            var r = await _db.GlobalEmoteRequests.FirstOrDefaultAsync(x => x.Id == id && x.Status == GlobalEmoteRequest.Pending);
            if (r == null) return "not_found";
            if (approve)
            {
                var error = await AddManagerAsync(r.Login, actor);
                if (error != null && error != "manager_exists") return error;
            }
            r.Status = approve ? GlobalEmoteRequest.Approved : GlobalEmoteRequest.Rejected;
            r.ResolvedBy = actor;
            r.ResolvedAt = DateTime.Now;
            await _db.SaveChangesAsync();
            await LogAsync(actor, approve ? "request_approve" : "request_reject", r.Login);
            return null;
        }

        // ── Quién puede manejarlos (lo edita solo el dueño) ──────────────────

        public Task<List<GlobalEmoteManager>> GetManagersAsync() =>
            _db.GlobalEmoteManagers.AsNoTracking().OrderBy(m => m.Login).ToListAsync();

        public async Task<string?> AddManagerAsync(string login, string addedBy)
        {
            login = (login ?? "").Trim().TrimStart('@').ToLowerInvariant();
            if (!Regex.IsMatch(login, @"^[a-z0-9_]{1,40}$")) return "invalid_login";
            if (await _db.GlobalEmoteManagers.CountAsync() >= 100) return "too_many_managers";
            if (await _db.GlobalEmoteManagers.AnyAsync(m => m.Login == login)) return "manager_exists";
            _db.GlobalEmoteManagers.Add(new GlobalEmoteManager { Login = login, AddedBy = addedBy });
            await _db.SaveChangesAsync();
            await LogAsync(addedBy, "manager_add", login);
            return null;
        }

        public async Task<bool> RemoveManagerAsync(long id, string actor)
        {
            var row = await _db.GlobalEmoteManagers.FirstOrDefaultAsync(m => m.Id == id);
            if (row == null) return false;
            _db.GlobalEmoteManagers.Remove(row);
            await _db.SaveChangesAsync();
            await LogAsync(actor, "manager_remove", row.Login);
            return true;
        }

        private async Task<string> ActorNameAsync(long userId) =>
            await _db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => u.DisplayName ?? u.Login ?? u.KickUsername ?? "?").FirstOrDefaultAsync() ?? "?";

        private void TryDeleteDir(string dir)
        {
            try { if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true); }
            catch (Exception ex) { _logger.LogWarning(ex, "[Emotes] No se pudo borrar {Dir}", dir); }
        }
    }
}
