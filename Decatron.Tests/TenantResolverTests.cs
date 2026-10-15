using Decatron.Core.Interfaces;
using Decatron.Data;
using Decatron.Services.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Decatron.Tests;

/// <summary>El resolutor de la Fase 2 acepta las claves de canal mixtas y cae al tenant 1 sin resolver lo desconocido.</summary>
public class TenantResolverTests : IDisposable
{
    private readonly ServiceProvider _sp = null!;
    private readonly ITenantResolver _resolver = null!;

    public TenantResolverTests()
    {
        if (!TestDb.Available) return;
        using (var c = TestDb.Open())
        {
            TestDb.Exec(c, "DROP TABLE IF EXISTS channels");
            TestDb.Exec(c, "DROP TABLE IF EXISTS discord_guild_configs");
            TestDb.Exec(c, "CREATE TABLE discord_guild_configs (id BIGSERIAL PRIMARY KEY, guild_id VARCHAR(50) NOT NULL, tenant_id BIGINT NOT NULL DEFAULT 1)");
            TestDb.Exec(c, "INSERT INTO discord_guild_configs (guild_id, tenant_id) VALUES ('1091093060244471808', 1)");
            TestDb.Exec(c, @"CREATE TABLE channels (id BIGSERIAL PRIMARY KEY, tenant_id BIGINT NOT NULL, platform VARCHAR(12) NOT NULL,
                external_id VARCHAR(64) NOT NULL, user_id BIGINT NOT NULL, login VARCHAR(100) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
            TestDb.Exec(c, "INSERT INTO channels (tenant_id, platform, external_id, user_id, login) VALUES (1,'twitch','123456',7,'PixiPNJ'),(1,'kick','98765',9,'kick_98765')");
        }
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<DecatronDbContext>(o => o.UseNpgsql(TestDb.Conn));
        services.AddSingleton<ITenantResolver, TenantResolver>();
        _sp = services.BuildServiceProvider();
        _resolver = _sp.GetRequiredService<ITenantResolver>();
    }

    [Theory(DisplayName = "Todas las formas de clave de un canal resuelven a su tenant")]
    [InlineData("pixipnj")]       // login sin importar mayúsculas
    [InlineData("PixiPNJ")]
    [InlineData("123456")]        // id de Twitch
    [InlineData("v2:pixipnj")]    // overlay v2
    [InlineData("7")]             // users.id
    [InlineData("98765")]         // id de Kick
    [InlineData("kick_98765")]    // login de Kick
    public void KnownKeys_Resolve(string key)
    {
        if (!TestDb.Available) return;
        var r = _resolver.ByChannelKey(key);
        Assert.True(r.Resolved);
        Assert.Equal(1, r.TenantId);
    }

    [Theory(DisplayName = "Una clave desconocida cae al tenant 1 pero queda marcada como no resuelta")]
    [InlineData("nadie")]
    [InlineData("999999999")]
    [InlineData("")]
    [InlineData(null)]
    public void UnknownKeys_FallBackUnresolved(string? key)
    {
        if (!TestDb.Available) return;
        var r = _resolver.ByChannelKey(key);
        Assert.False(r.Resolved);
        Assert.Equal(1, r.TenantId);
    }

    [Fact(DisplayName = "ByUserId resuelve usuarios con canal")]
    public void ByUserId()
    {
        if (!TestDb.Available) return;
        Assert.True(_resolver.ByUserId(7).Resolved);
        Assert.False(_resolver.ByUserId(123).Resolved);
    }

    [Fact(DisplayName = "Un servidor de Discord conocido resuelve a su tenant y uno desconocido no")]
    public void ByGuildId()
    {
        if (!TestDb.Available) return;
        var ok = _resolver.ByGuildId("1091093060244471808");
        Assert.True(ok.Resolved);
        Assert.Equal(1, ok.TenantId);
        Assert.Equal(TenantSource.Guild, ok.Source);
        Assert.False(_resolver.ByGuildId("42").Resolved);
        Assert.False(_resolver.ByGuildId(null).Resolved);
    }

    public void Dispose()
    {
        if (!TestDb.Available) return;
        _sp.Dispose();
        using var c = TestDb.Open();
        TestDb.Exec(c, "DROP TABLE IF EXISTS channels");
        TestDb.Exec(c, "DROP TABLE IF EXISTS discord_guild_configs");
    }
}
