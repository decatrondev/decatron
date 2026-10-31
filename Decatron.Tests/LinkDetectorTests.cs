using System.Diagnostics;
using Decatron.Core.Services.Moderation;
using Xunit;

namespace Decatron.Tests;

public class LinkDetectorTests
{
    [Theory]
    [InlineData("fakin primero tsukim40Beedrill")]
    [InlineData("buena rey como estamos")]
    [InlineData("@DecatronStreamBot cuantos baneos lleva ya la asian?")]
    [InlineData("Yo seria más como la Eli")]
    [InlineData("jajaja.xd v1.2 3.5 que bueno")]
    public void ChatNormal_NoEsLinkNiSospechoso(string texto)
    {
        Assert.Empty(LinkDetector.FindHosts(texto, true));
    }

    [Theory]
    [InlineData("mira https://www.YouTube.com/watch?v=x", "www.youtube.com")]
    [InlineData("entra a ejemplo.com ya", "ejemplo.com")]
    [InlineData("ejemplo . com", "ejemplo.com")]
    [InlineData("ejemplo(dot)com", "ejemplo.com")]
    public void Links_SeDetectan(string texto, string esperado)
    {
        Assert.Contains(LinkDetector.FindHosts(texto, true), h => h.Contains(esperado.Replace("www.", "")));
    }

    [Fact]
    public void MensajesLargosPatologicos_TerminanRapidoYSinMarcarSospechoso()
    {
        var casos = new[]
        {
            new string('a', 500),
            string.Concat(Enumerable.Repeat("a-", 250)),
            string.Concat(Enumerable.Repeat("a.", 250)),
            string.Concat(Enumerable.Repeat("a .", 160)),
            string.Concat(Enumerable.Repeat("a (dot) ", 60)),
        };
        foreach (var caso in casos)
        {
            var sw = Stopwatch.StartNew();
            var hosts = LinkDetector.FindHosts(caso, true);
            sw.Stop();
            Assert.DoesNotContain(LinkDetector.TimeoutMarker, hosts);
            Assert.True(sw.ElapsedMilliseconds < 250, $"tardó {sw.ElapsedMilliseconds} ms con '{caso[..12]}…'");
        }
    }
}
