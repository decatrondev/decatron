using System;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;
using Decatron.Core.Models.GameOverlays;
using Decatron.Data;
using Decatron.Services.GameData;
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

        /// <summary>
        /// Cuenta de LoL del canal para consultas de historial: la que tiene abierta el
        /// Desktop; si no, la visible en el overlay; si no, la primera vinculada.
        /// </summary>
        protected static async Task<LinkedGameAccount?> AccountAsync(Ctx ctx)
        {
            var user = await ctx.Db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == ctx.ChannelUserId);
            if (user == null) return null;
            var accountId = user.AccountId ?? user.Id;
            var linked = await ctx.Db.LinkedGameAccounts.AsNoTracking().Where(a => a.AccountId == accountId && a.IsActive && a.Game == GameIds.Lol).ToListAsync();
            if (linked.Count == 0) return null;
            var live = Live(ctx)?.Puuid;
            if (live != null && linked.FirstOrDefault(a => string.Equals(a.ExternalId, live, StringComparison.OrdinalIgnoreCase)) is { } fromDesktop) return fromDesktop;
            var store = ctx.Services.GetRequiredService<GameOverlayStateStore>();
            var visible = store.AllFor(ctx.ChannelUserId).Where(s => s.ActiveGame == GameIds.Lol).Select(s => s.ActiveAccountId).FirstOrDefault();
            return linked.FirstOrDefault(a => a.Id == visible) ?? linked[0];
        }

        protected static async Task<(LinkedGameAccount? account, List<LolHistoryService.HistoryMatch> history)> HistoryAsync(Ctx ctx)
        {
            var account = await AccountAsync(ctx);
            if (account == null) return (null, new());
            var svc = ctx.Services.GetRequiredService<LolHistoryService>();
            return (account, await svc.GetAsync(account, 60));
        }

        protected static string Rec(LolHistoryService.Record r) => $"{r.Wins}W-{r.Losses}L ({r.WinRate ?? 0}%)";
    }

    /// <summary>!vs &lt;campeón&gt; — cómo le va al streamer contra ese campeón (rival directo), últimas 60.</summary>
    public class VsCommand : LolCoachCommandBase
    {
        public VsCommand(string name, ILogger logger, IServiceScopeFactory scopeFactory) : base(name, logger, scopeFactory) { }
        public override string Description => "Cómo le va al streamer contra un campeón (historial propio)";
        protected override string StateName => "vs";

        protected override async Task RunAsync(Ctx ctx)
        {
            var champ = ctx.Args;
            if (string.IsNullOrWhiteSpace(champ)) { await SayCoach(ctx, "vs_usage", ctx.Context.Username); return; }
            var (account, history) = await HistoryAsync(ctx);
            if (account == null) { await SayCoach(ctx, "no_account", ctx.Context.Username); return; }
            if (history.Count == 0) { await SayCoach(ctx, "no_history", ctx.Context.Username); return; }
            var (rec, matches) = LolHistoryService.VersusChampion(history, champ);
            if (rec.Games == 0) { await SayCoach(ctx, "vs_none", ctx.Context.Username, champ, history.Count); return; }
            var name = matches[0].Opponent?.Champion ?? matches[0].Enemies.First(e => LolHistoryService.Normalize(e.Champion) == LolHistoryService.Normalize(champ)).Champion;
            var mine = matches.GroupBy(m => m.Me.Champion).OrderByDescending(g => g.Count()).Take(2).Select(g => $"{g.Key} {g.Count(m => m.Win)}W-{g.Count(m => !m.Win)}L");
            await SayCoach(ctx, "vs", ctx.Context.Username, name, Rec(rec), string.Join(", ", mine), history.Count);
        }
    }

    /// <summary>!duo [nombre] — récord con el duo actual del lobby o con quien se pida; sin argumento y sin lobby, los duos más frecuentes.</summary>
    public class DuoCommand : LolCoachCommandBase
    {
        public DuoCommand(string name, ILogger logger, IServiceScopeFactory scopeFactory) : base(name, logger, scopeFactory) { }
        public override string Description => "Con quién juega el streamer y el récord juntos (historial propio)";
        protected override string StateName => "duo";

        protected override async Task RunAsync(Ctx ctx)
        {
            var (account, history) = await HistoryAsync(ctx);
            if (account == null) { await SayCoach(ctx, "no_account", ctx.Context.Username); return; }
            if (history.Count == 0) { await SayCoach(ctx, "no_history", ctx.Context.Username); return; }

            var who = ctx.Args;
            if (!string.IsNullOrWhiteSpace(who))
            {
                var (rec, _) = LolHistoryService.WithAlly(history, who);
                if (rec.Games == 0) await SayCoach(ctx, "duo_none", ctx.Context.Username, who);
                else await SayCoach(ctx, "duo_one", ctx.Context.Username, who, Rec(rec));
                return;
            }

            var lobby = Live(ctx)?.Phase.Lobby.Where(m => !m.IsMe).ToList() ?? new();
            if (lobby.Count > 0)
            {
                var parts = lobby.Select(m => { var (r, _) = LolHistoryService.WithAlly(history, m.Puuid ?? m.Name); return r.Games > 0 ? $"{m.Name} {Rec(r)}" : $"{m.Name} (primera vez)"; });
                await SayCoach(ctx, "duo_lobby", ctx.Context.Username, string.Join(" · ", parts));
                return;
            }

            var frequent = LolHistoryService.FrequentAllies(history, 2).Take(3).ToList();
            if (frequent.Count == 0) { await SayCoach(ctx, "duo_alone", ctx.Context.Username); return; }
            await SayCoach(ctx, "duo_frequent", ctx.Context.Username, string.Join(" · ", frequent.Select(f => $"{f.Name} {Rec(f.Record)}")));
        }
    }

    /// <summary>!pool — campeones más jugados del streamer con winrate (últimas 20 de la cola del overlay, o pool declarado).</summary>
    public class PoolCommand : LolCoachCommandBase
    {
        public PoolCommand(string name, ILogger logger, IServiceScopeFactory scopeFactory) : base(name, logger, scopeFactory) { }
        public override string Description => "Champ pool del streamer con winrate";
        protected override string StateName => "pool";

        protected override async Task RunAsync(Ctx ctx)
        {
            var account = await AccountAsync(ctx);
            if (account == null) { await SayCoach(ctx, "no_account", ctx.Context.Username); return; }
            var store = ctx.Services.GetRequiredService<GameOverlayStateStore>();
            var stats = store.AllFor(ctx.ChannelUserId).SelectMany(s => s.Accounts).FirstOrDefault(a => a.AccountId == account.Id)?.Stats;
            if (stats == null || stats.TopCharacters.Count == 0)
            {
                // Sin overlay en memoria: calcular desde el historial.
                var (_, history) = await HistoryAsync(ctx);
                if (history.Count == 0) { await SayCoach(ctx, "no_history", ctx.Context.Username); return; }
                var top = history.Where(m => !m.IsRemake).GroupBy(m => m.Me.Champion).OrderByDescending(g => g.Count()).Take(5)
                    .Select(g => $"{g.Key} {g.Count(m => m.Win)}W-{g.Count(m => !m.Win)}L");
                await SayCoach(ctx, "pool", ctx.Context.Username, string.Join(" · ", top));
                return;
            }
            var settings = await ctx.Db.LolCoachSettings.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == ctx.ChannelUserId);
            var declared = string.IsNullOrWhiteSpace(settings?.ChampPool) ? "" : ctx.Messages.GetMessage("lolcoach", "pool_declared", ctx.Lang, settings!.ChampPool);
            var list = stats.TopCharacters.Take(5).Select(c => $"{c.Name} {c.Wins}W-{c.Losses}L ({c.WinRate ?? 0}%)");
            await SayCoach(ctx, "pool", ctx.Context.Username, string.Join(" · ", list) + declared);
        }
    }

    /// <summary>!meta [texto] — ver o fijar el objetivo del día (fijar: streamer/mods).</summary>
    public class MetaCommand : LolCoachCommandBase
    {
        public MetaCommand(string name, ILogger logger, IServiceScopeFactory scopeFactory) : base(name, logger, scopeFactory) { }
        public override string Description => "Objetivo del día del streamer (verlo; mods y streamer lo fijan con !meta <texto>)";
        protected override string StateName => "meta";

        protected override async Task RunAsync(Ctx ctx)
        {
            var settings = await ctx.Db.LolCoachSettings.FirstOrDefaultAsync(x => x.UserId == ctx.ChannelUserId);
            var text = ctx.Args;
            if (string.IsNullOrWhiteSpace(text))
            {
                var goal = settings?.CurrentGoal;
                if (goal == null) await SayCoach(ctx, "meta_none", ctx.Context.Username);
                else await SayCoach(ctx, "meta", ctx.Context.Username, goal);
                return;
            }
            if (!(ctx.Context.IsModerator || ctx.Context.IsBroadcaster)) { await SayCoach(ctx, "mod_only", ctx.Context.Username); return; }
            if (settings == null) { settings = new LolCoachSettings { UserId = ctx.ChannelUserId }; ctx.Db.LolCoachSettings.Add(settings); }
            if (text.Equals("off", StringComparison.OrdinalIgnoreCase) || text.Equals("borrar", StringComparison.OrdinalIgnoreCase) || text.Equals("clear", StringComparison.OrdinalIgnoreCase))
            {
                settings.DailyGoal = ""; settings.GoalSetAt = null;
                await ctx.Db.SaveChangesAsync();
                await SayCoach(ctx, "meta_cleared", ctx.Context.Username);
                return;
            }
            settings.DailyGoal = text.Length > 200 ? text[..200] : text;
            settings.GoalSetAt = DateTime.UtcNow;
            settings.UpdatedAt = DateTime.UtcNow;
            await ctx.Db.SaveChangesAsync();
            await SayCoach(ctx, "meta_set", ctx.Context.Username, settings.DailyGoal);
        }
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

    /// <summary>
    /// !coach — lo último que dijo el coach (resumen post-partida si acaba de terminar).
    /// Abierto a todos con un cooldown por canal: cualquier viewer puede preguntar qué dijo
    /// sin que diez personas seguidas llenen el chat con la misma respuesta. Mods y streamer
    /// no esperan.
    /// </summary>
    public class CoachCommand : LolCoachCommandBase
    {
        private static readonly TimeSpan Cooldown = TimeSpan.FromSeconds(30);
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<long, DateTime> _ultimo = new();

        public CoachCommand(string name, ILogger logger, IServiceScopeFactory scopeFactory) : base(name, logger, scopeFactory) { }
        public override string Description => "Lo último que dijo el coach de LoL (o el resumen de la partida que acaba de terminar)";
        protected override string StateName => "coach";

        protected override async Task RunAsync(Ctx ctx)
        {
            var esMod = ctx.Context.IsModerator || ctx.Context.IsBroadcaster;
            var ahora = DateTime.UtcNow;
            if (!esMod && _ultimo.TryGetValue(ctx.ChannelUserId, out var antes) && ahora - antes < Cooldown) return;
            _ultimo[ctx.ChannelUserId] = ahora;

            var e = Live(ctx);
            if (e == null) { await SayCoach(ctx, "no_desktop", ctx.Context.Username); return; }
            var c = Last(ctx);
            if (c == null) { await SayCoach(ctx, "nothing_yet", ctx.Context.Username); return; }
            var tips = c.Tips.Count > 0 ? " · " + string.Join(" · ", c.Tips) : "";
            await SayCoach(ctx, "say", ctx.Context.Username, c.CoachName, Trunc(c.Comment + tips));
        }
    }
}

