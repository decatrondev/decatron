using Decatron.Core.Interfaces;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 4 (paso 6c.1): el cliente persistente depende del tenant y un tenant sin cliente propio falla cerrado (se prueba con texto en lugar de DiscordClient).</summary>
public class TenantClientRegistryTests
{
    private sealed class NoClient : Exception { public long Tenant; public NoClient(long t) { Tenant = t; } }
    private static Func<long, Exception> Fail => t => new NoClient(t);

    [Fact]
    public void SinTenantOUnoEsElClienteDeSiempre()
    {
        var r = new TenantClientRegistry<string>();
        Assert.Equal("uno", r.Resolve("uno", Fail));
        using var _ = TenantAmbient.Push(1);
        Assert.Equal("uno", r.Resolve("uno", Fail));
    }

    [Fact]
    public void OtroTenantSinClienteFallaCerradoYNoRecibeElDelUno()
    {
        var r = new TenantClientRegistry<string>();
        using var _ = TenantAmbient.Push(2);
        Assert.Equal(2, Assert.Throws<NoClient>(() => r.Resolve("uno", Fail)).Tenant);
    }

    [Fact]
    public void CadaTenantRecibeSuPropioCliente()
    {
        var r = new TenantClientRegistry<string>();
        Assert.True(r.TryAdd(2, "dos")); Assert.True(r.TryAdd(3, "tres"));
        Assert.False(r.TryAdd(2, "otro-dos")); // ya hay uno
        Assert.False(r.TryAdd(1, "intruso"));   // el #1 no vive en el registro
        using (TenantAmbient.Push(2)) Assert.Equal("dos", r.Resolve("uno", Fail));
        using (TenantAmbient.Push(3)) Assert.Equal("tres", r.Resolve("uno", Fail));
        using (TenantAmbient.Push(4)) Assert.Throws<NoClient>(() => r.Resolve("uno", Fail));
        Assert.Equal("uno", r.Resolve("uno", Fail));
        Assert.Equal(2, r.Count);
        Assert.True(r.TryRemove(2, out _));
        using (TenantAmbient.Push(2)) Assert.Throws<NoClient>(() => r.Resolve("uno", Fail));
    }
}
