using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Decatron.Core.Interfaces;
using Decatron.Core.Models.OAuth;
using Decatron.Data;
using Decatron.OAuth.Scopes;

namespace Decatron.Services
{
    /// <summary>
    /// Implementación del servicio OAuth2 para Decatron.
    /// Maneja todo el flujo de autorización, generación de tokens y validación.
    /// </summary>
    public class OAuthService : IOAuthService
    {
        private readonly DecatronDbContext _db;
        private readonly ILogger<OAuthService> _logger;

        // Configuración de expiración
        private const int AuthCodeExpirationMinutes = 10;
        private const int AccessTokenExpirationHours = 1;
        private const int RefreshTokenExpirationDays = 30;

        public OAuthService(DecatronDbContext db, ILogger<OAuthService> logger)
        {
            _db = db;
            _logger = logger;
        }

        // ═══════════════════════════════════════════════════════════════════
        // GESTIÓN DE APLICACIONES
        // ═══════════════════════════════════════════════════════════════════

        public async Task<CreateAppResult> CreateApplicationAsync(long ownerId, CreateOAuthAppRequest request)
        {
            // Validar scopes
            var validScopes = DecatronScopes.FilterValid(request.Scopes);
            if (validScopes.Length == 0)
            {
                throw new ArgumentException("At least one valid scope is required");
            }

            // Generar client_id y client_secret
            var clientId = GenerateClientId();
            var clientSecret = GenerateClientSecret();
            var clientSecretHash = HashSecret(clientSecret);

            var app = new OAuthApplication
            {
                Id = Guid.NewGuid(),
                OwnerId = ownerId,
                Name = request.Name,
                Description = request.Description,
                ClientId = clientId,
                ClientSecretHash = clientSecretHash,
                RedirectUris = request.RedirectUris,
                Scopes = validScopes,
                IconUrl = request.IconUrl,
                WebsiteUrl = request.WebsiteUrl,
                IsActive = true,
                IsVerified = false,
                CreatedAt = DateTime.UtcNow
            };

            _db.OAuthApplications.Add(app);
            await _db.SaveChangesAsync();

            _logger.LogInformation("OAuth app created: {AppId} ({AppName}) by user {UserId}",
                app.Id, app.Name, ownerId);

            return new CreateAppResult(app, clientSecret);
        }

        public async Task<OAuthApplication?> GetApplicationAsync(Guid id)
        {
            return await _db.OAuthApplications
                .Include(a => a.Owner)
                .FirstOrDefaultAsync(a => a.Id == id);
        }

        public async Task<OAuthApplication?> GetApplicationByClientIdAsync(string clientId)
        {
            return await _db.OAuthApplications
                .Include(a => a.Owner)
                .FirstOrDefaultAsync(a => a.ClientId == clientId && a.IsActive);
        }

        public async Task<List<OAuthApplication>> GetUserApplicationsAsync(long userId)
        {
            return await _db.OAuthApplications
                .Where(a => a.OwnerId == userId)
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();
        }

        public async Task<OAuthApplication?> UpdateApplicationAsync(Guid appId, long userId, UpdateOAuthAppRequest request)
        {
            var app = await _db.OAuthApplications
                .FirstOrDefaultAsync(a => a.Id == appId && a.OwnerId == userId);

            if (app == null) return null;

            if (request.Name != null) app.Name = request.Name;
            if (request.Description != null) app.Description = request.Description;
            if (request.RedirectUris != null) app.RedirectUris = request.RedirectUris;
            if (request.Scopes != null) app.Scopes = DecatronScopes.FilterValid(request.Scopes);
            if (request.IconUrl != null) app.IconUrl = request.IconUrl;
            if (request.WebsiteUrl != null) app.WebsiteUrl = request.WebsiteUrl;

            app.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            _logger.LogInformation("OAuth app updated: {AppId}", appId);

            return app;
        }

