using System.Text.Json;
using Decatron.Core.Helpers;
using Xunit;

namespace Decatron.Tests;

/// <summary>Traductor de eventos de Kick: reglas puras (sin red ni base de datos).</summary>
public class KickEventTranslatorTests
{
    private static JsonElement J(string json) => JsonDocument.Parse(json).RootElement.Clone();

    private const string Bc = "\"broadcaster\":{\"is_anonymous\":false,\"user_id\":123456789,\"username\":\"canal\"}";

    [Fact]
    public void Follow_TraeElSeguidor_ConIdNumerico()
    {
        var e = KickEventTranslator.Translate("channel.followed",
            J("{" + Bc + ",\"follower\":{\"is_anonymous\":false,\"user_id\":987,\"username\":\"ana\"}}"), "m1");
        Assert.NotNull(e);
        Assert.Equal(PlatformEventType.Follow, e!.Type);
        Assert.Equal("kick", e.Platform);
        Assert.Equal("123456789", e.BroadcasterId);
        Assert.Equal("987", e.UserId);
        Assert.Equal("ana", e.UserName);
        Assert.False(e.IsAnonymous);
        Assert.Equal("m1", e.Id);
    }

    [Theory]
    [InlineData("channel.subscription.new", PlatformEventType.Subscription)]
    [InlineData("channel.subscription.renewal", PlatformEventType.SubscriptionRenewal)]
    public void Sub_ValeUnoYGuardaLosMeses(string tipo, PlatformEventType esperado)
    {
        var e = KickEventTranslator.Translate(tipo,
            J("{" + Bc + ",\"subscriber\":{\"user_id\":5,\"username\":\"luis\"},\"duration\":3,\"created_at\":\"2026-11-03T10:00:00Z\"}"), "m2");
        Assert.NotNull(e);
        Assert.Equal(esperado, e!.Type);
        Assert.Equal(1, e.Amount);
        Assert.Equal(3, e.Months);
        Assert.Equal(new DateTime(2026, 11, 3, 10, 0, 0, DateTimeKind.Utc), e.OccurredAtUtc);
    }

    [Fact]
    public void SubsRegaladas_LaCantidadSaleDeContarLosReceptores()
    {
        var e = KickEventTranslator.Translate("channel.subscription.gifts",
            J("{" + Bc + ",\"gifter\":{\"user_id\":7,\"username\":\"mia\"},\"giftees\":[{\"user_id\":1,\"username\":\"a\"},{\"user_id\":2,\"username\":\"b\"},{\"user_id\":3,\"username\":\"c\"}]}"), "m3");
        Assert.NotNull(e);
        Assert.Equal(PlatformEventType.GiftedSubs, e!.Type);
        Assert.Equal(3, e.Amount);
        Assert.Equal("mia", e.UserName);
    }

    [Fact]
    public void SubsRegaladas_AnonimoConCamposNull()
    {
        var e = KickEventTranslator.Translate("channel.subscription.gifts",
            J("{" + Bc + ",\"gifter\":{\"is_anonymous\":true,\"user_id\":null,\"username\":null},\"giftees\":[{\"user_id\":1,\"username\":\"a\"}]}"), "m4");
        Assert.NotNull(e);
        Assert.True(e!.IsAnonymous);
        Assert.Null(e.UserName);
        Assert.Null(e.UserId);
        Assert.Equal(1, e.Amount);
    }

    [Fact]
    public void SubsRegaladas_SinRegaladorNiReceptores_NoRompe()
    {
        var e = KickEventTranslator.Translate("channel.subscription.gifts", J("{" + Bc + "}"), "m5");
        Assert.NotNull(e);
        Assert.True(e!.IsAnonymous);
        Assert.Equal(0, e.Amount);
    }

    [Fact]
    public void Kicks_LaCantidadEsGiftAmount_YElMensajeVacioEsNull()
    {
        var e = KickEventTranslator.Translate("kicks.gifted",
            J("{" + Bc + ",\"sender\":{\"user_id\":9,\"username\":\"pepe\"},\"gift\":{\"amount\":500,\"name\":\"Full Send\",\"type\":\"BASIC\",\"tier\":\"BASIC\",\"message\":\"  \",\"pinned_time_seconds\":0},\"created_at\":\"2026-11-03T10:00:00Z\"}"), "m6");
        Assert.NotNull(e);
        Assert.Equal(PlatformEventType.Kicks, e!.Type);
        Assert.Equal(500, e.Amount);
        Assert.Equal("pepe", e.UserName);
        Assert.Null(e.Message);
    }

