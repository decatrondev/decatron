using Decatron.Core.Helpers;
using Decatron.Core.Models;
using Decatron.Core.Settings;
using Decatron.Data;
using Decatron.Discord.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

namespace Decatron.Discord;

[Route("api/auth/discord")]
[ApiController]
public class DiscordAuthController : ControllerBase
{
    private readonly DiscordSettings _discordSettings;
    private readonly JwtSettings _jwtSettings;
    private readonly DecatronDbContext _db;
    private readonly ILogger<DiscordAuthController> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _memoryCache;

    private const string DiscordApiBase = "https://discord.com/api/v10";
    private const string DiscordOAuthScopes = "identify email guilds";

    public DiscordAuthController(
        IOptions<DiscordSettings> discordSettings,
        IOptions<JwtSettings> jwtSettings,
        DecatronDbContext db,
        ILogger<DiscordAuthController> logger,
        IHttpClientFactory httpClientFactory,
        IMemoryCache memoryCache)
    {
        _discordSettings = discordSettings.Value;
        _jwtSettings = jwtSettings.Value;
        _db = db;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _memoryCache = memoryCache;
    }

    /// <summary>
    /// GET /api/auth/discord/login — Redirects to Discord OAuth (for new login)
    /// </summary>
    [HttpGet("login")]
    public IActionResult Login()
    {
        var state = Guid.NewGuid().ToString("N");
        _memoryCache.Set($"discord_auth_state:{state}", "login", TimeSpan.FromMinutes(10));

        var url = $"https://discord.com/api/oauth2/authorize" +
                  $"?client_id={_discordSettings.AppId}" +
                  $"&redirect_uri={Uri.EscapeDataString(_discordSettings.LoginRedirectUri)}" +
                  $"&response_type=code" +
                  $"&scope={Uri.EscapeDataString(DiscordOAuthScopes)}" +
                  $"&state={state}" +
                  $"&prompt=consent";

        _logger.LogInformation("Redirecting to Discord login OAuth");
        return Redirect(url);
    }

    /// <summary>
    /// POST /api/auth/discord/link-start — Start Discord link flow (returns URL to redirect to)
    /// </summary>
    [Authorize]
    [HttpPost("link-start")]
    public IActionResult LinkStart()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var linkCode = Guid.NewGuid().ToString("N");
        _memoryCache.Set($"discord_link_code:{linkCode}", userId, TimeSpan.FromMinutes(5));

