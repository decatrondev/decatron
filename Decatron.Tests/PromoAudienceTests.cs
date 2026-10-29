using System;
using Decatron.Services.Accounts;
using Decatron.Services.Promo;
using Xunit;

namespace Decatron.Tests;

/// <summary>Promociones F7 (preparación): reglas puras de la audiencia (en directo, espectadores, contenido de marca), sin red ni base de datos.</summary>
public class PromoAudienceTests
{
    private static readonly DateTime Ahora = new(2026, 10, 29, 20, 0, 0, DateTimeKind.Utc);

    [Fact(DisplayName = "Promo audiencia: sin dato no cuenta como en directo")]
    public void SinDato() => Assert.Equal((false, 0), PromoAudience.Reading(null, Ahora));

    [Fact(DisplayName = "Promo audiencia: un dato reciente en directo cuenta con sus espectadores")]
    public void DatoReciente() =>
        Assert.Equal((true, 42), PromoAudience.Reading(new AudienceSample(true, 42, null, Ahora.AddMinutes(-4)), Ahora));

    [Fact(DisplayName = "Promo audiencia: un dato viejo (más de 12 minutos) deja de valer")]
    public void DatoViejo() =>
        Assert.Equal((false, 0), PromoAudience.Reading(new AudienceSample(true, 42, null, Ahora.AddMinutes(-13)), Ahora));

    [Fact(DisplayName = "Promo audiencia: fuera de directo no suma espectadores")]
    public void FueraDeDirecto() =>
        Assert.Equal((false, 0), PromoAudience.Reading(new AudienceSample(false, 99, null, Ahora), Ahora));

    [Fact(DisplayName = "Promo audiencia: dos plataformas suman espectadores solo de las que están en directo")]
    public void CombinaPlataformas()
    {
        var s = PromoAudience.Combine(new[] { (true, 30), (true, 12), (false, 500) }, null, Ahora);
        Assert.True(s.Live); Assert.Equal(42, s.Viewers);
        Assert.False(PromoAudience.Combine(new[] { (false, 5) }, null, Ahora).Live);
    }

    [Theory(DisplayName = "Promo audiencia: pieza de tercero en Twitch exige contenido de marca activo y dato reciente")]
    [InlineData(true, true, "all", true, 2, true)]     // marca activa, dato reciente
    [InlineData(false, true, "all", true, 2, false)]   // marca apagada
    [InlineData(true, true, "all", true, 30, false)]   // dato viejo
    [InlineData(false, true, "kick", true, 2, true)]   // overlay solo Kick: no se pide
    [InlineData(false, false, "all", true, 2, true)]   // cuenta sin Twitch: no se pide
    [InlineData(false, true, "twitch", false, 2, true)] // control apagado en la configuración
    public void TerceroEnTwitch(bool branded, bool hasTwitch, string variant, bool required, int minutosDeEdad, bool esperado)
    {
        var s = new AudienceSample(true, 10, branded, Ahora.AddMinutes(-minutosDeEdad));
        Assert.Equal(esperado, PromoAudience.ThirdPartyAllowed(s, hasTwitch, variant, required, Ahora));
    }

    [Fact(DisplayName = "Promo audiencia: sin ningún dato, una pieza de tercero en Twitch no sale")]
    public void TerceroSinDato() => Assert.False(PromoAudience.ThirdPartyAllowed(null, true, OverlayVariant.Twitch, true, Ahora));
}
