using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Decatron.Services.Promo;
using Xunit;

namespace Decatron.Tests;

/// <summary>Promociones: el validador del diseño deja pasar un diseño sano y rechaza lo que llegaría a CSS, HTML o direcciones.</summary>
public class PromoDesignValidatorTests
{
    private static JsonObject Step(string type = "fade") => new() { ["type"] = type, ["direction"] = "left", ["durationMs"] = 500, ["easing"] = "ease-out", ["delayMs"] = 0 };
    private static JsonObject Anim() => new() { ["enter"] = Step(), ["exit"] = Step("none") };
    private static JsonObject Fill(string type = "color") => new() { ["type"] = type, ["color"] = "#1b2236", ["gradient"] = new JsonObject { ["color1"] = "#1b2236", ["color2"] = "#0b1020", ["angle"] = 135 } };
    private static JsonObject Border() => new() { ["enabled"] = true, ["color"] = "rgba(120,160,255,0.35)", ["width"] = 1 };
    private static JsonObject Glow() => new() { ["enabled"] = false, ["color"] = "#3b82f6", ["blur"] = 24 };
    private static JsonObject Base(string id, string kind, JsonObject extra)
    {
        var o = new JsonObject
        {
            ["id"] = id, ["kind"] = kind, ["name"] = "Elemento", ["enabled"] = true, ["x"] = 0, ["y"] = 0, ["width"] = 100, ["height"] = 50, ["rotation"] = 0, ["opacity"] = 100,
            ["animation"] = Anim(), ["loop"] = new JsonObject { ["type"] = "none", ["durationMs"] = 2000, ["delayMs"] = 0 },
        };
        foreach (var kv in extra) o[kv.Key] = kv.Value?.DeepClone();
        return o;
    }

    public static JsonObject ValidDesign() => new()
    {
        ["version"] = 1, ["canvas"] = new JsonObject { ["width"] = 420, ["height"] = 130 }, ["animation"] = Anim(),
        ["elements"] = new JsonArray
        {
            Base("a1", "shape", new JsonObject { ["fill"] = Fill("gradient"), ["border"] = Border(), ["radius"] = 20, ["cut"] = "none", ["cutSize"] = 24, ["shadow"] = "0 10px 32px rgba(0,0,0,0.5)", ["glow"] = Glow(), ["backdropBlur"] = 0 }),
            Base("a2", "image", new JsonObject { ["source"] = "library", ["ref"] = "asset:12", ["fit"] = "contain", ["radius"] = 16, ["border"] = Border(), ["shadow"] = "", ["glow"] = Glow() }),
            Base("a3", "icon", new JsonObject { ["source"] = "piece", ["icon"] = "megaphone", ["color"] = "#ffffff", ["strokeWidth"] = 2, ["glow"] = Glow() }),
            Base("a4", "text", new JsonObject
            {
                ["template"] = "{{title}} en {{channel}}", ["fontFamily"] = "Big Shoulders Display", ["fontSize"] = 30, ["fontWeight"] = 800, ["color"] = "#ffffff", ["align"] = "left", ["verticalAlign"] = "center",
                ["lineHeight"] = 1.15, ["letterSpacing"] = 0, ["italic"] = false, ["uppercase"] = true, ["maxLines"] = 2, ["shadow"] = "glow", ["glowColor"] = "#3b82f6", ["fill"] = Fill("transparent"),
                ["border"] = Border(), ["radius"] = 0, ["padding"] = 0,
            }),
            Base("a5", "qr", new JsonObject { ["color"] = "#06080e", ["background"] = "#ffffff", ["radius"] = 12, ["padding"] = 6, ["border"] = Border() }),
        },
    };

    public static string ValidDesignJson() => ValidDesign().ToJsonString();

    private static System.Collections.Generic.List<string> Check(Action<JsonObject> mutate)
    {
        var d = ValidDesign(); mutate(d);
        return PromoDesignValidator.Validate(d.ToJsonString());
    }
    private static JsonObject El(JsonObject d, int i) => d["elements"]![i]!.AsObject();