        public async Task<RegenerateSecretResult?> RegenerateSecretAsync(Guid appId, long userId)
        {
            var app = await _db.OAuthApplications
                .FirstOrDefaultAsync(a => a.Id == appId && a.OwnerId == userId);

            if (app == null) return null;

            var newSecret = GenerateClientSecret();
            app.ClientSecretHash = HashSecret(newSecret);
            app.UpdatedAt = DateTime.UtcNow;

            // Revocar todos los tokens existentes por seguridad
            await RevokeAllAppTokensAsync(appId);

            await _db.SaveChangesAsync();

            _logger.LogWarning("OAuth app secret regenerated: {AppId}. All tokens revoked.", appId);

            return new RegenerateSecretResult(app.ClientId, newSecret);
        }

        public async Task<bool> DeleteApplicationAsync(Guid appId, long userId)
        {
            var app = await _db.OAuthApplications
                .FirstOrDefaultAsync(a => a.Id == appId && a.OwnerId == userId);

            if (app == null) return false;

            // Los tokens se eliminan en cascada por FK
            _db.OAuthApplications.Remove(app);
            await _db.SaveChangesAsync();

            _logger.LogWarning("OAuth app deleted: {AppId} ({AppName})", appId, app.Name);

            return true;
        }

        // ═══════════════════════════════════════════════════════════════════
        // FLUJO DE AUTORIZACIÓN
        // ═══════════════════════════════════════════════════════════════════

        public async Task<(bool IsValid, string? Error, OAuthApplication? App)> ValidateAuthorizeRequestAsync(AuthorizeRequest request)
        {
            // 1. Validar response_type
            if (request.ResponseType != "code")
            {
                return (false, "unsupported_response_type", null);
            }

            // 2. Buscar aplicación
            var app = await GetApplicationByClientIdAsync(request.ClientId);
            if (app == null)
            {
                return (false, "invalid_client", null);
            }

            // 3. Validar redirect_uri
            if (!app.RedirectUris.Contains(request.RedirectUri))
            {
                return (false, "invalid_redirect_uri", null);
            }

            // 4. Validar scopes
            var requestedScopes = DecatronScopes.Parse(request.Scope);
            if (!ValidateScopesForApp(requestedScopes, app.Scopes))
            {
                return (false, "invalid_scope", null);
            }

            // 5. Validar PKCE si se proporciona
            if (!string.IsNullOrEmpty(request.CodeChallenge))
            {
                if (request.CodeChallengeMethod != "S256" && request.CodeChallengeMethod != "plain")
                {
                    return (false, "invalid_code_challenge_method", null);
                }
            }

            return (true, null, app);
        }

        public async Task<string> CreateAuthorizationCodeAsync(
            Guid applicationId,
            long userId,
            string[] scopes,
            string redirectUri,
            string? state,
            string? codeChallenge,
            string? codeChallengeMethod)
        {
            var code = GenerateSecureToken();

            var authCode = new OAuthAuthorizationCode
            {
                Id = Guid.NewGuid(),
                Code = code,
                ApplicationId = applicationId,
                UserId = userId,
                Scopes = scopes,
                RedirectUri = redirectUri,
                State = state,
                CodeChallenge = codeChallenge,
                CodeChallengeMethod = codeChallengeMethod,
                ExpiresAt = DateTime.UtcNow.AddMinutes(AuthCodeExpirationMinutes),
                Used = false,
                CreatedAt = DateTime.UtcNow
            };

            _db.OAuthAuthorizationCodes.Add(authCode);
            await _db.SaveChangesAsync();

            _logger.LogInformation("Auth code created for app {AppId}, user {UserId}",
                applicationId, userId);

            return code;
        }