    [Fact]
    public void Kicks_ConMensaje()
    {
        var e = KickEventTranslator.Translate("kicks.gifted",
            J("{" + Bc + ",\"sender\":{\"user_id\":9,\"username\":\"pepe\"},\"gift\":{\"amount\":100,\"message\":\"gracias\"}}"), "m7");
        Assert.Equal("gracias", e!.Message);
    }

    [Theory]
    [InlineData("\"gift\":{\"amount\":0}")]
    [InlineData("\"gift\":{}")]
    [InlineData("\"otro\":1")]
    public void Kicks_SinCantidadValida_SeDescarta(string cuerpo)
    {
        var e = KickEventTranslator.Translate("kicks.gifted", J("{" + Bc + ",\"sender\":{\"user_id\":9,\"username\":\"p\"}," + cuerpo + "}"), "m8");
        Assert.Null(e);
    }

    [Fact]
    public void Directo_Encendido_UsaStartedAt()
    {
        var e = KickEventTranslator.Translate("livestream.status.updated",
            J("{" + Bc + ",\"is_live\":true,\"title\":\"Hola\",\"started_at\":\"2026-11-03T10:00:00Z\",\"ended_at\":null}"), "m9");
        Assert.NotNull(e);
        Assert.Equal(PlatformEventType.StreamStatus, e!.Type);
        Assert.True(e.IsLive);
        Assert.Equal("Hola", e.Title);
        Assert.Equal(new DateTime(2026, 11, 3, 10, 0, 0, DateTimeKind.Utc), e.OccurredAtUtc);
    }

    [Fact]
    public void Directo_Apagado_UsaEndedAt()
    {
        var e = KickEventTranslator.Translate("livestream.status.updated",
            J("{" + Bc + ",\"is_live\":false,\"title\":\"x\",\"started_at\":\"2026-11-03T10:00:00Z\",\"ended_at\":\"2026-11-03T12:00:00Z\"}"), "m10");
        Assert.False(e!.IsLive);
        Assert.Equal(new DateTime(2026, 11, 3, 12, 0, 0, DateTimeKind.Utc), e.OccurredAtUtc);
    }

    [Fact]
    public void Directo_SinIsLive_SeDescarta()
    {
        Assert.Null(KickEventTranslator.Translate("livestream.status.updated", J("{" + Bc + ",\"title\":\"x\"}"), "m11"));
    }

    [Theory]
    [InlineData("chat.message.sent")]
    [InlineData("channel.reward.redemption.updated")]
    [InlineData("moderation.banned")]
    [InlineData(null)]
    public void TiposQueNoSeTraducen_DanNull(string? tipo)
    {
        Assert.Null(KickEventTranslator.Translate(tipo, J("{" + Bc + "}"), "x"));
    }

    [Fact]
    public void SinCanal_DaNull()
    {
        Assert.Null(KickEventTranslator.Translate("channel.followed", J("{\"follower\":{\"user_id\":1,\"username\":\"a\"}}"), "x"));
    }

    [Fact]
    public void PayloadQueNoEsObjeto_DaNull()
    {
        Assert.Null(KickEventTranslator.Translate("channel.followed", J("[1,2,3]"), "x"));
    }

    [Fact]
    public void SinMessageId_ArmaUnIdEstable_ParaDescartarRepetidos()
    {
        var p = J("{" + Bc + ",\"follower\":{\"user_id\":1,\"username\":\"a\"}}");
        var a = KickEventTranslator.Translate("channel.followed", p, null);
        var b = KickEventTranslator.Translate("channel.followed", p, "  ");
        Assert.NotNull(a);
        Assert.False(string.IsNullOrEmpty(a!.Id));
        Assert.Equal(a.Id, b!.Id);
    }

    [Fact]
    public void IsAlertEvent_SoloLosSeis()
    {
        Assert.Equal(6, KickEventTranslator.AlertEvents.Length);
        Assert.True(KickEventTranslator.IsAlertEvent("kicks.gifted"));
        Assert.False(KickEventTranslator.IsAlertEvent("chat.message.sent"));
        Assert.False(KickEventTranslator.IsAlertEvent(null));
    }
}
