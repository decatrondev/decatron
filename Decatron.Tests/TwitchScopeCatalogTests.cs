using Decatron.Services;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Decatron.Tests;

/// <summary>Transparencia de permisos: todo scope que la plataforma pide tiene motivo, y channel_editor no llega a los tenants.</summary>
public class TwitchScopeCatalogTests
{
    private static string[] Split(string s) => s.Split(' ', StringSplitOptions.RemoveEmptyEntries);

    [Fact]
    public void TodoScopeDeAppsettingsTieneEntrada()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "../../../../appsettings.json");
        var cfg = new ConfigurationBuilder().AddJsonFile(Path.GetFullPath(path)).Build();
        var known = TwitchScopeCatalog.All().ToHashSet();
        foreach (var s in Split(cfg["TwitchSettings:Scopes"]!).Where(s => s != TwitchScopeCatalog.DeprecatedScope))
            Assert.True(known.Contains(s), $"Falta el motivo del permiso {s} en TwitchScopeCatalog");
    }

    [Fact]
    public void LosPermisosDelBotYDeModeracionTienenEntrada()
    {
        var known = TwitchScopeCatalog.All().ToHashSet();
        foreach (var s in Split(AuthService.BotScopes).Concat(Split(AuthService.ModerationScopes)))
            Assert.Contains(s, known);
    }

    [Fact]
    public void ElPermisoRetiradoNoEstaEnElCatalogoYSeQuita()
    {
        Assert.DoesNotContain(TwitchScopeCatalog.DeprecatedScope, TwitchScopeCatalog.All());
        Assert.Equal("chat:read bits:read", TwitchScopeCatalog.StripDeprecated("chat:read channel_editor bits:read"));
    }

    [Fact]
    public void CredentialProviderDeTenantNoPideChannelEditor()
    {
        var store = FakeStore.Create("chat:read channel_editor");
        var cp = new CredentialProvider(new ConfigurationBuilder().Build(), store);
        using var _ = Decatron.Core.Interfaces.TenantAmbient.Push(5);
        Assert.DoesNotContain("channel_editor", cp.GetTwitchApp().Scopes!);
    }

    /// <summary>Almacen falso: solo responde GetTwitchAppAsync, cualquier otra llamada es un error de la prueba.</summary>
    private class FakeStore : System.Reflection.DispatchProxy
    {
        public string Scopes = "";
        public static Decatron.Core.Interfaces.ITenantCredentialStore Create(string scopes)
        {
            var p = Create<Decatron.Core.Interfaces.ITenantCredentialStore, FakeStore>();
            ((FakeStore)(object)p).Scopes = scopes;
            return p;
        }
        protected override object? Invoke(System.Reflection.MethodInfo? m, object?[]? args)
        {
            if (m!.Name != "GetTwitchAppAsync") throw new NotImplementedException(m.Name);
            return Task.FromResult<Decatron.Core.Interfaces.TwitchAppCredentials?>(new("cid", "sec", "https://x/cb", null, null, Scopes));
        }
    }
}
