using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using Decatron.Core.Interfaces;
using Npgsql;

namespace Decatron.Data.Encryption;

/// <summary>
/// Plataforma, Fase 4 (paso 2): cifrado de secretos por tenant, formato <c>ENC2:&lt;versión&gt;:&lt;base64(nonce|tag|cifrado)&gt;</c>.
/// AES-256-GCM. Cada tenant tiene su clave de datos (tabla tenant_keys), cifrada a su vez con la clave maestra, que vive FUERA de la BD
/// (archivo 600). El dato asociado (AAD) es tenant|proveedor|tipo: un secreto copiado a otra fila u otro tenant no descifra.
/// Convive con el formato antiguo <c>ENC:</c> (<see cref="TokenEncryption"/>); quien lee decide por prefijo (<see cref="IsV2"/>).
/// </summary>
public interface IMasterKeySource { byte[] GetKey(); }

public interface ITenantKeyStore
{
    Task<(int Version, byte[] Wrapped)?> GetLatestAsync(long tenantId, CancellationToken ct = default);
    Task<byte[]?> GetAsync(long tenantId, int version, CancellationToken ct = default);
    /// <summary>Inserta si no existe esa versión. Devuelve false si otro proceso ya la había creado.</summary>
    Task<bool> InsertAsync(long tenantId, int version, byte[] wrapped, CancellationToken ct = default);
    /// <summary>Reemplaza el valor envuelto (solo para rotar la clave maestra).</summary>
    Task ReplaceAsync(long tenantId, int version, byte[] wrapped, CancellationToken ct = default);
}

/// <summary>Clave maestra: 32 bytes en base64, en un archivo (modo 600) fuera de la base de datos y del respaldo diario.</summary>
public sealed class FileMasterKeySource : IMasterKeySource
{
    private readonly string _path;
    private byte[]? _key;
    public FileMasterKeySource(string path) => _path = path;

    public byte[] GetKey()
    {
        if (_key != null) return _key;
        if (!File.Exists(_path)) throw new InvalidOperationException("Clave maestra de credenciales no encontrada.");
        byte[] k;
        try { k = Convert.FromBase64String(File.ReadAllText(_path).Trim()); }
        catch (FormatException) { throw new InvalidOperationException("Clave maestra de credenciales con formato inválido."); }
        if (k.Length != 32) throw new InvalidOperationException("La clave maestra debe tener 32 bytes.");
        return _key = k;
    }
}

public sealed class InMemoryTenantKeyStore : ITenantKeyStore
{
    private readonly ConcurrentDictionary<(long, int), byte[]> _d = new();
    public Task<(int Version, byte[] Wrapped)?> GetLatestAsync(long tenantId, CancellationToken ct = default)
    {
        var best = _d.Where(kv => kv.Key.Item1 == tenantId).OrderByDescending(kv => kv.Key.Item2).FirstOrDefault();
        return Task.FromResult<(int, byte[])?>(best.Value == null ? null : (best.Key.Item2, best.Value));
    }
    public Task<byte[]?> GetAsync(long tenantId, int version, CancellationToken ct = default) =>
        Task.FromResult(_d.TryGetValue((tenantId, version), out var v) ? v : null);
    public Task<bool> InsertAsync(long tenantId, int version, byte[] wrapped, CancellationToken ct = default) =>
        Task.FromResult(_d.TryAdd((tenantId, version), wrapped));
    public Task ReplaceAsync(long tenantId, int version, byte[] wrapped, CancellationToken ct = default)
    { _d[(tenantId, version)] = wrapped; return Task.CompletedTask; }
}

/// <summary>Almacén real: tabla tenant_keys. Cada consulta abre una conexión que nace con el tenant (RLS).</summary>
public sealed class NpgsqlTenantKeyStore : ITenantKeyStore
{
    private readonly string _cs;
    public NpgsqlTenantKeyStore(string connectionString) => _cs = connectionString;

    public async Task<(int Version, byte[] Wrapped)?> GetLatestAsync(long tenantId, CancellationToken ct = default)
    {
        await using var c = TenantNpgsql.Create(_cs, tenantId);
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT version, wrapped_key FROM tenant_keys WHERE tenant_id=@t ORDER BY version DESC LIMIT 1", c);
        cmd.Parameters.AddWithValue("t", tenantId);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        return await r.ReadAsync(ct) ? (r.GetInt32(0), Convert.FromBase64String(r.GetString(1))) : null;
    }

    public async Task<byte[]?> GetAsync(long tenantId, int version, CancellationToken ct = default)
    {
        await using var c = TenantNpgsql.Create(_cs, tenantId);
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT wrapped_key FROM tenant_keys WHERE tenant_id=@t AND version=@v", c);
        cmd.Parameters.AddWithValue("t", tenantId);
        cmd.Parameters.AddWithValue("v", version);
        return await cmd.ExecuteScalarAsync(ct) is string s ? Convert.FromBase64String(s) : null;
    }

    public async Task<bool> InsertAsync(long tenantId, int version, byte[] wrapped, CancellationToken ct = default)
    {
        await using var c = TenantNpgsql.Create(_cs, tenantId);
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            "INSERT INTO tenant_keys (tenant_id, version, wrapped_key) VALUES (@t,@v,@w) ON CONFLICT DO NOTHING", c);
        cmd.Parameters.AddWithValue("t", tenantId);
        cmd.Parameters.AddWithValue("v", version);
        cmd.Parameters.AddWithValue("w", Convert.ToBase64String(wrapped));
        return await cmd.ExecuteNonQueryAsync(ct) == 1;
    }

    public async Task ReplaceAsync(long tenantId, int version, byte[] wrapped, CancellationToken ct = default)
    {
        await using var c = TenantNpgsql.Create(_cs, tenantId);
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("UPDATE tenant_keys SET wrapped_key=@w WHERE tenant_id=@t AND version=@v", c);
        cmd.Parameters.AddWithValue("t", tenantId);
        cmd.Parameters.AddWithValue("v", version);
        cmd.Parameters.AddWithValue("w", Convert.ToBase64String(wrapped));
        await cmd.ExecuteNonQueryAsync(ct);
    }
}

