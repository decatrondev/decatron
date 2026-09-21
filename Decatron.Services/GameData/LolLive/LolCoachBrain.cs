using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models;
using Decatron.Core.Models.GameOverlays;
using Decatron.Services.AI;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Decatron.Data;
using Decatron.Core.Helpers;

namespace Decatron.Services.GameData.LolLive
{
    /// <summary>
    /// El "cerebro" del coach: arma el prompt con lo que se ve en el cliente + lo que se
    /// sabe del streamer (top champs, rol, pool declarado) y pide a la IA un JSON corto.
    /// Solo habla en lobby/selección/post-partida — nunca en partida (política de Riot).
    /// Tope de llamadas por selección para que el gasto sea predecible (~$0.005/partida).
    /// Plan: .dev/plans/LOL_COACH_PLAN.md §2.3, §2.5
    /// </summary>
    public class LolCoachBrain
    {
        public const string Module = "lol-coach";
        public const int MaxCallsPerChampSelect = 8;

        private readonly OpenRouterClient _ai;
        private readonly AiSettingsCache _settings;
        private readonly LolStaticNames _names;
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<LolCoachBrain> _logger;

        public LolCoachBrain(OpenRouterClient ai, AiSettingsCache settings, LolStaticNames names, IServiceScopeFactory scopes, ILogger<LolCoachBrain> logger)
        {
            _ai = ai; _settings = settings; _names = names; _scopes = scopes; _logger = logger;
        }

        /// <summary>Llamadas del coach hechas hoy (UTC) por el canal y el tope de su tier.</summary>
        public async Task<(int used, int max)> DailyUsageAsync(long userId, CancellationToken ct = default)
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var tier = await TierResolver.GetEffectiveTierAsync(db, userId);
            var max = GameOverlayTierLimits.ForTier(tier).MaxCoachCallsPerDay;
            var since = DateTime.UtcNow.Date;
            var used = await db.AiUsageLogs.CountAsync(l => l.Module == Module && l.UserId == userId && l.UsedAt >= since, ct);
            return (used, max);
        }

        public bool IsAvailable => _ai.IsConfigured;

        /// <summary>Contexto del streamer que no cambia durante la selección. Extra = datos del historial propio (fase 3a) ya resumidos, por clave.</summary>
        public sealed record StreamerContext(long UserId, string Login, string Language, LolCoachSettings Settings, AccountStats? Stats, string? SummonerName, JsonObject? Extra = null);

        /// <summary>
        /// kind: pick (cambió un pick/ban), my_turn (me toca), final (todos lockearon), postgame.
        /// Devuelve null si la IA no está configurada o falló (nunca lanza).
        /// </summary>
        public async Task<LiveCoachInfo?> ThinkAsync(string kind, LivePhaseInfo phase, StreamerContext ctx, CancellationToken ct = default)
        {
            if (!IsAvailable) return null;
            try
            {
                // Tope diario por tier: el texto del coach es gratis para el canal, pero no ilimitado.
                var (used, max) = await DailyUsageAsync(ctx.UserId, ct);
                if (used >= max)
                {
                    if (used == max) _logger.LogInformation("[LolCoach] {Login}: tope diario alcanzado ({Max} llamadas)", ctx.Login, max);
                    return null;
                }
                var system = SystemPrompt(ctx, kind, phase);
                var user = UserPrompt(kind, phase, ctx);
                var isFinal = kind is "final" or "postgame" or "briefing";
                var r = await _ai.ChatAsync(_settings.CoachModel, system, user, new AiCallContext(Module, ctx.UserId, ctx.Login),
                    maxTokens: isFinal ? 700 : 400, temperature: 0.7, timeout: TimeSpan.FromSeconds(isFinal ? 25 : 12), reasoning: false, ct: ct);
                var info = Parse(r.Text, kind, ctx.Settings.CoachName);
                if (info == null) { _logger.LogWarning("[LolCoach] {Login}: respuesta no parseable: {Text}", ctx.Login, r.Text.Length > 200 ? r.Text[..200] : r.Text); return null; }
                // La IA escribe ítems/runas/hechizos en inglés (ver SystemPrompt); acá se pasan al idioma
                // del canal con la tabla oficial de Data Dragon y se tira lo que no exista.
                info.Runes = await _names.LocalizeAsync(info.Runes, ctx.Language, ct);
                // Los hechizos se quedan en inglés: en LATAM todo el mundo dice "Flash", nadie "Destello".
                info.Build = await _names.CleanBuildAsync(info.Build, ctx.Language, ct);
                return info;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[LolCoach] {Login}: fallo pensando ({Kind})", ctx.Login, kind);
                return null;
            }
        }

