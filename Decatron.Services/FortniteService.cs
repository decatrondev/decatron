using Decatron.Core.Models.Fortnite;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    public interface IFortniteService
    {
        // Temporada
        string CurrentSeason { get; }
        Task<List<string>> GetAvailableSeasonsAsync();

        // Catálogo público
        Task<List<FortniteSprite>> GetAllSpritesAsync();
        Task<FortniteSprite?> GetSpriteByKeyAsync(string spriteKey);
        Task<FortniteSprite?> GetSpriteByIdAsync(int id);

        // Colección de usuario
        Task<List<SpriteCollectionItem>> GetUserCollectionAsync(long userId);
        Task<List<SpriteCollectionItem>> GetPublicCollectionAsync(string username);
        Task MarkSpriteAsync(long userId, string spriteKey, string platform = "web");
        Task UnmarkSpriteAsync(long userId, string spriteKey);
        Task<bool> HasSpriteAsync(long userId, int spriteId);

        // Leaderboard
        Task<List<LeaderboardEntry>> GetGlobalLeaderboardAsync(int top = 10, string? season = null);

        // Notificaciones de sprites nuevos
        Task<UserSpiritNotificationPref> GetOrCreateNotificationPrefsAsync(long userId);
        Task<UserSpiritNotificationPref> SetNotificationPrefsAsync(long userId, bool notifyTwitchChat, bool notifyDiscordDm);
        Task<List<FortniteSprite>> GetSpritesReleasedSinceAsync(DateTime? since);
        Task<List<FortniteSprite>> GetNewSinceDashboardVisitAsync(long userId);

        // Admin
        Task<FortniteSprite> CreateSpriteAsync(FortniteSprite sprite);
        Task<FortniteSprite> UpdateSpriteAsync(FortniteSprite sprite);
        Task DeleteSpriteAsync(int id);
    }

    public class SpriteCollectionItem
    {
        public FortniteSprite Sprite { get; set; } = null!;
        public bool IsObtained { get; set; }
        public DateTime? ObtainedAt { get; set; }
        public string? Platform { get; set; }
    }

    public class LeaderboardEntry
    {
        public string Username { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public int Count { get; set; }
        public int Total { get; set; }
    }

    public class FortniteService : IFortniteService
    {
        private readonly DecatronDbContext _context;
        private readonly ILogger<FortniteService> _logger;

        public string CurrentSeason { get; }

        public FortniteService(DecatronDbContext context, ILogger<FortniteService> logger, IConfiguration configuration)
        {
            _context = context;
            _logger = logger;
            CurrentSeason = configuration["Fortnite:CurrentSeason"] ?? "Unknown";
        }

        public async Task<List<string>> GetAvailableSeasonsAsync()
        {
            return await _context.FortniteSprites
                .Where(s => s.Season != null)
                .Select(s => s.Season!)
                .Distinct()
                .ToListAsync();
        }

        public async Task<List<FortniteSprite>> GetAllSpritesAsync()
        {
            return await _context.FortniteSprites
                .OrderBy(s => s.Character)
                .ThenBy(s => s.Theme)
                .ToListAsync();
        }

        public async Task<FortniteSprite?> GetSpriteByKeyAsync(string spriteKey)
        {
            return await _context.FortniteSprites
                .FirstOrDefaultAsync(s => s.SpriteKey == spriteKey.ToLower());
        }

        public async Task<FortniteSprite?> GetSpriteByIdAsync(int id)
        {
            return await _context.FortniteSprites.FindAsync(id);
        }

        /// <summary>
        /// Los spirits son de la PERSONA, no del canal — a diferencia de comandos/
        /// overlays/etc, que son por canal. Si el usuario tiene Twitch y Kick
        /// vinculados (mismo account_id), la coleccion es una sola entre los dos.
        /// Ver .dev/plans/UNIFICACION_MULTIPLATAFORMA_PLAN.md seccion 8.10.
        /// Sin cuenta vinculada, esto devuelve solo [userId] — mismo comportamiento
        /// de siempre, cero cambio para el 99% de las cuentas hoy.
        /// </summary>
        private async Task<List<long>> GetAccountUserIdsAsync(long userId)
        {
            var accountId = await _context.Users
                .Where(u => u.Id == userId)
                .Select(u => u.AccountId)
                .FirstOrDefaultAsync();

            if (accountId == null)
                return new List<long> { userId };

            return await _context.Users
                .Where(u => u.AccountId == accountId)
                .Select(u => u.Id)
                .ToListAsync();
        }

        public async Task<List<SpriteCollectionItem>> GetUserCollectionAsync(long userId)
        {
            var accountUserIds = await GetAccountUserIdsAsync(userId);

            var allSprites = await _context.FortniteSprites
                .OrderBy(s => s.Character).ThenBy(s => s.Theme)
                .ToListAsync();

            var obtained = await _context.UserFortniteSprites
                .Where(u => accountUserIds.Contains(u.UserId))
                .ToListAsync();

            // GroupBy, no ToDictionary directo: si el mismo spirit ya estaba marcado
            // en mas de un canal antes de vincular la cuenta, habria dos filas con el
            // mismo SpriteId — se queda con la mas antigua.
            var obtainedMap = obtained
                .GroupBy(u => u.SpriteId)
                .ToDictionary(g => g.Key, g => g.OrderBy(u => u.ObtainedAt).First());

            return allSprites.Select(s => new SpriteCollectionItem
            {
                Sprite = s,
                IsObtained = obtainedMap.ContainsKey(s.Id),
                ObtainedAt = obtainedMap.TryGetValue(s.Id, out var entry) ? entry.ObtainedAt : null,
                Platform = obtainedMap.TryGetValue(s.Id, out var e2) ? e2.Platform : null
            }).ToList();
        }

        public async Task<List<SpriteCollectionItem>> GetPublicCollectionAsync(string username)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Login == username.ToLower() && u.IsActive);

            if (user == null)
                throw new KeyNotFoundException($"Usuario '{username}' no encontrado");

            return await GetUserCollectionAsync(user.Id);
        }

        public async Task MarkSpriteAsync(long userId, string spriteKey, string platform = "web")
        {
            var sprite = await GetSpriteByKeyAsync(spriteKey);
            if (sprite == null)
                throw new KeyNotFoundException($"Spirit '{spriteKey}' no encontrado");

            if (sprite.IsUnreleased)
                throw new InvalidOperationException($"Spirit '{sprite.Name}' todavia no salio en el juego");

            var accountUserIds = await GetAccountUserIdsAsync(userId);

            var exists = await _context.UserFortniteSprites
                .AnyAsync(u => accountUserIds.Contains(u.UserId) && u.SpriteId == sprite.Id);

            if (exists)
                return; // Ya lo tiene (en este canal o en otro vinculado), no hacer nada

            // Se guarda contra el userId que lo disparo (que plataforma lo marco
            // queda en el registro), pero "exists" ya mira toda la cuenta.
            _context.UserFortniteSprites.Add(new UserFortniteSprite
            {
                UserId = userId,
                SpriteId = sprite.Id,
                Platform = platform,
                ObtainedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            _logger.LogInformation("Spirit marcado: {SpriteKey} por usuario {UserId} via {Platform}", spriteKey, userId, platform);
        }

        public async Task UnmarkSpriteAsync(long userId, string spriteKey)
        {
            var sprite = await GetSpriteByKeyAsync(spriteKey);
            if (sprite == null)
                throw new KeyNotFoundException($"Spirit '{spriteKey}' no encontrado");

            var accountUserIds = await GetAccountUserIdsAsync(userId);

            // Puede estar guardado contra cualquiera de los canales de la cuenta,
            // no necesariamente el que esta desmarcando ahora.
            var entries = await _context.UserFortniteSprites
                .Where(u => accountUserIds.Contains(u.UserId) && u.SpriteId == sprite.Id)
                .ToListAsync();

            if (entries.Count == 0)
                return;

            _context.UserFortniteSprites.RemoveRange(entries);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Spirit desmarcado: {SpriteKey} por usuario {UserId} ({Count} fila(s))", spriteKey, userId, entries.Count);
        }

        public async Task<bool> HasSpriteAsync(long userId, int spriteId)
        {
            var accountUserIds = await GetAccountUserIdsAsync(userId);
            return await _context.UserFortniteSprites
                .AnyAsync(u => accountUserIds.Contains(u.UserId) && u.SpriteId == spriteId);
        }

        public async Task<List<LeaderboardEntry>> GetGlobalLeaderboardAsync(int top = 10, string? season = null)
        {
            var spritesQuery = _context.FortniteSprites.Where(s => !s.IsUnreleased);
            if (!string.IsNullOrEmpty(season))
                spritesQuery = spritesQuery.Where(s => s.Season == season);

            var total = await spritesQuery.CountAsync();
            var spriteIdsInScope = string.IsNullOrEmpty(season)
                ? (HashSet<int>?)null
                : (await spritesQuery.Select(s => s.Id).ToListAsync()).ToHashSet();

            // Se agrupa por cuenta, no por canal — un streamer con Twitch y Kick
            // vinculados aparece como una sola entrada con el total combinado, no
            // partido en dos filas mas chicas. Traido a memoria porque el
            // agrupamiento (AccountId ?? Id) no es algo que EF pueda traducir a SQL
            // limpio; el volumen (decenas de streamers, no millones) lo hace trivial.
            var raw = await (
                from ufs in _context.UserFortniteSprites
                join u in _context.Users on ufs.UserId equals u.Id
                select new { ufs.SpriteId, u.Id, u.AccountId, u.Login, u.DisplayName, u.TwitchId, u.CreatedAt }
            ).ToListAsync();

            if (spriteIdsInScope != null)
                raw = raw.Where(x => spriteIdsInScope.Contains(x.SpriteId)).ToList();

            return raw
                .GroupBy(x => x.AccountId ?? x.Id)
                .Select(g => new
                {
                    Count = g.Select(x => x.SpriteId).Distinct().Count(),
                    // Preferir el canal de Twitch como "cara" del leaderboard (login
                    // mas reconocible que kick_123456), si no hay, el mas antiguo.
                    Representative = g.OrderByDescending(x => !string.IsNullOrEmpty(x.TwitchId)).ThenBy(x => x.CreatedAt).First()
                })
                .OrderByDescending(x => x.Count)
                .Take(top)
                .Select(x => new LeaderboardEntry
                {
                    Username = x.Representative.Login,
                    DisplayName = x.Representative.DisplayName ?? x.Representative.Login,
                    Count = x.Count,
                    Total = total
                })
                .ToList();
        }

        public async Task<UserSpiritNotificationPref> GetOrCreateNotificationPrefsAsync(long userId)
        {
            var prefs = await _context.UserSpiritNotificationPrefs.FirstOrDefaultAsync(p => p.UserId == userId);
            if (prefs != null)
                return prefs;

            // El front dispara varios GET en paralelo al entrar a /me/spirits (prefs
            // + banner de novedades) y los dos pueden llegar sin fila todavia. Un
            // INSERT trackeado por EF que despues choca contra la constraint unica
            // logea la excepcion completa como ERROR aunque se recupere bien — con
            // ON CONFLICT DO NOTHING el que pierde la carrera ni genera el error.
            await _context.Database.ExecuteSqlInterpolatedAsync(
                $"INSERT INTO user_spirit_notification_prefs (user_id) VALUES ({userId}) ON CONFLICT (user_id) DO NOTHING");

            return await _context.UserSpiritNotificationPrefs.FirstAsync(p => p.UserId == userId);
        }

        public async Task<UserSpiritNotificationPref> SetNotificationPrefsAsync(long userId, bool notifyTwitchChat, bool notifyDiscordDm)
        {
            var prefs = await GetOrCreateNotificationPrefsAsync(userId);
            var now = DateTime.UtcNow;

            // Al prender por primera vez un canal, el punto de partida es ahora:
            // solo avisa de lo que salga de aca en adelante, no hace backfill de
            // todo lo que ya se libero antes de que la persona se suscribiera.
            if (notifyTwitchChat && !prefs.NotifyTwitchChat)
                prefs.LastNotifiedTwitchAt = now;
            if (notifyDiscordDm && !prefs.NotifyDiscordDm)
                prefs.LastNotifiedDiscordAt = now;

            prefs.NotifyTwitchChat = notifyTwitchChat;
            prefs.NotifyDiscordDm = notifyDiscordDm;
            prefs.UpdatedAt = now;
            await _context.SaveChangesAsync();
            return prefs;
        }

        public async Task<List<FortniteSprite>> GetSpritesReleasedSinceAsync(DateTime? since)
        {
            var query = _context.FortniteSprites.Where(s => s.ReleasedAt != null);
            if (since != null)
                query = query.Where(s => s.ReleasedAt > since);
            return await query.OrderBy(s => s.ReleasedAt).ToListAsync();
        }

        public async Task<List<FortniteSprite>> GetNewSinceDashboardVisitAsync(long userId)
        {
            var prefs = await GetOrCreateNotificationPrefsAsync(userId);
            var since = prefs.LastSeenDashboardAt;

            var newSprites = await GetSpritesReleasedSinceAsync(since);

            prefs.LastSeenDashboardAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // La primera vez (since == null) no hay "ultima visita" real contra
            // que comparar — se marca el punto de partida ahora y no se muestra
            // como si todo el catalogo historico fuera "nuevo".
            return since == null ? new List<FortniteSprite>() : newSprites;
        }

        public async Task<FortniteSprite> CreateSpriteAsync(FortniteSprite sprite)
        {
            var exists = await _context.FortniteSprites
                .AnyAsync(s => s.SpriteKey == sprite.SpriteKey);
            if (exists)
                throw new InvalidOperationException($"Ya existe un spirit con key '{sprite.SpriteKey}'");

            sprite.CreatedAt = DateTime.UtcNow;
            sprite.UpdatedAt = DateTime.UtcNow;
            _context.FortniteSprites.Add(sprite);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Spirit creado: {Name} ({SpriteKey})", sprite.Name, sprite.SpriteKey);
            return sprite;
        }

        public async Task<FortniteSprite> UpdateSpriteAsync(FortniteSprite sprite)
        {
            var existing = await _context.FortniteSprites.FindAsync(sprite.Id)
                ?? throw new KeyNotFoundException($"Spirit con ID {sprite.Id} no encontrado");

            existing.Name = sprite.Name;
            existing.Character = sprite.Character;
            existing.Theme = sprite.Theme;
            existing.Rarity = sprite.Rarity;
            existing.ImageUrl = sprite.ImageUrl;
            existing.IsUnreleased = sprite.IsUnreleased;
            existing.Season = sprite.Season;
            existing.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            _logger.LogInformation("Spirit actualizado: {Name} (ID: {Id})", existing.Name, existing.Id);
            return existing;
        }

        public async Task DeleteSpriteAsync(int id)
        {
            var sprite = await _context.FortniteSprites.FindAsync(id)
                ?? throw new KeyNotFoundException($"Spirit con ID {id} no encontrado");

            _context.FortniteSprites.Remove(sprite);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Spirit eliminado: {Name} (ID: {Id})", sprite.Name, id);
        }
    }
}
