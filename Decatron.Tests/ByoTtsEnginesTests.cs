using System.Net;
using Decatron.Core.Interfaces;
using Decatron.Services.LiveTranslation;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 5.8: las voces Fish y Aura de un tenant usan SU llave; sin ella se apagan y nunca usan la del #1.</summary>
public class ByoTtsEnginesTests
{
    private sealed class Handler : HttpMessageHandler
    {
        public List<(Uri? Url, string? Auth, string? Model)> Calls = new();
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage r, CancellationToken ct)
        {
            Calls.Add((r.RequestUri, r.Headers.Authorization?.ToString(), r.Headers.TryGetValues("model", out var m) ? m.First() : null));
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(new byte[] { 1, 2, 3 }) });
        }
    }
    private sealed class Factory(HttpMessageHandler h) : IHttpClientFactory { public HttpClient CreateClient(string name) => new(h, false); }
    private sealed class Byo(Dictionary<string, ByoKey> keys) : IByoKeys
    {
        public Task<ByoKey?> GetAsync(string p, long? t = null, CancellationToken ct = default) => Task.FromResult(keys.GetValueOrDefault(p));
        public bool IsAvailable(string p, long? t = null) => keys.ContainsKey(p);
        public void Invalidate(long t) { }
    }
    private static IConfiguration Cfg() => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
    { ["FishAudio:ApiKey"] = "fish-del-uno", ["Deepgram:ApiKey"] = "dg-del-uno" }).Build();

    private static async Task<int> Drain(IAsyncEnumerable<ReadOnlyMemory<byte>> s) { var n = 0; await foreach (var c in s) n += c.Length; return n; }

    [Fact]
    public async Task Fish_Tenant_UsaSuLlaveYSuModelo()
    {
        var h = new Handler();
        var e = new FishAudioTtsEngine(new Factory(h), Cfg(), new Byo(new() { ["fishaudio"] = new ByoKey("fish-del-tenant", new Dictionary<string, string> { ["model"] = "s2" }) }));
        using var _ = TenantAmbient.Push(2);
        Assert.True(e.IsConfigured);
        Assert.Equal(3, await Drain(e.SynthesizeAsync("hola", "4eb30374137749b9a377f06674a3ca22", default)));
        Assert.Equal("Bearer fish-del-tenant", h.Calls[0].Auth);
        Assert.Equal("s2", h.Calls[0].Model);
    }

    [Fact]
    public async Task Fish_TenantSinLlave_SeApaga_SinLlamarALaDelUno()
    {
        var h = new Handler();
        var e = new FishAudioTtsEngine(new Factory(h), Cfg(), new Byo(new()));
        using var _ = TenantAmbient.Push(2);
        Assert.False(e.IsConfigured);
        await Assert.ThrowsAsync<InvalidOperationException>(() => Drain(e.SynthesizeAsync("hola", "", default)));
        Assert.Empty(h.Calls);
    }

    [Fact]
    public async Task Fish_TenantUno_SigueConAppsettings()
    {
        var h = new Handler();
        var e = new FishAudioTtsEngine(new Factory(h), Cfg(), new Byo(new()));
        Assert.True(e.IsConfigured);
        await Drain(e.SynthesizeAsync("hola", "", default));
        Assert.Equal("Bearer fish-del-uno", h.Calls[0].Auth);
    }

    [Fact]
    public async Task Aura_Tenant_UsaSuLlave_YSinLlaveSeApaga()
    {
        var h = new Handler();
        var con = new DeepgramAuraTtsEngine(new Factory(h), Cfg(), new Byo(new() { ["deepgram"] = new ByoKey("dg-del-tenant", new Dictionary<string, string>()) }));
        using (TenantAmbient.Push(2))
        {
            Assert.True(con.IsConfigured);
            await Drain(con.SynthesizeAsync("hola", "aura-2-celeste-es", default));
            Assert.Equal("Token dg-del-tenant", h.Calls[0].Auth);
        }
        var sin = new DeepgramAuraTtsEngine(new Factory(h), Cfg(), new Byo(new()));
        using (TenantAmbient.Push(2))
        {
            Assert.False(sin.IsConfigured);
            await Assert.ThrowsAsync<InvalidOperationException>(() => Drain(sin.SynthesizeAsync("hola", "aura-2-celeste-es", default)));
        }
        Assert.Single(h.Calls);
        await Drain(sin.SynthesizeAsync("hola", "aura-2-celeste-es", default)); // el #1
        Assert.Equal("Token dg-del-uno", h.Calls[1].Auth);
    }
}
