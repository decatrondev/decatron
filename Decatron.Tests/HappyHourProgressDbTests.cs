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
}
