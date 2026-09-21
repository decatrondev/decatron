using System.Text.Json;
using Decatron.Core.Models;
using Decatron.Core.Settings;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Services.Platforms.Kick
{
    /// <summary>
    /// Unico punto que le habla a <c>POST https://id.kick.com/oauth/token</c> — antes esta
    /// llamada estaba duplicada a mano dentro de <c>KickAuthController.Callback</c> (solo el
    /// intercambio inicial) y no existia en absoluto para refresh. Sacarla a un cliente propio
    /// evita que las dos rutas (login y refresh) diverjan con el tiempo, y es lo que permite que
    /// el refresh se llame desde un background service, que no puede depender de un Controller.
    /// </summary>
    public class KickOAuthClient
    {
        private const string KickTokenUrl = "https://id.kick.com/oauth/token";

        private readonly IHttpClientFactory _httpClientFactory;
        private readonly KickSettings _kickSettings;
        private readonly ILogger<KickOAuthClient> _logger;

        public KickOAuthClient(
            IHttpClientFactory httpClientFactory,
            IOptions<KickSettings> kickSettings,
            ILogger<KickOAuthClient> logger)
        {
            _httpClientFactory = httpClientFactory;
            _kickSettings = kickSettings.Value;
            _logger = logger;
        }

        /// <summary>Intercambio inicial code+PKCE verifier por tokens (flujo de login/vinculacion).</summary>
        public Task<KickTokenResponse> ExchangeCodeAsync(string code, string codeVerifier)
        {
            var fields = new[]
            {
                new KeyValuePair<string, string>("grant_type", "authorization_code"),
                new KeyValuePair<string, string>("client_id", _kickSettings.ClientId),
                new KeyValuePair<string, string>("client_secret", _kickSettings.ClientSecret),
                new KeyValuePair<string, string>("redirect_uri", _kickSettings.RedirectUri),
                new KeyValuePair<string, string>("code", code),
                new KeyValuePair<string, string>("code_verifier", codeVerifier)
            };

            return PostTokenRequestAsync(fields, "intercambio de codigo");
        }

        /// <summary>
        /// Refresh. Kick ROTA el refresh_token en cada llamada (confirmado contra
        /// KickEngineering/KickDevDocs, 6 ago 2026): la respuesta siempre trae un
        /// refresh_token nuevo que reemplaza al usado, y el usado deja de servir. A diferencia
        /// del refresh de Twitch, acá no hay fallback razonable a "si no viene uno nuevo, me
        /// quedo con el viejo" — si no viene, el viejo ya esta muerto igual.
        /// </summary>
        public Task<KickTokenResponse> RefreshTokenAsync(string refreshToken)
        {
            var fields = new[]
            {
                new KeyValuePair<string, string>("grant_type", "refresh_token"),
                new KeyValuePair<string, string>("client_id", _kickSettings.ClientId),
                new KeyValuePair<string, string>("client_secret", _kickSettings.ClientSecret),
                new KeyValuePair<string, string>("refresh_token", refreshToken)
            };

            return PostTokenRequestAsync(fields, "refresh");
        }

        private async Task<KickTokenResponse> PostTokenRequestAsync(KeyValuePair<string, string>[] fields, string operacion)
        {
            HttpResponseMessage response;
            string content;

            try
            {
                var client = _httpClientFactory.CreateClient();
                response = await client.PostAsync(KickTokenUrl, new FormUrlEncodedContent(fields));
                content = await response.Content.ReadAsStringAsync();
            }
            catch (Exception ex)
            {
                // Timeout, DNS, conexion caida: no sabemos si el token es valido o no.
                throw new KickTokenException($"Error de red en {operacion} de token Kick", isTerminal: false, inner: ex);
            }

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("[KickOAuthClient] {Operacion} fallo ({Status}): {Content}", operacion, response.StatusCode, content);

                // 400/401 es Kick diciendo explicitamente "este code/refresh_token no sirve" —
                // terminal. Un 5xx es un problema del lado de Kick, no del token: no terminal.
                var isTerminal = response.StatusCode == System.Net.HttpStatusCode.BadRequest
                    || response.StatusCode == System.Net.HttpStatusCode.Unauthorized;

                throw new KickTokenException($"Kick rechazo el {operacion}: {response.StatusCode}", isTerminal);
            }

            KickTokenResponse? parsed;
            try
            {
                parsed = JsonSerializer.Deserialize<KickTokenResponse>(content);
            }
            catch (JsonException ex)
            {
                throw new KickTokenException($"Respuesta de {operacion} no se pudo parsear", isTerminal: false, inner: ex);
            }

            if (parsed == null || string.IsNullOrEmpty(parsed.AccessToken))
                throw new KickTokenException($"Respuesta de {operacion} sin access_token", isTerminal: false);

            return parsed;
        }
    }
}
