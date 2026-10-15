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
        public Task SaveTwitchBotAsync(long t, TwitchBotInput i, string a, CancellationToken ct = default) => Task.CompletedTask;
        public Task<TwitchBotSummary?> GetTwitchBotAsync(long t, CancellationToken ct = default) => Task.FromResult<TwitchBotSummary?>(null);
        public Task<bool> DeleteTwitchBotAsync(long t, string a, CancellationToken ct = default) => Task.FromResult(false);
        public Task SaveDiscordBotAsync(long t, DiscordBotInput i, string a, CancellationToken ct = default) => Task.CompletedTask;
        public Task<DiscordBotSummary?> GetDiscordBotAsync(long t, CancellationToken ct = default) => Task.FromResult<DiscordBotSummary?>(null);
        public Task<string?> GetDiscordBotTokenAsync(long t, string p, CancellationToken ct = default) => Task.FromResult<string?>(null);
        public Task<bool> DeleteDiscordBotAsync(long t, string a, CancellationToken ct = default) => Task.FromResult(false);
        public Task<IReadOnlyList<long>> ListActiveTenantIdsAsync(CancellationToken ct = default) => Task.FromResult<IReadOnlyList<long>>(new List<long>());
        public Task<long?> FindActiveTenantIdAsync(string slug, CancellationToken ct = default) => Task.FromResult<long?>(null);
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
    private sealed class FixedMaster : IMasterKeySource { private readonly byte[] _k = Enumerable.Range(1, 32).Select(i => (byte)i).ToArray(); public byte[] GetKey() => _k; }

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

            // Cuenta de bot: se guarda cifrada, el resumen no trae tokens y otro tenant no la ve
            await store.SaveTwitchBotAsync(A, new TwitchBotInput("anabot", "123456", "tok-acceso-secreto", "tok-refresco-secreto", DateTimeOffset.UtcNow.AddHours(4)), "tester");
            var bot = await store.GetTwitchBotAsync(A);
            Assert.Equal("anabot", bot!.Username); Assert.Equal("123456", bot.TwitchId);
            Assert.Null(await store.GetTwitchBotAsync(B));
            await using (var c = TenantNpgsql.Create(App, A)) { await c.OpenAsync();
                var raws = new List<string>();
                await using var rd = await new NpgsqlCommand("select secret_enc from tenant_credentials where provider='twitch_bot'", c).ExecuteReaderAsync();
                while (await rd.ReadAsync()) raws.Add(rd.GetString(0));
                Assert.Equal(2, raws.Count); Assert.All(raws, r => { Assert.StartsWith("ENC2:", r); Assert.DoesNotContain("secreto", r); }); }
            // Bot de Discord: token cifrado, solo legible por su tenant, resumen sin token
            const string dtok = "token-de-prueba-fakefakefakefakefakefakefakefakefakefake";
            await store.SaveDiscordBotAsync(A, new DiscordBotInput(dtok, "9988", "AnaBot"), "tester");
            var dsum = await store.GetDiscordBotAsync(A);
            Assert.Equal("9988", dsum!.BotId); Assert.Equal("AnaBot", dsum.BotName);
            Assert.Equal(dtok, await store.GetDiscordBotTokenAsync(A, "test"));
            Assert.Null(await store.GetDiscordBotAsync(B));
            Assert.Null(await store.GetDiscordBotTokenAsync(B, "test"));
            await using (var c = TenantNpgsql.Create(App, A)) { await c.OpenAsync();
                var raw = (string)(await new NpgsqlCommand("select secret_enc from tenant_credentials where provider='discord_bot'", c).ExecuteScalarAsync())!;
                Assert.StartsWith("ENC2:", raw); Assert.DoesNotContain("fakefake", raw); }
            Assert.Contains(A, await store.ListActiveTenantIdsAsync());
            Assert.True(await store.DeleteDiscordBotAsync(A, "tester"));
            Assert.Null(await store.GetDiscordBotAsync(A));

            Assert.True(await store.DeleteTwitchBotAsync(A, "tester"));
            Assert.Null(await store.GetTwitchBotAsync(A));

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

