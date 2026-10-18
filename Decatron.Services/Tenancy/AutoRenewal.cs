using Decatron.Core.Interfaces;
using Decatron.Services.Finance;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Services.Tenancy;

/// <summary>
/// Plataforma, Fase 7.8: cobro automático con la tarjeta guardada. Para cada tenant en modo <c>auto</c> con tarjeta, cuando faltan 3 días o menos para el vencimiento
/// (o ya venció y sigue en gracia) cobra la renovación del mismo plan, periodo y módulos al tipo de cambio fijo de Decatron. Hasta 3 intentos (día 0, +2 y +4); si fallan
/// los tres, el tenant vuelve a modo manual, se borra la tarjeta y se avisa al dueño (la suscripción sigue su camino normal: gracia y pausa). Cada intento queda en
/// <c>tenant_autopay_attempts</c> ANTES de cobrar: un reinicio a mitad de un cobro nunca lo repite (queda en revisión manual).
/// Apagado por defecto (<c>Platform:Billing:AutoRenewEnabled</c>).
/// </summary>
public sealed class AutoRenewal
{
    public static readonly TimeSpan Ahead = TimeSpan.FromDays(3);
    public static readonly TimeSpan RetryEvery = TimeSpan.FromDays(2);
    public const int MaxAttempts = 3;

    private readonly string? _cs;
    private readonly IConfiguration _cfg;
    private readonly PlatformCheckout _checkout;
    private readonly ExchangeRate _rate;
    private readonly IServiceScopeFactory _scopes;
    private readonly IBillingMailer _mail;
    private readonly ILogger<AutoRenewal> _log;

    public AutoRenewal(IConfiguration cfg, PlatformCheckout checkout, ExchangeRate rate, IServiceScopeFactory scopes, IBillingMailer mail, ILogger<AutoRenewal> log)
    { _cs = cfg.GetConnectionString("DefaultConnection"); _cfg = cfg; _checkout = checkout; _rate = rate; _scopes = scopes; _mail = mail; _log = log; }

    public bool Enabled => _cfg.GetValue<bool?>("Platform:Billing:AutoRenewEnabled") ?? false;

