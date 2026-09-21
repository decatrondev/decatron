using System.Text.Json.Serialization;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Respuesta de <c>POST https://id.kick.com/oauth/token</c>, tanto para el intercambio
    /// inicial (<c>grant_type=authorization_code</c>) como para el refresh
    /// (<c>grant_type=refresh_token</c>) — mismo shape en los dos casos. Vive en Core (no en
    /// Decatron.Controllers, donde estaba antes) porque Decatron.Services necesita el mismo DTO
    /// para el refresh y Services no puede depender de Controllers.
    /// </summary>
    public class KickTokenResponse
    {
        [JsonPropertyName("access_token")]
        public string? AccessToken { get; set; }

        [JsonPropertyName("refresh_token")]
        public string? RefreshToken { get; set; }

        [JsonPropertyName("expires_in")]
        public int ExpiresIn { get; set; }

        [JsonPropertyName("token_type")]
        public string? TokenType { get; set; }

        [JsonPropertyName("scope")]
        public string? Scope { get; set; }
    }
}
