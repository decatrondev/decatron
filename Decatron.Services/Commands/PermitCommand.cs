using System.Threading.Tasks;
using Decatron.Core.Services.Moderation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Commands
{
    /// <summary>
    /// !permit usuario — deja pasar los links de un usuario por un rato (o un solo mensaje),
    /// según la configuración del filtro de links.
    /// </summary>
    public class PermitCommand : ModerationCommandBase
    {
        public override string Name => "!permit";
        public override string Description => "Permite que un usuario envíe links por un tiempo";
        protected override string ConfigKey => ModerationCommandsConfig.Permit;

        public PermitCommand(ILogger<PermitCommand> logger, IServiceScopeFactory serviceScopeFactory) : base(logger, serviceScopeFactory) { }

        protected override async Task RunAsync(Run run)
        {
            var target = run.Target;
            if (string.IsNullOrEmpty(target))
            {
                await run.ReplyAsync($"🔗 @{run.Mod}, uso: !permit @usuario");
                return;
            }

            var filter = await run.Moderation.GetFilterAsync(run.Context.Channel, LinkFilter.FilterKey);
            if (filter == null || !filter.Enabled)
            {
                await run.ReplyAsync($"🔗 @{run.Mod}, el filtro de links está apagado: los links ya pasan sin permiso.");
                return;
            }

            var settings = LinkFilterSettings.Parse(filter.Settings);
            LinkPermits.Grant(run.Context.Channel, target, settings.PermitSeconds, settings.PermitSingleMessage);

            var duration = ModerationText.Duration(settings.PermitSeconds);
            await run.ReplyAsync(settings.PermitSingleMessage
                ? $"🔗 @{target} puede enviar un mensaje con link en los próximos {duration}."
                : $"🔗 @{target} puede enviar links durante {duration}.");

            _logger.LogInformation("[PERMIT] {Mod} dio permiso de links a {Target} en {Channel} ({Seconds}s, un mensaje: {Single})",
                run.Mod, target, run.Context.Channel, settings.PermitSeconds, settings.PermitSingleMessage);
        }
    }

    internal static class ModerationText
    {
        public static string Duration(int seconds) =>
            seconds >= 3600 && seconds % 3600 == 0 ? $"{seconds / 3600} h"
            : seconds >= 60 && seconds % 60 == 0 ? $"{seconds / 60} min"
            : $"{seconds} s";
    }
}
