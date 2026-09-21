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
    /// Fase 3b del coach: datos públicos de los amigos que entran al lobby del streamer
    /// (rango solo/duo, winrate y racha de las últimas 20, top campeones). Solo lectura,
    /// cacheado (rango 1 h, historial 10 min, partidas 30 días compartidas con el streamer)
    /// y solo para el lobby de ese streamer. Descrito en la app 736779 de Riot (2026-09-20).
    /// Nunca lanza: si algo falla, el miembro se queda sin Scout.
    /// </summary>
    public class LolLobbyScoutService
    {
        public const int MaxMembers = 4;
        public const int RecentGames = 20;

        private readonly RiotApiClient _riot;
        private readonly RiotApiKeys _keys;
        private readonly GameDataCache _cache;
        private readonly LolHistoryService _history;
        private readonly ILogger<LolLobbyScoutService> _logger;

        public LolLobbyScoutService(RiotApiClient riot, RiotApiKeys keys, GameDataCache cache, LolHistoryService history, ILogger<LolLobbyScoutService> logger)
        {
            _riot = riot; _keys = keys; _cache = cache; _history = history; _logger = logger;
        }

        public bool IsAvailable => _keys.HasKeyFor(GameIds.Lol);

        /// <summary>Rellena <see cref="LiveLobbyMember.Scout"/> de los miembros que no son el streamer (los que tengan PUUID).</summary>
        public async Task ScoutAsync(string region, IEnumerable<LiveLobbyMember> members, CancellationToken ct = default)
        {
            if (!IsAvailable || string.IsNullOrEmpty(region)) return;
            var targets = members.Where(m => !m.IsMe && !string.IsNullOrEmpty(m.Puuid) && m.Scout == null).Take(MaxMembers).ToList();
            foreach (var m in targets)
            {
                try
                {
                    m.Scout = await _cache.GetOrFetchAsync<LiveLobbyScout>(GameProviders.Riot, m.Puuid!, "lobby-scout", TimeSpan.FromMinutes(10),
                        () => BuildAsync(region, m.Puuid!, ct), ct);
                    if (m.Scout != null) _logger.LogInformation("[LolScout] {Name}: {Tier} {Div} · {Games} partidas · {WinRate}% · racha {Streak}", m.Name, m.Scout.Tier ?? "unranked", m.Scout.Division, m.Scout.Games, m.Scout.WinRate, m.Scout.Streak);
                }
                catch (Exception ex) { _logger.LogDebug(ex, "[LolScout] {Name}", m.Name); }
            }
        }

        private async Task<LiveLobbyScout?> BuildAsync(string region, string puuid, CancellationToken ct)
        {
            var key = _keys.ForGame(GameIds.Lol)!;
            var scout = new LiveLobbyScout();

            var entries = await _cache.GetOrFetchAsync<List<RiotApiClient.LeagueEntry>>(GameProviders.Riot, puuid, "league-entries", TimeSpan.FromHours(1), async () =>
            {
                var (ok, list, error) = await _riot.GetLeagueEntriesAsync(region, puuid, key);
                if (!ok) { _logger.LogDebug("[LolScout] league {Puuid}: {Error}", puuid, error); return null; }
                return list;
            }, ct);
            var rank = entries?.FirstOrDefault(e => e.QueueType == "RANKED_SOLO_5x5") ?? entries?.FirstOrDefault(e => e.QueueType == "RANKED_FLEX_SR");
            if (rank != null)
            {
                scout.Tier = rank.Tier; scout.Division = rank.Rank; scout.Lp = rank.LeaguePoints;
                scout.RankWins = rank.Wins; scout.RankLosses = rank.Losses;
            }

            var history = await _history.GetAsync(region, puuid, RecentGames, ct);
            var played = history.Where(h => !h.IsRemake).ToList();
            scout.Games = played.Count;
            scout.WinRate = played.Count > 0 ? Math.Round(100.0 * played.Count(h => h.Win) / played.Count, 0) : null;
            scout.Streak = LolHistoryService.Streak(played);
            scout.TopChampions = LolHistoryService.TopChampions(played).Select(c => $"{c.Champion} {c.Record.Wins}-{c.Record.Losses}").ToList();
            return scout;
        }
    }
}
