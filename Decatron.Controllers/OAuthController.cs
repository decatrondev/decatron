using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Decatron.Core.Interfaces;
using Decatron.OAuth.Scopes;
using Decatron.OAuth.Handlers;
using Decatron.OAuth.Attributes;

namespace Decatron.Controllers
{
    /// <summary>
    /// Controlador OAuth2 para la API pública de Decatron.
    /// Implementa el flujo Authorization Code con soporte para PKCE.
    /// </summary>
    [ApiController]
    [Route("api/oauth")]
    public class OAuthController : ControllerBase
    {
        private readonly IOAuthService _oauthService;
        private readonly ILogger<OAuthController> _logger;

        public OAuthController(IOAuthService oauthService, ILogger<OAuthController> logger)
        {
            _oauthService = oauthService;
            _logger = logger;
        }

        // ═══════════════════════════════════════════════════════════════════
        // GET /oauth/authorize
        // Redirige al frontend para mostrar la página de autorización
        // ═══════════════════════════════════════════════════════════════════

        /// <summary>
        /// Inicia el flujo de autorización OAuth2.
        /// Redirige al usuario a la página de autorización del frontend.
        /// </summary>
        [HttpGet("authorize")]
        public async Task<IActionResult> Authorize(
            [FromQuery] string client_id,
            [FromQuery] string redirect_uri,
            [FromQuery] string response_type,
            [FromQuery] string scope,
            [FromQuery] string? state = null,
            [FromQuery] string? code_challenge = null,
            [FromQuery] string? code_challenge_method = null)
        {
            var request = new AuthorizeRequest(
                client_id,
                redirect_uri,
                response_type,
                scope,
                state,
                code_challenge,
                code_challenge_method
            );

            // Validar la solicitud
            var (isValid, error, app) = await _oauthService.ValidateAuthorizeRequestAsync(request);

            if (!isValid || app == null)
            {
                _logger.LogWarning("Invalid authorize request: {Error}", error);

                // Si hay redirect_uri válida, redirigir con error
                if (!string.IsNullOrEmpty(redirect_uri))
                {
                    var errorUri = $"{redirect_uri}?error={error}";
                    if (!string.IsNullOrEmpty(state))
                    {
                        errorUri += $"&state={Uri.EscapeDataString(state)}";
                    }
                    return Redirect(errorUri);
                }

                return BadRequest(new { error, error_description = GetErrorDescription(error) });
            }

            // Redirigir al frontend para mostrar la página de autorización
            // El frontend mostrará la UI de autorización y luego hará POST a /oauth/authorize
            var authPageUrl = $"/oauth/authorize?" +
                $"client_id={Uri.EscapeDataString(client_id)}&" +
                $"redirect_uri={Uri.EscapeDataString(redirect_uri)}&" +
                $"response_type={Uri.EscapeDataString(response_type)}&" +
                $"scope={Uri.EscapeDataString(scope)}";

            if (!string.IsNullOrEmpty(state))
                authPageUrl += $"&state={Uri.EscapeDataString(state)}";
            if (!string.IsNullOrEmpty(code_challenge))
                authPageUrl += $"&code_challenge={Uri.EscapeDataString(code_challenge)}";
            if (!string.IsNullOrEmpty(code_challenge_method))
                authPageUrl += $"&code_challenge_method={Uri.EscapeDataString(code_challenge_method)}";

            // Retornar info de la app para que el frontend pueda mostrarla
            return Ok(new
            {
                app = new
                {
                    id = app.Id,
                    name = app.Name,
                    description = app.Description,
                    icon_url = app.IconUrl,
                    website_url = app.WebsiteUrl,
                    is_verified = app.IsVerified,
                    owner = app.Owner?.DisplayName ?? app.Owner?.Login
                },
                requested_scopes = DecatronScopes.Parse(scope)
                    .Select(s => new
                    {
                        scope = s,
                        info = DecatronScopes.All.TryGetValue(s, out var info)
                            ? new { name = info.Name, description = info.Description, category = info.Category }
                            : null
                    }),
                redirect_uri,
                state
            });
        }

