using Decatron.Services;
using Xunit;

namespace Decatron.Tests;

/// <summary>Historial de cambios de Speak Chat: qué campos cambiaron entre dos guardados.</summary>
public class SpeakChatConfigDiffTests
{
    [Fact]
    public void Sin_cambios_no_devuelve_nada()
    {
        var json = """{"global":{"enabled":true},"filters":{"maxChars":200}}""";
        Assert.Empty(SpeakChatConfigDiff.Compute(json, json));
    }

    [Fact]
    public void Apagar_el_interruptor_general_queda_registrado()
    {
        var antes = """{"global":{"enabled":true}}""";
        var despues = """{"global":{"enabled":false}}""";
        var c = Assert.Single(SpeakChatConfigDiff.Compute(antes, despues));
        Assert.Equal("global.enabled", c.Path);
        Assert.Equal("true", c.Before);
        Assert.Equal("false", c.After);
    }

    [Fact]
    public void Activar_una_regla_de_todos_aparece_por_su_posicion()
    {
        var antes = """{"activation":{"rules":[{"type":"command","enabled":true},{"type":"all","enabled":false}]}}""";
        var despues = """{"activation":{"rules":[{"type":"command","enabled":true},{"type":"all","enabled":true}]}}""";
        var c = Assert.Single(SpeakChatConfigDiff.Compute(antes, despues));
        Assert.Equal("activation.rules[1].enabled", c.Path);
        Assert.Equal("false", c.Before);
        Assert.Equal("true", c.After);
    }

    [Fact]
    public void Una_regla_nueva_se_ve_como_campos_agregados()
    {
        var antes = """{"activation":{"rules":[]}}""";
        var despues = """{"activation":{"rules":[{"type":"bits","enabled":true}]}}""";
        var cambios = SpeakChatConfigDiff.Compute(antes, despues);
        Assert.Equal(2, cambios.Count);
        Assert.All(cambios, c => Assert.Null(c.Before));
    }

    [Fact]
    public void Sin_configuracion_previa_todo_cuenta_como_nuevo()
    {
        var cambios = SpeakChatConfigDiff.Compute(null, """{"global":{"enabled":true}}""");
        var c = Assert.Single(cambios);
        Assert.Null(c.Before);
        Assert.Equal("true", c.After);
    }

    [Fact]
    public void Los_valores_largos_se_recortan_y_la_lista_tiene_tope()
    {
        var largo = new string('a', 500);
        var c = Assert.Single(SpeakChatConfigDiff.Compute("""{"x":"b"}""", $$"""{"x":"{{largo}}"}"""));
        Assert.True(c.After!.Length <= 81);

        var muchos = "{" + string.Join(",", Enumerable.Range(0, 200).Select(i => $"\"k{i}\":{i}")) + "}";
        Assert.Equal(SpeakChatConfigDiff.MaxChanges, SpeakChatConfigDiff.Compute("{}", muchos).Count);
    }

    [Fact]
    public void Un_json_roto_no_lanza()
    {
        Assert.Single(SpeakChatConfigDiff.Compute("no es json", """{"a":1}"""));
    }
}
