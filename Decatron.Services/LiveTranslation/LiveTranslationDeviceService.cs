using System.Security.Cryptography;
using System.Text;
using Decatron.Core.Models.LiveTranslation;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Decatron.Services.LiveTranslation
{
    /// <summary>
    /// Vinculación de la app de escritorio. El dashboard genera un código corto de un solo
    /// uso; la app lo canjea por un token largo que guarda en disco y usa para abrir el
    /// WebSocket de ingesta. Así el token del dashboard (JWT) nunca sale del navegador.
    /// </summary>
    public class LiveTranslationDeviceService
    {
        private readonly DecatronDbContext _db;
        private readonly IMemoryCache _cache;
        private readonly LiveTranslationOptions _opts;

        private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I

        public LiveTranslationDeviceService(DecatronDbContext db, IMemoryCache cache, IOptions<LiveTranslationOptions> opts)
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
        public async Task<(LiveTranslationDevice device, string token)?> ClaimAsync(string code, string deviceName)
        {
            code = (code ?? "").Trim().ToUpperInvariant().Replace("-", "");
            if (!_cache.TryGetValue(CacheKey(code), out long userId)) return null;
            _cache.Remove(CacheKey(code));

            var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
                .Replace('+', '-').Replace('/', '_').TrimEnd('=');
            var device = new LiveTranslationDevice
            {
                UserId = userId,
                Name = string.IsNullOrWhiteSpace(deviceName) ? "App de escritorio" : deviceName.Trim()[..Math.Min(80, deviceName.Trim().Length)],
                TokenHash = Hash(token),
            };
            _db.LiveTranslationDevices.Add(device);
            await _db.SaveChangesAsync();
            return (device, token);
        }

        public async Task<LiveTranslationDevice?> ValidateTokenAsync(string? token)
        {
            if (string.IsNullOrWhiteSpace(token) || token.Length > 200) return null;
            var hash = Hash(token);
            var device = await _db.LiveTranslationDevices.FirstOrDefaultAsync(d => d.TokenHash == hash && d.RevokedAt == null);
            if (device == null) return null;
            device.LastSeenAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return device;
        }

        public Task<List<LiveTranslationDevice>> ListAsync(long userId) =>
            _db.LiveTranslationDevices.AsNoTracking()
                .Where(d => d.UserId == userId && d.RevokedAt == null)
                .OrderByDescending(d => d.CreatedAt).ToListAsync();

        public async Task<bool> RevokeAsync(long userId, long deviceId)
        {
            var d = await _db.LiveTranslationDevices.FirstOrDefaultAsync(x => x.Id == deviceId && x.UserId == userId && x.RevokedAt == null);
            if (d == null) return false;
            d.RevokedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return true;
        }

        private static string CacheKey(string code) => "lt:link:" + code;

        private static string Hash(string token) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
    }
}
