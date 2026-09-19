using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Decatron.Attributes;
using Decatron.Services.Desktop;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Caching.Memory;
using System.Text.Json;

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
        private readonly IHttpClientFactory _http;
        private readonly IMemoryCache _cache;

        public DesktopController(DesktopDeviceService devices, IHttpClientFactory http, IMemoryCache cache)
        {
            _devices = devices;
            _http = http;
            _cache = cache;
        }

        private const string ReleasesRepo = "decatrondev/decatron-desktop";
        private const string ReleasesLatestUrl = $"https://github.com/{ReleasesRepo}/releases/latest";

        public record ReleaseInfo(string? Version, string ReleaseUrl, string? Windows, string? MacOs, string? Linux);

        /// <summary>
        /// URL de descarga del último release por plataforma, para que el botón «Descargar» del
        /// dashboard y de /translate apunten directo al archivo. Se lee de la API de GitHub y se
        /// cachea 5 min en memoria (la API anónima tiene 60 req/h por IP y /translate es pública;
        /// más de eso hace que el botón siga sirviendo la versión anterior un rato después de publicar).
        /// Los nombres de los assets los fija release.yml del repo de la app. Si GitHub falla se
        /// devuelve solo la página del release, así el botón nunca queda roto.
        /// </summary>
        [HttpGet("releases/latest")]
        [AllowAnonymous]
        [ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any)]
        public async Task<ActionResult<ReleaseInfo>> LatestRelease(CancellationToken ct)
        {
            var info = await _cache.GetOrCreateAsync("desktop:latest-release", async e =>
            {
                try
                {
                    var client = _http.CreateClient();
                    client.Timeout = TimeSpan.FromSeconds(8);
                    client.DefaultRequestHeaders.UserAgent.ParseAdd("Decatron/1.0 (+https://decatron.net)");
                    client.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
                    using var doc = JsonDocument.Parse(await client.GetStringAsync($"https://api.github.com/repos/{ReleasesRepo}/releases/latest", ct));
                    var root = doc.RootElement;
                    string? Asset(string name) => root.TryGetProperty("assets", out var assets)
                        ? assets.EnumerateArray()
                            .Where(a => a.GetProperty("name").GetString() == name)
                            .Select(a => a.GetProperty("browser_download_url").GetString())
                            .FirstOrDefault()
                        : null;
                    e.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
                    return new ReleaseInfo(
                        root.GetProperty("tag_name").GetString()?.TrimStart('v'),
                        root.TryGetProperty("html_url", out var h) ? h.GetString() ?? ReleasesLatestUrl : ReleasesLatestUrl,
                        Asset("DecatronDesktop-Setup.exe"),
                        Asset("DecatronDesktop-osx-Setup.pkg"),
                        Asset("DecatronDesktop.AppImage"));
                }
                catch
                {
                    e.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1);
                    return new ReleaseInfo(null, ReleasesLatestUrl, null, null, null);
                }
            });
            return Ok(info);
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
