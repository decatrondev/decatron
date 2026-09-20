using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models.GameOverlays;
using Decatron.Data;
using Decatron.Services.Desktop;
using Decatron.Services.GameData.Riot;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.GameData.LolLive
{
    /// <summary>
    /// Canal <c>lol-coach</c> del WebSocket de escritorio. Decatron Desktop lee el cliente
    /// de LoL (LCU, solo en la PC del streamer) y manda lo que pasa; aca se traduce a
    /// nombres/iconos y se empuja al overlay al instante. Fase 1 del coach: solo lectura,
    /// sin IA todavia. Plan: .dev/plans/LOL_COACH_PLAN.md
    ///
    /// Cliente → servidor:
    ///   <c>client</c>   { connected, summoner: { puuid, gameName, tagLine, displayName } | null }
    ///   <c>phase</c>    { phase, queueId, queueName, lobby: [{ name, tag, puuid, isMe, isLeader, position1, position2 }] }
    ///   <c>champselect</c> { timerPhase, remainingMs, localCellId, myTeam: [{ cellId, championId, position, spell1Id, spell2Id, locked }],
    ///                        theirTeam: [{ cellId, championId, locked }], myBans: [ids], theirBans: [ids], myTurn }
    ///   <c>ingame</c>   { championId, position, startedAt, gameMode, queueId }
    ///   <c>eog</c>      { win, championId, kills, deaths, assists, cs, damage, visionScore, durationSeconds, pointsDelta,
    ///                     myTeam: [{ name, championId, kills, deaths, assists, isMe }], theirTeam: [...] }
    /// Servidor → cliente:
    ///   <c>accounts</c> { linked: [{ puuid, name, region }] } — para que la app avise si la cuenta abierta no esta vinculada.
    ///   <c>ack</c>      { phase } tras cada mensaje aplicado.
    /// </summary>
    public class LolCoachDesktopChannel : IDesktopChannel
    {
        public const string ChannelName = "lol-coach";

        private readonly LolLiveStateStore _store;
        private readonly GameDataPollingService _poller;
        private readonly GameDataCache _cache;
        private readonly RiotApiClient _riot;
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<LolCoachDesktopChannel> _logger;

        public LolCoachDesktopChannel(LolLiveStateStore store, GameDataPollingService poller, GameDataCache cache, RiotApiClient riot,
            IServiceScopeFactory scopes, ILogger<LolCoachDesktopChannel> logger)
        {
            _store = store; _poller = poller; _cache = cache; _riot = riot; _scopes = scopes; _logger = logger;
        }

        public string Name => ChannelName;
        public byte? BinaryChannelId => null;

        public async Task<object?> DescribeAsync(DesktopConnection conn)
        {
            var linked = await LinkedAsync(conn.UserId);
            return new
            {
                available = true,
                // Habilitado = tiene al menos una cuenta de LoL vinculada en Game Overlays.
                enabled = linked.Count > 0,
                linked,
            };
        }

        private async Task<List<Decatron.Core.Models.GameOverlays.LinkedGameAccount>> LinkedAccountsAsync(long userId)
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return new();
            var accountId = user.AccountId ?? user.Id;
            return await db.LinkedGameAccounts.AsNoTracking()
                .Where(a => a.AccountId == accountId && a.IsActive && a.Game == GameIds.Lol).ToListAsync();
        }

        private async Task<List<object>> LinkedAsync(long userId)
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return new List<object>();
            var accountId = user.AccountId ?? user.Id;
            return await db.LinkedGameAccounts.AsNoTracking()
                .Where(a => a.AccountId == accountId && a.IsActive && a.Game == GameIds.Lol)
                .Select(a => (object)new { puuid = a.ExternalId, name = a.ExternalName + (a.ExternalTag != null ? "#" + a.ExternalTag : ""), region = a.Region })
                .ToListAsync();
        }

        public async Task OnMessageAsync(DesktopConnection conn, string type, JsonNode msg)
        {
            var entry = _store.GetOrCreate(conn.UserId, conn.Device.Id);
            var phase = entry.Phase;
            switch (type)
            {
                case "client":
                {
                    var connected = msg["connected"]?.GetValue<bool>() ?? false;
                    var s = msg["summoner"] as JsonObject;
                    var puuid = connected ? s?["puuid"]?.GetValue<string>() : null;
                    var gameName = s?["gameName"]?.GetValue<string>() ?? s?["displayName"]?.GetValue<string>();
                    var tag = s?["tagLine"]?.GetValue<string>();
                    entry.SummonerName = gameName;

                    // Cruce con las cuentas vinculadas: por PUUID y, si no coincide (Riot ID
                    // migrado, cuenta vinculada con otro dato), por nombre#tag. Se guarda el
                    // PUUID de la cuenta vinculada, que es el que usa el overlay.
                    var linked = await LinkedAccountsAsync(conn.UserId);
                    var match = connected ? linked.FirstOrDefault(a => string.Equals(a.ExternalId, puuid, StringComparison.OrdinalIgnoreCase))
                        ?? linked.FirstOrDefault(a => !string.IsNullOrEmpty(gameName)
                            && string.Equals(a.ExternalName, gameName, StringComparison.OrdinalIgnoreCase)
                            && (string.IsNullOrEmpty(tag) || string.IsNullOrEmpty(a.ExternalTag) || string.Equals(a.ExternalTag, tag, StringComparison.OrdinalIgnoreCase)))
                        : null;
                    entry.Puuid = match?.ExternalId ?? puuid;
                    if (!connected) entry.Phase = new LivePhaseInfo();
                    if (connected && match == null)
                        _logger.LogInformation("[LolCoach] {Login}: invocador {Name}#{Tag} ({Puuid}) no coincide con ninguna cuenta vinculada", conn.Login, gameName, tag, puuid);
                    await conn.SendAsync(Name, "accounts", new
                    {
                        linked = await LinkedAsync(conn.UserId),
                        matched = match == null ? null : new { puuid = match.ExternalId, name = match.FullExternalName, region = match.Region },
                        summonerPuuid = puuid,
                    });
                    break;
                }
                case "phase":
                {
                    var p = NormalizePhase(msg["phase"]?.GetValue<string>());
                    if (p != phase.Phase)
                    {
                        // Al cambiar de fase se limpia lo de la anterior (el champ select no sobrevive a la partida, etc.).
                        phase.ChampSelect = p == "champselect" ? phase.ChampSelect : null;
                        phase.Game = p is "ingame" or "postgame" ? phase.Game : null;
                        phase.PostGame = p == "postgame" ? phase.PostGame : null;
                        if (p != "lobby" && p != "matchmaking") phase.Lobby = new();
                    }
                    phase.Phase = p;
                    phase.QueueId = msg["queueId"]?.GetValue<int?>();
                    phase.QueueName = msg["queueName"]?.GetValue<string>();
                    if (msg["lobby"] is JsonArray lobby)
                        phase.Lobby = lobby.OfType<JsonObject>().Select(m => new LiveLobbyMember
                        {
                            Name = m["name"]?.GetValue<string>() ?? "", Tag = m["tag"]?.GetValue<string>(),
                            IsMe = m["isMe"]?.GetValue<bool>() ?? false, IsLeader = m["isLeader"]?.GetValue<bool>() ?? false,
                            Position1 = m["position1"]?.GetValue<string>(), Position2 = m["position2"]?.GetValue<string>(),
                        }).ToList();
                    break;
                }
                case "champselect":
                {
                    var champs = await ChampionsAsync();
                    LiveChampionRef? Ref(JsonNode? idNode)
                    {
                        var id = idNode?.GetValue<int?>() ?? 0;
                        if (id <= 0) return null;
                        return champs.TryGetValue(id, out var c) ? new LiveChampionRef { Id = id, Name = c.Name, Icon = c.IconUrl } : new LiveChampionRef { Id = id, Name = $"#{id}" };
                    }
                    var localCell = msg["localCellId"]?.GetValue<int?>() ?? -1;
                    List<LivePick> Picks(JsonNode? arr) => (arr as JsonArray)?.OfType<JsonObject>().Select(x => new LivePick
                    {
                        CellId = x["cellId"]?.GetValue<int>() ?? -1,
                        Champion = Ref(x["championId"]),
                        Position = x["position"]?.GetValue<string>(),
                        Locked = x["locked"]?.GetValue<bool>() ?? false,
                        IsMe = (x["cellId"]?.GetValue<int>() ?? -2) == localCell,
                    }).ToList() ?? new();
                    List<LiveChampionRef> Bans(JsonNode? arr) => (arr as JsonArray)?.Select(x => Ref(x)).Where(r => r != null).Select(r => r!).ToList() ?? new();

                    var cs = new LiveChampSelect
                    {
                        MyTeam = Picks(msg["myTeam"]), TheirTeam = Picks(msg["theirTeam"]),
                        MyBans = Bans(msg["myBans"]), TheirBans = Bans(msg["theirBans"]),
                        TimerPhase = msg["timerPhase"]?.GetValue<string>(), RemainingMs = msg["remainingMs"]?.GetValue<int?>(),
                        MyTurn = msg["myTurn"]?.GetValue<bool>() ?? false,
                    };
                    var me = cs.MyTeam.FirstOrDefault(p => p.IsMe);
                    cs.MyPick = me?.Champion; cs.MyPosition = me?.Position;
                    phase.ChampSelect = cs;
                    if (phase.Phase != "champselect") phase.Phase = "champselect";
                    break;
                }
                case "ingame":
                {
                    var champs = await ChampionsAsync();
                    var id = msg["championId"]?.GetValue<int?>() ?? 0;
                    phase.Game = new LiveGameDetails
                    {
                        Champion = id > 0 && champs.TryGetValue(id, out var c) ? new LiveChampionRef { Id = id, Name = c.Name, Icon = c.IconUrl } : null,
                        Position = msg["position"]?.GetValue<string>(),
                        StartedAt = msg["startedAt"]?.GetValue<DateTime?>() ?? DateTime.UtcNow,
                        GameMode = msg["gameMode"]?.GetValue<string>(),
                    };
                    phase.QueueId ??= msg["queueId"]?.GetValue<int?>();
                    phase.Phase = "ingame";
                    break;
                }
                case "eog":
                {
                    var champs = await ChampionsAsync();
                    LiveChampionRef? Ref(int id) => id > 0 && champs.TryGetValue(id, out var c) ? new LiveChampionRef { Id = id, Name = c.Name, Icon = c.IconUrl } : null;
                    List<LivePostGamePlayer> Team(JsonNode? arr) => (arr as JsonArray)?.OfType<JsonObject>().Select(x => new LivePostGamePlayer
                    {
                        Name = x["name"]?.GetValue<string>() ?? "", Champion = Ref(x["championId"]?.GetValue<int>() ?? 0),
                        Kills = x["kills"]?.GetValue<int>() ?? 0, Deaths = x["deaths"]?.GetValue<int>() ?? 0, Assists = x["assists"]?.GetValue<int>() ?? 0,
                        IsMe = x["isMe"]?.GetValue<bool>() ?? false,
                    }).ToList() ?? new();
                    phase.PostGame = new LivePostGame
                    {
                        Win = msg["win"]?.GetValue<bool>() ?? false,
                        Champion = Ref(msg["championId"]?.GetValue<int>() ?? 0),
                        Kills = msg["kills"]?.GetValue<int>() ?? 0, Deaths = msg["deaths"]?.GetValue<int>() ?? 0, Assists = msg["assists"]?.GetValue<int>() ?? 0,
                        Cs = msg["cs"]?.GetValue<int?>(), Damage = msg["damage"]?.GetValue<int?>(), VisionScore = msg["visionScore"]?.GetValue<int?>(),
                        DurationSeconds = msg["durationSeconds"]?.GetValue<int>() ?? 0, PointsDelta = msg["pointsDelta"]?.GetValue<int?>(),
                        MyTeam = Team(msg["myTeam"]), TheirTeam = Team(msg["theirTeam"]),
                    };
                    phase.Phase = "postgame";
                    // La partida ya termino: que el poller traiga rango/partidas nuevas sin esperar su intervalo.
                    _poller.RequestRefresh(conn.UserId);
                    break;
                }
                default:
                    return;
            }

            phase.UpdatedAt = DateTime.UtcNow;
            await _poller.PushLivePhaseAsync(conn.UserId);
            await conn.SendAsync(Name, "ack", new { phase = phase.Phase });
        }

        public Task OnBinaryAsync(DesktopConnection conn, ReadOnlyMemory<byte> payload) => Task.CompletedTask;

        public async Task OnDisconnectedAsync(DesktopConnection conn)
        {
            _store.Remove(conn.UserId, conn.Device.Id);
            try { await _poller.PushLivePhaseAsync(conn.UserId); }
            catch (Exception ex) { _logger.LogDebug(ex, "[LolCoach] push tras desconexion"); }
        }

        /// <summary>none | lobby | matchmaking | champselect | ingame | postgame, desde los nombres del LCU.</summary>
        private static string NormalizePhase(string? lcu) => (lcu ?? "").ToLowerInvariant() switch
        {
            "lobby" => "lobby",
            "matchmaking" or "readycheck" => "matchmaking",
            "champselect" => "champselect",
            "gamestart" or "inprogress" or "reconnect" => "ingame",
            "waitingforstats" or "preendofgame" or "endofgame" => "postgame",
            _ => "none",
        };

        private Task<Dictionary<int, RiotApiClient.DdragonChampion>> ChampionsAsync() =>
            _cache.GetOrFetchAsync<Dictionary<int, RiotApiClient.DdragonChampion>>(GameProviders.Riot, "ddragon", "champions2", TimeSpan.FromDays(1),
                async () => await _riot.GetChampionsAsync())!;
    }
}
