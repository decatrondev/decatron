using System.Collections.Generic;
using System.Linq;
using Decatron.Services.Promo;
using Xunit;

namespace Decatron.Tests;

/// <summary>Promociones B2: los ajustes del streamer (color, texto, tipografía) solo valen si el dueño los declaró y el valor pasa las listas cerradas.</summary>
public class PromoSlotsTests
{
    private const string Anim = "{\"enter\":{\"type\":\"fade\",\"direction\":\"left\",\"durationMs\":500,\"easing\":\"ease-out\",\"delayMs\":0},\"exit\":{\"type\":\"none\",\"direction\":\"left\",\"durationMs\":500,\"easing\":\"ease-out\",\"delayMs\":0}}";
    private const string Common = "\"enabled\":true,\"name\":\"E\",\"x\":0,\"y\":0,\"width\":100,\"height\":50,\"rotation\":0,\"opacity\":100,\"animation\":" + Anim + ",\"loop\":{\"type\":\"none\",\"durationMs\":2000,\"delayMs\":0}";
    private const string FillJson = "{\"type\":\"color\",\"color\":\"#112233\",\"gradient\":{\"color1\":\"#112233\",\"color2\":\"#000000\",\"angle\":90}}";
    private const string BorderJson = "{\"enabled\":false,\"color\":\"#ffffff\",\"width\":1}";
    private const string GlowJson = "{\"enabled\":false,\"color\":\"#3b82f6\",\"blur\":10}";

    private static string Design(string slots) =>
        "{\"version\":1,\"canvas\":{\"width\":400,\"height\":120},\"animation\":" + Anim + ",\"slots\":" + slots + ",\"elements\":["
        + "{\"id\":\"bg\",\"kind\":\"shape\"," + Common + ",\"fill\":" + FillJson + ",\"border\":" + BorderJson + ",\"glow\":" + GlowJson + ",\"shadow\":\"\",\"radius\":10,\"cut\":\"none\",\"cutSize\":0,\"backdropBlur\":0},"
        + "{\"id\":\"tx\",\"kind\":\"text\"," + Common + ",\"template\":\"Hola\",\"fontFamily\":\"Inter\",\"fontSize\":20,\"fontWeight\":500,\"color\":\"#ffffff\",\"align\":\"left\",\"verticalAlign\":\"center\",\"lineHeight\":1.2,\"letterSpacing\":0,\"italic\":false,\"uppercase\":false,\"maxLines\":0,\"shadow\":\"none\",\"glowColor\":\"#3b82f6\",\"fill\":" + FillJson + ",\"border\":" + BorderJson + ",\"radius\":0,\"padding\":0}"
        + "]}";

    private const string GoodSlots = "[{\"id\":\"acc\",\"kind\":\"color\",\"labelEs\":\"Acento\",\"labelEn\":\"Accent\",\"maxLength\":40,\"targets\":[{\"elementId\":\"bg\",\"prop\":\"fill.color\"},{\"elementId\":\"tx\",\"prop\":\"color\"}]},"
        + "{\"id\":\"lbl\",\"kind\":\"text\",\"labelEs\":\"Etiqueta\",\"labelEn\":\"Label\",\"maxLength\":30,\"targets\":[{\"elementId\":\"tx\",\"prop\":\"template\"}]},"
        + "{\"id\":\"fnt\",\"kind\":\"font\",\"labelEs\":\"Fuente\",\"labelEn\":\"Font\",\"maxLength\":40,\"targets\":[{\"elementId\":\"tx\",\"prop\":\"fontFamily\"}]}]";

    [Fact(DisplayName = "Promo ajustes: un diseño con ajustes bien declarados pasa el validador")]
    public void DeclaracionSana() => Assert.Empty(PromoDesignValidator.Validate(Design(GoodSlots)));

