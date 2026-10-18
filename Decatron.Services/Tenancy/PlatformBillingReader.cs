using Decatron.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace Decatron.Services.Tenancy;

/// <summary>
/// Plataforma, Fase 7.7: lecturas del panel de facturación (estado de la suscripción, historial de pagos, perfil de facturación) y catálogo público de planes.
/// Solo lee: comprar y confirmar es <see cref="PlatformCheckout"/>. Nunca devuelve ids de tarjeta ni de cliente del proveedor.
/// </summary>
public sealed class PlatformBillingReader
{
    public sealed record Subscription(string PlanKey, string PlanName, string Status, int? PeriodMonths, DateTime StartsAt, DateTime? EndsAt, DateTime? GraceUntil, DateTime? SandboxEndsAt);
    public sealed record Addon(string Key, DateTime? EndsAt);
    public sealed record Profile(string? LegalName, string? Country, string? DocType, string? DocNumber, string? BillingEmail, string PayMode, bool HasSavedCard);
    public sealed record State(Subscription? Subscription, IReadOnlyList<Addon> Addons, Profile? Profile);
    public sealed record Payment(long Id, string Purpose, string? PlanKey, int PeriodMonths, decimal AmountUsd, decimal? AmountPen, string Status, bool IsTest,
        DateTime CreatedAt, DateTime? PaidAt, DateTime? PeriodEnds, string[] Addons, string? InvoiceType, string? InvoiceNumber, bool CanDownload);
    public sealed record PlanRow(string Key, string Name, decimal? Channels, decimal? Admins, IReadOnlyList<string> Modules, IReadOnlyDictionary<int, decimal> Prices);
    /// <summary><c>IncludedIn</c>: primer plan de pago que ya trae el módulo de serie (null si ninguno); por debajo de ese plan se puede comprar suelto.</summary>
    public sealed record AddonRow(string Key, string? IncludedIn, IReadOnlyDictionary<int, decimal> Prices);
    public sealed record Catalog(IReadOnlyList<PlanRow> Plans, IReadOnlyList<AddonRow> Addons);

    private readonly string? _cs;
    private Catalog? _catalog;
    private DateTime _catalogAt;
    private readonly object _gate = new();

    public PlatformBillingReader(IConfiguration cfg) { _cs = cfg.GetConnectionString("DefaultConnection"); }

    private NpgsqlConnection Open(long tenant) => TenantNpgsql.Create(_cs, tenant);

