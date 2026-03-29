using Decatron.Core.Helpers;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Attributes;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Security.Claims;

namespace Decatron.Default.Controllers
{
    [ApiController]
    [Route("api/commands/microcommands")]
    [Authorize]
    public class MicroCommandsController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<MicroCommandsController> _logger;
        private readonly DecatronDbContext _dbContext;
        private readonly IPermissionService _permissionService;
        private readonly CommandService _commandService;
        private readonly GameSearchService _gameSearchService;

        public MicroCommandsController(
            IConfiguration configuration,
            ILogger<MicroCommandsController> logger,
            DecatronDbContext dbContext,
            IPermissionService permissionService,
            CommandService commandService,
            GameSearchService gameSearchService)
        {
            _configuration = configuration;
            _logger = logger;
            _dbContext = dbContext;
            _permissionService = permissionService;
            _commandService = commandService;
            _gameSearchService = gameSearchService;
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
                _logger.LogInformation($"[MicroCommands] Using channel from session: {sessionId}");
                return sessionId;
            }

            // PRIORIDAD 2: Usar el claim del JWT si existe
            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
            {
                _logger.LogInformation($"[MicroCommands] Using channel from JWT claim: {channelOwnerId}");
                return channelOwnerId;
            }

            // PRIORIDAD 3: Por defecto, usar el propio canal del usuario
            var userId = GetUserId();
            _logger.LogInformation($"[MicroCommands] Using user's own channel: {userId}");
            return userId;
        }

        private string GetChannelLogin()
        {
            return User.FindFirst(ClaimTypes.Name)?.Value ?? "";
        }

        [HttpGet]
        [RequirePermission("commands")]
        public async Task<IActionResult> GetMicroCommands()
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();

                if (!await _permissionService.CanAccessAsync(userId, channelOwnerId, "commands"))
                {
                    return StatusCode(403, new { success = false, message = "No tienes permisos para ver micro comandos" });
                }

                var channelOwner = await _dbContext.Users
                    .Where(u => u.Id == channelOwnerId && u.IsActive)
                    .FirstOrDefaultAsync();

                if (channelOwner == null)
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var microCommands = await _dbContext.MicroGameCommands
                    .Where(mc => mc.ChannelName == channelOwner.Login)
                    .OrderBy(mc => mc.ShortCommand)
                    .Select(mc => new
                    {
                        mc.Id,
                        mc.ShortCommand,
                        mc.CategoryName,
                        mc.CreatedBy,
                        mc.CreatedAt,
                        mc.UpdatedAt
                    })
                    .ToListAsync();

                var userAccessLevel = await _permissionService.GetUserAccessLevelAsync(userId, channelOwnerId);

                return Ok(new
                {
                    success = true,
                    microCommands = microCommands,
                    total = microCommands.Count,
                    channel = channelOwner.Login,
                    userAccessLevel = userAccessLevel,
                    canEdit = await _permissionService.CanAccessAsync(userId, channelOwnerId, "commands")
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo micro comandos");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        // SOLO LOS MÉTODOS CORREGIDOS - Reemplazar en tu MicroCommandsController

        [HttpPost]
        [RequirePermission("commands")]
        public async Task<IActionResult> CreateMicroCommand([FromBody] CreateMicroCommandRequest request)
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();

                if (!await _permissionService.CanAccessAsync(userId, channelOwnerId, "commands"))
                {
                    return StatusCode(403, new { success = false, message = "No tienes permisos para crear micro comandos" });
                }

                var channelOwner = await _dbContext.Users
                    .Where(u => u.Id == channelOwnerId && u.IsActive)
                    .FirstOrDefaultAsync();

                if (channelOwner == null)
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                // CORREGIDO: Obtener el usuario que realmente está ejecutando la acción
                var executingUser = await _dbContext.Users
                    .Where(u => u.Id == userId && u.IsActive)
                    .FirstOrDefaultAsync();

                if (executingUser == null)
                {
                    return NotFound(new { success = false, message = "Usuario ejecutor no encontrado" });
                }

                if (string.IsNullOrWhiteSpace(request.Command) || string.IsNullOrWhiteSpace(request.Category))
                {
                    return BadRequest(new { success = false, message = "Comando y categoría son requeridos" });
                }

                var command = request.Command.Trim();
                var category = request.Category.Trim();

                if (!command.StartsWith("!"))
                {
                    command = "!" + command;
                }

                if (!System.Text.RegularExpressions.Regex.IsMatch(command, @"^![a-zA-Z0-9]+$"))
                {
                    return BadRequest(new { success = false, message = "El comando solo puede contener letras y números después del !" });
                }

                var reservedWords = new[] { "!g", "!game", "!set", "!remove", "!delete", "!list", "!help", "!title", "!t" };
                if (reservedWords.Contains(command.ToLower()))
                {
                    return BadRequest(new { success = false, message = $"'{command}' es una palabra reservada" });
                }

                var existingCommand = await _dbContext.MicroGameCommands
                    .FirstOrDefaultAsync(mc => mc.ChannelName == channelOwner.Login && mc.ShortCommand == command);

                var wasUpdate = existingCommand != null;

                if (existingCommand != null)
                {
                    existingCommand.CategoryName = category;
                    existingCommand.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    var newCommand = new MicroGameCommands
                    {
                        ChannelName = channelOwner.Login,
                        ShortCommand = command,
                        CategoryName = category,
                        CreatedBy = executingUser.Login, // CORREGIDO: Usar el usuario real
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    _dbContext.MicroGameCommands.Add(newCommand);
                }

                await _dbContext.SaveChangesAsync();
                await _commandService.RefreshMicroCommandsForChannelAsync(channelOwner.Login);

                // Incrementar contador de uso del juego en cache
                await _gameSearchService.IncrementUsageCountAsync(category);

                _logger.LogInformation($"Micro comando {(wasUpdate ? "actualizado" : "creado")}: {command} -> {category} por usuario {executingUser.Login} en canal {channelOwner.Login}");

                return Ok(new
                {
                    success = true,
                    message = wasUpdate
                        ? $"Micro comando {command} actualizado correctamente"
                        : $"Micro comando {command} creado correctamente",
                    command = command,
                    category = category,
                    wasUpdate = wasUpdate
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creando/actualizando micro comando");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpPut("{id}")]
        [RequirePermission("commands")]
        public async Task<IActionResult> UpdateMicroCommand(long id, [FromBody] UpdateMicroCommandRequest request)
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();

                if (!await _permissionService.CanAccessAsync(userId, channelOwnerId, "commands"))
                {
                    return StatusCode(403, new { success = false, message = "No tienes permisos para modificar micro comandos" });
                }

                var channelOwner = await _dbContext.Users
                    .Where(u => u.Id == channelOwnerId && u.IsActive)
                    .FirstOrDefaultAsync();

                if (channelOwner == null)
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var microCommand = await _dbContext.MicroGameCommands
                    .FirstOrDefaultAsync(mc => mc.Id == id && mc.ChannelName == channelOwner.Login);

                if (microCommand == null)
                {
                    return NotFound(new { success = false, message = "Micro comando no encontrado" });
                }

                if (string.IsNullOrWhiteSpace(request.Category))
                {
                    return BadRequest(new { success = false, message = "La categoría es requerida" });
                }

                microCommand.CategoryName = request.Category.Trim();
                microCommand.UpdatedAt = DateTime.UtcNow;

                await _dbContext.SaveChangesAsync();

                // IMPORTANTE: Refrescar cache de micro comandos
                await _commandService.RefreshMicroCommandsForChannelAsync(channelOwner.Login);

                _logger.LogInformation($"Micro comando actualizado: {microCommand.ShortCommand} -> {microCommand.CategoryName} por usuario {userId} en canal {channelOwner.Login}");

                return Ok(new
                {
                    success = true,
                    message = $"Micro comando {microCommand.ShortCommand} actualizado correctamente"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error actualizando micro comando {id}");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpDelete("{id}")]
        [RequirePermission("commands")]
        public async Task<IActionResult> DeleteMicroCommand(long id)
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();

                // REQUERIMIENTO: Solo moderación o superior puede eliminar
                if (!await _permissionService.HasPermissionLevelAsync(userId, channelOwnerId, "moderation"))
                {
                    _logger.LogWarning($"[MicroCommands] User {userId} denied delete: requires moderation level for channel {channelOwnerId}");
                    return StatusCode(403, new { success = false, message = "Se requiere nivel de Moderación o superior para eliminar micro comandos" });
                }

                var channelOwner = await _dbContext.Users
                    .Where(u => u.Id == channelOwnerId && u.IsActive)
                    .FirstOrDefaultAsync();

                if (channelOwner == null)
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var microCommand = await _dbContext.MicroGameCommands
                    .FirstOrDefaultAsync(mc => mc.Id == id && mc.ChannelName == channelOwner.Login);

                if (microCommand == null)
                {
                    return NotFound(new { success = false, message = "Micro comando no encontrado" });
                }

                var commandName = microCommand.ShortCommand;

                _dbContext.MicroGameCommands.Remove(microCommand);
                await _dbContext.SaveChangesAsync();

                // IMPORTANTE: Refrescar cache de micro comandos
                await _commandService.RefreshMicroCommandsForChannelAsync(channelOwner.Login);

                _logger.LogInformation($"[MicroCommands] User {userId} deleted micro command '{commandName}' from channel {channelOwner.Login}");

                return Ok(new
                {
                    success = true,
                    message = $"Micro comando {commandName} eliminado correctamente"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error eliminando micro comando {id}");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        // Resto de métodos sin cambios...
        [HttpGet("search/{command}")]
        [RequirePermission("commands")]
        public async Task<IActionResult> SearchMicroCommand(string command)
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();

                if (!await _permissionService.CanAccessAsync(userId, channelOwnerId, "commands"))
                {
                    return StatusCode(403, new { success = false, message = "No tienes permisos para buscar micro comandos" });
                }

                var channelOwner = await _dbContext.Users
                    .Where(u => u.Id == channelOwnerId && u.IsActive)
                    .FirstOrDefaultAsync();

                if (channelOwner == null)
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                if (!command.StartsWith("!"))
                {
                    command = "!" + command;
                }

                var microCommand = await _dbContext.MicroGameCommands
                    .FirstOrDefaultAsync(mc => mc.ChannelName == channelOwner.Login && mc.ShortCommand == command);

                if (microCommand == null)
                {
                    return NotFound(new { success = false, message = "Micro comando no encontrado" });
                }

                return Ok(new
                {
                    success = true,
                    microCommand = new
                    {
                        microCommand.Id,
                        microCommand.ShortCommand,
                        microCommand.CategoryName,
                        microCommand.CreatedBy,
                        microCommand.CreatedAt,
                        microCommand.UpdatedAt
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error buscando micro comando {command}");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpGet("check-availability/{command}")]
        [RequirePermission("commands")]
        public IActionResult CheckCommandAvailability(string command)
        {
            try
            {
                if (!command.StartsWith("!"))
                {
                    command = "!" + command;
                }

                var reservedWords = new[] { "!g", "!game", "!set", "!remove", "!delete", "!list", "!help", "!title", "!t" };
                var isReserved = reservedWords.Contains(command.ToLower());

                var isValidFormat = System.Text.RegularExpressions.Regex.IsMatch(command, @"^![a-zA-Z0-9]+$");

                return Ok(new
                {
                    success = true,
                    command = command,
                    isAvailable = !isReserved && isValidFormat,
                    isReserved = isReserved,
                    isValidFormat = isValidFormat
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando disponibilidad del comando {command}");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpGet("status")]
        [RequirePermission("commands")]
        public async Task<IActionResult> GetMicroCommandsStatus()
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();

                var channelOwner = await _dbContext.Users
                    .Where(u => u.Id == channelOwnerId && u.IsActive)
                    .FirstOrDefaultAsync();

                if (channelOwner == null)
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var userAccessLevel = await _permissionService.GetUserAccessLevelAsync(userId, channelOwnerId);
                var canManage = await _permissionService.CanAccessAsync(userId, channelOwnerId, "commands");

                return Ok(new
                {
                    success = true,
                    channel = channelOwner.Login,
                    userAccessLevel = userAccessLevel,
                    canManage = canManage,
                    isOwner = userId == channelOwnerId
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo estado de micro comandos");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Busca juegos/categorías de Twitch para autocomplete
        /// Usa sistema híbrido: aliases -> cache local -> Twitch API
        /// </summary>
        [HttpGet("search-games")]
        [RequirePermission("commands")]
        public async Task<IActionResult> SearchGames([FromQuery] string q, [FromQuery] int limit = 10)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
                {
                    return Ok(new
                    {
                        success = true,
                        games = new List<object>(),
                        message = "Query debe tener al menos 2 caracteres"
                    });
                }

                var games = await _gameSearchService.SearchGamesAsync(q, limit);

                return Ok(new
                {
                    success = true,
                    games = games.Select(g => new
                    {
                        id = g.Id,
                        name = g.Name,
                        boxArtUrl = g.BoxArtUrl,
                        source = g.Source
                    }),
                    query = q,
                    total = games.Count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error searching games for query: {q}");
                return StatusCode(500, new { success = false, message = "Error buscando juegos" });
            }
        }
    }

    public class CreateMicroCommandRequest
    {
        public string Command { get; set; } = "";
        public string Category { get; set; } = "";
    }

    public class UpdateMicroCommandRequest
    {
        public string Category { get; set; } = "";
    }
}