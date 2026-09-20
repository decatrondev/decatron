using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Decatron.Core.Interfaces;
using Decatron.Core.Models.GameOverlays;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.GameData.LolLive
{
    /// <summary>
    /// Predicciones del chat: abrir al empezar la partida, apostar, cerrar al minuto N,
    /// resolver con el resultado real (parimutuel: los que acertaron se reparten el pozo
    /// de los que no, proporcional a lo apostado; si un lado quedó vacío, reembolso).
    /// Puntos de predicción por canal, gratis; nada que ver con DecaCoins.
    /// </summary>
    public class LolPredictionService
    {
        public const int MinBet = 10;

        private readonly IServiceScopeFactory _scopes;
        private readonly IMessageSender _chat;
        private readonly ILogger<LolPredictionService> _logger;

        public LolPredictionService(IServiceScopeFactory scopes, IMessageSender chat, ILogger<LolPredictionService> logger)
        {
            _scopes = scopes; _chat = chat; _logger = logger;
        }

        private string Msg(IServiceProvider sp, string key, string lang, params object[] args) =>
            sp.GetRequiredService<ICommandMessagesService>().GetMessage("lolpred", key, lang, args);

        /// <summary>Abre la predicción de esta partida (si no existe ya) y lo anuncia en el chat.</summary>
        public async Task OpenAsync(long userId, string login, string lang, LolCoachSettings settings, string gameKey, string? champion, DateTime startedAt)
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            if (await db.LolPredictions.AnyAsync(p => p.UserId == userId && p.GameKey == gameKey)) return;

            // Cualquier predicción anterior sin resolver (partida sin eog, app cerrada) se reembolsa.
            foreach (var stale in await db.LolPredictions.Where(p => p.UserId == userId && p.ResolvedAt == null).ToListAsync())
                await ResolveInternalAsync(db, stale, null);

            var closes = startedAt.AddMinutes(Math.Clamp(settings.PredictionCloseMinutes, 1, 20));
            if (closes <= DateTime.UtcNow.AddSeconds(30)) return; // llegamos tarde (reconexión a mitad de partida): no abrir
            db.LolPredictions.Add(new LolPrediction { UserId = userId, GameKey = gameKey, Champion = champion, ClosesAt = closes });
            await db.SaveChangesAsync();
            var minutes = Math.Max(1, (int)Math.Round((closes - DateTime.UtcNow).TotalMinutes));
            await SayAsync(login, Msg(scope.ServiceProvider, "opened", lang, champion ?? "?", minutes, settings.PredictionStartPoints));
        }

        /// <summary>Resuelve la predicción pendiente del canal con el resultado real y anuncia.</summary>
        public async Task ResolveAsync(long userId, string login, string lang, bool win)
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var pred = await db.LolPredictions.Where(p => p.UserId == userId && p.ResolvedAt == null).OrderByDescending(p => p.Id).FirstOrDefaultAsync();
            if (pred == null) return;
            var (result, winners, top) = await ResolveInternalAsync(db, pred, win);
            if (result == "refund")
                await SayAsync(login, Msg(scope.ServiceProvider, "refunded", lang, win ? Msg(scope.ServiceProvider, "side_win", lang) : Msg(scope.ServiceProvider, "side_loss", lang)));
            else
                await SayAsync(login, Msg(scope.ServiceProvider, "resolved", lang, win ? Msg(scope.ServiceProvider, "side_win", lang) : Msg(scope.ServiceProvider, "side_loss", lang),
                    winners, pred.PoolWin + pred.PoolLoss, top.Length > 0 ? " · " + top : ""));
        }

        /// <summary>Reembolsa lo pendiente (la partida terminó sin resultado, o se apagó la app).</summary>
        public async Task RefundPendingAsync(long userId)
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            foreach (var p in await db.LolPredictions.Where(p => p.UserId == userId && p.ResolvedAt == null).ToListAsync())
                await ResolveInternalAsync(db, p, null);
        }

        private async Task<(string result, int winners, string top)> ResolveInternalAsync(DecatronDbContext db, LolPrediction pred, bool? win)
        {
            var bets = await db.LolPredictionBets.Where(b => b.PredictionId == pred.Id).ToListAsync();
            var winSide = win == null ? null : win.Value ? "win" : "loss";
            var winnersList = winSide == null ? new List<LolPredictionBet>() : bets.Where(b => b.Side == winSide).ToList();
            var losersPool = winSide == null ? 0 : bets.Where(b => b.Side != winSide).Sum(b => (long)b.Amount);
            // Sin resultado, o un lado vacío (nadie contra quien repartir): todos recuperan lo suyo.
            var refund = winSide == null || winnersList.Count == 0 || losersPool == 0;

            var payouts = new List<(string viewer, long payout, bool correct)>();
            if (refund)
            {
                foreach (var b in bets) { b.Payout = b.Amount; payouts.Add((b.Viewer, b.Amount, false)); }
                pred.Result = "refund";
            }
            else
            {
                var winPool = winnersList.Sum(b => (long)b.Amount);
                foreach (var b in bets)
                {
                    if (b.Side == winSide)
                    {
                        b.Payout = b.Amount + (long)Math.Floor(losersPool * (b.Amount / (double)winPool));
                        payouts.Add((b.Viewer, b.Payout, true));
                    }
                    else { b.Payout = 0; payouts.Add((b.Viewer, 0, false)); }
                }
                pred.Result = winSide;
            }
            pred.ResolvedAt = DateTime.UtcNow;

            foreach (var (viewer, payout, correct) in payouts)
            {
                var pts = await db.LolPredictionPoints.FirstOrDefaultAsync(x => x.UserId == pred.UserId && x.Viewer == viewer);
                if (pts == null) continue;
                pts.Points += payout;
                if (!refund) { pts.Total++; if (correct) pts.Correct++; }
                pts.UpdatedAt = DateTime.UtcNow;
            }
            await db.SaveChangesAsync();

            var top = string.Join(", ", payouts.Where(p => p.correct).OrderByDescending(p => p.payout).Take(3).Select(p => $"{p.viewer} +{p.payout - bets.First(b => b.Viewer == p.viewer).Amount}"));
            return (pred.Result!, payouts.Count(p => p.correct), top);
        }

        // ─── Viewers ────────────────────────────────────────────────────────────

        public async Task<LolPredictionPoints> GetOrCreatePointsAsync(DecatronDbContext db, long userId, string viewer, int startPoints)
        {
            var pts = await db.LolPredictionPoints.FirstOrDefaultAsync(x => x.UserId == userId && x.Viewer == viewer);
            if (pts == null)
            {
                pts = new LolPredictionPoints { UserId = userId, Viewer = viewer, Points = startPoints };
                db.LolPredictionPoints.Add(pts);
                await db.SaveChangesAsync();
            }
            return pts;
        }

        public sealed record BetResult(string Status, long Balance = 0, int Amount = 0, long PoolWin = 0, long PoolLoss = 0);

        /// <summary>Status: ok | no_prediction | closed | already | not_enough | invalid</summary>
        public async Task<BetResult> BetAsync(DecatronDbContext db, long userId, string viewer, string side, int amount, int startPoints)
        {
            if (side is not ("win" or "loss") || amount < MinBet) return new BetResult("invalid");
            var pred = await db.LolPredictions.Where(p => p.UserId == userId && p.ResolvedAt == null).OrderByDescending(p => p.Id).FirstOrDefaultAsync();
            if (pred == null) return new BetResult("no_prediction");
            if (!pred.IsOpen) return new BetResult("closed");
            if (await db.LolPredictionBets.AnyAsync(b => b.PredictionId == pred.Id && b.Viewer == viewer)) return new BetResult("already");
            var pts = await GetOrCreatePointsAsync(db, userId, viewer, startPoints);
            if (pts.Points < amount) return new BetResult("not_enough", pts.Points);
            pts.Points -= amount; pts.UpdatedAt = DateTime.UtcNow;
            db.LolPredictionBets.Add(new LolPredictionBet { PredictionId = pred.Id, Viewer = viewer, Side = side, Amount = amount });
            if (side == "win") pred.PoolWin += amount; else pred.PoolLoss += amount;
            await db.SaveChangesAsync();
            return new BetResult("ok", pts.Points, amount, pred.PoolWin, pred.PoolLoss);
        }

        private async Task SayAsync(string login, string msg)
        {
            try { await _chat.SendMessageAsync(login, msg); }
            catch (Exception ex) { _logger.LogDebug(ex, "[LolPred] chat de {Login}", login); }
        }
    }
}
