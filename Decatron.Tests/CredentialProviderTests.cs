using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 4 (paso 3): el tenant #1 lee de appsettings como siempre; cualquier otro falla cerrado (nunca cae a las del #1).</summary>
public class CredentialProviderTests
{
    private static ICredentialProvider New() => new CredentialProvider(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["TwitchSettings:ClientId"] = "cid", ["TwitchSettings:ClientSecret"] = "sec", ["TwitchSettings:WebhookSecret"] = "wh",
        ["TwitchSettings:WebhookCallbackUrl"] = "https://x/cb", ["TwitchSettings:BotUsername"] = "elbot",
    }).Build());

    [Fact]
    public void SinTenantAmbienteEsElUno()
    {
        var app = New().GetTwitchApp();
        Assert.Equal("cid", app.ClientId);
        Assert.Equal("wh", app.WebhookSecret);
        Assert.Equal("https://x/cb", app.WebhookCallbackUrl);
        Assert.Equal("elbot", New().GetTwitchBotUsername());
    }

    [Fact]
    public void TenantUnoExplicitoLeeLegacy()
    {
        using var _ = TenantAmbient.Push(1);
        Assert.Equal("cid", New().GetTwitchApp().ClientId);
    }

    [Fact]
    public void OtroTenantFallaCerrado()
    {
        using var _ = TenantAmbient.Push(2);
        var ex = Assert.Throws<CredentialsNotConfiguredException>(() => New().GetTwitchApp());
        Assert.Equal(2, ex.TenantId);
        Assert.Throws<CredentialsNotConfiguredException>(() => New().GetTwitchBotUsername());
    }
}
