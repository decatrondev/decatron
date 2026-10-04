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

        public Task<List<GlobalEmote>> ListAsync() => _db.GlobalEmotes.AsNoTracking().OrderBy(e => e.Name).ToListAsync();

        public Task<List<GlobalEmote>> ListApprovedAsync() =>
            _db.GlobalEmotes.AsNoTracking().Where(e => e.Status == GlobalEmote.Approved).OrderBy(e => e.Name).ToListAsync();

        /// <summary>Nombres de 7TV, BTTV y FFZ globales con los que chocaría este nombre (el nuestro queda tapado en el chat)</summary>
        public async Task<bool> CollidesAsync(string name) => (await _catalog.GetExternalGlobalNamesAsync()).Contains(name);

        public async Task<EmoteResult> UploadAsync(long actorUserId, string name, Stream file, bool zeroWidth, CancellationToken ct = default)
        {
            name = (name ?? "").Trim();
            if (ChannelEmoteService.ValidateName(name) != null) return EmoteResult.Fail("invalid_name");
            if (await _db.GlobalEmotes.AnyAsync(e => e.Name.ToLower() == name.ToLower(), ct)) return EmoteResult.Fail("name_taken");
            if (await _db.GlobalEmotes.CountAsync(ct) >= MaxEmotes) return EmoteResult.Fail("limit_reached");

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

        public async Task<string?> UpdateAsync(long id, string? name, bool? zeroWidth, bool? visible)
        {
            var e = await _db.GlobalEmotes.FirstOrDefaultAsync(x => x.Id == id);
            if (e == null) return "not_found";
            if (name != null)
            {
                name = name.Trim();
                if (ChannelEmoteService.ValidateName(name) != null) return "invalid_name";
                if (await _db.GlobalEmotes.AnyAsync(x => x.Id != id && x.Name.ToLower() == name.ToLower())) return "name_taken";
                e.Name = name;
            }
            if (zeroWidth.HasValue) e.ZeroWidth = zeroWidth.Value;
            if (visible.HasValue) e.Status = visible.Value ? GlobalEmote.Approved : GlobalEmote.Hidden;
            e.UpdatedAt = DateTime.Now;
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateException) { return "name_taken"; }
            _catalog.InvalidateGlobal();
            return null;
        }

        public async Task<bool> DeleteAsync(long id)
        {
            var e = await _db.GlobalEmotes.FirstOrDefaultAsync(x => x.Id == id);
            if (e == null) return false;
            _db.GlobalEmotes.Remove(e);
            await _db.SaveChangesAsync();
            TryDeleteDir(Path.Combine(AssetsPath, e.FileKey));
            _catalog.InvalidateGlobal();
            return true;
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
            return null;
        }

        public async Task<bool> RemoveManagerAsync(long id)
        {
            var row = await _db.GlobalEmoteManagers.FirstOrDefaultAsync(m => m.Id == id);
            if (row == null) return false;
            _db.GlobalEmoteManagers.Remove(row);
            await _db.SaveChangesAsync();
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