        private static string ToneText(string tone, string lang) => (tone, lang.StartsWith("en")) switch
        {
            ("hype", true) => "Energetic, hype caster voice. Short punchy sentences, some caps allowed, no filler.",
            ("hype", false) => "Voz de caster con hype. Frases cortas y con energía, alguna mayúscula permitida, sin relleno.",
            ("troll", true) => "Sarcastic, roasts the streamer with love. Never insulting for real, never toxic to other players.",
            ("troll", false) => "Sarcástico, se burla del streamer con cariño. Nunca insulto real, nunca tóxico con otros jugadores.",
            (_, true) => "Calm analyst voice, concrete and useful, no fluff.",
            _ => "Voz de analista tranquilo, concreto y útil, sin relleno.",
        };

        private static string SystemPrompt(StreamerContext ctx, string kind, LivePhaseInfo phase)
        {
            var en = ctx.Language.StartsWith("en", StringComparison.OrdinalIgnoreCase);
            var name = string.IsNullOrWhiteSpace(ctx.Settings.CoachName) ? "Coach" : ctx.Settings.CoachName;
            var rules = en
                ? $"You are {name}, the League of Legends coach of the streamer {ctx.Login}. You speak on their live stream. {ToneText(ctx.Settings.Tone, "en")}\n" +
                  "Rules: never invent stats; only use what is given. Use current patch knowledge for runes, summoner spells and items. " +
                  "Do not give in-game advice (the game has not started or is already over). " +
                  "For runes, spells and build use ONLY the official in-game English names (e.g. Infinity Edge, Kraken Slayer, Lethal Tempo, Flash, Heal); only items and runes that exist in the current patch (16.x, season 2026); if unsure of a name, leave it out rather than invent it. " +
                  "Answer ONLY with a JSON object, no markdown, with keys: comment (string, 1-2 sentences max), suggestion (string or null: the pick/ban to make), " +
                  "runes (string or null: primary tree + keystone + secondary, short), spells (string or null), build (string or null: first 2-3 items), matchup (string or null: 1-2 sentences about the lane matchup), tips (array of up to 3 short strings)."
                : $"Eres {name}, el coach de League of Legends del streamer {ctx.Login}. Hablas en su stream en vivo. {ToneText(ctx.Settings.Tone, "es")}\n" +
                  "Reglas: nunca inventes estadísticas; usa solo lo que te dan. Usa conocimiento del parche actual para runas, hechizos e ítems. " +
                  "No des consejos dentro de la partida (aún no empezó o ya terminó). Español neutro, sin voseo. " +
                  "IMPORTANTE: en runes, spells y build escribe SIEMPRE los nombres oficiales EN INGLÉS del juego (ej. Infinity Edge, Kraken Slayer, Lethal Tempo, Flash, Heal), aunque el resto vaya en español; el sistema los traduce. " +
                  "Solo ítems y runas que existan hoy (parche 16.x, temporada 2026); si dudas de un nombre, omítelo antes que inventarlo. " +
                  "Responde SOLO con un objeto JSON, sin markdown, con claves: comment (string, máximo 1-2 frases), suggestion (string o null: el pick/ban a hacer), " +
                  "runes (string o null: árbol principal + keystone + secundario, corto), spells (string o null), build (string o null: primeros 2-3 ítems), matchup (string o null: 1-2 frases del matchup de línea), tips (array de hasta 3 strings cortos).";
            var focus = kind switch
            {
                "pick" => en ? "\nEvent: a pick or ban just changed. Give ONLY comment (and suggestion if it changes the plan). Leave the rest null." : "\nEvento: cambió un pick o ban. Da SOLO comment (y suggestion si cambia el plan). El resto null.",
                "my_turn" => en ? "\nEvent: it is the streamer's turn to pick NOW. comment + a clear suggestion (one champion). Leave runes/spells/build null." : "\nEvento: le toca elegir al streamer AHORA. comment + suggestion clara (un campeón). runes/spells/build en null.",
                "final" => en ? "\nEvent: everyone locked in. Full plan: comment, runes, spells, build, matchup, tips." : "\nEvento: todos lockearon. Plan completo: comment, runes, spells, build, matchup, tips.",
                "briefing" => en ? "\nEvent: the streamer just opened the LoL client to start the stream. Give a 2-3 sentence session briefing from the data (rank/LP, yesterday's results, best champion this week, streak, today's goal if any). comment only; tips = up to 2 short focus points. Rest null." : "\nEvento: el streamer acaba de abrir el cliente de LoL para empezar el stream. Da un briefing de 2-3 frases con los datos (rango/LP, cómo le fue ayer, mejor campeón de la semana, racha, objetivo de hoy si hay). Solo comment; tips = hasta 2 focos cortos. El resto null.",
                "lobby" => en ? "\nEvent: friends joined the lobby. One or two sentences: the record with each of them (if given), who is on a streak, a role suggestion if obvious. comment only. Rest null." : "\nEvento: entraron amigos al lobby. Una o dos frases: el récord con cada uno (si te lo dan), quién viene en racha, sugerencia de roles si es obvia. Solo comment. El resto null.",
                "tilt" => en ? "\nEvent: the streamer just lost 3+ games in a row this session. One honest, caring sentence asking whether to keep going or stop, no lecture. comment only. Rest null." : "\nEvento: el streamer lleva 3+ derrotas seguidas en la sesión. Una frase honesta y con cariño preguntando si sigue o corta, sin sermón. Solo comment. El resto null.",
                "postgame" => en ? "\nEvent: the game just ended. comment = honest 2-sentence review of the streamer's game; tips = up to 3 concrete things to improve (compare with their averages when given). Leave the rest null." : "\nEvento: terminó la partida. comment = opinión honesta en 2 frases de cómo jugó el streamer; tips = hasta 3 cosas concretas a mejorar (compara con sus promedios si te los dan). El resto null.",
                _ => "",
            };
            var mode = QueueMode(phase.QueueId, phase.Game?.GameMode);
            var modeNote = (mode, en) switch
            {
                ("aram", true) => "\nMode: ARAM (Howling Abyss, one lane, random champions, no bans). No lane matchup or roles: talk about the team fight, poke vs engage, and the ARAM build (Mark/Dash instead of Flash+Heal, no boots rush). Never suggest a pick from the pool: the champion is random.",
                ("aram", false) => "\nModo: ARAM (Abismo de los Lamentos, una sola línea, campeones al azar, sin bans). No hay matchup de línea ni roles: habla de la pelea de equipo, poke vs engage, y de la build de ARAM (Marca/Dash en vez de Flash+Heal, sin priorizar botas). Nunca sugieras un pick del pool: el campeón es aleatorio.",
                ("arena", true) => "\nMode: Arena (2v2v2v2 with a duo, augments, no lanes, no bans). Talk about the duo synergy and the enemy pairs; build and runes are Arena-specific. No lane matchup.",
                ("arena", false) => "\nModo: Arena (2v2v2v2 en dúo, aumentos, sin líneas, sin bans). Habla de la sinergia del dúo y de las parejas rivales; build y runas son las de Arena. Sin matchup de línea.",
                ("urf", true) => "\nMode: URF/ARURF (no mana, 300 haste, snowball). Fun mode: keep it light, builds are non-standard.",
                ("urf", false) => "\nModo: URF/ARURF (sin maná, 300 de celeridad, snowball). Modo de diversión: tono ligero, las builds no son las normales.",
                ("normal", true) => "\nMode: Normal draft (not ranked): nothing at stake, allow experiments, less pressure.",
                ("normal", false) => "\nModo: Normal (no es ranked): nada en juego, vale experimentar, menos presión.",
                _ => "",
            };
            if (!string.IsNullOrWhiteSpace(ctx.Settings.Notes)) rules += (en ? "\nStreamer's notes for you: " : "\nNotas del streamer para ti: ") + ctx.Settings.Notes.Trim();
            return rules + focus + modeNote;
        }

