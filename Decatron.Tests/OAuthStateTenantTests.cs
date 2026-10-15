using Decatron.Services;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 4 (paso 5): el tenant viaja firmado en el state del OAuth y no se puede alterar.</summary>
public class OAuthStateTenantTests
{
    private const string Key = "clave-de-prueba-con-suficiente-longitud-123456";

    [Fact]
    public void ElTenantViajaFirmado()
    {
        var state = AuthService.SignOAuthState("/panel", 7, Key);
        var (ok, redirect, tenant) = AuthService.ValidateOAuthStateWithTenant(state, Key);
        Assert.True(ok); Assert.Equal("/panel", redirect); Assert.Equal(7, tenant);
    }

    [Fact]
    public void SinTenantOUnoEsNull()
    {
        Assert.Null(AuthService.ValidateOAuthStateWithTenant(AuthService.SignOAuthState(null, null, Key), Key).TenantId);
        Assert.Null(AuthService.ValidateOAuthStateWithTenant(AuthService.SignOAuthState(null, 1, Key), Key).TenantId);
    }

    [Fact]
    public void CambiarElTenantInvalidaLaFirma()
    {
        var state = AuthService.SignOAuthState("/x", 7, Key);
        var json = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(state.Split('.')[0])).Replace("\"tn\":7", "\"tn\":1");
        var forged = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(json)) + "." + state.Split('.')[1];
        Assert.False(AuthService.ValidateOAuthStateWithTenant(forged, Key).IsValid);
        Assert.False(AuthService.ValidateOAuthStateWithTenant(state, "otra-clave-distinta-de-la-original-xxxxxxxxx").IsValid);
    }

    [Fact]
    public void LaFirmaAntiguaSinTenantSigueValiendo()
    {
        // state generado por la version anterior: {"redirect":"/a","ts":...} sin tn
        var payload = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{{\"redirect\":\"/a\",\"ts\":{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}}}"));
        using var h = new System.Security.Cryptography.HMACSHA256(System.Text.Encoding.UTF8.GetBytes(Key));
        var sig = Convert.ToBase64String(h.ComputeHash(System.Text.Encoding.UTF8.GetBytes(payload)));
        var (ok, redirect, tenant) = AuthService.ValidateOAuthStateWithTenant($"{payload}.{sig}", Key);
        Assert.True(ok); Assert.Equal("/a", redirect); Assert.Null(tenant);
    }
}
