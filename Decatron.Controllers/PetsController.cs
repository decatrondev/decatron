using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Data;
using Decatron.Services.Pets;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    /// <summary>
    /// Mascotas (plan: .dev/plans/PETS_PLAN.md). Catálogo de modelos, config por canal,
    /// entrega firmada del glb y estímulos de prueba al overlay.
    /// </summary>
    [ApiController]
    [Route("api/pets")]
    [Authorize]
    public class PetsController : ControllerBase
    {
        /// <summary>Panel: URL corta, se pide con JWT cada vez.</summary>
        private static readonly TimeSpan PanelUrlTtl = TimeSpan.FromMinutes(10);
        /// <summary>Overlay de OBS: no tiene JWT, la firma va en la respuesta pública y el overlay recarga config cada 2 min.</summary>
        private static readonly TimeSpan OverlayUrlTtl = TimeSpan.FromHours(6);

        private readonly PetCatalogService _catalog;
        private readonly PetService _service;
        private readonly DecatronDbContext _db;

        public PetsController(PetCatalogService catalog, PetService service, DecatronDbContext db)
        {
            _catalog = catalog;
            _service = service;
            _db = db;
        }

        private long GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(claim, out var id) ? id : 0;
        }

        /// <summary>Canal que se administra (sesión de switch > claim > el propio). Mismo criterio que Game Overlays.</summary>
        private long GetChannelOwnerId()
        {
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId)) return sessionId;
            var claim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(claim, out var channelOwnerId)) return channelOwnerId;
            return GetUserId();
        }

        private static object ManifestDto(Decatron.Core.Models.Pets.PetManifest m) => new
        {
            m.Id, m.Name, m.Credit, m.Triangles, m.Scale, m.GroundOffset, m.States, m.Skins
        };

        private string SignedUrl(string id, TimeSpan ttl)
        {
            var (expires, signature) = _catalog.Sign(id, ttl);
            return Url.Action(nameof(GetFile), "Pets", new { id, e = expires, s = signature }) ?? string.Empty;
        }

        // ---------- catálogo y archivos ----------

        /// <summary>Modelos disponibles (sin rutas de archivo).</summary>
        [HttpGet("catalog")]
        public IActionResult Catalog() => Ok(_catalog.GetAll().Select(ManifestDto));

        /// <summary>URL firmada de corta duración para cargar el glb de un modelo (panel/demo).</summary>
        [HttpGet("models/{id}/sign")]
        public IActionResult Sign(string id)
        {
            var manifest = _catalog.Get(id);
            if (manifest == null) return NotFound();
            return Ok(new { url = SignedUrl(manifest.Id, PanelUrlTtl) });
        }

        /// <summary>Entrega el glb. Solo con firma válida y no vencida; nunca se cachea en proxies.</summary>
        [HttpGet("models/{id}/file")]
        [AllowAnonymous]
        public IActionResult GetFile(string id, [FromQuery] long e, [FromQuery] string? s)
        {
            if (!_catalog.Verify(id, e, s)) return Unauthorized();
            var path = _catalog.GetModelPath(id);
            if (path == null) return NotFound();

            Response.Headers["Cache-Control"] = "private, no-store";
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            return PhysicalFile(path, "model/gltf-binary", enableRangeProcessing: true);
        }

        // ---------- config del canal ----------

        public class SaveConfigRequest
        {
            public bool IsEnabled { get; set; } = true;
            public System.Text.Json.JsonElement Config { get; set; }
        }

        /// <summary>Config del canal + catálogo + plantilla de URL, para el panel.</summary>
        [HttpGet("config")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetConfig()
        {
            var channelId = GetChannelOwnerId();
            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == channelId);
            if (user == null) return NotFound(new { success = false, message = "Canal no encontrado" });

            var config = await _service.GetAsync(channelId);
            var platform = user.AuthProvider == "kick" ? "kick" : "twitch";
            return Ok(new
            {
                success = true,
                isEnabled = config?.IsEnabled ?? true,
                config = config == null ? (System.Text.Json.JsonElement?)null : System.Text.Json.JsonDocument.Parse(config.ConfigJson).RootElement,
                catalog = _catalog.GetAll().Select(ManifestDto),
                overlayUrlTemplate = $"/overlay/pets?channel={Uri.EscapeDataString(user.Login.ToLowerInvariant())}&platform={platform}",
            });
        }

        [HttpPost("config")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SaveConfig([FromBody] SaveConfigRequest req)
        {
            var channelId = GetChannelOwnerId();
            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == channelId);
            if (user == null) return NotFound(new { success = false, message = "Canal no encontrado" });

            try
            {
                var saved = await _service.SaveAsync(channelId, req.IsEnabled, req.Config.GetRawText());
                await _service.NotifyConfigChangedAsync(user.Login);
                return Ok(new { success = true, isEnabled = saved.IsEnabled, updatedAt = saved.UpdatedAt });
            }
            catch (System.Text.Json.JsonException)
            {
                return BadRequest(new { success = false, message = "Config inválida" });
            }
        }

        public class TestRequest
        {
            public string State { get; set; } = "react";
            public int DurationSec { get; set; } = 4;
            public string? Bubble { get; set; }
        }

        /// <summary>Pestaña Testing: manda un estímulo al overlay real del canal.</summary>
        [HttpPost("test")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Test([FromBody] TestRequest req)
        {
            var channelId = GetChannelOwnerId();
            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == channelId);
            if (user == null) return NotFound(new { success = false, message = "Canal no encontrado" });
            await _service.SendEventAsync(user.Login, req.State, req.DurationSec, req.Bubble, "test");
            return Ok(new { success = true });
        }

        // ---------- overlay público ----------

        /// <summary>Lo que carga el overlay de OBS: config, manifests resueltos y URL firmada de cada modelo. Sin secretos.</summary>
        [HttpGet("overlay/{channel}")]
        [AllowAnonymous]
        public async Task<IActionResult> PublicOverlay(string channel, [FromQuery] string platform = "twitch")
        {
            var normalized = channel.Trim().ToLowerInvariant();
            var user = platform == "kick"
                ? await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.IsActive && u.AuthProvider == "kick" &&
                    (u.Login == normalized || (u.KickUsername != null && u.KickUsername.ToLower() == normalized)))
                : await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.IsActive && u.AuthProvider != "kick" && u.Login == normalized);
            if (user == null) return NotFound(new { success = false, message = "Canal no encontrado" });

            var channelKey = user.Login.ToLowerInvariant();
            var config = await _service.GetAsync(user.Id);
            if (config == null || !config.IsEnabled)
                return Ok(new { success = true, enabled = false, channelKey });

            var models = _catalog.GetAll().Select(m => new
            {
                manifest = ManifestDto(m),
                url = SignedUrl(m.Id, OverlayUrlTtl),
            });

            return Ok(new
            {
                success = true,
                enabled = true,
                channelKey,
                config = System.Text.Json.JsonDocument.Parse(config.ConfigJson).RootElement,
                models,
            });
        }
    }
}
