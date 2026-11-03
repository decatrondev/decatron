using Decatron.Core.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>
/// Registro de follows en vivo contra la base: atómico (sin perder follows por carreras), sin pisar bloqueo ni fecha de cuenta.
/// Corre sobre `decatron_schema` con DECATRON_APP_CONN y limpia lo que crea; sin la variable se omite.
/// </summary>
public class FollowersRecordFollowDbTests
{
    static FollowersRecordFollowDbTests() => AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

    private static string? Conn => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
    private const string Broadcaster = "test-rec-b1";

    private static FollowersService Service() => new(
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = Conn }).Build(),
        NullLogger<FollowersService>.Instance);

    private static NpgsqlConnection Open()
    {
        var c = Decatron.Core.Interfaces.TenantNpgsql.Create(Conn!, 1);
        c.Open();
        using var chk = new NpgsqlCommand("select current_database()", c);
        if ((string)chk.ExecuteScalar()! != "decatron_schema") { c.Dispose(); throw new InvalidOperationException("Base inesperada: solo decatron_schema"); }
        return c;
    }

    private static void Exec(string sql)
    {
        using var c = Open();
        using var cmd = new NpgsqlCommand(sql, c);
        cmd.ExecuteNonQuery();
    }

    private static T? Scalar<T>(string sql)
    {
        using var c = Open();
        using var cmd = new NpgsqlCommand(sql, c);
        var o = cmd.ExecuteScalar();
        return o is null or DBNull ? default : (T)Convert.ChangeType(o, typeof(T));
    }

    private static void Clean() => Exec($"delete from channel_followers where broadcaster_id='{Broadcaster}'");

    [Fact(DisplayName = "Follow en vivo: 20 eventos simultáneos del mismo usuario dejan una sola fila y ninguno falla")]
    public async Task ParallelEvents_OneRow_NoFailures()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        Clean();
        try
        {
            var svc = Service();
            var when = new DateTime(2026, 11, 3, 12, 0, 0, DateTimeKind.Utc);
            var results = await Task.WhenAll(Enumerable.Range(0, 20).Select(_ =>
                svc.RecordFollowAsync(Broadcaster, "Canal", "u-race", "Persona", "persona", when)));
            Assert.Equal(1, results.Count(r => r == FollowRecordOutcome.Created));
            Assert.Equal(19, results.Count(r => r == FollowRecordOutcome.AlreadyFollowing));
            Assert.Equal(1, Scalar<int>($"select count(*) from channel_followers where broadcaster_id='{Broadcaster}' and user_id='u-race'"));
        }
        finally { Clean(); }
    }

    [Fact(DisplayName = "Follow en vivo: el mismo id en Twitch y en Kick son dos seguidores distintos, sin chocar")]
    public async Task SameIdOnTwitchAndKick_AreSeparateRows()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        Clean();
        try
        {
            var svc = Service();
            var when = new DateTime(2026, 11, 3, 12, 0, 0, DateTimeKind.Utc);
            Assert.Equal(FollowRecordOutcome.Created, await svc.RecordFollowAsync(Broadcaster, "Canal", "u-same", "Ana", "ana", when));
            Assert.Equal(FollowRecordOutcome.Created, await svc.RecordFollowAsync(Broadcaster, "Canal", "u-same", "Ana", "ana", when, "kick"));
            Assert.Equal(2, Scalar<int>($"select count(*) from channel_followers where broadcaster_id='{Broadcaster}' and user_id='u-same'"));
            Assert.Equal(FollowRecordOutcome.AlreadyFollowing, await svc.RecordFollowAsync(Broadcaster, "Canal", "u-same", "Ana", "ana", when, "kick"));

            // Lo de Kick no aparece en lo de Twitch, y al revés
            var twitch = await svc.GetFollowersAsync(Broadcaster);
            var kick = await svc.GetFollowersAsync(Broadcaster, platform: "kick");
            Assert.Single(twitch);
            Assert.Single(kick);
            Assert.Equal("kick", kick[0].Platform);
        }
        finally { Clean(); }
    }

    [Fact(DisplayName = "Follow en vivo: si ya seguía (evento repetido) conserva la fecha original")]
    public async Task Duplicate_KeepsOriginalDate()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        Clean();
        try
        {
            var svc = Service();
            var first = new DateTime(2026, 11, 3, 12, 0, 0, DateTimeKind.Utc);
            Assert.Equal(FollowRecordOutcome.Created, await svc.RecordFollowAsync(Broadcaster, "Canal", "u-dup", "A", "a", first));
            Assert.Equal(FollowRecordOutcome.AlreadyFollowing, await svc.RecordFollowAsync(Broadcaster, "Canal", "u-dup", "A", "a", first.AddMinutes(5)));
            Assert.Equal(first, Scalar<DateTime>($"select followed_at from channel_followers where broadcaster_id='{Broadcaster}' and user_id='u-dup'"));
        }
        finally { Clean(); }
    }

    [Fact(DisplayName = "Follow en vivo: al volver tras un unfollow se reactiva sin pisar el bloqueo ni la fecha de creación de la cuenta")]
    public async Task Refollow_ReactivatesWithoutOverwriting()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        Clean();
        try
        {
            var svc = Service();
            var first = new DateTime(2026, 1, 1, 10, 0, 0, DateTimeKind.Utc);
            await svc.RecordFollowAsync(Broadcaster, "Canal", "u-ref", "Viejo", "viejo", first);
            Exec($@"update channel_followers set is_following=1, unfollowed_at=now(), is_blocked=1, was_blocked=1,
                    account_created_at='2020-05-05 00:00:00' where broadcaster_id='{Broadcaster}' and user_id='u-ref'");

            var again = new DateTime(2026, 11, 3, 12, 0, 0, DateTimeKind.Utc);
            Assert.Equal(FollowRecordOutcome.Reactivated, await svc.RecordFollowAsync(Broadcaster, "Canal", "u-ref", "Nuevo", "nuevo", again));

            Assert.Equal(0, Scalar<int>($"select is_following from channel_followers where broadcaster_id='{Broadcaster}' and user_id='u-ref'"));
            Assert.Null(Scalar<DateTime?>($"select unfollowed_at from channel_followers where broadcaster_id='{Broadcaster}' and user_id='u-ref'"));
            Assert.Equal(1, Scalar<int>($"select is_blocked from channel_followers where broadcaster_id='{Broadcaster}' and user_id='u-ref'"));
            Assert.Equal(1, Scalar<int>($"select was_blocked from channel_followers where broadcaster_id='{Broadcaster}' and user_id='u-ref'"));
            Assert.Equal(new DateTime(2020, 5, 5), Scalar<DateTime>($"select account_created_at from channel_followers where broadcaster_id='{Broadcaster}' and user_id='u-ref'"));
            Assert.Equal("nuevo", Scalar<string>($"select user_login from channel_followers where broadcaster_id='{Broadcaster}' and user_id='u-ref'"));
            Assert.Equal(again, Scalar<DateTime>($"select followed_at from channel_followers where broadcaster_id='{Broadcaster}' and user_id='u-ref'"));
        }
        finally { Clean(); }
    }
}
