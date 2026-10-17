using System.Text;
using Decatron.Core.Interfaces;
using Decatron.Data.Encryption;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase A, pieza F: TOTP (vectores de RFC 6238), token de paso y el flujo del 2FA sobre decatron_schema (DECATRON_APP_CONN).</summary>
public class BuyerMfaTests
{
    private static readonly byte[] RfcKey = Encoding.ASCII.GetBytes("12345678901234567890");

    [Theory(DisplayName = "TOTP: vectores de RFC 6238 (SHA1, 6 digitos)")]
    [InlineData(59L, "287082")]
    [InlineData(1111111109L, "081804")]
    [InlineData(1234567890L, "005924")]
    [InlineData(20000000000L, "353130")]
    public void VectoresRfc(long unix, string expected) => Assert.Equal(expected, BuyerMfa.TotpCode(RfcKey, unix / 30));

    [Fact]
    public void Base32IdaYVuelta()
    {
        var data = new byte[] { 1, 2, 3, 250, 251, 252, 0, 77, 99, 100, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 };
        Assert.Equal(data, BuyerMfa.FromBase32(BuyerMfa.Base32(data)));
        Assert.Equal("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", BuyerMfa.Base32(RfcKey)); // valor publicado en el RFC
    }

    [Fact]
    public void ElCodigoSeAceptaConUnPasoDeDesfaseYNoMas()
    {
        var now = DateTimeOffset.FromUnixTimeSeconds(1_700_000_000);
        var step = BuyerMfa.StepOf(now);
        Assert.Equal(step, BuyerMfa.MatchStep(RfcKey, BuyerMfa.TotpCode(RfcKey, step), now));
        Assert.Equal(step - 1, BuyerMfa.MatchStep(RfcKey, BuyerMfa.TotpCode(RfcKey, step - 1), now));
        Assert.Equal(step + 1, BuyerMfa.MatchStep(RfcKey, BuyerMfa.TotpCode(RfcKey, step + 1), now));
        Assert.Null(BuyerMfa.MatchStep(RfcKey, BuyerMfa.TotpCode(RfcKey, step - 2), now));
        Assert.Null(BuyerMfa.MatchStep(RfcKey, BuyerMfa.TotpCode(RfcKey, step + 2), now));
    }

    [Fact]
    public void NormalizaCodigosConEspaciosYGuiones() => Assert.Equal("ABCD2345", BuyerMfa.Normalize(" abcd-2345 "));

    [Fact]
    public void TokenDePasoValidoSoloParaSuTenantUsuarioYActivacion()
    {
        const string secret = "clave-de-prueba-para-firmar-1234567890";
        var now = DateTimeOffset.UtcNow;
        var t = BuyerStepUp.Issue(3, 81, 1000, secret, now);
        Assert.True(BuyerStepUp.Validate(t, 3, 81, 1000, secret, now));
        Assert.False(BuyerStepUp.Validate(t, 4, 81, 1000, secret, now));            // otro tenant
        Assert.False(BuyerStepUp.Validate(t, 3, 82, 1000, secret, now));            // otro usuario
        Assert.False(BuyerStepUp.Validate(t, 3, 81, 2000, secret, now));            // 2FA reactivado
        Assert.False(BuyerStepUp.Validate(t, 3, 81, 1000, "otra-clave", now));      // firma
        Assert.False(BuyerStepUp.Validate(t, 3, 81, 1000, secret, now.AddMinutes(11))); // vencido
        Assert.False(BuyerStepUp.Validate(t + "x", 3, 81, 1000, secret, now));
        Assert.False(BuyerStepUp.Validate("", 3, 81, 1000, secret, now));
        Assert.False(BuyerStepUp.Validate("basura", 3, 81, 1000, secret, now));
    }

    private sealed class FixedMaster : IMasterKeySource { private readonly byte[] _k = Enumerable.Range(1, 32).Select(i => (byte)i).ToArray(); public byte[] GetKey() => _k; }
    private static string? App => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");