    [Fact(DisplayName = "Promo diseño: uno válido con un elemento de cada tipo no da errores")]
    public void Valido() => Assert.Empty(PromoDesignValidator.Validate(ValidDesignJson()));

    [Theory(DisplayName = "Promo diseño: vacío, roto o de otro tipo se rechaza")]
    [InlineData(null)] [InlineData("")] [InlineData("{}")] [InlineData("no es json")] [InlineData("[]")]
    public void Roto(string? json) => Assert.NotEmpty(PromoDesignValidator.Validate(json));

    [Fact(DisplayName = "Promo diseño: lienzo fuera de rango y demasiados elementos")]
    public void Limites()
    {
        Assert.Contains("designCanvasRange", Check(d => d["canvas"]!["width"] = 99999));
        var muchos = Check(d => { var a = new JsonArray(); for (int i = 0; i < PromoDesignValidator.MaxElements + 1; i++) a.Add(Base($"x{i}", "qr", new JsonObject { ["color"] = "#000", ["background"] = "#fff", ["radius"] = 0, ["padding"] = 0, ["border"] = Border() })); d["elements"] = a; });
        Assert.Contains("designTooManyElements", muchos);
        var grande = ValidDesign(); grande["elements"]!.AsArray().Add(Base("big", "shape", new JsonObject { ["x"] = 1 })); // incompleto
        Assert.NotEmpty(PromoDesignValidator.Validate(grande.ToJsonString()));
    }

    [Theory(DisplayName = "Promo diseño: un color solo puede ser #hex, rgb(a) o transparent (nada de CSS suelto)")]
    [InlineData("red; background:url(http://x)")] [InlineData("url(http://evil)")] [InlineData("expression(alert(1))")] [InlineData("#12")] [InlineData("var(--x)")]
    public void ColorMalo(string color) => Assert.Contains("designColorInvalid", Check(d => El(d, 0)["fill"]!["color"] = color));

    [Theory(DisplayName = "Promo diseño: colores válidos")]
    [InlineData("#fff")] [InlineData("#1b2236")] [InlineData("#1b223680")] [InlineData("rgba(10,20,30,0.5)")] [InlineData("rgb(10, 20, 30)")] [InlineData("transparent")]
    public void ColorBueno(string color) => Assert.Empty(Check(d => El(d, 0)["fill"]!["color"] = color));

    [Fact(DisplayName = "Promo diseño: la sombra solo puede ser una de las del editor")]
    public void SombraLibre() => Assert.Contains("designValueInvalid", Check(d => El(d, 0)["shadow"] = "0 0 0 100px red"));

    [Theory(DisplayName = "Promo diseño: la imagen de biblioteca solo con asset: o builtin:")]
    [InlineData("https://evil.com/x.png")] [InlineData("javascript:alert(1)")] [InlineData("asset:../../x")] [InlineData("/etc/passwd")]
    public void ImagenMala(string r) => Assert.Contains("designImageRefInvalid", Check(d => El(d, 1)["ref"] = r));

    [Fact(DisplayName = "Promo diseño: el texto no admite < ni >, ni variables desconocidas")]
    public void TextoMalo()
    {
        Assert.Contains("designTextInvalid", Check(d => El(d, 3)["template"] = "<img src=x onerror=alert(1)>"));
        Assert.Contains("designUnknownVariable", Check(d => El(d, 3)["template"] = "Hola {{usuario}}"));
        Assert.Empty(Check(d => El(d, 3)["template"] = "{{commands}} y {{ link }}"));
    }

    [Fact(DisplayName = "Promo diseño: tipografía fuera de la lista y icono desconocido")]
    public void FuenteEIcono()
    {
        Assert.Contains("designFontInvalid", Check(d => El(d, 3)["fontFamily"] = "Comic Sans MS'; background:url(x)"));
        Assert.Contains("designIconInvalid", Check(d => El(d, 2)["icon"] = "no-existe"));
    }

