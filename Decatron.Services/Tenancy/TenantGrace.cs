using Decatron.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Services.Tenancy;

/// <summary>
/// Plataforma, Fase 7.3: gracia al vencer. Un plan de pago activo cuyo <c>ends_at</c> ya pasó recibe <c>grace_until = ends_at + N días</c>
/// (<c>Platform:Billing:GraceDays</c>, 5 por defecto) y pasa a <c>past_due</c>. <see cref="Entitlements"/> ya trata <c>past_due</c> con gracia vigente como operativo,
/// así que el bot sigue funcionando; al terminar la gracia el tenant deja de ser operativo y <c>TenantLifecycle</c> lo pausa sin borrar nada.
/// Pagar (Fase 7.5) vuelve a <c>active</c> y limpia <c>grace_until</c>. No toca internal, sandbox ni suscripciones sin <c>ends_at</c> (los pilotos).
/// </summary>
public sealed class TenantGrace
{
    private readonly string? _cs;
    private readonly IEntitlements _ent;
    private readonly IConfiguration _cfg;
    private readonly ILogger<TenantGrace> _log;

    public TenantGrace(IConfiguration cfg, IEntitlements ent, ILogger<TenantGrace> log)
    { _cs = cfg.GetConnectionString("DefaultConnection"); _cfg = cfg; _ent = ent; _log = log; }

    public int GraceDays => Math.Clamp(_cfg.GetValue<int?>("Platform:Billing:GraceDays") ?? 5, 0, 30);

    /// <summary>Una pasada sobre todos los tenants (tenant_subscriptions tiene RLS: se recorre uno a uno). Devuelve los que entraron en gracia ahora.</summary>
    public async Task<IReadOnlyList<long>> SweepAsync(CancellationToken ct = default)
    {
        var started = new List<long>();
        var ids = new List<long>();
        await using (var c = TenantNpgsql.Create(_cs, 1))
        {
            await c.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand("SELECT id FROM tenants WHERE id<>1 AND status<>'closed' ORDER BY id", c);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct)) ids.Add(r.GetInt64(0));
        }
        foreach (var id in ids)
        {
            await using var t = TenantNpgsql.Create(_cs, id);
            await t.OpenAsync(ct);
            await using var up = new NpgsqlCommand(@"UPDATE tenant_subscriptions s
                SET status='past_due', grace_until = s.ends_at + make_interval(days => @d), updated_at = now()
                FROM plans p
                WHERE p.id = s.plan_id AND s.tenant_id = @t AND s.status = 'active' AND s.ends_at IS NOT NULL AND s.ends_at < now()
                  AND s.grace_until IS NULL AND p.key NOT IN ('internal','sandbox')", t);
            up.Parameters.AddWithValue("t", id); up.Parameters.AddWithValue("d", GraceDays);
            if (await up.ExecuteNonQueryAsync(ct) > 0)
            {
                started.Add(id);
                _ent.Invalidate(id);
                _log.LogWarning("tenant.grace.start tenant={Tenant} days={Days}", id, GraceDays);
            }
        }
        return started;
    }
}