public sealed class SecretVault
{
    public const string Prefix = "ENC2:";
    private readonly IMasterKeySource _master;
    private readonly ITenantKeyStore _store;
    private readonly ConcurrentDictionary<(long, int), byte[]> _dataKeys = new();

    public SecretVault(IMasterKeySource master, ITenantKeyStore store) { _master = master; _store = store; }

    public static bool IsV2(string? value) => value != null && value.StartsWith(Prefix, StringComparison.Ordinal);

    public async Task<string> ProtectAsync(long tenantId, string provider, string kind, string plaintext, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(plaintext)) throw new ArgumentException("El secreto está vacío.", nameof(plaintext));
        var (version, key) = await GetOrCreateLatestKeyAsync(tenantId, ct);
        var blob = Seal(key, Encoding.UTF8.GetBytes(plaintext), Aad(tenantId, provider, kind));
        return $"{Prefix}{version}:{Convert.ToBase64String(blob)}";
    }

    public async Task<string> UnprotectAsync(long tenantId, string provider, string kind, string value, CancellationToken ct = default)
    {
        if (!IsV2(value)) throw new FormatException("No es un valor ENC2.");
        var rest = value.Substring(Prefix.Length);
        var sep = rest.IndexOf(':');
        if (sep <= 0 || !int.TryParse(rest.AsSpan(0, sep), out var version)) throw new FormatException("Valor ENC2 mal formado.");
        var key = await GetDataKeyAsync(tenantId, version, ct);
        var plain = Open(key, Convert.FromBase64String(rest.Substring(sep + 1)), Aad(tenantId, provider, kind));
        return Encoding.UTF8.GetString(plain);
    }

    /// <summary>Rotación de la clave maestra: reenvuelve las claves de datos de un tenant con la clave nueva (los secretos no se tocan).</summary>
    public async Task<int> RewrapAsync(long tenantId, byte[] oldMaster, byte[] newMaster, int upToVersion, CancellationToken ct = default)
    {
        var n = 0;
        for (var v = 1; v <= upToVersion; v++)
        {
            var wrapped = await _store.GetAsync(tenantId, v, ct);
            if (wrapped == null) continue;
            var dk = Open(oldMaster, wrapped, WrapAad(tenantId, v));
            var again = Seal(newMaster, dk, WrapAad(tenantId, v));
            await _store.ReplaceAsync(tenantId, v, again, ct);
            n++;
        }
        return n;
    }

    private async Task<(int Version, byte[] Key)> GetOrCreateLatestKeyAsync(long tenantId, CancellationToken ct)
    {
        var latest = await _store.GetLatestAsync(tenantId, ct);
        if (latest != null) return (latest.Value.Version, UnwrapCached(tenantId, latest.Value.Version, latest.Value.Wrapped));
        var fresh = RandomNumberGenerator.GetBytes(32);
        var wrapped = Seal(_master.GetKey(), fresh, WrapAad(tenantId, 1));
        if (await _store.InsertAsync(tenantId, 1, wrapped, ct)) { _dataKeys[(tenantId, 1)] = fresh; return (1, fresh); }
        // otro proceso la creó primero: usar la suya
        var existing = await _store.GetAsync(tenantId, 1, ct) ?? throw new InvalidOperationException("No se pudo obtener la clave del tenant.");
        return (1, UnwrapCached(tenantId, 1, existing));
    }

    private async Task<byte[]> GetDataKeyAsync(long tenantId, int version, CancellationToken ct)
    {
        if (_dataKeys.TryGetValue((tenantId, version), out var k)) return k;
        var wrapped = await _store.GetAsync(tenantId, version, ct) ?? throw new CryptographicException("Clave del tenant no encontrada.");
        return UnwrapCached(tenantId, version, wrapped);
    }

    private byte[] UnwrapCached(long tenantId, int version, byte[] wrapped) =>
        _dataKeys.GetOrAdd((tenantId, version), _ => Open(_master.GetKey(), wrapped, WrapAad(tenantId, version)));

    private static byte[] Aad(long tenantId, string provider, string kind) => Encoding.UTF8.GetBytes($"secret|{tenantId}|{provider}|{kind}");
    private static byte[] WrapAad(long tenantId, int version) => Encoding.UTF8.GetBytes($"tenant_keys|{tenantId}|{version}");

    private static byte[] Seal(byte[] key, byte[] plain, byte[] aad)
    {
        var nonce = RandomNumberGenerator.GetBytes(12);
        var tag = new byte[16];
        var ct = new byte[plain.Length];
        using var gcm = new AesGcm(key, 16);
        gcm.Encrypt(nonce, plain, ct, tag, aad);
        var blob = new byte[12 + 16 + ct.Length];
        nonce.CopyTo(blob, 0); tag.CopyTo(blob, 12); ct.CopyTo(blob, 28);
        return blob;
    }

    private static byte[] Open(byte[] key, byte[] blob, byte[] aad)
    {
        if (blob.Length < 28) throw new CryptographicException("Valor cifrado demasiado corto.");
        var plain = new byte[blob.Length - 28];
        using var gcm = new AesGcm(key, 16);
        gcm.Decrypt(blob.AsSpan(0, 12), blob.AsSpan(28), blob.AsSpan(12, 16), plain, aad);
        return plain;
    }
}
