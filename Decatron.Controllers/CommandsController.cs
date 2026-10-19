using Decatron.Services;
using Decatron.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Decatron.Core.Interfaces;
using System.Security.Claims;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/commands")]
    [Authorize]
    public class CommandsController : ControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly ISettingsService _settingsService;
        private readonly ICommandStateService _commandStateService;
        private readonly IPermissionService _permissionService;
        private readonly ICommandTranslationService _commandTranslationService;
        private readonly ILanguageService _languageService;
        private readonly ILogger<CommandsController> _logger;

        public CommandsController(
            DecatronDbContext dbContext,
            ISettingsService settingsService,
            ICommandStateService commandStateService,
            IPermissionService permissionService,
            ICommandTranslationService commandTranslationService,
            ILanguageService languageService,
            ILogger<CommandsController> logger)
        {
            _dbContext = dbContext;
            _settingsService = settingsService;
            _commandStateService = commandStateService;
            _permissionService = permissionService;
            _commandTranslationService = commandTranslationService;
            _languageService = languageService;
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
            // PRIORIDAD 1: Obtener canal activo desde la sesión (después de switch)
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
            {
                _logger.LogInformation($"[Commands] Using channel from session: {sessionId}");
                return sessionId;
            }

            // PRIORIDAD 2: Usar el claim del JWT si existe
            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
            {
                _logger.LogInformation($"[Commands] Using channel from JWT claim: {channelOwnerId}");
                return channelOwnerId;
            }

            // PRIORIDAD 3: Por defecto, usar el propio canal del usuario
            var userId = GetUserId();
            _logger.LogInformation($"[Commands] Using user's own channel: {userId}");
            return userId;
        }

        /// <summary>
        /// Obtiene el estado de un comando específico
        /// </summary>
        [HttpGet("{commandName}/status")]
        public async Task<IActionResult> GetCommandStatus(string commandName)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();

                // Obtener settings del canal
                var settings = await _settingsService.GetSettingsByUserIdAsync(channelOwnerId);
                if (settings == null)
                {
                    return NotFound(new { success = false, message = "Settings not found" });
                }

                // Obtener estado del comando
                var commandEnabled = await _commandStateService.IsCommandEnabledAsync(channelOwnerId, commandName);               

                return Ok(new
                {
                    success = true,
                    commandName,
                    botEnabled = settings.BotEnabled,                    
                    commandEnabled = commandEnabled,
                    isActive = settings.BotEnabled && commandEnabled
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting status for command {commandName}");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Toggle para activar/desactivar un comando (requiere nivel Moderación o superior)
        /// </summary>
        [HttpPost("{commandName}/toggle")]
        public async Task<IActionResult> ToggleCommand(string commandName, [FromBody] ToggleCommandDto dto)
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();

                // Verificar que tenga nivel de moderación o superior
                if (!await _permissionService.HasPermissionLevelAsync(userId, channelOwnerId, "moderation"))
                {
                    return StatusCode(403, new { success = false, message = "Se requiere nivel de Moderación o superior para activar/desactivar comandos" });
                }

                // Actualizar estado del comando
                await _commandStateService.SetCommandEnabledAsync(channelOwnerId, commandName, dto.Enabled);

                _logger.LogInformation($"Command {commandName} {(dto.Enabled ? "enabled" : "disabled")} for channel {channelOwnerId}");

                return Ok(new
                {
                    success = true,
                    message = $"Comando {commandName} {(dto.Enabled ? "habilitado" : "deshabilitado")}",
                    commandName,
                    enabled = dto.Enabled
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error toggling command {commandName}");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Obtiene todos los comandos por defecto con sus estados
        /// Retorna descripciones traducidas según el idioma del usuario
        /// </summary>
        [HttpGet("default")]
        public async Task<IActionResult> GetDefaultCommands()
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();
                var settings = await _settingsService.GetSettingsByUserIdAsync(channelOwnerId);

                // Obtener idioma preferido del usuario autenticado
                var userLanguage = await _languageService.GetUserLanguageAsync(userId);

                // Si el usuario no tiene idioma guardado, usar español como default
                if (string.IsNullOrEmpty(userLanguage))
                {
                    userLanguage = "es";
                    _logger.LogInformation($"User {userId} has no language preference, using default: es");
                }

                _logger.LogInformation($"Fetching commands for user {userId} in language: {userLanguage}");

                // Obtener metadatos de TODOS los comandos por defecto traducidos
                var allCommandsMetadata = _commandTranslationService.GetAllDefaultCommandsMetadata(userLanguage);

                var commandsWithStatus = new List<object>();

                foreach (var cmdMetadata in allCommandsMetadata)
                {
                    var commandEnabled = await _commandStateService.IsCommandEnabledAsync(channelOwnerId, cmdMetadata.Name);
                    commandsWithStatus.Add(new
                    {
                        name = cmdMetadata.Name,
                        aliases = cmdMetadata.Aliases,
                        description = cmdMetadata.Description,
                        enabled = commandEnabled,
                        isActive = settings.BotEnabled && commandEnabled
                    });
                }

                return Ok(new
                {
                    success = true,
                    botEnabled = settings.BotEnabled,
                    commands = commandsWithStatus
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting default commands");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }
    }

    public class ToggleCommandDto
    {
        public bool Enabled { get; set; }
    }
}
