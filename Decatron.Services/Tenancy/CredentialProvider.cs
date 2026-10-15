using Decatron.Core.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Decatron.Services.Tenancy;

/// <summary>Despacha por tenant: el #1 lee de appsettings (legacy); otro tenant falla cerrado hasta el paso 4.</summary>
public sealed class CredentialProvider : ICredentialProvider
{
    private readonly IConfiguration _cfg;
    public CredentialProvider(IConfiguration cfg) => _cfg = cfg;

    private long Tenant => TenantAmbient.Current ?? 1;

    public TwitchAppCredentials GetTwitchApp()
    {
        if (Tenant != 1) throw new CredentialsNotConfiguredException(Tenant, "la app de Twitch");
        return new TwitchAppCredentials(
            _cfg["TwitchSettings:ClientId"] ?? "",
            _cfg["TwitchSettings:ClientSecret"],
            _cfg["TwitchSettings:RedirectUri"],
            _cfg["TwitchSettings:WebhookSecret"],
            _cfg["TwitchSettings:WebhookCallbackUrl"]);
    }

    public string? GetTwitchBotUsername()
    {
        if (Tenant != 1) throw new CredentialsNotConfiguredException(Tenant, "la cuenta de bot de Twitch");
        return _cfg["TwitchSettings:BotUsername"];
    }
}
