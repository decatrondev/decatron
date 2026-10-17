using System.Text.Json;
using Decatron.Core.Interfaces;
using Decatron.Data.Encryption;
using Npgsql;

namespace Decatron.Services.Tenancy;

/// <summary>Llaves propias de los tenants: <c>tenant_credentials</c> (ENC2, kind <c>api_key</c>) + <c>tenant_provider_config</c> + <c>credential_access_log</c>.</summary>
public sealed class NpgsqlTenantByoStore : ITenantByoStore
{
    private const string Kind = "api_key";
    private readonly string _cs;
    private readonly SecretVault _vault;

    public NpgsqlTenantByoStore(string connectionString, SecretVault vault) { _cs = connectionString; _vault = vault; }

    private async Task<NpgsqlConnection> OpenAsync(long tenantId, CancellationToken ct)
    {
        var c = TenantNpgsql.Create(_cs, tenantId);
        await c.OpenAsync(ct);
        return c;
    }

    private static async Task LogAsync(NpgsqlConnection c, NpgsqlTransaction? tx, long tenantId, string provider, string action, string actor, string purpose, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(
            "INSERT INTO credential_access_log (tenant_id, provider, kind, action, actor, purpose) VALUES (@t, @p, @k, @a, @actor, @purpose)", c, tx);
        cmd.Parameters.AddWithValue("t", tenantId);
        cmd.Parameters.AddWithValue("p", provider);
        cmd.Parameters.AddWithValue("k", Kind);
        cmd.Parameters.AddWithValue("a", action);
        cmd.Parameters.AddWithValue("actor", actor);
        cmd.Parameters.AddWithValue("purpose", purpose);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static IReadOnlyDictionary<string, string> ParseConfig(string json)
    {
        var d = new Dictionary<string, string>();
        using var doc = JsonDocument.Parse(json);
        foreach (var p in doc.RootElement.EnumerateObject())
            if (p.Value.ValueKind == JsonValueKind.String && p.Value.GetString() is { } v) d[p.Name] = v;
        return d;
    }

    public async Task SaveAsync(long tenantId, string provider, string apiKey, IReadOnlyDictionary<string, string> config, string actor, CancellationToken ct = default)
    {
        if (!ByoProviders.IsKnown(provider)) throw new ArgumentException("provider", nameof(provider));
        var enc = await _vault.ProtectAsync(tenantId, provider, Kind, apiKey, ct); // antes de abrir la transaccion: usa su propia conexion
        await using var c = await OpenAsync(tenantId, ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await using (var cmd = new NpgsqlCommand(
            @"INSERT INTO tenant_provider_config (tenant_id, provider, config, updated_at) VALUES (@t, @p, @cfg::jsonb, now())
              ON CONFLICT (tenant_id, provider) DO UPDATE SET config = EXCLUDED.config, updated_at = now()", c, tx))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("p", provider);
            cmd.Parameters.AddWithValue("cfg", JsonSerializer.Serialize(config));
            await cmd.ExecuteNonQueryAsync(ct);
        }
        await using (var cmd = new NpgsqlCommand(
            @"INSERT INTO tenant_credentials (tenant_id, provider, kind, secret_enc, key_version, hint, status, last_validated_at)
              VALUES (@t, @p, @k, @e, @v, @h, 'ok', now())
              ON CONFLICT (tenant_id, provider, kind) DO UPDATE SET secret_enc = EXCLUDED.secret_enc, key_version = EXCLUDED.key_version,
                hint = EXCLUDED.hint, status = 'ok', last_validated_at = now(), updated_at = now()", c, tx))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("p", provider);
            cmd.Parameters.AddWithValue("k", Kind);
            cmd.Parameters.AddWithValue("e", enc);
            cmd.Parameters.AddWithValue("v", int.Parse(enc.Split(':')[1]));
            cmd.Parameters.AddWithValue("h", apiKey.Length <= 4 ? "" : apiKey[^4..]);
            await cmd.ExecuteNonQueryAsync(ct);
        }
        await LogAsync(c, tx, tenantId, provider, "write", actor, "admin-save", ct);
        await tx.CommitAsync(ct);
    }

    public async Task<ByoKeySummary?> GetSummaryAsync(long tenantId, string provider, CancellationToken ct = default)
    {
        await using var c = await OpenAsync(tenantId, ct);
        await using var cmd = new NpgsqlCommand(
            @"SELECT k.hint, k.status, k.updated_at, COALESCE(p.config::text, '{}') FROM tenant_credentials k
              LEFT JOIN tenant_provider_config p ON p.tenant_id=k.tenant_id AND p.provider=k.provider
              WHERE k.tenant_id=@t AND k.provider=@p AND k.kind=@k", c);
        cmd.Parameters.AddWithValue("t", tenantId);
        cmd.Parameters.AddWithValue("p", provider);
        cmd.Parameters.AddWithValue("k", Kind);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) return null;
        return new ByoKeySummary(provider, r.IsDBNull(0) ? "" : r.GetString(0), ParseConfig(r.GetString(3)), r.GetString(1), r.GetFieldValue<DateTimeOffset>(2));
    }

    public async Task<ByoKey?> GetAsync(long tenantId, string provider, string purpose, CancellationToken ct = default)
    {
        await using var c = await OpenAsync(tenantId, ct);
        string enc; string cfg;
        await using (var cmd = new NpgsqlCommand(
            @"SELECT k.secret_enc, COALESCE(p.config::text, '{}') FROM tenant_credentials k
              LEFT JOIN tenant_provider_config p ON p.tenant_id=k.tenant_id AND p.provider=k.provider
              WHERE k.tenant_id=@t AND k.provider=@p AND k.kind=@k AND k.status='ok'", c))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("p", provider);
            cmd.Parameters.AddWithValue("k", Kind);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) return null;
            enc = r.GetString(0); cfg = r.GetString(1);
        }
        var key = await _vault.UnprotectAsync(tenantId, provider, Kind, enc, ct);
        await LogAsync(c, null, tenantId, provider, "read", "system", purpose, ct);
        return new ByoKey(key, ParseConfig(cfg));
    }

    public async Task<bool> DeleteAsync(long tenantId, string provider, string actor, CancellationToken ct = default)
    {
        await using var c = await OpenAsync(tenantId, ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        int n = 0;
        foreach (var table in new[] { "tenant_credentials", "tenant_provider_config" })
        {
            await using var cmd = new NpgsqlCommand($"DELETE FROM {table} WHERE tenant_id=@t AND provider=@p", c, tx);
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("p", provider);
            n += await cmd.ExecuteNonQueryAsync(ct);
        }
        if (n > 0) await LogAsync(c, tx, tenantId, provider, "write", actor, "admin-delete", ct);
        await tx.CommitAsync(ct);
        return n > 0;
    }
}
