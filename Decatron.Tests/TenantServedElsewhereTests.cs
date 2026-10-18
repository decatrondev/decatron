using Decatron.Core.Interfaces;
using Decatron.Data;
using Decatron.Services.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>
/// Un streamer con cuenta en el #1 y en el tenant de su proyecto (misma cuenta de Twitch): el bot que lo atiende es el del tenant ≠ 1
/// solo mientras lo tenga activado; si no, sigue el #1. Corre sobre decatron_schema con el tenant fijo 9101.
/// </summary>
[Collection("entitlements-db")]
public class TenantServedElsewhereTests : IDisposable
{
    private static string? Conn => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
    private static bool Available => !string.IsNullOrWhiteSpace(Conn);
    private const long Other = 9101, UserOne = 990301, UserOther = 990302;
    private const string Ext = "zz-ext-served", Login = "zz-served-login";

    private static NpgsqlConnection Open(long tenant) { var c = TenantNpgsql.Create(Conn, tenant); c.Open(); return c; }
    private static void Exec(long tenant, string sql) { using var c = Open(tenant); using var cmd = new NpgsqlCommand(sql, c); cmd.ExecuteNonQuery(); }

    private static void InsertUser(long tenant, long id) => Exec(tenant, $@"INSERT INTO users (id, twitch_id, login, display_name, email, profile_image_url, offline_image_url, broadcaster_type, view_count, description,
            access_token, refresh_token, token_expiration, created_at, updated_at, is_active, unique_id)
            VALUES ({id}, 'zz-tw-{id}', '{Login}', 'Z', '', '', '', '', 0, '', 'a', 'b', now(), now(), now(), true, 'zz-uid-{id}')");

    private static ITenantResolver NewResolver()
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = Conn }).Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IConfiguration>(cfg);
        services.AddDbContext<DecatronDbContext>(o => o.UseNpgsql(Conn));
        return new TenantResolver(services.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>(), NullLogger<TenantResolver>.Instance);
    }

    private static void SetBot(bool enabled) => Exec(Other, $"UPDATE system_settings SET bot_enabled={(enabled ? "true" : "false")} WHERE user_id={UserOther}");

    public TenantServedElsewhereTests()
    {
        if (!Available) return;
        Dispose();
        InsertUser(1, UserOne);
        InsertUser(Other, UserOther);
        Exec(1, $"INSERT INTO channels (tenant_id, platform, external_id, user_id, login) VALUES (1,'twitch','{Ext}',{UserOne},'{Login}')");
        Exec(Other, $"INSERT INTO channels (tenant_id, platform, external_id, user_id, login) VALUES ({Other},'twitch','{Ext}',{UserOther},'{Login}')");
        Exec(Other, $@"INSERT INTO system_settings (id, user_id, bot_enabled, created_at, updated_at) VALUES ({UserOther}, {UserOther}, false, now(), now())");
    }

    [Fact(DisplayName = "Mismo canal en dos tenants: lo atiende el del proyecto solo cuando tiene el bot activado; si no, el #1")]
    public void ElBotActivadoDelTenantGana()
    {
        if (!Available) return;

        // Bot del tenant apagado: sigue el #1 y no se marca como atendido fuera.
        var off = NewResolver();
        Assert.False(off.IsServedByOtherTenant(Ext));
        Assert.Equal(1, off.ByChannelKey(Ext).TenantId);
        Assert.Equal(1, off.ByChannelKey(Login).TenantId);

        // Bot del tenant encendido: lo atiende el tenant por id de Twitch y por login, el #1 lo deja.
        SetBot(true);
        var on = NewResolver();
        Assert.True(on.IsServedByOtherTenant(Ext));
        Assert.Equal(Other, on.ByChannelKey(Ext).TenantId);
        Assert.Equal(Other, on.ByChannelKey(Login).TenantId);
        Assert.Equal(1, on.ByUserId(UserOne).TenantId); // cada cuenta sigue en su tenant
        Assert.False(on.IsServedByOtherTenant("otro-canal"));
        Assert.False(on.IsServedByOtherTenant(null));

        // Lo apaga de nuevo: vuelve al #1 solo.
        SetBot(false);
        Assert.False(NewResolver().IsServedByOtherTenant(Ext));
    }

    public void Dispose()
    {
        if (!Available) return;
        Exec(Other, $"DELETE FROM system_settings WHERE user_id={UserOther}");
        Exec(1, $"DELETE FROM channels WHERE external_id='{Ext}'");
        Exec(Other, $"DELETE FROM channels WHERE external_id='{Ext}'");
        Exec(Other, $"DELETE FROM users WHERE id={UserOther}");
        Exec(1, $"DELETE FROM users WHERE id={UserOne}");
    }
}
