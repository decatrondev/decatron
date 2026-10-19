using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 7.5b: avisos de Culqi. Corre sobre decatron_schema (tenant 9101) con DECATRON_APP_CONN y DECATRON_SCHEMA_CONN; el proveedor es un doble que responde lo que Culqi respondería.</summary>
[Collection("entitlements-db")]
public class PlatformWebhooksTests : IDisposable
{
    private static string? App => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
    private static string? Owner => Environment.GetEnvironmentVariable("DECATRON_SCHEMA_CONN");
    private static bool Available => !string.IsNullOrWhiteSpace(App) && !string.IsNullOrWhiteSpace(Owner);
    private const long A = 9101;
    private const string Secret = "secreto-de-prueba-de-24-o-mas-caracteres";

    private sealed class FakeProvider : IPaymentProvider
    {
        public string Name => "culqi";
        public ProviderChargeInfo? Info;
        public readonly List<string> Asked = new();
        public Task<ProviderCharge> ChargeAsync(ProviderChargeRequest req, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<ProviderCard> SaveCardAsync(ProviderCustomer customer, string token, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<bool> DeleteCardAsync(string cardId, CancellationToken ct = default) => Task.FromResult(true);
        public Task<ProviderChargeInfo?> GetChargeAsync(string chargeId, CancellationToken ct = default) { Asked.Add(chargeId); return Task.FromResult(Info); }
    }

    private static void Exec(string conn, long? tenant, string sql)
    {
        using var c = tenant is long t ? TenantNpgsql.Create(conn, t) : new NpgsqlConnection(conn);
        c.Open();
        using var cmd = new NpgsqlCommand(sql, c); cmd.ExecuteNonQuery();
    }
    private static T Scalar<T>(string sql, long tenant = A)
    {
        using var c = TenantNpgsql.Create(App, tenant); c.Open();
        var v = new NpgsqlCommand(sql, c).ExecuteScalar();
        return v is null or DBNull ? default! : (T)v;
    }

    private static (PlatformWebhooks Hooks, PlatformCheckout Checkout) Make(string? secret = Secret)
    {
        var d = new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = App };
        if (secret is not null) d["Platform:Billing:CulqiWebhookSecret"] = secret;
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(d).Build();
        var checkout = new PlatformCheckout(cfg, new Entitlements(cfg, NullLogger<Entitlements>.Instance), NullLogger<PlatformCheckout>.Instance);
        return (new PlatformWebhooks(cfg, checkout, NullLogger<PlatformWebhooks>.Instance), checkout);
    }

