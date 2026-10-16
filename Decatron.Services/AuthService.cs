using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Core.Settings;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;
using Npgsql;
using System.Security.Cryptography;
using System.Text;


namespace Decatron.Services
{
    public class AuthService : IAuthService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IUserRepository _userRepository;
        private readonly ISettingsService _settingsService;
        private readonly ILanguageService _languageService;
        private readonly Decatron.Core.Interfaces.ICredentialProvider _credentials;
        private readonly JwtSettings _jwtSettings;
        private readonly ILogger<AuthService> _logger;
        private readonly DecatronDbContext _dbContext;
        private readonly UsernameUpdateService _usernameUpdateService;

        private readonly Decatron.Services.Tenancy.TenantMembership? _membership;

        public AuthService(
            IHttpClientFactory httpClientFactory,
            IUserRepository userRepository,
            ISettingsService settingsService,
            ILanguageService languageService,
            Decatron.Core.Interfaces.ICredentialProvider credentials,
            IOptions<JwtSettings> jwtSettings,
            ILogger<AuthService> logger,
            DecatronDbContext dbContext,
            UsernameUpdateService usernameUpdateService,
            Decatron.Services.Tenancy.TenantMembership? membership = null)
        {
            _membership = membership;
            _httpClientFactory = httpClientFactory;
            _userRepository = userRepository;
            _settingsService = settingsService;
            _languageService = languageService;
            _credentials = credentials;
            _jwtSettings = jwtSettings.Value;
            _logger = logger;
            _dbContext = dbContext;
            _usernameUpdateService = usernameUpdateService;
        }

        /// <summary>Permisos extra para moderar el chat desde el Multi-view; solo se piden a quien los necesita.</summary>
        /// <summary>Permisos de la cuenta de bot de un tenant: leer/escribir chat, actuar como bot y moderar (timeout, borrar mensajes: !ruleta, filtros, pánico).</summary>
        public const string BotScopes = "user:read:chat user:write:chat user:bot moderator:manage:chat_messages moderator:manage:banned_users";

        public const string ModerationScopes = "moderator:manage:chat_messages moderator:manage:banned_users";

        public string GetLoginUrl(string? redirect = null, bool withModeration = false, long? tenantId = null, bool bot = false)
        {
            // Plataforma, Fase 4 (paso 5): con tenant (>1) el login usa la app de Twitch de ese tenant y el tenant viaja firmado en el state.
            // Si el tenant no tiene app cargada, GetTwitchApp() lanza CredentialsNotConfiguredException (falla cerrado).
            long? tn = tenantId is > 1 ? tenantId : null;
            using var _scope = tn is long t ? TenantAmbient.Push(t) : null;
            var state = GenerateSignedOAuthState(redirect, tn, bot && tn is not null);
            // Cuenta de bot del tenant: solo los permisos para escribir en el chat como bot, nada de moderacion ni del resto.
            var scopes = bot && tn is not null ? BotScopes
                : withModeration ? $"{_credentials.GetTwitchApp().Scopes} {ModerationScopes}" : _credentials.GetTwitchApp().Scopes;

            var loginUrl = $"https://id.twitch.tv/oauth2/authorize" +
                $"?client_id={_credentials.GetTwitchApp().ClientId}" +
                $"&redirect_uri={Uri.EscapeDataString(_credentials.GetTwitchApp().RedirectUri)}" +
                $"&response_type=code" +
                $"&scope={Uri.EscapeDataString(scopes)}" +
                $"&state={Uri.EscapeDataString(state)}";

            _logger.LogInformation("Generated login URL for Twitch (redirect: {Redirect})", redirect ?? "none");
            return loginUrl;
        }

        /// <summary>
        /// Generates an HMAC-signed OAuth state parameter.
        /// Format: base64payload.signature
        /// Payload JSON: {"redirect":"...","ts":unix_timestamp}
        /// </summary>
        private string GenerateSignedOAuthState(string? redirect, long? tenantId = null, bool bot = false) => SignOAuthState(redirect, tenantId, _jwtSettings.SecretKey, bot);

        public static string SignOAuthState(string? redirect, long? tenantId, string secretKey, bool bot = false)
        {
            var payload = new
            {
                redirect = redirect ?? "",
                ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                tn = tenantId ?? 0L,
                bt = bot ? 1 : 0
            };

            var payloadJson = JsonConvert.SerializeObject(payload);
            var payloadBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(payloadJson));
            var signature = ComputeHmacSha256(payloadBase64, secretKey);

