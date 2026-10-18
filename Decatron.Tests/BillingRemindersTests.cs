using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 7.4: recordatorios de vencimiento. Corre sobre decatron_schema (tenants 9101/9102) con DECATRON_APP_CONN; el correo es un doble, no se envía nada.</summary>
[Collection("entitlements-db")]
public class BillingRemindersTests : IDisposable
{
    private static string? Conn => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
    private static bool Available => !string.IsNullOrWhiteSpace(Conn);
    private const long A = 9101, B = 9102;

    private sealed class FakeMailer : IBillingMailer
    {
        public readonly List<(string To, string Subject, string Html)> Sent = new();
        public bool Fail;
        public Task<(bool Ok, string? Error)> SendAsync(string to, string subject, string html, CancellationToken ct = default)
        {
            if (Fail) return Task.FromResult((false, (string?)"fallo-de-prueba"));
            Sent.Add((to, subject, html));
            return Task.FromResult((true, (string?)null));
        }
    }

    private static void Exec(long tenant, string sql)
    {
        using var c = TenantNpgsql.Create(Conn, tenant); c.Open();
        using var cmd = new NpgsqlCommand(sql, c); cmd.ExecuteNonQuery();
    }

    private static long Count(long tenant, string sql)
    {
        using var c = TenantNpgsql.Create(Conn, tenant); c.Open();
        return (long)new NpgsqlCommand(sql, c).ExecuteScalar()!;
    }

