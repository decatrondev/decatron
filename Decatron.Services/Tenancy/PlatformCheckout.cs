using Decatron.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Services.Tenancy;

/// <summary>
/// Plataforma, Fase 7.5: compra de un plan (alta o renovación) con sus complementos. Calcula el presupuesto con <see cref="PlatformPricing"/> sobre los precios de
/// la base, guarda un pago pendiente que RECUERDA lo comprado y, al confirmarse el cobro, aplica la suscripción y los complementos en una sola transacción
/// (idempotente por pago). No habla con ningún proveedor de pago: eso es <see cref="IPaymentProvider"/>.
/// Alcance de esta versión: alta (sandbox, sin fecha, vencido o en gracia) y renovación del MISMO plan dentro de los 7 días previos al vencimiento. Subir de plan o
/// agregar módulos a mitad de periodo queda para después (<c>change_not_available</c>).
/// </summary>
public sealed class PlatformCheckout
{
    /// <summary>Orden de los planes de pago; el tope de complementos es el precio del siguiente.</summary>
    public static readonly string[] PaidPlans = { "semilla", "creator", "pro", "studio" };
    public static readonly TimeSpan RenewWindow = TimeSpan.FromDays(7);

    public sealed record Request(string PlanKey, int Months, IReadOnlyList<string> Addons, string Country);
    /// <summary>Cambio a mitad de periodo: total del periodo con el cambio, lo ya pagado por el plan actual y los días que faltan (el cobro es la diferencia prorrateada).</summary>
    public sealed record Proration(decimal NewPeriodUsd, decimal CurrentPeriodUsd, int RemainingDays, int PeriodDays);
    /// <summary><c>Kind</c>: <c>new</c> (alta), <c>renew</c>, <c>upgrade</c> (subir de plan a mitad de periodo) o <c>addons</c> (sumar módulos al plan vigente).</summary>
    public sealed record Offer(long PlanId, string PlanKey, string Kind, int Months, PlatformPricing.Quote Quote, string TaxTreatment, string TaxCountry,
        PlatformPricing.TaxSplit Tax, DateTime StartsAt, DateTime EndsAt, Proration? Proration = null);
    /// <summary>Datos del comprobante, congelados con el pago.</summary>
    public sealed record Customer(string? Name, string? DocType, string? DocNumber, string? Email, bool PreferFactura);
    public sealed record Result<T>(T? Value, string? Error)
    {
        public bool Ok => Error is null;
    }

    private readonly string? _cs;
    private readonly IEntitlements _ent;
    private readonly ILogger<PlatformCheckout> _log;

    public PlatformCheckout(IConfiguration cfg, IEntitlements ent, ILogger<PlatformCheckout> log)
    { _cs = cfg.GetConnectionString("DefaultConnection"); _ent = ent; _log = log; }

    private NpgsqlConnection Open(long tenant) => TenantNpgsql.Create(_cs, tenant);

