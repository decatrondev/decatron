using Decatron.Core.Helpers;
using Decatron.Core.Models;
using Decatron.Core.Resolvers;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using TimerModel = Decatron.Core.Models.Timer;

namespace Decatron.Services
{
    /// <summary>
    /// Background Service que ejecuta los timers automáticamente cada 30 segundos
    /// </summary>
    public class TimerBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<TimerBackgroundService> _logger;
        private const int CHECK_INTERVAL_SECONDS = 1; // Revisar cada segundo para precisión máxima
        private readonly Dictionary<string, DateTime> _lastAutoSave = new(); // Control de Auto-Save

        public TimerBackgroundService(
            IServiceProvider serviceProvider,
            ILogger<TimerBackgroundService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
            _logger.LogInformation("⏰ TimerBackgroundService constructor llamado");
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try
            {
                _logger.LogInformation("⏰ TimerBackgroundService iniciado");
                _logger.LogInformation($"⏰ ServiceProvider: {_serviceProvider != null}");
                _logger.LogInformation($"⏰ Logger: {_logger != null}");

                // Esperar 60 segundos antes de empezar (dar tiempo al bot para conectarse)
                _logger.LogInformation("⏰ Esperando 60 segundos antes de iniciar checks...");
                await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken);

                _logger.LogInformation("⏰ Iniciando loop de checks cada 30 segundos");
                while (!stoppingToken.IsCancellationRequested)
                {
                    try
                    {
                        await CheckAndExecuteTimersAsync();
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "❌ Error en TimerBackgroundService");
                    }

                    // Esperar 30 segundos antes del próximo check
                    await Task.Delay(TimeSpan.FromSeconds(CHECK_INTERVAL_SECONDS), stoppingToken);
                }