    public async Task<State> GetStateAsync(long tenantId, CancellationToken ct = default)
    {
        await using var c = Open(tenantId);
        await c.OpenAsync(ct);

        Subscription? sub = null;
        await using (var q = new NpgsqlCommand(@"SELECT p.key, p.name, s.status, s.period_months, s.starts_at, s.ends_at, s.grace_until, s.sandbox_ends_at
              FROM tenant_subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.tenant_id = @t AND s.status <> 'cancelled' LIMIT 1", c))
        {
            q.Parameters.AddWithValue("t", tenantId);
            await using var r = await q.ExecuteReaderAsync(ct);
            if (await r.ReadAsync(ct))
                sub = new Subscription(r.GetString(0), r.GetString(1), r.GetString(2), r.IsDBNull(3) ? null : r.GetInt16(3), r.GetDateTime(4),
                    r.IsDBNull(5) ? null : r.GetDateTime(5), r.IsDBNull(6) ? null : r.GetDateTime(6), r.IsDBNull(7) ? null : r.GetDateTime(7));
        }

        var addons = new List<Addon>();
        await using (var q = new NpgsqlCommand(@"SELECT capability_key, ends_at FROM tenant_addons
              WHERE tenant_id = @t AND source = 'purchase' AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()) ORDER BY capability_key", c))
        {
            q.Parameters.AddWithValue("t", tenantId);
            await using var r = await q.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct)) addons.Add(new Addon(r.GetString(0), r.IsDBNull(1) ? null : r.GetDateTime(1)));
        }

        Profile? profile = null;
        await using (var q = new NpgsqlCommand(@"SELECT legal_name, country, doc_type, doc_number, billing_email, pay_mode, culqi_card_id IS NOT NULL
              FROM tenant_billing_profile WHERE tenant_id = @t", c))
        {
            q.Parameters.AddWithValue("t", tenantId);
            await using var r = await q.ExecuteReaderAsync(ct);
            if (await r.ReadAsync(ct))
                profile = new Profile(Str(r, 0), Str(r, 1), Str(r, 2), Str(r, 3), Str(r, 4), r.GetString(5), r.GetBoolean(6));
        }
        return new State(sub, addons, profile);
    }

    /// <summary>Historial del tenant, el más reciente primero. Los pendientes de más de una hora no se muestran (cobros que nunca se completaron).</summary>
    public async Task<IReadOnlyList<Payment>> ListPaymentsAsync(long tenantId, int limit = 100, CancellationToken ct = default)
    {
        await using var c = Open(tenantId);
        await c.OpenAsync(ct);
        await using var q = new NpgsqlCommand(@"SELECT t.id, t.purpose, p.key, t.period_months, t.amount_usd, t.amount_pen, t.status, t.is_test, t.created_at, t.paid_at, t.period_ends,
              t.addons, t.invoice_type, t.invoice_series, t.invoice_number, t.invoice_document_id IS NOT NULL
              FROM tenant_payments t LEFT JOIN plans p ON p.id = t.plan_id
              WHERE t.tenant_id = @t AND (t.status <> 'pending' OR t.created_at > now() - interval '1 hour')
              ORDER BY t.created_at DESC LIMIT @l", c);
        q.Parameters.AddWithValue("t", tenantId); q.Parameters.AddWithValue("l", Math.Clamp(limit, 1, 200));
        var list = new List<Payment>();
        await using var r = await q.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
            list.Add(new Payment(r.GetInt64(0), r.GetString(1), Str(r, 2), r.GetInt16(3), r.GetDecimal(4), r.IsDBNull(5) ? null : r.GetDecimal(5), r.GetString(6), r.GetBoolean(7),
                r.GetDateTime(8), r.IsDBNull(9) ? null : r.GetDateTime(9), r.IsDBNull(10) ? null : r.GetDateTime(10), (string[])r.GetValue(11), Str(r, 12),
                r.IsDBNull(13) || r.IsDBNull(14) ? null : $"{r.GetString(13)}-{r.GetInt32(14):D8}", r.GetBoolean(15)));
        return list;
    }

    /// <summary>Id del documento del comprobante de un pago PAGADO del tenant (null si no existe, no es suyo o aún no se emitió).</summary>
    public async Task<int?> InvoiceDocumentIdAsync(long tenantId, long paymentId, CancellationToken ct = default)
    {
        await using var c = Open(tenantId);
        await c.OpenAsync(ct);
        await using var q = new NpgsqlCommand("SELECT invoice_document_id FROM tenant_payments WHERE id = @i AND tenant_id = @t AND status = 'paid'", c);
        q.Parameters.AddWithValue("i", paymentId); q.Parameters.AddWithValue("t", tenantId);
        return await q.ExecuteScalarAsync(ct) is int d ? d : null;
    }

    /// <summary>Catálogo público: planes de pago con sus precios por periodo y los complementos. Los precios salen de la base (nunca copiados); caché de 5 minutos.</summary>
    public async Task<Catalog> GetCatalogAsync(CancellationToken ct = default)
    {
        lock (_gate) { if (_catalog is not null && DateTime.UtcNow - _catalogAt < TimeSpan.FromMinutes(5)) return _catalog; }

        await using var c = Open(1);
        await c.OpenAsync(ct);
        var plans = new List<(long Id, string Key, string Name)>();
        await using (var q = new NpgsqlCommand("SELECT id, key, name FROM plans WHERE is_public AND NOT is_internal AND key = ANY(@k) ORDER BY sort, id", c))
        {
            q.Parameters.AddWithValue("k", PlatformCheckout.PaidPlans);
            await using var r = await q.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct)) plans.Add((r.GetInt64(0), r.GetString(1), r.GetString(2)));
        }

        var rows = new List<PlanRow>();
        foreach (var p in plans)
        {
            var prices = new Dictionary<int, decimal>();
            await using (var q = new NpgsqlCommand("SELECT period_months, price_usd FROM plan_prices WHERE plan_id = @p AND active ORDER BY period_months", c))
            {
                q.Parameters.AddWithValue("p", p.Id);
                await using var r = await q.ExecuteReaderAsync(ct);
                while (await r.ReadAsync(ct)) prices[r.GetInt16(0)] = r.GetDecimal(1);
            }
            decimal? channels = null, admins = null; var modules = new List<string>();
            await using (var q = new NpgsqlCommand(@"SELECT capability_key, value FROM plan_entitlements WHERE plan_id = @p
                  AND (capability_key IN ('quota.channels','quota.admins') OR (capability_key LIKE 'module.%' AND value >= 1)) ORDER BY capability_key", c))
            {
                q.Parameters.AddWithValue("p", p.Id);
                await using var r = await q.ExecuteReaderAsync(ct);
                while (await r.ReadAsync(ct))
                {
                    var k = r.GetString(0); var v = r.IsDBNull(1) ? (decimal?)null : r.GetDecimal(1);
                    if (k == "quota.channels") channels = v; else if (k == "quota.admins") admins = v; else modules.Add(k);
                }
            }
            if (prices.Count > 0) rows.Add(new PlanRow(p.Key, p.Name, channels, admins, modules, prices));
        }

        var addonPrices = new SortedDictionary<string, Dictionary<int, decimal>>(StringComparer.Ordinal);
        await using (var q = new NpgsqlCommand("SELECT capability_key, period_months, price_usd FROM addon_prices WHERE active ORDER BY capability_key, period_months", c))
        {
            await using var r = await q.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct))
            {
                var k = r.GetString(0);
                if (!addonPrices.TryGetValue(k, out var d)) addonPrices[k] = d = new();
                d[r.GetInt16(1)] = r.GetDecimal(2);
            }
        }
        var addonRows = addonPrices.Select(kv => new AddonRow(kv.Key, rows.FirstOrDefault(p => p.Modules.Contains(kv.Key))?.Key, kv.Value)).ToList();

        var cat = new Catalog(rows, addonRows);
        lock (_gate) { _catalog = cat; _catalogAt = DateTime.UtcNow; }
        return cat;
    }

    private static string? Str(NpgsqlDataReader r, int i) => r.IsDBNull(i) ? null : r.GetString(i);
}
