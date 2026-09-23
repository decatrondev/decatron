using System;
using System.Linq;
using System.Threading.Tasks;
using Decatron.Core.Models;
using Decatron.Core.Services;
using Decatron.Core.Services.Moderation;
using Decatron.Services.Moderation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Commands
{
    /// <summary>
    /// !nuke frase — timeout (o ban, según el canal) a todos los que escribieron esa frase en
    /// los últimos N segundos. No toca al streamer, los mods, los Lead Mods ni la whitelist.
    /// </summary>
    public class NukeCommand : ModerationCommandBase
    {
        private const int MinPhraseLength = 3;

        public override string Name => "!nuke";
        public override string Description => "Sanciona a todos los que escribieron una frase en los últimos segundos";
        protected override string ConfigKey => ModerationCommandsConfig.Nuke;

        public NukeCommand(ILogger<NukeCommand> logger, IServiceScopeFactory serviceScopeFactory) : base(logger, serviceScopeFactory) { }

        protected override async Task RunAsync(Run run)
        {
            var phrase = string.Join(' ', run.Args).Trim();
            if (phrase.Length < MinPhraseLength)
            {
                await run.ReplyAsync($"💥 @{run.Mod}, uso: !nuke frase (mínimo {MinPhraseLength} letras)");
                return;
            }

            var channel = run.Key;
            var setting = run.Setting;
            var config = await run.Moderation.GetModerationConfigAsync(channel) ?? new ModerationConfig();

            var targets = RecentChatBuffer.Since(channel, TimeSpan.FromSeconds(setting.WindowSeconds))
                .Where(e => e.Text.Contains(phrase, StringComparison.OrdinalIgnoreCase))
                .GroupBy(e => e.Username)
                .Select(g => new ModerationTarget(g.Key, g.First().UserId))
                .Where(t => t.Username != run.Mod.ToLower() && !ModerationService.IsWhitelisted(config, t.Username))
                .Take(ModerationCommandsConfig.NukeMaxUsers)
                .ToList();

            if (targets.Count == 0)
            {
                var window = setting.WindowSeconds == 60 ? "el último minuto" : $"los últimos {ModerationText.Duration(setting.WindowSeconds)}";
                await run.ReplyAsync($"💥 Nadie escribió \"{phrase}\" en {window}.");
                return;
            }

            var ban = setting.Action == "ban";
            var reason = $"Nuke de {run.Mod}: \"{phrase}\"";
            var done = 0;

            foreach (var target in targets)
            {
                var ok = ban
                    ? await run.Moderator.BanAsync(target, reason)
                    : await run.Moderator.TimeoutAsync(target, setting.TimeoutSeconds, reason);
                if (!ok) continue;

                done++;
                await run.Moderation.LogCommandActionAsync(channel, run.Channel.UserId, target.Username, phrase,
                    ban ? "severo" : "medio", ban ? "ban" : $"timeout_{setting.TimeoutSeconds}s", "nuke", run.Mod, targetUserId: target.UserId);
            }

            _logger.LogWarning("[NUKE] {Mod} en {Channel}: \"{Phrase}\" → {Done}/{Total} usuarios ({Action})",
                run.Mod, channel, phrase, done, targets.Count, setting.Action);

            var what = ban ? "baneados" : $"con timeout de {ModerationText.Duration(setting.TimeoutSeconds)}";
            var failed = targets.Count - done;
            await run.ReplyAsync($"💥 Nuke de \"{phrase}\": {done} usuario{(done == 1 ? "" : "s")} {what}." +
                (failed > 0 ? $" {failed} no se {(failed == 1 ? "pudo" : "pudieron")} sancionar." : ""));
        }
    }
}
