using System.Security.Cryptography;
using System.Text.Json;
using Decatron.Core.Interfaces;
using Decatron.Data.Encryption;
using Npgsql;

namespace Decatron.Services.Tenancy;

/// <summary>Almacén real: tenant_provider_config (datos no secretos) + tenant_credentials (ENC2) + credential_access_log.</summary>
public sealed class NpgsqlTenantCredentialStore : ITenantCredentialStore
{
    private const string Provider = "twitch_app";
    private readonly string _cs;
    private readonly SecretVault _vault;

    public NpgsqlTenantCredentialStore(string connectionString, SecretVault vault) { _cs = connectionString; _vault = vault; }

    private async Task<NpgsqlConnection> OpenAsync(long tenantId, CancellationToken ct)
    {
        var c = TenantNpgsql.Create(_cs, tenantId);
        await c.OpenAsync(ct);
        return c;
    }

    private static async Task LogAsync(NpgsqlConnection c, NpgsqlTransaction? tx, long tenantId, string kind, string action, string actor, string purpose, CancellationToken ct, string provider = Provider)
    {
        await using var cmd = new NpgsqlCommand(
            "INSERT INTO credential_access_log (tenant_id, provider, kind, action, actor, purpose) VALUES (@t, @p, @k, @a, @actor, @purpose)", c, tx);
        cmd.Parameters.AddWithValue("t", tenantId);
        cmd.Parameters.AddWithValue("p", provider);
        cmd.Parameters.AddWithValue("k", kind);
        cmd.Parameters.AddWithValue("a", action);
        cmd.Parameters.AddWithValue("actor", actor);
        cmd.Parameters.AddWithValue("purpose", purpose);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<long?> FindActiveTenantIdAsync(string slug, CancellationToken ct = default)
    {
        await using var c = TenantNpgsql.Create(_cs, 1);
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT id FROM tenants WHERE slug=@s AND status='active' AND id<>1", c);
        cmd.Parameters.AddWithValue("s", slug);
        return await cmd.ExecuteScalarAsync(ct) is long id ? id : null;
    }

    private static string Hint(string secret) => secret.Length <= 4 ? "" : secret[^4..];

    public async Task SaveTwitchAppAsync(long tenantId, TwitchAppInput input, string actor, CancellationToken ct = default)
    {
        // Cifrar antes de abrir la transaccion: ProtectAsync usa su propia conexion para la clave del tenant.
        var secretEnc = await _vault.ProtectAsync(tenantId, Provider, "client_secret", input.ClientSecret, ct);
        var webhookEnc = await _vault.ProtectAsync(tenantId, Provider, "webhook_secret", Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant(), ct);

        await using var c = await OpenAsync(tenantId, ct);
        await using var tx = await c.BeginTransactionAsync(ct);

        await using (var cmd = new NpgsqlCommand(
            @"INSERT INTO tenant_provider_config (tenant_id, provider, config, updated_at) VALUES (@t, @p, @cfg::jsonb, now())
              ON CONFLICT (tenant_id, provider) DO UPDATE SET config = EXCLUDED.config, updated_at = now()", c, tx))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("p", Provider);
            cmd.Parameters.AddWithValue("cfg", JsonSerializer.Serialize(new { clientId = input.ClientId, redirectUri = input.RedirectUri, scopes = input.Scopes }));
            await cmd.ExecuteNonQueryAsync(ct);
        }

        foreach (var (kind, enc, hint) in new[] { ("client_secret", secretEnc, Hint(input.ClientSecret)), ("webhook_secret", webhookEnc, "") })
        {
            await using var cmd = new NpgsqlCommand(
                @"INSERT INTO tenant_credentials (tenant_id, provider, kind, secret_enc, key_version, hint, status, last_validated_at)
                  VALUES (@t, @p, @k, @e, @v, @h, 'ok', now())
                  ON CONFLICT (tenant_id, provider, kind) DO UPDATE SET secret_enc = EXCLUDED.secret_enc, key_version = EXCLUDED.key_version,
                    hint = EXCLUDED.hint, status = 'ok', last_validated_at = now(), updated_at = now()", c, tx);
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("p", Provider);
            cmd.Parameters.AddWithValue("k", kind);
            cmd.Parameters.AddWithValue("e", enc);
            cmd.Parameters.AddWithValue("v", int.Parse(enc.Split(':')[1]));
            cmd.Parameters.AddWithValue("h", hint);
            await cmd.ExecuteNonQueryAsync(ct);
            await LogAsync(c, tx, tenantId, kind, "write", actor, "admin-save", ct);
        }
        await tx.CommitAsync(ct);
    }

    private sealed record Row(string ClientId, string? RedirectUri, string? Scopes);

    private static async Task<Row?> ReadConfigAsync(NpgsqlConnection c, long tenantId, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("SELECT config::text FROM tenant_provider_config WHERE tenant_id=@t AND provider=@p", c);
        cmd.Parameters.AddWithValue("t", tenantId);
        cmd.Parameters.AddWithValue("p", Provider);
        if (await cmd.ExecuteScalarAsync(ct) is not string json) return null;
        using var doc = JsonDocument.Parse(json);
        string? S(string n) => doc.RootElement.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
        var id = S("clientId");
        return string.IsNullOrEmpty(id) ? null : new Row(id, S("redirectUri"), S("scopes"));
    }

    public async Task<TwitchAppCredentials?> GetTwitchAppAsync(long tenantId, CancellationToken ct = default)
    {
        await using var c = await OpenAsync(tenantId, ct);
        var cfg = await ReadConfigAsync(c, tenantId, ct);
        if (cfg is null) return null;

        var secrets = new Dictionary<string, string>();
        await using (var cmd = new NpgsqlCommand("SELECT kind, secret_enc FROM tenant_credentials WHERE tenant_id=@t AND provider=@p AND status='ok'", c))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("p", Provider);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct)) secrets[r.GetString(0)] = r.GetString(1);
        }
        if (!secrets.TryGetValue("client_secret", out var secretEnc)) return null;
        var secret = await _vault.UnprotectAsync(tenantId, Provider, "client_secret", secretEnc, ct);
        string? webhook = secrets.TryGetValue("webhook_secret", out var wEnc) ? await _vault.UnprotectAsync(tenantId, Provider, "webhook_secret", wEnc, ct) : null;
        await LogAsync(c, null, tenantId, "client_secret", "read", "system", "provider-load", ct);
        return new TwitchAppCredentials(cfg.ClientId, secret, cfg.RedirectUri, webhook, null, cfg.Scopes);
    }

