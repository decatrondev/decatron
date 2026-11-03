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
}
