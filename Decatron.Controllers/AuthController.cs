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
        private readonly ITenantCredentialStore _tenantStore;
        private readonly Decatron.Services.Tenancy.TenantMembership _membership;
        private readonly Decatron.Core.Interfaces.ICredentialProvider _credProvider;
        private readonly Decatron.Services.Tenancy.TenantEventSubHub _eventSubHub;

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
            DecatronDbContext dbContext,
            ITenantCredentialStore tenantStore,
            Decatron.Services.Tenancy.TenantEventSubHub eventSubHub,
            Decatron.Services.Tenancy.TenantMembership membership,
            Decatron.Core.Interfaces.ICredentialProvider credProvider)
        {
            _credProvider = credProvider;
            _membership = membership;
            _eventSubHub = eventSubHub;
            _tenantStore = tenantStore;
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

        /// <summary>
        /// Adonde vuelve el navegador tras el login. Para un tenant es SU subdominio (el callback llega ahi, asi la sesion queda guardada en ese Host);
        /// para el #1, el sitio de siempre (FrontendUrl).
        /// </summary>
        private string Front => (Decatron.Core.Interfaces.TenantAmbient.Current ?? 1) != 1 && Request.Host.HasValue
            ? $"https://{Request.Host.Value}" : _twitchSettings.FrontendUrl;

        [HttpGet("login")]
        public async Task<IActionResult> Login([FromQuery] string? redirect = null, [FromQuery] string? mod = null, [FromQuery] string? tenant = null, [FromQuery] string? bot = null, [FromQuery] string? k = null)
        {
            try
            {
                // Plataforma (Fase 4, paso 5): ?tenant=<slug> inicia sesion con la app de Twitch de ese tenant. Slug desconocido = error, nunca cae al #1.
                long? tenantId = null;
                // En slug.decatron.top el tenant sale del Host (no hace falta ?tenant=): el login es siempre con la app de ESE tenant.
                var hostCtx = HttpContext.RequestServices.GetService<Decatron.Core.Interfaces.ITenantContext>();
                if (string.IsNullOrWhiteSpace(tenant) && hostCtx is { Source: Decatron.Core.Interfaces.TenantSource.Host, IsResolved: true } && hostCtx.TenantId != 1)
                    tenantId = hostCtx.TenantId;
                if (!string.IsNullOrWhiteSpace(tenant))
                {
                    tenantId = await _tenantStore.FindActiveTenantIdAsync(tenant.Trim().ToLowerInvariant());
                    if (tenantId is null) return Redirect($"{Front}/login?error={Uri.EscapeDataString("Unknown tenant")}");
                }
                // bot=1: autorizar la CUENTA DE BOT del tenant. Solo con el enlace firmado que genera el dueño (k): sin el, cualquiera podria fijar el bot.
                var isBot = bot is "1" or "true";
                if (isBot)
                {
                    var (okLink, linkWhat, linkTenant) = AuthService.ValidateOAuthStateWithTenant(k ?? "", _jwtSettings.SecretKey, maxAgeMinutes: 30);
                    if (tenantId is null || !okLink || linkWhat != "botlink" || linkTenant != tenantId)
                        return Redirect($"{Front}/login?error={Uri.EscapeDataString("Invalid or expired link")}");
                }
                // mod=1: además de los permisos de siempre, los de moderar el chat (Multi-view).
                var loginUrl = _authService.GetLoginUrl(redirect, withModeration: mod is "1" or "true", tenantId: tenantId, bot: isBot);
                _logger.LogInformation("Redirecting to Twitch login (redirect: {Redirect})", redirect ?? "none");
                return Redirect(loginUrl);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during login");
                return Redirect($"{Front}/login?error={Uri.EscapeDataString("Error initiating login")}");
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
        /// POST /api/auth/link-account-start — vincula Twitch a la cuenta del usuario
        /// actual SIN fusionar filas (a diferencia de link-twitch-start, pensado para
        /// Discord). Para usar desde una sesion de Kick — cada canal conserva su
        /// propia config. Ver plan de unificacion, seccion 8.6.
        /// </summary>
        [Authorize]
        [HttpPost("link-account-start")]
        public IActionResult LinkAccountStart()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var loginUrl = _authService.GetLoginUrl($"link-account:{userId}");
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
                return Redirect($"{Front}/login?error=Session+expired");

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

                // Plataforma (Fase 4, paso 5): el tenant firmado en el state fija el contexto de todo el callback (intercambio de codigo con la
                // app de ese tenant incluido). Un state invalido o sin tenant sigue el camino de siempre (#1).
                IDisposable? tenantScope = null;
                if (!string.IsNullOrEmpty(state))
                {
                    var (okState, _, stateTenant) = AuthService.ValidateOAuthStateWithTenant(state, _jwtSettings.SecretKey);
                    if (okState && stateTenant is long stn) tenantScope = TenantAmbient.Push(stn);
                }
                using var _tenantScope = tenantScope;

                if (!string.IsNullOrEmpty(error))
                {
                    _logger.LogWarning($"Authentication error: {error}");
                    return Redirect($"{Front}/login?error={Uri.EscapeDataString(error)}");
                }

                if (string.IsNullOrEmpty(code))
                {
                    _logger.LogWarning("Authorization code not received");
                    return Redirect($"{Front}/login?error=Authorization+code+not+received");
                }

                // Exchange code for token
                _logger.LogInformation("Exchanging code for token...");
                var tokenResponse = await _authService.ExchangeCodeForTokenAsync(code);

                // Get user info
                _logger.LogInformation("Fetching user information...");
                var twitchUser = await _authService.GetUserInfoAsync(tokenResponse.AccessToken);

                // Autorizacion de la cuenta de bot de un tenant: se guarda en su almacen y NO se crea sesion ni usuario.
                if (!string.IsNullOrEmpty(state))
                {
                    var (okBot, _, botTenant, isBotState) = AuthService.ValidateOAuthStateFull(state, _jwtSettings.SecretKey);
                    if (okBot && isBotState && botTenant is long botTenantId)
                    {
                        if (tokenResponse.Scope is null || !tokenResponse.Scope.Contains("user:bot"))
                            return Content("<!doctype html><meta charset=utf-8><body style='font-family:system-ui;padding:2rem'>Falta el permiso user:bot. Vuelve a abrir el enlace y acepta todos los permisos.<br>The user:bot permission is missing. Open the link again and accept every permission.", "text/html; charset=utf-8");
                        await _tenantStore.SaveTwitchBotAsync(botTenantId, new TwitchBotInput(
                            twitchUser.Login, twitchUser.Id, tokenResponse.AccessToken, tokenResponse.RefreshToken,
                            DateTimeOffset.UtcNow.AddSeconds(tokenResponse.ExpiresIn)), "bot-oauth");
                        _logger.LogInformation("Plataforma: cuenta de bot {Bot} autorizada para el tenant {Tenant}", twitchUser.Login, botTenantId);
                        _credProvider.Invalidate(botTenantId);
                        _ = Task.Run(() => _eventSubHub.StartAsync(botTenantId)); // con app y bot listos se abre su conduit
                        return Content("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>OK</title>"
                            + "<body style='font-family:system-ui;background:#0f1115;color:#e8eaf0;display:grid;place-items:center;min-height:100vh;margin:0'>"
                            + $"<p style='text-align:center;padding:1rem'>✓ {System.Net.WebUtility.HtmlEncode(twitchUser.DisplayName ?? twitchUser.Login)}<br>Bot autorizado. Ya puedes cerrar esta ventana.<br>Bot authorized. You can close this window.</p>", "text/html; charset=utf-8");
                    }
                }

                // Check if this is a link-twitch operation BEFORE creating/updating user
                string? linkUserIdEarly = null;
                // link-account: mismo espiritu, mecanismo distinto — ver mas abajo.
                // No fusiona filas (Twitch se queda con la suya), solo comparte
                // account_id. Necesario para vincular Twitch desde una sesion de
                // Kick, donde fusionar en la fila actual estaria mal (perderia su
                // config propia). Ver plan de unificacion, seccion 8.6.
                string? linkAccountUserId = null;
                if (!string.IsNullOrEmpty(state))
                {
                    var (isValidEarly, redirectEarly) = AuthService.ValidateOAuthState(state, _jwtSettings.SecretKey);
                    if (isValidEarly && !string.IsNullOrEmpty(redirectEarly) && redirectEarly.StartsWith("link-twitch:"))
                    {
                        linkUserIdEarly = redirectEarly.Split(':')[1];
                    }
                    else if (isValidEarly && !string.IsNullOrEmpty(redirectEarly) && redirectEarly.StartsWith("link-account:"))
                    {
                        linkAccountUserId = redirectEarly.Split(':')[1];
                    }
                }

                // If linking Twitch to Discord user
                if (linkUserIdEarly != null && long.TryParse(linkUserIdEarly, out var discordUserId))
                {
                    var discordUser = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == discordUserId);
                    if (discordUser == null)
                        return Redirect($"{Front}/settings?error=User+not+found");

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
                            return Redirect($"{Front}/settings?error={Uri.EscapeDataString(innerMsg)}");
                        }

                        finalUser = discordUser;
                    }

                    _logger.LogInformation("Twitch linked successfully. Final user: {Login} (ID: {Id})", finalUser.Login, finalUser.Id);

                    if (_botService.IsConnected)
                        _botService.JoinChannel(finalUser.Login);

                    var linkJwt = GenerateJwtToken(finalUser);
                    var linkCode = Guid.NewGuid().ToString("N");
                    _memoryCache.Set($"auth_exchange:{linkCode}", linkJwt, TimeSpan.FromSeconds(60));

                    return Redirect($"{Front}/settings?linked=twitch&code={linkCode}");
                }

                // Normal login flow
                // Una cuenta pertenece a un solo tenant (users guarda un unico juego de tokens): entrar por otro sobrescribiria los de su app.
                // Fase A2: con Platform:IdentityPerTenant la persona tiene una fila de users por tenant (tokens propios), asi que la regla ya no aplica.
                if (!_configuration.GetValue<bool>("Platform:IdentityPerTenant")
                    && await _membership.BelongsElsewhereAsync(twitchUser.Id, TenantAmbient.Current ?? 1))
                {
                    _logger.LogWarning("Login rechazado: {Login} pertenece a otro tenant (entro por el {Tenant})", twitchUser.Login, TenantAmbient.Current ?? 1);
                    return Redirect($"{Front}/login?error={Uri.EscapeDataString("account_other_tenant")}");
                }
                var channelQuota = await _membership.ChannelQuotaAsync(twitchUser.Id, TenantAmbient.Current ?? 1);
                if (!channelQuota.IsAllowed)
                {
                    _logger.LogWarning("Login rechazado: {Login} no cabe en el plan del tenant {Tenant} ({Used}/{Limit} canales, {Reason})", twitchUser.Login, TenantAmbient.Current ?? 1, channelQuota.Used, channelQuota.Limit, channelQuota.Reason);
                    return Redirect($"{Front}/login?error={Uri.EscapeDataString("channel_quota_reached")}");
                }
                var acceptLanguage = Request.Headers["Accept-Language"].ToString();
                _logger.LogInformation("Authenticating user: {Login}", twitchUser.Login);
                var user = await _authService.AuthenticateUserAsync(twitchUser, tokenResponse, acceptLanguage);

                // link-account: colgar este canal de Twitch de la cuenta de quien
                // ya esta logueado (ej. una sesion de Kick), sin fusionar filas.
                // No corta el flujo — el bot se conecta y el EventSub se registra
                // igual que en un login normal, solo cambia el redirect final.
                if (linkAccountUserId != null && long.TryParse(linkAccountUserId, out var accountLinkUserId))
                {
                    var linkingUser = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == accountLinkUserId);
                    if (linkingUser == null)
                        return Redirect($"{Front}/settings?error=link_user_not_found");

                    if (linkingUser.AccountId == null)
                    {
                        var newAccountForLinking = new Account { CreatedAt = DateTime.UtcNow };
                        _dbContext.Accounts.Add(newAccountForLinking);
                        await _dbContext.SaveChangesAsync();
                        linkingUser.AccountId = newAccountForLinking.Id;
                        await _dbContext.SaveChangesAsync();
                    }

                    if (user.AccountId != linkingUser.AccountId)
                    {
                        // Bug real encontrado el 6 ago 2026: comparar solo AccountId
                        // rechazaba CUALQUIER vinculacion, porque toda fila ya tiene su
                        // propia cuenta solitaria desde el backfill — eso no es "ya
                        // vinculada a alguien mas". Solo se rechaza si esa cuenta esta
                        // realmente compartida con OTRA fila.
                        var otherMembers = user.AccountId != null
                            ? await _dbContext.Users.CountAsync(u => u.AccountId == user.AccountId && u.Id != user.Id)
                            : 0;

                        if (otherMembers > 0)
                        {
                            _logger.LogWarning("[Link Account] El Twitch {Login} ya pertenece a otra cuenta", user.Login);
                            return Redirect($"{Front}/settings?error=twitch_already_linked");
                        }

                        user.AccountId = linkingUser.AccountId;
                        await _dbContext.SaveChangesAsync();
                        _logger.LogInformation("[Link Account] Twitch {Login} vinculado a la cuenta {AccountId}", user.Login, user.AccountId);
                    }
                }

                // Generate JWT
                var jwt = GenerateJwtToken(user);

                // Connect bot to channel
                _logger.LogInformation($"Connecting bot to channel: {user.Login}");
                if (_botService.IsConnected)
                {
                    _botService.JoinChannel(user.Login);
                }

                // Registrar suscripciones EventSub en background (paralelo)
                if (!string.IsNullOrEmpty(user.TwitchId))
                {
                    var twitchId = user.TwitchId;
                    var userLogin = user.Login;
                    var eventSubService = _eventSubService;
                    var logger = _logger;

                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            logger.LogInformation($"🔔 Verificando suscripciones EventSub para {userLogin} (paralelo)");

                            // Mismo criterio que EventSubBackgroundService: streamers se
                            // suscriben por conduit si hay uno disponible, webhook como
                            // fallback. Sin esto, cada login/reconexión revivía
                            // suscripciones webhook aunque el streamer ya estuviera
                            // migrado — encontrado el 5 ago 2026 al cerrar la migración.
                            var transportMode = EventSubTransportMode.Webhook;
                            string? conduitId = null;
                            var conduitsResult = await eventSubService.GetConduitsAsync();
                            if (conduitsResult.Success && !string.IsNullOrEmpty(conduitsResult.ResponseBody))
                            {
                                try
                                {
                                    var conduitsJson = System.Text.Json.JsonDocument.Parse(conduitsResult.ResponseBody);
                                    var conduitsData = conduitsJson.RootElement.GetProperty("data");
                                    if (conduitsData.GetArrayLength() > 0)
                                    {
                                        conduitId = conduitsData[0].GetProperty("id").GetString();
                                        transportMode = EventSubTransportMode.Conduit;
                                    }
                                }
                                catch (Exception ex)
                                {
                                    logger.LogError(ex, "Error parseando la lista de conduits, se sigue con webhook");
                                }
                            }

                            var tasks = new Dictionary<string, Task<EventSubSubscriptionResult>>
                            {
                                ["Chat"] = eventSubService.EnsureSubscriptionAsync(twitchId, transportMode, conduitId),
                                ["Channel Points"] = eventSubService.EnsureChannelPointsSubscriptionAsync(twitchId, transportMode, conduitId),
                                ["Follows"] = eventSubService.EnsureFollowsSubscriptionAsync(twitchId, transportMode, conduitId),
                                ["Bits"] = eventSubService.EnsureCheerSubscriptionAsync(twitchId, transportMode, conduitId),
                                ["Subs"] = eventSubService.EnsureSubscriptionsSubscriptionAsync(twitchId, transportMode, conduitId),
                                ["Gift Subs"] = eventSubService.EnsureGiftSubsSubscriptionAsync(twitchId, transportMode, conduitId),
                                ["Raids"] = eventSubService.EnsureRaidSubscriptionAsync(twitchId, transportMode, conduitId),
                                ["Hype Train"] = eventSubService.EnsureHypeTrainSubscriptionAsync(twitchId, transportMode, conduitId),
                                ["Channel Update"] = eventSubService.EnsureChannelUpdateSubscriptionAsync(twitchId, transportMode, conduitId)
                            };

                            await Task.WhenAll(tasks.Values);

                            foreach (var (name, task) in tasks)
                            {
                                var result = await task;
                                if (result.Success)
                                {
                                    logger.LogInformation(result.Message.Contains("ya existe")
                                        ? $"✅ {userLogin}: {name} ya existía"
                                        : $"🆕 {userLogin}: {name} creada");
                                }
                                else
                                {
                                    logger.LogWarning($"⚠️ {userLogin}: {name} falló - {result.Message}");
                                }
                            }

                            logger.LogInformation($"✅ {userLogin}: EventSub completado (8 eventos en paralelo)");
                        }
                        catch (Exception ex)
                        {
                            logger.LogError(ex, $"❌ Error registrando suscripciones EventSub para {userLogin}");
                        }
                    });
                }

                // link-account: no se cambia la sesion del navegador (sigue logueado
                // como estaba, ej. Kick) — el vinculo ya quedo guardado arriba.
                if (linkAccountUserId != null)
                {
                    return Redirect($"{Front}/settings?linked=twitch-account");
                }

                // Validate HMAC-signed state and extract redirect
                string redirectPath = "/dashboard";
                if (!string.IsNullOrEmpty(state))
                {
                    var (isValid, redirect) = AuthService.ValidateOAuthState(state, _jwtSettings.SecretKey);
                    if (!isValid)
                    {
                        _logger.LogWarning("Invalid or expired OAuth state parameter");
                        return Redirect($"{Front}/login?error={Uri.EscapeDataString("Invalid or expired login session. Please try again.")}");
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

                // Always redirect to /login for code exchange, with redirect param to navigate after
                var redirectParam = redirectPath != "/dashboard" ? $"&redirect={Uri.EscapeDataString(redirectPath.TrimStart('/'))}" : "";
                _logger.LogInformation("Redirecting to login with exchange code, then to {RedirectPath}", redirectPath);
                return Redirect($"{Front}/login?code={exchangeCode}{redirectParam}");
            }
            catch (Exception ex)
            {
                var fullError = ex.InnerException?.Message ?? ex.Message;
                _logger.LogError(ex, "Error during authentication callback: {Error}", fullError);
                return Redirect($"{Front}/login?error={Uri.EscapeDataString(fullError)}");
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
                new Claim("Email", user.Email ?? ""),
                new Claim(BuyerClaims.Tenant, (TenantAmbient.Current ?? 1).ToString()) // Fase A-C: la sesion vale solo en el subdominio de su tenant
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

                var response = await Core.Helpers.TwitchAuthHelper.GetWithFallbackAsync(httpClient, "/oauth2/validate", _logger);
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

        private long GetChannelOwnerId()
        {
            // PRIORIDAD 1: Obtener canal activo desde la sesion (despues de switch)
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
            {
                return sessionId;
            }

            // PRIORIDAD 2: Usar el claim del JWT si existe
            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
            {
                return channelOwnerId;
            }

            // PRIORIDAD 3: Por defecto, usar el propio canal del usuario
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(userIdClaim, out var userId) ? userId : 0;
        }

        /// <summary>
        /// Lista los canales vinculados a la misma cuenta que el usuario actual —
        /// cada fila de "users" (Twitch o Kick) que comparte account_id. El JWT
        /// solo describe la sesion actual, no el resto de canales vinculados.
        /// Ver .dev/plans/UNIFICACION_MULTIPLATAFORMA_PLAN.md seccion 8.6.
        /// </summary>
        /// <summary>
        /// Desvincula el canal de Twitch vinculado por cuenta (no fusionado) — le da
        /// su propia cuenta nueva, mismo patron que KickAuthController.Unlink.
        /// </summary>
        [Authorize]
        [HttpPost("unlink-account")]
        public async Task<IActionResult> UnlinkAccount()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!long.TryParse(userIdClaim, out var userId))
                return Unauthorized();

            var currentUser = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (currentUser?.AccountId == null)
                return BadRequest(new { error = "Cuenta no encontrada" });

            var linkedTwitchUser = await _dbContext.Users
                .FirstOrDefaultAsync(u => u.AccountId == currentUser.AccountId && u.TwitchId != null && u.Id != userId);

            if (linkedTwitchUser == null)
                return BadRequest(new { error = "No hay ningun canal de Twitch vinculado" });

            var freshAccount = new Account { CreatedAt = DateTime.UtcNow };
            _dbContext.Accounts.Add(freshAccount);
            await _dbContext.SaveChangesAsync();

            linkedTwitchUser.AccountId = freshAccount.Id;
            linkedTwitchUser.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true });
        }

        [Authorize]
        [HttpGet("account-channels")]
        public async Task<IActionResult> AccountChannels()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!long.TryParse(userIdClaim, out var userId))
                return Unauthorized();

            var currentUser = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (currentUser?.AccountId == null)
                return Ok(new { channels = Array.Empty<object>() });

            var channels = await _dbContext.Users
                .Where(u => u.AccountId == currentUser.AccountId)
                .Select(u => new
                {
                    id = u.Id,
                    isCurrent = u.Id == userId,
                    hasTwitch = u.TwitchId != null,
                    twitchLogin = u.TwitchId != null ? u.Login : null,
                    hasKick = u.KickId != null,
                    kickUsername = u.KickUsername
                })
                .ToListAsync();

            return Ok(new { channels });
        }

        /// <summary>
        /// Cambia de canal propio DE VERDAD — no una nota invisible en la sesion
        /// (asi funcionaba antes, via /api/channel/switch, y resultaba en que el
        /// header/sidebar/dashboard seguian mostrando el canal viejo). Esto genera
        /// un JWT nuevo, como si te loguearas de cero con el otro canal, y el
        /// frontend lo reemplaza — todo lo que lee el token cambia junto.
        ///
        /// Solo para canales propios vinculados por cuenta (Twitch <-> Kick) — el
        /// selector de permisos delegados del header sigue con su propio mecanismo,
        /// sin tocar. Ver .dev/plans/UNIFICACION_MULTIPLATAFORMA_PLAN.md seccion 8.14.
        /// </summary>
        [Authorize]
        [HttpPost("switch-channel")]
        public async Task<IActionResult> SwitchChannel([FromBody] SwitchChannelRequest request)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!long.TryParse(userIdClaim, out var userId))
                return Unauthorized();

            var currentUser = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (currentUser?.AccountId == null)
                return BadRequest(new { error = "Cuenta no encontrada" });

            var targetUser = await _dbContext.Users
                .FirstOrDefaultAsync(u => u.Id == request.ChannelId && u.AccountId == currentUser.AccountId);

            if (targetUser == null)
                return StatusCode(403, new { error = "Ese canal no pertenece a tu cuenta" });

            var jwt = GenerateJwtTokenForChannel(targetUser);
            return Ok(new { token = jwt });
        }

        public class SwitchChannelRequest
        {
            public long ChannelId { get; set; }
        }

        /// <summary>
        /// Igual que GenerateJwtToken, pero elige campos de Twitch o de Kick segun
        /// de que plataforma sea la fila — GenerateJwtToken (Twitch) siempre usaba
        /// Login/ProfileImageUrl, que para una fila de Kick estan vacios o son el
        /// "kick_123456" interno, no el nombre real.
        /// </summary>
        private string GenerateJwtTokenForChannel(User user)
        {
            var now = DateTime.UtcNow;
            var expires = now.AddMinutes(_jwtSettings.ExpiryMinutes);
            var isKick = user.KickId != null;

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, isKick ? (user.KickUsername ?? user.Login) : user.Login),
                new Claim(ClaimTypes.GivenName, isKick ? (user.KickUsername ?? user.DisplayName) : (user.DisplayName ?? user.Login)),
                new Claim("AuthProvider", user.AuthProvider ?? "twitch"),
                new Claim("TwitchId", user.TwitchId ?? ""),
                new Claim("KickId", user.KickId ?? ""),
                new Claim("DiscordId", user.DiscordId ?? ""),
                new Claim("ProfileImage", isKick ? (user.KickProfilePic ?? "") : (user.ProfileImageUrl ?? "")),
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

        [Authorize]
        [HttpGet("account-tier")]
        public async Task<IActionResult> GetAccountTier()
        {
            try
            {
                var targetUserId = GetChannelOwnerId();
                if (targetUserId == 0)
                    return Unauthorized();

                // Antes: consulta SQL directa contra este solo user_id, ignoraba
                // canales vinculados. TierResolver ya resuelve "mejor tier entre
                // todos los canales de la cuenta" — se delega ahi en vez de repetir
                // la logica. Ver .dev/plans/UNIFICACION_MULTIPLATAFORMA_PLAN.md
                // seccion 8.11.
                var details = await Core.Helpers.TierResolver.GetEffectiveTierDetailsAsync(_dbContext, targetUserId);

                return Ok(new
                {
                    tier = details.Tier,
                    tierStartedAt = details.TierStartedAt?.UtcDateTime,
                    tierExpiresAt = details.TierExpiresAt?.UtcDateTime,
                    source = details.Source
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo tier de cuenta");
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }
}