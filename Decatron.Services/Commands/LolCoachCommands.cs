using System;
using System.Linq;
using System.Threading.Tasks;
using Decatron.Core.Models.GameOverlays;
using Decatron.Services.GameData.LolLive;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Commands
{
    /// <summary>
    /// Comandos del Coach de LoL. Leen lo último que dijo el coach (en memoria, por
    /// canal); no consultan a la IA desde el chat — así el chat no puede gastar tokens.
    /// Mensajes en Resources/bot-messages/*.json grupo "lolcoach".
    /// Plan: .dev/plans/LOL_COACH_PLAN.md §2.6
    /// </summary>
    public abstract class LolCoachCommandBase : GameOverlayCommandBase
    {
        protected LolCoachCommandBase(string name, ILogger logger, IServiceScopeFactory scopeFactory) : base(name, logger, scopeFactory) { }

        protected static LolLiveStateStore.Entry? Live(Ctx ctx) => ctx.Services.GetRequiredService<LolLiveStateStore>().Get(ctx.ChannelUserId);

        protected static LiveCoachInfo? Last(Ctx ctx, Func<LiveCoachInfo, bool>? filter = null)
        {
            var e = Live(ctx);
            if (e == null) return null;
            return e.CoachHistory.AsEnumerable().Reverse().FirstOrDefault(c => filter == null || filter(c));
        }

        protected Task SayCoach(Ctx ctx, string key, params object[] args) =>
            ctx.Sender.SendMessageAsync(ctx.Context.Channel, ctx.Messages.GetMessage("lolcoach", key, ctx.Lang, args));

        protected static string Trunc(string s, int max = 380) => s.Length <= max ? s : s[..(max - 1)] + "…";
    }

    /// <summary>!matchup — el matchup de la partida actual (o el último) según el coach.</summary>
    public class MatchupCommand : LolCoachCommandBase
    {
        public MatchupCommand(string name, ILogger logger, IServiceScopeFactory scopeFactory) : base(name, logger, scopeFactory) { }
        public override string Description => "Matchup de la partida actual según el coach";
        protected override string StateName => "matchup";

        protected override async Task RunAsync(Ctx ctx)
        {
            var e = Live(ctx);
            if (e == null) { await SayCoach(ctx, "no_desktop", ctx.Context.Username); return; }
            var c = Last(ctx, x => x.Matchup != null) ?? Last(ctx);
            if (c == null) { await SayCoach(ctx, "nothing_yet", ctx.Context.Username); return; }
            var champ = e.Phase.Game?.Champion?.Name ?? e.Phase.ChampSelect?.MyPick?.Name ?? e.Phase.PostGame?.Champion?.Name ?? "?";
            await SayCoach(ctx, "matchup", ctx.Context.Username, c.CoachName, champ, Trunc(c.Matchup ?? c.Comment));
        }
    }

    /// <summary>!build / !runas — runas, hechizos y primeros ítems que sugirió el coach.</summary>
    public class BuildCommand : LolCoachCommandBase
    {
        public BuildCommand(string name, ILogger logger, IServiceScopeFactory scopeFactory) : base(name, logger, scopeFactory) { }
        public override string Description => "Runas, hechizos y build que sugirió el coach para esta partida";
        protected override string StateName => "build";

        protected override async Task RunAsync(Ctx ctx)
        {
            var e = Live(ctx);
            if (e == null) { await SayCoach(ctx, "no_desktop", ctx.Context.Username); return; }
            var c = Last(ctx, x => x.Runes != null || x.Build != null || x.Spells != null);
            if (c == null) { await SayCoach(ctx, "no_build", ctx.Context.Username); return; }
            var parts = new[] { c.Runes, c.Spells, c.Build }.Where(x => !string.IsNullOrWhiteSpace(x));
            var champ = e.Phase.Game?.Champion?.Name ?? e.Phase.ChampSelect?.MyPick?.Name ?? "?";
            await SayCoach(ctx, "build", ctx.Context.Username, c.CoachName, champ, Trunc(string.Join(" · ", parts)));
        }
    }

    /// <summary>!coach — lo último que dijo el coach (resumen post-partida si acaba de terminar). Mods y streamer.</summary>
    public class CoachCommand : LolCoachCommandBase
    {
        public CoachCommand(string name, ILogger logger, IServiceScopeFactory scopeFactory) : base(name, logger, scopeFactory) { }
        public override string Description => "Lo último que dijo el coach de LoL (o el resumen de la partida que acaba de terminar)";
        protected override string StateName => "coach";
        protected override bool RequiresMod => true;

        protected override async Task RunAsync(Ctx ctx)
        {
            var e = Live(ctx);
            if (e == null) { await SayCoach(ctx, "no_desktop", ctx.Context.Username); return; }
            var c = Last(ctx);
            if (c == null) { await SayCoach(ctx, "nothing_yet", ctx.Context.Username); return; }
            var tips = c.Tips.Count > 0 ? " · " + string.Join(" · ", c.Tips) : "";
            await SayCoach(ctx, "say", ctx.Context.Username, c.CoachName, Trunc(c.Comment + tips));
        }
    }
}
