using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services.Accounts;
using Decatron.Services.Platforms.Kick;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Multiview
{
    public sealed record TwitchIdentity(string TwitchId, string Login, string Token);
    public sealed record KickIdentity(string KickId, string Login, string Token);
    public sealed record LinkedAccounts(string? TwitchLogin, string? KickLogin);

    /// <summary>
    /// Qué cuentas de Twitch y de Kick tiene vinculadas quien mira el Multi-view y con qué token actúa en cada una.
    /// Los tokens salen de la base de datos y se refrescan si están por vencer; nunca llegan al navegador.
    /// </summary>
    public sealed class MultiviewAccountService
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly AccountChannelResolver _accounts;
        private readonly ILogger<MultiviewAccountService> _logger;

        public MultiviewAccountService(IServiceScopeFactory scopes, AccountChannelResolver accounts, ILogger<MultiviewAccountService> logger)
        {
            _scopes = scopes;
            _accounts = accounts;
            _logger = logger;
        }

        public async Task<LinkedAccounts> GetLinkedAsync(long userId)
        {
            var account = await _accounts.ResolveByUserIdAsync(userId);
            if (account == null) return new LinkedAccounts(null, null);
            var twitch = account.Members.FirstOrDefault(m => !string.IsNullOrEmpty(m.TwitchId));
            var kick = account.Members.FirstOrDefault(m => !string.IsNullOrEmpty(m.KickId));
            return new LinkedAccounts(twitch?.Login, kick == null ? null : (kick.KickUsername ?? kick.Login));
        }

        public async Task<TwitchIdentity?> GetTwitchAsync(long userId)
        {
            var account = await _accounts.ResolveByUserIdAsync(userId);
            var row = account?.Members.FirstOrDefault(m => !string.IsNullOrEmpty(m.TwitchId));
            if (row == null) return null;

            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == row.UserId && u.IsActive);
            if (user == null || string.IsNullOrEmpty(user.AccessToken) || string.IsNullOrEmpty(user.TwitchId)) return null;

            try
            {
                var refresh = scope.ServiceProvider.GetRequiredService<IUserTokenRefreshService>();
                if (await refresh.IsTokenExpiringSoonAsync(user, TimeSpan.FromMinutes(5)))
                    user = await refresh.RefreshUserTokenAsync(user);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Multiview] No se pudo refrescar el token de Twitch del usuario {UserId}", userId);
            }
            return new TwitchIdentity(user.TwitchId!, user.Login, user.AccessToken);
        }

        public async Task<KickIdentity?> GetKickAsync(long userId)
        {
            var account = await _accounts.ResolveByUserIdAsync(userId);
            var row = account?.Members.FirstOrDefault(m => !string.IsNullOrEmpty(m.KickId));
            if (row == null) return null;

            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == row.UserId && u.IsActive);
            if (user == null || string.IsNullOrEmpty(user.KickId)) return null;

            var token = await KickChannelTokens.GetValidAsync(scope.ServiceProvider, user, _logger);
            if (string.IsNullOrEmpty(token)) return null;
            return new KickIdentity(user.KickId!, user.KickUsername ?? user.Login, token);
        }
    }
}
