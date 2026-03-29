using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Decatron.Core.Interfaces;

namespace Decatron.OAuth.Handlers
{
    /// <summary>
    /// Opciones de configuración para OAuthBearer
    /// </summary>
    public class OAuthBearerOptions : AuthenticationSchemeOptions
    {
        /// <summary>
        /// Nombre del esquema de autenticación
        /// </summary>
        public const string SchemeName = "OAuthBearer";
    }

    /// <summary>
    /// Handler de autenticación para tokens OAuth2 Bearer.
    /// Valida tokens de acceso de la API pública.
    /// </summary>
    public class OAuthBearerHandler : AuthenticationHandler<OAuthBearerOptions>
    {
        private readonly IOAuthService _oauthService;

        public OAuthBearerHandler(
            IOptionsMonitor<OAuthBearerOptions> options,
            ILoggerFactory logger,
            UrlEncoder encoder,
            IOAuthService oauthService)
            : base(options, logger, encoder)
        {
            _oauthService = oauthService;
        }

        protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            // 1. Verificar que existe el header Authorization
            if (!Request.Headers.TryGetValue("Authorization", out var authHeaderValues))
            {
                return AuthenticateResult.NoResult();
            }

            var authHeader = authHeaderValues.FirstOrDefault();
            if (string.IsNullOrEmpty(authHeader))
            {
                return AuthenticateResult.NoResult();
            }

            // 2. Verificar formato "Bearer {token}"
            if (!authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                return AuthenticateResult.NoResult();
            }

            var token = authHeader.Substring("Bearer ".Length).Trim();
            if (string.IsNullOrEmpty(token))
            {
                return AuthenticateResult.Fail("Empty token");
            }

            // 3. Validar el token
            var accessToken = await _oauthService.ValidateAccessTokenAsync(token);
            if (accessToken == null)
            {
                Logger.LogWarning("Invalid or expired OAuth token");
                return AuthenticateResult.Fail("Invalid or expired token");
            }

            // 4. Crear claims
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, accessToken.UserId.ToString()),
                new Claim("oauth_app_id", accessToken.ApplicationId.ToString()),
                new Claim("oauth_scopes", string.Join(" ", accessToken.Scopes)),
                new Claim("oauth_token_id", accessToken.Id.ToString()),
            };

            // Agregar información del usuario si está disponible
            if (accessToken.User != null)
            {
                claims.Add(new Claim(ClaimTypes.Name, accessToken.User.Login));
                claims.Add(new Claim("display_name", accessToken.User.DisplayName ?? accessToken.User.Login));
                claims.Add(new Claim("twitch_id", accessToken.User.TwitchId ?? ""));
            }

            // Agregar información de la app
            if (accessToken.Application != null)
            {
                claims.Add(new Claim("oauth_app_name", accessToken.Application.Name));
            }

            // Agregar cada scope como claim individual (para autorización granular)
            foreach (var scope in accessToken.Scopes)
            {
                claims.Add(new Claim("scope", scope));
            }

            var identity = new ClaimsIdentity(claims, OAuthBearerOptions.SchemeName);
            var principal = new ClaimsPrincipal(identity);
            var ticket = new AuthenticationTicket(principal, OAuthBearerOptions.SchemeName);

            Logger.LogDebug("OAuth token validated for user {UserId}, app {AppId}",
                accessToken.UserId, accessToken.ApplicationId);

            return AuthenticateResult.Success(ticket);
        }

        protected override Task HandleChallengeAsync(AuthenticationProperties properties)
        {
            Response.StatusCode = 401;
            Response.Headers.Append("WWW-Authenticate", "Bearer realm=\"Decatron API\"");
            return Task.CompletedTask;
        }

        protected override Task HandleForbiddenAsync(AuthenticationProperties properties)
        {
            Response.StatusCode = 403;
            return Task.CompletedTask;
        }
    }
}
