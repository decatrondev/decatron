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
        private readonly DecatronDbContext _context;
        private readonly ILogger<FortniteController> _logger;

        public FortniteController(
            IFortniteService fortniteService,
            DecatronDbContext context,
            ILogger<FortniteController> logger)
        {
            _fortniteService = fortniteService;
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
        public async Task<IActionResult> GetGlobalLeaderboard([FromQuery] int top = 10)
        {
            try
            {
                var entries = await _fortniteService.GetGlobalLeaderboardAsync(Math.Min(top, 50));
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
                var userId = GetUserId();
                if (userId == null)
                    return Unauthorized(new { success = false, message = "Usuario no autenticado" });

                var collection = await _fortniteService.GetUserCollectionAsync(userId.Value);
                var obtained = collection.Count(c => c.IsObtained);
                var total = collection.Count;

                return Ok(new
                {
                    success = true,
                    obtained,
                    total,
                    percentage = total > 0 ? Math.Round((double)obtained / total * 100, 1) : 0,
                    collection
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
                var userId = GetUserId();
                if (userId == null)
                    return Unauthorized(new { success = false, message = "Usuario no autenticado" });

                await _fortniteService.MarkSpriteAsync(userId.Value, dto.SpriteKey, dto.Platform ?? "web");
                return Ok(new { success = true, message = "Spirit marcado como obtenido" });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = ex.Message });
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
                var userId = GetUserId();
                if (userId == null)
                    return Unauthorized(new { success = false, message = "Usuario no autenticado" });

                await _fortniteService.UnmarkSpriteAsync(userId.Value, spriteKey);
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

        // ─── Helper ──────────────────────────────────────────────

        private long? GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(claim, out var id) ? id : null;
        }
    }

    public class MarkSpriteDto
    {
        public string SpriteKey { get; set; } = "";
        public string? Platform { get; set; }
    }
}