    [Fact(DisplayName = "Promo diseño: animaciones — tipo, dirección, curva y duración conocidos")]
    public void Animaciones()
    {
        Assert.Contains("designAnimationInvalid", Check(d => d["animation"]!["enter"]!["type"] = "event"));
        Assert.Contains("designAnimationInvalid", Check(d => El(d, 0)["animation"]!["enter"]!["easing"] = "cubic-bezier(1,1,1,1)"));
        Assert.Contains("designAnimationInvalid", Check(d => El(d, 0)["animation"]!["enter"]!["durationMs"] = 999999));
        Assert.Contains("designAnimationInvalid", Check(d => El(d, 0)["loop"]!["type"] = "explotar"));
        Assert.Empty(Check(d => El(d, 0)["loop"]!["type"] = "pulse"));
    }

    [Fact(DisplayName = "Promo diseño: ids repetidos y tipos de elemento desconocidos")]
    public void IdsYTipos()
    {
        Assert.Contains("designValueInvalid", Check(d => El(d, 1)["id"] = "a1"));
        Assert.Contains("designKindInvalid", Check(d => El(d, 1)["kind"] = "script"));
    }

    [Fact(DisplayName = "Promo diseño: los números deben estar en rango (nada de infinitos ni gigantes)")]
    public void Rangos()
    {
        Assert.Contains("designValueInvalid", Check(d => El(d, 0)["width"] = 0));
        Assert.Contains("designValueInvalid", Check(d => El(d, 0)["opacity"] = 500));
        Assert.Contains("designValueInvalid", Check(d => El(d, 3)["fontSize"] = 100000));
    }

    [Fact(DisplayName = "Promo diseño: la lista de tipografías del servidor es la misma que la del front (fonts.ts)")]
    public void FuentesIguales()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "Decatron.csproj"))) dir = dir.Parent;
        Assert.NotNull(dir);
        var ts = File.ReadAllText(Path.Combine(dir!.FullName, "ClientApp", "src", "components", "promo-overlay", "fonts.ts"));
        var front = Regex.Matches(ts, @"family: '([^']+)', weights: \[([0-9, ]+)\]")
            .ToDictionary(m => m.Groups[1].Value, m => m.Groups[2].Value.Split(',', StringSplitOptions.TrimEntries).Select(int.Parse).ToArray());
        Assert.Equal(PromoDesignValidator.Fonts.Count, front.Count);
        foreach (var kv in PromoDesignValidator.Fonts)
        {
            Assert.True(front.ContainsKey(kv.Key), $"Falta en fonts.ts: {kv.Key}");
            Assert.Equal(kv.Value, front[kv.Key]);
        }
    }

    [Fact(DisplayName = "Promo diseño: las sombras y variables del servidor son las del front (defaults.ts y types.ts)")]
    public void ListasIguales()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "Decatron.csproj"))) dir = dir.Parent;
        var root = Path.Combine(dir!.FullName, "ClientApp", "src", "components", "promo-overlay");
        var defaults = File.ReadAllText(Path.Combine(root, "defaults.ts"));
        foreach (var s in PromoDesignValidator.BoxShadows.Where(x => x != "")) Assert.Contains($"'{s}'", defaults);
        var types = File.ReadAllText(Path.Combine(root, "types.ts"));
        foreach (var v in PromoDesignValidator.TextVariables) Assert.Contains($"'{v}'", types);
    }

    [Fact(DisplayName = "Promo diseño: las plantillas por defecto del repo (Seed/Promo) pasan el validador")]
    public void PlantillasPorDefecto()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "Decatron.csproj"))) dir = dir.Parent;
        var files = Directory.GetFiles(Path.Combine(dir!.FullName, "Decatron.Data", "Seed", "Promo"), "*.json");
        Assert.NotEmpty(files);
        foreach (var f in files) Assert.True(PromoDesignValidator.Validate(File.ReadAllText(f)).Count == 0, $"{Path.GetFileName(f)}: {string.Join(", ", PromoDesignValidator.Validate(File.ReadAllText(f)))}");
    }
}
