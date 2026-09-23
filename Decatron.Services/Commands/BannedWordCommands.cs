using System;
using System.Linq;
using System.Threading.Tasks;
using Decatron.Core.Models;
using Decatron.Core.Services.Moderation;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Commands
{
    /// <summary>
    /// !addword palabra o frase [leve|medio|severo] — agrega a las palabras prohibidas
    /// </summary>
    public class AddWordCommand : ModerationCommandBase
    {
        private static readonly string[] Severities = { "leve", "medio", "severo" };

        public override string Name => "!addword";
        public override string Description => "Agrega una palabra prohibida";
        protected override string ConfigKey => ModerationCommandsConfig.Words;

        public AddWordCommand(ILogger<AddWordCommand> logger, IServiceScopeFactory serviceScopeFactory) : base(logger, serviceScopeFactory) { }

        protected override async Task RunAsync(Run run)
        {
            var args = run.Args;
            var severity = "leve";
            if (args.Length > 1 && Severities.Contains(args[^1].ToLower()))
            {
                severity = args[^1].ToLower();
                args = args[..^1];
            }

            var word = string.Join(' ', args).Trim().ToLower();
            if (word.Length == 0)
            {
                await run.ReplyAsync($"🚫 @{run.Mod}, uso: !addword palabra [leve|medio|severo]");
                return;
            }
            if (word.Length > 500 || word.Trim('*').Length == 0)
            {
                await run.ReplyAsync($"🚫 @{run.Mod}, esa palabra no es válida.");
                return;
            }
            if (run.Context.ChannelUserId == null)
                return;

            var channel = run.Key;
            var db = run.Services.GetRequiredService<DecatronDbContext>();

            if (await db.BannedWords.AnyAsync(w => w.ChannelName == channel && w.Word.ToLower() == word))
            {
                await run.ReplyAsync($"🚫 @{run.Mod}, \"{word}\" ya estaba en la lista.");
                return;
            }
            if (await db.BannedWords.CountAsync(w => w.ChannelName == channel) >= 500)
            {
                await run.ReplyAsync($"🚫 @{run.Mod}, la lista ya tiene el máximo de 500 palabras.");
                return;
            }

            db.BannedWords.Add(new BannedWord
            {
                UserId = run.Context.ChannelUserId.Value,
                ChannelName = channel,
                Word = word,
                Severity = severity,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
            ModerationCache.Invalidate(channel);

            await run.Moderation.LogCommandActionAsync(channel, run.Context.ChannelUserId.Value, run.Mod, word, "comando", "add_word", BannedWordsFilter.FilterKey, run.Mod);

            var filter = await run.Moderation.GetFilterAsync(channel, BannedWordsFilter.FilterKey);
            var off = filter?.Enabled == true ? "" : " (el filtro de palabras está apagado; actívalo en el dashboard)";
            await run.ReplyAsync($"🚫 \"{word}\" agregada a las palabras prohibidas ({severity}).{off}");
        }
    }

    /// <summary>
    /// !delword palabra o frase — quita de las palabras prohibidas
    /// </summary>
    public class DelWordCommand : ModerationCommandBase
    {
        public override string Name => "!delword";
        public override string Description => "Quita una palabra prohibida";
        protected override string ConfigKey => ModerationCommandsConfig.Words;

        public DelWordCommand(ILogger<DelWordCommand> logger, IServiceScopeFactory serviceScopeFactory) : base(logger, serviceScopeFactory) { }

        protected override async Task RunAsync(Run run)
        {
            var word = string.Join(' ', run.Args).Trim().ToLower();
            if (word.Length == 0)
            {
                await run.ReplyAsync($"🚫 @{run.Mod}, uso: !delword palabra");
                return;
            }

            var channel = run.Key;
            var db = run.Services.GetRequiredService<DecatronDbContext>();
            var row = await db.BannedWords.FirstOrDefaultAsync(w => w.ChannelName == channel && w.Word.ToLower() == word);
            if (row == null)
            {
                await run.ReplyAsync($"🚫 @{run.Mod}, \"{word}\" no está en la lista.");
                return;
            }

            db.BannedWords.Remove(row);
            await db.SaveChangesAsync();
            ModerationCache.Invalidate(channel);

            if (run.Context.ChannelUserId.HasValue)
                await run.Moderation.LogCommandActionAsync(channel, run.Context.ChannelUserId.Value, run.Mod, word, "comando", "del_word", BannedWordsFilter.FilterKey, run.Mod);

            await run.ReplyAsync($"✅ \"{word}\" ya no está prohibida.");
        }
    }
}
