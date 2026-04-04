using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Core.Settings;
using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Decatron.Controllers
{
    [Route("api/auth")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly TwitchBotService _botService;
        private readonly EventSubService _eventSubService;
        private readonly ILogger<AuthController> _logger;
        private readonly JwtSettings _jwtSettings;
        private readonly TwitchSettings _twitchSettings;
        private readonly Microsoft.Extensions.Configuration.IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IMemoryCache _memoryCache;
        private readonly DecatronDbContext _dbContext;

        public AuthController(
            IAuthService authService,
            TwitchBotService botService,
            EventSubService eventSubService,
            ILogger<AuthController> logger,
            IOptions<JwtSettings> jwtSettings,
            IOptions<TwitchSettings> twitchSettings,
            Microsoft.Extensions.Configuration.IConfiguration configuration,
            IHttpClientFactory httpClientFactory,
            IMemoryCache memoryCache,
            DecatronDbContext dbContext)
        {
            _authService = authService;
            _botService = botService;
            _eventSubService = eventSubService;
            _logger = logger;
            _jwtSettings = jwtSettings.Value;
            _twitchSettings = twitchSettings.Value;
            _configuration = configuration;
            _httpClientFactory = httpClientFactory;
            _memoryCache = memoryCache;
            _dbContext = dbContext;
        }

        [HttpGet("login")]
        public IActionResult Login([FromQuery] string? redirect = null)
        {
            try
            {
                var loginUrl = _authService.GetLoginUrl(redirect);
                _logger.LogInformation("Redirecting to Twitch login (redirect: {Redirect})", redirect ?? "none");
                return Redirect(loginUrl);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during login");
                return Redirect($"{_twitchSettings.FrontendUrl}/login?error={Uri.EscapeDataString("Error initiating login")}");
            }
        }

        /// <summary>
        /// POST /api/auth/link-twitch-start — Start Twitch link flow (returns URL)
        /// </summary>
        [Authorize]
        [HttpPost("link-twitch-start")]
        public IActionResult LinkTwitchStart()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var loginUrl = _authService.GetLoginUrl($"link-twitch:{userId}");
            return Ok(new { url = loginUrl });
        }

        /// <summary>
        /// GET /api/auth/link-twitch — Legacy redirect (kept for compatibility)
        /// </summary>
        [HttpGet("link-twitch")]
        public IActionResult LinkTwitch([FromQuery] string? access_token = null)
        {
            var userId = ValidateTokenAndGetUserId(access_token);
            if (userId == null)
                return Redirect($"{_twitchSettings.FrontendUrl}/login?error=Session+expired");

            var loginUrl = _authService.GetLoginUrl($"link-twitch:{userId}");
            return Redirect(loginUrl);
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
                return principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            }
            catch { return null; }
        }

        [HttpGet("callback")]
        public async Task<IActionResult> Callback(
            [FromQuery] string? code = null,
            [FromQuery] string? error = null,
            [FromQuery] string? state = null)
        {
            try
            {
                _logger.LogInformation("Auth callback received - Error: {Error}", error);

                if (!string.IsNullOrEmpty(error))
                {
                    _logger.LogWarning($"Authentication error: {error}");
                    return Redirect($"{_twitchSettings.FrontendUrl}/login?error={Uri.EscapeDataString(error)}");
                }

                if (string.IsNullOrEmpty(code))
                {
                    _logger.LogWarning("Authorization code not received");
                    return Redirect($"{_twitchSettings.FrontendUrl}/login?error=Authorization+code+not+received");
                }

                // Exchange code for token
                _logger.LogInformation("Exchanging code for token...");
                var tokenResponse = await _authService.ExchangeCodeForTokenAsync(code);

                // Get user info
                _logger.LogInformation("Fetching user information...");
                var twitchUser = await _authService.GetUserInfoAsync(tokenResponse.AccessToken);

                // Check if this is a link-twitch operation BEFORE creating/updating user
                string? linkUserIdEarly = null;
                if (!string.IsNullOrEmpty(state))
                {
                    var (isValidEarly, redirectEarly) = AuthService.ValidateOAuthState(state, _jwtSettings.SecretKey);
                    if (isValidEarly && !string.IsNullOrEmpty(redirectEarly) && redirectEarly.StartsWith("link-twitch:"))
                    {
                        linkUserIdEarly = redirectEarly.Split(':')[1];
                    }
                }

                // If linking Twitch to Discord user
                if (linkUserIdEarly != null && long.TryParse(linkUserIdEarly, out var discordUserId))
                {
                    var discordUser = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == discordUserId);
                    if (discordUser == null)
                        return Redirect($"{_twitchSettings.FrontendUrl}/settings?error=User+not+found");

                    // Check if a Twitch user already exists with this TwitchId
                    var existingTwitch = await _dbContext.Users.FirstOrDefaultAsync(u => u.TwitchId == twitchUser.Id && u.Id != discordUserId);

                    User finalUser;

                    if (existingTwitch != null)
                    {
                        // MERGE via raw SQL: order matters for unique constraints
                        // 1. Clear discord_id from temp user
                        // 2. Copy Discord data to Twitch user
                        // 3. Delete temp user
                        _logger.LogInformation("Merging Discord user (ID: {DiscordId}) into Twitch user (ID: {TwitchUserId})", discordUserId, existingTwitch.Id);

                        var discordId = discordUser.DiscordId;
                        var discordUname = discordUser.DiscordUsername;
                        var discordAvt = discordUser.DiscordAvatar;
                        var discordEml = discordUser.DiscordEmail;
                        var discordAT = discordUser.DiscordAccessToken;
                        var discordRT = discordUser.DiscordRefreshToken;
                        var discordTE = discordUser.DiscordTokenExpiration;

                        // Detach both entities so EF doesn't interfere
                        _dbContext.Entry(discordUser).State = Microsoft.EntityFrameworkCore.EntityState.Detached;
                        _dbContext.Entry(existingTwitch).State = Microsoft.EntityFrameworkCore.EntityState.Detached;

                        var conn = _dbContext.Database.GetDbConnection();
                        if (conn.State != System.Data.ConnectionState.Open)
                            await conn.OpenAsync();

                        void AddP(System.Data.Common.DbCommand c, string n, object? v) {
                            var p = c.CreateParameter(); p.ParameterName = n; p.Value = v ?? DBNull.Value; c.Parameters.Add(p);
                        }

                        // Step 1: Clear unique constraints on temp Discord user
                        using (var cmd = conn.CreateCommand()) {
                            cmd.CommandText = "UPDATE users SET discord_id = NULL, login = CONCAT('merged_', id) WHERE id = @id";
                            AddP(cmd, "@id", discordUserId);
                            await cmd.ExecuteNonQueryAsync();
                        }

                        // Step 2: Delete temp user's tier + delete temp user
                        using (var cmd = conn.CreateCommand()) {
                            cmd.CommandText = "DELETE FROM user_subscription_tiers WHERE user_id = @id";
                            AddP(cmd, "@id", discordUserId);
                            await cmd.ExecuteNonQueryAsync();
                        }
                        using (var cmd = conn.CreateCommand()) {
                            cmd.CommandText = "DELETE FROM users WHERE id = @id";
                            AddP(cmd, "@id", discordUserId);
                            await cmd.ExecuteNonQueryAsync();
                        }

                        // Step 3: Add Discord data to existing Twitch user
                        using (var cmd = conn.CreateCommand()) {
                            cmd.CommandText = @"UPDATE users SET
                                discord_id = @discordId, discord_username = @discordUsername,
                                discord_avatar = @discordAvatar, discord_email = @discordEmail,
                                discord_access_token = @discordAT, discord_refresh_token = @discordRT,
                                discord_token_expiration = @discordTE,
                                access_token = @accessToken, refresh_token = @refreshToken,
                                token_expiration = @tokenExp,
                                auth_provider = 'both', updated_at = NOW()
                                WHERE id = @userId";
                            AddP(cmd, "@discordId", discordId);
                            AddP(cmd, "@discordUsername", discordUname);
                            AddP(cmd, "@discordAvatar", discordAvt);
                            AddP(cmd, "@discordEmail", discordEml);
                            AddP(cmd, "@discordAT", discordAT);
                            AddP(cmd, "@discordRT", discordRT);
                            AddP(cmd, "@discordTE", discordTE);
                            AddP(cmd, "@accessToken", tokenResponse.AccessToken);
                            AddP(cmd, "@refreshToken", tokenResponse.RefreshToken);
                            AddP(cmd, "@tokenExp", DateTime.UtcNow.AddSeconds(tokenResponse.ExpiresIn));
                            AddP(cmd, "@userId", existingTwitch.Id);
                            await cmd.ExecuteNonQueryAsync();
                        }

                        // Reload from DB
                        finalUser = await _dbContext.Users.FirstAsync(u => u.Id == existingTwitch.Id);
                    }
                    else
                    {
                        // NO existing Twitch user — just add Twitch data to Discord user
                        discordUser.TwitchId = twitchUser.Id;
                        discordUser.Login = twitchUser.Login;
                        discordUser.DisplayName = twitchUser.DisplayName ?? discordUser.DisplayName;
                        discordUser.Email = twitchUser.Email ?? discordUser.Email;
                        discordUser.ProfileImageUrl = twitchUser.ProfileImageUrl ?? discordUser.ProfileImageUrl;
                        discordUser.OfflineImageUrl = twitchUser.OfflineImageUrl ?? "";
                        discordUser.BroadcasterType = twitchUser.BroadcasterType ?? "";
                        discordUser.AccessToken = tokenResponse.AccessToken;
                        discordUser.RefreshToken = tokenResponse.RefreshToken;
                        discordUser.TokenExpiration = DateTime.UtcNow.AddSeconds(tokenResponse.ExpiresIn);
                        discordUser.AuthProvider = "both";
                        discordUser.UpdatedAt = DateTime.UtcNow;
                        try
                        {
                            await _dbContext.SaveChangesAsync();
                        }
                        catch (Exception ex)
                        {
                            var innerMsg = ex.InnerException?.Message ?? ex.Message;
                            System.IO.File.AppendAllText("/tmp/discord_debug.log", $"[{DateTime.UtcNow}] SAVE ERROR 4 (add twitch to discord): {innerMsg}\n");
                            return Redirect($"{_twitchSettings.FrontendUrl}/settings?error={Uri.EscapeDataString(innerMsg)}");
                        }

                        finalUser = discordUser;
                    }

                    _logger.LogInformation("Twitch linked successfully. Final user: {Login} (ID: {Id})", finalUser.Login, finalUser.Id);

                    if (_botService.IsConnected)
                        _botService.JoinChannel(finalUser.Login);

                    var linkJwt = GenerateJwtToken(finalUser);
                    var linkCode = Guid.NewGuid().ToString("N");
                    _memoryCache.Set($"auth_exchange:{linkCode}", linkJwt, TimeSpan.FromSeconds(60));

                    return Redirect($"{_twitchSettings.FrontendUrl}/settings?linked=twitch&code={linkCode}");
                }

                // Normal login flow
                var acceptLanguage = Request.Headers["Accept-Language"].ToString();
                _logger.LogInformation("Authenticating user: {Login}", twitchUser.Login);
                var user = await _authService.AuthenticateUserAsync(twitchUser, tokenResponse, acceptLanguage);

                // Generate JWT
                var jwt = GenerateJwtToken(user);

                // Connect bot to channel
                _logger.LogInformation($"Connecting bot to channel: {user.Login}");
                if (_botService.IsConnected)
                {
                    _botService.JoinChannel(user.Login);
                }

                // Registrar suscripciones EventSub (no bloqueante)
                if (!string.IsNullOrEmpty(user.TwitchId))
                {
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            _logger.LogInformation($"🔔 Verificando suscripciones EventSub para {user.Login}");

                            // 1. Suscripción a channel.chat.message
                            var chatResult = await _eventSubService.EnsureSubscriptionAsync(user.TwitchId);
                            if (chatResult.Success)
                            {
                                if (chatResult.Message.Contains("ya existe"))
                                {
                                    _logger.LogInformation($"✅ {user.Login}: Suscripción Chat ya existía");
                                }
                                else
                                {
                                    _logger.LogInformation($"🆕 {user.Login}: Nueva suscripción Chat creada");
                                }
                            }
                            else
                            {
                                _logger.LogWarning($"⚠️ {user.Login}: No se pudo crear suscripción Chat - {chatResult.Message}");
                            }

                            // 2. Suscripción a channel_points_custom_reward_redemption.add
                            var channelPointsResult = await _eventSubService.EnsureChannelPointsSubscriptionAsync(user.TwitchId);
                            if (channelPointsResult.Success)
                            {
                                if (channelPointsResult.Message.Contains("ya existe"))
                                {
                                    _logger.LogInformation($"✅ {user.Login}: Suscripción Channel Points ya existía");
                                }
                                else
                                {
                                    _logger.LogInformation($"🆕 {user.Login}: Nueva suscripción Channel Points creada");
                                }
                            }
                            else
                            {
                                _logger.LogWarning($"⚠️ {user.Login}: No se pudo crear suscripción Channel Points - {channelPointsResult.Message}");
                            }

                            // 3. Suscripción a channel.follow
                            var followsResult = await _eventSubService.EnsureFollowsSubscriptionAsync(user.TwitchId);
                            if (followsResult.Success)
                            {
                                if (followsResult.Message.Contains("ya existe"))
                                {
                                    _logger.LogInformation($"✅ {user.Login}: Suscripción Follows ya existía");
                                }
                                else
                                {
                                    _logger.LogInformation($"🆕 {user.Login}: Nueva suscripción Follows creada");
                                }
                            }
                            else
                            {
                                _logger.LogWarning($"⚠️ {user.Login}: No se pudo crear suscripción Follows - {followsResult.Message}");
                            }

                            // 4. Suscripción a channel.cheer (Bits) - TIMER EVENT
                            var cheerResult = await _eventSubService.EnsureCheerSubscriptionAsync(user.TwitchId);
                            if (cheerResult.Success)
                            {
                                _logger.LogInformation(cheerResult.Message.Contains("ya existe")
                                    ? $"✅ {user.Login}: Suscripción Bits ya existía"
                                    : $"🆕 {user.Login}: Nueva suscripción Bits creada");
                            }
                            else
                            {
                                _logger.LogWarning($"⚠️ {user.Login}: No se pudo crear suscripción Bits - {cheerResult.Message}");
                            }

                            // 5. Suscripción a channel.subscribe (Subs) - TIMER EVENT
                            var subscribeResult = await _eventSubService.EnsureSubscriptionsSubscriptionAsync(user.TwitchId);
                            if (subscribeResult.Success)
                            {
                                _logger.LogInformation(subscribeResult.Message.Contains("ya existe")
                                    ? $"✅ {user.Login}: Suscripción Subs ya existía"
                                    : $"🆕 {user.Login}: Nueva suscripción Subs creada");
                            }
                            else
                            {
                                _logger.LogWarning($"⚠️ {user.Login}: No se pudo crear suscripción Subs - {subscribeResult.Message}");
                            }

                            // 6. Suscripción a channel.subscription.gift (Gift Subs) - TIMER EVENT
                            var giftSubResult = await _eventSubService.EnsureGiftSubsSubscriptionAsync(user.TwitchId);
                            if (giftSubResult.Success)
                            {
                                _logger.LogInformation(giftSubResult.Message.Contains("ya existe")
                                    ? $"✅ {user.Login}: Suscripción Gift Subs ya existía"
                                    : $"🆕 {user.Login}: Nueva suscripción Gift Subs creada");
                            }
                            else
                            {
                                _logger.LogWarning($"⚠️ {user.Login}: No se pudo crear suscripción Gift Subs - {giftSubResult.Message}");
                            }

                            // 7. Suscripción a channel.raid (Raids) - TIMER EVENT
                            var raidResult = await _eventSubService.EnsureRaidSubscriptionAsync(user.TwitchId);
                            if (raidResult.Success)
                            {
                                _logger.LogInformation(raidResult.Message.Contains("ya existe")
                                    ? $"✅ {user.Login}: Suscripción Raids ya existía"
                                    : $"🆕 {user.Login}: Nueva suscripción Raids creada");
                            }
                            else
                            {
                                _logger.LogWarning($"⚠️ {user.Login}: No se pudo crear suscripción Raids - {raidResult.Message}");
                            }

                            // 8. Suscripción a channel.hype_train.begin (Hype Train) - TIMER EVENT
                            var hypeTrainResult = await _eventSubService.EnsureHypeTrainSubscriptionAsync(user.TwitchId);
                            if (hypeTrainResult.Success)
                            {
                                _logger.LogInformation(hypeTrainResult.Message.Contains("ya existe")
                                    ? $"✅ {user.Login}: Suscripción Hype Train ya existía"
                                    : $"🆕 {user.Login}: Nueva suscripción Hype Train creada");
                            }
                            else
                            {
                                _logger.LogWarning($"⚠️ {user.Login}: No se pudo crear suscripción Hype Train - {hypeTrainResult.Message}");
                            }

                            _logger.LogInformation($"✅ {user.Login}: Verificación de suscripciones EventSub completada (8 eventos)");
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, $"❌ Error registrando suscripciones EventSub para {user.Login}");
                        }
                    });
                }

                // Validate HMAC-signed state and extract redirect
                string redirectPath = "/dashboard";
                if (!string.IsNullOrEmpty(state))
                {
                    var (isValid, redirect) = AuthService.ValidateOAuthState(state, _jwtSettings.SecretKey);
                    if (!isValid)
                    {
                        _logger.LogWarning("Invalid or expired OAuth state parameter");
                        return Redirect($"{_twitchSettings.FrontendUrl}/login?error={Uri.EscapeDataString("Invalid or expired login session. Please try again.")}");
                    }
                    if (!string.IsNullOrEmpty(redirect) && !redirect.StartsWith("link-twitch:"))
                    {
                        redirectPath = $"/{redirect}";
                        _logger.LogInformation("Custom redirect detected: {RedirectPath}", redirectPath);
                    }
                }

                _logger.LogInformation("User {Login} authenticated successfully", user.Login);

                // Store JWT behind a short-lived exchange code to avoid leaking it in the URL
                var exchangeCode = Guid.NewGuid().ToString("N");
                _memoryCache.Set($"auth_exchange:{exchangeCode}", jwt, TimeSpan.FromSeconds(60));

                _logger.LogInformation("Redirecting to {RedirectPath} with exchange code", redirectPath);
                return Redirect($"{_twitchSettings.FrontendUrl}{redirectPath}?code={exchangeCode}");
            }
            catch (Exception ex)
            {
                var fullError = ex.InnerException?.Message ?? ex.Message;
                _logger.LogError(ex, "Error during authentication callback: {Error}", fullError);
                System.IO.File.AppendAllText("/tmp/discord_debug.log", $"[{DateTime.UtcNow}] CALLBACK ERROR: {fullError}\n");
                return Redirect($"{_twitchSettings.FrontendUrl}/login?error={Uri.EscapeDataString(fullError)}");
            }
        }

        /// <summary>
        /// Exchanges a short-lived code for the actual JWT token.
        /// This prevents the JWT from being exposed in URLs, browser history, and Referer headers.
        /// </summary>
        [AllowAnonymous]
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
                // Remove the code so it cannot be reused
                _memoryCache.Remove(cacheKey);
                return Ok(new { token = jwt });
            }

            return Unauthorized(new { error = "Invalid or expired code" });
        }

        public class ExchangeCodeRequest
        {
            public string? Code { get; set; }
        }

        private string GenerateJwtToken(User user)
        {
            var now = DateTime.UtcNow;
            var expires = now.AddMinutes(_jwtSettings.ExpiryMinutes);

            _logger.LogInformation($"Generating JWT - IssuedAt: {now:yyyy-MM-dd HH:mm:ss} UTC, Expires: {expires:yyyy-MM-dd HH:mm:ss} UTC");

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Login),
                new Claim(ClaimTypes.GivenName, user.DisplayName ?? user.Login),
                new Claim("AuthProvider", user.AuthProvider ?? "twitch"),
                new Claim("TwitchId", user.TwitchId ?? ""),
                new Claim("DiscordId", user.DiscordId ?? ""),
                new Claim("ProfileImage", user.ProfileImageUrl ?? ""),
                new Claim("Email", user.Email ?? "")
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

        /// <summary>
        /// POST /api/auth/unlink-twitch — Remove Twitch from linked account
        /// </summary>
        [Authorize]
        [HttpPost("unlink-twitch")]
        public async Task<IActionResult> UnlinkTwitch()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!long.TryParse(userIdClaim, out var userId))
                return Unauthorized();

            var authProviderClaim = User.FindFirst("AuthProvider")?.Value ?? "twitch";
            if (authProviderClaim == "twitch")
                return BadRequest(new { error = "No puedes desvincular la cuenta con la que iniciaste sesion" });

            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return NotFound();
            if (string.IsNullOrEmpty(user.TwitchId))
                return BadRequest(new { error = "Twitch no esta vinculado" });

            user.TwitchId = null;
            user.Login = $"discord_{user.DiscordId}";
            user.AccessToken = "";
            user.RefreshToken = "";
            user.TokenExpiration = DateTime.UtcNow;
            user.BroadcasterType = "";
            user.AuthProvider = "discord";
            user.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync();
            _logger.LogInformation("Twitch unlinked from user {UserId}", userId);

            var jwt = GenerateJwtToken(user);
            return Ok(new { success = true, token = jwt });
        }

        [Authorize]
        [HttpGet("validate-scopes/{twitchId}")]
        public async Task<IActionResult> ValidateScopes(string twitchId)
        {
            try
            {
                var user = await _dbContext.Users
                    .Where(u => u.TwitchId == twitchId && u.IsActive)
                    .Select(u => new { u.AccessToken, u.Login })
                    .FirstOrDefaultAsync();

                if (user == null)
                {
                    return NotFound(new { error = "Usuario no encontrado" });
                }

                // Validar el token con Twitch para obtener los scopes
                var httpClient = _httpClientFactory.CreateClient();
                httpClient.DefaultRequestHeaders.Add("Authorization", $"OAuth {user.AccessToken}");

                var response = await httpClient.GetAsync("https://id.twitch.tv/oauth2/validate");
                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"Token de {user.Login} validado - Scopes: {responseBody}");
                    return Ok(new { user = user.Login, validation = System.Text.Json.JsonSerializer.Deserialize<object>(responseBody) });
                }
                else
                {
                    _logger.LogError($"Error validando token de {user.Login}: {responseBody}");
                    return BadRequest(new { error = "Error validando token", details = responseBody });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validando scopes");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [Authorize]
        [HttpGet("account-tier")]
        public async Task<IActionResult> GetAccountTier()
        {
            try
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!long.TryParse(userIdClaim, out var userId))
                    return Unauthorized();

                // Use EF Core's managed connection instead of a separate NpgsqlConnection
                var connection = _dbContext.Database.GetDbConnection();
                if (connection.State != System.Data.ConnectionState.Open)
                    await connection.OpenAsync();

                using var cmd = connection.CreateCommand();
                cmd.CommandText = @"
                    SELECT tier, tier_started_at, tier_expires_at, source
                    FROM user_subscription_tiers
                    WHERE user_id = @userId
                    AND (tier_expires_at IS NULL OR tier_expires_at > NOW())
                    LIMIT 1";

                var param = cmd.CreateParameter();
                param.ParameterName = "@userId";
                param.Value = userId;
                cmd.Parameters.Add(param);

                using var reader = await cmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    return Ok(new
                    {
                        tier = reader.GetString(0),
                        tierStartedAt = reader.IsDBNull(1) ? null : (DateTime?)reader.GetDateTime(1),
                        tierExpiresAt = reader.IsDBNull(2) ? null : (DateTime?)reader.GetDateTime(2),
                        source = reader.IsDBNull(3) ? null : reader.GetString(3)
                    });
                }

                // Sin registro = free por defecto
                return Ok(new { tier = "free", tierStartedAt = (DateTime?)null, tierExpiresAt = (DateTime?)null, source = (string?)null });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo tier de cuenta");
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }
}