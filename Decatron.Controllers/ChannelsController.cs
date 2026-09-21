using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Decatron.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ChannelsController : ControllerBase
    {
        private readonly DecatronDbContext _db;
        private readonly ILogger<ChannelsController> _logger;

        public ChannelsController(DecatronDbContext db, ILogger<ChannelsController> logger)
        {
            _db = db;
            _logger = logger;
        }

        private async Task<bool> IsOwnerAsync()
        {
            var username = User.FindFirst("login")?.Value
                        ?? User.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(username)) return false;

            var admin = await _db.SystemAdmins.FirstOrDefaultAsync(
                a => a.Username.ToLower() == username.ToLower() && a.Role == "owner");

            return admin != null;
        }

        public record CarouselChannelDto(long Id, string Platform, string Login, string DisplayName, string AvatarUrl);
        public record AdminChannelDto(long Id, string Login, string DisplayName, string AvatarUrl, bool IsHidden);
        public record SetVisibilityRequest(bool IsHidden);

        // ═══════════════════════════════════════════════════════════════
        // PUBLIC ENDPOINTS — no authentication required
        // ═══════════════════════════════════════════════════════════════

        /// <summary>Canales activos y visibles para el carrusel público de la landing</summary>
        [HttpGet("carousel")]
        [AllowAnonymous]
        public async Task<IActionResult> GetCarouselChannels()
        {
            try
            {
                var users = await _db.Users
                    .Where(u => u.IsActive && !u.IsHiddenFromCarousel && (u.TwitchId != null || u.KickId != null))
                    .ToListAsync();

                var channels = users
                    .SelectMany(u =>
                    {
                        var result = new System.Collections.Generic.List<CarouselChannelDto>();
                        if (u.TwitchId != null)
                            result.Add(new CarouselChannelDto(u.Id, "twitch", u.Login, u.DisplayName, u.ProfileImageUrl));
                        if (u.KickId != null)
                            result.Add(new CarouselChannelDto(u.Id, "kick", u.KickUsername, u.DisplayName, u.KickProfilePic));
                        return result;
                    })
                    .ToList();

                return Ok(channels);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting carousel channels");
                return StatusCode(500, new { error = "Error al obtener los canales" });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // ADMIN ENDPOINTS — owner only
        // ═══════════════════════════════════════════════════════════════

        /// <summary>Lista completa (incluye ocultos) de canales de una plataforma, para el panel admin</summary>
        [Authorize]
        [HttpGet("admin/{platform}")]
        public async Task<IActionResult> GetAdminChannelList(string platform)
        {
            if (!await IsOwnerAsync()) return Forbid();

            platform = platform?.ToLower();
            if (platform != "twitch" && platform != "kick")
                return BadRequest(new { error = "Plataforma inválida" });

            try
            {
                var query = platform == "twitch"
                    ? _db.Users.Where(u => u.IsActive && u.TwitchId != null)
                    : _db.Users.Where(u => u.IsActive && u.KickId != null);

                var users = await query.ToListAsync();

                var channels = platform == "twitch"
                    ? users.Select(u => new AdminChannelDto(u.Id, u.Login, u.DisplayName, u.ProfileImageUrl, u.IsHiddenFromCarousel))
                    : users.Select(u => new AdminChannelDto(u.Id, u.KickUsername, u.DisplayName, u.KickProfilePic, u.IsHiddenFromCarousel));

                return Ok(channels);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting admin channel list for {Platform}", platform);
                return StatusCode(500, new { error = "Error al obtener los canales" });
            }
        }

        /// <summary>Muestra u oculta un canal del carrusel público</summary>
        [Authorize]
        [HttpPatch("admin/{id}/visibility")]
        public async Task<IActionResult> SetChannelVisibility(long id, [FromBody] SetVisibilityRequest body)
        {
            if (!await IsOwnerAsync()) return Forbid();

            try
            {
                var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
                if (user == null) return NotFound();

                user.IsHiddenFromCarousel = body.IsHidden;
                await _db.SaveChangesAsync();

                return Ok(new { id, isHidden = body.IsHidden });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error setting channel visibility for user {Id}", id);
                return StatusCode(500, new { error = "Error al guardar el cambio" });
            }
        }
    }
}
