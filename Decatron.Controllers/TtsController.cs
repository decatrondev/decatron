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
        private readonly ITtsCreditService _creditService;
        private readonly ILogger<TtsController> _logger;

        public TtsController(
            ITtsService ttsService,
            ITtsCreditService creditService,
            ILogger<TtsController> logger)
        {
            _ttsService = ttsService;
            _creditService = creditService;
            _logger = logger;
        }

        private long GetChannelOwnerId()
        {
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
                return sessionId;

            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
                return channelOwnerId;

            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(userIdClaim, out var userId) ? userId : 0;
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

                var channelOwnerId = GetChannelOwnerId();
                if (channelOwnerId == 0)
                    return Unauthorized(new { success = false, message = "No se pudo identificar el canal" });

                // Esta generación cuesta igual que una alerta en vivo: cobra créditos.
                // Y como cualquier otra, si Polly no puede se cae a voz estándar en vez
                // de devolver un error — el respaldo lo aplica el servicio de créditos.
                var provider = request.Provider == "piper" ? "piper" : "polly";

                var url = await _creditService.GenerateWithCreditsAsync(
                    channelOwnerId,
                    request.Text,
                    request.VoiceId,
                    request.Engine,
                    request.LanguageCode,
                    "tts_api",
                    provider: provider
                );

                if (url == null)
                {
                    // Llegar aquí significa que tampoco quedaba voz estándar
                    var balance = await _creditService.GetBalanceAsync(channelOwnerId);
                    if (!balance.IsUnlimited && balance.StandardRemaining < request.Text.Length)
                    {
                        return StatusCode(402, new
                        {
                            success = false,
                            message = "Sin créditos TTS suficientes, ni premium ni de voz estándar",
                            creditsAvailable = balance.TotalAvailable,
                            creditsNeeded = _creditService.CalculateCost(request.Text.Length, request.Engine),
                            standardAvailable = balance.StandardRemaining
                        });
                    }

                    return StatusCode(500, new { success = false, message = "Error al generar el audio TTS" });
                }

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

            /// <summary>"polly" (por defecto) o "piper" para la voz estándar.</summary>
            public string? Provider { get; set; }
        }
    }
}
