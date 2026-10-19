using System.Net;
using Decatron.Core.Interfaces;
using Decatron.Services.Tts;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Decatron.Tests;

/// <summary>Voces de Fish en el TTS con caché y créditos: llave por tenant, errores de Fish y unidad de cobro (bytes UTF-8).</summary>
public class FishTtsClientTests
{
    private sealed class Handler(HttpStatusCode status, byte[]? body = null) : HttpMessageHandler
    {
        public List<(string? Auth, string? Body)> Calls = new();
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage r, CancellationToken ct)
        {
            Calls.Add((r.Headers.Authorization?.ToString(), r.Content == null ? null : await r.Content.ReadAsStringAsync(ct)));
            return new HttpResponseMessage(status) { Content = new ByteArrayContent(body ?? new byte[] { 1, 2, 3 }) };
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
    { ["FishAudio:ApiKey"] = "fish-del-uno", ["FishAudio:DefaultVoiceId"] = "4eb30374137749b9a377f06674a3ca22" }).Build();
    private static FishTtsClient Client(Handler h, Dictionary<string, ByoKey>? byo = null) =>
        new(new Factory(h), Cfg(), NullLogger<FishTtsClient>.Instance, new Byo(byo ?? new()));

    [Fact]
    public async Task TenantUno_UsaAppsettings_YEnviaLaVoz()
    {
        var h = new Handler(HttpStatusCode.OK);
        var bytes = await Client(h).SynthesizeAsync("hola", "4eb30374137749b9a377f06674a3ca22");
        Assert.Equal(3, bytes.Length);
        Assert.Equal("Bearer fish-del-uno", h.Calls[0].Auth);
        Assert.Contains("\"reference_id\":\"4eb30374137749b9a377f06674a3ca22\"", h.Calls[0].Body);
    }

    [Fact]
    public async Task Tenant_UsaSuLlave_ySinLlaveSeApaga_SinLlamarALaDelUno()
    {
        var h = new Handler(HttpStatusCode.OK);
        using var _ = TenantAmbient.Push(2);
        var con = Client(h, new() { ["fishaudio"] = new ByoKey("fish-del-tenant", new Dictionary<string, string>()) });
        Assert.True(con.IsConfigured);
        await con.SynthesizeAsync("hola", "4eb30374137749b9a377f06674a3ca22");
        Assert.Equal("Bearer fish-del-tenant", h.Calls[0].Auth);

        var sin = Client(h);
        Assert.False(sin.IsConfigured);
        await Assert.ThrowsAsync<InvalidOperationException>(() => sin.SynthesizeAsync("hola", ""));
        Assert.Single(h.Calls);
    }

    [Theory]
    [InlineData(HttpStatusCode.PaymentRequired, 402)]
    [InlineData(HttpStatusCode.NotFound, 404)]
    public async Task ErrorDeFish_LlegaConSuCodigo(HttpStatusCode code, int esperado)
    {
        var ex = await Assert.ThrowsAsync<FishTtsException>(() => Client(new Handler(code)).SynthesizeAsync("hola", ""));
        Assert.Equal(esperado, ex.Status);
    }

    [Fact]
    public void Voz_SoloSeAceptaUnIdDeFish_NoUnNombreDePolly()
    {
        Assert.True(FishTtsClient.LooksLikeVoiceId("4eb30374137749b9a377f06674a3ca22"));
        Assert.False(FishTtsClient.LooksLikeVoiceId("Lupe"));
        Assert.False(FishTtsClient.LooksLikeVoiceId(""));
        Assert.False(FishTtsClient.LooksLikeVoiceId(null));
    }

    [Fact]
    public void Cobro_EsPorBytesUtf8_ElEspanolPesaMasQueSusCaracteres()
    {
        const string frase = "Gracias por el apoyo, Carlos. Acabas de donar cinco dólares y el stream te lo agradece. ¡Vamos con todo!";
        Assert.Equal(106, FishTtsClient.BillableBytes(frase));
        Assert.True(FishTtsClient.BillableBytes(frase) > frase.Length);
    }
}
