using Decatron.Core.Helpers;
using Decatron.Core.Services;
using Decatron.Data;
using Decatron.Services.Accounts;
using Decatron.Services.Platforms.Kick;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>
/// Follows de Kick de punta a punta: el webhook ya tradujo el evento; el registrador resuelve la cuenta por el id de Kick y lo guarda
/// como seguidor con platform = kick (más su historial). Corre sobre `decatron_schema` con DECATRON_APP_CONN y limpia lo que crea.
/// </summary>
public class KickFollowRecorderDbTests
{
    static KickFollowRecorderDbTests() => AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

    private static string? Conn
    {
        get
        {
            var raw = Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
            return string.IsNullOrWhiteSpace(raw) ? null : raw.TrimEnd(';') + ";Timezone=UTC;Application Name=kick-follow-tests";
        }
    }

    private const long UserId = 987654341;
    private const string KickId = "424242001";
    private const string Login = "kickfollowtest";

    private static NpgsqlConnection Open()
    {
        var c = Decatron.Core.Interfaces.TenantNpgsql.Create(Conn!, 1);
        c.Open();
        using var chk = new NpgsqlCommand("select current_database()", c);
        if ((string)chk.ExecuteScalar()! != "decatron_schema") { c.Dispose(); throw new InvalidOperationException("Base inesperada: solo decatron_schema"); }
        return c;
    }

    private static void Exec(string sql) { using var c = Open(); using var cmd = new NpgsqlCommand(sql, c); cmd.ExecuteNonQuery(); }
    private static T? Scalar<T>(string sql)
    {
        using var c = Open(); using var cmd = new NpgsqlCommand(sql, c);
        var o = cmd.ExecuteScalar();
        return o is null or DBNull ? default : (T)Convert.ChangeType(o, typeof(T));
    }

    private static void Clean()
    {
        Exec($"delete from channel_followers where broadcaster_id='{KickId}'");
        Exec($"delete from follower_history where broadcaster_id='{KickId}'");
        Exec($"delete from users where id={UserId}");
    }

    private static KickFollowRecorder BuildRecorder()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IConfiguration>(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = Conn }).Build());
        services.AddScoped(_ => new DecatronDbContext(new DbContextOptionsBuilder<DecatronDbContext>()
            .UseNpgsql(Decatron.Core.Interfaces.TenantNpgsql.Create(Conn!, 1)).Options));
        services.AddScoped<FollowersService>();
        var sp = services.BuildServiceProvider();
        var scopes = sp.GetRequiredService<IServiceScopeFactory>();
        return new KickFollowRecorder(scopes, new AccountChannelResolver(scopes, NullLogger<AccountChannelResolver>.Instance), NullLogger<KickFollowRecorder>.Instance);
    }

    private static PlatformEvent Follow(string eventId, string broadcaster, string userId, string name, DateTime at) =>
        new(eventId, "kick", PlatformEventType.Follow, broadcaster, userId, name, false, 0, 0, null, null, null, at);

    [Fact(DisplayName = "Kick: un follow de un canal vinculado se guarda como seguidor kick con su historial, y uno repetido no duplica nada")]
    public async Task KickFollow_IsStored_AndDuplicateIgnored()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        Clean();
        try
        {
            using (var db = new DecatronDbContext(new DbContextOptionsBuilder<DecatronDbContext>().UseNpgsql(Decatron.Core.Interfaces.TenantNpgsql.Create(Conn!, 1)).Options))
                await db.Database.ExecuteSqlRawAsync($"INSERT INTO users (id, login, display_name, email, profile_image_url, offline_image_url, broadcaster_type, view_count, description, access_token, refresh_token, token_expiration, created_at, updated_at, is_active, unique_id, kick_id, kick_username) VALUES ({UserId}, '{Login}', 'zz', 'zz@x', '', '', '', 0, '', '', '', now(), now(), now(), true, 'zz-{UserId}', '{KickId}', 'CanalKick')");

            var recorder = BuildRecorder();
            var at = new DateTime(2026, 11, 3, 18, 30, 0, DateTimeKind.Utc);
            await recorder.RecordAsync(Follow("e1", KickId, "9001", "Persona_Kick", at));
            await recorder.RecordAsync(Follow("e2", KickId, "9001", "Persona_Kick", at.AddMinutes(3))); // repetido

            Assert.Equal(1, Scalar<int>($"select count(*) from channel_followers where broadcaster_id='{KickId}' and platform='kick' and user_id='9001'"));
            Assert.Equal(0, Scalar<int>($"select count(*) from channel_followers where broadcaster_id='{KickId}' and platform='twitch'"));
            Assert.Equal("persona_kick", Scalar<string>($"select user_login from channel_followers where broadcaster_id='{KickId}' and user_id='9001'"));
            Assert.Equal("CanalKick", Scalar<string>($"select broadcaster_name from channel_followers where broadcaster_id='{KickId}' and user_id='9001'"));
            Assert.Equal(at, Scalar<DateTime>($"select followed_at from channel_followers where broadcaster_id='{KickId}' and user_id='9001'"));
            Assert.Equal(1, Scalar<int>($"select count(*) from follower_history where broadcaster_id='{KickId}' and platform='kick' and user_id='9001' and action=0"));
        }
        finally { Clean(); }
    }

    [Fact(DisplayName = "Kick: un follow de un canal sin cuenta, anónimo o que no es follow no guarda nada")]
    public async Task Unknown_Anonymous_OrOtherEvents_AreIgnored()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        Clean();
        try
        {
            var recorder = BuildRecorder();
            var at = new DateTime(2026, 11, 3, 18, 30, 0, DateTimeKind.Utc);
            await recorder.RecordAsync(Follow("e1", "no-existe-424242009", "9002", "Alguien", at)); // canal sin cuenta
            await recorder.RecordAsync(new PlatformEvent("e2", "kick", PlatformEventType.Follow, KickId, null, null, true, 0, 0, null, null, null, at)); // anónimo
            await recorder.RecordAsync(new PlatformEvent("e3", "kick", PlatformEventType.Kicks, KickId, "9003", "Alguien", false, 5, 0, null, null, null, at)); // no es follow
            Assert.Equal(0, Scalar<int>("select count(*) from channel_followers where platform='kick' and user_id in ('9002','9003')"));
        }
        finally { Clean(); }
    }
}
