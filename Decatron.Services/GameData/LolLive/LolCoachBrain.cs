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
using Microsoft.Extensions.Logging;

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
        private readonly ILogger<LolCoachBrain> _logger;

        public LolCoachBrain(OpenRouterClient ai, AiSettingsCache settings, ILogger<LolCoachBrain> logger)
        {
            _ai = ai; _settings = settings; _logger = logger;
        }

        public bool IsAvailable => _ai.IsConfigured;

        /// <summary>Contexto del streamer que no cambia durante la selección.</summary>
        public sealed record StreamerContext(string Login, string Language, LolCoachSettings Settings, AccountStats? Stats, string? SummonerName);

        /// <summary>
        /// kind: pick (cambió un pick/ban), my_turn (me toca), final (todos lockearon), postgame.
        /// Devuelve null si la IA no está configurada o falló (nunca lanza).
        /// </summary>
        public async Task<LiveCoachInfo?> ThinkAsync(string kind, LivePhaseInfo phase, StreamerContext ctx, CancellationToken ct = default)
        {
            if (!IsAvailable) return null;
            try
            {
                var system = SystemPrompt(ctx, kind);
                var user = UserPrompt(kind, phase, ctx);
                var isFinal = kind is "final" or "postgame";
                var r = await _ai.ChatAsync(_settings.CoachModel, system, user, new AiCallContext(Module, 0, ctx.Login),
                    maxTokens: isFinal ? 700 : 220, temperature: 0.7, timeout: TimeSpan.FromSeconds(isFinal ? 25 : 12), reasoning: false, ct: ct);
                var info = Parse(r.Text, kind, ctx.Settings.CoachName);
                if (info == null) _logger.LogWarning("[LolCoach] {Login}: respuesta no parseable: {Text}", ctx.Login, r.Text.Length > 200 ? r.Text[..200] : r.Text);
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

        private static string SystemPrompt(StreamerContext ctx, string kind)
        {
            var en = ctx.Language.StartsWith("en", StringComparison.OrdinalIgnoreCase);
            var name = string.IsNullOrWhiteSpace(ctx.Settings.CoachName) ? "Coach" : ctx.Settings.CoachName;
            var rules = en
                ? $"You are {name}, the League of Legends coach of the streamer {ctx.Login}. You speak on their live stream. {ToneText(ctx.Settings.Tone, "en")}\n" +
                  "Rules: never invent stats; only use what is given. Use current patch knowledge for runes, summoner spells and items. " +
                  "Do not give in-game advice (the game has not started or is already over). " +
                  "Answer ONLY with a JSON object, no markdown, with keys: comment (string, 1-2 sentences max), suggestion (string or null: the pick/ban to make), " +
                  "runes (string or null: primary tree + keystone + secondary, short), spells (string or null), build (string or null: first 2-3 items), matchup (string or null: 1-2 sentences about the lane matchup), tips (array of up to 3 short strings)."
                : $"Eres {name}, el coach de League of Legends del streamer {ctx.Login}. Hablas en su stream en vivo. {ToneText(ctx.Settings.Tone, "es")}\n" +
                  "Reglas: nunca inventes estadísticas; usa solo lo que te dan. Usa conocimiento del parche actual para runas, hechizos e ítems. " +
                  "No des consejos dentro de la partida (aún no empezó o ya terminó). Español neutro, sin voseo. " +
                  "Responde SOLO con un objeto JSON, sin markdown, con claves: comment (string, máximo 1-2 frases), suggestion (string o null: el pick/ban a hacer), " +
                  "runes (string o null: árbol principal + keystone + secundario, corto), spells (string o null), build (string o null: primeros 2-3 ítems), matchup (string o null: 1-2 frases del matchup de línea), tips (array de hasta 3 strings cortos).";
            var focus = kind switch
            {
                "pick" => en ? "\nEvent: a pick or ban just changed. Give ONLY comment (and suggestion if it changes the plan). Leave the rest null." : "\nEvento: cambió un pick o ban. Da SOLO comment (y suggestion si cambia el plan). El resto null.",
                "my_turn" => en ? "\nEvent: it is the streamer's turn to pick NOW. comment + a clear suggestion (one champion). Leave runes/spells/build null." : "\nEvento: le toca elegir al streamer AHORA. comment + suggestion clara (un campeón). runes/spells/build en null.",
                "final" => en ? "\nEvent: everyone locked in. Full plan: comment, runes, spells, build, matchup, tips." : "\nEvento: todos lockearon. Plan completo: comment, runes, spells, build, matchup, tips.",
                "postgame" => en ? "\nEvent: the game just ended. comment = honest 2-sentence review of the streamer's game; tips = up to 3 concrete things to improve (compare with their averages when given). Leave the rest null." : "\nEvento: terminó la partida. comment = opinión honesta en 2 frases de cómo jugó el streamer; tips = hasta 3 cosas concretas a mejorar (compara con sus promedios si te los dan). El resto null.",
                _ => "",
            };
            if (!string.IsNullOrWhiteSpace(ctx.Settings.Notes)) rules += (en ? "\nStreamer's notes for you: " : "\nNotas del streamer para ti: ") + ctx.Settings.Notes.Trim();
            return rules + focus;
        }

        private static string UserPrompt(string kind, LivePhaseInfo phase, StreamerContext ctx)
        {
            var o = new JsonObject { ["event"] = kind, ["phase"] = phase.Phase, ["queue"] = phase.QueueName };
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
            if (a < 0 || b <= a) return null;
            try
            {
                var j = JsonNode.Parse(t[a..(b + 1)]) as JsonObject;
                if (j == null) return null;
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
