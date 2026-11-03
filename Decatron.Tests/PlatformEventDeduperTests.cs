using Decatron.Services.Platforms;
using Xunit;

namespace Decatron.Tests;

/// <summary>Filtro de avisos repetidos: reglas puras, con el reloj como parámetro.</summary>
public class PlatformEventDeduperTests
{
    private static readonly DateTime T0 = new(2026, 11, 3, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void PrimeraVezEsNueva_LaSegundaSeDescarta()
    {
        var d = new PlatformEventDeduper();
        Assert.True(d.TryMarkNew("kick", "a", T0));
        Assert.False(d.TryMarkNew("kick", "a", T0.AddSeconds(5)));
    }

    [Fact]
    public void MismoIdEnOtraPlataformaNoChoca()
    {
        var d = new PlatformEventDeduper();
        Assert.True(d.TryMarkNew("kick", "a", T0));
        Assert.True(d.TryMarkNew("twitch", "a", T0));
    }

    [Fact]
    public void IdsDistintosPasan()
    {
        var d = new PlatformEventDeduper();
        Assert.True(d.TryMarkNew("kick", "a", T0));
        Assert.True(d.TryMarkNew("kick", "b", T0));
    }
}
