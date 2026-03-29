using System;
using System.Collections.Concurrent;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Core.Helpers;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    public interface IStreamStatusService
    {
        bool IsLive(string broadcasterUserId);
        Task SetStreamOnlineAsync(string broadcasterUserId, string channelName);
        Task SetStreamOfflineAsync(string broadcasterUserId, string channelName);
    }

    public class StreamStatusService : IStreamStatusService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly OverlayNotificationService _overlayService;
        private readonly ILogger<StreamStatusService> _logger;

        // In-memory: broadcasterUserId -> isLive
        private static readonly ConcurrentDictionary<string, bool> _liveStatus = new();

        public StreamStatusService(
            IServiceProvider serviceProvider,
            OverlayNotificationService overlayService,
            ILogger<StreamStatusService> logger)
        {
            _serviceProvider  = serviceProvider;
            _overlayService   = overlayService;
            _logger           = logger;
        }

        public bool IsLive(string broadcasterUserId) =>
            _liveStatus.TryGetValue(broadcasterUserId, out var v) && v;

        public async Task SetStreamOnlineAsync(string broadcasterUserId, string channelName)
        {
            _liveStatus[broadcasterUserId] = true;
            _logger.LogInformation("🟢 [StreamStatus] {Channel} está EN VIVO", channelName);

            var config = await GetStreamTimerConfigAsync(channelName);
            if (config?.AutoPlayOnStreamOnline != true) return;

            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            var state = await db.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelName);

            if (state == null || state.Status == "stopped" || state.Status == "finished")
            {
                _logger.LogInformation("⏭️ [StreamStatus] {Channel}: stream online pero no hay timer activo para reanudar", channelName);
                return;
            }

            // Solo reanudar si fue pausado por stream.offline (stream_paused)
            // Si el streamer pausó manualmente (paused) o por horario (auto_paused), respetar su decisión
            if (state.Status == "stream_paused")
            {
                if (state.PausedAt.HasValue)
                {
                    var pausedDuration = (int)(DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(state.PausedAt.Value)).TotalSeconds;
                    state.ElapsedPausedTime += pausedDuration;
                }
                state.Status    = "running";
                state.PausedAt  = null;
                state.UpdatedAt = TimerDateTimeHelper.NowForDb();
                await db.SaveChangesAsync();

                await _overlayService.SendResumeTimerAsync(channelName);
                _logger.LogInformation("▶️ [StreamStatus] Timer reanudado para {Channel} (stream volvió online)", channelName);
            }
            else if (state.Status == "paused")
            {
                _logger.LogInformation("⏸️ [StreamStatus] {Channel}: stream online pero el timer está en pausa manual — no se reanuda", channelName);
            }
            else if (state.Status == "auto_paused")
            {
                _logger.LogInformation("⏸️ [StreamStatus] {Channel}: stream online pero el timer está en pausa por horario — no se reanuda", channelName);
            }
        }

        public async Task SetStreamOfflineAsync(string broadcasterUserId, string channelName)
        {
            _liveStatus[broadcasterUserId] = false;
            _logger.LogInformation("🔴 [StreamStatus] {Channel} está OFFLINE", channelName);

            var config = await GetStreamTimerConfigAsync(channelName);
            if (config?.AutoStopOnStreamOffline != true) return;

            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            var state = await db.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelName);
            if (state == null || state.Status != "running") return;

            // Pausar como auto_paused (distinto a pausa manual) para que stream.online sepa que puede reanudar
            if (state.StartedAt.HasValue)
            {
                var totalElapsed   = (DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(state.StartedAt.Value)).TotalSeconds;
                var elapsedSeconds = (int)(totalElapsed - state.ElapsedPausedTime);
                state.CurrentTime  = Math.Max(0, state.TotalTime - elapsedSeconds);
            }
            state.Status    = "stream_paused";
            state.PausedAt  = TimerDateTimeHelper.NowForDb();
            state.UpdatedAt = TimerDateTimeHelper.NowForDb();
            await db.SaveChangesAsync();

            await _overlayService.SendPauseTimerAsync(channelName);
            _logger.LogInformation("⏸️ [StreamStatus] Timer en pausa por stream offline para {Channel}", channelName);
        }

        // ── Helpers ───────────────────────────────────────────────────────────────

        private async Task<StreamTimerConfig?> GetStreamTimerConfigAsync(string channelName)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var config = await db.TimerConfigs
                    .FirstOrDefaultAsync(c => c.ChannelName == channelName);

                if (config == null || string.IsNullOrWhiteSpace(config.AdvancedConfig))
                    return null;

                var advanced = JsonSerializer.Deserialize<JsonElement>(config.AdvancedConfig);

                return new StreamTimerConfig
                {
                    AutoPlayOnStreamOnline  = advanced.TryGetProperty("autoPlayOnStreamOnline",  out var p) && p.GetBoolean(),
                    AutoStopOnStreamOffline = advanced.TryGetProperty("autoStopOnStreamOffline", out var s) && s.GetBoolean(),
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[StreamStatus] Error leyendo config de timer para {Channel}", channelName);
                return null;
            }
        }
    }

    public class StreamTimerConfig
    {
        public bool AutoPlayOnStreamOnline  { get; set; }
        public bool AutoStopOnStreamOffline { get; set; }
    }
}
