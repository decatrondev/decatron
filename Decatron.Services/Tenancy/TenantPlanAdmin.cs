using Decatron.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Services.Tenancy;

public readonly record struct PlanResult(bool Ok, int Status, string? Code, object? Data)
{
    public static PlanResult Success(object? data = null) => new(true, 200, null, data);
    public static PlanResult Fail(int status, string code) => new(false, status, code, null);
}

public sealed class PlanInput
{
    public string? PlanKey { get; set; }
    public string? Status { get; set; }
    public int? PeriodMonths { get; set; }
    public DateTime? EndsAt { get; set; }
    public DateTime? SandboxEndsAt { get; set; }
    public string? SuspendedReason { get; set; }
}

public sealed class ValueInput
{
    public decimal? Value { get; set; }     // null = ilimitado / encendido
    public string? Reason { get; set; }
    public DateTime? ExpiresAt { get; set; }
}

public sealed class AddonInput
{
    public string? CapabilityKey { get; set; }
    public decimal? Value { get; set; }
    public DateTime? EndsAt { get; set; }
    public string? Source { get; set; }
}

/// <summary>
/// Plataforma, Fase 5.7: lo que escribe la pantalla del dueño (plan, estado, ajustes y complementos de un tenant). Todo son filas (FASE5_DISENO §3):
/// nada de esto cambia código. Cada cambio invalida la caché de <see cref="IEntitlements"/> para que se note al instante. El #1 no se edita.
/// </summary>
public sealed class TenantPlanAdmin
{
        private static readonly string[] Statuses = { "sandbox", "active", "past_due", "suspended", "cancelled" };
        private static readonly string[] AddonSources = { "purchase", "gift", "pilot" };
        private static readonly int[] Periods = { 1, 3, 6, 9, 12 };

        private readonly IConfiguration _config;
        private readonly IEntitlements _ent;
        private readonly ILogger<TenantPlanAdmin> _log;

        public TenantPlanAdmin(IConfiguration config, IEntitlements ent, ILogger<TenantPlanAdmin> log)
        { _config = config; _ent = ent; _log = log; }
        private NpgsqlConnection Open(long tenant) => TenantNpgsql.Create(_config.GetConnectionString("DefaultConnection"), tenant);

        private async Task<bool> TenantExistsAsync(long id)
        {
            await using var c = Open(1); await c.OpenAsync();
            await using var cmd = new NpgsqlCommand("SELECT 1 FROM tenants WHERE id=@id", c);
            cmd.Parameters.AddWithValue("id", id);
            return await cmd.ExecuteScalarAsync() != null;
        }




        /// <summary>Planes con sus capacidades y el catálogo de capacidades (para armar los selectores).</summary>
        public async Task<PlanResult> CatalogAsync()
        {
            await using var c = Open(1); await c.OpenAsync();
            var plans = new List<object>(); var caps = new List<object>();
            await using (var cmd = new NpgsqlCommand("SELECT key, name, is_internal, is_public FROM plans ORDER BY sort, id", c))
            await using (var r = await cmd.ExecuteReaderAsync())
                while (await r.ReadAsync()) plans.Add(new { key = r.GetString(0), name = r.GetString(1), isInternal = r.GetBoolean(2), isPublic = r.GetBoolean(3) });
            await using (var cmd = new NpgsqlCommand("SELECT key, kind, unit, group_key, description FROM capabilities WHERE active ORDER BY sort, key", c))
            await using (var r = await cmd.ExecuteReaderAsync())
                while (await r.ReadAsync()) caps.Add(new { key = r.GetString(0), kind = r.GetString(1), unit = r.IsDBNull(2) ? null : r.GetString(2), group = r.GetString(3), description = r.GetString(4) });
            return PlanResult.Success(new { success = true, plans, capabilities = caps });
        }

