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

    // ── Estados de pausa: manual, por horario y por corte de directo congelan igual ──

    [Theory]
    [InlineData("paused")]
    [InlineData("auto_paused")]
    [InlineData("stream_paused")]
    public void Elapsed_TodasLasPausasCongelan(string status)
        => Assert.Equal(3 * H, HappyHourProgressRule.ElapsedSeconds(status, T0, T0.AddHours(3), 0, T0.AddHours(10)));

    // ── Por tiempo restante (el caso del timer que baja de 12 h, lo suben con donaciones y vuelve a bajar) ──

    [Fact]
    public void Remaining_EsElTotalMenosLoTranscurrido()
        // total 480 h acumuladas, lleva 464 h corriendo: quedan 16 h
        => Assert.Equal(16 * H, HappyHourProgressRule.RemainingSeconds("running", T0, null, 0, 480 * H, T0.AddHours(464)));

    [Fact]
    public void Remaining_NoPasaDeCeroNiEsNegativo()
        => Assert.Equal(0, HappyHourProgressRule.RemainingSeconds("running", T0, null, 0, 10 * H, T0.AddHours(99)));

    [Fact]
    public void Remaining_EnPausaSeCongela()
        // total 100 h, pausó a las 90 h: quedan 10 h aunque pasen días
        => Assert.Equal(10 * H, HappyHourProgressRule.RemainingSeconds("stream_paused", T0, T0.AddHours(90), 0, 100 * H, T0.AddDays(5)));

    [Fact]
    public void Remaining_SinTimerNoHayTiempo()
        => Assert.Null(HappyHourProgressRule.RemainingSeconds("stopped", T0, null, 0, 100 * H, T0.AddHours(1)));

    [Theory]
    [InlineData(12 * H + 1, false)]   // todavía le quedan un poco más de 12 h
    [InlineData(12 * H, true)]        // borde exacto: 12 h o menos
    [InlineData(5 * H, true)]
    [InlineData(1, true)]
    [InlineData(0, false)]            // ya terminó
    public void Remaining_SeActivaConDocehorasOMenos(long remaining, bool esperado)
        => Assert.Equal(esperado, HappyHourProgressRule.EvaluateRemaining(remaining, 12 * H));

    [Fact]
    public void Remaining_UnaDonacionLoApagaYAlBajarOtraVezSeEnciende()
    {
        // total 480 h; a las 470 h quedan 10 h (activa); donan 5 h y quedan 15 h (se apaga); al pasar 4 h vuelven a quedar 11 h (activa)
        Assert.True(HappyHourProgressRule.EvaluateRemaining(HappyHourProgressRule.RemainingSeconds("running", T0, null, 0, 480 * H, T0.AddHours(470))!.Value, 12 * H));
        Assert.False(HappyHourProgressRule.EvaluateRemaining(HappyHourProgressRule.RemainingSeconds("running", T0, null, 0, 485 * H, T0.AddHours(470))!.Value, 12 * H));
        Assert.True(HappyHourProgressRule.EvaluateRemaining(HappyHourProgressRule.RemainingSeconds("running", T0, null, 0, 485 * H, T0.AddHours(474))!.Value, 12 * H));
    }

    [Theory]
    [InlineData(null, false)]
    [InlineData(0, false)]
    [InlineData(-5, false)]
    [InlineData(12 * H, true)]
    public void Remaining_Validate(int? threshold, bool valida)
        => Assert.Equal(valida, HappyHourProgressRule.ValidateRemaining(threshold) == null);

    // ── Por tiempo restante: cómo termina ────────────────────────────────────

    private static (bool Active, long? Latched) Rem(long remaining, long elapsed, string mode, int? end, int? dur, long? latched)
        => HappyHourProgressRule.EvaluateRemainingWindow(remaining, elapsed, 12 * H, mode, end, dur, latched);

    [Theory]
    [InlineData(13 * H, false)]
    [InlineData(12 * H, true)]
    [InlineData(1, true)]
    [InlineData(0, false)]
    public void RemainingEnd_Above_EsLoDeSiempre(long remaining, bool esperado)
        => Assert.Equal((esperado, (long?)null), Rem(remaining, 5000, "above", null, null, null));

    [Theory]
    [InlineData(13 * H, false)]       // todavía no
    [InlineData(12 * H, true)]        // se activa
    [InlineData(7 * H, true)]
    [InlineData(6 * H + 1, true)]
    [InlineData(6 * H, false)]        // bajó a 6 h: se apaga
    [InlineData(2 * H, false)]
    public void RemainingEnd_FallTo_ActivaEntreUmbralYFin(long remaining, bool esperado)
        => Assert.Equal(esperado, Rem(remaining, 5000, "fall_to", 6 * H, null, null).Active);

    [Fact]
    public void RemainingEnd_RiseTo_SeMantieneHastaQueSubaAlFinYSeRearmaAlBajar()
    {
        long? latched = null;
        // 13 h: todavía no
        var r = Rem(13 * H, 100, "rise_to", 48 * H, null, latched); Assert.Equal((false, (long?)null), r); latched = r.Latched;
        // 12 h: se activa y recuerda en qué momento
        r = Rem(12 * H, 200, "rise_to", 48 * H, null, latched); Assert.Equal((true, (long?)200), r); latched = r.Latched;
        // donan: sube a 30 h, sigue activa
        r = Rem(30 * H, 300, "rise_to", 48 * H, null, latched); Assert.Equal((true, (long?)200), r); latched = r.Latched;
        // 47 h 59: sigue activa
        r = Rem(48 * H - 1, 400, "rise_to", 48 * H, null, latched); Assert.True(r.Active); latched = r.Latched;
        // llega a 48 h: se apaga
        r = Rem(48 * H, 500, "rise_to", 48 * H, null, latched); Assert.Equal((false, (long?)null), r); latched = r.Latched;
        // baja a 30 h: sigue apagada (no se rearma hasta bajar al umbral)
        r = Rem(30 * H, 600, "rise_to", 48 * H, null, latched); Assert.Equal((false, (long?)null), r); latched = r.Latched;
        // vuelve a 12 h: se activa otra vez
        r = Rem(12 * H, 700, "rise_to", 48 * H, null, latched); Assert.True(r.Active);
    }

    [Fact]
    public void RemainingEnd_RiseTo_SeApagaSiElTimerTermina()
        => Assert.Equal((false, (long?)null), Rem(0, 900, "rise_to", 48 * H, null, 200));

    [Fact]
    public void RemainingEnd_RiseTo_ElEstadoDeUnTimerReiniciadoNoVale()
        // guardado «activa desde 5000 s» pero el timer ya va en 100 s: se reinició; con 30 h restantes no está activa
        => Assert.Equal((false, (long?)null), Rem(30 * H, 100, "rise_to", 48 * H, null, 5000));

    [Fact]
    public void RemainingEnd_Duration_DuraLoConfiguradoAunqueSubanElTiempo()
    {
        long? latched = null;
        var r = Rem(12 * H, 1000, "duration", null, 3 * H, latched); Assert.Equal((true, (long?)1000), r); latched = r.Latched;
        // una donación sube el restante a 40 h: sigue activa porque dura 3 h del timer
        r = Rem(40 * H, 1000 + 3 * H - 1, "duration", null, 3 * H, latched); Assert.True(r.Active); latched = r.Latched;
        // se cumplen las 3 h: se apaga
        r = Rem(40 * H, 1000 + 3 * H, "duration", null, 3 * H, latched); Assert.Equal((false, (long?)HappyHourProgressRule.Spent), r); latched = r.Latched;
        // aunque el restante siga bajo el umbral, no se vuelve a activar
        r = Rem(11 * H, 1000 + 4 * H, "duration", null, 3 * H, latched); Assert.Equal((false, (long?)HappyHourProgressRule.Spent), r); latched = r.Latched;
        // al subir sobre el umbral se rearma
        r = Rem(13 * H, 1000 + 5 * H, "duration", null, 3 * H, latched); Assert.Equal((false, (long?)null), r); latched = r.Latched;
        // y al volver a bajar, se activa de nuevo
        r = Rem(12 * H, 1000 + 6 * H, "duration", null, 3 * H, latched); Assert.True(r.Active);
    }

    [Theory]
    [InlineData(12 * H, "above", null, null, true)]
    [InlineData(12 * H, null, null, null, true)]                 // sin elegir = como siempre
    [InlineData(12 * H, "rise_to", 48 * H, null, true)]
    [InlineData(12 * H, "rise_to", 12 * H, null, false)]         // debe ser mayor que el umbral
    [InlineData(12 * H, "rise_to", 6 * H, null, false)]
    [InlineData(12 * H, "rise_to", null, null, false)]
    [InlineData(12 * H, "fall_to", 6 * H, null, true)]
    [InlineData(12 * H, "fall_to", 0, null, true)]
    [InlineData(12 * H, "fall_to", 12 * H, null, false)]         // debe ser menor que el umbral
    [InlineData(12 * H, "fall_to", 24 * H, null, false)]
    [InlineData(12 * H, "fall_to", null, null, false)]
    [InlineData(12 * H, "duration", null, 3 * H, true)]
    [InlineData(12 * H, "duration", null, 0, false)]
    [InlineData(12 * H, "duration", null, null, false)]
    [InlineData(12 * H, "otra", null, null, false)]
    [InlineData(0, "above", null, null, false)]                   // sin umbral
    public void RemainingEnd_Validate(int threshold, string? mode, int? end, int? dur, bool valida)
        => Assert.Equal(valida, HappyHourProgressRule.ValidateRemaining(threshold, mode, end, dur) == null);
}
