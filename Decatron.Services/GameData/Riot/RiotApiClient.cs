using Microsoft.Extensions.Logging;
using System.Linq;
using System.Collections.Generic;
using System.Threading.Tasks;
using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;

namespace Decatron.Services.GameData.Riot
{
    public class RiotMatchSummary
    {
        public string MatchId { get; set; } = "";
        public DateTime OccurredAt { get; set; }
        public bool Win { get; set; }
        public string? Champion { get; set; }
        public int Kills { get; set; }
        public int Deaths { get; set; }
        public int Assists { get; set; }
        public int DurationSeconds { get; set; }
        public int? DamageDealt { get; set; }
        public int? VisionScore { get; set; }
        public int PentaKills { get; set; }
        public int? ChampionId { get; set; }
        /// <summary>teamPosition de match-v5: TOP | JUNGLE | MIDDLE | BOTTOM | UTILITY ("" en ARAM/Arena).</summary>
        public string? Position { get; set; }
        public decimal? CsPerMin => DurationSeconds > 0
            ? Math.Round((decimal)_totalCs / DurationSeconds * 60, 2)
            : null;

        private int _totalCs;
        public int TotalCs { set => _totalCs = value; get => _totalCs; }
    }

    // Stats finales de UN participante de una partida ya terminada — como
    // RiotMatchSummary pero con el puuid incluido, para poder sacar los 10 de una
    // sola llamada en vez de una por jugador (usado por el motor de condicion de
    // victoria de ARAM para poblar TournamentLpSnapshot y que "premio por metrica"
    // funcione tambien ahi, no solo en SoloQ Climb — agregado 24-08-2026).
    public class RiotParticipantMatchStats
    {
        public string Puuid { get; set; } = "";
        public DateTime OccurredAt { get; set; }
        public bool Win { get; set; }
        public string? Champion { get; set; }
        public int Kills { get; set; }
        public int Deaths { get; set; }
        public int Assists { get; set; }
        public int DurationSeconds { get; set; }
        public int? DamageDealt { get; set; }
        public int? VisionScore { get; set; }
        public int PentaKills { get; set; }
        public int TotalCs { get; set; }
        public decimal? CsPerMin => DurationSeconds > 0 ? Math.Round((decimal)TotalCs / DurationSeconds * 60, 2) : null;
    }

    // Un participante de una partida real de Riot — usado para mapear "puuid
    // conocido de nuestro TournamentParticipant" -> "participantId/teamId de esta
    // partida", necesario para leer el timeline (que solo habla en participantId).
    public class RiotMatchParticipantRef
    {
        public string Puuid { get; set; } = "";
        public int ParticipantId { get; set; }
        public int TeamId { get; set; } // 100 o 200
    }

    // Un evento del timeline (kills, torres, inhibidores) — solo los campos que
    // usa el motor de condicion de victoria, el resto del payload de Riot se ignora.
    public class RiotTimelineEvent
    {
        public string Type { get; set; } = ""; // "CHAMPION_KILL" | "BUILDING_KILL"
        public long Timestamp { get; set; } // ms desde el arranque de la partida
        public int? KillerId { get; set; } // 0 = una torre/minion, no un jugador
        public int? VictimId { get; set; }
        public int? TeamId { get; set; } // BUILDING_KILL: equipo DUEÑO de la estructura perdida
        public string? BuildingType { get; set; } // "TOWER_BUILDING" | "INHIBITOR_BUILDING"
    }

    // Snapshot de un participante en un frame (Riot manda uno cada ~60s).
    public class RiotParticipantFrame
    {
        public int ParticipantId { get; set; }
        public int MinionsKilled { get; set; }
        public int JungleMinionsKilled { get; set; }
        public int TotalGold { get; set; }
        public int Level { get; set; }
        public int DamageToChampions { get; set; }
    }

    public class RiotTimelineFrame
    {
        public long Timestamp { get; set; }
        public List<RiotParticipantFrame> Participants { get; set; } = new();
    }

    public class RiotMatchTimeline
    {
        public List<RiotTimelineFrame> Frames { get; set; } = new();
        public List<RiotTimelineEvent> Events { get; set; } = new();
    }

