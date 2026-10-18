using System.Security.Cryptography;
using System.Text;
using Decatron.Core.Interfaces;
using Decatron.Data.Encryption;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace Decatron.Services.Tenancy;

public enum MfaResult { Ok, Invalid, Locked, NotEnabled }

public sealed record MfaStatus(bool Enabled, int RecoveryLeft, int LockedSeconds);

/// <summary>
/// Plataforma, Fase A (pieza F): 2FA por TOTP (RFC 6238) del comprador, opcional. El secreto se guarda cifrado con <see cref="SecretVault"/>,
/// los codigos de recuperacion solo como hash y cada codigo TOTP se acepta una sola vez. Cinco fallos seguidos bloquean 15 minutos.
/// Todo el tiempo se calcula en SQL (now()) para no cruzar el desfase horario legacy de Npgsql. Cada hecho queda en credential_access_log.
/// </summary>
public sealed class BuyerMfa
{
    public const int MaxFailures = 5;
    public const int LockMinutes = 15;
    public const int RecoveryCodeCount = 8;
    private const string Provider = "buyer_mfa", Kind = "totp";
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I: se leen y se teclean sin dudas

    private readonly string _cs;
    private readonly SecretVault _vault;

    public BuyerMfa(IConfiguration config, SecretVault vault)
    {
        _cs = config.GetConnectionString("DefaultConnection") ?? "";
        _vault = vault;
    }

    // ── TOTP ──

    public static string TotpCode(byte[] key, long step)
    {
        var msg = BitConverter.GetBytes(step);
        if (BitConverter.IsLittleEndian) Array.Reverse(msg);
        var hash = HMACSHA1.HashData(key, msg);
        var off = hash[^1] & 0x0F;
        var bin = ((hash[off] & 0x7F) << 24) | (hash[off + 1] << 16) | (hash[off + 2] << 8) | hash[off + 3];
        return (bin % 1_000_000).ToString("D6");
    }

    public static long StepOf(DateTimeOffset at) => at.ToUnixTimeSeconds() / 30;

    /// <summary>Paso en el que el codigo es valido (±1 por desfase de reloj), o null. Compara en tiempo constante.</summary>
    public static long? MatchStep(byte[] key, string code, DateTimeOffset now)
    {
        long? hit = null;
        for (var d = -1; d <= 1; d++)
        {
            var step = StepOf(now) + d;
            var expected = Encoding.ASCII.GetBytes(TotpCode(key, step));
            if (CryptographicOperations.FixedTimeEquals(expected, Encoding.ASCII.GetBytes(code))) hit = step;
        }
        return hit;
    }

    public static string Base32(byte[] data)
    {
        const string a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var sb = new StringBuilder();
        int buffer = 0, bits = 0;
        foreach (var b in data)
        {
            buffer = (buffer << 8) | b; bits += 8;
            while (bits >= 5) { sb.Append(a[(buffer >> (bits - 5)) & 31]); bits -= 5; }
        }
        if (bits > 0) sb.Append(a[(buffer << (5 - bits)) & 31]);
        return sb.ToString();
    }

    public static byte[] FromBase32(string s)
    {
        const string a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var bytes = new List<byte>();
        int buffer = 0, bits = 0;
        foreach (var ch in s.Trim().TrimEnd('=').ToUpperInvariant())
        {
            var v = a.IndexOf(ch);
            if (v < 0) throw new FormatException("Base32 invalido.");
            buffer = (buffer << 5) | v; bits += 5;
            if (bits >= 8) { bytes.Add((byte)((buffer >> (bits - 8)) & 0xFF)); bits -= 8; }
        }
        return bytes.ToArray();
    }

    public static string OtpAuthUri(string issuer, string account, string secretBase32)
        => $"otpauth://totp/{Uri.EscapeDataString(issuer)}:{Uri.EscapeDataString(account)}?secret={secretBase32}&issuer={Uri.EscapeDataString(issuer)}&algorithm=SHA1&digits=6&period=30";

