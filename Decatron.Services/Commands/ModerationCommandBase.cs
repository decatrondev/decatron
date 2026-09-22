using System;
using System.Linq;
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
    /// Lo que comparten los comandos de moderación: se saltan Kick, respetan el interruptor
    /// del canal y el rol mínimo (moderator &lt; lead_moderator &lt; broadcaster, donde
    /// control_total cuenta como broadcaster). A quien no le alcanza el rol se lo ignora en silencio.
    /// </summary>
    public abstract class ModerationCommandBase : ICommand
    {
        protected readonly ILogger _logger;
        private readonly IServiceScopeFactory _serviceScopeFactory;

        public abstract string Name { get; }
        public abstract string Description { get; }
        /// <summary>Clave en ModerationCommandsConfig</summary>
        protected abstract string ConfigKey { get; }

        protected ModerationCommandBase(ILogger logger, IServiceScopeFactory serviceScopeFactory)
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
                var moderation = scope.ServiceProvider.GetRequiredService<ModerationService>();

                var setting = (await moderation.GetCommandConfigAsync(context.Channel))[ConfigKey];
                if (!setting.Enabled)
                    return;

                if (!await CanUseAsync(scope.ServiceProvider, context, setting.MinRole))
                    return;

                var args = context.Message.Split(' ', StringSplitOptions.RemoveEmptyEntries).Skip(1).ToArray();
                await RunAsync(new Run(context, messageSender, scope.ServiceProvider, moderation, setting, args));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ejecutando {Command} en {Channel}", Name, context.Channel);
            }
        }

        protected abstract Task RunAsync(Run run);

        private static async Task<bool> CanUseAsync(IServiceProvider services, CommandContext context, string minRole)
        {
            var required = ModerationCommandsConfig.RoleRank(minRole);
            var rank = context.IsBroadcaster ? 3 : context.IsLeadModerator ? 2 : context.IsModerator ? 1 : 0;
            if (rank >= required)
                return true;

            return await ModerationPermissions.HasControlTotalAsync(services, context.Channel, context.UserId);
        }

        protected record Run(
            CommandContext Context,
            IMessageSender Sender,
            IServiceProvider Services,
            ModerationService Moderation,
            ModerationCommandSetting Setting,
            string[] Args)
        {
            public Task ReplyAsync(string message) => Sender.SendMessageAsync(Context.Channel, message);

            /// <summary>Primer argumento como usuario (sin @), o null</summary>
            public string? Target => Args.Length > 0 ? Args[0].TrimStart('@').ToLower() : null;

            public string Mod => Context.Username;
        }
    }
}
