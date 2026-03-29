using System;
using System.Threading.Tasks;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Core.Functions
{
    /// <summary>
    /// Contador simple que solo incrementa cada vez que se usa
    /// Usado por $(uses)
    /// </summary>
    public class UsesFunction
    {
        private readonly DecatronDbContext _context;
        private readonly ILogger<UsesFunction> _logger;

        public UsesFunction(DecatronDbContext context, ILogger<UsesFunction> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Incrementa y retorna el contador de usos de un comando
        /// </summary>
        public async Task<string> Execute(string channelName, string commandName)
        {
            try
            {
                var uses = await _context.CommandUses
                    .FirstOrDefaultAsync(u => u.ChannelName == channelName && u.CommandName == commandName);

                if (uses == null)
                {
                    uses = new CommandUses
                    {
                        ChannelName = channelName,
                        CommandName = commandName,
                        UseCount = 1,
                        LastUsedAt = DateTime.UtcNow,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.CommandUses.Add(uses);
                }
                else
                {
                    uses.UseCount++;
                    uses.LastUsedAt = DateTime.UtcNow;
                    _context.CommandUses.Update(uses);
                }

                await _context.SaveChangesAsync();

                return uses.UseCount.ToString();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error en UsesFunction para {channelName}/{commandName}");
                return "0";
            }
        }

        /// <summary>
        /// Obtiene el contador de usos sin incrementarlo
        /// </summary>
        public async Task<int> GetUseCount(string channelName, string commandName)
        {
            try
            {
                var uses = await _context.CommandUses
                    .FirstOrDefaultAsync(u => u.ChannelName == channelName && u.CommandName == commandName);

                return uses?.UseCount ?? 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error obteniendo contador de usos para {channelName}/{commandName}");
                return 0;
            }
        }
    }
}