    /// <summary>Deja solo el codigo: sin espacios ni guiones, en mayusculas.</summary>
    public static string Normalize(string? input) => new string((input ?? "").Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();

    private static string RecoveryHash(long tenantId, long userId, string code) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{tenantId}:{userId}:{code}"))).ToLowerInvariant();

    private static string NewRecoveryCode()
    {
        var chars = new char[8];
        for (var i = 0; i < chars.Length; i++) chars[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        return new string(chars);
    }

    // ── Almacen ──

    private async Task<NpgsqlConnection> OpenAsync(long tenantId, CancellationToken ct)
    {
        var c = TenantNpgsql.Create(_cs, tenantId);
        await c.OpenAsync(ct);
        return c;
    }

    private static async Task LogAsync(NpgsqlConnection c, NpgsqlTransaction? tx, long tenantId, long userId, string action, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(
            "INSERT INTO credential_access_log (tenant_id, provider, kind, action, actor, purpose) VALUES (@t, @p, @k, @a, @actor, 'mfa')", c, tx);
        cmd.Parameters.AddWithValue("t", tenantId);
        cmd.Parameters.AddWithValue("p", Provider);
        cmd.Parameters.AddWithValue("k", Kind);
        cmd.Parameters.AddWithValue("a", action);
        cmd.Parameters.AddWithValue("actor", "buyer:" + userId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<MfaStatus> StatusAsync(long tenantId, long userId, CancellationToken ct = default)
    {
        await using var c = await OpenAsync(tenantId, ct);
        await using var cmd = new NpgsqlCommand(
            @"SELECT m.enabled, GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (m.locked_until - now())), 0))::int,
                     (SELECT count(*) FROM tenant_buyer_recovery_codes r WHERE r.tenant_id = m.tenant_id AND r.user_id = m.user_id AND r.used_at IS NULL)
              FROM tenant_buyer_mfa m WHERE m.tenant_id = @t AND m.user_id = @u", c);
        cmd.Parameters.AddWithValue("t", tenantId); cmd.Parameters.AddWithValue("u", userId);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct) || !r.GetBoolean(0)) return new MfaStatus(false, 0, 0);
        return new MfaStatus(true, (int)r.GetInt64(2), r.GetInt32(1));
    }

    /// <summary>Marca de la activacion actual (segundos Unix) o null si no hay 2FA. El token de paso se ata a ella: desactivar y reactivar lo invalida.</summary>
    public async Task<long?> EnabledAtAsync(long tenantId, long userId, CancellationToken ct = default)
    {
        await using var c = await OpenAsync(tenantId, ct);
        await using var cmd = new NpgsqlCommand(
            "SELECT EXTRACT(EPOCH FROM enabled_at)::bigint FROM tenant_buyer_mfa WHERE tenant_id=@t AND user_id=@u AND enabled", c);
        cmd.Parameters.AddWithValue("t", tenantId); cmd.Parameters.AddWithValue("u", userId);
        var o = await cmd.ExecuteScalarAsync(ct);
        return o is null or DBNull ? null : Convert.ToInt64(o);
    }

    /// <summary>Genera un secreto nuevo en estado «configurando». Si ya hay 2FA activo, devuelve null (primero hay que desactivarlo).</summary>
    public async Task<(string Secret, string Uri)?> BeginSetupAsync(long tenantId, long userId, string account, string issuer, CancellationToken ct = default)
    {
        var secret = Base32(RandomNumberGenerator.GetBytes(20));
        var enc = await _vault.ProtectAsync(tenantId, Provider, Kind, secret, ct);
        await using var c = await OpenAsync(tenantId, ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await using (var cmd = new NpgsqlCommand(
            @"INSERT INTO tenant_buyer_mfa (tenant_id, user_id, secret_enc, enabled) VALUES (@t, @u, @s, false)
              ON CONFLICT (tenant_id, user_id) DO UPDATE SET secret_enc = EXCLUDED.secret_enc, last_step = 0, failed_count = 0, locked_until = NULL
              WHERE tenant_buyer_mfa.enabled = false", c, tx))
        {
            cmd.Parameters.AddWithValue("t", tenantId); cmd.Parameters.AddWithValue("u", userId); cmd.Parameters.AddWithValue("s", enc);
            if (await cmd.ExecuteNonQueryAsync(ct) == 0) return null;
        }
        await LogAsync(c, tx, tenantId, userId, "mfa_setup", ct);
        await tx.CommitAsync(ct);
        return (secret, OtpAuthUri(issuer, account, secret));
    }

    /// <summary>Confirma la activacion con un codigo de la app. Devuelve los codigos de recuperacion (solo se ven esta vez) o null si el codigo no sirve.</summary>
    public async Task<string[]?> ConfirmSetupAsync(long tenantId, long userId, string code, CancellationToken ct = default)
    {
        code = Normalize(code);
        await using var c = await OpenAsync(tenantId, ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        string enc; bool enabled;
        await using (var cmd = new NpgsqlCommand("SELECT secret_enc, enabled FROM tenant_buyer_mfa WHERE tenant_id=@t AND user_id=@u FOR UPDATE", c, tx))
        {
            cmd.Parameters.AddWithValue("t", tenantId); cmd.Parameters.AddWithValue("u", userId);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) return null;
            enc = r.GetString(0); enabled = r.GetBoolean(1);
        }
        if (enabled || code.Length != 6) return null;
        var key = FromBase32(await _vault.UnprotectAsync(tenantId, Provider, Kind, enc, ct));
        var step = MatchStep(key, code, DateTimeOffset.UtcNow);
        if (step is null) return null;

        await using (var cmd = new NpgsqlCommand("UPDATE tenant_buyer_mfa SET enabled=true, enabled_at=now(), last_step=@s, failed_count=0, locked_until=NULL WHERE tenant_id=@t AND user_id=@u", c, tx))
        {
            cmd.Parameters.AddWithValue("s", step.Value); cmd.Parameters.AddWithValue("t", tenantId); cmd.Parameters.AddWithValue("u", userId);
            await cmd.ExecuteNonQueryAsync(ct);
        }
        var codes = await ReplaceRecoveryAsync(c, tx, tenantId, userId, ct);
        await LogAsync(c, tx, tenantId, userId, "mfa_enable", ct);
        await tx.CommitAsync(ct);
        return codes;
    }

    private static async Task<string[]> ReplaceRecoveryAsync(NpgsqlConnection c, NpgsqlTransaction tx, long tenantId, long userId, CancellationToken ct)
    {
        await using (var del = new NpgsqlCommand("DELETE FROM tenant_buyer_recovery_codes WHERE tenant_id=@t AND user_id=@u", c, tx))
        {
            del.Parameters.AddWithValue("t", tenantId); del.Parameters.AddWithValue("u", userId);
            await del.ExecuteNonQueryAsync(ct);
        }
        var codes = Enumerable.Range(0, RecoveryCodeCount).Select(_ => NewRecoveryCode()).ToArray();
        foreach (var code in codes)
        {
            await using var ins = new NpgsqlCommand("INSERT INTO tenant_buyer_recovery_codes (tenant_id, user_id, code_hash) VALUES (@t, @u, @h)", c, tx);
            ins.Parameters.AddWithValue("t", tenantId); ins.Parameters.AddWithValue("u", userId); ins.Parameters.AddWithValue("h", RecoveryHash(tenantId, userId, code));
            await ins.ExecuteNonQueryAsync(ct);
        }
        return codes.Select(x => $"{x[..4]}-{x[4..]}").ToArray();
    }

    /// <summary>Comprueba un codigo TOTP o uno de recuperacion (onRecovery se llama si fue de recuperacion). Aplica el bloqueo por fallos y no deja reutilizar un codigo.</summary>
    public async Task<MfaResult> VerifyAsync(long tenantId, long userId, string input, CancellationToken ct = default, Action<bool>? onRecovery = null)
    {
        var code = Normalize(input);
        await using var c = await OpenAsync(tenantId, ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        string enc; long lastStep; bool locked;
        await using (var cmd = new NpgsqlCommand(
            "SELECT secret_enc, last_step, (locked_until IS NOT NULL AND locked_until > now()) FROM tenant_buyer_mfa WHERE tenant_id=@t AND user_id=@u AND enabled FOR UPDATE", c, tx))
        {
            cmd.Parameters.AddWithValue("t", tenantId); cmd.Parameters.AddWithValue("u", userId);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) return MfaResult.NotEnabled;
            enc = r.GetString(0); lastStep = r.GetInt64(1); locked = r.GetBoolean(2);
        }
        if (locked) return MfaResult.Locked;

        var ok = false; string action = "mfa_ok";
        if (code.Length == 6 && code.All(char.IsDigit))
        {
            var key = FromBase32(await _vault.UnprotectAsync(tenantId, Provider, Kind, enc, ct));
            var step = MatchStep(key, code, DateTimeOffset.UtcNow);
            if (step is not null && step.Value > lastStep)
            {
                ok = true;
                await using var up = new NpgsqlCommand("UPDATE tenant_buyer_mfa SET last_step=@s WHERE tenant_id=@t AND user_id=@u", c, tx);
                up.Parameters.AddWithValue("s", step.Value); up.Parameters.AddWithValue("t", tenantId); up.Parameters.AddWithValue("u", userId);
                await up.ExecuteNonQueryAsync(ct);
            }
        }
        else if (code.Length == 8)
        {
            await using var use = new NpgsqlCommand(
                "UPDATE tenant_buyer_recovery_codes SET used_at=now() WHERE tenant_id=@t AND user_id=@u AND code_hash=@h AND used_at IS NULL", c, tx);
            use.Parameters.AddWithValue("t", tenantId); use.Parameters.AddWithValue("u", userId); use.Parameters.AddWithValue("h", RecoveryHash(tenantId, userId, code));
            if (await use.ExecuteNonQueryAsync(ct) == 1) { ok = true; action = "mfa_recovery"; }
        }

        if (ok)
        {
            await using (var reset = new NpgsqlCommand("UPDATE tenant_buyer_mfa SET failed_count=0, locked_until=NULL WHERE tenant_id=@t AND user_id=@u", c, tx))
            { reset.Parameters.AddWithValue("t", tenantId); reset.Parameters.AddWithValue("u", userId); await reset.ExecuteNonQueryAsync(ct); }
            await LogAsync(c, tx, tenantId, userId, action, ct);
            await tx.CommitAsync(ct);
            if (action == "mfa_recovery") onRecovery?.Invoke(true); // el controlador avisa por correo: un codigo de recuperacion gastado es una señal
            return MfaResult.Ok;
        }

        await using (var fail = new NpgsqlCommand(
            @"UPDATE tenant_buyer_mfa SET failed_count = CASE WHEN failed_count + 1 >= @max THEN 0 ELSE failed_count + 1 END,
                     locked_until = CASE WHEN failed_count + 1 >= @max THEN now() + make_interval(mins => @mins) ELSE locked_until END
              WHERE tenant_id=@t AND user_id=@u
              RETURNING (locked_until IS NOT NULL AND locked_until > now())", c, tx))
        {
            fail.Parameters.AddWithValue("max", MaxFailures); fail.Parameters.AddWithValue("mins", LockMinutes);
            fail.Parameters.AddWithValue("t", tenantId); fail.Parameters.AddWithValue("u", userId);
            var nowLocked = (bool)(await fail.ExecuteScalarAsync(ct))!;
            await LogAsync(c, tx, tenantId, userId, nowLocked ? "mfa_locked" : "mfa_fail", ct);
            await tx.CommitAsync(ct);
            return nowLocked ? MfaResult.Locked : MfaResult.Invalid;
        }
    }

    /// <summary>Nuevos codigos de recuperacion (los anteriores dejan de servir). El controlador exige antes un codigo valido.</summary>
    public async Task<string[]> RegenerateRecoveryAsync(long tenantId, long userId, CancellationToken ct = default)
    {
        await using var c = await OpenAsync(tenantId, ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var codes = await ReplaceRecoveryAsync(c, tx, tenantId, userId, ct);
        await LogAsync(c, tx, tenantId, userId, "mfa_codes", ct);
        await tx.CommitAsync(ct);
        return codes;
    }

    public async Task DisableAsync(long tenantId, long userId, CancellationToken ct = default)
    {
        await using var c = await OpenAsync(tenantId, ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        foreach (var table in new[] { "tenant_buyer_recovery_codes", "tenant_buyer_mfa" })
        {
            await using var cmd = new NpgsqlCommand($"DELETE FROM {table} WHERE tenant_id=@t AND user_id=@u", c, tx);
            cmd.Parameters.AddWithValue("t", tenantId); cmd.Parameters.AddWithValue("u", userId);
            await cmd.ExecuteNonQueryAsync(ct);
        }
        await LogAsync(c, tx, tenantId, userId, "mfa_disable", ct);
        await tx.CommitAsync(ct);
    }
}

/// <summary>
/// Token de paso: prueba de que el comprador acaba de verificar su 2FA. Firmado (HMAC) con la clave del JWT, atado a tenant, usuario y a la
/// activacion vigente del 2FA, y de 10 minutos. Viaja en el encabezado X-Step-Up solo en las acciones que tocan credenciales.
/// </summary>
public static class BuyerStepUp
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);
    public const string Header = "X-Step-Up";

    private static string Sign(string payload, string secret)
        => Convert.ToBase64String(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(payload))).Replace('+', '-').Replace('/', '_').TrimEnd('=');

    public static string Issue(long tenantId, long userId, long enabledAt, string secret, DateTimeOffset? now = null)
    {
        var exp = (now ?? DateTimeOffset.UtcNow).Add(Lifetime).ToUnixTimeSeconds();
        var payload = $"{tenantId}|{userId}|{enabledAt}|{exp}";
        return $"{Convert.ToBase64String(Encoding.UTF8.GetBytes(payload)).Replace('+', '-').Replace('/', '_').TrimEnd('=')}.{Sign(payload, secret)}";
    }

    public static bool Validate(string? token, long tenantId, long userId, long enabledAt, string secret, DateTimeOffset? now = null)
    {
        if (string.IsNullOrEmpty(token)) return false;
        var parts = token.Split('.');
        if (parts.Length != 2) return false;
        try
        {
            var b64 = parts[0].Replace('-', '+').Replace('_', '/');
            b64 = b64.PadRight(b64.Length + (4 - b64.Length % 4) % 4, '=');
            var payload = Encoding.UTF8.GetString(Convert.FromBase64String(b64));
            if (!CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(Sign(payload, secret)), Encoding.ASCII.GetBytes(parts[1]))) return false;
            var f = payload.Split('|');
            return f.Length == 4 && f[0] == tenantId.ToString() && f[1] == userId.ToString() && f[2] == enabledAt.ToString()
                && long.Parse(f[3]) > (now ?? DateTimeOffset.UtcNow).ToUnixTimeSeconds();
        }
        catch { return false; }
    }
}
