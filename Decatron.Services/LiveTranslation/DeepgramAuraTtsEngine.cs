using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using Decatron.Core.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Decatron.Services.LiveTranslation
{
    /// <summary>
    /// TTS de Deepgram (Aura-2). Misma llave que el STT. En la Fase 0 dio ≈ 0.26 s hasta el
    /// primer byte (p50) — ver el plan.
    /// </summary>
    public class DeepgramAuraTtsEngine : ITranslationTtsEngine
    {
        private readonly HttpClient _http;
        private readonly string _apiKey;

        // Catálogo curado. Deepgram tiene más; estas son las que suenan mejor para un
        // stream (naturales, no de call center). Se puede ampliar sin migración.
        private static readonly TtsVoice[] _voices =
        {
            new("aura-2-thalia-en",   "Thalia",   "en", "f"),
            new("aura-2-andromeda-en","Andromeda","en", "f"),
            new("aura-2-luna-en",     "Luna",     "en", "f"),
            new("aura-2-orion-en",    "Orion",    "en", "m"),
            new("aura-2-arcas-en",    "Arcas",    "en", "m"),
            new("aura-2-zeus-en",     "Zeus",     "en", "m"),
            new("aura-2-celeste-es",  "Celeste",  "es", "f"),
            new("aura-2-estrella-es", "Estrella", "es", "f"),
            new("aura-2-sirio-es",    "Sirio",    "es", "m"),
            new("aura-2-nestor-es",   "Néstor",   "es", "m"),
        };

        private readonly IByoKeys? _byo;

        public DeepgramAuraTtsEngine(IHttpClientFactory httpFactory, IConfiguration config, IByoKeys? byo = null)
        {
            _byo = byo;
            _http = httpFactory.CreateClient("deepgram-tts");
            _http.Timeout = TimeSpan.FromSeconds(30);
            _apiKey = config["Deepgram:ApiKey"] ?? "";
        }

        public string Name => "deepgram";
        public string CreditEngine => "deepgram_aura";
        // #1: su llave de appsettings. Otro tenant (Fase 5.8): SU llave de Deepgram; sin ella la voz Aura queda apagada (nunca la del #1).
        public bool IsConfigured => (TenantAmbient.Current ?? 1) == 1 ? !string.IsNullOrWhiteSpace(_apiKey) : _byo?.IsAvailable(ByoProviders.Deepgram) == true;
        public IReadOnlyList<TtsVoice> Voices => _voices;

        public string DefaultVoiceFor(string language) =>
            _voices.FirstOrDefault(v => v.Language == language)?.Id ?? _voices[0].Id;

        public async IAsyncEnumerable<ReadOnlyMemory<byte>> SynthesizeAsync(
            string text, string voiceId, [EnumeratorCancellation] CancellationToken ct)
        {
            if (!_voices.Any(v => v.Id == voiceId)) voiceId = _voices[0].Id;

            var key = _apiKey;
            if ((TenantAmbient.Current ?? 1) != 1)
            {
                var byo = _byo is null ? null : await _byo.GetAsync(ByoProviders.Deepgram, null, ct);
                if (byo is null) throw new InvalidOperationException("byo_not_configured");
                key = byo.ApiKey;
            }

            // Una conexión reutilizada que Deepgram ya cerró hace fallar el envío con «The response ended prematurely» antes de recibir
            // un solo byte (se vio en producción el 2026-10-11). Eso es seguro de repetir una vez: no se entregó nada y el cobro ya se
            // hizo antes de sintetizar. Un fallo a mitad del audio no se reintenta (ya salieron trozos).
            HttpResponseMessage res;
            for (var attempt = 1; ; attempt++)
            {
                using var req = new HttpRequestMessage(HttpMethod.Post,
                    $"https://api.deepgram.com/v1/speak?model={voiceId}&encoding=mp3")
                {
                    Content = new StringContent(JsonSerializer.Serialize(new { text }), Encoding.UTF8, "application/json")
                };
                req.Headers.Authorization = new AuthenticationHeaderValue("Token", key);
                try
                {
                    res = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
                    break;
                }
                catch (HttpRequestException ex) when (attempt < 2 && ex.InnerException is System.IO.IOException)
                {
                    await Task.Delay(250, ct);
                }
            }

            using (res)
            {
                if (!res.IsSuccessStatusCode)
                {
                    var body = await res.Content.ReadAsStringAsync(ct);
                    throw new InvalidOperationException($"Deepgram TTS {(int)res.StatusCode}: {Truncate(body)}");
                }

                await using var stream = await res.Content.ReadAsStreamAsync(ct);
                var buf = new byte[8192];
                int n;
                while ((n = await stream.ReadAsync(buf, ct)) > 0)
                    yield return buf.AsMemory(0, n).ToArray();
            }
        }

        private static string Truncate(string s) => s.Length > 200 ? s[..200] : s;
    }
}
