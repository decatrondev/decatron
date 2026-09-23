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
        private readonly LolCoachBrain _brain;
        private readonly GameOverlayStateStore _overlays;
        private readonly LolCoachVoice _voice;
        private readonly LolHistoryService _history;
        private readonly LolPredictionService _predictions;
        private readonly LolLobbyScoutService _scout;
        private readonly IServiceScopeFactory _scopes;
        private readonly Decatron.Core.Interfaces.IMessageSender _chat;
        private readonly ILogger<LolCoachDesktopChannel> _logger;

        /// <summary>Límite de un mensaje de Twitch (500) con margen para el prefijo.</summary>
        private const int ChatMax = 480;

        public LolCoachDesktopChannel(LolLiveStateStore store, GameDataPollingService poller, GameDataCache cache, RiotApiClient riot,
            LolCoachBrain brain, GameOverlayStateStore overlays, LolCoachVoice voice, LolHistoryService history, LolPredictionService predictions, LolLobbyScoutService scout,
            IServiceScopeFactory scopes, Decatron.Core.Interfaces.IMessageSender chat, ILogger<LolCoachDesktopChannel> logger)
        {
            _store = store; _poller = poller; _cache = cache; _riot = riot; _brain = brain; _overlays = overlays; _voice = voice; _history = history; _predictions = predictions; _scout = scout; _scopes = scopes; _chat = chat; _logger = logger;
        }

        public string Name => ChannelName;
        public byte? BinaryChannelId => null;

        public async Task<object?> DescribeAsync(DesktopConnection conn)
        {
            var linked = await LinkedAsync(conn.UserId);
            var coach = await CoachSettingsAsync(conn.UserId);
            return new
            {
                available = true,
                // Habilitado = tiene al menos una cuenta de LoL vinculada en Game Overlays.
                enabled = linked.Count > 0,
                linked,
                coach = new { enabled = coach.Enabled && _brain.IsAvailable, name = coach.CoachName, tone = coach.Tone, voice = coach.VoiceEnabled && _voice.IsAvailable },
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

        private async Task<LolCoachSettings> CoachSettingsAsync(long userId)
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            return await db.LolCoachSettings.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId) ?? new LolCoachSettings { UserId = userId };
        }

        public async Task OnMessageAsync(DesktopConnection conn, string type, JsonNode msg)
        {
            var entry = _store.GetOrCreate(conn.UserId, conn.Device.Id);
            var phase = entry.Phase;
            var prevPhase = phase.Phase;
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
                    {
                        // El scouting (3b) se conserva entre mensajes: el LCU reenvía el lobby entero por cada cambio.
                        var previous = phase.Lobby.Where(m => m.Scout != null && m.Puuid != null).ToDictionary(m => m.Puuid!, m => m.Scout!);
                        phase.Lobby = lobby.OfType<JsonObject>().Select(m => new LiveLobbyMember
                        {
                            Name = m["name"]?.GetValue<string>() ?? "", Tag = m["tag"]?.GetValue<string>(), Puuid = m["puuid"]?.GetValue<string>(),
                            IsMe = m["isMe"]?.GetValue<bool>() ?? false, IsLeader = m["isLeader"]?.GetValue<bool>() ?? false,
                            Position1 = m["position1"]?.GetValue<string>(), Position2 = m["position2"]?.GetValue<string>(),
                        }).ToList();
                        foreach (var m in phase.Lobby) if (m.Puuid != null && previous.TryGetValue(m.Puuid, out var sc)) m.Scout = sc;
                    }
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

            // El coach piensa aparte: la IA y el historial de Riot pueden tardar segundos (o
            // minutos con rate limit) y no pueden frenar los mensajes siguientes del cliente.
            _ = Task.Run(async () =>
            {
                try { await CoachAsync(conn, entry, prevPhase, type); }
                catch (Exception ex) { _logger.LogWarning(ex, "[LolCoach] {Login}: coach ({Type})", conn.Login, type); }
            });
            _ = Task.Run(async () =>
            {
                try { await PredictionsAsync(conn, entry, type); }
                catch (Exception ex) { _logger.LogWarning(ex, "[LolPred] {Login}: ({Type})", conn.Login, type); }
            });
        }

        /// <summary>Predicciones del chat: se abren al entrar en partida y se resuelven con el eog. Independientes del coach IA.</summary>
        private async Task PredictionsAsync(DesktopConnection conn, LolLiveStateStore.Entry entry, string type)
        {
            if (type is not ("ingame" or "eog")) return;
            var settings = await CoachSettingsAsync(conn.UserId);
            if (!settings.PredictionsEnabled) { entry.Phase.Prediction = null; return; }
            string lang;
            using (var scope = _scopes.CreateScope())
                lang = await scope.ServiceProvider.GetRequiredService<DecatronDbContext>().Users.Where(u => u.Id == conn.UserId).Select(u => u.PreferredLanguage).FirstOrDefaultAsync() ?? "es";

            if (type == "ingame" && entry.Phase.Game is { } g)
            {
                var started = g.StartedAt ?? DateTime.UtcNow;
                var key = $"{entry.Puuid}:{started:yyyyMMddHHmm}";
                // La de la partida anterior no debe quedar en el overlay si esta no llega a abrirse.
                if (entry.Phase.Prediction is { } old && old.OpenedAt < started) entry.Phase.Prediction = null;
                await _predictions.OpenAsync(conn.UserId, conn.Login, lang, settings, key, g.Champion?.Name, started);
            }
            else if (type == "eog" && entry.Phase.PostGame is { } pg)
            {
                await _predictions.ResolveAsync(conn.UserId, conn.Login, lang, pg.Win);
            }
        }

        // ─── Coach (fase 2): cuándo habla la IA ─────────────────────────────────
        //  - pick: cambió un pick lockeado o un ban (debounce 2 s, solo si CommentPicks)
        //  - my_turn: me toca elegir (inmediato)
        //  - final: todos lockearon / FINALIZATION (inmediato, una vez, con runas/spells/build)
        //  - postgame: llegó el eog (una vez, si PostGameSummary)
        // Tope por selección: LolCoachBrain.MaxCallsPerChampSelect. Nunca habla en partida.
        private async Task CoachAsync(DesktopConnection conn, LolLiveStateStore.Entry entry, string prevPhase, string type)
        {
            var phase = entry.Phase;
            if (phase.Phase == "champselect" && prevPhase != "champselect") entry.ResetChampSelect();
            if (phase.Phase != "postgame") entry.PostGameSent = false;
            if (phase.Phase is "none" or "lobby" or "matchmaking" && prevPhase is "ingame" or "postgame") { /* el último comentario se conserva para !matchup hasta la próxima selección */ }

            if (!_brain.IsAvailable) return;
            var settings = await CoachSettingsAsync(conn.UserId);
            if (!settings.Enabled) return;

            // Briefing: una vez por día al ver el cliente con una cuenta vinculada.
            // Briefing: una vez por sesión de juego (no en cada reconexión del Desktop ni en
            // cada reinicio del backend). Se recuerda en la base.
            if (type == "client" && entry.Puuid != null && settings.Briefing
                && (settings.LastBriefingAt == null || DateTime.UtcNow - settings.LastBriefingAt.Value >= LolHistoryService.SessionGap))
            {
                using (var scope = _scopes.CreateScope())
                {
                    var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                    await db.LolCoachSettings.Where(s => s.UserId == conn.UserId)
                        .ExecuteUpdateAsync(u => u.SetProperty(s => s.LastBriefingAt, DateTime.UtcNow));
                }
                await SpeakAsync(conn, entry, settings, "briefing");
                return;
            }

            // Lobby: cuando entra alguien más (una vez por combinación de miembros).
            if (type == "phase" && phase.Phase == "lobby" && settings.LobbyComments)
            {
                var others = phase.Lobby.Where(m => !m.IsMe).ToList();
                var sig = string.Join("|", others.Select(m => m.Puuid ?? m.Name).OrderBy(x => x));
                if (others.Count > 0 && sig != entry.LastLobbySignature)
                {
                    entry.LastLobbySignature = sig;
                    // 3b: rango/winrate/top champs públicos de los que entraron, para el overlay, el panel y el prompt.
                    var region = await RegionAsync(conn.UserId, entry);
                    if (region != null)
                    {
                        await _scout.ScoutAsync(region, others, conn.Token);
                        entry.Phase.UpdatedAt = DateTime.UtcNow;
                        await _poller.PushLivePhaseAsync(conn.UserId);
                    }
                    await SpeakAsync(conn, entry, settings, "lobby");
                }
                return;
            }

            if (type == "champselect" && phase.ChampSelect is { } cs)
            {
                var signature = string.Join("|", cs.MyTeam.Where(p => p.Locked).Select(p => $"m{p.CellId}:{p.Champion?.Id}")
                    .Concat(cs.TheirTeam.Where(p => p.Locked).Select(p => $"t{p.CellId}:{p.Champion?.Id}"))
                    .Concat(cs.MyBans.Select(b => "mb" + b.Id)).Concat(cs.TheirBans.Select(b => "tb" + b.Id)));
                var allLocked = cs.MyTeam.Count > 0 && cs.MyTeam.All(p => p.Locked) && cs.TheirTeam.All(p => p.Locked || p.Champion == null);
                // El plan final (runas, hechizos, build) sale en cuanto el streamer confirma su
                // campeón, sin esperar a los diez: si el último rival lockeaba al final del
                // tiempo, las runas llegaban a 2 s de empezar la partida (2026-09-23). Con lo
                // que ya se sabe del rival alcanza; FINALIZATION y "todos lockearon" quedan como
                // red para las colas donde el pick propio nunca figura como lockeado.
                var myLocked = cs.MyTeam.FirstOrDefault(p => p.IsMe)?.Locked == true;
                var isFinal = !entry.FinalSent && cs.MyPick != null && (myLocked || cs.TimerPhase is "FINALIZATION" or "GAME_STARTING" || allLocked);
                var myTurn = cs.MyTurn && !entry.LastMyTurn;
                entry.LastMyTurn = cs.MyTurn;

                if (isFinal) { entry.FinalSent = true; entry.Debounce?.Cancel(); await SpeakAsync(conn, entry, settings, "final"); return; }
                if (myTurn) { entry.Debounce?.Cancel(); await SpeakAsync(conn, entry, settings, "my_turn"); entry.LastCommentedSignature = signature; return; }
                if (settings.CommentPicks && signature != entry.LastCommentedSignature && signature.Length > 0)
                {
                    entry.LastCommentedSignature = signature;
                    entry.Debounce?.Cancel();
                    var cts = entry.Debounce = new CancellationTokenSource();
                    _ = Task.Run(async () =>
                    {
                        try { await Task.Delay(2000, cts.Token); await SpeakAsync(conn, entry, settings, "pick"); }
                        catch (OperationCanceledException) { }
                        catch (Exception ex) { _logger.LogDebug(ex, "[LolCoach] pick debounce"); }
                    });
                }
            }
            else if (type == "eog" && !entry.PostGameSent)
            {
                entry.PostGameSent = true;
                if (settings.PostGameSummary) await SpeakAsync(conn, entry, settings, "postgame");

                // Tilt check: 3+ derrotas seguidas en la sesión de hoy (según el overlay), una vez por racha.
                if (settings.TiltCheck)
                {
                    var streak = _overlays.AllFor(conn.UserId).SelectMany(o => o.Accounts)
                        .FirstOrDefault(a => string.Equals(a.ExternalId, entry.Puuid, StringComparison.OrdinalIgnoreCase))?.Session?.Streak ?? 0;
                    // El overlay puede no haber visto aún la partida recién terminada: contarla si fue derrota.
                    if (phase.PostGame is { Win: false } && streak <= 0) streak -= 1;
                    if (streak <= -3 && entry.TiltCheckedAt != streak) { entry.TiltCheckedAt = streak; await SpeakAsync(conn, entry, settings, "tilt"); }
                    else if (streak >= 0) entry.TiltCheckedAt = 0;
                }
            }
        }

        /// <summary>
        /// Datos del historial propio que van al prompt según el momento (fase 3a). Todo
        /// sale de match-v5 de la cuenta del streamer: récord con los del lobby, contra el
        /// rival directo, ayer/esta semana. Nunca lanza: si falla, el coach habla sin esto.
        /// </summary>
        private async Task<JsonObject?> HistoryContextAsync(long userId, LolLiveStateStore.Entry entry, string kind, CancellationToken ct)
        {
            if (!_history.IsAvailable || entry.Puuid == null || kind is "pick" or "my_turn") return null;
            try
            {
                LinkedGameAccount? account;
                using (var scope = _scopes.CreateScope())
                {
                    var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                    account = await db.LinkedGameAccounts.AsNoTracking().FirstOrDefaultAsync(a => a.Game == GameIds.Lol && a.IsActive && a.ExternalId == entry.Puuid, ct);
                }
                if (account == null) return null;
                var history = await _history.GetAsync(account, 40, ct);
                if (history.Count == 0) return null;
                var o = new JsonObject();
                var now = DateTime.UtcNow;

                if (kind == "briefing")
                {
                    // "Hoy" y "la vez anterior" por sesiones de juego, no por fecha UTC. Si ya jugó
                    // en esta sesión (volvió después de una pausa), el coach tiene que saberlo en
                    // vez de saludar como si recién empezara.
                    var current = LolHistoryService.CurrentSession(history);
                    var previous = LolHistoryService.PreviousSession(history);
                    var week = LolHistoryService.Between(history, now.AddDays(-7), now);
                    if (current.Count > 0)
                        o["todaySoFar"] = new JsonObject { ["games"] = current.Count, ["wins"] = current.Count(m => m.Win), ["losses"] = current.Count(m => !m.Win) };
                    if (previous.Count > 0)
                        o["lastSession"] = new JsonObject
                        {
                            ["games"] = previous.Count, ["wins"] = previous.Count(m => m.Win), ["losses"] = previous.Count(m => !m.Win),
                            ["hoursAgo"] = Math.Round((now - previous[0].At).TotalHours),
                        };
                    if (LolHistoryService.BestChampion(week) is { } best)
                        o["bestChampionThisWeek"] = new JsonObject { ["champion"] = best.Champion, ["games"] = best.Record.Games, ["winRate"] = best.Record.WinRate };
                    var rank = _overlays.AllFor(userId).SelectMany(s => s.Accounts).FirstOrDefault(a => a.ExternalId == entry.Puuid)?.Rank;
                    if (rank != null) o["rank"] = new JsonObject { ["tier"] = rank.Tier, ["division"] = rank.Division, ["lp"] = rank.Points, ["wins"] = rank.Wins, ["losses"] = rank.Losses };
                }
                if (kind == "lobby")
                {
                    var arr = new JsonArray();
                    foreach (var m in entry.Phase.Lobby.Where(m => !m.IsMe))
                    {
                        var (rec, _) = LolHistoryService.WithAlly(history, m.Puuid ?? m.Name);
                        var member = new JsonObject { ["name"] = m.Name, ["gamesTogether"] = rec.Games, ["winsTogether"] = rec.Wins, ["lossesTogether"] = rec.Losses };
                        if (m.Scout is { } sc)
                        {
                            if (sc.Tier != null) member["rank"] = $"{sc.Tier} {sc.Division} {sc.Lp} LP ({sc.RankWins}W {sc.RankLosses}L)";
                            member["last20"] = new JsonObject { ["games"] = sc.Games, ["winRate"] = sc.WinRate, ["streak"] = sc.Streak };
                            member["topChampions"] = new JsonArray(sc.TopChampions.Select(c => (JsonNode)c).ToArray());
                        }
                        arr.Add(member);
                    }
                    o["lobbyMembers"] = arr;
                }
                if (kind == "final" && entry.Phase.ChampSelect is { } cs)
                {
                    // Contra el rival directo (si ya se sabe quién está en mi rol) y con mi pick.
                    var enemyChamps = cs.TheirTeam.Where(p => p.Champion != null).Select(p => p.Champion!.Name).ToList();
                    var vs = new JsonArray();
                    foreach (var c in enemyChamps)
                    {
                        var (rec, _) = LolHistoryService.VersusChampion(history, c);
                        if (rec.Games > 0) vs.Add(new JsonObject { ["enemyChampion"] = c, ["games"] = rec.Games, ["wins"] = rec.Wins, ["losses"] = rec.Losses });
                    }
                    if (vs.Count > 0) o["recordVersusEnemies"] = vs;
                    if (cs.MyPick != null)
                    {
                        var mine = history.Where(m => !m.IsRemake && LolHistoryService.Normalize(m.Me.Champion) == LolHistoryService.Normalize(cs.MyPick.Name)).ToList();
                        if (mine.Count > 0) o["recordOnMyPick"] = new JsonObject { ["champion"] = cs.MyPick.Name, ["games"] = mine.Count, ["wins"] = mine.Count(m => m.Win) };
                    }
                }
                if (kind == "postgame")
                {
                    var today = LolHistoryService.CurrentSession(history);
                    o["today"] = new JsonObject { ["games"] = today.Count, ["wins"] = today.Count(m => m.Win), ["losses"] = today.Count(m => !m.Win) };
                }
                return o.Count > 0 ? o : null;
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "[LolCoach] historial para {Kind}", kind);
                return null;
            }
        }

        private async Task SpeakAsync(DesktopConnection conn, LolLiveStateStore.Entry entry, LolCoachSettings settings, string kind)
        {
            var inSelect = kind is "pick" or "my_turn" or "final";
            if (inSelect && entry.CoachCalls >= LolCoachBrain.MaxCallsPerChampSelect) return;
            if (inSelect) entry.CoachCalls++;

            string lang = "es";
            using (var scope = _scopes.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                lang = await db.Users.Where(u => u.Id == conn.UserId).Select(u => u.PreferredLanguage).FirstOrDefaultAsync() ?? "es";
            }
            var stats = _overlays.AllFor(conn.UserId).SelectMany(s => s.Accounts)
                .FirstOrDefault(a => string.Equals(a.ExternalId, entry.Puuid, StringComparison.OrdinalIgnoreCase))?.Stats;

            // Sin saldo el coach no puede pensar. Antes callaba sin decir nada y el streamer
            // creía que estaba roto; ahora el Desktop lo avisa, una vez por día.
            if (!await _brain.HasCreditsAsync(conn.UserId))
            {
                if (entry.NoCreditsNotifiedOn?.Date != DateTime.UtcNow.Date)
                {
                    entry.NoCreditsNotifiedOn = DateTime.UtcNow;
                    var en = lang.StartsWith("en", StringComparison.OrdinalIgnoreCase);
                    await conn.SendAsync(Name, "coach", new
                    {
                        kind = "notice",
                        comment = en
                            ? "Out of credits: the coach is paused. Top up at decatron.net/credits and it comes back on its own."
                            : "Sin créditos: el coach está en pausa. Recarga en decatron.net/credits y vuelve solo.",
                        tips = Array.Empty<string>(),
                        coachName = settings.CoachName,
                    });
                }
                return;
            }

            var reloj = System.Diagnostics.Stopwatch.StartNew();
            var extra = await HistoryContextAsync(conn.UserId, entry, kind, conn.Token);
            var msHistorial = reloj.ElapsedMilliseconds;
            var info = await _brain.ThinkAsync(kind, entry.Phase, new LolCoachBrain.StreamerContext(conn.UserId, conn.Login, lang, settings, stats, entry.SummonerName, extra), conn.Token);
            if (info == null) return;
            var msIa = reloj.ElapsedMilliseconds - msHistorial;

            entry.CoachHistory.Add(info);
            if (entry.CoachHistory.Count > 20) entry.CoachHistory.RemoveAt(0);
            if (settings.ShowOnOverlay) entry.Phase.Coach = info;
            entry.Phase.UpdatedAt = DateTime.UtcNow;

            await conn.SendAsync(Name, "coach", new
            {
                kind = info.Kind, comment = info.Comment, suggestion = info.Suggestion, runes = info.Runes, spells = info.Spells,
                build = info.Build, matchup = info.Matchup, tips = info.Tips, coachName = info.CoachName,
            });
            var msTexto = reloj.ElapsedMilliseconds;

            // La voz arranca YA, en paralelo con el overlay y el chat: antes esperaba a que
            // salieran los dos y el audio del plan final llegaba varios segundos tarde.
            var voz = settings.SpeaksOn(info.Kind) ? SpeakAloudAsync(conn, settings, info, lang, reloj) : Task.CompletedTask;

            if (settings.ShowOnOverlay) await _poller.PushLivePhaseAsync(conn.UserId);
            if (settings.PostsOn(info.Kind)) await PostToChatAsync(conn.Login, info, lang);

            _logger.LogInformation("[LolCoach] {Login} {Kind}: historial {Hist} ms · IA {Ia} ms · texto al Desktop a los {Texto} ms",
                conn.Login, info.Kind, msHistorial, msIa, msTexto);
            await voz;
        }

        /// <summary>
        /// Sintetiza y manda la voz. El audio va como MP3 en base64 por el mismo canal (son
        /// clips de pocos segundos). Si no hay créditos ni voz estándar, se manda el motivo y
        /// el coach sigue en texto. Nunca lanza.
        /// </summary>
        private async Task SpeakAloudAsync(DesktopConnection conn, LolCoachSettings settings, LiveCoachInfo info, string lang, System.Diagnostics.Stopwatch reloj)
        {
            try
            {
                var (mp3, error, fellBack) = await _voice.SpeakAsync(conn.UserId, settings, info, lang, conn.Token);
                if (fellBack) _logger.LogInformation("[LolCoach] {Login}: sin saldo para la voz premium, salió con la estándar", conn.Login);
                if (mp3 != null)
                    await conn.SendAsync(Name, "coach-audio", new { kind = info.Kind, mime = "audio/mpeg", data = Convert.ToBase64String(mp3) });
                else if (error != null)
                    await conn.SendAsync(Name, "coach-audio", new { kind = info.Kind, error });
                _logger.LogInformation("[LolCoach] {Login} {Kind}: voz ({Engine}{Fallback}) al Desktop a los {Ms} ms{Error}",
                    conn.Login, info.Kind, settings.VoiceEngine, fellBack ? " → standard" : "", reloj.ElapsedMilliseconds, error != null ? " · " + error : "");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[LolCoach] {Login}: la voz falló ({Kind})", conn.Login, info.Kind);
            }
        }

        /// <summary>
        /// Lo que dijo el coach, en el chat del canal. Un solo mensaje por momento, corto, con
        /// el nombre del coach delante para que se lea como suyo y no del bot. Nunca durante
        /// la partida: los momentos que llegan acá son todos fuera de ella (política de Riot).
        /// </summary>
        private async Task PostToChatAsync(string login, LiveCoachInfo info, string lang)
        {
            try
            {
                var en = lang.StartsWith("en", StringComparison.OrdinalIgnoreCase);
                var partes = new List<string?> { info.Comment };
                if (info.Kind == "final")
                {
                    partes.Add(info.Runes != null ? (en ? "Runes: " : "Runas: ") + info.Runes : null);
                    partes.Add(info.Spells != null ? (en ? "Spells: " : "Hechizos: ") + info.Spells : null);
                    partes.Add(info.Build != null ? "Build: " + info.Build : null);
                }
                else if (info.Kind == "postgame")
                {
                    partes.AddRange(info.Tips.Take(2));
                }

                var icono = info.Kind switch { "final" => "🎯", "postgame" => "📊", "briefing" => "☀️", "lobby" => "👥", _ => "🎮" };
                var cuerpo = string.Join(" · ", partes.Where(p => !string.IsNullOrWhiteSpace(p)).Select(p => p!.Replace("\n", " ").Trim()));
                var texto = $"{icono} {info.CoachName}: {cuerpo}";
                if (texto.Length > ChatMax) texto = texto[..(ChatMax - 1)].TrimEnd() + "…";

                await _chat.SendMessageAsync(login, texto);
            }
            catch (Exception ex)
            {
                // Un mensaje de chat que no sale no puede cortar la voz ni el Desktop.
                _logger.LogWarning(ex, "[LolCoach] {Login}: no se pudo publicar en el chat ({Kind})", login, info.Kind);
            }
        }

        public Task OnBinaryAsync(DesktopConnection conn, ReadOnlyMemory<byte> payload) => Task.CompletedTask;

        public async Task OnDisconnectedAsync(DesktopConnection conn)
        {
            _store.Get(conn.UserId)?.Debounce?.Cancel();
            _store.Remove(conn.UserId, conn.Device.Id);
            try { await _poller.PushLivePhaseAsync(conn.UserId); }
            catch (Exception ex) { _logger.LogDebug(ex, "[LolCoach] push tras desconexion"); }
        }

        /// <summary>Región de la cuenta vinculada del streamer (los amigos del lobby están en la misma).</summary>
        private async Task<string?> RegionAsync(long userId, LolLiveStateStore.Entry entry)
        {
            if (entry.Puuid == null) return null;
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            return await db.LinkedGameAccounts.AsNoTracking().Where(a => a.Game == GameIds.Lol && a.IsActive && a.ExternalId == entry.Puuid).Select(a => a.Region).FirstOrDefaultAsync();
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
