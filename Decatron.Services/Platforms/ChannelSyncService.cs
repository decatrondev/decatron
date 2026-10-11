using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Default.Helpers;
using Decatron.Services.Accounts;
using Decatron.Services.Platforms.Kick;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Platforms
{
    public record MirrorResult(bool Attempted, bool Ok, string Target);

    /// <summary>
    /// Aplicar título y categoría en las dos plataformas a la vez (plan: .dev/plans/KICK_TITULO_CATEGORIA_PLAN.md). Interruptor por
    /// cuenta, apagado por defecto. Solo actúa en cuentas con Twitch y Kick vinculados. Un cambio hecho en Twitch (por los ganchos de
    /// <see cref="ChannelSyncHooks"/>) se copia a Kick y uno hecho en Kick se copia a Twitch; la categoría se copia por nombre.
    /// </summary>
    public class ChannelSyncService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly AccountChannelResolver _accounts;
        private readonly IConfiguration _configuration;
        private readonly ILogger<ChannelSyncService> _logger;

        public ChannelSyncService(IServiceScopeFactory scopeFactory, AccountChannelResolver accounts, IConfiguration configuration,
            ILogger<ChannelSyncService> logger)
        {
            _scopeFactory = scopeFactory;
            _accounts = accounts;
            _configuration = configuration;
            _logger = logger;
            ChannelSyncHooks.TitleChanged = (twitchId, title) => MirrorFromTwitchAsync(twitchId, "title", title);
            ChannelSyncHooks.CategoryChanged = (twitchId, name) => MirrorFromTwitchAsync(twitchId, "game", name);
        }

        /// <summary>Available = la cuenta tiene Twitch y Kick vinculados (si no, el interruptor no tiene sentido).</summary>
        public async Task<(bool Available, bool Enabled)> GetAsync(long userId)
        {
            var account = await _accounts.ResolveByUserIdAsync(userId);
            if (account == null) return (false, false);
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var enabled = await db.TitleGameSyncSettings.AsNoTracking().AnyAsync(s => s.UserId == account.Principal.UserId && s.Enabled);
            return (account.HasTwitch && account.HasKick, enabled);
        }

        public async Task<bool> SetEnabledAsync(long userId, bool enabled)
        {
            var account = await _accounts.ResolveByUserIdAsync(userId);
            if (account == null || !(account.HasTwitch && account.HasKick)) return false;
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var row = await db.TitleGameSyncSettings.FirstOrDefaultAsync(s => s.UserId == account.Principal.UserId);
            if (row == null) db.TitleGameSyncSettings.Add(new TitleGameSyncSetting { UserId = account.Principal.UserId, Enabled = enabled });
            else { row.Enabled = enabled; row.UpdatedAt = DateTime.UtcNow; }
            await db.SaveChangesAsync();
            return true;
        }

        /// <summary>Copia a Kick un cambio hecho en Twitch. kind: "title" o "game".</summary>
        public async Task<MirrorResult> MirrorFromTwitchAsync(string twitchId, string kind, string value)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var twitchRow = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.TwitchId == twitchId);
                if (twitchRow == null) return new MirrorResult(false, false, "kick");

                var account = await _accounts.ResolveByUserIdAsync(twitchRow.Id);
                var kickMember = account?.Members.FirstOrDefault(m => !string.IsNullOrEmpty(m.KickId));
                if (account == null || kickMember == null || !await IsEnabledAsync(db, account)) return new MirrorResult(false, false, "kick");

                var kickUser = await db.Users.FirstOrDefaultAsync(u => u.Id == kickMember.UserId);
                var token = kickUser == null ? null : await KickChannelTokens.GetValidAsync(scope.ServiceProvider, kickUser, _logger);
                if (string.IsNullOrEmpty(token)) { _logger.LogWarning("[Sync] Sin token de Kick para copiar {Kind}", kind); return new MirrorResult(true, false, "kick"); }

                var kickApi = scope.ServiceProvider.GetRequiredService<IKickApiService>();
                KickUpdateResult res;
                if (kind == "title")
                    res = await kickApi.UpdateChannelAsync(token, value, null);
                else
                {
                    var category = await scope.ServiceProvider.GetRequiredService<KickCategoryService>().ResolveAsync(value, token);
                    if (category == null) { _logger.LogWarning("[Sync] Kick no tiene la categoría '{Name}'", value); return new MirrorResult(true, false, "kick"); }
                    res = await kickApi.UpdateChannelAsync(token, null, category.Id);
                }
                if (!res.Ok) _logger.LogWarning("[Sync] No se pudo copiar {Kind} a Kick", kind);
                return new MirrorResult(true, res.Ok, "kick");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Sync] Error copiando {Kind} de Twitch a Kick", kind);
                return new MirrorResult(true, false, "kick");
            }
        }

        /// <summary>Copia a Twitch un cambio hecho en Kick. <paramref name="kickRowUserId"/> es la fila de Kick del canal.</summary>
        public async Task<MirrorResult> MirrorFromKickAsync(long kickRowUserId, string kind, string value)
        {
            try
            {
                var account = await _accounts.ResolveByUserIdAsync(kickRowUserId);
                var twitchMember = account?.Members.FirstOrDefault(m => !string.IsNullOrEmpty(m.TwitchId));
                if (account == null || twitchMember == null) return new MirrorResult(false, false, "twitch");

                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                if (!await IsEnabledAsync(db, account)) return new MirrorResult(false, false, "twitch");

                var twitchUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == twitchMember.UserId);
                if (twitchUser == null || string.IsNullOrEmpty(twitchUser.AccessToken) || string.IsNullOrEmpty(twitchUser.TwitchId))
                    return new MirrorResult(true, false, "twitch");

                // Mientras se escribe en Twitch por otra plataforma, el cambio no debe rebotar hacia Kick
                ChannelSyncHooks.Mirroring.Value = true;
                try
                {
                    if (kind == "title")
                    {
                        var ok = await TitleUtils.UpdateTitleAsync(_configuration, twitchUser.TwitchId, value, twitchUser.AccessToken);
                        return new MirrorResult(true, ok, "twitch");
                    }
                    var name = await GameUtils.UpdateCategoryAsync(_configuration, twitchUser.TwitchId, StripParenthetical(value), twitchUser.AccessToken, _logger);
                    return new MirrorResult(true, name != null, "twitch");
                }
                finally { ChannelSyncHooks.Mirroring.Value = false; }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Sync] Error copiando {Kind} de Kick a Twitch", kind);
                return new MirrorResult(true, false, "twitch");
            }
        }

        /// <summary>«Grand Theft Auto V (GTA)» → «Grand Theft Auto V»: Twitch no incluye ese paréntesis en sus nombres.</summary>
        public static string StripParenthetical(string name)
        {
            var n = (name ?? "").Trim();
            var open = n.LastIndexOf('(');
            return open > 0 && n.EndsWith(')') ? n[..open].Trim() : n;
        }

        private static Task<bool> IsEnabledAsync(DecatronDbContext db, AccountChannels account) =>
            db.TitleGameSyncSettings.AsNoTracking().AnyAsync(s => s.UserId == account.Principal.UserId && s.Enabled);
    }
}
