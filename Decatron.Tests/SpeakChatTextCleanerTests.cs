using System.Text.Json;
using Decatron.Services;
using Xunit;
using static Decatron.Services.SpeakChatTextCleaner;

namespace Decatron.Tests;

public class SpeakChatTextCleanerTests
{
    private static readonly Options All = new(LinkMode.Remove, true, true, true);

    [Fact]
    public void Sin_la_seccion_cleanup_no_se_limpia_nada()
    {
        var filters = JsonSerializer.Deserialize<JsonElement>("{\"maxChars\":200}");
        Assert.Equal(Options.Off, Read(filters));
        Assert.Equal("mira https://x.com holaaaa", Clean("mira https://x.com holaaaa", Read(filters), null, "enlace"));
    }

    [Fact]
    public void Lee_las_opciones_guardadas()
    {
        var filters = JsonSerializer.Deserialize<JsonElement>("{\"cleanup\":{\"links\":\"replace\",\"emotes\":true,\"repeats\":false,\"emojis\":true}}");
        Assert.Equal(new Options(LinkMode.Replace, true, false, true), Read(filters));
    }

    [Fact]
    public void Quita_enlaces_con_esquema_www_y_dominio_conocido()
    {
        Assert.Equal("mira y listo", Clean("mira https://youtu.be/abc?x=1 y listo", All, null, "enlace"));
        Assert.Equal("mira", Clean("mira www.ejemplo.com/ruta", All, null, "enlace"));
        Assert.Equal("entra", Clean("entra twitch.tv/canal", All, null, "enlace"));
    }

    [Fact]
    public void Una_frase_sin_espacio_tras_el_punto_no_es_un_enlace()
    {
        Assert.Equal("ok.gracias por todo", Clean("ok.gracias por todo", All, null, "enlace"));
    }

    [Fact]
    public void El_enlace_puede_reemplazarse_por_una_palabra()
    {
        var o = new Options(LinkMode.Replace, false, false, false);
        Assert.Equal("mira enlace ya", Clean("mira https://x.com/a ya", o, null, "enlace"));
        Assert.Equal("see link now", Clean("see www.a.com now", o, null, "link"));
    }

    [Fact]
    public void Quita_emotes_por_nombre_y_las_etiquetas_de_kick()
    {
        var names = new HashSet<string> { "Kappa", "KEKW" };
        Assert.Equal("hola amigos", Clean("hola Kappa amigos KEKW", All, names, "enlace"));
        Assert.Equal("buenas", Clean("[emote:37226:KEKW] buenas", All, null, "enlace"));
    }

    [Fact]
    public void La_etiqueta_de_kick_se_lee_como_su_nombre_si_se_conservan_los_emotes()
    {
        var o = new Options(LinkMode.Keep, false, false, false);
        Assert.Equal("KEKW buenas", Clean("[emote:37226:KEKW] buenas", o, null, "enlace"));
    }

    [Fact]
    public void Acorta_letras_y_signos_repetidos()
    {
        Assert.Equal("holaa que tal!", Clean("holaaaaaaa que tal!!!!!", All, null, "enlace"));
        Assert.Equal("llegue", Clean("llegue", All, null, "enlace"));
    }

    [Fact]
    public void Quita_emojis_sin_tocar_letras_con_tilde()
    {
        Assert.Equal("qué bueno", Clean("qué 😂🔥 bueno ❤️", All, null, "enlace"));
    }

    [Fact]
    public void Si_solo_habia_enlaces_y_emotes_queda_vacio()
    {
        Assert.Equal("", Clean("https://x.com Kappa", All, new HashSet<string> { "Kappa" }, "enlace"));
    }
}
