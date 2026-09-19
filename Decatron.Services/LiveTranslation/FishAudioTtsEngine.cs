using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace Decatron.Services.LiveTranslation
{
    /// <summary>
    /// TTS de Fish Audio: catálogo propio y, sobre todo, clon de voz del streamer
    /// (reference_id). Requiere crédito de API (separado del de la web); sin saldo la API
    /// devuelve 402 y el pipeline cae al motor por defecto. Pendiente de medir latencia
    /// cuando haya crédito — ver plan §Fase 0.
    /// </summary>
    public class FishAudioTtsEngine : ITranslationTtsEngine
    {
        private readonly HttpClient _http;
        private readonly string _apiKey;
        private readonly string _model;

        public FishAudioTtsEngine(IHttpClientFactory httpFactory, IConfiguration config)
        {
            _http = httpFactory.CreateClient("fish-tts");
            _http.Timeout = TimeSpan.FromSeconds(30);
            _apiKey = config["FishAudio:ApiKey"] ?? "";
            _model = config["FishAudio:Model"] ?? "s1";
        }

        public string Name => "fish";
        public string CreditEngine => "fish";
        public bool IsConfigured => !string.IsNullOrWhiteSpace(_apiKey);

        // El catálogo de Fish es enorme y cambia; la voz "real" de este motor es el clon
        // del streamer (reference_id guardado en VoicesJson). Sin voz ⇒ voz por defecto de Fish.
        public IReadOnlyList<TtsVoice> Voices => Array.Empty<TtsVoice>();
        public string DefaultVoiceFor(string language) => "";

        public async IAsyncEnumerable<ReadOnlyMemory<byte>> SynthesizeAsync(
            string text, string voiceId, [EnumeratorCancellation] CancellationToken ct)
        {
            var body = new Dictionary<string, object?>
            {
                ["text"] = text,
                ["format"] = "mp3",
                ["latency"] = "balanced",
                ["chunk_length"] = 100,
            };
            if (!string.IsNullOrWhiteSpace(voiceId)) body["reference_id"] = voiceId;

            using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.fish.audio/v1/tts")
            {
                Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
            };
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
            req.Headers.TryAddWithoutValidation("model", _model);

            using var res = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!res.IsSuccessStatusCode)
            {
                var err = await res.Content.ReadAsStringAsync(ct);
                throw new InvalidOperationException($"Fish TTS {(int)res.StatusCode}: {(err.Length > 200 ? err[..200] : err)}");
            }

            await using var stream = await res.Content.ReadAsStreamAsync(ct);
            var buf = new byte[8192];
            int n;
            while ((n = await stream.ReadAsync(buf, ct)) > 0)
                yield return buf.AsMemory(0, n).ToArray();
        }
    }
}
