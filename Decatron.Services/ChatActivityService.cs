using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace Decatron.Services
{
    public interface IChatActivityService
    {
        Task TrackMessage(string channelId, string userId, string username);
        Task<int> GetMessageCount(string channelId, string userId);
        Task ResetStreamChatActivity(string channelId, string? streamId = null);
    }

    /// <summary>
    /// Servicio que rastrea cuántos mensajes los usuarios han enviado en el stream actual
    /// Se resetea cuando el stream termina o inicia uno nuevo
    /// </summary>
    public class ChatActivityService : IChatActivityService
    {
        private readonly DecatronDbContext _context;
        private readonly ILogger<ChatActivityService> _logger;

        public ChatActivityService(
            DecatronDbContext context,
            ILogger<ChatActivityService> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Registra un mensaje enviado por un usuario
        /// </summary>
        public async Task TrackMessage(string channelId, string userId, string username)
        {
            try
            {
                var now = DateTime.UtcNow;

                var activity = await _context.StreamChatActivities
                    .FirstOrDefaultAsync(a => a.ChannelId == channelId && a.UserId == userId);

                if (activity == null)
                {
                    // Primera vez que vemos a este usuario en este canal (para este stream)
                    activity = new StreamChatActivity
                    {
                        ChannelId = channelId,
                        UserId = userId,
                        Username = username,
                        MessageCount = 1,
                        LastMessageAt = now,
                        CreatedAt = now,
                        UpdatedAt = now
                    };

                    _context.StreamChatActivities.Add(activity);
                }
                else
                {
                    // Incrementar contador
                    activity.MessageCount++;
                    activity.LastMessageAt = now;
                    activity.Username = username; // Actualizar por si cambió
                    activity.UpdatedAt = now;
                }

                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error tracking message for {username} in channel {channelId}");
            }
        }

        /// <summary>
        /// Obtiene el número de mensajes que un usuario ha enviado en el stream actual
        /// </summary>
        public async Task<int> GetMessageCount(string channelId, string userId)
        {
            try
            {
                var activity = await _context.StreamChatActivities
                    .AsNoTracking()
                    .FirstOrDefaultAsync(a => a.ChannelId == channelId && a.UserId == userId);

                return activity?.MessageCount ?? 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting message count for user {userId} in channel {channelId}");
                return 0;
            }
        }

        /// <summary>
        /// Resetea la actividad de chat para un canal cuando un stream termina o inicia uno nuevo
        /// </summary>
        public async Task ResetStreamChatActivity(string channelId, string? streamId = null)
        {
            try
            {
                var activities = await _context.StreamChatActivities
                    .Where(a => a.ChannelId == channelId)
                    .ToListAsync();

                _logger.LogInformation($"Reseteando chat activity para canal {channelId}. {activities.Count} registros.");

                _context.StreamChatActivities.RemoveRange(activities);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error resetting chat activity for channel {channelId}");
            }
        }
    }
}
