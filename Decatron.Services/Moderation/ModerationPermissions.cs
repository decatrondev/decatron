using System;
using System.Linq;
using System.Threading.Tasks;
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
        public static async Task<bool> HasControlTotalAsync(IServiceProvider services, ModerationChannel channel, string platformUserId)
        {
            if (string.IsNullOrEmpty(platformUserId))
                return false;

            // La cuenta de Decatron de quien escribe, según la plataforma del chat
            var db = services.GetRequiredService<DecatronDbContext>();
            var chatterId = await db.Users
                .Where(u => u.IsActive && (channel.IsKick ? u.KickId == platformUserId : u.TwitchId == platformUserId))
                .Select(u => (long?)u.Id)
                .FirstOrDefaultAsync();
            if (chatterId == null)
                return false;

            var permissions = services.GetRequiredService<IPermissionService>();
            return await permissions.HasPermissionLevelAsync(chatterId.Value, channel.UserId, "control_total");
        }
    }
}
