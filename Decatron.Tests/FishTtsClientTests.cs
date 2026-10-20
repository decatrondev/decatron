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

    /// <summary>Responde con la secuencia dada (la última se repite) y cuenta las llamadas.</summary>
    private sealed class Sequence(params HttpStatusCode[] codes) : HttpMessageHandler
    {
        public int Calls;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage r, CancellationToken ct)
        {
            var code = codes[Math.Min(Calls, codes.Length - 1)];
            Calls++;
            return Task.FromResult(new HttpResponseMessage(code) { Content = new ByteArrayContent(new byte[] { 1, 2, 3 }) });
        }
    }
    private static FishTtsClient FastRetry(HttpMessageHandler h) => new(new Factory(h), new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
    { ["FishAudio:ApiKey"] = "fish-del-uno", ["FishAudio:RetryDelayMs"] = "1" }).Build(), NullLogger<FishTtsClient>.Instance, new Byo(new()));

    [Fact]
    public async Task LimiteDeFish_429_SeReintentaYTerminaBien()
    {
        var h = new Sequence(HttpStatusCode.TooManyRequests, HttpStatusCode.TooManyRequests, HttpStatusCode.OK);
        var bytes = await FastRetry(h).SynthesizeAsync("hola", "");
        Assert.Equal(3, bytes.Length);
        Assert.Equal(3, h.Calls);
    }

    [Fact]
    public async Task LimiteDeFish_SiPersiste_FallaConSuCodigoTrasLosIntentos()
    {
        var h = new Sequence(HttpStatusCode.TooManyRequests);
        var ex = await Assert.ThrowsAsync<FishTtsException>(() => FastRetry(h).SynthesizeAsync("hola", ""));
        Assert.Equal(429, ex.Status);
        Assert.Equal(3, h.Calls);
    }

    [Theory]
    [InlineData(HttpStatusCode.PaymentRequired)]
    [InlineData(HttpStatusCode.NotFound)]
    [InlineData(HttpStatusCode.UnprocessableEntity)]
    public async Task SinSaldoOVozInservible_NoSeReintenta(HttpStatusCode code)
    {
        var h = new Sequence(code, HttpStatusCode.OK);
        await Assert.ThrowsAsync<FishTtsException>(() => FastRetry(h).SynthesizeAsync("hola", ""));
        Assert.Equal(1, h.Calls);
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

    private const string ModelJson = """
        {"_id":"4eb30374137749b9a377f06674a3ca22","title":"Toji","languages":["es"],"visibility":"public","dmca_taken_down":false,
         "like_count":215,"task_count":44921,"state":"trained","author":{"nickname":"JOA549582"},
         "samples":[{"text":"hola","audio":"https://muestra/a.mp3"}]}
        """;

    [Fact]
    public async Task GetModel_LeeLosDatosPublicos_YUn404EsNull()
    {
        var ok = await Client(new Handler(HttpStatusCode.OK, System.Text.Encoding.UTF8.GetBytes(ModelJson))).GetModelAsync("4eb30374137749b9a377f06674a3ca22");
        Assert.NotNull(ok);
        Assert.Equal("Toji", ok!.Title);
        Assert.Equal("JOA549582", ok.Author);
        Assert.Equal(new[] { "es" }, ok.Languages);
        Assert.Equal("https://muestra/a.mp3", ok.SampleUrl);
        Assert.False(ok.TakenDown);
        Assert.Equal("public", ok.Visibility);

        // El enlace firmado (que caduca) de la consulta por id se guarda como el permanente
        var firmado = ModelJson.Replace("https://muestra/a.mp3", "https://x.r2.cloudflarestorage.com/fish-platform-data/task/abc.mp3?X-Amz-Signature=zzz");
        var m2 = await Client(new Handler(HttpStatusCode.OK, System.Text.Encoding.UTF8.GetBytes(firmado))).GetModelAsync("4eb30374137749b9a377f06674a3ca22");
        Assert.Equal("https://platform.r2.fish.audio/task/abc.mp3", m2!.SampleUrl);

        Assert.Null(await Client(new Handler(HttpStatusCode.NotFound)).GetModelAsync("4eb30374137749b9a377f06674a3ca22"));
        Assert.Null(await Client(new Handler(HttpStatusCode.OK)).GetModelAsync("Lupe")); // no es un id: ni se consulta
    }

    [Fact]
    public async Task Buscar_DevuelveLosItems_SinEnviarLlave()
    {
        var h = new Handler(HttpStatusCode.OK, System.Text.Encoding.UTF8.GetBytes("{\"items\":[" + ModelJson + "]}"));
        var found = await Client(h).SearchModelsAsync("toji", "es");
        Assert.Single(found);
        Assert.Null(h.Calls[0].Auth);
    }
}
