using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Decatron.Services;
using Decatron.Attributes;
using System;
using System.Text.Json;
using System.Threading.Tasks;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class GoalsController : ControllerBase
    {
        private readonly GoalsService _goalsService;
        private readonly ILogger<GoalsController> _logger;

        public GoalsController(
            GoalsService goalsService,
            ILogger<GoalsController> logger)
        {
            _goalsService = goalsService;
            _logger = logger;
        }

        // ========================================================================
        // CONFIG ENDPOINTS
        // ========================================================================

        [HttpGet("config")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetConfig()
        {
            try
            {
                var userId = GetUserId();
                if (userId == 0)
                    return Unauthorized(new { success = false, message = "No autenticado" });

                var config = await _goalsService.GetConfig(userId);

                if (config == null)
                {
                    // Return default config structure
                    return Ok(new { success = true, config = (object?)null });
                }

                // Transform to frontend format
                return Ok(new
                {
                    success = true,
                    config = new
                    {
                        goals = JsonSerializer.Deserialize<JsonElement>(config.Goals),
                        activeGoalIds = JsonSerializer.Deserialize<JsonElement>(config.ActiveGoalIds),
                        defaultSources = JsonSerializer.Deserialize<JsonElement>(config.DefaultSources),
                        design = JsonSerializer.Deserialize<JsonElement>(config.DesignConfig),
                        notifications = JsonSerializer.Deserialize<JsonElement>(config.NotificationsConfig),
                        timerIntegration = JsonSerializer.Deserialize<JsonElement>(config.TimerIntegrationConfig),
                        commands = JsonSerializer.Deserialize<JsonElement>(config.CommandsConfig),
                        historyEnabled = config.HistoryEnabled,
                        historyRetentionDays = config.HistoryRetentionDays,
                        resetOnStreamEnd = config.ResetOnStreamEnd,
                        canvasWidth = config.CanvasWidth,
                        canvasHeight = config.CanvasHeight,
                        goalPositions = JsonSerializer.Deserialize<JsonElement>(config.GoalPositions)
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener config de goals");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        [HttpPost("config")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SaveConfig([FromBody] JsonElement configData)
        {
            try
            {
                var userId = GetUserId();
                var channelName = GetChannelName();

                if (userId == 0 || string.IsNullOrEmpty(channelName))
                    return Unauthorized(new { success = false, message = "No autenticado" });

                var savedConfig = await _goalsService.SaveConfig(userId, channelName, configData);

                return Ok(new { success = true, message = "Configuración guardada" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al guardar config de goals");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ========================================================================
        // OVERLAY ENDPOINT (No auth required)
        // ========================================================================

        [HttpGet("config/overlay/{channelName}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetOverlayConfig(string channelName)
        {
            try
            {
                var data = await _goalsService.GetOverlayData(channelName);

                if (data == null)
                {
                    return Ok(new { success = true, config = (object?)null });
                }

                return Ok(new { success = true, config = data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener config de overlay para {Channel}", channelName);
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ========================================================================
        // PROGRESS ENDPOINTS
        // ========================================================================

        [HttpPost("{goalId}/progress")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> UpdateProgress(string goalId, [FromBody] ProgressUpdateRequest request)
        {
            try
            {
                var userId = GetUserId();
                if (userId == 0)
                    return Unauthorized(new { success = false, message = "No autenticado" });

                var success = await _goalsService.UpdateProgress(
                    userId,
                    goalId,
                    request.Amount,
                    request.Source ?? "manual",
                    GetUserName()
                );

                if (!success)
                    return BadRequest(new { success = false, message = "No se pudo actualizar el progreso" });

                return Ok(new { success = true, message = "Progreso actualizado" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al actualizar progreso del goal {GoalId}", goalId);
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        [HttpPost("{goalId}/set")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SetProgress(string goalId, [FromBody] SetProgressRequest request)
        {
            try
            {
                var userId = GetUserId();
                if (userId == 0)
                    return Unauthorized(new { success = false, message = "No autenticado" });

                var success = await _goalsService.SetProgress(userId, goalId, request.Value, GetUserName());

                if (!success)
                    return BadRequest(new { success = false, message = "No se pudo establecer el progreso" });

                return Ok(new { success = true, message = "Progreso establecido" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al establecer progreso del goal {GoalId}", goalId);
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        [HttpPost("{goalId}/reset")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ResetGoal(string goalId)
        {
            try
            {
                var userId = GetUserId();
                if (userId == 0)
                    return Unauthorized(new { success = false, message = "No autenticado" });

                var success = await _goalsService.ResetGoal(userId, goalId, GetUserName());

                if (!success)
                    return BadRequest(new { success = false, message = "No se pudo resetear el goal" });

                return Ok(new { success = true, message = "Goal reseteado" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al resetear goal {GoalId}", goalId);
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ========================================================================
        // HISTORY ENDPOINT
        // ========================================================================

        [HttpGet("history")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetHistory([FromQuery] int limit = 50)
        {
            try
            {
                var userId = GetUserId();
                if (userId == 0)
                    return Unauthorized(new { success = false, message = "No autenticado" });

                var history = await _goalsService.GetHistory(userId, limit);

                return Ok(new { success = true, history });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener historial de goals");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ========================================================================
        // HELPERS
        // ========================================================================

        private long GetUserId()
        {
            var twitchIdClaim = User.FindFirst("TwitchId")?.Value;
            if (long.TryParse(twitchIdClaim, out var userId))
                return userId;
            return 0;
        }

        private string? GetChannelName()
        {
            return User.FindFirst("Login")?.Value;
        }

        private string? GetUserName()
        {
            return User.FindFirst("DisplayName")?.Value ?? User.FindFirst("Login")?.Value;
        }

        // ========================================================================
        // REQUEST DTOS
        // ========================================================================

        public class ProgressUpdateRequest
        {
            public int Amount { get; set; }
            public string? Source { get; set; }
        }

        public class SetProgressRequest
        {
            public int Value { get; set; }
        }
    }
}
