using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    public interface IPermissionService
    {
        Task<bool> CanAccessAsync(long userId, long channelOwnerId, string section);
        Task<string?> GetUserAccessLevelAsync(long userId, long channelOwnerId);
        Task<bool> HasPermissionLevelAsync(long userId, long channelOwnerId, string requiredLevel);
        Task<bool> IsChannelOwnerAsync(long userId, long channelOwnerId);
        Task<List<UserPermissionInfo>> GetChannelUsersAsync(long channelOwnerId);
        Task<UserChannelPermissions> AddUserPermissionAsync(UserChannelPermissions permission);
        Task<bool> RemoveUserPermissionAsync(long permissionId);
        Task<bool> UpdateUserPermissionAsync(long permissionId, string newAccessLevel);
        Task<List<UserAccountDto>> GetUserAvailableAccountsAsync(long userId);
        Task<Dictionary<string, bool>> GetUserSectionsAccessAsync(long userId, long channelOwnerId);



    }

    public class PermissionService : IPermissionService
    {
        private readonly DecatronDbContext _dbContext;
        private readonly ILogger<PermissionService> _logger;

        // Jerarquía de permisos (orden de mayor a menor)
        private readonly Dictionary<string, int> _permissionLevels = new()
        {
            { "control_total", 3 },
            { "moderation", 2 },
            { "commands", 1 }
        };

        // Mapeo de secciones a nivel mínimo requerido
        private readonly Dictionary<string, string> _sectionPermissions = new()
        {
            { "commands", "commands" },
            { "microcommands", "commands" },
            { "title", "commands" },
            { "game", "commands" },
            { "overlays", "moderation" },
            { "timers", "moderation" },
            { "raffles", "moderation" },
            { "giveaways", "moderation" },
            { "loyalty", "moderation" },
            { "chatfilters", "moderation" },
            { "user_management", "control_total" },
            { "settings", "control_total" }
        };

        public PermissionService(DecatronDbContext dbContext, ILogger<PermissionService> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        /// <summary>
        /// Verifica si un usuario puede acceder a una sección específica
        /// </summary>
        public async Task<bool> CanAccessAsync(long userId, long channelOwnerId, string section)
        {
            try
            {
                // Si es el propietario del canal, tiene acceso total
                if (await IsChannelOwnerAsync(userId, channelOwnerId))
                {
                    return true;
                }

                // Obtener el nivel mínimo requerido para la sección
                if (!_sectionPermissions.TryGetValue(section.ToLower(), out var requiredLevel))
                {
                    _logger.LogWarning($"Sección desconocida solicitada: {section}");
                    return false;
                }

                // Verificar si el usuario tiene el nivel requerido
                return await HasPermissionLevelAsync(userId, channelOwnerId, requiredLevel);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando acceso para usuario {userId} en canal {channelOwnerId}, sección {section}");
                return false;
            }
        }

        /// <summary>
        /// Obtiene el nivel de acceso de un usuario en un canal
        /// </summary>
        public async Task<string?> GetUserAccessLevelAsync(long userId, long channelOwnerId)
        {
            try
            {
                // Si es el propietario, tiene control total
                if (await IsChannelOwnerAsync(userId, channelOwnerId))
                {
                    return "control_total";
                }

                // Buscar permisos otorgados
                var permission = await _dbContext.UserChannelPermissions
                    .Where(p => p.GrantedUserId == userId &&
                               p.ChannelOwnerId == channelOwnerId &&
                               p.IsActive)
                    .FirstOrDefaultAsync();

                return permission?.AccessLevel;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error obteniendo nivel de acceso para usuario {userId} en canal {channelOwnerId}");
                return null;
            }
        }

        /// <summary>
        /// Verifica si un usuario tiene al menos el nivel de permisos requerido
        /// </summary>
        public async Task<bool> HasPermissionLevelAsync(long userId, long channelOwnerId, string requiredLevel)
        {
            try
            {
                var userLevel = await GetUserAccessLevelAsync(userId, channelOwnerId);

                if (string.IsNullOrEmpty(userLevel))
                {
                    return false;
                }

                // Comparar niveles jerárquicos
                var userLevelValue = _permissionLevels.GetValueOrDefault(userLevel, 0);
                var requiredLevelValue = _permissionLevels.GetValueOrDefault(requiredLevel, 0);

                return userLevelValue >= requiredLevelValue;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando nivel de permisos para usuario {userId}");
                return false;
            }
        }

        /// <summary>
        /// Verifica si un usuario es propietario del canal
        /// </summary>
        public async Task<bool> IsChannelOwnerAsync(long userId, long channelOwnerId)
        {
            return userId == channelOwnerId;
        }

        /// <summary>
        /// Obtiene todos los usuarios con acceso a un canal
        /// </summary>
        public async Task<List<UserPermissionInfo>> GetChannelUsersAsync(long channelOwnerId)
        {
            try
            {
                var permissions = await _dbContext.UserChannelPermissions
                    .Include(p => p.GrantedUser)
                    .Include(p => p.GrantedByUser)
                    .Where(p => p.ChannelOwnerId == channelOwnerId && p.IsActive)
                    .Select(p => new UserPermissionInfo
                    {
                        UserId = p.GrantedUserId,
                        Username = p.GrantedUser.Login,
                        DisplayName = p.GrantedUser.DisplayName,
                        AccessLevel = p.AccessLevel,
                        GrantedBy = p.GrantedByUser.Login,
                        CreatedAt = p.CreatedAt
                    })
                    .ToListAsync();

                return permissions;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error obteniendo usuarios del canal {channelOwnerId}");
                return new List<UserPermissionInfo>();
            }
        }

        /// <summary>
        /// Agrega un nuevo permiso de usuario
        /// </summary>
        public async Task<UserChannelPermissions> AddUserPermissionAsync(UserChannelPermissions permission)
        {
            try
            {
                // Verificar si ya existe un permiso para este usuario y canal
                var existingPermission = await _dbContext.UserChannelPermissions
                    .FirstOrDefaultAsync(p => p.ChannelOwnerId == permission.ChannelOwnerId &&
                                             p.GrantedUserId == permission.GrantedUserId);

                if (existingPermission != null)
                {
                    // Actualizar el permiso existente
                    existingPermission.AccessLevel = permission.AccessLevel;
                    existingPermission.IsActive = true;
                    existingPermission.UpdatedAt = DateTime.UtcNow;
                    existingPermission.GrantedBy = permission.GrantedBy;

                    await _dbContext.SaveChangesAsync();
                    return existingPermission;
                }
                else
                {
                    // Crear nuevo permiso
                    _dbContext.UserChannelPermissions.Add(permission);
                    await _dbContext.SaveChangesAsync();
                    return permission;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error agregando permiso para usuario {permission.GrantedUserId} en canal {permission.ChannelOwnerId}");
                throw;
            }
        }

        /// <summary>
        /// Remueve un permiso de usuario
        /// </summary>
        public async Task<bool> RemoveUserPermissionAsync(long permissionId)
        {
            try
            {
                var permission = await _dbContext.UserChannelPermissions
                    .FirstOrDefaultAsync(p => p.Id == permissionId);

                if (permission == null)
                {
                    return false;
                }

                // En lugar de eliminar, marcar como inactivo
                permission.IsActive = false;
                permission.UpdatedAt = DateTime.UtcNow;

                await _dbContext.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error removiendo permiso {permissionId}");
                return false;
            }
        }

        /// <summary>
        /// Actualiza el nivel de acceso de un usuario
        /// </summary>
        public async Task<bool> UpdateUserPermissionAsync(long permissionId, string newAccessLevel)
        {
            try
            {
                var permission = await _dbContext.UserChannelPermissions
                    .FirstOrDefaultAsync(p => p.Id == permissionId);

                if (permission == null)
                {
                    return false;
                }

                permission.AccessLevel = newAccessLevel;
                permission.UpdatedAt = DateTime.UtcNow;

                await _dbContext.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error actualizando permiso {permissionId}");
                return false;
            }
        }

        public async Task<List<UserAccountDto>> GetUserAvailableAccountsAsync(long userId)
        {
            try
            {
                var availableAccounts = new List<UserAccountDto>();

                // 1. Obtener la cuenta propia del usuario
                var ownAccount = await _dbContext.Users
                    .Where(u => u.Id == userId && u.IsActive)
                    .Select(u => new UserAccountDto
                    {
                        Id = u.Id,
                        Username = u.Login,
                        DisplayName = u.DisplayName,
                        ProfileImageUrl = u.ProfileImageUrl,
                        IsOwner = true,
                        AccessLevel = "control_total",
                        PermissionLabel = "Propietario" // CORREGIDO: Valor directo en lugar de método
                    })
                    .FirstOrDefaultAsync();

                if (ownAccount != null)
                {
                    availableAccounts.Add(ownAccount);
                }

                // 2. Obtener cuentas donde tiene permisos como usuario autorizado
                // CORREGIDO: Hacer la consulta sin el método, luego mapear
                var authorizedAccountsRaw = await _dbContext.UserChannelPermissions
                    .Where(ucp => ucp.GrantedUserId == userId && ucp.IsActive)
                    .Include(ucp => ucp.ChannelOwner)
                    .Select(ucp => new
                    {
                        Id = ucp.ChannelOwner.Id,
                        Username = ucp.ChannelOwner.Login,
                        DisplayName = ucp.ChannelOwner.DisplayName,
                        ProfileImageUrl = ucp.ChannelOwner.ProfileImageUrl,
                        AccessLevel = ucp.AccessLevel
                    })
                    .ToListAsync();

                // CORREGIDO: Mapear después de la consulta
                var authorizedAccounts = authorizedAccountsRaw.Select(raw => new UserAccountDto
                {
                    Id = raw.Id,
                    Username = raw.Username,
                    DisplayName = raw.DisplayName,
                    ProfileImageUrl = raw.ProfileImageUrl,
                    IsOwner = false,
                    AccessLevel = raw.AccessLevel,
                    PermissionLabel = GetPermissionLabel(raw.AccessLevel) // Ahora funciona porque no está en la consulta SQL
                }).ToList();

                availableAccounts.AddRange(authorizedAccounts);

                return availableAccounts.DistinctBy(a => a.Id).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error obteniendo cuentas disponibles para usuario {userId}");
                return new List<UserAccountDto>();
            }
        }

        // CORREGIDO: Hacer el método estático como sugiere el error
        private static string GetPermissionLabel(string accessLevel)
        {
            return accessLevel switch
            {
                "commands" => "Solo Comandos",
                "moderation" => "Moderación",
                "control_total" => "Control Total",
                _ => "Sin Acceso"
            };
        }

        /// <summary>
        /// Obtiene el acceso del usuario a cada sección específica
        /// </summary>
        public async Task<Dictionary<string, bool>> GetUserSectionsAccessAsync(long userId, long channelOwnerId)
        {
            try
            {
                var sectionsAccess = new Dictionary<string, bool>();

                // Obtener nivel de acceso del usuario
                var accessLevel = await GetUserAccessLevelAsync(userId, channelOwnerId);

                if (string.IsNullOrEmpty(accessLevel))
                {
                    // Sin acceso - denegar todo
                    foreach (var section in _sectionPermissions.Keys)
                    {
                        sectionsAccess[section] = false;
                    }
                    return sectionsAccess;
                }

                // Verificar acceso a cada sección basado en su nivel
                foreach (var sectionMapping in _sectionPermissions)
                {
                    var sectionName = sectionMapping.Key;
                    var requiredLevel = sectionMapping.Value;

                    sectionsAccess[sectionName] = await HasPermissionLevelAsync(userId, channelOwnerId, requiredLevel);
                }

                return sectionsAccess;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error obteniendo acceso a secciones para usuario {userId}");
                return new Dictionary<string, bool>();
            }
        }
    }


    public class UserAccountDto
    {
        public long Id { get; set; }
        public string Username { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public string ProfileImageUrl { get; set; } = "";
        public bool IsOwner { get; set; }
        public string AccessLevel { get; set; } = "";
        public string PermissionLabel { get; set; } = "";
    }
    public class UserPermissionInfo
    {
        public long UserId { get; set; }
        public string Username { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public string AccessLevel { get; set; } = "";
        public string GrantedBy { get; set; } = "";
        public DateTime CreatedAt { get; set; }
    }
}