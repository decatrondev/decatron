using Microsoft.Extensions.Caching.Memory;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Decatron.Services;
using Decatron.Attributes;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Linq;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/spotify")]
    public class SpotifyController : ControllerBase
    {
        private readonly NowPlayingService _nowPlayingService;
        private readonly ILogger<SpotifyController> _logger;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly string _clientId;
        private readonly string _clientSecret;
        private readonly string _redirectUri;
        private readonly string _frontendUrl;

        private const string AuthorizeUrl = "https://accounts.spotify.com/authorize";
        private const string TokenUrl = "https://accounts.spotify.com/api/token";
        private const string Scopes = "user-read-currently-playing user-read-playback-state user-read-email user-read-private";

        public SpotifyController(
            NowPlayingService nowPlayingService,
            ILogger<SpotifyController> logger,
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration)
        {
            _nowPlayingService = nowPlayingService;
            _logger = logger;
            _httpClientFactory = httpClientFactory;
            _clientId = configuration["SpotifySettings:ClientId"] ?? "";
            _clientSecret = configuration["SpotifySettings:ClientSecret"] ?? "";
            _redirectUri = configuration["SpotifySettings:RedirectUri"] ?? "";
            _frontendUrl = configuration["FrontendUrl"] ?? "https://twitch.decatron.net";
        }

        /// <summary>
        /// Returns the Spotify OAuth URL for the authenticated user.
        /// Frontend calls this via AJAX (with JWT), then navigates to the returned URL.
        /// </summary>
        [HttpGet("authorize-url")]
        [Authorize]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetAuthorizeUrl()
        {
            var channelOwnerId = GetChannelOwnerId();
            if (channelOwnerId == 0)
                return Unauthorized(new { success = false, message = "No autenticado" });

            // Check tier — Spotify requires Supporter+
            var tier = await _nowPlayingService.GetUserTierPublic(channelOwnerId);
            var limits = NowPlayingService.GetLimitsForTier(tier);
            if (!limits.CanUseSpotify)
                return StatusCode(403, new { success = false, message = "Spotify requiere ser Supporter ($5/mes) o superior" });

            // Generate cryptographic state token to prevent CSRF and forgery
            var stateToken = Guid.NewGuid().ToString("N");
            var cache = HttpContext.RequestServices.GetRequiredService<Microsoft.Extensions.Caching.Memory.IMemoryCache>();
            cache.Set($"spotify_state_{stateToken}", channelOwnerId, TimeSpan.FromMinutes(10));
            var state = stateToken;

            var queryParams = new Dictionary<string, string>
            {
                ["client_id"] = _clientId,
                ["response_type"] = "code",
                ["redirect_uri"] = _redirectUri,
                ["scope"] = Scopes,
                ["state"] = state,
                ["show_dialog"] = "true"
            };

            var queryString = string.Join("&",
                queryParams.Select(kv => $"{kv.Key}={Uri.EscapeDataString(kv.Value)}"));

            var url = $"{AuthorizeUrl}?{queryString}";
            return Ok(new { success = true, url });
        }

        /// <summary>
        /// Spotify OAuth callback. Exchanges code for tokens and saves them.
        /// </summary>
        [HttpGet("callback")]
        [AllowAnonymous]
        public async Task<IActionResult> Callback(
            [FromQuery] string? code,
            [FromQuery] string? error,
            [FromQuery] string? state)
        {
            if (!string.IsNullOrEmpty(error))
            {
                _logger.LogWarning("Spotify OAuth error: {Error}", error);
                return Redirect($"{_frontendUrl}/overlays/now-playing?spotify=error&message={Uri.EscapeDataString(error)}");
            }

            if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(state))
            {
                return Redirect($"{_frontendUrl}/overlays/now-playing?spotify=error&message=missing_params");
            }

            // Validate state token against cache to prevent CSRF/forgery
            var cache = HttpContext.RequestServices.GetRequiredService<Microsoft.Extensions.Caching.Memory.IMemoryCache>();
            if (!cache.TryGetValue($"spotify_state_{state}", out object? cachedId) || cachedId is not long userId || userId == 0)
            {
                return Redirect($"{_frontendUrl}/overlays/now-playing?spotify=error&message=invalid_state");
            }
            cache.Remove($"spotify_state_{state}");

            try
            {
                // Exchange code for tokens
                var httpClient = _httpClientFactory.CreateClient();
                var tokenRequest = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["grant_type"] = "authorization_code",
                    ["code"] = code,
                    ["redirect_uri"] = _redirectUri
                });

                var authHeader = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_clientId}:{_clientSecret}"));

                var request = new HttpRequestMessage(HttpMethod.Post, TokenUrl);
                request.Headers.Authorization = new AuthenticationHeaderValue("Basic", authHeader);
                request.Content = tokenRequest;

                var response = await httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Spotify token exchange failed: {Status} {Body}", response.StatusCode, responseBody);
                    return Redirect($"{_frontendUrl}/overlays/now-playing?spotify=error&message=token_exchange_failed");
                }

                var tokenData = JsonDocument.Parse(responseBody).RootElement;
                var accessToken = tokenData.GetProperty("access_token").GetString()!;
                var refreshToken = tokenData.GetProperty("refresh_token").GetString()!;
                var expiresIn = tokenData.GetProperty("expires_in").GetInt32();
                var expiresAt = DateTime.UtcNow.AddSeconds(expiresIn - 60); // 60s buffer

                // Try to fetch email from Spotify /v1/me (may fail with 403 if not in dashboard)
                string? spotifyEmail = null;
                try
                {
                    var meRequest = new HttpRequestMessage(HttpMethod.Get, "https://api.spotify.com/v1/me");
                    meRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                    var meResponse = await httpClient.SendAsync(meRequest);
                    if (meResponse.IsSuccessStatusCode)
                    {
                        var meJson = await meResponse.Content.ReadAsStringAsync();
                        var meData = JsonDocument.Parse(meJson).RootElement;
                        spotifyEmail = meData.TryGetProperty("email", out var emailProp) ? emailProp.GetString() : null;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Could not fetch Spotify info for userId={UserId}", userId);
                }

                // Save tokens + email
                await _nowPlayingService.ConnectSpotify(userId, accessToken, refreshToken, expiresAt, spotifyEmail);

                _logger.LogInformation("Spotify connected for userId={UserId}, email={Email}", userId, spotifyEmail ?? "unknown");
                return Redirect($"{_frontendUrl}/overlays/now-playing?spotify=success");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during Spotify OAuth callback for userId={UserId}", userId);
                return Redirect($"{_frontendUrl}/overlays/now-playing?spotify=error&message=server_error");
            }
        }

        /// <summary>
        /// Disconnect Spotify (clear tokens)
        /// </summary>
        [HttpPost("disconnect")]
        [Authorize]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Disconnect()
        {
            var channelOwnerId = GetChannelOwnerId();
            if (channelOwnerId == 0)
                return Unauthorized(new { success = false, message = "No autenticado" });

            await _nowPlayingService.DisconnectSpotify(channelOwnerId);
            return Ok(new { success = true, message = "Spotify desconectado" });
        }

        /// <summary>
        /// Check Spotify connection status
        /// </summary>
        [HttpGet("status")]
        [Authorize]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetStatus()
        {
            var channelOwnerId = GetChannelOwnerId();
            if (channelOwnerId == 0)
                return Unauthorized(new { success = false, message = "No autenticado" });

            var config = await _nowPlayingService.GetConfig(channelOwnerId);
            var isConnected = config?.SpotifyRefreshToken != null;

            return Ok(new { success = true, connected = isConnected });
        }

        private long GetUserId()
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(userIdClaim, out var userId))
                return userId;
            return 0;
        }

        private long GetChannelOwnerId()
        {
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
                return sessionId;

            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
                return channelOwnerId;

            return GetUserId();
        }
    }
}