        // ═══════════════════════════════════════════════════════════════════
        // POST /oauth/authorize
        // Usuario aprueba o deniega la autorización
        // ═══════════════════════════════════════════════════════════════════

        /// <summary>
        /// Procesa la decisión del usuario sobre la autorización.
        /// </summary>
        [HttpPost("authorize")]
        [Authorize] // Requiere sesión de usuario activa
        public async Task<IActionResult> AuthorizePost([FromBody] AuthorizePostRequest request)
        {
            // Obtener el usuario de la sesión
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !long.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { error = "invalid_session" });
            }

            // Validar la solicitud original
            var authRequest = new AuthorizeRequest(
                request.ClientId,
                request.RedirectUri,
                "code",
                string.Join(" ", request.ApprovedScopes),
                request.State,
                request.CodeChallenge,
                request.CodeChallengeMethod
            );

            var (isValid, error, app) = await _oauthService.ValidateAuthorizeRequestAsync(authRequest);

            if (!isValid || app == null)
            {
                return RedirectWithError(request.RedirectUri, error ?? "invalid_request", request.State);
            }

            // Si el usuario denegó
            if (!request.Approved)
            {
                return RedirectWithError(request.RedirectUri, "access_denied", request.State);
            }

            // Crear código de autorización
            var code = await _oauthService.CreateAuthorizationCodeAsync(
                app.Id,
                userId,
                request.ApprovedScopes,
                request.RedirectUri,
                request.State,
                request.CodeChallenge,
                request.CodeChallengeMethod
            );

            // Redirigir con el código
            var redirectUrl = $"{request.RedirectUri}?code={Uri.EscapeDataString(code)}";
            if (!string.IsNullOrEmpty(request.State))
            {
                redirectUrl += $"&state={Uri.EscapeDataString(request.State)}";
            }

            _logger.LogInformation("Authorization code created for user {UserId}, app {AppId}",
                userId, app.Id);

