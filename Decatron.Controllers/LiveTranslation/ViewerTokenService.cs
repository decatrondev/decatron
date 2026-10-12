using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Decatron.Core.Models.LiveTranslation;
using Decatron.Core.Settings;
using Decatron.Data;
using Decatron.Hubs;
using Decatron.Services.Accounts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Decatron.Services.LiveTranslation
{
    /// <summary>
    /// Token de espectador de la traducción en vivo: identifica a una persona ante el hub de traducción y NADA más. Está firmado con
    /// una clave DERIVADA distinta a la de la sesión del panel (la validación normal de sesiones no comprueba emisor ni audiencia, así
    /// que con la misma clave un token de espectador serviría como sesión completa del dashboard). Dura 30 días y se invalida
    /// subiendo la «época» de su dueño. Plan: .dev/plans/TRADUCCION_ACCESO_PLAN.md, Fase 2.
    /// </summary>
    public sealed class ViewerTokenService : IViewerIdentityResolver
    {
        public const string Audience = "decatron-viewer";
        public const string Issuer = "decatron";
        public static readonly TimeSpan Lifetime = TimeSpan.FromDays(30);
        private static readonly TimeSpan EpochTtl = TimeSpan.FromSeconds(60);

        private readonly SymmetricSecurityKey _key;
        private readonly IServiceScopeFactory _scopes;
        private readonly AccountChannelResolver _accounts;
        private readonly IMemoryCache _cache;
        private readonly ILogger<ViewerTokenService> _logger;

        public ViewerTokenService(IOptions<JwtSettings> jwt, IServiceScopeFactory scopes, AccountChannelResolver accounts, IMemoryCache cache, ILogger<ViewerTokenService> logger)
        {
            _key = DeriveKey(jwt.Value.SecretKey);
            _scopes = scopes;
            _accounts = accounts;
            _cache = cache;
            _logger = logger;
        }

        /// <summary>La clave de los tokens de espectador: SHA-256(secreto + «:viewer-v1»). Distinta a la de las sesiones.</summary>
        public static SymmetricSecurityKey DeriveKey(string secret) =>
            new(SHA256.HashData(Encoding.UTF8.GetBytes(secret + ":viewer-v1")));

        public string Create(ViewerIdentity who, int epoch, DateTime? now = null)
        {
            var t = now ?? DateTime.UtcNow;
            var claims = new List<Claim>
            {
                new("sub", who.UserId.ToString()),
                new("login", who.Login),
                new("ep", epoch.ToString()),
                new("typ", "viewer"),
            };
            if (!string.IsNullOrEmpty(who.TwitchId)) claims.Add(new Claim("tw", who.TwitchId!));
            var token = new JwtSecurityToken(Issuer, Audience, claims, notBefore: t, expires: t.Add(Lifetime),
                signingCredentials: new SigningCredentials(_key, SecurityAlgorithms.HmacSha256));
            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        /// <summary>¿Parece un token de espectador? Mira la audiencia SIN verificar la firma: solo sirve para no confundirlo con una sesión normal.</summary>
        public static bool LooksLikeViewerToken(string? token)
        {
            if (string.IsNullOrEmpty(token)) return false;
            var parts = token.Split('.');
            if (parts.Length != 3) return false;
            try
            {
                var payload = parts[1].Replace('-', '+').Replace('_', '/');
                payload = payload.PadRight(payload.Length + (4 - payload.Length % 4) % 4, '=');
                return Encoding.UTF8.GetString(Convert.FromBase64String(payload)).Contains("\"" + Audience + "\"", StringComparison.Ordinal);
            }
            catch { return false; }
        }

        /// <summary>Valida firma, vencimiento, audiencia y época. null si algo falla.</summary>
        public async Task<ViewerIdentity?> ValidateAsync(string token, int clockSkewSeconds = 60)
        {
            try
            {
                // MapInboundClaims = false: sin eso la librería renombra «sub» a otro tipo de claim y no se encontraría el id
                var p = new JwtSecurityTokenHandler { MapInboundClaims = false }.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = _key,
                    ValidateIssuer = true,
                    ValidIssuer = Issuer,
                    ValidateAudience = true,
                    ValidAudience = Audience,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(clockSkewSeconds),
                    ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 },
                }, out _);
                if (p.FindFirst("typ")?.Value != "viewer") return null;
                if (!long.TryParse(p.FindFirst("sub")?.Value, out var userId)) return null;
                if (!int.TryParse(p.FindFirst("ep")?.Value, out var epoch)) return null;
                if (epoch != await GetEpochAsync(userId)) return null; // revocado
                return new ViewerIdentity(userId, p.FindFirst("login")?.Value ?? "", p.FindFirst("tw")?.Value);
            }
            catch (Exception ex) when (ex is SecurityTokenException or ArgumentException or FormatException)
            {
                return null;
            }
        }

        public async Task<int> GetEpochAsync(long userId)
        {
            var key = "viewer-epoch:" + userId;
            if (_cache.TryGetValue(key, out int hit)) return hit;
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var epoch = await db.ViewerTokenEpochs.AsNoTracking().Where(e => e.UserId == userId).Select(e => e.Epoch).FirstOrDefaultAsync();
            _cache.Set(key, epoch, EpochTtl);
            return epoch;
        }

        /// <summary>Cierra la sesión de la extensión en todos los navegadores de la persona: sube la época de todas las filas de su cuenta.</summary>
        public async Task RevokeAllAsync(long userId)
        {
            var account = await _accounts.ResolveByUserIdAsync(userId);
            var ids = account?.Members.Select(m => m.UserId).Append(userId).Distinct().ToArray() ?? new[] { userId };
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            foreach (var id in ids)
            {
                var row = await db.ViewerTokenEpochs.FirstOrDefaultAsync(e => e.UserId == id);
                if (row == null) db.ViewerTokenEpochs.Add(new ViewerTokenEpoch { UserId = id, Epoch = 1 });
                else { row.Epoch++; row.UpdatedAt = DateTime.UtcNow; }
                _cache.Remove("viewer-epoch:" + id);
            }
            await db.SaveChangesAsync();
            _logger.LogInformation("[LiveTranslation] Sesiones de espectador revocadas para la cuenta de {UserId}", userId);
        }

        /// <summary>La identidad que se escribe en el token: el login de Twitch de la cuenta (si lo tiene) y su id; si no, el de la fila.</summary>
        public async Task<ViewerIdentity?> IdentityOfAsync(long userId)
        {
            var account = await _accounts.ResolveByUserIdAsync(userId);
            if (account == null) return null;
            var twitch = account.Members.FirstOrDefault(m => !string.IsNullOrEmpty(m.TwitchId));
            var me = account.Members.FirstOrDefault(m => m.UserId == userId) ?? account.Principal;
            return new ViewerIdentity(userId, (twitch?.Login ?? me.Login), twitch?.TwitchId);
        }

        // ── IViewerIdentityResolver (lo usa el hub)
        public async Task<ViewerIdentity?> ResolveAsync(string? accessToken, ClaimsPrincipal? user)
        {
            // La página del Multi-view manda la sesión normal: ya viene validada por la autenticación del servidor.
            if (user?.Identity?.IsAuthenticated == true && long.TryParse(user.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var uid))
                return await IdentityOfAsync(uid);
            // La extensión manda su token de espectador
            if (!string.IsNullOrEmpty(accessToken) && LooksLikeViewerToken(accessToken))
                return await ValidateAsync(accessToken);
            return null;
        }
    }
}
