using Decatron.Core.Models.OAuth;

namespace Decatron.Core.Interfaces
{
    /// <summary>
    /// Request para crear una nueva aplicación OAuth
    /// </summary>
    public record CreateOAuthAppRequest(
        string Name,
        string? Description,
        string[] RedirectUris,
        string[] Scopes,
        string? IconUrl,
        string? WebsiteUrl
    );

    /// <summary>
    /// Request para actualizar una aplicación OAuth
    /// </summary>
    public record UpdateOAuthAppRequest(
        string? Name,
        string? Description,
        string[]? RedirectUris,
        string[]? Scopes,
        string? IconUrl,
        string? WebsiteUrl
    );

    /// <summary>
    /// Request para el endpoint /oauth/authorize
    /// </summary>
    public record AuthorizeRequest(
        string ClientId,
        string RedirectUri,
        string ResponseType,
        string Scope,
        string? State,
        string? CodeChallenge,
        string? CodeChallengeMethod
    );

    /// <summary>
    /// Request para el endpoint /oauth/token
    /// </summary>
    public record TokenRequest(
        string GrantType,
        string? Code,
        string? RedirectUri,
        string ClientId,
        string? ClientSecret,
        string? RefreshToken,
        string? CodeVerifier
    );

    /// <summary>
    /// Respuesta del endpoint /oauth/token (API Pública)
    /// </summary>
    public record OAuthTokenResponse(
        string AccessToken,
        string TokenType,
        int ExpiresIn,
        string? RefreshToken,
        string Scope
    );

    /// <summary>
    /// Resultado de crear una aplicación (incluye el secret en texto plano)
    /// </summary>
    public record CreateAppResult(
        OAuthApplication Application,
        string ClientSecret  // Solo disponible al crear
    );

    /// <summary>
    /// Resultado de regenerar el secret
    /// </summary>
    public record RegenerateSecretResult(
        string ClientId,
        string ClientSecret
    );

    /// <summary>
    /// Servicio para gestionar OAuth2
    /// </summary>
    public interface IOAuthService
    {
        // ═══════════════════════════════════════════════════════════════
        // GESTIÓN DE APLICACIONES
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// Crea una nueva aplicación OAuth
        /// </summary>
        Task<CreateAppResult> CreateApplicationAsync(long ownerId, CreateOAuthAppRequest request);

        /// <summary>
        /// Obtiene una aplicación por su ID
        /// </summary>
        Task<OAuthApplication?> GetApplicationAsync(Guid id);

        /// <summary>
        /// Obtiene una aplicación por su client_id
        /// </summary>
        Task<OAuthApplication?> GetApplicationByClientIdAsync(string clientId);

        /// <summary>
        /// Lista las aplicaciones de un usuario
        /// </summary>
        Task<List<OAuthApplication>> GetUserApplicationsAsync(long userId);

        /// <summary>
        /// Actualiza una aplicación
        /// </summary>
        Task<OAuthApplication?> UpdateApplicationAsync(Guid appId, long userId, UpdateOAuthAppRequest request);

        /// <summary>
        /// Regenera el client_secret de una aplicación
        /// </summary>
        Task<RegenerateSecretResult?> RegenerateSecretAsync(Guid appId, long userId);

        /// <summary>
        /// Elimina una aplicación
        /// </summary>
        Task<bool> DeleteApplicationAsync(Guid appId, long userId);

        // ═══════════════════════════════════════════════════════════════
        // FLUJO DE AUTORIZACIÓN
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// Valida los parámetros de una solicitud de autorización
        /// </summary>
        Task<(bool IsValid, string? Error, OAuthApplication? App)> ValidateAuthorizeRequestAsync(AuthorizeRequest request);

        /// <summary>
        /// Crea un código de autorización después de que el usuario aprueba
        /// </summary>
        Task<string> CreateAuthorizationCodeAsync(
            Guid applicationId,
            long userId,
            string[] scopes,
            string redirectUri,
            string? state,
            string? codeChallenge,
            string? codeChallengeMethod
        );

        /// <summary>
        /// Intercambia un código de autorización por tokens
        /// </summary>
        Task<OAuthTokenResponse?> ExchangeCodeForTokenAsync(TokenRequest request);

        /// <summary>
        /// Refresca un access token usando un refresh token
        /// </summary>
        Task<OAuthTokenResponse?> RefreshTokenAsync(string refreshToken, string clientId, string? clientSecret);

        // ═══════════════════════════════════════════════════════════════
        // VALIDACIÓN Y REVOCACIÓN
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// Valida un access token y retorna su información
        /// </summary>
        Task<OAuthAccessToken?> ValidateAccessTokenAsync(string token);

        /// <summary>
        /// Revoca un token (access o refresh)
        /// </summary>
        Task<bool> RevokeTokenAsync(string token);

        /// <summary>
        /// Revoca todos los tokens de un usuario para una aplicación
        /// </summary>
        Task<int> RevokeAllUserTokensAsync(long userId, Guid applicationId);

        /// <summary>
        /// Revoca todos los tokens de una aplicación
        /// </summary>
        Task<int> RevokeAllAppTokensAsync(Guid applicationId);

        // ═══════════════════════════════════════════════════════════════
        // VALIDACIÓN DE SCOPES
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// Verifica si los scopes solicitados son válidos para la aplicación
        /// </summary>
        bool ValidateScopesForApp(string[] requestedScopes, string[] appScopes);

        /// <summary>
        /// Verifica si los scopes otorgados incluyen todos los requeridos
        /// </summary>
        bool ValidateScopesGranted(string[] requiredScopes, string[] grantedScopes);

        // ═══════════════════════════════════════════════════════════════
        // ESTADÍSTICAS
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// Obtiene estadísticas de uso de una aplicación
        /// </summary>
        Task<OAuthAppStats?> GetAppStatsAsync(Guid appId);
    }

    /// <summary>
    /// Estadísticas de una aplicación OAuth
    /// </summary>
    public record OAuthAppStats(
        Guid AppId,
        string AppName,
        int UniqueUsers,
        int TotalTokens,
        int ActiveTokens,
        DateTime? LastTokenAt
    );
}