            return Ok(new { redirect_url = redirectUrl });
        }

        // ═══════════════════════════════════════════════════════════════════
        // POST /oauth/token
        // Intercambia código por tokens o refresh token
        // ═══════════════════════════════════════════════════════════════════

        /// <summary>
        /// Intercambia un código de autorización por tokens,
        /// o un refresh token por un nuevo access token.
        /// </summary>
        [HttpPost("token")]
        [Consumes("application/x-www-form-urlencoded")]
        public async Task<IActionResult> Token([FromForm] TokenFormRequest form)
        {
            var request = new TokenRequest(
                form.grant_type,
                form.code,
                form.redirect_uri,
                form.client_id,
                form.client_secret,
                form.refresh_token,
                form.code_verifier
            );

            OAuthTokenResponse? response = null;

            switch (request.GrantType)
            {
                case "authorization_code":
                    response = await _oauthService.ExchangeCodeForTokenAsync(request);
                    break;

                case "refresh_token":
                    if (string.IsNullOrEmpty(request.RefreshToken))
                    {
                        return BadRequest(new { error = "invalid_request", error_description = "refresh_token is required" });
                    }
                    response = await _oauthService.RefreshTokenAsync(
                        request.RefreshToken,
                        request.ClientId,
                        request.ClientSecret
                    );
                    break;

                default:
                    return BadRequest(new { error = "unsupported_grant_type" });
            }

            if (response == null)
            {
                return BadRequest(new { error = "invalid_grant", error_description = "Invalid code or refresh token" });
            }

            return Ok(new
            {
                access_token = response.AccessToken,
                token_type = response.TokenType,
                expires_in = response.ExpiresIn,
                refresh_token = response.RefreshToken,
                scope = response.Scope
            });
        }

        // ═══════════════════════════════════════════════════════════════════
        // POST /oauth/revoke
        // Revoca un token
        // ═══════════════════════════════════════════════════════════════════

        /// <summary>
        /// Revoca un access token o refresh token.
        /// </summary>
        [HttpPost("revoke")]
        [Consumes("application/x-www-form-urlencoded")]
        public async Task<IActionResult> Revoke([FromForm] string token)
        {
            if (string.IsNullOrEmpty(token))
            {
                return BadRequest(new { error = "invalid_request" });
            }

            var revoked = await _oauthService.RevokeTokenAsync(token);

            // RFC 7009: Always return 200, even if token was invalid
            return Ok();
        }

        // ═══════════════════════════════════════════════════════════════════
        // GET /oauth/userinfo
        // Retorna información del usuario autenticado
        // ═══════════════════════════════════════════════════════════════════

        /// <summary>
        /// Retorna información del usuario basado en el access token.
        /// Requiere scope: read:profile
        /// </summary>
        [HttpGet("userinfo")]
        [Authorize(AuthenticationSchemes = OAuthBearerOptions.SchemeName)]
        [RequireScope("read:profile")]
        public IActionResult UserInfo()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var login = User.FindFirst(ClaimTypes.Name)?.Value;
            var displayName = User.FindFirst("display_name")?.Value;
            var twitchId = User.FindFirst("twitch_id")?.Value;

            return Ok(new
            {
                sub = userId,
                login = login,
                display_name = displayName ?? login,
                twitch_id = twitchId
            });
        }

        // ═══════════════════════════════════════════════════════════════════
        // GET /oauth/scopes
        // Lista todos los scopes disponibles
        // ═══════════════════════════════════════════════════════════════════

        /// <summary>
        /// Lista todos los scopes disponibles en la API.
        /// </summary>
        [HttpGet("scopes")]
        public IActionResult GetScopes()
        {
            var grouped = DecatronScopes.GetGroupedByCategory();

            return Ok(new
            {
                scopes = grouped.ToDictionary(
                    g => g.Key,
                    g => g.Value.Select(s => new
                    {
                        scope = s.Scope,
                        name = s.Info.Name,
                        description = s.Info.Description,
                        requires_verification = s.Info.RequiresVerification
                    })
                )
            });
        }

        // ═══════════════════════════════════════════════════════════════════
        // HELPERS
        // ═══════════════════════════════════════════════════════════════════

        private IActionResult RedirectWithError(string redirectUri, string error, string? state)
        {
            var url = $"{redirectUri}?error={Uri.EscapeDataString(error)}";
            if (!string.IsNullOrEmpty(state))
            {
                url += $"&state={Uri.EscapeDataString(state)}";
            }
            return Ok(new { redirect_url = url, error });
        }

        private static string GetErrorDescription(string? error) => error switch
        {
            "invalid_client" => "The client_id is invalid or not found",
            "invalid_redirect_uri" => "The redirect_uri is not registered for this application",
            "invalid_scope" => "One or more scopes are invalid or not allowed",
            "unsupported_response_type" => "Only response_type=code is supported",
            "invalid_code_challenge_method" => "code_challenge_method must be S256 or plain",
            _ => "An error occurred"
        };
    }

    // ═══════════════════════════════════════════════════════════════════
    // DTOs
    // ═══════════════════════════════════════════════════════════════════

    public record AuthorizePostRequest(
        string ClientId,
        string RedirectUri,
        string[] ApprovedScopes,
        string? State,
        string? CodeChallenge,
        string? CodeChallengeMethod,
        bool Approved
    );

    public class TokenFormRequest
    {
        public string grant_type { get; set; } = string.Empty;
        public string? code { get; set; }
        public string? redirect_uri { get; set; }
        public string client_id { get; set; } = string.Empty;
        public string? client_secret { get; set; }
        public string? refresh_token { get; set; }
        public string? code_verifier { get; set; }
    }
}
