using Decatron.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Services.Tenancy;

/// <summary>Salida de correo de los avisos de cobro. Aparte de EmailService para poder probarla sin enviar nada.</summary>
public interface IBillingMailer
{
    Task<(bool Ok, string? Error)> SendAsync(string to, string subject, string html, CancellationToken ct = default);
}

public sealed class BillingMailer : IBillingMailer
{
    private readonly IServiceScopeFactory _scopes;
    public BillingMailer(IServiceScopeFactory scopes) { _scopes = scopes; }

    public async Task<(bool Ok, string? Error)> SendAsync(string to, string subject, string html, CancellationToken ct = default)
    {
        using var scope = _scopes.CreateScope();
        var (ok, _, error) = await scope.ServiceProvider.GetRequiredService<EmailService>().SendEmailAsync(to, subject, html, "Decatron <support@decatron.net>");
        return (ok, error);
    }
}

/// <summary>
/// Plataforma, Fase 7.4: recordatorios de vencimiento al dueño (a 7, 3 y 1 días, y un aviso al entrar en gracia). Un recordatorio por vencimiento y umbral
/// (<c>tenant_billing_reminders</c>), con tope diario propio (<c>Platform:Billing:ReminderMaxPerDay</c>, 100) en <c>platform_billing_emails</c>: no gasta
/// la cuota de la lista de espera y los enlaces de entrada. Apagado por defecto (<c>Platform:Billing:RemindersEnabled</c>) hasta que exista cómo pagar.
/// No avisa a internal, sandbox ni suscripciones sin <c>ends_at</c>.
/// </summary>
public sealed class BillingReminders
{
    private readonly string? _cs;
    private readonly IConfiguration _cfg;
    private readonly IBillingMailer _mail;
    private readonly ILogger<BillingReminders> _log;

    public BillingReminders(IConfiguration cfg, IBillingMailer mail, ILogger<BillingReminders> log)
    { _cs = cfg.GetConnectionString("DefaultConnection"); _cfg = cfg; _mail = mail; _log = log; }

    public bool Enabled => _cfg.GetValue<bool?>("Platform:Billing:RemindersEnabled") ?? false;
    public int MaxPerDay => Math.Max(0, _cfg.GetValue<int?>("Platform:Billing:ReminderMaxPerDay") ?? 100);