    public PlatformWebhooksTests()
    {
        if (!Available) return;
        Dispose();
        Exec(App!, 1, @"
            INSERT INTO plans (key, name) VALUES ('semilla','Semilla'), ('creator','Creator'), ('pro','Pro'), ('studio','Studio');
            INSERT INTO plan_prices (plan_id, period_months, price_usd) SELECT id, 1, CASE key WHEN 'semilla' THEN 9 WHEN 'creator' THEN 19 WHEN 'pro' THEN 39 ELSE 79 END FROM plans WHERE key IN ('semilla','creator','pro','studio');");
        Exec(App!, A, "INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, sandbox_ends_at) SELECT 9101, id, 'sandbox', now() + interval '3 days' FROM plans WHERE key='semilla'");
    }

    public void Dispose()
    {
        if (!Available) return;
        Exec(Owner!, null, "DELETE FROM tenant_payments WHERE tenant_id = 9101");
        Exec(App!, A, "DELETE FROM tenant_addons; DELETE FROM tenant_subscriptions");
        Exec(App!, 1, @"DELETE FROM platform_webhook_events; DELETE FROM plan_prices WHERE plan_id IN (SELECT id FROM plans WHERE key IN ('semilla','creator','pro','studio'));
            DELETE FROM plans WHERE key IN ('semilla','creator','pro','studio')");
    }

    /// <summary>Un pago pendiente de Semilla 1 mes (USD 9 = S/ 34,20 = 3420 céntimos).</summary>
    private static async Task<long> Pending(PlatformCheckout checkout)
    {
        var o = (await checkout.QuoteAsync(A, new PlatformCheckout.Request("semilla", 1, new List<string>(), "PE"))).Value!;
        return await checkout.CreatePendingAsync(A, o, "culqi", 3.8m, isTest: true);
    }

    private static ProviderChargeInfo Info(long paymentId, int amount = 3420, bool authorized = true, int refunded = 0, string platform = "decatron-platform", string id = "chr_test_abcdefgh1234")
        => new(id, authorized, amount, refunded, true, new Dictionary<string, string> { ["platform"] = platform, ["tenant_id"] = A.ToString(), ["payment_id"] = paymentId.ToString() });

    [Fact(DisplayName = "El secreto de la URL: sin configurar, corto o distinto, el endpoint no existe")]
    public void Secreto()
    {
        Assert.True(Make().Hooks.SecretOk(Secret));
        Assert.False(Make().Hooks.SecretOk("otro-secreto-distinto-de-24-o-mas"));
        Assert.False(Make().Hooks.SecretOk(""));
        Assert.False(Make(secret: null).Hooks.SecretOk(Secret));
        Assert.False(Make(secret: "corto").Hooks.SecretOk("corto"));
    }

    [Fact(DisplayName = "Saca los ids de cargo del aviso venga como venga (JSON anidado o texto), sin repetidos y con tope")]
    public void Ids()
    {
        var body = "{\"object\":\"event\",\"type\":\"charge.creation.succeeded\",\"data\":\"{\\\"object\\\":\\\"charge\\\",\\\"id\\\":\\\"chr_live_Ab12Cd34Ef56\\\"}\"} chr_live_Ab12Cd34Ef56 chr_test_ZZzzZZzz1234";
        Assert.Equal(new[] { "chr_live_Ab12Cd34Ef56", "chr_test_ZZzzZZzz1234" }, PlatformWebhooks.ChargeIdsIn(body));
        Assert.Empty(PlatformWebhooks.ChargeIdsIn("{\"nada\":\"de interes\"}"));
    }

    [Fact(DisplayName = "Un cobro autorizado cuyo pago quedo pendiente se confirma (corte entre cobrar y confirmar) y no se confirma dos veces")]
    public async Task Recupera_pago_pendiente()
    {
        if (!Available) return;
        var (hooks, checkout) = Make();
        var id = await Pending(checkout);
        var provider = new FakeProvider { Info = Info(id) };
        Assert.Equal("recovered", await hooks.ReconcileAsync(provider, "chr_test_abcdefgh1234"));
        Assert.Equal("paid", Scalar<string>($"SELECT status FROM tenant_payments WHERE id={id}"));
        Assert.Equal("active", Scalar<string>("SELECT status FROM tenant_subscriptions"));
        Assert.Equal("ok", await hooks.ReconcileAsync(provider, "chr_test_abcdefgh1234"));        // segundo aviso: nada que hacer
    }

    [Fact(DisplayName = "Un cobro no autorizado, de otro producto, sin metadatos o con otro monto no cambia nada")]
    public async Task No_actua_si_no_debe()
    {
        if (!Available) return;
        var (hooks, checkout) = Make();
        var id = await Pending(checkout);
        var p = new FakeProvider();
        p.Info = Info(id, authorized: false); Assert.Equal("noop:pending", await hooks.ReconcileAsync(p, "chr_test_abcdefgh1234"));
        p.Info = Info(id, platform: "decacoins"); Assert.Equal("ignored:other_product", await hooks.ReconcileAsync(p, "chr_test_abcdefgh1234"));
        p.Info = new ProviderChargeInfo("chr_test_abcdefgh1234", true, 3420, 0, true, new Dictionary<string, string> { ["platform"] = "decatron-platform" });
        Assert.Equal("ignored:no_metadata", await hooks.ReconcileAsync(p, "chr_test_abcdefgh1234"));
        p.Info = Info(id, amount: 999); Assert.Equal("mismatch", await hooks.ReconcileAsync(p, "chr_test_abcdefgh1234"));
        p.Info = null; Assert.Equal("unknown_charge", await hooks.ReconcileAsync(p, "chr_test_abcdefgh1234"));
        Assert.Equal("pending", Scalar<string>($"SELECT status FROM tenant_payments WHERE id={id}"));
        Assert.Equal("sandbox", Scalar<string>("SELECT status FROM tenant_subscriptions"));
    }

    [Fact(DisplayName = "Un reembolso hecho en Culqi deja el pago como refunded y fuera del P&L; la suscripcion no se toca")]
    public async Task Registra_reembolso()
    {
        if (!Available) return;
        var (hooks, checkout) = Make();
        var id = await Pending(checkout);
        await checkout.ConfirmAsync(A, id, "chr_test_abcdefgh1234", isTest: true);
        var provider = new FakeProvider { Info = Info(id, refunded: 3420) };
        Assert.Equal("refund_recorded", await hooks.ReconcileAsync(provider, "chr_test_abcdefgh1234"));
        Assert.Equal("refunded", Scalar<string>($"SELECT status FROM tenant_payments WHERE id={id}"));
        Assert.Equal("active", Scalar<string>("SELECT status FROM tenant_subscriptions"));
        Assert.Equal("ok", await hooks.ReconcileAsync(provider, "chr_test_abcdefgh1234"));        // ya registrado
    }

    [Fact(DisplayName = "Procesar un aviso completo: guarda el evento con su resultado y consulta cada cargo")]
    public async Task Aviso_completo()
    {
        if (!Available) return;
        var (hooks, checkout) = Make();
        var id = await Pending(checkout);
        var provider = new FakeProvider { Info = Info(id) };
        var summary = await hooks.HandleAsync(provider, "{\"type\":\"charge.creation.succeeded\",\"data\":\"chr_test_abcdefgh1234\"}");
        Assert.Equal("recovered", summary);
        Assert.Equal(new[] { "chr_test_abcdefgh1234" }, provider.Asked);
        Assert.Equal("recovered", Scalar<string>("SELECT result FROM platform_webhook_events", 1));
        Assert.Equal("ignored:no_charge_id", await hooks.HandleAsync(provider, "{\"hola\":1}"));
    }
}
