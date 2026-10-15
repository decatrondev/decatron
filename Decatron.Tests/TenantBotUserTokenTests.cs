using System.Net;
using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 4: el token de usuario del bot de un tenant se refresca solo, con SU app, y nunca cae al del #1.</summary>
public class TenantBotUserTokenTests
{
    private sealed class Store : ITenantCredentialStore
    {
        public Dictionary<long, TwitchBotTokens> Tokens = new();
        public int Updates;
        public Task<TwitchBotTokens?> GetTwitchBotTokensAsync(long t, string p, CancellationToken ct = default) => Task.FromResult(Tokens.GetValueOrDefault(t));
        public Task UpdateTwitchBotTokensAsync(long t, TwitchBotTokens k, CancellationToken ct = default) { Updates++; Tokens[t] = k; return Task.CompletedTask; }
        public Task<TwitchAppCredentials?> GetTwitchAppAsync(long t, CancellationToken ct = default) => Task.FromResult<TwitchAppCredentials?>(null);
        public Task<TwitchAppSummary?> GetTwitchAppSummaryAsync(long t, CancellationToken ct = default) => Task.FromResult<TwitchAppSummary?>(null);
        public Task SaveTwitchAppAsync(long t, TwitchAppInput i, string a, CancellationToken ct = default) => Task.CompletedTask;
        public Task<bool> DeleteTwitchAppAsync(long t, string a, CancellationToken ct = default) => Task.FromResult(false);
        public Task SaveTwitchBotAsync(long t, TwitchBotInput i, string a, CancellationToken ct = default) => Task.CompletedTask;
        public Task<TwitchBotSummary?> GetTwitchBotAsync(long t, CancellationToken ct = default) => Task.FromResult<TwitchBotSummary?>(null);
        public Task<bool> DeleteTwitchBotAsync(long t, string a, CancellationToken ct = default) => Task.FromResult(false);
        public Task SaveDiscordBotAsync(long t, DiscordBotInput i, string a, CancellationToken ct = default) => Task.CompletedTask;
        public Task<DiscordBotSummary?> GetDiscordBotAsync(long t, CancellationToken ct = default) => Task.FromResult<DiscordBotSummary?>(null);
        public Task<string?> GetDiscordBotTokenAsync(long t, string p, CancellationToken ct = default) => Task.FromResult<string?>(null);
        public Task<bool> DeleteDiscordBotAsync(long t, string a, CancellationToken ct = default) => Task.FromResult(false);
        public Task<IReadOnlyList<long>> ListActiveTenantIdsAsync(CancellationToken ct = default) => Task.FromResult<IReadOnlyList<long>>(new List<long>());
        public Task<long?> FindActiveTenantIdAsync(string slug, CancellationToken ct = default) => Task.FromResult<long?>(null);
    }

    private sealed class Creds : ICredentialProvider
    {
        public TwitchAppCredentials GetTwitchApp() => (TenantAmbient.Current ?? 1) == 2
            ? new TwitchAppCredentials("app-dos", "secreto-dos", null, null, null)
            : throw new CredentialsNotConfiguredException(TenantAmbient.Current ?? 1, "app");
        public string? GetTwitchBotUsername() => null;
        public void Invalidate(long tenantId) { }
    }

    private sealed class Http : IHttpClientFactory
    {
        public List<string> Bodies = new(); public HttpStatusCode Status = HttpStatusCode.OK;
        private sealed class H(Http o) : HttpMessageHandler
        {
            protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage r, CancellationToken ct)
            {
                o.Bodies.Add(await r.Content!.ReadAsStringAsync(ct));
                return new HttpResponseMessage(o.Status) { Content = new StringContent("{\"access_token\":\"nuevo-acceso\",\"refresh_token\":\"nuevo-refresco\",\"expires_in\":14000}") };
            }
        }
        public HttpClient CreateClient(string name) => new(new H(this));
    }

    private static TenantBotUserToken Make(Store s, Http h) => new(s, new Creds(), h, NullLogger<TenantBotUserToken>.Instance);

    [Fact]
    public async Task TenantUnoNoPasaPorAqui()
    {
        var s = new Store(); s.Tokens[1] = new TwitchBotTokens("del-uno", "r", DateTimeOffset.UtcNow.AddHours(1));
        Assert.Null(await Make(s, new Http()).GetAsync());
    }

    [Fact]
    public async Task TokenVigenteSeDevuelveSinRefrescar()
    {
        var s = new Store(); s.Tokens[2] = new TwitchBotTokens("vigente", "r", DateTimeOffset.UtcNow.AddHours(1)); var h = new Http();
        using var _ = TenantAmbient.Push(2);
        Assert.Equal("vigente", await Make(s, h).GetAsync());
        Assert.Empty(h.Bodies); Assert.Equal(0, s.Updates);
    }

    [Fact]
    public async Task TokenPorVencerSeRefrescaConLaAppDelTenantYSeGuarda()
    {
        var s = new Store(); s.Tokens[2] = new TwitchBotTokens("viejo", "refresco-viejo", DateTimeOffset.UtcNow.AddMinutes(1)); var h = new Http();
        using var _ = TenantAmbient.Push(2);
        Assert.Equal("nuevo-acceso", await Make(s, h).GetAsync());
        var body = Assert.Single(h.Bodies);
        Assert.Contains("client_id=app-dos", body); Assert.Contains("refresh_token=refresco-viejo", body);
        Assert.Equal(1, s.Updates);
        Assert.Equal("nuevo-refresco", s.Tokens[2].RefreshToken);
        Assert.True(s.Tokens[2].ExpiresAt > DateTimeOffset.UtcNow.AddHours(3));
        Assert.Equal("nuevo-acceso", await Make(s, h).GetAsync()); // ya vigente: no vuelve a refrescar
        Assert.Single(h.Bodies);
    }

    [Fact]
    public async Task SinBotOConRefrescoRechazadoDevuelveNullSinTocarElToken()
    {
        var s = new Store(); var h = new Http();
        using var _ = TenantAmbient.Push(2);
        Assert.Null(await Make(s, h).GetAsync()); // sin bot
        s.Tokens[2] = new TwitchBotTokens("viejo", "r", DateTimeOffset.UtcNow.AddMinutes(-1)); h.Status = HttpStatusCode.BadRequest;
        Assert.Null(await Make(s, h).GetAsync());
        Assert.Equal(0, s.Updates); Assert.Equal("viejo", s.Tokens[2].AccessToken);
    }

    [Fact]
    public async Task VencidoSinRefrescoPideReautorizar()
    {
        var s = new Store(); s.Tokens[2] = new TwitchBotTokens("viejo", null, DateTimeOffset.UtcNow.AddMinutes(-1));
        using var _ = TenantAmbient.Push(2);
        Assert.Null(await Make(s, new Http()).GetAsync());
    }

    [Fact]
    public async Task TenantSinAppNoRefrescaNiUsaOtra()
    {
        var s = new Store(); s.Tokens[3] = new TwitchBotTokens("viejo", "r", DateTimeOffset.UtcNow.AddMinutes(-1)); var h = new Http();
        using var _ = TenantAmbient.Push(3);
        Assert.Null(await Make(s, h).GetAsync());
        Assert.Empty(h.Bodies);
    }
}
