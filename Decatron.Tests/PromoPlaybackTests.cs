using System;
using System.Collections.Generic;
using System.Linq;
using Decatron.Core.Models.Promo;
using Decatron.Services.Promo;
using Xunit;

namespace Decatron.Tests;

/// <summary>Promociones F2: las reglas de rotación del overlay (elegibilidad, prioridad, peso, mínimo entre piezas y tope por hora), sin base de datos.</summary>
public class PromoPlaybackTests
{
    private static readonly DateTime Now = new(2026, 10, 28, 12, 0, 0, DateTimeKind.Utc);
    private static readonly string[] Logins = { "anthonydeca" };

    private static PromoPiece P(long id, int priority = 0, int weight = 1, int seconds = 10) => new()
    {
        Id = id, Status = "published", Zone = "corner", Platforms = "all", Priority = priority, Weight = weight, DurationSeconds = seconds,
    };

    private static bool Ok(PromoPiece p, string variant = "all") => PromoPlayback.IsEligible(p, "corner", variant, Logins, Now);

    [Fact(DisplayName = "Promo: una pieza publicada de la zona es elegible")]
    public void Elegible() => Assert.True(Ok(P(1)));

    [Fact(DisplayName = "Promo: borrador, peso 0 o zona distinta no salen")]
    public void NoElegible()
    {
        var d = P(1); d.Status = "draft";
        var w = P(2, weight: 0);
        var z = P(3); z.Zone = "banner";
        Assert.False(Ok(d)); Assert.False(Ok(w)); Assert.False(Ok(z));
    }

    [Fact(DisplayName = "Promo: respeta la vigencia")]
    public void Vigencia()
    {
        var antes = P(1); antes.StartsAt = Now.AddHours(1);
        var despues = P(2); despues.EndsAt = Now.AddHours(-1);
        var dentro = P(3); dentro.StartsAt = Now.AddHours(-1); dentro.EndsAt = Now.AddHours(1);
        Assert.False(Ok(antes)); Assert.False(Ok(despues)); Assert.True(Ok(dentro));
    }

    [Fact(DisplayName = "Promo: una pieza solo de Kick no sale en un enlace solo de Twitch, pero sí en «todo»")]
    public void Plataforma()
    {
        var kick = P(1); kick.Platforms = "kick";
        Assert.False(Ok(kick, "twitch")); Assert.True(Ok(kick, "kick")); Assert.True(Ok(kick, "all"));
    }

    [Fact(DisplayName = "Promo: only_channels limita por login de cualquier canal de la cuenta")]
    public void Canales()
    {
        var p = P(1); p.OnlyChannels = "Otro, AnthonyDeca";
        var q = P(2); q.OnlyChannels = "otro";
        Assert.True(Ok(p)); Assert.False(Ok(q));
    }

    [Fact(DisplayName = "Promo: solo compiten las de mayor prioridad")]
    public void Prioridad()
    {
        var pick = PromoPlayback.Pick(new List<PromoPiece> { P(1, priority: 1), P(2, priority: 5) }, null, 0.0);
        Assert.Equal(2, pick!.Id);
    }

    [Fact(DisplayName = "Promo: no repite la anterior si hay otra")]
    public void SinRepetir()
    {
        var list = new List<PromoPiece> { P(1), P(2) };
        Assert.Equal(2, PromoPlayback.Pick(list, 1, 0.0)!.Id);
        Assert.Equal(1, PromoPlayback.Pick(new List<PromoPiece> { P(1) }, 1, 0.0)!.Id);
    }

    [Fact(DisplayName = "Promo: el sorteo respeta el peso")]
    public void Peso()
    {
        var list = new List<PromoPiece> { P(1, weight: 1), P(2, weight: 3) };
        Assert.Equal(1, PromoPlayback.Pick(list, null, 0.1)!.Id);
        Assert.Equal(2, PromoPlayback.Pick(list, null, 0.5)!.Id);
        Assert.Equal(2, PromoPlayback.Pick(list, null, 0.999)!.Id);
    }

    [Fact(DisplayName = "Promo: tras mostrar una pieza la zona espera su duración más el mínimo entre piezas")]
    public void MinimoEntrePiezas()
    {
        var s = new PromoPlayback.State();
        var limits = new PromoOverlayLimits { MinGapSeconds = 60, HourlyCapSeconds = 600 };
        var p = P(1, seconds: 10);
        Assert.Equal(0, PromoPlayback.WaitSeconds(s, "corner", limits, 10, Now));
        PromoPlayback.MarkShown(s, p, limits, Now);
        Assert.Equal(70, PromoPlayback.WaitSeconds(s, "corner", limits, 10, Now));
        Assert.Equal(0, PromoPlayback.WaitSeconds(s, "corner", limits, 10, Now.AddSeconds(70)));
        Assert.Equal(0, PromoPlayback.WaitSeconds(s, "banner", limits, 10, Now));
    }

    [Fact(DisplayName = "Promo: el tope por hora frena y libera cuando la entrada más vieja sale de la ventana")]
    public void TopePorHora()
    {
        var s = new PromoPlayback.State();
        var limits = new PromoOverlayLimits { MinGapSeconds = 0, HourlyCapSeconds = 30 };
        var p = P(1, seconds: 15);
        PromoPlayback.MarkShown(s, p, limits, Now);
        PromoPlayback.MarkShown(s, p, limits, Now.AddMinutes(1));
        var at = Now.AddMinutes(2);
        Assert.Equal((int)(Now.AddHours(1) - at).TotalSeconds, PromoPlayback.WaitSeconds(s, "otra", limits, 15, at));
        Assert.Equal(0, PromoPlayback.WaitSeconds(s, "otra", limits, 15, Now.AddHours(1).AddSeconds(1)));
    }

    [Fact(DisplayName = "Promo: el streamer solo puede ser más discreto que los topes globales")]
    public void TopesDelStreamer()
    {
        var g = new PromoOverlayLimits { MinGapSeconds = 60, HourlyCapSeconds = 600 };
        var mas = PromoPlayback.EffectiveLimits(g, new PromoChannelSettings { MinGapSeconds = 120, HourlyCapSeconds = 300 });
        Assert.Equal(120, mas.MinGapSeconds); Assert.Equal(300, mas.HourlyCapSeconds);
        var menos = PromoPlayback.EffectiveLimits(g, new PromoChannelSettings { MinGapSeconds = 10, HourlyCapSeconds = 5000 });
        Assert.Equal(60, menos.MinGapSeconds); Assert.Equal(600, menos.HourlyCapSeconds);
        var ninguno = PromoPlayback.EffectiveLimits(g, null);
        Assert.Equal(60, ninguno.MinGapSeconds); Assert.Equal(600, ninguno.HourlyCapSeconds);
    }

    [Fact(DisplayName = "Promo: los ids apagados se leen del JSON y lo ilegible se ignora")]
    public void PiezasApagadas()
    {
        Assert.Equal(new long[] { 3, 7 }, PromoPlayback.DisabledIds(new PromoChannelSettings { DisabledPieces = "[3,7]" }).OrderBy(i => i));
        Assert.Empty(PromoPlayback.DisabledIds(new PromoChannelSettings { DisabledPieces = "no es json" }));
        Assert.Empty(PromoPlayback.DisabledIds(null));
    }
}
