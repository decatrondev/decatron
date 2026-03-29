using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Data.Repositories
{
    public class BotTokenRepository : IBotTokenRepository
    {
        private readonly DecatronDbContext _context;
        private readonly ILogger<BotTokenRepository> _logger;

        public BotTokenRepository(DecatronDbContext context, ILogger<BotTokenRepository> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<BotTokens> GetByIdAsync(int id)
        {
            try
            {
                return await _context.BotTokens.FirstOrDefaultAsync(bt => bt.Id == id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting bot token by ID: {id}");
                throw;
            }
        }

        public async Task<BotTokens> GetByBotUsernameAsync(string botUsername)
        {
            try
            {
                return await _context.BotTokens.FirstOrDefaultAsync(bt => bt.BotUsername == botUsername.ToLower());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting bot token by username: {botUsername}");
                throw;
            }
        }

        public async Task<List<BotTokens>> GetAllActiveAsync()
        {
            try
            {
                return await _context.BotTokens
                    .Where(bt => bt.IsActive)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all active bot tokens");
                throw;
            }
        }

        public async Task<List<BotTokens>> GetTokensExpiringWithinAsync(TimeSpan timeSpan)
        {
            try
            {
                var expirationThreshold = DateTime.UtcNow.Add(timeSpan);
                return await _context.BotTokens
                    .Where(bt => bt.IsActive &&
                           bt.RefreshToken != null &&
                           bt.TokenExpiration.HasValue &&
                           bt.TokenExpiration.Value <= expirationThreshold)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting bot tokens expiring soon");
                throw;
            }
        }

        public async Task<BotTokens> CreateAsync(BotTokens botToken)
        {
            try
            {
                botToken.BotUsername = botToken.BotUsername.ToLower();
                _context.BotTokens.Add(botToken);
                await _context.SaveChangesAsync();
                _logger.LogInformation($"Bot token created: {botToken.BotUsername}");
                return botToken;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error creating bot token: {botToken.BotUsername}");
                throw;
            }
        }

        public async Task<BotTokens> UpdateAsync(BotTokens botToken)
        {
            try
            {
                botToken.UpdatedAt = DateTime.UtcNow;
                _context.BotTokens.Update(botToken);
                await _context.SaveChangesAsync();
                _logger.LogInformation($"Bot token updated: {botToken.BotUsername}");
                return botToken;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating bot token: {botToken.BotUsername}");
                throw;
            }
        }

        public async Task<bool> DeleteAsync(int id)
        {
            try
            {
                var botToken = await GetByIdAsync(id);
                if (botToken == null)
                {
                    return false;
                }

                _context.BotTokens.Remove(botToken);
                await _context.SaveChangesAsync();
                _logger.LogInformation($"Bot token deleted: {botToken.BotUsername}");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error deleting bot token with ID: {id}");
                throw;
            }
        }
    }
}
