using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Platforms.Kick
{
    /// <summary>Token de Kick del streamer, refrescado si está por vencer (mismo criterio que la moderación de Kick).</summary>
    public static class KickChannelTokens
    {
        public static async Task<string?> GetValidAsync(IServiceProvider sp, User user, ILogger logger)
        {
            var token = user.KickAccessToken;
            if ((user.KickTokenExpiration == null || user.KickTokenExpiration.Value <= DateTime.UtcNow.AddMinutes(2))
                && !string.IsNullOrEmpty(user.KickRefreshToken))
            {
                try { token = (await sp.GetRequiredService<IKickTokenRefreshService>().RefreshUserTokenAsync(user)).KickAccessToken; }
                catch (KickTokenException ex) { logger.LogWarning(ex, "[Kick] No se pudo refrescar el token de {Channel}", user.KickUsername); }
            }
            return token;
        }
    }
}