namespace Decatron.Services.Commands
{
    /// <summary>!pred win|loss [puntos] — apuesta de predicción sobre la partida en curso.</summary>
    public class PredCommand : LolCoachCommandBase
    {
        public PredCommand(string name, ILogger logger, IServiceScopeFactory scopeFactory) : base(name, logger, scopeFactory) { }
        public override string Description => "Predice si el streamer gana o pierde la partida en curso (puntos de predicción del canal)";
        protected override string StateName => "pred";

        protected override async Task RunAsync(Ctx ctx)
        {
            var settings = await ctx.Db.LolCoachSettings.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == ctx.ChannelUserId);
            if (settings == null || !settings.PredictionsEnabled) { await SayPred(ctx, "disabled", ctx.Context.Username); return; }
            var parts = ctx.Args.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var svc = ctx.Services.GetRequiredService<LolPredictionService>();
            var viewer = ctx.Context.Username.ToLowerInvariant();

            if (parts.Length == 0)
            {
                var pts = await svc.GetOrCreatePointsAsync(ctx.Db, ctx.ChannelUserId, viewer, settings.PredictionStartPoints);
                var open = await ctx.Db.LolPredictions.AnyAsync(p => p.UserId == ctx.ChannelUserId && p.ResolvedAt == null && p.ClosesAt > DateTime.UtcNow);
                await SayPred(ctx, open ? "usage_open" : "usage", ctx.Context.Username, pts.Points, pts.Correct, pts.Total);
                return;
            }
            var side = parts[0].ToLowerInvariant() switch
            {
                "win" or "gana" or "victoria" or "w" or "si" or "sí" => "win",
                "loss" or "lose" or "pierde" or "derrota" or "l" or "no" => "loss",
                _ => "",
            };
            var amount = parts.Length > 1 && int.TryParse(parts[1], out var a) ? a : 100;
            var r = await svc.BetAsync(ctx.Db, ctx.ChannelUserId, viewer, side, amount, settings.PredictionStartPoints);
            switch (r.Status)
            {
                case "ok": await SayPred(ctx, "placed", ctx.Context.Username, side == "win" ? ctx.Messages.GetMessage("lolpred", "side_win", ctx.Lang) : ctx.Messages.GetMessage("lolpred", "side_loss", ctx.Lang), r.Amount, r.Balance, r.PoolWin, r.PoolLoss); break;
                case "no_prediction": await SayPred(ctx, "none", ctx.Context.Username); break;
                case "closed": await SayPred(ctx, "closed", ctx.Context.Username); break;
                case "already": await SayPred(ctx, "already", ctx.Context.Username); break;
                case "not_enough": await SayPred(ctx, "not_enough", ctx.Context.Username, r.Balance); break;
                default: await SayPred(ctx, "invalid", ctx.Context.Username, LolPredictionService.MinBet); break;
            }
            if (r.Status == "ok") await svc.NotifyBetAsync(ctx.ChannelUserId); // pozo en vivo en el overlay
        }

