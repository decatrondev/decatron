using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models.GameOverlays;
using Decatron.Services.GameData.Riot;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.GameData.Providers
{
    /// <summary>
    /// League of Legends via Riot API (key de plataforma RiotApi:PlatformApiKey, App
    /// 736779). Rango = RANKED_SOLO_5x5 (flex de respaldo si no tiene solo). Partidas
    /// de la sesion = match-v5 filtrado por cola 420 desde el inicio del stream. Cada
    /// partida terminada se cachea 30 dias (no cambia nunca), asi el refresco de
    /// "ultimas partidas" cuesta 1 request de ids + solo las partidas nuevas.
    /// </summary>
    public class RiotLolProvider : IGameDataProvider
    {
        public const int QueueRankedSolo = 420;
        public const int QueueRankedFlex = 440;

        private readonly RiotApiClient _riot;
        private readonly RiotApiKeys _keys;
        private readonly GameDataCache _cache;
        private readonly ILogger<RiotLolProvider> _logger;

        public RiotLolProvider(RiotApiClient riot, RiotApiKeys keys, GameDataCache cache, ILogger<RiotLolProvider> logger)
        {
            _riot = riot;
            _keys = keys;
            _cache = cache;
            _logger = logger;
        }

        public string Game => GameIds.Lol;
        public string Provider => GameProviders.Riot;
        public bool IsAvailable => _keys.HasKeyFor(GameIds.Lol);

        public const string QueueSolo = "solo";
        public const string QueueFlex = "flex";

        public ProviderCapabilities Capabilities { get; } = new()
        {
            HasRank = true, HasExactPoints = true, HasRecentMatches = true, HasKda = true,
            HasLiveGame = true, IsManualOnly = false, RequiresVerification = true, RequiresRegion = true,
            SupportedQueues = new[] { QueueSolo, QueueFlex },
        };

        private static (int queueId, string queueType) QueueOf(string? queue) =>
            queue == QueueFlex ? (QueueRankedFlex, "RANKED_FLEX_SR") : (QueueRankedSolo, "RANKED_SOLO_5x5");

        private string Key => _keys.ForGame(GameIds.Lol) ?? throw new InvalidOperationException("Sin key de Riot para LoL");

        public async Task<(ResolvedAccount? account, string? error)> ResolveAsync(string name, string? tag, string? region, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(tag) || string.IsNullOrWhiteSpace(region))
                return (null, "Riot ID necesita nombre, tag y región");

            var (ok, puuid, error) = await _riot.ResolvePuuidAsync(region, name.Trim(), tag.Trim().TrimStart('#'), Key);
            if (!ok || string.IsNullOrEmpty(puuid))
                return (null, error != null && error.StartsWith("HTTP 404") ? "No existe esa cuenta de Riot en esa región" : error);

            return (new ResolvedAccount { ExternalId = puuid, ExternalName = name.Trim(), ExternalTag = tag.Trim().TrimStart('#'), Region = region }, null);
        }

        public async Task<RankInfo?> GetRankAsync(LinkedGameAccount account, string? queue = null, CancellationToken ct = default)
        {
            var (_, queueType) = QueueOf(queue);
            if (string.IsNullOrEmpty(account.Region) || string.IsNullOrEmpty(account.ExternalId)) return null;

            var (ok, entries, error) = await _riot.GetLeagueEntriesAsync(account.Region, account.ExternalId, Key);
            if (!ok)
            {
                _logger.LogDebug("LoL rank {Name}: {Error}", account.FullExternalName, error);
                return null;
            }

            // Cola elegida; si no tiene entrada en esa cola es UNRANKED en esa cola (no se
            // cae a la otra: el streamer eligio explicitamente que mostrar).
            var entry = entries.FirstOrDefault(e => e.QueueType == queueType);

            if (entry == null)
                return new RankInfo { Tier = "UNRANKED", PointsLabel = "LP", Queue = queueType, Emblem = "/games/lol/ranks/unranked.png", Source = "api" };

            return new RankInfo
            {
                Tier = entry.Tier.ToUpperInvariant(),
                Division = LolRanks.HasDivisions(entry.Tier) ? entry.Rank : null,
                Points = entry.LeaguePoints,
                PointsLabel = "LP",
                Wins = entry.Wins,
                Losses = entry.Losses,
                Queue = entry.QueueType,
                Emblem = $"/games/lol/ranks/{entry.Tier.ToLowerInvariant()}.png",
                IsExact = true,
                Source = "api",
            };
        }

        public async Task<IReadOnlyList<MatchSummary>> GetRecentMatchesAsync(LinkedGameAccount account, int count, DateTime? since, string? queue = null, CancellationToken ct = default)
        {
            if (string.IsNullOrEmpty(account.Region) || string.IsNullOrEmpty(account.ExternalId)) return Array.Empty<MatchSummary>();

            var (queueId, _) = QueueOf(queue);
            var (ok, ids, error) = await _riot.GetMatchIdsAsync(account.Region, account.ExternalId, Key, count, queueId, since);
            if (!ok)
            {
                _logger.LogDebug("LoL match ids {Name}: {Error}", account.FullExternalName, error);
                return Array.Empty<MatchSummary>();
            }

            var result = new List<MatchSummary>();
            foreach (var id in ids)
            {
                var summary = await FetchMatchAsync(account, id, queueId, ct);
                if (summary != null) result.Add(summary);
            }
            return result.OrderByDescending(m => m.EndedAt).ToList();
        }

        // "match2": la version anterior del cache no traia CS/daño/rol/icono.
        private Task<MatchSummary?> FetchMatchAsync(LinkedGameAccount account, string id, int queueId, CancellationToken ct) =>
            _cache.GetOrFetchAsync(Provider, account.ExternalId, $"match2:{id}", TimeSpan.FromDays(30), async () =>
            {
                var (mok, m, merr) = await _riot.GetMatchSummaryAsync(account.Region!, id, account.ExternalId, Key);
                if (!mok || m == null) return null;
                var champs = await ChampionsAsync(ct);
                // Remake: partida de menos de 5 min no cuenta como W/L.
                var isRemake = m.DurationSeconds < 300;
                return new MatchSummary
                {
                    Id = id,
                    Result = isRemake ? "remake" : (m.Win ? "win" : "loss"),
                    Kills = m.Kills, Deaths = m.Deaths, Assists = m.Assists,
                    Character = m.Champion,
                    CharacterIcon = m.ChampionId != null && champs.TryGetValue(m.ChampionId.Value, out var c) ? c.IconUrl : null,
                    Role = string.IsNullOrEmpty(m.Position) ? null : m.Position,
                    Cs = m.TotalCs,
                    CsPerMin = m.CsPerMin.HasValue ? (double)m.CsPerMin.Value : null,
                    Damage = m.DamageDealt,
                    VisionScore = m.VisionScore,
                    Queue = queueId.ToString(),
                    EndedAt = m.OccurredAt.AddSeconds(m.DurationSeconds),
                    DurationSeconds = m.DurationSeconds,
                };
            }, ct);

        private Task<Dictionary<int, RiotApiClient.DdragonChampion>> ChampionsAsync(CancellationToken ct) =>
            _cache.GetOrFetchAsync<Dictionary<int, RiotApiClient.DdragonChampion>>(Provider, "ddragon", "champions2", TimeSpan.FromDays(1),
                async () => await _riot.GetChampionsAsync(), ct)!;

        /// <summary>
        /// Ultimas 20 partidas de la cola (sin filtro de fecha): promedios, racha, top
        /// campeones, rol principal, mas top 3 de maestria. Se cachea 10 min por cuenta
        /// y cola; las partidas en si ya estan cacheadas 30 dias, asi que el costo real
        /// es 1 request de ids + solo las partidas nuevas + maestria cada hora.
        /// </summary>
        public async Task<AccountStats?> GetStatsAsync(LinkedGameAccount account, string? queue = null, CancellationToken ct = default)
        {
            if (string.IsNullOrEmpty(account.Region) || string.IsNullOrEmpty(account.ExternalId)) return null;
            var (queueId, _) = QueueOf(queue);

            return await _cache.GetOrFetchAsync(Provider, account.ExternalId, $"stats:{queueId}", TimeSpan.FromMinutes(10), async () =>
            {
                const int sample = 20;
                var (ok, ids, error) = await _riot.GetMatchIdsAsync(account.Region, account.ExternalId, Key, sample, queueId, null);
                if (!ok) { _logger.LogDebug("LoL stats ids {Name}: {Error}", account.FullExternalName, error); return null; }

                var matches = new List<MatchSummary>();
                foreach (var id in ids)
                {
                    var m = await FetchMatchAsync(account, id, queueId, ct);
                    if (m != null) matches.Add(m);
                }
                matches = matches.OrderByDescending(m => m.EndedAt).ToList();
                var played = matches.Where(m => m.Result is "win" or "loss").ToList();

                var stats = new AccountStats { SampleSize = played.Count, UpdatedAt = DateTime.UtcNow };
                if (played.Count > 0)
                {
                    stats.WinRate = Math.Round(100.0 * played.Count(m => m.Result == "win") / played.Count, 0);
                    stats.AvgKills = Math.Round(played.Average(m => m.Kills ?? 0), 1);
                    stats.AvgDeaths = Math.Round(played.Average(m => m.Deaths ?? 0), 1);
                    stats.AvgAssists = Math.Round(played.Average(m => m.Assists ?? 0), 1);
                    var deaths = played.Sum(m => m.Deaths ?? 0);
                    var ka = played.Sum(m => (m.Kills ?? 0) + (m.Assists ?? 0));
                    stats.AvgKda = Math.Round(deaths == 0 ? ka : ka / (double)deaths, 2);
                    var withCs = played.Where(m => m.CsPerMin.HasValue).ToList();
                    stats.AvgCsPerMin = withCs.Count > 0 ? Math.Round(withCs.Average(m => m.CsPerMin!.Value), 1) : null;
                    var withDmg = played.Where(m => m.Damage.HasValue).ToList();
                    stats.AvgDamage = withDmg.Count > 0 ? Math.Round(withDmg.Average(m => m.Damage!.Value), 0) : null;
                    var withVis = played.Where(m => m.VisionScore.HasValue).ToList();
                    stats.AvgVisionScore = withVis.Count > 0 ? Math.Round(withVis.Average(m => m.VisionScore!.Value), 1) : null;
                    stats.Streak = new SessionState { Matches = matches }.Streak;
                    stats.MainRole = played.Where(m => m.Role != null).GroupBy(m => m.Role).OrderByDescending(g => g.Count()).FirstOrDefault()?.Key;
                    stats.TopCharacters = played.Where(m => m.Character != null)
                        .GroupBy(m => m.Character!)
                        .Select(g =>
                        {
                            var d = g.Sum(m => m.Deaths ?? 0);
                            var k = g.Sum(m => (m.Kills ?? 0) + (m.Assists ?? 0));
                            return new CharacterStat
                            {
                                Name = g.Key, Icon = g.First().CharacterIcon, Games = g.Count(),
                                Wins = g.Count(m => m.Result == "win"), Losses = g.Count(m => m.Result == "loss"),
                                AvgKda = Math.Round(d == 0 ? k : k / (double)d, 2),
                            };
                        })
                        .OrderByDescending(c => c.Games).ThenByDescending(c => c.Wins).Take(5).ToList();
                }

                var mastery = await _cache.GetOrFetchAsync(Provider, account.ExternalId, "mastery", TimeSpan.FromHours(1), async () =>
                {
                    var (mok, entries, merr) = await _riot.GetTopMasteryAsync(account.Region, account.ExternalId, Key, 3);
                    if (!mok) { _logger.LogDebug("LoL mastery {Name}: {Error}", account.FullExternalName, merr); return null; }
                    var champs = await ChampionsAsync(ct);
                    return entries.Select(e => new MasteryInfo
                    {
                        Name = champs.TryGetValue(e.ChampionId, out var c) ? c.Name : $"#{e.ChampionId}",
                        Icon = champs.TryGetValue(e.ChampionId, out var c2) ? c2.IconUrl : null,
                        Level = e.Level, Points = e.Points,
                    }).ToList();
                }, ct);
                if (mastery != null) stats.Mastery = mastery;

                return stats;
            }, ct);
        }

        public async Task<LiveGameInfo?> GetLiveGameAsync(LinkedGameAccount account, CancellationToken ct = default)
        {
            if (string.IsNullOrEmpty(account.Region) || string.IsNullOrEmpty(account.ExternalId)) return null;

            var (ok, game, _) = await _riot.GetActiveGameAsync(account.Region, account.ExternalId, Key);
            if (!ok) return null;
            if (!game.InGame) return new LiveGameInfo { InGame = false };

            string? champion = null, icon = null;
            if (game.ChampionId != null)
            {
                var champs = await ChampionsAsync(ct);
                if (champs.TryGetValue(game.ChampionId.Value, out var c)) { champion = c.Name; icon = c.IconUrl; }
            }

            return new LiveGameInfo
            {
                InGame = true,
                Character = champion,
                CharacterIcon = icon,
                Queue = game.QueueId?.ToString(),
                StartedAt = game.StartedAt,
            };
        }
    }

    /// <summary>Escala absoluta de LoL para calcular deltas de LP entre divisiones.</summary>
    public static class LolRanks
    {
        private static readonly string[] Tiers = { "IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER" };
        private static readonly string[] Divisions = { "IV", "III", "II", "I" };

        public static bool HasDivisions(string tier) => Array.IndexOf(Tiers, tier.ToUpperInvariant()) is >= 0 and < 7;

        /// <summary>Puntos absolutos (0 = Iron IV 0 LP). null si es UNRANKED o desconocido.</summary>
        public static int? Absolute(RankInfo? rank)
        {
            if (rank == null || rank.IsUnranked) return null;
            var t = Array.IndexOf(Tiers, rank.Tier.ToUpperInvariant());
            if (t < 0) return null;
            var lp = rank.Points ?? 0;
            if (t >= 7) return 7 * 400 + lp; // Master+ comparten escala continua de LP
            var d = rank.Division == null ? 0 : Array.IndexOf(Divisions, rank.Division.ToUpperInvariant());
            if (d < 0) d = 0;
            return t * 400 + d * 100 + lp;
        }
    }
}
