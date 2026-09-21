using System;
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
    /// Overlay "Partida en vivo" (LIVE_MATCH_OVERLAY_PLAN.md §3): instancias por canal y
    /// el endpoint público que usa OBS. La fase llega por SignalR ("LiveMatchState") desde
    /// GameDataPollingService.PushLivePhaseAsync cada vez que Decatron Desktop manda algo.
    /// </summary>
    [ApiController]
    [Route("api/live-overlays")]
    [Authorize]
    public class LiveOverlaysController : ControllerBase
    {
        private readonly DecatronDbContext _db;
        private readonly LiveOverlayService _service;

        public LiveOverlaysController(DecatronDbContext db, LiveOverlayService service)
        {
            _db = db;
            _service = service;
        }

        private long GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(claim, out var id) ? id : 0;
        }

        /// <summary>Canal que se administra (sesion de switch > claim > el propio). Mismo criterio que Game Overlays.</summary>
        private long GetChannelOwnerId()
        {
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId)) return sessionId;
            var claim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(claim, out var channelOwnerId)) return channelOwnerId;
            return GetUserId();
        }

        private static object ToDto(LiveOverlayConfig c) => new
        {
            c.Id, c.Slug, c.Name, c.IsEnabled,
            canvas = JsonSerializer.Deserialize<JsonElement>(c.CanvasJson),
            config = JsonSerializer.Deserialize<JsonElement>(c.ConfigJson),
            c.CreatedAt, c.UpdatedAt,
        };

        private static string Platform(Decatron.Core.Models.User u) => u.AuthProvider == "kick" ? "kick" : "twitch";

        [HttpGet]
        [RequirePermission("overlays")]
        public async Task<IActionResult> List()
        {
            var channelId = GetChannelOwnerId();
            if (channelId == 0) return Unauthorized();
            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == channelId);
            if (user == null) return NotFound(new { success = false, message = "Canal no encontrado" });
            var instances = await _service.ListAsync(channelId);
            var coach = await _db.LolCoachSettings.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == channelId);
            return Ok(new
            {
                success = true,
                channel = new { id = user.Id, login = user.Login, platform = Platform(user), displayName = user.KickUsername ?? user.DisplayName ?? user.Login },
                instances = instances.Select(ToDto),
                state = _service.StateFor(channelId),
                desktopLinked = coach != null,
                overlayUrlTemplate = $"/overlay/live?channel={Uri.EscapeDataString(user.Login)}&platform={Platform(user)}&slug={{slug}}",
            });
        }

        public class CreateRequest { public string? Slug { get; set; } public string? Name { get; set; } }

        [HttpPost]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Create([FromBody] CreateRequest? req)
        {
            var channelId = GetChannelOwnerId();
            if (channelId == 0) return Unauthorized();
            var (config, error) = await _service.CreateAsync(channelId, req?.Slug, req?.Name);
            if (config == null) return BadRequest(new { success = false, message = error });
            return Ok(new { success = true, instance = ToDto(config) });
        }

        [HttpPut("{slug}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Update(string slug, [FromBody] LiveOverlayService.UpdateRequest req)
        {
            var channelId = GetChannelOwnerId();
            if (channelId == 0) return Unauthorized();
            var (config, error) = await _service.UpdateAsync(channelId, slug, req);
            if (config == null) return BadRequest(new { success = false, message = error });
            return Ok(new { success = true, instance = ToDto(config) });
        }

        [HttpDelete("{slug}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Delete(string slug)
        {
            var channelId = GetChannelOwnerId();
            var ok = await _service.DeleteAsync(channelId, slug);
            return ok ? Ok(new { success = true }) : NotFound(new { success = false, message = "Overlay no encontrado" });
        }

        /// <summary>Config + fase actual para el overlay de OBS. channelKey = grupo de SignalR (JoinChannel).</summary>
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

            var config = await _service.GetAsync(user.Id, slug);
            if (config == null || !config.IsEnabled)
                return Ok(new { success = true, enabled = false, channelKey = user.Login.ToLowerInvariant() });

            return Ok(new
            {
                success = true,
                enabled = true,
                channelKey = user.Login.ToLowerInvariant(),
                channel = new { login = user.Login, platform = Platform(user), displayName = user.KickUsername ?? user.DisplayName ?? user.Login, language = user.PreferredLanguage ?? "es" },
                config = ToDto(config),
                state = _service.StateFor(user.Id),
            });
        }
    }
}
