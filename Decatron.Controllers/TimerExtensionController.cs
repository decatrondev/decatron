using System.Collections.Concurrent;
using System.Security.Claims;
using System.Text.Json;
using Decatron.Core.Helpers;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Controllers
{
    /// <summary>
    /// Controlador para la extensión visual del Timer (Overlay, Configuración, Historial)
    /// </summary>
    [Authorize]
    [Route("api/timer")]
    [ApiController]
    public class TimerExtensionController : ControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly ILogger<TimerExtensionController> _logger;
        private readonly Decatron.Services.OverlayNotificationService _overlayNotificationService;
        private readonly Decatron.Services.TimerEventService _timerEventService;

        public TimerExtensionController(
            DecatronDbContext dbContext,
            ILogger<TimerExtensionController> logger,
            Decatron.Services.OverlayNotificationService overlayNotificationService,
            Decatron.Services.TimerEventService timerEventService)
        {
            _dbContext = dbContext;
            _logger = logger;
            _overlayNotificationService = overlayNotificationService;
            _timerEventService = timerEventService;
        }

        /// <summary>
        /// Obtiene el ID del usuario autenticado
        /// </summary>
        private long GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(userIdClaim, out var userId))
                return userId;
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
            var userId = GetUserId();
            return userId;
        }

        /// <summary>
        /// Obtiene el username del propietario del canal
        /// </summary>
        private async Task<string?> GetChannelUsernameAsync(long channelOwnerId)
        {
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == channelOwnerId);
            return user?.Login?.ToLower();
        }

        // ========================================================================
        // CONFIGURATION ENDPOINTS
        // ========================================================================

        [HttpGet("config")]
        public async Task<IActionResult> GetConfiguration()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                _logger.LogInformation($"Obteniendo configuración de timer para canal: {username} (ID: {channelOwnerId})");

                var config = await _dbContext.TimerConfigs
                    .FirstOrDefaultAsync(c => c.ChannelName == username);

                if (config == null)
                {
                    // Retornar configuración por defecto
                    return Ok(new
                    {
                        success = true,
                        config = new
                        {
                            defaultDuration = 300,
                            autoStart = false,
                            timeZone = "UTC",
                            canvasWidth = 1000,
                            canvasHeight = 300,
                            displayConfig = new { },
                            progressBarConfig = new { },
                            styleConfig = new { },
                            animationConfig = new { },
                            themeConfig = new { },
                            eventsConfig = new { },
                            commandsConfig = new { },
                            alertsConfig = new { },
                            goalConfig = new { },
                            advancedConfig = new { },
                            historyConfig = new { }
                        }
                    });
                }

                // Preparar HistoryConfig inyectando los logs reales de la BD
                var historyConfigDict = JsonSerializer.Deserialize<Dictionary<string, object>>(config.HistoryConfig) ?? new Dictionary<string, object>();
                
                // Obtener logs reales
                var logs = await _dbContext.TimerEventLogs
                    .Where(l => l.ChannelName == username)
                    .OrderByDescending(l => l.OccurredAt)
                    .Take(100)
                    .Select(l => new
                    {
                        id = l.Id.ToString(),
                        timestamp = l.OccurredAt,
                        eventType = l.EventType,
                        username = l.Username,
                        timeAdded = l.TimeAdded,
                        details = l.Details ?? ""
                    })
                    .ToListAsync();

                historyConfigDict["logs"] = logs;

                return Ok(new
                {
                    success = true,
                    config = new
                    {
                        defaultDuration = config.DefaultDuration,
                        autoStart = config.AutoStart,
                        maxChances = config.MaxChances,
                        resurrectionMessage = config.ResurrectionMessage, // Nuevo
                        gameOverMessage = config.GameOverMessage, // Nuevo
                        timeZone = config.TimeZone,
                        canvasWidth = config.CanvasWidth,
                        canvasHeight = config.CanvasHeight,
                        displayConfig = JsonSerializer.Deserialize<object>(config.DisplayConfig),
                        progressBarConfig = JsonSerializer.Deserialize<object>(config.ProgressBarConfig),
                        styleConfig = JsonSerializer.Deserialize<object>(config.StyleConfig),
                        animationConfig = JsonSerializer.Deserialize<object>(config.AnimationConfig),
                        themeConfig = JsonSerializer.Deserialize<object>(config.ThemeConfig),
                        eventsConfig = JsonSerializer.Deserialize<object>(config.EventsConfig),
                        commandsConfig = JsonSerializer.Deserialize<object>(config.CommandsConfig),
                        alertsConfig = JsonSerializer.Deserialize<object>(config.AlertsConfig),
                        goalConfig = JsonSerializer.Deserialize<object>(config.GoalConfig),
                        advancedConfig = JsonSerializer.Deserialize<object>(config.AdvancedConfig),
                        historyConfig = historyConfigDict
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener configuración del timer");
                return StatusCode(500, new { success = false, message = "Error al obtener configuración" });
            }
        }

        [HttpPost("config")]
        public async Task<IActionResult> SaveConfiguration([FromBody] TimerConfigRequest request)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                _logger.LogInformation($"Guardando configuración de timer para canal: {username} (ID: {channelOwnerId})");

                var config = await _dbContext.TimerConfigs
                    .FirstOrDefaultAsync(c => c.ChannelName == username);

                if (config == null)
                {
                    config = new TimerConfig
                    {
                        UserId = channelOwnerId,
                        ChannelName = username,
                        DefaultDuration = request.DefaultDuration,
                        AutoStart = request.AutoStart,
                        MaxChances = request.MaxChances,
                        ResurrectionMessage = request.ResurrectionMessage, // Nuevo
                        GameOverMessage = request.GameOverMessage, // Nuevo
                        TimeZone = request.TimeZone ?? "UTC",
                        CanvasWidth = request.CanvasWidth,
                        CanvasHeight = request.CanvasHeight,
                        DisplayConfig = JsonSerializer.Serialize(request.DisplayConfig ?? new { }),
                        ProgressBarConfig = JsonSerializer.Serialize(request.ProgressBarConfig ?? new { }),
                        StyleConfig = JsonSerializer.Serialize(request.StyleConfig ?? new { }),
                        AnimationConfig = JsonSerializer.Serialize(request.AnimationConfig ?? new { }),
                        ThemeConfig = JsonSerializer.Serialize(request.ThemeConfig ?? new { }),
                        EventsConfig = JsonSerializer.Serialize(request.EventsConfig ?? new { }),
                        CommandsConfig = JsonSerializer.Serialize(request.CommandsConfig ?? new { }),
                        AlertsConfig = JsonSerializer.Serialize(request.AlertsConfig ?? new { }),
                        GoalConfig = JsonSerializer.Serialize(request.GoalConfig ?? new { }),
                        AdvancedConfig = JsonSerializer.Serialize(request.AdvancedConfig ?? new { }),
                        HistoryConfig = JsonSerializer.Serialize(request.HistoryConfig ?? new { }),
                        CreatedAt = TimerDateTimeHelper.NowForDb(),
                        UpdatedAt = DateTime.UtcNow
                    };

                    _dbContext.TimerConfigs.Add(config);
                }
                else
                {
                    config.DefaultDuration = request.DefaultDuration;
                    config.AutoStart = request.AutoStart;
                    config.MaxChances = request.MaxChances;
                    config.ResurrectionMessage = request.ResurrectionMessage; // Nuevo
                    config.GameOverMessage = request.GameOverMessage; // Nuevo
                    config.TimeZone = request.TimeZone ?? "UTC";
                    config.CanvasWidth = request.CanvasWidth;
                    config.CanvasHeight = request.CanvasHeight;
                    config.DisplayConfig = JsonSerializer.Serialize(request.DisplayConfig ?? new { });
                    config.ProgressBarConfig = JsonSerializer.Serialize(request.ProgressBarConfig ?? new { });
                    config.StyleConfig = JsonSerializer.Serialize(request.StyleConfig ?? new { });
                    config.AnimationConfig = JsonSerializer.Serialize(request.AnimationConfig ?? new { });
                    config.ThemeConfig = JsonSerializer.Serialize(request.ThemeConfig ?? new { });
                    config.EventsConfig = JsonSerializer.Serialize(request.EventsConfig ?? new { });
                    config.CommandsConfig = JsonSerializer.Serialize(request.CommandsConfig ?? new { });
                    config.AlertsConfig = JsonSerializer.Serialize(request.AlertsConfig ?? new { });
                    config.GoalConfig = JsonSerializer.Serialize(request.GoalConfig ?? new { });
                    config.AdvancedConfig = JsonSerializer.Serialize(request.AdvancedConfig ?? new { });
                    config.HistoryConfig = JsonSerializer.Serialize(request.HistoryConfig ?? new { });
                    config.UpdatedAt = TimerDateTimeHelper.NowForDb();
                }

                await _dbContext.SaveChangesAsync();

                // Fase 4: Registrar entrada en historial si se configuró un offset de migración
                try
                {
                    var advancedJson = request.AdvancedConfig != null
                        ? JsonSerializer.Serialize(request.AdvancedConfig)
                        : "{}";
                    var advancedDoc = System.Text.Json.JsonDocument.Parse(advancedJson);
                    if (advancedDoc.RootElement.TryGetProperty("initialTimeOffset", out var offsetEl))
                    {
                        var offsetSeconds = offsetEl.GetInt32();
                        if (offsetSeconds > 0)
                        {
                            var alreadyLogged = await _dbContext.TimerEventLogs
                                .AnyAsync(l => l.ChannelName == username && l.EventType == "migration_offset"
                                            && l.TimeAdded == offsetSeconds);
                            if (!alreadyLogged)
                            {
                                _dbContext.TimerEventLogs.Add(new Decatron.Core.Models.TimerEventLog
                                {
                                    ChannelName = username,
                                    EventType = "migration_offset",
                                    Username = username,
                                    TimeAdded = offsetSeconds,
                                    Details = $"Tiempo base acumulado configurado: {offsetSeconds / 3600}h {(offsetSeconds % 3600) / 60}m",
                                    EventData = JsonSerializer.Serialize(new { offsetSeconds, source = "migration" }),
                                    OccurredAt = TimerDateTimeHelper.NowForDb(),
                                    CreatedAt = DateTime.UtcNow
                                });
                                await _dbContext.SaveChangesAsync();
                            }
                        }
                    }
                }
                catch (Exception offsetEx)
                {
                    _logger.LogWarning(offsetEx, "Error registrando historial de offset para {Channel}", username);
                }

                // NOTA: NO modificar TotalTime/CurrentTime de un timer activo al guardar config.
                // defaultDuration solo se usa al INICIAR un nuevo timer.
                // Un timer extensible acumula tiempo de subs y su TotalTime crece naturalmente.

                await _overlayNotificationService.NotifyTimerConfigChangedAsync(username);

                return Ok(new { success = true, message = "Configuración guardada correctamente" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al guardar configuración del timer");
                return StatusCode(500, new { success = false, message = "Error al guardar configuración" });
            }
        }

        [HttpPost("config/reset")]
        public async Task<IActionResult> ResetConfiguration()
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var config = await _dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == username);
                if (config != null) _dbContext.TimerConfigs.Remove(config);

                var templates = await _dbContext.TimerTemplates.Where(t => t.UserId == userId).ToListAsync();
                _dbContext.TimerTemplates.RemoveRange(templates);

                var schedules = await _dbContext.TimerSchedules.Where(s => s.UserId == userId).ToListAsync();
                _dbContext.TimerSchedules.RemoveRange(schedules);

                var happyHours = await _dbContext.TimerHappyHours.Where(h => h.UserId == userId).ToListAsync();
                _dbContext.TimerHappyHours.RemoveRange(happyHours);

                var logs = await _dbContext.TimerEventLogs.Where(l => l.ChannelName == username).ToListAsync();
                _dbContext.TimerEventLogs.RemoveRange(logs);
                
                var sessions = await _dbContext.TimerSessions.Where(s => s.ChannelName == username).ToListAsync();
                _dbContext.TimerSessions.RemoveRange(sessions);

                var cooldowns = await _dbContext.TimerEventCooldowns.Where(c => c.ChannelName == username).ToListAsync();
                _dbContext.TimerEventCooldowns.RemoveRange(cooldowns);

                var state = await _dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == username);

                if (state != null)
                {
                    state.Status = "stopped";
                    state.CurrentTime = 300;
                    state.TotalTime = 300;
                    state.StartedAt = null;
                    state.PausedAt = null;
                    state.ElapsedPausedTime = 0;
                    state.IsVisible = false;
                    state.CurrentSessionId = null;
                    state.UpdatedAt = TimerDateTimeHelper.NowForDb();
                }

                var newConfig = new TimerConfig
                {
                    UserId = channelOwnerId,
                    ChannelName = username,
                    DefaultDuration = 300,
                    AutoStart = false,
                    TimeZone = "UTC",
                    CanvasWidth = 1000,
                    CanvasHeight = 300,
                    DisplayConfig = "{}",
                    ProgressBarConfig = "{}",
                    StyleConfig = "{}",
                    AnimationConfig = "{}",
                    ThemeConfig = "{}",
                    EventsConfig = "{}",
                    CommandsConfig = "{}",
                    AlertsConfig = "{}",
                    GoalConfig = "{}",
                    AdvancedConfig = "{}",
                    HistoryConfig = "{}",
                    CreatedAt = TimerDateTimeHelper.NowForDb(),
                    UpdatedAt = DateTime.UtcNow
                };
                _dbContext.TimerConfigs.Add(newConfig);

                await _dbContext.SaveChangesAsync();

                await _overlayNotificationService.NotifyConfigurationChangedAsync(username);
                await _overlayNotificationService.SendStopTimerAsync(username);

                return Ok(new { success = true, message = "Cuenta de Timer reiniciada a fábrica totalmente." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al resetear configuración del timer");
                return StatusCode(500, new { success = false, message = "Error al restaurar configuración" });
            }
        }

        // ========================================================================
        // STATE & CONTROL ENDPOINTS
        // ========================================================================

        [HttpGet("state/current")]
        public async Task<IActionResult> GetCurrentState()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var state = await _dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == username);

                if (state == null)
                {
                    return Ok(new
                    {
                        success = true,
                        state = new
                        {
                            status = "stopped",
                            currentTime = 0,
                            totalTime = 0,
                            isVisible = false,
                            elapsedSeconds = 0
                        }
                    });
                }

                var elapsedSeconds = 0;
                if (state.Status == "running" && state.StartedAt.HasValue)
                {
                    var totalElapsed = (DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(state.StartedAt.Value)).TotalSeconds;
                    elapsedSeconds = (int)(totalElapsed - state.ElapsedPausedTime);
                }
                else if (state.Status == "paused" || state.Status == "auto_paused" || state.Status == "stream_paused")
                {
                    if (state.StartedAt.HasValue && state.PausedAt.HasValue)
                    {
                        var elapsedBeforePause = (TimerDateTimeHelper.NormalizeToUtc(state.PausedAt.Value) - TimerDateTimeHelper.NormalizeToUtc(state.StartedAt.Value)).TotalSeconds;
                        elapsedSeconds = (int)(elapsedBeforePause - state.ElapsedPausedTime);
                    }
                }

                elapsedSeconds = Math.Max(0, Math.Min(elapsedSeconds, state.TotalTime));

                return Ok(new
                {
                    success = true,
                    state = new
                    {
                        status = state.Status,
                        currentTime = state.CurrentTime,
                        totalTime = state.TotalTime,
                        startedAt = state.StartedAt,
                        pausedAt = state.PausedAt,
                        elapsedPausedTime = state.ElapsedPausedTime,
                        elapsedSeconds = elapsedSeconds,
                        isVisible = state.IsVisible,
                        channelName = username
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener estado del timer para usuario actual");
                return StatusCode(500, new { success = false, message = "Error al obtener estado" });
            }
        }

        [HttpGet("state/{channel}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetState(string channel)
        {
            try
            {
                var channelLower = channel.ToLower();
                var state = await _dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);

                if (state == null)
                {
                    return Ok(new
                    {
                        success = true,
                        state = new
                        {
                            status = "stopped",
                            currentTime = 0,
                            totalTime = 0,
                            isVisible = false,
                            elapsedSeconds = 0
                        }
                    });
                }

                var elapsedSeconds = 0;
                if (state.Status == "running" && state.StartedAt.HasValue)
                {
                    var totalElapsed = (DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(state.StartedAt.Value)).TotalSeconds;
                    elapsedSeconds = (int)(totalElapsed - state.ElapsedPausedTime);
                }
                else if (state.Status == "paused" || state.Status == "auto_paused" || state.Status == "stream_paused")
                {
                    if (state.StartedAt.HasValue && state.PausedAt.HasValue)
                    {
                        var elapsedBeforePause = (TimerDateTimeHelper.NormalizeToUtc(state.PausedAt.Value) - TimerDateTimeHelper.NormalizeToUtc(state.StartedAt.Value)).TotalSeconds;
                        elapsedSeconds = (int)(elapsedBeforePause - state.ElapsedPausedTime);
                    }
                }

                elapsedSeconds = Math.Max(0, Math.Min(elapsedSeconds, state.TotalTime));

                return Ok(new
                {
                    success = true,
                    state = new
                    {
                        status = state.Status,
                        currentTime = state.CurrentTime,
                        totalTime = state.TotalTime,
                        startedAt = state.StartedAt,
                        pausedAt = state.PausedAt,
                        elapsedPausedTime = state.ElapsedPausedTime,
                        elapsedSeconds = elapsedSeconds,
                        isVisible = state.IsVisible
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener estado del timer");
                return StatusCode(500, new { success = false, message = "Error al obtener estado" });
            }
        }

        [HttpPost("control")]
        public async Task<IActionResult> ControlTimer([FromBody] TimerControlRequest request)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var state = await _dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == username);

                switch (request.Action.ToLower())
                {
                    case "start":
                        if (state == null)
                        {
                            state = new TimerState
                            {
                                ChannelName = username,
                                Status = "running",
                                CurrentTime = request.Duration ?? 300,
                                TotalTime = request.Duration ?? 300,
                                StartedAt = TimerDateTimeHelper.NowForDb(),
                                IsVisible = true,
                                CreatedAt = TimerDateTimeHelper.NowForDb(),
                                UpdatedAt = DateTime.UtcNow
                            };
                            _dbContext.TimerStates.Add(state);
                        }
                        else
                        {
                            state.Status = "running";
                            state.CurrentTime = request.Duration ?? state.CurrentTime;
                            state.TotalTime = request.Duration ?? state.TotalTime;
                            state.ElapsedPausedTime = 0;
                            state.StartedAt = TimerDateTimeHelper.NowForDb();
                            state.IsVisible = true;
                            state.UpdatedAt = TimerDateTimeHelper.NowForDb();
                        }

                        if (state.CurrentSessionId.HasValue)
                        {
                            var oldSession = await _dbContext.TimerSessions.FindAsync(state.CurrentSessionId.Value);
                            if (oldSession != null && !oldSession.EndedAt.HasValue)
                            {
                                oldSession.EndedAt = TimerDateTimeHelper.NowForDb();
                            }
                        }

                        var newSession = new TimerSession
                        {
                            ChannelName = username,
                            StartedAt = TimerDateTimeHelper.NowForDb(),
                            InitialDuration = state.CurrentTime,
                            TotalAddedTime = 0
                        };
                        _dbContext.TimerSessions.Add(newSession);
                        await _dbContext.SaveChangesAsync();

                        state.CurrentSessionId = newSession.Id;
                        await _dbContext.SaveChangesAsync();
                        break;

                    case "pause":
                        if (state != null && (state.Status == "running" || state.Status == "auto_paused" || state.Status == "stream_paused"))
                        {
                            if (state.StartedAt.HasValue)
                            {
                                var totalElapsed = (DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(state.StartedAt.Value)).TotalSeconds;
                                var elapsedSeconds = (int)(totalElapsed - state.ElapsedPausedTime);
                                var remainingSeconds = Math.Max(0, state.TotalTime - elapsedSeconds);
                                state.CurrentTime = remainingSeconds;
                            }

                            state.Status = "paused";
                            state.PausedAt = TimerDateTimeHelper.NowForDb();
                            state.UpdatedAt = TimerDateTimeHelper.NowForDb();
                        }
                        break;

                    case "resume":
                        if (state != null && (state.Status == "paused" || state.Status == "auto_paused" || state.Status == "stream_paused"))
                        {
                            if (state.PausedAt.HasValue && state.StartedAt.HasValue)
                            {
                                var pausedDuration = (int)(DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(state.PausedAt.Value)).TotalSeconds;
                                state.ElapsedPausedTime += pausedDuration;
                            }
                            state.Status = "running";
                            state.PausedAt = null;
                            state.UpdatedAt = TimerDateTimeHelper.NowForDb();
                        }
                        break;

                    case "reset":
                        if (state != null)
                        {
                            // Crear backup ANTES de cerrar la sesión
                            if (state.CurrentSessionId.HasValue)
                            {
                                int remainingSeconds = state.CurrentTime;
                                int totalElapsedSeconds = 0;

                                if (state.Status == "running" && state.StartedAt.HasValue)
                                {
                                    var totalElapsed = (DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(state.StartedAt.Value)).TotalSeconds;
                                    var elapsedSecs = (int)(totalElapsed - state.ElapsedPausedTime);
                                    remainingSeconds = Math.Max(0, state.TotalTime - elapsedSecs);
                                    totalElapsedSeconds = elapsedSecs;
                                }
                                else if ((state.Status == "paused" || state.Status == "auto_paused" || state.Status == "stream_paused") && state.TotalTime > 0)
                                {
                                    remainingSeconds = state.CurrentTime;
                                    totalElapsedSeconds = state.TotalTime - state.CurrentTime;
                                }

                                if (remainingSeconds > 0 || totalElapsedSeconds > 0)
                                {
                                    var resetBackup = new TimerSessionBackup
                                    {
                                        ChannelName = username,
                                        RemainingSeconds = remainingSeconds,
                                        TotalElapsedSeconds = totalElapsedSeconds,
                                        TotalDurationAtSnapshot = state.TotalTime,
                                        TimerSessionId = state.CurrentSessionId,
                                        Reason = "manual_reset",
                                        CreatedAt = DateTime.UtcNow
                                    };
                                    _dbContext.TimerSessionBackups.Add(resetBackup);
                                    _logger.LogInformation($"💾 Backup creado en reset para {username}: {remainingSeconds}s restantes (Sesión: {state.CurrentSessionId})");
                                }

                                var session = await _dbContext.TimerSessions.FindAsync(state.CurrentSessionId.Value);
                                if (session != null) session.EndedAt = TimerDateTimeHelper.NowForDb();
                                state.CurrentSessionId = null;
                            }

                            state.Status = "stopped";
                            state.CurrentTime = state.TotalTime;
                            state.StartedAt = null;
                            state.PausedAt = null;
                            state.StoppedAt = TimerDateTimeHelper.NowForDb();
                            state.ElapsedPausedTime = 0;
                            state.UpdatedAt = TimerDateTimeHelper.NowForDb();
                        }
                        break;

                    case "stop":
                        if (state != null)
                        {
                            // Crear backup ANTES de cerrar la sesión
                            if (state.CurrentSessionId.HasValue)
                            {
                                int remainingSeconds = state.CurrentTime;
                                int totalElapsedSeconds = 0;

                                if (state.Status == "running" && state.StartedAt.HasValue)
                                {
                                    var totalElapsed = (DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(state.StartedAt.Value)).TotalSeconds;
                                    var elapsedSecs = (int)(totalElapsed - state.ElapsedPausedTime);
                                    remainingSeconds = Math.Max(0, state.TotalTime - elapsedSecs);
                                    totalElapsedSeconds = elapsedSecs;
                                }
                                else if ((state.Status == "paused" || state.Status == "auto_paused" || state.Status == "stream_paused") && state.TotalTime > 0)
                                {
                                    remainingSeconds = state.CurrentTime;
                                    totalElapsedSeconds = state.TotalTime - state.CurrentTime;
                                }

                                if (remainingSeconds > 0 || totalElapsedSeconds > 0)
                                {
                                    var stopBackup = new TimerSessionBackup
                                    {
                                        ChannelName = username,
                                        RemainingSeconds = remainingSeconds,
                                        TotalElapsedSeconds = totalElapsedSeconds,
                                        TotalDurationAtSnapshot = state.TotalTime,
                                        TimerSessionId = state.CurrentSessionId,
                                        Reason = "manual_stop",
                                        CreatedAt = DateTime.UtcNow
                                    };
                                    _dbContext.TimerSessionBackups.Add(stopBackup);
                                    _logger.LogInformation($"💾 Backup creado en stop para {username}: {remainingSeconds}s restantes (Sesión: {state.CurrentSessionId})");
                                }

                                var session = await _dbContext.TimerSessions.FindAsync(state.CurrentSessionId.Value);
                                if (session != null) session.EndedAt = TimerDateTimeHelper.NowForDb();
                                state.CurrentSessionId = null;
                            }

                            state.Status = "stopped";
                            state.CurrentTime = 0;
                            state.StartedAt = null;
                            state.PausedAt = null;
                            state.StoppedAt = TimerDateTimeHelper.NowForDb();
                            state.IsVisible = false;
                            state.ElapsedPausedTime = 0;
                            state.UpdatedAt = TimerDateTimeHelper.NowForDb();
                        }
                        break;

                    case "addtime":
                        if (state != null && request.TimeToAdd.HasValue)
                        {
                            state.CurrentTime += request.TimeToAdd.Value;
                            state.TotalTime += request.TimeToAdd.Value;
                            state.UpdatedAt = TimerDateTimeHelper.NowForDb();

                            if (state.CurrentSessionId.HasValue)
                            {
                                var session = await _dbContext.TimerSessions.FindAsync(state.CurrentSessionId.Value);
                                if (session != null) session.TotalAddedTime += request.TimeToAdd.Value;

                                var eventLog = new TimerEventLog
                                {
                                    ChannelName = username,
                                    EventType = "command",
                                    Username = request.CommandUser ?? "Dashboard",
                                    TimeAdded = request.TimeToAdd.Value,
                                    Details = $"!dtimer +{request.TimeToAdd.Value}s",
                                    EventData = JsonSerializer.Serialize(new { action = "addtime", seconds = request.TimeToAdd.Value }),
                                    TimerSessionId = state.CurrentSessionId,
                                    OccurredAt = TimerDateTimeHelper.NowForDb(),
                                    CreatedAt = DateTime.UtcNow
                                };
                                _dbContext.TimerEventLogs.Add(eventLog);
                            }
                        }
                        break;

                    case "removetime":
                        if (state != null && request.TimeToAdd.HasValue)
                        {
                            var actualRemoved = Math.Min(request.TimeToAdd.Value, state.CurrentTime);
                            state.CurrentTime = Math.Max(0, state.CurrentTime - request.TimeToAdd.Value);
                            state.TotalTime = Math.Max(0, state.TotalTime - request.TimeToAdd.Value);
                            state.UpdatedAt = TimerDateTimeHelper.NowForDb();

                            if (state.CurrentSessionId.HasValue)
                            {
                                var session = await _dbContext.TimerSessions.FindAsync(state.CurrentSessionId.Value);
                                if (session != null) session.TotalAddedTime -= actualRemoved;

                                var eventLog = new TimerEventLog
                                {
                                    ChannelName = username,
                                    EventType = "command",
                                    Username = request.CommandUser ?? "Dashboard",
                                    TimeAdded = -actualRemoved,
                                    Details = $"!dtimer -{request.TimeToAdd.Value}s",
                                    EventData = JsonSerializer.Serialize(new { action = "removetime", seconds = request.TimeToAdd.Value }),
                                    TimerSessionId = state.CurrentSessionId,
                                    OccurredAt = TimerDateTimeHelper.NowForDb(),
                                    CreatedAt = DateTime.UtcNow
                                };
                                _dbContext.TimerEventLogs.Add(eventLog);
                            }
                        }
                        break;

                    default:
                        return BadRequest(new { success = false, message = "Acción no válida" });
                }

                await _dbContext.SaveChangesAsync();

                if (state != null)
                {
                    switch (request.Action.ToLower())
                    {
                        case "start": await _overlayNotificationService.SendStartTimerAsync(username, state.TotalTime); break;
                        case "pause": await _overlayNotificationService.SendPauseTimerAsync(username); break;
                        case "resume": await _overlayNotificationService.SendResumeTimerAsync(username); break;
                        case "reset": await _overlayNotificationService.SendResetTimerAsync(username); break;
                        case "stop": await _overlayNotificationService.SendStopTimerAsync(username); break;
                        case "addtime":
                        case "removetime":
                            var timeChange = request.Action.ToLower() == "removetime" ? -(request.TimeToAdd ?? 0) : (request.TimeToAdd ?? 0);
                            await _overlayNotificationService.SendAddTimeAsync(username, timeChange);
                            break;
                    }
                }

                return Ok(new { success = true, message = $"Timer {request.Action} ejecutado correctamente" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al controlar timer");
                return StatusCode(500, new { success = false, message = "Error al controlar timer" });
            }
        }

        // ========================================================================
        // OVERLAY ENDPOINTS
        // ========================================================================

        [HttpGet("config/overlay/{channel}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetOverlayConfiguration(string channel)
        {
            try
            {
                var channelLower = channel.ToLower();
                var config = await _dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == channelLower);
                var state = await _dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);

                if (config != null && config.AutoStart && state == null)
                {
                    state = new TimerState
                    {
                        ChannelName = channelLower,
                        Status = "running",
                        CurrentTime = config.DefaultDuration,
                        TotalTime = config.DefaultDuration,
                        StartedAt = TimerDateTimeHelper.NowForDb(),
                        ElapsedPausedTime = 0,
                        IsVisible = true,
                        CreatedAt = TimerDateTimeHelper.NowForDb(),
                        UpdatedAt = DateTime.UtcNow
                    };
                    _dbContext.TimerStates.Add(state);

                    var newSession = new TimerSession
                    {
                        ChannelName = channelLower,
                        StartedAt = TimerDateTimeHelper.NowForDb(),
                        InitialDuration = config.DefaultDuration,
                        TotalAddedTime = 0
                    };
                    _dbContext.TimerSessions.Add(newSession);
                    await _dbContext.SaveChangesAsync();

                    state.CurrentSessionId = newSession.Id;
                    await _dbContext.SaveChangesAsync();

                    await _overlayNotificationService.SendStartTimerAsync(channelLower, config.DefaultDuration);
                }

                object configData = config == null ? new { defaultDuration = 300 } : new
                {
                    defaultDuration = config.DefaultDuration,
                    autoStart = config.AutoStart,
                    canvasWidth = config.CanvasWidth,
                    canvasHeight = config.CanvasHeight,
                    displayConfig = JsonSerializer.Deserialize<object>(config.DisplayConfig),
                    progressBarConfig = JsonSerializer.Deserialize<object>(config.ProgressBarConfig),
                    styleConfig = JsonSerializer.Deserialize<object>(config.StyleConfig),
                    animationConfig = JsonSerializer.Deserialize<object>(config.AnimationConfig),
                    themeConfig = JsonSerializer.Deserialize<object>(config.ThemeConfig),
                    eventsConfig = JsonSerializer.Deserialize<object>(config.EventsConfig),
                    commandsConfig = JsonSerializer.Deserialize<object>(config.CommandsConfig),
                    alertsConfig = JsonSerializer.Deserialize<object>(config.AlertsConfig),
                    goalConfig = JsonSerializer.Deserialize<object>(config.GoalConfig),
                    advancedConfig = JsonSerializer.Deserialize<object>(config.AdvancedConfig),
                    historyConfig = JsonSerializer.Deserialize<object>(config.HistoryConfig)
                };

                object stateData;
                if (state == null)
                {
                    stateData = new { status = "stopped", currentTime = 0, totalTime = 0 };
                }
                else
                {
                    var elapsedSeconds = 0;
                    if (state.Status == "running" && state.StartedAt.HasValue)
                    {
                        var totalElapsed = (DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(state.StartedAt.Value)).TotalSeconds;
                        elapsedSeconds = (int)(totalElapsed - state.ElapsedPausedTime);
                    }
                    else if ((state.Status == "paused" || state.Status == "auto_paused" || state.Status == "stream_paused") && state.StartedAt.HasValue && state.PausedAt.HasValue)
                    {
                        var elapsedBeforePause = (TimerDateTimeHelper.NormalizeToUtc(state.PausedAt.Value) - TimerDateTimeHelper.NormalizeToUtc(state.StartedAt.Value)).TotalSeconds;
                        elapsedSeconds = (int)(elapsedBeforePause - state.ElapsedPausedTime);
                    }
                    elapsedSeconds = Math.Min(elapsedSeconds, state.TotalTime);
                    var remainingSeconds = Math.Max(0, state.TotalTime - elapsedSeconds);

                    if (state.Status == "running" || state.Status == "paused" || state.Status == "auto_paused" || state.Status == "stream_paused")
                    {
                        state.CurrentTime = remainingSeconds;
                        state.UpdatedAt = TimerDateTimeHelper.NowForDb();
                        await _dbContext.SaveChangesAsync();
                    }

                    stateData = new
                    {
                        targetSeconds = state.TotalTime,
                        elapsedSeconds = elapsedSeconds,
                        remainingSeconds = remainingSeconds,
                        isPaused = state.Status == "paused" || state.Status == "auto_paused" || state.Status == "stream_paused",
                        startTime = state.StartedAt.HasValue ? new DateTimeOffset(TimerDateTimeHelper.NormalizeToUtc(state.StartedAt.Value), TimeSpan.Zero).ToUnixTimeMilliseconds() : (long?)null,
                        status = state.Status
                    };
                }

                return Ok(new { success = true, config = configData, state = stateData });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al obtener configuración de overlay para canal: {channel}");
                return StatusCode(500, new { success = false, message = "Error al obtener configuración del overlay" });
            }
        }

        [HttpPost("overlay/{channel}/complete")]
        [Authorize]
        public async Task<IActionResult> TimerComplete(string channel)
        {
            try
            {
                var channelLower = channel.ToLower();
                var state = await _dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);

                if (state == null) return Ok(new { success = false, message = "No timer state found" });
                if (state.Status != "running" && state.Status != "auto_paused" && state.Status != "stream_paused") return Ok(new { success = true, message = "Timer was not running" });

                if (state.CurrentSessionId.HasValue)
                {
                    var session = await _dbContext.TimerSessions.FindAsync(state.CurrentSessionId.Value);
                    if (session != null && !session.EndedAt.HasValue) session.EndedAt = TimerDateTimeHelper.NowForDb();
                }

                state.Status = "stopped";
                state.CurrentTime = 0;
                state.StoppedAt = TimerDateTimeHelper.NowForDb();
                state.IsVisible = false;
                state.CurrentSessionId = null;
                state.UpdatedAt = TimerDateTimeHelper.NowForDb();

                await _dbContext.SaveChangesAsync();
                await _overlayNotificationService.SendStopTimerAsync(channelLower);

                return Ok(new { success = true, message = "Timer completed and session closed" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error completing timer for {channel}");
                return StatusCode(500, new { success = false, message = "Error completing timer" });
            }
        }

        // ========================================================================
        // HISTORIAL / SESIONES ENDPOINTS
        // ========================================================================

        [HttpGet("sessions")]
        public async Task<IActionResult> GetTimerSessions()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);
                
                _logger.LogInformation($"[HISTORY DEBUG] Solicitando sesiones para usuario ID: {channelOwnerId}, Username: '{username}'");

                if (string.IsNullOrEmpty(username)) 
                {
                    _logger.LogWarning("[HISTORY DEBUG] Username es nulo o vacío");
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var sessionsList = await _dbContext.TimerSessions
                    .Where(s => s.ChannelName == username)
                    .OrderByDescending(s => s.StartedAt)
                    .Take(20)
                    .Select(s => new
                    {
                        id = s.Id,
                        startedAt = s.StartedAt,
                        endedAt = s.EndedAt,
                        initialDuration = s.InitialDuration,
                        totalAddedTime = s.TotalAddedTime,
                        isActive = !s.EndedAt.HasValue,
                        hasBackup = _dbContext.TimerSessionBackups.Any(b => b.TimerSessionId == s.Id),
                        backupRemainingSeconds = _dbContext.TimerSessionBackups
                            .Where(b => b.TimerSessionId == s.Id)
                            .OrderByDescending(b => b.CreatedAt)
                            .Select(b => (int?)b.RemainingSeconds)
                            .FirstOrDefault(),
                        backupCreatedAt = _dbContext.TimerSessionBackups
                            .Where(b => b.TimerSessionId == s.Id)
                            .OrderByDescending(b => b.CreatedAt)
                            .Select(b => (DateTime?)b.CreatedAt)
                            .FirstOrDefault(),
                        backupReason = _dbContext.TimerSessionBackups
                            .Where(b => b.TimerSessionId == s.Id)
                            .OrderByDescending(b => b.CreatedAt)
                            .Select(b => b.Reason)
                            .FirstOrDefault()
                    })
                    .ToListAsync();

                _logger.LogInformation($"[HISTORY DEBUG] Encontradas {sessionsList.Count} sesiones para {username}");

                return Ok(new { success = true, sessions = sessionsList });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo sesiones del timer");
                return StatusCode(500, new { success = false, message = "Error al obtener sesiones" });
            }
        }

        [HttpGet("sessions/{id}/logs")]
        public async Task<IActionResult> GetSessionLogs(int id, [FromQuery] int limit = 100)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);
                
                _logger.LogInformation($"[HISTORY DEBUG] Solicitando logs para Sesión {id}, Usuario: '{username}'");

                if (string.IsNullOrEmpty(username)) return NotFound(new { success = false, message = "Canal no encontrado" });

                var session = await _dbContext.TimerSessions.FirstOrDefaultAsync(s => s.Id == id && s.ChannelName == username);
                if (session == null) 
                {
                    _logger.LogWarning($"[HISTORY DEBUG] Sesión {id} no encontrada o no pertenece a {username}");
                    return NotFound(new { success = false, message = "Sesión no encontrada" });
                }

                var logs = await _dbContext.TimerEventLogs
                    .Where(l => l.TimerSessionId == id)
                    .OrderByDescending(l => l.OccurredAt)
                    .Take(limit)
                    .Select(l => new
                    {
                        id = l.Id.ToString(),
                        timestamp = l.OccurredAt,
                        eventType = l.EventType,
                        username = l.Username,
                        timeAdded = l.TimeAdded,
                        details = l.Details ?? ""
                    })
                    .ToListAsync();

                _logger.LogInformation($"[HISTORY DEBUG] Encontrados {logs.Count} logs para Sesión {id}");

                return Ok(new { success = true, logs });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error obteniendo logs de la sesión {id}");
                return StatusCode(500, new { success = false, message = "Error al obtener logs" });
            }
        }

        // ========================================================================
        // TEST EVENTS
        // ========================================================================
        [HttpPost("test/event")]
        public async Task<IActionResult> TestEvent([FromBody] TimerTestEventRequest request)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);
                if (string.IsNullOrEmpty(username)) return NotFound(new { success = false, message = "Canal no encontrado" });

                bool result = false;
                string message = "";
                
                // Si AddTime es true, entonces NO es un test simulado, es un evento "real" forzado.
                // isTest = true  -> Solo notificaciones visuales, NO DB updates.
                // isTest = false -> DB updates + notificaciones (Comportamiento real).
                bool isSimulation = !request.AddTime; 

                switch (request.EventType.ToLower())
                {
                    case "bits":
                    case "cheer":
                        result = await _timerEventService.ProcessCheerEventAsync(username, request.Username ?? "TestUser", request.Amount ?? 100, isTest: isSimulation);
                        message = $"Simulado: {request.Amount ?? 100} bits de {request.Username ?? "TestUser"}";
                        break;
                    case "follow":
                        result = await _timerEventService.ProcessFollowEventAsync(username, request.Username ?? "TestFollower", userId: null, isTest: isSimulation);
                        message = $"Simulado: Follow de {request.Username ?? "TestFollower"}";
                        break;
                    case "sub":
                    case "subscribe":
                        if (request.Tier == "Prime")
                        {
                             result = await _timerEventService.ProcessSubscribeEventAsync(username, request.Username ?? "TestSubscriber", "1000", months: request.Amount ?? 1, isPrime: true, isTest: isSimulation);
                             message = $"Simulado: Prime Gaming Sub de {request.Username ?? "TestSubscriber"}";
                        }
                        else
                        {
                             result = await _timerEventService.ProcessSubscribeEventAsync(username, request.Username ?? "TestSubscriber", request.Tier ?? "1000", months: request.Amount ?? 1, isPrime: false, isTest: isSimulation);
                             message = $"Simulado: Sub Tier {request.Tier ?? "1000"} de {request.Username ?? "TestSubscriber"}";
                        }
                        break;
                    case "prime":
                    case "primesub":
                        result = await _timerEventService.ProcessSubscribeEventAsync(username, request.Username ?? "TestPrimeUser", "1000", isPrime: true, isTest: isSimulation);
                        message = $"Simulado: Prime Gaming Sub de {request.Username ?? "TestPrimeUser"}";
                        break;
                    case "giftsub":
                    case "gift":
                        result = await _timerEventService.ProcessGiftSubEventAsync(username, request.Username ?? "TestGifter", request.Amount ?? 1, isTest: isSimulation);
                        message = $"Simulado: {request.Amount ?? 1} gift subs de {request.Username ?? "TestGifter"}";
                        break;
                    case "raid":
                        result = await _timerEventService.ProcessRaidEventAsync(username, request.Username ?? "TestRaider", request.Amount ?? 50, isTest: isSimulation);
                        message = $"Simulado: Raid de {request.Amount ?? 50} viewers de {request.Username ?? "TestRaider"}";
                        break;
                    case "hypetrain":
                    case "hype":
                        result = await _timerEventService.ProcessHypeTrainEventAsync(username, request.Level ?? 1, isTest: isSimulation);
                        message = $"Simulado: Hype Train nivel {request.Level ?? 1}";
                        break;
                    case "tips":
                    case "tip":
                    case "donation":
                        result = await _timerEventService.ProcessTipEventAsync(
                            username,
                            request.Username ?? "TestDonor",
                            request.Amount ?? 5,
                            "USD",
                            request.Message ?? "Test donation message!",
                            isTest: isSimulation);
                        message = $"Simulado: Donación de ${request.Amount ?? 5} de {request.Username ?? "TestDonor"}";
                        break;
                    default: return BadRequest(new { success = false, message = $"Tipo de evento no válido: {request.EventType}" });
                }

                string statusMsg = result 
                    ? (request.AddTime ? " - Tiempo AÑADIDO al Timer Real ✅" : " - Simulación visual enviada (Sin tiempo)") 
                    : " - No se pudo procesar (¿Timer detenido o config desactivada?)";

                return Ok(new { success = result, message = message + statusMsg, eventType = request.EventType });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error simulando evento {request.EventType}");
                return StatusCode(500, new { success = false, message = "Error al simular evento" });
            }
        }
    
        // ========================================================================
        // TEMPLATE MANAGEMENT
        // ========================================================================
        [HttpGet("templates")]
        public async Task<IActionResult> GetTemplates()
        {
            try
            {
                var userId = GetUserId();
                var templates = await _dbContext.TimerTemplates
                    .Where(t => t.UserId == userId)
                    .OrderByDescending(t => t.UpdatedAt)
                    .Select(t => new { t.Id, t.Name, t.Description, t.Icon, t.CreatedAt, t.UpdatedAt })
                    .ToListAsync();
                return Ok(new { success = true, templates });
            }
            catch (Exception ex) { return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." }); }
        }

        [HttpPost("templates")]
        public async Task<IActionResult> CreateTemplate([FromBody] CreateTemplateRequest request)
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);
                if (string.IsNullOrEmpty(username)) return NotFound(new { success = false, message = "Canal no encontrado" });

                if (await _dbContext.TimerTemplates.AnyAsync(t => t.UserId == userId && t.Name == request.Name))
                    return BadRequest(new { success = false, message = "Ya existe una plantilla con ese nombre" });

                var currentConfig = await _dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == username);
                if (currentConfig == null) return NotFound(new { success = false, message = "No hay configuración para guardar" });

                var template = new TimerTemplate
                {
                    UserId = userId,
                    Name = request.Name,
                    Description = request.Description,
                    Icon = request.Icon ?? "📋",
                    DefaultDuration = currentConfig.DefaultDuration,
                    AutoStart = currentConfig.AutoStart,
                    CanvasWidth = currentConfig.CanvasWidth,
                    CanvasHeight = currentConfig.CanvasHeight,
                    DisplayConfig = currentConfig.DisplayConfig,
                    ProgressBarConfig = currentConfig.ProgressBarConfig,
                    StyleConfig = currentConfig.StyleConfig,
                    AnimationConfig = currentConfig.AnimationConfig,
                    ThemeConfig = currentConfig.ThemeConfig,
                    EventsConfig = currentConfig.EventsConfig,
                    AlertsConfig = currentConfig.AlertsConfig,
                    GoalConfig = currentConfig.GoalConfig,
                    CreatedAt = TimerDateTimeHelper.NowForDb(),
                    UpdatedAt = DateTime.UtcNow
                };

                _dbContext.TimerTemplates.Add(template);
                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true, message = "Plantilla creada", template = new { template.Id, template.Name, template.Description, template.Icon, template.CreatedAt } });
            }
            catch (Exception ex) { return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." }); }
        }

        [HttpPut("templates/{id}")]
        public async Task<IActionResult> UpdateTemplate(int id, [FromBody] UpdateTemplateRequest request)
        {
            try
            {
                var userId = GetUserId();
                var template = await _dbContext.TimerTemplates.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
                if (template == null) return NotFound(new { success = false, message = "Plantilla no encontrada" });

                if (!string.IsNullOrEmpty(request.Name) && request.Name != template.Name)
                {
                    if (await _dbContext.TimerTemplates.AnyAsync(t => t.UserId == userId && t.Name == request.Name && t.Id != id))
                        return BadRequest(new { success = false, message = "Nombre duplicado" });
                    template.Name = request.Name;
                }
                if (request.Description != null) template.Description = request.Description;
                if (!string.IsNullOrEmpty(request.Icon)) template.Icon = request.Icon;

                template.UpdatedAt = TimerDateTimeHelper.NowForDb();
                await _dbContext.SaveChangesAsync();
                return Ok(new { success = true, message = "Plantilla actualizada" });
            }
            catch (Exception ex) { return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." }); }
        }

        [HttpDelete("templates/{id}")]
        public async Task<IActionResult> DeleteTemplate(int id)
        {
            try
            {
                var userId = GetUserId();
                var template = await _dbContext.TimerTemplates.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
                if (template == null) return NotFound(new { success = false, message = "Plantilla no encontrada" });

                _dbContext.TimerTemplates.Remove(template);
                await _dbContext.SaveChangesAsync();
                return Ok(new { success = true, message = "Plantilla eliminada" });
            }
            catch (Exception ex) { return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." }); }
        }

        [HttpPost("templates/{id}/apply")]
        public async Task<IActionResult> ApplyTemplate(int id, [FromBody] ApplyTemplateRequest request)
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);
                if (string.IsNullOrEmpty(username)) return NotFound(new { success = false, message = "Canal no encontrado" });

                var template = await _dbContext.TimerTemplates.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
                if (template == null) return NotFound(new { success = false, message = "Plantilla no encontrada" });

                var config = await _dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == username);
                if (config == null) return NotFound(new { success = false, message = "Configuración no encontrada" });

                if (request.ApplyBasic) { config.DefaultDuration = template.DefaultDuration; config.AutoStart = template.AutoStart; }
                if (request.ApplyCanvas) { config.CanvasWidth = template.CanvasWidth; config.CanvasHeight = template.CanvasHeight; }
                if (request.ApplyDisplay) config.DisplayConfig = template.DisplayConfig;
                if (request.ApplyProgressBar) config.ProgressBarConfig = template.ProgressBarConfig;
                if (request.ApplyStyle) config.StyleConfig = template.StyleConfig;
                if (request.ApplyAnimation) config.AnimationConfig = template.AnimationConfig;
                if (request.ApplyTheme) config.ThemeConfig = template.ThemeConfig;
                if (request.ApplyEvents) config.EventsConfig = template.EventsConfig;
                if (request.ApplyAlerts) config.AlertsConfig = template.AlertsConfig;
                if (request.ApplyGoal) config.GoalConfig = template.GoalConfig;

                config.UpdatedAt = TimerDateTimeHelper.NowForDb();
                await _dbContext.SaveChangesAsync();
                await _overlayNotificationService.NotifyConfigurationChangedAsync(username);

                return Ok(new { success = true, message = "Plantilla aplicada" });
            }
            catch (Exception ex) { return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." }); }
        }

        // ========================================================================
        // SCHEDULES (AUTO-PAUSE)
        // ========================================================================
        [HttpGet("schedules")]
        public async Task<IActionResult> GetSchedules()
        {
            try
            {
                var userId = GetUserId();
                var schedules = await _dbContext.TimerSchedules.Where(s => s.UserId == userId).OrderBy(s => s.StartTime).ToListAsync();
                var dtos = schedules.Select(s => new { s.Id, s.Name, s.Reason, startTime = s.StartTime.ToString(@"hh\:mm"), endTime = s.EndTime.ToString(@"hh\:mm"), daysOfWeek = s.DaysOfWeek, enabled = s.Enabled, createdAt = s.CreatedAt, updatedAt = s.UpdatedAt });
                return Ok(new { success = true, schedules = dtos });
            }
            catch (Exception ex) { return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." }); }
        }

        [HttpPost("schedules")]
        public async Task<IActionResult> CreateSchedule([FromBody] CreateScheduleRequest request)
        {
            try
            {
                var userId = GetUserId();
                if (request.StartTime >= request.EndTime) return BadRequest(new { success = false, message = "Hora inicio debe ser menor a fin" });

                var schedule = new TimerSchedule
                {
                    UserId = userId,
                    Name = request.Name,
                    Reason = request.Reason,
                    StartTime = request.StartTime,
                    EndTime = request.EndTime,
                    DaysOfWeek = System.Text.Json.JsonSerializer.Serialize(request.DaysOfWeek),
                    Enabled = request.Enabled,
                    CreatedAt = TimerDateTimeHelper.NowForDb(),
                    UpdatedAt = DateTime.UtcNow
                };
                _dbContext.TimerSchedules.Add(schedule);
                await _dbContext.SaveChangesAsync();
                return Ok(new { success = true, message = "Schedule creado", schedule });
            }
            catch (Exception ex) { return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." }); }
        }

        [HttpPut("schedules/{id}")]
        public async Task<IActionResult> UpdateSchedule(int id, [FromBody] UpdateScheduleRequest request)
        {
            try
            {
                var userId = GetUserId();
                var schedule = await _dbContext.TimerSchedules.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);
                if (schedule == null) return NotFound(new { success = false, message = "Schedule no encontrado" });

                if (request.StartTime.HasValue && request.EndTime.HasValue && request.StartTime >= request.EndTime)
                    return BadRequest(new { success = false, message = "Hora inicio debe ser menor a fin" });

                if (!string.IsNullOrEmpty(request.Name)) schedule.Name = request.Name;
                if (request.Reason != null) schedule.Reason = request.Reason;
                if (request.StartTime.HasValue) schedule.StartTime = request.StartTime.Value;
                if (request.EndTime.HasValue) schedule.EndTime = request.EndTime.Value;
                if (request.DaysOfWeek != null) schedule.DaysOfWeek = System.Text.Json.JsonSerializer.Serialize(request.DaysOfWeek);
                if (request.Enabled.HasValue) schedule.Enabled = request.Enabled.Value;

                schedule.UpdatedAt = TimerDateTimeHelper.NowForDb();
                await _dbContext.SaveChangesAsync();
                return Ok(new { success = true, message = "Schedule actualizado" });
            }
            catch (Exception ex) { return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." }); }
        }

        [HttpDelete("schedules/{id}")]
        public async Task<IActionResult> DeleteSchedule(int id)
        {
            try
            {
                var userId = GetUserId();
                var schedule = await _dbContext.TimerSchedules.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);
                if (schedule == null) return NotFound(new { success = false, message = "Schedule no encontrado" });

                _dbContext.TimerSchedules.Remove(schedule);
                await _dbContext.SaveChangesAsync();
                return Ok(new { success = true, message = "Schedule eliminado" });
            }
            catch (Exception ex) { return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." }); }
        }

        // ========================================================================
        // HAPPY HOUR
        // ========================================================================
        [HttpGet("happyhour")]
        public async Task<IActionResult> GetHappyHours()
        {
            try
            {
                var userId = GetChannelOwnerId();
                var happyHours = await _dbContext.TimerHappyHours.Where(h => h.UserId == userId).OrderBy(h => h.StartTime).ToListAsync();
                var dtos = happyHours.Select(h => new { h.Id, h.Name, h.Description, startTime = h.StartTime.ToString(@"hh\:mm"), endTime = h.EndTime.ToString(@"hh\:mm"), multiplier = h.Multiplier, daysOfWeek = h.DaysOfWeek, enabled = h.Enabled, createdAt = h.CreatedAt, updatedAt = h.UpdatedAt });
                return Ok(new { success = true, happyHours = dtos });
            }
            catch (Exception ex) { return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." }); }
        }

        [HttpPost("happyhour")]
        public async Task<IActionResult> CreateHappyHour([FromBody] CreateHappyHourRequest request)
        {
            try
            {
                var userId = GetChannelOwnerId();

                // Fix 5: Validate name is required
                if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest(new { success = false, message = "Name is required" });

                if (request.StartTime >= request.EndTime) return BadRequest(new { success = false, message = "Hora inicio debe ser menor a fin" });
                if (request.Multiplier < 1 || request.Multiplier > 10) return BadRequest(new { success = false, message = "Multiplicador inválido (1-10)" });

                // Fix 4: Validate timezone is configured
                var timerConfig = await _dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.UserId == userId);
                if (timerConfig == null || string.IsNullOrWhiteSpace(timerConfig.TimeZone))
                    return BadRequest(new { success = false, message = "Configura tu zona horaria en la pestaña General antes de crear un Happy Hour" });

                // Fix 2: Check for duplicate Happy Hours (same start_time, end_time, overlapping days)
                var requestDaysJson = System.Text.Json.JsonSerializer.Serialize(request.DaysOfWeek);
                var existingHappyHours = await _dbContext.TimerHappyHours
                    .Where(h => h.UserId == userId && h.StartTime == request.StartTime && h.EndTime == request.EndTime)
                    .ToListAsync();
                foreach (var existing in existingHappyHours)
                {
                    try
                    {
                        var existingDays = System.Text.Json.JsonSerializer.Deserialize<bool[]>(existing.DaysOfWeek);
                        if (existingDays != null && request.DaysOfWeek != null)
                        {
                            bool hasOverlap = false;
                            for (int i = 0; i < Math.Min(existingDays.Length, request.DaysOfWeek.Length); i++)
                            {
                                if (existingDays[i] && request.DaysOfWeek[i]) { hasOverlap = true; break; }
                            }
                            if (hasOverlap)
                                return BadRequest(new { success = false, message = "Ya existe un Happy Hour con el mismo horario y días superpuestos" });
                        }
                    }
                    catch { /* skip malformed entries */ }
                }

                var happyHour = new TimerHappyHour
                {
                    UserId = userId,
                    Name = request.Name,
                    Description = request.Description,
                    StartTime = request.StartTime,
                    EndTime = request.EndTime,
                    Multiplier = request.Multiplier,
                    DaysOfWeek = System.Text.Json.JsonSerializer.Serialize(request.DaysOfWeek),
                    Enabled = request.Enabled,
                    CreatedAt = TimerDateTimeHelper.NowForDb(),
                    UpdatedAt = DateTime.UtcNow
                };
                _dbContext.TimerHappyHours.Add(happyHour);
                await _dbContext.SaveChangesAsync();
                return Ok(new { success = true, message = "Happy Hour creado", happyHour });
            }
            catch (Exception ex) { return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." }); }
        }

        [HttpPut("happyhour/{id}")]
        public async Task<IActionResult> UpdateHappyHour(int id, [FromBody] UpdateHappyHourRequest request)
        {
            try
            {
                var userId = GetChannelOwnerId();
                var happyHour = await _dbContext.TimerHappyHours.FirstOrDefaultAsync(h => h.Id == id && h.UserId == userId);
                if (happyHour == null) return NotFound(new { success = false, message = "Happy Hour no encontrado" });

                if (request.StartTime.HasValue && request.EndTime.HasValue && request.StartTime >= request.EndTime) return BadRequest(new { success = false, message = "Hora inicio debe ser menor a fin" });
                if (request.Multiplier.HasValue && (request.Multiplier < 1 || request.Multiplier > 10)) return BadRequest(new { success = false, message = "Multiplicador inválido" });

                if (!string.IsNullOrEmpty(request.Name)) happyHour.Name = request.Name;
                if (request.Description != null) happyHour.Description = request.Description;
                if (request.StartTime.HasValue) happyHour.StartTime = request.StartTime.Value;
                if (request.EndTime.HasValue) happyHour.EndTime = request.EndTime.Value;
                if (request.Multiplier.HasValue) happyHour.Multiplier = request.Multiplier.Value;
                if (request.DaysOfWeek != null) happyHour.DaysOfWeek = System.Text.Json.JsonSerializer.Serialize(request.DaysOfWeek);
                if (request.Enabled.HasValue) happyHour.Enabled = request.Enabled.Value;

                happyHour.UpdatedAt = TimerDateTimeHelper.NowForDb();
                await _dbContext.SaveChangesAsync();
                return Ok(new { success = true, message = "Happy Hour actualizado" });
            }
            catch (Exception ex) { return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." }); }
        }

        [HttpDelete("happyhour/{id}")]
        public async Task<IActionResult> DeleteHappyHour(int id)
        {
            try
            {
                var userId = GetChannelOwnerId();
                var happyHour = await _dbContext.TimerHappyHours.FirstOrDefaultAsync(h => h.Id == id && h.UserId == userId);
                if (happyHour == null) return NotFound(new { success = false, message = "Happy Hour no encontrado" });

                _dbContext.TimerHappyHours.Remove(happyHour);
                await _dbContext.SaveChangesAsync();
                return Ok(new { success = true, message = "Happy Hour eliminado" });
            }
            catch (Exception ex) { return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." }); }
        }

        [HttpPost("happy-hour/manual-activate")]
        public async Task<IActionResult> ManualActivateHappyHour([FromBody] ManualHappyHourRequest request)
        {
            try
            {
                var userId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(userId);
                if (string.IsNullOrEmpty(username)) return NotFound(new { success = false, message = "Canal no encontrado" });

                if (request.Multiplier < 1 || request.Multiplier > 10) return BadRequest(new { success = false, message = "Multiplicador inválido (1-10)" });
                if (request.DurationMinutes < 1 || request.DurationMinutes > 1440) return BadRequest(new { success = false, message = "Duración inválida (1-1440 minutos)" });

                var manual = new ManualHappyHour
                {
                    Multiplier = (double)request.Multiplier,
                    ExpiresAt = DateTime.UtcNow.AddMinutes(request.DurationMinutes)
                };
                TimerEventService.ManualHappyHours[username] = manual;

                return Ok(new { success = true, message = $"Happy Hour manual activado: {request.Multiplier}x por {request.DurationMinutes} minutos", expiresAt = manual.ExpiresAt });
            }
            catch (Exception ex) { return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." }); }
        }

        [HttpPost("happy-hour/manual-deactivate")]
        public async Task<IActionResult> ManualDeactivateHappyHour()
        {
            try
            {
                var userId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(userId);
                if (string.IsNullOrEmpty(username)) return NotFound(new { success = false, message = "Canal no encontrado" });

                TimerEventService.ManualHappyHours.TryRemove(username, out _);
                return Ok(new { success = true, message = "Happy Hour manual desactivado" });
            }
            catch (Exception ex) { return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." }); }
        }

        [HttpGet("happy-hour/manual-status")]
        public async Task<IActionResult> GetManualHappyHourStatus()
        {
            try
            {
                var userId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(userId);
                if (string.IsNullOrEmpty(username)) return NotFound(new { success = false, message = "Canal no encontrado" });

                if (TimerEventService.ManualHappyHours.TryGetValue(username, out var manual) && DateTime.UtcNow < manual.ExpiresAt)
                {
                    return Ok(new { success = true, active = true, multiplier = manual.Multiplier, expiresAt = manual.ExpiresAt });
                }
                else
                {
                    TimerEventService.ManualHappyHours.TryRemove(username, out _);
                    return Ok(new { success = true, active = false });
                }
            }
            catch (Exception ex) { return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." }); }
        }
    }

    // DTOs
    public class ManualHappyHourRequest
    {
        public decimal Multiplier { get; set; } = 2.0m;
        public int DurationMinutes { get; set; } = 60;
    }

    public class TimerConfigRequest
    {
        public int DefaultDuration { get; set; }
        public bool AutoStart { get; set; }
        public int MaxChances { get; set; } = 0;
        public string? ResurrectionMessage { get; set; } // Nuevo
        public string? GameOverMessage { get; set; } // Nuevo
        public string? TimeZone { get; set; }
        public int CanvasWidth { get; set; } = 1000;
        public int CanvasHeight { get; set; } = 300;
        public object? DisplayConfig { get; set; }
        public object? ProgressBarConfig { get; set; }
        public object? StyleConfig { get; set; }
        public object? AnimationConfig { get; set; }
        public object? ThemeConfig { get; set; }
        public object? EventsConfig { get; set; }
        public object? CommandsConfig { get; set; }
        public object? AlertsConfig { get; set; }
        public object? GoalConfig { get; set; }
        public object? AdvancedConfig { get; set; }
        public object? HistoryConfig { get; set; }
    }

    public class TimerControlRequest
    {
        public string Action { get; set; } = string.Empty;
        public int? Duration { get; set; }
        public int? TimeToAdd { get; set; }
        public string? CommandUser { get; set; }
    }

    public class TimerTestEventRequest
    {
        public string EventType { get; set; } = string.Empty;
        public string? Username { get; set; }
        public int? Amount { get; set; }
        public string? Tier { get; set; }
        public int? Level { get; set; }
        public string? Message { get; set; }
        public bool AddTime { get; set; } = false; // Si true, suma tiempo real. Default false (solo visual).
    }

    public class CreateTemplateRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Icon { get; set; }
    }

    public class UpdateTemplateRequest
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public string? Icon { get; set; }
    }

    public class ApplyTemplateRequest
    {
        public bool ApplyBasic { get; set; } = true;
        public bool ApplyCanvas { get; set; } = true;
        public bool ApplyDisplay { get; set; } = true;
        public bool ApplyProgressBar { get; set; } = true;
        public bool ApplyStyle { get; set; } = true;
        public bool ApplyAnimation { get; set; } = true;
        public bool ApplyTheme { get; set; } = true;
        public bool ApplyEvents { get; set; } = true;
        public bool ApplyAlerts { get; set; } = true;
        public bool ApplyGoal { get; set; } = true;
    }

    public class CreateScheduleRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Reason { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }
        public bool[] DaysOfWeek { get; set; } = new bool[7] { true, true, true, true, true, true, true };
        public bool Enabled { get; set; } = true;
    }

    public class UpdateScheduleRequest
    {
        public string? Name { get; set; }
        public string? Reason { get; set; }
        public TimeSpan? StartTime { get; set; }
        public TimeSpan? EndTime { get; set; }
        public bool[]? DaysOfWeek { get; set; }
        public bool? Enabled { get; set; }
    }

    public class CreateHappyHourRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }
        public decimal Multiplier { get; set; } = 2.0m;
        public bool[] DaysOfWeek { get; set; } = new bool[7] { true, true, true, true, true, true, true };
        public bool Enabled { get; set; } = true;
    }

    public class UpdateHappyHourRequest
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public TimeSpan? StartTime { get; set; }
        public TimeSpan? EndTime { get; set; }
        public decimal? Multiplier { get; set; }
        public bool[]? DaysOfWeek { get; set; }
        public bool? Enabled { get; set; }
    }
}