        /// <summary>ranked | normal | aram | arena | urf | other, por queueId de Riot (o gameMode del cliente como respaldo).</summary>
        public static string QueueMode(int? queueId, string? gameMode) => queueId switch
        {
            420 or 440 or 700 or 1100 => "ranked",           // solo, flex, clash, TFT ranked no aplica
            400 or 430 or 490 => "normal",
            450 or 2400 => "aram",
            1700 or 1710 or 1720 => "arena",
            900 or 1010 or 1900 => "urf",
            _ => (gameMode?.ToUpperInvariant()) switch
            {
                "ARAM" => "aram", "CHERRY" => "arena", "URF" or "ARURF" => "urf", "CLASSIC" => "ranked", _ => "other",
            },
        };

        private static string UserPrompt(string kind, LivePhaseInfo phase, StreamerContext ctx)
        {
            var o = new JsonObject { ["event"] = kind, ["phase"] = phase.Phase, ["queue"] = phase.QueueName, ["mode"] = QueueMode(phase.QueueId, phase.Game?.GameMode) };
            if (ctx.Stats != null)
            {
                o["streamer"] = new JsonObject
                {
                    ["mainRole"] = ctx.Stats.MainRole,
                    ["last20"] = new JsonObject { ["winRate"] = ctx.Stats.WinRate, ["avgKda"] = ctx.Stats.AvgKda, ["avgCsPerMin"] = ctx.Stats.AvgCsPerMin, ["streak"] = ctx.Stats.Streak },
                    ["topChampions"] = new JsonArray(ctx.Stats.TopCharacters.Select(c => (JsonNode)new JsonObject { ["name"] = c.Name, ["games"] = c.Games, ["wins"] = c.Wins, ["losses"] = c.Losses, ["kda"] = c.AvgKda }).ToArray()),
                    ["mastery"] = new JsonArray(ctx.Stats.Mastery.Select(m => (JsonNode)$"{m.Name} M{m.Level}").ToArray()),
                };
            }
            if (!string.IsNullOrWhiteSpace(ctx.Settings.ChampPool)) o["declaredPool"] = ctx.Settings.ChampPool;
            if (ctx.Settings.CurrentGoal is { } goal) o["todayGoal"] = goal;
            if (ctx.Extra != null) foreach (var (k, v) in ctx.Extra) o[k] = v?.DeepClone();

            if (phase.ChampSelect is { } cs)
            {
                static JsonNode Pick(LivePick p) => new JsonObject { ["champion"] = p.Champion?.Name, ["position"] = p.Position, ["locked"] = p.Locked, ["isStreamer"] = p.IsMe };
                o["champSelect"] = new JsonObject
                {
                    ["timerPhase"] = cs.TimerPhase, ["myTurn"] = cs.MyTurn,
                    ["streamerPosition"] = cs.MyPosition, ["streamerPick"] = cs.MyPick?.Name,
                    ["myTeam"] = new JsonArray(cs.MyTeam.Select(Pick).ToArray()),
                    ["enemyTeam"] = new JsonArray(cs.TheirTeam.Select(Pick).ToArray()),
                    ["myBans"] = new JsonArray(cs.MyBans.Select(b => (JsonNode)b.Name).ToArray()),
                    ["enemyBans"] = new JsonArray(cs.TheirBans.Select(b => (JsonNode)b.Name).ToArray()),
                };
            }
            if (phase.PostGame is { } pg)
            {
                o["game"] = new JsonObject
                {
                    ["win"] = pg.Win, ["champion"] = pg.Champion?.Name, ["kills"] = pg.Kills, ["deaths"] = pg.Deaths, ["assists"] = pg.Assists,
                    ["cs"] = pg.Cs, ["csPerMin"] = pg.Cs != null && pg.DurationSeconds > 0 ? Math.Round(pg.Cs.Value / (pg.DurationSeconds / 60.0), 1) : null,
                    ["damage"] = pg.Damage, ["visionScore"] = pg.VisionScore, ["durationMin"] = pg.DurationSeconds / 60, ["lpDelta"] = pg.PointsDelta,
                    ["myTeam"] = new JsonArray(pg.MyTeam.Select(p => (JsonNode)$"{p.Champion?.Name} {p.Kills}/{p.Deaths}/{p.Assists}{(p.IsMe ? " (streamer)" : "")}").ToArray()),
                    ["enemyTeam"] = new JsonArray(pg.TheirTeam.Select(p => (JsonNode)$"{p.Champion?.Name} {p.Kills}/{p.Deaths}/{p.Assists}").ToArray()),
                };
            }
            if (phase.Lobby.Count > 0) o["lobby"] = new JsonArray(phase.Lobby.Select(m => (JsonNode)(m.Name + (m.IsMe ? " (streamer)" : ""))).ToArray());
            return o.ToJsonString();
        }

