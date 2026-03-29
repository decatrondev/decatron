using System;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Default.Controllers
{
    [Authorize]
    [Route("api/decatron-ai")]
    [ApiController]
    public class DecatronAIController : ControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly ILogger<DecatronAIController> _logger;
        private readonly IPermissionService _permissionService;

        public DecatronAIController(
            DecatronDbContext dbContext,
            ILogger<DecatronAIController> logger,
            IPermissionService permissionService)
        {
            _dbContext = dbContext;
            _logger = logger;
            _permissionService = permissionService;
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
            // PRIORIDAD 1: Obtener canal activo desde la sesión (después de switch)
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
            {
                _logger.LogDebug($"[DecatronAI] Using channel from session: {sessionId}");
                return sessionId;
            }

            // PRIORIDAD 2: Usar el claim del JWT si existe
            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
            {
                _logger.LogDebug($"[DecatronAI] Using channel from JWT claim: {channelOwnerId}");
                return channelOwnerId;
            }

            // PRIORIDAD 3: Por defecto, usar el propio canal del usuario
            var userId = GetUserId();
            _logger.LogDebug($"[DecatronAI] Using user's own channel: {userId}");
            return userId;
        }

        private async Task<string> GetChannelNameAsync()
        {
            // Obtener canal activo desde sesión
            var sessionChannelName = HttpContext.Session.GetString("ActiveChannelName");
            if (!string.IsNullOrEmpty(sessionChannelName))
                return sessionChannelName.ToLower();

            // Obtener del channelOwnerId
            var channelOwnerId = GetChannelOwnerId();
            var channelOwner = await _dbContext.Users
                .Where(u => u.Id == channelOwnerId && u.IsActive)
                .FirstOrDefaultAsync();

            return channelOwner?.Login?.ToLower() ?? "";
        }

        private async Task<bool> CanConfigureAsync(string channelName)
        {
            var permission = await _dbContext.DecatronAIChannelPermissions
                .FirstOrDefaultAsync(c => c.ChannelName == channelName && c.Enabled && c.CanConfigure);

            return permission != null;
        }

        // ==================== VERIFICAR ACCESO ====================

        [HttpGet("check-access")]
        public async Task<IActionResult> CheckAccess()
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();
                var channelName = await GetChannelNameAsync();

                // Verificar que tenga control_total en el canal usando IPermissionService
                if (!await _permissionService.HasPermissionLevelAsync(userId, channelOwnerId, "control_total"))
                {
                    _logger.LogDebug($"[DecatronAI] User {userId} denied: no control_total for channel {channelOwnerId}");
                    return Ok(new { success = true, canConfigure = false, channelName, reason = "no_permission" });
                }

                // Verificar que el canal tenga permiso de Decatron IA
                var canConfigure = await CanConfigureAsync(channelName);

                return Ok(new { success = true, canConfigure, channelName });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[DecatronAI] Error checking access");
                return StatusCode(500, new { success = false, message = "Error interno" });
            }
        }

        // ==================== CONFIGURACIÓN DEL CANAL ====================

        [HttpGet("config")]
        public async Task<IActionResult> GetConfig()
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();
                var channelName = await GetChannelNameAsync();

                // Verificar que tenga control_total en el canal
                if (!await _permissionService.HasPermissionLevelAsync(userId, channelOwnerId, "control_total"))
                {
                    _logger.LogWarning($"[DecatronAI] User {userId} denied config: no control_total for channel {channelOwnerId}");
                    return Forbid();
                }

                if (!await CanConfigureAsync(channelName))
                    return Forbid();

                var config = await _dbContext.DecatronAIChannelConfigs
                    .FirstOrDefaultAsync(c => c.ChannelName == channelName);

                var globalConfig = await _dbContext.DecatronAIGlobalConfigs.FirstOrDefaultAsync();

                return Ok(new
                {
                    success = true,
                    config = config ?? new DecatronAIChannelConfig { ChannelName = channelName },
                    globalDefaults = new
                    {
                        minCooldown = globalConfig?.MinChannelCooldownSeconds ?? 120,
                        defaultCooldown = globalConfig?.DefaultChannelCooldownSeconds ?? 300,
                        maxPromptLength = globalConfig?.MaxPromptLength ?? 200
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[DecatronAI] Error getting config");
                return StatusCode(500, new { success = false, message = "Error interno" });
            }
        }

        [HttpPost("config")]
        public async Task<IActionResult> UpdateConfig([FromBody] UpdateStreamerConfigRequest request)
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();
                var channelName = await GetChannelNameAsync();

                // Verificar que tenga control_total en el canal
                if (!await _permissionService.HasPermissionLevelAsync(userId, channelOwnerId, "control_total"))
                {
                    _logger.LogWarning($"[DecatronAI] User {userId} denied update config: no control_total for channel {channelOwnerId}");
                    return Forbid();
                }

                if (!await CanConfigureAsync(channelName))
                    return Forbid();

                var globalConfig = await _dbContext.DecatronAIGlobalConfigs.FirstOrDefaultAsync();
                var minCooldown = globalConfig?.MinChannelCooldownSeconds ?? 120;

                var config = await _dbContext.DecatronAIChannelConfigs
                    .FirstOrDefaultAsync(c => c.ChannelName == channelName);

                if (config == null)
                {
                    config = new DecatronAIChannelConfig
                    {
                        ChannelName = channelName,
                        CreatedAt = DateTime.UtcNow
                    };
                    _dbContext.DecatronAIChannelConfigs.Add(config);
                }

                // Actualizar campos
                if (!string.IsNullOrEmpty(request.PermissionLevel))
                {
                    var validLevels = new[] { "everyone", "subscriber", "vip", "moderator", "broadcaster" };
                    if (validLevels.Contains(request.PermissionLevel.ToLower()))
                        config.PermissionLevel = request.PermissionLevel.ToLower();
                }

                if (request.WhitelistEnabled.HasValue)
                    config.WhitelistEnabled = request.WhitelistEnabled.Value;

                if (request.WhitelistUsers != null)
                    config.WhitelistUsers = JsonSerializer.Serialize(request.WhitelistUsers);

                if (request.BlacklistUsers != null)
                    config.BlacklistUsers = JsonSerializer.Serialize(request.BlacklistUsers);

                if (request.ChannelCooldownSeconds.HasValue)
                {
                    // Asegurar que no sea menor al mínimo global
                    config.ChannelCooldownSeconds = Math.Max(request.ChannelCooldownSeconds.Value, minCooldown);
                }

                if (request.UserCooldownSeconds.HasValue)
                    config.UserCooldownSeconds = request.UserCooldownSeconds > 0 ? request.UserCooldownSeconds : null;

                if (request.CustomPrefix != null)
                    config.CustomPrefix = string.IsNullOrWhiteSpace(request.CustomPrefix) ? null : request.CustomPrefix;

                if (request.CustomSystemPrompt != null)
                    config.CustomSystemPrompt = string.IsNullOrWhiteSpace(request.CustomSystemPrompt) ? null : request.CustomSystemPrompt;

                config.UpdatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();

                _logger.LogInformation($"✅ [STREAMER] Config de Decatron IA actualizada para {channelName} por user {userId}");
                return Ok(new { success = true, message = "Configuración guardada" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[DecatronAI] Error updating config");
                return StatusCode(500, new { success = false, message = "Error interno" });
            }
        }

        // ==================== ESTADÍSTICAS DEL CANAL ====================

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();
                var channelName = await GetChannelNameAsync();

                // Verificar que tenga control_total en el canal
                if (!await _permissionService.HasPermissionLevelAsync(userId, channelOwnerId, "control_total"))
                {
                    _logger.LogWarning($"[DecatronAI] User {userId} denied stats: no control_total for channel {channelOwnerId}");
                    return Forbid();
                }

                if (!await CanConfigureAsync(channelName))
                    return Forbid();

                var today = DateTime.UtcNow.Date;
                var thisWeek = today.AddDays(-7);

                var totalUsage = await _dbContext.DecatronAIUsages
                    .CountAsync(u => u.ChannelName == channelName);

                var todayUsage = await _dbContext.DecatronAIUsages
                    .CountAsync(u => u.ChannelName == channelName && u.UsedAt >= today);

                var weekUsage = await _dbContext.DecatronAIUsages
                    .CountAsync(u => u.ChannelName == channelName && u.UsedAt >= thisWeek);

                var topUsers = await _dbContext.DecatronAIUsages
                    .Where(u => u.ChannelName == channelName)
                    .GroupBy(u => u.Username)
                    .Select(g => new { Username = g.Key, Count = g.Count() })
                    .OrderByDescending(x => x.Count)
                    .Take(5)
                    .ToListAsync();

                var recentUsage = await _dbContext.DecatronAIUsages
                    .Where(u => u.ChannelName == channelName)
                    .OrderByDescending(u => u.UsedAt)
                    .Take(10)
                    .Select(u => new
                    {
                        u.Username,
                        Prompt = u.Prompt.Length > 50 ? u.Prompt.Substring(0, 50) + "..." : u.Prompt,
                        Response = u.Response != null && u.Response.Length > 50 ? u.Response.Substring(0, 50) + "..." : u.Response,
                        u.Success,
                        u.UsedAt
                    })
                    .ToListAsync();

                return Ok(new
                {
                    success = true,
                    stats = new
                    {
                        totalUsage,
                        todayUsage,
                        weekUsage,
                        topUsers,
                        recentUsage
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[DecatronAI] Error getting stats");
                return StatusCode(500, new { success = false, message = "Error interno" });
            }
        }
    }

    // DTOs
    public class UpdateStreamerConfigRequest
    {
        public string? PermissionLevel { get; set; }
        public bool? WhitelistEnabled { get; set; }
        public string[]? WhitelistUsers { get; set; }
        public string[]? BlacklistUsers { get; set; }
        public int? ChannelCooldownSeconds { get; set; }
        public int? UserCooldownSeconds { get; set; }
        public string? CustomPrefix { get; set; }
        public string? CustomSystemPrompt { get; set; }
    }
}
