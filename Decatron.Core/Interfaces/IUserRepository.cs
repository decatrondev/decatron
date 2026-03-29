using Decatron.Core.Models;

namespace Decatron.Core.Interfaces
{
    public interface IUserRepository
    {
        Task<User> GetByIdAsync(long id);
        Task<User> GetByLoginAsync(string login);
        Task<User> GetByTwitchIdAsync(string twitchId);
        Task<User> CreateAsync(User user);
        Task<User> UpdateAsync(User user);
        Task<bool> ExistsAsync(long id);
        Task<List<User>> GetAllActiveAsync();
        Task<List<User>> GetUsersWithTokensExpiringWithinAsync(TimeSpan timeSpan);
    }
}