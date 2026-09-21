using System;
using System.Linq;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Core.Models.GameOverlays;
using Decatron.Data;
using Decatron.Services.GameData;
using Decatron.Services.GameData.Riot;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    /// <summary>
    /// Admin del modulo Game Overlays (.dev/plans/GAME_OVERLAYS_PLAN.md §3):
    /// estado de proveedores, mapeo de categorias y una prueba directa de una
    /// cuenta vinculada contra su proveedor (para diagnosticar "no me muestra el
    /// rango" sin tener que estar en vivo).
    /// </summary>
    [ApiController]
    [Route("api/admin/game-overlays")]
    [Authorize]
    [RequireSystemOwner]
    public class GameOverlaysAdminController : ControllerBase
    {
        private readonly DecatronDbContext _db;
        private readonly GameDataProviderRegistry _providers;
        private readonly RiotApiKeys _riotKeys;
        private readonly RiotRateLimitGate _gate;
        private readonly GameDetectionService _detection;
        private readonly GameOverlayStateStore _store;

        public GameOverlaysAdminController(DecatronDbContext db, GameDataProviderRegistry providers, RiotApiKeys riotKeys,
            RiotRateLimitGate gate, GameDetectionService detection, GameOverlayStateStore store)
        {
            _db = db;
            _providers = providers;
            _riotKeys = riotKeys;
            _gate = gate;
            _detection = detection;
            _store = store;
        }

        /// <summary>Que juegos tienen API funcionando y cuales estan en manual.</summary>
        [HttpGet("providers/status")]
        public IActionResult ProvidersStatus()
        {
            var games = _providers.All().Select(x => new
            {
                game = x.game,
                provider = x.provider.Provider,
                hasApi = _providers.HasApi(x.game),
                capabilities = x.provider.Capabilities,
            });

            var lolKey = _riotKeys.ForGame(GameIds.Lol);
            var riot = new
            {
                lol = lolKey != null,
                tft = _riotKeys.HasKeyFor(GameIds.Tft),
                valorant = _riotKeys.HasKeyFor(GameIds.Valorant),
                lolKeyBlockedSeconds = lolKey == null ? 0 : (int)_gate.BlockedFor(lolKey).TotalSeconds,
            };

            return Ok(new { success = true, games, riot });
        }

        [HttpGet("category-mappings")]
        public async Task<IActionResult> CategoryMappings()
        {
            var rows = await _db.GameCategoryMappings.AsNoTracking()
                .OrderBy(m => m.Platform).ThenBy(m => m.Game)
                .ToListAsync();
            return Ok(new { success = true, mappings = rows });
        }

        public class UpsertMappingRequest
        {
            public string Platform { get; set; } = "";
            public string CategoryId { get; set; } = "";
            public string CategoryName { get; set; } = "";
            public string Game { get; set; } = "";
        }

        [HttpPut("category-mappings")]
        public async Task<IActionResult> UpsertMapping([FromBody] UpsertMappingRequest req)
        {
            if (req.Platform is not ("twitch" or "kick")) return BadRequest(new { success = false, message = "platform debe ser twitch o kick" });
            if (!GameIds.IsKnown(req.Game)) return BadRequest(new { success = false, message = "juego desconocido" });
            if (string.IsNullOrWhiteSpace(req.CategoryId)) return BadRequest(new { success = false, message = "categoryId requerido" });

            var row = await _db.GameCategoryMappings.FirstOrDefaultAsync(m => m.Platform == req.Platform && m.CategoryId == req.CategoryId);
            if (row == null)
            {
                row = new GameCategoryMapping { Platform = req.Platform, CategoryId = req.CategoryId };
                _db.GameCategoryMappings.Add(row);
            }
            row.CategoryName = req.CategoryName;
            row.Game = req.Game;
            await _db.SaveChangesAsync();
            return Ok(new { success = true, mapping = row });
        }

        [HttpDelete("category-mappings/{id:long}")]
        public async Task<IActionResult> DeleteMapping(long id)
        {
            var row = await _db.GameCategoryMappings.FindAsync(id);
            if (row == null) return NotFound(new { success = false });
            _db.GameCategoryMappings.Remove(row);
            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }

        /// <summary>
        /// Consulta al proveedor una cuenta vinculada cualquiera y devuelve el modelo
        /// normalizado. Gasta rate limit real: es para diagnostico, no para el overlay.
        /// </summary>
        [HttpPost("test-account/{linkedAccountId:long}")]
        public async Task<IActionResult> TestAccount(long linkedAccountId, [FromQuery] bool live = false, [FromQuery] int matches = 5, [FromQuery] string? queue = null)
        {
            var account = await _db.LinkedGameAccounts.AsNoTracking().FirstOrDefaultAsync(a => a.Id == linkedAccountId);
            if (account == null) return NotFound(new { success = false, message = "Cuenta no encontrada" });

            var provider = _providers.For(account);
            var started = DateTime.UtcNow;
            var rank = await provider.GetRankAsync(account, queue);
            var recent = await provider.GetRecentMatchesAsync(account, Math.Clamp(matches, 1, 20), null, queue);
            var liveGame = live ? await provider.GetLiveGameAsync(account) : null;

            return Ok(new
            {
                success = true,
                provider = provider.Provider,
                game = account.Game,
                account = new { account.Id, name = account.FullExternalName, account.Region, account.IsVerified },
                rank,
                recent,
                live = liveGame,
                elapsedMs = (int)(DateTime.UtcNow - started).TotalMilliseconds,
            });
        }

        /// <summary>Estado de deteccion y ultimo OverlayState de un canal (por id de usuario).</summary>
        [HttpGet("channel/{userId:long}/state")]
        public async Task<IActionResult> ChannelState(long userId, [FromQuery] string slug = "main")
        {
            var config = await _db.GameOverlayConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.UserId == userId && c.Slug == slug);
            return Ok(new
            {
                success = true,
                detection = _detection.Get(userId),
                resolved = config == null ? null : new { game = _detection.Resolve(userId, config).game, reason = _detection.Resolve(userId, config).reason },
                state = _store.Get(userId, slug),
            });
        }
    }
}
