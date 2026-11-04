using Decatron.Core.Helpers;
using Xunit;

namespace Decatron.Tests;

/// <summary>Modo de configuración de Event Alerts (Unificada / Separada): reglas puras.</summary>
public class EventAlertsPlatformModeTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("no es json")]
    [InlineData("[]")]
    [InlineData("{}")]
    [InlineData("{\"global\":{}}")]
    [InlineData("{\"global\":{\"platformMode\":\"separate\"}}")]
    [InlineData("{\"global\":{\"platformMode\":\"cualquier cosa\"}}")]
    [InlineData("{\"global\":{\"platformMode\":5}}")]
    [InlineData("{\"global\":\"x\"}")]
    public void SinModoValido_EsSeparada(string? json)
    {
        Assert.Equal(EventAlertsMode.Separate, EventAlertsPlatformMode.Parse(json));
    }

    [Theory]
    [InlineData("{\"global\":{\"platformMode\":\"unified\"}}")]
    [InlineData("{\"global\":{\"platformMode\":\"UNIFIED\"}}")]
    [InlineData("{\"follow\":{},\"global\":{\"enabled\":true,\"platformMode\":\"unified\",\"defaultVolume\":50}}")]
    public void Unificada_SoloConElValorExacto(string json)
    {
        Assert.Equal(EventAlertsMode.Unified, EventAlertsPlatformMode.Parse(json));
    }

    [Fact]
    public void KickSeparada_UsaLaConfiguracionDeLaFilaDeKick()
    {
        Assert.Equal("kick_123", EventAlertsPlatformMode.PreferredConfigChannel(EventAlertsMode.Separate, "kick", "kick_123", "anthonydeca"));
    }

    [Theory]
    [InlineData(EventAlertsMode.Unified, "kick", "kick_123", "anthonydeca")]   // unificada: la principal
    [InlineData(EventAlertsMode.Separate, "twitch", "kick_123", "anthonydeca")] // Twitch nunca cambia
    [InlineData(EventAlertsMode.Separate, "kick", null, "anthonydeca")]        // sin fila de Kick conocida
    [InlineData(EventAlertsMode.Separate, "kick", "  ", "anthonydeca")]
    [InlineData(EventAlertsMode.Separate, "kick", "kick_123", "kick_123")]      // cuenta solo de Kick: ya es la principal
    [InlineData(EventAlertsMode.Separate, "kick", "KICK_123", "kick_123")]
    public void EnElRestoDeLosCasos_SeUsaLaPrincipal(EventAlertsMode modo, string plataforma, string? kickLogin, string principal)
    {
        Assert.Null(EventAlertsPlatformMode.PreferredConfigChannel(modo, plataforma, kickLogin, principal));
    }

    [Theory]
    [InlineData("kick", false, true)]   // configuracion compartida: los Kicks se convierten
    [InlineData("kick", true, false)]   // configuracion propia de Kick: ya estan en Kicks
    [InlineData("twitch", false, false)]
    [InlineData("twitch", true, false)]
    public void ConversionDeKicks(string plataforma, bool propia, bool esperado)
    {
        Assert.Equal(esperado, EventAlertsPlatformMode.ConvertKicksToBits(plataforma, propia));
    }

    [Fact]
    public void Creditos_SeCobranALaFilaPrincipal()
    {
        Assert.Equal(10, EventAlertsPlatformMode.CreditUserId(10, 99));   // config de la fila de Kick (99), cuenta principal 10
        Assert.Equal(99, EventAlertsPlatformMode.CreditUserId(null, 99)); // sin cuenta resuelta: la dueña de la config
    }

    // ── Cuenta solo de Kick ──────────────────────────────────────────────────

    [Theory]
    [InlineData(EventAlertsMode.Separate)]
    [InlineData(EventAlertsMode.Unified)]
    public void CuentaSoloKick_SiempreUsaSuPropiaConfiguracion(EventAlertsMode modo)
    {
        Assert.Equal("kick_123", EventAlertsPlatformMode.PreferredConfigChannel(modo, "kick", "kick_123", "kick_123", accountHasTwitch: false));
    }

    [Fact]
    public void CuentaSoloKick_PeroEventoDeTwitch_NoCambiaNada()
    {
        Assert.Null(EventAlertsPlatformMode.PreferredConfigChannel(EventAlertsMode.Separate, "twitch", "kick_123", "kick_123", accountHasTwitch: false));
    }

    // ── Cambiar de modo ──────────────────────────────────────────────────────

    [Fact]
    public void WithMode_FijaElModoSinTocarElResto()
    {
        var json = EventAlertsPlatformMode.WithMode("{\"global\":{\"enabled\":true,\"defaultVolume\":40},\"follow\":{\"enabled\":true}}", EventAlertsMode.Unified)!;
        Assert.Equal(EventAlertsMode.Unified, EventAlertsPlatformMode.Parse(json));
        using var doc = System.Text.Json.JsonDocument.Parse(json);
        Assert.True(doc.RootElement.GetProperty("follow").GetProperty("enabled").GetBoolean());
        Assert.Equal(40, doc.RootElement.GetProperty("global").GetProperty("defaultVolume").GetInt32());
        Assert.True(doc.RootElement.GetProperty("global").GetProperty("enabled").GetBoolean());
    }

    [Fact]
    public void WithMode_CreaGlobalSiNoExisteYVuelveASeparada()
    {
        var unificada = EventAlertsPlatformMode.WithMode("{}", EventAlertsMode.Unified)!;
        Assert.Equal(EventAlertsMode.Unified, EventAlertsPlatformMode.Parse(unificada));
        var separada = EventAlertsPlatformMode.WithMode(unificada, EventAlertsMode.Separate)!;
        Assert.Equal(EventAlertsMode.Separate, EventAlertsPlatformMode.Parse(separada));
    }

    [Theory]
    [InlineData("[]")]
    [InlineData("no es json")]
    public void WithMode_ConJsonInvalido_DaNull(string json)
    {
        Assert.Null(EventAlertsPlatformMode.WithMode(json, EventAlertsMode.Unified));
    }

    // ── Guardar desde el panel ───────────────────────────────────────────────

    [Fact]
    public void AlGuardarLaPrincipal_SeConservaElModoQueYaHabia_AunqueElPanelTraigaOtro()
    {
        var existente = "{\"global\":{\"platformMode\":\"unified\"}}";
        var entrante = "{\"global\":{\"platformMode\":\"separate\",\"defaultVolume\":10},\"follow\":{}}";
        var guardado = EventAlertsPlatformMode.ApplyOnSave(existente, entrante, savingPrincipal: true);
        Assert.Equal(EventAlertsMode.Unified, EventAlertsPlatformMode.Parse(guardado));
        Assert.Contains("\"defaultVolume\":10", guardado);
    }

    [Fact]
    public void AlGuardarLaPrincipal_SinModoGuardado_NoSeInventaUno()
    {
        var guardado = EventAlertsPlatformMode.ApplyOnSave("{\"global\":{}}", "{\"global\":{\"platformMode\":\"unified\"}}", savingPrincipal: true);
        Assert.DoesNotContain("platformMode", guardado);
        Assert.Equal(EventAlertsMode.Separate, EventAlertsPlatformMode.Parse(guardado));
    }

    [Fact]
    public void AlGuardarLaDeKick_SeQuitaElModo()
    {
        var guardado = EventAlertsPlatformMode.ApplyOnSave("{\"global\":{\"platformMode\":\"unified\"}}", "{\"global\":{\"platformMode\":\"unified\",\"defaultVolume\":10}}", savingPrincipal: false);
        Assert.DoesNotContain("platformMode", guardado);
        Assert.Contains("\"defaultVolume\":10", guardado);
    }

    [Theory]
    [InlineData("no es json")]
    [InlineData("{}")]
    [InlineData("[]")]
    public void ApplyOnSave_NuncaRompe(string entrante)
    {
        Assert.Equal(entrante, EventAlertsPlatformMode.ApplyOnSave(null, entrante, true));
    }
}
