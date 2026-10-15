using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 4 (paso 3, lote 2): el acceso estático al ClientId respeta el tenant ambiente y falla cerrado.</summary>
[Collection("CredentialAccessor")]
public class CredentialAccessorTests
{
    private static IConfiguration Cfg() => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
    { ["TwitchSettings:ClientId"] = "cid" }).Build();

    [Fact]
    public void TenantUnoDevuelveElClientIdLegacy()
    {
        CredentialAccessor.Set(new CredentialProvider(Cfg()));
        Assert.Equal("cid", CredentialAccessor.TwitchClientId());
        using var _ = TenantAmbient.Push(1);
        Assert.Equal("cid", CredentialAccessor.TwitchClientId(Cfg()));
    }

    [Fact]
    public void OtroTenantFallaCerradoYNoCaeAlFallback()
    {
        CredentialAccessor.Set(new CredentialProvider(Cfg()));
        using var _ = TenantAmbient.Push(2);
        Assert.Throws<CredentialsNotConfiguredException>(() => CredentialAccessor.TwitchClientId(Cfg()));
    }
}

public class CredentialScopesTests
{
    [Fact]
    public void ScopesYRedirectSalenDeLaConfiguracionDelUno()
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        { ["TwitchSettings:ClientId"] = "cid", ["TwitchSettings:Scopes"] = "chat:read", ["TwitchSettings:RedirectUri"] = "https://x/cb" }).Build();
        var app = new CredentialProvider(cfg).GetTwitchApp();
        Assert.Equal("chat:read", app.Scopes);
        Assert.Equal("https://x/cb", app.RedirectUri);
    }
}
