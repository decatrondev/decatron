using System.Collections.Concurrent;
using Decatron.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Services.Tenancy;

/// <summary>Implementación de <see cref="IEntitlements"/> (Fase 5.3). Lee catálogo y estado del tenant con una conexión fijada a ese tenant (RLS) y los guarda 30 s.</summary>
public sealed class Entitlements : IEntitlements
{
    private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(30);

    private sealed record Snapshot(DateTime At, bool Operational, IReadOnlyDictionary<string, decimal?> Values, IReadOnlyDictionary<string, (string Meter, string? Period)> Meters);

    private readonly string? _cs;
    private readonly ILogger<Entitlements> _log;
    private readonly ConcurrentDictionary<long, Snapshot> _cache = new();
    private readonly ConcurrentDictionary<(long Tenant, string Key), long> _pending = new();

    public Entitlements(IConfiguration cfg, ILogger<Entitlements> log)
    {
        _cs = cfg.GetConnectionString("DefaultConnection");
        _log = log;
    }

    private static long Resolve(long? tenantId) => tenantId ?? TenantAmbient.Current ?? 1;

    public void Invalidate(long? tenantId = null)
    {
        if (tenantId is long t) _cache.TryRemove(t, out _); else _cache.Clear();
    }

    /// <summary>Devuelve la foto del tenant; null si no se pudo leer y no hay una anterior (el llamador decide según <c>live</c>).</summary>
    private async Task<Snapshot?> GetAsync(long tenant, CancellationToken ct)
    {
        _cache.TryGetValue(tenant, out var cached);
        if (cached != null && DateTime.UtcNow - cached.At < CacheFor) return cached;
        try
        {
            var fresh = await LoadAsync(tenant, ct);
            _cache[tenant] = fresh;
            return fresh;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _log.LogWarning("entitlements.load.failed tenant={Tenant} {Type}; se usa {Fallback}", tenant, ex.GetType().Name, cached != null ? "la caché anterior" : "el modo de falla");
            return cached;
        }
    }

