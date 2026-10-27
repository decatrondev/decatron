using System;
using System.Linq;
using Decatron.Core.Models.Promo;
using Decatron.Services.Promo;
using Xunit;

namespace Decatron.Tests;

/// <summary>Promociones F1: las reglas del catálogo rechazan lo que no debe salir en pantalla (sin base de datos).</summary>
public class PromoValidatorTests
{
    private static PromoPiece Valid() => new()
    {
        Kind = "news", Origin = "bot", TitleEs = "Hola", BodyEs = "Un aviso", Zone = "corner", Platforms = "all", Status = "draft",
    };

    private static System.Collections.Generic.List<string> Check(PromoPiece p) { PromoValidator.NormalizePiece(p); return PromoValidator.ValidatePiece(p); }

    [Fact(DisplayName = "Promo: una pieza correcta no da errores")]
    public void PiezaValida() => Assert.Empty(Check(Valid()));

    [Fact(DisplayName = "Promo: sin título ni texto en español se rechaza")]
    public void SinContenido()
    {
        var p = Valid(); p.TitleEs = "  "; p.BodyEs = "";
        Assert.Contains("titleOrBodyRequired", Check(p));
    }

    [Theory(DisplayName = "Promo: el texto no admite < ni > (nada de HTML)")]
    [InlineData("<b>hola</b>")]
    [InlineData("a > b")]
    public void SinHtml(string texto)
    {
        var p = Valid(); p.BodyEn = texto;
        Assert.Contains("noAngleBrackets", Check(p));
    }

    [Fact(DisplayName = "Promo: solo las variables conocidas; las demás se rechazan")]
    public void Variables()
    {
        var ok = Valid(); ok.BodyEs = "Canal {{ channel }}: {{commands}}";
        Assert.Empty(Check(ok));

        var mala = Valid(); mala.BodyEs = "Hola {{usuario}}";
        Assert.Contains("unknownVariable", Check(mala));
    }

    [Fact(DisplayName = "Promo: {{link}} y el QR exigen un enlace")]
    public void LinkNecesario()
    {
        var a = Valid(); a.BodyEs = "Mira {{link}}";
        Assert.Contains("linkVariableNeedsLink", Check(a));

        var b = Valid(); b.ShowQr = true;
        Assert.Contains("qrNeedsLink", Check(b));

        var c = Valid(); c.ShowQr = true; c.LinkUrl = "https://decatron.net";
        Assert.Empty(Check(c));
    }

    [Theory(DisplayName = "Promo: el enlace solo puede ser https")]
    [InlineData("http://decatron.net")]
    [InlineData("javascript:alert(1)")]
    [InlineData("https://")]
    [InlineData("https://a b.com")]
    [InlineData("decatron.net")]
    public void EnlaceInvalido(string url)
    {
        var p = Valid(); p.LinkUrl = url;
        Assert.Contains("linkInvalid", Check(p));
    }

    [Theory(DisplayName = "Promo: la imagen es https o una ruta propia sin trucos")]
    [InlineData("https://decatron.net/x.png", true)]
    [InlineData("/brand/logo.png", true)]
    [InlineData("//evil.com/x.png", false)]
    [InlineData("/brand/../secreto", false)]
    [InlineData("http://decatron.net/x.png", false)]
    [InlineData("data:image/png;base64,AAAA", false)]
    public void Imagen(string url, bool ok)
    {
        var p = Valid(); p.ImageUrl = url;
        Assert.Equal(!ok, Check(p).Contains("imageInvalid"));
    }

    [Fact(DisplayName = "Promo: los valores numéricos se recortan a su rango")]
    public void Rangos()
    {
        var p = Valid(); p.Weight = 500; p.Priority = -4; p.DurationSeconds = 1;
        Assert.Empty(Check(p));
        Assert.Equal(100, p.Weight); Assert.Equal(0, p.Priority); Assert.Equal(3, p.DurationSeconds);
        p.DurationSeconds = 999; PromoValidator.NormalizePiece(p);
        Assert.Equal(30, p.DurationSeconds);
    }