        /// <summary>Suscripción, complementos, ajustes y uso de un tenant.</summary>
        public async Task<PlanResult> GetAsync(long id)
        {
            if (!await TenantExistsAsync(id)) return PlanResult.Fail(404, "tenant_not_found");
            await using var c = Open(id); await c.OpenAsync();
            object? sub = null; var overrides = new List<object>(); var addons = new List<object>(); var usage = new List<object>();
            await using (var cmd = new NpgsqlCommand(@"SELECT p.key, p.name, s.status, s.period_months, s.starts_at, s.ends_at, s.grace_until, s.sandbox_ends_at, s.suspended_reason
                FROM tenant_subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.tenant_id=@t AND s.status <> 'cancelled' LIMIT 1", c))
            {
                cmd.Parameters.AddWithValue("t", id);
                await using var r = await cmd.ExecuteReaderAsync();
                if (await r.ReadAsync())
                    sub = new { planKey = r.GetString(0), planName = r.GetString(1), status = r.GetString(2), periodMonths = r.IsDBNull(3) ? (int?)null : r.GetInt16(3),
                        startsAt = r.GetDateTime(4), endsAt = r.IsDBNull(5) ? (DateTime?)null : r.GetDateTime(5), graceUntil = r.IsDBNull(6) ? (DateTime?)null : r.GetDateTime(6),
                        sandboxEndsAt = r.IsDBNull(7) ? (DateTime?)null : r.GetDateTime(7), suspendedReason = r.IsDBNull(8) ? null : r.GetString(8) };
            }
            await using (var cmd = new NpgsqlCommand("SELECT capability_key, value, reason, source, expires_at FROM tenant_entitlement_overrides WHERE tenant_id=@t ORDER BY capability_key", c))
            {
                cmd.Parameters.AddWithValue("t", id);
                await using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync()) overrides.Add(new { key = r.GetString(0), value = r.IsDBNull(1) ? (decimal?)null : r.GetDecimal(1), reason = r.IsDBNull(2) ? null : r.GetString(2), source = r.GetString(3), expiresAt = r.IsDBNull(4) ? (DateTime?)null : r.GetDateTime(4) });
            }
            await using (var cmd = new NpgsqlCommand("SELECT id, capability_key, value, starts_at, ends_at, source FROM tenant_addons WHERE tenant_id=@t ORDER BY capability_key, id", c))
            {
                cmd.Parameters.AddWithValue("t", id);
                await using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync()) addons.Add(new { id = r.GetInt64(0), key = r.GetString(1), value = r.IsDBNull(2) ? (decimal?)null : r.GetDecimal(2), startsAt = r.GetDateTime(3), endsAt = r.IsDBNull(4) ? (DateTime?)null : r.GetDateTime(4), source = r.GetString(5) });
            }
            await using (var cmd = new NpgsqlCommand("SELECT capability_key, period_start, used FROM usage_counters WHERE tenant_id=@t AND period_start >= date_trunc('month', now())::date - interval '1 month' ORDER BY period_start DESC, capability_key", c))
            {
                cmd.Parameters.AddWithValue("t", id);
                await using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync()) usage.Add(new { key = r.GetString(0), periodStart = r.GetDateTime(1).ToString("yyyy-MM-dd"), used = r.GetInt64(2) });
            }
            long channels, admins;
            await using (var cmd = new NpgsqlCommand("SELECT (SELECT count(*) FROM channels WHERE tenant_id=@t), (SELECT count(*) FROM tenant_members WHERE tenant_id=@t AND role <> 'viewer')", c))
            {
                cmd.Parameters.AddWithValue("t", id);
                await using var r = await cmd.ExecuteReaderAsync(); await r.ReadAsync();
                channels = r.GetInt64(0); admins = r.GetInt64(1);
            }
            var operational = await _ent.IsOperationalAsync(id, live: true);
            var chLimit = (await _ent.LimitAsync("quota.channels", id, live: true)).Limit;
            var adLimit = (await _ent.LimitAsync("quota.admins", id, live: true)).Limit;
            return PlanResult.Success(new { success = true, subscription = sub, overrides, addons, usage, operational, channels = new { used = channels, limit = chLimit }, admins = new { used = admins, limit = adLimit } });
        }

        /// <summary>Asigna o cambia el plan y el estado. Crea la suscripción si no existe.</summary>
        public async Task<PlanResult> SetPlanAsync(long id, PlanInput body, string actor)
        {
            if (id == 1) return PlanResult.Fail(400, "tenant_one");
            if (!await TenantExistsAsync(id)) return PlanResult.Fail(404, "tenant_not_found");
            if (string.IsNullOrWhiteSpace(body.PlanKey)) return PlanResult.Fail(400, "plan_required");
            var status = body.Status ?? "active";
            if (!Statuses.Contains(status)) return PlanResult.Fail(400, "bad_status");
            if (body.PeriodMonths is int pm && !Periods.Contains(pm)) return PlanResult.Fail(400, "bad_period");

            await using var c = Open(id); await c.OpenAsync();
            long? planId; bool internalPlan;
            await using (var cmd = new NpgsqlCommand("SELECT id, is_internal FROM plans WHERE key=@k", c))
            {
                cmd.Parameters.AddWithValue("k", body.PlanKey);
                await using var r = await cmd.ExecuteReaderAsync();
                if (!await r.ReadAsync()) return PlanResult.Fail(404, "plan_not_found");
                planId = r.GetInt64(0); internalPlan = r.GetBoolean(1);
            }
            if (internalPlan) return PlanResult.Fail(400, "plan_internal");   // el plan interno es solo del #1

            var sandboxEnds = status == "sandbox" ? (body.SandboxEndsAt ?? DateTime.UtcNow.AddDays(7)) : body.SandboxEndsAt;
            await using var tx = await c.BeginTransactionAsync();
            await using (var cmd = new NpgsqlCommand(@"
                UPDATE tenant_subscriptions SET plan_id=@p, status=@s, period_months=@pm, ends_at=@e, sandbox_ends_at=@se, suspended_reason=@sr, updated_at=now()
                WHERE tenant_id=@t AND status <> 'cancelled'", c, tx))
            {
                Bind(cmd, id, planId.Value, status, body, sandboxEnds);
                if (await cmd.ExecuteNonQueryAsync() == 0)
                {
                    await using var ins = new NpgsqlCommand(@"
                        INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, period_months, ends_at, sandbox_ends_at, suspended_reason)
                        VALUES (@t, @p, @s, @pm, @e, @se, @sr)", c, tx);
                    Bind(ins, id, planId.Value, status, body, sandboxEnds);
                    await ins.ExecuteNonQueryAsync();
                }
            }
            await tx.CommitAsync();
            _ent.Invalidate(id);
            _log.LogInformation("platform.plan.set tenant={Tenant} plan={Plan} status={Status} actor={Actor}", id, body.PlanKey, status, actor);
            return PlanResult.Success();
        }

        private static void Bind(NpgsqlCommand cmd, long tenant, long planId, string status, PlanInput b, DateTime? sandboxEnds)
        {
            cmd.Parameters.AddWithValue("t", tenant);
            cmd.Parameters.AddWithValue("p", planId);
            cmd.Parameters.AddWithValue("s", status);
            cmd.Parameters.AddWithValue("pm", b.PeriodMonths is int m ? (object)(short)m : DBNull.Value);
            cmd.Parameters.AddWithValue("e", b.EndsAt is DateTime e ? (object)e.ToUniversalTime() : DBNull.Value);
            cmd.Parameters.AddWithValue("se", sandboxEnds is DateTime se ? (object)se.ToUniversalTime() : DBNull.Value);
            cmd.Parameters.AddWithValue("sr", status == "suspended" && !string.IsNullOrWhiteSpace(b.SuspendedReason) ? b.SuspendedReason!.Trim()[..Math.Min(200, b.SuspendedReason!.Trim().Length)] : DBNull.Value);
        }

        private async Task<bool> CapabilityExistsAsync(NpgsqlConnection c, string key)
        {
            await using var cmd = new NpgsqlCommand("SELECT 1 FROM capabilities WHERE key=@k AND active", c);
            cmd.Parameters.AddWithValue("k", key);
            return await cmd.ExecuteScalarAsync() != null;
        }

        /// <summary>Ajuste puntual de una capacidad para el tenant (gana sobre complemento y plan).</summary>
        public async Task<PlanResult> SetOverrideAsync(long id, string key, ValueInput body, string actor)
        {
            if (id == 1) return PlanResult.Fail(400, "tenant_one");
            if (!await TenantExistsAsync(id)) return PlanResult.Fail(404, "tenant_not_found");
            await using var c = Open(id); await c.OpenAsync();
            if (!await CapabilityExistsAsync(c, key)) return PlanResult.Fail(404, "capability_not_found");
            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO tenant_entitlement_overrides (tenant_id, capability_key, value, reason, source, expires_at) VALUES (@t, @k, @v, @r, @src, @e)
                ON CONFLICT (tenant_id, capability_key) DO UPDATE SET value=@v, reason=@r, source=@src, expires_at=@e", c);
            cmd.Parameters.AddWithValue("t", id);
            cmd.Parameters.AddWithValue("k", key);
            cmd.Parameters.AddWithValue("v", body.Value is decimal v ? (object)v : DBNull.Value);
            cmd.Parameters.AddWithValue("r", string.IsNullOrWhiteSpace(body.Reason) ? DBNull.Value : body.Reason!.Trim()[..Math.Min(200, body.Reason!.Trim().Length)]);
            cmd.Parameters.AddWithValue("src", "custom");
            cmd.Parameters.AddWithValue("e", body.ExpiresAt is DateTime e ? (object)e.ToUniversalTime() : DBNull.Value);
            await cmd.ExecuteNonQueryAsync();
            _ent.Invalidate(id);
            _log.LogInformation("platform.override.set tenant={Tenant} key={Key} actor={Actor}", id, key, actor);
            return PlanResult.Success();
        }

        public async Task<PlanResult> DeleteOverrideAsync(long id, string key, string actor)
        {
            if (id == 1) return PlanResult.Fail(400, "tenant_one");
            await using var c = Open(id); await c.OpenAsync();
            await using var cmd = new NpgsqlCommand("DELETE FROM tenant_entitlement_overrides WHERE tenant_id=@t AND capability_key=@k", c);
            cmd.Parameters.AddWithValue("t", id); cmd.Parameters.AddWithValue("k", key);
            var n = await cmd.ExecuteNonQueryAsync();
            _ent.Invalidate(id);
            _log.LogInformation("platform.override.delete tenant={Tenant} key={Key} actor={Actor}", id, key, actor);
            return n > 0 ? PlanResult.Success() : PlanResult.Fail(404, "override_not_found");
        }

        /// <summary>Complemento (módulo o cuota suelta). Su vencimiento se alinea con el de la suscripción cuando no se indica fecha.</summary>
        public async Task<PlanResult> AddAddonAsync(long id, AddonInput body, string actor)
        {
            if (id == 1) return PlanResult.Fail(400, "tenant_one");
            if (!await TenantExistsAsync(id)) return PlanResult.Fail(404, "tenant_not_found");
            if (string.IsNullOrWhiteSpace(body.CapabilityKey)) return PlanResult.Fail(400, "capability_required");
            var source = body.Source ?? "purchase";
            if (!AddonSources.Contains(source)) return PlanResult.Fail(400, "bad_source");
            await using var c = Open(id); await c.OpenAsync();
            if (!await CapabilityExistsAsync(c, body.CapabilityKey)) return PlanResult.Fail(404, "capability_not_found");
            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO tenant_addons (tenant_id, capability_key, value, ends_at, source)
                VALUES (@t, @k, @v, COALESCE(@e, (SELECT ends_at FROM tenant_subscriptions WHERE tenant_id=@t AND status <> 'cancelled' LIMIT 1)), @src) RETURNING id", c);
            cmd.Parameters.AddWithValue("t", id);
            cmd.Parameters.AddWithValue("k", body.CapabilityKey);
            cmd.Parameters.AddWithValue("v", body.Value is decimal v ? (object)v : DBNull.Value);
            cmd.Parameters.AddWithValue("e", body.EndsAt is DateTime e ? (object)e.ToUniversalTime() : DBNull.Value);
            cmd.Parameters.AddWithValue("src", source);
            var newId = await cmd.ExecuteScalarAsync();
            _ent.Invalidate(id);
            _log.LogInformation("platform.addon.add tenant={Tenant} key={Key} actor={Actor}", id, body.CapabilityKey, actor);
            return PlanResult.Success(new { success = true, id = newId });
        }

        public async Task<PlanResult> DeleteAddonAsync(long id, long addonId, string actor)
        {
            if (id == 1) return PlanResult.Fail(400, "tenant_one");
            await using var c = Open(id); await c.OpenAsync();
            await using var cmd = new NpgsqlCommand("DELETE FROM tenant_addons WHERE tenant_id=@t AND id=@i", c);
            cmd.Parameters.AddWithValue("t", id); cmd.Parameters.AddWithValue("i", addonId);
            var n = await cmd.ExecuteNonQueryAsync();
            _ent.Invalidate(id);
            _log.LogInformation("platform.addon.delete tenant={Tenant} addon={Addon} actor={Actor}", id, addonId, actor);
            return n > 0 ? PlanResult.Success() : PlanResult.Fail(404, "addon_not_found");
        }
}
