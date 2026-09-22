using System;
using System.Linq;
using System.Threading.Tasks;
using Decatron.Core.Helpers;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Decatron.Services.Moderation
{
    /// <summary>
    /// Quién cuenta como qué en la moderación del chat
    /// </summary>
    public static class ModerationPermissions
    {
        /// <summary>
        /// Quien tiene control_total del canal en el dashboard cuenta como el streamer
        /// aunque en ese chat sea un viewer más.
        /// </summary>
        public static async Task<bool> HasControlTotalAsync(IServiceProvider services, string channel, string twitchUserId)
        {
            if (string.IsNullOrEmpty(twitchUserId))
                return false;

            var db = services.GetRequiredService<DecatronDbContext>();
            var chatterId = await db.Users
                .Where(u => u.TwitchId == twitchUserId && u.IsActive)
                .Select(u => (long?)u.Id)
                .FirstOrDefaultAsync();
            if (chatterId == null)
                return false;

            var channelInfo = await ChannelResolver.ResolveChannelInfoAsync(db, channel);
            if (channelInfo == null)
                return false;

            var permissions = services.GetRequiredService<IPermissionService>();
            return await permissions.HasPermissionLevelAsync(chatterId.Value, channelInfo.UserId, "control_total");
        }
    }
}
