using Decatron.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Tenancy;

public sealed class BotAccountProvider : IBotAccountProvider
{
    private readonly IServiceProvider _sp;
    private readonly ICredentialProvider _credentials;
    private readonly ILogger<BotAccountProvider> _log;
    private readonly ITenantCredentialStore? _store;
    private readonly TenantAppTokens? _appTokens;

    public BotAccountProvider(IServiceProvider sp, ICredentialProvider credentials, ILogger<BotAccountProvider> log,
        ITenantCredentialStore? store = null, TenantAppTokens? appTokens = null)
    { _sp = sp; _credentials = credentials; _log = log; _store = store; _appTokens = appTokens; }

    public async Task<BotAccount?> GetAsync(CancellationToken ct = default)
    {
        var tenant = TenantAmbient.Current ?? 1;
        if (tenant != 1)
        {
            // El bot del tenant es su propia cuenta (autorizada por OAuth); se envia con el App Access Token de SU app, como el #1.
            var tenantBot = _store is null ? null : await _store.GetTwitchBotAsync(tenant, ct);
            var appToken = tenantBot is null || _appTokens is null ? null : await _appTokens.GetAsync(ct);
            if (tenantBot is null || string.IsNullOrEmpty(appToken))
            {
                _log.LogWarning("Tenant {Tenant} sin cuenta de bot propia lista: no se envia el mensaje (nunca se usa la del #1)", tenant);
                return null;
            }
            return new BotAccount(tenantBot.Username, tenantBot.TwitchId, appToken);
        }
        var username = _credentials.GetTwitchBotUsername();
        if (string.IsNullOrEmpty(username)) return null;

        using var scope = _sp.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IBotTokenRepository>();
        var bot = await repo.GetByBotUsernameAsync(username);
        if (bot is null || string.IsNullOrEmpty(bot.AccessToken))
        {
            _log.LogWarning("Access token del bot no encontrado en BD");
            return null;
        }
        if (string.IsNullOrEmpty(bot.BotTwitchId))
        {
            _log.LogWarning("bot_twitch_id no encontrado para bot: {Bot}", username);
            return null;
        }
        var token = bot.AccessToken.StartsWith("oauth:") ? bot.AccessToken.Substring(6) : bot.AccessToken;
        return new BotAccount(username, bot.BotTwitchId, token);
    }
}
