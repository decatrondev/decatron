using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Data.Repositories
{
    public class UserRepository : IUserRepository
    {
        private readonly DecatronDbContext _context;
        private readonly ILogger<UserRepository> _logger;

        public UserRepository(DecatronDbContext context, ILogger<UserRepository> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<User> GetByIdAsync(long id)
        {
            try
            {
                return await _context.Users.FirstOrDefaultAsync(u => u.Id == id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting user by ID: {id}");
                throw;
            }
        }

        public async Task<User> GetByLoginAsync(string login)
        {
            try
            {
                return await _context.Users.FirstOrDefaultAsync(u => u.Login == login.ToLower());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting user by login: {login}");
                throw;
            }
        }

        public async Task<User> GetByTwitchIdAsync(string twitchId)
        {
            try
            {
                return await _context.Users.FirstOrDefaultAsync(u => u.TwitchId == twitchId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting user by Twitch ID: {twitchId}");
                throw;
            }
        }

        public async Task<User> CreateAsync(User user)
        {
            try
            {
                user.Login = user.Login.ToLower();
                _context.Users.Add(user);
                await _context.SaveChangesAsync();
                _logger.LogInformation($"User created: {user.Login}");
                return user;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error creating user: {user.Login}");
                throw;
            }
        }

        public async Task<User> UpdateAsync(User user)
        {
            try
            {
                _context.Users.Update(user);
                await _context.SaveChangesAsync();
                _logger.LogInformation($"User updated: {user.Login}");
                return user;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating user: {user.Login}");
                throw;
            }
        }

        public async Task<bool> ExistsAsync(long id)
        {
            try
            {
                return await _context.Users.AnyAsync(u => u.Id == id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error checking user existence: {id}");
                throw;
            }
        }

        public async Task<List<User>> GetAllActiveAsync()
        {
            try
            {
                return await _context.Users
                    .Where(u => u.IsActive)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all active users");
                throw;
            }
        }

        public async Task<List<User>> GetUsersWithTokensExpiringWithinAsync(TimeSpan timeSpan)
        {
            try
            {
                var expirationThreshold = DateTime.UtcNow.Add(timeSpan);
                return await _context.Users
                    .Where(u => u.IsActive &&
                           // "" no "": KickAuthController y DiscordAuthController crean filas
                           // sin Twitch con RefreshToken = "" (no null, porque la columna no es
                           // nullable) — un "" != null pasaba este filtro igual, asi que el
                           // refresh de Twitch reintentaba para siempre contra usuarios que
                           // nunca tuvieron token de Twitch. Encontrado el 6 ago 2026 viendo
                           // "has no refresh token" repetido cada 30 min para filas de Kick y
                           // Discord desde su login.
                           !string.IsNullOrEmpty(u.RefreshToken) &&
                           u.TokenExpiration <= expirationThreshold)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting users with tokens expiring soon");
                throw;
            }
        }

        public async Task<List<User>> GetUsersWithKickTokensExpiringWithinAsync(TimeSpan timeSpan)
        {
            try
            {
                var expirationThreshold = DateTime.UtcNow.Add(timeSpan);
                return await _context.Users
                    .Where(u => u.IsActive &&
                           u.KickRefreshToken != null &&
                           u.KickTokenExpiration != null &&
                           u.KickTokenExpiration <= expirationThreshold)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting users with Kick tokens expiring soon");
                throw;
            }
        }
    }
}