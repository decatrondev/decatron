using Decatron.Attributes;
using Decatron.Core.Models;
using Decatron.Core.Resolvers;
using Decatron.Services;
using Decatron.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TimerModel = Decatron.Core.Models.Timer;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TimersController : ControllerBase
    {
        private readonly ITimerService _timerService;
        private readonly IPermissionService _permissionService;
        private readonly ILogger<TimersController> _logger;
        private readonly TwitchBotService _botService;
        private readonly VariableResolver _variableResolver;
        private readonly DecatronDbContext _context;

        public TimersController(
            ITimerService timerService,
            IPermissionService permissionService,
            ILogger<TimersController> logger,
            TwitchBotService botService,
            VariableResolver variableResolver,
            DecatronDbContext context)
        {
            _timerService = timerService;
            _permissionService = permissionService;
            _logger = logger;
            _botService = botService;
            _variableResolver = variableResolver;
            _context = context;
        }

        private async Task<(long channelOwnerId, string channelName)?> GetActiveChannelContext()
        {
            try
            {
                long channelOwnerId;

                // PRIORIDAD 1: Obtener canal activo desde la sesión (después de switch)
                var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
                if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
                {
                    channelOwnerId = sessionId;
                    _logger.LogInformation($"[Timers] Using channel from session: {channelOwnerId}");
                }
                // PRIORIDAD 2: Usar el claim del JWT si existe
                else
                {
                    var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
                    if (!string.IsNullOrEmpty(channelOwnerIdClaim) && long.TryParse(channelOwnerIdClaim, out var claimId))
                    {
                        channelOwnerId = claimId;
                        _logger.LogInformation($"[Timers] Using channel from JWT claim: {channelOwnerId}");
                    }
                    // PRIORIDAD 3: Por defecto, usar el propio canal del usuario
                    else
                    {
                        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                        if (!long.TryParse(userIdClaim, out var userId))
                        {
                            _logger.LogWarning("No se pudo obtener UserId");
                            return null;
                        }
                        channelOwnerId = userId;
                        _logger.LogInformation($"[Timers] Using user's own channel: {channelOwnerId}");
                    }
                }

                // Obtener el nombre del canal desde la BD
                var channel = await _context.Users
                    .Where(u => u.Id == channelOwnerId && u.IsActive)
                    .Select(u => new { u.Login })
                    .FirstOrDefaultAsync();

                if (channel == null)
                {
                    _logger.LogWarning($"No se encontró canal con ID {channelOwnerId}");
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
        /// Obtiene todos los timers del canal activo
        /// </summary>
        [HttpGet]
        [RequirePermission("timers")]
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
                var timers = await _timerService.GetAllByChannelAsync(channelName);

                _logger.LogInformation($"Cargando {timers.Count} timers para el canal {channelName} (ID: {channelOwnerId})");

                return Ok(new
                {
                    success = true,
                    timers = timers,
                    count = timers.Count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo timers");
                return StatusCode(500, new { success = false, message = "Error obteniendo timers" });
            }
        }

        /// <summary>
        /// Obtiene un timer por ID
        /// </summary>
        [HttpGet("{id}")]
        [RequirePermission("timers")]
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

                var timer = await _timerService.GetByIdAsync(id);
                if (timer == null)
                {
                    return NotFound(new { success = false, message = "Timer no encontrado" });
                }

                // Verificar que el timer pertenece al canal activo
                if (!timer.ChannelName.Equals(channelName, StringComparison.OrdinalIgnoreCase))
                {
                    return Forbid();
                }

                return Ok(new { success = true, timer });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error obteniendo timer {id}");
                return StatusCode(500, new { success = false, message = "Error obteniendo timer" });
            }
        }

        /// <summary>
        /// Crea un nuevo timer
        /// </summary>
        [HttpPost]
        [RequirePermission("timers")]
        public async Task<IActionResult> Create([FromBody] TimerCreateDto dto)
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

                var timer = new TimerModel
                {
                    ChannelName = channelName,
                    Name = dto.Name,
                    Message = dto.Message,
                    IntervalMinutes = dto.IntervalMinutes,
                    IntervalMessages = dto.IntervalMessages,
                    StreamStatus = dto.StreamStatus ?? "online",
                    Priority = dto.Priority,
                    IsActive = dto.IsActive ?? true,
                    CategoryName = dto.CategoryName,
                    CreatedBy = long.Parse(userId)
                };

                var created = await _timerService.CreateAsync(timer);

                _logger.LogInformation($"Timer '{timer.Name}' creado en canal {channelName} (ID: {channelOwnerId})");

                return Ok(new
                {
                    success = true,
                    message = "Timer creado exitosamente",
                    timer = created
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
                _logger.LogError(ex, "Error creando timer");
                return StatusCode(500, new { success = false, message = "Error creando timer" });
            }
        }

        /// <summary>
        /// Actualiza un timer existente
        /// </summary>
        [HttpPut("{id}")]
        [RequirePermission("timers")]
        public async Task<IActionResult> Update(int id, [FromBody] TimerUpdateDto dto)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { success = false, message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;

                // Verificar que el timer existe y pertenece al canal activo
                var existing = await _timerService.GetByIdAsync(id);
                if (existing == null)
                {
                    return NotFound(new { success = false, message = "Timer no encontrado" });
                }

                if (!existing.ChannelName.Equals(channelName, StringComparison.OrdinalIgnoreCase))
                {
                    return Forbid();
                }

                // Actualizar campos
                existing.Name = dto.Name;
                existing.Message = dto.Message;
                existing.IntervalMinutes = dto.IntervalMinutes;
                existing.IntervalMessages = dto.IntervalMessages;
                existing.StreamStatus = dto.StreamStatus ?? "online";
                existing.Priority = dto.Priority;
                existing.IsActive = dto.IsActive ?? true;
                existing.CategoryName = dto.CategoryName;

                var updated = await _timerService.UpdateAsync(existing);

                _logger.LogInformation($"Timer '{existing.Name}' actualizado en canal {channelName} (ID: {channelOwnerId})");

                return Ok(new
                {
                    success = true,
                    message = "Timer actualizado exitosamente",
                    timer = updated
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
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error actualizando timer {id}");
                return StatusCode(500, new { success = false, message = "Error actualizando timer" });
            }
        }

        /// <summary>
        /// Elimina un timer
        /// </summary>
        [HttpDelete("{id}")]
        [RequirePermission("timers")]
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

                // Verificar que el timer existe y pertenece al canal activo
                var timer = await _timerService.GetByIdAsync(id);
                if (timer == null)
                {
                    return NotFound(new { success = false, message = "Timer no encontrado" });
                }

                if (!timer.ChannelName.Equals(channelName, StringComparison.OrdinalIgnoreCase))
                {
                    return Forbid();
                }

                await _timerService.DeleteAsync(id);

                return Ok(new
                {
                    success = true,
                    message = "Timer eliminado exitosamente"
                });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error eliminando timer {id}");
                return StatusCode(500, new { success = false, message = "Error eliminando timer" });
            }
        }

        /// <summary>
        /// Ejecuta un timer manualmente para testing
        /// No actualiza contadores ni estadísticas, solo envía el mensaje resuelto
        /// </summary>
        [HttpPost("{id}/test")]
        [RequirePermission("timers")]
        public async Task<IActionResult> Test(int id)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { success = false, message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, channelName) = channelContext.Value;

                // Obtener el timer
                var timer = await _timerService.GetByIdAsync(id);
                if (timer == null)
                {
                    return NotFound(new { success = false, message = "Timer no encontrado" });
                }

                // Verificar que el timer pertenece al canal activo
                if (!timer.ChannelName.Equals(channelName, StringComparison.OrdinalIgnoreCase))
                {
                    return Forbid();
                }

                // Verificar que el canal está conectado
                var connectedChannels = _botService.GetConnectedChannels();
                if (!connectedChannels.Any(c => c.Equals(channelName, StringComparison.OrdinalIgnoreCase)))
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "El bot no está conectado al canal. Por favor, conecta el bot primero."
                    });
                }

                // Resolver variables del sistema en el mensaje
                var context = new VariableContext(channelName, $"timer:test:{timer.Name}", channelName);
                var resolvedMessage = await _variableResolver.ResolveAsync(timer.Message, context);

                // Enviar mensaje al chat
                await _botService.SendMessage(channelName, resolvedMessage);

                _logger.LogInformation($"🧪 [TEST] Timer '{timer.Name}' ejecutado manualmente en {channelName} (ID: {channelOwnerId})");

                return Ok(new
                {
                    success = true,
                    message = "Timer enviado exitosamente",
                    data = new
                    {
                        originalMessage = timer.Message,
                        resolvedMessage = resolvedMessage,
                        channelName = channelName,
                        timerName = timer.Name
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error testeando timer {id}");
                return StatusCode(500, new
                {
                    success = false,
                    message = "Error ejecutando test del timer"
                });
            }
        }
    }

    /// <summary>
    /// DTO para crear un timer
    /// </summary>
    public class TimerCreateDto
    {
        public string Name { get; set; }
        public string Message { get; set; }
        public int IntervalMinutes { get; set; } = 5;
        public int IntervalMessages { get; set; } = 5;
        public string? StreamStatus { get; set; } = "online";
        public int Priority { get; set; } = 1;
        public bool? IsActive { get; set; } = true;
        public string? CategoryName { get; set; }
    }

    /// <summary>
    /// DTO para actualizar un timer
    /// </summary>
    public class TimerUpdateDto
    {
        public string Name { get; set; }
        public string Message { get; set; }
        public int IntervalMinutes { get; set; }
        public int IntervalMessages { get; set; }
        public string? StreamStatus { get; set; }
        public int Priority { get; set; }
        public bool? IsActive { get; set; }
        public string? CategoryName { get; set; }
    }
}
