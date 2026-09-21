using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/fortnite")]
    public class FortniteController : ControllerBase
    {
        private readonly IFortniteService _fortniteService;
        private readonly IPermissionService _permissionService;
        private readonly DecatronDbContext _context;
        private readonly ILogger<FortniteController> _logger;

        public FortniteController(
            IFortniteService fortniteService,
            IPermissionService permissionService,
            DecatronDbContext context,
            ILogger<FortniteController> logger)
        {
            _fortniteService = fortniteService;
            _permissionService = permissionService;
            _context = context;
            _logger = logger;
        }

        // ─── Público ────────────────────────────────────────────

        /// <summary>Catálogo completo de spirits</summary>
        [HttpGet("sprites")]
        public async Task<IActionResult> GetSprites()
        {
            try
            {
                var sprites = await _fortniteService.GetAllSpritesAsync();
                return Ok(new { success = true, sprites, count = sprites.Count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo catálogo de spirits");
                return StatusCode(500, new { success = false, message = "Error obteniendo spirits" });
            }
        }

        /// <summary>Temporada actual y lista de temporadas del catalogo — fuente unica para que el front y el bot de chat no hardcodeen el nombre de temporada cada uno por su lado</summary>
        [HttpGet("current-season")]
        public async Task<IActionResult> GetCurrentSeason()
        {
            try
            {
                var seasons = await _fortniteService.GetAvailableSeasonsAsync();
                return Ok(new { success = true, currentSeason = _fortniteService.CurrentSeason, seasons });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo temporada actual");
                return StatusCode(500, new { success = false, message = "Error obteniendo temporada" });
            }
        }

        /// <summary>Colección pública de un usuario</summary>
        [HttpGet("collection/{username}")]
        public async Task<IActionResult> GetPublicCollection(string username)
        {
            try
            {
                var collection = await _fortniteService.GetPublicCollectionAsync(username);
                var obtained = collection.Count(c => c.IsObtained);
                var total = collection.Count;

                return Ok(new
                {
                    success = true,
                    username,
                    obtained,
                    total,
                    percentage = total > 0 ? Math.Round((double)obtained / total * 100, 1) : 0,
                    collection
                });
            }
            catch (KeyNotFoundException)
            {
                return NotFound(new { success = false, message = $"Usuario '{username}' no encontrado" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo colección de {Username}", username);
                return StatusCode(500, new { success = false, message = "Error obteniendo colección" });
            }
        }

        /// <summary>Leaderboard global</summary>
        [HttpGet("leaderboard/global")]
        public async Task<IActionResult> GetGlobalLeaderboard([FromQuery] int top = 10, [FromQuery] string? season = null)
        {
            try
            {
                var entries = await _fortniteService.GetGlobalLeaderboardAsync(Math.Min(top, 50), season);
                return Ok(new { success = true, leaderboard = entries });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo leaderboard global");
                return StatusCode(500, new { success = false, message = "Error obteniendo leaderboard" });
            }
        }

        // ─── Autenticado ─────────────────────────────────────────

        /// <summary>Mi colección</summary>
        [HttpGet("my-collection")]
        [Authorize]
        public async Task<IActionResult> GetMyCollection()
        {
            try
            {
                var (targetUserId, channelName, error) = await GetEffectiveTargetUserAsync();
                if (error != null) return error;

                var collection = await _fortniteService.GetUserCollectionAsync(targetUserId!.Value);
                var obtained = collection.Count(c => c.IsObtained);
                var total = collection.Count;

                return Ok(new
                {
                    success = true,
                    obtained,
                    total,
                    percentage = total > 0 ? Math.Round((double)obtained / total * 100, 1) : 0,
                    collection,
                    managingChannel = channelName
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo mi colección");
                return StatusCode(500, new { success = false, message = "Error obteniendo colección" });
            }
        }

        /// <summary>Marcar spirit como obtenido</summary>
        [HttpPost("my-collection/mark")]
        [Authorize]
        public async Task<IActionResult> MarkSprite([FromBody] MarkSpriteDto dto)
        {
            try
            {
                var (targetUserId, _, error) = await GetEffectiveTargetUserAsync();
                if (error != null) return error;

                await _fortniteService.MarkSpriteAsync(targetUserId!.Value, dto.SpriteKey, dto.Platform ?? "web");
                return Ok(new { success = true, message = "Spirit marcado como obtenido" });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marcando spirit {SpriteKey}", dto.SpriteKey);
                return StatusCode(500, new { success = false, message = "Error marcando spirit" });
            }
        }

        /// <summary>Desmarcar spirit</summary>
        [HttpDelete("my-collection/{spriteKey}")]
        [Authorize]
        public async Task<IActionResult> UnmarkSprite(string spriteKey)
        {
            try
            {
                var (targetUserId, _, error) = await GetEffectiveTargetUserAsync();
                if (error != null) return error;

                await _fortniteService.UnmarkSpriteAsync(targetUserId!.Value, spriteKey);
                return Ok(new { success = true, message = "Spirit desmarcado" });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error desmarcando spirit {SpriteKey}", spriteKey);
                return StatusCode(500, new { success = false, message = "Error desmarcando spirit" });
            }
        }

        // ─── Notificaciones de spirits nuevos ──────────────────────────────

        /// <summary>Preferencias de aviso del usuario (Twitch chat / Discord DM)</summary>
        [HttpGet("notification-prefs")]
        [Authorize]
        public async Task<IActionResult> GetNotificationPrefs()
        {
            try
            {
                var (targetUserId, channelName, error) = await GetEffectiveTargetUserAsync();
                if (error != null) return error;

                var prefs = await _fortniteService.GetOrCreateNotificationPrefsAsync(targetUserId!.Value);
                var hasDiscord = await _context.Users
                    .Where(u => u.Id == targetUserId.Value)
                    .Select(u => u.DiscordId != null)
                    .FirstOrDefaultAsync();

                return Ok(new
                {
                    success = true,
                    notifyTwitchChat = prefs.NotifyTwitchChat,
                    notifyDiscordDm = prefs.NotifyDiscordDm,
                    hasDiscordLinked = hasDiscord,
                    managingChannel = channelName
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo preferencias de notificacion");
                return StatusCode(500, new { success = false, message = "Error obteniendo preferencias" });
            }
        }

        /// <summary>Actualizar preferencias de aviso</summary>
        [HttpPut("notification-prefs")]
        [Authorize]
        public async Task<IActionResult> SetNotificationPrefs([FromBody] NotificationPrefsDto dto)
        {
            try
            {
                var (targetUserId, _, error) = await GetEffectiveTargetUserAsync();
                if (error != null) return error;

                await _fortniteService.SetNotificationPrefsAsync(targetUserId!.Value, dto.NotifyTwitchChat, dto.NotifyDiscordDm);
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error actualizando preferencias de notificacion");
                return StatusCode(500, new { success = false, message = "Error actualizando preferencias" });
            }
        }

        /// <summary>Spirits nuevos desde la ultima visita al dashboard — marca la visita como vista al leerlo</summary>
        [HttpGet("new-since-last-visit")]
        [Authorize]
        public async Task<IActionResult> GetNewSinceLastVisit()
        {
            try
            {
                var (targetUserId, _, error) = await GetEffectiveTargetUserAsync();
                if (error != null) return error;

                var newSprites = await _fortniteService.GetNewSinceDashboardVisitAsync(targetUserId!.Value);
                return Ok(new { success = true, sprites = newSprites });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo spirits nuevos");
                return StatusCode(500, new { success = false, message = "Error obteniendo spirits nuevos" });
            }
        }

        // ─── Helper ──────────────────────────────────────────────

        private long? GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(claim, out var id) ? id : null;
        }

        /// <summary>
        /// Los spirits son de la persona, no del canal, pero alguien con
        /// control_total delegado sobre otro canal (via el channel-switcher, el
        /// mismo mecanismo que ya usa CustomCommandsController) puede gestionar
        /// la coleccion/avisos de esa persona igual que gestiona sus comandos.
        /// channelName viene informado solo cuando se esta actuando sobre un
        /// canal ajeno, para que el front pueda avisarlo.
        /// </summary>
        private async Task<(long? targetUserId, string? channelName, IActionResult? error)> GetEffectiveTargetUserAsync()
        {
            var userId = GetUserId();
            if (userId == null)
                return (null, null, Unauthorized(new { success = false, message = "Usuario no autenticado" }));

            long channelOwnerId;
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
            {
                channelOwnerId = sessionId;
            }
            else
            {
                var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
                channelOwnerId = !string.IsNullOrEmpty(channelOwnerIdClaim) && long.TryParse(channelOwnerIdClaim, out var claimId)
                    ? claimId
                    : userId.Value;
            }

            if (channelOwnerId == userId.Value)
                return (userId.Value, null, null);

            var canAccess = await _permissionService.CanAccessAsync(userId.Value, channelOwnerId, "spirits");
            if (!canAccess)
                return (null, null, StatusCode(403, new { success = false, message = "No tenés control total sobre este canal para gestionar sus spirits." }));

            var channelLogin = await _context.Users
                .Where(u => u.Id == channelOwnerId)
                .Select(u => u.Login)
                .FirstOrDefaultAsync();

            return (channelOwnerId, channelLogin, null);
        }
    }

    public class MarkSpriteDto
    {
        public string SpriteKey { get; set; } = "";
        public string? Platform { get; set; }
    }

    public class NotificationPrefsDto
    {
        public bool NotifyTwitchChat { get; set; }
        public bool NotifyDiscordDm { get; set; }
    }
}
