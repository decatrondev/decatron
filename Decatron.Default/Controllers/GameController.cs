using System.Data;
using System.Security.Claims;
using Decatron.Attributes;
using Decatron.Core.Helpers;
using Decatron.Core.Models;
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
    [Route("api/commands/game")]
    [Authorize]
    public class GameCommandController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<GameCommandController> _logger;
        private readonly ICommandStateService _commandStateService;
        private readonly IPermissionService _permissionService;

        public GameCommandController(
            IConfiguration configuration,
            ILogger<GameCommandController> logger,
            ICommandStateService commandStateService,
            IPermissionService permissionService)
        {
            _configuration = configuration;
            _logger = logger;
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
                _logger.LogInformation($"[Game] Using channel from session: {sessionId}");
                return sessionId;
            }

            // PRIORIDAD 2: Usar el claim del JWT si existe
            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
            {
                _logger.LogInformation($"[Game] Using channel from JWT claim: {channelOwnerId}");
                return channelOwnerId;
            }

            // PRIORIDAD 3: Por defecto, usar el propio canal del usuario
            var userId = GetUserId();
            _logger.LogInformation($"[Game] Using user's own channel: {userId}");
            return userId;
        }

        private string GetChannelLogin()
        {
            return User.FindFirst(ClaimTypes.Name)?.Value ?? "";
        }

        /// <summary>
        /// Obtiene la categoría actual del stream
        /// </summary>
        [HttpGet("current")]
        [RequirePermission("game")]
        public async Task<IActionResult> GetCurrentCategory()
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();

                // Verificar permisos adicionales si es necesario
                if (!await _permissionService.CanAccessAsync(userId, channelOwnerId, "game"))
                {
                    return StatusCode(403, new { success = false, message = "No tienes permisos para acceder a esta función" });
                }

                var channelLogin = GetChannelLogin();
                var userInfo = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channelLogin);

                if (userInfo == null)
                {
                    return NotFound(new { success = false, message = "Usuario no encontrado" });
                }

                var currentCategory = await GameUtils.GetCurrentCategoryAsync(_configuration, userInfo.TwitchId, userInfo.AccessToken);

                return Ok(new
                {
                    success = true,
                    currentCategory = currentCategory ?? "Sin categoría",
                    channel = userInfo.Login,
                    hasEditPermission = await _permissionService.CanAccessAsync(userId, channelOwnerId, "game")
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo categoría actual");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Cambia la categoría del stream
        /// </summary>
        [HttpPost("update")]
        [RequirePermission("game")]
        public async Task<IActionResult> UpdateCategory([FromBody] UpdateCategoryRequest request)
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();

                // Verificar permisos para modificar
                if (!await _permissionService.CanAccessAsync(userId, channelOwnerId, "game"))
                {
                    return StatusCode(403, new { success = false, message = "No tienes permisos para cambiar la categoría" });
                }

                var channelLogin = GetChannelLogin();
                var userInfo = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channelLogin);

                if (userInfo == null)
                {
                    return NotFound(new { success = false, message = "Usuario no encontrado" });
                }

                var validationResult = GameUtils.ValidateCategory(request.Category);
                if (!validationResult.isValid)
                {
                    return BadRequest(new { success = false, message = validationResult.errorMessage });
                }

                var realCategoryName = await GameUtils.UpdateCategoryAsync(_configuration, userInfo.TwitchId, request.Category, userInfo.AccessToken, _logger);

                if (realCategoryName != null)
                {
                    await GameUtils.SaveCategoryToHistoryAsync(_configuration, userInfo.Login, realCategoryName, userInfo.Login);
                    _logger.LogInformation($"Categoría actualizada por {userInfo.Login}: {realCategoryName}");

                    return Ok(new
                    {
                        success = true,
                        message = "Categoría actualizada correctamente",
                        newCategory = realCategoryName
                    });
                }
                else
                {
                    return BadRequest(new { success = false, message = "Error al actualizar la categoría en Twitch" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error actualizando categoría");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Obtiene el historial de cambios de categoría
        /// </summary>
        [HttpGet("history")]
        [RequirePermission("game")]
        public async Task<IActionResult> GetCategoryHistory([FromQuery] int page = 1, [FromQuery] int limit = 10)
        {
            try
            {
                var channelLogin = GetChannelLogin();
                var history = await GetCategoryHistoryFromDatabase(channelLogin, page, limit);

                return Ok(new
                {
                    success = true,
                    history = history,
                    page = page,
                    limit = limit
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo historial de categorías");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Activa o desactiva el comando !game (solo control total)
        /// </summary>
        [HttpPost("toggle")]
        [RequirePermission("game", "control_total")]
        public async Task<IActionResult> ToggleGameCommand([FromBody] ToggleGameCommandRequest request)
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

                await _commandStateService.SetCommandEnabledAsync(channelOwnerId, "game", request.Enabled);

                _logger.LogInformation($"Usuario {userId} cambió estado del comando game a: {request.Enabled} para canal {channelOwnerId}");

                return Ok(new
                {
                    success = true,
                    message = $"Comando game {(request.Enabled ? "habilitado" : "deshabilitado")} correctamente",
                    enabled = request.Enabled
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cambiando estado del comando game");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Verifica si el comando !game está habilitado
        /// </summary>
        [HttpGet("status")]
        [RequirePermission("game")]
        public async Task<IActionResult> GetGameCommandStatus()
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();
                var channelLogin = GetChannelLogin();
                var userInfo = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channelLogin);

                if (userInfo == null)
                {
                    return NotFound(new { success = false, message = "Usuario no encontrado" });
                }

                var isBotEnabled = await Utils.IsBotEnabledForChannelAsync(_configuration, userInfo.Login);
                var isCommandEnabled = await _commandStateService.IsCommandEnabledAsync(channelOwnerId, "game");
                var userAccessLevel = await _permissionService.GetUserAccessLevelAsync(userId, channelOwnerId);
                var canToggle = await _permissionService.HasPermissionLevelAsync(userId, channelOwnerId, "control_total");

                return Ok(new
                {
                    success = true,
                    botEnabled = isBotEnabled,
                    commandEnabled = isCommandEnabled,
                    channel = userInfo.Login,
                    userAccessLevel = userAccessLevel,
                    canToggle = canToggle,
                    canEdit = await _permissionService.CanAccessAsync(userId, channelOwnerId, "game")
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo estado del comando game");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        private async Task<List<CategoryHistoryItem>> GetCategoryHistoryFromDatabase(string channelLogin, int page, int limit)
        {
            try
            {
                var connectionString = _configuration.GetConnectionString("DefaultConnection");
                using var connection = new NpgsqlConnection(connectionString);
                await connection.OpenAsync();

                var offset = (page - 1) * limit;
                const string query = @"
                    SELECT category_name, changed_by, changed_at
                    FROM game_history 
                    WHERE channel_login = @channelLogin
                    ORDER BY changed_at DESC
                    LIMIT @limit OFFSET @offset";

                using var command = new NpgsqlCommand(query, connection);
                command.Parameters.AddWithValue("@channelLogin", channelLogin);
                command.Parameters.AddWithValue("@limit", limit);
                command.Parameters.AddWithValue("@offset", offset);

                var history = new List<CategoryHistoryItem>();
                using var reader = await command.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    history.Add(new CategoryHistoryItem
                    {
                        CategoryName = reader.GetString("category_name"),
                        ChangedBy = reader.GetString("changed_by"),
                        ChangedAt = reader.GetDateTime("changed_at")
                    });
                }

                return history;
            }
            catch (Exception)
            {
                return new List<CategoryHistoryItem>();
            }
        }
    }

    // DTOs (sin cambios)
    public class UpdateCategoryRequest
    {
        public string Category { get; set; } = "";
    }

    public class ToggleGameCommandRequest
    {
        public bool Enabled { get; set; }
    }

    public class CategoryHistoryItem
    {
        public string CategoryName { get; set; } = "";
        public string ChangedBy { get; set; } = "";
        public DateTime ChangedAt { get; set; }
    }
}