using Decatron.Core.Helpers;
using Xunit;

namespace Decatron.Tests;

/// <summary>Happy Hour por progreso del timer: reglas puras (sin base de datos), con el reloj como parámetro.</summary>
public class HappyHourProgressRuleTests
{
    private const int H = 3600;
    private static readonly DateTime T0 = new(2026, 10, 31, 12, 0, 0, DateTimeKind.Utc);

    // ── Tiempo transcurrido ──────────────────────────────────────────────────

    [Fact]
    public void Elapsed_RunningDescuentaLasPausasAnteriores()
    {
        // arrancó hace 5 h, estuvo 1 h en pausa antes
        var e = HappyHourProgressRule.ElapsedSeconds("running", T0, null, H, T0.AddHours(5));
        Assert.Equal(4 * H, e);
    }

    [Fact]
    public void Elapsed_PausadoSeCongelaEnElMomentoDeLaPausa()
    {
        // arrancó a las 0, pausó a las 3 h, ahora pasaron 10 h: sigue en 3 h
        var e = HappyHourProgressRule.ElapsedSeconds("paused", T0, T0.AddHours(3), 0, T0.AddHours(10));
        Assert.Equal(3 * H, e);
    }

    [Theory]
    [InlineData("stopped")]
    [InlineData("finished")]
    [InlineData(null)]
    public void Elapsed_SinTimerCorriendoNoHayTiempo(string? status)
        => Assert.Null(HappyHourProgressRule.ElapsedSeconds(status, T0, null, 0, T0.AddHours(1)));

    [Fact]
    public void Elapsed_SinInicioNoHayTiempo()
        => Assert.Null(HappyHourProgressRule.ElapsedSeconds("running", null, null, 0, T0));

    [Fact]
    public void Elapsed_NuncaEsNegativo()
        => Assert.Equal(0, HappyHourProgressRule.ElapsedSeconds("running", T0, null, 999999, T0.AddSeconds(5)));

    // ── Una sola vez, por duración ───────────────────────────────────────────

    [Theory]
    [InlineData(12 * H - 1, false)]   // un segundo antes
    [InlineData(12 * H, true)]        // borde exacto de inicio
    [InlineData(14 * H - 1, true)]    // último segundo
    [InlineData(14 * H, false)]       // borde exacto de fin
    [InlineData(30 * H, false)]       // ya pasó y no se repite
    public void UnaVez_PorDuracion(long elapsed, bool esperado)
        => Assert.Equal(esperado, HappyHourProgressRule.Evaluate(elapsed, 12 * H, null, 2 * H, null).Active);

    [Fact]
    public void UnaVez_CalculaLoQueLeQueda()
        => Assert.Equal(H + 20 * 60, HappyHourProgressRule.Evaluate(12 * H + 40 * 60, 12 * H, null, 2 * H, null).SecondsLeft);

    // ── Por segundo umbral (a las 12 h se activa, a las 24 h se apaga) ───────

    [Theory]
    [InlineData(11 * H, false)]
    [InlineData(12 * H, true)]
    [InlineData(23 * H, true)]
    [InlineData(24 * H, false)]
    public void UnaVez_PorSegundoUmbral(long elapsed, bool esperado)
        => Assert.Equal(esperado, HappyHourProgressRule.Evaluate(elapsed, 12 * H, 24 * H, null, null).Active);

    // ── Repetir ──────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(12 * H, true)]        // 1.ª ventana
    [InlineData(14 * H, false)]
    [InlineData(17 * H + 59 * 60, false)]
    [InlineData(18 * H, true)]        // 2.ª ventana (cada 6 h)
    [InlineData(19 * H + 59 * 60, true)]
    [InlineData(20 * H, false)]
    [InlineData(24 * H, true)]        // 3.ª
    [InlineData(6 * H, false)]        // antes de la primera no hay ventanas "hacia atrás"
    public void Repetir_CadaSeisHoras(long elapsed, bool esperado)
        => Assert.Equal(esperado, HappyHourProgressRule.Evaluate(elapsed, 12 * H, null, 2 * H, 6 * H).Active);

    [Fact]
    public void Repetir_LeQuedaLoDeLaVentanaActual()
        => Assert.Equal(H, HappyHourProgressRule.Evaluate(19 * H, 12 * H, null, 2 * H, 6 * H).SecondsLeft);

    [Fact]
    public void Repetir_ConUmbralDeFinTambienRepite()
    {
        // ventana de 12 h a 14 h dada por los dos umbrales, repetida cada 6 h
        Assert.True(HappyHourProgressRule.Evaluate(18 * H + 5, 12 * H, 14 * H, null, 6 * H).Active);
        Assert.False(HappyHourProgressRule.Evaluate(16 * H, 12 * H, 14 * H, null, 6 * H).Active);
    }

    [Fact]
    public void Repetir_QueNoSupereLaVentanaSeIgnoraYNoSeActivaParaSiempre()
        // Validate la rechaza al guardar; si llegara a la base igual, se comporta como "una vez"
        => Assert.False(HappyHourProgressRule.Evaluate(20 * H, 12 * H, null, 2 * H, 2 * H).Active);

    // ── Pausa: la ventana activa queda congelada ─────────────────────────────

    [Fact]
    public void Pausa_ConservaLoQueQuedabaYNoSeAdelantaLaSiguiente()
    {
        // se pausa a las 12 h 40 y pasan 5 h reales: sigue en 12 h 40, con 1 h 20 por delante
        var e = HappyHourProgressRule.ElapsedSeconds("paused", T0, T0.AddSeconds(12 * H + 40 * 60), 0, T0.AddHours(17))!.Value;
        var r = HappyHourProgressRule.Evaluate(e, 12 * H, null, 2 * H, null);
        Assert.True(r.Active);
        Assert.Equal(H + 20 * 60, r.SecondsLeft);
    }

    [Fact]
    public void Pausa_AntesDelUmbralNoLoAdelanta()
    {
        // a las 11 h 50 pausa; aunque pase 1 h real, el umbral de las 12 h sigue 10 min más adelante
        var e = HappyHourProgressRule.ElapsedSeconds("paused", T0, T0.AddSeconds(11 * H + 50 * 60), 0, T0.AddHours(13))!.Value;
        Assert.False(HappyHourProgressRule.Evaluate(e, 12 * H, null, 2 * H, null).Active);
    }

    // ── Validación ───────────────────────────────────────────────────────────

    [Theory]
    [InlineData(12 * H, null, 2 * H, null, true)]
    [InlineData(12 * H, 24 * H, null, null, true)]
    [InlineData(12 * H, null, 2 * H, 6 * H, true)]
    [InlineData(0, null, 60, null, true)]                 // desde el inicio es válido
    [InlineData(null, null, 2 * H, null, false)]          // falta el inicio
    [InlineData(-1, null, 2 * H, null, false)]
    [InlineData(12 * H, null, null, null, false)]         // falta duración o fin
    [InlineData(12 * H, 10 * H, null, null, false)]       // el fin es antes del inicio
    [InlineData(12 * H, 12 * H, null, null, false)]       // fin = inicio
    [InlineData(12 * H, 24 * H, 2 * H, null, false)]      // duración y fin a la vez
    [InlineData(12 * H, null, 2 * H, 2 * H, false)]       // repetir = duración
    [InlineData(12 * H, null, 2 * H, H, false)]           // repetir menor que la duración
    public void Validate(int? start, int? end, int? dur, int? repeat, bool valida)
        => Assert.Equal(valida, HappyHourProgressRule.Validate(start, end, dur, repeat) == null);
}
