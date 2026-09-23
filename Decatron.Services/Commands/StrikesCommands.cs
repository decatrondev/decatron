using System;
using System.Threading.Tasks;
using Decatron.Core.Services.Moderation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Commands
{
    /// <summary>
    /// !strikes usuario — en qué strike está y cuándo baja el próximo
    /// </summary>
    public class StrikesCommand : ModerationCommandBase
    {
        public override string Name => "!strikes";
        public override string Description => "Muestra los strikes de moderación de un usuario";
        protected override string ConfigKey => ModerationCommandsConfig.Strikes;

        public StrikesCommand(ILogger<StrikesCommand> logger, IServiceScopeFactory serviceScopeFactory) : base(logger, serviceScopeFactory) { }

        protected override async Task RunAsync(Run run)
        {
            var target = run.Target;
            if (string.IsNullOrEmpty(target))
            {
                await run.ReplyAsync($"⚖️ @{run.Mod}, uso: !strikes @usuario");
                return;
            }

            var (level, nextDecay) = await run.Moderation.GetStrikeStatusAsync(run.Key, target);
            if (level == 0)
            {
                await run.ReplyAsync($"⚖️ @{target} no tiene strikes.");
                return;
            }

            var decay = nextDecay.HasValue
                ? $" Baja uno en {ModerationText.Duration(Math.Max(1, (int)Math.Ceiling((nextDecay.Value - DateTime.Now).TotalMinutes)) * 60)}."
                : " No bajan solos en este canal.";
            await run.ReplyAsync($"⚖️ @{target} tiene {level}/5 strikes.{decay}");
        }
    }

    /// <summary>
    /// !resetstrikes usuario — deja sus strikes en 0
    /// </summary>
    public class ResetStrikesCommand : ModerationCommandBase
    {
        public override string Name => "!resetstrikes";
        public override string Description => "Deja en 0 los strikes de moderación de un usuario";
        protected override string ConfigKey => ModerationCommandsConfig.ResetStrikes;

        public ResetStrikesCommand(ILogger<ResetStrikesCommand> logger, IServiceScopeFactory serviceScopeFactory) : base(logger, serviceScopeFactory) { }

        protected override async Task RunAsync(Run run)
        {
            var target = run.Target;
            if (string.IsNullOrEmpty(target))
            {
                await run.ReplyAsync($"⚖️ @{run.Mod}, uso: !resetstrikes @usuario");
                return;
            }

            var previous = await run.Moderation.ResetStrikesAsync(run.Key, target);
            if (previous == 0)
            {
                await run.ReplyAsync($"⚖️ @{target} no tenía strikes.");
                return;
            }

            if (run.Context.ChannelUserId.HasValue)
                await run.Moderation.LogCommandActionAsync(run.Key, run.Context.ChannelUserId.Value, target,
                    $"{previous} → 0", "comando", "reset_strikes", "strikes", run.Mod);

            await run.ReplyAsync($"⚖️ @{target} ya no tiene strikes (tenía {previous}/5).");
        }
    }
}
