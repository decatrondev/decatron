using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Decatron.Core.Helpers;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Core.Functions
{
    /// <summary>
    /// Contador avanzado con operaciones: +, -, set, reset
    /// Usado por $(count)
    /// </summary>
    public class CounterFunction
    {
        private readonly DecatronDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly ILogger<CounterFunction> _logger;

        public CounterFunction(
            DecatronDbContext context,
            IConfiguration configuration,
            ILogger<CounterFunction> logger)
        {
            _context = context;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<string> Execute(string channelName, string commandName, string userName, string[] args)
        {
            try
            {
                var counter = await LoadCounterFromDatabase(channelName, commandName);
                int counterValue = counter?.CounterValue ?? 0;
                string operation = args.Length > 0 ? args[0].ToLower() : "";
                int? newValue = null;

                switch (operation)
                {
                    case "set":
                        if (await Utils.IsOwnerOrModerator(_configuration, userName, channelName))
                        {
                            if (args.Length > 1 && int.TryParse(args[1], out int setValue))
                            {
                                newValue = Math.Max(0, Math.Min(999999, setValue)); // Límite 0-999999
                            }
                        }
                        else
                        {
                            return "Solo los moderadores o el streamer pueden usar la operación 'set' del contador.";
                        }
                        break;

                    case "+":
                    case "add":
                        int addValue = 1;
                        if (args.Length > 1 && int.TryParse(args[1], out int parsedAddValue))
                        {
                            addValue = parsedAddValue;
                        }
                        newValue = Math.Min(999999, counterValue + addValue);
                        break;

                    case "-":
                    case "subtract":
                        int subtractValue = 1;
                        if (args.Length > 1 && int.TryParse(args[1], out int parsedSubtractValue))
                        {
                            subtractValue = parsedSubtractValue;
                        }
                        newValue = Math.Max(0, counterValue - subtractValue);
                        break;

                    case "reset":
                        if (await Utils.IsOwnerOrModerator(_configuration, userName, channelName))
                        {
                            newValue = 0;
                        }
                        else
                        {
                            return "Solo los moderadores o el streamer pueden resetear el contador.";
                        }
                        break;

                    case "view":
                    case "":
                        // Solo mostrar el valor actual sin modificar
                        break;

                    default:
                        return $"Operación desconocida. Usa: +, -, set, reset, o view. Valor actual: {counterValue}";
                }

                if (newValue.HasValue)
                {
                    await SaveCounterToDatabase(channelName, commandName, newValue.Value, userName);
                    counterValue = newValue.Value;
                }

                return counterValue.ToString();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error en CounterFunction para {channelName}/{commandName}");
                return "Error al procesar el contador.";
            }
        }

        private async Task<CommandCounter?> LoadCounterFromDatabase(string channelName, string commandName)
        {
            try
            {
                return await _context.CommandCounters
                    .FirstOrDefaultAsync(c => c.ChannelName == channelName && c.CommandName == commandName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error cargando contador: {channelName}/{commandName}");
                return null;
            }
        }

        private async Task SaveCounterToDatabase(string channelName, string commandName, int counterValue, string modifiedBy)
        {
            try
            {
                var counter = await _context.CommandCounters
                    .FirstOrDefaultAsync(c => c.ChannelName == channelName && c.CommandName == commandName);

                if (counter == null)
                {
                    counter = new CommandCounter
                    {
                        ChannelName = channelName,
                        CommandName = commandName,
                        CounterValue = counterValue,
                        LastModifiedBy = modifiedBy,
                        LastModifiedAt = DateTime.UtcNow,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.CommandCounters.Add(counter);
                }
                else
                {
                    counter.CounterValue = counterValue;
                    counter.LastModifiedBy = modifiedBy;
                    counter.LastModifiedAt = DateTime.UtcNow;
                    _context.CommandCounters.Update(counter);
                }

                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error guardando contador: {channelName}/{commandName}");
            }
        }
    }
}
