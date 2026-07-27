using Decatron.Data;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Core.Helpers
{
    /// <summary>
    /// Centralized helper for resolving channel login ↔ userId ↔ TwitchId.
    /// Used during the migration from ChannelName-based queries to UserId-based queries.
    /// </summary>
    public static class ChannelResolver
    {
        /// <summary>
        /// Resolves a channel login (username) to the internal database user ID.
        /// </summary>
        public static async Task<long?> ResolveUserIdAsync(DecatronDbContext db, string channelLogin)
        {
            return await db.Users
                .Where(u => u.Login == channelLogin.ToLower() && u.IsActive)
                .Select(u => (long?)u.Id)
                .FirstOrDefaultAsync();
        }

        /// <summary>
        /// Resolves an internal user ID to the current channel login (username).
        /// </summary>
        public static async Task<string?> ResolveLoginAsync(DecatronDbContext db, long userId)
        {
            return await db.Users
                .Where(u => u.Id == userId && u.IsActive)
                .Select(u => u.Login)
                .FirstOrDefaultAsync();
        }

        /// <summary>
        /// Resolves a channel login to both userId and TwitchId in a single query.
        /// </summary>
        public static async Task<ChannelInfo?> ResolveChannelInfoAsync(DecatronDbContext db, string channelLogin)
        {
            return await db.Users
                .Where(u => u.Login == channelLogin.ToLower() && u.IsActive)
                .Select(u => new ChannelInfo
                {
                    UserId = u.Id,
                    TwitchId = u.TwitchId,
                    Login = u.Login,
                    DisplayName = u.DisplayName,
                    PreferredLanguage = u.PreferredLanguage
                })
                .FirstOrDefaultAsync();
        }

        /// <summary>
        /// Resolves a user ID to full channel info.
        /// </summary>
        public static async Task<ChannelInfo?> ResolveChannelInfoByIdAsync(DecatronDbContext db, long userId)
        {
            return await db.Users
                .Where(u => u.Id == userId && u.IsActive)
                .Select(u => new ChannelInfo
                {
                    UserId = u.Id,
                    TwitchId = u.TwitchId,
                    Login = u.Login,
                    DisplayName = u.DisplayName,
                    PreferredLanguage = u.PreferredLanguage
                })
                .FirstOrDefaultAsync();
        }
    }

    public class ChannelInfo
    {
        public long UserId { get; set; }
        public string TwitchId { get; set; } = "";
        public string Login { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public string? PreferredLanguage { get; set; }
    }
}
