using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Decatron.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Services.Tenancy;

/// <summary>
/// Plataforma, Fase 5.6: exportación y borrado de los datos de un tenant. El #1 (Decatron) jamás se exporta ni se borra por aquí.
/// Exportar: un zip con un JSONL por tabla del tenant, SIN credenciales ni columnas de tokens/secretos. Borrar: solo si el tenant no está operativo
/// y con confirmación del slug; borra todas sus filas (la RLS y el filtro explícito lo acotan), las cuentas que eran solo suyas, sus credenciales y
/// deja el tenant en estado «closed» (la fila de <c>tenants</c> y los registros de auditoría se conservan).
/// </summary>
public sealed class TenantDataAdmin
{
    // Tablas del tenant que nunca salen en una exportación (secretos y registros internos de acceso).
    private static readonly HashSet<string> ExportExcluded = new(StringComparer.OrdinalIgnoreCase)
        { "tenant_credentials", "tenant_keys", "credential_access_log", "bot_tokens" };
    // Se conservan al borrar: son de solo inserción para la app (auditoría).
    private static readonly HashSet<string> PurgeKeep = new(StringComparer.OrdinalIgnoreCase)
        { "credential_access_log", "entitlement_events" };
    private static readonly Regex Secretish = new(@"token|secret|password|passwd|api_?key|stream_?key|private_?key|authorization", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly string? _cs;
    private readonly IEntitlements _ent;
    private readonly ILogger<TenantDataAdmin> _log;

    public TenantDataAdmin(IConfiguration cfg, IEntitlements ent, ILogger<TenantDataAdmin> log)
    { _cs = cfg.GetConnectionString("DefaultConnection"); _ent = ent; _log = log; }

    private NpgsqlConnection Open(long tenant) => TenantNpgsql.Create(_cs, tenant);

    private static async Task<List<string>> TenantTablesAsync(NpgsqlConnection c)
    {
        var list = new List<string>();
        await using var cmd = new NpgsqlCommand(@"SELECT t.table_name FROM information_schema.tables t
            WHERE t.table_schema='public' AND t.table_type='BASE TABLE'
              AND EXISTS (SELECT 1 FROM information_schema.columns k WHERE k.table_schema='public' AND k.table_name=t.table_name AND k.column_name='tenant_id')
            ORDER BY 1", c);
        await using var r = await cmd.ExecuteReaderAsync();
        while (await r.ReadAsync()) list.Add(r.GetString(0));
        return list;
    }

    private static string Quote(string ident) => "\"" + ident.Replace("\"", "\"\"") + "\"";

    /// <summary>Escribe el zip de exportación en <paramref name="output"/>. Devuelve el conteo de filas por tabla.</summary>
    public async Task<PlanResult> ExportAsync(long tenantId, Stream output, string actor, CancellationToken ct = default)
    {
        if (tenantId == 1) return PlanResult.Fail(400, "tenant_one");
        string slug;
        await using (var c1 = Open(1))
        {
            await c1.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand("SELECT slug FROM tenants WHERE id=@id", c1);
            cmd.Parameters.AddWithValue("id", tenantId);
            if (await cmd.ExecuteScalarAsync(ct) is not string s) return PlanResult.Fail(404, "tenant_not_found");
            slug = s;
        }

        var counts = new SortedDictionary<string, long>();
        await using var c = Open(tenantId);
        await c.OpenAsync(ct);
        var tables = (await TenantTablesAsync(c)).Where(t => !ExportExcluded.Contains(t)).ToList();
        using var zip = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true);
        foreach (var table in tables)
        {
            ct.ThrowIfCancellationRequested();
            // columnas visibles: sin nada que parezca token o secreto
            var cols = new List<string>();
            await using (var cc = new NpgsqlCommand("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=@t ORDER BY ordinal_position", c))
            {
                cc.Parameters.AddWithValue("t", table);
                await using var cr = await cc.ExecuteReaderAsync(ct);
                while (await cr.ReadAsync(ct)) if (!Secretish.IsMatch(cr.GetString(0))) cols.Add(cr.GetString(0));
            }
            if (cols.Count == 0) continue;
            await using var q = new NpgsqlCommand($"SELECT {string.Join(", ", cols.Select(Quote))} FROM {Quote(table)} WHERE tenant_id = @t", c) { CommandTimeout = 600 };
            q.Parameters.AddWithValue("t", tenantId);
            await using var rd = await q.ExecuteReaderAsync(ct);
            long n = 0; ZipArchiveEntry? entry = null; StreamWriter? w = null;
            try
            {
                while (await rd.ReadAsync(ct))
                {
                    if (entry is null) { entry = zip.CreateEntry($"{table}.jsonl", CompressionLevel.Fastest); w = new StreamWriter(entry.Open(), new UTF8Encoding(false)); }
                    var row = new Dictionary<string, object?>(cols.Count);
                    for (var i = 0; i < cols.Count; i++) row[cols[i]] = rd.IsDBNull(i) ? null : Safe(rd.GetValue(i));
                    await w!.WriteLineAsync(JsonSerializer.Serialize(row));
                    n++;
                }
            }
            finally { if (w != null) { await w.FlushAsync(); await w.DisposeAsync(); } }
            if (n > 0) counts[table] = n;
        }

        // Con identidad por tenant (A2) `users` lleva tenant_id y ya salió arriba, sin columnas de tokens. Este bloque solo cubre el modo antiguo
        // (cuentas globales de tenant_id 1 que tienen canal o membresía aquí): sin él se escribiría un segundo users.jsonl con el mismo nombre.
        if (!counts.ContainsKey("users"))
        await using (var uq = new NpgsqlCommand(@"SELECT u.id, u.login, u.display_name, u.created_at FROM users u
            WHERE EXISTS (SELECT 1 FROM channels ch WHERE ch.user_id=u.id AND ch.tenant_id=@t) OR EXISTS (SELECT 1 FROM tenant_members m WHERE m.user_id=u.id AND m.tenant_id=@t)", c))
        {
            uq.Parameters.AddWithValue("t", tenantId);
            await using var rd = await uq.ExecuteReaderAsync(ct);
            long n = 0; ZipArchiveEntry? entry = null; StreamWriter? w = null;
            try
            {
                while (await rd.ReadAsync(ct))
                {
                    if (entry is null) { entry = zip.CreateEntry("users.jsonl", CompressionLevel.Fastest); w = new StreamWriter(entry.Open(), new UTF8Encoding(false)); }
                    await w!.WriteLineAsync(JsonSerializer.Serialize(new { id = rd.GetInt64(0), login = rd.GetString(1), display_name = rd.IsDBNull(2) ? null : rd.GetString(2), created_at = rd.GetValue(3) }));
                    n++;
                }
            }
            finally { if (w != null) { await w.FlushAsync(); await w.DisposeAsync(); } }
            if (n > 0) counts["users"] = n;
        }

        var manifest = zip.CreateEntry("MANIFEST.json");
        await using (var mw = manifest.Open())
            await JsonSerializer.SerializeAsync(mw, new { tenant = slug, tenantId, exportedAt = DateTime.UtcNow, tables = counts, note = "Sin credenciales ni columnas de tokens/secretos." }, new JsonSerializerOptions { WriteIndented = true }, ct);
        _log.LogInformation("platform.tenant.export tenant={Tenant} tables={Tables} rows={Rows} actor={Actor}", tenantId, counts.Count, counts.Values.Sum(), actor);
        return PlanResult.Success(new { success = true, tables = counts.Count, rows = counts.Values.Sum() });
    }

    private static object? Safe(object v) => v switch
    {
        byte[] b => Convert.ToBase64String(b),
        System.Collections.BitArray => v.ToString(),
        _ => v
    };

    /// <summary>Borra todos los datos del tenant. Exige confirmación con el slug y que el tenant no esté operativo.</summary>
    public async Task<PlanResult> PurgeAsync(long tenantId, string? confirmSlug, string actor, CancellationToken ct = default)
    {
        if (tenantId == 1) return PlanResult.Fail(400, "tenant_one");
        string slug, status;
        await using (var c1 = Open(1))
        {
            await c1.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand("SELECT slug, status FROM tenants WHERE id=@id", c1);
            cmd.Parameters.AddWithValue("id", tenantId);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) return PlanResult.Fail(404, "tenant_not_found");
            slug = r.GetString(0); status = r.GetString(1);
        }
        if (!string.Equals(confirmSlug?.Trim(), slug, StringComparison.Ordinal)) return PlanResult.Fail(400, "confirm_mismatch");
        _ent.Invalidate(tenantId);
        if (await _ent.IsOperationalAsync(tenantId, live: false, ct)) return PlanResult.Fail(409, "tenant_operational");

        var deleted = new SortedDictionary<string, long>();
        var usersRemoved = 0; var usersKept = 0;
        await using var c = Open(tenantId);
        await c.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);

        // cuentas que eran solo de este tenant (se identifican ANTES de borrar sus canales y membresías)
        var userIds = new List<long>();
        await using (var uq = new NpgsqlCommand(@"
            SELECT DISTINCT u FROM (SELECT user_id u FROM channels WHERE tenant_id=@t UNION SELECT user_id FROM tenant_members WHERE tenant_id=@t) x
            WHERE NOT EXISTS (SELECT 1 FROM channels ch WHERE ch.user_id=x.u AND ch.tenant_id<>@t)
              AND NOT EXISTS (SELECT 1 FROM tenant_members m WHERE m.user_id=x.u AND m.tenant_id<>@t)", c, tx))
        {
            uq.Parameters.AddWithValue("t", tenantId);
            await using var r = await uq.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct)) userIds.Add(r.GetInt64(0));
        }

        // borrado por pasadas con punto de guardado: lo que choque con una clave foránea se reintenta cuando sus dependientes ya no están
        var pending = (await TenantTablesAsync(c)).Where(t => !PurgeKeep.Contains(t)).ToList();
        for (var pass = 1; pass <= 8 && pending.Count > 0; pass++)
        {
            var failed = new List<string>();
            foreach (var table in pending)
            {
                await using (var sp = new NpgsqlCommand("SAVEPOINT purge_t", c, tx)) await sp.ExecuteNonQueryAsync(ct);
                try
                {
                    await using var del = new NpgsqlCommand($"DELETE FROM {Quote(table)} WHERE tenant_id = @t", c, tx) { CommandTimeout = 600 };
                    del.Parameters.AddWithValue("t", tenantId);
                    var n = await del.ExecuteNonQueryAsync(ct);
                    if (n > 0) deleted[table] = deleted.GetValueOrDefault(table) + n;
                    await using var rel = new NpgsqlCommand("RELEASE SAVEPOINT purge_t", c, tx); await rel.ExecuteNonQueryAsync(ct);
                }
                catch (PostgresException ex) when (ex.SqlState == "23503")
                {
                    await using var rb = new NpgsqlCommand("ROLLBACK TO SAVEPOINT purge_t", c, tx); await rb.ExecuteNonQueryAsync(ct);
                    failed.Add(table);
                }
            }
            if (failed.Count == pending.Count) { await tx.RollbackAsync(ct); _log.LogError("platform.tenant.purge.stuck tenant={Tenant} tables={Tables}", tenantId, string.Join(",", failed)); return PlanResult.Fail(500, "purge_stuck"); }
            pending = failed;
        }
        if (pending.Count > 0) { await tx.RollbackAsync(ct); return PlanResult.Fail(500, "purge_stuck"); }

        // cuentas propias del tenant: si alguna sigue referenciada por algo ajeno al tenant se conserva (sin canal ni membresía) y se cuenta
        foreach (var uid in userIds)
        {
            await using (var sp = new NpgsqlCommand("SAVEPOINT purge_u", c, tx)) await sp.ExecuteNonQueryAsync(ct);
            try
            {
                await using var del = new NpgsqlCommand("DELETE FROM users WHERE id=@u", c, tx);
                del.Parameters.AddWithValue("u", uid);
                usersRemoved += await del.ExecuteNonQueryAsync(ct);
                await using var rel = new NpgsqlCommand("RELEASE SAVEPOINT purge_u", c, tx); await rel.ExecuteNonQueryAsync(ct);
            }
            catch (PostgresException ex) when (ex.SqlState == "23503")
            {
                await using var rb = new NpgsqlCommand("ROLLBACK TO SAVEPOINT purge_u", c, tx); await rb.ExecuteNonQueryAsync(ct);
                usersKept++;
            }
        }

        await using (var close = new NpgsqlCommand("UPDATE tenants SET status='closed', credentials_mode='legacy' WHERE id=@id", c, tx))
        {
            close.Parameters.AddWithValue("id", tenantId);
            await close.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
        _ent.Invalidate(tenantId);
        _log.LogWarning("platform.tenant.purge tenant={Tenant} slug={Slug} tables={Tables} rows={Rows} usersRemoved={Removed} usersKept={Kept} actor={Actor}",
            tenantId, slug, deleted.Count, deleted.Values.Sum(), usersRemoved, usersKept, actor);
        return PlanResult.Success(new { success = true, tables = deleted.Count, rows = deleted.Values.Sum(), usersRemoved, usersKept });
    }

    /// <summary>Tenants cuyo plazo de guarda venció (sandbox vencido o cancelado hace más de <paramref name="days"/> días) y que aún no se cerraron.</summary>
    public async Task<IReadOnlyList<long>> DueForPurgeAsync(int days, CancellationToken ct = default)
    {
        var due = new List<long>();
        await using var c = Open(1);
        await c.OpenAsync(ct);
        // tenant_subscriptions tiene RLS: se recorre por tenant
        var ids = new List<long>();
        await using (var cmd = new NpgsqlCommand("SELECT id FROM tenants WHERE id<>1 AND status<>'closed' ORDER BY id", c))
        await using (var r = await cmd.ExecuteReaderAsync(ct))
            while (await r.ReadAsync(ct)) ids.Add(r.GetInt64(0));
        foreach (var id in ids)
        {
            await using var t = Open(id);
            await t.OpenAsync(ct);
            await using var q = new NpgsqlCommand(@"SELECT 1 FROM tenant_subscriptions WHERE tenant_id=@t AND (
                (status='cancelled' AND updated_at < now() - make_interval(days => @d)) OR
                (status='sandbox' AND sandbox_ends_at IS NOT NULL AND sandbox_ends_at < now() - make_interval(days => @d)))", t);
            q.Parameters.AddWithValue("t", id); q.Parameters.AddWithValue("d", days);
            if (await q.ExecuteScalarAsync(ct) != null) due.Add(id);
        }
        return due;
    }
}