            return $"{payloadBase64}.{signature}";
        }

        /// <summary>
        /// Validates an HMAC-signed OAuth state parameter.
        /// Returns the redirect path if valid, null if invalid or expired.
        /// </summary>
        public static (bool IsValid, string? Redirect) ValidateOAuthState(string state, string secretKey, int maxAgeMinutes = 10)
        {
            var (ok, redirect, _) = ValidateOAuthStateWithTenant(state, secretKey, maxAgeMinutes);
            return (ok, redirect);
        }

        /// <summary>Igual que <see cref="ValidateOAuthState"/> y además devuelve el tenant firmado en el state (null = el #1 / sin tenant).</summary>
        public static (bool IsValid, string? Redirect, long? TenantId) ValidateOAuthStateWithTenant(string state, string secretKey, int maxAgeMinutes = 10)
        {
            var (ok, redirect, tenant, _) = ValidateOAuthStateFull(state, secretKey, maxAgeMinutes);
            return (ok, redirect, tenant);
        }

        /// <summary>Igual y además indica si el state es de la autorización de la cuenta de bot de un tenant.</summary>
        public static (bool IsValid, string? Redirect, long? TenantId, bool Bot) ValidateOAuthStateFull(string state, string secretKey, int maxAgeMinutes = 10)
        {
            if (string.IsNullOrEmpty(state))
                return (false, null, null, false);

            var dotIndex = state.IndexOf('.');
            if (dotIndex < 0 || dotIndex == state.Length - 1)
                return (false, null, null, false);

            var payloadBase64 = state.Substring(0, dotIndex);
            var signature = state.Substring(dotIndex + 1);

            // Verify HMAC signature
            var expectedSignature = ComputeHmacSha256(payloadBase64, secretKey);
            if (!CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(signature),
                    Encoding.UTF8.GetBytes(expectedSignature)))
            {
                return (false, null, null, false);
            }

            // Decode and parse payload
            try
            {
                var payloadJson = Encoding.UTF8.GetString(Convert.FromBase64String(payloadBase64));
                var payload = JsonConvert.DeserializeAnonymousType(payloadJson, new { redirect = "", ts = 0L, tn = 0L, bt = 0 });

                if (payload == null)
                    return (false, null, null, false);

                // Check timestamp is within allowed window
                var stateTime = DateTimeOffset.FromUnixTimeSeconds(payload.ts);
                if (DateTimeOffset.UtcNow - stateTime > TimeSpan.FromMinutes(maxAgeMinutes))
                    return (false, null, null, false);

                return (true, string.IsNullOrEmpty(payload.redirect) ? null : payload.redirect, payload.tn > 1 ? payload.tn : null, payload.bt == 1 && payload.tn > 1);
            }
            catch
            {
                return (false, null, null, false);
            }
        }

        private static string ComputeHmacSha256(string data, string key)
        {
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
            var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
            return Convert.ToBase64String(hash);
        }

        public async Task<TokenResponse> ExchangeCodeForTokenAsync(string code)
        {
            if (string.IsNullOrEmpty(code))
            {
                throw new ArgumentException("Authorization code is required");
            }

            try
            {
                var client = _httpClientFactory.CreateClient();
                var requestBody = new Dictionary<string, string>
                {
                    { "client_id", _credentials.GetTwitchApp().ClientId },
                    { "client_secret", _credentials.GetTwitchApp().ClientSecret },
                    { "code", code },
                    { "grant_type", "authorization_code" },
                    { "redirect_uri", _credentials.GetTwitchApp().RedirectUri }
                };

                var content = new FormUrlEncodedContent(requestBody);
                var response = await Core.Helpers.TwitchAuthHelper.PostWithFallbackAsync(client, "/oauth2/token", content, _logger);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to exchange code for token: {StatusCode} - {ErrorContent}", response.StatusCode, errorContent);
                    throw new Exception($"Failed to obtain token: {response.StatusCode}");
                }

                var responseContent = await response.Content.ReadAsStringAsync();
                var tokenResponse = JsonConvert.DeserializeObject<TokenResponse>(responseContent);

                _logger.LogInformation("Successfully exchanged code for token");
                return tokenResponse;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exchanging code for token");
                throw;
            }
        }

        public async Task<TwitchUser> GetUserInfoAsync(string accessToken)
        {
            if (string.IsNullOrEmpty(accessToken))
            {
                throw new ArgumentException("Access token is required");
            }

            try
            {
                var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {accessToken}");
                client.DefaultRequestHeaders.Add("Client-ID", _credentials.GetTwitchApp().ClientId);

                var response = await client.GetAsync("https://api.twitch.tv/helix/users");

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Failed to get user info: {StatusCode}", response.StatusCode);
                    throw new Exception($"Failed to get user information: {response.StatusCode}");
                }

                var content = await response.Content.ReadAsStringAsync();
                var userResponse = JsonConvert.DeserializeObject<TwitchUserResponse>(content);

                if (userResponse?.Data == null || userResponse.Data.Length == 0)
                {
                    throw new Exception("No user data found");
                }

                _logger.LogInformation("Retrieved user info for {Login}", userResponse.Data[0].Login);
                return userResponse.Data[0];
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user information");
                throw;
            }
        }

        public async Task<User> AuthenticateUserAsync(TwitchUser twitchUser, TokenResponse tokenResponse, string? acceptLanguage = null)
        {
            try
            {
                var user = await _userRepository.GetByTwitchIdAsync(twitchUser.Id);

                if (user != null)
                {
                    // Update existing user
                    user.AccessToken = tokenResponse.AccessToken;
                    user.RefreshToken = tokenResponse.RefreshToken;
                    user.TokenExpiration = DateTime.UtcNow.AddSeconds(tokenResponse.ExpiresIn);
                    user.UpdatedAt = DateTime.UtcNow;
                    user.IsActive = true;
                    user.DisplayName = twitchUser.DisplayName;
                    user.Email = twitchUser.Email;
                    user.ProfileImageUrl = twitchUser.ProfileImageUrl;
                    user.OfflineImageUrl = twitchUser.OfflineImageUrl;
                    user.ViewCount = twitchUser.ViewCount;
                    user.Description = twitchUser.Description;

                    // Note: We do NOT update language preference for existing users
                    // Their preference should remain as-is

                    // Detect username change and propagate across all tables
                    var newLoginLower = twitchUser.Login.ToLower();
                    if (!user.Login.Equals(newLoginLower, StringComparison.OrdinalIgnoreCase))
                    {
                        try
                        {
                            await _usernameUpdateService.DetectAndPropagateAsync(
                                user.Id, user.Login, newLoginLower, "auth");
                            user.Login = newLoginLower;
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Failed to propagate username change for user {UserId}, continuing login", user.Id);
                            // Don't block login if propagation fails
                        }
                    }

                    user = await _userRepository.UpdateAsync(user);
                    _logger.LogInformation("Updated existing user: {Login}", user.Login);
                }
                else
                {
                    // Detect language for new user
                    string? detectedLanguage = null;
                    if (!string.IsNullOrWhiteSpace(acceptLanguage))
                    {
                        detectedLanguage = _languageService.ParseAcceptLanguageHeader(acceptLanguage);
                        _logger.LogInformation("Detected language {DetectedLanguage} from header for new user {Login}", detectedLanguage, twitchUser.Login);
                    }

                    // Cuenta nueva para esta persona — ver Add_Accounts_Table.sql.
                    var account = new Account { CreatedAt = DateTime.UtcNow };
                    _dbContext.Accounts.Add(account);
                    await _dbContext.SaveChangesAsync();

                    // Create new user
                    user = new User
                    {
                        AccountId = account.Id,
                        TwitchId = twitchUser.Id,
                        Login = twitchUser.Login,
                        DisplayName = twitchUser.DisplayName,
                        Email = twitchUser.Email,
                        ProfileImageUrl = twitchUser.ProfileImageUrl,
                        OfflineImageUrl = twitchUser.OfflineImageUrl,
                        BroadcasterType = twitchUser.BroadcasterType,
                        ViewCount = twitchUser.ViewCount,
                        Description = twitchUser.Description,
                        AccessToken = tokenResponse.AccessToken,
                        RefreshToken = tokenResponse.RefreshToken,
                        TokenExpiration = DateTime.UtcNow.AddSeconds(tokenResponse.ExpiresIn),
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow,
                        IsActive = true,
                        UniqueId = UniqueIdGenerator.Generate(),
                        PreferredLanguage = detectedLanguage,
                        LanguagePreferenceUpdatedAt = detectedLanguage != null ? DateTime.UtcNow : null
                    };

                    user = await _userRepository.CreateAsync(user);
                    _logger.LogInformation("Created new user: {Login}", user.Login);

                    // Plataforma: todo usuario nuevo necesita su fila de canal; sin ella el resolutor la marca ambigua (tenant.ambiguous). Los del #1 no entran a tenant_members (solo el dueno).
                    if (_membership is not null)
                    {
                        var newUserTenant = TenantAmbient.Current ?? 1;
                        await _membership.EnsureChannelAsync(newUserTenant, user.Id, user.TwitchId, user.Login, default, addMember: newUserTenant > 1);
                    }

                    // Asignar tier 'free' al nuevo usuario
                    try
                    {
                        var connection = _dbContext.Database.GetDbConnection();
                        if (connection.State != System.Data.ConnectionState.Open)
                            await connection.OpenAsync();

                        using var tierCmd = connection.CreateCommand();
                        tierCmd.CommandText = @"
                            INSERT INTO user_subscription_tiers (user_id, tier, tier_started_at, source, notes)
                            VALUES (@userId, 'free', NOW(), 'auto_register', 'Asignado automáticamente al registrarse')
                            ON CONFLICT (tenant_id, user_id) DO NOTHING";
                        tierCmd.Parameters.Add(new NpgsqlParameter("@userId", user.Id));
                        await tierCmd.ExecuteNonQueryAsync();
                        _logger.LogInformation("Tier free assigned to new user {Login}", user.Login);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error assigning tier to new user {Login}", user.Login);
                        // No bloquear el login
                    }

                    // IMPORTANTE: Crear configuración por defecto con BotEnabled=true
                    try
                    {
                        await _settingsService.CreateDefaultSettingsAsync(user.Id);
                        _logger.LogInformation("Default settings created for new user {Login} with BotEnabled=true", user.Login);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error creating default settings for new user {Login}", user.Login);
                        // No lanzar excepción para no bloquear el login
                    }
                }

                return user;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error authenticating user");
                throw;
            }
        }

        public async Task<User> GetUserByIdAsync(long userId)
        {
            try
            {
                return await _userRepository.GetByIdAsync(userId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user by ID {UserId}", userId);
                return null;
            }
        }

        public async Task<User> GetUserByLoginAsync(string login)
        {
            return await _userRepository.GetByLoginAsync(login);
        }

        public async Task<bool> ValidateTokenAsync(string accessToken)
        {
            if (string.IsNullOrEmpty(accessToken))
            {
                return false;
            }

            try
            {
                var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Add("Authorization", $"OAuth {accessToken}");

                var response = await Core.Helpers.TwitchAuthHelper.GetWithFallbackAsync(client, "/oauth2/validate", _logger);
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating token");
                return false;
            }
        }

        public async Task<TokenResponse> RefreshTokenAsync(string refreshToken)
        {
            if (string.IsNullOrEmpty(refreshToken))
            {
                throw new ArgumentException("Refresh token is required");
            }

            try
            {
                var client = _httpClientFactory.CreateClient();
                var requestBody = new Dictionary<string, string>
                {
                    { "client_id", _credentials.GetTwitchApp().ClientId },
                    { "client_secret", _credentials.GetTwitchApp().ClientSecret },
                    { "grant_type", "refresh_token" },
                    { "refresh_token", refreshToken }
                };

                var content = new FormUrlEncodedContent(requestBody);
                var response = await Core.Helpers.TwitchAuthHelper.PostWithFallbackAsync(client, "/oauth2/token", content, _logger);

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to refresh token: {StatusCode} — {Error}", response.StatusCode, errorBody);
                    throw new Exception($"Failed to refresh token: {response.StatusCode} — {errorBody}");
                }

                var responseContent = await response.Content.ReadAsStringAsync();
                var tokenResponse = JsonConvert.DeserializeObject<TokenResponse>(responseContent);

                _logger.LogInformation("Token refreshed successfully");
                return tokenResponse;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error refreshing token");
                throw;
            }
        }
    }
}