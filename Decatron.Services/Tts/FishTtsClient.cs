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

    /// <summary>Datos públicos de una voz de Fish (búsqueda y consulta por id; no gastan saldo).</summary>
    public sealed record FishModelInfo(
        string Id, string Title, string[] Languages, string? Author, string? SampleUrl, string? SampleText,
        int Likes, int Uses, string? Visibility, bool TakenDown, string? State);

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
            // Estabilidad de la voz: más bajo = más regular, más alto = más expresivo. Sin valor, Fish usa el suyo.
            // Se lee en caliente de FishAudio:Temperature (0 a 1) y se ignora lo que no sea un número válido.
            if (double.TryParse(_config["FishAudio:Temperature"], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var temperature)
                && temperature is >= 0 and <= 1)
                body["temperature"] = temperature;

            // Fish limita las peticiones simultáneas (5 en Starter) y a veces responde 429/503: se reintenta con una espera corta
            // en vez de dejar el chat sin voz. 402, 404 o 422 no se reintentan (sin saldo o voz inservible: no se arreglan esperando).
            var attempts = Math.Clamp(int.TryParse(_config["FishAudio:RetryAttempts"], out var ra) ? ra : 3, 1, 5);
            var baseDelay = Math.Clamp(int.TryParse(_config["FishAudio:RetryDelayMs"], out var rd) ? rd : 700, 0, 5000);
            for (var attempt = 1; ; attempt++)
            {
                var gate = Gate();
                await gate.WaitAsync(ct);
                TimeSpan? wait = null;
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
                    if (res.IsSuccessStatusCode)
                    {
                        var bytes = await res.Content.ReadAsByteArrayAsync(ct);
                        if (bytes.Length == 0) throw new FishTtsException(204, "Fish TTS devolvió audio vacío");
                        return bytes;
                    }

                    var status = (int)res.StatusCode;
                    var err = await res.Content.ReadAsStringAsync(ct);
                    if (status == 402)
                        _logger.LogWarning("[FishTts] Sin saldo de API en Fish (402)");
                    var retryable = status is 429 or 502 or 503 or 504;
                    if (!retryable || attempt >= attempts)
                        throw new FishTtsException(status, $"Fish TTS {status}: {(err.Length > 200 ? err[..200] : err)}");

                    // Retry-After manda si Fish lo indica (con tope para no dejar un turno de audio colgado)
                    var hinted = res.Headers.RetryAfter?.Delta;
                    wait = hinted is { } d && d > TimeSpan.Zero
                        ? TimeSpan.FromMilliseconds(Math.Min(d.TotalMilliseconds, 5000))
                        : TimeSpan.FromMilliseconds(baseDelay * attempt);
                    _logger.LogInformation("[FishTts] Fish respondió {Status}; reintento {Attempt}/{Max} en {Ms} ms", status, attempt + 1, attempts, (int)wait.Value.TotalMilliseconds);
                }
                finally { gate.Release(); }

                // La espera va fuera del semáforo: otra petición puede usar el cupo mientras tanto
                if (wait is { } w && w > TimeSpan.Zero) await Task.Delay(w, ct);
            }
        }

        /// <summary>Busca voces públicas por título. No pide llave ni gasta saldo.</summary>
        public async Task<List<FishModelInfo>> SearchModelsAsync(string? title, string? language, int pageSize = 12, CancellationToken ct = default)
        {
            var q = new List<string> { $"page_size={Math.Clamp(pageSize, 1, 30)}", "sort_by=score" };
            if (!string.IsNullOrWhiteSpace(title)) q.Add("title=" + Uri.EscapeDataString(title.Trim()));
            if (!string.IsNullOrWhiteSpace(language)) q.Add("language=" + Uri.EscapeDataString(language.Trim()));
            using var res = await Public().GetAsync("https://api.fish.audio/model?" + string.Join("&", q), ct);
            if (!res.IsSuccessStatusCode) throw new FishTtsException((int)res.StatusCode, $"Fish búsqueda {(int)res.StatusCode}");
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
            var list = new List<FishModelInfo>();
            if (doc.RootElement.TryGetProperty("items", out var items))
                foreach (var it in items.EnumerateArray()) list.Add(ParseModel(it));
            return list;
        }

        /// <summary>Consulta una voz por id. Null si Fish ya no la devuelve (404); otro error lanza <see cref="FishTtsException"/>.</summary>
        public async Task<FishModelInfo?> GetModelAsync(string voiceId, CancellationToken ct = default)
        {
            if (!LooksLikeVoiceId(voiceId)) return null;
            using var res = await Public().GetAsync("https://api.fish.audio/model/" + voiceId.Trim(), ct);
            if ((int)res.StatusCode == 404) return null;
            if (!res.IsSuccessStatusCode) throw new FishTtsException((int)res.StatusCode, $"Fish modelo {(int)res.StatusCode}");
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
            return ParseModel(doc.RootElement);
        }

        private HttpClient Public()
        {
            var http = _http.CreateClient("fish-tts");
            http.Timeout = TimeSpan.FromSeconds(15);
            return http;
        }

        private static FishModelInfo ParseModel(JsonElement e)
        {
            string? Str(JsonElement x, string n) => x.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
            int Int(JsonElement x, string n) => x.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetInt32() : 0;
            var langs = e.TryGetProperty("languages", out var l) && l.ValueKind == JsonValueKind.Array
                ? l.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => x != "").ToArray() : Array.Empty<string>();
            string? sample = null, sampleText = null;
            if (e.TryGetProperty("samples", out var sm) && sm.ValueKind == JsonValueKind.Array && sm.GetArrayLength() > 0)
            { sample = Str(sm[0], "audio"); sampleText = Str(sm[0], "text"); }
            // La consulta por id devuelve la muestra con un enlace firmado que caduca; la búsqueda trae el permanente. Se guarda el permanente.
            const string signedMarker = "/fish-platform-data/";
            if (sample != null && sample.Contains(signedMarker, StringComparison.Ordinal))
                sample = "https://platform.r2.fish.audio/" + sample[(sample.IndexOf(signedMarker, StringComparison.Ordinal) + signedMarker.Length)..].Split('?')[0];
            var author = e.TryGetProperty("author", out var a) && a.ValueKind == JsonValueKind.Object ? Str(a, "nickname") : null;
            var takenDown = e.TryGetProperty("dmca_taken_down", out var d) && d.ValueKind == JsonValueKind.True;
            return new FishModelInfo(Str(e, "_id") ?? "", Str(e, "title") ?? "", langs, author, sample, sampleText,
                Int(e, "like_count"), Int(e, "task_count"), Str(e, "visibility"), takenDown, Str(e, "state"));
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
