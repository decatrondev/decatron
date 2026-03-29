using Decatron.Core.Models;

namespace Decatron.Core.Interfaces
{
    public interface ISettingsService
    {
        // Métodos existentes
        Task<SystemSettings> GetSettingsByUserIdAsync(long userId);
        Task<SystemSettings> UpdateSettingsAsync(SystemSettings settings);
        Task<SystemSettings> CreateDefaultSettingsAsync(long userId);
        Task<IEnumerable<UserAccess>> GetUserAccessesAsync(long userId);
        Task<UserAccess> AddUserAccessAsync(long userId, long authorizedUserId, string permissionLevel);
        Task<bool> RemoveUserAccessAsync(long accessId);
        Task<bool> UpdateUserAccessAsync(long accessId, string permissionLevel);

        
        Task<bool> SetBotEnabledAsync(long userId, bool enabled);
        Task<List<string>> GetEnabledBotChannelsAsync();
        Task<bool> IsBotEnabledForChannelAsync(string channelLogin);
    }
}