    /// <summary>
    /// Cliente de Riot API compartido por Torneos y Game Overlays (movido de
    /// Decatron.Services/Tournament/TournamentRiotApiClient.cs el 18-09-2026, Fase 0
    /// de .dev/plans/GAME_OVERLAYS_PLAN.md). Cubre account-v1, match-v5, league-v4,
    /// summoner-v4 y el timeline de match-v5.
    ///
    /// Es STATELESS respecto de la key: cada llamada recibe la key por parametro.
    /// Motivo: hay varias keys con scopes aprobados distintos que no se mezclan —
    /// la de plataforma (overlays de LoL, RiotApi:PlatformApiKey), las futuras de
    /// TFT/Valorant (productos aparte en el portal de Riot, ver RiotApiKeys) y la
    /// key propia de cada canal-tenant en Torneos (TournamentRiotConfig).
    ///
    /// GetMatchParticipantsAsync/GetMatchTimelineAsync existen para el motor de
    /// condicion de victoria de ARAM (TournamentWinConditionEngine) — necesitan el
    /// timeline minuto a minuto que GetMatchSummaryAsync no trae.
    /// </summary>
    public class RiotApiClient
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<RiotApiClient> _logger;
        private readonly RiotRateLimitGate _gate;

        // Riot separa "platform routing" (por servidor, ej. euw1) de "regional routing"
        // (agrupado por continente, ej. europe) segun el endpoint. match-v5 y account-v1
        // usan regional; league-v4 y spectator-v5 usan platform.
        private static readonly Dictionary<string, string> PlatformToRegional = new()
        {
            ["euw1"] = "europe", ["eun1"] = "europe", ["tr1"] = "europe", ["ru"] = "europe",
            ["na1"] = "americas", ["br1"] = "americas", ["la1"] = "americas", ["la2"] = "americas", ["oc1"] = "americas",
            ["kr"] = "asia", ["jp1"] = "asia",
        };

        public RiotApiClient(HttpClient httpClient, ILogger<RiotApiClient> logger, RiotRateLimitGate gate)
        {
            _httpClient = httpClient;
            _logger = logger;
            _gate = gate;
        }

        public static string RegionalRoutingFor(string platformRegion) =>
            PlatformToRegional.TryGetValue(platformRegion.ToLowerInvariant(), out var regional) ? regional : "europe";

        // Pasa por RiotRateLimitGate: espaciado por key y freno global ante 429 (con
        // Retry-After de Riot). Todos los consumidores — torneos y overlays — lo
        // heredan sin hacer nada.
        private async Task<(bool ok, JsonDocument? doc, string? error)> GetJsonAsync(string url, string apiKey)
        {
            await _gate.WaitAsync(apiKey);

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("X-Riot-Token", apiKey);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            using var response = await _httpClient.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                if ((int)response.StatusCode == 429)
                {
                    var retryAfter = response.Headers.RetryAfter?.Delta;
                    _gate.Block(apiKey, retryAfter);
                    _logger.LogWarning("Riot API 429 en {Url} — key frenada {Seconds}s", url, (retryAfter ?? TimeSpan.FromSeconds(10)).TotalSeconds);
                }
                else
                {
                    _logger.LogWarning("Riot API {Url} -> {Status}: {Body}", url, (int)response.StatusCode, body);
                }
                return (false, null, $"HTTP {(int)response.StatusCode}: {body}");
            }

