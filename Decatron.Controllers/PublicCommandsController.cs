using Decatron.Core.Helpers;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Decatron.Controllers
{
    [ApiController]
    public class PublicCommandsController : ControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly ICommandStateService _commandStateService;
        private readonly ICommandTranslationService _commandTranslationService;
        private readonly ILogger<PublicCommandsController> _logger;

        public PublicCommandsController(
            DecatronDbContext dbContext,
            ICommandStateService commandStateService,
            ICommandTranslationService commandTranslationService,
            ILogger<PublicCommandsController> logger)
        {
            _dbContext = dbContext;
            _commandStateService = commandStateService;
            _commandTranslationService = commandTranslationService;
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

        // ── Config (dashboard, autenticado) ─────────────────────────────────────

        [Authorize]
        [HttpGet("api/publiccommands/config")]
        public async Task<IActionResult> GetConfig()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var items = await BuildCommandListAsync(channelOwnerId, applyHiddenFilter: false);
                var channelLogin = await ChannelResolver.ResolveLoginAsync(_dbContext, channelOwnerId);
                return Ok(new { success = true, items, channel = channelLogin });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🌐 [PublicCommands] Error obteniendo config");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [Authorize]
        [HttpPost("api/publiccommands/config")]
        public async Task<IActionResult> SaveConfig([FromBody] List<PublicCommandOverrideDto> overrides)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();

                var existing = await _dbContext.PublicCommandOverrides
                    .Where(o => o.UserId == channelOwnerId)
                    .ToListAsync();
                _dbContext.PublicCommandOverrides.RemoveRange(existing);

                // Solo persistimos overrides que difieren del default (oculto o con descripción pública)
                var toSave = overrides
                    .Where(o => o.Hidden || !string.IsNullOrWhiteSpace(o.PublicDescription))
                    .Select(o => new PublicCommandOverride
                    {
                        UserId = channelOwnerId,
                        Category = o.Category,
                        CommandKey = o.CommandKey,
                        Hidden = o.Hidden,
                        PublicDescription = string.IsNullOrWhiteSpace(o.PublicDescription) ? null : o.PublicDescription,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow,
                    });

                await _dbContext.PublicCommandOverrides.AddRangeAsync(toSave);
                await _dbContext.SaveChangesAsync();

                _logger.LogInformation("🌐 [PublicCommands] Overrides guardados para canal {ChannelOwnerId}", channelOwnerId);

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🌐 [PublicCommands] Error guardando config");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        // ── Vista pública (sin auth) ─────────────────────────────────────────────

        [HttpGet("api/public/commands/{channel}")]
        public async Task<IActionResult> GetPublicCommands(string channel)
        {
            try
            {
                var channelInfo = await ChannelResolver.ResolveChannelInfoAsync(_dbContext, channel);
                if (channelInfo == null)
                    return NotFound(new { success = false, message = "Canal no encontrado" });

                var items = await BuildCommandListAsync(channelInfo.UserId, applyHiddenFilter: true);

                return Ok(new
                {
                    success = true,
                    channel = channelInfo.Login,
                    displayName = channelInfo.DisplayName,
                    items = items.Select(i => new
                    {
                        i.category,
                        i.name,
                        description = i.publicDescription ?? i.description,
                        i.restriction,
                    })
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🌐 [PublicCommands] Error obteniendo vista pública para {Channel}", channel);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        // ── Helper compartido ────────────────────────────────────────────────────

        private async Task<List<PublicCommandItemResult>> BuildCommandListAsync(long channelOwnerId, bool applyHiddenFilter)
        {
            var overrides = await _dbContext.PublicCommandOverrides
                .AsNoTracking()
                .Where(o => o.UserId == channelOwnerId)
                .ToListAsync();

            var overrideMap = overrides.ToDictionary(o => (o.Category, o.CommandKey));

            var results = new List<PublicCommandItemResult>();

            // Default commands
            var defaultMetadata = _commandTranslationService.GetAllDefaultCommandsMetadata("es");
            foreach (var meta in defaultMetadata)
            {
                var enabled = await _commandStateService.IsCommandEnabledAsync(channelOwnerId, meta.Name);
                if (!enabled) continue;

                AddItem(results, overrideMap, "default", meta.Name, meta.Name, meta.Description, null, applyHiddenFilter);
            }

            // Custom commands
            var customCommands = await _dbContext.CustomCommands
                .AsNoTracking()
                .Where(c => c.UserId == channelOwnerId && c.IsActive)
                .ToListAsync();
            foreach (var cmd in customCommands)
            {
                AddItem(results, overrideMap, "custom", cmd.Id.ToString(), cmd.CommandName, "", cmd.Restriction, applyHiddenFilter);
            }

            // Microcommands
            var microCommands = await _dbContext.MicroGameCommands
                .AsNoTracking()
                .Where(c => c.UserId == channelOwnerId)
                .ToListAsync();
            foreach (var cmd in microCommands)
            {
                AddItem(results, overrideMap, "microcommands", cmd.Id.ToString(), cmd.ShortCommand, cmd.CategoryName, null, applyHiddenFilter);
            }

            // Scripting
            var scripts = await _dbContext.ScriptedCommands
                .AsNoTracking()
                .Where(s => s.UserId == channelOwnerId && s.IsActive)
                .ToListAsync();
            foreach (var script in scripts)
            {
                AddItem(results, overrideMap, "scripting", script.Id.ToString(), script.CommandName, "", null, applyHiddenFilter);
            }

            return results;
        }

        private static void AddItem(
            List<PublicCommandItemResult> results,
            Dictionary<(string Category, string CommandKey), PublicCommandOverride> overrideMap,
            string category, string commandKey, string name, string description, string? restriction,
            bool applyHiddenFilter)
        {
            overrideMap.TryGetValue((category, commandKey), out var over);
            var hidden = over?.Hidden ?? false;

            if (applyHiddenFilter && hidden) return;

            results.Add(new PublicCommandItemResult
            {
                category = category,
                commandKey = commandKey,
                name = name,
                description = description,
                restriction = restriction,
                hidden = hidden,
                publicDescription = over?.PublicDescription,
            });
        }
    }

    public class PublicCommandItemResult
    {
        public string category { get; set; } = "";
        public string commandKey { get; set; } = "";
        public string name { get; set; } = "";
        public string description { get; set; } = "";
        public string? restriction { get; set; }
        public bool hidden { get; set; }
        public string? publicDescription { get; set; }
    }

    public class PublicCommandOverrideDto
    {
        public string Category { get; set; } = "";
        public string CommandKey { get; set; } = "";
        public bool Hidden { get; set; }
        public string? PublicDescription { get; set; }
    }
}
