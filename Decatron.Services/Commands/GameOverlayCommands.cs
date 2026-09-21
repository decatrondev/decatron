using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Core.Models.GameOverlays;
using Decatron.Data;
using Decatron.Services.GameData;
using Decatron.Services.GameData.Providers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Commands
{
    /// <summary>
    /// Comandos de chat del modulo Game Overlays (plan §3). Leen el MISMO estado
    /// que el overlay (GameOverlayStateStore / GameDataPollingService), asi lo que
    /// dice el chat y lo que se ve en pantalla nunca difieren. Funcionan en Twitch
    /// y Kick (el canal se resuelve por ChannelUserId).
    ///
    /// Publicos: !rango (!rank), !lp (!puntos), !sesion (!session), !ultimas (!recent), !cuentas (!accounts)
    /// Mod+:     !juego, !setrango, !rankup, !rankdown, !win, !loss
    /// Cada alias es una instancia con otro Name; el toggle de command_settings usa
    /// el nombre canonico (StateName).
    /// </summary>
    public abstract class GameOverlayCommandBase : ICommand
    {
        protected readonly ILogger _logger;
        protected readonly IServiceScopeFactory _scopeFactory;
        private readonly string _name;

        protected GameOverlayCommandBase(string name, ILogger logger, IServiceScopeFactory scopeFactory)
        {
            _name = name;
            _logger = logger;
            _scopeFactory = scopeFactory;
        }

        public string Name => "!" + _name;
        public abstract string Description { get; }
        /// <summary>Nombre canonico para command_settings (los alias comparten toggle).</summary>
        protected abstract string StateName { get; }
        protected virtual bool RequiresMod => false;

        public async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            try
            {
                if (context.ChannelUserId == null) return;
                using var scope = _scopeFactory.CreateScope();
                var sp = scope.ServiceProvider;
                var db = sp.GetRequiredService<DecatronDbContext>();
                var state = sp.GetRequiredService<ICommandStateService>();
                var messages = sp.GetRequiredService<ICommandMessagesService>();

                if (!await state.IsCommandEnabledAsync(context.ChannelUserId.Value, StateName)) return;

                var lang = await db.Users.Where(u => u.Id == context.ChannelUserId.Value).Select(u => u.PreferredLanguage).FirstOrDefaultAsync() ?? "es";

                if (RequiresMod && !(context.IsModerator || context.IsBroadcaster))
                {
                    await messageSender.SendMessageAsync(context.Channel, messages.GetMessage("gameoverlay", "mod_only", lang, context.Username));
                    return;
                }

                var ctx = new Ctx(context, sp, db, messages, lang, messageSender);
                await RunAsync(ctx);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[GameOverlay] error en {Command} por {User} en {Channel}", Name, context.Username, context.Channel);
            }
        }

        protected abstract Task RunAsync(Ctx ctx);

        protected sealed class Ctx
        {
            public CommandContext Context { get; }
            public IServiceProvider Services { get; }
            public DecatronDbContext Db { get; }
            public ICommandMessagesService Messages { get; }
            public string Lang { get; }
            public IMessageSender Sender { get; }
            public long ChannelUserId => Context.ChannelUserId!.Value;

            public Ctx(CommandContext context, IServiceProvider services, DecatronDbContext db, ICommandMessagesService messages, string lang, IMessageSender sender)
            {
                Context = context; Services = services; Db = db; Messages = messages; Lang = lang; Sender = sender;
            }

            public Task Say(string key, params object[] args) => Sender.SendMessageAsync(Context.Channel, Messages.GetMessage("gameoverlay", key, Lang, args));
            public string Msg(string key, params object[] args) => Messages.GetMessage("gameoverlay", key, Lang, args);

            /// <summary>Argumentos despues del comando.</summary>
            public string Args => string.Join(' ', Context.Message.Split(' ', StringSplitOptions.RemoveEmptyEntries).Skip(1)).Trim();
        }

        // ─── helpers compartidos ─────────────────────────────────────────────

        /// <summary>Primera instancia habilitada del canal ("main" si existe).</summary>
        protected static async Task<GameOverlayConfig?> GetInstanceAsync(Ctx ctx)
        {
            var list = await ctx.Db.GameOverlayConfigs.AsNoTracking().Where(c => c.UserId == ctx.ChannelUserId && c.IsEnabled).ToListAsync();
            return list.FirstOrDefault(c => c.Slug == "main") ?? list.OrderBy(c => c.Id).FirstOrDefault();
        }

        /// <summary>Estado actual (en vivo: del poller; offline: bajo demanda) para el juego activo o el pedido.</summary>
        protected static async Task<(OverlayState? state, GameOverlayConfig? instance, string? error)> GetStateAsync(Ctx ctx, string? requestedGame = null)
        {
            var instance = await GetInstanceAsync(ctx);
            if (instance == null) return (null, null, "not_configured");

            var poller = ctx.Services.GetRequiredService<GameDataPollingService>();
            var detection = ctx.Services.GetRequiredService<GameDetectionService>();

            if (!string.IsNullOrEmpty(requestedGame))
            {
                var game = ParseGame(requestedGame);
                if (game == null) return (null, instance, "unknown_game");
                // Juego distinto al activo: estado puntual sin tocar la deteccion.
                var current = detection.Resolve(ctx.ChannelUserId, instance).game;
                if (current != game)
                {
                    var adhoc = await poller.BuildStateForGameAsync(ctx.ChannelUserId, instance, game);
                    return (adhoc, instance, adhoc == null ? "not_configured" : null);
                }
            }

            var state = await poller.GetOrBuildStateAsync(ctx.ChannelUserId, instance.Slug);
            if (state == null || state.ActiveGame == null) return (state, instance, "no_game");
            if (state.Accounts.Count == 0) return (state, instance, "no_accounts");
            return (state, instance, null);
        }

        protected static AccountOverlayState? VisibleAccount(OverlayState state) =>
            state.Accounts.FirstOrDefault(a => a.AccountId == state.ActiveAccountId) ?? state.Accounts.FirstOrDefault();

        protected static string? ParseGame(string text)
        {
            var t = text.Trim().ToLowerInvariant();
            return t switch
            {
                "lol" or "league" or "leagueoflegends" => GameIds.Lol,
                "tft" or "teamfight" => GameIds.Tft,
                "val" or "valorant" => GameIds.Valorant,
                "mr" or "rivals" or "marvel" or "marvelrivals" or "marvel_rivals" => GameIds.MarvelRivals,
                "cs" or "cs2" or "csgo" or "counterstrike" => GameIds.Cs2,
                "fn" or "fortnite" => GameIds.Fortnite,
                "rl" or "rocket" or "rocketleague" or "rocket_league" => GameIds.RocketLeague,
                "wz" or "warzone" or "cod" => GameIds.Warzone,
                _ => GameIds.IsKnown(t) ? t : null,
            };
        }

        protected static string GameLabel(string game) => game switch
        {
            GameIds.Lol => "LoL", GameIds.Tft => "TFT", GameIds.Valorant => "Valorant", GameIds.MarvelRivals => "Marvel Rivals",
            GameIds.Cs2 => "CS2", GameIds.Fortnite => "Fortnite", GameIds.RocketLeague => "Rocket League", GameIds.Warzone => "Warzone", _ => game,
        };

        protected static string FormatRank(RankInfo? r)
        {
            if (r == null || r.IsUnranked) return "Unranked";
            var tier = r.Tier.ToLowerInvariant().Replace('_', ' ');
            tier = string.Join(' ', tier.Split(' ').Select(w => w.Length > 0 ? char.ToUpperInvariant(w[0]) + w[1..] : w));
            var s = tier + (string.IsNullOrEmpty(r.Division) ? "" : " " + r.Division);
            if (r.Points != null && !string.IsNullOrEmpty(r.PointsLabel)) s += $" {r.Points} {r.PointsLabel}";
            else if (r.Points != null && r.Points > 0) s += $" ({r.Points})";
            if (!r.IsExact && r.Source == "derived") s += " ≈";
            return s;
        }

        protected static string FormatDelta(int? delta, string label) =>
            delta == null ? "" : $"{(delta > 0 ? "+" : "")}{delta}{(string.IsNullOrEmpty(label) ? "" : " " + label)}";
    }

    // ─── publicos ────────────────────────────────────────────────────────────

    public class RangoCommand : GameOverlayCommandBase
    {
        public RangoCommand(string name, ILogger logger, IServiceScopeFactory f) : base(name, logger, f) { }
        public override string Description => "Rango actual del streamer en el juego que está jugando";
        protected override string StateName => "rango";

        protected override async Task RunAsync(Ctx ctx)
        {
            var (state, _, error) = await GetStateAsync(ctx, ctx.Args);
            if (error != null || state == null) { await ctx.Say(error ?? "no_game", ctx.Context.Username); return; }

            var parts = state.Accounts.Select(a => $"{a.DisplayName}: {FormatRank(a.Rank)}");
            await ctx.Say("rank", ctx.Context.Username, GameLabel(state.ActiveGame!), string.Join(" · ", parts));
        }
    }

    public class LpCommand : GameOverlayCommandBase
    {
        public LpCommand(string name, ILogger logger, IServiceScopeFactory f) : base(name, logger, f) { }
        public override string Description => "Puntos ganados o perdidos en el stream de hoy";
        protected override string StateName => "lp";

        protected override async Task RunAsync(Ctx ctx)
        {
            var (state, _, error) = await GetStateAsync(ctx);
            if (error != null || state == null) { await ctx.Say(error ?? "no_game", ctx.Context.Username); return; }

            var acc = VisibleAccount(state)!;
            var s = acc.Session;
            if (s == null || s.Wins < 0) { await ctx.Say("offline", ctx.Context.Username, acc.DisplayName, FormatRank(acc.Rank)); return; }

            var label = acc.Rank?.PointsLabel ?? "";
            var delta = FormatDelta(s.PointsDelta, label);
            await ctx.Say("lp", ctx.Context.Username, acc.DisplayName, string.IsNullOrEmpty(delta) ? "±0" : delta, s.Wins, s.Losses, FormatRank(acc.Rank));
        }
    }

    public class SesionCommand : GameOverlayCommandBase
    {
        public SesionCommand(string name, ILogger logger, IServiceScopeFactory f) : base(name, logger, f) { }
        public override string Description => "Victorias y derrotas del stream de hoy";
        protected override string StateName => "sesion";

        protected override async Task RunAsync(Ctx ctx)
        {
            var (state, _, error) = await GetStateAsync(ctx);
            if (error != null || state == null) { await ctx.Say(error ?? "no_game", ctx.Context.Username); return; }

            var live = state.Accounts.Where(a => a.Session != null && a.Session.Wins >= 0).ToList();
            if (live.Count == 0) { await ctx.Say("offline_session", ctx.Context.Username); return; }

            var wins = live.Sum(a => a.Session!.Wins);
            var losses = live.Sum(a => a.Session!.Losses);
            var deltas = live.Select(a => a.Session!.PointsDelta).Where(d => d != null).Select(d => d!.Value).ToList();
            var label = live.First().Rank?.PointsLabel ?? "";
            var delta = deltas.Count > 0 ? FormatDelta(deltas.Sum(), label) : "";
            var perAccount = live.Count > 1 ? " (" + string.Join(", ", live.Select(a => $"{a.DisplayName} {a.Session!.Wins}W-{a.Session.Losses}L")) + ")" : "";
            await ctx.Say("session", ctx.Context.Username, GameLabel(state.ActiveGame!), wins, losses, string.IsNullOrEmpty(delta) ? "" : $" · {delta}", perAccount);
        }
    }

    public class UltimasCommand : GameOverlayCommandBase
    {
        public UltimasCommand(string name, ILogger logger, IServiceScopeFactory f) : base(name, logger, f) { }
        public override string Description => "Últimas partidas del streamer";
        protected override string StateName => "ultimas";

        protected override async Task RunAsync(Ctx ctx)
        {
            var (state, _, error) = await GetStateAsync(ctx);
            if (error != null || state == null) { await ctx.Say(error ?? "no_game", ctx.Context.Username); return; }

            var acc = VisibleAccount(state)!;
            var matches = (acc.Session?.Matches ?? new List<MatchSummary>()).Where(m => m.Result != "remake").Take(5).ToList();
            if (matches.Count == 0) { await ctx.Say("no_matches", ctx.Context.Username, acc.DisplayName); return; }

            var seq = string.Join(" ", matches.Select(m => m.Result == "win" ? "W" : m.Result == "loss" ? "L" : "-"));
            var last = matches[0];
            var detail = last.Kills != null ? $"{last.Character} {last.Kills}/{last.Deaths}/{last.Assists}" : (last.Placement != null ? $"#{last.Placement}" : "");
            var kdas = matches.Where(m => m.Kda != null).Select(m => m.Kda!.Value).ToList();
            var avgKda = kdas.Count > 0 ? $" · KDA {Math.Round(kdas.Average(), 2)}" : "";
            await ctx.Say("recent", ctx.Context.Username, acc.DisplayName, seq, detail, avgKda);
        }
    }

    public class CuentasCommand : GameOverlayCommandBase
    {
        public CuentasCommand(string name, ILogger logger, IServiceScopeFactory f) : base(name, logger, f) { }
        public override string Description => "Cuentas del streamer en el juego actual";
        protected override string StateName => "cuentas";

        protected override async Task RunAsync(Ctx ctx)
        {
            var (state, _, error) = await GetStateAsync(ctx, ctx.Args);
            if (error != null || state == null) { await ctx.Say(error ?? "no_game", ctx.Context.Username); return; }

            var parts = state.Accounts.Select(a =>
                $"{a.DisplayName} ({a.ExternalName}{(string.IsNullOrEmpty(a.Region) ? "" : " " + a.Region.ToUpperInvariant())}): {FormatRank(a.Rank)}{(a.Live?.InGame == true ? " 🔴" : "")}");
            await ctx.Say("accounts", ctx.Context.Username, GameLabel(state.ActiveGame!), string.Join(" · ", parts));
        }
    }

    // ─── mod+ ────────────────────────────────────────────────────────────────

    public class JuegoCommand : GameOverlayCommandBase
    {
        public JuegoCommand(string name, ILogger logger, IServiceScopeFactory f) : base(name, logger, f) { }
        public override string Description => "Fuerza el juego del overlay (!juego lol) o vuelve a automático (!juego auto)";
        protected override string StateName => "juego";
        protected override bool RequiresMod => true;

        protected override async Task RunAsync(Ctx ctx)
        {
            var configs = ctx.Services.GetRequiredService<GameOverlayConfigService>();
            var detection = ctx.Services.GetRequiredService<GameDetectionService>();
            var arg = ctx.Args;

            if (string.IsNullOrEmpty(arg))
            {
                var d = detection.Get(ctx.ChannelUserId);
                var instance = await GetInstanceAsync(ctx);
                var (cur, reason) = instance != null ? detection.Resolve(ctx.ChannelUserId, instance) : (null, "idle");
                await ctx.Say("game_status", ctx.Context.Username, cur != null ? GameLabel(cur) : "—", d?.CategoryName ?? "—", reason == "manual" ? ctx.Msg("forced_tag") : "");
                return;
            }
            if (arg.Equals("auto", StringComparison.OrdinalIgnoreCase))
            {
                configs.ForceGame(ctx.ChannelUserId, null);
                await ctx.Say("game_auto", ctx.Context.Username);
                return;
            }
            var game = ParseGame(arg);
            if (game == null) { await ctx.Say("unknown_game", ctx.Context.Username); return; }
            configs.ForceGame(ctx.ChannelUserId, game);
            await ctx.Say("game_forced", ctx.Context.Username, GameLabel(game));
        }
    }

    /// <summary>!setrango Champion II [puntos] — fija el rango manual de la cuenta visible.</summary>
    public class SetRangoCommand : GameOverlayCommandBase
    {
        public SetRangoCommand(string name, ILogger logger, IServiceScopeFactory f) : base(name, logger, f) { }
        public override string Description => "Fija a mano el rango de la cuenta visible (juegos sin API)";
        protected override string StateName => "setrango";
        protected override bool RequiresMod => true;

        protected override async Task RunAsync(Ctx ctx)
        {
            var (state, _, error) = await GetStateAsync(ctx);
            if (error != null || state == null) { await ctx.Say(error ?? "no_game", ctx.Context.Username); return; }
            var acc = VisibleAccount(state)!;

            var words = ctx.Args.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
            if (words.Count == 0) { await ctx.Say("setrank_usage", ctx.Context.Username); return; }

            int? points = null;
            if (words.Count > 1 && int.TryParse(words[^1], out var p)) { points = p; words.RemoveAt(words.Count - 1); }
            string? division = null;
            if (words.Count > 1 && IsDivision(words[^1])) { division = words[^1].ToUpperInvariant(); words.RemoveAt(words.Count - 1); }
            var tier = string.Join('_', words).ToUpperInvariant();

            var accounts = ctx.Services.GetRequiredService<GameAccountService>();
            var row = await ctx.Db.LinkedGameAccounts.FirstOrDefaultAsync(a => a.Id == acc.AccountId);
            if (row == null) { await ctx.Say("no_accounts", ctx.Context.Username); return; }

            await accounts.SetManualRankAsync(row, new ManualRank { Tier = tier, Division = division, Points = points });
            ctx.Services.GetRequiredService<GameDataPollingService>().RequestRefresh(ctx.ChannelUserId);
            ctx.Services.GetRequiredService<GameDataPollingService>().InvalidateOffline(ctx.ChannelUserId);
            await ctx.Say("setrank_ok", ctx.Context.Username, acc.DisplayName, FormatRank(ManualProvider.FromManual(row)));
        }

        private static bool IsDivision(string s) => s.ToUpperInvariant() is "I" or "II" or "III" or "IV" or "1" or "2" or "3" or "4";
    }

    /// <summary>!rankup / !rankdown — sube o baja una division en el catalogo del juego (manual).</summary>
    public class RankStepCommand : GameOverlayCommandBase
    {
        private readonly int _direction;
        public RankStepCommand(string name, int direction, ILogger logger, IServiceScopeFactory f) : base(name, logger, f) { _direction = direction; }
        public override string Description => _direction > 0 ? "Sube una división el rango manual" : "Baja una división el rango manual";
        protected override string StateName => _direction > 0 ? "rankup" : "rankdown";
        protected override bool RequiresMod => true;

        protected override async Task RunAsync(Ctx ctx)
        {
            var (state, _, error) = await GetStateAsync(ctx);
            if (error != null || state == null) { await ctx.Say(error ?? "no_game", ctx.Context.Username); return; }
            var acc = VisibleAccount(state)!;
            var row = await ctx.Db.LinkedGameAccounts.FirstOrDefaultAsync(a => a.Id == acc.AccountId);
            if (row == null) { await ctx.Say("no_accounts", ctx.Context.Username); return; }

            var ladder = RankLadders.For(row.Game);
            if (ladder.Count == 0) { await ctx.Say("no_ladder", ctx.Context.Username); return; }

            var current = ManualProvider.FromManual(row) ?? acc.Rank;
            var idx = current == null ? -1 : ladder.FindIndex(r => r.tier == current.Tier && (r.division ?? "") == (current.Division ?? ""));
            var next = Math.Clamp((idx < 0 ? 0 : idx) + _direction, 0, ladder.Count - 1);
            var target = ladder[next];

            var accounts = ctx.Services.GetRequiredService<GameAccountService>();
            await accounts.SetManualRankAsync(row, new ManualRank { Tier = target.tier, Division = target.division, Points = 0 });
            ctx.Services.GetRequiredService<GameDataPollingService>().RequestRefresh(ctx.ChannelUserId);
            ctx.Services.GetRequiredService<GameDataPollingService>().InvalidateOffline(ctx.ChannelUserId);
            await ctx.Say(_direction > 0 ? "rankup_ok" : "rankdown_ok", ctx.Context.Username, acc.DisplayName, FormatRank(ManualProvider.FromManual(row)));
        }
    }

    /// <summary>!win / !loss — suma un resultado a la sesion de hoy (juegos sin API o correccion).</summary>
    public class WinLossCommand : GameOverlayCommandBase
    {
        private readonly bool _win;
        public WinLossCommand(string name, bool win, ILogger logger, IServiceScopeFactory f) : base(name, logger, f) { _win = win; }
        public override string Description => _win ? "Suma una victoria a la sesión de hoy" : "Suma una derrota a la sesión de hoy";
        protected override string StateName => _win ? "win" : "loss";
        protected override bool RequiresMod => true;

        protected override async Task RunAsync(Ctx ctx)
        {
            var (state, _, error) = await GetStateAsync(ctx);
            if (error != null || state == null) { await ctx.Say(error ?? "no_game", ctx.Context.Username); return; }
            var acc = VisibleAccount(state)!;
            var row = await ctx.Db.LinkedGameAccounts.FirstOrDefaultAsync(a => a.Id == acc.AccountId);
            if (row == null) { await ctx.Say("no_accounts", ctx.Context.Username); return; }

            var sessions = ctx.Services.GetRequiredService<GameSessionService>();
            var session = await sessions.GetOpenAsync(ctx.Db, ctx.ChannelUserId, row.Id)
                       ?? await sessions.GetOrOpenAsync(ctx.Db, ctx.ChannelUserId, row, DateTime.UtcNow, acc.Rank);
            await sessions.AddManualResultAsync(ctx.Db, session, _win);
            ctx.Services.GetRequiredService<GameDataPollingService>().RequestRefresh(ctx.ChannelUserId);
            await ctx.Say(_win ? "win_ok" : "loss_ok", ctx.Context.Username, acc.DisplayName, session.Wins, session.Losses);
        }
    }

    /// <summary>Escaleras de rango por juego para !rankup/!rankdown (mismo catalogo que el frontend).</summary>
    public static class RankLadders
    {
        private static List<(string tier, string? division)> Build(string[] tiersWithDiv, string[] divisions, string[] apex)
        {
            var list = new List<(string, string?)>();
            foreach (var t in tiersWithDiv) foreach (var d in divisions) list.Add((t, d));
            foreach (var a in apex) list.Add((a, null));
            return list;
        }

        private static readonly string[] IvToI = { "IV", "III", "II", "I" };
        private static readonly string[] IiiToI = { "III", "II", "I" };

        public static List<(string tier, string? division)> For(string game) => game switch
        {
            GameIds.Lol or GameIds.Tft => Build(new[] { "IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND" }, IvToI, new[] { "MASTER", "GRANDMASTER", "CHALLENGER" }),
            GameIds.Valorant => Build(new[] { "IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND", "ASCENDANT", "IMMORTAL" }, new[] { "1", "2", "3" }, new[] { "RADIANT" }),
            GameIds.MarvelRivals => Build(new[] { "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND", "GRANDMASTER", "CELESTIAL" }, IiiToI, new[] { "ETERNITY", "ONE_ABOVE_ALL" }),
            GameIds.Cs2 => Build(Array.Empty<string>(), Array.Empty<string>(), Enumerable.Range(1, 10).Select(i => $"LEVEL_{i}").ToArray()),
            GameIds.Fortnite => Build(new[] { "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND" }, new[] { "I", "II", "III" }, new[] { "ELITE", "CHAMPION", "UNREAL" }),
            GameIds.RocketLeague => Build(new[] { "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND", "CHAMPION", "GRAND_CHAMPION" }, new[] { "I", "II", "III" }, new[] { "SUPERSONIC_LEGEND" }),
            GameIds.Warzone => Build(new[] { "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND", "CRIMSON", "IRIDESCENT" }, new[] { "I", "II", "III" }, new[] { "TOP_250" }),
            _ => new List<(string, string?)>(),
        };
    }
}
