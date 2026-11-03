using Decatron.Core.Helpers;
using Decatron.Core.Services;
using Decatron.Services.Accounts;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Platforms.Kick
{
    /// <summary>
    /// Guarda como seguidor (platform = 'kick') cada follow que Kick avisa por webhook. Kick no entrega la lista de
    /// seguidores existentes ni avisa los unfollows, así que solo se conocen los follows desde que se empezó a guardar.
    /// Nunca lanza: un fallo aquí no debe romper el webhook.
    /// </summary>
    public class KickFollowRecorder
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly AccountChannelResolver _accounts;
        private readonly ILogger<KickFollowRecorder> _logger;

        public KickFollowRecorder(IServiceScopeFactory scopes, AccountChannelResolver accounts, ILogger<KickFollowRecorder> logger)
        {
            _scopes = scopes;
            _accounts = accounts;
            _logger = logger;
        }

        public async Task RecordAsync(PlatformEvent evt)
        {
            try
            {
                var follow = KickFollowMapper.FromEvent(evt, DateTime.UtcNow);
                if (follow == null) return;

                var resolved = await _accounts.ResolveKickIdAsync(follow.BroadcasterId);
                if (resolved == null)
                {
                    _logger.LogWarning("[Kick Seguidores] Follow de un canal sin cuenta (id {Id}), no se guarda", follow.BroadcasterId);
                    return;
                }

                var kickChannel = resolved.Account.Members.FirstOrDefault(m => m.KickId == follow.BroadcasterId) ?? resolved.Matched;
                var channelName = string.IsNullOrWhiteSpace(kickChannel.KickUsername) ? kickChannel.Login : kickChannel.KickUsername!;

                using var scope = _scopes.CreateScope();
                var followers = scope.ServiceProvider.GetRequiredService<FollowersService>();
                var outcome = await followers.RecordFollowAsync(
                    follow.BroadcasterId, channelName, follow.UserId, follow.UserName, follow.UserLogin, follow.FollowedAtUtc,
                    FollowerPlatforms.Kick);

                if (outcome != FollowRecordOutcome.AlreadyFollowing)
                    await followers.AddHistoryEntryAsync(follow.BroadcasterId, follow.UserId, 0, follow.FollowedAtUtc, FollowerPlatforms.Kick);

                _logger.LogInformation("[Kick Seguidores] {User} siguió a {Channel} ({Outcome})", follow.UserName, channelName, outcome);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Kick Seguidores] Error guardando el follow");
            }
        }
    }
}
