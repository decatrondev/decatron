using System.Security.Claims;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Controllers
{
    [Authorize]
    [Route("api/timer/backup")]
    [ApiController]
    public class TimerBackupController : ControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly ILogger<TimerBackupController> _logger;
        private readonly Decatron.Services.OverlayNotificationService _overlayService;

        public TimerBackupController(
            DecatronDbContext dbContext,
            ILogger<TimerBackupController> logger,
            Decatron.Services.OverlayNotificationService overlayService)
        {
            _dbContext = dbContext;
            _logger = logger;
            _overlayService = overlayService;
        }

        private long GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(userIdClaim, out var userId)) return userId;
            throw new UnauthorizedAccessException("User not found");
        }

        /// <summary>
        /// Obtiene el ID del canal que se está gestionando (respeta jerarquía de permisos)
        /// </summary>
        private long GetChannelOwnerId()
        {
            // PRIORIDAD 1: Obtener canal activo desde la sesión (después de switch)
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
            {
                return sessionId;
            }

            // PRIORIDAD 2: Usar el claim del JWT si existe
            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
            {
                return channelOwnerId;
            }

            // PRIORIDAD 3: Por defecto, usar el propio canal del usuario
            return GetUserId();
        }

        private async Task<string> GetChannelNameAsync()
        {
            var targetUserId = GetChannelOwnerId();
            var user = await _dbContext.Users.FindAsync(targetUserId);
            return user?.Login?.ToLower() ?? throw new Exception("Channel not found");
        }

        /// <summary>
        /// Crea un respaldo manual del estado actual del timer
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateBackup([FromBody] CreateBackupRequest request)
        {
            try
            {
                var channelName = await GetChannelNameAsync();
                var currentState = await _dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelName);

                int remaining = request.RemainingSeconds;
                int elapsed = request.TotalElapsedSeconds;
                int totalDuration = request.TotalDurationAtSnapshot;

                if (currentState != null && request.UseServerState)
                {
                    remaining = currentState.CurrentTime;
                }

                var backup = new TimerSessionBackup
                {
                    ChannelName = channelName,
                    RemainingSeconds = remaining,
                    TotalElapsedSeconds = elapsed,
                    TotalDurationAtSnapshot = totalDuration,
                    TimerSessionId = currentState?.CurrentSessionId,
                    Reason = request.Reason ?? "manual",
                    CreatedAt = DateTime.UtcNow
                };

                _dbContext.TimerSessionBackups.Add(backup);
                await _dbContext.SaveChangesAsync();

                _logger.LogInformation($"💾 Respaldo creado para {channelName}: {remaining}s restantes (Sesión: {currentState?.CurrentSessionId})");

                return Ok(new { success = true, message = "Respaldo guardado correctamente", backupId = backup.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creando respaldo del timer");
                return StatusCode(500, new { success = false, message = "Error al guardar respaldo" });
            }
        }

        /// <summary>
        /// Obtiene una lista de los últimos respaldos, enriquecida con info de sesión
        /// </summary>
        [HttpGet("list")]
        public async Task<IActionResult> GetBackups([FromQuery] int limit = 5)
        {
            try
            {
                var channelName = await GetChannelNameAsync();

                var backups = await _dbContext.TimerSessionBackups
                    .Where(b => b.ChannelName == channelName)
                    .OrderByDescending(b => b.CreatedAt)
                    .Take(limit)
                    .ToListAsync();

                // Enriquecer con info de sesión si existe el vínculo
                var sessionIds = backups
                    .Where(b => b.TimerSessionId.HasValue)
                    .Select(b => b.TimerSessionId!.Value)
                    .Distinct()
                    .ToList();

                var sessions = sessionIds.Any()
                    ? await _dbContext.TimerSessions
                        .Where(s => sessionIds.Contains(s.Id))
                        .ToDictionaryAsync(s => s.Id)
                    : new Dictionary<int, TimerSession>();

                var result = backups.Select(b =>
                {
                    TimerSession? session = b.TimerSessionId.HasValue && sessions.TryGetValue(b.TimerSessionId.Value, out var s) ? s : null;
                    return new
                    {
                        b.Id,
                        b.ChannelName,
                        b.RemainingSeconds,
                        b.TotalElapsedSeconds,
                        b.TotalDurationAtSnapshot,
                        b.TimerSessionId,
                        b.Reason,
                        b.CreatedAt,
                        sessionStartedAt = session?.StartedAt,
                        sessionTotalAddedTime = session?.TotalAddedTime
                    };
                });

                return Ok(new { success = true, backups = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo lista de respaldos");
                return StatusCode(500, new { success = false, message = "Error al obtener respaldos" });
            }
        }

        /// <summary>
        /// Obtiene el backup más reciente vinculado a una sesión específica
        /// </summary>
        [HttpGet("by-session/{sessionId}")]
        public async Task<IActionResult> GetBackupBySession(int sessionId)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var channelName = await GetChannelNameAsync();

                _logger.LogInformation($"[BACKUP DEBUG] Buscando backup para sesión {sessionId}, ChannelOwnerId: {channelOwnerId}, ChannelName: '{channelName}'");

                var backup = await _dbContext.TimerSessionBackups
                    .Where(b => b.ChannelName == channelName && b.TimerSessionId == sessionId)
                    .OrderByDescending(b => b.CreatedAt)
                    .FirstOrDefaultAsync();

                if (backup == null)
                {
                    _logger.LogWarning($"[BACKUP DEBUG] No se encontró backup para sesión {sessionId} en canal '{channelName}'");
                    return Ok(new { success = true, backup = (object?)null });
                }

                _logger.LogInformation($"[BACKUP DEBUG] Backup encontrado: ID={backup.Id}, RemainingSeconds={backup.RemainingSeconds}");
                return Ok(new { success = true, backup });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo backup por sesión");
                return StatusCode(500, new { success = false, message = "Error al obtener respaldo" });
            }
        }

        /// <summary>
        /// Crea un backup temporal para una sesión específica y restaura el timer con ese tiempo
        /// </summary>
        [HttpPost("restore-session")]
        public async Task<IActionResult> RestoreSessionWithTime([FromBody] RestoreSessionRequest request)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var channelName = await GetChannelNameAsync();

                _logger.LogInformation($"[RESTORE DEBUG] RestoreSession - ChannelOwnerId: {channelOwnerId}, ChannelName: '{channelName}', SessionId: {request.SessionId}");

                // Verificar que la sesión existe y pertenece a este canal
                var session = await _dbContext.TimerSessions.FindAsync(request.SessionId);
                if (session == null)
                {
                    _logger.LogWarning($"[RESTORE DEBUG] Sesión {request.SessionId} no existe");
                    return NotFound(new { success = false, message = "Sesión no encontrada" });
                }

                if (session.ChannelName != channelName)
                {
                    _logger.LogWarning($"[RESTORE DEBUG] Mismatch: Sesión.ChannelName='{session.ChannelName}' vs Resuelto='{channelName}'");
                    return NotFound(new { success = false, message = "Sesión no encontrada" });
                }

                // Crear backup on-the-fly vinculado a la sesión
                var backup = new TimerSessionBackup
                {
                    ChannelName = channelName,
                    RemainingSeconds = request.RemainingSeconds,
                    TotalElapsedSeconds = 0,
                    TotalDurationAtSnapshot = request.RemainingSeconds,
                    TimerSessionId = request.SessionId,
                    Reason = "manual_restore",
                    CreatedAt = DateTime.UtcNow
                };
                _dbContext.TimerSessionBackups.Add(backup);
                await _dbContext.SaveChangesAsync();

                // Obtener o crear estado del timer
                var state = await _dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelName);
                if (state == null)
                {
                    state = new TimerState { ChannelName = channelName };
                    _dbContext.TimerStates.Add(state);
                }

                // Restaurar valores de tiempo
                state.Status = "paused";
                state.CurrentTime = request.RemainingSeconds;
                state.TotalTime = request.RemainingSeconds;
                state.StartedAt = DateTime.UtcNow;
                state.PausedAt = DateTime.UtcNow;
                state.ElapsedPausedTime = 0;
                state.IsVisible = true; // Asegurar que el overlay sea visible al restaurar
                state.UpdatedAt = DateTime.UtcNow;

                // Reactivar la sesión exacta
                session.EndedAt = null;
                state.CurrentSessionId = session.Id;

                await _dbContext.SaveChangesAsync();

                await _overlayService.SendTimerStateUpdateAsync(channelName, new
                {
                    status = "paused",
                    currentTime = state.CurrentTime,
                    totalTime = state.TotalTime,
                    startedAt = state.StartedAt,
                    pausedAt = state.PausedAt
                });

                await _overlayService.NotifyTimerConfigChangedAsync(channelName);

                _logger.LogInformation($"🔄 Timer restaurado manualmente para {channelName} (Sesión: {session.Id}, Tiempo: {request.RemainingSeconds}s)");

                return Ok(new { success = true, message = "Sesión restaurada correctamente (en pausa)" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en RestoreSessionWithTime");
                return StatusCode(500, new { success = false, message = "Error al restaurar la sesión" });
            }
        }

        /// <summary>
        /// Restaura el timer usando un respaldo específico
        /// </summary>
        [HttpPost("restore/{id}")]
        public async Task<IActionResult> RestoreBackup(int id)
        {
            try
            {
                var channelName = await GetChannelNameAsync();
                var backup = await _dbContext.TimerSessionBackups.FindAsync(id);

                if (backup == null || backup.ChannelName != channelName)
                {
                    return NotFound(new { success = false, message = "Respaldo no encontrado" });
                }

                // Obtener o crear estado del timer
                var state = await _dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelName);
                if (state == null)
                {
                    state = new TimerState { ChannelName = channelName };
                    _dbContext.TimerStates.Add(state);
                }

                // Restaurar valores de tiempo
                state.Status = "paused";
                state.CurrentTime = backup.RemainingSeconds;
                state.TotalTime = backup.RemainingSeconds;
                state.StartedAt = DateTime.UtcNow;
                state.PausedAt = DateTime.UtcNow;
                state.ElapsedPausedTime = 0;
                state.IsVisible = true; // Asegurar que el overlay sea visible al restaurar
                state.UpdatedAt = DateTime.UtcNow;

                // Restaurar Offset de Tiempo Transcurrido en configuración
                var config = await _dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == channelName);
                if (config != null)
                {
                    try
                    {
                        var advancedConfigDict = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(config.AdvancedConfig)
                                                 ?? new Dictionary<string, object>();
                        advancedConfigDict["initialTimeOffset"] = backup.TotalElapsedSeconds;
                        config.AdvancedConfig = System.Text.Json.JsonSerializer.Serialize(advancedConfigDict);
                        config.DefaultDuration = backup.RemainingSeconds;
                        _logger.LogInformation($"🔄 Offset restaurado a {backup.TotalElapsedSeconds}s");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error actualizando offset durante restauración");
                    }
                }

                // Reactivar la sesión EXACTA vinculada al backup
                if (backup.TimerSessionId.HasValue)
                {
                    var linkedSession = await _dbContext.TimerSessions.FindAsync(backup.TimerSessionId.Value);
                    if (linkedSession != null && linkedSession.ChannelName == channelName)
                    {
                        linkedSession.EndedAt = null; // Reactivar
                        state.CurrentSessionId = linkedSession.Id;
                        _logger.LogInformation($"🔄 Sesión exacta {linkedSession.Id} reactivada desde backup {id}");
                    }
                }
                else
                {
                    // Fallback para backups viejos sin SessionId: buscar última sesión reciente
                    var lastSession = await _dbContext.TimerSessions
                        .Where(s => s.ChannelName == channelName)
                        .OrderByDescending(s => s.StartedAt)
                        .FirstOrDefaultAsync();

                    if (lastSession != null && lastSession.EndedAt.HasValue
                        && (DateTime.UtcNow - lastSession.EndedAt.Value).TotalHours < 24)
                    {
                        lastSession.EndedAt = null;
                        state.CurrentSessionId = lastSession.Id;
                        _logger.LogInformation($"🔄 [FALLBACK] Sesión {lastSession.Id} reactivada (backup sin SessionId)");
                    }
                }

                await _dbContext.SaveChangesAsync();

                // Notificar al overlay
                await _overlayService.SendTimerStateUpdateAsync(channelName, new
                {
                    status = "paused",
                    currentTime = state.CurrentTime,
                    totalTime = state.TotalTime,
                    startedAt = state.StartedAt,
                    pausedAt = state.PausedAt
                });

                await _overlayService.NotifyTimerConfigChangedAsync(channelName);

                _logger.LogInformation($"🔄 Timer restaurado desde backup {id} para {channelName} (Sesión: {state.CurrentSessionId})");

                return Ok(new { success = true, message = "Timer restaurado exitosamente (en pausa)" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error restaurando backup");
                return StatusCode(500, new { success = false, message = "Error al restaurar respaldo" });
            }
        }
    }

    public class CreateBackupRequest
    {
        public int RemainingSeconds { get; set; }
        public int TotalElapsedSeconds { get; set; }
        public int TotalDurationAtSnapshot { get; set; }
        public string? Reason { get; set; }
        public bool UseServerState { get; set; } = false;
    }

    public class RestoreSessionRequest
    {
        public int SessionId { get; set; }
        public int RemainingSeconds { get; set; }
    }
}
