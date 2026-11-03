using Decatron.Core.Helpers;
using Xunit;

namespace Decatron.Tests;

/// <summary>Qué alerta dispara cada evento de Kick y cuánto valen los Kicks en bits: reglas puras.</summary>
public class KickAlertMapperTests
{
    private static PlatformEvent Ev(PlatformEventType type, string? user = "ana", bool anon = false, int amount = 0, int months = 0, string? msg = null) =>
        new("id", "kick", type, "123", "9", user, anon, amount, months, msg, null, null, null);

    [Fact]
    public void Follow_DisparaFollow()
    {
        var c = KickAlertMapper.Map(Ev(PlatformEventType.Follow));
        Assert.Equal("follow", c!.EventType);
        Assert.Equal("ana", c.Username);
    }

    [Fact]
    public void FollowAnonimo_NoSeAvisa()
    {
        Assert.Null(KickAlertMapper.Map(Ev(PlatformEventType.Follow, user: null, anon: true)));
    }

    [Fact]
    public void SubNueva_EsNivel1()
    {
        var c = KickAlertMapper.Map(Ev(PlatformEventType.Subscription, amount: 1, months: 1));
        Assert.Equal("subs", c!.EventType);
        Assert.Equal("1000", c.SubTier);
    }

    [Theory]
    [InlineData(3, 3)]
    [InlineData(0, 1)]
    public void Renovacion_UsaResubsConLosMeses_MinimoUno(int meses, int esperado)
    {
        var c = KickAlertMapper.Map(Ev(PlatformEventType.SubscriptionRenewal, amount: 1, months: meses));
        Assert.Equal("resubs", c!.EventType);
        Assert.Equal(esperado, c.Months);
        Assert.Equal("1000", c.SubTier);
    }

    [Fact]
    public void SubsRegaladas_LlevanLaCantidad()
    {
        var c = KickAlertMapper.Map(Ev(PlatformEventType.GiftedSubs, amount: 5));
        Assert.Equal("giftSubs", c!.EventType);
        Assert.Equal(5, c.Amount);
    }

    [Fact]
    public void SubsRegaladasAnonimas_SeLlamanAnonimo()
    {
        var c = KickAlertMapper.Map(Ev(PlatformEventType.GiftedSubs, user: null, anon: true, amount: 2));
        Assert.Equal("Anónimo", c!.Username);
    }

    [Fact]
    public void SubsRegaladasSinReceptores_NoSeAvisan()
    {
        Assert.Null(KickAlertMapper.Map(Ev(PlatformEventType.GiftedSubs, amount: 0)));
    }

    [Fact]
    public void Kicks_DisparanBitsConElMensaje()
    {
        var c = KickAlertMapper.Map(Ev(PlatformEventType.Kicks, amount: 500, msg: "gracias"));
        Assert.Equal("bits", c!.EventType);
        Assert.Equal(500, c.Amount);
        Assert.Equal("gracias", c.UserMessage);
    }

    [Fact]
    public void EstadoDelDirecto_NoEsUnaAlerta()
    {
        Assert.Null(KickAlertMapper.Map(Ev(PlatformEventType.StreamStatus)));
    }

    [Theory]
    [InlineData(500, 1.0, 500)]
    [InlineData(500, 2.0, 1000)]
    [InlineData(500, 0.5, 250)]
    [InlineData(1, 0.1, 1)]        // nunca baja de 1 bit
    [InlineData(0, 1.0, 0)]
    [InlineData(-3, 1.0, 0)]
    [InlineData(100, 0.0, 1)]      // valor fuera de rango: se sube al mínimo (0,01) y da 1
    [InlineData(100, double.NaN, 100)]
    [InlineData(100, 5000.0, 100000)] // tope de 1000 bits por Kick
    public void KicksToBits(int kicks, double porKick, int esperado)
    {
        Assert.Equal(esperado, KickAlertMapper.KicksToBits(kicks, porKick));
    }
}
