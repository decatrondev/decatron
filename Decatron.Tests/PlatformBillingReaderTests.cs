using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 7.7: lecturas del panel de facturación y catálogo público. Corre sobre decatron_schema (tenants 9101/9102); necesita DECATRON_APP_CONN y DECATRON_SCHEMA_CONN.</summary>
[Collection("entitlements-db")]
public class PlatformBillingReaderTests : IDisposable
{
    private static string? App => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
    private static string? Owner => Environment.GetEnvironmentVariable("DECATRON_SCHEMA_CONN");
    private static bool Available => !string.IsNullOrWhiteSpace(App) && !string.IsNullOrWhiteSpace(Owner);
    private const long A = 9101, B = 9102;

    private static void Exec(string conn, long? tenant, string sql)
    {
        using var c = tenant is long t ? TenantNpgsql.Create(conn, t) : new NpgsqlConnection(conn);
        c.Open();
        using var cmd = new NpgsqlCommand(sql, c); cmd.ExecuteNonQuery();
    }

    private static PlatformBillingReader Make()
        => new(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = App }).Build());

    public PlatformBillingReaderTests()
    {
        if (!Available) return;
        Dispose();
        Exec(App!, 1, @"
            INSERT INTO capabilities (key, kind, group_key, default_value, meter, period) VALUES
              ('module.zz_a','flag','zz',0,'none',NULL), ('module.zz_b','flag','zz',0,'none',NULL);
            INSERT INTO plans (key, name, sort, is_public) VALUES ('semilla','Semilla',1,true), ('creator','Creator',2,true), ('pro','Pro',3,true), ('studio','Studio',4,true), ('exclusivo','Exclusivo',5,true);
            INSERT INTO plan_prices (plan_id, period_months, price_usd) SELECT id, 1, CASE key WHEN 'semilla' THEN 9 WHEN 'creator' THEN 19 WHEN 'pro' THEN 39 ELSE 79 END FROM plans WHERE key IN ('semilla','creator','pro','studio');
            INSERT INTO plan_prices (plan_id, period_months, price_usd) SELECT id, 3, 25.65 FROM plans WHERE key='semilla';
            INSERT INTO plan_entitlements (plan_id, capability_key, value) SELECT id, 'module.zz_a', 1 FROM plans WHERE key IN ('creator','pro');
            INSERT INTO addon_prices (capability_key, period_months, price_usd) VALUES ('module.zz_a',1,4), ('module.zz_b',1,3), ('module.zz_b',3,8.55);");
    }

    public void Dispose()
    {
        if (!Available) return;
        Exec(Owner!, null, "DELETE FROM tenant_payments WHERE tenant_id IN (9101, 9102)");
        foreach (var t in new[] { A, B }) Exec(App!, t, "DELETE FROM tenant_addons; DELETE FROM tenant_billing_profile; DELETE FROM tenant_subscriptions");
        Exec(App!, 1, @"DELETE FROM addon_prices WHERE capability_key LIKE 'module.zz_%'; DELETE FROM plan_prices WHERE plan_id IN (SELECT id FROM plans WHERE key IN ('semilla','creator','pro','studio','exclusivo'));
            DELETE FROM plan_entitlements WHERE capability_key LIKE 'module.zz_%'; DELETE FROM plans WHERE key IN ('semilla','creator','pro','studio','exclusivo'); DELETE FROM capabilities WHERE key LIKE 'module.zz_%'");
    }

    private static void Sub(long tenant, string plan, string status, string? endsAt, string? graceUntil = null)
        => Exec(App!, tenant, $"INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, ends_at, grace_until) SELECT {tenant}, id, '{status}', {endsAt ?? "NULL"}, {graceUntil ?? "NULL"} FROM plans WHERE key='{plan}'");

    private static void Pay(long tenant, string status, string createdAt, string extra = "")
        => Exec(Owner!, null, $@"INSERT INTO tenant_payments (tenant_id, purpose, plan_id, period_months, provider, amount_usd, amount_pen, status, created_at, paid_at, period_ends, addons {(extra.Length > 0 ? ", " + extra.Split('|')[0] : "")})
            SELECT {tenant}, 'plan', id, 1, 'culqi', 9, 34.2, '{status}', {createdAt}, {(status == "paid" ? createdAt : "NULL")}, now() + interval '30 days', '{{zz}}' {(extra.Length > 0 ? ", " + extra.Split('|')[1] : "")} FROM plans WHERE key='semilla'");

    [Fact(DisplayName = "Estado: plan, vencimiento y complementos vigentes del tenant")]
    public async Task Estado_basico()
    {
        if (!Available) return;
        Sub(A, "creator", "active", "now() + interval '10 days'");
        Exec(App!, A, "INSERT INTO tenant_addons (tenant_id, capability_key, ends_at, source) VALUES (9101,'module.zz_b', now() + interval '10 days','purchase'), (9101,'module.zz_a', now() - interval '1 day','purchase')");
        var s = await Make().GetStateAsync(A);
        Assert.Equal("creator", s.Subscription!.PlanKey);
        Assert.Equal("active", s.Subscription.Status);
        Assert.Single(s.Addons);                               // el vencido no cuenta
        Assert.Equal("module.zz_b", s.Addons[0].Key);
        Assert.Null(s.Profile);
    }

    [Fact(DisplayName = "Estado: el perfil no expone ids de tarjeta, solo si hay una guardada")]
    public async Task Perfil_sin_ids_de_tarjeta()
    {
        if (!Available) return;
        Sub(A, "semilla", "sandbox", null);
        Exec(App!, A, "INSERT INTO tenant_billing_profile (tenant_id, legal_name, country, doc_type, doc_number, billing_email, culqi_customer_id, culqi_card_id) VALUES (9101,'Ana','PE','DNI','12345678','a@x.pe','cus_1','crd_1')");
        var s = await Make().GetStateAsync(A);
        Assert.Equal("Ana", s.Profile!.LegalName);
        Assert.True(s.Profile.HasSavedCard);
        Assert.Equal("manual", s.Profile.PayMode);
    }

    [Fact(DisplayName = "Historial: solo los pagos del tenant, el reciente primero; pendientes viejos fuera")]
    public async Task Historial()
    {
        if (!Available) return;
        Sub(A, "semilla", "active", "now() + interval '10 days'");
        Pay(A, "paid", "now() - interval '40 days'");
        Pay(A, "paid", "now() - interval '5 days'");
        Pay(A, "failed", "now() - interval '2 days'");
        Pay(A, "pending", "now() - interval '3 hours'");     // abandonado: no se muestra
        Pay(A, "pending", "now() - interval '5 minutes'");   // en proceso: sí
        Pay(B, "paid", "now() - interval '1 day'");           // de otro tenant
        var list = await Make().ListPaymentsAsync(A);
        Assert.Equal(4, list.Count);
        Assert.True(list.SequenceEqual(list.OrderByDescending(p => p.CreatedAt)));
        Assert.DoesNotContain(list, p => p.Status == "pending" && p.CreatedAt < DateTime.UtcNow.AddHours(-1));
        Assert.Empty((await Make().ListPaymentsAsync(9999)));
    }

    [Fact(DisplayName = "Comprobante: serie-numero con ceros y descarga solo de pagos pagados del propio tenant")]
    public async Task Comprobante()
    {
        if (!Available) return;
        Sub(A, "semilla", "active", "now() + interval '10 days'");
        Pay(A, "paid", "now() - interval '1 day'", "invoice_document_id, invoice_type, invoice_series, invoice_number|77, 'boleta', 'B001', 12");
        Pay(A, "failed", "now() - interval '1 day'", "invoice_document_id|88");
        var r = Make();
        var list = await r.ListPaymentsAsync(A);
        var paid = list.Single(p => p.Status == "paid");
        Assert.Equal("B001-00000012", paid.InvoiceNumber);
        Assert.True(paid.CanDownload);
        Assert.Equal(77, await r.InvoiceDocumentIdAsync(A, paid.Id));
        Assert.Null(await r.InvoiceDocumentIdAsync(B, paid.Id));                         // otro tenant: no ve el pago
        Assert.Null(await r.InvoiceDocumentIdAsync(A, list.Single(p => p.Status == "failed").Id));   // fallido: nunca
    }

    [Fact(DisplayName = "Catalogo: planes de pago con precios por periodo, modulos y complementos con su plan de origen")]
    public async Task Catalogo()
    {
        if (!Available) return;
        var cat = await Make().GetCatalogAsync();
        Assert.Equal(new[] { "semilla", "creator", "pro", "studio" }, cat.Plans.Select(p => p.Key));   // sin exclusivo ni internal
        Assert.Equal(9m, cat.Plans[0].Prices[1]);
        Assert.Equal(25.65m, cat.Plans[0].Prices[3]);
        Assert.Contains("module.zz_a", cat.Plans.Single(p => p.Key == "creator").Modules);
        Assert.DoesNotContain("module.zz_a", cat.Plans.Single(p => p.Key == "semilla").Modules);
        var a = cat.Addons.Single(x => x.Key == "module.zz_a");
        Assert.Equal("creator", a.IncludedIn);                 // se compra suelto en Semilla; Creator ya lo trae
        Assert.Equal(4m, a.Prices[1]);
        Assert.Null(cat.Addons.Single(x => x.Key == "module.zz_b").IncludedIn);
        Assert.Equal(8.55m, cat.Addons.Single(x => x.Key == "module.zz_b").Prices[3]);
    }
}
