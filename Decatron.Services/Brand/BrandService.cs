using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Core.Models.Brand;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;

namespace Decatron.Services.Brand
{
    /// <summary>
    /// Logos de la marca editables desde /admin/brand (.dev/plans/BRAND_LOGOS_PLAN.md).
    /// El front de todas las vistas pide /api/brand al cargar, así que se cachea en memoria
    /// y se invalida en cada cambio del admin: guardar ya es publicar.
    /// </summary>
    public class BrandService
    {
        private const string CacheKey = "brand-public";
        private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(10);
        public const int MaxConfigBytes = 64 * 1024;

        private readonly DecatronDbContext _db;
        private readonly IMemoryCache _cache;
        private readonly IConfiguration _config;

        public BrandService(DecatronDbContext db, IMemoryCache cache, IConfiguration config)
        {
            _db = db;
            _cache = cache;
            _config = config;
        }

        public string AssetsPath => _config["Brand:AssetsPath"] ?? "/var/www/html/decatron/brand-assets";

        public record AssetDto(long Id, string Name, string Url, int Width, int Height);
        public record BrandDto(List<AssetDto> Assets, Dictionary<string, JsonElement> Slots, DateTime UpdatedAt);

        public async Task<BrandDto> GetPublicAsync()
        {
            if (_cache.TryGetValue(CacheKey, out BrandDto? cached) && cached != null) return cached;
            var dto = await LoadAsync();
            _cache.Set(CacheKey, dto, CacheTtl);
            return dto;
        }

        public Task<BrandDto> GetAdminAsync() => LoadAsync();

        private async Task<BrandDto> LoadAsync()
        {
            var assets = await _db.BrandAssets.AsNoTracking().OrderBy(a => a.Id).ToListAsync();
            var slots = await _db.BrandSlots.AsNoTracking().ToListAsync();
            var dict = new Dictionary<string, JsonElement>();
            foreach (var s in slots)
            {
                try { dict[s.SlotKey] = JsonDocument.Parse(s.Config).RootElement.Clone(); }
                catch (JsonException) { /* fila corrupta: el lugar vuelve a su diseño de código */ }
            }
            var updated = slots.Select(s => s.UpdatedAt)
                .Concat(assets.Select(a => a.CreatedAt))
                .DefaultIfEmpty(DateTime.MinValue).Max();
            return new BrandDto(assets.Select(ToDto).ToList(), dict, updated);
        }

        private static AssetDto ToDto(BrandAsset a) => new(a.Id, a.Name, a.Url, a.Width, a.Height);

        public void Invalidate() => _cache.Remove(CacheKey);

        public async Task<AssetDto> AddAssetAsync(string name, string extension, Stream content, int width, int height)
        {
            Directory.CreateDirectory(AssetsPath);
            // Nombre propio y único: el navegador puede cachearlo para siempre y no hay
            // caracteres raros del archivo original en el filesystem.
            var fileName = $"{Guid.NewGuid():N}{extension}";
            await using (var fs = File.Create(Path.Combine(AssetsPath, fileName)))
                await content.CopyToAsync(fs);

            var asset = new BrandAsset
            {
                Name = string.IsNullOrWhiteSpace(name) ? "Sin nombre" : name.Trim()[..Math.Min(name.Trim().Length, 120)],
                FileName = fileName,
                Url = $"/uploads/brand/{fileName}",
                Width = Math.Max(0, width),
                Height = Math.Max(0, height),
            };
            _db.BrandAssets.Add(asset);
            await _db.SaveChangesAsync();
            Invalidate();
            return ToDto(asset);
        }

        public async Task<AssetDto?> RenameAssetAsync(long id, string name)
        {
            var a = await _db.BrandAssets.FirstOrDefaultAsync(x => x.Id == id);
            if (a == null) return null;
            var n = (name ?? "").Trim();
            a.Name = n.Length == 0 ? a.Name : n[..Math.Min(n.Length, 120)];
            await _db.SaveChangesAsync();
            Invalidate();
            return ToDto(a);
        }

        public async Task<bool> DeleteAssetAsync(long id)
        {
            var a = await _db.BrandAssets.FirstOrDefaultAsync(x => x.Id == id);
            if (a == null) return false;
            _db.BrandAssets.Remove(a);
            await _db.SaveChangesAsync();
            var path = Path.Combine(AssetsPath, Path.GetFileName(a.FileName));
            if (File.Exists(path)) File.Delete(path);
            Invalidate();
            return true;
        }

        public async Task SaveSlotAsync(string key, string json)
        {
            var row = await _db.BrandSlots.FirstOrDefaultAsync(s => s.SlotKey == key);
            if (row == null) { row = new BrandSlot { SlotKey = key }; _db.BrandSlots.Add(row); }
            row.Config = json;
            row.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            Invalidate();
        }

        public async Task<bool> ResetSlotAsync(string key)
        {
            var row = await _db.BrandSlots.FirstOrDefaultAsync(s => s.SlotKey == key);
            if (row == null) return false;
            _db.BrandSlots.Remove(row);
            await _db.SaveChangesAsync();
            Invalidate();
            return true;
        }
    }
}