            return (true, JsonDocument.Parse(body), null);
        }

        // ─── Endpoints agregados para Game Overlays (Fase 1, 18-09-2026) ───────────

        public class LeagueEntry
        {
            public string QueueType { get; set; } = "";
            public string Tier { get; set; } = "";
            public string Rank { get; set; } = "";
            public int LeaguePoints { get; set; }
            public int Wins { get; set; }
            public int Losses { get; set; }
        }

        /// <summary>Todas las entradas de league-v4 (solo, flex...) con W/L incluidos.</summary>
        public async Task<(bool ok, List<LeagueEntry> entries, string? error)> GetLeagueEntriesAsync(string platformRegion, string puuid, string apiKey)
        {
            var url = $"https://{platformRegion}.api.riotgames.com/lol/league/v4/entries/by-puuid/{puuid}";
            var (ok, doc, error) = await GetJsonAsync(url, apiKey);
            if (!ok || doc == null) return (false, new List<LeagueEntry>(), error);

            using (doc)
            {
                var list = new List<LeagueEntry>();
                foreach (var e in doc.RootElement.EnumerateArray())
                {
                    list.Add(new LeagueEntry
                    {
                        QueueType = e.GetProperty("queueType").GetString() ?? "",
                        Tier = e.TryGetProperty("tier", out var t) ? t.GetString() ?? "" : "",
                        Rank = e.TryGetProperty("rank", out var r) ? r.GetString() ?? "" : "",
                        LeaguePoints = e.TryGetProperty("leaguePoints", out var lp) ? lp.GetInt32() : 0,
                        Wins = e.TryGetProperty("wins", out var w) ? w.GetInt32() : 0,
                        Losses = e.TryGetProperty("losses", out var l) ? l.GetInt32() : 0,
                    });
                }
                return (true, list, null);
            }
        }

        /// <summary>
        /// Ids de partidas filtrados por cola y/o desde una fecha (match-v5 lo soporta
        /// nativo) — para "partidas de esta sesion" sin traer historial de mas.
        /// </summary>
        public async Task<(bool ok, List<string> matchIds, string? error)> GetMatchIdsAsync(
            string platformRegion, string puuid, string apiKey, int count = 20, int? queue = null, DateTime? startTime = null)
        {
            var regional = RegionalRoutingFor(platformRegion);
            var url = $"https://{regional}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?count={count}";
            if (queue != null) url += $"&queue={queue}";
            if (startTime != null) url += $"&startTime={new DateTimeOffset(startTime.Value.ToUniversalTime()).ToUnixTimeSeconds()}";

            var (ok, doc, error) = await GetJsonAsync(url, apiKey);
            if (!ok || doc == null) return (false, new List<string>(), error);

            using (doc)
            {
                var ids = doc.RootElement.EnumerateArray().Select(e => e.GetString() ?? "").Where(s => s != "").ToList();
                return (true, ids, null);
            }
        }

        public class ActiveGame
        {
            public bool InGame { get; set; }
            public int? ChampionId { get; set; }
            public int? QueueId { get; set; }
            public DateTime? StartedAt { get; set; }
        }

        /// <summary>
        /// spectator-v5: partida en curso de la cuenta. 404 = no esta en partida (no es
        /// error). Es el endpoint mas caro en rate limit: el poller solo lo consulta
        /// cuando la config lo pide (rotacion active_first).
        /// </summary>
        public async Task<(bool ok, ActiveGame game, string? error)> GetActiveGameAsync(string platformRegion, string puuid, string apiKey)
        {
            var url = $"https://{platformRegion}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/{puuid}";
            var (ok, doc, error) = await GetJsonAsync(url, apiKey);
            if (!ok)
            {
                if (error != null && error.StartsWith("HTTP 404")) return (true, new ActiveGame { InGame = false }, null);
                return (false, new ActiveGame(), error);
            }
            if (doc == null) return (false, new ActiveGame(), "sin cuerpo");

            using (doc)
            {
                var root = doc.RootElement;
                var game = new ActiveGame
                {
                    InGame = true,
                    QueueId = root.TryGetProperty("gameQueueConfigId", out var q) ? q.GetInt32() : null,
                    StartedAt = root.TryGetProperty("gameStartTime", out var st) && st.GetInt64() > 0
                        ? DateTimeOffset.FromUnixTimeMilliseconds(st.GetInt64()).UtcDateTime
                        : null,
                };
                if (root.TryGetProperty("participants", out var parts))
                {
                    foreach (var p in parts.EnumerateArray())
                    {
                        if (p.TryGetProperty("puuid", out var pp) && pp.GetString() == puuid)
                        {
                            game.ChampionId = p.TryGetProperty("championId", out var c) ? c.GetInt32() : null;
                            break;
                        }
                    }
                }
                return (true, game, null);
            }
        }

        /// <summary>
        /// Mapa championId -> nombre desde Data Dragon (sin key, sin rate limit de la
        /// API). Se cachea arriba (GameDataCache) por un dia.
        /// </summary>
        /// <summary>Un campeon del Data Dragon: id numerico, clave ("KaiSa") y nombre ("Kai'Sa").</summary>
        public sealed record DdragonChampion(int Id, string Key, string Name, string IconUrl);

        /// <summary>Version actual de Data Dragon (cacheada 1 h en memoria del cliente).</summary>
        public async Task<string> GetDdragonVersionAsync()
        {
            if (_ddragonVersion != null && DateTime.UtcNow - _ddragonVersionAt < TimeSpan.FromHours(1)) return _ddragonVersion;
            try
            {
                var versions = await _httpClient.GetStringAsync("https://ddragon.leagueoflegends.com/api/versions.json");
                using var vdoc = JsonDocument.Parse(versions);
                _ddragonVersion = vdoc.RootElement[0].GetString() ?? "14.1.1";
                _ddragonVersionAt = DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo leer versions.json de Data Dragon");
                _ddragonVersion ??= "14.1.1";
            }
            return _ddragonVersion;
        }
        private string? _ddragonVersion;
        private DateTime _ddragonVersionAt;

        public static string ChampionIconUrl(string version, string key) => $"https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{key}.png";

        /// <summary>Catalogo completo de campeones (id numerico -> datos) desde Data Dragon.</summary>
        public async Task<Dictionary<int, DdragonChampion>> GetChampionsAsync()
        {
            try
            {
                var version = await GetDdragonVersionAsync();
                var json = await _httpClient.GetStringAsync($"https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/champion.json");
                using var doc = JsonDocument.Parse(json);
                var map = new Dictionary<int, DdragonChampion>();
                foreach (var champ in doc.RootElement.GetProperty("data").EnumerateObject())
                {
                    if (!int.TryParse(champ.Value.GetProperty("key").GetString(), out var id)) continue;
                    var name = champ.Value.GetProperty("name").GetString() ?? champ.Name;
                    map[id] = new DdragonChampion(id, champ.Name, name, ChampionIconUrl(version, champ.Name));
                }
                return map;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo leer champion.json de Data Dragon");
                return new Dictionary<int, DdragonChampion>();
            }
        }

        public sealed record ChampionMasteryEntry(int ChampionId, int Level, int Points);

        /// <summary>Top N de maestria de campeon (champion-mastery-v4).</summary>
        public async Task<(bool ok, List<ChampionMasteryEntry> entries, string? error)> GetTopMasteryAsync(string platformRegion, string puuid, string apiKey, int count = 3)
        {
            var url = $"https://{platformRegion}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}/top?count={count}";
            var (ok, doc, error) = await GetJsonAsync(url, apiKey);
            if (!ok || doc == null) return (false, new List<ChampionMasteryEntry>(), error);
            using (doc)
            {
                var list = new List<ChampionMasteryEntry>();
                foreach (var e in doc.RootElement.EnumerateArray())
                {
                    list.Add(new ChampionMasteryEntry(
                        e.GetProperty("championId").GetInt32(),
                        e.TryGetProperty("championLevel", out var lv) ? lv.GetInt32() : 0,
                        e.TryGetProperty("championPoints", out var pts) ? pts.GetInt32() : 0));
                }
                return (true, list, null);
            }
        }

        public async Task<Dictionary<int, string>> GetChampionNamesAsync()
        {
            try
            {
                var versions = await _httpClient.GetStringAsync("https://ddragon.leagueoflegends.com/api/versions.json");
                using var vdoc = JsonDocument.Parse(versions);
                var version = vdoc.RootElement[0].GetString() ?? "14.1.1";
                var json = await _httpClient.GetStringAsync($"https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/champion.json");
                using var doc = JsonDocument.Parse(json);
                var map = new Dictionary<int, string>();
                foreach (var champ in doc.RootElement.GetProperty("data").EnumerateObject())
                {
                    var key = champ.Value.GetProperty("key").GetString();
                    if (int.TryParse(key, out var id))
                        map[id] = champ.Value.GetProperty("name").GetString() ?? champ.Name;
                }
                return map;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo leer champion.json de Data Dragon");
                return new Dictionary<int, string>();
            }
        }

        /// <summary>
        /// Prueba si una key es realmente valida contra Riot, sin depender de que
        /// exista ninguna cuenta real — pide una cuenta que casi seguro no existe
        /// (account-v1) y mira el status HTTP: 404 = la key funciona (Riot llego a
        /// autenticar la request y solo no encontro la cuenta), 401/403 = la key en
        /// si esta mal/vencida/no autorizada. Usado por el boton "Guardar" del panel
        /// de Riot API para avisar en el momento en vez de que el usuario se entere
        /// recien cuando el poller falla 3 minutos despues. Agregado 24-08-2026,
        /// pedido del usuario: "mejor si agregar verificar api key".
        /// </summary>
        public async Task<(bool valid, string? error)> VerifyApiKeyAsync(string apiKey)
        {
            var url = "https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/decatron-key-check/0000";
            var (ok, doc, error) = await GetJsonAsync(url, apiKey);
            doc?.Dispose();

            if (ok) return (true, null);
            if (error != null && error.StartsWith("HTTP 404")) return (true, null);
            return (false, error);
        }

        public async Task<(bool ok, string? puuid, string? error)> ResolvePuuidAsync(string platformRegion, string gameName, string tagLine, string apiKey)
        {
            var regional = RegionalRoutingFor(platformRegion);
            var url = $"https://{regional}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{Uri.EscapeDataString(gameName)}/{Uri.EscapeDataString(tagLine)}";

            var (ok, doc, error) = await GetJsonAsync(url, apiKey);
            if (!ok || doc == null) return (false, null, error);

            using (doc)
            {
                var puuid = doc.RootElement.GetProperty("puuid").GetString();
                return (true, puuid, null);
            }
        }

        public async Task<(bool ok, List<string> matchIds, string? error)> GetRecentMatchIdsAsync(string platformRegion, string puuid, string apiKey, int count = 5)
        {
            var regional = RegionalRoutingFor(platformRegion);
            var url = $"https://{regional}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?count={count}";

            var (ok, doc, error) = await GetJsonAsync(url, apiKey);
            if (!ok || doc == null) return (false, new List<string>(), error);

            using (doc)
            {
                var ids = doc.RootElement.EnumerateArray().Select(e => e.GetString() ?? "").Where(s => s != "").ToList();
                return (true, ids, null);
            }
        }

        public async Task<(bool ok, RiotMatchSummary? summary, string? error)> GetMatchSummaryAsync(string platformRegion, string matchId, string puuid, string apiKey)
        {
            var regional = RegionalRoutingFor(platformRegion);
            var url = $"https://{regional}.api.riotgames.com/lol/match/v5/matches/{matchId}";

            var (ok, doc, error) = await GetJsonAsync(url, apiKey);
            if (!ok || doc == null) return (false, null, error);

            using (doc)
            {
                var info = doc.RootElement.GetProperty("info");
                var durationSeconds = info.GetProperty("gameDuration").GetInt32();
                var startedAtMs = info.GetProperty("gameStartTimestamp").GetInt64();

                var participants = info.GetProperty("participants");
                JsonElement? mine = null;
                foreach (var p in participants.EnumerateArray())
                {
                    if (p.GetProperty("puuid").GetString() == puuid) { mine = p; break; }
                }

                if (mine == null)
                    return (false, null, "El participante no aparece en esta partida (puuid no encontrado)");

                var p2 = mine.Value;
                var summary = new RiotMatchSummary
                {
                    MatchId = matchId,
                    OccurredAt = DateTimeOffset.FromUnixTimeMilliseconds(startedAtMs).UtcDateTime,
                    Win = p2.GetProperty("win").GetBoolean(),
                    Champion = p2.TryGetProperty("championName", out var champ) ? champ.GetString() : null,
                    Kills = p2.GetProperty("kills").GetInt32(),
                    Deaths = p2.GetProperty("deaths").GetInt32(),
                    Assists = p2.GetProperty("assists").GetInt32(),
                    DurationSeconds = durationSeconds,
                    DamageDealt = p2.TryGetProperty("totalDamageDealtToChampions", out var dmg) ? dmg.GetInt32() : null,
                    VisionScore = p2.TryGetProperty("visionScore", out var vis) ? vis.GetInt32() : null,
                    PentaKills = p2.TryGetProperty("pentaKills", out var penta) ? penta.GetInt32() : 0,
                    ChampionId = p2.TryGetProperty("championId", out var cid) ? cid.GetInt32() : null,
                    Position = p2.TryGetProperty("teamPosition", out var pos) ? pos.GetString() : null,
                };

                var cs = 0;
                if (p2.TryGetProperty("totalMinionsKilled", out var minions)) cs += minions.GetInt32();
                if (p2.TryGetProperty("neutralMinionsKilled", out var neutral)) cs += neutral.GetInt32();
                summary.TotalCs = cs;

                return (true, summary, null);
            }
        }

        /// <summary>
        /// LP actual en solo/duo queue. Devuelve null si el jugador no tiene entrada
        /// de ranked solo (unranked) — no es un error, es un estado valido.
        /// </summary>
        public async Task<(bool ok, int? leaguePoints, string? tier, string? rank, string? error)> GetCurrentSoloQLpAsync(string platformRegion, string puuid, string apiKey)
        {
            var url = $"https://{platformRegion}.api.riotgames.com/lol/league/v4/entries/by-puuid/{puuid}";

            var (ok, doc, error) = await GetJsonAsync(url, apiKey);
            if (!ok || doc == null) return (false, null, null, null, error);

            using (doc)
            {
                foreach (var entry in doc.RootElement.EnumerateArray())
                {
                    if (entry.GetProperty("queueType").GetString() == "RANKED_SOLO_5x5")
                    {
                        return (true,
                            entry.GetProperty("leaguePoints").GetInt32(),
                            entry.GetProperty("tier").GetString(),
                            entry.GetProperty("rank").GetString(),
                            null);
                    }
                }

                return (true, null, null, null, null); // unranked
            }
        }

        /// <summary>
        /// Icono de invocador actual — usado para el metodo de verificacion de
        /// propiedad de cuenta ("poné este icono, confirmá") en vez de RSO real
        /// (que Riot no habilita en keys de dev/tenant comunes). Ver
        /// .dev/torneos/03-riot-api-integracion.md #2.
        /// </summary>
        public async Task<(bool ok, int? profileIconId, string? error)> GetProfileIconIdAsync(string platformRegion, string puuid, string apiKey)
        {
            var url = $"https://{platformRegion}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/{puuid}";

            var (ok, doc, error) = await GetJsonAsync(url, apiKey);
            if (!ok || doc == null) return (false, null, error);

            using (doc)
            {
                return (true, doc.RootElement.GetProperty("profileIconId").GetInt32(), null);
            }
        }

        /// <summary>
        /// Lista los 10 participantes de una partida ya terminada con su puuid y
        /// equipo Riot (100/200) — liviano, solo para identificar "esta partida es la
        /// que jugaron nuestros dos equipos del bracket" antes de pagar el costo de
        /// traer el timeline completo.
        /// </summary>
        public async Task<(bool ok, List<RiotMatchParticipantRef> participants, string? error)> GetMatchParticipantsAsync(
            string platformRegion, string matchId, string apiKey)
        {
            var regional = RegionalRoutingFor(platformRegion);
            var url = $"https://{regional}.api.riotgames.com/lol/match/v5/matches/{matchId}";

            var (ok, doc, error) = await GetJsonAsync(url, apiKey);
            if (!ok || doc == null) return (false, new List<RiotMatchParticipantRef>(), error);

            using (doc)
            {
                var result = new List<RiotMatchParticipantRef>();
                foreach (var p in doc.RootElement.GetProperty("info").GetProperty("participants").EnumerateArray())
                {
                    result.Add(new RiotMatchParticipantRef
                    {
                        Puuid = p.GetProperty("puuid").GetString() ?? "",
                        ParticipantId = p.GetProperty("participantId").GetInt32(),
                        TeamId = p.GetProperty("teamId").GetInt32(),
                    });
                }
                return (true, result, null);
            }
        }

        /// <summary>
        /// Stats finales de los 10 participantes de una partida ya terminada, en una
        /// sola llamada — a diferencia de GetMatchSummaryAsync (que filtra a un solo
        /// puuid), esto trae a todos. Usado para guardar el historial de cada
        /// participante conocido de un match ARAM de una vez.
        /// </summary>
        public async Task<(bool ok, List<RiotParticipantMatchStats> stats, string? error)> GetMatchAllParticipantStatsAsync(
            string platformRegion, string matchId, string apiKey)
        {
            var regional = RegionalRoutingFor(platformRegion);
            var url = $"https://{regional}.api.riotgames.com/lol/match/v5/matches/{matchId}";

            var (ok, doc, error) = await GetJsonAsync(url, apiKey);
            if (!ok || doc == null) return (false, new List<RiotParticipantMatchStats>(), error);

            using (doc)
            {
                var info = doc.RootElement.GetProperty("info");
                var durationSeconds = info.GetProperty("gameDuration").GetInt32();
                var startedAtMs = info.GetProperty("gameStartTimestamp").GetInt64();
                var occurredAt = DateTimeOffset.FromUnixTimeMilliseconds(startedAtMs).UtcDateTime;

                var result = new List<RiotParticipantMatchStats>();
                foreach (var p in info.GetProperty("participants").EnumerateArray())
                {
                    var cs = 0;
                    if (p.TryGetProperty("totalMinionsKilled", out var minions)) cs += minions.GetInt32();
                    if (p.TryGetProperty("neutralMinionsKilled", out var neutral)) cs += neutral.GetInt32();

                    result.Add(new RiotParticipantMatchStats
                    {
                        Puuid = p.GetProperty("puuid").GetString() ?? "",
                        OccurredAt = occurredAt,
                        Win = p.GetProperty("win").GetBoolean(),
                        Champion = p.TryGetProperty("championName", out var champ) ? champ.GetString() : null,
                        Kills = p.GetProperty("kills").GetInt32(),
                        Deaths = p.GetProperty("deaths").GetInt32(),
                        Assists = p.GetProperty("assists").GetInt32(),
                        DurationSeconds = durationSeconds,
                        DamageDealt = p.TryGetProperty("totalDamageDealtToChampions", out var dmg) ? dmg.GetInt32() : null,
                        VisionScore = p.TryGetProperty("visionScore", out var vis) ? vis.GetInt32() : null,
                        PentaKills = p.TryGetProperty("pentaKills", out var penta) ? penta.GetInt32() : 0,
                        TotalCs = cs,
                    });
                }
                return (true, result, null);
            }
        }

        /// <summary>
        /// Timeline minuto a minuto de una partida — eventos de kills/torres/inhibidores
        /// y snapshot de subditos/oro/nivel/daño por participante en cada frame. Es lo
        /// unico que permite evaluar condiciones de victoria "el primero en X" sin
        /// esperar al resumen final de la partida.
        /// </summary>
        public async Task<(bool ok, RiotMatchTimeline? timeline, string? error)> GetMatchTimelineAsync(
            string platformRegion, string matchId, string apiKey)
        {
            var regional = RegionalRoutingFor(platformRegion);
            var url = $"https://{regional}.api.riotgames.com/lol/match/v5/matches/{matchId}/timeline";

            var (ok, doc, error) = await GetJsonAsync(url, apiKey);
            if (!ok || doc == null) return (false, null, error);

            using (doc)
            {
                var timeline = new RiotMatchTimeline();
                var frames = doc.RootElement.GetProperty("info").GetProperty("frames");

                foreach (var frame in frames.EnumerateArray())
                {
                    var timelineFrame = new RiotTimelineFrame { Timestamp = frame.GetProperty("timestamp").GetInt64() };

                    if (frame.TryGetProperty("participantFrames", out var pFrames))
                    {
                        foreach (var prop in pFrames.EnumerateObject())
                        {
                            var pf = prop.Value;
                            var damage = pf.TryGetProperty("damageStats", out var dmgStats) && dmgStats.TryGetProperty("totalDamageDoneToChampions", out var dmg)
                                ? dmg.GetInt32() : 0;

                            timelineFrame.Participants.Add(new RiotParticipantFrame
                            {
                                ParticipantId = pf.GetProperty("participantId").GetInt32(),
                                MinionsKilled = pf.TryGetProperty("minionsKilled", out var mk) ? mk.GetInt32() : 0,
                                JungleMinionsKilled = pf.TryGetProperty("jungleMinionsKilled", out var jmk) ? jmk.GetInt32() : 0,
                                TotalGold = pf.TryGetProperty("totalGold", out var g) ? g.GetInt32() : 0,
                                Level = pf.TryGetProperty("level", out var lvl) ? lvl.GetInt32() : 0,
                                DamageToChampions = damage,
                            });
                        }
                    }
                    timeline.Frames.Add(timelineFrame);

                    if (frame.TryGetProperty("events", out var events))
                    {
                        foreach (var ev in events.EnumerateArray())
                        {
                            var type = ev.GetProperty("type").GetString() ?? "";
                            if (type != "CHAMPION_KILL" && type != "BUILDING_KILL") continue;

                            timeline.Events.Add(new RiotTimelineEvent
                            {
                                Type = type,
                                Timestamp = ev.GetProperty("timestamp").GetInt64(),
                                KillerId = ev.TryGetProperty("killerId", out var kId) ? kId.GetInt32() : null,
                                VictimId = ev.TryGetProperty("victimId", out var vId) ? vId.GetInt32() : null,
                                TeamId = ev.TryGetProperty("teamId", out var tId) ? tId.GetInt32() : null,
                                BuildingType = ev.TryGetProperty("buildingType", out var bt) ? bt.GetString() : null,
                            });
                        }
                    }
                }

                return (true, timeline, null);
            }
        }
    }
}
