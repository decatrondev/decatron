using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Decatron.Core.Interfaces;
using Decatron.Core.Settings;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Decatron.Controllers;

/// <summary>
/// Fase A, pieza C: sesion del comprador. JWT de vida corta atado a un tenant (claim "tid") y con alcance "buyer"
/// (TenantMiddleware solo lo deja entrar al panel del comprador). Se entrega por un codigo de canje de 60 s, como el login de Twitch.
/// </summary>
public sealed class BuyerSessions
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromHours(8);

    private readonly JwtSettings _jwt;
    private readonly IMemoryCache _cache;
    public BuyerSessions(IOptions<JwtSettings> jwt, IMemoryCache cache) { _jwt = jwt.Value; _cache = cache; }

    /// <summary>Emite el JWT del comprador y devuelve el codigo de canje (POST /api/auth/exchange).</summary>
    public string IssueExchangeCode(long userId, string login, string? displayName, string email, long tenantId)
    {
        var now = DateTime.UtcNow;
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Name, login),
            new Claim(ClaimTypes.GivenName, displayName ?? login),
            new Claim("AuthProvider", "email"),
            new Claim("TwitchId", ""),
            new Claim("DiscordId", ""),
            new Claim("ProfileImage", ""),
            new Claim("Email", email),
            new Claim(BuyerClaims.Tenant, tenantId.ToString()),
            new Claim(BuyerClaims.Scope, BuyerClaims.BuyerScope),
        };
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.SecretKey));
        var jwt = new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(
            claims: claims, notBefore: now, expires: now.Add(Lifetime), signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)));
        var code = Guid.NewGuid().ToString("N");
        _cache.Set($"auth_exchange:{code}", jwt, TimeSpan.FromSeconds(60));
        return code;
    }
}
