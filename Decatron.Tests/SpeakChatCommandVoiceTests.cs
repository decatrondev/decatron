using System.Text.Json;
using Decatron.Services;
using Xunit;

namespace Decatron.Tests;

public class SpeakChatCommandVoiceTests
{
    private static JsonElement J(string json) => JsonSerializer.Deserialize<JsonElement>(json);

    [Theory]
    [InlineData("free", 3)]
    [InlineData(null, 3)]
    [InlineData("supporter", 10)]
    [InlineData("premium", 30)]
    [InlineData("patrocinador", 100)]
    [InlineData("fundador", SpeakChatCommandVoice.HardMax)]
    [InlineData("admin", SpeakChatCommandVoice.HardMax)]
    public void El_rango_pone_el_tope_de_comandos_con_voz_propia(string? tier, int esperado) =>
        Assert.Equal(esperado, SpeakChatCommandVoice.MaxVoiceCommandsFor(tier));

    [Fact]
    public void Solo_cuentan_los_comandos_que_traen_voz_propia()
    {
        var cfg = """
        {"activation":{"rules":[
          {"type":"command","enabled":true,"commandName":"!tts"},
          {"type":"command","enabled":true,"commandName":"!goku","voice":{"engine":"fish","fishVoice":"abc"}},
          {"type":"command","enabled":false,"commandName":"!rey","voice":{"engine":"polly","pollyVoice":"Lupe"}},
          {"type":"all","enabled":true,"voice":{"engine":"fish"}},
          {"type":"command","enabled":true,"commandName":"!raro","voice":{"engine":"otro"}}
        ]}}
        """;
        Assert.Equal(2, SpeakChatCommandVoice.CountVoiceCommands(cfg));
        Assert.Equal(0, SpeakChatCommandVoice.CountVoiceCommands(null));
        Assert.Equal(0, SpeakChatCommandVoice.CountVoiceCommands("no es json"));
    }

    [Fact]
    public void Una_config_que_ya_superaba_el_tope_no_se_recorta_pero_no_puede_crecer()
    {
        Assert.True(SpeakChatCommandVoice.CanSave(before: 2, after: 3, max: 3));
        Assert.False(SpeakChatCommandVoice.CanSave(before: 3, after: 4, max: 3));
        Assert.True(SpeakChatCommandVoice.CanSave(before: 5, after: 5, max: 3));
        Assert.True(SpeakChatCommandVoice.CanSave(before: 5, after: 4, max: 3));
        Assert.False(SpeakChatCommandVoice.CanSave(before: 5, after: 6, max: 3));
    }

    [Fact]
    public void La_voz_del_comando_manda_y_lo_demas_lo_hereda_del_canal()
    {
        var canal = J("""{"engine":"piper","standardVoice":"es_MX-claude-high","volume":70,"languageCode":"es-US"}""");
        var cmd = J("""{"engine":"fish","fishVoice":"abc123"}""");
        var m = SpeakChatCommandVoice.Merge(canal, cmd);
        Assert.Equal("fish", m.GetProperty("engine").GetString());
        Assert.Equal("abc123", m.GetProperty("fishVoice").GetString());
        Assert.Equal(70, m.GetProperty("volume").GetInt32());
        Assert.Equal("es_MX-claude-high", m.GetProperty("standardVoice").GetString());
    }

    [Fact]
    public void Sin_voz_de_canal_la_del_comando_alcanza()
    {
        var m = SpeakChatCommandVoice.Merge(default, J("""{"engine":"fish","fishVoice":"x"}"""));
        Assert.Equal("fish", m.GetProperty("engine").GetString());
    }

    [Fact]
    public void Los_enfriamientos_del_comando_son_opcionales()
    {
        var r = J("""{"cooldownSeconds":30,"perUserCooldownSeconds":0,"otro":"x"}""");
        Assert.Equal(30, SpeakChatCommandVoice.OptionalSeconds(r, "cooldownSeconds"));
        Assert.Equal(0, SpeakChatCommandVoice.OptionalSeconds(r, "perUserCooldownSeconds"));
        Assert.Null(SpeakChatCommandVoice.OptionalSeconds(r, "falta"));
        Assert.Null(SpeakChatCommandVoice.OptionalSeconds(r, "otro"));
        Assert.Null(SpeakChatCommandVoice.OptionalSeconds(J("""{"cooldownSeconds":-5}"""), "cooldownSeconds"));
    }

    [Fact]
    public void Sin_saldo_el_comando_calla_salvo_que_pida_la_voz_estandar()
    {
        Assert.False(SpeakChatCommandVoice.FallsBackToStandard(J("""{}""")));
        Assert.False(SpeakChatCommandVoice.FallsBackToStandard(J("""{"noBalance":"silence"}""")));
        Assert.True(SpeakChatCommandVoice.FallsBackToStandard(J("""{"noBalance":"standard"}""")));
    }

    [Fact]
    public void El_aviso_de_sin_saldo_sale_una_vez_cada_cinco_minutos_por_canal_y_comando()
    {
        var t0 = new DateTime(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc);
        var cinco = TimeSpan.FromMinutes(5);
        Assert.True(SpeakChatCommandVoice.ShouldNotify("canalx", "!goku", t0, cinco));
        Assert.False(SpeakChatCommandVoice.ShouldNotify("CanalX", "!GOKU", t0.AddMinutes(4), cinco));
        Assert.True(SpeakChatCommandVoice.ShouldNotify("canalx", "!rey", t0.AddMinutes(4), cinco));
        Assert.True(SpeakChatCommandVoice.ShouldNotify("canalx", "!goku", t0.AddMinutes(5), cinco));
    }
}
