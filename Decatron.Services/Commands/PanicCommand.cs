using System;
using System.Threading.Tasks;
using Decatron.Core.Services.Moderation;
using Decatron.Services.Moderation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Commands
{
    /// <summary>
    /// !panico — activa el modo pánico (o lo extiende si ya estaba); !panico off lo apaga.
    /// </summary>
    public class PanicCommand : ModerationCommandBase
    {
        private readonly string _name;
        public override string Name => _name;
        public override string Description => "Activa o apaga el modo pánico del chat";
        protected override string ConfigKey => ModerationCommandsConfig.Panic;

        public PanicCommand(string name, ILogger<PanicCommand> logger, IServiceScopeFactory serviceScopeFactory) : base(logger, serviceScopeFactory)
        {
            _name = name;
        }

        protected override async Task RunAsync(Run run)
        {
            // Kick no deja cambiar los modos del chat (solo seguidores, solo emotes, Shield) desde su API
            if (run.Channel.IsKick)
            {
                await run.ReplyAsync($"🚨 @{run.Mod}, el modo pánico no está disponible en Kick: Kick no permite que los bots cambien los modos del chat.");
                return;
            }

            var panic = run.Services.GetRequiredService<PanicModeService>();
            var channel = run.Key;
            var arg = run.Args.Length > 0 ? run.Args[0].ToLower() : "";

            if (arg is "off" or "apagar" or "stop")
            {
                if (!await panic.DeactivateAsync(channel, run.Mod))
                    await run.ReplyAsync($"🚨 @{run.Mod}, el modo pánico no estaba activo.");
                return;
            }

            if (run.Context.ChannelUserId == null)
                return;

            var wasActive = PanicRegistry.IsActive(channel);
            var endsAt = await panic.ActivateAsync(channel, run.Context.ChannelUserId.Value, run.Mod, $"lo activó {run.Mod}");
            if (wasActive && endsAt.HasValue)
                await run.ReplyAsync($"🚨 Modo pánico extendido: se desactiva a las {endsAt.Value:HH:mm}. Para apagarlo ya: {Name} off");
        }
    }
}
