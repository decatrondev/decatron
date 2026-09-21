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

                // 2. Canales donde tiene permisos otorgados. El permiso es especifico
                // de la plataforma/fila con la que se otorgo — Twitch y Kick se ven
                // como accesos separados, cada uno con su propio listado.
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

                // Verificar que el usuario puede gestionar este canal. Se delega en
                // PermissionService, que ya resuelve tanto "es dueño (o cuenta propia
                // vinculada por otra plataforma)" como "tiene permiso delegado en
                // cualquiera de sus cuentas vinculadas" — ver seccion 8.13/8.14 del
                // plan de unificacion multiplataforma.
                bool canManage = false;
                string accessLevel = "none";

                if (await _permissionService.IsChannelOwnerAsync(userId, request.ChannelId))
                {
                    canManage = true;
                    accessLevel = request.ChannelId == userId ? "owner" : "linked";
                }
                else
                {
                    var userAccessLevel = await _permissionService.GetUserAccessLevelAsync(userId, request.ChannelId);

                    if (!string.IsNullOrEmpty(userAccessLevel))
                    {
                        canManage = true;
                        accessLevel = userAccessLevel;
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
                        login = u.KickId != null ? u.KickUsername : u.Login,
                        displayName = u.KickId != null ? (u.KickUsername ?? u.DisplayName) : u.DisplayName,
                        profileImageUrl = u.KickId != null ? (u.KickProfilePic ?? "") : u.ProfileImageUrl,
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
                    // Verificar que aún tiene permisos para este canal. GetUserAccessLevelAsync
                    // ya resuelve tanto el caso "dueño (o cuenta propia vinculada)" como el
                    // de "permiso delegado en cualquiera de sus cuentas vinculadas".
                    bool stillHasAccess = parsedChannelId == userId ||
                        !string.IsNullOrEmpty(await _permissionService.GetUserAccessLevelAsync(userId, parsedChannelId));

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
                            login = activeChannel.KickId != null ? activeChannel.KickUsername : activeChannel.Login,
                            displayName = activeChannel.KickId != null ? (activeChannel.KickUsername ?? activeChannel.DisplayName) : activeChannel.DisplayName,
                            profileImageUrl = activeChannel.KickId != null ? (activeChannel.KickProfilePic ?? "") : activeChannel.ProfileImageUrl,
                            uniqueId = activeChannel.UniqueId,
                            createdAt = activeChannel.CreatedAt,
                            updatedAt = activeChannel.UpdatedAt,
                            accessLevel = accessLevel ?? (isOwner ? "owner" : (activeChannelId != userId ? "linked" : "none")),
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