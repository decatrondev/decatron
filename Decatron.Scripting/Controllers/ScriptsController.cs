using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Core.Interfaces;
using Decatron.Scripting.Services;
using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using Decatron.Services;

namespace Decatron.Scripting.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class ScriptsController : ControllerBase
    {
        private readonly DecatronDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IPermissionService _permissionService;
        private readonly ScriptingService _scriptingService;
        private readonly ILogger<ScriptsController> _logger;

        public ScriptsController(
            DecatronDbContext context,
            IConfiguration configuration,
            IPermissionService permissionService,
            ScriptingService scriptingService,
            ILogger<ScriptsController> logger)
        {
            _context = context;
            _configuration = configuration;
            _permissionService = permissionService;
            _scriptingService = scriptingService;
            _logger = logger;
        }

        // Helper para obtener el canal activo del contexto
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
                    _logger.LogInformation($"[Scripts] Using channel from session: {channelOwnerId}");
                }
                // PRIORIDAD 2: Usar el claim del JWT si existe
                else
                {
                    var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
                    if (!string.IsNullOrEmpty(channelOwnerIdClaim) && long.TryParse(channelOwnerIdClaim, out var claimId))
                    {
                        channelOwnerId = claimId;
                        _logger.LogInformation($"[Scripts] Using channel from JWT claim: {channelOwnerId}");
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
                        _logger.LogInformation($"[Scripts] Using user's own channel: {channelOwnerId}");
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

        // GET: api/scripts
        [HttpGet]
        public async Task<ActionResult> GetScripts()
        {
            try
            {
                var channelContext = await GetActiveChannelContext();

                if (!channelContext.HasValue)
                {
                    return BadRequest(new { message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;

                var scripts = await _context.ScriptedCommands
                    .Where(c => c.ChannelName == channelName)
                    .OrderBy(c => c.CommandName)
                    .Select(c => new
                    {
                        c.Id,
                        c.CommandName,
                        c.ScriptContent,
                        c.IsActive,
                        c.CreatedAt,
                        c.UpdatedAt
                    })
                    .ToListAsync();

                _logger.LogInformation($"Cargando {scripts.Count} scripts para el canal {channelName} (ID: {channelOwnerId})");

                return Ok(scripts);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener scripts");
                return StatusCode(500, new { message = "Error al obtener los scripts." });
            }
        }

        // GET: api/scripts/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult> GetScript(long id)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();

                if (!channelContext.HasValue)
                {
                    return BadRequest(new { message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;

                var script = await _context.ScriptedCommands
                    .Where(c => c.Id == id && c.ChannelName == channelName)
                    .FirstOrDefaultAsync();

                if (script == null)
                {
                    return NotFound(new { message = "Script no encontrado." });
                }

                return Ok(new
                {
                    script.Id,
                    script.CommandName,
                    script.ScriptContent,
                    script.IsActive,
                    script.CreatedAt,
                    script.UpdatedAt
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al obtener script con ID {id}");
                return StatusCode(500, new { message = "Error al obtener el script." });
            }
        }

        // POST: api/scripts/validate
        [HttpPost("validate")]
        public async Task<ActionResult> ValidateScript([FromBody] ValidateScriptDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto.ScriptContent))
                {
                    return BadRequest(new { message = "El contenido del script no puede estar vacío." });
                }

                var result = await _scriptingService.ValidateScriptAsync(dto.ScriptContent);

                // Estructura de respuesta que el frontend espera: res.data.data
                return Ok(new
                {
                    success = result.IsValid,
                    data = new
                    {
                        isValid = result.IsValid,
                        errorMessage = result.ErrorMessage,
                        errorLine = result.ErrorLine
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al validar script");
                return StatusCode(500, new { message = "Error al validar el script" });
            }
        }

        // POST: api/scripts/preview
        [HttpPost("preview")]
        public async Task<ActionResult> PreviewScript([FromBody] PreviewScriptDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto.ScriptContent))
                {
                    return BadRequest(new { message = "El contenido del script no puede estar vacío." });
                }

                _logger.LogInformation("Ejecutando preview de script: {Script}", dto.ScriptContent.Substring(0, Math.Min(100, dto.ScriptContent.Length)));

                // Ejecutar el script con el servicio
                var result = await _scriptingService.ExecuteScriptPreviewAsync(
                    dto.ScriptContent,
                    dto.CommandName ?? "test"
                );

                // Estructura de respuesta que el frontend espera: res.data.data
                return Ok(new
                {
                    success = result.Success,
                    data = new
                    {
                        success = result.Success,
                        output = result.Success
                            ? string.Join("\n", result.OutputMessages)
                            : (result.ErrorMessage ?? "Error al ejecutar el script"),
                        errorLine = result.ErrorLine
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al ejecutar preview del script");
                return StatusCode(500, new { message = "Error al ejecutar la simulación" });
            }
        }

        // POST: api/scripts
        [HttpPost]
        public async Task<ActionResult> CreateScript([FromBody] CreateScriptDto dto)
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
                    return StatusCode(403, new { message = "No tienes permisos para crear scripts en este canal." });
                }

                // Validar que el nombre del comando no esté vacío
                if (string.IsNullOrWhiteSpace(dto.CommandName))
                {
                    return BadRequest(new { message = "El nombre del comando no puede estar vacío." });
                }

                // Limpiar el nombre del comando (trim y lowercase)
                var commandName = dto.CommandName.Trim().ToLower();

                // Validar que el contenido del script no esté vacío
                if (string.IsNullOrWhiteSpace(dto.ScriptContent))
                {
                    return BadRequest(new { message = "El contenido del script no puede estar vacío." });
                }

                // Validar sintaxis del script
                var validationResult = await _scriptingService.ValidateScriptAsync(dto.ScriptContent);
                if (!validationResult.IsValid)
                {
                    return BadRequest(new
                    {
                        message = $"Error de sintaxis en línea {validationResult.ErrorLine}: {validationResult.ErrorMessage}"
                    });
                }

                // Verificar si el comando ya existe
                var exists = await _context.ScriptedCommands
                    .AnyAsync(c => c.ChannelName == channelName && c.CommandName == commandName);

                if (exists)
                {
                    return Conflict(new
                    {
                        message = $"El comando '{commandName}' ya existe en el canal {channelName}. Usa la opción de editar para modificarlo."
                    });
                }

                // Crear el script usando el servicio
                var success = await _scriptingService.CreateScriptedCommandAsync(
                    channelName,
                    commandName,
                    dto.ScriptContent,
                    userId
                );

                if (success)
                {
                    // Obtener el script recién creado para devolverlo
                    var createdScript = await _context.ScriptedCommands
                        .Where(c => c.ChannelName == channelName && c.CommandName == commandName)
                        .FirstOrDefaultAsync();

                    if (createdScript == null)
                    {
                        return StatusCode(500, new { message = "Script creado pero no se pudo recuperar" });
                    }

                    _logger.LogInformation($"Script '{commandName}' creado por {username} en el canal {channelName} (ID: {channelOwnerId})");

                    return CreatedAtAction(nameof(GetScript), new { id = createdScript.Id }, new
                    {
                        createdScript.Id,
                        createdScript.CommandName,
                        createdScript.ScriptContent,
                        createdScript.IsActive,
                        createdScript.CreatedAt,
                        createdScript.UpdatedAt
                    });
                }
                else
                {
                    return StatusCode(500, new { message = "No se pudo crear el script." });
                }
            }
            catch (ScriptingServiceException ex)
            {
                _logger.LogWarning(ex, "Error de scripting al crear comando");
                return BadRequest(new { message = "An internal error occurred. Please try again later." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear script");
                return StatusCode(500, new { message = "Error al crear el script" });
            }
        }

        // PUT: api/scripts/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateScript(long id, [FromBody] UpdateScriptDto dto)
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
                    return StatusCode(403, new { message = "No tienes permisos para editar scripts en este canal." });
                }

                // Obtener el script existente
                var existingScript = await _context.ScriptedCommands
                    .Where(c => c.Id == id && c.ChannelName == channelName)
                    .FirstOrDefaultAsync();

                if (existingScript == null)
                {
                    return NotFound(new { message = "Script no encontrado en el canal activo." });
                }

                // Validar que el contenido del script no esté vacío
                if (string.IsNullOrWhiteSpace(dto.ScriptContent))
                {
                    return BadRequest(new { message = "El contenido del script no puede estar vacío." });
                }

                // Validar sintaxis del script
                var validationResult = await _scriptingService.ValidateScriptAsync(dto.ScriptContent);
                if (!validationResult.IsValid)
                {
                    return BadRequest(new
                    {
                        message = $"Error de sintaxis en línea {validationResult.ErrorLine}: {validationResult.ErrorMessage}"
                    });
                }

                // Actualizar solo los campos permitidos
                existingScript.ScriptContent = dto.ScriptContent.Trim();
                existingScript.IsActive = dto.IsActive;
                existingScript.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                _logger.LogInformation($"Script '{existingScript.CommandName}' actualizado por {username} en canal {channelName}");

                return Ok(new
                {
                    existingScript.Id,
                    existingScript.CommandName,
                    existingScript.ScriptContent,
                    existingScript.IsActive,
                    existingScript.CreatedAt,
                    existingScript.UpdatedAt
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al actualizar script con ID {id}");
                return StatusCode(500, new { message = "Error al actualizar el script" });
            }
        }

        // DELETE: api/scripts/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteScript(long id)
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
                    _logger.LogWarning($"[Scripts] User {userId} denied delete: requires moderation level for channel {channelOwnerId}");
                    return StatusCode(403, new { message = "Se requiere nivel de Moderación o superior para eliminar scripts." });
                }

                // Obtener el script
                var script = await _context.ScriptedCommands
                    .Where(c => c.Id == id && c.ChannelName == channelName)
                    .FirstOrDefaultAsync();

                if (script == null)
                {
                    return NotFound(new { message = "Script no encontrado en el canal activo." });
                }

                _context.ScriptedCommands.Remove(script);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"Script '{script.CommandName}' eliminado por {username} del canal {channelName}");
                return Ok(new { message = "Script eliminado correctamente." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al eliminar script con ID {id}");
                return StatusCode(500, new { message = "Error al eliminar el script" });
            }
        }
    }

    // DTOs
    public class CreateScriptDto
    {
        public string CommandName { get; set; } = "";
        public string ScriptContent { get; set; } = "";
    }

    public class UpdateScriptDto
    {
        public string ScriptContent { get; set; } = "";
        public bool IsActive { get; set; } = true;
    }

    public class ValidateScriptDto
    {
        public string ScriptContent { get; set; } = "";
    }

    public class PreviewScriptDto
    {
        public string ScriptContent { get; set; } = "";
        public string? CommandName { get; set; }
    }
}
