using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Decatron.Services
{
    /// <summary>
    /// Síntesis de voz con Piper, auto-alojada en el servidor.
    ///
    /// Existe porque la voz del navegador no es una opción real dentro de OBS: su audio lo
    /// genera el motor del sistema y nunca entra en la captura de la fuente. Piper produce
    /// un MP3 igual que Polly, así que suena en cualquier OBS, y no cuesta por carácter:
    /// solo CPU del servidor.
    ///
    /// Es el motor del nivel gratuito: voz estándar, sin coste por carácter.
    /// Polly queda para lo que Piper no cubre — japonés, coreano y voces neuronales.
    /// </summary>
    public class PiperTtsService
    {
        private readonly ILogger<PiperTtsService> _logger;
        private readonly string _cachePath;

        private const string PiperBinary = "/opt/piper/piper";
        private const string VoicesDir = "/opt/piper/voices";
        private const string PublicUrlBase = "/tts-audio";

        /// <summary>Tope defensivo: una alerta no debería tardar tanto ni de lejos.</summary>
        private const int TimeoutMs = 60000;

        /// <summary>
        /// Síntesis simultáneas como máximo.
        ///
        /// El servidor tiene 4 núcleos y los comparte con el bot, la API y el resto de
        /// servicios. Piper va a 0,2×–0,6× de tiempo real con un núcleo libre, pero un
        /// raid o una ráfaga de bits puede disparar diez alertas a la vez: sin tope, las
        /// diez compiten, ninguna termina a tiempo y de paso el bot deja de responder al
        /// chat. Con dos en paralelo el resto espera unos cientos de milisegundos, que en
        /// una cola de alertas no se nota.
        /// </summary>
        private static readonly SemaphoreSlim _slots = new(2, 2);

        /// <summary>
        /// Espera máxima por un hueco. Si se llena tanto la cola, más vale renunciar a
        /// esa alerta que acumular texto que se leería con minutos de retraso.
        /// </summary>
        private const int QueueTimeoutMs = 20000;

        /// <summary>
        /// Voz por defecto de cada idioma. Se usa cuando el streamer no eligió ninguna
        /// o cuando la que tenía guardada ya no está instalada.
        /// </summary>
        private static readonly Dictionary<string, string> _defaultByLanguage = new(StringComparer.OrdinalIgnoreCase)
        {
            ["es"] = "es_MX-claude-high",
            ["en"] = "en_US-lessac-high",
            ["pt"] = "pt_BR-faber-medium",
            ["fr"] = "fr_FR-siwis-medium",
            ["de"] = "de_DE-thorsten-high",
            ["it"] = "it_IT-paola-medium",
        };

        /// <summary>
        /// Voz a la que cae una alerta premium cuyo idioma no existe en Piper.
        ///
        /// Solo pasa con japonés y coreano. Leerlos con una voz española suena peculiar,
        /// pero es preferible a callarse: el streamer se entera de que la alerta llegó,
        /// y el silencio se confunde con que el bot está roto.
        /// </summary>
        private const string UniversalFallbackVoice = "es_MX-claude-high";

        public PiperTtsService(ILogger<PiperTtsService> logger, string cachePath)
        {
            _logger = logger;
            _cachePath = cachePath;
        }

        public bool IsAvailable => File.Exists(PiperBinary) && Directory.Exists(VoicesDir);

        public record PiperVoice(
            string Id,           // es_ES-davefx-medium
            string Language,     // es_ES
            string Speaker,      // davefx
            string Quality,      // x_low | low | medium | high
            long ModelSizeBytes);

        public record PiperResult(
            bool Success,
            string? Url,
            long GenerationMs,
            double AudioSeconds,
            long FileSizeBytes,
            string? Error);

        /// <summary>Voces instaladas, deducidas de los archivos de modelo.</summary>
        public IReadOnlyList<PiperVoice> ListVoices()
        {
            if (!IsAvailable) return Array.Empty<PiperVoice>();

            return Directory.GetFiles(VoicesDir, "*.onnx")
                .Select(path =>
                {
                    var id = Path.GetFileNameWithoutExtension(path);
                    // Formato del nombre: idioma-hablante-calidad (es_ES-davefx-medium)
                    var parts = id.Split('-');
                    return new PiperVoice(
                        Id: id,
                        Language: parts.Length > 0 ? parts[0] : "",
                        Speaker: parts.Length > 1 ? parts[1] : id,
                        Quality: parts.Length > 2 ? string.Join("-", parts.Skip(2)) : "",
                        ModelSizeBytes: new FileInfo(path).Length);
                })
                .OrderBy(v => v.Language).ThenBy(v => v.Speaker)
                .ToList();
        }

        /// <summary>
        /// Idiomas que Piper cubre, en prefijo ISO. Lo que no esté aquí solo existe en
        /// Polly: el japonés y el coreano, sobre todo.
        /// </summary>
        public IReadOnlyCollection<string> SupportedLanguages =>
            ListVoices().Select(v => v.Language.Split('_')[0].ToLowerInvariant()).Distinct().ToList();

        /// <summary>
        /// Elige qué voz usar de verdad: la pedida si existe, si no la de su idioma, y
        /// si tampoco, cualquiera. Nunca devuelve null teniendo voces instaladas — que
        /// suene con un acento que no toca es mejor que quedarse callado.
        /// </summary>
        public string? ResolveVoice(string? requestedVoice, string? languageCode)
        {
            var voices = ListVoices();
            if (voices.Count == 0) return null;

            var wanted = (requestedVoice ?? "").Trim();
            if (wanted.Length > 0)
            {
                var exact = voices.FirstOrDefault(v => v.Id.Equals(wanted, StringComparison.OrdinalIgnoreCase));
                if (exact != null) return exact.Id;
            }

            var prefix = (languageCode ?? "es").Split('-', '_')[0].ToLowerInvariant();

            if (_defaultByLanguage.TryGetValue(prefix, out var preferred) &&
                voices.Any(v => v.Id == preferred))
                return preferred;

            var sameLanguage = voices.FirstOrDefault(
                v => v.Language.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));

            return sameLanguage?.Id ?? voices[0].Id;
        }

        /// <summary>
        /// Voz para cuando una alerta de Polly tiene que caer a voz estándar.
        ///
        /// Se respeta el idioma siempre que Piper lo tenga: un texto en inglés leído por
        /// una voz española suena a error, y hay inglés instalado. Solo cuando el idioma
        /// no existe aquí se recurre a la voz universal.
        /// </summary>
        public string? ResolveFallbackVoice(string? languageCode)
        {
            var voices = ListVoices();
            if (voices.Count == 0) return null;

            var prefix = (languageCode ?? "").Split('-', '_')[0].ToLowerInvariant();
            var hasLanguage = voices.Any(v => v.Language.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));

            if (prefix.Length > 0 && hasLanguage)
                return ResolveVoice(null, languageCode);

            return voices.Any(v => v.Id == UniversalFallbackVoice)
                ? UniversalFallbackVoice
                : ResolveVoice(null, "es");
        }

        /// <summary>
        /// Sintetiza un texto y devuelve la URL del MP3 junto con lo que tardó.
        /// El tiempo medido es el de Piper más la conversión a MP3, que es lo que de
        /// verdad retrasaría una alerta.
        /// </summary>
        public async Task<PiperResult> SynthesizeAsync(string text, string voiceId)
        {
            if (!IsAvailable)
                return new PiperResult(false, null, 0, 0, 0, "Piper no está instalado en el servidor");

            if (string.IsNullOrWhiteSpace(text))
                return new PiperResult(false, null, 0, 0, 0, "Texto vacío");

            var modelPath = Path.Combine(VoicesDir, $"{voiceId}.onnx");
            if (!File.Exists(modelPath))
                return new PiperResult(false, null, 0, 0, 0, $"Voz desconocida: {voiceId}");

            var dir = Path.Combine(_cachePath, "piper", voiceId);
            Directory.CreateDirectory(dir);

            var hash = Sha256Short($"{voiceId}:{text}");
            var wavPath = Path.Combine(dir, $"{hash}.wav");
            var mp3Path = Path.Combine(dir, $"{hash}.mp3");
            var url = $"{PublicUrlBase}/piper/{voiceId}/{hash}.mp3";

            // Ya generado antes: se devuelve sin volver a sintetizar
            if (File.Exists(mp3Path))
            {
                var cached = new FileInfo(mp3Path);
                return new PiperResult(true, url, 0, await ProbeDurationAsync(mp3Path), cached.Length, null);
            }

            // Hueco de CPU. Se pide después de mirar el caché: un acierto no gasta nada
            // y no tiene por qué hacer cola detrás de una síntesis real.
            if (!await _slots.WaitAsync(QueueTimeoutMs))
            {
                _logger.LogWarning("[Piper] Cola llena, se descarta la síntesis de {Voice}", voiceId);
                return new PiperResult(false, null, 0, 0, 0, "Servidor ocupado, inténtalo de nuevo");
            }

            var sw = Stopwatch.StartNew();

            try
            {
                // Otra petición idéntica pudo generarlo mientras esperábamos el hueco
                if (File.Exists(mp3Path))
                {
                    var justMade = new FileInfo(mp3Path);
                    return new PiperResult(true, url, 0, await ProbeDurationAsync(mp3Path), justMade.Length, null);
                }

                var piperOk = await RunAsync(
                    PiperBinary,
                    $"--model \"{modelPath}\" --output_file \"{wavPath}\"",
                    stdin: text);

                if (!piperOk || !File.Exists(wavPath))
                    return new PiperResult(false, null, sw.ElapsedMilliseconds, 0, 0, "Piper no generó audio");

                // A MP3 porque es lo que ya sirven y reproducen los overlays
                var ffmpegOk = await RunAsync(
                    "ffmpeg",
                    $"-y -i \"{wavPath}\" -codec:a libmp3lame -q:a 4 \"{mp3Path}\"");

                if (!ffmpegOk || !File.Exists(mp3Path))
                    return new PiperResult(false, null, sw.ElapsedMilliseconds, 0, 0, "Fallo al convertir a MP3");

                sw.Stop();

                var info = new FileInfo(mp3Path);
                var seconds = await ProbeDurationAsync(mp3Path);

                TryDelete(wavPath);

                _logger.LogInformation(
                    "[Piper] {Voice}: {Chars} chars en {Ms} ms ({Seconds:F2}s de audio)",
                    voiceId, text.Length, sw.ElapsedMilliseconds, seconds);

                return new PiperResult(true, url, sw.ElapsedMilliseconds, seconds, info.Length, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Piper] Error sintetizando con {Voice}", voiceId);
                return new PiperResult(false, null, sw.ElapsedMilliseconds, 0, 0, ex.Message);
            }
            finally
            {
                _slots.Release();
            }
        }

        private static async Task<bool> RunAsync(string fileName, string arguments, string? stdin = null)
        {
            using var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = fileName,
                    Arguments = arguments,
                    RedirectStandardInput = stdin != null,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };

            process.Start();

            if (stdin != null)
            {
                await process.StandardInput.WriteAsync(stdin);
                process.StandardInput.Close();
            }

            // Hay que drenar las salidas o el proceso se bloquea al llenarse el búfer
            var stdoutTask = process.StandardOutput.ReadToEndAsync();
            var stderrTask = process.StandardError.ReadToEndAsync();

            using var cts = new System.Threading.CancellationTokenSource(TimeoutMs);
            try
            {
                await process.WaitForExitAsync(cts.Token);
            }
            catch (OperationCanceledException)
            {
                try { process.Kill(true); } catch { }
                return false;
            }

            await Task.WhenAll(stdoutTask, stderrTask);
            return process.ExitCode == 0;
        }

        private static async Task<double> ProbeDurationAsync(string path)
        {
            try
            {
                using var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "ffprobe",
                        Arguments = $"-v error -show_entries format=duration -of csv=p=0 \"{path}\"",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };
                process.Start();
                var output = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();

                return double.TryParse(output.Trim(), System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture, out var seconds) ? seconds : 0;
            }
            catch
            {
                return 0;
            }
        }

        private static void TryDelete(string path)
        {
            try { if (File.Exists(path)) File.Delete(path); } catch { }
        }

        private static string Sha256Short(string value)
        {
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
            return Convert.ToHexString(bytes)[..24].ToLowerInvariant();
        }
    }
}
