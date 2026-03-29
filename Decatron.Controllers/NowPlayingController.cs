using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Decatron.Data;
using Decatron.Services;
using Decatron.Attributes;
using System;
using System.Net.Http;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/nowplaying")]
    [Authorize]
    public class NowPlayingController : ControllerBase
    {
        private readonly NowPlayingService _nowPlayingService;
        private readonly ILogger<NowPlayingController> _logger;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly OverlayNotificationService _overlayNotificationService;
        private readonly DecatronDbContext _db;

        public NowPlayingController(
            NowPlayingService nowPlayingService,
            ILogger<NowPlayingController> logger,
            IHttpClientFactory httpClientFactory,
            OverlayNotificationService overlayNotificationService,
            DecatronDbContext db)
        {
            _nowPlayingService = nowPlayingService;
            _logger = logger;
            _httpClientFactory = httpClientFactory;
            _overlayNotificationService = overlayNotificationService;
            _db = db;
        }

        // ========================================================================
        // CONFIG ENDPOINTS
        // ========================================================================

        [HttpGet("config")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetConfig()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                if (channelOwnerId == 0)
                    return Unauthorized(new { success = false, message = "No autenticado" });

                var config = await _nowPlayingService.GetConfig(channelOwnerId);

                if (config == null)
                {
                    return Ok(new { success = true, config = (object?)null });
                }

                // Get tier limits
                var tier = await _nowPlayingService.GetUserTierPublic(channelOwnerId);
                var limits = NowPlayingService.GetLimitsForTier(tier);

                // Get cupo info for non-premium
                var cupoInfo = await _nowPlayingService.GetSpotifySlotsInfo();

                return Ok(new
                {
                    success = true,
                    config = new
                    {
                        isEnabled = config.IsEnabled,
                        provider = config.Provider,
                        lastfmUsername = config.LastfmUsername,
                        pollingInterval = config.PollingInterval,
                        configJson = JsonSerializer.Deserialize<JsonElement>(config.ConfigJson),
                        spotifySlotRequested = config.SpotifySlotRequested,
                        spotifySlotAssigned = config.SpotifySlotAssigned,
                        spotifySlotEmail = config.SpotifySlotEmail,
                    },
                    cupos = cupoInfo,
                    tier,
                    limits = new
                    {
                        canUseSpotify = limits.CanUseSpotify,
                        allowVertical = limits.AllowVertical,
                        allowToggleElements = limits.AllowToggleElements,
                        allowGradient = limits.AllowGradient,
                        allowTransparent = limits.AllowTransparent,
                        allowCustomColors = limits.AllowCustomColors,
                        allowCustomOpacity = limits.AllowCustomOpacity,
                        allowCustomFonts = limits.AllowCustomFonts,
                        allowFontSize = limits.AllowFontSize,
                        allowTextShadow = limits.AllowTextShadow,
                        allowProgressBarColors = limits.AllowProgressBarColors,
                        allowProgressBarAnimation = limits.AllowProgressBarAnimation,
                        allowAnimationType = limits.AllowAnimationType,
                        allowAnimationDetails = limits.AllowAnimationDetails,
                        allowFreeMode = limits.AllowFreeMode,
                        allowMoveCard = limits.AllowMoveCard,
                        allowedCanvasPresets = limits.AllowedCanvasPresets,
                        pollingInterval = limits.PollingInterval,
                    },
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener config de now playing");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        [HttpPost("config")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SaveConfig([FromBody] JsonElement configData)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var channelName = await GetChannelNameFromOwner(channelOwnerId);

                if (channelOwnerId == 0 || string.IsNullOrEmpty(channelName))
                    return Unauthorized(new { success = false, message = "No autenticado" });

                await _nowPlayingService.SaveConfig(channelOwnerId, channelName, configData);

                return Ok(new { success = true, message = "Configuración guardada" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al guardar config de now playing");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ========================================================================
        // LAST.FM CONNECTION
        // ========================================================================

        [HttpPost("connect/lastfm")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ConnectLastfm([FromBody] LastfmConnectRequest request)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var channelName = await GetChannelNameFromOwner(channelOwnerId);

                if (channelOwnerId == 0 || string.IsNullOrEmpty(channelName))
                    return Unauthorized(new { success = false, message = "No autenticado" });

                if (string.IsNullOrWhiteSpace(request.Username))
                    return BadRequest(new { success = false, message = "Username es requerido" });

                // Validate username exists on Last.fm
                var httpClient = _httpClientFactory.CreateClient();
                var isValid = await _nowPlayingService.ValidateLastfmUsername(request.Username.Trim(), httpClient);

                if (!isValid)
                    return BadRequest(new { success = false, message = "Username de Last.fm no encontrado" });

                await _nowPlayingService.ConnectLastfm(channelOwnerId, channelName, request.Username.Trim());

                return Ok(new { success = true, message = "Last.fm conectado exitosamente" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al conectar Last.fm");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        [HttpPost("validate/lastfm")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ValidateLastfm([FromBody] LastfmConnectRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Username))
                    return BadRequest(new { success = false, message = "Username es requerido" });

                var httpClient = _httpClientFactory.CreateClient();
                var isValid = await _nowPlayingService.ValidateLastfmUsername(request.Username.Trim(), httpClient);

                return Ok(new { success = true, valid = isValid });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al validar Last.fm username");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        [HttpPost("disconnect")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Disconnect()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                if (channelOwnerId == 0)
                    return Unauthorized(new { success = false, message = "No autenticado" });

                var success = await _nowPlayingService.Disconnect(channelOwnerId);

                if (!success)
                    return NotFound(new { success = false, message = "No hay configuración para desconectar" });

                return Ok(new { success = true, message = "Proveedor desconectado" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al desconectar proveedor");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ========================================================================
        // OVERLAY ENDPOINTS (No auth required)
        // ========================================================================

        [HttpGet("config/overlay/{channelName}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetOverlayConfig(string channelName)
        {
            try
            {
                var data = await _nowPlayingService.GetOverlayConfig(channelName);

                if (data == null)
                    return Ok(new { success = true, config = (object?)null });

                return Ok(new { success = true, config = data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener config de overlay now playing para {Channel}", channelName);
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        [HttpGet("now/{channelName}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetNowPlaying(string channelName)
        {
            try
            {
                var httpClient = _httpClientFactory.CreateClient();
                var data = await _nowPlayingService.GetNowPlaying(channelName, httpClient);

                return Ok(new { success = true, data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener now playing para {Channel}", channelName);
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ========================================================================
        // SPOTIFY CUPOS (non-premium users only)
        // ========================================================================

        [HttpGet("spotify-cupos")]
        [AllowAnonymous]
        public async Task<IActionResult> GetSpotifyCupos()
        {
            try
            {
                var info = await _nowPlayingService.GetSpotifySlotsInfo();
                return Ok(new { success = true, cupos = info });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener info de cupos Spotify");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        [HttpPost("request-spotify-cupo")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> RequestSpotifyCupo([FromBody] SpotifyCupoRequest? request = null)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                if (channelOwnerId == 0)
                    return Unauthorized(new { success = false, message = "No autenticado" });

                var (success, message) = await _nowPlayingService.RequestSpotifySlot(channelOwnerId, request?.SpotifyEmail);

                if (!success)
                    return BadRequest(new { success = false, message });

                return Ok(new { success = true, message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al solicitar cupo Spotify");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        [HttpGet("admin/spotify-cupos")]
        public async Task<IActionResult> GetAdminSpotifyCupos()
        {
            if (!IsAdmin()) return Forbid();
            try
            {
                var requests = await _nowPlayingService.GetSpotifySlotRequests();
                return Ok(new { success = true, requests });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener solicitudes de cupos");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        [HttpPost("admin/assign-cupo/{userId}")]
        public async Task<IActionResult> AssignCupo(long userId)
        {
            if (!IsAdmin()) return Forbid();
            try
            {
                var (success, message) = await _nowPlayingService.AssignSpotifySlot(userId);
                if (!success) return BadRequest(new { success = false, message });
                return Ok(new { success = true, message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al asignar cupo");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        [HttpPost("admin/revoke-cupo/{userId}")]
        public async Task<IActionResult> RevokeCupo(long userId)
        {
            if (!IsAdmin()) return Forbid();
            try
            {
                var (success, message) = await _nowPlayingService.RevokeSpotifySlot(userId);
                if (!success) return BadRequest(new { success = false, message });
                return Ok(new { success = true, message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al revocar cupo");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ========================================================================
        // TESTING
        // ========================================================================

        [HttpPost("test")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SendTestTrack()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var channelName = await GetChannelNameFromOwner(channelOwnerId);
                if (string.IsNullOrEmpty(channelName))
                    return Unauthorized(new { success = false, message = "No autenticado" });

                await _overlayNotificationService.SendToChannel(channelName, "NowPlayingUpdate", new
                {
                    song = "Blinding Lights",
                    artist = "The Weeknd",
                    album = "After Hours",
                    albumArtUrl = "https://lastfm.freetls.fastly.net/i/u/300x300/3b3c24e5a5e7e4b8a2e7e4b8a2e7e4b8.png",
                    durationMs = 200000,
                    isPlaying = true,
                    provider = "lastfm",
                    isNewTrack = true,
                    isTest = true,
                    timestamp = DateTime.UtcNow
                });

                return Ok(new { success = true, message = "Test track enviado al overlay" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al enviar test track");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ========================================================================
        // HELPERS
        // ========================================================================

        private long GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(userIdClaim, out var userId))
                return userId;
            return 0;
        }

        /// <summary>
        /// Obtiene el ID del canal que se está gestionando (respeta jerarquía de permisos)
        /// </summary>
        private long GetChannelOwnerId()
        {
            // PRIORIDAD 1: Obtener canal activo desde la sesión (después de switch)
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
                return sessionId;

            // PRIORIDAD 2: Usar el claim del JWT si existe
            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
                return channelOwnerId;

            // PRIORIDAD 3: Por defecto, usar el propio canal del usuario
            return GetUserId();
        }

        private async Task<string?> GetChannelNameFromOwner(long channelOwnerId)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == channelOwnerId);
            return user?.Login?.ToLower();
        }

        private string? GetChannelName()
        {
            return User.FindFirst(ClaimTypes.Name)?.Value
                ?? User.FindFirst("Login")?.Value;
        }

        private bool IsAdmin()
        {
            var username = User.FindFirst("login")?.Value
                        ?? User.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(username)) return false;

            return _db.SystemAdmins.Any(
                a => a.Username.ToLower() == username.ToLower() && a.Role == "owner");
        }
    }

    // ========================================================================
    // REQUEST DTOS
    // ========================================================================

    public class LastfmConnectRequest
    {
        public string Username { get; set; } = string.Empty;
    }

    public class SpotifyCupoRequest
    {
        public string? SpotifyEmail { get; set; }
    }
}
