using System.Security.Cryptography;
using System.Text;
using Decatron.Core.Models.Desktop;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Decatron.Services.Desktop
{
    /// <summary>
    /// Vinculación de Decatron Desktop. El dashboard genera un código corto de un solo
    /// uso; la app lo canjea por un token largo que guarda en disco y usa para abrir el
    /// WebSocket de escritorio. Así el JWT del dashboard nunca sale del navegador.
    /// </summary>
    public class DesktopDeviceService
    {
        private readonly DecatronDbContext _db;
        private readonly IMemoryCache _cache;
        private readonly DesktopOptions _opts;

        private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I

        public DesktopDeviceService(DecatronDbContext db, IMemoryCache cache, IOptions<DesktopOptions> opts)
        {
            _db = db; _cache = cache; _opts = opts.Value;
        }

        public (string code, DateTime expiresAt) CreateLinkCode(long userId)
        {
            var code = new string(Enumerable.Range(0, 8).Select(_ => Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)]).ToArray());
            var expires = DateTime.UtcNow.AddMinutes(_opts.LinkCodeMinutes);
            _cache.Set(CacheKey(code), userId, expires);
            return (code, expires);
        }

        /// <summary>Canjea el código. Devuelve el token en claro una sola vez.</summary>
        public async Task<(DesktopDevice device, string token)?> ClaimAsync(string code, string deviceName, string? appVersion, string? platform)
        {
            code = (code ?? "").Trim().ToUpperInvariant().Replace("-", "");
            if (!_cache.TryGetValue(CacheKey(code), out long userId)) return null;
            _cache.Remove(CacheKey(code));

            var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
                .Replace('+', '-').Replace('/', '_').TrimEnd('=');
            var name = string.IsNullOrWhiteSpace(deviceName) ? "Decatron Desktop" : deviceName.Trim();
            var device = new DesktopDevice
            {
                UserId = userId,
                Name = name[..Math.Min(80, name.Length)],
                TokenHash = Hash(token),
                AppVersion = Trunc(appVersion, 30),
                Platform = Trunc(platform, 20),
            };
            _db.DesktopDevices.Add(device);
            await _db.SaveChangesAsync();
            return (device, token);
        }

        public async Task<DesktopDevice?> ValidateTokenAsync(string? token, string? appVersion = null, string? platform = null)
        {
            if (string.IsNullOrWhiteSpace(token) || token.Length > 200) return null;
            var hash = Hash(token);
            var device = await _db.DesktopDevices.FirstOrDefaultAsync(d => d.TokenHash == hash && d.RevokedAt == null);
            if (device == null) return null;
            device.LastSeenAt = DateTime.UtcNow;
            if (appVersion != null) device.AppVersion = Trunc(appVersion, 30);
            if (platform != null) device.Platform = Trunc(platform, 20);
            await _db.SaveChangesAsync();
            return device;
        }

        public Task<List<DesktopDevice>> ListAsync(long userId) =>
            _db.DesktopDevices.AsNoTracking()
                .Where(d => d.UserId == userId && d.RevokedAt == null)
                .OrderByDescending(d => d.CreatedAt).ToListAsync();

        public async Task<bool> RevokeAsync(long userId, long deviceId)
        {
            var d = await _db.DesktopDevices.FirstOrDefaultAsync(x => x.Id == deviceId && x.UserId == userId && x.RevokedAt == null);
            if (d == null) return false;
            d.RevokedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return true;
        }

        private static string CacheKey(string code) => "desktop:link:" + code;
        private static string? Trunc(string? s, int n) => string.IsNullOrWhiteSpace(s) ? null : s.Trim()[..Math.Min(n, s.Trim().Length)];
        private static string Hash(string token) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
    }
}
