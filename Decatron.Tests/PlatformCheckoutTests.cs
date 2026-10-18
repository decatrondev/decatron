using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 7.5: presupuesto, pago pendiente y confirmación idempotente que aplica plan y complementos. Corre sobre decatron_schema (tenants 9101/9102);
/// necesita DECATRON_APP_CONN y DECATRON_SCHEMA_CONN (el libro de pagos no se puede borrar con el rol de la app).</summary>
[Collection("entitlements-db")]
public class PlatformCheckoutTests : IDisposable
{
    private static string? App => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
    private static string? Owner => Environment.GetEnvironmentVariable("DECATRON_SCHEMA_CONN");
    private static bool Available => !string.IsNullOrWhiteSpace(App) && !string.IsNullOrWhiteSpace(Owner);
    private const long A = 9101, B = 9102;
    private static readonly string[] Keys = { "semilla", "creator", "pro", "studio" };

    private static void Exec(string conn, long? tenant, string sql)
    {
        using var c = tenant is long t ? TenantNpgsql.Create(conn, t) : new NpgsqlConnection(conn);
        c.Open();
        using var cmd = new NpgsqlCommand(sql, c); cmd.ExecuteNonQuery();
    }

    private static T Scalar<T>(long tenant, string sql)
    {
        using var c = TenantNpgsql.Create(App, tenant); c.Open();
        var v = new NpgsqlCommand(sql, c).ExecuteScalar();
        return v is null or DBNull ? default! : (T)v;
    }

