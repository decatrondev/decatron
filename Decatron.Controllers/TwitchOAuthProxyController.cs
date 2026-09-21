using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Decatron.Core.Helpers;
using Decatron.Core.Settings;

namespace Decatron.Controllers
{
    /// <summary>
    /// Proxea el canje de token de Twitch (id.twitch.tv/oauth2/token) para Flowdeck
    /// (app de escritorio, repo público). Flowdeck hace el paso de autorización
    /// directo contra Twitch (Authorization Code + PKCE), pero el client_id de esa
    /// app de Twitch ya tiene un client_secret generado (lo usa el bot), y Twitch
    /// lo exige en el canje pase lo que pase con PKCE ("missing client secret").
    /// Ese secret no puede vivir en un repo público, así que este endpoint lo
    /// guarda acá server-side y hace el canje por Flowdeck, devolviéndole solo
    /// el resultado — nunca ve ni necesita el secret del lado del cliente.
    /// </summary>
    [ApiController]
    [Route("api/oauth/twitch")]
    public class TwitchOAuthProxyController : ControllerBase
    {
        // Redirect URIs de loopback que puede pedir Flowdeck — cualquier otro
        // valor se rechaza acá antes de gastar la llamada a Twitch. Twitch ya
        // exige que id.twitch.tv/oauth2/authorize solo redirija a URIs
        // registradas para este client_id, esto es una capa extra para que
        // el proxy no se preste como "canjeador de tokens" genérico.
        private static readonly HashSet<string> AllowedRedirectUris = new()
        {
            "http://localhost:51824/callback/"
        };

        private readonly IHttpClientFactory _httpClientFactory;
        private readonly TwitchSettings _twitchSettings;
        private readonly ILogger<TwitchOAuthProxyController> _logger;

        public TwitchOAuthProxyController(
            IHttpClientFactory httpClientFactory,
            IOptions<TwitchSettings> twitchSettings,
            ILogger<TwitchOAuthProxyController> logger)
        {
            _httpClientFactory = httpClientFactory;
            _twitchSettings = twitchSettings.Value;
            _logger = logger;
        }

        [HttpPost("token")]
        [Consumes("application/x-www-form-urlencoded")]
        public async Task<IActionResult> Token([FromForm] TwitchProxyTokenFormRequest form)
        {
            if (string.IsNullOrEmpty(form.redirect_uri) || !AllowedRedirectUris.Contains(form.redirect_uri))
            {
                return BadRequest(new { error = "invalid_redirect_uri" });
            }

            var payload = new Dictionary<string, string>
            {
                ["client_id"] = _twitchSettings.ClientId,
                ["client_secret"] = _twitchSettings.ClientSecret,
                ["grant_type"] = form.grant_type
            };

            if (form.grant_type == "authorization_code")
            {
                if (string.IsNullOrEmpty(form.code) || string.IsNullOrEmpty(form.code_verifier))
                {
                    return BadRequest(new { error = "invalid_request", error_description = "code y code_verifier son requeridos" });
                }

                payload["code"] = form.code;
                payload["code_verifier"] = form.code_verifier;
                payload["redirect_uri"] = form.redirect_uri;
            }
            else if (form.grant_type == "refresh_token")
            {
                if (string.IsNullOrEmpty(form.refresh_token))
                {
                    return BadRequest(new { error = "invalid_request", error_description = "refresh_token es requerido" });
                }

                payload["refresh_token"] = form.refresh_token;
            }
            else
            {
                return BadRequest(new { error = "unsupported_grant_type" });
            }

            var client = _httpClientFactory.CreateClient();
            using var content = new FormUrlEncodedContent(payload);

            var response = await TwitchAuthHelper.PostWithFallbackAsync(client, "/oauth2/token", content, _logger);
            var body = await response.Content.ReadAsStringAsync();

            _logger.LogInformation(
                "Proxy de token Twitch para Flowdeck: grant_type={GrantType}, status={Status}",
                form.grant_type, (int)response.StatusCode);

            return new ContentResult
            {
                StatusCode = (int)response.StatusCode,
                Content = body,
                ContentType = "application/json"
            };
        }
    }

    public class TwitchProxyTokenFormRequest
    {
        public string grant_type { get; set; }
        public string? code { get; set; }
        public string? code_verifier { get; set; }
        public string? redirect_uri { get; set; }
        public string? refresh_token { get; set; }
    }
}
