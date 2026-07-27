using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Data;
using Decatron.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/speakchat")]
    [Authorize]
    public class SpeakChatController : ControllerBase
    {
        private readonly ISpeakChatService _speakChatService;
        private readonly ITtsService _ttsService;
        private readonly ITtsCreditService _creditService;
        private readonly OverlayNotificationService _overlayNotificationService;
        private readonly ILogger<SpeakChatController> _logger;
        private readonly DecatronDbContext _dbContext;

        public SpeakChatController(
            ISpeakChatService speakChatService,
            ITtsService ttsService,
            ITtsCreditService creditService,
            OverlayNotificationService overlayNotificationService,
            ILogger<SpeakChatController> logger,
            DecatronDbContext dbContext)
        {
            _speakChatService = speakChatService;
            _ttsService = ttsService;
            _creditService = creditService;
            _overlayNotificationService = overlayNotificationService;
            _logger = logger;
            _dbContext = dbContext;
        }

        // ============================
        // GET /api/speakchat/config
        // ============================
        [HttpGet("config")]
        public async Task<IActionResult> GetConfig()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var config = await _speakChatService.GetConfigAsync(channelOwnerId);

                if (config == null)
                    return Ok(new { success = true, config = (object?)null });

                return Ok(new
                {
                    success = true,
                    config = new
                    {
                        data = JsonSerializer.Deserialize<JsonElement>(config.ConfigJson),
                        isEnabled = config.IsEnabled
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpeakChat] Error al obtener config");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ============================
        // POST /api/speakchat/config
        // ============================
        [HttpPost("config")]
        public async Task<IActionResult> SaveConfig([FromBody] SpeakChatSaveRequest body)
        {
            try
            {
                if (body?.Config == null)
                    return BadRequest(new { success = false, message = "Config es requerida" });

                var channelOwnerId = GetChannelOwnerId();
                var channelName = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(channelName))
                    return Unauthorized(new { success = false, message = "No se pudo identificar el canal" });

                var configJson = JsonSerializer.Serialize(body.Config);
                await _speakChatService.SaveConfigAsync(channelOwnerId, channelName, configJson);

                _logger.LogInformation("[SpeakChat] Config guardada para {Channel}", channelName);
                return Ok(new { success = true, message = "Configuración guardada" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpeakChat] Error al guardar config");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ====================================================
        // GET /api/speakchat/config/overlay/{channelName}
        // Anónimo — usado por el OBS Browser Source
        // ====================================================
        [HttpGet("config/overlay/{channelName}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetOverlayConfig(string channelName)
        {
            try
            {
                var config = await _speakChatService.GetConfigByChannelAsync(channelName);

                if (config == null || !config.IsEnabled)
                    return Ok(new { success = true, config = (object?)null });

                // Retornar solo lo necesario para el overlay (no datos sensibles)
                var full = JsonSerializer.Deserialize<JsonElement>(config.ConfigJson);
                var safeConfig = new
                {
                    voice = full.TryGetProperty("voice", out var v) ? JsonSerializer.Deserialize<object>(v.GetRawText()) : null,
                    overlay = full.TryGetProperty("overlay", out var o) ? JsonSerializer.Deserialize<object>(o.GetRawText()) : null,
                    global = full.TryGetProperty("global", out var g) ? JsonSerializer.Deserialize<object>(g.GetRawText()) : null
                };

                return Ok(new { success = true, config = safeConfig });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpeakChat] Error al obtener config overlay para {Channel}", channelName);
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ============================
        // POST /api/speakchat/test
        // ============================
        [HttpPost("test")]
        public async Task<IActionResult> SendTest([FromBody] SpeakChatTestRequest body)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var channelName = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(channelName))
                    return BadRequest(new { success = false, message = "No se pudo identificar el canal" });

                var text = body?.Message ?? "Mensaje de prueba del Speak Chat";
                var languageCode = body?.LanguageCode ?? "es-US";

                // El panel manda en `engine` el proveedor elegido. Cualquier cosa que no
                // sea "polly" es voz estándar, incluido el "browser" de configuraciones
                // viejas: ese motor ya no existe.
                var provider = body?.Engine == "polly" ? "polly" : "piper";

                // Con Piper, vacío significa "la voz por defecto de ese idioma"; con
                // Polly hace falta un nombre concreto.
                var voiceId = string.IsNullOrWhiteSpace(body?.Voice)
                    ? (provider == "polly" ? "Lupe" : "")
                    : body!.Voice!;

                // La prueba cobra igual que un mensaje real, o no sirve para probar nada
                var pollyEngine = body?.PollyEngine ?? "standard";
                var audioUrl = await _creditService.GenerateWithCreditsAsync(
                    channelOwnerId, text, voiceId, pollyEngine, languageCode, "speak_chat", channelName,
                    provider);

                var ttsEngine = audioUrl != null ? provider : "none";

                if (audioUrl == null)
                    _logger.LogInformation(
                        "[SpeakChat] Test sin audio ({Provider}) para {Channel}", provider, channelName);

                await _overlayNotificationService.SendToChannel(channelName, "SpeakChatMessage", new
                {
                    username = channelName,
                    message = text,
                    audioUrl,
                    volume = 80,
                    ttsEngine,
                    voice = voiceId,
                    languageCode,
                    overlay = new { showBubble = true, position = "bottom-left", fontSize = 16, duration = 5000 },
                    timestamp = DateTime.UtcNow,
                    isTest = true
                });

                return Ok(new { success = true, message = "Test enviado al overlay" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpeakChat] Error al enviar test");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ============================
        // GET /api/speakchat/usage
        // ============================
        [HttpGet("usage")]
        public async Task<IActionResult> GetUsage()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var balance = await _creditService.GetBalanceAsync(channelOwnerId);
                var expiresAt = await TierResolver.GetTierExpiryAsync(_dbContext, channelOwnerId);

                // La cuota mensual se muestra como "límite" para que la barra de progreso
                // siga funcionando; los créditos comprados van aparte porque no caducan.
                var charLimit = balance.IsUnlimited ? -1 : balance.MonthlyGranted;

                return Ok(new
                {
                    success = true,
                    tier = balance.Tier,
                    isUnlimited = balance.IsUnlimited,

                    // Cartera de créditos
                    monthlyGranted   = balance.MonthlyGranted,
                    monthlyUsed      = balance.MonthlyUsed,
                    monthlyRemaining = balance.MonthlyRemaining,
                    purchasedBalance = balance.PurchasedBalance,
                    totalAvailable   = balance.TotalAvailable,

                    // Bolsa de voz estándar (Piper), independiente de la premium
                    standardGranted   = balance.StandardGranted,
                    standardUsed      = balance.StandardUsed,
                    standardRemaining = balance.StandardRemaining,
                    standardPercentage = !balance.IsUnlimited && balance.StandardGranted > 0
                        ? (double)balance.StandardUsed / balance.StandardGranted * 100
                        : 0,

                    // Ventana de transición
                    inTransitionWindow = balance.InTransitionWindow,
                    transitionEndsAt   = balance.TransitionEndsAt,

                    tierExpiresAt = expiresAt,

                    // Compatibilidad con la UI anterior
                    charsUsed = balance.MonthlyUsed,
                    charLimit,
                    percentage = !balance.IsUnlimited && balance.MonthlyGranted > 0
                        ? (double)balance.MonthlyUsed / balance.MonthlyGranted * 100
                        : 0
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpeakChat] Error al obtener usage");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ==========================================================
        // POST /api/speakchat/overlay/reload
        // Fuerza la recarga de los overlays abiertos. Los overlays se auto-actualizan
        // solos al detectar un despliegue nuevo, pero esto lo hace al instante.
        // ==========================================================
        [HttpPost("overlay/reload")]
        public async Task<IActionResult> ReloadOverlays()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var channelName = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(channelName))
                    return BadRequest(new { success = false, message = "No se pudo identificar el canal" });

                await _overlayNotificationService.NotifyOverlayRefresh(channelName);

                return Ok(new { success = true, message = "Recarga solicitada" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpeakChat] Error solicitando recarga de overlays");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ============================
        // HELPERS
        // ============================

        private long GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(userIdClaim, out var userId))
                return userId;
            return 0;
        }

        private long GetChannelOwnerId()
        {
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
                return sessionId;

            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
                return channelOwnerId;

            return GetUserId();
        }

        private async Task<string?> GetChannelUsernameAsync(long channelOwnerId)
        {
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == channelOwnerId);
            return user?.Login?.ToLower();
        }
    }

    public record SpeakChatSaveRequest(JsonElement Config);
    public record SpeakChatTestRequest(string? Message, string? Voice, string? Engine, string? LanguageCode, string? PollyEngine);

}
