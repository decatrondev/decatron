using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    public interface ICommandStateService
    {
        Task<bool> IsCommandEnabledAsync(long userId, string commandName);
        Task SetCommandEnabledAsync(long userId, string commandName, bool enabled);
    }

    public class CommandStateService : ICommandStateService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<CommandStateService> _logger;

        public CommandStateService(IServiceScopeFactory scopeFactory, ILogger<CommandStateService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        public async Task<bool> IsCommandEnabledAsync(long userId, string commandName)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var commandSetting = await dbContext.CommandSettings
                    .FirstOrDefaultAsync(cs => cs.UserId == userId && cs.CommandName == commandName);

                // Si no existe configuración, el comando está habilitado por defecto
                return commandSetting?.IsEnabled ?? true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando estado del comando {commandName} para usuario {userId}");
                // En caso de error, asumir que está habilitado
                return true;
            }
        }

        public async Task SetCommandEnabledAsync(long userId, string commandName, bool enabled)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var commandSetting = await dbContext.CommandSettings
                    .FirstOrDefaultAsync(cs => cs.UserId == userId && cs.CommandName == commandName);

                if (commandSetting == null)
                {
                    commandSetting = new CommandSettings
                    {
                        UserId = userId,
                        CommandName = commandName,
                        IsEnabled = enabled,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    dbContext.CommandSettings.Add(commandSetting);
                }
                else
                {
                    commandSetting.IsEnabled = enabled;
                    commandSetting.UpdatedAt = DateTime.UtcNow;
                }

                await dbContext.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error estableciendo estado del comando {commandName} para usuario {userId}");
                throw;
            }
        }
    }
}