    [Fact(DisplayName = "Promo: la fecha de fin debe ser posterior a la de inicio")]
    public void Fechas()
    {
        var p = Valid(); p.StartsAt = new DateTime(2026, 12, 1, 0, 0, 0, DateTimeKind.Utc); p.EndsAt = new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc);
        Assert.Contains("datesOrder", Check(p));
        p.EndsAt = new DateTime(2026, 12, 2, 0, 0, 0, DateTimeKind.Utc);
        Assert.Empty(Check(p));
    }

    [Fact(DisplayName = "Promo: los canales se normalizan (minúsculas, sin duplicados) y se rechaza lo raro")]
    public void Canales()
    {
        var p = Valid(); p.OnlyChannels = " PixiPNJ, pixipnj ,anthonydeca ,, ";
        Assert.Empty(Check(p));
        Assert.Equal("pixipnj,anthonydeca", p.OnlyChannels);

        var mala = Valid(); mala.OnlyChannels = "ok,mal nombre!";
        Assert.Contains("channelsInvalid", Check(mala));

        var vacia = Valid(); vacia.OnlyChannels = " , ";
        Check(vacia); Assert.Null(vacia.OnlyChannels);
    }

    [Fact(DisplayName = "Promo: los valores de lista (tipo, zona, plataforma, estado) deben ser los conocidos")]
    public void Listas()
    {
        var p = Valid(); p.Kind = "otra"; p.Zone = "Zona rara!"; p.Platforms = "youtube"; p.Status = "borrado"; p.Origin = "x";
        var e = Check(p);
        Assert.Contains("kindInvalid", e); Assert.Contains("zoneInvalid", e); Assert.Contains("platformsInvalid", e);
        Assert.Contains("statusInvalid", e); Assert.Contains("originInvalid", e);
    }

    [Fact(DisplayName = "Promo: el aviso de emergencia exige texto")]
    public void Emergencia()
    {
        var p = Valid(); p.Kind = "emergency"; p.BodyEs = ""; p.TitleEs = "Aviso";
        Assert.Contains("emergencyNeedsBody", Check(p));
    }

    [Fact(DisplayName = "Promo: el icono debe ser uno de la lista")]
    public void Iconos()
    {
        var ok = Valid(); ok.Icon = "Megaphone";
        Assert.Empty(Check(ok));
        Assert.Equal("megaphone", ok.Icon);
        var mal = Valid(); mal.Icon = "no-existe";
        Assert.Contains("iconInvalid", Check(mal));
    }

    [Fact(DisplayName = "Promo: plantillas — clave estable, nombres, zona y diseño válido")]
    public void Plantillas()
    {
        var ok = new PromoTemplate { Key = "Mi-Estilo", NameEs = "Mi estilo", Zone = "Corner", Design = PromoDesignValidatorTests.ValidDesignJson() };
        PromoValidator.NormalizeTemplate(ok);
        Assert.Equal("mi-estilo", ok.Key);
        Assert.Equal("corner", ok.Zone);
        Assert.Empty(PromoValidator.ValidateTemplate(ok));

        var mala = new PromoTemplate { Key = "x", NameEs = "", Zone = "Zona rara!", Design = "{}" };
        PromoValidator.NormalizeTemplate(mala);
        var e = PromoValidator.ValidateTemplate(mala);
        foreach (var c in new[] { "keyInvalid", "nameRequired", "zoneInvalid", "designInvalid" }) Assert.Contains(c, e);
    }

    [Fact(DisplayName = "Promo: zonas — clave, nombre, ancla y márgenes")]
    public void Zonas()
    {
        var ok = new PromoZone { Key = "Esquina-2", NameEs = "Esquina 2", Anchor = "Bottom-Left", MarginX = 40, MarginY = 40 };
        PromoValidator.NormalizeZone(ok);
        Assert.Equal("esquina-2", ok.Key);
        Assert.Equal("bottom-left", ok.Anchor);
        Assert.Empty(PromoValidator.ValidateZone(ok));

        var mala = new PromoZone { Key = "x", NameEs = "", Anchor = "arriba", MarginX = -1, MarginY = 5000 };
        PromoValidator.NormalizeZone(mala);
        var e = PromoValidator.ValidateZone(mala);
        foreach (var c in new[] { "keyInvalid", "nameRequired", "anchorInvalid", "marginRange" }) Assert.Contains(c, e);
    }

    [Theory(DisplayName = "Promo: topes de cuidado del espectador con rango")]
    [InlineData(60, 600, 0)]
    [InlineData(5, 600, 1)]
    [InlineData(60, 5, 1)]
    [InlineData(5000, 5000, 2)]
    public void Topes(int gap, int cap, int errores) => Assert.Equal(errores, PromoValidator.ValidateLimits(gap, cap).Count);
}
