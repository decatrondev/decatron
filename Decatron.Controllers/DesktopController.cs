using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Decatron.Attributes;
using Decatron.Services.Desktop;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Decatron.Controllers
{
    /// <summary>
    /// Decatron Desktop: vinculación de la app y dispositivos del canal. Los módulos de la
    /// app (traducción en vivo, asistente de LoL…) hablan por el WebSocket de
    /// <see cref="DesktopWsMiddleware"/>; aquí solo está lo común a todos.
    /// </summary>
    [ApiController]
    [Route("api/desktop")]
    public class DesktopController : ControllerBase
    {
        private readonly DesktopDeviceService _devices;

        public DesktopController(DesktopDeviceService devices)
        {
            _devices = devices;
        }

        public record ClaimRequest(
            [Required, MaxLength(12)] string Code,
            [MaxLength(80)] string? DeviceName,
            [MaxLength(30)] string? AppVersion,
            [MaxLength(20)] string? Platform);

        /// <summary>La app canjea el código que el streamer generó en el dashboard. Anónimo.</summary>
        [HttpPost("devices/claim")]
        [AllowAnonymous]
        [EnableRateLimiting("live-translation-claim")]
        public async Task<IActionResult> Claim([FromBody] ClaimRequest req)
        {
            var result = await _devices.ClaimAsync(req.Code, req.DeviceName ?? "", req.AppVersion, req.Platform);
            if (result == null)
                return BadRequest(new { success = false, message = "Código inválido o vencido" });

            var (device, token) = result.Value;
            return Ok(new
            {
                success = true,
                token,
                deviceId = device.Id,
                wsUrl = $"wss://{Request.Host}{DesktopWsMiddleware.Path}",
            });
        }

        /// <summary>Código de un solo uso para vincular la app. Lo muestra el dashboard.</summary>
        [HttpPost("devices/link-code")]
        [Authorize]
        [RequirePermission("settings", "control_total")]
        public IActionResult CreateLinkCode()
        {
            var (code, expiresAt) = _devices.CreateLinkCode(GetChannelOwnerId());
            return Ok(new { code = $"{code[..4]}-{code[4..]}", expiresAt });
        }

        [HttpGet("devices")]
        [Authorize]
        [RequirePermission("settings")]
        public async Task<IActionResult> List()
        {
            var list = await _devices.ListAsync(GetChannelOwnerId());
            return Ok(list.Select(d => new { d.Id, d.Name, d.AppVersion, d.Platform, d.CreatedAt, d.LastSeenAt }));
        }

        [HttpDelete("devices/{id:long}")]
        [Authorize]
        [RequirePermission("settings", "control_total")]
        public async Task<IActionResult> Revoke(long id)
        {
            var ok = await _devices.RevokeAsync(GetChannelOwnerId(), id);
            return ok ? Ok(new { success = true }) : NotFound();
        }

        private long GetChannelOwnerId()
        {
            var session = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(session) && long.TryParse(session, out var sid)) return sid;
            var claim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(claim, out var cid)) return cid;
            var userClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(userClaim, out var uid)) return uid;
            throw new UnauthorizedAccessException("User not found");
        }
    }
}