    [Fact(DisplayName = "2FA: activar, verificar, no reutilizar, recuperacion, bloqueo, aislamiento y desactivar")]
    public async Task FlujoCompleto()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        const long A = 9101, B = 9102;
        await using (var c0 = TenantNpgsql.Create(App, 1))
        {
            await c0.OpenAsync();
            if ((string)(await new NpgsqlCommand("select current_database()", c0).ExecuteScalarAsync())! != "decatron_schema") return;
            if ((long)(await new NpgsqlCommand($"select count(*) from tenants where id in ({A},{B})", c0).ExecuteScalarAsync())! != 2) return;
        }
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = App }).Build();
        var mfa = new BuyerMfa(cfg, new SecretVault(new FixedMaster(), new NpgsqlTenantKeyStore(App!)));
        const long U = 5001;
        try
        {
            Assert.False((await mfa.StatusAsync(A, U)).Enabled);
            Assert.Equal(MfaResult.NotEnabled, await mfa.VerifyAsync(A, U, "123456"));

            var (secret, uri) = (await mfa.BeginSetupAsync(A, U, "a@b.c", "Decatron"))!.Value;
            Assert.StartsWith("otpauth://totp/Decatron:", uri);
            var key = BuyerMfa.FromBase32(secret);
            await using (var c = TenantNpgsql.Create(App, A)) { await c.OpenAsync();   // cifrado en reposo
                var raw = (string)(await new NpgsqlCommand("select secret_enc from tenant_buyer_mfa", c).ExecuteScalarAsync())!;
                Assert.StartsWith("ENC2:", raw); Assert.DoesNotContain(secret, raw); }

            Assert.Null(await mfa.ConfirmSetupAsync(A, U, "000000"));                   // codigo malo: sigue sin activar
            Assert.False((await mfa.StatusAsync(A, U)).Enabled);
            var step = BuyerMfa.StepOf(DateTimeOffset.UtcNow);
            var recovery = await mfa.ConfirmSetupAsync(A, U, BuyerMfa.TotpCode(key, step));
            Assert.NotNull(recovery); Assert.Equal(BuyerMfa.RecoveryCodeCount, recovery!.Length);
            Assert.True((await mfa.StatusAsync(A, U)).Enabled);
            Assert.Null(await mfa.BeginSetupAsync(A, U, "a@b.c", "Decatron"));          // ya activo: no se pisa el secreto
            Assert.NotNull(await mfa.EnabledAtAsync(A, U));

            // el mismo codigo no se reutiliza (el de confirmar ya gasto ese paso); uno posterior si sirve
            Assert.Equal(MfaResult.Invalid, await mfa.VerifyAsync(A, U, BuyerMfa.TotpCode(key, step)));
            Assert.Equal(MfaResult.Ok, await mfa.VerifyAsync(A, U, BuyerMfa.TotpCode(key, step + 1)));
            Assert.Equal(MfaResult.Invalid, await mfa.VerifyAsync(A, U, BuyerMfa.TotpCode(key, step + 1)));

            // recuperacion: sirve una vez, con o sin guion y en minusculas
            Assert.Equal(MfaResult.Ok, await mfa.VerifyAsync(A, U, recovery[0].ToLowerInvariant()));
            Assert.Equal(MfaResult.Invalid, await mfa.VerifyAsync(A, U, recovery[0]));
            Assert.Equal(BuyerMfa.RecoveryCodeCount - 1, (await mfa.StatusAsync(A, U)).RecoveryLeft);
            await using (var c = TenantNpgsql.Create(App, A)) { await c.OpenAsync();
                Assert.Equal(0L, await new NpgsqlCommand($"select count(*) from tenant_buyer_recovery_codes where code_hash like '%{recovery[1].Replace("-", "")}%'", c).ExecuteScalarAsync()); } // solo hash

            // aislamiento: el otro tenant no ve nada
            Assert.False((await mfa.StatusAsync(B, U)).Enabled);
            Assert.Equal(MfaResult.NotEnabled, await mfa.VerifyAsync(B, U, recovery[1]));

            // bloqueo tras 5 fallos; mientras dura, ni el codigo bueno entra
            MfaResult last = MfaResult.Invalid;
            for (var i = 0; i < BuyerMfa.MaxFailures; i++) last = await mfa.VerifyAsync(A, U, "999999");
            Assert.Equal(MfaResult.Locked, last);
            Assert.Equal(MfaResult.Locked, await mfa.VerifyAsync(A, U, recovery[2]));
            Assert.True((await mfa.StatusAsync(A, U)).LockedSeconds > 0);
            await using (var c = TenantNpgsql.Create(App, A)) { await c.OpenAsync();   // se levanta el bloqueo a mano para seguir
                await new NpgsqlCommand("update tenant_buyer_mfa set locked_until = now() - interval '1 second'", c).ExecuteNonQueryAsync(); }
            Assert.Equal(MfaResult.Ok, await mfa.VerifyAsync(A, U, recovery[2]));

            var fresh = await mfa.RegenerateRecoveryAsync(A, U);                         // regenerar invalida los anteriores
            Assert.Equal(MfaResult.Invalid, await mfa.VerifyAsync(A, U, recovery[3]));
            Assert.Equal(MfaResult.Ok, await mfa.VerifyAsync(A, U, fresh[0]));

            await using (var c = TenantNpgsql.Create(App, A)) { await c.OpenAsync();   // auditoria sin secretos
                Assert.True((long)(await new NpgsqlCommand("select count(*) from credential_access_log where provider='buyer_mfa'", c).ExecuteScalarAsync())! >= 8); }

            await mfa.DisableAsync(A, U);
            Assert.False((await mfa.StatusAsync(A, U)).Enabled);
            Assert.Null(await mfa.EnabledAtAsync(A, U));
        }
        finally
        {
            await using var c = TenantNpgsql.Create(App, A); await c.OpenAsync();
            await new NpgsqlCommand("delete from tenant_buyer_recovery_codes; delete from tenant_buyer_mfa", c).ExecuteNonQueryAsync();
        }
    }
}
