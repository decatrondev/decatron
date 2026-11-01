using Decatron.Services;
using Decatron.Services.SongRequest;
using Decatron.Services.GameData;
using Xunit;

namespace Decatron.Tests;

/// <summary>La tarjeta de Decatron en el overlay del timer: mismo criterio por plan que Song Request y Game Overlays.</summary>
public class TimerPromoCardTests
{
    private static readonly string?[] Tiers = { null, "free", "supporter", "premium", "patrocinador", "fundador", "admin", "desconocido" };

    [Fact(DisplayName = "Tarjeta del timer: el plan puede ocultarla exactamente cuando puede en Song Request y en Game Overlays")]
    public void CanHide_MatchesSongRequestAndGames()
    {
        foreach (var t in Tiers)
        {
            Assert.Equal(SongRequestTierLimits.ForTier(t).CanHidePromo, TimerTierLimits.CanHidePromo(t));
            Assert.Equal(GameOverlayTierLimits.ForTier(t).CanHidePromo, TimerTierLimits.CanHidePromo(t));
        }
    }

    [Theory(DisplayName = "Tarjeta del timer: el plan gratis siempre la muestra, aunque la hayan apagado")]
    [InlineData(null)]
    [InlineData("free")]
    [InlineData("desconocido")]
    public void FreePlan_AlwaysShows(string? tier)
    {
        Assert.True(TimerTierLimits.ShowCard(tier, "{\"decatronCard\":false}"));
        Assert.True(TimerTierLimits.ShowCard(tier, null));
    }

    [Theory(DisplayName = "Tarjeta del timer: desde Supporter se oculta solo con el interruptor apagado de forma explícita")]
    [InlineData("supporter")]
    [InlineData("premium")]
    [InlineData("patrocinador")]
    [InlineData("fundador")]
    [InlineData("admin")]
    public void PaidPlans_HideOnlyWhenExplicitlyOff(string tier)
    {
        Assert.False(TimerTierLimits.ShowCard(tier, "{\"decatronCard\":false}"));
        Assert.True(TimerTierLimits.ShowCard(tier, "{\"decatronCard\":true}"));
        Assert.True(TimerTierLimits.ShowCard(tier, "{}"));                        // sin interruptor guardado = encendida
        Assert.True(TimerTierLimits.ShowCard(tier, null));
        Assert.True(TimerTierLimits.ShowCard(tier, ""));
        Assert.True(TimerTierLimits.ShowCard(tier, "no es json"));                // un valor roto no la apaga
        Assert.True(TimerTierLimits.ShowCard(tier, "[1,2]"));
        Assert.True(TimerTierLimits.ShowCard(tier, "{\"decatronCard\":\"false\"}")); // solo un false real la apaga
    }
}
