using Decatron.Attributes;
using Decatron.Core.Models.Fortnite;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/admin/fortnite")]
    [Authorize]
    [RequireSystemOwner]
    public class AdminFortniteController : ControllerBase
    {
        private readonly IFortniteService _fortniteService;
        private readonly ILogger<AdminFortniteController> _logger;

        public AdminFortniteController(
            IFortniteService fortniteService,
            ILogger<AdminFortniteController> logger)
        {
            _fortniteService = fortniteService;
            _logger = logger;
        }

        /// <summary>Lista todos los spirits con filtros opcionales</summary>
        [HttpGet("sprites")]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? character = null,
            [FromQuery] string? rarity = null,
            [FromQuery] bool? unreleased = null)
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