    private static PlatformCheckout Make()
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = App }).Build();
        return new PlatformCheckout(cfg, new Entitlements(cfg, NullLogger<Entitlements>.Instance), NullLogger<PlatformCheckout>.Instance);
    }

    public PlatformCheckoutTests()
    {
        if (!Available) return;
        Dispose();
        Exec(App!, 1, @"
            INSERT INTO capabilities (key, kind, group_key, default_value, meter, period) VALUES
              ('zz.mod_a','flag','zz',0,'none',NULL), ('zz.mod_b','flag','zz',0,'none',NULL), ('zz.mod_big','flag','zz',0,'none',NULL);
            INSERT INTO plans (key, name) VALUES ('semilla','Semilla'), ('creator','Creator'), ('pro','Pro'), ('studio','Studio'), ('exclusivo','Exclusivo');
            INSERT INTO plan_prices (plan_id, period_months, price_usd) SELECT id, 1, CASE key WHEN 'semilla' THEN 9 WHEN 'creator' THEN 19 WHEN 'pro' THEN 39 ELSE 79 END FROM plans WHERE key IN ('semilla','creator','pro','studio');
            INSERT INTO plan_prices (plan_id, period_months, price_usd) SELECT id, 3, CASE key WHEN 'semilla' THEN 25.65 WHEN 'creator' THEN 54.15 WHEN 'pro' THEN 111.15 ELSE 225.15 END FROM plans WHERE key IN ('semilla','creator','pro','studio');
            INSERT INTO plan_entitlements (plan_id, capability_key, value) SELECT id, 'zz.mod_a', 1 FROM plans WHERE key='semilla';
            INSERT INTO addon_prices (capability_key, period_months, price_usd) VALUES ('zz.mod_a',1,2), ('zz.mod_b',1,3), ('zz.mod_b',3,8.55), ('zz.mod_big',1,20);");
    }

    public void Dispose()
    {
        if (!Available) return;
        Exec(Owner!, null, "DELETE FROM tenant_payments WHERE tenant_id IN (9101, 9102)");
        foreach (var t in new[] { A, B }) Exec(App!, t, "DELETE FROM tenant_addons; DELETE FROM tenant_subscriptions");
        Exec(App!, 1, @"DELETE FROM addon_prices WHERE capability_key LIKE 'zz.%'; DELETE FROM plan_prices WHERE plan_id IN (SELECT id FROM plans WHERE key IN ('semilla','creator','pro','studio','exclusivo'));
            DELETE FROM plan_entitlements WHERE capability_key LIKE 'zz.%'; DELETE FROM plans WHERE key IN ('semilla','creator','pro','studio','exclusivo'); DELETE FROM capabilities WHERE key LIKE 'zz.%'");
    }

    private static void Sub(long tenant, string plan, string status, string? endsAt)
        => Exec(App!, tenant, $"INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, ends_at, sandbox_ends_at) SELECT {tenant}, id, '{status}', {endsAt ?? "NULL"}, {(status == "sandbox" ? "now() + interval '3 days'" : "NULL")} FROM plans WHERE key='{plan}'");

    private static PlatformCheckout.Request Req(string plan = "semilla", int months = 1, string country = "PE", params string[] addons) => new(plan, months, addons, country);

    [Fact(DisplayName = "Alta desde sandbox: total = plan + complementos, IGV de Peru")]
    public async Task Alta_desde_sandbox()
    {
        if (!Available) return;
        Sub(A, "semilla", "sandbox", null);
        var r = await Make().QuoteAsync(A, Req(addons: "zz.mod_b"));
        Assert.True(r.Ok, r.Error);
        Assert.Equal("new", r.Value!.Kind);
        Assert.Equal(12m, r.Value.Quote.TotalUsd);            // 9 + 3 < 19 (creator)
        Assert.False(r.Value.Quote.Capped);
        Assert.Equal("igv", r.Value.TaxTreatment);
        Assert.Equal(10.17m, r.Value.Tax.Base);
        Assert.Equal(1.83m, r.Value.Tax.Igv);
    }

    [Fact(DisplayName = "Fuera de Peru es exportacion: mismo precio, sin IGV")]
    public async Task Exportacion()
    {
        if (!Available) return;
        Sub(A, "semilla", "sandbox", null);
        var r = await Make().QuoteAsync(A, Req(country: "US"));
        Assert.Equal("export", r.Value!.TaxTreatment);
        Assert.Equal(9m, r.Value.Tax.Base);
        Assert.Equal(0m, r.Value.Tax.Igv);
    }

    [Fact(DisplayName = "Los complementos se recortan en el precio del siguiente plan")]
    public async Task Tope_siguiente_plan()
    {
        if (!Available) return;
        Sub(A, "semilla", "sandbox", null);
        var r = await Make().QuoteAsync(A, Req(addons: "zz.mod_big"));   // 9 + 20 = 29 > 19
        Assert.Equal(19m, r.Value!.Quote.TotalUsd);
        Assert.True(r.Value.Quote.Capped);
    }

    [Theory(DisplayName = "Peticiones invalidas dan su codigo")]
    [InlineData("semilla", 2, "PE", "invalid_period")]
    [InlineData("semilla", 1, "", "country_required")]
    [InlineData("exclusivo", 1, "PE", "plan_not_for_sale")]
    [InlineData("internal", 1, "PE", "plan_not_for_sale")]
    [InlineData("pro", 6, "PE", "plan_not_for_sale")]          // sin precio sembrado para 6 meses
    public async Task Invalidas(string plan, int months, string country, string code)
    {
        if (!Available) return;
        Sub(A, "semilla", "sandbox", null);
        Assert.Equal(code, (await Make().QuoteAsync(A, Req(plan, months, country))).Error);
    }

    [Fact(DisplayName = "Un complemento ya incluido o sin precio se rechaza")]
    public async Task Complementos_invalidos()
    {
        if (!Available) return;
        Sub(A, "semilla", "sandbox", null);
        Assert.Equal("addon_included", (await Make().QuoteAsync(A, Req(addons: "zz.mod_a"))).Error);       // semilla ya lo trae
        Assert.Equal("addon_unavailable", (await Make().QuoteAsync(A, Req(addons: "zz.no_existe"))).Error);
    }

    [Fact(DisplayName = "Confirmar aplica plan y complementos una sola vez y co-termina")]
    public async Task Confirmar_es_idempotente()
    {
        if (!Available) return;
        Sub(A, "semilla", "sandbox", null);
        var svc = Make();
        var o = (await svc.QuoteAsync(A, Req("creator", 3, "PE", "zz.mod_b"))).Value!;
        var id = await svc.CreatePendingAsync(A, o, "culqi", 3.8m, isTest: true);
        Assert.Equal("pending", Scalar<string>(A, $"SELECT status FROM tenant_payments WHERE id={id}"));

        Assert.True(await svc.ConfirmAsync(A, id, "chr_test_unico", true));
        Assert.False(await svc.ConfirmAsync(A, id, "chr_test_unico", true));        // segunda vez: no hace nada

        Assert.Equal("active", Scalar<string>(A, "SELECT status FROM tenant_subscriptions"));
        Assert.Equal("creator", Scalar<string>(A, "SELECT p.key FROM tenant_subscriptions s JOIN plans p ON p.id=s.plan_id"));
        Assert.Equal(3, (int)Scalar<short>(A, "SELECT period_months FROM tenant_subscriptions"));
        Assert.Equal("igv_18", Scalar<string>(A, "SELECT tax_treatment FROM tenant_subscriptions"));
        Assert.Equal(1L, Scalar<long>(A, "SELECT count(*) FROM tenant_addons WHERE capability_key='zz.mod_b'"));
        Assert.True(Scalar<bool>(A, "SELECT (SELECT ends_at FROM tenant_subscriptions) = (SELECT ends_at FROM tenant_addons WHERE capability_key='zz.mod_b')"));
        Assert.Equal("paid", Scalar<string>(A, $"SELECT status FROM tenant_payments WHERE id={id}"));
        Assert.True(Scalar<bool>(A, $"SELECT is_test FROM tenant_payments WHERE id={id}"));
        Assert.True(Scalar<bool>(A, "SELECT abs(extract(epoch FROM (ends_at - (now() + interval '3 months')))) < 3600 FROM tenant_subscriptions"));   // la fecha escrita por la app es la real, sin desfase
        Assert.Null(Scalar<string>(A, $"SELECT invoice_status FROM tenant_payments WHERE id={id}"));                                         // pago de prueba: nunca se factura
        Assert.Equal(62.70m, Scalar<decimal>(A, $"SELECT amount_usd FROM tenant_payments WHERE id={id}"));   // 54,15 + 8,55, bajo el tope de Pro (111,15)
    }

    [Fact(DisplayName = "Renovar: solo el mismo plan y dentro de los 7 dias; arranca donde termina el actual")]
    public async Task Renovacion()
    {
        if (!Available) return;
        Sub(A, "creator", "active", "now() + interval '3 days'");
        var svc = Make();
        var ok = await svc.QuoteAsync(A, Req("creator", 1));
        Assert.Equal("renew", ok.Value!.Kind);
        Assert.True((ok.Value.StartsAt - DateTime.UtcNow).TotalDays is > 2.5 and < 3.5);
        Assert.Equal(ok.Value.StartsAt.AddMonths(1), ok.Value.EndsAt);
        Assert.Equal("change_not_available", (await svc.QuoteAsync(A, Req("pro", 1))).Error);

        Exec(App!, A, "UPDATE tenant_subscriptions SET ends_at = now() + interval '20 days'");
        Assert.Equal("renew_window", (await svc.QuoteAsync(A, Req("creator", 1))).Error);
    }

    [Fact(DisplayName = "Vencido, en gracia o sin fecha (piloto): es un alta nueva desde hoy")]
    public async Task Vencido_es_alta()
    {
        if (!Available) return;
        var svc = Make();
        Sub(A, "creator", "past_due", "now() - interval '1 day'");
        Assert.Equal("new", (await svc.QuoteAsync(A, Req("pro", 1))).Value!.Kind);                // en gracia puede elegir otro plan
        Exec(App!, A, "UPDATE tenant_subscriptions SET status='active', ends_at=NULL");
        Assert.Equal("new", (await svc.QuoteAsync(A, Req("creator", 1))).Value!.Kind);            // piloto sin ends_at
        Exec(App!, A, "UPDATE tenant_subscriptions SET status='suspended'");
        Assert.Equal("suspended", (await svc.QuoteAsync(A, Req("creator", 1))).Error);
    }

    [Fact(DisplayName = "Un pago real confirmado nace PENDING de comprobante y el admin lo ve entre tenants")]
    public async Task Pago_real_queda_pendiente_de_comprobante()
    {
        if (!Available) return;
        Sub(A, "semilla", "sandbox", null);
        var svc = Make();
        var o = (await svc.QuoteAsync(A, Req())).Value!;
        var id = await svc.CreatePendingAsync(A, o, "culqi", 3.8m, isTest: false, new PlatformCheckout.Customer("Cliente S.A.", "RUC", "20123456789", "c@example.test", true));
        await svc.ConfirmAsync(A, id, "chr_live_x", isTest: false);
        Assert.Equal("PENDING", Scalar<string>(A, $"SELECT invoice_status FROM tenant_payments WHERE id={id}"));
        Assert.Equal("Cliente S.A.", Scalar<string>(A, $"SELECT customer_name FROM tenant_payments WHERE id={id}"));
        // El P&L del dueño (corre como tenant 1) ve el pago de otro tenant solo por la función; la tabla directa no.
        Assert.Equal(0L, Scalar<long>(1, "SELECT count(*) FROM tenant_payments"));
        Assert.Equal(1L, Scalar<long>(1, "SELECT count(*) FROM platform_payments_all(now() - interval '1 day', now() + interval '1 day') WHERE tenant_id = 9101"));
    }

    [Fact(DisplayName = "Un pago de un tenant no se ve en otro")]
    public async Task Aislamiento()
    {
        if (!Available) return;
        Sub(A, "semilla", "sandbox", null);
        var svc = Make();
        var o = (await svc.QuoteAsync(A, Req())).Value!;
        await svc.CreatePendingAsync(A, o, "culqi", 3.8m, true);
        Assert.Equal(1L, Scalar<long>(A, "SELECT count(*) FROM tenant_payments"));
        Assert.Equal(0L, Scalar<long>(B, "SELECT count(*) FROM tenant_payments"));
    }
}
