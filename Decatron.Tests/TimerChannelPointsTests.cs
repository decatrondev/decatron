using System.Text.Json;
using Decatron.Core.Helpers;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Hubs;
using Decatron.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Decatron.Tests;

/// <summary>
/// Timer + puntos de canal: un canje de una recompensa elegida suma tiempo (con la Happy Hour si hay), uno de otra recompensa
/// o con el timer detenido no hace nada. Corre sobre `decatron_schema` con DECATRON_APP_CONN; sin la variable se omite.
/// El servicio abre su propia transacción (bloqueo de fila), así que no se puede envolver en otra: cada prueba borra lo que creó.
/// </summary>
public class TimerChannelPointsTests
{
    static TimerChannelPointsTests() => AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

    private static string? RawConn => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
    private static string? Conn => string.IsNullOrWhiteSpace(RawConn) ? null : (RawConn!.Contains("Timezone=", StringComparison.OrdinalIgnoreCase) ? RawConn : RawConn!.TrimEnd(';') + ";Timezone=America/Lima");
    private const long UserId = 987654331;
    private const string Login = "cptimertest";

    // Overlay falso: anota los grupos y mensajes que se enviarían, sin SignalR real.
    private sealed class Sent { public List<(string Group, string Method)> Calls { get; } = new(); }
    private sealed class FakeProxy(Sent sent, string group) : IClientProxy
    {
        public Task SendCoreAsync(string method, object?[] args, CancellationToken ct = default) { sent.Calls.Add((group, method)); return Task.CompletedTask; }
    }
    private sealed class FakeClients(Sent sent) : IHubClients
    {
        public IClientProxy All => new FakeProxy(sent, "*");
        public IClientProxy AllExcept(IReadOnlyList<string> c) => All;
        public IClientProxy Client(string id) => new FakeProxy(sent, id);
        public IClientProxy Clients(IReadOnlyList<string> ids) => All;
        public IClientProxy Group(string g) => new FakeProxy(sent, g);
        public IClientProxy GroupExcept(string g, IReadOnlyList<string> c) => new FakeProxy(sent, g);
        public IClientProxy Groups(IReadOnlyList<string> g) => All;
        public IClientProxy User(string u) => All;
        public IClientProxy Users(IReadOnlyList<string> u) => All;
    }
    private sealed class FakeHub(Sent sent) : IHubContext<OverlayHub>
    {
        public IHubClients Clients => new FakeClients(sent);
        public IGroupManager Groups => throw new NotSupportedException();
    }

    private static DecatronDbContext NewContext()
        => new(new DbContextOptionsBuilder<DecatronDbContext>().UseNpgsql(Decatron.Core.Interfaces.TenantNpgsql.Create(Conn, 1)).Options);

    private static TimerEventService Service(DecatronDbContext db, Sent sent)
        => new(db, new OverlayNotificationService(new FakeHub(sent), NullLogger<OverlayNotificationService>.Instance),
               NullLogger<TimerEventService>.Instance, null!, null!, null!, null!);

    private static async Task Seed(DecatronDbContext db, string status, object channelPoints)
    {
        await db.Database.ExecuteSqlRawAsync($"INSERT INTO users (id, login, display_name, email, profile_image_url, offline_image_url, broadcaster_type, view_count, description, access_token, refresh_token, token_expiration, created_at, updated_at, is_active, unique_id) VALUES ({UserId}, '{Login}', 'zz', 'zz@x', '', '', '', 0, '', '', '', now(), now(), now(), true, 'zz-{UserId}')");
        db.TimerConfigs.Add(new TimerConfig { UserId = UserId, ChannelName = Login, EventsConfig = JsonSerializer.Serialize(new { channelPoints }) });
        db.TimerStates.Add(new TimerState
        {
            ChannelName = Login, UserId = UserId, Status = status, StartedAt = TimerDateTimeHelper.NowForDb(),
            CurrentTime = 600, TotalTime = 600,
        });
        await db.SaveChangesAsync();
    }

    /// <summary>Borra todo lo que sembró una prueba (también si falló a medias).</summary>
    private static async Task Cleanup(DecatronDbContext db)
    {
        foreach (var sql in new[] {
            $"DELETE FROM timer_event_logs WHERE channel_name = '{Login}'",
            $"DELETE FROM timer_states WHERE channel_name = '{Login}'",
            $"DELETE FROM timer_happyhour WHERE user_id = {UserId}",
            $"DELETE FROM timer_configs WHERE channel_name = '{Login}'",
            $"DELETE FROM users WHERE id = {UserId}" })
            await db.Database.ExecuteSqlRawAsync(sql);
    }

    private static readonly object OneReward = new[] { new { rewardId = "r-1", title = "Mas tiempo", timeAdded = 300, enabled = true } };