    // El proceso corre con Npgsql.EnableLegacyTimestampBehavior: un DateTime suelto se guarda como «timestamp» y el servidor lo lee en su zona (America/Lima),
    // así que una hora UTC quedaba 5 h en el futuro. Las fechas de la compra viajan siempre como instantes (timestamptz, UTC) y se leen como DateTimeOffset.
    private static NpgsqlParameter Tz(string name, DateTime utc)
        => new(name, NpgsqlTypes.NpgsqlDbType.TimestampTz) { Value = new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)) };

    /// <summary>País de 2 letras → tratamiento de IGV: Perú paga IGV incluido; el resto es exportación de servicios.</summary>
    public static string TaxTreatmentFor(string country) => string.Equals(country, "PE", StringComparison.OrdinalIgnoreCase) ? "igv" : "export";

    public async Task<Result<Offer>> QuoteAsync(long tenantId, Request req, DateTime? nowOverride = null, CancellationToken ct = default)
    {
        var now = nowOverride ?? DateTime.UtcNow;
        if (!PlatformPricing.IsValidPeriod(req.Months)) return Fail<Offer>("invalid_period");
        var country = (req.Country ?? "").Trim().ToUpperInvariant();
        if (country.Length != 2) return Fail<Offer>("country_required");
        var planIdx = Array.IndexOf(PaidPlans, req.PlanKey);
        if (planIdx < 0) return Fail<Offer>("plan_not_for_sale");

        await using var c = Open(tenantId);
        await c.OpenAsync(ct);

        long planId; decimal planTotal;
        (planId, planTotal) = await PlanPriceAsync(c, req.PlanKey, req.Months, ct) ?? default;
        if (planId == 0) return Fail<Offer>("plan_not_for_sale");

        decimal? nextTotal = null;
        if (planIdx + 1 < PaidPlans.Length)
        {
            var next = await PlanPriceAsync(c, PaidPlans[planIdx + 1], req.Months, ct);
            if (next is { } n) nextTotal = n.Total;
        }

        var addonLines = new List<(string Key, decimal Usd)>();
        foreach (var key in req.Addons.Distinct())
        {
            await using var q = new NpgsqlCommand(@"SELECT price_usd FROM addon_prices WHERE capability_key = @k AND period_months = @m AND active", c);
            q.Parameters.AddWithValue("k", key); q.Parameters.AddWithValue("m", (short)req.Months);
            if (await q.ExecuteScalarAsync(ct) is not decimal price) return Fail<Offer>("addon_unavailable");
            await using var inc = new NpgsqlCommand(@"SELECT 1 FROM plan_entitlements WHERE plan_id = @p AND capability_key = @k AND value >= 1", c);
            inc.Parameters.AddWithValue("p", planId); inc.Parameters.AddWithValue("k", key);
            if (await inc.ExecuteScalarAsync(ct) is not null) return Fail<Offer>("addon_included");
            addonLines.Add((key, price));
        }

        // Estado actual de la suscripción: decide si es alta o renovación
        string? curPlan = null, status = null; DateTime? endsAt = null, subStarts = null; int? curMonths = null;
        await using (var q = new NpgsqlCommand(@"SELECT p.key, s.status, s.ends_at, s.starts_at, s.period_months FROM tenant_subscriptions s JOIN plans p ON p.id = s.plan_id
              WHERE s.tenant_id = @t AND s.status <> 'cancelled' LIMIT 1", c))
        {
            q.Parameters.AddWithValue("t", tenantId);
            await using var r = await q.ExecuteReaderAsync(ct);
            if (await r.ReadAsync(ct))
            {
                curPlan = r.GetString(0); status = r.GetString(1); endsAt = r.IsDBNull(2) ? null : r.GetFieldValue<DateTimeOffset>(2).UtcDateTime;
                subStarts = r.GetFieldValue<DateTimeOffset>(3).UtcDateTime; curMonths = r.IsDBNull(4) ? null : r.GetInt16(4);
            }
        }
        if (curPlan == "internal") return Fail<Offer>("not_billable");
        if (status == "suspended") return Fail<Offer>("suspended");

        string kind; DateTime starts;
        var live = status == "active" && endsAt is { } e && e > now;
        if (!live) { kind = "new"; starts = now; }                                   // sandbox, sin fecha (pilotos), vencido o en gracia: cualquier plan
        else
        {
            var curIdx = Array.IndexOf(PaidPlans, curPlan);
            if (curIdx < 0) return Fail<Offer>("change_not_available");              // plan a medida: se maneja a mano
            if (planIdx < curIdx) return Fail<Offer>("downgrade_not_available");     // bajar nunca devuelve dinero: se compra el plan menor al vencer o en la gracia
            if (planIdx == curIdx && endsAt!.Value - now <= RenewWindow) { kind = "renew"; starts = endsAt.Value; }
            else
            {
                // A mitad de periodo: subir de plan o sumar módulos. El periodo se mantiene y todo termina en la misma fecha.
                if (planIdx == curIdx && addonLines.Count == 0) return Fail<Offer>("renew_window");   // mismo plan y sin módulos: aún no toca renovar
                if (curMonths is not { } m0) return Fail<Offer>("change_not_available");
                if (req.Months != m0) return Fail<Offer>("period_locked");
                return await MidPeriodAsync(c, tenantId, req, planId, planTotal, nextTotal, planIdx, curIdx, curPlan!, m0, subStarts!.Value, endsAt!.Value, now, addonLines, country, ct);
            }
        }

        var quote = PlatformPricing.Build(planTotal, addonLines, nextTotal);
        var treatment = TaxTreatmentFor(country);
        return new Result<Offer>(new Offer(planId, req.PlanKey, kind, req.Months, quote, treatment, country,
            PlatformPricing.Split(quote.TotalUsd, treatment), starts, starts.AddMonths(req.Months)), null);
    }

    /// <summary>
    /// Cobro de un cambio a mitad de periodo: la diferencia entre el total del periodo CON el cambio y el del plan actual con sus módulos, prorrateada por los días que faltan
    /// (<see cref="PlatformPricing.UpgradeCharge"/>). Los módulos ya comprados se conservan hasta el fin del periodo; pedir menos no devuelve nada.
    /// </summary>
    private async Task<Result<Offer>> MidPeriodAsync(NpgsqlConnection c, long tenantId, Request req, long planId, decimal planTotal, decimal? nextTotal, int planIdx, int curIdx, string curPlan,
        int months, DateTime subStarts, DateTime endsAt, DateTime now, List<(string Key, decimal Usd)> requested, string country, CancellationToken ct)
    {
        var owned = new List<string>();
        await using (var q = new NpgsqlCommand(@"SELECT capability_key FROM tenant_addons WHERE tenant_id = @t AND source = 'purchase' AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())", c))
        {
            q.Parameters.AddWithValue("t", tenantId);
            await using var r = await q.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct)) owned.Add(r.GetString(0));
        }
        var newKeys = requested.Where(a => !owned.Contains(a.Key)).ToList();
        if (planIdx == curIdx && newKeys.Count == 0) return Fail<Offer>(requested.Count == 0 ? "renew_window" : "nothing_to_change");   // mismo plan y nada nuevo: aún no toca renovar

        // Total del periodo actual: plan vigente + módulos comprados, con el tope de siempre
        var curPlanPrice = await PlanPriceAsync(c, curPlan, months, ct);
        if (curPlanPrice is not { } cp) return Fail<Offer>("change_not_available");
        decimal? curNext = null;
        if (curIdx + 1 < PaidPlans.Length && await PlanPriceAsync(c, PaidPlans[curIdx + 1], months, ct) is { } cn) curNext = cn.Total;
        var curLines = new List<(string Key, decimal Usd)>();
        foreach (var k in owned)
            if (await AddonPriceAsync(c, k, months, ct) is { } price) curLines.Add((k, price));
        var current = PlatformPricing.Build(cp.Total, curLines, curNext);

        // Total del periodo con el cambio: plan nuevo + (módulos ya comprados que el plan nuevo aún no incluye) + módulos pedidos
        var newLines = new List<(string Key, decimal Usd)>();
        foreach (var k in owned)
        {
            if (await PlanIncludesAsync(c, planId, k, ct)) continue;
            if (await AddonPriceAsync(c, k, months, ct) is { } price) newLines.Add((k, price));
        }
        newLines.AddRange(newKeys);
        var target = PlatformPricing.Build(planTotal, newLines, nextTotal);

        var periodDays = Math.Max(1, (int)Math.Round((endsAt - subStarts).TotalDays));
        var remaining = Math.Max(1, (int)Math.Ceiling((endsAt - now).TotalDays));
        var charge = PlatformPricing.UpgradeCharge(target.TotalUsd, current.TotalUsd, periodDays, remaining);
        if (charge <= 0) return Fail<Offer>("nothing_to_change");

        var treatment = TaxTreatmentFor(country);
        var shown = new PlatformPricing.Quote(target.PlanUsd, newKeys.Select(a => new PlatformPricing.QuoteLine(a.Key, a.Usd)).ToList(), newKeys.Sum(a => a.Usd), charge, target.Capped);
        return new Result<Offer>(new Offer(planId, req.PlanKey, planIdx > curIdx ? "upgrade" : "addons", months, shown, treatment, country,
            PlatformPricing.Split(charge, treatment), now, endsAt, new Proration(target.TotalUsd, current.TotalUsd, remaining, periodDays)), null);
    }

    private static async Task<decimal?> AddonPriceAsync(NpgsqlConnection c, string key, int months, CancellationToken ct)
    {
        await using var q = new NpgsqlCommand("SELECT price_usd FROM addon_prices WHERE capability_key = @k AND period_months = @m AND active", c);
        q.Parameters.AddWithValue("k", key); q.Parameters.AddWithValue("m", (short)months);
        return await q.ExecuteScalarAsync(ct) is decimal d ? d : null;
    }

    private static async Task<bool> PlanIncludesAsync(NpgsqlConnection c, long planId, string key, CancellationToken ct)
    {
        await using var q = new NpgsqlCommand("SELECT 1 FROM plan_entitlements WHERE plan_id = @p AND capability_key = @k AND value >= 1", c);
        q.Parameters.AddWithValue("p", planId); q.Parameters.AddWithValue("k", key);
        return await q.ExecuteScalarAsync(ct) is not null;
    }

    private static async Task<(long Id, decimal Total)?> PlanPriceAsync(NpgsqlConnection c, string planKey, int months, CancellationToken ct)
    {
        await using var q = new NpgsqlCommand(@"SELECT p.id, pp.price_usd FROM plans p JOIN plan_prices pp ON pp.plan_id = p.id
              WHERE p.key = @k AND pp.period_months = @m AND pp.active", c);
        q.Parameters.AddWithValue("k", planKey); q.Parameters.AddWithValue("m", (short)months);
        await using var r = await q.ExecuteReaderAsync(ct);
        return await r.ReadAsync(ct) ? (r.GetInt64(0), r.GetDecimal(1)) : null;
    }

    private static Result<T> Fail<T>(string code) => new(default, code);

    /// <summary>Guarda el pago pendiente con todo lo necesario para aplicarlo después. Devuelve su id.</summary>
    public async Task<long> CreatePendingAsync(long tenantId, Offer o, string provider, decimal penPerUsd, bool isTest, Customer? customer = null, CancellationToken ct = default)
    {
        await using var c = Open(tenantId);
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(@"INSERT INTO tenant_payments
              (purpose, plan_id, period_months, provider, amount_usd, pen_per_usd, amount_pen, tax_treatment, tax_country, status, is_test, addons, period_starts, period_ends,
               customer_name, customer_doc_type, customer_doc_number, customer_email, prefer_factura)
              VALUES (@purpose, @plan, @m, @prov, @usd, @rate, @pen, @tax, @cc, 'pending', @test, @addons, @s, @e, @cn, @cdt, @cdn, @ce, @pf) RETURNING id", c);
        cmd.Parameters.AddWithValue("cn", (object?)customer?.Name ?? DBNull.Value); cmd.Parameters.AddWithValue("cdt", (object?)customer?.DocType ?? DBNull.Value);
        cmd.Parameters.AddWithValue("cdn", (object?)customer?.DocNumber ?? DBNull.Value); cmd.Parameters.AddWithValue("ce", (object?)customer?.Email ?? DBNull.Value);
        cmd.Parameters.AddWithValue("pf", customer?.PreferFactura ?? false);
        cmd.Parameters.AddWithValue("purpose", o.Kind switch { "renew" => "renewal", "upgrade" or "addons" => "addon", _ => "plan" });
        cmd.Parameters.AddWithValue("plan", o.PlanId); cmd.Parameters.AddWithValue("m", (short)o.Months); cmd.Parameters.AddWithValue("prov", provider);
        cmd.Parameters.AddWithValue("usd", o.Quote.TotalUsd); cmd.Parameters.AddWithValue("rate", penPerUsd);
        cmd.Parameters.AddWithValue("pen", PlatformPricing.ToPen(o.Quote.TotalUsd, penPerUsd));
        cmd.Parameters.AddWithValue("tax", o.TaxTreatment); cmd.Parameters.AddWithValue("cc", o.TaxCountry); cmd.Parameters.AddWithValue("test", isTest);
        cmd.Parameters.AddWithValue("addons", o.Quote.Addons.Select(a => a.Key).ToArray());
        cmd.Parameters.Add(Tz("s", o.StartsAt)); cmd.Parameters.Add(Tz("e", o.EndsAt));
        return (long)(await cmd.ExecuteScalarAsync(ct))!;
    }

    /// <summary>Datos de facturación del tenant (para el comprobante y el tratamiento de IGV). Guarda lo último que dio el comprador.</summary>
    public async Task SaveProfileAsync(long tenantId, string? legalName, string country, string? docType, string? docNumber, string? email, CancellationToken ct = default)
    {
        await using var c = Open(tenantId);
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(@"INSERT INTO tenant_billing_profile (tenant_id, legal_name, country, doc_type, doc_number, billing_email, updated_at)
              VALUES (@t, @n, @c, @dt, @dn, @e, now())
              ON CONFLICT (tenant_id) DO UPDATE SET legal_name=EXCLUDED.legal_name, country=EXCLUDED.country, doc_type=EXCLUDED.doc_type,
                doc_number=EXCLUDED.doc_number, billing_email=EXCLUDED.billing_email, updated_at=now()", c);
        cmd.Parameters.AddWithValue("t", tenantId); cmd.Parameters.AddWithValue("n", (object?)legalName?.Trim() ?? DBNull.Value);
        cmd.Parameters.AddWithValue("c", country.ToUpperInvariant()); cmd.Parameters.AddWithValue("dt", (object?)docType?.Trim() ?? DBNull.Value);
        cmd.Parameters.AddWithValue("dn", (object?)docNumber?.Trim() ?? DBNull.Value); cmd.Parameters.AddWithValue("e", (object?)email?.Trim() ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>Tarjeta guardada y modo de pago del tenant. Los ids son del proveedor; nunca hay número de tarjeta.</summary>
    public sealed record AutoProfile(string? CustomerId, string? CardId, string PayMode, string? LegalName, string? DocType, string? DocNumber, string? Email, string? Country);

    public async Task<AutoProfile?> GetAutoAsync(long tenantId, CancellationToken ct = default)
    {
        await using var c = Open(tenantId);
        await c.OpenAsync(ct);
        await using var q = new NpgsqlCommand("SELECT culqi_customer_id, culqi_card_id, pay_mode, legal_name, doc_type, doc_number, billing_email, country FROM tenant_billing_profile WHERE tenant_id = @t", c);
        q.Parameters.AddWithValue("t", tenantId);
        await using var r = await q.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) return null;
        string? S(int i) => r.IsDBNull(i) ? null : r.GetString(i);
        return new AutoProfile(S(0), S(1), r.GetString(2), S(3), S(4), S(5), S(6), S(7));
    }

    /// <summary>Activa el cobro automático con la tarjeta guardada (el perfil de facturación ya existe: se guarda antes de cobrar).</summary>
    public async Task SaveAutoAsync(long tenantId, string customerId, string cardId, string? last4, string? brand, CancellationToken ct = default)
    {
        await using var c = Open(tenantId);
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(@"UPDATE tenant_billing_profile SET culqi_customer_id=@cu, culqi_card_id=@cd, card_last4=@l4, card_brand=@br,
              pay_mode='auto', auto_enabled_at=now(), updated_at=now() WHERE tenant_id=@t", c);
        cmd.Parameters.AddWithValue("t", tenantId); cmd.Parameters.AddWithValue("cu", customerId); cmd.Parameters.AddWithValue("cd", cardId);
        cmd.Parameters.AddWithValue("l4", (object?)last4 ?? DBNull.Value); cmd.Parameters.AddWithValue("br", (object?)brand ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>Vuelve al modo manual y olvida la tarjeta. Devuelve el id de la tarjeta que había (para borrarla en el proveedor) o null.</summary>
    public async Task<string?> DisableAutoAsync(long tenantId, CancellationToken ct = default)
    {
        await using var c = Open(tenantId);
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(@"UPDATE tenant_billing_profile p SET culqi_card_id=NULL, card_last4=NULL, card_brand=NULL, pay_mode='manual', auto_enabled_at=NULL, updated_at=now()
              FROM (SELECT culqi_card_id FROM tenant_billing_profile WHERE tenant_id=@t) old WHERE p.tenant_id=@t RETURNING old.culqi_card_id", c);
        cmd.Parameters.AddWithValue("t", tenantId);
        return await cmd.ExecuteScalarAsync(ct) as string;
    }

    public async Task MarkFailedAsync(long tenantId, long paymentId, bool isTest = false, CancellationToken ct = default)
    {
        await using var c = Open(tenantId);
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("UPDATE tenant_payments SET status='failed', is_test=@test WHERE id=@i AND status='pending'", c);
        cmd.Parameters.AddWithValue("i", paymentId); cmd.Parameters.AddWithValue("test", isTest);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// Confirma un cobro y aplica la compra. Una sola transacción; si el pago ya estaba confirmado no vuelve a aplicar nada (devuelve false).
    /// </summary>
    public async Task<bool> ConfirmAsync(long tenantId, long paymentId, string chargeId, bool isTest = false, CancellationToken ct = default)
    {
        await using var c = Open(tenantId);
        await c.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);

        long planId; short months; string[] addons; DateTime starts, ends; string? taxTreatment, taxCountry; string purpose;
        await using (var q = new NpgsqlCommand(@"SELECT plan_id, period_months, addons, period_starts, period_ends, tax_treatment, tax_country, status, purpose
              FROM tenant_payments WHERE id = @i FOR UPDATE", c, tx))
        {
            q.Parameters.AddWithValue("i", paymentId);
            await using var r = await q.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) throw new InvalidOperationException("payment_not_found");
            if (r.GetString(7) == "paid") return false;
            planId = r.GetInt64(0); months = r.GetInt16(1); addons = (string[])r.GetValue(2);
            starts = r.GetFieldValue<DateTimeOffset>(3).UtcDateTime; ends = r.GetFieldValue<DateTimeOffset>(4).UtcDateTime; taxTreatment = r.IsDBNull(5) ? null : r.GetString(5); taxCountry = r.IsDBNull(6) ? null : r.GetString(6); purpose = r.GetString(8);
        }

        await using (var up = new NpgsqlCommand(@"UPDATE tenant_payments SET status='paid', provider_charge_id=@c, is_test=@test, paid_at=now(),
              invoice_status = CASE WHEN @test OR COALESCE(amount_pen, 0) <= 0 THEN NULL ELSE 'PENDING' END WHERE id=@i", c, tx))
        {
            up.Parameters.AddWithValue("test", isTest); up.Parameters.AddWithValue("c", chargeId); up.Parameters.AddWithValue("i", paymentId);
            await up.ExecuteNonQueryAsync(ct);
        }

        // Una compra nueva empieza hoy; una renovación empieza donde terminaba la anterior: ambas fechas ya vienen en period_starts
        var subStarts = starts;
        // tenant_subscriptions usa otros valores que tenant_payments: igv_18 / export_0
        var subTax = taxTreatment == "igv" ? "igv_18" : taxTreatment == "export" ? "export_0" : null;
        if (purpose == "addon")
        {
            // Cambio a mitad de periodo: solo cambia el plan y se suman módulos; el periodo y la fecha de fin NO se tocan (los módulos nuevos terminan en ella).
            await using var up2 = new NpgsqlCommand("UPDATE tenant_subscriptions SET plan_id=@p, updated_at=now() WHERE tenant_id=@t AND status <> 'cancelled'", c, tx);
            up2.Parameters.AddWithValue("p", planId); up2.Parameters.AddWithValue("t", tenantId);
            await up2.ExecuteNonQueryAsync(ct);
        }
        else
        await using (var sub = new NpgsqlCommand(@"UPDATE tenant_subscriptions SET plan_id=@p, period_months=@m, status='active', starts_at=@s, ends_at=@e,
              grace_until=NULL, sandbox_ends_at=NULL, tax_country=@cc, tax_treatment=@tax, updated_at=now() WHERE tenant_id=@t AND status <> 'cancelled'", c, tx))
        {
            sub.Parameters.AddWithValue("p", planId); sub.Parameters.AddWithValue("m", months); sub.Parameters.Add(Tz("s", subStarts)); sub.Parameters.Add(Tz("e", ends));
            sub.Parameters.AddWithValue("cc", (object?)taxCountry ?? DBNull.Value); sub.Parameters.AddWithValue("tax", (object?)subTax ?? DBNull.Value);
            sub.Parameters.AddWithValue("t", tenantId);
            if (await sub.ExecuteNonQueryAsync(ct) == 0)
            {
                await using var ins = new NpgsqlCommand(@"INSERT INTO tenant_subscriptions (tenant_id, plan_id, period_months, status, starts_at, ends_at, tax_country, tax_treatment)
                      VALUES (@t, @p, @m, 'active', @s, @e, @cc, @tax)", c, tx);
                ins.Parameters.AddWithValue("t", tenantId); ins.Parameters.AddWithValue("p", planId); ins.Parameters.AddWithValue("m", months);
                ins.Parameters.Add(Tz("s", subStarts)); ins.Parameters.Add(Tz("e", ends));
                ins.Parameters.AddWithValue("cc", (object?)taxCountry ?? DBNull.Value); ins.Parameters.AddWithValue("tax", (object?)subTax ?? DBNull.Value);
                await ins.ExecuteNonQueryAsync(ct);
            }
        }

        // Complementos comprados: co-terminados con el plan. Reemplazan los comprados antes de la misma capacidad.
        foreach (var key in addons)
        {
            await using var del = new NpgsqlCommand("DELETE FROM tenant_addons WHERE tenant_id=@t AND capability_key=@k AND source='purchase'", c, tx);
            del.Parameters.AddWithValue("t", tenantId); del.Parameters.AddWithValue("k", key);
            await del.ExecuteNonQueryAsync(ct);
            await using var ins = new NpgsqlCommand(@"INSERT INTO tenant_addons (tenant_id, capability_key, value, starts_at, ends_at, source) VALUES (@t, @k, 1, @s, @e, 'purchase')", c, tx);
            ins.Parameters.AddWithValue("t", tenantId); ins.Parameters.AddWithValue("k", key); ins.Parameters.Add(Tz("s", subStarts)); ins.Parameters.Add(Tz("e", ends));
            await ins.ExecuteNonQueryAsync(ct);
        }

        await tx.CommitAsync(ct);
        _ent.Invalidate(tenantId);
        _log.LogInformation("tenant.billing.paid tenant={Tenant} payment={Payment} addons={Addons}", tenantId, paymentId, addons.Length);
        return true;
    }
}
