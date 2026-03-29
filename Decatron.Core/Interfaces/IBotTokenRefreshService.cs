using Decatron.Core.Models;

namespace Decatron.Core.Interfaces
{
    public interface IBotTokenRefreshService
    {
        Task<BotTokens> RefreshBotTokenAsync(BotTokens botToken);
        Task RefreshExpiringTokensAsync();
        Task RefreshAllTokensOnStartupAsync();
        Task<bool> IsTokenExpiringSoonAsync(BotTokens botToken, TimeSpan threshold);
    }
}
