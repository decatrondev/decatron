using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Decatron.Core.Models.GameOverlays;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Decatron.Services.GameData
{
    /// <summary>
    /// Catálogo de anuncios de Decatron para Game Overlays (LIVE_MATCH_OVERLAY_PLAN.md §2.3).
    /// Lo administra el dueño desde /admin; el overlay y el editor lo reciben ya en el
    /// idioma del canal. Cacheado 60 s porque lo pide cada overlay abierto.
    /// </summary>
    public class GameOverlayPromoService
    {
        private const string CacheKey = "game-overlay-promos";
        private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(60);

        private readonly DecatronDbContext _db;
        private readonly IMemoryCache _cache;

        public GameOverlayPromoService(DecatronDbContext db, IMemoryCache cache)
        {
            _db = db;
            _cache = cache;
        }

        public record PromoItemDto(long Id, string Title, string Line, string? ImageUrl, int Weight, int DurationSeconds);
        public record PromoCatalogDto(int EverySeconds, List<PromoItemDto> Items);

        private record Snapshot(int EverySeconds, List<GameOverlayPromo> Promos);

        private async Task<Snapshot> LoadAsync()
        {
            if (_cache.TryGetValue(CacheKey, out Snapshot? cached) && cached != null) return cached;
            var settings = await _db.GameOverlayPromoSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Id == 1);
            var promos = await _db.GameOverlayPromos.AsNoTracking().Where(p => p.IsEnabled && p.Weight > 0)
                .OrderBy(p => p.SortOrder).ThenBy(p => p.Id).ToListAsync();
            var snap = new Snapshot(settings?.EverySeconds ?? 180, promos);
            _cache.Set(CacheKey, snap, CacheTtl);
            return snap;
        }

        public void Invalidate() => _cache.Remove(CacheKey);

        /// <summary>Anuncios activos para un idioma y (opcional) un juego, listos para el overlay.</summary>
        public async Task<PromoCatalogDto> GetCatalogAsync(string? lang, string? game = null)
        {
            var en = lang != null && lang.StartsWith("en", StringComparison.OrdinalIgnoreCase);
            var snap = await LoadAsync();
            var items = snap.Promos
                .Where(p => string.IsNullOrWhiteSpace(p.Games) || game == null || p.Games.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Contains(game, StringComparer.OrdinalIgnoreCase))
                .Select(p => new PromoItemDto(p.Id,
                    en && !string.IsNullOrWhiteSpace(p.TitleEn) ? p.TitleEn : p.TitleEs,
                    en && !string.IsNullOrWhiteSpace(p.LineEn) ? p.LineEn : p.LineEs,
                    string.IsNullOrWhiteSpace(p.ImageUrl) ? null : p.ImageUrl,
                    p.Weight, Math.Clamp(p.DurationSeconds, 3, 30)))
                .ToList();
            return new PromoCatalogDto(Math.Clamp(snap.EverySeconds, 30, 1800), items);
        }

        // ─── Admin ───────────────────────────────────────────────────────────

        public Task<List<GameOverlayPromo>> ListAllAsync() =>
            _db.GameOverlayPromos.AsNoTracking().OrderBy(p => p.SortOrder).ThenBy(p => p.Id).ToListAsync();

        public async Task<GameOverlayPromoSettings> GetSettingsAsync()
        {
            var s = await _db.GameOverlayPromoSettings.FirstOrDefaultAsync(x => x.Id == 1);
            if (s != null) return s;
            s = new GameOverlayPromoSettings { Id = 1 };
            _db.GameOverlayPromoSettings.Add(s);
            await _db.SaveChangesAsync();
            return s;
        }

        public async Task<GameOverlayPromoSettings> UpdateSettingsAsync(int everySeconds)
        {
            var s = await GetSettingsAsync();
            s.EverySeconds = Math.Clamp(everySeconds, 30, 1800);
            s.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            Invalidate();
            return s;
        }

        public async Task<GameOverlayPromo> UpsertAsync(GameOverlayPromo input)
        {
            var p = input.Id > 0 ? await _db.GameOverlayPromos.FirstOrDefaultAsync(x => x.Id == input.Id) : null;
            if (p == null) { p = new GameOverlayPromo(); _db.GameOverlayPromos.Add(p); }
            p.IsEnabled = input.IsEnabled;
            p.Weight = Math.Clamp(input.Weight, 0, 100);
            p.SortOrder = input.SortOrder;
            p.TitleEs = (input.TitleEs ?? "").Trim();
            p.TitleEn = (input.TitleEn ?? "").Trim();
            p.LineEs = (input.LineEs ?? "").Trim();
            p.LineEn = (input.LineEn ?? "").Trim();
            p.ImageUrl = string.IsNullOrWhiteSpace(input.ImageUrl) ? null : input.ImageUrl.Trim();
            p.DurationSeconds = Math.Clamp(input.DurationSeconds, 3, 30);
            p.Games = string.IsNullOrWhiteSpace(input.Games) ? null : input.Games.Trim().ToLowerInvariant();
            p.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            Invalidate();
            return p;
        }

        public async Task<bool> DeleteAsync(long id)
        {
            var p = await _db.GameOverlayPromos.FirstOrDefaultAsync(x => x.Id == id);
            if (p == null) return false;
            _db.GameOverlayPromos.Remove(p);
            await _db.SaveChangesAsync();
            Invalidate();
            return true;
        }
    }
}
