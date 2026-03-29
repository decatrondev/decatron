using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Decatron.Data;
using Decatron.Services;
using Decatron.Core.Interfaces;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/channel")]
    [Authorize]
    public class ChannelSwitchController : ControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly IPermissionService _permissionService;
        private readonly ILogger<ChannelSwitchController> _logger;

        public ChannelSwitchController(
            DecatronDbContext dbContext,
            IPermissionService permissionService,
            ILogger<ChannelSwitchController> logger)
        {
            _dbContext = dbContext;
            _permissionService = permissionService;
            _logger = logger;
        }

        private long GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(userIdClaim, out var userId))
                return userId;
            throw new UnauthorizedAccessException("User not found");
        }

        /// <summary>
        /// Obtiene todas las cuentas que el usuario puede gestionar
        /// </summary>
        [HttpGet("available")]
        public async Task<IActionResult> GetAvailableChannels()
        {
            try
            {
                var userId = GetUserId();

                var availableChannels = new List<object>();

                // 1. Su propio canal (siempre disponible)
                var ownChannel = await _dbContext.Users
                    .Where(u => u.Id == userId && u.IsActive)
                    .Select(u => new
                    {
                        channelId = u.Id,
                        login = u.Login,
                        displayName = u.DisplayName,
                        profileImageUrl = u.ProfileImageUrl,
                        accessLevel = "owner",
                        isOwner = true
                    })
                    .FirstOrDefaultAsync();

                if (ownChannel != null)
                {
                    availableChannels.Add(ownChannel);
                }

                // 2. Canales donde tiene permisos otorgados
                var managedChannels = await _dbContext.UserChannelPermissions
                    .Include(p => p.ChannelOwner)
                    .Where(p => p.GrantedUserId == userId && p.IsActive)
                    .Select(p => new
                    {
                        channelId = p.ChannelOwnerId,
                        login = p.ChannelOwner.Login,
                        displayName = p.ChannelOwner.DisplayName,
                        profileImageUrl = p.ChannelOwner.ProfileImageUrl,
                        accessLevel = p.AccessLevel,
                        isOwner = false
                    })
                    .ToListAsync();

                availableChannels.AddRange(managedChannels);

                _logger.LogInformation($"User {userId} can manage {availableChannels.Count} channels");

                return Ok(new
                {
                    success = true,
                    currentUserId = userId,
                    channels = availableChannels
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting available channels");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Cambia el contexto activo del usuario (solo en memoria/sesión)
        /// </summary>
        [HttpPost("switch")]
        public async Task<IActionResult> SwitchContext([FromBody] SwitchContextRequest request)
        {
            try
            {
                var userId = GetUserId();

                if (request.ChannelId <= 0)
                {
                    return BadRequest(new { success = false, message = "ID de canal inválido" });
                }

                // Verificar que el usuario puede gestionar este canal
                bool canManage = false;
                string accessLevel = "none";

                // 1. Es su propio canal?
                if (request.ChannelId == userId)
                {
                    canManage = true;
                    accessLevel = "owner";
                }
                else
                {
                    // 2. Tiene permisos otorgados?
                    var permission = await _dbContext.UserChannelPermissions
                        .Where(p => p.GrantedUserId == userId &&
                                   p.ChannelOwnerId == request.ChannelId &&
                                   p.IsActive)
                        .FirstOrDefaultAsync();

                    if (permission != null)
                    {
                        canManage = true;
                        accessLevel = permission.AccessLevel;
                    }
                }

                if (!canManage)
                {
                    return StatusCode(403, new { success = false, message = "No tienes permisos para gestionar este canal" });
                }

                // Obtener información del canal objetivo
                var targetChannel = await _dbContext.Users
                    .Where(u => u.Id == request.ChannelId && u.IsActive)
                    .Select(u => new
                    {
                        channelId = u.Id,
                        login = u.Login,
                        displayName = u.DisplayName,
                        profileImageUrl = u.ProfileImageUrl,
                        accessLevel = accessLevel,
                        isOwner = request.ChannelId == userId
                    })
                    .FirstOrDefaultAsync();

                if (targetChannel == null)
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                // Guardar contexto en sesión (no en JWT, para mantener URLs limpias)
                HttpContext.Session.SetString("ActiveChannelId", request.ChannelId.ToString());
                HttpContext.Session.SetString("ActiveChannelLogin", targetChannel.login);
                HttpContext.Session.SetString("ActiveChannelAccessLevel", accessLevel);

                _logger.LogInformation($"User {userId} switched context to channel {request.ChannelId} ({targetChannel.login})");

                return Ok(new
                {
                    success = true,
                    message = $"Contexto cambiado a {targetChannel.displayName}",
                    activeChannel = targetChannel
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error switching context");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Obtiene el contexto activo actual
        /// </summary>
        [HttpGet("context")]
        public async Task<IActionResult> GetCurrentContext()
        {
            try
            {
                var userId = GetUserId();

                // Intentar obtener contexto de sesión
                var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
                var activeChannelId = userId; // Default a su propio canal

                if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var parsedChannelId))
                {
                    // Verificar que aún tiene permisos para este canal
                    bool stillHasAccess = false;

                    if (parsedChannelId == userId)
                    {
                        stillHasAccess = true; // Siempre tiene acceso a su propio canal
                    }
                    else
                    {
                        var permission = await _dbContext.UserChannelPermissions
                            .Where(p => p.GrantedUserId == userId &&
                                       p.ChannelOwnerId == parsedChannelId &&
                                       p.IsActive)
                            .FirstOrDefaultAsync();
                        stillHasAccess = permission != null;
                    }

                    if (stillHasAccess)
                    {
                        activeChannelId = parsedChannelId;
                    }
                    else
                    {
                        // Limpiar sesión si ya no tiene acceso
                        HttpContext.Session.Remove("ActiveChannelId");
                        HttpContext.Session.Remove("ActiveChannelLogin");
                        HttpContext.Session.Remove("ActiveChannelAccessLevel");
                    }
                }

                // Obtener información del canal activo
                var activeChannel = await _dbContext.Users
                    .Where(u => u.Id == activeChannelId && u.IsActive)
                    .FirstOrDefaultAsync();

                if (activeChannel == null)
                {
                    return StatusCode(500, new { success = false, message = "Canal activo no encontrado" });
                }

                // Determinar nivel de acceso
                var accessLevel = await _permissionService.GetUserAccessLevelAsync(userId, activeChannelId);
                var isOwner = userId == activeChannelId;

                return Ok(new
                {
                    success = true,
                    context = new
                    {
                        userId = userId,
                        activeChannelId = activeChannelId,
                        activeChannel = new
                        {
                            channelId = activeChannel.Id,
                            login = activeChannel.Login,
                            displayName = activeChannel.DisplayName,
                            profileImageUrl = activeChannel.ProfileImageUrl,
                            uniqueId = activeChannel.UniqueId,
                            createdAt = activeChannel.CreatedAt,
                            updatedAt = activeChannel.UpdatedAt,
                            accessLevel = accessLevel ?? (isOwner ? "owner" : "none"),
                            isOwner = isOwner
                        }
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting current context");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }



    }

    public class SwitchContextRequest
    {
        public long ChannelId { get; set; }
    }
}