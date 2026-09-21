using Decatron.Attributes;
using Decatron.Core.Models.Fortnite;
using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/admin/fortnite")]
    [Authorize]
    [RequireSystemOwner]
    public class AdminFortniteController : ControllerBase
    {
        private readonly IFortniteService _fortniteService;
        private readonly ISpiritNotificationDeliveryService _notificationDelivery;
        private readonly DecatronDbContext _context;
        private readonly ILogger<AdminFortniteController> _logger;

        public AdminFortniteController(
            IFortniteService fortniteService,
            ISpiritNotificationDeliveryService notificationDelivery,
            DecatronDbContext context,
            ILogger<AdminFortniteController> logger)
        {
            _fortniteService = fortniteService;
            _notificationDelivery = notificationDelivery;
            _context = context;
            _logger = logger;
        }

        /// <summary>Dispara a mano el aviso de Twitch de un usuario, como si su stream recien hubiera arrancado — util para probar sin esperar al evento real</summary>
        [HttpPost("test-twitch-notify/{username}")]
        public async Task<IActionResult> TestTwitchNotify(string username)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Login == username.ToLower());
            if (user == null)
                return NotFound(new { success = false, message = $"Usuario '{username}' no encontrado" });

            await _notificationDelivery.NotifyStreamOnlineAsync(user.Id, username.ToLower());
            return Ok(new { success = true, message = $"Disparado para {username} (si no llego nada, no habia sprites nuevos pendientes)" });
        }

        /// <summary>Dispara a mano el barrido de DM de Discord (normalmente corre cada 15min solo) — util para probar sin esperar</summary>
        [HttpPost("test-discord-notify/{username}")]
        public async Task<IActionResult> TestDiscordNotify(string username)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Login == username.ToLower());
            if (user == null)
                return NotFound(new { success = false, message = $"Usuario '{username}' no encontrado" });
            if (user.DiscordId == null)
                return BadRequest(new { success = false, message = $"{username} no tiene Discord vinculado" });

            await _notificationDelivery.RunDiscordSweepAsync();
            return Ok(new { success = true, message = $"Barrido de Discord disparado (si no llego nada, no habia sprites nuevos pendientes para {username})" });
        }

        /// <summary>Lista todos los spirits con filtros opcionales</summary>
        [HttpGet("sprites")]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? character = null,
            [FromQuery] string? rarity = null,
            [FromQuery] bool? unreleased = null,
            [FromQuery] string? season = null)
        {
            try
            {
                var sprites = await _fortniteService.GetAllSpritesAsync();

                if (!string.IsNullOrEmpty(character))
                    sprites = sprites.Where(s => s.Character.Equals(character, StringComparison.OrdinalIgnoreCase)).ToList();

                if (!string.IsNullOrEmpty(rarity))
                    sprites = sprites.Where(s => s.Rarity.Equals(rarity, StringComparison.OrdinalIgnoreCase)).ToList();

                if (unreleased.HasValue)
                    sprites = sprites.Where(s => s.IsUnreleased == unreleased.Value).ToList();

                if (!string.IsNullOrEmpty(season))
                    sprites = sprites.Where(s => string.Equals(s.Season, season, StringComparison.OrdinalIgnoreCase)).ToList();

                return Ok(new { success = true, sprites, count = sprites.Count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo spirits para admin");
                return StatusCode(500, new { success = false, message = "Error obteniendo spirits" });
            }
        }

        /// <summary>Obtener un spirit por ID</summary>
        [HttpGet("sprites/{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            try
            {
                var sprite = await _fortniteService.GetSpriteByIdAsync(id);
                if (sprite == null)
                    return NotFound(new { success = false, message = "Spirit no encontrado" });

                return Ok(new { success = true, sprite });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo spirit {Id}", id);
                return StatusCode(500, new { success = false, message = "Error obteniendo spirit" });
            }
        }

        /// <summary>Crear nuevo spirit</summary>
        [HttpPost("sprites")]
        public async Task<IActionResult> Create([FromBody] SpriteUpsertDto dto)
        {
            try
            {
                var sprite = new FortniteSprite
                {
                    SpriteKey = dto.SpriteKey.ToLower().Trim(),
                    Name = dto.Name.Trim(),
                    Character = dto.Character.Trim(),
                    Theme = dto.Theme.Trim(),
                    Rarity = dto.Rarity.Trim(),
                    ImageUrl = dto.ImageUrl?.Trim(),
                    IsUnreleased = dto.IsUnreleased,
                    Season = dto.Season?.Trim()
                };

                var created = await _fortniteService.CreateSpriteAsync(sprite);
                return Ok(new { success = true, message = "Spirit creado exitosamente", sprite = created });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creando spirit");
                return StatusCode(500, new { success = false, message = "Error creando spirit" });
            }
        }

        /// <summary>Actualizar spirit existente</summary>
        [HttpPut("sprites/{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] SpriteUpsertDto dto)
        {
            try
            {
                var sprite = new FortniteSprite
                {
                    Id = id,
                    SpriteKey = dto.SpriteKey.ToLower().Trim(),
                    Name = dto.Name.Trim(),
                    Character = dto.Character.Trim(),
                    Theme = dto.Theme.Trim(),
                    Rarity = dto.Rarity.Trim(),
                    ImageUrl = dto.ImageUrl?.Trim(),
                    IsUnreleased = dto.IsUnreleased,
                    Season = dto.Season?.Trim()
                };

                var updated = await _fortniteService.UpdateSpriteAsync(sprite);
                return Ok(new { success = true, message = "Spirit actualizado", sprite = updated });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error actualizando spirit {Id}", id);
                return StatusCode(500, new { success = false, message = "Error actualizando spirit" });
            }
        }

        /// <summary>Eliminar spirit</summary>
        [HttpDelete("sprites/{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                await _fortniteService.DeleteSpriteAsync(id);
                return Ok(new { success = true, message = "Spirit eliminado" });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error eliminando spirit {Id}", id);
                return StatusCode(500, new { success = false, message = "Error eliminando spirit" });
            }
        }
    }

    public class SpriteUpsertDto
    {
        public string SpriteKey { get; set; } = "";
        public string Name { get; set; } = "";
        public string Character { get; set; } = "";
        public string Theme { get; set; } = "";
        public string Rarity { get; set; } = "";
        public string? ImageUrl { get; set; }
        public bool IsUnreleased { get; set; } = false;
        public string? Season { get; set; }
    }
}