                _logger.LogInformation("⏰ TimerBackgroundService detenido");
            }
            catch (Exception ex)
            {
                _logger.LogCritical(ex, "❌ FATAL: TimerBackgroundService falló completamente en ExecuteAsync");
                throw; // Re-lanzar para que se vea en consola
            }
        }

        private async Task CheckAndExecuteTimersAsync()
        {
            _logger.LogDebug("⏰ CheckAndExecuteTimersAsync iniciado");

            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var timerService = scope.ServiceProvider.GetRequiredService<ITimerService>();
            var variableResolver = scope.ServiceProvider.GetRequiredService<VariableResolver>();
            var botService = scope.ServiceProvider.GetRequiredService<TwitchBotService>();
            var apiService = scope.ServiceProvider.GetRequiredService<TwitchApiService>();
            var overlayService = scope.ServiceProvider.GetRequiredService<OverlayNotificationService>();

            // Canales con message timers activos
            var channelsWithMessageTimers = await dbContext.Timers
                .Where(t => t.IsActive)
                .Select(t => t.ChannelName)
                .Distinct()
                .ToListAsync();

            // Canales con timer extension corriendo (necesitan auto-save/auto-pause aunque no tengan message timers)
            var channelsWithRunningExtension = await dbContext.TimerStates
                .Where(s => s.Status == "running" || s.Status == "auto_paused" || s.Status == "stream_paused")
                .Select(s => s.ChannelName)
                .Distinct()
                .ToListAsync();

            var channelsWithTimers = channelsWithMessageTimers.Union(channelsWithRunningExtension).Distinct().ToList();

            _logger.LogDebug($"⏰ Encontrados {channelsWithTimers.Count} canales a procesar: {string.Join(", ", channelsWithTimers)}");

            foreach (var channelName in channelsWithTimers)
            {
                try
                {
                    // --- AUTO-PAUSE LOGIC (UPDATED) ---
                    var config = await dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == channelName);
                    var timerState = await dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelName);

                    // Permitir entrar si está corriendo O si está auto-pausado (para verificar si debe reanudar)
                    if (config != null && timerState != null && (timerState.Status == "running" || timerState.Status == "auto_paused" || timerState.Status == "stream_paused"))
                    {
                        try 
                        {
                            // 1. Resolver Zona Horaria
                            DateTime userTime = TimerDateTimeHelper.NowForDb();
                            try
                            {
                                string tzId = config.TimeZone ?? "UTC";
                                var tz = TimeZoneInfo.FindSystemTimeZoneById(tzId);
                                userTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
                                
                                // DEBUG LOG (Opcional, puede ser ruidoso)
                                // _logger.LogInformation($"[AUTO-PAUSE DEBUG] Canal: {channelName} | Zona: {tzId} | Local: {userTime:HH:mm}");
                            } 
                            catch (Exception tzEx) 
                            { 
                                _logger.LogWarning($"Error converting timezone '{config.TimeZone}' for {channelName}: {tzEx.Message}. Using UTC.");
                            }

                            var currentDay = (int)userTime.DayOfWeek; // 0 = Domingo
                            var currentTime = userTime.TimeOfDay;

                            // 2. Obtener Schedules ACTIVOS desde la tabla TimerSchedules
                            var schedules = await dbContext.TimerSchedules
                                .Where(s => s.UserId == config.UserId && s.Enabled)
                                .ToListAsync();

                            bool isInsideSchedule = false;
                            string activeScheduleName = "";

                            foreach (var schedule in schedules)
                            {
                                // Verificar Días (JSON string)
                                bool[] daysList = null;
                                try {
                                    if (!string.IsNullOrEmpty(schedule.DaysOfWeek))
                                    {
                                        daysList = JsonSerializer.Deserialize<bool[]>(schedule.DaysOfWeek);
                                    }
                                } catch {}

                                // Si daysList es null o no coincide el día, continuar
                                if (daysList != null && daysList.Length > currentDay && !daysList[currentDay]) continue;

                                // Verificar Horas
                                var start = schedule.StartTime;
                                var end = schedule.EndTime;

                                bool inside;
                                if (end >= start)
                                    inside = currentTime >= start && currentTime <= end;
                                else
                                    inside = currentTime >= start || currentTime <= end; // Cruza medianoche

                                if (inside)
                                {
                                    isInsideSchedule = true;
                                    activeScheduleName = schedule.Name;
                                    break; // Encontramos uno, no necesitamos buscar más
                                }
                            }

                            // --- LÓGICA DE ESTADO ---

                            // CASO 1: Entrar en pausa (Running -> AutoPaused)
                            if (isInsideSchedule && timerState.Status == "running")
                            {
                                _logger.LogInformation($"⏸️ Auto-Pausa activada para {channelName} (Schedule: {activeScheduleName}, Hora: {userTime:HH:mm})");
                                
                                timerState.Status = "auto_paused"; // Estado especial para diferenciar de pausa manual
                                timerState.PausedAt = TimerDateTimeHelper.NowForDb();
                                timerState.UpdatedAt = TimerDateTimeHelper.NowForDb();
                                await dbContext.SaveChangesAsync();
                                
                                await overlayService.SendPauseTimerAsync(channelName);
                            }
                            // CASO 2: Reanudar (AutoPaused -> Running)
                            else if (!isInsideSchedule && timerState.Status == "auto_paused")
                            {
                                _logger.LogInformation($"▶️ Auto-Reanudar para {channelName} (Fin de horario, Hora: {userTime:HH:mm})");

                                if (timerState.PausedAt.HasValue && timerState.StartedAt.HasValue)
                                {
                                    var pausedDuration = (int)(DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(timerState.PausedAt.Value)).TotalSeconds;
                                    timerState.ElapsedPausedTime += pausedDuration;
                                }

                                timerState.Status = "running";
                                timerState.PausedAt = null;
                                timerState.UpdatedAt = TimerDateTimeHelper.NowForDb();
                                await dbContext.SaveChangesAsync();

                                await overlayService.SendResumeTimerAsync(channelName);
                            }

                            // --- TIMER TICK BROADCAST ---
                            // Emitir tiempo restante cada segundo a todos los clientes conectados
                            if (timerState.Status == "running" && timerState.StartedAt.HasValue)
                            {
                                try
                                {
                                    var totalElapsedTick = (int)(DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(timerState.StartedAt.Value)).TotalSeconds - timerState.ElapsedPausedTime;
                                    var remainingTick = Math.Max(0, timerState.TotalTime - totalElapsedTick);
                                    await overlayService.SendTimerTickAsync(channelName, remainingTick);
                                }
                                catch (Exception tickEx)
                                {
                                    _logger.LogError(tickEx, $"Error enviando TimerTick para {channelName}");
                                }
                            }

                            // --- AUTO-SAVE LOGIC (NUEVO) ---
                            // Guardar respaldo cada 5 minutos si está corriendo
                            if (timerState.Status == "running")
                            {
                                if (!_lastAutoSave.ContainsKey(channelName))
                                {
                                    _lastAutoSave[channelName] = TimerDateTimeHelper.NowForDb(); // Primera vez, marcamos inicio
                                }

                                var timeSinceLastSave = DateTime.UtcNow - _lastAutoSave[channelName];
                                if (timeSinceLastSave.TotalMinutes >= 5)
                                {
                                    try 
                                    {
                                        // Calcular estado actual preciso
                                        var elapsedSeconds = 0;
                                        if (timerState.StartedAt.HasValue)
                                        {
                                            var totalElapsed = (DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(timerState.StartedAt.Value)).TotalSeconds;
                                            elapsedSeconds = (int)(totalElapsed - timerState.ElapsedPausedTime);
                                        }
                                        
                                        // Limitar elapsed
                                        elapsedSeconds = Math.Max(0, elapsedSeconds);
                                        
                                        // Calcular restante
                                        var remainingSeconds = Math.Max(0, timerState.TotalTime - elapsedSeconds);

                                        // Crear o Actualizar Backup Automático (vinculado a la sesión actual)
                                        var currentSessionId = timerState.CurrentSessionId;
                                        var existingBackup = await dbContext.TimerSessionBackups
                                            .Where(b => b.ChannelName == channelName && b.Reason == "auto_save"
                                                     && b.TimerSessionId == currentSessionId)
                                            .OrderByDescending(b => b.CreatedAt)
                                            .FirstOrDefaultAsync();

                                        // Si existe un backup de esta misma sesión reciente (menos de 24h), lo actualizamos
                                        if (existingBackup != null && (DateTime.UtcNow - existingBackup.CreatedAt).TotalHours < 24)
                                        {
                                            existingBackup.RemainingSeconds = remainingSeconds;
                                            existingBackup.TotalElapsedSeconds = elapsedSeconds;
                                            existingBackup.TotalDurationAtSnapshot = timerState.TotalTime;
                                            existingBackup.CreatedAt = TimerDateTimeHelper.NowForDb();

                                            _logger.LogInformation($"💾 [AUTO-SAVE] Respaldo actualizado para {channelName} (Sesión: {currentSessionId}, Restan: {remainingSeconds}s)");
                                        }
                                        else
                                        {
                                            // Crear nuevo si no hay o es de otra sesión
                                            var autoBackup = new TimerSessionBackup
                                            {
                                                ChannelName = channelName,
                                                RemainingSeconds = remainingSeconds,
                                                TotalElapsedSeconds = elapsedSeconds,
                                                TotalDurationAtSnapshot = timerState.TotalTime,
                                                TimerSessionId = currentSessionId,
                                                Reason = "auto_save",
                                                CreatedAt = DateTime.UtcNow
                                            };
                                            dbContext.TimerSessionBackups.Add(autoBackup);
                                            _logger.LogInformation($"💾 [AUTO-SAVE] Nuevo respaldo creado para {channelName} (Sesión: {currentSessionId})");
                                        }

                                        await dbContext.SaveChangesAsync();
                                        _lastAutoSave[channelName] = TimerDateTimeHelper.NowForDb();
                                    }
                                    catch (Exception saveEx)
                                    {
                                        _logger.LogError(saveEx, $"Error en Auto-Save para {channelName}");
                                    }
                                }
                            }
                        }
                        catch (Exception apEx)
                        {
                            _logger.LogError(apEx, $"Error processing auto-pause/save for {channelName}");
                        }
                    }

                    // Verificar si el canal está conectado al bot
                    var connectedChannels = botService.GetConnectedChannels();
                    if (!connectedChannels.Any(c => c.Equals(channelName, StringComparison.OrdinalIgnoreCase)))
                    {
                        _logger.LogDebug($"⏭️ Canal {channelName} no está conectado, saltando timers");
                        continue;
                    }

                    // Verificar si el stream está online y obtener categoría actual
                    var (isOnline, currentCategory) = await GetStreamInfoAsync(apiService, channelName);

                    // Obtener timers listos para ejecutar (con filtro de categoría)
                    var timersReady = await timerService.GetTimersReadyToExecuteAsync(channelName, isOnline, currentCategory);

                    if (timersReady.Count == 0)
                    {
                        continue;
                    }

                    _logger.LogDebug($"⏰ {timersReady.Count} timer(s) listos para ejecutar en {channelName}");

                    // Obtener configuración global del canal
                    var settings = await dbContext.SystemSettings
                        .Where(s => dbContext.Users.Any(u => u.Id == s.UserId && u.Login == channelName))
                        .FirstOrDefaultAsync();

                    if (settings == null || !settings.TimersEnabled)
                    {
                        continue;
                    }

                    var cooldownSeconds = settings.TimerGlobalCooldownSeconds;

                    // Ejecutar los timers en orden de prioridad con delay configurado
                    foreach (var timer in timersReady.OrderBy(t => t.Priority))
                    {
                        try
                        {
                            // Resolver variables del sistema en el mensaje
                            var context = new VariableContext(channelName, $"timer:{timer.Name}", "Bot");
                            var resolvedMessage = await variableResolver.ResolveAsync(timer.Message, context);

                            // Enviar mensaje
                            await botService.SendMessage(channelName, resolvedMessage);

                            // Actualizar registro de ejecución
                            await timerService.UpdateTimerExecutionAsync(timer.Id);

                            _logger.LogInformation($"⏰ [{channelName}] Timer enviado: {timer.Name}");

                            // Esperar el cooldown global antes de enviar el siguiente timer
                            if (cooldownSeconds > 0 && timersReady.Count > 1)
                            {
                                await Task.Delay(TimeSpan.FromSeconds(cooldownSeconds));
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, $"❌ Error ejecutando timer {timer.Name} en {channelName}");
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"❌ Error procesando timers para canal {channelName}");
                }
            }
        }

        /// <summary>
        /// Verifica si un stream está online y obtiene la categoría actual
        /// </summary>
        private async Task<(bool isOnline, string currentCategory)> GetStreamInfoAsync(TwitchApiService apiService, string channelName)
        {
            try
            {
                // Obtener el ID del usuario
                var userData = await apiService.GetUserByLoginAsync(channelName);
                if (userData == null)
                {
                    _logger.LogWarning($"⚠️ No se pudo obtener usuario {channelName}");
                    return (false, null);
                }

                // Verificar si el stream está online y obtener categoría
                var streamData = await apiService.GetStreamAsync(userData.id);
                if (streamData != null)
                {
                    // Stream está online, retornar categoría actual
                    return (true, streamData.game_name);
                }

                // Stream está offline
                return (false, null);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, $"⚠️ Error obteniendo información del stream {channelName}, asumiendo offline");
                return (false, null);
            }
        }
    }
}
