using System;
using Decatron.Core.Models.Promo;
using Decatron.Services.Promo;
using Xunit;

namespace Decatron.Tests;

/// <summary>Promociones F3b: reglas puras de los disparadores (inicio de directo y raid).</summary>
public class PromoTriggersTests
{
    private static readonly DateTime Now = new(2026, 10, 29, 12, 0, 0, DateTimeKind.Utc);

    [Fact(DisplayName = "Promo disparadores: sin ajustes están apagados")]
    public void Off_by_default()
    {
        Assert.False(PromoTriggers.Of(null, PromoTriggers.Start).Enabled);
        Assert.False(PromoTriggers.Of(new PromoChannelSettings(), PromoTriggers.Raid).Enabled);
        Assert.False(PromoTriggers.Of(new PromoChannelSettings { TriggerStartEnabled = true }, "otro").Enabled);
    }

    [Fact(DisplayName = "Promo disparadores: cada tipo lee sus propias columnas")]
    public void Reads_own_columns()
    {
        var s = new PromoChannelSettings { TriggerStartEnabled = true, TriggerStartPieceId = 4, TriggerStartDelaySeconds = 30, TriggerRaidEnabled = true, TriggerRaidPieceId = -2, TriggerRaidDelaySeconds = 5 };
        Assert.Equal((true, (long?)4, 30), PromoTriggers.Of(s, PromoTriggers.Start));
        Assert.Equal((true, (long?)-2, 5), PromoTriggers.Of(s, PromoTriggers.Raid));
    }

    [Theory(DisplayName = "Promo disparadores: la espera va de 0 a 120 s")]
    [InlineData(0, true)] [InlineData(120, true)] [InlineData(-1, false)] [InlineData(121, false)]
    public void Delay_range(int seconds, bool ok) => Assert.Equal(ok, PromoTriggers.DelayValid(seconds));

    [Fact(DisplayName = "Promo disparadores: el enfriamiento evita repetir (15 min inicio, 3 min raid)")]
    public void Cooldowns()
    {
        Assert.True(PromoTriggers.CooledDown(null, Now, PromoTriggers.Start));
        Assert.False(PromoTriggers.CooledDown(Now.AddMinutes(-14), Now, PromoTriggers.Start));
        Assert.True(PromoTriggers.CooledDown(Now.AddMinutes(-15), Now, PromoTriggers.Start));
        Assert.False(PromoTriggers.CooledDown(Now.AddMinutes(-2), Now, PromoTriggers.Raid));
        Assert.True(PromoTriggers.CooledDown(Now.AddMinutes(-3), Now, PromoTriggers.Raid));
    }
}

/// <summary>Promociones: «una pieza a la vez entre todas las zonas».</summary>
public class PromoOneAtATimeTests
{
    private static readonly DateTime Now = new(2026, 10, 29, 12, 0, 0, DateTimeKind.Utc);
    private static PromoPiece P(string zone, int seconds) => new() { Id = 1, Zone = zone, DurationSeconds = seconds };

    [Fact(DisplayName = "Promo una a la vez: otra zona espera a que termine la pieza en pantalla y su pausa")]
    public void Other_zone_waits()
    {
        var limits = new PromoOverlayLimits { MinGapSeconds = 60, HourlyCapSeconds = 0, OneAtATime = true };
        var st = new PromoPlayback.State();
        PromoPlayback.MarkShown(st, P("corner", 10), limits, Now);
        Assert.Equal(70, PromoPlayback.WaitSeconds(st, "banner", limits, 8, Now));
        Assert.Equal(10, PromoPlayback.OtherZoneBusySeconds(st, "banner", Now));
        Assert.Equal(0, PromoPlayback.OtherZoneBusySeconds(st, "corner", Now));
        Assert.Equal(0, PromoPlayback.OtherZoneBusySeconds(st, "banner", Now.AddSeconds(10)));
    }

    [Fact(DisplayName = "Promo una a la vez: apagado, cada zona espera solo la suya")]
    public void Off_zones_independent()
    {
        var limits = new PromoOverlayLimits { MinGapSeconds = 60, HourlyCapSeconds = 0, OneAtATime = false };
        var st = new PromoPlayback.State();
        PromoPlayback.MarkShown(st, P("corner", 10), limits, Now);
        Assert.Equal(0, PromoPlayback.WaitSeconds(st, "banner", limits, 8, Now));
        Assert.Equal(70, PromoPlayback.WaitSeconds(st, "corner", limits, 8, Now));
    }

    [Fact(DisplayName = "Promo una a la vez: el streamer hereda el interruptor del dueño")]
    public void Streamer_inherits()
    {
        Assert.True(PromoPlayback.EffectiveLimits(new PromoOverlayLimits { OneAtATime = true }, null).OneAtATime);
        Assert.False(PromoPlayback.EffectiveLimits(new PromoOverlayLimits { OneAtATime = false }, new PromoChannelSettings()).OneAtATime);
    }
}
