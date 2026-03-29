using Microsoft.AspNetCore.Authorization;
using Decatron.Attributes;
using Decatron.Core.Models;
using Decatron.Services;
using Decatron.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/raffles")]
[Authorize]
    public class RaffleController : ControllerBase
    {
        private readonly IRaffleService _raffleService;
        private readonly ILogger<RaffleController> _logger;
        private readonly DecatronDbContext _context;

        public RaffleController(
            IRaffleService raffleService,
            ILogger<RaffleController> logger,
            DecatronDbContext context)
        {
            _raffleService = raffleService;
            _logger = logger;
            _context = context;
        }

        private async Task<(long channelOwnerId, string channelName)?> GetActiveChannelContext()
        {
            try
            {
                long channelOwnerId;

                var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
                if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
                {
                    channelOwnerId = sessionId;
                }
                else
                {
                    var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
                    if (!string.IsNullOrEmpty(channelOwnerIdClaim) && long.TryParse(channelOwnerIdClaim, out var claimId))
                    {
                        channelOwnerId = claimId;
                    }
                    else
                    {
                        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                        if (!long.TryParse(userIdClaim, out var userId))
                        {
                            return null;
                        }
                        channelOwnerId = userId;
                    }
                }

                var channel = await _context.Users
                    .Where(u => u.Id == channelOwnerId && u.IsActive)
                    .Select(u => new { u.Login })
                    .FirstOrDefaultAsync();

                if (channel == null)
                {
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

        /// <summary>
        /// Obtiene todos los sorteos del canal activo
        /// </summary>
        [HttpGet]
        [RequirePermission("raffles")]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { success = false, message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;
                var raffles = await _raffleService.GetAllByChannelAsync(channelName);

                return Ok(raffles);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo sorteos");
                return StatusCode(500, new { success = false, message = "Error obteniendo sorteos" });
            }
        }

        /// <summary>
        /// Obtiene un sorteo por ID
        /// </summary>
        [HttpGet("{id}")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> GetById(int id)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { success = false, message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;
                var raffle = await _raffleService.GetByIdAsync(id);

                if (raffle == null)
                {
                    return NotFound(new { success = false, message = "Sorteo no encontrado" });
                }

                if (!raffle.ChannelName.Equals(channelName, StringComparison.OrdinalIgnoreCase))
                {
                    return Forbid();
                }

                return Ok(new { success = true, raffle });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error obteniendo sorteo {id}");
                return StatusCode(500, new { success = false, message = "Error obteniendo sorteo" });
            }
        }

        /// <summary>
        /// Crea un nuevo sorteo
        /// </summary>
        [HttpPost]
        [RequirePermission("raffles")]
        public async Task<IActionResult> Create([FromBody] RaffleCreateDto dto)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { success = false, message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (string.IsNullOrEmpty(userId))
                {
                    return Unauthorized(new { success = false, message = "Usuario no autenticado" });
                }

                var raffle = new Raffle
                {
                    ChannelName = channelName,
                    Name = dto.Name,
                    Description = dto.Description,
                    WinnersCount = dto.WinnersCount,
                    ConfigJson = JsonSerializer.Serialize(dto.Config ?? new {}),
                    CreatedBy = long.Parse(userId)
                };

                var created = await _raffleService.CreateAsync(raffle);

                _logger.LogInformation($"Sorteo '{raffle.Name}' creado en canal {channelName}");

                return Ok(new
                {
                    success = true,
                    message = "Sorteo creado exitosamente",
                    raffle = created
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creando sorteo");
                return StatusCode(500, new { success = false, message = "Error creando sorteo" });
            }
        }

        /// <summary>
        /// Actualiza un sorteo existente
        /// </summary>
        [HttpPut("{id}")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> Update(int id, [FromBody] RaffleUpdateDto dto)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { success = false, message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;
                var existing = await _raffleService.GetByIdAsync(id);

                if (existing == null)
                {
                    return NotFound(new { success = false, message = "Sorteo no encontrado" });
                }

                if (!existing.ChannelName.Equals(channelName, StringComparison.OrdinalIgnoreCase))
                {
                    return Forbid();
                }

                existing.Name = dto.Name;
                existing.Description = dto.Description;
                existing.WinnersCount = dto.WinnersCount;
                existing.ConfigJson = JsonSerializer.Serialize(dto.Config ?? new {});

                var updated = await _raffleService.UpdateAsync(existing);

                return Ok(new
                {
                    success = true,
                    message = "Sorteo actualizado exitosamente",
                    raffle = updated
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error actualizando sorteo {id}");
                return StatusCode(500, new { success = false, message = "Error actualizando sorteo" });
            }
        }

        /// <summary>
        /// Elimina un sorteo
        /// </summary>
        [HttpDelete("{id}")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { success = false, message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;
                var raffle = await _raffleService.GetByIdAsync(id);

                if (raffle == null)
                {
                    return NotFound(new { success = false, message = "Sorteo no encontrado" });
                }

                if (!raffle.ChannelName.Equals(channelName, StringComparison.OrdinalIgnoreCase))
                {
                    return Forbid();
                }

                await _raffleService.DeleteAsync(id);

                return Ok(new { success = true, message = "Sorteo eliminado exitosamente" });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error eliminando sorteo {id}");
                return StatusCode(500, new { success = false, message = "Error eliminando sorteo" });
            }
        }

        /// <summary>
        /// Abre un sorteo para participación
        /// </summary>
        [HttpPost("{id}/open")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> Open(int id)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { success = false, message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;
                var raffle = await _raffleService.GetByIdAsync(id);

                if (raffle == null || !raffle.ChannelName.Equals(channelName, StringComparison.OrdinalIgnoreCase))
                {
                    return NotFound(new { success = false, message = "Sorteo no encontrado" });
                }

                var updated = await _raffleService.OpenRaffleAsync(id);

                return Ok(new
                {
                    success = true,
                    message = "Sorteo abierto exitosamente",
                    raffle = updated
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error abriendo sorteo {id}");
                return StatusCode(500, new { success = false, message = "Error abriendo sorteo" });
            }
        }

        /// <summary>
        /// Cierra un sorteo (ya no acepta participantes)
        /// </summary>
        [HttpPost("{id}/close")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> Close(int id)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { success = false, message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;
                var raffle = await _raffleService.GetByIdAsync(id);

                if (raffle == null || !raffle.ChannelName.Equals(channelName, StringComparison.OrdinalIgnoreCase))
                {
                    return NotFound(new { success = false, message = "Sorteo no encontrado" });
                }

                var updated = await _raffleService.CloseRaffleAsync(id);

                return Ok(new
                {
                    success = true,
                    message = "Sorteo cerrado exitosamente",
                    raffle = updated
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error cerrando sorteo {id}");
                return StatusCode(500, new { success = false, message = "Error cerrando sorteo" });
            }
        }

        /// <summary>
        /// Ejecuta el sorteo y selecciona ganadores
        /// </summary>
        [HttpPost("{id}/draw")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> Draw(int id, [FromBody] DrawWinnersDto dto)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { success = false, message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;
                var raffle = await _raffleService.GetByIdAsync(id);

                if (raffle == null || !raffle.ChannelName.Equals(channelName, StringComparison.OrdinalIgnoreCase))
                {
                    return NotFound(new { success = false, message = "Sorteo no encontrado" });
                }

                var winners = await _raffleService.DrawWinnersAsync(id, dto.Weighted);

                return Ok(new
                {
                    success = true,
                    message = "Ganadores seleccionados exitosamente",
                    winners = winners,
                    count = winners.Count
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error sorteando ganadores {id}");
                return StatusCode(500, new { success = false, message = "Error sorteando ganadores" });
            }
        }

        /// <summary>
        /// Obtiene los participantes de un sorteo
        /// </summary>
        [HttpGet("{id}/participants")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> GetParticipants(int id)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { success = false, message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;
                var raffle = await _raffleService.GetByIdAsync(id);

                if (raffle == null || !raffle.ChannelName.Equals(channelName, StringComparison.OrdinalIgnoreCase))
                {
                    return NotFound(new { success = false, message = "Sorteo no encontrado" });
                }

                var participants = await _raffleService.GetParticipantsAsync(id);

                return Ok(new
                {
                    success = true,
                    participants = participants,
                    count = participants.Count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error obteniendo participantes del sorteo {id}");
                return StatusCode(500, new { success = false, message = "Error obteniendo participantes" });
            }
        }

        /// <summary>
        /// Obtiene los ganadores de un sorteo
        /// </summary>
        [HttpGet("{id}/winners")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> GetWinners(int id)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { success = false, message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;
                var raffle = await _raffleService.GetByIdAsync(id);

                if (raffle == null || !raffle.ChannelName.Equals(channelName, StringComparison.OrdinalIgnoreCase))
                {
                    return NotFound(new { success = false, message = "Sorteo no encontrado" });
                }

                var winners = await _raffleService.GetWinnersAsync(id);

                return Ok(new
                {
                    success = true,
                    winners = winners,
                    count = winners.Count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error obteniendo ganadores del sorteo {id}");
                return StatusCode(500, new { success = false, message = "Error obteniendo ganadores" });
            }
        }

        /// <summary>
        /// Re-sortea un ganador específico
        /// </summary>
        [HttpPost("winners/{winnerId}/reroll")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> RerollWinner(int winnerId, [FromBody] RerollWinnerDto dto)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { success = false, message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;

                // Verify the winner belongs to a raffle owned by this channel
                var winner = await _context.RaffleWinners
                    .Include(w => w.Raffle)
                    .FirstOrDefaultAsync(w => w.Id == winnerId);

                if (winner == null)
                {
                    return NotFound(new { success = false, message = "Ganador no encontrado" });
                }

                if (winner.Raffle == null || !winner.Raffle.ChannelName.Equals(channelName, StringComparison.OrdinalIgnoreCase))
                {
                    return Forbid();
                }

                var newWinner = await _raffleService.RerollWinnerAsync(winnerId, dto.Reason);

                return Ok(new
                {
                    success = true,
                    message = "Re-roll ejecutado exitosamente",
                    winner = newWinner
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error re-sorteando ganador {winnerId}");
                return StatusCode(500, new { success = false, message = "Error re-sorteando ganador" });
            }
        }

        /// <summary>
        /// Obtiene estadísticas de sorteos del canal
        /// </summary>

        /// <summary>
        /// Agrega manualmente un participante al sorteo
        /// </summary>
        [HttpPost("{id}/participants")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> AddParticipant(int id, [FromBody] AddParticipantDto dto)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { success = false, message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;
                var raffle = await _raffleService.GetByIdAsync(id);

                if (raffle == null)
                {
                    return NotFound(new { success = false, message = "Sorteo no encontrado" });
                }

                if (!raffle.ChannelName.Equals(channelName, StringComparison.OrdinalIgnoreCase))
                {
                    return Forbid();
                }

                var participant = await _raffleService.AddParticipantAsync(
                    id, 
                    dto.Username, 
                    null, // TwitchUserId no disponible manual
                    "manual", 
                    dto.Tickets
                );

                return Ok(new { success = true, participant });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error agregando participante a sorteo {id}");
                return StatusCode(500, new { success = false, message = "Error agregando participante" });
            }
        }

        /// <summary>
        /// Elimina un participante del sorteo
        /// </summary>
        [HttpDelete("{id}/participants/{participantId}")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> RemoveParticipant(int id, int participantId)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { success = false, message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;
                var raffle = await _raffleService.GetByIdAsync(id);

                if (raffle == null)
                {
                    return NotFound(new { success = false, message = "Sorteo no encontrado" });
                }

                if (!raffle.ChannelName.Equals(channelName, StringComparison.OrdinalIgnoreCase))
                {
                    return Forbid();
                }

                await _raffleService.RemoveParticipantAsync(participantId);

                return Ok(new { success = true, message = "Participante eliminado correctamente" });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error eliminando participante {participantId}");
                return StatusCode(500, new { success = false, message = "Error eliminando participante" });
            }
        }

        /// <summary>
        /// Importa participantes automáticamente desde la última sesión activa del timer
        /// </summary>
        [HttpPost("{id}/import-session")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> ImportFromSession(int id)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { success = false, message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;
                var raffle = await _raffleService.GetByIdAsync(id);

                if (raffle == null)
                {
                    return NotFound(new { success = false, message = "Sorteo no encontrado" });
                }

                if (!raffle.ChannelName.Equals(channelName, StringComparison.OrdinalIgnoreCase))
                {
                    return Forbid();
                }

                var count = await _raffleService.ImportParticipantsFromSessionAsync(id);

                return Ok(new
                {
                    success = true,
                    message = $"Se importaron {count} participantes de la sesión activa.",
                    count = count
                });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error importando sesión para sorteo {id}");
                return StatusCode(500, new { success = false, message = "Error importando sesión" });
            }
        }
        [HttpGet("statistics")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> GetStatistics()
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { success = false, message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;
                var statistics = await _raffleService.GetStatisticsAsync(channelName);

                return Ok(new
                {
                    success = true,
                    statistics = statistics
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo estadísticas de sorteos");
                return StatusCode(500, new { success = false, message = "Error obteniendo estadísticas" });
            }
        }
    }

    // ========================================================================
    // DTOs
    // ========================================================================

    public class RaffleCreateDto
    {
        public string Name { get; set; }
        public string? Description { get; set; }
        public int WinnersCount { get; set; } = 1;
        public object? Config { get; set; }
    }

    public class RaffleUpdateDto
    {
        public string Name { get; set; }
        public string? Description { get; set; }
        public int WinnersCount { get; set; }
        public object? Config { get; set; }
    }

    public class DrawWinnersDto
    {
        public bool Weighted { get; set; } = false;
    }

    public class RerollWinnerDto
    {
        public string Reason { get; set; } = "Not present in chat";
    }

    public class AddParticipantDto
    {
        public string Username { get; set; }
        public int Tickets { get; set; } = 1;
    }
}
