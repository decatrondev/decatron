using Decatron.Core.Models;

namespace Decatron.Core.Interfaces
{
    public interface IAuthService
    {
        string GetLoginUrl(string? redirect = null);
        Task<TokenResponse> ExchangeCodeForTokenAsync(string code);
        Task<TwitchUser> GetUserInfoAsync(string accessToken);
        Task<User> AuthenticateUserAsync(TwitchUser twitchUser, TokenResponse tokenResponse, string? acceptLanguage = null);
        Task<User> GetUserByIdAsync(long userId);
        Task<User> GetUserByLoginAsync(string login);
        Task<bool> ValidateTokenAsync(string accessToken);
        Task<TokenResponse> RefreshTokenAsync(string refreshToken);
        
    }
}