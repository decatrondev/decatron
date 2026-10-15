using System.Security.Cryptography;
using Decatron.Core.Interfaces;
using Decatron.Data.Encryption;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 4 (paso 4): proveedor del almacen (cache, falla cerrada) y almacen real sobre decatron_schema (DECATRON_APP_CONN + DECATRON_SCHEMA_CONN).</summary>
public class StoreCredentialProviderTests
{
    private sealed class FakeStore : ITenantCredentialStore
    {
        public int Calls;
        public Dictionary<long, TwitchAppCredentials> Apps = new();
        public Task<TwitchAppCredentials?> GetTwitchAppAsync(long t, CancellationToken ct = default) { Calls++; return Task.FromResult(Apps.GetValueOrDefault(t)); }
        public Task<TwitchAppSummary?> GetTwitchAppSummaryAsync(long t, CancellationToken ct = default) => Task.FromResult<TwitchAppSummary?>(null);
        public Task SaveTwitchAppAsync(long t, TwitchAppInput i, string a, CancellationToken ct = default) => Task.CompletedTask;
        public Task<bool> DeleteTwitchAppAsync(long t, string a, CancellationToken ct = default) => Task.FromResult(false);
    }

    private static IConfiguration Cfg() => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["TwitchSettings:ClientId"] = "uno" }).Build();

    [Fact]
    public void TenantUnoNuncaTocaElAlmacen()
    {
        var store = new FakeStore();
        Assert.Equal("uno", new CredentialProvider(Cfg(), store).GetTwitchApp().ClientId);
        Assert.Equal(0, store.Calls);
    }

    [Fact]
    public void OtroTenantLeeSuAppYLaCachea()
    {
        var store = new FakeStore { Apps = { [2] = new TwitchAppCredentials("dos", "sec", null, null, null) } };
        var p = new CredentialProvider(Cfg(), store);
        using var _ = TenantAmbient.Push(2);
        Assert.Equal("dos", p.GetTwitchApp().ClientId);
        Assert.Equal("dos", p.GetTwitchApp().ClientId);
        Assert.Equal(1, store.Calls);
        p.Invalidate(2);
        p.GetTwitchApp();
        Assert.Equal(2, store.Calls);
    }

    [Fact]
    public void TenantSinAppFallaCerradoYNoCaeAlUno()
    {
        var p = new CredentialProvider(Cfg(), new FakeStore());
        using var _ = TenantAmbient.Push(3);
        var ex = Assert.Throws<CredentialsNotConfiguredException>(() => p.GetTwitchApp());
        Assert.Equal(3, ex.TenantId);
    }

    [Fact]
    public void LaAppDeUnTenantNoSeFiltraAOtro()
    {
        var store = new FakeStore { Apps = { [2] = new TwitchAppCredentials("dos", "sec", null, null, null) } };
        var p = new CredentialProvider(Cfg(), store);
        using (TenantAmbient.Push(2)) p.GetTwitchApp();
        using var _ = TenantAmbient.Push(3);
        Assert.Throws<CredentialsNotConfiguredException>(() => p.GetTwitchApp());
    }
}

public class NpgsqlTenantCredentialStoreTests
{
    private sealed class FixedMaster : IMasterKeySource { private readonly byte[] _k = RandomNumberGenerator.GetBytes(32); public byte[] GetKey() => _k; }

    private static string? App => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
    private static string? Schema => Environment.GetEnvironmentVariable("DECATRON_SCHEMA_CONN");

    [Fact(DisplayName = "Guardar, leer, aislar entre tenants y borrar (cifrado en reposo)")]
    public async Task IdaVueltaYAislamiento()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        const long A = 9101, B = 9102;
        // Los tenants 9101/9102 viven en decatron_schema (copia solo-esquema, desechable); decatron_app no puede crear tenants.
        await using (var c0 = TenantNpgsql.Create(App, 1))
        {
            await c0.OpenAsync();
            Assert.Equal("decatron_schema", (string)(await new NpgsqlCommand("select current_database()", c0).ExecuteScalarAsync())!);
            if ((long)(await new NpgsqlCommand($"select count(*) from tenants where id in ({A},{B})", c0).ExecuteScalarAsync())! != 2) return;
        }
        try
        {
            var vault = new SecretVault(new FixedMaster(), new NpgsqlTenantKeyStore(App!));
            var store = new NpgsqlTenantCredentialStore(App!, vault);
            const string secret = "sssssssssssssssssssssssssssssssss-ABCD";
            await store.SaveTwitchAppAsync(A, new TwitchAppInput("abcdefghijklmnopqrstuvwxyz1234", secret, "https://a.example/cb", "chat:read"), "tester");

            var app = await store.GetTwitchAppAsync(A);
            Assert.NotNull(app);
            Assert.Equal(secret, app!.ClientSecret);
            Assert.Equal("abcdefghijklmnopqrstuvwxyz1234", app.ClientId);
            Assert.Equal("chat:read", app.Scopes);
            Assert.False(string.IsNullOrEmpty(app.WebhookSecret));

            var sum = await store.GetTwitchAppSummaryAsync(A);
            Assert.Equal("ABCD", sum!.SecretHint);
            Assert.Equal("ok", sum.Status);

            // Cifrado en reposo y aislamiento por RLS
            await using (var c = TenantNpgsql.Create(App, A)) { await c.OpenAsync();
                var raw = (string)(await new NpgsqlCommand("select secret_enc from tenant_credentials where kind='client_secret'", c).ExecuteScalarAsync())!;
                Assert.StartsWith("ENC2:", raw); Assert.DoesNotContain("sssss", raw); }
            Assert.Null(await store.GetTwitchAppAsync(B));
            await using (var c = TenantNpgsql.Create(App, B)) { await c.OpenAsync();
                Assert.Equal(0L, await new NpgsqlCommand("select count(*) from tenant_credentials", c).ExecuteScalarAsync()); }

            // La auditoria registra escritura y lectura, sin secretos
            await using (var c = TenantNpgsql.Create(App, A)) { await c.OpenAsync();
                Assert.True((long)(await new NpgsqlCommand("select count(*) from credential_access_log where action in ('write','read')", c).ExecuteScalarAsync())! >= 3); }

            Assert.True(await store.DeleteTwitchAppAsync(A, "tester"));
            Assert.Null(await store.GetTwitchAppAsync(A));
        }
        finally
        {
            // El log de auditoria es solo insercion para la app: se limpia solo si hay cadena de administracion.
            if (!string.IsNullOrWhiteSpace(Schema))
            {
                await using var s = new NpgsqlConnection(Schema); await s.OpenAsync();
                foreach (var t in new[] { "credential_access_log", "tenant_credentials", "tenant_provider_config", "tenant_keys" })
                    await new NpgsqlCommand($"delete from {t} where tenant_id in ({A},{B})", s).ExecuteNonQueryAsync();
            }
        }
    }
}
