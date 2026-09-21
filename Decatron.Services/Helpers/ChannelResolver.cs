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
        /// Resolves a channel login to both userId and TwitchId in a single query.
        ///
        /// Tambien resuelve canales de Kick: "channelLogin" puede ser el kick_id
        /// numerico del canal (asi lo pasa KickWebhookController — ver
        /// .dev/plans/UNIFICACION_MULTIPLATAFORMA_PLAN.md seccion 8.8). Primero se
        /// prueba por login de Twitch (caso comun); si no matchea, por kick_id.
        /// </summary>
        public static async Task<ChannelInfo?> ResolveChannelInfoAsync(DecatronDbContext db, string channelLogin)
        {
            var normalized = channelLogin.ToLower();

            var byTwitch = await db.Users
                .Where(u => u.Login == normalized && u.IsActive)
                .Select(u => new ChannelInfo
                {
                    UserId = u.Id,
                    TwitchId = u.TwitchId,
                    KickId = u.KickId,
                    Login = u.Login,
                    DisplayName = u.DisplayName,
                    PreferredLanguage = u.PreferredLanguage
                })
                .FirstOrDefaultAsync();

            if (byTwitch != null)
                return byTwitch;

            return await db.Users
                .Where(u => u.KickId == channelLogin && u.IsActive)
                .Select(u => new ChannelInfo
                {
                    UserId = u.Id,
                    TwitchId = u.TwitchId,
                    KickId = u.KickId,
                    Login = u.KickUsername ?? u.Login,
                    DisplayName = u.KickUsername ?? u.DisplayName,
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
                    KickId = u.KickId,
                    Login = u.KickId != null ? (u.KickUsername ?? u.Login) : u.Login,
                    DisplayName = u.KickId != null ? (u.KickUsername ?? u.DisplayName) : u.DisplayName,
                    PreferredLanguage = u.PreferredLanguage
                })
                .FirstOrDefaultAsync();
        }
    }

    public class ChannelInfo
    {
        public long UserId { get; set; }
        public string? TwitchId { get; set; } = "";
        public string? KickId { get; set; }
        public string Login { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public string? PreferredLanguage { get; set; }
    }
}
