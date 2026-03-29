using Decatron.Core.Models;

namespace Decatron.Core.Interfaces
{
    public interface IBotTokenRepository
    {
        Task<BotTokens> GetByIdAsync(int id);
        Task<BotTokens> GetByBotUsernameAsync(string botUsername);
        Task<List<BotTokens>> GetAllActiveAsync();
        Task<List<BotTokens>> GetTokensExpiringWithinAsync(TimeSpan timeSpan);
        Task<BotTokens> CreateAsync(BotTokens botToken);
        Task<BotTokens> UpdateAsync(BotTokens botToken);
        Task<bool> DeleteAsync(int id);
    }
}
