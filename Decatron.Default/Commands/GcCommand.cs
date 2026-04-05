using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Services;
using Microsoft.Extensions.Logging;

namespace Decatron.Default.Commands
{
    /// <summary>
    /// !gc — Alias corto para !gacha. Delega todo al GachaCommand.
    /// Permite: !gcpull, !gcpulls, !gccol, !gcpause, !gcresume
    /// </summary>
    public class GcCommand : ICommand
    {
        private readonly GachaCommand _gachaCommand;

        public string Name => "!gc";
        public string Description => "Alias corto de !gacha (!gcpull, !gcpulls, !gccol)";

        public GcCommand(GachaCommand gachaCommand)
        {
            _gachaCommand = gachaCommand;
        }

        public Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            return _gachaCommand.ExecuteAsync(context, messageSender);
        }
    }
}
