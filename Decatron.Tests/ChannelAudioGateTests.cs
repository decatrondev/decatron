using Decatron.Core.Services;
using Xunit;

namespace Decatron.Tests;

/// <summary>Un turno de voz por canal: orden de llegada, liberación por aviso o por tiempo, y descarte de lo que sobra.</summary>
public class ChannelAudioGateTests
{
    [Fact]
    public async Task Primer_turno_es_inmediato_y_el_segundo_espera_al_aviso()
    {
        var gate = new ChannelAudioGate();
        var a = await gate.RequestAsync("canal", "event_alerts");
        Assert.NotNull(a);

        var segundo = gate.RequestAsync("canal", "speak_chat");
        await Task.Delay(50);
        Assert.False(segundo.IsCompleted);

        gate.Complete("canal", a!.Id);
        var b = await segundo.WaitAsync(TimeSpan.FromSeconds(2));
        Assert.NotNull(b);
        Assert.Equal("speak_chat", b!.Source);
    }

    [Fact]
    public async Task Canales_distintos_no_se_esperan_y_el_nombre_no_distingue_mayusculas()
    {
        var gate = new ChannelAudioGate();
        Assert.NotNull(await gate.RequestAsync("uno", "x"));
        Assert.NotNull(await gate.RequestAsync("dos", "x"));

        var a = await gate.RequestAsync("Tres", "x");
        gate.Complete("tres", a!.Id);
        Assert.False(gate.Snapshot("TRES").Busy);
    }

    [Fact]
    public async Task Un_aviso_de_otro_turno_no_suelta_el_actual()
    {
        var gate = new ChannelAudioGate();
        var a = await gate.RequestAsync("canal", "x");
        gate.Complete("canal", "otro-id");
        Assert.True(gate.Snapshot("canal").Busy);
        a!.Release();
        Assert.False(gate.Snapshot("canal").Busy);
    }

    [Fact]
    public async Task Sin_aviso_el_turno_vence_por_su_tiempo()
    {
        var gate = new ChannelAudioGate();
        var a = await gate.RequestAsync("canal", "x");
        a!.Arm(TimeSpan.FromMilliseconds(100));

        var b = await gate.RequestAsync("canal", "y").WaitAsync(TimeSpan.FromSeconds(3));
        Assert.NotNull(b);
    }

    [Fact]
    public async Task Release_es_idempotente_y_respeta_el_orden_de_llegada()
    {
        var gate = new ChannelAudioGate();
        var a = await gate.RequestAsync("canal", "a");
        var t2 = gate.RequestAsync("canal", "b");
        await Task.Delay(20);
        var t3 = gate.RequestAsync("canal", "c");
        await Task.Delay(20);

        a!.Release();
        a.Release();
        var b = await t2.WaitAsync(TimeSpan.FromSeconds(2));
        Assert.Equal("b", b!.Source);
        Assert.False(t3.IsCompleted);

        b.Release();
        Assert.Equal("c", (await t3.WaitAsync(TimeSpan.FromSeconds(2)))!.Source);
    }

    [Fact]
    public async Task Con_la_cola_llena_se_descarta_al_mas_antiguo()
    {
        var gate = new ChannelAudioGate();
        var actual = await gate.RequestAsync("canal", "actual");

        var esperando = new List<Task<AudioTurn?>>();
        for (var i = 0; i < ChannelAudioGate.MaxQueued; i++)
        {
            esperando.Add(gate.RequestAsync("canal", "e" + i));
            await Task.Delay(5);
        }
        var nuevo = gate.RequestAsync("canal", "nuevo");

        Assert.Null(await esperando[0].WaitAsync(TimeSpan.FromSeconds(2)));
        Assert.Equal(ChannelAudioGate.MaxQueued, gate.Snapshot("canal").Waiting);
        Assert.False(nuevo.IsCompleted);
        actual!.Release();
    }

    [Fact]
    public void Un_texto_ya_leido_por_otro_modulo_se_omite_pero_el_mismo_modulo_puede_repetirlo()
    {
        var gate = new ChannelAudioGate();
        gate.Remember("canal", "event_alerts", "cheer100 Hola   a TODOS");

        Assert.True(gate.SpokenByOtherSource("canal", "speak_chat", "hola a todos"));
        Assert.False(gate.SpokenByOtherSource("canal", "event_alerts", "hola a todos"));
        Assert.False(gate.SpokenByOtherSource("otro-canal", "speak_chat", "hola a todos"));
        Assert.False(gate.SpokenByOtherSource("canal", "speak_chat", "otra cosa distinta"));
    }

    [Fact]
    public void Un_texto_cortado_al_maximo_de_caracteres_cuenta_como_el_mismo()
    {
        var gate = new ChannelAudioGate();
        gate.Remember("canal", "speak_chat", "este es un mensaje largo que un modulo corta");
        Assert.True(gate.SpokenByOtherSource("canal", "event_alerts", "este es un mensaje largo"));
    }

    [Fact]
    public void Textos_muy_cortos_no_se_comparan()
    {
        var gate = new ChannelAudioGate();
        gate.Remember("canal", "speak_chat", "gg");
        Assert.False(gate.SpokenByOtherSource("canal", "event_alerts", "gg"));
    }
}