    private static BillingReminders Make(FakeMailer mail, bool enabled = true, int? max = null)
    {
        var d = new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = Conn, ["Platform:Billing:RemindersEnabled"] = enabled.ToString() };
        if (max is int m) d["Platform:Billing:ReminderMaxPerDay"] = m.ToString();
        return new BillingReminders(new ConfigurationBuilder().AddInMemoryCollection(d).Build(), mail, NullLogger<BillingReminders>.Instance);
    }

    public BillingRemindersTests()
    {
        if (!Available) return;
        Dispose();
        Exec(1, "INSERT INTO plans (key, name) VALUES ('zz-rem','Plan prueba')");
        using var c = TenantNpgsql.Create(Conn, A); c.Open();
        using var tx = c.BeginTransaction();
        var id = TenantProvisioner.CreateBuyerUserAsync(c, tx, "dueno-rem", "dueno-rem@example.test", "es").GetAwaiter().GetResult();
        new NpgsqlCommand($"insert into tenant_members (tenant_id, user_id, role) values ({A}, {id}, 'owner')", c, tx).ExecuteNonQuery();
        tx.Commit();
    }

    public void Dispose()
    {
        if (!Available) return;
        foreach (var t in new[] { A, B })
            Exec(t, $"DELETE FROM tenant_billing_reminders; DELETE FROM tenant_subscriptions; DELETE FROM tenant_members WHERE tenant_id={t}; DELETE FROM users WHERE tenant_id={t}; DELETE FROM accounts");
        Exec(1, "DELETE FROM platform_billing_emails WHERE tenant_id IN (9101, 9102); DELETE FROM plans WHERE key = 'zz-rem'");
    }

    private static void Sub(string status, string endsAt, string? grace = null)
        => Exec(A, $"INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, ends_at, grace_until) SELECT {A}, id, '{status}', {endsAt}, {grace ?? "NULL"} FROM plans WHERE key='zz-rem'");

    [Theory(DisplayName = "El umbral sale de los dias que faltan")]
    [InlineData(10, null)] [InlineData(7, "d7")] [InlineData(5, "d7")] [InlineData(3, "d3")] [InlineData(2, "d3")] [InlineData(1, "d1")] [InlineData(0.5, "d1")] [InlineData(-1, null)]
    public void KindFor(double days, string? expected) => Assert.Equal(expected, BillingNotices.KindFor(TimeSpan.FromDays(days)));

    [Fact(DisplayName = "Apagado por defecto: no envia nada")]
    public async Task Apagado()
    {
        if (!Available) return;
        Sub("active", "now() + interval '2 days'");
        var mail = new FakeMailer();
        Assert.Equal(0, await Make(mail, enabled: false).SweepAsync());
        Assert.Empty(mail.Sent);
    }

    [Fact(DisplayName = "Un recordatorio por umbral y vencimiento; no se repite")]
    public async Task Un_aviso_por_umbral()
    {
        if (!Available) return;
        Sub("active", "now() + interval '6 days'");
        var mail = new FakeMailer(); var rem = Make(mail);
        Assert.Equal(1, await rem.SweepAsync());
        Assert.Equal(0, await rem.SweepAsync());                                  // mismo umbral: nada
        Assert.Single(mail.Sent);
        Assert.Equal("dueno-rem@example.test", mail.Sent[0].To);
    }

    [Fact(DisplayName = "Avanza de 7 a 3 a 1 dias y manda uno en cada umbral")]
    public async Task Umbrales_sucesivos()
    {
        if (!Available) return;
        Sub("active", "now() + interval '6 days'");
        var mail = new FakeMailer(); var rem = Make(mail);
        Assert.Equal(1, await rem.SweepAsync());                                           // d7
        Assert.Equal(1, await rem.SweepAsync(now: DateTime.UtcNow.AddDays(3.5)));          // faltan ~2,5 dias: d3
        Assert.Equal(1, await rem.SweepAsync(now: DateTime.UtcNow.AddDays(5.5)));          // faltan ~0,5 dia: d1
        Assert.Equal(0, await rem.SweepAsync(now: DateTime.UtcNow.AddDays(5.6)));
        Assert.Equal(3, mail.Sent.Count);
        Assert.Equal(3, Count(A, "SELECT count(*) FROM tenant_billing_reminders"));
    }

    [Fact(DisplayName = "Si el correo falla, no queda marcado y se reintenta")]
    public async Task Falla_y_reintenta()
    {
        if (!Available) return;
        Sub("active", "now() + interval '2 days'");
        var mail = new FakeMailer { Fail = true }; var rem = Make(mail);
        Assert.Equal(0, await rem.SweepAsync());
        Assert.Equal(0, Count(A, "SELECT count(*) FROM tenant_billing_reminders"));
        mail.Fail = false;
        Assert.Equal(1, await rem.SweepAsync());
    }

    [Fact(DisplayName = "El tope diario propio corta el envio y no deja marca")]
    public async Task Tope_diario()
    {
        if (!Available) return;
        Sub("active", "now() + interval '2 days'");
        var mail = new FakeMailer();
        Assert.Equal(0, await Make(mail, max: 0).SweepAsync());
        Assert.Empty(mail.Sent);
        Assert.Equal(0, Count(A, "SELECT count(*) FROM tenant_billing_reminders"));
    }

    [Fact(DisplayName = "Al entrar en gracia avisa una vez; sin ends_at y planes lejanos no avisa")]
    public async Task Gracia_y_exclusiones()
    {
        if (!Available) return;
        Sub("past_due", "now() - interval '1 hour'", "now() + interval '5 days'");
        var mail = new FakeMailer(); var rem = Make(mail);
        Assert.Equal(1, await rem.SweepAsync());
        Assert.Equal(0, await rem.SweepAsync());
        Assert.Contains("Venció", mail.Sent[0].Subject);

        Exec(A, "DELETE FROM tenant_billing_reminders; DELETE FROM tenant_subscriptions");
        Sub("active", "NULL");
        Assert.Equal(0, await rem.SweepAsync());                                           // piloto sin ends_at
        Exec(A, "DELETE FROM tenant_subscriptions");
        Sub("active", "now() + interval '30 days'");
        Assert.Equal(0, await rem.SweepAsync());                                           // falta mucho
    }

    [Fact(DisplayName = "Un tenant no avisa a otro (aislamiento)")]
    public async Task Aislamiento()
    {
        if (!Available) return;
        Exec(B, "INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, ends_at) SELECT 9102, id, 'active', now() + interval '2 days' FROM plans WHERE key='zz-rem'");
        var mail = new FakeMailer();
        Assert.Equal(0, await Make(mail).SweepAsync());                                    // B vence pronto pero no tiene dueño con correo
        Assert.Empty(mail.Sent);
        Assert.Equal(0, Count(B, "SELECT count(*) FROM tenant_billing_reminders"));
    }
}