    [Fact(DisplayName = "Puntos de canal: el canje de la recompensa elegida suma su tiempo y avisa al overlay")]
    public async Task Redeem_AddsConfiguredTime()
    {
        if (Conn == null) return;
        using var db = NewContext();
        await Cleanup(db);
        try
        {
        await Seed(db, "running", OneReward);
        var sent = new Sent();
        Assert.True(await Service(db, sent).ProcessChannelPointsEventAsync(Login, "ana", "1", "r-1", "Mas tiempo"));
        var state = await db.TimerStates.AsNoTracking().SingleAsync(s => s.ChannelName == Login);
        Assert.Equal(900, state.CurrentTime);
        Assert.Equal(900, state.TotalTime);
        Assert.Contains(sent.Calls, c => c.Group == $"overlay_{Login}" && c.Method == "AddTime");
        var log = await db.TimerEventLogs.AsNoTracking().SingleAsync(l => l.ChannelName == Login);
        Assert.Equal(("channelpoints", 300, "Mas tiempo"), (log.EventType, log.TimeAdded, log.Details));
        }
        finally { await Cleanup(db); }
    }

    [Fact(DisplayName = "Puntos de canal: otra recompensa, una apagada o con 0 segundos no suman")]
    public async Task Redeem_OtherRewardDisabledOrZero_DoesNothing()
    {
        if (Conn == null) return;
        using var db = NewContext();
        await Cleanup(db);
        try
        {
        await Seed(db, "running", new object[]
        {
            new { rewardId = "r-1", title = "A", timeAdded = 300, enabled = true },
            new { rewardId = "r-off", title = "B", timeAdded = 300, enabled = false },
            new { rewardId = "r-zero", title = "C", timeAdded = 0, enabled = true },
        });
        var svc = Service(db, new Sent());
        Assert.False(await svc.ProcessChannelPointsEventAsync(Login, "ana", "1", "otra", "Otra"));
        Assert.False(await svc.ProcessChannelPointsEventAsync(Login, "ana", "1", "r-off", "B"));
        Assert.False(await svc.ProcessChannelPointsEventAsync(Login, "ana", "1", "r-zero", "C"));
        Assert.Equal(600, (await db.TimerStates.AsNoTracking().SingleAsync(s => s.ChannelName == Login)).CurrentTime);
        }
        finally { await Cleanup(db); }
    }

    [Theory(DisplayName = "Puntos de canal: con el timer detenido o terminado el canje se ignora, sin vidas extra ni mensajes")]
    [InlineData("stopped")]
    [InlineData("finished")]
    public async Task Redeem_TimerNotRunning_IsIgnored(string status)
    {
        if (Conn == null) return;
        using var db = NewContext();
        await Cleanup(db);
        try
        {
        await Seed(db, status, OneReward);
        var sent = new Sent();
        Assert.False(await Service(db, sent).ProcessChannelPointsEventAsync(Login, "ana", "1", "r-1", "Mas tiempo"));
        var state = await db.TimerStates.AsNoTracking().SingleAsync(s => s.ChannelName == Login);
        Assert.Equal((600, 0), (state.CurrentTime, state.UsedChances));
        Assert.Empty(sent.Calls);
        }
        finally { await Cleanup(db); }
    }

    [Fact(DisplayName = "Puntos de canal: en pausa también suma, y la Happy Hour lo multiplica")]
    public async Task Redeem_WhilePaused_AppliesHappyHour()
    {
        if (Conn == null) return;
        using var db = NewContext();
        await Cleanup(db);
        try
        {
        await Seed(db, "paused", OneReward);
        db.TimerHappyHours.Add(new TimerHappyHour { UserId = UserId, Name = "x2", Multiplier = 2m, Mode = HappyHourModes.Progress, StartAfterSeconds = 0, DurationSeconds = 3600 });
        // en pausa desde hace poco: el timer lleva 0 s, dentro de la ventana
        var st = await db.TimerStates.SingleAsync(s => s.ChannelName == Login);
        st.PausedAt = st.StartedAt;
        await db.SaveChangesAsync();
        Assert.True(await Service(db, new Sent()).ProcessChannelPointsEventAsync(Login, "ana", "1", "r-1", "Mas tiempo"));
        Assert.Equal(600 + 600, (await db.TimerStates.AsNoTracking().SingleAsync(s => s.ChannelName == Login)).CurrentTime); // 300 s x2
        }
        finally { await Cleanup(db); }
    }

    [Fact(DisplayName = "Puntos de canal: un canal sin recompensas configuradas no hace nada")]
    public async Task Redeem_NoRewardsConfigured_DoesNothing()
    {
        if (Conn == null) return;
        using var db = NewContext();
        await Cleanup(db);
        try
        {
        await Seed(db, "running", Array.Empty<object>());
        Assert.False(await Service(db, new Sent()).ProcessChannelPointsEventAsync(Login, "ana", "1", "r-1", "Mas tiempo"));
        }
        finally { await Cleanup(db); }
    }
}
