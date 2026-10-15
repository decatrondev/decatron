using System.Security.Cryptography;
using Decatron.Data.Encryption;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 4 (paso 2): cifrado ENC2 por tenant. No usa base de datos ni la clave real.</summary>
public class SecretVaultTests
{
    private sealed class FixedMaster : IMasterKeySource
    {
        private readonly byte[] _k;
        public FixedMaster(byte[] k) => _k = k;
        public byte[] GetKey() => _k;
    }

    private static SecretVault NewVault(out InMemoryTenantKeyStore store, byte[]? master = null)
    {
        store = new InMemoryTenantKeyStore();
        return new SecretVault(new FixedMaster(master ?? RandomNumberGenerator.GetBytes(32)), store);
    }

    [Fact]
    public async Task IdaYVuelta()
    {
        var v = NewVault(out _);
        var enc = await v.ProtectAsync(7, "twitch_app", "client_secret", "super-secreto");
        Assert.StartsWith("ENC2:1:", enc);
        Assert.DoesNotContain("super-secreto", enc);
        Assert.Equal("super-secreto", await v.UnprotectAsync(7, "twitch_app", "client_secret", enc));
    }

    [Fact]
    public async Task MismoTextoDaCifradosDistintos()
    {
        var v = NewVault(out _);
        Assert.NotEqual(await v.ProtectAsync(7, "p", "k", "x"), await v.ProtectAsync(7, "p", "k", "x"));
    }

    [Fact]
    public async Task OtroTenantNoDescifra()
    {
        var v = NewVault(out _);
        var enc = await v.ProtectAsync(7, "twitch_app", "client_secret", "s");
        await v.ProtectAsync(8, "twitch_app", "client_secret", "otro"); // crea clave del 8
        await Assert.ThrowsAnyAsync<CryptographicException>(() => v.UnprotectAsync(8, "twitch_app", "client_secret", enc));
    }

    [Theory]
    [InlineData("twitch_bot", "client_secret")]
    [InlineData("twitch_app", "access_token")]
    public async Task OtroProveedorOTipoNoDescifra(string provider, string kind)
    {
        var v = NewVault(out _);
        var enc = await v.ProtectAsync(7, "twitch_app", "client_secret", "s");
        await Assert.ThrowsAnyAsync<CryptographicException>(() => v.UnprotectAsync(7, provider, kind, enc));
    }

    [Fact]
    public async Task ValorAlteradoSeRechaza()
    {
        var v = NewVault(out _);
        var enc = await v.ProtectAsync(7, "p", "k", "secreto largo para alterar");
        var i = enc.LastIndexOf(':') + 6;
        var alterado = enc[..i] + (enc[i] == 'A' ? 'B' : 'A') + enc[(i + 1)..];
        await Assert.ThrowsAnyAsync<CryptographicException>(() => v.UnprotectAsync(7, "p", "k", alterado));
    }

    [Fact]
    public async Task OtraClaveMaestraNoDescifraLasClavesDeDatos()
    {
        var v = NewVault(out var store);
        var enc = await v.ProtectAsync(7, "p", "k", "s");
        var otra = new SecretVault(new FixedMaster(RandomNumberGenerator.GetBytes(32)), store);
        await Assert.ThrowsAnyAsync<CryptographicException>(() => otra.UnprotectAsync(7, "p", "k", enc));
    }

    [Fact]
    public async Task RotacionDeMaestraNoTocaLosSecretos()
    {
        var viejaMaestra = RandomNumberGenerator.GetBytes(32);
        var nuevaMaestra = RandomNumberGenerator.GetBytes(32);
        var v = NewVault(out var store, viejaMaestra);
        var enc = await v.ProtectAsync(7, "p", "k", "s");
        Assert.Equal(1, await v.RewrapAsync(7, viejaMaestra, nuevaMaestra, 1));
        var tras = new SecretVault(new FixedMaster(nuevaMaestra), store);
        Assert.Equal("s", await tras.UnprotectAsync(7, "p", "k", enc));
    }

    [Fact]
    public void ConviveConElFormatoAntiguo()
    {
        var viejo = Decatron.Data.Encryption.TokenEncryption.Encrypt("tok", "clave-global");
        Assert.False(SecretVault.IsV2(viejo));
        Assert.True(SecretVault.IsV2("ENC2:1:abc"));
        Assert.False(SecretVault.IsV2(null));
    }

    [Fact]
    public void ArchivoDeClaveMaestraSeValida()
    {
        var f = Path.GetTempFileName();
        try
        {
            File.WriteAllText(f, Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)) + "\n");
            Assert.Equal(32, new FileMasterKeySource(f).GetKey().Length);
            File.WriteAllText(f, Convert.ToBase64String(RandomNumberGenerator.GetBytes(16)));
            Assert.Throws<InvalidOperationException>(() => new FileMasterKeySource(f).GetKey());
            File.WriteAllText(f, "no es base64 !!");
            Assert.Throws<InvalidOperationException>(() => new FileMasterKeySource(f).GetKey());
        }
        finally { File.Delete(f); }
        Assert.Throws<InvalidOperationException>(() => new FileMasterKeySource("/no/existe/clave").GetKey());
    }
}

/// <summary>Contra Postgres real (RLS incluida). Cadena en DECATRON_APP_CONN (rol decatron_app, base con tenant_keys); sin ella se omite.</summary>
public class SecretVaultDbTests
{
    private static string? Conn => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");

    [Fact]
    public async Task AlmacenReal_IdaYVueltaYAislamiento()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        await using (var chk = Decatron.Core.Interfaces.TenantNpgsql.Create(Conn, 1))
        {
            await chk.OpenAsync();
            await using var q = new Npgsql.NpgsqlCommand("SELECT count(*) FROM tenants WHERE id=1", chk);
            if ((long)(await q.ExecuteScalarAsync())! == 0) return; // base sin el tenant 1 (copia solo-esquema)
        }
        var master = RandomNumberGenerator.GetBytes(32);
        var store = new NpgsqlTenantKeyStore(Conn);
        var vault = new SecretVault(new FixedMaster2(master), store);
        var enc = await vault.ProtectAsync(1, "twitch_app", "client_secret", "valor-de-prueba");
        // un vault nuevo (sin caché) lee la clave envuelta desde la BD
        var otro = new SecretVault(new FixedMaster2(master), store);
        Assert.Equal("valor-de-prueba", await otro.UnprotectAsync(1, "twitch_app", "client_secret", enc));
        // el tenant 2 no ve la clave del 1 (RLS)
        Assert.Null(await store.GetAsync(2, 1));
        await using var c = Decatron.Core.Interfaces.TenantNpgsql.Create(Conn, 1);
        await c.OpenAsync();
        await using var del = new Npgsql.NpgsqlCommand("DELETE FROM tenant_keys WHERE tenant_id=1", c);
        await del.ExecuteNonQueryAsync();
    }

    private sealed class FixedMaster2 : IMasterKeySource
    {
        private readonly byte[] _k;
        public FixedMaster2(byte[] k) => _k = k;
        public byte[] GetKey() => _k;
    }
}