    /// <summary>Una pasada. Devuelve cuántos cobros se hicieron. <paramref name="now"/> solo para pruebas.</summary>
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
        var charged = 0;
        foreach (var (id, name, slug) in tenants)
        {
            if (ct.IsCancellationRequested) break;
            try { if (await ForTenantAsync(id, name, slug, at, ct)) charged++; }
            catch (Exception ex) when (ex is not OperationCanceledException) { _log.LogError(ex, "tenant.billing.auto.failed tenant={Tenant}", id); }
        }
        return charged;
    }

    private sealed record Sub(string PlanKey, string PlanName, int Months, DateTime EndsAt);
    private sealed record Attempt(int N, string Status, DateTime At);

    private async Task<bool> ForTenantAsync(long id, string name, string slug, DateTime now, CancellationToken ct)
    {
        Sub? sub = null; PlatformCheckout.AutoProfile? profile = null; bool preferFactura = false;
        var owned = new List<string>();
        await using (var c = TenantNpgsql.Create(_cs, id))
        {
            await c.OpenAsync(ct);
            // Vigente o vencida dentro de la gracia; nunca interna, sandbox ni sin fecha de fin
            await using (var q = new NpgsqlCommand(@"SELECT p.key, p.name, s.period_months, s.ends_at FROM tenant_subscriptions s JOIN plans p ON p.id = s.plan_id
                  WHERE s.tenant_id = @t AND s.status IN ('active','past_due') AND s.ends_at IS NOT NULL AND s.period_months IS NOT NULL
                    AND p.key NOT IN ('internal','sandbox') AND (s.grace_until IS NULL OR s.grace_until > now()) LIMIT 1", c))
            {
                q.Parameters.AddWithValue("t", id);
                await using var r = await q.ExecuteReaderAsync(ct);
                if (await r.ReadAsync(ct)) sub = new Sub(r.GetString(0), r.GetString(1), r.GetInt16(2), r.GetFieldValue<DateTimeOffset>(3).UtcDateTime);
            }
            if (sub is null) return false;
            profile = await _checkout.GetAutoAsync(id, ct);
            if (profile is not { PayMode: "auto", CardId: { Length: > 0 }, CustomerId: { Length: > 0 } }) return false;
            if (sub.EndsAt - now > Ahead) return false;                                // todavía falta
            await using (var q = new NpgsqlCommand("SELECT capability_key FROM tenant_addons WHERE tenant_id=@t AND source='purchase' AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())", c))
            {
                q.Parameters.AddWithValue("t", id);
                await using var r = await q.ExecuteReaderAsync(ct);
                while (await r.ReadAsync(ct)) owned.Add(r.GetString(0));
            }
            await using (var q = new NpgsqlCommand("SELECT prefer_factura FROM tenant_payments WHERE tenant_id=@t AND status='paid' ORDER BY paid_at DESC NULLS LAST LIMIT 1", c))
            { q.Parameters.AddWithValue("t", id); preferFactura = await q.ExecuteScalarAsync(ct) is bool b && b; }
        }

        // ¿Toca un intento? Máximo 3 por vencimiento, separados 2 días; uno «started» sin resolver es un cobro a medias: NO se repite (revisión manual).
        var attempts = new List<Attempt>();
        await using (var c = TenantNpgsql.Create(_cs, id))
        {
            await c.OpenAsync(ct);
            await using var q = new NpgsqlCommand("SELECT attempt, status, created_at FROM tenant_autopay_attempts WHERE tenant_id=@t AND cycle_ends=@e ORDER BY attempt", c);
            q.Parameters.AddWithValue("t", id); q.Parameters.Add(Tz("e", sub.EndsAt));
            await using var r = await q.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct)) attempts.Add(new Attempt(r.GetInt16(0), r.GetString(1), r.GetFieldValue<DateTimeOffset>(2).UtcDateTime));
        }
        if (attempts.Any(a => a.Status is "paid" or "review")) return false;
        var stuck = attempts.FirstOrDefault(a => a.Status == "started");
        if (stuck is not null)
        {
            if (now - stuck.At > TimeSpan.FromMinutes(10))
            {
                await SetAttemptAsync(id, sub.EndsAt, stuck.N, "review", "cobro a medias", null, ct);
                _log.LogError("tenant.billing.auto.review tenant={Tenant} attempt={N}: cobro automático interrumpido, REVISAR A MANO y no reintentar", id, stuck.N);
            }
            return false;
        }
        if (attempts.Count >= MaxAttempts) return false;
        if (attempts.Count > 0 && now - attempts[^1].At < RetryEvery) return false;
        var n = attempts.Count + 1;

        // Se reserva el intento antes de cobrar
        if (!await ReserveAsync(id, sub.EndsAt, n, ct)) return false;

        string? failure = null; long? paymentId = null;
        var quote = await _checkout.QuoteAsync(id, new PlatformCheckout.Request(sub.PlanKey, sub.Months, owned, profile!.Country ?? "PE"), now, ct);
        if (!quote.Ok) failure = quote.Error;
        else
        {
            var offer = quote.Value!;
            var rate = await _rate.PenPerUsdAsync(ct);
            var pen = PlatformPricing.ToPen(offer.Quote.TotalUsd, rate);
            using var scope = _scopes.CreateScope();
            var provider = scope.ServiceProvider.GetRequiredService<IPaymentProvider>();
            paymentId = await _checkout.CreatePendingAsync(id, offer, provider.Name, rate, isTest: false,
                new PlatformCheckout.Customer(profile.LegalName, profile.DocType, profile.DocNumber, profile.Email, preferFactura), ct);
            var (first, last) = SplitName(profile.LegalName);
            var charge = await provider.ChargeAsync(new ProviderChargeRequest(PlatformPricing.ToCentimos(pen), "PEN", profile.Email ?? "", profile.CardId!,
                $"Decatron Plataforma - renovación automática plan {offer.PlanKey} ({offer.Months} m)", $"PLATA-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..8].ToUpper()}", first, last,
                new Dictionary<string, string> { ["tenant_id"] = id.ToString(), ["payment_id"] = paymentId.Value.ToString(), ["platform"] = "decatron-platform", ["auto"] = "1" }, Recurrent: true), ct);
            if (charge.NeedsReview)
            {
                await SetAttemptAsync(id, sub.EndsAt, n, "review", "sin id de cargo", paymentId, ct);
                _log.LogError("tenant.billing.review tenant={Tenant} payment={Payment}: cobro automático sin id; REVISAR A MANO", id, paymentId);
                return false;
            }
            if (charge.Ok)
            {
                await _checkout.ConfirmAsync(id, paymentId.Value, charge.ChargeId!, charge.IsTest, ct);
                await SetAttemptAsync(id, sub.EndsAt, n, "paid", null, paymentId, ct);
                _log.LogInformation("tenant.billing.auto.paid tenant={Tenant} payment={Payment} attempt={N} test={Test}", id, paymentId, n, charge.IsTest);
                return true;
            }
            await _checkout.MarkFailedAsync(id, paymentId.Value, charge.IsTest, ct);
            failure = Trunc(charge.UserMessage ?? "rechazado");
        }

        await SetAttemptAsync(id, sub.EndsAt, n, "failed", Trunc(failure), paymentId, ct);
        _log.LogWarning("tenant.billing.auto.failed tenant={Tenant} attempt={N} reason={Reason}", id, n, failure);
        if (n >= MaxAttempts)
        {
            var card = await _checkout.DisableAutoAsync(id, ct);
            if (card is not null)
            {
                using var scope = _scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<IPaymentProvider>().DeleteCardAsync(card, ct);
            }
            await NotifyAsync(id, name, slug, BillingNotices.AutoOff, sub, now.Add(TimeSpan.Zero), n, ct);
        }
        else await NotifyAsync(id, name, slug, BillingNotices.AutoFailed, sub, now + RetryEvery, n, ct);
        return false;
    }

    private static string Trunc(string? s) => s is null ? "" : s.Length <= 200 ? s : s[..200];
    private static (string First, string Last) SplitName(string? full)
    {
        var parts = (full ?? "").Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        return parts.Length == 0 ? ("Cliente", "Decatron") : parts.Length == 1 ? (parts[0], "Decatron") : (parts[0], parts[1]);
    }
    private static NpgsqlParameter Tz(string name, DateTime utc)
        => new(name, NpgsqlTypes.NpgsqlDbType.TimestampTz) { Value = new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)) };

    private async Task<bool> ReserveAsync(long id, DateTime cycle, int n, CancellationToken ct)
    {
        await using var c = TenantNpgsql.Create(_cs, id);
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("INSERT INTO tenant_autopay_attempts (tenant_id, cycle_ends, attempt, status) VALUES (@t, @e, @n, 'started') ON CONFLICT DO NOTHING", c);
        cmd.Parameters.AddWithValue("t", id); cmd.Parameters.Add(Tz("e", cycle)); cmd.Parameters.AddWithValue("n", (short)n);
        return await cmd.ExecuteNonQueryAsync(ct) == 1;
    }

    private async Task SetAttemptAsync(long id, DateTime cycle, int n, string status, string? error, long? paymentId, CancellationToken ct)
    {
        await using var c = TenantNpgsql.Create(_cs, id);
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("UPDATE tenant_autopay_attempts SET status=@s, error=@er, payment_id=@p WHERE tenant_id=@t AND cycle_ends=@e AND attempt=@n", c);
        cmd.Parameters.AddWithValue("s", status); cmd.Parameters.AddWithValue("er", (object?)error ?? DBNull.Value); cmd.Parameters.AddWithValue("p", (object?)paymentId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("t", id); cmd.Parameters.Add(Tz("e", cycle)); cmd.Parameters.AddWithValue("n", (short)n);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>Aviso al dueño de un intento fallido o del cobro desactivado. Los avisos de cobro fallido no se cortan por el tope diario: son críticos.</summary>
    private async Task NotifyAsync(long id, string name, string slug, string kind, Sub sub, DateTime next, int attempt, CancellationToken ct)
    {
        string? to = null; string locale = "es";
        await using (var c = TenantNpgsql.Create(_cs, id))
        {
            await c.OpenAsync(ct);
            await using var q = new NpgsqlCommand(@"SELECT u.email, u.preferred_language FROM tenant_members m JOIN users u ON u.id = m.user_id
                  WHERE m.tenant_id = @t AND m.role = 'owner' AND u.email IS NOT NULL ORDER BY m.user_id LIMIT 1", c);
            q.Parameters.AddWithValue("t", id);
            await using var r = await q.ExecuteReaderAsync(ct);
            if (await r.ReadAsync(ct)) { to = r.GetString(0); locale = !r.IsDBNull(1) && r.GetString(1) == "en" ? "en" : "es"; }
        }
        if (string.IsNullOrWhiteSpace(to)) return;
        var (subject, html) = BillingNotices.BuildAuto(locale, kind, name, sub.PlanName, sub.EndsAt, next, attempt, MaxAttempts, $"https://{slug}.{TenantResolver.PlatformDomain}/panel/plan");
        var (ok, error) = await _mail.SendAsync(to, subject, html, ct);
        if (!ok) { _log.LogWarning("tenant.billing.auto.mail_failed tenant={Tenant} error={Error}", id, error); return; }
        await using var cnt = TenantNpgsql.Create(_cs, 1);
        await cnt.OpenAsync(ct);
        await using var ins = new NpgsqlCommand("INSERT INTO platform_billing_emails (tenant_id) VALUES (@t)", cnt);
        ins.Parameters.AddWithValue("t", id);
        await ins.ExecuteNonQueryAsync(ct);
    }
}
