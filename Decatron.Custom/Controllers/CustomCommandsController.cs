using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Core.Helpers;
using Decatron.Services;
using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Custom.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class CustomCommandsController : ControllerBase
    {
        private readonly DecatronDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IPermissionService _permissionService;
        private readonly ILogger<CustomCommandsController> _logger;

        public CustomCommandsController(
            DecatronDbContext context,
            IConfiguration configuration,
            IPermissionService permissionService,
            ILogger<CustomCommandsController> logger)
        {
            _context = context;
            _configuration = configuration;
            _permissionService = permissionService;
            _logger = logger;
        }

        // Helper para obtener el canal activo del contexto con sistema de prioridades
        private async Task<(long channelOwnerId, string channelName)?> GetActiveChannelContext()
        {
            try
            {
                long channelOwnerId;

                // PRIORIDAD 1: Obtener canal activo desde la sesión (después de switch)
                var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
                if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
                {
                    channelOwnerId = sessionId;
                    _logger.LogInformation($"[CustomCommands] Using channel from session: {channelOwnerId}");
                }
                // PRIORIDAD 2: Usar el claim del JWT si existe
                else
                {
                    var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
                    if (!string.IsNullOrEmpty(channelOwnerIdClaim) && long.TryParse(channelOwnerIdClaim, out var claimId))
                    {
                        channelOwnerId = claimId;
                        _logger.LogInformation($"[CustomCommands] Using channel from JWT claim: {channelOwnerId}");
                    }
                    // PRIORIDAD 3: Por defecto, usar el propio canal del usuario
                    else
                    {
                        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                        if (!long.TryParse(userIdClaim, out var userId))
                        {
                            _logger.LogWarning("No se pudo obtener UserId");
                            return null;
                        }
                        channelOwnerId = userId;
                        _logger.LogInformation($"[CustomCommands] Using user's own channel: {channelOwnerId}");
                    }
                }

                // Obtener el nombre del canal desde la BD
                var channel = await _context.Users
                    .Where(u => u.Id == channelOwnerId && u.IsActive)
                    .Select(u => new { u.Login })
                    .FirstOrDefaultAsync();

                if (channel == null)
                {
                    _logger.LogWarning($"No se encontró canal con ID {channelOwnerId}");
                    return null;
                }

                return (channelOwnerId, channel.Login.ToLower());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo contexto del canal activo");
                return null;
            }
        }

        // GET: api/customcommands
        [HttpGet]
        public async Task<ActionResult<IEnumerable<CustomCommand>>> GetCustomCommands()
        {
            try
            {
                var channelContext = await GetActiveChannelContext();

                if (!channelContext.HasValue)
                {
                    return BadRequest(new { message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;

                var commands = _context.CustomCommands
                    .Where(c => c.ChannelName == channelName)
                    .OrderBy(c => c.CommandName)
                    .ToList();

                _logger.LogInformation($"Cargando {commands.Count} comandos para el canal {channelName} (ID: {channelOwnerId})");

                return Ok(commands);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener comandos personalizados");
                return StatusCode(500, new { message = "Error al obtener los comandos." });
            }
        }

        // GET: api/customcommands/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<CustomCommand>> GetCustomCommand(int id)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();

                if (!channelContext.HasValue)
                {
                    return BadRequest(new { message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;

                var command = await _context.CustomCommands.FindAsync(id);

                if (command == null || command.ChannelName != channelName)
                {
                    return NotFound(new { message = "Comando no encontrado." });
                }

                return Ok(command);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al obtener comando con ID {id}");
                return StatusCode(500, new { message = "Error al obtener el comando." });
            }
        }

        // POST: api/customcommands
        [HttpPost]
        public async Task<ActionResult<CustomCommand>> CreateCustomCommand([FromBody] CreateCommandDto dto)
        {
            try
            {
                // Obtener información del usuario y canal activo
                var username = User.FindFirst(ClaimTypes.Name)?.Value;
                var channelContext = await GetActiveChannelContext();

                if (string.IsNullOrEmpty(username) || !channelContext.HasValue)
                {
                    return BadRequest(new { message = "No se pudo obtener la información del usuario o canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;

                // Obtener UserId del usuario actual
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!long.TryParse(userIdClaim, out var userId))
                {
                    return BadRequest(new { message = "No se pudo obtener el ID del usuario." });
                }

                // Validar permisos usando PermissionService
                var canAccess = await _permissionService.CanAccessAsync(userId, channelOwnerId, "commands");
                if (!canAccess)
                {
                    return StatusCode(403, new { message = "No tienes permisos para crear comandos en este canal." });
                }

                // Validar que el nombre del comando no esté vacío
                if (string.IsNullOrWhiteSpace(dto.CommandName))
                {
                    return BadRequest(new { message = "El nombre del comando no puede estar vacío." });
                }

                // Limpiar el nombre del comando (trim y lowercase)
                var commandName = dto.CommandName.Trim().ToLower();

                // Validar que la respuesta no esté vacía
                if (string.IsNullOrWhiteSpace(dto.Response))
                {
                    return BadRequest(new { message = "La respuesta del comando no puede estar vacía." });
                }

                // Validar que NO sea un script (detectar keywords)
                if (IsScriptContent(dto.Response))
                {
                    return BadRequest(new
                    {
                        message = "Este comando parece contener scripting. Por favor, usa la sección de 'Comandos con Scripting' para crear comandos con scripts."
                    });
                }

                // Verificar si el comando ya existe EN EL CANAL ACTIVO
                var exists = await UtilsCrear.CommandExists(_context, commandName, channelName);
                if (exists)
                {
                    return Conflict(new
                    {
                        message = $"El comando '{commandName}' ya existe en el canal {channelName}. Usa la opción de editar para modificarlo."
                    });
                }

                // Validar restricción
                var validRestrictions = new[] { "all", "mod", "vip", "sub" };
                var restriction = validRestrictions.Contains(dto.Restriction?.ToLower())
                    ? dto.Restriction.ToLower()
                    : "all";

                // Crear el comando para el CANAL ACTIVO
                var command = new CustomCommand
                {
                    CommandName = commandName,
                    Response = dto.Response.Trim(),
                    Restriction = restriction,
                    IsActive = dto.IsActive,
                    ChannelName = channelName,
                    CreatedBy = username,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    IsScripted = false,
                    ScriptContent = null
                };

                // Crear el comando
                var success = await UtilsCrear.CreateCustomCommand(_context, command);

                if (success)
                {
                    _logger.LogInformation($"Comando '{command.CommandName}' creado por {username} en el canal {channelName} (ID: {channelOwnerId})");
                    return CreatedAtAction(nameof(GetCustomCommand), new { id = command.Id }, command);
                }
                else
                {
                    return StatusCode(500, new { message = "No se pudo crear el comando." });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear comando personalizado");
                return StatusCode(500, new { message = "Error al crear el comando: " + ex.Message });
            }
        }

        // PUT: api/customcommands/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateCustomCommand(int id, [FromBody] UpdateCommandDto dto)
        {
            try
            {
                // Obtener información del usuario y canal activo
                var username = User.FindFirst(ClaimTypes.Name)?.Value;
                var channelContext = await GetActiveChannelContext();

                if (string.IsNullOrEmpty(username) || !channelContext.HasValue)
                {
                    return BadRequest(new { message = "No se pudo obtener la información del usuario o canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;

                // Obtener UserId del usuario actual
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!long.TryParse(userIdClaim, out var userId))
                {
                    return BadRequest(new { message = "No se pudo obtener el ID del usuario." });
                }

                // Validar permisos usando PermissionService
                var canAccess = await _permissionService.CanAccessAsync(userId, channelOwnerId, "commands");
                if (!canAccess)
                {
                    return StatusCode(403, new { message = "No tienes permisos para editar comandos en este canal." });
                }

                // Obtener el comando existente
                var existingCommand = await _context.CustomCommands.FindAsync(id);

                if (existingCommand == null || existingCommand.ChannelName != channelName)
                {
                    return NotFound(new { message = "Comando no encontrado en el canal activo." });
                }

                // Validar que la respuesta no esté vacía
                if (string.IsNullOrWhiteSpace(dto.Response))
                {
                    return BadRequest(new { message = "La respuesta del comando no puede estar vacía." });
                }

                // Validar que NO sea un script
                if (IsScriptContent(dto.Response))
                {
                    return BadRequest(new
                    {
                        message = "Este comando parece contener scripting. Por favor, usa la sección de 'Comandos con Scripting'."
                    });
                }

                // Validar restricción
                var validRestrictions = new[] { "all", "mod", "vip", "sub" };
                var restriction = validRestrictions.Contains(dto.Restriction?.ToLower())
                    ? dto.Restriction.ToLower()
                    : "all";

                // Actualizar solo los campos permitidos
                existingCommand.Response = dto.Response.Trim();
                existingCommand.Restriction = restriction;
                existingCommand.IsActive = dto.IsActive;
                existingCommand.UpdatedAt = DateTime.UtcNow;

                var success = await UtilsCrear.UpdateCustomCommand(_context, existingCommand);

                if (success)
                {
                    _logger.LogInformation($"Comando '{existingCommand.CommandName}' actualizado por {username} en canal {channelName}");
                    return Ok(existingCommand);
                }
                else
                {
                    return StatusCode(500, new { message = "No se pudo actualizar el comando." });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al actualizar comando con ID {id}");
                return StatusCode(500, new { message = "Error al actualizar el comando: " + ex.Message });
            }
        }

        // DELETE: api/customcommands/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCustomCommand(int id)
        {
            try
            {
                // Obtener información del usuario y canal activo
                var username = User.FindFirst(ClaimTypes.Name)?.Value;
                var channelContext = await GetActiveChannelContext();

                if (string.IsNullOrEmpty(username) || !channelContext.HasValue)
                {
                    return BadRequest(new { message = "No se pudo obtener la información del usuario o canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;

                // Obtener UserId del usuario actual
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!long.TryParse(userIdClaim, out var userId))
                {
                    return BadRequest(new { message = "No se pudo obtener el ID del usuario." });
                }

                // REQUERIMIENTO: Solo moderación o superior puede eliminar
                var hasModeration = await _permissionService.HasPermissionLevelAsync(userId, channelOwnerId, "moderation");
                if (!hasModeration)
                {
                    _logger.LogWarning($"[CustomCommands] User {userId} denied delete: requires moderation level for channel {channelOwnerId}");
                    return StatusCode(403, new { message = "Se requiere nivel de Moderación o superior para eliminar comandos personalizados." });
                }

                // Obtener el comando
                var command = await _context.CustomCommands.FindAsync(id);

                if (command == null || command.ChannelName != channelName)
                {
                    return NotFound(new { message = "Comando no encontrado en el canal activo." });
                }

                var success = await UtilsCrear.DeleteCustomCommand(_context, command.CommandName, channelName);

                if (success)
                {
                    _logger.LogInformation($"Comando '{command.CommandName}' eliminado por {username} del canal {channelName}");
                    return Ok(new { message = "Comando eliminado correctamente." });
                }
                else
                {
                    return StatusCode(500, new { message = "No se pudo eliminar el comando." });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al eliminar comando con ID {id}");
                return StatusCode(500, new { message = "Error al eliminar el comando: " + ex.Message });
            }
        }

        // Método privado para detectar si el contenido es un script
        private bool IsScriptContent(string content)
        {
            if (string.IsNullOrWhiteSpace(content))
                return false;

            var scriptKeywords = new[] {
                "set ", "when ", "then", "else", "end",
                "send ", "roll(", "pick(", "count("
            };

            var contentLower = content.ToLower();
            return scriptKeywords.Any(keyword => contentLower.Contains(keyword));
        }
    }

    // DTOs para evitar validación prematura de CustomCommand
    public class CreateCommandDto
    {
        public string CommandName { get; set; } = "";
        public string Response { get; set; } = "";
        public string Restriction { get; set; } = "all";
        public bool IsActive { get; set; } = true;
    }

    public class UpdateCommandDto
    {
        public string Response { get; set; } = "";
        public string Restriction { get; set; } = "all";
        public bool IsActive { get; set; } = true;
    }
}