public class BotTokensRlsTests
{
    private static string? App => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");

    [Fact(DisplayName = "bot_tokens: un tenant distinto de 1 no ve el bot de Decatron (RLS)")]
    public async Task ElBotDelUnoNoSeVeDesdeOtroTenant()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        await using var one = TenantNpgsql.Create(App, 1); await one.OpenAsync();
        if ((string)(await new NpgsqlCommand("select current_database()", one).ExecuteScalarAsync())! != "decatron_schema") return;
        // Solo valida si la base de pruebas ya tiene la politica (7_bot_tokens_rls.sql)
        if (!(bool)(await new NpgsqlCommand("select relrowsecurity from pg_class where relname='bot_tokens'", one).ExecuteScalarAsync())!) return;
        const int id = 990001;
        try
        {
            await new NpgsqlCommand($"insert into bot_tokens (\"Id\", bot_username, access_token, chat_token, created_at, updated_at, is_active) values ({id}, 'zz-bot', 'x', 'y', now(), now(), true)", one).ExecuteNonQueryAsync();
            Assert.Equal(1L, await new NpgsqlCommand($"select count(*) from bot_tokens where \"Id\"={id}", one).ExecuteScalarAsync());
            await using var other = TenantNpgsql.Create(App, 9101); await other.OpenAsync();
            Assert.Equal(0L, await new NpgsqlCommand("select count(*) from bot_tokens", other).ExecuteScalarAsync());
        }
        finally { await new NpgsqlCommand($"delete from bot_tokens where \"Id\"={id}", one).ExecuteNonQueryAsync(); }
    }
}

public class TenantMembershipTests
{
    private static string? App => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");

    [Fact(DisplayName = "Una cuenta pertenece a un solo tenant: el canal nuevo se crea en su tenant y entrar por otro se rechaza")]
    public async Task UnaCuentaPerteneceAUnTenant()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        await using var c = TenantNpgsql.Create(App, 1); await c.OpenAsync();
        if ((string)(await new NpgsqlCommand("select current_database()", c).ExecuteScalarAsync())! != "decatron_schema") return;
        if ((long)(await new NpgsqlCommand("select count(*) from tenants where id in (9101,9102)", c).ExecuteScalarAsync())! != 2) return;
        const long uid = 990101; const string tw = "zz-tw-990101";
        var cfg = new Microsoft.Extensions.Configuration.ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = App }).Build();
        var m = new Decatron.Services.Tenancy.TenantMembership(cfg);
        try
        {
            await new NpgsqlCommand($@"insert into users (id, twitch_id, login, display_name, email, profile_image_url, offline_image_url, broadcaster_type, view_count, description,
                access_token, refresh_token, token_expiration, created_at, updated_at, is_active, unique_id)
                values ({uid}, '{tw}', 'zzuser', 'Z', '', '', '', '', 0, '', 'a', 'b', now(), now(), now(), true, 'zz-uid-990101')", c).ExecuteNonQueryAsync();

            Assert.False(await m.BelongsElsewhereAsync(tw, 9101)); // cuenta nueva: puede entrar por cualquier tenant
            await m.EnsureChannelAsync(9101, uid, tw, "ZZUser");
            await m.EnsureChannelAsync(9101, uid, tw, "ZZUser"); // idempotente
            Assert.Equal(1L, await new NpgsqlCommand($"select count(*) from channels where user_id={uid}", c).ExecuteScalarAsync());
            Assert.Equal(9101L, await new NpgsqlCommand($"select tenant_id from channels where user_id={uid}", c).ExecuteScalarAsync());
            Assert.False(await m.BelongsElsewhereAsync(tw, 9101)); // por su tenant entra
            Assert.True(await m.BelongsElsewhereAsync(tw, 9102));  // por otro tenant, no
            Assert.True(await m.BelongsElsewhereAsync(tw, 1));     // ni por el #1
        }
        finally
        {
            foreach (var sql in new[] { $"delete from tenant_members where user_id={uid}", $"delete from channels where user_id={uid}", $"delete from users where id={uid}" })
                await new NpgsqlCommand(sql, c).ExecuteNonQueryAsync();
        }
    }
}