        return Ok(new { url = $"/api/auth/discord/link?link_code={linkCode}" });
    }

    /// <summary>
    /// GET /api/auth/discord/link — Link Discord to existing account (uses link_code from MemoryCache)
    /// </summary>
    [HttpGet("link")]
    public IActionResult Link([FromQuery] string? link_code = null, [FromQuery] string? access_token = null)
    {
        // Try link_code first (new flow), then access_token (legacy)
        string? userId = null;
        if (!string.IsNullOrEmpty(link_code))
        {
            var cacheKey = $"discord_link_code:{link_code}";
            if (_memoryCache.TryGetValue(cacheKey, out string? cachedUserId))
            {
                userId = cachedUserId;
                _memoryCache.Remove(cacheKey);
            }
        }
        if (userId == null && !string.IsNullOrEmpty(access_token))
        {
            userId = ValidateTokenAndGetUserId(access_token);
        }
        if (userId == null)
            return Redirect($"{_discordSettings.FrontendUrl}/login?error=Session+expired.+Please+login+again.");

        var state = Guid.NewGuid().ToString("N");
        // Store "link:{userId}" so the callback knows this is a link operation
        _memoryCache.Set($"discord_auth_state:{state}", $"link:{userId}", TimeSpan.FromMinutes(10));

        var url = $"https://discord.com/api/oauth2/authorize" +
                  $"?client_id={_discordSettings.AppId}" +
                  $"&redirect_uri={Uri.EscapeDataString(_discordSettings.LoginRedirectUri)}" +
                  $"&response_type=code" +
                  $"&scope={Uri.EscapeDataString(DiscordOAuthScopes)}" +
                  $"&state={state}" +
                  $"&prompt=consent";

        return Redirect(url);
    }

    /// <summary>
    /// GET /api/auth/discord/callback — Discord OAuth callback
    /// </summary>
    [HttpGet("callback")]
    public async Task<IActionResult> Callback(
        [FromQuery] string? code = null,
        [FromQuery] string? error = null,
        [FromQuery] string? state = null)
    {
        var frontendUrl = _discordSettings.FrontendUrl;

        try
        {
            if (!string.IsNullOrEmpty(error))
            {
                _logger.LogWarning("Discord auth error: {Error}", error);
                return Redirect($"{frontendUrl}/login?error={Uri.EscapeDataString(error)}");
            }

            if (string.IsNullOrEmpty(code))
            {
                return Redirect($"{frontendUrl}/login?error=Authorization+code+not+received");
            }

            // Validate state and determine mode (login vs link)
            var stateKey = $"discord_auth_state:{state}";
            if (string.IsNullOrEmpty(state) || !_memoryCache.TryGetValue(stateKey, out string? stateValue) || stateValue == null)
            {
                _logger.LogWarning("Invalid or expired Discord OAuth state");
                return Redirect($"{frontendUrl}/login?error=Invalid+or+expired+login+session");
            }
            _memoryCache.Remove(stateKey);

            var isLinkMode = stateValue.StartsWith("link:");
            long? linkUserId = isLinkMode ? long.Parse(stateValue.Split(':')[1]) : null;

            // Exchange code for token
            var client = _httpClientFactory.CreateClient();
            var tokenResponse = await client.PostAsync($"{DiscordApiBase}/oauth2/token", new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = _discordSettings.AppId,
                ["client_secret"] = _discordSettings.ClientSecret,
                ["grant_type"] = "authorization_code",
                ["code"] = code,
                ["redirect_uri"] = _discordSettings.LoginRedirectUri
            }));

            if (!tokenResponse.IsSuccessStatusCode)
            {
                var errorBody = await tokenResponse.Content.ReadAsStringAsync();
                _logger.LogError("Discord token exchange failed: {Status} {Body}", tokenResponse.StatusCode, errorBody);
                return Redirect($"{frontendUrl}/login?error=Discord+authentication+failed");
            }

            var tokenJson = await tokenResponse.Content.ReadAsStringAsync();
            var tokenData = JsonSerializer.Deserialize<JsonElement>(tokenJson);
            var accessToken = tokenData.GetProperty("access_token").GetString()!;
            var refreshToken = tokenData.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;
            var expiresIn = tokenData.TryGetProperty("expires_in", out var ei) ? ei.GetInt32() : 604800;

            // Get Discord user info
            client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

            var userResponse = await client.GetAsync($"{DiscordApiBase}/users/@me");
            if (!userResponse.IsSuccessStatusCode)
            {
                _logger.LogError("Failed to fetch Discord user info");
                return Redirect($"{frontendUrl}/login?error=Failed+to+fetch+Discord+user+info");
            }

            var userJson = await userResponse.Content.ReadAsStringAsync();
            var discordUser = JsonSerializer.Deserialize<JsonElement>(userJson);

            var discordId = discordUser.GetProperty("id").GetString()!;
            var username = discordUser.GetProperty("username").GetString()!;
            var globalName = discordUser.TryGetProperty("global_name", out var gn) && gn.ValueKind != JsonValueKind.Null ? gn.GetString() : username;
            var avatar = discordUser.TryGetProperty("avatar", out var av) && av.ValueKind != JsonValueKind.Null ? av.GetString() : null;
            var email = discordUser.TryGetProperty("email", out var em) && em.ValueKind != JsonValueKind.Null ? em.GetString() : null;

            var avatarUrl = avatar != null
                ? $"https://cdn.discordapp.com/avatars/{discordId}/{avatar}.png?size=256"
                : $"https://cdn.discordapp.com/embed/avatars/{(int.Parse(discordId) >> 22) % 6}.png";

            _logger.LogInformation("Discord user authenticated: {Username} ({DiscordId}), mode: {Mode}", username, discordId, isLinkMode ? "link" : "login");

            User user;

            if (isLinkMode && linkUserId.HasValue)
            {
                // === LINK MODE: Add Discord to existing Twitch user ===
                var existingUser = await _db.Users.FirstOrDefaultAsync(u => u.Id == linkUserId.Value);
                if (existingUser == null)
                {
                    return Redirect($"{frontendUrl}/me/account?error=User+not+found");
                }

                // If a Discord-only user exists with this ID, remove it (it's a temp account)
                var conflictUser = await _db.Users.FirstOrDefaultAsync(u => u.DiscordId == discordId && u.Id != linkUserId.Value);
                if (conflictUser != null)
                {
                    if (conflictUser.AuthProvider == "discord" && string.IsNullOrEmpty(conflictUser.TwitchId))
                    {
                        _logger.LogInformation("Removing temp Discord user (ID: {Id}) before linking to user {TargetId}", conflictUser.Id, linkUserId.Value);
                        // Clean up FKs (only free tier typically)
                        var conn = _db.Database.GetDbConnection();
                        if (conn.State != System.Data.ConnectionState.Open)
                            await conn.OpenAsync();
                        using var cmd = conn.CreateCommand();
                        cmd.CommandText = "DELETE FROM user_subscription_tiers WHERE user_id = @id";
                        var p = cmd.CreateParameter(); p.ParameterName = "@id"; p.Value = conflictUser.Id; cmd.Parameters.Add(p);
                        await cmd.ExecuteNonQueryAsync();

                        conflictUser.DiscordId = null;
                        await _db.SaveChangesAsync();
                        _db.Users.Remove(conflictUser);
                        await _db.SaveChangesAsync();
                    }
                    else
                    {
                        _logger.LogWarning("Discord {DiscordId} already linked to user {ConflictId} with Twitch data", discordId, conflictUser.Id);
                        return Redirect($"{frontendUrl}/settings?error=This+Discord+account+is+already+linked+to+another+user");
                    }
                }

                existingUser.DiscordId = discordId;
                existingUser.DiscordUsername = username;
                existingUser.DiscordAvatar = avatarUrl;
                existingUser.DiscordEmail = email;
                existingUser.DiscordAccessToken = accessToken;
                existingUser.DiscordRefreshToken = refreshToken;
                existingUser.DiscordTokenExpiration = DateTime.UtcNow.AddSeconds(expiresIn);
                existingUser.AuthProvider = "both";
                existingUser.UpdatedAt = DateTime.UtcNow;

                await _db.SaveChangesAsync();
                user = existingUser;

                _logger.LogInformation("Discord linked to existing user: {Login} (ID: {Id}), Discord: {DiscordUsername}", user.Login, user.Id, username);

                // Generate new JWT with updated claims
                var jwt = GenerateJwtToken(user);
                var exchangeCode = Guid.NewGuid().ToString("N");
                _memoryCache.Set($"auth_exchange:{exchangeCode}", jwt, TimeSpan.FromSeconds(60));

                return Redirect($"{frontendUrl}/settings?linked=discord&code={exchangeCode}");
            }
            else
            {
                // === LOGIN MODE: Find or create Discord user ===
                user = await _db.Users.FirstOrDefaultAsync(u => u.DiscordId == discordId);

                if (user == null)
                {
                    user = new User
                    {
                        TwitchId = "",
                        Login = $"discord_{discordId}",
                        DisplayName = globalName ?? username,
                        Email = email ?? "",
                        ProfileImageUrl = avatarUrl,
                        OfflineImageUrl = "",
                        BroadcasterType = "",
                        ViewCount = 0,
                        Description = "",
                        AccessToken = "",
                        RefreshToken = "",
                        TokenExpiration = DateTime.UtcNow,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow,
                        IsActive = true,
                        UniqueId = UniqueIdGenerator.Generate(),
                        DiscordId = discordId,
                        DiscordUsername = username,
                        DiscordAvatar = avatarUrl,
                        DiscordEmail = email,
                        DiscordAccessToken = accessToken,
                        DiscordRefreshToken = refreshToken,
                        DiscordTokenExpiration = DateTime.UtcNow.AddSeconds(expiresIn),
                        AuthProvider = "discord"
                    };

                    _db.Users.Add(user);
                    await _db.SaveChangesAsync();
                    await AssignFreeTier(user.Id);

                    _logger.LogInformation("New Discord user created: {Username} (ID: {Id})", username, user.Id);
                }
                else
                {
                    user.DiscordUsername = username;
                    user.DiscordAvatar = avatarUrl;
                    user.DiscordEmail = email;
                    user.DiscordAccessToken = accessToken;
                    user.DiscordRefreshToken = refreshToken;
                    user.DiscordTokenExpiration = DateTime.UtcNow.AddSeconds(expiresIn);
                    user.UpdatedAt = DateTime.UtcNow;

                    await _db.SaveChangesAsync();
                    _logger.LogInformation("Discord user updated: {Username} (ID: {Id})", username, user.Id);
                }

                var jwt = GenerateJwtToken(user);
                var exchangeCode = Guid.NewGuid().ToString("N");
                _memoryCache.Set($"auth_exchange:{exchangeCode}", jwt, TimeSpan.FromSeconds(60));

                return Redirect($"{frontendUrl}/login?code={exchangeCode}&provider=discord");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during Discord authentication callback");
            return Redirect($"{frontendUrl}/login?error={Uri.EscapeDataString("Discord authentication error")}");
        }
    }

    /// <summary>
    /// POST /api/auth/discord/exchange — Exchange code for JWT (same pattern as Twitch)
    /// </summary>
    [HttpPost("exchange")]
    public IActionResult Exchange([FromBody] ExchangeCodeRequest request)
    {
        if (string.IsNullOrEmpty(request?.Code))
        {
            return BadRequest(new { error = "Code is required" });
        }

        var cacheKey = $"auth_exchange:{request.Code}";
        if (_memoryCache.TryGetValue(cacheKey, out string? jwt) && jwt != null)
        {
            _memoryCache.Remove(cacheKey);
            return Ok(new { token = jwt });
        }

        return Unauthorized(new { error = "Invalid or expired code" });
    }

    /// <summary>
    /// GET /api/auth/discord/me — Get current Discord user info
    /// </summary>
    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!long.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return NotFound();

        return Ok(new
        {
            uniqueId = user.UniqueId,
            displayName = user.DisplayName,
            discordUsername = user.DiscordUsername,
            discordAvatar = user.DiscordAvatar,
            discordId = user.DiscordId,
            authProvider = user.AuthProvider,
            createdAt = user.CreatedAt,
            updatedAt = user.UpdatedAt
        });
    }

    /// <summary>
    /// POST /api/auth/discord/unlink — Remove Discord from linked account
    /// </summary>
    [Authorize]
    [HttpPost("unlink")]
    public async Task<IActionResult> UnlinkDiscord()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!long.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var authProviderClaim = User.FindFirst("AuthProvider")?.Value ?? "twitch";
        if (authProviderClaim == "discord")
            return BadRequest(new { error = "No puedes desvincular la cuenta con la que iniciaste sesion" });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return NotFound();
        if (string.IsNullOrEmpty(user.DiscordId))
            return BadRequest(new { error = "Discord no esta vinculado" });

        user.DiscordId = null;
        user.DiscordUsername = null;
        user.DiscordAvatar = null;
        user.DiscordEmail = null;
        user.DiscordAccessToken = null;
        user.DiscordRefreshToken = null;
        user.DiscordTokenExpiration = null;
        user.AuthProvider = "twitch";
        user.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        _logger.LogInformation("Discord unlinked from user {UserId}", userId);

        // Return new JWT with updated claims
        var jwt = GenerateJwtToken(user);
        return Ok(new { success = true, token = jwt });
    }

    public class ExchangeCodeRequest
    {
        public string? Code { get; set; }
    }

    // ============================================
    // HELPERS
    // ============================================

    private string GenerateJwtToken(User user)
    {
        var now = DateTime.UtcNow;
        var expires = now.AddMinutes(_jwtSettings.ExpiryMinutes);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.DiscordUsername ?? user.Login),
            new(ClaimTypes.GivenName, user.DisplayName ?? user.DiscordUsername ?? user.Login),
            new("AuthProvider", user.AuthProvider),
            new("TwitchId", user.TwitchId ?? ""),
            new("DiscordId", user.DiscordId ?? ""),
            new("ProfileImage", user.DiscordAvatar ?? user.ProfileImageUrl ?? ""),
            new("Email", user.DiscordEmail ?? user.Email ?? "")
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.SecretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            claims: claims,
            notBefore: now,
            expires: expires,
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private string? ValidateTokenAndGetUserId(string? token)
    {
        if (string.IsNullOrEmpty(token)) return null;

        try
        {
            var handler = new JwtSecurityTokenHandler();
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.SecretKey));
            var validationParams = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = key,
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromMinutes(5)
            };

            var principal = handler.ValidateToken(token, validationParams, out _);
            return principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        }
        catch
        {
            return null;
        }
    }

    private async Task AssignFreeTier(long userId)
    {
        try
        {
            var conn = _db.Database.GetDbConnection();
            if (conn.State != System.Data.ConnectionState.Open)
                await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                INSERT INTO user_subscription_tiers (user_id, tier, tier_started_at, source, notes)
                VALUES (@userId, 'free', NOW(), 'auto_register', 'Asignado automáticamente al registrarse via Discord')
                ON CONFLICT DO NOTHING";

            var param = cmd.CreateParameter();
            param.ParameterName = "@userId";
            param.Value = userId;
            cmd.Parameters.Add(param);

            await cmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning free tier to Discord user {UserId}", userId);
        }
    }
}