    public async Task<TwitchAppSummary?> GetTwitchAppSummaryAsync(long tenantId, CancellationToken ct = default)
    {
        await using var c = await OpenAsync(tenantId, ct);
        var cfg = await ReadConfigAsync(c, tenantId, ct);
        if (cfg is null) return null;
        await using var cmd = new NpgsqlCommand("SELECT hint, status, last_validated_at FROM tenant_credentials WHERE tenant_id=@t AND provider=@p AND kind='client_secret'", c);
        cmd.Parameters.AddWithValue("t", tenantId);
        cmd.Parameters.AddWithValue("p", Provider);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) return new TwitchAppSummary(cfg.ClientId, cfg.RedirectUri, cfg.Scopes, null, "pending", null);
        return new TwitchAppSummary(cfg.ClientId, cfg.RedirectUri, cfg.Scopes, r.IsDBNull(0) ? null : r.GetString(0), r.GetString(1),
            r.IsDBNull(2) ? null : r.GetFieldValue<DateTimeOffset>(2));
    }

    public async Task<bool> DeleteTwitchAppAsync(long tenantId, string actor, CancellationToken ct = default)
    {
        await using var c = await OpenAsync(tenantId, ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        int n;
        await using (var cmd = new NpgsqlCommand("DELETE FROM tenant_credentials WHERE tenant_id=@t AND provider=@p", c, tx))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("p", Provider);
            n = await cmd.ExecuteNonQueryAsync(ct);
        }
        await using (var cmd = new NpgsqlCommand("DELETE FROM tenant_provider_config WHERE tenant_id=@t AND provider=@p", c, tx))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("p", Provider);
            n += await cmd.ExecuteNonQueryAsync(ct);
        }
        if (n > 0) await LogAsync(c, tx, tenantId, "*", "write", actor, "admin-delete", ct);
        await tx.CommitAsync(ct);
        return n > 0;
    }

    private const string BotProvider = "twitch_bot";

    public async Task SaveTwitchBotAsync(long tenantId, TwitchBotInput input, string actor, CancellationToken ct = default)
    {
        var accessEnc = await _vault.ProtectAsync(tenantId, BotProvider, "access_token", input.AccessToken, ct);
        var refreshEnc = string.IsNullOrEmpty(input.RefreshToken) ? null : await _vault.ProtectAsync(tenantId, BotProvider, "refresh_token", input.RefreshToken, ct);

        await using var c = await OpenAsync(tenantId, ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await using (var cmd = new NpgsqlCommand(
            @"INSERT INTO tenant_provider_config (tenant_id, provider, config, updated_at) VALUES (@t, @p, @cfg::jsonb, now())
              ON CONFLICT (tenant_id, provider) DO UPDATE SET config = EXCLUDED.config, updated_at = now()", c, tx))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("p", BotProvider);
            cmd.Parameters.AddWithValue("cfg", JsonSerializer.Serialize(new { username = input.Username, twitchId = input.TwitchId, expiresAt = input.ExpiresAt }));
            await cmd.ExecuteNonQueryAsync(ct);
        }
        var rows = new List<(string Kind, string Enc)> { ("access_token", accessEnc) };
        if (refreshEnc != null) rows.Add(("refresh_token", refreshEnc));
        else
        {
            await using var del = new NpgsqlCommand("DELETE FROM tenant_credentials WHERE tenant_id=@t AND provider=@p AND kind='refresh_token'", c, tx);
            del.Parameters.AddWithValue("t", tenantId);
            del.Parameters.AddWithValue("p", BotProvider);
            await del.ExecuteNonQueryAsync(ct);
        }
        foreach (var (kind, enc) in rows)
        {
            await using var cmd = new NpgsqlCommand(
                @"INSERT INTO tenant_credentials (tenant_id, provider, kind, secret_enc, key_version, hint, status, last_validated_at)
                  VALUES (@t, @p, @k, @e, @v, '', 'ok', now())
                  ON CONFLICT (tenant_id, provider, kind) DO UPDATE SET secret_enc = EXCLUDED.secret_enc, key_version = EXCLUDED.key_version,
                    status = 'ok', last_validated_at = now(), updated_at = now()", c, tx);
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("p", BotProvider);
            cmd.Parameters.AddWithValue("k", kind);
            cmd.Parameters.AddWithValue("e", enc);
            cmd.Parameters.AddWithValue("v", int.Parse(enc.Split(':')[1]));
            await cmd.ExecuteNonQueryAsync(ct);
            await LogAsync(c, tx, tenantId, kind, "write", actor, "bot-link", ct, BotProvider);
        }
        await tx.CommitAsync(ct);
    }

    public async Task<TwitchBotSummary?> GetTwitchBotAsync(long tenantId, CancellationToken ct = default)
    {
        await using var c = await OpenAsync(tenantId, ct);
        await using var cmd = new NpgsqlCommand(
            @"SELECT p.config::text, (SELECT max(updated_at) FROM tenant_credentials k WHERE k.tenant_id=p.tenant_id AND k.provider=p.provider AND k.status='ok')
              FROM tenant_provider_config p WHERE p.tenant_id=@t AND p.provider=@p", c);
        cmd.Parameters.AddWithValue("t", tenantId);
        cmd.Parameters.AddWithValue("p", BotProvider);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct) || r.IsDBNull(1)) return null; // sin credencial vigente no hay bot
        using var doc = JsonDocument.Parse(r.GetString(0));
        string? S(string n) => doc.RootElement.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
        var user = S("username"); var id = S("twitchId");
        return string.IsNullOrEmpty(user) || string.IsNullOrEmpty(id) ? null : new TwitchBotSummary(user, id, r.GetFieldValue<DateTimeOffset>(1));
    }

    public async Task<bool> DeleteTwitchBotAsync(long tenantId, string actor, CancellationToken ct = default)
    {
        await using var c = await OpenAsync(tenantId, ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        int n = 0;
        foreach (var table in new[] { "tenant_credentials", "tenant_provider_config" })
        {
            await using var cmd = new NpgsqlCommand($"DELETE FROM {table} WHERE tenant_id=@t AND provider=@p", c, tx);
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("p", BotProvider);
            n += await cmd.ExecuteNonQueryAsync(ct);
        }
        if (n > 0) await LogAsync(c, tx, tenantId, "*", "write", actor, "bot-unlink", ct, BotProvider);
        await tx.CommitAsync(ct);
        return n > 0;
    }

    private const string DiscordProvider = "discord_bot";

    public async Task SaveDiscordBotAsync(long tenantId, DiscordBotInput input, string actor, CancellationToken ct = default)
    {
        var enc = await _vault.ProtectAsync(tenantId, DiscordProvider, "bot_token", input.Token, ct);
        await using var c = await OpenAsync(tenantId, ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await using (var cmd = new NpgsqlCommand(
            @"INSERT INTO tenant_provider_config (tenant_id, provider, config, updated_at) VALUES (@t, @p, @cfg::jsonb, now())
              ON CONFLICT (tenant_id, provider) DO UPDATE SET config = EXCLUDED.config, updated_at = now()", c, tx))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("p", DiscordProvider);
            cmd.Parameters.AddWithValue("cfg", JsonSerializer.Serialize(new { botId = input.BotId, botName = input.BotName }));
            await cmd.ExecuteNonQueryAsync(ct);
        }
        await using (var cmd = new NpgsqlCommand(
            @"INSERT INTO tenant_credentials (tenant_id, provider, kind, secret_enc, key_version, hint, status, last_validated_at)
              VALUES (@t, @p, 'bot_token', @e, @v, @h, 'ok', now())
              ON CONFLICT (tenant_id, provider, kind) DO UPDATE SET secret_enc = EXCLUDED.secret_enc, key_version = EXCLUDED.key_version,
                hint = EXCLUDED.hint, status = 'ok', last_validated_at = now(), updated_at = now()", c, tx))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("p", DiscordProvider);
            cmd.Parameters.AddWithValue("e", enc);
            cmd.Parameters.AddWithValue("v", int.Parse(enc.Split(':')[1]));
            cmd.Parameters.AddWithValue("h", Hint(input.Token));
            await cmd.ExecuteNonQueryAsync(ct);
        }
        await LogAsync(c, tx, tenantId, "bot_token", "write", actor, "admin-save", ct, DiscordProvider);
        await tx.CommitAsync(ct);
    }

    public async Task<DiscordBotSummary?> GetDiscordBotAsync(long tenantId, CancellationToken ct = default)
    {
        await using var c = await OpenAsync(tenantId, ct);
        await using var cmd = new NpgsqlCommand(
            @"SELECT p.config::text, k.updated_at FROM tenant_provider_config p
              JOIN tenant_credentials k ON k.tenant_id=p.tenant_id AND k.provider=p.provider AND k.kind='bot_token' AND k.status='ok'
              WHERE p.tenant_id=@t AND p.provider=@p", c);
        cmd.Parameters.AddWithValue("t", tenantId);
        cmd.Parameters.AddWithValue("p", DiscordProvider);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) return null;
        using var doc = JsonDocument.Parse(r.GetString(0));
        string? S(string n) => doc.RootElement.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
        var id = S("botId"); var name = S("botName");
        return string.IsNullOrEmpty(id) ? null : new DiscordBotSummary(id, name ?? id, r.GetFieldValue<DateTimeOffset>(1));
    }

    public async Task<string?> GetDiscordBotTokenAsync(long tenantId, string purpose, CancellationToken ct = default)
    {
        await using var c = await OpenAsync(tenantId, ct);
        await using var cmd = new NpgsqlCommand("SELECT secret_enc FROM tenant_credentials WHERE tenant_id=@t AND provider=@p AND kind='bot_token' AND status='ok'", c);
        cmd.Parameters.AddWithValue("t", tenantId);
        cmd.Parameters.AddWithValue("p", DiscordProvider);
        if (await cmd.ExecuteScalarAsync(ct) is not string enc) return null;
        var token = await _vault.UnprotectAsync(tenantId, DiscordProvider, "bot_token", enc, ct);
        await LogAsync(c, null, tenantId, "bot_token", "read", "system", purpose, ct, DiscordProvider);
        return token;
    }

    public async Task<bool> DeleteDiscordBotAsync(long tenantId, string actor, CancellationToken ct = default)
    {
        await using var c = await OpenAsync(tenantId, ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        int n = 0;
        foreach (var table in new[] { "tenant_credentials", "tenant_provider_config" })
        {
            await using var cmd = new NpgsqlCommand($"DELETE FROM {table} WHERE tenant_id=@t AND provider=@p", c, tx);
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("p", DiscordProvider);
            n += await cmd.ExecuteNonQueryAsync(ct);
        }
        if (n > 0) await LogAsync(c, tx, tenantId, "bot_token", "write", actor, "admin-delete", ct, DiscordProvider);
        await tx.CommitAsync(ct);
        return n > 0;
    }

    public async Task<IReadOnlyList<long>> ListActiveTenantIdsAsync(CancellationToken ct = default)
    {
        var ids = new List<long>();
        await using var c = TenantNpgsql.Create(_cs, 1);
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT id FROM tenants WHERE status='active' AND id<>1 ORDER BY id", c);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) ids.Add(r.GetInt64(0));
        return ids;
    }
}