        public async Task<OAuthTokenResponse?> ExchangeCodeForTokenAsync(TokenRequest request)
        {
            // 1. Buscar y validar el código
            var authCode = await _db.OAuthAuthorizationCodes
                .Include(c => c.Application)
                .FirstOrDefaultAsync(c => c.Code == request.Code && !c.Used);

            if (authCode == null || authCode.IsExpired)
            {
                _logger.LogWarning("Invalid or expired auth code: {Code}", request.Code);
                return null;
            }

            // 2. Validar client_id
            if (authCode.Application?.ClientId != request.ClientId)
            {
                _logger.LogWarning("Client ID mismatch for code {Code}", request.Code);
                return null;
            }

            // 3. Validar client_secret O PKCE
            // Si se usó PKCE (code_challenge presente), no requerimos client_secret
            // Si no se usó PKCE, client_secret es obligatorio
            bool usingPKCE = !string.IsNullOrEmpty(authCode.CodeChallenge);

            if (!usingPKCE)
            {
                // Sin PKCE, client_secret es obligatorio
                if (authCode.Application == null || !VerifySecret(request.ClientSecret, authCode.Application.ClientSecretHash))
                {
                    _logger.LogWarning("Invalid client secret for code {Code}", request.Code);
                    return null;
                }
            }

            // 4. Validar redirect_uri
            if (authCode.RedirectUri != request.RedirectUri)
            {
                _logger.LogWarning("Redirect URI mismatch for code {Code}", request.Code);
                return null;
            }

            // 5. Validar PKCE si se usó
            if (!string.IsNullOrEmpty(authCode.CodeChallenge))
            {
                if (string.IsNullOrEmpty(request.CodeVerifier))
                {
                    _logger.LogWarning("Missing code verifier for code {Code}", request.Code);
                    return null;
                }

                if (!VerifyCodeChallenge(request.CodeVerifier, authCode.CodeChallenge, authCode.CodeChallengeMethod))
                {
                    _logger.LogWarning("Invalid code verifier for code {Code}", request.Code);
                    return null;
                }
            }

            // 6. Marcar código como usado
            authCode.Used = true;

            // 7. Crear access token
            var accessToken = new OAuthAccessToken
            {
                Id = Guid.NewGuid(),
                Token = GenerateSecureToken(),
                ApplicationId = authCode.ApplicationId,
                UserId = authCode.UserId,
                Scopes = authCode.Scopes,
                ExpiresAt = DateTime.UtcNow.AddHours(AccessTokenExpirationHours),
                CreatedAt = DateTime.UtcNow
            };

            // 8. Crear refresh token
            var refreshToken = new OAuthRefreshToken
            {
                Id = Guid.NewGuid(),
                Token = GenerateSecureToken(),
                AccessTokenId = accessToken.Id,
                ExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenExpirationDays),
                CreatedAt = DateTime.UtcNow
            };

            _db.OAuthAccessTokens.Add(accessToken);
            _db.OAuthRefreshTokens.Add(refreshToken);
            await _db.SaveChangesAsync();

            _logger.LogInformation("Tokens created for app {AppId}, user {UserId}",
                authCode.ApplicationId, authCode.UserId);

            return new OAuthTokenResponse(
                AccessToken: accessToken.Token,
                TokenType: "Bearer",
                ExpiresIn: AccessTokenExpirationHours * 3600,
                RefreshToken: refreshToken.Token,
                Scope: DecatronScopes.Join(authCode.Scopes)
            );
        }

        public async Task<OAuthTokenResponse?> RefreshTokenAsync(string refreshToken, string clientId, string? clientSecret)
        {
            // 1. Buscar refresh token
            var refresh = await _db.OAuthRefreshTokens
                .Include(r => r.AccessToken)
                    .ThenInclude(a => a!.Application)
                .FirstOrDefaultAsync(r => r.Token == refreshToken && !r.Revoked);

            if (refresh == null || refresh.IsExpired)
            {
                _logger.LogWarning("Invalid or expired refresh token");
                return null;
            }

            var app = refresh.AccessToken?.Application;
            if (app == null || app.ClientId != clientId)
            {
                _logger.LogWarning("Client ID mismatch for refresh token");
                return null;
            }

            // 2. Validar client_secret
            if (!VerifySecret(clientSecret, app.ClientSecretHash))
            {
                _logger.LogWarning("Invalid client secret for refresh");
                return null;
            }

            // 3. Revocar tokens antiguos
            if (refresh.AccessToken != null)
            {
                refresh.AccessToken.Revoked = true;
                refresh.AccessToken.RevokedReason = "Refreshed";
            }
            refresh.Revoked = true;
            refresh.UsedAt = DateTime.UtcNow;

            // 4. Crear nuevos tokens
            var newAccessToken = new OAuthAccessToken
            {
                Id = Guid.NewGuid(),
                Token = GenerateSecureToken(),
                ApplicationId = app.Id,
                UserId = refresh.AccessToken?.UserId ?? 0,
                Scopes = refresh.AccessToken?.Scopes ?? Array.Empty<string>(),
                ExpiresAt = DateTime.UtcNow.AddHours(AccessTokenExpirationHours),
                CreatedAt = DateTime.UtcNow
            };

            var newRefreshToken = new OAuthRefreshToken
            {
                Id = Guid.NewGuid(),
                Token = GenerateSecureToken(),
                AccessTokenId = newAccessToken.Id,
                ExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenExpirationDays),
                CreatedAt = DateTime.UtcNow
            };

