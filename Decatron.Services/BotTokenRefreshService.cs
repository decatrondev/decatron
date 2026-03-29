using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Core.Settings;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;

namespace Decatron.Services
{
    public class BotTokenRefreshService : IBotTokenRefreshService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IBotTokenRepository _botTokenRepository;
        private readonly TwitchSettings _twitchSettings;
        private readonly ILogger<BotTokenRefreshService> _logger;

        public BotTokenRefreshService(
            IHttpClientFactory httpClientFactory,
            IBotTokenRepository botTokenRepository,
            IOptions<TwitchSettings> twitchSettings,
            ILogger<BotTokenRefreshService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _botTokenRepository = botTokenRepository;
            _twitchSettings = twitchSettings.Value;
            _logger = logger;
        }

        public async Task<bool> IsTokenExpiringSoonAsync(BotTokens botToken, TimeSpan threshold)
        {
            if (!botToken.TokenExpiration.HasValue)
            {
                _logger.LogWarning("Bot token for {BotUsername} has no expiration date", botToken.BotUsername);
                return false;
            }

            var timeUntilExpiration = botToken.TokenExpiration.Value - DateTime.UtcNow;
            return timeUntilExpiration <= threshold;
        }

        public async Task<BotTokens> RefreshBotTokenAsync(BotTokens botToken)
        {
            if (string.IsNullOrEmpty(botToken.RefreshToken))
            {
                _logger.LogWarning("Bot token for {BotUsername} has no refresh token", botToken.BotUsername);
                throw new InvalidOperationException($"Bot token for {botToken.BotUsername} has no refresh token");
            }

            try
            {
                _logger.LogInformation("Refreshing token for bot: {BotUsername}, expires: {TokenExpiration}", botToken.BotUsername, botToken.TokenExpiration);

                var client = _httpClientFactory.CreateClient();
                var requestBody = new Dictionary<string, string>
                {
                    { "client_id", _twitchSettings.ClientId },
                    { "client_secret", _twitchSettings.ClientSecret },
                    { "grant_type", "refresh_token" },
                    { "refresh_token", botToken.RefreshToken }
                };

                var content = new FormUrlEncodedContent(requestBody);
                var response = await client.PostAsync("https://id.twitch.tv/oauth2/token", content);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to refresh bot token for {BotUsername}: {StatusCode} - {ErrorContent}", botToken.BotUsername, response.StatusCode, errorContent);
                    throw new Exception($"Failed to refresh bot token: {response.StatusCode}");
                }

                var responseContent = await response.Content.ReadAsStringAsync();
                var tokenResponse = JsonConvert.DeserializeObject<TokenResponse>(responseContent);

                // Update bot token with new values
                // IMPORTANTE: AccessToken NO se actualiza, es fijo y solo cambia ChatToken
                botToken.RefreshToken = tokenResponse.RefreshToken ?? botToken.RefreshToken;
                botToken.ChatToken = tokenResponse.AccessToken; // ChatToken is the user access token used for IRC
                botToken.TokenExpiration = DateTime.UtcNow.AddSeconds(tokenResponse.ExpiresIn);
                botToken.UpdatedAt = DateTime.UtcNow;

                // Save to database
                await _botTokenRepository.UpdateAsync(botToken);

                _logger.LogInformation("Successfully refreshed token for bot: {BotUsername}, new expiration: {TokenExpiration}", botToken.BotUsername, botToken.TokenExpiration);
                return botToken;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error refreshing token for bot: {BotUsername}", botToken.BotUsername);
                throw;
            }
        }

        public async Task RefreshExpiringTokensAsync()
        {
            try
            {
                _logger.LogInformation("Checking for bot tokens expiring soon...");

                // Get tokens expiring within 7 days (refresh proactively)
                var expiringTokens = await _botTokenRepository.GetTokensExpiringWithinAsync(TimeSpan.FromDays(7));

                if (!expiringTokens.Any())
                {
                    _logger.LogInformation("No bot tokens expiring soon");
                    return;
                }

                _logger.LogInformation("Found {Count} bot token(s) expiring soon", expiringTokens.Count);

                foreach (var botToken in expiringTokens)
                {
                    try
                    {
                        await RefreshBotTokenAsync(botToken);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to refresh token for bot: {BotUsername}", botToken.BotUsername);
                        // Continue with other tokens even if one fails
                    }
                }

                _logger.LogInformation("Finished refreshing expiring bot tokens");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in RefreshExpiringTokensAsync");
                throw;
            }
        }

        public async Task RefreshAllTokensOnStartupAsync()
        {
            try
            {
                _logger.LogInformation("🔄 Refreshing all bot tokens on startup...");

                var allTokens = await _botTokenRepository.GetAllActiveAsync();

                if (!allTokens.Any())
                {
                    _logger.LogWarning("No bot tokens found in database");
                    return;
                }

                _logger.LogInformation("Found {Count} bot token(s) to refresh", allTokens.Count);

                foreach (var botToken in allTokens)
                {
                    try
                    {
                        await RefreshBotTokenAsync(botToken);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to refresh token for bot: {BotUsername}", botToken.BotUsername);
                        // Continue with other tokens even if one fails
                    }
                }

                _logger.LogInformation("Finished refreshing all bot tokens on startup");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in RefreshAllTokensOnStartupAsync");
                throw;
            }
        }
    }
}