    /// <summary>Una pasada. Devuelve cuántos correos salieron. <paramref name="now"/> solo para pruebas.</summary>
    public async Task<int> SweepAsync(CancellationToken ct = default, DateTime? now = null)
    {
        if (!Enabled) return 0;
        var at = now ?? DateTime.UtcNow;
        var tenants = new List<(long Id, string Name, string Slug)>();
        await using (var c = TenantNpgsql.Create(_cs, 1))
        {
            await c.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand("SELECT id, name, slug FROM tenants WHERE id<>1 AND status<>'closed' ORDER BY id", c);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct)) tenants.Add((r.GetInt64(0), r.GetString(1), r.GetString(2)));
        }

        var sent = 0;
        foreach (var (id, name, slug) in tenants)
        {
            if (ct.IsCancellationRequested) break;
            try { sent += await ForTenantAsync(id, name, slug, at, ct); }
            catch (Exception ex) when (ex is not OperationCanceledException) { _log.LogWarning("tenant.billing.reminder.failed tenant={Tenant} type={Type}", id, ex.GetType().Name); }
        }
        return sent;
    }

    // El vencimiento viaja como instante (timestamptz, UTC): un DateTime suelto se guardaría como hora local con Npgsql legacy.
    private static NpgsqlParameter E(DateTime utc) => new("e", NpgsqlTypes.NpgsqlDbType.TimestampTz) { Value = new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)) };

    private async Task<int> ForTenantAsync(long id, string name, string slug, DateTime now, CancellationToken ct)
    {
        await using var c = TenantNpgsql.Create(_cs, id);
        await c.OpenAsync(ct);

        string planName = ""; DateTime endsAt = default; DateTime? graceUntil = null; string status = "";
        await using (var q = new NpgsqlCommand(@"SELECT p.name, s.ends_at, s.grace_until, s.status FROM tenant_subscriptions s JOIN plans p ON p.id = s.plan_id
              WHERE s.tenant_id = @t AND s.status IN ('active','past_due') AND s.ends_at IS NOT NULL AND p.key NOT IN ('internal','sandbox') LIMIT 1", c))
        {
            q.Parameters.AddWithValue("t", id);
            await using var r = await q.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) return 0;
            planName = r.GetString(0); endsAt = r.GetFieldValue<DateTimeOffset>(1).UtcDateTime; graceUntil = r.IsDBNull(2) ? null : r.GetFieldValue<DateTimeOffset>(2).UtcDateTime;   // instantes UTC: con Npgsql legacy GetDateTime da la hora local y la comparación con UtcNow se desfasa 5 h status = r.GetString(3);
        }

        string? kind = status == "past_due" && graceUntil is { } g && g > now ? BillingNotices.Grace
                     : status == "active" ? BillingNotices.KindFor(endsAt - now) : null;
        if (kind is null) return 0;

        // ¿Ya se mandó este umbral para este vencimiento? Se reserva la fila antes de enviar: un reinicio a medias no repite el correo.
        await using (var ins = new NpgsqlCommand("INSERT INTO tenant_billing_reminders (tenant_id, ends_at, kind) VALUES (@t, @e, @k) ON CONFLICT DO NOTHING", c))
        {
            ins.Parameters.AddWithValue("t", id); ins.Parameters.Add(E(endsAt)); ins.Parameters.AddWithValue("k", kind);
            if (await ins.ExecuteNonQueryAsync(ct) == 0) return 0;
        }

        async Task ReleaseAsync()
        {
            await using var del = new NpgsqlCommand("DELETE FROM tenant_billing_reminders WHERE tenant_id=@t AND ends_at=@e AND kind=@k", c);
            del.Parameters.AddWithValue("t", id); del.Parameters.Add(E(endsAt)); del.Parameters.AddWithValue("k", kind);
            await del.ExecuteNonQueryAsync(ct);
        }

        // Tope diario propio, global (platform_billing_emails no tiene RLS).
        await using (var cnt = TenantNpgsql.Create(_cs, 1))
        {
            await cnt.OpenAsync(ct);
            await using var q = new NpgsqlCommand("SELECT count(*) FROM platform_billing_emails WHERE sent_at >= now() - interval '24 hours'", cnt);
            if ((long)(await q.ExecuteScalarAsync(ct))! >= MaxPerDay)
            {
                await ReleaseAsync();
                _log.LogWarning("tenant.billing.reminder.cap max={Max}", MaxPerDay);
                return 0;
            }
        }

        string? to = null; string locale = "es";
        await using (var q = new NpgsqlCommand(@"SELECT u.email, u.preferred_language FROM tenant_members m JOIN users u ON u.id = m.user_id
              WHERE m.tenant_id = @t AND m.role = 'owner' AND u.email IS NOT NULL ORDER BY m.user_id LIMIT 1", c))
        {
            q.Parameters.AddWithValue("t", id);
            await using var r = await q.ExecuteReaderAsync(ct);
            if (await r.ReadAsync(ct)) { to = r.GetString(0); locale = !r.IsDBNull(1) && r.GetString(1) == "en" ? "en" : "es"; }
        }
        if (string.IsNullOrWhiteSpace(to)) { await ReleaseAsync(); return 0; }

        var (subject, html) = BillingNotices.Build(locale, kind, name, planName, endsAt, graceUntil, $"https://{slug}.{TenantResolver.PlatformDomain}/panel");
        var (ok, error) = await _mail.SendAsync(to, subject, html, ct);
        if (!ok)
        {
            await ReleaseAsync(); // se reintenta en la próxima pasada
            _log.LogWarning("tenant.billing.reminder.send_failed tenant={Tenant} kind={Kind} error={Error}", id, kind, error);
            return 0;
        }
        await using (var cnt = TenantNpgsql.Create(_cs, 1))
        {
            await cnt.OpenAsync(ct);
            await using var ins = new NpgsqlCommand("INSERT INTO platform_billing_emails (tenant_id) VALUES (@t)", cnt);
            ins.Parameters.AddWithValue("t", id);
            await ins.ExecuteNonQueryAsync(ct);
        }
        _log.LogInformation("tenant.billing.reminder tenant={Tenant} kind={Kind}", id, kind);
        return 1;
    }
}
