using Decatron.Attributes;
using Decatron.Core.Interfaces;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;

namespace Decatron.Controllers
{
    /// <summary>
    /// Laboratorio de voces: compara Piper (auto-alojado, gratis) con Polly (de pago)
    /// en calidad, tiempo y coste. Solo para el dueño, no es una función de producto.
    /// </summary>
    [ApiController]
    [Route("api/admin/tts-lab")]
    [Authorize]
    [RequireSystemOwner]
    public class TtsLabController : ControllerBase
    {
        private readonly PiperTtsService _piper;
        private readonly ITtsService _ttsService;
        private readonly ILogger<TtsLabController> _logger;

        public TtsLabController(
            PiperTtsService piper,
            ITtsService ttsService,
            ILogger<TtsLabController> logger)
        {
            _piper = piper;
            _ttsService = ttsService;
            _logger = logger;
        }

        [HttpGet("voices")]
        public IActionResult GetVoices()
        {
            var voices = _piper.ListVoices();

            return Ok(new
            {
                success = true,
                available = _piper.IsAvailable,
                voices = voices.Select(v => new
                {
                    id = v.Id,
                    language = v.Language,
                    speaker = v.Speaker,
                    quality = v.Quality,
                    modelSizeMb = Math.Round(v.ModelSizeBytes / 1024.0 / 1024.0, 1)
                })
            });
        }

        [HttpPost("synthesize")]
        public async Task<IActionResult> Synthesize([FromBody] TtsLabRequest body)
        {
            var text = (body?.Text ?? "").Trim();
            if (string.IsNullOrWhiteSpace(text))
                return BadRequest(new { success = false, message = "Texto requerido" });

            if (text.Length > 500)
                return BadRequest(new { success = false, message = "Máximo 500 caracteres para las pruebas" });

            var requested = body?.Voices?.Where(v => !string.IsNullOrWhiteSpace(v)).ToList();
            var voices = requested?.Count > 0
                ? requested
                : _piper.ListVoices().Select(v => v.Id).ToList();

            var results = new List<object>();
            var batch = Stopwatch.StartNew();

            // En serie a propósito: así el tiempo de cada voz es comparable y no se
            // saturan los 4 núcleos que comparte con el bot.
            foreach (var voiceId in voices)
            {
                var r = await _piper.SynthesizeAsync(text, voiceId);

                results.Add(new
                {
                    voice = voiceId,
                    success = r.Success,
                    url = r.Url,
                    generationMs = r.GenerationMs,
                    audioSeconds = Math.Round(r.AudioSeconds, 2),
                    // Cuánto tarda respecto a lo que dura el audio: por debajo de 1 va
                    // más rápido que tiempo real, que es lo que hace falta en directo.
                    realtimeFactor = r.AudioSeconds > 0
                        ? Math.Round(r.GenerationMs / 1000.0 / r.AudioSeconds, 2)
                        : 0,
                    sizeKb = Math.Round(r.FileSizeBytes / 1024.0, 1),
                    fromCache = r.Success && r.GenerationMs == 0,
                    error = r.Error
                });
            }

            batch.Stop();

            // Comparación con Polly. Va aparte porque cuesta dinero de verdad.
            object? polly = null;
            if (body?.IncludePolly == true)
            {
                var sw = Stopwatch.StartNew();
                var result = await _ttsService.GenerateWithInfoAsync(text, body.PollyVoice ?? "Lupe", "standard", "es-US", null);
                sw.Stop();

                polly = new
                {
                    voice = body.PollyVoice ?? "Lupe",
                    success = result.Success,
                    url = result.Url,
                    generationMs = sw.ElapsedMilliseconds,
                    fromCache = result.FromCache,
                    // 1 crédito = 1 carácter en voz standard
                    creditsCost = result.FromCache ? 0 : text.Length
                };
            }

            return Ok(new
            {
                success = true,
                chars = text.Length,
                totalMs = batch.ElapsedMilliseconds,
                results,
                polly
            });
        }
    }

    public record TtsLabRequest(
        string? Text,
        List<string>? Voices,
        bool IncludePolly,
        string? PollyVoice);
}
