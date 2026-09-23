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
            var lista = members.Where(m => !m.IsMe).ToList();
            await ResolvePuuidsAsync(region, lista, ct);
            var targets = lista.Where(m => !string.IsNullOrEmpty(m.Puuid) && !EsPuuidDelCliente(m.Puuid) && m.Scout == null).Take(MaxMembers).ToList();
            var sinId = lista.Count(m => string.IsNullOrEmpty(m.Puuid) || EsPuuidDelCliente(m.Puuid));
            if (sinId > 0) _logger.LogInformation("[LolScout] {Count} miembro(s) del lobby sin Riot ID: no se pueden consultar (¿Desktop anterior a v0.0.16?)", sinId);
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

        /// <summary>
        /// El PUUID que da el cliente de LoL (un UUID, "72886918-3fee-…") NO es el que acepta
        /// la API de Riot: esa usa uno cifrado por clave de aplicación, y con el del cliente
        /// responde 400 "Exception decrypting". Así estuvo el scouting del lobby hasta el
        /// 2026-09-23: sin rango ni partidas para nadie.
        /// </summary>
        private static bool EsPuuidDelCliente(string puuid) => Guid.TryParse(puuid, out _);

        /// <summary>
        /// Cambia el PUUID del cliente por el de la API buscando al jugador por su Riot ID
        /// (nombre#tag). Deja el PUUID bueno en el miembro, así el récord "partidas juntos"
        /// del historial también cruza con el jugador correcto. Cacheado un día: un Riot ID
        /// casi nunca cambia y el lobby se revisa en cada cambio de miembros.
        /// </summary>
        private async Task ResolvePuuidsAsync(string region, List<LiveLobbyMember> members, CancellationToken ct)
        {
            var key = _keys.ForGame(GameIds.Lol)!;
            foreach (var m in members)
            {
                if (string.IsNullOrEmpty(m.Name) || string.IsNullOrEmpty(m.Tag)) continue;
                if (!string.IsNullOrEmpty(m.Puuid) && !EsPuuidDelCliente(m.Puuid)) continue;
                try
                {
                    var riotId = $"{m.Name}#{m.Tag}".ToLowerInvariant();
                    var puuid = await _cache.GetOrFetchAsync<string>(GameProviders.Riot, riotId, "riot-id-puuid", TimeSpan.FromDays(1), async () =>
                    {
                        var (ok, found, error) = await _riot.ResolvePuuidAsync(region, m.Name, m.Tag, key);
                        if (!ok) { _logger.LogWarning("[LolScout] no se pudo resolver {Name}#{Tag}: {Error}", m.Name, m.Tag, error); return null; }
                        return found;
                    }, ct);
                    if (!string.IsNullOrEmpty(puuid)) m.Puuid = puuid;
                }
                catch (Exception ex) { _logger.LogDebug(ex, "[LolScout] Riot ID {Name}", m.Name); }
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
