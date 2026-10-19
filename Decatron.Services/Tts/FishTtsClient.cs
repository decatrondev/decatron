using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Decatron.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Tts
{
    /// <summary>Fish respondió con error. <see cref="Status"/> 402 = sin saldo de API, 404/422 = la voz ya no existe o no es usable.</summary>
    public sealed class FishTtsException : Exception
    {
        public int Status { get; }
        public FishTtsException(int status, string message) : base(message) { Status = status; }
    }

    /// <summary>
    /// TTS de Fish Audio que devuelve el mp3 completo, para que el audio pase por el caché y el cobro de créditos como los de
    /// Polly y Piper (alertas, Speak Chat, tips, timers). La traducción en vivo usa <c>FishAudioTtsEngine</c>, que hace streaming.
    ///
    /// Llave: el #1 usa la de appsettings; otro tenant usa SU llave y, sin ella, la voz queda apagada (nunca la del #1).
    /// Fish cobra por bytes UTF-8 y deja 5 peticiones a la vez en el nivel Starter, por eso hay un semáforo compartido.
    /// </summary>
    public sealed class FishTtsClient
    {
        private static readonly Regex VoiceId = new("^[0-9a-f]{32}$", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private static SemaphoreSlim? _gate;
        private static int _gateSize;
        private static readonly object GateLock = new();

        private readonly IHttpClientFactory _http;
        private readonly IConfiguration _config;
        private readonly IByoKeys? _byo;
        private readonly ILogger<FishTtsClient> _logger;

        public FishTtsClient(IHttpClientFactory http, IConfiguration config, ILogger<FishTtsClient> logger, IByoKeys? byo = null)
        {
            _http = http;
            _config = config;
            _logger = logger;
            _byo = byo;
        }

        /// <summary>Voz que se usa cuando quien llama no trae una válida. Se cambia en appsettings (después, desde el catálogo del admin).</summary>
        public string DefaultVoiceId => _config["FishAudio:DefaultVoiceId"] ?? "";

        /// <summary>Un <c>reference_id</c> de Fish son 32 caracteres hexadecimales; un nombre de Polly como «Lupe» no lo es.</summary>
        public static bool LooksLikeVoiceId(string? value) => !string.IsNullOrWhiteSpace(value) && VoiceId.IsMatch(value.Trim());

        /// <summary>Bytes UTF-8 del texto: la unidad en que Fish cobra (el español pesa algo más que sus caracteres por las tildes).</summary>
        public static int BillableBytes(string text) => Encoding.UTF8.GetByteCount(text);

        /// <summary>¿Hay llave usable ahora para el tenant en curso?</summary>
        public bool IsConfigured => (TenantAmbient.Current ?? 1) == 1
            ? !string.IsNullOrWhiteSpace(_config["FishAudio:ApiKey"])
            : _byo?.IsAvailable(ByoProviders.FishAudio) == true;

        public async Task<byte[]> SynthesizeAsync(string text, string voiceId, CancellationToken ct = default)
        {
            var key = _config["FishAudio:ApiKey"] ?? "";
            var model = _config["FishAudio:Model"] ?? "s1";
            if ((TenantAmbient.Current ?? 1) != 1)
            {
                var byo = _byo is null ? null : await _byo.GetAsync(ByoProviders.FishAudio, null, ct);
                if (byo is null) throw new InvalidOperationException("byo_not_configured");
                key = byo.ApiKey;
                model = byo.Config.GetValueOrDefault("model") ?? "s1";
            }
            if (string.IsNullOrWhiteSpace(key)) throw new InvalidOperationException("fish_not_configured");

            var body = new Dictionary<string, object?>
            {
                ["text"] = text,
                ["format"] = "mp3",
                ["latency"] = "balanced",
            };
            if (!string.IsNullOrWhiteSpace(voiceId)) body["reference_id"] = voiceId.Trim();

            var gate = Gate();
            await gate.WaitAsync(ct);
            try
            {
                var http = _http.CreateClient("fish-tts");
                http.Timeout = TimeSpan.FromSeconds(30);
                using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.fish.audio/v1/tts")
                {
                    Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
                };
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
                req.Headers.TryAddWithoutValidation("model", model);

                using var res = await http.SendAsync(req, ct);
                if (!res.IsSuccessStatusCode)
                {
                    var err = await res.Content.ReadAsStringAsync(ct);
                    if ((int)res.StatusCode == 402)
                        _logger.LogWarning("[FishTts] Sin saldo de API en Fish (402)");
                    throw new FishTtsException((int)res.StatusCode, $"Fish TTS {(int)res.StatusCode}: {(err.Length > 200 ? err[..200] : err)}");
                }
                var bytes = await res.Content.ReadAsByteArrayAsync(ct);
                if (bytes.Length == 0) throw new FishTtsException(204, "Fish TTS devolvió audio vacío");
                return bytes;
            }
            finally { gate.Release(); }
        }

        private SemaphoreSlim Gate()
        {
            var size = int.TryParse(_config["FishAudio:MaxConcurrent"], out var n) && n > 0 ? n : 4;
            lock (GateLock)
            {
                if (_gate == null || _gateSize != size) { _gate = new SemaphoreSlim(size, size); _gateSize = size; }
                return _gate;
            }
        }
    }
}
