using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 7.8: cobro automático con tarjeta guardada. Corre sobre decatron_schema (tenant 9101) con DECATRON_APP_CONN y DECATRON_SCHEMA_CONN; el proveedor de pago y el correo son dobles.</summary>
[Collection("entitlements-db")]
public class AutoRenewalTests : IDisposable
{
    private static string? App => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
    private static string? Owner => Environment.GetEnvironmentVariable("DECATRON_SCHEMA_CONN");
    private static bool Available => !string.IsNullOrWhiteSpace(App) && !string.IsNullOrWhiteSpace(Owner);
    private const long A = 9101;

    private sealed class FakeProvider : IPaymentProvider
    {
        public string Name => "culqi";
        public bool Approve = true;
        public readonly List<ProviderChargeRequest> Charges = new();
        public readonly List<string> Deleted = new();
        public Task<ProviderCharge> ChargeAsync(ProviderChargeRequest req, CancellationToken ct = default)
        {
            Charges.Add(req);
            return Task.FromResult(Approve ? new ProviderCharge(true, "chr_test_auto" + Charges.Count, true, null, false) : new ProviderCharge(false, null, true, "Tarjeta rechazada", false));
        }
        public Task<ProviderCard> SaveCardAsync(ProviderCustomer customer, string token, CancellationToken ct = default) => Task.FromResult(new ProviderCard(true, "cus_x", "crd_x", "1111", "Visa", null, true));
        public Task<bool> DeleteCardAsync(string cardId, CancellationToken ct = default) { Deleted.Add(cardId); return Task.FromResult(true); }
    }

    private sealed class FakeMailer : IBillingMailer
    {
        public readonly List<(string To, string Subject)> Sent = new();
        public Task<(bool Ok, string? Error)> SendAsync(string to, string subject, string html, CancellationToken ct = default) { Sent.Add((to, subject)); return Task.FromResult((true, (string?)null)); }
    }

    private static void Exec(string conn, long? tenant, string sql)
    {
        using var c = tenant is long t ? TenantNpgsql.Create(conn, t) : new NpgsqlConnection(conn);
        c.Open();
        using var cmd = new NpgsqlCommand(sql, c); cmd.ExecuteNonQuery();
    }
    private static T Scalar<T>(string sql)
    {
        using var c = TenantNpgsql.Create(App, A); c.Open();
        var v = new NpgsqlCommand(sql, c).ExecuteScalar();
        return v is null or DBNull ? default! : (T)v;
    }

