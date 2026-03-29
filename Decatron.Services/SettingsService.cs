using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    public class SettingsService : ISettingsService
    {
        private readonly DecatronDbContext _context;
        private readonly ILogger<SettingsService> _logger;
        private readonly Lazy<TwitchBotService> _botService;

        public SettingsService(DecatronDbContext context, ILogger<SettingsService> logger, Lazy<TwitchBotService> botService)
        {
            _context = context;
            _logger = logger;
            _botService = botService;
        }

        /// <summary>
        /// Obtiene la configuración del usuario por su ID
        /// </summary>
        public async Task<SystemSettings> GetSettingsByUserIdAsync(long userId)
        {
            try
            {
                var settings = await _context.SystemSettings
                    .FirstOrDefaultAsync(s => s.UserId == userId);

                if (settings == null)
                {
                    _logger.LogWarning($"Settings not found for user {userId}, creating default settings");
                    return await CreateDefaultSettingsAsync(userId);
                }

                return settings;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting settings for user {userId}");
                throw;
            }
        }

        /// <summary>
        /// Actualiza la configuración del usuario y maneja conexión automática del bot
        /// </summary>
        public async Task<SystemSettings> UpdateSettingsAsync(SystemSettings settings)
        {
            try
            {
                var oldSettings = await _context.SystemSettings
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.Id == settings.Id);

                if (oldSettings == null)
                {
                    throw new InvalidOperationException($"Settings with ID {settings.Id} not found");
                }

                settings.UpdatedAt = DateTime.UtcNow;
                _context.SystemSettings.Update(settings);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"Settings updated for user {settings.UserId}");

                // Manejar conexión automática del bot si BotEnabled cambió
                if (oldSettings.BotEnabled != settings.BotEnabled)
                {
                    await HandleBotConnectionAsync(settings.UserId, settings.BotEnabled);
                }

                return settings;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating settings for user {settings.UserId}");
                throw;
            }
        }

        /// <summary>
        /// Actualiza solo el estado del bot y maneja la conexión automáticamente
        /// </summary>
        public async Task<bool> SetBotEnabledAsync(long userId, bool enabled)
        {
            try
            {
                var settings = await GetSettingsByUserIdAsync(userId);

                if (settings.BotEnabled == enabled)
                {
                    _logger.LogInformation($"Bot status for user {userId} is already {enabled}");
                    return true;
                }

                settings.BotEnabled = enabled;
                settings.UpdatedAt = DateTime.UtcNow;

                _context.SystemSettings.Update(settings);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"Bot {(enabled ? "enabled" : "disabled")} for user {userId}");

                // Manejar conexión automática del bot
                await HandleBotConnectionAsync(userId, enabled);

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error setting bot enabled status for user {userId}");
                throw;
            }
        }

        /// <summary>
        /// Obtiene todos los usuarios que tienen el bot habilitado
        /// </summary>
        public async Task<List<string>> GetEnabledBotChannelsAsync()
        {
            try
            {
                var enabledChannels = await (from u in _context.Users
                                             join s in _context.SystemSettings on u.Id equals s.UserId into settings
                                             from s in settings.DefaultIfEmpty()
                                             where u.IsActive && (s == null || s.BotEnabled)
                                             select u.Login).ToListAsync();

                _logger.LogInformation($"Found {enabledChannels.Count} channels with bot enabled");
                return enabledChannels;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting enabled bot channels");
                throw;
            }
        }

        /// <summary>
        /// Verifica si el bot está habilitado para un canal específico
        /// </summary>
        public async Task<bool> IsBotEnabledForChannelAsync(string channelLogin)
        {
            try
            {
                var isEnabled = await (from u in _context.Users
                                       join s in _context.SystemSettings on u.Id equals s.UserId into settings
                                       from s in settings.DefaultIfEmpty()
                                       where u.Login.ToLower() == channelLogin.ToLower() && u.IsActive
                                       select s == null || s.BotEnabled).FirstOrDefaultAsync();

                return isEnabled;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error checking if bot is enabled for channel {channelLogin}");
                return false;
            }
        }

        /// <summary>
        /// Obtiene información completa de usuarios con configuración del bot
        /// </summary>
        public async Task<List<UserBotInfo>> GetUsersBotInfoAsync()
        {
            try
            {
                var usersBotInfo = await (from u in _context.Users
                                          join s in _context.SystemSettings on u.Id equals s.UserId into settings
                                          from s in settings.DefaultIfEmpty()
                                          where u.IsActive
                                          select new UserBotInfo
                                          {
                                              UserId = u.Id,
                                              Login = u.Login,
                                              DisplayName = u.DisplayName,
                                              IsUserActive = u.IsActive,
                                              BotEnabled = s == null || s.BotEnabled,
                                              HasSettings = s != null
                                          }).ToListAsync();

                return usersBotInfo;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting users bot info");
                throw;
            }
        }

        /// <summary>
        /// Maneja automáticamente la conexión/desconexión del bot cuando cambia el estado
        /// </summary>
        private async Task HandleBotConnectionAsync(long userId, bool enabled)
        {
            try
            {
                var user = await _context.Users
                    .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive);

                if (user == null)
                {
                    _logger.LogWarning($"User {userId} not found or not active");
                    return;
                }

                if (!_botService.Value.IsConnected)
                {
                    _logger.LogWarning("Bot is not connected, skipping channel connection management");
                    return;
                }

                if (enabled)
                {
                    // Conectar al canal si no está conectado
                    var connectedChannels = _botService.Value.GetConnectedChannels();
                    if (!connectedChannels.Any(c => c.Equals(user.Login, StringComparison.OrdinalIgnoreCase)))
                    {
                        _botService.Value.JoinChannel(user.Login);
                        _logger.LogInformation($"Bot automatically joined channel: {user.Login}");
                    }
                    else
                    {
                        _logger.LogInformation($"Bot already connected to channel: {user.Login}");
                    }
                }
                else
                {
                    // Desconectar del canal
                    _botService.Value.LeaveChannel(user.Login);
                    _logger.LogInformation($"Bot automatically left channel: {user.Login}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error handling bot connection for user {userId}");
            }
        }

        /// <summary>
        /// Crea la configuración por defecto para un nuevo usuario
        /// </summary>
        public async Task<SystemSettings> CreateDefaultSettingsAsync(long userId)
        {
            try
            {
                // Verificar si el usuario existe
                var userExists = await _context.Users.AnyAsync(u => u.Id == userId);
                if (!userExists)
                {
                    throw new InvalidOperationException($"User {userId} not found");
                }

                var settings = new SystemSettings
                {
                    UserId = userId,
                    BotEnabled = true,
                    CommandsEnabled = true,
                    CommandCooldown = 5,
                    TimersEnabled = true,
                    TimerMinMessages = 5,
                    AutoModerationEnabled = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.SystemSettings.Add(settings);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"Default settings created for user {userId}");
                return settings;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error creating default settings for user {userId}");
                throw;
            }
        }

        /// <summary>
        /// Obtiene todos los accesos autorizados del usuario
        /// </summary>
        public async Task<IEnumerable<UserAccess>> GetUserAccessesAsync(long userId)
        {
            try
            {
                var accesses = await _context.UserAccess
                    .Where(ua => ua.UserId == userId)
                    .OrderByDescending(ua => ua.CreatedAt)
                    .ToListAsync();

                return accesses;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting user accesses for user {userId}");
                throw;
            }
        }

        /// <summary>
        /// Agrega un usuario autorizado
        /// </summary>
        public async Task<UserAccess> AddUserAccessAsync(long userId, long authorizedUserId, string permissionLevel)
        {
            try
            {
                // Validar que no sea el mismo usuario
                if (userId == authorizedUserId)
                {
                    throw new InvalidOperationException("Cannot add yourself as authorized user");
                }

                // Validar que el usuario autorizado no esté duplicado
                var existingAccess = await _context.UserAccess
                    .FirstOrDefaultAsync(ua => ua.UserId == userId && ua.AuthorizedUserId == authorizedUserId);

                if (existingAccess != null)
                {
                    throw new InvalidOperationException("This user already has access");
                }

                // Validar permission level
                var validPermissions = new[] { "commands", "moderation", "admin" };
                if (!validPermissions.Contains(permissionLevel?.ToLower()))
                {
                    throw new InvalidOperationException("Invalid permission level");
                }

                var userAccess = new UserAccess
                {
                    UserId = userId,
                    AuthorizedUserId = authorizedUserId,
                    PermissionLevel = permissionLevel.ToLower(),
                    CreatedAt = DateTime.UtcNow
                };

                _context.UserAccess.Add(userAccess);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"User access added: {userId} -> {authorizedUserId} ({permissionLevel})");
                return userAccess;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error adding user access for user {userId}");
                throw;
            }
        }

        /// <summary>
        /// Remueve un usuario autorizado
        /// </summary>
        public async Task<bool> RemoveUserAccessAsync(long accessId)
        {
            try
            {
                var userAccess = await _context.UserAccess
                    .FirstOrDefaultAsync(ua => ua.Id == accessId);

                if (userAccess == null)
                {
                    _logger.LogWarning($"User access {accessId} not found");
                    return false;
                }

                _context.UserAccess.Remove(userAccess);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"User access removed: {accessId}");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error removing user access {accessId}");
                throw;
            }
        }

        /// <summary>
        /// Actualiza los permisos de un usuario autorizado
        /// </summary>
        public async Task<bool> UpdateUserAccessAsync(long accessId, string permissionLevel)
        {
            try
            {
                var userAccess = await _context.UserAccess
                    .FirstOrDefaultAsync(ua => ua.Id == accessId);

                if (userAccess == null)
                {
                    _logger.LogWarning($"User access {accessId} not found");
                    return false;
                }

                // Validar permission level
                var validPermissions = new[] { "commands", "moderation", "admin" };
                if (!validPermissions.Contains(permissionLevel?.ToLower()))
                {
                    throw new InvalidOperationException("Invalid permission level");
                }

                userAccess.PermissionLevel = permissionLevel.ToLower();
                _context.UserAccess.Update(userAccess);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"User access updated: {accessId} -> {permissionLevel}");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating user access {accessId}");
                throw;
            }
        }
    }

    /// <summary>
    /// Clase auxiliar para obtener información completa de usuarios y configuración del bot
    /// </summary>
    public class UserBotInfo
    {
        public long UserId { get; set; }
        public string Login { get; set; }
        public string DisplayName { get; set; }
        public bool IsUserActive { get; set; }
        public bool BotEnabled { get; set; }
        public bool HasSettings { get; set; }
    }
}