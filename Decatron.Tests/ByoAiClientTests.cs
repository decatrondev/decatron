using System.Net;
using System.Text;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Services.AI;
using Decatron.Services.Finance;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 5.8: la IA de un tenant va por SU llave, su URL y su modelo; sin llave se apaga y jamás usa la del #1.</summary>
public class ByoAiClientTests
{
    private sealed class Handler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public List<(Uri? Url, string? Auth, string Body)> Calls = new();
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage r, CancellationToken ct)
        {
            Calls.Add((r.RequestUri, r.Headers.Authorization?.ToString(), r.Content is null ? "" : await r.Content.ReadAsStringAsync(ct)));
            return respond(r);
        }
    }

    private sealed class Factory(HttpMessageHandler h) : IHttpClientFactory { public HttpClient CreateClient(string name) => new(h, false); }

    private sealed class Byo(ByoKey? key) : IByoKeys
    {
        public Task<ByoKey?> GetAsync(string provider, long? tenantId = null, CancellationToken ct = default) => Task.FromResult(key);
        public bool IsAvailable(string provider, long? tenantId = null) => key is not null;
        public void Invalidate(long tenantId) { }
    }

    private static HttpResponseMessage Ok(string text) => new(HttpStatusCode.OK)
    { Content = new StringContent("{\"choices\":[{\"message\":{\"content\":\"" + text + "\"}}],\"usage\":{\"prompt_tokens\":3,\"completion_tokens\":2}}", Encoding.UTF8, "application/json") };

    private static OpenRouterClient Make(Handler h, ByoKey? key)
    {
        var sp = new ServiceCollection().BuildServiceProvider();
        var scopes = sp.GetRequiredService<IServiceScopeFactory>();
        var settings = new AiSettingsCache(scopes, NullLogger<AiSettingsCache>.Instance);
        var credits = new AiCreditGate(scopes, new CreditRates(scopes, NullLogger<CreditRates>.Instance), NullLogger<AiCreditGate>.Instance);
        var usage = new AiUsageRecorder(scopes, settings, credits, NullLogger<AiUsageRecorder>.Instance);
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["OpenRouterSettings:ApiKey"] = "llave-del-uno" }).Build();
        return new OpenRouterClient(new Factory(h), cfg, usage, settings, NullLogger<OpenRouterClient>.Instance, new Byo(key));
    }

    private static ByoKey Key(string baseUrl = "https://api.example.com/v1", string? fallback = null)
    {
        var c = new Dictionary<string, string> { ["base_url"] = baseUrl, ["model"] = "modelo-1" };
        if (fallback != null) c["fallback_model"] = fallback;
        return new ByoKey("llave-del-tenant", c);
    }

    [Fact]
    public async Task Tenant_UsaSuLlave_SuUrl_YSuModelo_SinCampoReasoning()
    {
        var h = new Handler(_ => Ok("hola"));
        using var _ = TenantAmbient.Push(2);
        var r = await Make(h, Key()).ChatAsync("modelo-global-del-uno", "sys", "user", new AiCallContext("test"));
        Assert.Equal("hola", r.Text);
        var call = Assert.Single(h.Calls);
        Assert.Equal("https://api.example.com/v1/chat/completions", call.Url!.ToString());
        Assert.Equal("Bearer llave-del-tenant", call.Auth);
        Assert.Contains("\"model\":\"modelo-1\"", call.Body);
        Assert.DoesNotContain("reasoning", call.Body);
        Assert.DoesNotContain("modelo-global-del-uno", call.Body);
    }

    [Fact]
    public async Task OpenRouterDelTenant_SiLlevaReasoning()
    {
        var h = new Handler(_ => Ok("ok"));
        using var _ = TenantAmbient.Push(2);
        await Make(h, Key("https://openrouter.ai/api/v1")).ChatAsync("x", "s", "u", new AiCallContext("test"));
        Assert.Contains("\"reasoning\":{\"enabled\":false}", h.Calls[0].Body);
    }

    [Fact]
    public async Task SiElPrincipalFalla_ProbarElRespaldo()
    {
        var n = 0;
        var h = new Handler(_ => ++n == 1 ? new HttpResponseMessage(HttpStatusCode.InternalServerError) : Ok("respaldo"));
        using var _ = TenantAmbient.Push(2);
        var r = await Make(h, Key(fallback: "modelo-2")).ChatAsync("x", "s", "u", new AiCallContext("test"));
        Assert.Equal("respaldo", r.Text);
        Assert.Equal("modelo-2", r.Model);
        Assert.Equal(2, h.Calls.Count);
    }

    [Fact]
    public async Task SinLlave_SeApaga_YNuncaLlamaALaDelUno()
    {
        var h = new Handler(_ => Ok("no debe llamarse"));
        using var _ = TenantAmbient.Push(2);
        var client = Make(h, null);
        Assert.False(client.IsConfigured);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => client.ChatAsync("x", "s", "u", new AiCallContext("test")));
        Assert.Equal("byo_not_configured", ex.Message);
        Assert.Empty(h.Calls);
    }

    [Fact]
    public async Task Tenant_ConLlaveSinModelo_SeApaga()
    {
        var h = new Handler(_ => Ok("x"));
        using var _ = TenantAmbient.Push(2);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Make(h, new ByoKey("k", new Dictionary<string, string> { ["base_url"] = "https://api.example.com/v1" })).ChatAsync("x", "s", "u", new AiCallContext("test")));
        Assert.Empty(h.Calls);
    }

    [Fact]
    public async Task TenantUno_SigueConSuLlaveDeAppsettings()
    {
        var h = new Handler(_ => Ok("uno"));
        var client = Make(h, null);
        Assert.True(client.IsConfigured);
        await client.ChatAsync("qwen/x", "s", "u", new AiCallContext("test"));
        Assert.Equal("https://openrouter.ai/api/v1/chat/completions", h.Calls[0].Url!.ToString());
        Assert.Equal("Bearer llave-del-uno", h.Calls[0].Auth);
    }
}
