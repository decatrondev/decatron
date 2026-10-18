using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 7.3: gracia al vencer. Corre sobre decatron_schema (tenants 9101/9102) con DECATRON_APP_CONN; sin la variable se omite.</summary>
[Collection("entitlements-db")]
public class TenantGraceTests : IDisposable
{
    private static string? Conn => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
    private static bool Available => !string.IsNullOrWhiteSpace(Conn);
    private const long A = 9101, B = 9102;

    private static void Exec(long tenant, string sql)
    {
        using var c = TenantNpgsql.Create(Conn, tenant); c.Open();
        using var cmd = new NpgsqlCommand(sql, c); cmd.ExecuteNonQuery();
    }

    private static T Scalar<T>(long tenant, string sql)
    {
        using var c = TenantNpgsql.Create(Conn, tenant); c.Open();
        using var cmd = new NpgsqlCommand(sql, c);
        var v = cmd.ExecuteScalar();
        return v is null or DBNull ? default! : (T)v;
    }

    private static IConfiguration Cfg(int? days = null)
    {
        var d = new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = Conn };
        if (days is int n) d["Platform:Billing:GraceDays"] = n.ToString();
        return new ConfigurationBuilder().AddInMemoryCollection(d).Build();
    }

    private static (TenantGrace Grace, Entitlements Ent) Make(int? days = null)
    {
        var cfg = Cfg(days);
        var ent = new Entitlements(cfg, NullLogger<Entitlements>.Instance);
        return (new TenantGrace(cfg, ent, NullLogger<TenantGrace>.Instance), ent);
    }

    public TenantGraceTests()
    {
        if (!Available) return;
        Dispose();
        Exec(1, "INSERT INTO plans (key, name) VALUES ('zz-grace','zz')");
    }

    public void Dispose()
    {
        if (!Available) return;
        foreach (var t in new[] { A, B }) Exec(t, "DELETE FROM tenant_subscriptions");
        Exec(1, "DELETE FROM plans WHERE key = 'zz-grace'");
    }

    private static void Sub(long tenant, string plan, string status, string? endsAt)
        => Exec(tenant, $"INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, ends_at) SELECT {tenant}, id, '{status}', {(endsAt ?? "NULL")} FROM plans WHERE key='{plan}'");

    [Fact(DisplayName = "Un plan de pago vencido entra en gracia de 5 dias y sigue operativo")]
    public async Task Vencido_entra_en_gracia()
    {
        if (!Available) return;
        Sub(A, "zz-grace", "active", "now() - interval '1 hour'");
        var (grace, ent) = Make();
        var moved = await grace.SweepAsync();
        Assert.Contains(A, moved);
        Assert.Equal("past_due", Scalar<string>(A, "SELECT status FROM tenant_subscriptions"));
        var days = (double)Scalar<decimal>(A, "SELECT extract(epoch FROM (grace_until - ends_at))/86400 FROM tenant_subscriptions");
        Assert.Equal(5d, days, 3);
        Assert.True(await ent.IsOperationalAsync(A, live: true));
    }

    [Fact(DisplayName = "Una segunda pasada no cambia nada")]
    public async Task Es_idempotente()
    {
        if (!Available) return;
        Sub(A, "zz-grace", "active", "now() - interval '1 hour'");
        var (grace, _) = Make();
        await grace.SweepAsync();
        var first = Scalar<DateTime>(A, "SELECT grace_until FROM tenant_subscriptions");
        var moved = await grace.SweepAsync();
        Assert.DoesNotContain(A, moved);
        Assert.Equal(first, Scalar<DateTime>(A, "SELECT grace_until FROM tenant_subscriptions"));
    }

    [Fact(DisplayName = "Pasada la gracia el tenant deja de ser operativo")]
    public async Task Gracia_vencida_pausa()
    {
        if (!Available) return;
        Sub(A, "zz-grace", "active", "now() - interval '6 days'");
        var (grace, ent) = Make();
        await grace.SweepAsync();                       // grace_until = ends_at + 5 d = hace 1 dia
        Assert.False(await ent.IsOperationalAsync(A, live: true));
    }

    [Fact(DisplayName = "Sin ends_at (pilotos) y planes aun vigentes no se tocan")]
    public async Task No_toca_lo_que_no_vence()
    {
        if (!Available) return;
        Sub(A, "zz-grace", "active", null);
        Sub(B, "zz-grace", "active", "now() + interval '1 day'");
        var (grace, _) = Make();
        var moved = await grace.SweepAsync();
        Assert.DoesNotContain(A, moved);
        Assert.Equal("active", Scalar<string>(A, "SELECT status FROM tenant_subscriptions"));
        Assert.DoesNotContain(B, moved);
        Assert.Equal("active", Scalar<string>(B, "SELECT status FROM tenant_subscriptions"));
    }

    [Fact(DisplayName = "Los dias de gracia salen de Platform:Billing:GraceDays")]
    public async Task Dias_configurables()
    {
        if (!Available) return;
        Sub(B, "zz-grace", "active", "now() - interval '1 hour'");
        var (grace, _) = Make(days: 2);
        await grace.SweepAsync();
        Assert.Equal(2d, (double)Scalar<decimal>(B, "SELECT extract(epoch FROM (grace_until - ends_at))/86400 FROM tenant_subscriptions"), 3);
    }
}
