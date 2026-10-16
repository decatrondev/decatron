using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 5.7: la pantalla del dueño escribe plan, ajustes y complementos como filas y el servicio de entitlements los ve al instante. Corre sobre decatron_schema (tenant 9101).</summary>
[Collection("entitlements-db")]
public class TenantPlanAdminTests : IDisposable
{
    private static string? Conn => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
    private static bool Available => !string.IsNullOrWhiteSpace(Conn);
    private const long A = 9101;

    private readonly IConfiguration _cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = Conn }).Build();

    private static void Exec(long tenant, string sql)
    {
        using var c = TenantNpgsql.Create(Conn, tenant); c.Open();
        using var cmd = new NpgsqlCommand(sql, c); cmd.ExecuteNonQuery();
    }

    public TenantPlanAdminTests()
    {
        if (!Available) return;
        Dispose();
        Exec(1, @"INSERT INTO capabilities (key, kind, group_key, default_value, meter) VALUES ('zz.flag','flag','zz',0,'none'), ('zz.cuota','quota','zz',1,'gauge');
                  INSERT INTO plans (key, name, is_internal) VALUES ('zz-plan','zz',false), ('zz-interno','zz i',true);
                  INSERT INTO plan_entitlements (plan_id, capability_key, value) SELECT id,'zz.flag',1 FROM plans WHERE key='zz-plan';");
    }

    public void Dispose()
    {
        if (!Available) return;
        Exec(A, "DELETE FROM tenant_entitlement_overrides; DELETE FROM tenant_addons; DELETE FROM tenant_subscriptions");
        Exec(1, "DELETE FROM plans WHERE key LIKE 'zz-%'; DELETE FROM capabilities WHERE key LIKE 'zz.%'");
    }

    private sealed class Svc(TenantPlanAdmin s)
    {
        public Task<PlanResult> SetPlan(long id, PlanInput b) => s.SetPlanAsync(id, b, "test");
        public Task<PlanResult> SetOverride(long id, string k, ValueInput b) => s.SetOverrideAsync(id, k, b, "test");
        public Task<PlanResult> DeleteOverride(long id, string k) => s.DeleteOverrideAsync(id, k, "test");
        public Task<PlanResult> AddAddon(long id, AddonInput b) => s.AddAddonAsync(id, b, "test");
        public Task<PlanResult> Get(long id) => s.GetAsync(id);
    }

    private (Svc c, Entitlements e) Make()
    {
        var e = new Entitlements(_cfg, NullLogger<Entitlements>.Instance);
        return (new Svc(new TenantPlanAdmin(_cfg, e, NullLogger<TenantPlanAdmin>.Instance)), e);
    }

    private static int Status(PlanResult r) => r.Status;

    [Fact(DisplayName = "Asignar plan crea la suscripción, el servicio lo ve al instante, y suspender corta todo")]
    public async Task AsignarYSuspender()
    {
        if (!Available) return;
        var (c, e) = Make();
        Assert.False(await e.IsOperationalAsync(A));                                                    // sin suscripción: no opera
        Assert.Equal(200, Status(await c.SetPlan(A, new() { PlanKey = "zz-plan", Status = "active", PeriodMonths = 3 })));
        Assert.True(await e.HasAsync("zz.flag", A));                                                    // la caché se invalidó
        Assert.Equal(200, Status(await c.SetPlan(A, new() { PlanKey = "zz-plan", Status = "suspended", SuspendedReason = "prueba" })));
        Assert.False(await e.HasAsync("zz.flag", A));
        Assert.Equal(200, Status(await c.SetPlan(A, new() { PlanKey = "zz-plan", Status = "sandbox" })));
        Assert.True(await e.IsOperationalAsync(A));                                                     // sandbox: 7 días por defecto
        using var conn = TenantNpgsql.Create(Conn, A); conn.Open();
        using var q = new NpgsqlCommand("select count(*) from tenant_subscriptions where status <> 'cancelled'", conn);
        Assert.Equal(1L, q.ExecuteScalar());                                                            // se actualiza, no se duplica
    }

    [Fact(DisplayName = "Validaciones: tenant 1, plan interno, plan inexistente, estado y periodo no válidos")]
    public async Task Validaciones()
    {
        if (!Available) return;
        var (c, _) = Make();
        Assert.Equal(400, Status(await c.SetPlan(1, new() { PlanKey = "zz-plan" })));
        Assert.Equal(400, Status(await c.SetPlan(A, new() { PlanKey = "zz-interno" })));
        Assert.Equal(404, Status(await c.SetPlan(A, new() { PlanKey = "no-existe" })));
        Assert.Equal(400, Status(await c.SetPlan(A, new() { PlanKey = "zz-plan", Status = "raro" })));
        Assert.Equal(400, Status(await c.SetPlan(A, new() { PlanKey = "zz-plan", PeriodMonths = 5 })));
        Assert.Equal(404, Status(await c.SetPlan(777777, new() { PlanKey = "zz-plan" })));
    }

    [Fact(DisplayName = "Ajustes y complementos: ganan sobre el plan, se pueden quitar, y una capacidad inexistente se rechaza")]
    public async Task AjustesYComplementos()
    {
        if (!Available) return;
        var (c, e) = Make();
        await c.SetPlan(A, new() { PlanKey = "zz-plan", Status = "active" });
        Assert.Equal((true, 1m), await e.LimitAsync("zz.cuota", A));

        Assert.Equal(200, Status(await c.AddAddon(A, new() { CapabilityKey = "zz.cuota", Value = 5 })));
        Assert.Equal(5m, (await e.LimitAsync("zz.cuota", A)).Limit);                                   // complemento > plan
        Assert.Equal(200, Status(await c.SetOverride(A, "zz.cuota", new() { Value = 9, Reason = "regalo" })));
        Assert.Equal(9m, (await e.LimitAsync("zz.cuota", A)).Limit);                                   // ajuste > complemento
        Assert.Equal(200, Status(await c.SetOverride(A, "zz.cuota", new() { Value = null })));
        Assert.Null((await e.LimitAsync("zz.cuota", A)).Limit);                                        // vacío = ilimitado

        var det = await c.Get(A);
        Assert.True(det.Ok);
        var json = System.Text.Json.JsonSerializer.Serialize(det.Data);
        Assert.Contains("zz.cuota", json);

        Assert.Equal(200, Status(await c.DeleteOverride(A, "zz.cuota")));
        Assert.Equal(404, Status(await c.DeleteOverride(A, "zz.cuota")));
        Assert.Equal(404, Status(await c.AddAddon(A, new() { CapabilityKey = "zz.nope" })));
        Assert.Equal(400, Status(await c.AddAddon(A, new() { CapabilityKey = "zz.cuota", Source = "otro" })));
    }
}
