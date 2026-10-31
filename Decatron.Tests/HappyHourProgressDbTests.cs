using Decatron.Core.Helpers;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Decatron.Tests;

/// <summary>
/// Happy Hour por progreso del timer, de punta a punta contra la base: lee el estado real del timer (inicio, pausa) y decide
/// si está activa, con qué multiplicador y hasta cuándo. Corre sobre `decatron_schema` con DECATRON_APP_CONN, dentro de una
/// transacción que se revierte; sin la variable se omite.
/// </summary>
public class HappyHourProgressDbTests
{
    // Igual que producción: fechas "legacy" de Npgsql y la sesión de PostgreSQL en la hora de Lima (ver TimerDateTimeHelper)
    static HappyHourProgressDbTests() => AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

    private static string? RawConn => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
    private static string? Conn => string.IsNullOrWhiteSpace(RawConn) ? null : (RawConn!.Contains("Timezone=", StringComparison.OrdinalIgnoreCase) ? RawConn : RawConn!.TrimEnd(';') + ";Timezone=America/Lima");
    private const long UserId = 987654330;
    private const string Login = "hhprogresstest";

    private static DecatronDbContext NewContext()
        => new(new DbContextOptionsBuilder<DecatronDbContext>().UseNpgsql(Decatron.Core.Interfaces.TenantNpgsql.Create(Conn, 1)).Options);

    private static TimerEventService Service(DecatronDbContext db)
        => new(db, null!, NullLogger<TimerEventService>.Instance, null!, null!, null!, null!);

    private static async Task Seed(DecatronDbContext db, string status, TimeSpan startedAgo, TimeSpan? pausedAfterStart = null, int pausedSeconds = 0)
    {
        await db.Database.ExecuteSqlRawAsync($"INSERT INTO users (id, login, display_name, email, profile_image_url, offline_image_url, broadcaster_type, view_count, description, access_token, refresh_token, token_expiration, created_at, updated_at, is_active, unique_id) VALUES ({UserId}, '{Login}', 'zz', 'zz@x', '', '', '', 0, '', '', '', now(), now(), now(), true, 'zz-{UserId}')");
        var started = TimerDateTimeHelper.NowForDb().Subtract(startedAgo);
        db.TimerStates.Add(new TimerState
        {
            ChannelName = Login, UserId = UserId, Status = status, StartedAt = started,
            PausedAt = pausedAfterStart == null ? null : started.Add(pausedAfterStart.Value), ElapsedPausedTime = pausedSeconds,
            CurrentTime = 3600, TotalTime = 3600,
        });
        db.TimerHappyHours.Add(new TimerHappyHour
        {
            UserId = UserId, Name = "Hora de oro", Multiplier = 3m, Mode = HappyHourModes.Progress,
            StartAfterSeconds = 12 * 3600, DurationSeconds = 2 * 3600,
        });
        await db.SaveChangesAsync();
    }

