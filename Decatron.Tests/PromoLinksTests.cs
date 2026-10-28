using Decatron.Services.Promo;
using Xunit;

namespace Decatron.Tests;

/// <summary>Enlace corto del QR de Promociones: el código identifica pieza o tarjeta y cuenta, nunca el destino.</summary>
public class PromoLinksTests
{
    [Theory(DisplayName = "El código de una pieza o tarjeta propia se escribe y se lee de vuelta")]
    [InlineData(6L, 1L)]
    [InlineData(-5L, 987654321L)]
    [InlineData(123456L, 36L)]
    public void RoundTrip(long pieceId, long userId)
    {
        Assert.True(PromoLinks.TryParse(PromoLinks.Code(pieceId, userId), out var p, out var u));
        Assert.Equal((pieceId, userId), (p, u));
        Assert.StartsWith("https://decatron.net/r/", PromoLinks.ShortUrl(pieceId, userId));
    }

    [Theory(DisplayName = "Lo que no tiene la forma esperada se rechaza (nada que parezca un destino)")]
    [InlineData("")]
    [InlineData("p6")]
    [InlineData("p0-1")]
    [InlineData("x6-1")]
    [InlineData("p6-")]
    [InlineData("p6-ZZ")]
    [InlineData("p6-1/../x")]
    [InlineData("https://evil.example")]
    [InlineData("p99999999999999999999-1")]
    public void RejectsMalformed(string code) => Assert.False(PromoLinks.TryParse(code, out _, out _));

    [Theory(DisplayName = "Vistas previas y rastreadores no cuentan como clic")]
    [InlineData(null, true)]
    [InlineData("", true)]
    [InlineData("Mozilla/5.0 (compatible; Discordbot/2.0)", true)]
    [InlineData("WhatsApp/2.23", true)]
    [InlineData("curl/8.5.0", true)]
    [InlineData("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36", false)]
    public void Automated(string? ua, bool expected) => Assert.Equal(expected, PromoLinks.LooksAutomated(ua));
}
