using Decatron.Core.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>Estado de la última sincronización por canal: una fila por canal, un fallo no borra el último éxito. Sobre `decatron_schema`; limpia lo que crea.</summary>
public class FollowerSyncStatusDbTests
{
    static FollowerSyncStatusDbTests() => AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

    private static string? Conn
    {
        get
        {
            var raw = Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
            return string.IsNullOrWhiteSpace(raw) ? null : raw.TrimEnd(';') + ";Timezone=UTC;Application Name=sync-status-tests";
        }
    }
    private const string Broadcaster = "test-sync-b1";

    private static FollowersService Service() => new(
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = Conn }).Build(),
        NullLogger<FollowersService>.Instance);

    private static void Clean()
    {
        using var c = Decatron.Core.Interfaces.TenantNpgsql.Create(Conn!, 1);
        c.Open();
        using var chk = new NpgsqlCommand("select current_database()", c);
        if ((string)chk.ExecuteScalar()! != "decatron_schema") throw new InvalidOperationException("Base inesperada: solo decatron_schema");
        using var cmd = new NpgsqlCommand($"delete from follower_sync_status where broadcaster_id='{Broadcaster}'", c);
        cmd.ExecuteNonQuery();
    }

    [Fact(DisplayName = "Estado de sincronización: sin intentos no hay estado; cada intento actualiza la misma fila")]
    public async Task OneRowPerChannel_UpdatedEachAttempt()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        Clean();
        try
        {
            var svc = Service();
            Assert.Null(await svc.GetSyncStatusAsync("twitch", Broadcaster));

            await svc.RecordSyncStatusAsync("twitch", Broadcaster, "auto", "ok", null, true, 3, 1, 2, 4);
            var first = await svc.GetSyncStatusAsync("twitch", Broadcaster);
            Assert.NotNull(first);
            Assert.Equal("auto", first!.Source);
            Assert.Equal("ok", first.Result);
            Assert.NotNull(first.LastSuccessAt);
            Assert.Equal((3, 1, 2, 4), (first.NewCount, first.ReturnedCount, first.UnfollowedCount, first.RenamedCount));

            await svc.RecordSyncStatusAsync("twitch", Broadcaster, "manual", "unfollows_skipped", "SuspiciousDrop", true, 0, 0, 0, 0);
            var second = await svc.GetSyncStatusAsync("twitch", Broadcaster);
            Assert.Equal("manual", second!.Source);
            Assert.Equal("unfollows_skipped", second.Result);
            Assert.Equal("SuspiciousDrop", second.Detail);
        }
        finally { Clean(); }
    }

    [Fact(DisplayName = "Estado de sincronización: un intento fallido conserva la fecha del último éxito")]
    public async Task FailedAttempt_KeepsLastSuccess()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        Clean();
        try
        {
            var svc = Service();
            await svc.RecordSyncStatusAsync("twitch", Broadcaster, "auto", "ok", null, true, 0, 0, 0, 0);
            var ok = await svc.GetSyncStatusAsync("twitch", Broadcaster);
            await Task.Delay(50);
            await svc.RecordSyncStatusAsync("twitch", Broadcaster, "auto", "fetch_failed", "http_401", false, 0, 0, 0, 0);
            var failed = await svc.GetSyncStatusAsync("twitch", Broadcaster);

            Assert.Equal("fetch_failed", failed!.Result);
            Assert.Equal(ok!.LastSuccessAt, failed.LastSuccessAt);
            Assert.True(failed.LastAttemptAt > ok.LastAttemptAt);
        }
        finally { Clean(); }
    }
}