        private Task SayPred(Ctx ctx, string key, params object[] args) => ctx.Sender.SendMessageAsync(ctx.Context.Channel, ctx.Messages.GetMessage("lolpred", key, ctx.Lang, args));
    }

    /// <summary>!predtop — ranking de puntos de predicción del canal.</summary>
    public class PredTopCommand : LolCoachCommandBase
    {
        public PredTopCommand(string name, ILogger logger, IServiceScopeFactory scopeFactory) : base(name, logger, scopeFactory) { }
        public override string Description => "Top 5 de puntos de predicción del canal";
        protected override string StateName => "predtop";

        protected override async Task RunAsync(Ctx ctx)
        {
            var top = await ctx.Db.LolPredictionPoints.Where(p => p.UserId == ctx.ChannelUserId && p.Total > 0).OrderByDescending(p => p.Points).Take(5).ToListAsync();
            if (top.Count == 0) { await ctx.Sender.SendMessageAsync(ctx.Context.Channel, ctx.Messages.GetMessage("lolpred", "top_empty", ctx.Lang, ctx.Context.Username)); return; }
            var list = string.Join(" · ", top.Select((p, i) => $"{i + 1}. {p.Viewer} {p.Points:N0} ({p.Correct}/{p.Total})"));
            await ctx.Sender.SendMessageAsync(ctx.Context.Channel, ctx.Messages.GetMessage("lolpred", "top", ctx.Lang, ctx.Context.Username, list));
        }
    }
}