            _db.OAuthAccessTokens.Add(newAccessToken);
            _db.OAuthRefreshTokens.Add(newRefreshToken);
            await _db.SaveChangesAsync();

            _logger.LogInformation("Tokens refreshed for app {AppId}", app.Id);

            return new OAuthTokenResponse(
                AccessToken: newAccessToken.Token,
                TokenType: "Bearer",
                ExpiresIn: AccessTokenExpirationHours * 3600,
                RefreshToken: newRefreshToken.Token,
                Scope: DecatronScopes.Join(newAccessToken.Scopes)
            );
        }

        // ═══════════════════════════════════════════════════════════════════
        // VALIDACIÓN Y REVOCACIÓN
        // ═══════════════════════════════════════════════════════════════════

        public async Task<OAuthAccessToken?> ValidateAccessTokenAsync(string token)
        {
            var accessToken = await _db.OAuthAccessTokens
                .Include(t => t.Application)
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.Token == token);

            if (accessToken == null)
            {
                return null;
            }

            if (!accessToken.IsValid)
            {
                return null;
            }

            // Verificar que la aplicación sigue activa
            if (accessToken.Application?.IsActive != true)
            {
                return null;
            }

            return accessToken;
        }

        public async Task<bool> RevokeTokenAsync(string token)
        {
            // Intentar revocar como access token
            var accessToken = await _db.OAuthAccessTokens
                .FirstOrDefaultAsync(t => t.Token == token);

            if (accessToken != null)
            {
                accessToken.Revoked = true;
                accessToken.RevokedReason = "User revoked";

                // También revocar el refresh token asociado
                var refreshToken = await _db.OAuthRefreshTokens
                    .FirstOrDefaultAsync(r => r.AccessTokenId == accessToken.Id);
                if (refreshToken != null)
                {
                    refreshToken.Revoked = true;
                }

                await _db.SaveChangesAsync();
                _logger.LogInformation("Access token revoked: {TokenId}", accessToken.Id);
                return true;
            }

            // Intentar revocar como refresh token
            var refresh = await _db.OAuthRefreshTokens
                .Include(r => r.AccessToken)
                .FirstOrDefaultAsync(r => r.Token == token);

            if (refresh != null)
            {
                refresh.Revoked = true;
                if (refresh.AccessToken != null)
                {
                    refresh.AccessToken.Revoked = true;
                    refresh.AccessToken.RevokedReason = "Refresh token revoked";
                }

                await _db.SaveChangesAsync();
                _logger.LogInformation("Refresh token revoked: {TokenId}", refresh.Id);
                return true;
            }

            return false;
        }

        public async Task<int> RevokeAllUserTokensAsync(long userId, Guid applicationId)
        {
            var tokens = await _db.OAuthAccessTokens
                .Where(t => t.UserId == userId && t.ApplicationId == applicationId && !t.Revoked)
                .ToListAsync();

            foreach (var token in tokens)
            {
                token.Revoked = true;
                token.RevokedReason = "User revoked all tokens";
            }

            await _db.SaveChangesAsync();

            _logger.LogInformation("Revoked {Count} tokens for user {UserId} on app {AppId}",
                tokens.Count, userId, applicationId);

            return tokens.Count;
        }

        public async Task<int> RevokeAllAppTokensAsync(Guid applicationId)
        {
            var tokens = await _db.OAuthAccessTokens
                .Where(t => t.ApplicationId == applicationId && !t.Revoked)
                .ToListAsync();

            foreach (var token in tokens)
            {
                token.Revoked = true;
                token.RevokedReason = "App tokens revoked";
            }

            await _db.SaveChangesAsync();

            _logger.LogWarning("Revoked all {Count} tokens for app {AppId}", tokens.Count, applicationId);

            return tokens.Count;
        }

        // ═══════════════════════════════════════════════════════════════════
        // VALIDACIÓN DE SCOPES
        // ═══════════════════════════════════════════════════════════════════

        public bool ValidateScopesForApp(string[] requestedScopes, string[] appScopes)
        {
            // Todos los scopes solicitados deben estar permitidos para la app
            return requestedScopes.All(s => appScopes.Contains(s));
        }

        public bool ValidateScopesGranted(string[] requiredScopes, string[] grantedScopes)
        {
            return requiredScopes.All(s => grantedScopes.Contains(s));
        }

        // ═══════════════════════════════════════════════════════════════════
        // ESTADÍSTICAS
        // ═══════════════════════════════════════════════════════════════════

        public async Task<OAuthAppStats?> GetAppStatsAsync(Guid appId)
        {
            var app = await _db.OAuthApplications.FindAsync(appId);
            if (app == null) return null;

            var tokens = await _db.OAuthAccessTokens
                .Where(t => t.ApplicationId == appId)
                .ToListAsync();

            var now = DateTime.UtcNow;

            return new OAuthAppStats(
                AppId: appId,
                AppName: app.Name,
                UniqueUsers: tokens.Select(t => t.UserId).Distinct().Count(),
                TotalTokens: tokens.Count,
                ActiveTokens: tokens.Count(t => !t.Revoked && t.ExpiresAt > now),
                LastTokenAt: tokens.OrderByDescending(t => t.CreatedAt).FirstOrDefault()?.CreatedAt
            );
        }

        // ═══════════════════════════════════════════════════════════════════
        // HELPERS PRIVADOS
        // ═══════════════════════════════════════════════════════════════════

        /// <summary>
        /// Genera un client_id único (deca_ + 20 chars)
        /// </summary>
        private static string GenerateClientId()
        {
            return "deca_" + GenerateRandomString(20);
        }

        /// <summary>
        /// Genera un client_secret (deca_secret_ + 40 chars)
        /// </summary>
        private static string GenerateClientSecret()
        {
            return "deca_secret_" + GenerateRandomString(40);
        }

        /// <summary>
        /// Genera un token seguro (64 chars)
        /// </summary>
        private static string GenerateSecureToken()
        {
            // Generar 48 bytes para asegurar al menos 64 caracteres base64
            var bytes = new byte[48];
            RandomNumberGenerator.Fill(bytes);
            var token = Convert.ToBase64String(bytes)
                .Replace("+", "-")  // URL-safe
                .Replace("/", "_")  // URL-safe
                .Replace("=", "");  // Remove padding
            // Tomar los primeros 64 caracteres (o menos si no hay suficientes)
            return token.Length > 64 ? token.Substring(0, 64) : token;
        }

        /// <summary>
        /// Genera un string random de longitud específica
        /// </summary>
        private static string GenerateRandomString(int length)
        {
            const string chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            var bytes = new byte[length];
            RandomNumberGenerator.Fill(bytes);
            return new string(bytes.Select(b => chars[b % chars.Length]).ToArray());
        }

        /// <summary>
        /// Hashea un secret con BCrypt
        /// </summary>
        private static string HashSecret(string secret)
        {
            return BCrypt.Net.BCrypt.HashPassword(secret);
        }

        /// <summary>
        /// Verifica un secret contra su hash
        /// </summary>
        private static bool VerifySecret(string? secret, string hash)
        {
            if (string.IsNullOrEmpty(secret)) return false;
            return BCrypt.Net.BCrypt.Verify(secret, hash);
        }

        /// <summary>
        /// Verifica el code_verifier contra el code_challenge (PKCE)
        /// </summary>
        private static bool VerifyCodeChallenge(string codeVerifier, string codeChallenge, string? method)
        {
            if (method == "plain")
            {
                return codeVerifier == codeChallenge;
            }

            // S256: SHA256(verifier) base64url encoded
            using var sha256 = SHA256.Create();
            var hash = sha256.ComputeHash(Encoding.ASCII.GetBytes(codeVerifier));
            var computed = Convert.ToBase64String(hash)
                .Replace("+", "-")
                .Replace("/", "_")
                .Replace("=", "");

            return computed == codeChallenge;
        }
    }
}
