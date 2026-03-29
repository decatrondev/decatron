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
        private readonly TwitchSettings _twitchSettings;
        private readonly JwtSettings _jwtSettings;
        private readonly ILogger<AuthService> _logger;
        private readonly DecatronDbContext _dbContext;

        public AuthService(
            IHttpClientFactory httpClientFactory,
            IUserRepository userRepository,
            ISettingsService settingsService,
            ILanguageService languageService,
            IOptions<TwitchSettings> twitchSettings,
            IOptions<JwtSettings> jwtSettings,
            ILogger<AuthService> logger,
            DecatronDbContext dbContext)
        {
            _httpClientFactory = httpClientFactory;
            _userRepository = userRepository;
            _settingsService = settingsService;
            _languageService = languageService;
            _twitchSettings = twitchSettings.Value;
            _jwtSettings = jwtSettings.Value;
            _logger = logger;
            _dbContext = dbContext;
        }

        public string GetLoginUrl(string? redirect = null)
        {
            var state = GenerateSignedOAuthState(redirect);

            var loginUrl = $"https://id.twitch.tv/oauth2/authorize" +
                $"?client_id={_twitchSettings.ClientId}" +
                $"&redirect_uri={Uri.EscapeDataString(_twitchSettings.RedirectUri)}" +
                $"&response_type=code" +
                $"&scope={Uri.EscapeDataString(_twitchSettings.Scopes)}" +
                $"&state={Uri.EscapeDataString(state)}";

            _logger.LogInformation("Generated login URL for Twitch (redirect: {Redirect})", redirect ?? "none");
            return loginUrl;
        }

        /// <summary>
        /// Generates an HMAC-signed OAuth state parameter.
        /// Format: base64payload.signature
        /// Payload JSON: {"redirect":"...","ts":unix_timestamp}
        /// </summary>
        private string GenerateSignedOAuthState(string? redirect)
        {
            var payload = new
            {
                redirect = redirect ?? "",
                ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
            };

            var payloadJson = JsonConvert.SerializeObject(payload);
            var payloadBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(payloadJson));
            var signature = ComputeHmacSha256(payloadBase64, _jwtSettings.SecretKey);

            return $"{payloadBase64}.{signature}";
        }

        /// <summary>
        /// Validates an HMAC-signed OAuth state parameter.
        /// Returns the redirect path if valid, null if invalid or expired.
        /// </summary>
        public static (bool IsValid, string? Redirect) ValidateOAuthState(string state, string secretKey, int maxAgeMinutes = 10)
        {
            if (string.IsNullOrEmpty(state))
                return (false, null);

            var dotIndex = state.IndexOf('.');
            if (dotIndex < 0 || dotIndex == state.Length - 1)
                return (false, null);

            var payloadBase64 = state.Substring(0, dotIndex);
            var signature = state.Substring(dotIndex + 1);

            // Verify HMAC signature
            var expectedSignature = ComputeHmacSha256(payloadBase64, secretKey);
            if (!CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(signature),
                    Encoding.UTF8.GetBytes(expectedSignature)))
            {
                return (false, null);
            }

            // Decode and parse payload
            try
            {
                var payloadJson = Encoding.UTF8.GetString(Convert.FromBase64String(payloadBase64));
                var payload = JsonConvert.DeserializeAnonymousType(payloadJson, new { redirect = "", ts = 0L });

                if (payload == null)
                    return (false, null);

                // Check timestamp is within allowed window
                var stateTime = DateTimeOffset.FromUnixTimeSeconds(payload.ts);
                if (DateTimeOffset.UtcNow - stateTime > TimeSpan.FromMinutes(maxAgeMinutes))
                    return (false, null);

                return (true, string.IsNullOrEmpty(payload.redirect) ? null : payload.redirect);
            }
            catch
            {
                return (false, null);
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
                    { "client_id", _twitchSettings.ClientId },
                    { "client_secret", _twitchSettings.ClientSecret },
                    { "code", code },
                    { "grant_type", "authorization_code" },
                    { "redirect_uri", _twitchSettings.RedirectUri }
                };

                var content = new FormUrlEncodedContent(requestBody);
                var response = await client.PostAsync("https://id.twitch.tv/oauth2/token", content);

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
                client.DefaultRequestHeaders.Add("Client-ID", _twitchSettings.ClientId);

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

                    // Create new user
                    user = new User
                    {
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
                            ON CONFLICT (user_id) DO NOTHING";
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

                var response = await client.GetAsync("https://id.twitch.tv/oauth2/validate");
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
                    { "client_id", _twitchSettings.ClientId },
                    { "client_secret", _twitchSettings.ClientSecret },
                    { "grant_type", "refresh_token" },
                    { "refresh_token", refreshToken }
                };

                var content = new FormUrlEncodedContent(requestBody);
                var response = await client.PostAsync("https://id.twitch.tv/oauth2/token", content);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Failed to refresh token: {StatusCode}", response.StatusCode);
                    throw new Exception($"Failed to refresh token: {response.StatusCode}");
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