using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models.GameOverlays;
using Decatron.Data;
using Decatron.Services.GameData.Providers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.GameData
{
    /// <summary>
    /// Sesiones por stream (game_session_snapshots): una fila por (canal, cuenta,
    /// stream). Se abre con stream.online, se cierra con stream.offline; el poller
    /// la va actualizando con rango/partidas y de ahi salen el delta de LP del
    /// overlay, !sesion y el historico del panel. Retencion por tier.
    /// </summary>
    public class GameSessionService
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
        private readonly ILogger<GameSessionService> _logger;

        public GameSessionService(ILogger<GameSessionService> logger)
        {
            _logger = logger;
        }

        /// <summary>Sesion abierta de una cuenta en un canal, o null.</summary>
        public Task<GameSessionSnapshot?> GetOpenAsync(DecatronDbContext db, long userId, long linkedAccountId, CancellationToken ct = default) =>
            db.GameSessionSnapshots
                .Where(s => s.UserId == userId && s.LinkedAccountId == linkedAccountId && s.StreamEndedAt == null)
                .OrderByDescending(s => s.StreamStartedAt)
                .FirstOrDefaultAsync(ct);

        /// <summary>Abre (o devuelve) la sesion de esta cuenta para el stream actual.</summary>
        public async Task<GameSessionSnapshot> GetOrOpenAsync(DecatronDbContext db, long userId, LinkedGameAccount account, DateTime streamStartedAt, RankInfo? startRank, CancellationToken ct = default)
        {
            var open = await GetOpenAsync(db, userId, account.Id, ct);
            if (open != null) return open;

            var session = new GameSessionSnapshot
            {
                UserId = userId,
                LinkedAccountId = account.Id,
                Game = account.Game,
                StreamStartedAt = streamStartedAt,
                StartRankJson = startRank == null ? null : JsonSerializer.Serialize(startRank, Json),
                CurrentRankJson = startRank == null ? null : JsonSerializer.Serialize(startRank, Json),
            };
            db.GameSessionSnapshots.Add(session);
            await db.SaveChangesAsync(ct);
            _logger.LogInformation("🎮 [GameSession] abierta user {UserId} cuenta {Account} ({Game})", userId, account.FullExternalName, account.Game);
            return session;
        }

        /// <summary>Cierra todas las sesiones abiertas del canal (stream.offline).</summary>
        public async Task CloseAllAsync(DecatronDbContext db, long userId, CancellationToken ct = default)
        {
            var open = await db.GameSessionSnapshots
                .Where(s => s.UserId == userId && s.StreamEndedAt == null)
                .ToListAsync(ct);
            if (open.Count == 0) return;
            var now = DateTime.UtcNow;
            foreach (var s in open) { s.StreamEndedAt = now; s.UpdatedAt = now; }
            await db.SaveChangesAsync(ct);
            _logger.LogInformation("🎮 [GameSession] cerradas {Count} sesiones de user {UserId}", open.Count, userId);
        }

        /// <summary>
        /// Actualiza la sesion con lo que trajo el proveedor. Las partidas que ya
        /// estaban no se duplican; W-L se recalcula desde la lista (excluye remakes).
        /// Si el rango de inicio no estaba (primer poll sin datos) se fija ahora.
        /// </summary>
        public async Task UpdateAsync(DecatronDbContext db, GameSessionSnapshot session, RankInfo? rank, IReadOnlyList<MatchSummary> sessionMatches, int keep, CancellationToken ct = default)
        {
            if (rank != null)
            {
                session.CurrentRankJson = JsonSerializer.Serialize(rank, Json);
                if (session.StartRankJson == null) session.StartRankJson = session.CurrentRankJson;

                // Grafico de LP: una muestra por cambio de puntos (y la primera del stream).
                var abs = AbsolutePoints(session.Game, rank);
                if (abs != null)
                {
                    var history = Read<List<PointsSample>>(session.PointsHistoryJson) ?? new List<PointsSample>();
                    if (history.Count == 0 || history[^1].Absolute != abs.Value)
                    {
                        history.Add(new PointsSample { At = DateTime.UtcNow, Absolute = abs.Value, Label = ShortRank(rank) });
                        if (history.Count > 200) history.RemoveRange(0, history.Count - 200);
                        session.PointsHistoryJson = JsonSerializer.Serialize(history, Json);
                    }
                }
            }

            var existing = ReadMatches(session);
            var merged = existing.ToDictionary(m => m.Id);
            foreach (var m in sessionMatches) merged[m.Id] = m;
            var list = merged.Values.OrderByDescending(m => m.EndedAt).Take(Math.Max(keep, 20)).ToList();

            session.MatchesJson = JsonSerializer.Serialize(list, Json);
            session.Wins = list.Count(m => m.Result == "win");
            session.Losses = list.Count(m => m.Result == "loss");
            session.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }

        /// <summary>!win / !loss para juegos sin API (o para corregir a mano).</summary>
        public async Task AddManualResultAsync(DecatronDbContext db, GameSessionSnapshot session, bool win, CancellationToken ct = default)
        {
            var list = ReadMatches(session);
            list.Insert(0, new MatchSummary { Id = $"manual:{Guid.NewGuid():N}", Result = win ? "win" : "loss", EndedAt = DateTime.UtcNow });
            session.MatchesJson = JsonSerializer.Serialize(list.Take(50).ToList(), Json);
            session.Wins = list.Count(m => m.Result == "win");
            session.Losses = list.Count(m => m.Result == "loss");
            session.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }

        public SessionState ToState(GameSessionSnapshot session)
        {
            var start = Read<RankInfo>(session.StartRankJson);
            var current = Read<RankInfo>(session.CurrentRankJson);
            var matches = ReadMatches(session);
            return new SessionState
            {
                StartRank = start,
                CurrentRank = current,
                Wins = session.Wins,
                Losses = session.Losses,
                Matches = matches,
                StreamStartedAt = session.StreamStartedAt,
                PointsDelta = PointsDelta(session.Game, start, current),
                PointsHistory = Read<List<PointsSample>>(session.PointsHistoryJson) ?? new List<PointsSample>(),
            };
        }

        private static int? AbsolutePoints(string game, RankInfo rank) => game switch
        {
            GameIds.Lol => LolRanks.Absolute(rank),
            _ => rank.IsUnranked ? null : rank.Points,
        };

        /// <summary>"G II 45", "D 12", "Unranked".</summary>
        private static string ShortRank(RankInfo r)
        {
            if (r.IsUnranked) return "Unranked";
            var t = r.Tier.Length > 0 ? r.Tier[..1] : "";
            if (r.Tier.StartsWith("GRANDMASTER", StringComparison.OrdinalIgnoreCase)) t = "GM";
            return $"{t}{(r.Division != null ? " " + r.Division : "")}{(r.Points != null ? " " + r.Points : "")}".Trim();
        }

        /// <summary>Borra sesiones cerradas mas viejas que la retencion del tier.</summary>
        public async Task PurgeAsync(DecatronDbContext db, long userId, int historyDays, CancellationToken ct = default)
        {
            if (historyDays == int.MaxValue) return;
            var cutoff = DateTime.UtcNow.AddDays(-Math.Max(historyDays, 1));
            await db.GameSessionSnapshots
                .Where(s => s.UserId == userId && s.StreamEndedAt != null && s.StreamEndedAt < cutoff)
                .ExecuteDeleteAsync(ct);
        }

        private static int? PointsDelta(string game, RankInfo? start, RankInfo? current)
        {
            if (start == null || current == null) return null;
            return game switch
            {
                GameIds.Lol => LolRanks.Absolute(current) - LolRanks.Absolute(start),
                _ => (current.Points.HasValue && start.Points.HasValue && current.Tier == start.Tier && current.Division == start.Division)
                        ? current.Points - start.Points
                        : null,
            };
        }

        private static List<MatchSummary> ReadMatches(GameSessionSnapshot s) => Read<List<MatchSummary>>(s.MatchesJson) ?? new List<MatchSummary>();

        private static T? Read<T>(string? json) where T : class
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            try { return JsonSerializer.Deserialize<T>(json, Json); } catch { return null; }
        }
    }
}
