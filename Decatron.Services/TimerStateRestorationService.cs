using Decatron.Core.Helpers;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    /// <summary>
    /// Background Service que restaura el estado de los timers al iniciar el servidor
    /// </summary>
    public class TimerStateRestorationService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<TimerStateRestorationService> _logger;

        public TimerStateRestorationService(
            IServiceProvider serviceProvider,
            ILogger<TimerStateRestorationService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try
            {
                _logger.LogInformation("🔄 TimerStateRestorationService iniciado");

                // Esperar 5 segundos para que la base de datos y otros servicios se inicialicen
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

                _logger.LogInformation("🔄 Iniciando restauración de estados de timers...");

                await RestoreTimerStatesAsync();

                _logger.LogInformation("✅ TimerStateRestorationService completado");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error en TimerStateRestorationService");
            }
        }

        private async Task RestoreTimerStatesAsync()
        {
            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var overlayNotificationService = scope.ServiceProvider.GetRequiredService<OverlayNotificationService>();

            // Obtener todos los timer_states (incluyendo stopped para sincronizar totalTime)
            var allStates = await dbContext.TimerStates.ToListAsync();

            if (allStates.Count == 0)
            {
                _logger.LogInformation("ℹ️ No hay timers para procesar");
                return;
            }

            var activeStates = allStates.Where(s => s.Status == "running" || s.Status == "paused").ToList();
            var stoppedStates = allStates.Where(s => s.Status == "stopped").ToList();

            _logger.LogInformation($"🔄 Encontrados {activeStates.Count} timer(s) activo(s) y {stoppedStates.Count} detenido(s) para procesar");

            foreach (var state in activeStates)
            {
                try
                {
                    _logger.LogInformation($"🔄 Restaurando timer para canal: {state.ChannelName}");

                    // Obtener la configuración para sincronizar el TotalTime
                    var config = await dbContext.TimerConfigs
                        .FirstOrDefaultAsync(c => c.ChannelName == state.ChannelName);

                    if (config == null)
                    {
                        _logger.LogWarning($"⚠️ No se encontró configuración para {state.ChannelName}, saltando restauración");
                        continue;
                    }

                    // Sincronizar TotalTime con la configuración
                    var originalTotalTime = state.TotalTime;
                    // FIX: No sobrescribir TotalTime con DefaultDuration si el timer está activo.
                    // Esto borraba el tiempo añadido por eventos (ej: +20h) al reiniciar el servidor.
                    // state.TotalTime = config.DefaultDuration; 
                    
                    _logger.LogInformation($"[RESTORE] Timer {state.ChannelName}: Persisted TotalTime={originalTotalTime}s (Config Default={config.DefaultDuration}s)");

                    // Calcular tiempo transcurrido basado en timestamps
                    var elapsedSeconds = 0;
                    var wasRunning = state.Status == "running";

                    if (state.Status == "running" && state.StartedAt.HasValue)
                    {
                        // Timer estaba corriendo: calcular tiempo desde que inició
                        var totalElapsed = (DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(state.StartedAt.Value)).TotalSeconds;
                        elapsedSeconds = (int)(totalElapsed - state.ElapsedPausedTime);
                    }
                    else if (state.Status == "paused" && state.StartedAt.HasValue && state.PausedAt.HasValue)
                    {
                        // Timer estaba pausado: calcular tiempo hasta la pausa
                        var elapsedBeforePause = (TimerDateTimeHelper.NormalizeToUtc(state.PausedAt.Value) - TimerDateTimeHelper.NormalizeToUtc(state.StartedAt.Value)).TotalSeconds;
                        elapsedSeconds = (int)(elapsedBeforePause - state.ElapsedPausedTime);
                    }

                    // Limitar elapsed al total
                    elapsedSeconds = Math.Max(0, Math.Min(elapsedSeconds, state.TotalTime));

                    // Calcular tiempo restante
                    var newCurrentTime = Math.Max(0, state.TotalTime - elapsedSeconds);

                    // Si el tiempo se agotó, detener el timer
                    if (newCurrentTime <= 0)
                    {
                        _logger.LogInformation($"⏱️ Timer de {state.ChannelName} se agotó durante el reinicio, deteniendo");
                        state.Status = "stopped";
                        state.CurrentTime = 0;
                        state.StartedAt = null;
                        state.PausedAt = null;
                        state.ElapsedPausedTime = 0;

                        await dbContext.SaveChangesAsync();
                        await overlayNotificationService.SendStopTimerAsync(state.ChannelName);
                        continue;
                    }

                    // Actualizar CurrentTime con el valor recalculado
                    state.CurrentTime = newCurrentTime;
                    state.UpdatedAt = TimerDateTimeHelper.NowForDb();

                    await dbContext.SaveChangesAsync();

                    _logger.LogInformation(
                        $"✅ Timer restaurado para {state.ChannelName}: " +
                        $"Status={state.Status}, " +
                        $"TotalTime={state.TotalTime}s (era {originalTotalTime}s), " +
                        $"CurrentTime={state.CurrentTime}s, " +
                        $"Elapsed={elapsedSeconds}s");

                    // Emitir evento SignalR para que el overlay se actualice
                    if (wasRunning)
                    {
                        // Si estaba running, reenviar StartTimer con el tiempo total
                        await overlayNotificationService.SendStartTimerAsync(state.ChannelName, state.TotalTime);
                        _logger.LogInformation($"📡 Evento StartTimer enviado para {state.ChannelName}");
                    }
                    else
                    {
                        // Si estaba pausado, enviar StartTimer seguido de PauseTimer
                        await overlayNotificationService.SendStartTimerAsync(state.ChannelName, state.TotalTime);
                        await Task.Delay(100); // Pequeño delay para asegurar orden
                        await overlayNotificationService.SendPauseTimerAsync(state.ChannelName);
                        _logger.LogInformation($"📡 Eventos StartTimer + PauseTimer enviados para {state.ChannelName}");
                    }

                    // Enviar actualización de estado completo
                    var stateUpdate = new
                    {
                        status = state.Status,
                        currentTime = state.CurrentTime,
                        totalTime = state.TotalTime,
                        startedAt = state.StartedAt,
                        pausedAt = state.PausedAt,
                        elapsedPausedTime = state.ElapsedPausedTime,
                        elapsedSeconds = elapsedSeconds,
                        isVisible = state.IsVisible
                    };

                    await overlayNotificationService.SendTimerStateUpdateAsync(state.ChannelName, stateUpdate);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"❌ Error restaurando timer para {state.ChannelName}");
                }
            }

            _logger.LogInformation($"✅ Restauración completada: {activeStates.Count} timer(s) procesado(s)");

            // Procesar timers detenidos para sincronizar totalTime con config
            if (stoppedStates.Count > 0)
            {
                _logger.LogInformation($"🔄 Sincronizando totalTime para {stoppedStates.Count} timer(s) detenido(s)");

                foreach (var state in stoppedStates)
                {
                    try
                    {
                        var config = await dbContext.TimerConfigs
                            .FirstOrDefaultAsync(c => c.ChannelName == state.ChannelName);

                        if (config == null)
                        {
                            _logger.LogWarning($"⚠️ No se encontró configuración para {state.ChannelName}");
                            continue;
                        }

                        // Sincronizar TotalTime con defaultDuration si difieren
                        if (state.TotalTime != config.DefaultDuration)
                        {
                            _logger.LogInformation($"🔄 Sincronizando totalTime para {state.ChannelName}: {state.TotalTime}s → {config.DefaultDuration}s");
                            state.TotalTime = config.DefaultDuration;
                            state.UpdatedAt = TimerDateTimeHelper.NowForDb();
                            await dbContext.SaveChangesAsync();
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"❌ Error sincronizando timer detenido para {state.ChannelName}");
                    }
                }

                _logger.LogInformation($"✅ Sincronización de timers detenidos completada");
            }
        }
    }
}
