using System.Net;
using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 5.8: IByoKeys (el #1 lee appsettings; otro tenant usa SU llave y sin ella queda apagado) y el validador.</summary>
public class ByoKeysTests
{
    private sealed class Store : ITenantByoStore
    {
        public Dictionary<(long, string), ByoKey> Keys = new();
        public int Reads;
        public Task SaveAsync(long t, string p, string k, IReadOnlyDictionary<string, string> c, string a, CancellationToken ct = default) { Keys[(t, p)] = new ByoKey(k, c); return Task.CompletedTask; }
        public Task<ByoKeySummary?> GetSummaryAsync(long t, string p, CancellationToken ct = default) => Task.FromResult<ByoKeySummary?>(null);
        public Task<ByoKey?> GetAsync(long t, string p, string purpose, CancellationToken ct = default) { Reads++; return Task.FromResult(Keys.GetValueOrDefault((t, p))); }
        public Task<bool> DeleteAsync(long t, string p, string a, CancellationToken ct = default) => Task.FromResult(Keys.Remove((t, p)));
    }

    private sealed class Ent(params string[] caps) : IEntitlements
    {
        public Task<bool> IsOperationalAsync(long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult(true);
        public Task<bool> HasAsync(string f, long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult(caps.Contains(f));
        public Task<(bool Operational, decimal? Limit)> LimitAsync(string k, long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult((true, (decimal?)null));
        public Task<EntitlementResult> TryConsumeAsync(string k, long a = 1, long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult(EntitlementResult.Ok());
        public Task<EntitlementResult> CheckGaugeAsync(string k, long c, long a = 1, long? t = null, CancellationToken ct = default) => Task.FromResult(EntitlementResult.Ok());
        public void Invalidate(long? t = null) { }
    }

    private static IConfiguration Cfg() => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
    { ["OpenRouterSettings:ApiKey"] = "llave-del-uno", ["Deepgram:ApiKey"] = "dg-del-uno" }).Build();

    [Fact]
    public async Task TenantUno_LeeAppsettings_SinTocarElAlmacen()
    {
        var store = new Store();
        var k = new ByoKeys(Cfg(), store, new Ent());
        Assert.Equal("llave-del-uno", (await k.GetAsync(ByoProviders.Ai, 1))!.ApiKey);
        Assert.Equal("dg-del-uno", (await k.GetAsync(ByoProviders.Deepgram, 1))!.ApiKey);
        Assert.Null(await k.GetAsync(ByoProviders.FishAudio, 1)); // sin llave en appsettings
        Assert.Equal(0, store.Reads);
    }

    [Fact]
    public async Task OtroTenantSinLlave_RecibeNull_NuncaLaDelUno()
    {
        var k = new ByoKeys(Cfg(), new Store(), new Ent("byo.ai", "byo.stt", "byo.tts"));
        Assert.Null(await k.GetAsync(ByoProviders.Ai, 2));
        Assert.Null(await k.GetAsync(ByoProviders.Deepgram, 2));
    }

    [Fact]
    public async Task OtroTenantConSuLlave_LaUsa_YElPlanDebeAdmitirla()
    {
        var store = new Store();
        await store.SaveAsync(2, ByoProviders.Ai, "llave-del-dos", new Dictionary<string, string> { ["model"] = "m" }, "t");
        Assert.Equal("llave-del-dos", (await new ByoKeys(Cfg(), store, new Ent("byo.ai")).GetAsync(ByoProviders.Ai, 2))!.ApiKey);
        Assert.Null(await new ByoKeys(Cfg(), store, new Ent()).GetAsync(ByoProviders.Ai, 2)); // el plan no admite byo
        Assert.NotNull(await new ByoKeys(Cfg(), store, new Ent("byo.translate")).GetAsync(ByoProviders.Ai, 2)); // traduccion tambien habilita la IA
    }

    [Fact]
    public async Task Cache_YInvalidar()
    {
        var store = new Store();
        var k = new ByoKeys(Cfg(), store, new Ent("byo.ai"));
        Assert.Null(await k.GetAsync(ByoProviders.Ai, 2));
        await store.SaveAsync(2, ByoProviders.Ai, "nueva-llave", new Dictionary<string, string>(), "t");
        Assert.Null(await k.GetAsync(ByoProviders.Ai, 2)); // negativa cacheada
        Assert.Equal(1, store.Reads);
        k.Invalidate(2);
        Assert.Equal("nueva-llave", (await k.GetAsync(ByoProviders.Ai, 2))!.ApiKey);
    }

    [Theory]
    [InlineData("10.0.0.5", true)] [InlineData("127.0.0.1", true)] [InlineData("192.168.1.1", true)] [InlineData("172.16.0.1", true)]
    [InlineData("169.254.169.254", true)] [InlineData("::1", true)] [InlineData("8.8.8.8", false)] [InlineData("104.18.0.1", false)]
    public void IpsPrivadasSeRechazan(string ip, bool privada) => Assert.Equal(privada, ByoKeyValidator.IsPrivate(IPAddress.Parse(ip)));

    [Theory]
    [InlineData("http://api.example.com/v1")] [InlineData("https://localhost/v1")] [InlineData("https://127.0.0.1/v1")]
    [InlineData("https://user:pw@api.example.com")] [InlineData("no-es-url")] [InlineData("https://intranet/v1")]
    public async Task UrlsInseguras_SeRechazan(string url) => Assert.Null(await ByoKeyValidator.SafeBaseUrlAsync(url, default));

    [Fact]
    public void VocesDeFish()
    {
        Assert.True(ByoKeyValidator.VoicesValid("[{\"name\":\"Toji\",\"referenceId\":\"abc123_-\"}]"));
        Assert.False(ByoKeyValidator.VoicesValid("[{\"name\":\"\",\"referenceId\":\"abc\"}]"));
        Assert.False(ByoKeyValidator.VoicesValid("[{\"name\":\"X\",\"referenceId\":\"a b;\"}]"));
        Assert.False(ByoKeyValidator.VoicesValid("no es json"));
    }
}
