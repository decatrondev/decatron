using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    public class UserTokenRefreshService : IUserTokenRefreshService
    {
        private readonly IUserRepository _userRepository;
        private readonly IAuthService _authService;
        private readonly ILogger<UserTokenRefreshService> _logger;

        public UserTokenRefreshService(
            IUserRepository userRepository,
            IAuthService authService,
            ILogger<UserTokenRefreshService> logger)
        {
            _userRepository = userRepository;
            _authService = authService;
            _logger = logger;
        }

        public async Task<bool> IsTokenExpiringSoonAsync(User user, TimeSpan threshold)
        {
            var timeUntilExpiration = user.TokenExpiration - DateTime.UtcNow;
            return timeUntilExpiration <= threshold;
        }

        public async Task<User> RefreshUserTokenAsync(User user)
        {
            if (string.IsNullOrEmpty(user.RefreshToken))
            {
                _logger.LogWarning($"User {user.Login} has no refresh token");
                throw new InvalidOperationException($"User {user.Login} has no refresh token");
            }

            try
            {
                _logger.LogInformation($"Refreshing token for user: {user.Login}");

                // Use AuthService to refresh the token
                var tokenResponse = await _authService.RefreshTokenAsync(user.RefreshToken);

                // Update user with new values
                user.AccessToken = tokenResponse.AccessToken;
                user.RefreshToken = tokenResponse.RefreshToken ?? user.RefreshToken;
                user.TokenExpiration = DateTime.UtcNow.AddSeconds(tokenResponse.ExpiresIn);
                user.UpdatedAt = DateTime.UtcNow;

                // Save to database
                await _userRepository.UpdateAsync(user);

                _logger.LogInformation($"Successfully refreshed token for user: {user.Login}. New expiration: {user.TokenExpiration}");
                return user;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error refreshing token for user: {user.Login}");
                throw;
            }
        }

        public async Task RefreshExpiringTokensAsync()
        {
            try
            {
                _logger.LogInformation("Checking for user tokens expiring soon...");

                // Get users with tokens expiring within 7 days (refresh proactively)
                var expiringUsers = await _userRepository.GetUsersWithTokensExpiringWithinAsync(TimeSpan.FromDays(7));

                if (!expiringUsers.Any())
                {
                    _logger.LogInformation("No user tokens expiring soon");
                    return;
                }

                _logger.LogInformation($"Found {expiringUsers.Count} user token(s) expiring soon");

                foreach (var user in expiringUsers)
                {
                    try
                    {
                        await RefreshUserTokenAsync(user);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Failed to refresh token for user: {user.Login}");
                        // Continue with other users even if one fails
                    }
                }

                _logger.LogInformation("Finished refreshing expiring user tokens");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in RefreshExpiringTokensAsync");
                throw;
            }
        }
    }
}
