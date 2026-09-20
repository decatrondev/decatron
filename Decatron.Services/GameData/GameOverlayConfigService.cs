using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Decatron.Core.Helpers;
using Decatron.Core.Models.GameOverlays;
using Decatron.Data;
using Decatron.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.GameData
{
    /// <summary>
    /// CRUD + validacion por tier de game_overlay_configs (instancias del overlay,
    /// por canal). Al guardar avisa al overlay por SignalR y le pide al poller un
    /// refresco inmediato. La validacion es la misma que ve el frontend con
    /// TierLock: cuentas por juego, instancias, modos de rotacion.
    /// </summary>
    public class GameOverlayConfigService
    {
        private static readonly Regex SlugRegex = new("^[a-z0-9][a-z0-9-]{0,39}$", RegexOptions.Compiled);
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        private readonly DecatronDbContext _db;
        private readonly IHubContext<OverlayHub> _hub;
        private readonly GameDataPollingService _poller;
        private readonly GameDetectionService _detection;
        private readonly GameOverlayStateStore _store;
        private readonly GameDataProviderRegistry _providers;

        public GameOverlayConfigService(DecatronDbContext db, IHubContext<OverlayHub> hub, GameDataPollingService poller,
            GameDetectionService detection, GameOverlayStateStore store, GameDataProviderRegistry providers)
        {
            _providers = providers;
            _db = db;
            _hub = hub;
            _poller = poller;
            _detection = detection;
            _store = store;
        }

        public async Task<(string tier, GameOverlayTierLimits limits)> LimitsForChannelAsync(long channelUserId)
        {
            var tier = await TierResolver.GetEffectiveTierAsync(_db, channelUserId);
            return (tier, GameOverlayTierLimits.ForTier(tier));
        }

        public Task<List<GameOverlayConfig>> ListAsync(long channelUserId) =>
            _db.GameOverlayConfigs.Where(c => c.UserId == channelUserId).OrderBy(c => c.Id).ToListAsync();

        public Task<GameOverlayConfig?> GetAsync(long channelUserId, string slug) =>
            _db.GameOverlayConfigs.FirstOrDefaultAsync(c => c.UserId == channelUserId && c.Slug == slug);

        public async Task<(GameOverlayConfig? config, string? error)> CreateAsync(long channelUserId, string? slug, string? name)
        {
            var (_, limits) = await LimitsForChannelAsync(channelUserId);
            var count = await _db.GameOverlayConfigs.CountAsync(c => c.UserId == channelUserId);
            if (count >= limits.MaxInstances)
                return (null, $"Tu plan permite {limits.MaxInstances} overlay(s) de juegos. Sube de tier para crear más.");

            slug = string.IsNullOrWhiteSpace(slug) ? (count == 0 ? "main" : $"overlay-{count + 1}") : slug.Trim().ToLowerInvariant();
            if (!SlugRegex.IsMatch(slug)) return (null, "El identificador solo admite letras minúsculas, números y guiones (máx. 40).");
            if (await _db.GameOverlayConfigs.AnyAsync(c => c.UserId == channelUserId && c.Slug == slug))
                return (null, "Ya existe un overlay con ese identificador.");

            var config = new GameOverlayConfig
            {
                UserId = channelUserId,
                Slug = slug,
                Name = string.IsNullOrWhiteSpace(name) ? (count == 0 ? "Principal" : $"Overlay {count + 1}") : name.Trim(),
                GamesJson = "{}",
            };
            _db.GameOverlayConfigs.Add(config);
            await _db.SaveChangesAsync();
            _poller.RequestRefresh(channelUserId);
            return (config, null);
        }

        public class UpdateRequest
        {
            public string? Name { get; set; }
            public bool? IsEnabled { get; set; }
            public string? DetectionMode { get; set; }
            public string? ForcedGame { get; set; }
            public string? IdleBehavior { get; set; }
            public JsonElement? Canvas { get; set; }
            public JsonElement? Games { get; set; }
        }

        /// <summary>
        /// Guarda una instancia validando contra el tier. games_json se guarda tal
        /// cual llega (el frontend es dueño de elements/background/fonts), salvo que
        /// se recortan las cuentas que exceden el tope y se degrada la rotacion no
        /// permitida — no se rechaza, se ajusta, y se devuelve que se ajusto.
        /// </summary>
        public async Task<(GameOverlayConfig? config, string? error, List<string> adjustments)> UpdateAsync(
            long channelUserId, long ownerAccountId, string slug, UpdateRequest req)
        {
            var adjustments = new List<string>();
            var config = await GetAsync(channelUserId, slug);
            if (config == null) return (null, "Overlay no encontrado", adjustments);

            var (_, limits) = await LimitsForChannelAsync(channelUserId);

            if (req.Name != null) config.Name = req.Name.Trim().Length == 0 ? config.Name : req.Name.Trim()[..Math.Min(60, req.Name.Trim().Length)];
            if (req.IsEnabled != null) config.IsEnabled = req.IsEnabled.Value;

            if (req.DetectionMode != null)
            {
                if (req.DetectionMode is not ("auto" or "manual")) return (null, "detectionMode debe ser auto o manual", adjustments);
                config.DetectionMode = req.DetectionMode;
            }
            if (req.ForcedGame != null)
            {
                var fg = string.IsNullOrWhiteSpace(req.ForcedGame) ? null : req.ForcedGame;
                if (fg != null && !GameIds.IsKnown(fg)) return (null, "Juego desconocido", adjustments);
                config.ForcedGame = fg;
            }
            if (req.IdleBehavior != null)
            {
                if (req.IdleBehavior is not ("hide" or "multi_card")) return (null, "idleBehavior debe ser hide o multi_card", adjustments);
                config.IdleBehavior = req.IdleBehavior;
            }
            if (req.Canvas != null && req.Canvas.Value.ValueKind == JsonValueKind.Object)
            {
                var w = req.Canvas.Value.TryGetProperty("width", out var wv) && wv.TryGetInt32(out var wi) ? Math.Clamp(wi, 320, 3840) : 1920;
                var h = req.Canvas.Value.TryGetProperty("height", out var hv) && hv.TryGetInt32(out var hi) ? Math.Clamp(hi, 180, 2160) : 1080;
                config.CanvasJson = JsonSerializer.Serialize(new { width = w, height = h });
            }

            if (req.Games != null && req.Games.Value.ValueKind == JsonValueKind.Object)
            {
                var myAccounts = await _db.LinkedGameAccounts
                    .Where(a => a.AccountId == ownerAccountId)
                    .Select(a => new { a.Id, a.Game })
                    .ToListAsync();

                // Reconstruir el objeto juego por juego, tocando solo accounts/rotation.
                var output = new Dictionary<string, JsonElement>();
                foreach (var prop in req.Games.Value.EnumerateObject())
                {
                    if (!GameIds.IsKnown(prop.Name)) continue;
                    if (prop.Value.ValueKind != JsonValueKind.Object) continue;

                    var node = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(prop.Value.GetRawText(), Json) ?? new();

                    // accounts: solo cuentas del dueño, del mismo juego, hasta el tope del tier.
                    var ids = new List<long>();
                    if (node.TryGetValue("accounts", out var accEl) && accEl.ValueKind == JsonValueKind.Array)
                        foreach (var e in accEl.EnumerateArray())
                            if (e.TryGetInt64(out var id) && myAccounts.Any(a => a.Id == id && a.Game == prop.Name) && !ids.Contains(id))
                                ids.Add(id);
                    if (ids.Count > limits.MaxAccountsPerGame)
                    {
                        adjustments.Add($"{prop.Name}: tu plan muestra hasta {limits.MaxAccountsPerGame} cuenta(s); se conservaron las primeras.");
                        ids = ids.Take(limits.MaxAccountsPerGame).ToList();
                    }
                    node["accounts"] = JsonSerializer.SerializeToElement(ids);

                    // rotation.mode: degradar si el tier no lo permite.
                    var mode = "none"; var seconds = 30;
                    if (node.TryGetValue("rotation", out var rotEl) && rotEl.ValueKind == JsonValueKind.Object)
                    {
                        if (rotEl.TryGetProperty("mode", out var m) && m.ValueKind == JsonValueKind.String) mode = m.GetString() ?? "none";
                        if (rotEl.TryGetProperty("seconds", out var sec) && sec.TryGetInt32(out var si)) seconds = Math.Clamp(si, 5, 600);
                    }
                    if (mode is not ("none" or "interval" or "active_first")) mode = "none";
                    if (!limits.AllowsRotation(mode))
                    {
                        var fallback = limits.AllowsRotation("interval") ? "interval" : "none";
                        adjustments.Add($"{prop.Name}: la rotación '{mode}' no está en tu plan; se usó '{fallback}'.");
                        mode = fallback;
                    }
                    node["rotation"] = JsonSerializer.SerializeToElement(new { mode, seconds });

                    // queue / accountQueues: solo valores que el proveedor del juego soporta.
                    var supported = _providers.ForGame(prop.Name).Capabilities.SupportedQueues;
                    string? queue = null;
                    if (node.TryGetValue("queue", out var qEl) && qEl.ValueKind == JsonValueKind.String && supported.Contains(qEl.GetString()))
                        queue = qEl.GetString();
                    if (queue != null) node["queue"] = JsonSerializer.SerializeToElement(queue); else node.Remove("queue");

                    var accountQueues = new Dictionary<string, string>();
                    if (node.TryGetValue("accountQueues", out var aqEl) && aqEl.ValueKind == JsonValueKind.Object)
                        foreach (var kv in aqEl.EnumerateObject())
                            if (long.TryParse(kv.Name, out var aid) && ids.Contains(aid) && kv.Value.ValueKind == JsonValueKind.String && supported.Contains(kv.Value.GetString()))
                                accountQueues[kv.Name] = kv.Value.GetString()!;
                    node["accountQueues"] = JsonSerializer.SerializeToElement(accountQueues);

                    // promo.enabled: en el tier gratis la tarjeta de Decatron no se puede apagar.
                    if (!limits.CanHidePromo && node.TryGetValue("promo", out var promoEl) && promoEl.ValueKind == JsonValueKind.Object
                        && promoEl.TryGetProperty("enabled", out var pen) && pen.ValueKind == JsonValueKind.False)
                    {
                        var promo = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(promoEl.GetRawText(), Json) ?? new();
                        promo["enabled"] = JsonSerializer.SerializeToElement(true);
                        node["promo"] = JsonSerializer.SerializeToElement(promo, Json);
                        adjustments.Add($"{prop.Name}: la tarjeta de Decatron se puede ocultar a partir del plan Supporter.");
                    }

                    output[prop.Name] = JsonSerializer.SerializeToElement(node, Json);
                }
                config.GamesJson = JsonSerializer.Serialize(output, Json);
            }

            config.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            await NotifyConfigChangedAsync(channelUserId, config.Slug);
            _poller.InvalidateOffline(channelUserId);
            _poller.RequestRefresh(channelUserId);
            return (config, null, adjustments);
        }

        public async Task<bool> DeleteAsync(long channelUserId, string slug)
        {
            var config = await GetAsync(channelUserId, slug);
            if (config == null) return false;
            _db.GameOverlayConfigs.Remove(config);
            await _db.SaveChangesAsync();
            _store.Remove(channelUserId, slug);
            await NotifyConfigChangedAsync(channelUserId, slug);
            return true;
        }

        /// <summary>!juego X / panel: override de deteccion para el canal (todas las instancias).</summary>
        public void ForceGame(long channelUserId, string? game)
        {
            _detection.SetOverride(channelUserId, game);
            _poller.RequestRefresh(channelUserId);
        }

        private async Task NotifyConfigChangedAsync(long channelUserId, string slug)
        {
            var login = await _db.Users.Where(u => u.Id == channelUserId).Select(u => u.Login).FirstOrDefaultAsync();
            if (string.IsNullOrEmpty(login)) return;
            try
            {
                await _hub.Clients.Group($"overlay_{login.ToLowerInvariant()}").SendAsync("GameOverlayConfigChanged", new { slug });
            }
            catch { /* overlay desconectado: lo lee al reconectar */ }
        }

        /// <summary>
        /// Estado simulado para el editor y la demo publica: no consulta proveedores
        /// ni gasta rate limit. Determinista por juego para que el preview no baile.
        /// </summary>
        public static OverlayState BuildPreviewState(string game, List<(long id, string name)>? accounts = null)
        {
            var (tier, division, points, label) = game switch
            {
                GameIds.Lol => ("DIAMOND", "II", 45, "LP"),
                GameIds.Tft => ("PLATINUM", "I", 78, "LP"),
                GameIds.Valorant => ("ASCENDANT", "1", 32, "RR"),
                GameIds.MarvelRivals => ("DIAMOND", "III", 0, ""),
                GameIds.Cs2 => ("LEVEL_8", null, 1850, "ELO"),
                GameIds.Fortnite => ("UNREAL", null, 0, ""),
                GameIds.RocketLeague => ("CHAMPION", "II", 0, ""),
                GameIds.Warzone => ("CRIMSON", null, 0, ""),
                _ => ("GOLD", "IV", 12, ""),
            };
            var character = game switch
            {
                GameIds.Lol => new[] { "Caitlyn", "Jhin", "Varus", "Ezreal", "Kai'Sa" },
                GameIds.Valorant => new[] { "Jett", "Reyna", "Sage", "Omen", "Sova" },
                GameIds.MarvelRivals => new[] { "Spider-Man", "Magneto", "Luna Snow", "Hela", "Iron Man" },
                _ => new[] { "", "", "", "", "" },
            };
            var results = new[] { "win", "win", "loss", "win", "loss" };
            var now = DateTime.UtcNow;
            // Iconos reales de Data Dragon para LoL (la version vieja sigue sirviendo para el preview).
            static string? LolIcon(string name) => name switch
            {
                "Caitlyn" => "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Caitlyn.png",
                "Jhin" => "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Jhin.png",
                "Varus" => "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Varus.png",
                "Ezreal" => "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Ezreal.png",
                "Kai'Sa" => "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Kaisa.png",
                _ => null,
            };
            var isLol = game == GameIds.Lol;

            var start = new RankInfo { Tier = tier, Division = division, Points = Math.Max(0, points - 38), PointsLabel = label, Emblem = $"/games/{game}/ranks/{tier.ToLowerInvariant()}.png", Source = "preview" };
            var current = new RankInfo { Tier = tier, Division = division, Points = points, PointsLabel = label, Wins = 128, Losses = 101, Emblem = start.Emblem, Source = "preview" };

            var list = (accounts == null || accounts.Count == 0) ? new List<(long id, string name)> { (0, "Main") } : accounts;
            var states = list.Select((acc, i) => new AccountOverlayState
            {
                AccountId = acc.id,
                Game = game,
                DisplayName = acc.name,
                ExternalName = acc.name,
                Rank = current,
                Session = new SessionState
                {
                    StartRank = start, CurrentRank = current, Wins = 3, Losses = 2, PointsDelta = 38, StreamStartedAt = now.AddHours(-2),
                    Matches = results.Select((r, j) => new MatchSummary
                    {
                        Id = $"preview-{i}-{j}", Result = r, Character = character[j], CharacterIcon = isLol ? LolIcon(character[j]) : null,
                        Kills = 5 + j * 2, Deaths = 3 + (j % 2), Assists = 7 + j, DurationSeconds = 1800 + j * 60,
                        Cs = isLol ? 180 + j * 12 : null, CsPerMin = isLol ? Math.Round((180 + j * 12) / ((1800 + j * 60) / 60.0), 1) : null,
                        Damage = isLol ? 18000 + j * 1500 : null, VisionScore = isLol ? 22 + j : null, Role = isLol ? "BOTTOM" : null,
                        EndedAt = now.AddMinutes(-25 * (j + 1)),
                    }).ToList(),
                    PointsHistory = Enumerable.Range(0, 6).Select(k => new PointsSample
                    {
                        At = now.AddMinutes(-120 + k * 24),
                        Absolute = 2445 - 38 + new[] { 0, 18, 36, 20, 42, 38 }[k],
                        Label = $"D II {Math.Max(0, points - 38) + new[] { 0, 18, 36, 20, 42, 38 }[k]}",
                    }).ToList(),
                },
                Live = i == 0 ? new LiveGameInfo { InGame = true, Character = character[0], CharacterIcon = isLol ? LolIcon(character[0]) : null, StartedAt = now.AddMinutes(-12) } : null,
                Stats = new AccountStats
                {
                    SampleSize = 20, WinRate = 60, AvgKda = 3.4, AvgKills = 7.1, AvgDeaths = 4.2, AvgAssists = 7.3,
                    AvgCsPerMin = isLol ? 7.2 : null, AvgDamage = isLol ? 21400 : null, AvgVisionScore = isLol ? 24.5 : null,
                    Streak = 2, MainRole = isLol ? "BOTTOM" : null, UpdatedAt = now,
                    TopCharacters = character.Where(c => c != "").Take(3).Select((c, j) => new CharacterStat
                    {
                        Name = c, Icon = isLol ? LolIcon(c) : null, Games = 8 - j * 2, Wins = 5 - j, Losses = 3 - j, AvgKda = 3.8 - j * 0.4,
                    }).ToList(),
                    Mastery = isLol ? character.Take(3).Select((c, j) => new MasteryInfo { Name = c, Icon = LolIcon(c), Level = 12 - j * 2, Points = 285_000 - j * 90_000 }).ToList() : new(),
                },
                UpdatedAt = now,
            }).ToList();

            return new OverlayState { ActiveGame = game, Reason = "preview", ActiveAccountId = states[0].AccountId, Accounts = states, UpdatedAt = now };
        }
    }
}
