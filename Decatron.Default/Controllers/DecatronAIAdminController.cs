using System;
using System.Linq;
using System.Threading.Tasks;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Attributes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Default.Controllers
{
    [Authorize]
    [RequireSystemOwner]
    [Route("api/admin/decatron-ai")]
    [ApiController]
    public class DecatronAIAdminController : ControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly ILogger<DecatronAIAdminController> _logger;

        public DecatronAIAdminController(
            DecatronDbContext dbContext,
            ILogger<DecatronAIAdminController> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        // ==================== CONFIGURACIÓN GLOBAL ====================

        [HttpGet("global-config")]
        public async Task<IActionResult> GetGlobalConfig()
        {

            var config = await _dbContext.DecatronAIGlobalConfigs.FirstOrDefaultAsync();
            if (config == null)
            {
                config = new DecatronAIGlobalConfig();
                _dbContext.DecatronAIGlobalConfigs.Add(config);
                await _dbContext.SaveChangesAsync();
            }

            return Ok(new { success = true, config });
        }

        [HttpPost("global-config")]
        public async Task<IActionResult> UpdateGlobalConfig([FromBody] UpdateGlobalConfigRequest request)
        {

            var config = await _dbContext.DecatronAIGlobalConfigs.FirstOrDefaultAsync();
            if (config == null)
            {
                config = new DecatronAIGlobalConfig();
                _dbContext.DecatronAIGlobalConfigs.Add(config);
            }

            if (request.Enabled.HasValue)
                config.Enabled = request.Enabled.Value;
            if (!string.IsNullOrEmpty(request.AIProvider))
                config.AIProvider = request.AIProvider;
            if (request.FallbackEnabled.HasValue)
                config.FallbackEnabled = request.FallbackEnabled.Value;
            if (!string.IsNullOrEmpty(request.Model))
                config.Model = request.Model;
            if (!string.IsNullOrEmpty(request.OpenRouterModel))
                config.OpenRouterModel = request.OpenRouterModel;
            if (request.MaxTokens.HasValue)
                config.MaxTokens = request.MaxTokens.Value;
            if (request.SystemPrompt != null)
                config.SystemPrompt = request.SystemPrompt;
            if (!string.IsNullOrEmpty(request.ResponsePrefix))
                config.ResponsePrefix = request.ResponsePrefix;
            if (request.GlobalCooldownSeconds.HasValue)
                config.GlobalCooldownSeconds = request.GlobalCooldownSeconds.Value;
            if (request.MinChannelCooldownSeconds.HasValue)
                config.MinChannelCooldownSeconds = request.MinChannelCooldownSeconds.Value;
            if (request.DefaultChannelCooldownSeconds.HasValue)
                config.DefaultChannelCooldownSeconds = request.DefaultChannelCooldownSeconds.Value;
            if (request.MaxPromptLength.HasValue)
                config.MaxPromptLength = request.MaxPromptLength.Value;

            config.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();

            _logger.LogInformation("✅ [ADMIN] Configuración global de Decatron IA actualizada");
            return Ok(new { success = true, message = "Configuración actualizada" });
        }

        // ==================== CANALES ====================

        [HttpGet("channels")]
        public async Task<IActionResult> GetChannels()
        {

            var channels = await _dbContext.DecatronAIChannelPermissions
                .OrderBy(c => c.ChannelName)
                .ToListAsync();

            return Ok(new { success = true, channels });
        }

        [HttpPost("channels")]
        public async Task<IActionResult> AddChannel([FromBody] AddChannelRequest request)
        {

            var channelName = request.ChannelName?.ToLower()?.Trim();
            if (string.IsNullOrEmpty(channelName))
                return BadRequest(new { success = false, message = "Nombre de canal requerido" });

            var existing = await _dbContext.DecatronAIChannelPermissions
                .FirstOrDefaultAsync(c => c.ChannelName == channelName);

            if (existing != null)
                return BadRequest(new { success = false, message = "Canal ya existe" });

            var channel = new DecatronAIChannelPermission
            {
                ChannelName = channelName,
                Enabled = request.Enabled ?? true,
                CanConfigure = request.CanConfigure ?? false,
                Notes = request.Notes,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _dbContext.DecatronAIChannelPermissions.Add(channel);
            await _dbContext.SaveChangesAsync();

            _logger.LogInformation($"✅ [ADMIN] Canal {channelName} agregado a Decatron IA");
            return Ok(new { success = true, message = "Canal agregado", channel });
        }

        [HttpPut("channels/{channelName}")]
        public async Task<IActionResult> UpdateChannel(string channelName, [FromBody] UpdateChannelRequest request)
        {

            var channel = await _dbContext.DecatronAIChannelPermissions
                .FirstOrDefaultAsync(c => c.ChannelName == channelName.ToLower());

            if (channel == null)
                return NotFound(new { success = false, message = "Canal no encontrado" });

            if (request.Enabled.HasValue)
                channel.Enabled = request.Enabled.Value;
            if (request.CanConfigure.HasValue)
                channel.CanConfigure = request.CanConfigure.Value;
            if (request.Notes != null)
                channel.Notes = request.Notes;

            channel.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true, message = "Canal actualizado" });
        }

        [HttpDelete("channels/{channelName}")]
        public async Task<IActionResult> DeleteChannel(string channelName)
        {

            var channel = await _dbContext.DecatronAIChannelPermissions
                .FirstOrDefaultAsync(c => c.ChannelName == channelName.ToLower());

            if (channel == null)
                return NotFound(new { success = false, message = "Canal no encontrado" });

            _dbContext.DecatronAIChannelPermissions.Remove(channel);
            await _dbContext.SaveChangesAsync();

            _logger.LogInformation($"✅ [ADMIN] Canal {channelName} eliminado de Decatron IA");
            return Ok(new { success = true, message = "Canal eliminado" });
        }

        // ==================== CONFIGURACIÓN DE CANAL (ADMIN) ====================

        [HttpGet("channels/{channelName}/config")]
        public async Task<IActionResult> GetChannelConfig(string channelName)
        {

            var channelLower = channelName.ToLower();

            // Verificar que el canal tenga permiso
            var permission = await _dbContext.DecatronAIChannelPermissions
                .FirstOrDefaultAsync(c => c.ChannelName == channelLower);

            if (permission == null)
                return NotFound(new { success = false, message = "Canal no encontrado en permisos" });

            // Obtener o crear config del canal
            var config = await _dbContext.DecatronAIChannelConfigs
                .FirstOrDefaultAsync(c => c.ChannelName == channelLower);

            var globalConfig = await _dbContext.DecatronAIGlobalConfigs.FirstOrDefaultAsync();

            return Ok(new
            {
                success = true,
                channelName = channelLower,
                permission,
                config = config ?? new DecatronAIChannelConfig { ChannelName = channelLower },
                globalDefaults = new
                {
                    minCooldown = globalConfig?.MinChannelCooldownSeconds ?? 120,
                    defaultCooldown = globalConfig?.DefaultChannelCooldownSeconds ?? 300,
                    maxPromptLength = globalConfig?.MaxPromptLength ?? 200
                }
            });
        }

        [HttpPost("channels/{channelName}/config")]
        public async Task<IActionResult> UpdateChannelConfig(string channelName, [FromBody] AdminUpdateChannelConfigRequest request)
        {

            var channelLower = channelName.ToLower();

            // Verificar que el canal tenga permiso
            var permission = await _dbContext.DecatronAIChannelPermissions
                .FirstOrDefaultAsync(c => c.ChannelName == channelLower);

            if (permission == null)
                return NotFound(new { success = false, message = "Canal no encontrado en permisos" });

            var globalConfig = await _dbContext.DecatronAIGlobalConfigs.FirstOrDefaultAsync();
            var minCooldown = globalConfig?.MinChannelCooldownSeconds ?? 120;

            // Obtener o crear config
            var config = await _dbContext.DecatronAIChannelConfigs
                .FirstOrDefaultAsync(c => c.ChannelName == channelLower);

            if (config == null)
            {
                config = new DecatronAIChannelConfig
                {
                    ChannelName = channelLower,
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
                config.WhitelistUsers = System.Text.Json.JsonSerializer.Serialize(request.WhitelistUsers);

            if (request.BlacklistUsers != null)
                config.BlacklistUsers = System.Text.Json.JsonSerializer.Serialize(request.BlacklistUsers);

            if (request.ChannelCooldownSeconds.HasValue)
                config.ChannelCooldownSeconds = Math.Max(request.ChannelCooldownSeconds.Value, minCooldown);

            if (request.UserCooldownSeconds.HasValue)
                config.UserCooldownSeconds = request.UserCooldownSeconds > 0 ? request.UserCooldownSeconds : null;

            if (request.CustomPrefix != null)
                config.CustomPrefix = string.IsNullOrWhiteSpace(request.CustomPrefix) ? null : request.CustomPrefix;

            if (request.CustomSystemPrompt != null)
                config.CustomSystemPrompt = string.IsNullOrWhiteSpace(request.CustomSystemPrompt) ? null : request.CustomSystemPrompt;

            config.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();

            _logger.LogInformation($"✅ [ADMIN] Config de canal {channelLower} actualizada");
            return Ok(new { success = true, message = "Configuración del canal guardada" });
        }

        // ==================== ESTADÍSTICAS ====================

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {

            var today = DateTime.UtcNow.Date;
            var thisWeek = today.AddDays(-7);
            var thisMonth = today.AddDays(-30);

            var totalUsage = await _dbContext.DecatronAIUsages.CountAsync();
            var todayUsage = await _dbContext.DecatronAIUsages.CountAsync(u => u.UsedAt >= today);
            var weekUsage = await _dbContext.DecatronAIUsages.CountAsync(u => u.UsedAt >= thisWeek);
            var monthUsage = await _dbContext.DecatronAIUsages.CountAsync(u => u.UsedAt >= thisMonth);

            var totalChannels = await _dbContext.DecatronAIChannelPermissions.CountAsync(c => c.Enabled);
            var totalTokens = await _dbContext.DecatronAIUsages.SumAsync(u => u.TokensUsed);

            var topChannels = await _dbContext.DecatronAIUsages
                .GroupBy(u => u.ChannelName)
                .Select(g => new { Channel = g.Key, Count = g.Count() })
                .OrderByDescending(x => x.Count)
                .Take(5)
                .ToListAsync();

            var recentUsage = await _dbContext.DecatronAIUsages
                .OrderByDescending(u => u.UsedAt)
                .Take(10)
                .Select(u => new
                {
                    u.ChannelName,
                    u.Username,
                    Prompt = u.Prompt.Length > 50 ? u.Prompt.Substring(0, 50) + "..." : u.Prompt,
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
                    monthUsage,
                    totalChannels,
                    totalTokens,
                    topChannels,
                    recentUsage
                }
            });
        }

        // ==================== CHECK OWNER ====================

        [HttpGet("check-owner")]
        public IActionResult CheckOwner()
        {
            // Si llegamos aquí, el filtro RequireSystemOwner ya validó que es owner
            return Ok(new { success = true, isOwner = true });
        }
    }

    // DTOs
    public class UpdateGlobalConfigRequest
    {
        public bool? Enabled { get; set; }
        public string? AIProvider { get; set; }  // "gemini" o "openrouter"
        public bool? FallbackEnabled { get; set; }
        public string? Model { get; set; }  // Modelo de Gemini
        public string? OpenRouterModel { get; set; }  // Modelo de OpenRouter
        public int? MaxTokens { get; set; }
        public string? SystemPrompt { get; set; }
        public string? ResponsePrefix { get; set; }
        public int? GlobalCooldownSeconds { get; set; }
        public int? MinChannelCooldownSeconds { get; set; }
        public int? DefaultChannelCooldownSeconds { get; set; }
        public int? MaxPromptLength { get; set; }
    }

    public class AddChannelRequest
    {
        public string? ChannelName { get; set; }
        public bool? Enabled { get; set; }
        public bool? CanConfigure { get; set; }
        public string? Notes { get; set; }
    }

    public class UpdateChannelRequest
    {
        public bool? Enabled { get; set; }
        public bool? CanConfigure { get; set; }
        public string? Notes { get; set; }
    }

    public class AdminUpdateChannelConfigRequest
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
