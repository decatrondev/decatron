using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 5.3: resolución de capacidades, estados de suscripción, contadores atómicos y modos de falla. Corre sobre decatron_schema (tenants 9101/9102) con el rol decatron_app.</summary>
[Collection("entitlements-db")]
public class EntitlementsTests : IDisposable
{
    private static string? Conn => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
    private static bool Available => !string.IsNullOrWhiteSpace(Conn);
    private const long A = 9101, B = 9102;

    private static NpgsqlConnection Open(long tenant)
    {
        var c = TenantNpgsql.Create(Conn, tenant);
        c.Open();
        return c;
    }

    private static void Exec(long tenant, string sql)
    {
        using var c = Open(tenant);
        using var cmd = new NpgsqlCommand(sql, c);
        cmd.ExecuteNonQuery();
    }

    private static Entitlements Make(string? conn = null)
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = conn ?? Conn }).Build();
        return new Entitlements(cfg, NullLogger<Entitlements>.Instance);
    }

    public EntitlementsTests()
    {
        if (!Available) return;
        Dispose();
        Exec(1, @"
            INSERT INTO capabilities (key, kind, group_key, default_value, meter, period) VALUES
              ('zz.flag','flag','zz',0,'none',NULL), ('zz.flag2','flag','zz',0,'none',NULL),
              ('zz.cuota','quota','zz',NULL,'counter','month'), ('zz.canales','quota','zz',1,'gauge',NULL);
            INSERT INTO plans (key, name) VALUES ('zz-plan','zz');
            INSERT INTO plan_entitlements (plan_id, capability_key, value) SELECT id,'zz.flag',1 FROM plans WHERE key='zz-plan';
            INSERT INTO plan_entitlements (plan_id, capability_key, value) SELECT id,'zz.cuota',3 FROM plans WHERE key='zz-plan';
            INSERT INTO plan_entitlements (plan_id, capability_key, value) SELECT id,'zz.canales',2 FROM plans WHERE key='zz-plan';");
        Exec(A, "INSERT INTO tenant_subscriptions (tenant_id, plan_id, status) SELECT 9101, id, 'active' FROM plans WHERE key='zz-plan'");
        Exec(B, "INSERT INTO tenant_subscriptions (tenant_id, plan_id, status) SELECT 9102, id, 'active' FROM plans WHERE key='zz-plan'");
    }

    public void Dispose()
    {
        if (!Available) return;
        foreach (var t in new[] { A, B })
            Exec(t, "DELETE FROM usage_counters; DELETE FROM tenant_entitlement_overrides; DELETE FROM tenant_addons; DELETE FROM tenant_subscriptions");
        Exec(1, "DELETE FROM plans WHERE key='zz-plan'; DELETE FROM capabilities WHERE key LIKE 'zz.%'");
    }

    [Fact(DisplayName = "El tenant 1 siempre pasa y no toca la base")]
    public async Task Tenant1_SiemprePasa()
    {
        var e = Make("Host=127.0.0.1;Port=1;Database=x;Username=x;Password=x;Timeout=1");
        Assert.True(await e.HasAsync("zz.flag", 1));
        Assert.True((await e.TryConsumeAsync("zz.cuota", 999, 1)).IsAllowed);
        Assert.Null((await e.LimitAsync("zz.cuota", 1)).Limit);
    }

    [Fact(DisplayName = "Plan activo: la bandera y el tope salen del plan; lo no incluido queda en su valor por defecto")]
    public async Task Plan_Resuelve()
    {
        if (!Available) return;
        var e = Make();
        Assert.True(await e.HasAsync("zz.flag", A));
        Assert.False(await e.HasAsync("zz.flag2", A));
        Assert.Equal(3m, (await e.LimitAsync("zz.cuota", A)).Limit);
    }

    [Fact(DisplayName = "Complemento vigente > plan; override vigente > complemento; override vencido se ignora")]
    public async Task Precedencia()
    {
        if (!Available) return;
        Exec(A, "INSERT INTO tenant_addons (tenant_id, capability_key, value, source) VALUES (9101,'zz.flag2',1,'purchase'), (9101,'zz.cuota',10,'purchase')");
        Exec(A, "INSERT INTO tenant_entitlement_overrides (tenant_id, capability_key, value, expires_at) VALUES (9101,'zz.cuota',50,NULL), (9101,'zz.flag',0, now() - interval '1 day')");
        var e = Make();
        Assert.True(await e.HasAsync("zz.flag2", A));                     // complemento
        Assert.Equal(50m, (await e.LimitAsync("zz.cuota", A)).Limit);     // override gana al complemento (10) y al plan (3)
        Assert.True(await e.HasAsync("zz.flag", A));                      // override vencido: manda el plan
    }

    [Fact(DisplayName = "Suspendido, cancelado, sandbox vencido o sin suscripción: nada se permite")]
    public async Task Estados_NoOperativos()
    {
        if (!Available) return;
        Exec(B, "UPDATE tenant_subscriptions SET status='suspended'");
        var e = Make();
        Assert.False(await e.IsOperationalAsync(B));
        Assert.False(await e.HasAsync("zz.flag", B));
        Assert.Equal(EntitlementOutcome.Blocked, (await e.TryConsumeAsync("zz.cuota", 1, B)).Outcome);

        Exec(B, "UPDATE tenant_subscriptions SET status='sandbox', sandbox_ends_at = now() - interval '1 hour'");
        e.Invalidate(B);
        Assert.False(await e.IsOperationalAsync(B));
        Exec(B, "UPDATE tenant_subscriptions SET sandbox_ends_at = now() + interval '1 day'");
        e.Invalidate(B);
        Assert.True(await e.IsOperationalAsync(B));
        Exec(B, "DELETE FROM tenant_subscriptions");
        e.Invalidate(B);
        Assert.False(await e.IsOperationalAsync(B));
    }

    /// <summary>Último id de evento del tenant. Se filtra por id y no por hora: comparar un DateTime con timestamptz arrastra el desfase horario legacy de Npgsql (5 h) y mezcla eventos de otras pruebas.</summary>
    private static long LastEventId(long tenant)
    {
        using var c = Open(tenant);
        using var q = new NpgsqlCommand("SELECT coalesce(max(id), 0) FROM entitlement_events", c);
        return Convert.ToInt64(q.ExecuteScalar());
    }

    [Fact(DisplayName = "Contador: aviso al 80 %, bloqueo al pasar el tope, y cada tenant cuenta aparte")]
    public async Task Contador()
    {
        if (!Available) return;
        var e = Make();
        var after = LastEventId(A);
        Assert.Equal(EntitlementOutcome.Allowed, (await e.TryConsumeAsync("zz.cuota", 1, A)).Outcome);        // 1/3
        Assert.Equal(EntitlementOutcome.Allowed, (await e.TryConsumeAsync("zz.cuota", 1, A)).Outcome);        // 2/3 (66 %)
        Assert.Equal(EntitlementOutcome.AllowedWarn80, (await e.TryConsumeAsync("zz.cuota", 1, A)).Outcome);  // 3/3 cruza el 80 %
        var r = await e.TryConsumeAsync("zz.cuota", 1, A);
        Assert.Equal(EntitlementOutcome.Blocked, r.Outcome);
        Assert.Equal("limit_reached", r.Reason);
        Assert.Equal(EntitlementOutcome.Allowed, (await e.TryConsumeAsync("zz.cuota", 1, B)).Outcome);        // B no se entera de A
        Assert.False((await e.TryConsumeAsync("zz.cuota", 4, B)).IsAllowed);                                 // más que el tope de una vez
        // entitlement_events es solo-inserción para el rol de la app: se mira lo que dejó ESTA prueba (ids posteriores a los que ya había)
        using var c = Open(A);
        using var q = new NpgsqlCommand("SELECT kind FROM entitlement_events WHERE capability_key='zz.cuota' AND id > @after ORDER BY id", c);
        q.Parameters.AddWithValue("after", after);
        using var rd = q.ExecuteReader();
        var kinds = new List<string>(); while (rd.Read()) kinds.Add(rd.GetString(0));
        Assert.Equal(new[] { "warn80", "blocked" }, kinds);
    }

    [Fact(DisplayName = "Contador atómico: consumos simultáneos nunca pasan el tope")]
    public async Task Contador_Concurrente()
    {
        if (!Available) return;
        var e = Make();
        var res = await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => e.TryConsumeAsync("zz.cuota", 1, A)));
        Assert.Equal(3, res.Count(x => x.IsAllowed));
    }

    [Fact(DisplayName = "Medidor de cuántos hay: permite hasta el tope y bloquea el exceso")]
    public async Task Gauge()
    {
        if (!Available) return;
        var e = Make();
        Assert.True((await e.CheckGaugeAsync("zz.canales", current: 1, tenantId: A)).IsAllowed);   // 2 de 2
        Assert.False((await e.CheckGaugeAsync("zz.canales", current: 2, tenantId: A)).IsAllowed);  // 3 de 2
    }

    [Fact(DisplayName = "Base caída: lo nuevo se niega (cerrado) y lo en vivo se permite (abierto)")]
    public async Task Falla_Cerrado_y_Abierto()
    {
        var e = Make("Host=127.0.0.1;Port=1;Database=x;Username=x;Password=x;Timeout=1");
        Assert.False(await e.HasAsync("zz.flag", 777));
        Assert.True(await e.HasAsync("zz.flag", 777, live: true));
        Assert.False((await e.TryConsumeAsync("zz.cuota", 1, 777)).IsAllowed);
        Assert.True((await e.TryConsumeAsync("zz.cuota", 1, 777, live: true)).IsAllowed);
    }

    [Fact(DisplayName = "Caché: tras un fallo de la base se usa el último valor conocido")]
    public async Task Cache_SeConserva()
    {
        if (!Available) return;
        var e = Make();
        Assert.True(await e.HasAsync("zz.flag", A));
        Exec(A, "UPDATE tenant_subscriptions SET status='suspended'");
        Assert.True(await e.HasAsync("zz.flag", A));    // aún cacheado (30 s)
        e.Invalidate(A);
        Assert.False(await e.HasAsync("zz.flag", A));   // refrescado
    }

    [Fact(DisplayName = "Count acumula en memoria, Flush escribe el lote, cruzar el 80 % y el tope deja eventos, y el #1 no cuenta")]
    public async Task Count_Lotes()
    {
        if (!Available) return;
        var e = Make();
        var after = LastEventId(A);
        e.Count("zz.cuota", 2, A);            // límite del plan = 3
        e.Count("zz.cuota", 1, A);
        e.Count("zz.cuota", 5, 1);            // el #1 no cuenta
        using (var c = Open(A)) { using var q = new NpgsqlCommand("select coalesce(sum(used),0) from usage_counters where capability_key='zz.cuota'", c); Assert.Equal(0m, q.ExecuteScalar()); }  // aún en memoria
        await e.FlushAsync();
        using (var c = Open(A)) { using var q = new NpgsqlCommand("select sum(used) from usage_counters where capability_key='zz.cuota'", c); Assert.Equal(3m, q.ExecuteScalar()); }
        e.Count("zz.cuota", 1, A);            // 4 > 3: pasa el tope, igual se mide (no corta)
        await e.FlushAsync();
        using (var c = Open(A))
        {
            using var q = new NpgsqlCommand("select sum(used) from usage_counters where capability_key='zz.cuota'", c); Assert.Equal(4m, q.ExecuteScalar());
            using var ev = new NpgsqlCommand("select string_agg(kind, ',' order by id) from entitlement_events where capability_key='zz.cuota' and id > @after", c);
            ev.Parameters.AddWithValue("after", after);
            Assert.Equal("warn80,blocked", ev.ExecuteScalar());
        }
    }
}