    private static (AutoRenewal Svc, FakeProvider Provider, FakeMailer Mail) Make(bool enabled = true)
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = App, ["Platform:Billing:AutoRenewEnabled"] = enabled.ToString() }).Build();
        var provider = new FakeProvider(); var mail = new FakeMailer();
        var sp = new ServiceCollection().AddSingleton<IPaymentProvider>(provider).BuildServiceProvider();
        var checkout = new PlatformCheckout(cfg, new Entitlements(cfg, NullLogger<Entitlements>.Instance), NullLogger<PlatformCheckout>.Instance);
        var rate = new Decatron.Services.Finance.ExchangeRate(sp.GetRequiredService<IServiceScopeFactory>(), NullLogger<Decatron.Services.Finance.ExchangeRate>.Instance);
        return (new AutoRenewal(cfg, checkout, rate, sp.GetRequiredService<IServiceScopeFactory>(), mail, NullLogger<AutoRenewal>.Instance), provider, mail);
    }

    public AutoRenewalTests()
    {
        if (!Available) return;
        Dispose();
        Exec(App!, 1, @"
            INSERT INTO capabilities (key, kind, group_key, default_value, meter, period) VALUES ('zz.mod_b','flag','zz',0,'none',NULL);
            INSERT INTO plans (key, name) VALUES ('semilla','Semilla'), ('creator','Creator'), ('pro','Pro'), ('studio','Studio');
            INSERT INTO plan_prices (plan_id, period_months, price_usd) SELECT id, 1, CASE key WHEN 'semilla' THEN 9 WHEN 'creator' THEN 19 WHEN 'pro' THEN 39 ELSE 79 END FROM plans WHERE key IN ('semilla','creator','pro','studio');
            INSERT INTO addon_prices (capability_key, period_months, price_usd) VALUES ('zz.mod_b',1,3);");
        using var c = TenantNpgsql.Create(App, A); c.Open();
        using var tx = c.BeginTransaction();
        var id = TenantProvisioner.CreateBuyerUserAsync(c, tx, "dueno-auto", "dueno-auto@example.test", "es").GetAwaiter().GetResult();
        new NpgsqlCommand($"insert into tenant_members (tenant_id, user_id, role) values ({A}, {id}, 'owner')", c, tx).ExecuteNonQuery();
        tx.Commit();
    }

    public void Dispose()
    {
        if (!Available) return;
        Exec(Owner!, null, "DELETE FROM tenant_payments WHERE tenant_id = 9101");
        Exec(App!, A, $"DELETE FROM tenant_autopay_attempts; DELETE FROM tenant_billing_profile; DELETE FROM tenant_addons; DELETE FROM tenant_subscriptions; DELETE FROM tenant_members WHERE tenant_id={A}; DELETE FROM users WHERE tenant_id={A}");
        Exec(App!, 1, @"DELETE FROM platform_billing_emails WHERE tenant_id = 9101; DELETE FROM addon_prices WHERE capability_key LIKE 'zz.%'; DELETE FROM plan_prices WHERE plan_id IN (SELECT id FROM plans WHERE key IN ('semilla','creator','pro','studio'));
            DELETE FROM plans WHERE key IN ('semilla','creator','pro','studio'); DELETE FROM capabilities WHERE key LIKE 'zz.%'");
    }

    /// <summary>Plan Creator de 1 mes que vence en <paramref name="days"/> días, con tarjeta guardada y cobro automático (o manual).</summary>
    private static void Setup(double days, string mode = "auto", bool card = true)
    {
        Exec(App!, A, $@"INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, period_months, starts_at, ends_at)
            SELECT {A}, id, 'active', 1, now() + interval '{days} days' - interval '1 month', now() + interval '{days} days' FROM plans WHERE key='creator'");
        Exec(App!, A, $@"INSERT INTO tenant_billing_profile (tenant_id, legal_name, country, doc_type, doc_number, billing_email, pay_mode, culqi_customer_id, culqi_card_id)
            VALUES ({A}, 'Cliente Demo', 'PE', 'DNI', '12345678', 'c@example.test', '{mode}', {(card ? "'cus_x'" : "NULL")}, {(card ? "'crd_x'" : "NULL")})");
    }

    [Fact(DisplayName = "Con 3 dias o menos y tarjeta guardada cobra la renovacion con la tarjeta, como recurrente, y corre el vencimiento un mes")]
    public async Task Cobra_la_renovacion()
    {
        if (!Available) return;
        Setup(2);
        var (svc, provider, _) = Make();
        var endsBefore = Scalar<DateTime>("SELECT ends_at FROM tenant_subscriptions");
        Assert.Equal(1, await svc.SweepAsync());
        var ch = Assert.Single(provider.Charges);
        Assert.Equal("crd_x", ch.Token);                         // cobra la tarjeta guardada, no un token
        Assert.True(ch.Recurrent);
        Assert.Equal(7220, ch.AmountCentavos);                   // 19 USD x 3,80
        Assert.Equal("paid", Scalar<string>("SELECT status FROM tenant_payments"));
        Assert.Equal("renewal", Scalar<string>("SELECT purpose FROM tenant_payments"));
        Assert.True(Scalar<bool>($"SELECT ends_at = '{endsBefore:O}'::timestamptz + interval '1 month' FROM tenant_subscriptions"));
        Assert.Equal("paid", Scalar<string>("SELECT status FROM tenant_autopay_attempts"));
        // ya renovado: otra pasada no vuelve a cobrar
        Assert.Equal(0, await svc.SweepAsync());
        Assert.Single(provider.Charges);
    }

    [Fact(DisplayName = "No cobra si falta mas de 3 dias, si el modo es manual, si no hay tarjeta o si esta apagado")]
    public async Task No_cobra_fuera_de_condiciones()
    {
        if (!Available) return;
        Setup(5);
        var (svc, provider, _) = Make();
        Assert.Equal(0, await svc.SweepAsync());                                                   // faltan 5 dias
        Exec(App!, A, "UPDATE tenant_subscriptions SET ends_at = now() + interval '2 days'");
        Exec(App!, A, "UPDATE tenant_billing_profile SET pay_mode='manual'");
        Assert.Equal(0, await svc.SweepAsync());                                                   // modo manual
        Exec(App!, A, "UPDATE tenant_billing_profile SET pay_mode='auto', culqi_card_id=NULL");
        Assert.Equal(0, await svc.SweepAsync());                                                   // sin tarjeta
        Exec(App!, A, "UPDATE tenant_billing_profile SET culqi_card_id='crd_x'");
        Assert.Equal(0, await Make(enabled: false).Svc.SweepAsync());                              // apagado
        Assert.Empty(provider.Charges);
    }

    [Fact(DisplayName = "Cobra los modulos comprados junto con el plan")]
    public async Task Incluye_modulos()
    {
        if (!Available) return;
        Setup(2);
        Exec(App!, A, "INSERT INTO tenant_addons (tenant_id, capability_key, ends_at, source) VALUES (9101, 'zz.mod_b', now() + interval '2 days', 'purchase')");
        var (svc, provider, _) = Make();
        Assert.Equal(1, await svc.SweepAsync());
        Assert.Equal(8360, provider.Charges[0].AmountCentavos);                                    // (19 + 3) x 3,80
    }

    [Fact(DisplayName = "Tres fallos: reintenta cada 2 dias, avisa, y al tercero vuelve a manual, borra la tarjeta y avisa")]
    public async Task Fallos_y_reintentos()
    {
        if (!Available) return;
        Setup(2);
        var (svc, provider, mail) = Make();
        provider.Approve = false;
        var t0 = DateTime.UtcNow;
        Assert.Equal(0, await svc.SweepAsync(now: t0));                                            // intento 1
        Assert.Single(provider.Charges);
        Assert.Equal("failed", Scalar<string>("SELECT status FROM tenant_payments"));
        Assert.Single(mail.Sent);                                                                  // aviso de intento fallido
        Assert.Equal(0, await svc.SweepAsync(now: t0.AddHours(30)));                               // a las 30 h todavia no toca
        Assert.Single(provider.Charges);
        Assert.Equal(0, await svc.SweepAsync(now: t0.AddDays(2).AddMinutes(1)));                   // intento 2
        Assert.Equal(2, provider.Charges.Count);
        Assert.Equal("auto", Scalar<string>("SELECT pay_mode FROM tenant_billing_profile"));       // aun en automatico
        Assert.Equal(0, await svc.SweepAsync(now: t0.AddDays(4).AddMinutes(2)));                   // intento 3
        Assert.Equal(3, provider.Charges.Count);
        Assert.Equal("manual", Scalar<string>("SELECT pay_mode FROM tenant_billing_profile"));
        Assert.Null(Scalar<string>("SELECT culqi_card_id FROM tenant_billing_profile"));
        Assert.Equal(new[] { "crd_x" }, provider.Deleted);
        Assert.Equal(3, mail.Sent.Count);                                                          // 2 avisos de fallo + el de desactivado
        Assert.Equal(0, await svc.SweepAsync(now: t0.AddDays(8)));                                 // ya en manual: no cobra mas
        Assert.Equal(3, provider.Charges.Count);
    }

    [Fact(DisplayName = "Un cobro a medias (intento 'started' viejo) nunca se repite: queda en revision")]
    public async Task Cobro_a_medias_no_se_repite()
    {
        if (!Available) return;
        Setup(2);
        Exec(App!, A, "INSERT INTO tenant_autopay_attempts (tenant_id, cycle_ends, attempt, status, created_at) SELECT 9101, ends_at, 1, 'started', now() - interval '1 hour' FROM tenant_subscriptions");
        var (svc, provider, _) = Make();
        Assert.Equal(0, await svc.SweepAsync());
        Assert.Empty(provider.Charges);
        Assert.Equal("review", Scalar<string>("SELECT status FROM tenant_autopay_attempts"));
        Assert.Equal(0, await svc.SweepAsync(now: DateTime.UtcNow.AddDays(3)));
        Assert.Empty(provider.Charges);
    }

    [Fact(DisplayName = "Quien paga solo no recibe el recordatorio de renovar")]
    public async Task Recordatorios_omiten_automaticos()
    {
        if (!Available) return;
        Setup(2);
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = App, ["Platform:Billing:RemindersEnabled"] = "true" }).Build();
        var mail = new FakeMailer();
        Assert.Equal(0, await new BillingReminders(cfg, mail, NullLogger<BillingReminders>.Instance).SweepAsync());
        Assert.Empty(mail.Sent);
        Exec(App!, A, "UPDATE tenant_billing_profile SET pay_mode='manual'");
        Assert.Equal(1, await new BillingReminders(cfg, mail, NullLogger<BillingReminders>.Instance).SweepAsync());   // en manual si recibe el aviso
    }
}