    private async Task<Snapshot> LoadAsync(long tenant, CancellationToken ct)
    {
        await using var c = TenantNpgsql.Create(_cs, tenant);
        await c.OpenAsync(ct);

        var values = new Dictionary<string, decimal?>();
        var meters = new Dictionary<string, (string, string?)>();
        await using (var cmd = new NpgsqlCommand("SELECT key, default_value, meter, period FROM capabilities WHERE active", c))
        await using (var r = await cmd.ExecuteReaderAsync(ct))
            while (await r.ReadAsync(ct))
            {
                values[r.GetString(0)] = r.IsDBNull(1) ? null : r.GetDecimal(1);
                meters[r.GetString(0)] = (r.GetString(2), r.IsDBNull(3) ? null : r.GetString(3));
            }

        // estado de la suscripción vigente
        long? planId = null; string? status = null; DateTime? endsAt = null, graceUntil = null, sandboxEnds = null;
        await using (var cmd = new NpgsqlCommand(
            "SELECT plan_id, status, ends_at, grace_until, sandbox_ends_at FROM tenant_subscriptions WHERE tenant_id = @t AND status <> 'cancelled' LIMIT 1", c))
        {
            cmd.Parameters.AddWithValue("t", tenant);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            if (await r.ReadAsync(ct))
            {
                planId = r.GetInt64(0); status = r.GetString(1);
                endsAt = r.IsDBNull(2) ? null : r.GetDateTime(2);
                graceUntil = r.IsDBNull(3) ? null : r.GetDateTime(3);
                sandboxEnds = r.IsDBNull(4) ? null : r.GetDateTime(4);
            }
        }
        var now = DateTime.UtcNow;
        var operational = status switch
        {
            "active" => endsAt is null || endsAt > now || (graceUntil != null && graceUntil > now),
            "past_due" => graceUntil != null && graceUntil > now,
            "sandbox" => sandboxEnds is null || sandboxEnds > now,
            _ => false // suspended, cancelled o sin suscripción: falla cerrado
        };

        if (planId is long pid)
        {
            await using var cmd = new NpgsqlCommand("SELECT capability_key, value FROM plan_entitlements WHERE plan_id = @p", c);
            cmd.Parameters.AddWithValue("p", pid);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct))
                if (values.ContainsKey(r.GetString(0))) values[r.GetString(0)] = r.IsDBNull(1) ? null : r.GetDecimal(1);
        }

        // complementos vigentes: varios sobre la misma capacidad → gana el mayor; NULL (ilimitado) gana siempre
        var addons = new Dictionary<string, decimal?>();
        await using (var cmd = new NpgsqlCommand(
            "SELECT capability_key, value FROM tenant_addons WHERE tenant_id = @t AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())", c))
        {
            cmd.Parameters.AddWithValue("t", tenant);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct))
            {
                var k = r.GetString(0); decimal? v = r.IsDBNull(1) ? null : r.GetDecimal(1);
                if (!addons.TryGetValue(k, out var prev)) addons[k] = v;
                else if (prev is not null) addons[k] = v is null ? null : Math.Max(prev.Value, v.Value);
            }
        }
        foreach (var (k, v) in addons) if (values.ContainsKey(k)) values[k] = v;

        await using (var cmd = new NpgsqlCommand(
            "SELECT capability_key, value FROM tenant_entitlement_overrides WHERE tenant_id = @t AND (expires_at IS NULL OR expires_at > now())", c))
        {
            cmd.Parameters.AddWithValue("t", tenant);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct))
                if (values.ContainsKey(r.GetString(0))) values[r.GetString(0)] = r.IsDBNull(1) ? null : r.GetDecimal(1);
        }
        return new Snapshot(DateTime.UtcNow, operational, values, meters);
    }

    public void Count(string key, long amount = 1, long? tenantId = null)
    {
        var t = Resolve(tenantId);
        if (t == 1 || amount <= 0) return;
        _pending.AddOrUpdate((t, key), amount, (_, old) => old + amount);
    }

    public async Task FlushAsync(CancellationToken ct = default)
    {
        foreach (var k in _pending.Keys.ToArray())
        {
            // se toma lo acumulado y se deja en cero; si el guardado falla se devuelve para el siguiente intento
            long n = 0;
            _pending.AddOrUpdate(k, 0, (_, old) => { n = old; return 0; });
            if (n <= 0) { _pending.TryRemove(new KeyValuePair<(long, string), long>(k, 0)); continue; }
            try { await AddUsageAsync(k.Tenant, k.Key, n, ct); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _pending.AddOrUpdate(k, n, (_, old) => old + n);
                _log.LogWarning("entitlements.flush.failed tenant={Tenant} key={Key} {Type}", k.Tenant, k.Key, ex.GetType().Name);
            }
        }
    }

    /// <summary>Suma al contador del periodo sin condición (medir, no cortar) y deja el aviso del 80 % o del tope al cruzarlos.</summary>
    private async Task AddUsageAsync(long tenant, string key, long amount, CancellationToken ct)
    {
        var s = await GetAsync(tenant, ct);
        var period = s != null && s.Meters.TryGetValue(key, out var m) ? m.Period : null;
        var start = period switch
        {
            "day" => DateTime.UtcNow.Date,
            "month" => new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1),
            _ => new DateTime(2000, 1, 1)
        };
        await using var c = TenantNpgsql.Create(_cs, tenant);
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(@"
            INSERT INTO usage_counters (tenant_id, capability_key, period_start, used) VALUES (@t, @k, @d, @n)
            ON CONFLICT (tenant_id, capability_key, period_start) DO UPDATE SET used = usage_counters.used + @n, updated_at = now()
            RETURNING used", c);
        cmd.Parameters.AddWithValue("t", tenant);
        cmd.Parameters.AddWithValue("k", key);
        cmd.Parameters.AddWithValue("d", start);
        cmd.Parameters.AddWithValue("n", amount);
        var used = Convert.ToInt64(await cmd.ExecuteScalarAsync(ct));
        if (s != null && s.Values.TryGetValue(key, out var limit) && limit is not null)
        {
            var before = used - amount;
            if (before <= limit && used > limit) await RecordAsync(tenant, key, "blocked", used, limit, ct);
            else if (before * 100m < limit * 80m && used * 100m >= limit * 80m) await RecordAsync(tenant, key, "warn80", used, limit, ct);
        }
    }

    public async Task<bool> IsOperationalAsync(long? tenantId = null, bool live = false, CancellationToken ct = default)
    {
        var t = Resolve(tenantId);
        if (t == 1) return true;
        var s = await GetAsync(t, ct);
        return s?.Operational ?? live;
    }

    public async Task<bool> HasAsync(string flag, long? tenantId = null, bool live = false, CancellationToken ct = default)
    {
        var t = Resolve(tenantId);
        if (t == 1) return true;
        var s = await GetAsync(t, ct);
        if (s is null) return live;
        if (!s.Operational) return false;
        return s.Values.TryGetValue(flag, out var v) && (v is null || v > 0);
    }

    public async Task<(bool Operational, decimal? Limit)> LimitAsync(string key, long? tenantId = null, bool live = false, CancellationToken ct = default)
    {
        var t = Resolve(tenantId);
        if (t == 1) return (true, null);
        var s = await GetAsync(t, ct);
        if (s is null) return (live, null);
        if (!s.Operational) return (false, 0);
        // una capacidad desconocida no se limita por adivinanza: falla cerrado (tope 0)
        return s.Values.TryGetValue(key, out var v) ? (true, v) : (true, 0);
    }

    public async Task<EntitlementResult> CheckGaugeAsync(string key, long current, long adding = 1, long? tenantId = null, CancellationToken ct = default)
    {
        var (ok, limit) = await LimitAsync(key, tenantId, live: false, ct);
        if (!ok) return new(EntitlementOutcome.Blocked, current, limit, "not_operational");
        if (limit is null) return EntitlementResult.Ok(current, null);
        if (current + adding > limit) { await RecordAsync(Resolve(tenantId), key, "blocked", current, limit, ct); return new(EntitlementOutcome.Blocked, current, limit, "limit_reached"); }
        return current + adding >= limit * 0.8m
            ? new(EntitlementOutcome.AllowedWarn80, current + adding, limit)
            : EntitlementResult.Ok(current + adding, limit);
    }

    public async Task<EntitlementResult> TryConsumeAsync(string key, long amount = 1, long? tenantId = null, bool live = false, CancellationToken ct = default)
    {
        var t = Resolve(tenantId);
        if (t == 1) return EntitlementResult.Ok();
        var s = await GetAsync(t, ct);
        if (s is null)
        {
            await RecordAsync(t, key, "failopen", null, null, ct);
            return live ? EntitlementResult.Ok() : new(EntitlementOutcome.Blocked, 0, null, "unavailable");
        }
        if (!s.Operational) return new(EntitlementOutcome.Blocked, 0, 0, "not_operational");
        if (!s.Values.TryGetValue(key, out var limit)) return new(EntitlementOutcome.Blocked, 0, 0, "unknown_capability");
        var period = s.Meters.TryGetValue(key, out var m) ? m.Period : null;
        var start = period switch
        {
            "day" => DateTime.UtcNow.Date,
            "month" => new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1),
            _ => new DateTime(2000, 1, 1)
        };
        if (limit is not null && amount > limit) { await RecordAsync(t, key, "blocked", 0, limit, ct); return new(EntitlementOutcome.Blocked, 0, limit, "limit_reached"); }

        try
        {
            await using var c = TenantNpgsql.Create(_cs, t);
            await c.OpenAsync(ct);
            // incremento atómico: con tope, solo si cabe (sin fila devuelta = no cupo)
            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO usage_counters (tenant_id, capability_key, period_start, used) VALUES (@t, @k, @d, @n)
                ON CONFLICT (tenant_id, capability_key, period_start)
                DO UPDATE SET used = usage_counters.used + @n, updated_at = now()
                " + (limit is null ? "" : "WHERE usage_counters.used + @n <= @lim ") + @"
                RETURNING used", c);
            cmd.Parameters.AddWithValue("t", t);
            cmd.Parameters.AddWithValue("k", key);
            cmd.Parameters.AddWithValue("d", start);
            cmd.Parameters.AddWithValue("n", amount);
            if (limit is not null) cmd.Parameters.AddWithValue("lim", limit.Value);
            var used = await cmd.ExecuteScalarAsync(ct);
            if (used is null)
            {
                await RecordAsync(t, key, "blocked", null, limit, ct);
                return new(EntitlementOutcome.Blocked, 0, limit, "limit_reached");
            }
            var u = Convert.ToInt64(used);
            if (limit is not null && u * 100m >= limit * 80m && (u - amount) * 100m < limit * 80m)
            {
                await RecordAsync(t, key, "warn80", u, limit, ct);
                return new(EntitlementOutcome.AllowedWarn80, u, limit);
            }
            return EntitlementResult.Ok(u, limit);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _log.LogWarning("entitlements.consume.failed tenant={Tenant} key={Key} {Type}", t, key, ex.GetType().Name);
            await RecordAsync(t, key, "failopen", null, limit, ct);
            return live ? EntitlementResult.Ok() : new(EntitlementOutcome.Blocked, 0, limit, "unavailable");
        }
    }

    /// <summary>Registro solo-inserción; nunca lanza (un fallo del registro no debe cambiar la decisión).</summary>
    private async Task RecordAsync(long tenant, string key, string kind, long? used, decimal? limit, CancellationToken ct)
    {
        try
        {
            await using var c = TenantNpgsql.Create(_cs, tenant);
            await c.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(
                "INSERT INTO entitlement_events (tenant_id, capability_key, kind, used, \"limit\") VALUES (@t, @k, @kind, @u, @l)", c);
            cmd.Parameters.AddWithValue("t", tenant);
            cmd.Parameters.AddWithValue("k", key);
            cmd.Parameters.AddWithValue("kind", kind);
            cmd.Parameters.AddWithValue("u", (object?)used ?? DBNull.Value);
            cmd.Parameters.AddWithValue("l", (object?)limit ?? DBNull.Value);
            await cmd.ExecuteNonQueryAsync(ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _log.LogWarning("entitlements.event.failed tenant={Tenant} key={Key} kind={Kind} {Type}", tenant, key, kind, ex.GetType().Name);
        }
    }
}
