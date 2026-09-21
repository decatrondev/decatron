using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/ruleta")]
    [Authorize]
    public class RuletaController : ControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly ILogger<RuletaController> _logger;

        public RuletaController(DecatronDbContext dbContext, ILogger<RuletaController> logger)
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

                var config = await _dbContext.RuletaCommandConfigs
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.UserId == channelOwnerId);

                config ??= new RuletaCommandConfig();

                return Ok(new
                {
                    success = true,
                    config = ToDto(config)
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🔫 [Ruleta] Error obteniendo configuración");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpPost("config")]
        public async Task<IActionResult> SaveConfiguration([FromBody] RuletaConfigDto request)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();

                if (request.CooldownGlobal < 0 || request.CooldownUser < 0)
                {
                    return BadRequest(new { success = false, message = "Los cooldowns no pueden ser negativos" });
                }

                if (request.ChancePercent < 1 || request.ChancePercent > 100)
                {
                    return BadRequest(new { success = false, message = "La probabilidad debe estar entre 1 y 100" });
                }

                if (request.MinTimeoutSeconds < 1 || request.MaxTimeoutSeconds < request.MinTimeoutSeconds)
                {
                    return BadRequest(new { success = false, message = "El rango de duración del timeout es inválido" });
                }

                var validPermissions = new[] { "everyone", "subscriber", "vip", "moderator", "lead_moderator", "broadcaster" };
                if (!validPermissions.Contains(request.Permission))
                {
                    return BadRequest(new { success = false, message = "Nivel de permiso inválido" });
                }

                if (request.HitMessages == null || request.HitMessages.Count(m => !string.IsNullOrWhiteSpace(m)) == 0 ||
                    request.MissMessages == null || request.MissMessages.Count(m => !string.IsNullOrWhiteSpace(m)) == 0 ||
                    request.SelfHitMessages == null || request.SelfHitMessages.Count(m => !string.IsNullOrWhiteSpace(m)) == 0 ||
                    request.SelfMissMessages == null || request.SelfMissMessages.Count(m => !string.IsNullOrWhiteSpace(m)) == 0)
                {
                    return BadRequest(new { success = false, message = "Cada categoría de mensajes necesita al menos una variante" });
                }

                var config = await _dbContext.RuletaCommandConfigs
                    .FirstOrDefaultAsync(c => c.UserId == channelOwnerId);

                if (config == null)
                {
                    config = new RuletaCommandConfig { UserId = channelOwnerId, CreatedAt = DateTime.UtcNow };
                    _dbContext.RuletaCommandConfigs.Add(config);
                }

                config.Enabled = request.Enabled;
                config.CommandName = request.CommandName;
                config.ChancePercent = request.ChancePercent;
                config.MinTimeoutSeconds = request.MinTimeoutSeconds;
                config.MaxTimeoutSeconds = request.MaxTimeoutSeconds;
                config.CooldownGlobal = request.CooldownGlobal;
                config.CooldownUser = request.CooldownUser;
                config.Permission = request.Permission;
                config.AllowSelfTarget = request.AllowSelfTarget;
                config.AllowTargetModerators = request.AllowTargetModerators;
                config.ProtectedUsers = JsonSerializer.Serialize((request.ProtectedUsers ?? new()).Select(u => u.TrimStart('@').ToLower()).Where(u => !string.IsNullOrWhiteSpace(u)).Distinct());
                config.BlockedUsers = JsonSerializer.Serialize((request.BlockedUsers ?? new()).Select(u => u.TrimStart('@').ToLower()).Where(u => !string.IsNullOrWhiteSpace(u)).Distinct());
                config.HitMessages = JsonSerializer.Serialize(request.HitMessages.Where(m => !string.IsNullOrWhiteSpace(m)));
                config.MissMessages = JsonSerializer.Serialize(request.MissMessages.Where(m => !string.IsNullOrWhiteSpace(m)));
                config.UseSelfMessages = request.UseSelfMessages;
                config.SelfHitMessages = JsonSerializer.Serialize(request.SelfHitMessages.Where(m => !string.IsNullOrWhiteSpace(m)));
                config.SelfMissMessages = JsonSerializer.Serialize(request.SelfMissMessages.Where(m => !string.IsNullOrWhiteSpace(m)));
                config.UpdatedAt = DateTime.UtcNow;

                await _dbContext.SaveChangesAsync();

                _logger.LogInformation($"🔫 [Ruleta] Configuración guardada para canal {channelOwnerId}");

                return Ok(new { success = true, config = ToDto(config) });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🔫 [Ruleta] Error guardando configuración");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        private static object ToDto(RuletaCommandConfig config) => new
        {
            enabled = config.Enabled,
            commandName = config.CommandName,
            chancePercent = config.ChancePercent,
            minTimeoutSeconds = config.MinTimeoutSeconds,
            maxTimeoutSeconds = config.MaxTimeoutSeconds,
            cooldownGlobal = config.CooldownGlobal,
            cooldownUser = config.CooldownUser,
            permission = config.Permission,
            allowSelfTarget = config.AllowSelfTarget,
            allowTargetModerators = config.AllowTargetModerators,
            protectedUsers = DeserializeMessages(config.ProtectedUsers),
            blockedUsers = DeserializeMessages(config.BlockedUsers),
            hitMessages = DeserializeMessages(config.HitMessages),
            missMessages = DeserializeMessages(config.MissMessages),
            useSelfMessages = config.UseSelfMessages,
            selfHitMessages = DeserializeMessages(config.SelfHitMessages),
            selfMissMessages = DeserializeMessages(config.SelfMissMessages),
        };

        private static List<string> DeserializeMessages(string json)
        {
            try
            {
                return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
            }
            catch
            {
                return new List<string>();
            }
        }
    }

    public class RuletaConfigDto
    {
        public bool Enabled { get; set; } = true;
        public string CommandName { get; set; } = "!ruleta";
        public int ChancePercent { get; set; } = 17;
        public int MinTimeoutSeconds { get; set; } = 60;
        public int MaxTimeoutSeconds { get; set; } = 60;
        public int CooldownGlobal { get; set; } = 10;
        public int CooldownUser { get; set; } = 30;
        public string Permission { get; set; } = "everyone";
        public bool AllowSelfTarget { get; set; } = true;
        public bool AllowTargetModerators { get; set; } = false;
        public List<string> ProtectedUsers { get; set; } = new();
        public List<string> BlockedUsers { get; set; } = new();
        public List<string> HitMessages { get; set; } = new();
        public List<string> MissMessages { get; set; } = new();
        public bool UseSelfMessages { get; set; } = true;
        public List<string> SelfHitMessages { get; set; } = new();
        public List<string> SelfMissMessages { get; set; } = new();
    }
}
