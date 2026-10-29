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

    [Theory(DisplayName = "Promo audiencia: el estado para pantalla distingue listo, falta contenido de marca, sin dato y no aplica")]
    [InlineData(true, true, false, true, 2, "ready")]
    [InlineData(true, false, false, true, 2, "needsBranded")]
    [InlineData(true, true, false, true, 30, "unknown")]     // dato viejo
    [InlineData(true, null, false, true, 2, "unknown")]      // la API no respondió: no se sabe
    [InlineData(false, false, true, true, 2, "notRequired")]  // cuenta solo de Kick
    [InlineData(true, false, false, false, 2, "notRequired")] // control apagado
    public void EstadoParaPantalla(bool hasTwitch, bool? branded, bool hasKick, bool required, int minutosDeEdad, string esperado)
    {
        var s = new AudienceSample(true, 10, branded, Ahora.AddMinutes(-minutosDeEdad));
        Assert.Equal(esperado, PromoAudience.Describe(s, hasTwitch, hasKick, required, Ahora).Status);
    }

    [Fact(DisplayName = "Promo audiencia: sin muestreo el estado es desconocido, sin hora y sin espectadores")]
    public void EstadoSinDato()
    {
        var d = PromoAudience.Describe(null, true, false, true, Ahora);
        Assert.Equal(("unknown", false, 0, (DateTime?)null), (d.Status, d.Live, d.Viewers, d.SampledAt));
    }
}
