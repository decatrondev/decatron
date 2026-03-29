using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Decatron.Services
{
    public interface IWatchTimeTrackingService
    {
        Task TrackUserPresence(string channelId, string userId, string username);
        Task<int> GetWatchTimeMinutes(string channelId, string userId);
        Task ResetStreamWatchTime(string channelId, string? streamId = null);
        Task UpdateWatchTimes();
    }

    /// <summary>
    /// Servicio que rastrea cuánto tiempo los usuarios han estado viendo el stream actual
    /// Se actualiza cada minuto y se resetea cuando el stream termina
    /// </summary>
    public class WatchTimeTrackingService : IWatchTimeTrackingService
    {
        private readonly DecatronDbContext _context;
        private readonly ILogger<WatchTimeTrackingService> _logger;

        public WatchTimeTrackingService(
            DecatronDbContext context,
            ILogger<WatchTimeTrackingService> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Registra que un usuario está presente en el chat
        /// Debe llamarse cada vez que se detecta actividad del usuario
        /// </summary>
        public async Task TrackUserPresence(string channelId, string userId, string username)
        {
            try
            {
                var now = DateTime.UtcNow;

                var watchTime = await _context.StreamWatchTimes
                    .FirstOrDefaultAsync(w => w.ChannelId == channelId && w.UserId == userId);

                if (watchTime == null)
                {
                    // Primera vez que vemos a este usuario en este canal (para este stream)
                    watchTime = new StreamWatchTime
                    {
                        ChannelId = channelId,
                        UserId = userId,
                        Username = username,
                        IsActive = true,
                        SessionStartedAt = now,
                        LastSeenAt = now,
                        TotalMinutes = 0,
                        CreatedAt = now,
                        UpdatedAt = now
                    };

                    _context.StreamWatchTimes.Add(watchTime);
                }
                else
                {
                    // Usuario existente
                    if (!watchTime.IsActive)
                    {
                        // Usuario volvió al chat después de estar inactivo
                        watchTime.IsActive = true;
                        watchTime.SessionStartedAt = now;
                    }

                    watchTime.LastSeenAt = now;
                    watchTime.Username = username; // Actualizar por si cambió
                    watchTime.UpdatedAt = now;
                }

                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error tracking user presence for {username} in channel {channelId}");
            }
        }

        /// <summary>
        /// Obtiene los minutos que un usuario ha estado viendo el stream actual
        /// </summary>
        public async Task<int> GetWatchTimeMinutes(string channelId, string userId)
        {
            try
            {
                var watchTime = await _context.StreamWatchTimes
                    .AsNoTracking()
                    .FirstOrDefaultAsync(w => w.ChannelId == channelId && w.UserId == userId);

                if (watchTime == null)
                {
                    return 0;
                }

                // Si el usuario está activo, sumar el tiempo de la sesión actual
                if (watchTime.IsActive && watchTime.SessionStartedAt.HasValue)
                {
                    var currentSessionMinutes = (int)(DateTime.UtcNow - watchTime.SessionStartedAt.Value).TotalMinutes;
                    return watchTime.TotalMinutes + currentSessionMinutes;
                }

                return watchTime.TotalMinutes;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting watch time for user {userId} in channel {channelId}");
                return 0;
            }
        }

        /// <summary>
        /// Actualiza los tiempos de watch time para todos los usuarios activos
        /// Debe ejecutarse cada minuto desde un BackgroundService
        /// Marca como inactivos a usuarios que no se han visto en 5 minutos
        /// </summary>
        public async Task UpdateWatchTimes()
        {
            try
            {
                var now = DateTime.UtcNow;
                var inactiveThreshold = now.AddMinutes(-5); // 5 minutos sin actividad = inactivo

                // Obtener todos los usuarios activos
                var activeUsers = await _context.StreamWatchTimes
                    .Where(w => w.IsActive)
                    .ToListAsync();

                foreach (var user in activeUsers)
                {
                    // Si no se ha visto en 5 minutos, marcar como inactivo
                    if (user.LastSeenAt < inactiveThreshold)
                    {
                        if (user.SessionStartedAt.HasValue)
                        {
                            // Acumular el tiempo de la sesión que terminó
                            var sessionMinutes = (int)(user.LastSeenAt - user.SessionStartedAt.Value).TotalMinutes;
                            user.TotalMinutes += Math.Max(0, sessionMinutes);
                        }

                        user.IsActive = false;
                        user.SessionStartedAt = null;
                        user.UpdatedAt = now;

                        _logger.LogDebug($"Usuario {user.Username} marcado como inactivo en canal {user.ChannelId} (total: {user.TotalMinutes} min)");
                    }
                }

                if (activeUsers.Count > 0)
                {
                    await _context.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating watch times");
            }
        }

        /// <summary>
        /// Resetea el watch time para un canal cuando un stream termina o inicia uno nuevo
        /// </summary>
        public async Task ResetStreamWatchTime(string channelId, string? streamId = null)
        {
            try
            {
                var watchTimes = await _context.StreamWatchTimes
                    .Where(w => w.ChannelId == channelId)
                    .ToListAsync();

                _logger.LogInformation($"Reseteando watch times para canal {channelId}. {watchTimes.Count} registros.");

                _context.StreamWatchTimes.RemoveRange(watchTimes);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error resetting watch time for channel {channelId}");
            }
        }
    }
}
