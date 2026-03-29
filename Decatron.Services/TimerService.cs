using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TimerModel = Decatron.Core.Models.Timer;

namespace Decatron.Services
{
    public interface ITimerService
    {
        Task<List<TimerModel>> GetAllByChannelAsync(string channelName);
        Task<TimerModel?> GetByIdAsync(int id);
        Task<TimerModel> CreateAsync(TimerModel timer);
        Task<TimerModel> UpdateAsync(TimerModel timer);
        Task DeleteAsync(int id);
        Task<int> GetTimerCountByChannelAsync(string channelName);
        Task<List<TimerModel>> GetTimersReadyToExecuteAsync(string channelName, bool isOnline, string? currentCategory = null);
        Task UpdateTimerExecutionAsync(int timerId);
        Task IncrementMessageCountersAsync(string channelName);
    }

    public class TimerService : ITimerService
    {
        private readonly DecatronDbContext _context;
        private readonly ILogger<TimerService> _logger;

        public TimerService(DecatronDbContext context, ILogger<TimerService> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Obtiene todos los timers de un canal
        /// </summary>
        public async Task<List<TimerModel>> GetAllByChannelAsync(string channelName)
        {
            return await _context.Timers
                .Where(t => t.ChannelName == channelName.ToLower())
                .OrderBy(t => t.Priority)
                .ToListAsync();
        }

        /// <summary>
        /// Obtiene un timer por ID
        /// </summary>
        public async Task<TimerModel?> GetByIdAsync(int id)
        {
            return await _context.Timers.FindAsync(id);
        }

        /// <summary>
        /// Crea un nuevo timer
        /// </summary>
        public async Task<TimerModel> CreateAsync(TimerModel timer)
        {
            // Normalizar nombre del canal
            timer.ChannelName = timer.ChannelName.ToLower();

            // Validar límite de timers por canal
            var timerCount = await GetTimerCountByChannelAsync(timer.ChannelName);
            if (timerCount >= 20)
            {
                throw new InvalidOperationException("Has alcanzado el límite máximo de 20 timers por canal");
            }

            // Validar campos requeridos
            ValidateTimer(timer);

            timer.CreatedAt = DateTime.UtcNow;
            timer.UpdatedAt = DateTime.UtcNow;

            _context.Timers.Add(timer);
            await _context.SaveChangesAsync();

            _logger.LogInformation($"✅ Timer creado: {timer.Name} en canal {timer.ChannelName}");
            return timer;
        }

        /// <summary>
        /// Actualiza un timer existente
        /// </summary>
        public async Task<TimerModel> UpdateAsync(TimerModel timer)
        {
            var existing = await _context.Timers.FindAsync(timer.Id);
            if (existing == null)
            {
                throw new KeyNotFoundException($"Timer con ID {timer.Id} no encontrado");
            }

            // Validar que pertenece al mismo canal
            if (existing.ChannelName != timer.ChannelName.ToLower())
            {
                throw new InvalidOperationException("No puedes cambiar el canal de un timer");
            }

            // Validar campos
            ValidateTimer(timer);

            // Actualizar campos editables
            existing.Name = timer.Name;
            existing.Message = timer.Message;
            existing.IntervalMinutes = timer.IntervalMinutes;
            existing.IntervalMessages = timer.IntervalMessages;
            existing.CategoryName = timer.CategoryName;
            existing.StreamStatus = timer.StreamStatus;
            existing.Priority = timer.Priority;
            existing.IsActive = timer.IsActive;
            existing.UpdatedAt = DateTime.UtcNow;

            // NO resetear: ExecutionCount, LastExecutedAt, MessagesSinceLastExecution
            // Estos se mantienen como histórico

            await _context.SaveChangesAsync();

            _logger.LogInformation($"✅ Timer actualizado: {timer.Name} (ID: {timer.Id})");
            return existing;
        }

        /// <summary>
        /// Elimina un timer
        /// </summary>
        public async Task DeleteAsync(int id)
        {
            var timer = await _context.Timers.FindAsync(id);
            if (timer == null)
            {
                throw new KeyNotFoundException($"Timer con ID {id} no encontrado");
            }

            _context.Timers.Remove(timer);
            await _context.SaveChangesAsync();

            _logger.LogInformation($"🗑️ Timer eliminado: {timer.Name} (ID: {id})");
        }

        /// <summary>
        /// Cuenta cuántos timers tiene un canal
        /// </summary>
        public async Task<int> GetTimerCountByChannelAsync(string channelName)
        {
            return await _context.Timers
                .Where(t => t.ChannelName == channelName.ToLower())
                .CountAsync();
        }

        /// <summary>
        /// Obtiene los timers que cumplen condiciones para ser ejecutados
        /// ANTI-SPAM: Todos los timers requieren AMBAS condiciones: tiempo Y mensajes
        /// Ordena por prioridad (menor número = mayor prioridad)
        /// </summary>
        public async Task<List<TimerModel>> GetTimersReadyToExecuteAsync(string channelName, bool isOnline, string? currentCategory = null)
        {
            var normalizedChannel = channelName.ToLower();

            // Obtener configuración global del canal
            var settings = await _context.SystemSettings
                .Where(s => _context.Users.Any(u => u.Id == s.UserId && u.Login == normalizedChannel))
                .FirstOrDefaultAsync();

            if (settings == null || !settings.TimersEnabled)
            {
                return new List<TimerModel>();
            }

            var now = DateTime.UtcNow;

            // Obtener todos los timers activos del canal que coincidan con el estado del stream
            var timers = await _context.Timers
                .FromSqlRaw("SELECT * FROM timers WHERE channel_name = {0} AND is_active = TRUE", normalizedChannel)
                .ToListAsync();

            var readyTimers = new List<TimerModel>();

            foreach (var timer in timers)
            {
                var isReady = true;

                // ANTI-SPAM: Verificar TIEMPO (obligatorio - mínimo 5 min)
                if (timer.LastExecutedAt.HasValue)
                {
                    var minutesSinceLastExecution = (now - timer.LastExecutedAt.Value).TotalMinutes;
                    if (minutesSinceLastExecution < timer.IntervalMinutes)
                    {
                        isReady = false;
                    }
                }
                // Si nunca se ejecutó, está listo en cuanto a tiempo

                // ANTI-SPAM: Verificar MENSAJES (obligatorio - mínimo 5 mensajes)
                if (isReady && timer.MessagesSinceLastExecution < timer.IntervalMessages)
                {
                    isReady = false;
                }

                // Verificar CATEGORÍA del stream (si el timer especifica una)
                if (isReady && !string.IsNullOrWhiteSpace(timer.CategoryName))
                {
                    if (string.IsNullOrWhiteSpace(currentCategory) ||
                        !timer.CategoryName.Equals(currentCategory, StringComparison.OrdinalIgnoreCase))
                    {
                        isReady = false;
                        _logger.LogDebug($"Timer {timer.Name} no ejecutado: requiere categoría '{timer.CategoryName}', actual '{currentCategory ?? "N/A"}'");
                    }
                }

                if (isReady)
                {
                    readyTimers.Add(timer);
                }
            }

            return readyTimers;
        }

        /// <summary>
        /// Actualiza el registro de ejecución de un timer
        /// </summary>
        public async Task UpdateTimerExecutionAsync(int timerId)
        {
            var timer = await _context.Timers.FindAsync(timerId);
            if (timer == null)
            {
                return;
            }

            timer.LastExecutedAt = DateTime.UtcNow;
            timer.ExecutionCount++;
            timer.MessagesSinceLastExecution = 0; // Resetear contador de mensajes de este timer

            await _context.SaveChangesAsync();

            // Resetear contador global de mensajes para el canal
            var settings = await _context.SystemSettings
                .Where(s => _context.Users.Any(u => u.Id == s.UserId && u.Login == timer.ChannelName))
                .FirstOrDefaultAsync();

            if (settings != null)
            {
                settings.MessageCountSinceLastTimer = 0;
                await _context.SaveChangesAsync();
            }

            _logger.LogDebug($"⏰ Timer ejecutado: {timer.Name} (Ejecución #{timer.ExecutionCount})");
        }

        /// <summary>
        /// Incrementa contadores de mensajes para todos los timers de un canal
        /// </summary>
        public async Task IncrementMessageCountersAsync(string channelName)
        {
            var normalizedChannel = channelName.ToLower();

            // Incrementar contador de mensajes de todos los timers del canal
            var timers = await _context.Timers
                .Where(t => t.ChannelName == normalizedChannel)
                .ToListAsync();

            foreach (var timer in timers)
            {
                timer.MessagesSinceLastExecution++;
            }

            // Incrementar contador global
            var settings = await _context.SystemSettings
                .Where(s => _context.Users.Any(u => u.Id == s.UserId && u.Login == normalizedChannel))
                .FirstOrDefaultAsync();

            if (settings != null)
            {
                settings.MessageCountSinceLastTimer++;
            }

            await _context.SaveChangesAsync();
        }

        /// <summary>
        /// Valida los campos de un timer
        /// ANTI-SPAM: Requiere mínimo 5 minutos Y 5 mensajes
        /// </summary>
        private void ValidateTimer(TimerModel timer)
        {
            if (string.IsNullOrWhiteSpace(timer.Name))
            {
                throw new ArgumentException("El nombre del timer no puede estar vacío");
            }

            if (string.IsNullOrWhiteSpace(timer.Message))
            {
                throw new ArgumentException("El mensaje del timer no puede estar vacío");
            }

            if (timer.Message.Length > 500)
            {
                throw new ArgumentException("El mensaje no puede superar los 500 caracteres");
            }

            // ANTI-SPAM: Ambos intervalos son obligatorios y tienen mínimos
            if (timer.IntervalMinutes < 5)
            {
                throw new ArgumentException("El intervalo de tiempo debe ser de al menos 5 minutos (anti-spam)");
            }

            if (timer.IntervalMessages < 5)
            {
                throw new ArgumentException("El intervalo de mensajes debe ser de al menos 5 mensajes (anti-spam)");
            }

            if (!new[] { "online", "offline", "both" }.Contains(timer.StreamStatus.ToLower()))
            {
                throw new ArgumentException("StreamStatus debe ser: online, offline o both");
            }

            if (timer.Priority < 1)
            {
                throw new ArgumentException("La prioridad debe ser mayor a 0");
            }
        }
    }
}
