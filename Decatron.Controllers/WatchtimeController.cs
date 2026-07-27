using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/watchtime")]
    [Authorize]
    public class WatchtimeController : ControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly ILogger<WatchtimeController> _logger;

        public WatchtimeController(DecatronDbContext dbContext, ILogger<WatchtimeController> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        private long GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(userIdClaim, out var userId))
                return userId;
            throw new UnauthorizedAccessException("User not found");
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

        [HttpGet("config")]
        public async Task<IActionResult> GetConfiguration()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();

                var config = await _dbContext.WatchtimeCommandConfigs
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.UserId == channelOwnerId);

                config ??= new WatchtimeCommandConfig();

                return Ok(new
                {
                    success = true,
                    config = ToDto(config)
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "⏱️ [Watchtime] Error obteniendo configuración");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpPost("config")]
        public async Task<IActionResult> SaveConfiguration([FromBody] WatchtimeConfigDto request)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();

                if (request.CooldownGlobal < 0 || request.CooldownUser < 0)
                {
                    return BadRequest(new { success = false, message = "Los cooldowns no pueden ser negativos" });
                }

                if (request.MinMinutesToRespond < 0)
                {
                    return BadRequest(new { success = false, message = "El tiempo mínimo no puede ser negativo" });
                }

                var validPermissions = new[] { "everyone", "subscriber", "vip", "moderator", "lead_moderator", "broadcaster" };
                if (!validPermissions.Contains(request.Permission))
                {
                    return BadRequest(new { success = false, message = "Nivel de permiso inválido" });
                }

                var validFormats = new[] { "minutes", "hours_minutes", "full" };
                if (!validFormats.Contains(request.TimeFormat))
                {
                    return BadRequest(new { success = false, message = "Formato de tiempo inválido" });
                }

                var config = await _dbContext.WatchtimeCommandConfigs
                    .FirstOrDefaultAsync(c => c.UserId == channelOwnerId);

                if (config == null)
                {
                    config = new WatchtimeCommandConfig { UserId = channelOwnerId, CreatedAt = DateTime.UtcNow };
                    _dbContext.WatchtimeCommandConfigs.Add(config);
                }

                config.Enabled = request.Enabled;
                config.CommandName = request.CommandName;
                config.CooldownGlobal = request.CooldownGlobal;
                config.CooldownUser = request.CooldownUser;
                config.Permission = request.Permission;
                config.TrackLurkers = request.TrackLurkers;
                config.MinMinutesToRespond = request.MinMinutesToRespond;
                config.TimeFormat = request.TimeFormat;
                config.ShowPosition = request.ShowPosition;
                config.OnlyWhenLive = request.OnlyWhenLive;
                config.CustomMessage = request.CustomMessage;
                config.UseFirstTimeMessage = request.UseFirstTimeMessage;
                config.FirstTimeMessage = request.FirstTimeMessage;
                config.UseNotEnoughTimeMessage = request.UseNotEnoughTimeMessage;
                config.NotEnoughTimeMessage = request.NotEnoughTimeMessage;
                config.UseOfflineMessage = request.UseOfflineMessage;
                config.OfflineMessage = request.OfflineMessage;
                config.UpdatedAt = DateTime.UtcNow;

                await _dbContext.SaveChangesAsync();

                _logger.LogInformation($"⏱️ [Watchtime] Configuración guardada para canal {channelOwnerId}");

                return Ok(new { success = true, config = ToDto(config) });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "⏱️ [Watchtime] Error guardando configuración");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        private static object ToDto(WatchtimeCommandConfig config) => new
        {
            enabled = config.Enabled,
            commandName = config.CommandName,
            cooldownGlobal = config.CooldownGlobal,
            cooldownUser = config.CooldownUser,
            permission = config.Permission,
            trackLurkers = config.TrackLurkers,
            minMinutesToRespond = config.MinMinutesToRespond,
            timeFormat = config.TimeFormat,
            showPosition = config.ShowPosition,
            onlyWhenLive = config.OnlyWhenLive,
            customMessage = config.CustomMessage,
            useFirstTimeMessage = config.UseFirstTimeMessage,
            firstTimeMessage = config.FirstTimeMessage,
            useNotEnoughTimeMessage = config.UseNotEnoughTimeMessage,
            notEnoughTimeMessage = config.NotEnoughTimeMessage,
            useOfflineMessage = config.UseOfflineMessage,
            offlineMessage = config.OfflineMessage,
        };
    }

    public class WatchtimeConfigDto
    {
        public bool Enabled { get; set; } = true;
        public string CommandName { get; set; } = "!watchtime";
        public int CooldownGlobal { get; set; } = 5;
        public int CooldownUser { get; set; } = 30;
        public string Permission { get; set; } = "everyone";
        public bool TrackLurkers { get; set; } = true;
        public int MinMinutesToRespond { get; set; } = 0;
        public string TimeFormat { get; set; } = "full";
        public bool ShowPosition { get; set; } = true;
        public bool OnlyWhenLive { get; set; } = false;
        public string CustomMessage { get; set; } = "";
        public bool UseFirstTimeMessage { get; set; } = true;
        public string FirstTimeMessage { get; set; } = "";
        public bool UseNotEnoughTimeMessage { get; set; } = true;
        public string NotEnoughTimeMessage { get; set; } = "";
        public bool UseOfflineMessage { get; set; } = false;
        public string OfflineMessage { get; set; } = "";
    }
}
