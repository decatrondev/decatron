using Decatron.Core.Models;

namespace Decatron.Core.Interfaces
{
    public interface IUserTokenRefreshService
    {
        Task<User> RefreshUserTokenAsync(User user);
        Task RefreshExpiringTokensAsync();
        Task<bool> IsTokenExpiringSoonAsync(User user, TimeSpan threshold);
    }
}
