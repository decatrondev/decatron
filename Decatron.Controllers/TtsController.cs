using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Decatron.Core.Interfaces;
using Decatron.Attributes;
using System;
using System.ComponentModel.DataAnnotations;
using System.Threading.Tasks;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class TtsController : ControllerBase
    {
        private readonly ITtsService _ttsService;
        private readonly ILogger<TtsController> _logger;

        public TtsController(
            ITtsService ttsService,
            ILogger<TtsController> logger)
        {
            _ttsService = ttsService;
            _logger = logger;
        }

        /// <summary>
        /// Generates TTS audio for testing in the dashboard.
        /// Returns a public URL to the generated .mp3 file.
        /// </summary>
        [HttpPost("generate")]
        public async Task<IActionResult> Generate([FromBody] TtsGenerateRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Text))
                    return BadRequest(new { success = false, message = "El texto no puede estar vacío" });

                if (request.Text.Length > 500)
                    return BadRequest(new { success = false, message = "El texto no puede superar los 500 caracteres" });

                var url = await _ttsService.GenerateAsync(
                    request.Text,
                    request.VoiceId,
                    request.Engine,
                    request.LanguageCode
                );

                if (url == null)
                    return StatusCode(500, new { success = false, message = "Error al generar el audio TTS" });

                return Ok(new { success = true, url });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al generar TTS");
                return StatusCode(500, new { success = false, message = "An internal error occurred generating TTS. Please try again later." });
            }
        }

        public class TtsGenerateRequest
        {
            [Required]
            public string Text { get; set; } = string.Empty;

            [Required]
            public string VoiceId { get; set; } = "Lupe";

            [Required]
            public string Engine { get; set; } = "standard";

            [Required]
            public string LanguageCode { get; set; } = "es-US";
        }
    }
}
