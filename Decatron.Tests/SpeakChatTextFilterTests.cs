using Decatron.Services;
using Xunit;

namespace Decatron.Tests;

public class SpeakChatTextFilterTests
{
    [Fact]
    public void El_recorte_no_deja_palabras_a_medias()
    {
        Assert.Equal("hola amigos", SpeakChatTextFilter.TruncateAtWord("hola amigos como estan", 14));
    }

    [Fact]
    public void Si_el_limite_cae_justo_en_un_espacio_se_conserva_la_palabra_anterior()
    {
        Assert.Equal("hola amigos", SpeakChatTextFilter.TruncateAtWord("hola amigos como", 11));
    }

    [Fact]
    public void Un_texto_corto_o_sin_espacios_se_trata_bien()
    {
        Assert.Equal("hola", SpeakChatTextFilter.TruncateAtWord("hola", 10));
        Assert.Equal("aaaaa", SpeakChatTextFilter.TruncateAtWord("aaaaaaaaaa", 5));
    }

    [Fact]
    public void Palabra_completa_no_bloquea_fragmentos_pero_parcial_si()
    {
        Assert.False(SpeakChatTextFilter.ContainsBlocked("la clase de hoy", "ase", true));
        Assert.True(SpeakChatTextFilter.ContainsBlocked("la clase de hoy", "ase", false));
        Assert.True(SpeakChatTextFilter.ContainsBlocked("eres un TONTO, ya", "tonto", true));
        Assert.True(SpeakChatTextFilter.ContainsBlocked("ñandú feo", "ñandú", true));
        Assert.False(SpeakChatTextFilter.ContainsBlocked("hola", "", true));
    }

    [Fact]
    public void Los_caracteres_especiales_de_la_palabra_se_toman_literales()
    {
        Assert.True(SpeakChatTextFilter.ContainsBlocked("mira a.b.c ahi", "a.b.c", true));
        Assert.False(SpeakChatTextFilter.ContainsBlocked("mira axbxc ahi", "a.b.c", true));
    }
}
