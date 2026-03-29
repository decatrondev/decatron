using System.Data;
using System.Security.Claims;
using Decatron.Attributes;
using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Default.Helpers;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Default.Controllers
{
    [ApiController]
    [Route("api/commands/title")]
    [Authorize]
    public class TitleCommandController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<TitleCommandController> _logger;
        private readonly DecatronDbContext _dbContext;
        private readonly ICommandStateService _commandStateService;
        private readonly IPermissionService _permissionService;

        public TitleCommandController(
            IConfiguration configuration,
            ILogger<TitleCommandController> logger,
            DecatronDbContext dbContext,
            ICommandStateService commandStateService,
            IPermissionService permissionService)
        {
            _configuration = configuration;
            _logger = logger;
            _dbContext = dbContext;
            _commandStateService = commandStateService;
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
                _logger.LogInformation($"[Title] Using channel from session: {sessionId}");
                return sessionId;
            }

            // PRIORIDAD 2: Usar el claim del JWT si existe
            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
            {
                _logger.LogInformation($"[Title] Using channel from JWT claim: {channelOwnerId}");
                return channelOwnerId;
            }

            // PRIORIDAD 3: Por defecto, usar el propio canal del usuario
            var userId = GetUserId();
            _logger.LogInformation($"[Title] Using user's own channel: {userId}");
            return userId;
        }

        /// <summary>
        /// Obtiene el título actual del stream
        /// </summary>
        [HttpGet("current")]
        [RequirePermission("commands")]
        public async Task<IActionResult> GetCurrentTitle()
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();

                // Verificar permisos
                if (!await _permissionService.CanAccessAsync(userId, channelOwnerId, "commands"))
                {
                    return StatusCode(403, new { success = false, message = "No tienes permisos para acceder a esta función" });
                }

                var channelOwner = await _dbContext.Users
                    .Where(u => u.Id == channelOwnerId && u.IsActive)
                    .FirstOrDefaultAsync();

                if (channelOwner == null)
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var currentTitle = await TitleUtils.GetCurrentTitleAsync(_configuration, channelOwner.TwitchId, channelOwner.AccessToken);

                return Ok(new
                {
                    success = true,
                    currentTitle = currentTitle ?? "Sin título",
                    channel = channelOwner.Login,
                    hasEditPermission = await _permissionService.CanAccessAsync(userId, channelOwnerId, "commands")
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo título actual");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Cambia el título del stream
        /// </summary>
        [HttpPost("update")]
        [RequirePermission("commands")]
        public async Task<IActionResult> UpdateTitle([FromBody] UpdateTitleRequest request)
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();

                // Verificar permisos para modificar
                if (!await _permissionService.CanAccessAsync(userId, channelOwnerId, "commands"))
                {
                    return StatusCode(403, new { success = false, message = "No tienes permisos para cambiar el título" });
                }

                var channelOwner = await _dbContext.Users
                    .Where(u => u.Id == channelOwnerId && u.IsActive)
                    .FirstOrDefaultAsync();

                if (channelOwner == null)
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                // Validar el título
                var (isValid, errorMessage) = TitleUtils.ValidateTitle(request.Title);
                if (!isValid)
                {
                    return BadRequest(new { success = false, message = errorMessage });
                }

                // Actualizar título
                var success = await TitleUtils.UpdateTitleAsync(_configuration, channelOwner.TwitchId, request.Title, channelOwner.AccessToken);

                if (success)
                {
                    // Guardar en historial
                    await TitleUtils.SaveTitleToHistoryAsync(_configuration, channelOwner.Login, request.Title, channelOwner.Login);

                    _logger.LogInformation($"Título actualizado por usuario {userId} en canal {channelOwner.Login}: {request.Title}");

                    return Ok(new
                    {
                        success = true,
                        message = "Título actualizado correctamente",
                        newTitle = request.Title
                    });
                }
                else
                {
                    return BadRequest(new { success = false, message = "Error al actualizar el título en Twitch" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error actualizando título");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Obtiene el historial de cambios de título
        /// </summary>
        [HttpGet("history")]
        [RequirePermission("commands")]
        public async Task<IActionResult> GetTitleHistory([FromQuery] int page = 1, [FromQuery] int limit = 10)
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();

                // Verificar permisos
                if (!await _permissionService.CanAccessAsync(userId, channelOwnerId, "commands"))
                {
                    return StatusCode(403, new { success = false, message = "No tienes permisos para ver el historial" });
                }

                var channelOwner = await _dbContext.Users
                    .Where(u => u.Id == channelOwnerId && u.IsActive)
                    .FirstOrDefaultAsync();

                if (channelOwner == null)
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var history = await GetTitleHistoryFromDatabase(channelOwner.Login, page, limit);

                return Ok(new
                {
                    success = true,
                    history = history,
                    page = page,
                    limit = limit,
                    channel = channelOwner.Login
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo historial de títulos");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Activa o desactiva el comando !title (solo control total)
        /// </summary>
        [HttpPost("toggle")]
        [RequirePermission("commands", "control_total")]
        public async Task<IActionResult> ToggleCommand([FromBody] ToggleCommandRequest request)
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();

                // Verificar que tenga control total
                if (!await _permissionService.HasPermissionLevelAsync(userId, channelOwnerId, "control_total"))
                {
                    return StatusCode(403, new { success = false, message = "Solo los usuarios con control total pueden activar/desactivar comandos" });
                }

                await _commandStateService.SetCommandEnabledAsync(channelOwnerId, "title", request.Enabled);

                _logger.LogInformation($"Usuario {userId} cambió estado del comando title a: {request.Enabled} para canal {channelOwnerId}");

                return Ok(new
                {
                    success = true,
                    message = $"Comando title {(request.Enabled ? "habilitado" : "deshabilitado")} correctamente",
                    enabled = request.Enabled
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cambiando estado del comando title");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Verifica si el comando !title está habilitado
        /// </summary>
        [HttpGet("status")]
        [RequirePermission("commands")]
        public async Task<IActionResult> GetCommandStatus()
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

                var isBotEnabled = await Utils.IsBotEnabledForChannelAsync(_configuration, channelOwner.Login);
                var isCommandEnabled = await _commandStateService.IsCommandEnabledAsync(channelOwnerId, "title");
                var userAccessLevel = await _permissionService.GetUserAccessLevelAsync(userId, channelOwnerId);
                var canToggle = await _permissionService.HasPermissionLevelAsync(userId, channelOwnerId, "control_total");

                return Ok(new
                {
                    success = true,
                    botEnabled = isBotEnabled,
                    commandEnabled = isCommandEnabled,
                    channel = channelOwner.Login,
                    userAccessLevel = userAccessLevel,
                    canToggle = canToggle,
                    canEdit = await _permissionService.CanAccessAsync(userId, channelOwnerId, "commands")
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo estado del comando title");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        private async Task<List<TitleHistoryItem>> GetTitleHistoryFromDatabase(string channelLogin, int page, int limit)
        {
            try
            {
                var connectionString = _configuration.GetConnectionString("DefaultConnection");
                using var connection = new NpgsqlConnection(connectionString);
                await connection.OpenAsync();

                var offset = (page - 1) * limit;
                const string query = @"
                    SELECT title, changed_by, changed_at
                    FROM title_history 
                    WHERE channel_login = @channelLogin
                    ORDER BY changed_at DESC
                    LIMIT @limit OFFSET @offset";

                using var command = new NpgsqlCommand(query, connection);
                command.Parameters.AddWithValue("@channelLogin", channelLogin);
                command.Parameters.AddWithValue("@limit", limit);
                command.Parameters.AddWithValue("@offset", offset);

                var history = new List<TitleHistoryItem>();
                using var reader = await command.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    history.Add(new TitleHistoryItem
                    {
                        Title = reader.GetString("title"),
                        ChangedBy = reader.GetString("changed_by"),
                        ChangedAt = reader.GetDateTime("changed_at")
                    });
                }

                return history;
            }
            catch (Exception)
            {
                return new List<TitleHistoryItem>();
            }
        }
    }

    // DTOs (sin cambios)
    public class UpdateTitleRequest
    {
        public string Title { get; set; } = "";
    }

    public class ToggleCommandRequest
    {
        public bool Enabled { get; set; }
    }

    public class TitleHistoryItem
    {
        public string Title { get; set; } = "";
        public string ChangedBy { get; set; } = "";
        public DateTime ChangedAt { get; set; }
    }
}