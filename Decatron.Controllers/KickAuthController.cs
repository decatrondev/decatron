using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Core.Settings;
using Decatron.Data;
using Decatron.Services.Platforms.Kick;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Decatron.Controllers
{
    /// <summary>
    /// Login con Kick — endpoint minimo, ver .dev/plans/UNIFICACION_MULTIPLATAFORMA_PLAN.md
    /// seccion 8.5 (6 ago 2026).
    ///
    /// Cada login de Kick crea (o reutiliza) su propia fila en "users" — su propio
    /// "canal" — con el mismo patron que ya usa Discord para colgar una identidad
    /// nueva de una fila (kick_id, kick_username, etc.), pero SIN vincularse a una
    /// fila de Twitch existente: por la decision de "config por canal", un mismo
    /// streamer con Twitch y Kick administra cada uno por separado. Vincular ambos
    /// bajo una sola cuenta (para compartir DecaCoins/facturacion) es el trabajo de
    /// "accounts" del plan, todavia sin hacer.
    ///
    /// Reusa el mismo /api/auth/exchange generico de AuthController.cs para
    /// entregar el JWT final — no hace falta un endpoint de exchange propio.
    /// </summary>
    [Route("api/auth/kick")]
    [ApiController]
    public class KickAuthController : ControllerBase
    {
        private const string KickAuthUrl = "https://id.kick.com/oauth/authorize";
        private const string KickApiUrl = "https://api.kick.com/public/v1/users";

        private readonly DecatronDbContext _db;
        private readonly KickSettings _kickSettings;
        private readonly JwtSettings _jwtSettings;
        private readonly TwitchSettings _twitchSettings;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IMemoryCache _memoryCache;
        private readonly KickOAuthClient _kickOAuthClient;
        private readonly IKickEventSubService _kickEventSubService;
        private readonly ILogger<KickAuthController> _logger;

        public KickAuthController(
            DecatronDbContext db,
            IOptions<KickSettings> kickSettings,
            IOptions<JwtSettings> jwtSettings,
            IOptions<TwitchSettings> twitchSettings,
            IHttpClientFactory httpClientFactory,
            IMemoryCache memoryCache,
            KickOAuthClient kickOAuthClient,
            IKickEventSubService kickEventSubService,
            ILogger<KickAuthController> logger)
        {
            _db = db;
            _kickSettings = kickSettings.Value;
            _jwtSettings = jwtSettings.Value;
            _twitchSettings = twitchSettings.Value;
            _httpClientFactory = httpClientFactory;
            _memoryCache = memoryCache;
            _kickOAuthClient = kickOAuthClient;
            _kickEventSubService = kickEventSubService;
            _logger = logger;
        }

        [HttpGet("login")]
        public IActionResult Login()
        {
            if (string.IsNullOrEmpty(_kickSettings.ClientId))
                return BadRequest("Kick no esta configurado (falta ClientId)");

            return Redirect(BuildAuthorizeUrl());
        }

        /// <summary>
        /// Vincula un canal de Kick a la cuenta del usuario ya logueado (Twitch u
        /// otro), en vez de crear un canal nuevo sin relacion. Misma mecanica que
        /// AuthController.LinkTwitchStart, pero via cookie en vez de un state
        /// firmado: acá ya hay cookies de por medio para el PKCE, sumar una mas
        /// para "a que cuenta se linkea" es mas simple que mezclarlo en el state.
        /// </summary>
        [Authorize]
        [HttpPost("link-start")]
        public IActionResult LinkStart()
        {
            if (string.IsNullOrEmpty(_kickSettings.ClientId))
                return BadRequest(new { error = "Kick no esta configurado" });

            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            Response.Cookies.Append("kick_link_user_id", userId, new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.None,
                Path = "/",
                Domain = ".decatron.net",
                Expires = DateTimeOffset.UtcNow.AddMinutes(5)
            });

            return Ok(new { url = BuildAuthorizeUrl() });
        }

        private string BuildAuthorizeUrl()
        {
            var codeVerifier = GenerateCodeVerifier();
            var codeChallenge = GenerateCodeChallenge(codeVerifier);
            var state = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

            // Domain con punto inicial: el /login (o /link-start) se pide desde
            // decatron.net (o twitch.decatron.net), pero Kick redirige el callback
            // a kick.decatron.net. Sin el dominio compartido, la cookie no viaja.
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.None,
                Path = "/",
                Domain = ".decatron.net",
                Expires = DateTimeOffset.UtcNow.AddMinutes(5)
            };

            Response.Cookies.Append("kick_pkce_verifier", codeVerifier, cookieOptions);
            Response.Cookies.Append("kick_oauth_state", state, cookieOptions);

            return $"{KickAuthUrl}?" +
                   $"client_id={Uri.EscapeDataString(_kickSettings.ClientId)}" +
                   $"&redirect_uri={Uri.EscapeDataString(_kickSettings.RedirectUri)}" +
                   "&response_type=code" +
                   $"&scope={Uri.EscapeDataString(_kickSettings.Scopes)}" +
                   // Uri.EscapeDataString acá es obligatorio, no cosmético: state es
                   // base64 estándar y puede contener "+". Sin escapar, un "+" crudo
                   // en la URL se interpreta como espacio al volver — el state nunca
                   // vuelve a coincidir con la cookie. Encontrado el 6 ago 2026
                   // reproduciendo el invalid_state en producción.
                   $"&state={Uri.EscapeDataString(state)}" +
                   $"&code_challenge={codeChallenge}" +
                   "&code_challenge_method=S256";
        }

        [HttpGet("callback")]
        public async Task<IActionResult> Callback([FromQuery] string? code, [FromQuery] string? state, [FromQuery] string? error)
        {
            if (!string.IsNullOrEmpty(error))
            {
                _logger.LogWarning("[Kick OAuth] Error de Kick: {Error}", error);
                return Redirect($"{_twitchSettings.FrontendUrl}/login?error={Uri.EscapeDataString(error)}&provider=kick");
            }

            if (string.IsNullOrEmpty(code))
                return Redirect($"{_twitchSettings.FrontendUrl}/login?error=no_code&provider=kick");

            if (!Request.Cookies.TryGetValue("kick_oauth_state", out var savedState) || state != savedState)
            {
                _logger.LogWarning("[Kick OAuth] State invalido o cookie ausente");
                return Redirect($"{_twitchSettings.FrontendUrl}/login?error=invalid_state&provider=kick");
            }

            if (!Request.Cookies.TryGetValue("kick_pkce_verifier", out var codeVerifier) || string.IsNullOrEmpty(codeVerifier))
            {
                _logger.LogWarning("[Kick OAuth] Falta el verifier de PKCE (cookie expirada?)");
                return Redirect($"{_twitchSettings.FrontendUrl}/login?error=session_expired&provider=kick");
            }

            // Delete necesita el mismo Domain/Path con el que se creo la cookie, si
            // no, el navegador no la reconoce como la misma y no la borra de verdad
            // — queda viva hasta que expira sola y contamina el intento siguiente.
            // Bug real encontrado el 6 ago 2026 con un Vincular Kick que quedaba
            // "pegado" en intentos de login posteriores.
            var deleteCookieOptions = new CookieOptions { Domain = ".decatron.net", Path = "/" };
            Response.Cookies.Delete("kick_pkce_verifier", deleteCookieOptions);
            Response.Cookies.Delete("kick_oauth_state", deleteCookieOptions);

            long? linkToUserId = null;
            if (Request.Cookies.TryGetValue("kick_link_user_id", out var linkUserIdRaw))
            {
                Response.Cookies.Delete("kick_link_user_id", deleteCookieOptions);
                if (long.TryParse(linkUserIdRaw, out var parsedLinkUserId))
                    linkToUserId = parsedLinkUserId;
            }

            try
            {
                var client = _httpClientFactory.CreateClient();

                KickTokenResponse tokenData;
                try
                {
                    // Antes esta llamada estaba inline aca, duplicando a mano lo que ahora
                    // tambien necesita el refresh en background — un solo cliente para las
                    // dos rutas evita que diverjan con el tiempo.
                    tokenData = await _kickOAuthClient.ExchangeCodeAsync(code, codeVerifier);
                }
                catch (KickTokenException ex)
                {
                    _logger.LogError(ex, "[Kick OAuth] Intercambio de token fallo");
                    return Redirect($"{_twitchSettings.FrontendUrl}/login?error=token_exchange_failed&provider=kick");
                }

                var userRequest = new HttpRequestMessage(HttpMethod.Get, KickApiUrl);
                userRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenData?.AccessToken);
                var userResponse = await client.SendAsync(userRequest);
                var userContent = await userResponse.Content.ReadAsStringAsync();

                if (!userResponse.IsSuccessStatusCode)
                {
                    _logger.LogError("[Kick OAuth] No se pudo obtener el perfil: {Content}", userContent);
                    return Redirect($"{_twitchSettings.FrontendUrl}/login?error=user_info_failed&provider=kick");
                }

                var kickUser = JsonSerializer.Deserialize<KickUserResponse>(userContent)?.Data?.FirstOrDefault();
                if (kickUser == null || kickUser.UserId == 0)
                    return Redirect($"{_twitchSettings.FrontendUrl}/login?error=invalid_user_data&provider=kick");

                var kickId = kickUser.UserId.ToString();
                var user = await _db.Users.FirstOrDefaultAsync(u => u.KickId == kickId);
                var isNewUser = user == null;

                // Modo vinculacion: si este canal de Kick ya comparte cuenta con OTRA
                // fila (un vinculo real, no la cuenta propia por defecto que trae
                // desde que se creo), no se puede robar silenciosamente. Bug real
                // encontrado el 6 ago 2026: comparar solo "AccountId != linkingAccount"
                // rechazaba CUALQUIER vinculacion, porque toda fila ya tiene su propia
                // cuenta desde el backfill — eso no es "ya vinculada a alguien mas".
                if (linkToUserId.HasValue && user != null)
                {
                    var linkingAccount = await _db.Users.Where(u => u.Id == linkToUserId.Value).Select(u => u.AccountId).FirstOrDefaultAsync();

                    if (user.AccountId != linkingAccount)
                    {
                        var otherMembers = user.AccountId != null
                            ? await _db.Users.CountAsync(u => u.AccountId == user.AccountId && u.Id != user.Id)
                            : 0;

                        if (otherMembers > 0)
                        {
                            _logger.LogWarning("[Kick OAuth] Intento de vincular un canal de Kick que ya pertenece a otra cuenta");
                            return Redirect($"{_twitchSettings.FrontendUrl}/settings?error=kick_already_linked");
                        }

                        // Sin conflicto: esta fila solo tenia su cuenta solitaria por
                        // defecto — se une a la cuenta de quien inicio la vinculacion.
                        user.AccountId = linkingAccount;
                    }
                }

                if (user == null)
                {
                    // Cuenta: si es un login nuevo suelto, cuenta propia. Si es una
                    // vinculacion, se cuelga de la cuenta del usuario que ya esta
                    // logueado — asi ambos canales quedan bajo la misma persona sin
                    // fusionar las filas (cada canal sigue con su propia config).
                    long accountId;
                    if (linkToUserId.HasValue)
                    {
                        var existingUser = await _db.Users.FirstOrDefaultAsync(u => u.Id == linkToUserId.Value);
                        if (existingUser == null)
                            return Redirect($"{_twitchSettings.FrontendUrl}/settings?error=link_user_not_found");

                        if (existingUser.AccountId == null)
                        {
                            var newAccountForExisting = new Account { CreatedAt = DateTime.UtcNow };
                            _db.Accounts.Add(newAccountForExisting);
                            await _db.SaveChangesAsync();
                            existingUser.AccountId = newAccountForExisting.Id;
                        }
                        accountId = existingUser.AccountId.Value;
                    }
                    else
                    {
                        var newAccount = new Account { CreatedAt = DateTime.UtcNow };
                        _db.Accounts.Add(newAccount);
                        await _db.SaveChangesAsync();
                        accountId = newAccount.Id;
                    }

                    user = new User
                    {
                        AccountId = accountId,
                        // NULL, no "": IX_users_twitch_id es un indice unico sobre toda la
                        // tabla. Postgres permite muchos NULL ahi (no son iguales entre si),
                        // pero "" es un valor real y choca con cualquier otra fila que
                        // tambien use "" — encontrado el 6 ago 2026 al probar este login
                        // contra el usuario solo-Discord que ya tenia twitch_id = "".
                        TwitchId = null!,
                        Login = $"kick_{kickId}",
                        DisplayName = kickUser.Name ?? $"kick_{kickId}",
                        Email = kickUser.Email ?? "",
                        ProfileImageUrl = kickUser.ProfilePicture ?? "",
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
                        AuthProvider = "kick",
                        KickId = kickId,
                    };
                    _db.Users.Add(user);
                }

                user.KickUsername = kickUser.Name;
                user.KickProfilePic = kickUser.ProfilePicture;
                user.KickAccessToken = tokenData?.AccessToken;
                user.KickRefreshToken = tokenData?.RefreshToken;
                user.KickTokenExpiration = DateTime.UtcNow.AddSeconds(tokenData?.ExpiresIn ?? 3600);
                user.UpdatedAt = DateTime.UtcNow;

                await _db.SaveChangesAsync();

                // Sin esto, Kick nunca nos manda el chat — cada login/relogin
                // reconfirma la suscripcion, mismo criterio que ya usa el login de
                // Twitch con EventSub. No bloquea el redirect si falla.
                if (!string.IsNullOrEmpty(tokenData?.AccessToken))
                    _ = _kickEventSubService.SubscribeAsync(kickId, tokenData.AccessToken, "chat.message.sent");

                if (isNewUser && !linkToUserId.HasValue)
                {
                    await AssignFreeTier(user.Id);
                    _logger.LogInformation("[Kick OAuth] Nuevo usuario de Kick creado: {Username} (Id: {Id})", user.KickUsername, user.Id);
                }

                if (linkToUserId.HasValue)
                {
                    _logger.LogInformation("[Kick OAuth] Canal de Kick {Username} vinculado a la cuenta {AccountId}", user.KickUsername, user.AccountId);
                    return Redirect($"{_twitchSettings.FrontendUrl}/settings?linked=kick");
                }

                var jwt = GenerateJwtToken(user);
                var exchangeCode = Guid.NewGuid().ToString("N");
                _memoryCache.Set($"auth_exchange:{exchangeCode}", jwt, TimeSpan.FromSeconds(60));

                return Redirect($"{_twitchSettings.FrontendUrl}/login?code={exchangeCode}&provider=kick");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Kick OAuth] Excepcion en el callback");
                return Redirect($"{_twitchSettings.FrontendUrl}/login?error=server_exception&provider=kick");
            }
        }

        /// <summary>
        /// Desvincula el canal de Kick de la cuenta actual — le da su propia cuenta
        /// nueva en vez de borrar la fila (el canal y su config siguen existiendo,
        /// solo deja de estar agrupado con los demas canales de la persona).
        /// </summary>
        [Authorize]
        [HttpPost("unlink")]
        public async Task<IActionResult> Unlink()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!long.TryParse(userIdClaim, out var userId))
                return Unauthorized();

            var currentUser = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (currentUser?.AccountId == null)
                return BadRequest(new { error = "Cuenta no encontrada" });

            var linkedKickUser = await _db.Users
                .FirstOrDefaultAsync(u => u.AccountId == currentUser.AccountId && u.AuthProvider == "kick" && u.Id != userId);

            if (linkedKickUser == null)
                return BadRequest(new { error = "No hay ningun canal de Kick vinculado" });

            var freshAccount = new Account { CreatedAt = DateTime.UtcNow };
            _db.Accounts.Add(freshAccount);
            await _db.SaveChangesAsync();

            linkedKickUser.AccountId = freshAccount.Id;
            linkedKickUser.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            _logger.LogInformation("[Kick OAuth] Canal de Kick {Username} desvinculado de la cuenta {AccountId}", linkedKickUser.KickUsername, currentUser.AccountId);
            return Ok(new { success = true });
        }

        /// <summary>
        /// Suscribe al canal a channel.reward.redemption.updated — paso de
        /// verificacion antes de construir Sound Alerts para Kick (plan seccion
        /// 8, item 3). Devuelve la respuesta cruda de Kick para poder confirmar
        /// desde el propio endpoint si la suscripcion prendio.
        /// </summary>
        [Authorize]
        [HttpPost("subscribe-rewards")]
        public async Task<IActionResult> SubscribeRewards()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!long.TryParse(userIdClaim, out var userId))
                return Unauthorized();

            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user?.KickId == null || string.IsNullOrEmpty(user.KickAccessToken))
                return BadRequest(new { error = "La sesion actual no es un canal de Kick con token valido. Cambia a tu canal de Kick desde 'Tus Canales' primero." });

            var result = await _kickEventSubService.SubscribeAsync(user.KickId, user.KickAccessToken, "channel.reward.redemption.updated");
            return Ok(new { result.Success, result.StatusCode, result.Body });
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
                    VALUES (@userId, 'free', NOW(), 'auto_register', 'Asignado automáticamente al registrarse via Kick')
                    ON CONFLICT DO NOTHING";
                var param = cmd.CreateParameter();
                param.ParameterName = "@userId";
                param.Value = userId;
                cmd.Parameters.Add(param);
                await cmd.ExecuteNonQueryAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Kick OAuth] Error asignando tier gratuito a {UserId}", userId);
            }
        }

        private string GenerateJwtToken(User user)
        {
            var now = DateTime.UtcNow;
            var expires = now.AddMinutes(_jwtSettings.ExpiryMinutes);

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(ClaimTypes.Name, user.KickUsername ?? user.Login),
                new(ClaimTypes.GivenName, user.DisplayName ?? user.KickUsername ?? user.Login),
                new("AuthProvider", user.AuthProvider),
                new("TwitchId", user.TwitchId ?? ""),
                new("KickId", user.KickId ?? ""),
                new("DiscordId", user.DiscordId ?? ""),
                new("ProfileImage", user.KickProfilePic ?? user.ProfileImageUrl ?? ""),
                new("Email", user.Email ?? "")
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

        private static string GenerateCodeVerifier()
        {
            const string chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";
            var bytes = RandomNumberGenerator.GetBytes(128);
            var result = new StringBuilder(128);
            foreach (var b in bytes)
                result.Append(chars[b % chars.Length]);
            return result.ToString();
        }

        private static string GenerateCodeChallenge(string codeVerifier)
        {
            var challengeBytes = SHA256.HashData(Encoding.UTF8.GetBytes(codeVerifier));
            return Convert.ToBase64String(challengeBytes)
                .TrimEnd('=')
                .Replace('+', '-')
                .Replace('/', '_');
        }
    }

    public class KickUserResponse
    {
        [System.Text.Json.Serialization.JsonPropertyName("data")]
        public List<KickUserData>? Data { get; set; }
    }

    public class KickUserData
    {
        [System.Text.Json.Serialization.JsonPropertyName("user_id")]
        public int UserId { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("name")]
        public string? Name { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("email")]
        public string? Email { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("profile_picture")]
        public string? ProfilePicture { get; set; }
    }
}