    [Fact(DisplayName = "Progreso: con el timer en 13 h se activa, con el multiplicador y la hora de fin de la ventana")]
    public async Task Active_WhenElapsedInsideWindow()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        using var db = NewContext();
        await using var tx = await db.Database.BeginTransactionAsync();
        await Seed(db, "running", TimeSpan.FromHours(13));
        var info = await Service(db).GetActiveHappyHourInfoAsync(Login);
        Assert.True(info.Active);
        Assert.Equal(3.0, info.Multiplier);
        Assert.NotNull(info.EndsAt);
        Assert.InRange((info.EndsAt!.Value - DateTime.UtcNow).TotalSeconds, 3600 - 5, 3600 + 5); // le queda 1 h de las 2 h
        await tx.RollbackAsync();
    }

    [Fact(DisplayName = "Progreso: con el timer en 11 h todavía no se activa")]
    public async Task Inactive_BeforeThreshold()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        using var db = NewContext();
        await using var tx = await db.Database.BeginTransactionAsync();
        await Seed(db, "running", TimeSpan.FromHours(11));
        Assert.False((await Service(db).GetActiveHappyHourInfoAsync(Login)).Active);
        await tx.RollbackAsync();
    }

    [Fact(DisplayName = "Progreso: las pausas no cuentan (15 h reales con 4 h en pausa = 11 h de timer)")]
    public async Task PausedTimeDoesNotCount()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        using var db = NewContext();
        await using var tx = await db.Database.BeginTransactionAsync();
        await Seed(db, "running", TimeSpan.FromHours(15), pausedSeconds: 4 * 3600);
        Assert.False((await Service(db).GetActiveHappyHourInfoAsync(Login)).Active);
        await tx.RollbackAsync();
    }

    [Fact(DisplayName = "Progreso: en pausa la ventana sigue activa y congelada (sin hora de fin)")]
    public async Task Paused_StaysActiveWithoutEnd()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        using var db = NewContext();
        await using var tx = await db.Database.BeginTransactionAsync();
        // arrancó hace 20 h y se pausó a las 12 h 40 del timer
        await Seed(db, "paused", TimeSpan.FromHours(20), pausedAfterStart: TimeSpan.FromMinutes(12 * 60 + 40));
        var info = await Service(db).GetActiveHappyHourInfoAsync(Login);
        Assert.True(info.Active);
        Assert.Null(info.EndsAt);
        await tx.RollbackAsync();
    }

    [Fact(DisplayName = "Progreso: con el timer detenido no hay Happy Hour")]
    public async Task Stopped_NoHappyHour()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        using var db = NewContext();
        await using var tx = await db.Database.BeginTransactionAsync();
        await Seed(db, "stopped", TimeSpan.FromHours(13));
        Assert.False((await Service(db).GetActiveHappyHourInfoAsync(Login)).Active);
        await tx.RollbackAsync();
    }

    // ── Por tiempo restante, de punta a punta ────────────────────────────────

    private static async Task SeedRemaining(DecatronDbContext db, string status, int totalSeconds, TimeSpan startedAgo, TimeSpan? pausedAfterStart = null)
    {
        await db.Database.ExecuteSqlRawAsync($"INSERT INTO users (id, login, display_name, email, profile_image_url, offline_image_url, broadcaster_type, view_count, description, access_token, refresh_token, token_expiration, created_at, updated_at, is_active, unique_id) VALUES ({UserId}, '{Login}', 'zz', 'zz@x', '', '', '', 0, '', '', '', now(), now(), now(), true, 'zz-{UserId}')");
        var started = TimerDateTimeHelper.NowForDb().Subtract(startedAgo);
        db.TimerStates.Add(new TimerState
        {
            ChannelName = Login, UserId = UserId, Status = status, StartedAt = started,
            PausedAt = pausedAfterStart == null ? null : started.Add(pausedAfterStart.Value), ElapsedPausedTime = 0,
            CurrentTime = 0, TotalTime = totalSeconds,
        });
        db.TimerHappyHours.Add(new TimerHappyHour { UserId = UserId, Name = "Ultimas 12 h", Multiplier = 2m, Mode = HappyHourModes.Remaining, StartAfterSeconds = 12 * 3600 });
        await db.SaveChangesAsync();
    }

    [Theory(DisplayName = "Restante: se activa con 12 h o menos por delante y no con más (el caso de un timer que baja, lo suben y vuelve a bajar)")]
    [InlineData(480, 470, true)]   // quedan 10 h
    [InlineData(485, 470, false)]  // donaron 5 h: quedan 15 h
    [InlineData(485, 474, true)]   // pasaron 4 h más: quedan 11 h
    [InlineData(480, 500, false)]  // ya terminó (quedan 0)
    public async Task Remaining_ActiveOnlyWhenWithinThreshold(int totalHours, int elapsedHours, bool esperado)
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        using var db = NewContext();
        await using var tx = await db.Database.BeginTransactionAsync();
        await SeedRemaining(db, "running", totalHours * 3600, TimeSpan.FromHours(elapsedHours));
        var info = await Service(db).GetActiveHappyHourInfoAsync(Login);
        Assert.Equal(esperado, info.Active);
        if (esperado) { Assert.Equal(2.0, info.Multiplier); Assert.Null(info.EndsAt); } // sin hora de fin: depende de las donaciones
        await tx.RollbackAsync();
    }

    [Fact(DisplayName = "Restante: con el timer pausado por corte de directo (stream_paused) sigue activa y congelada")]
    public async Task Remaining_StreamPaused_StaysActive()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        using var db = NewContext();
        await using var tx = await db.Database.BeginTransactionAsync();
        // total 100 h; se cortó el directo a las 95 h (quedan 5 h) y pasaron 20 h reales
        await SeedRemaining(db, "stream_paused", 100 * 3600, TimeSpan.FromHours(115), pausedAfterStart: TimeSpan.FromHours(95));
        Assert.True((await Service(db).GetActiveHappyHourInfoAsync(Login)).Active);
        await tx.RollbackAsync();
    }

    // ── Por tiempo restante con memoria (rise_to / duration) y sin memoria (fall_to), contra la base ──

    private static async Task SeedRemainingEnd(DecatronDbContext db, string status, int totalSeconds, TimeSpan startedAgo,
        string endMode, int? endAfter, int? duration, long? latched = null)
    {
        await SeedRemaining(db, status, totalSeconds, startedAgo);
        var hh = await db.TimerHappyHours.SingleAsync(h => h.UserId == UserId);
        hh.EndMode = endMode; hh.EndAfterSeconds = endAfter; hh.DurationSeconds = duration; hh.LatchedElapsedSeconds = latched;
        await db.SaveChangesAsync();
    }

    private static async Task<(bool Active, long? Latched)> Ask(DecatronDbContext db)
    {
        var info = await Service(db).GetActiveHappyHourInfoAsync(Login);
        db.ChangeTracker.Clear(); // lo siguiente se lee de la base, como lo haría otro proceso o un reinicio
        var latched = (await db.TimerHappyHours.AsNoTracking().SingleAsync(h => h.UserId == UserId)).LatchedElapsedSeconds;
        return (info.Active, latched);
    }

    private static async Task SetTotal(DecatronDbContext db, int totalSeconds)
    {
        var st = await db.TimerStates.SingleAsync(x => x.ChannelName == Login);
        st.TotalTime = totalSeconds;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
    }

    [Fact(DisplayName = "Restante rise_to: se activa a las 12 h, aguanta donaciones hasta las 48 h, se apaga y se rearma al bajar")]
    public async Task RemainingRiseTo_FullCycleAgainstDb()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        using var db = NewContext();
        await using var tx = await db.Database.BeginTransactionAsync();
        // total 480 h, lleva 470 h: quedan 10 h
        await SeedRemainingEnd(db, "running", 480 * 3600, TimeSpan.FromHours(470), RemainingEndModes.RiseTo, 48 * 3600, null);
        var r = await Ask(db);
        Assert.True(r.Active); Assert.NotNull(r.Latched);                    // activa y lo recuerda
        await SetTotal(db, 500 * 3600); r = await Ask(db);                   // donan 20 h: quedan 30 h
        Assert.True(r.Active);                                               // sigue activa
        await SetTotal(db, 520 * 3600); r = await Ask(db);                   // quedan 50 h: llegó a 48
        Assert.False(r.Active); Assert.Null(r.Latched);                      // se apaga y olvida
        await SetTotal(db, 500 * 3600); r = await Ask(db);                   // quedan 30 h: no se rearma aún
        Assert.False(r.Active);
        await SetTotal(db, 480 * 3600); r = await Ask(db);                   // quedan 10 h: se activa otra vez
        Assert.True(r.Active);
        await tx.RollbackAsync();
    }

    [Fact(DisplayName = "Restante duration: dura lo configurado del timer; al cumplirse no se reactiva hasta subir sobre el umbral")]
    public async Task RemainingDuration_ExpiresAndRearmsAgainstDb()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        using var db = NewContext();
        await using var tx = await db.Database.BeginTransactionAsync();
        await SeedRemainingEnd(db, "running", 480 * 3600, TimeSpan.FromHours(470), RemainingEndModes.Duration, null, 3 * 3600);
        var r = await Ask(db);
        Assert.True(r.Active); Assert.True(r.Latched >= 0);
        // pasan 4 h del timer desde que se activó: el estado guardado queda 4 h atrás
        var hh = await db.TimerHappyHours.SingleAsync(h => h.UserId == UserId);
        hh.LatchedElapsedSeconds = r.Latched - 4 * 3600; await db.SaveChangesAsync(); db.ChangeTracker.Clear();
        r = await Ask(db);
        Assert.False(r.Active); Assert.Equal(HappyHourProgressRule.Spent, r.Latched);   // ya cumplió
        r = await Ask(db);
        Assert.False(r.Active);                                                          // sigue bajo el umbral y no se reactiva
        await SetTotal(db, 500 * 3600); r = await Ask(db);                               // sube sobre el umbral
        Assert.False(r.Active); Assert.Null(r.Latched);                                  // se rearma
        await SetTotal(db, 480 * 3600); r = await Ask(db);                               // vuelve a bajar
        Assert.True(r.Active);
        await tx.RollbackAsync();
    }

    [Fact(DisplayName = "Restante fall_to: activa entre las 12 h y las 6 h restantes")]
    public async Task RemainingFallTo_ActiveOnlyBetweenThresholds()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        using var db = NewContext();
        await using var tx = await db.Database.BeginTransactionAsync();
        await SeedRemainingEnd(db, "running", 480 * 3600, TimeSpan.FromHours(470), RemainingEndModes.FallTo, 6 * 3600, null); // quedan 10 h
        Assert.True((await Ask(db)).Active);
        await SetTotal(db, 475 * 3600);                                                                                         // quedan 5 h
        Assert.False((await Ask(db)).Active);
        await tx.RollbackAsync();
    }

    [Fact(DisplayName = "Restante: con el timer detenido se borra lo recordado")]
    public async Task Remaining_TimerStopped_ClearsLatch()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        using var db = NewContext();
        await using var tx = await db.Database.BeginTransactionAsync();
        await SeedRemainingEnd(db, "stopped", 480 * 3600, TimeSpan.FromHours(470), RemainingEndModes.RiseTo, 48 * 3600, null, latched: 1234);
        var r = await Ask(db);
        Assert.False(r.Active); Assert.Null(r.Latched);
        await tx.RollbackAsync();
    }
}
