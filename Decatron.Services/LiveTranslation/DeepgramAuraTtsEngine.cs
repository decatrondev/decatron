using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
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

        public DeepgramAuraTtsEngine(IHttpClientFactory httpFactory, IConfiguration config)
        {
            _http = httpFactory.CreateClient("deepgram-tts");
            _http.Timeout = TimeSpan.FromSeconds(30);
            _apiKey = config["Deepgram:ApiKey"] ?? "";
        }

        public string Name => "deepgram";
        public string CreditEngine => "deepgram_aura";
        public bool IsConfigured => !string.IsNullOrWhiteSpace(_apiKey);
        public IReadOnlyList<TtsVoice> Voices => _voices;

        public string DefaultVoiceFor(string language) =>
            _voices.FirstOrDefault(v => v.Language == language)?.Id ?? _voices[0].Id;

        public async IAsyncEnumerable<ReadOnlyMemory<byte>> SynthesizeAsync(
            string text, string voiceId, [EnumeratorCancellation] CancellationToken ct)
        {
            if (!_voices.Any(v => v.Id == voiceId)) voiceId = _voices[0].Id;

            using var req = new HttpRequestMessage(HttpMethod.Post,
                $"https://api.deepgram.com/v1/speak?model={voiceId}&encoding=mp3")
            {
                Content = new StringContent(JsonSerializer.Serialize(new { text }), Encoding.UTF8, "application/json")
            };
            req.Headers.Authorization = new AuthenticationHeaderValue("Token", _apiKey);

            using var res = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
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

        private static string Truncate(string s) => s.Length > 200 ? s[..200] : s;
    }
}
