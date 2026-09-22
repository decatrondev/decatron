using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.LiveTranslation
{
    /// <summary>
    /// Voz estándar de la traducción en vivo: Piper en el propio servidor, sin costo real
    /// (cobra al bucket estándar, que es CPU). Es la opción gratis y la red de seguridad
    /// cuando se acaban los créditos premium (plan CREDITOS_UNIFICADOS, fase 2).
    ///
    /// Latencia medida 2026-09-22 (4 vCPU): arrancar piper y cargar el modelo cuesta ~430 ms,
    /// y sintetizar una frase corta ~250 ms (medium) / ~700 ms (high). Por eso se mantiene
    /// un proceso caliente por voz que recibe una línea por frase y va escribiendo un WAV
    /// por línea (imprime la ruta por stdout al terminar); el MP3 sale de ffmpeg en streaming.
    /// Un proceso ocioso se cierra a los <see cref="IdleTimeout"/>.
    /// </summary>
    public class PiperTranslationTtsEngine : ITranslationTtsEngine, IDisposable
    {
        private static readonly TimeSpan IdleTimeout = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan SynthesisTimeout = TimeSpan.FromSeconds(15);

        // Voz por defecto por idioma: la que mejor suena de las instaladas en /opt/piper/voices.
        // "medium" a propósito: la mitad de latencia que "high" y en una frase de 4 s no se nota.
        private static readonly Dictionary<string, string> DefaultVoices = new(StringComparer.OrdinalIgnoreCase)
        {
            ["es"] = "es_MX-ald-medium",
            ["en"] = "en_US-amy-medium",
            ["pt"] = "pt_BR-faber-medium",
            ["fr"] = "fr_FR-siwis-medium",
            ["de"] = "de_DE-thorsten-medium",
            ["it"] = "it_IT-paola-medium",
        };

        private readonly ILogger<PiperTranslationTtsEngine> _logger;
        private readonly string _workDir;
        private readonly ConcurrentDictionary<string, Worker> _workers = new(StringComparer.OrdinalIgnoreCase);
        private readonly Timer _reaper;
        private IReadOnlyList<TtsVoice>? _voices;

        public PiperTranslationTtsEngine(ILogger<PiperTranslationTtsEngine> logger)
        {
            _logger = logger;
            _workDir = Path.Combine(Path.GetTempPath(), "decatron-live-piper");
            Directory.CreateDirectory(_workDir);
            _reaper = new Timer(_ => ReapIdle(), null, TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(1));
        }

        public string Name => "piper";
        public string CreditEngine => "standard";
        public bool IsConfigured => File.Exists(PiperTtsService.PiperBinary) && Directory.Exists(PiperTtsService.VoicesDir);

        public IReadOnlyList<TtsVoice> Voices => _voices ??= LoadVoices();

        private IReadOnlyList<TtsVoice> LoadVoices()
        {
            if (!IsConfigured) return Array.Empty<TtsVoice>();
            return Directory.GetFiles(PiperTtsService.VoicesDir, "*.onnx")
                .Select(p => Path.GetFileNameWithoutExtension(p))
                .Select(id =>
                {
                    // es_MX-claude-high → idioma "es", nombre "Claude (MX, high)"
                    var parts = id.Split('-');
                    var locale = parts[0];
                    var lang = locale.Split('_')[0].ToLowerInvariant();
                    var speaker = parts.Length > 1 ? parts[1] : id;
                    var quality = parts.Length > 2 ? parts[2] : "";
                    var region = locale.Contains('_') ? locale.Split('_')[1] : "";
                    var name = $"{char.ToUpperInvariant(speaker[0])}{speaker[1..].Replace('_', ' ')} ({region}{(quality != "" ? ", " + quality : "")})";
                    return new TtsVoice(id, name, lang, GuessGender(speaker));
                })
                .OrderBy(v => v.Language).ThenBy(v => v.Name)
                .ToList();
        }

        // Piper no dice el género; se deduce del nombre del hablante para el ♀/♂ del selector.
        private static string GuessGender(string speaker) => speaker.ToLowerInvariant() switch
        {
            "amy" or "kristin" or "cori" or "jenny_dioco" or "daniela" or "claude" or "siwis" or "paola" or "sharvard" => "f",
            _ => "m",
        };

        public string DefaultVoiceFor(string language)
        {
            var lang = (language ?? "").Split('-', '_')[0].ToLowerInvariant();
            if (DefaultVoices.TryGetValue(lang, out var v) && Voices.Any(x => x.Id == v)) return v;
            return Voices.FirstOrDefault(x => x.Language == lang)?.Id ?? DefaultVoices["es"];
        }

        public async IAsyncEnumerable<ReadOnlyMemory<byte>> SynthesizeAsync(string text, string voiceId, [EnumeratorCancellation] CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(voiceId) || !Voices.Any(v => v.Id == voiceId)) voiceId = DefaultVoiceFor("es");
            // Una línea = una frase para piper: los saltos de línea se aplanan.
            var line = text.Replace("\r", " ").Replace("\n", " ").Trim();
            if (line.Length == 0) yield break;

            var worker = _workers.GetOrAdd(voiceId, id => new Worker(id, _workDir, _logger));
            string wav;
            try { wav = await worker.SynthesizeAsync(line, ct); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Proceso muerto o colgado: se descarta y la próxima frase arranca uno nuevo.
                _logger.LogWarning(ex, "[Piper-live] {Voice}: fallo sintetizando; se reinicia el proceso", voiceId);
                if (_workers.TryRemove(voiceId, out var dead)) dead.Dispose();
                throw;
            }

            try
            {
                await foreach (var chunk in ToMp3Async(wav, ct)) yield return chunk;
            }
            finally
            {
                try { File.Delete(wav); } catch { /* temporal */ }
            }
        }

        /// <summary>WAV → MP3 por ffmpeg a stdout, en trozos conforme salen (primer byte en ~50 ms).</summary>
        private static async IAsyncEnumerable<ReadOnlyMemory<byte>> ToMp3Async(string wavPath, [EnumeratorCancellation] CancellationToken ct)
        {
            using var ffmpeg = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "ffmpeg",
                    Arguments = $"-loglevel error -i \"{wavPath}\" -codec:a libmp3lame -q:a 4 -f mp3 pipe:1",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                },
            };
            ffmpeg.Start();
            _ = ffmpeg.StandardError.ReadToEndAsync();
            var buffer = new byte[8192];
            var stdout = ffmpeg.StandardOutput.BaseStream;
            while (true)
            {
                var n = await stdout.ReadAsync(buffer, ct);
                if (n <= 0) break;
                yield return new ReadOnlyMemory<byte>(buffer.AsSpan(0, n).ToArray());
            }
            await ffmpeg.WaitForExitAsync(ct);
        }

        private void ReapIdle()
        {
            foreach (var (id, w) in _workers)
            {
                if (DateTime.UtcNow - w.LastUsed < IdleTimeout) continue;
                if (_workers.TryRemove(id, out var gone)) { gone.Dispose(); _logger.LogInformation("[Piper-live] {Voice}: proceso cerrado por inactividad", id); }
            }
        }

        public void Dispose()
        {
            _reaper.Dispose();
            foreach (var w in _workers.Values) w.Dispose();
            _workers.Clear();
        }

        /// <summary>Un proceso piper caliente para una voz. Atiende una frase a la vez.</summary>
        private sealed class Worker : IDisposable
        {
            private readonly string _voiceId;
            private readonly string _outDir;
            private readonly ILogger _logger;
            private readonly SemaphoreSlim _one = new(1, 1);
            private Process? _proc;
            public DateTime LastUsed { get; private set; } = DateTime.UtcNow;

            public Worker(string voiceId, string workDir, ILogger logger)
            {
                _voiceId = voiceId;
                _outDir = Path.Combine(workDir, voiceId);
                _logger = logger;
                Directory.CreateDirectory(_outDir);
            }

            public async Task<string> SynthesizeAsync(string line, CancellationToken ct)
            {
                await _one.WaitAsync(ct);
                try
                {
                    LastUsed = DateTime.UtcNow;
                    var proc = EnsureProcess();
                    var sw = Stopwatch.StartNew();
                    await proc.StandardInput.WriteLineAsync(line.AsMemory(), ct);
                    await proc.StandardInput.FlushAsync(ct);

                    using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
                    timeout.CancelAfter(SynthesisTimeout);
                    // piper escribe la ruta del WAV en stdout cuando termina la línea.
                    var path = await proc.StandardOutput.ReadLineAsync(timeout.Token);
                    if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
                        throw new InvalidOperationException($"piper no devolvió audio para {_voiceId} (salida: '{path}')");
                    _logger.LogDebug("[Piper-live] {Voice}: {Chars} chars en {Ms} ms", _voiceId, line.Length, sw.ElapsedMilliseconds);
                    return path;
                }
                finally { _one.Release(); }
            }

            private Process EnsureProcess()
            {
                if (_proc is { HasExited: false }) return _proc;
                _proc?.Dispose();
                var model = Path.Combine(PiperTtsService.VoicesDir, $"{_voiceId}.onnx");
                _proc = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = PiperTtsService.PiperBinary,
                        Arguments = $"--model \"{model}\" --output_dir \"{_outDir}\"",
                        RedirectStandardInput = true,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                    },
                };
                _proc.Start();
                // stderr son los logs de piper: hay que drenarlo o se bloquea al llenar el búfer.
                _ = _proc.StandardError.ReadToEndAsync();
                _logger.LogInformation("[Piper-live] {Voice}: proceso arrancado (pid {Pid})", _voiceId, _proc.Id);
                return _proc;
            }

            public void Dispose()
            {
                try { if (_proc is { HasExited: false }) { _proc.StandardInput.Close(); if (!_proc.WaitForExit(2000)) _proc.Kill(); } } catch { /* cerrando */ }
                _proc?.Dispose();
                _one.Dispose();
                try { Directory.Delete(_outDir, true); } catch { /* temporal */ }
            }
        }
    }
}
