using System;
using System.Threading.Tasks;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Core.Services;
using Decatron.Core.Services.Moderation;
using Decatron.Services.Moderation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Commands
{
    /// <summary>
    /// !permit usuario — deja pasar los links de un usuario por un rato (o un solo mensaje),
    /// según la configuración del filtro de links. Lo usan mods, Lead Mods, el streamer y
    /// quien tenga control_total del canal; al resto se lo ignora en silencio.
    /// </summary>
    public class PermitCommand : ICommand
    {
        private readonly ILogger<PermitCommand> _logger;
        private readonly IServiceScopeFactory _serviceScopeFactory;

        public string Name => "!permit";
        public string Description => "Permite que un usuario envíe links por un tiempo";

        public PermitCommand(ILogger<PermitCommand> logger, IServiceScopeFactory serviceScopeFactory)
        {
            _logger = logger;
            _serviceScopeFactory = serviceScopeFactory;
        }

        public async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            try
            {
                // Kick todavía no tiene moderación (fase K del plan de moderación)
                if (context.Metadata != null && context.Metadata.TryGetValue("platform", out var platform) && platform?.ToString() == "kick")
                    return;

                using var scope = _serviceScopeFactory.CreateScope();

                var canUse = context.IsBroadcaster || context.IsLeadModerator || context.IsModerator
                    || await ModerationPermissions.HasControlTotalAsync(scope.ServiceProvider, context.Channel, context.UserId);
                if (!canUse)
                    return;

                var args = context.Message.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                var target = args.Length > 1 ? args[1].TrimStart('@').ToLower() : null;
                if (string.IsNullOrEmpty(target))
                {
                    await messageSender.SendMessageAsync(context.Channel, $"🔗 @{context.Username}, uso: !permit @usuario");
                    return;
                }

                var moderation = scope.ServiceProvider.GetRequiredService<ModerationService>();
                var filter = await moderation.GetFilterAsync(context.Channel, LinkFilter.FilterKey);
                if (filter == null || !filter.Enabled)
                {
                    await messageSender.SendMessageAsync(context.Channel, $"🔗 @{context.Username}, el filtro de links está apagado: los links ya pasan sin permiso.");
                    return;
                }

                var settings = LinkFilterSettings.Parse(filter.Settings);
                LinkPermits.Grant(context.Channel, target, settings.PermitSeconds, settings.PermitSingleMessage);

                var duration = settings.PermitSeconds % 60 == 0 ? $"{settings.PermitSeconds / 60} min" : $"{settings.PermitSeconds} s";
                var reply = settings.PermitSingleMessage
                    ? $"🔗 @{target} puede enviar un mensaje con link en los próximos {duration}."
                    : $"🔗 @{target} puede enviar links durante {duration}.";
                await messageSender.SendMessageAsync(context.Channel, reply);

                _logger.LogInformation("[PERMIT] {Mod} dio permiso de links a {Target} en {Channel} ({Seconds}s, un mensaje: {Single})",
                    context.Username, target, context.Channel, settings.PermitSeconds, settings.PermitSingleMessage);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ejecutando !permit en {Channel}", context.Channel);
            }
        }
    }
}
