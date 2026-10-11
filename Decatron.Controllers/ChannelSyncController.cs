using System.Security.Claims;
using Decatron.Attributes;
using Decatron.Services.Platforms;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Decatron.Controllers
{
    /// <summary>
    /// Interruptor «aplicar título y categoría en Twitch y Kick a la vez» de la cuenta (plan: .dev/plans/KICK_TITULO_CATEGORIA_PLAN.md).
    /// El canal sale de la sesión; solo tiene sentido si la cuenta tiene las dos plataformas vinculadas.
    /// </summary>
    [ApiController]
    [Route("api/channel-sync")]
    [Authorize]
    public class ChannelSyncController : ControllerBase
    {
        private readonly ChannelSyncService _sync;
        private readonly ILogger<ChannelSyncController> _logger;

        public ChannelSyncController(ChannelSyncService sync, ILogger<ChannelSyncController> logger)
        {
            _sync = sync;
            _logger = logger;
        }

        private long GetChannelOwnerId()
        {
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId)) return sessionId;
            var claim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(claim, out var channelOwnerId)) return channelOwnerId;
            var own = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(own, out var userId)) return userId;
            throw new UnauthorizedAccessException("User not found");
        }

        [HttpGet]
        [RequirePermission("settings")]
        public async Task<IActionResult> Get()
        {
            try
            {
                var (available, enabled) = await _sync.GetAsync(GetChannelOwnerId());
                return Ok(new { success = true, available, enabled = available && enabled });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Sync] Error leyendo el interruptor");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpPut]
        [RequirePermission("settings")]
        public async Task<IActionResult> Put([FromBody] ChannelSyncDto dto)
        {
            try
            {
                var ok = await _sync.SetEnabledAsync(GetChannelOwnerId(), dto?.Enabled ?? false);
                if (!ok) return BadRequest(new { success = false, message = "Hace falta tener Twitch y Kick vinculados" });
                return Ok(new { success = true, enabled = dto!.Enabled });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Sync] Error guardando el interruptor");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }
    }

    public class ChannelSyncDto
    {
        public bool Enabled { get; set; }
    }
}