        private static LiveCoachInfo? Parse(string text, string kind, string coachName)
        {
            var t = text.Trim();
            var a = t.IndexOf('{'); var b = t.LastIndexOf('}');
            if (a < 0) return null;
            JsonObject? j = null;
            if (b > a) { try { j = JsonNode.Parse(t[a..(b + 1)]) as JsonObject; } catch (JsonException) { j = null; } }
            if (j == null)
            {
                // Respuesta cortada por max_tokens: rescatar al menos el comment (y la sugerencia si llegó).
                var m = System.Text.RegularExpressions.Regex.Match(t, @"""comment""\s*:\s*""((?:[^""\\]|\\.)*)""");
                if (!m.Success) return null;
                j = new JsonObject { ["comment"] = System.Text.RegularExpressions.Regex.Unescape(m.Groups[1].Value) };
                var sug = System.Text.RegularExpressions.Regex.Match(t, @"""suggestion""\s*:\s*""((?:[^""\\]|\\.)*)""");
                if (sug.Success) j["suggestion"] = System.Text.RegularExpressions.Regex.Unescape(sug.Groups[1].Value);
            }
            try
            {
                string? S(string k) => j[k] is JsonValue v && v.TryGetValue<string>(out var s) && !string.IsNullOrWhiteSpace(s) ? s.Trim() : null;
                var comment = S("comment");
                if (comment == null) return null;
                return new LiveCoachInfo
                {
                    Kind = kind, Comment = comment, Suggestion = S("suggestion"), Runes = S("runes"), Spells = S("spells"), Build = S("build"), Matchup = S("matchup"),
                    Tips = (j["tips"] as JsonArray)?.Select(x => x?.GetValue<string>()).Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x!.Trim()).Take(3).ToList() ?? new(),
                    CoachName = coachName, At = DateTime.UtcNow,
                };
            }
            catch (JsonException) { return null; }
        }
    }
}