    [Theory(DisplayName = "Promo ajustes: se rechaza un ajuste mal declarado")]
    [InlineData("[{\"id\":\"a\",\"kind\":\"color\",\"labelEs\":\"x\",\"labelEn\":\"x\",\"maxLength\":40,\"targets\":[{\"elementId\":\"nada\",\"prop\":\"color\"}]}]")]
    [InlineData("[{\"id\":\"a\",\"kind\":\"color\",\"labelEs\":\"x\",\"labelEn\":\"x\",\"maxLength\":40,\"targets\":[{\"elementId\":\"tx\",\"prop\":\"template\"}]}]")]
    [InlineData("[{\"id\":\"a\",\"kind\":\"color\",\"labelEs\":\"x\",\"labelEn\":\"x\",\"maxLength\":40,\"targets\":[{\"elementId\":\"bg\",\"prop\":\"fill.color; x\"}]}]")]
    [InlineData("[{\"id\":\"a\",\"kind\":\"imagen\",\"labelEs\":\"x\",\"labelEn\":\"x\",\"maxLength\":40,\"targets\":[{\"elementId\":\"bg\",\"prop\":\"fill.color\"}]}]")]
    [InlineData("[{\"id\":\"a\",\"kind\":\"color\",\"labelEs\":\"<b>\",\"labelEn\":\"x\",\"maxLength\":40,\"targets\":[{\"elementId\":\"bg\",\"prop\":\"fill.color\"}]}]")]
    [InlineData("[{\"id\":\"a\",\"kind\":\"color\",\"labelEs\":\"x\",\"labelEn\":\"x\",\"maxLength\":40,\"targets\":[]}]")]
    public void DeclaracionMala(string slots) => Assert.Contains("designSlotsInvalid", PromoDesignValidator.Validate(Design(slots)));

    [Fact(DisplayName = "Promo ajustes: dos ajustes con el mismo id se rechazan")]
    public void IdRepetido()
    {
        var one = "{\"id\":\"a\",\"kind\":\"color\",\"labelEs\":\"x\",\"labelEn\":\"x\",\"maxLength\":40,\"targets\":[{\"elementId\":\"bg\",\"prop\":\"fill.color\"}]}";
        Assert.Contains("designSlotsInvalid", PromoDesignValidator.Validate(Design($"[{one},{one}]")));
    }

    [Fact(DisplayName = "Promo ajustes: valores válidos del streamer pasan")]
    public void ValoresSanos()
    {
        var v = new Dictionary<string, string> { ["acc"] = "#ff0000", ["lbl"] = "Sígueme en {{channel}}", ["fnt"] = "Poppins" };
        Assert.Empty(PromoSlots.ValidateValues(Design(GoodSlots), v));
    }

    [Theory(DisplayName = "Promo ajustes: se rechaza un valor del streamer fuera de las listas")]
    [InlineData("acc", "red; background:url(x)")]
    [InlineData("acc", "url(http://x)")]
    [InlineData("lbl", "<img src=x>")]
    [InlineData("lbl", "{{secreto}}")]
    [InlineData("lbl", "texto demasiado largo para el ajuste de treinta")]
    [InlineData("fnt", "Comic Sans; x")]
    [InlineData("otro", "#fff")]
    public void ValorMalo(string id, string value) => Assert.NotEmpty(PromoSlots.ValidateValues(Design(GoodSlots), new Dictionary<string, string> { [id] = value }));

    [Fact(DisplayName = "Promo ajustes: al leer se descartan los valores de ajustes que el dueño quitó o cambió de tipo")]
    public void SanitizeDescarta()
    {
        var v = new Dictionary<string, string> { ["acc"] = "#00ff00", ["fnt"] = "no-existe", ["viejo"] = "#fff" };
        var r = PromoSlots.Sanitize(Design(GoodSlots), v);
        Assert.Single(r);
        Assert.Equal("#00ff00", r["acc"]);
        Assert.Empty(PromoSlots.Sanitize(Design("[]"), v));
    }

    [Fact(DisplayName = "Promo ajustes: un estilo guardado dañado se lee como vacío")]
    public void EstiloDañado() => Assert.Empty(PromoSlots.ParseStyle("{no es json"));

    [Fact(DisplayName = "Promo ajustes: las propiedades permitidas son exactamente las que aplica el cliente")]
    public void TablaCliente()
    {
        var ts = System.IO.File.ReadAllText(System.IO.Path.Combine(FindRoot(), "ClientApp", "src", "components", "promo-overlay", "slots.ts"));
        foreach (var (_, byEl) in PromoSlots.Props)
            foreach (var (_, props) in byEl)
                foreach (var p in props) Assert.Contains($"'{p}'", ts);
    }

    private static string FindRoot()
    {
        var dir = new System.IO.DirectoryInfo(System.AppContext.BaseDirectory);
        while (dir != null && !System.IO.Directory.Exists(System.IO.Path.Combine(dir.FullName, "ClientApp"))) dir = dir.Parent;
        return dir!.FullName;
    }
}
