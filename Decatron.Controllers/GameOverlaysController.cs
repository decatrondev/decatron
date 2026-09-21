using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Core.Models.GameOverlays;
using Decatron.Data;
using Decatron.Services.GameData;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    /// <summary>
    /// Instancias del overlay de juegos, POR CANAL (Twitch y Kick por separado).
    /// Rutas autenticadas respetan la jerarquia de permisos (seccion "overlays",
    /// canal activo por sesion como NowPlaying). La ruta publica es la que carga
    /// /overlay/games?channel=X&platform=twitch|kick&slug=main en OBS.
    /// </summary>
    [ApiController]
    [Route("api/game-overlays")]
    [Authorize]
    public class GameOverlaysController : ControllerBase
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        private readonly DecatronDbContext _db;
        private readonly GameOverlayConfigService _configs;
        private readonly GameAccountService _accounts;
        private readonly GameOverlayStateStore _store;
        private readonly GameDetectionService _detection;
        private readonly GameDataProviderRegistry _providers;
        private readonly GameDataPollingService _poller;
        private readonly GameOverlayPromoService _promos;

        public GameOverlaysController(DecatronDbContext db, GameOverlayConfigService configs, GameAccountService accounts,
            GameOverlayStateStore store, GameDetectionService detection, GameDataProviderRegistry providers, GameDataPollingService poller,
            GameOverlayPromoService promos)
        {
            _promos = promos;
            _poller = poller;
            _db = db;
            _configs = configs;
            _accounts = accounts;
            _store = store;
            _detection = detection;
            _providers = providers;
        }

        // ─── helpers ──────────────────────────────────────────────────────────────

        private long GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(claim, out var id) ? id : 0;
        }

        /// <summary>Canal que se administra (sesion de switch > claim > el propio). Mismo criterio que NowPlaying.</summary>
        private long GetChannelOwnerId()
        {
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId)) return sessionId;
            var claim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(claim, out var channelOwnerId)) return channelOwnerId;
            return GetUserId();
        }

        private object ToDto(GameOverlayConfig c) => new
        {
            c.Id, c.Slug, c.Name, c.IsEnabled, c.DetectionMode, c.ForcedGame, c.IdleBehavior,
            canvas = JsonSerializer.Deserialize<JsonElement>(c.CanvasJson),
            games = JsonSerializer.Deserialize<JsonElement>(c.GamesJson),
            c.CreatedAt, c.UpdatedAt,
        };

        private static string Platform(Decatron.Core.Models.User u) => u.AuthProvider == "kick" ? "kick" : "twitch";

        // ─── panel (autenticado) ──────────────────────────────────────────────────

        /// <summary>Todo lo que necesita el panel al abrir: instancias, tier, limites, catalogo, cuentas del dueño, URL base.</summary>
        [HttpGet]
        [RequirePermission("overlays")]
        public async Task<IActionResult> List()
        {
            var channelId = GetChannelOwnerId();
            if (channelId == 0) return Unauthorized();

            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == channelId);
            if (user == null) return NotFound(new { success = false, message = "Canal no encontrado" });

            var (tier, limits) = await _configs.LimitsForChannelAsync(channelId);
            var instances = await _configs.ListAsync(channelId);
            var ownerAccountId = user.AccountId ?? user.Id;
            var accounts = await _accounts.ListAsync(ownerAccountId);
            var detection = _detection.Get(channelId);

            return Ok(new
            {
                success = true,
                channel = new { id = user.Id, login = user.Login, platform = Platform(user), displayName = user.KickUsername ?? user.DisplayName ?? user.Login },
                tier,
                limits = new
                {
                    limits.MaxAccountsPerGame,
                    maxInstances = limits.MaxInstances == int.MaxValue ? (int?)null : limits.MaxInstances,
                    limits.AllowedRotationModes, limits.PollingIntervalSeconds, limits.MaxRecentMatches,
                    sessionHistoryDays = limits.SessionHistoryDays == int.MaxValue ? (int?)null : limits.SessionHistoryDays,
                    limits.CanHidePromo,
                },
                catalog = _accounts.Catalog(),
                accounts = accounts.Select(_accounts.ToDto),
                instances = instances.Select(ToDto),
                detection = detection == null ? null : new { detection.CategoryId, detection.CategoryName, detection.DetectedGame, detection.OverrideGame },
                overlayUrlTemplate = $"/overlay/games?channel={Uri.EscapeDataString(user.Login)}&platform={Platform(user)}&slug={{slug}}",
            });
        }

        public class CreateRequest { public string? Slug { get; set; } public string? Name { get; set; } }

        [HttpPost]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Create([FromBody] CreateRequest? req)
        {
            var channelId = GetChannelOwnerId();
            if (channelId == 0) return Unauthorized();
            var (config, error) = await _configs.CreateAsync(channelId, req?.Slug, req?.Name);
            if (config == null) return BadRequest(new { success = false, message = error });
            return Ok(new { success = true, instance = ToDto(config) });
        }

        [HttpGet("{slug}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Get(string slug)
        {
            var channelId = GetChannelOwnerId();
            var config = await _configs.GetAsync(channelId, slug);
            if (config == null) return NotFound(new { success = false, message = "Overlay no encontrado" });
            return Ok(new { success = true, instance = ToDto(config), state = _store.Get(channelId, slug) });
        }

        [HttpPut("{slug}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Update(string slug, [FromBody] GameOverlayConfigService.UpdateRequest req)
        {
            var channelId = GetChannelOwnerId();
            if (channelId == 0) return Unauthorized();
            var ownerAccountId = await _accounts.EffectiveAccountIdAsync(channelId);
            var (config, error, adjustments) = await _configs.UpdateAsync(channelId, ownerAccountId, slug, req);
            if (config == null) return BadRequest(new { success = false, message = error });
            return Ok(new { success = true, instance = ToDto(config), adjustments });
        }

        [HttpDelete("{slug}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Delete(string slug)
        {
            var channelId = GetChannelOwnerId();
            var ok = await _configs.DeleteAsync(channelId, slug);
            return ok ? Ok(new { success = true }) : NotFound(new { success = false, message = "Overlay no encontrado" });
        }

        public class ForceGameRequest { public string? Game { get; set; } }

        /// <summary>Override de deteccion para el canal: {"game":"lol"} o {"game":"auto"}.</summary>
        [HttpPost("force-game")]
        [RequirePermission("overlays")]
        public IActionResult ForceGame([FromBody] ForceGameRequest req)
        {
            var channelId = GetChannelOwnerId();
            if (channelId == 0) return Unauthorized();
            var game = req.Game;
            if (game != null && game != "auto" && !GameIds.IsKnown(game)) return BadRequest(new { success = false, message = "Juego desconocido" });
            _configs.ForceGame(channelId, game);
            return Ok(new { success = true, detection = _detection.Get(channelId) });
        }

        /// <summary>Estado simulado de un juego para el editor (no gasta rate limit).</summary>
        [HttpGet("{slug}/preview")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Preview(string slug, [FromQuery] string game = GameIds.Lol)
        {
            if (!GameIds.IsKnown(game)) return BadRequest(new { success = false, message = "Juego desconocido" });
            var channelId = GetChannelOwnerId();
            var config = await _configs.GetAsync(channelId, slug);
            if (config == null) return NotFound(new { success = false, message = "Overlay no encontrado" });

            var games = GameOverlayGamesConfig.Parse(config.GamesJson);
            List<(long id, string name)>? accounts = null;
            if (games.TryGetValue(game, out var g) && g.Accounts.Count > 0)
            {
                var ownerAccountId = await _accounts.EffectiveAccountIdAsync(channelId);
                var linked = await _db.LinkedGameAccounts.AsNoTracking()
                    .Where(a => a.AccountId == ownerAccountId && g.Accounts.Contains(a.Id))
                    .ToListAsync();
                accounts = g.Accounts
                    .Select(id => linked.FirstOrDefault(a => a.Id == id))
                    .Where(a => a != null)
                    .Select(a => (a!.Id, string.IsNullOrWhiteSpace(a.DisplayName) ? a.ExternalName : a.DisplayName))
                    .ToList();
            }
            return Ok(new { success = true, state = GameOverlayConfigService.BuildPreviewState(game, accounts) });
        }

        /// <summary>Estado simulado sin login — demo publica y /overlay/games?preview=lol.</summary>
        [HttpGet("preview-public")]
        [AllowAnonymous]
        public IActionResult PreviewPublic([FromQuery] string game = GameIds.Lol)
        {
            if (!GameIds.IsKnown(game)) return BadRequest(new { success = false, message = "Juego desconocido" });
            return Ok(new { success = true, state = GameOverlayConfigService.BuildPreviewState(game, new List<(long, string)> { (1, "Main"), (2, "Smurf") }) });
        }

        /// <summary>Anuncios de Decatron activos (catálogo del admin) en un idioma, para el preview del editor.</summary>
        [HttpGet("promos")]
        [AllowAnonymous]
        public async Task<IActionResult> Promos([FromQuery] string lang = "es", [FromQuery] string? game = null)
            => Ok(new { success = true, promos = await _promos.GetCatalogAsync(lang, game) });

        // ─── publico (OBS) ────────────────────────────────────────────────────────

        /// <summary>
        /// Config + ultimo estado para el overlay. channel = login (Twitch) o
        /// usuario/login de Kick con platform=kick. Devuelve channelKey: el nombre
        /// del grupo de SignalR al que el overlay debe unirse (JoinChannel).
        /// </summary>
        [HttpGet("overlay/{channel}")]
        [AllowAnonymous]
        public async Task<IActionResult> PublicOverlay(string channel, [FromQuery] string platform = "twitch", [FromQuery] string slug = "main")
        {
            var normalized = channel.Trim().ToLowerInvariant();
            var user = platform == "kick"
                ? await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.IsActive && u.AuthProvider == "kick" &&
                    (u.Login == normalized || (u.KickUsername != null && u.KickUsername.ToLower() == normalized)))
                : await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.IsActive && u.AuthProvider != "kick" && u.Login == normalized);

            if (user == null) return NotFound(new { success = false, message = "Canal no encontrado" });

            var config = await _configs.GetAsync(user.Id, slug);
            if (config == null || !config.IsEnabled)
                return Ok(new { success = true, enabled = false, channelKey = user.Login.ToLowerInvariant() });

            var (_, limits) = await _configs.LimitsForChannelAsync(user.Id);
            // En vivo: lo que calculo el poller. Offline: rango real bajo demanda (throttled).
            OverlayState? state;
            try { state = await _poller.GetOrBuildStateAsync(user.Id, slug); }
            catch { state = _store.Get(user.Id, slug); }

            return Ok(new
            {
                success = true,
                enabled = true,
                channelKey = user.Login.ToLowerInvariant(),
                channel = new { login = user.Login, platform = Platform(user), displayName = user.KickUsername ?? user.DisplayName ?? user.Login, language = user.PreferredLanguage ?? "es" },
                config = ToDto(config),
                limits = new { limits.MaxRecentMatches, limits.PollingIntervalSeconds, limits.CanHidePromo },
                promos = await _promos.GetCatalogAsync(user.PreferredLanguage ?? "es"),
                catalog = _providers.All().Select(x => new { game = x.game, hasApi = _providers.HasApi(x.game), capabilities = x.provider.Capabilities }),
                state,
            });
        }
    }
}
