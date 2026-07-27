using Decatron.Core.Models.Fortnite;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    public interface IFortniteService
    {
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
        Task<List<LeaderboardEntry>> GetGlobalLeaderboardAsync(int top = 10);

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

        public FortniteService(DecatronDbContext context, ILogger<FortniteService> logger)
        {
            _context = context;
            _logger = logger;
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

        public async Task<List<SpriteCollectionItem>> GetUserCollectionAsync(long userId)
        {
            var allSprites = await _context.FortniteSprites
                .OrderBy(s => s.Character).ThenBy(s => s.Theme)
                .ToListAsync();

            var obtained = await _context.UserFortniteSprites
                .Where(u => u.UserId == userId)
                .ToListAsync();

            var obtainedMap = obtained.ToDictionary(u => u.SpriteId);

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

            var exists = await _context.UserFortniteSprites
                .AnyAsync(u => u.UserId == userId && u.SpriteId == sprite.Id);

            if (exists)
                return; // Ya lo tiene, no hacer nada

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

            var entry = await _context.UserFortniteSprites
                .FirstOrDefaultAsync(u => u.UserId == userId && u.SpriteId == sprite.Id);

            if (entry == null)
                return;

            _context.UserFortniteSprites.Remove(entry);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Spirit desmarcado: {SpriteKey} por usuario {UserId}", spriteKey, userId);
        }

        public async Task<bool> HasSpriteAsync(long userId, int spriteId)
        {
            return await _context.UserFortniteSprites
                .AnyAsync(u => u.UserId == userId && u.SpriteId == spriteId);
        }

        public async Task<List<LeaderboardEntry>> GetGlobalLeaderboardAsync(int top = 10)
        {
            var total = await _context.FortniteSprites.CountAsync(s => !s.IsUnreleased);

            return await _context.UserFortniteSprites
                .GroupBy(u => u.UserId)
                .Select(g => new
                {
                    UserId = g.Key,
                    Count = g.Count()
                })
                .OrderByDescending(x => x.Count)
                .Take(top)
                .Join(_context.Users,
                    x => x.UserId,
                    u => u.Id,
                    (x, u) => new LeaderboardEntry
                    {
                        Username = u.Login,
                        DisplayName = u.DisplayName ?? u.Login,
                        Count = x.Count,
                        Total = total
                    })
                .ToListAsync();
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
