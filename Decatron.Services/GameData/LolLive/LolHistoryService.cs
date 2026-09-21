using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models.GameOverlays;
using Decatron.Services.GameData.Providers;
using Decatron.Services.GameData.Riot;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.GameData.LolLive
{
    /// <summary>
    /// Historial del PROPIO streamer (match-v5 de su cuenta: 100 % dentro del alcance de
    /// la key 736779) con los 10 participantes de cada partida, para responder "cómo me
    /// va contra X", "cómo me va con Y", "qué hice ayer". Cada partida se cachea 30 días
    /// (no cambia); la lista de ids, 10 min. Fase 3a del plan.
    /// </summary>
    public class LolHistoryService
    {
        public sealed record Participant(string Puuid, string? Name, string Champion, int ChampionId, string? Position, bool Win, int Kills, int Deaths, int Assists);
        public sealed record HistoryMatch(string Id, DateTime At, int QueueId, int DurationSeconds, Participant Me, List<Participant> Allies, List<Participant> Enemies)
        {
            public bool Win => Me.Win;
            public bool IsRemake => DurationSeconds < 300;
            /// <summary>Rival directo: el enemigo en mi misma posición (null en ARAM/Arena).</summary>
            public Participant? Opponent => string.IsNullOrEmpty(Me.Position) ? null : Enemies.FirstOrDefault(e => e.Position == Me.Position);
        }
        public sealed record Record(int Games, int Wins, int Losses)
        {
            public double? WinRate => Games > 0 ? Math.Round(100.0 * Wins / Games, 0) : null;
        }

        private const int DefaultCount = 60;

        private readonly RiotApiClient _riot;
        private readonly RiotApiKeys _keys;
        private readonly GameDataCache _cache;
        private readonly ILogger<LolHistoryService> _logger;

        public LolHistoryService(RiotApiClient riot, RiotApiKeys keys, GameDataCache cache, ILogger<LolHistoryService> logger)
        {
            _riot = riot; _keys = keys; _cache = cache; _logger = logger;
        }

        public bool IsAvailable => _keys.HasKeyFor(GameIds.Lol);

        /// <summary>Últimas partidas (todas las colas ranked/normal), más reciente primero. Vacío si falla.</summary>
        public Task<List<HistoryMatch>> GetAsync(LinkedGameAccount account, int count = DefaultCount, CancellationToken ct = default) =>
            string.IsNullOrEmpty(account.Region) || string.IsNullOrEmpty(account.ExternalId) ? Task.FromResult(new List<HistoryMatch>()) : GetAsync(account.Region, account.ExternalId, count, ct);

        /// <summary>Lo mismo para cualquier PUUID (fase 3b: los amigos del lobby). Las partidas en común ya están en cache.</summary>
        public async Task<List<HistoryMatch>> GetAsync(string region, string puuid, int count = DefaultCount, CancellationToken ct = default)
        {
            if (!IsAvailable || string.IsNullOrEmpty(region) || string.IsNullOrEmpty(puuid)) return new();
            var key = _keys.ForGame(GameIds.Lol)!;
            count = Math.Clamp(count, 1, 100);
            var account = new LinkedGameAccount { Region = region, ExternalId = puuid };

            var ids = await _cache.GetOrFetchAsync<List<string>>(GameProviders.Riot, puuid, $"history-ids:{count}", TimeSpan.FromMinutes(10), async () =>
            {
                var (ok, list, error) = await _riot.GetMatchIdsAsync(region, puuid, key, count, null, null);
                if (!ok) { _logger.LogDebug("LoL history ids {Puuid}: {Error}", puuid, error); return null; }
                return list;
            }, ct) ?? new List<string>();

            var result = new List<HistoryMatch>();
            foreach (var id in ids)
            {
                var all = await _cache.GetOrFetchAsync<List<RiotParticipantMatchStats>>(GameProviders.Riot, "match", $"all:{id}", TimeSpan.FromDays(30), async () =>
                {
                    var (ok, stats, error) = await _riot.GetMatchAllParticipantStatsAsync(account.Region, id, key);
                    return ok && stats.Count > 0 ? stats : null;
                }, ct);
                if (all == null) continue;
                var me = all.FirstOrDefault(p => string.Equals(p.Puuid, account.ExternalId, StringComparison.OrdinalIgnoreCase));
                if (me == null) continue;
                static Participant P(RiotParticipantMatchStats x) => new(x.Puuid, x.Name, x.Champion ?? "?", x.ChampionId, string.IsNullOrEmpty(x.Position) ? null : x.Position, x.Win, x.Kills, x.Deaths, x.Assists);
                result.Add(new HistoryMatch(id, me.OccurredAt, me.QueueId, me.DurationSeconds, P(me),
                    all.Where(p => p.TeamId == me.TeamId && p.Puuid != me.Puuid).Select(P).ToList(),
                    all.Where(p => p.TeamId != me.TeamId).Select(P).ToList()));
            }
            return result.OrderByDescending(m => m.At).ToList();
        }

        // ─── Consultas ──────────────────────────────────────────────────────────

        /// <summary>Cómo le va al streamer cuando el RIVAL (mismo rol si se sabe; si no, cualquier enemigo) juega ese campeón.</summary>
        public static (Record record, List<HistoryMatch> matches) VersusChampion(IEnumerable<HistoryMatch> history, string champion)
        {
            var list = history.Where(m => !m.IsRemake && (
                    (m.Opponent != null && Eq(m.Opponent.Champion, champion)) ||
                    (m.Opponent == null && m.Enemies.Any(e => Eq(e.Champion, champion))))).ToList();
            return (new Record(list.Count, list.Count(m => m.Win), list.Count(m => !m.Win)), list);
        }

        /// <summary>Cómo le va con un aliado concreto (por PUUID o por nombre).</summary>
        public static (Record record, List<HistoryMatch> matches) WithAlly(IEnumerable<HistoryMatch> history, string puuidOrName)
        {
            var list = history.Where(m => !m.IsRemake && m.Allies.Any(a =>
                string.Equals(a.Puuid, puuidOrName, StringComparison.OrdinalIgnoreCase) || (a.Name != null && Eq(a.Name, puuidOrName)))).ToList();
            return (new Record(list.Count, list.Count(m => m.Win), list.Count(m => !m.Win)), list);
        }

        /// <summary>Aliados con los que más ha jugado (los duos), con su récord.</summary>
        public static List<(string Puuid, string Name, Record Record)> FrequentAllies(IEnumerable<HistoryMatch> history, int minGames = 2)
        {
            return history.Where(m => !m.IsRemake).SelectMany(m => m.Allies.Select(a => (a, m.Win)))
                .GroupBy(x => x.a.Puuid)
                .Select(g => (g.Key, g.First().a.Name ?? "?", new Record(g.Count(), g.Count(x => x.Win), g.Count(x => !x.Win))))
                .Where(x => x.Item3.Games >= minGames)
                .OrderByDescending(x => x.Item3.Games).ToList();
        }

        /// <summary>Partidas entre dos instantes (UTC).</summary>
        public static List<HistoryMatch> Between(IEnumerable<HistoryMatch> history, DateTime fromUtc, DateTime toUtc) =>
            history.Where(m => !m.IsRemake && m.At >= fromUtc && m.At < toUtc).ToList();

        /// <summary>Campeón con mejor récord (mínimo 2 partidas) en el rango.</summary>
        public static (string Champion, Record Record)? BestChampion(IEnumerable<HistoryMatch> history, int minGames = 2) =>
            history.Where(m => !m.IsRemake).GroupBy(m => m.Me.Champion)
                .Select(g => (g.Key, new Record(g.Count(), g.Count(m => m.Win), g.Count(m => !m.Win))))
                .Where(x => x.Item2.Games >= minGames)
                .OrderByDescending(x => x.Item2.WinRate).ThenByDescending(x => x.Item2.Games)
                .Select(x => ((string, Record)?)x).FirstOrDefault();

        /// <summary>Racha actual: +N victorias seguidas, -N derrotas seguidas (más reciente primero).</summary>
        public static int Streak(IEnumerable<HistoryMatch> history)
        {
            var list = history.Where(m => !m.IsRemake).OrderByDescending(m => m.At).ToList();
            if (list.Count == 0) return 0;
            var win = list[0].Win; var n = 0;
            foreach (var m in list) { if (m.Win != win) break; n++; }
            return win ? n : -n;
        }

        /// <summary>Campeones más jugados en el rango, con su récord.</summary>
        public static List<(string Champion, Record Record)> TopChampions(IEnumerable<HistoryMatch> history, int count = 3) =>
            history.Where(m => !m.IsRemake).GroupBy(m => m.Me.Champion)
                .Select(g => (g.Key, new Record(g.Count(), g.Count(m => m.Win), g.Count(m => !m.Win))))
                .OrderByDescending(x => x.Item2.Games).ThenByDescending(x => x.Item2.WinRate).Take(count).ToList();

        private static bool Eq(string a, string b) => Normalize(a) == Normalize(b);
        /// <summary>"Kai'Sa" == "kaisa" == "KAISA".</summary>
        public static string Normalize(string s) => new string(s.ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());
    }
}
