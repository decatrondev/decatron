using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Linq;
using System.Threading.Tasks;

namespace Decatron.Services
{
    public class NowPlayingService
    {
        private readonly DecatronDbContext _context;
        private readonly ILogger<NowPlayingService> _logger;
        private readonly OverlayNotificationService _overlayNotificationService;
        private readonly IConfiguration _configuration;
        private readonly string _lastfmApiKey;

        private const int MaxSpotifyUsers = 5; // Limit for non-premium users in Spotify dashboard

        // Tier limits for Now Playing
        private static readonly Dictionary<string, NowPlayingTierLimits> TierLimits = new()
        {
            ["free"] = new NowPlayingTierLimits
            {
                CanUseSpotify = true,
                AllowVertical = false,
                AllowToggleElements = true,
                AllowGradient = false,
                AllowTransparent = false,
                AllowCustomColors = true,
                AllowCustomOpacity = false,
                AllowCustomFonts = true,
                AllowFontSize = true,
                AllowTextShadow = false,
                AllowProgressBarColors = false,
                AllowProgressBarAnimation = false,
                AllowAnimationType = true,
                AllowAnimationDetails = false,
                AllowFreeMode = false,
                AllowMoveCard = false,
                AllowedCanvasPresets = new[] { "1920x1080" },
                PollingInterval = 5,
            },
            ["supporter"] = new NowPlayingTierLimits
            {
                CanUseSpotify = true,
                AllowVertical = true,
                AllowToggleElements = true,
                AllowGradient = false,
                AllowTransparent = true,
                AllowCustomColors = true,
                AllowCustomOpacity = true,
                AllowCustomFonts = false,
                AllowFontSize = true,
                AllowTextShadow = false,
                AllowProgressBarColors = true,
                AllowProgressBarAnimation = false,
                AllowAnimationType = true,
                AllowAnimationDetails = false,
                AllowFreeMode = false,
                AllowMoveCard = true,
                AllowedCanvasPresets = new[] { "1920x1080", "1280x720" },
                PollingInterval = 5,
            },
            ["premium"] = new NowPlayingTierLimits
            {
                CanUseSpotify = true,
                AllowVertical = true,
                AllowToggleElements = true,
                AllowGradient = true,
                AllowTransparent = true,
                AllowCustomColors = true,
                AllowCustomOpacity = true,
                AllowCustomFonts = true,
                AllowFontSize = true,
                AllowTextShadow = true,
                AllowProgressBarColors = true,
                AllowProgressBarAnimation = true,
                AllowAnimationType = true,
                AllowAnimationDetails = true,
                AllowFreeMode = true,
                AllowMoveCard = true,
                AllowedCanvasPresets = new[] { "1920x1080", "1280x720", "2560x1440", "3840x2160" },
                PollingInterval = 3,
            },
        };

        public static NowPlayingTierLimits GetLimitsForTier(string tier)
        {
            if (tier is "fundador" or "admin") return TierLimits["premium"]; // Unlimited = same as premium
            return TierLimits.GetValueOrDefault(tier, TierLimits["free"]);
        }

        public NowPlayingService(
            DecatronDbContext context,
            ILogger<NowPlayingService> logger,
            OverlayNotificationService overlayNotificationService,
            IConfiguration configuration)
        {
            _context = context;
            _logger = logger;
            _overlayNotificationService = overlayNotificationService;
            _configuration = configuration;
            _lastfmApiKey = configuration["LastFmSettings:ApiKey"] ?? "";
        }

        // ========================================================================
        // CONFIG METHODS
        // ========================================================================

        public async Task<NowPlayingConfig?> GetConfig(long userId)
        {
            return await _context.NowPlayingConfigs
                .FirstOrDefaultAsync(c => c.UserId == userId);
        }

        public async Task<NowPlayingConfig?> GetConfigByChannel(string channelName)
        {
            return await _context.NowPlayingConfigs
                .FirstOrDefaultAsync(c => c.ChannelName.ToLower() == channelName.ToLower());
        }

        public async Task<NowPlayingConfig> SaveConfig(long userId, string channelName, JsonElement configData)
        {
            var existing = await GetConfig(userId);

            // Validate tier restrictions
            var tier = await GetUserTier(userId);
            var limits = GetLimitsForTier(tier);
            var requestedProvider = GetStringProperty(configData, "provider", existing?.Provider ?? "lastfm");
            if (requestedProvider == "spotify" && !limits.CanUseSpotify)
                requestedProvider = "lastfm"; // Force Last.fm if tier doesn't allow Spotify

            if (existing != null)
            {
                existing.ChannelName = channelName;
                existing.IsEnabled = GetBoolProperty(configData, "isEnabled", existing.IsEnabled);
                existing.Provider = requestedProvider;
                existing.LastfmUsername = GetStringProperty(configData, "lastfmUsername", existing.LastfmUsername);
                existing.PollingInterval = GetIntProperty(configData, "pollingInterval", existing.PollingInterval);

                if (configData.TryGetProperty("configJson", out var configJson))
                {
                    existing.ConfigJson = configJson.GetRawText();
                }

                existing.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                await _overlayNotificationService.SendToChannel(
                    channelName, "NowPlayingConfigChanged", new { timestamp = DateTime.UtcNow });

                return existing;
            }
            else
            {
                var config = new NowPlayingConfig
                {
                    UserId = userId,
                    ChannelName = channelName,
                    IsEnabled = GetBoolProperty(configData, "isEnabled", false),
                    Provider = GetStringProperty(configData, "provider", "lastfm"),
                    LastfmUsername = GetStringProperty(configData, "lastfmUsername", null),
                    PollingInterval = GetIntProperty(configData, "pollingInterval", 5),
                    ConfigJson = configData.TryGetProperty("configJson", out var cj) ? cj.GetRawText() : "{}",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.NowPlayingConfigs.Add(config);
                await _context.SaveChangesAsync();

                await _overlayNotificationService.SendToChannel(
                    channelName, "NowPlayingConfigChanged", new { timestamp = DateTime.UtcNow });

                return config;
            }
        }

        public async Task<bool> ConnectLastfm(long userId, string channelName, string username)
        {
            var existing = await GetConfig(userId);

            if (existing != null)
            {
                existing.Provider = "lastfm";
                existing.LastfmUsername = username;
                existing.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
            else
            {
                var config = new NowPlayingConfig
                {
                    UserId = userId,
                    ChannelName = channelName,
                    Provider = "lastfm",
                    LastfmUsername = username,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.NowPlayingConfigs.Add(config);
                await _context.SaveChangesAsync();
            }

            return true;
        }

        public async Task<bool> Disconnect(long userId)
        {
            var existing = await GetConfig(userId);
            if (existing == null) return false;

            existing.LastfmUsername = null;
            existing.SpotifyAccessToken = null;
            existing.SpotifyRefreshToken = null;
            existing.SpotifyTokenExpiresAt = null;
            existing.IsEnabled = false;
            existing.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return true;
        }

        // ========================================================================
        // SPOTIFY CONNECTION
        // ========================================================================

        public async Task<bool> ConnectSpotify(long userId, string accessToken, string refreshToken, DateTime expiresAt, string? spotifyEmail = null)
        {
            var existing = await GetConfig(userId);

            if (existing != null)
            {
                existing.Provider = "spotify";
                existing.SpotifyAccessToken = accessToken;
                existing.SpotifyRefreshToken = refreshToken;
                existing.SpotifyTokenExpiresAt = expiresAt;
                if (!string.IsNullOrEmpty(spotifyEmail))
                    existing.SpotifySlotEmail = spotifyEmail;
                existing.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
            else
            {
                // Need channelName — get from user
                var user = await _context.Users.FindAsync(userId);
                var channelName = user?.Login ?? userId.ToString();

                var config = new NowPlayingConfig
                {
                    UserId = userId,
                    ChannelName = channelName,
                    Provider = "spotify",
                    SpotifyAccessToken = accessToken,
                    SpotifyRefreshToken = refreshToken,
                    SpotifyTokenExpiresAt = expiresAt,
                    SpotifySlotEmail = spotifyEmail,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.NowPlayingConfigs.Add(config);
                await _context.SaveChangesAsync();
            }

            return true;
        }

        public async Task<bool> DisconnectSpotify(long userId)
        {
            var existing = await GetConfig(userId);
            if (existing == null) return false;

            // Clear everything: tokens + slot + request
            existing.SpotifyAccessToken = null;
            existing.SpotifyRefreshToken = null;
            existing.SpotifyTokenExpiresAt = null;
            existing.SpotifySlotRequested = false;
            existing.SpotifySlotAssigned = false;
            existing.SpotifySlotAssignedAt = null;
            existing.SpotifySlotEmail = null;
            if (existing.Provider == "spotify")
            {
                existing.Provider = "lastfm";
            }
            existing.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<string?> RefreshSpotifyToken(long userId, string refreshToken, HttpClient httpClient, IConfiguration configuration)
        {
            try
            {
                var clientId = configuration["SpotifySettings:ClientId"] ?? "";
                var clientSecret = configuration["SpotifySettings:ClientSecret"] ?? "";

                var tokenRequest = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["grant_type"] = "refresh_token",
                    ["refresh_token"] = refreshToken
                });

                var authHeader = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));

                var request = new HttpRequestMessage(HttpMethod.Post, "https://accounts.spotify.com/api/token");
                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", authHeader);
                request.Content = tokenRequest;

                var response = await httpClient.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Spotify token refresh failed for userId={UserId}: {Status}", userId, response.StatusCode);
                    return null;
                }

                var json = await response.Content.ReadAsStringAsync();
                var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                var newAccessToken = root.GetProperty("access_token").GetString()!;
                var expiresIn = root.GetProperty("expires_in").GetInt32();
                var newRefreshToken = root.TryGetProperty("refresh_token", out var rt)
                    ? rt.GetString() ?? refreshToken
                    : refreshToken;

                // Update tokens in DB
                var existing = await GetConfig(userId);
                if (existing != null)
                {
                    existing.SpotifyAccessToken = newAccessToken;
                    existing.SpotifyRefreshToken = newRefreshToken;
                    existing.SpotifyTokenExpiresAt = DateTime.UtcNow.AddSeconds(expiresIn - 60);
                    existing.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }

                return newAccessToken;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error refreshing Spotify token for userId={UserId}", userId);
                return null;
            }
        }

        // ========================================================================
        // OVERLAY DATA
        // ========================================================================

        public async Task<object?> GetOverlayConfig(string channelName)
        {
            var config = await GetConfigByChannel(channelName);
            if (config == null) return null;

            return new
            {
                isEnabled = config.IsEnabled,
                provider = config.Provider,
                pollingInterval = config.PollingInterval,
                config = JsonSerializer.Deserialize<JsonElement>(config.ConfigJson)
            };
        }

        // ========================================================================
        // LAST.FM API
        // ========================================================================

        public async Task<object?> GetNowPlaying(string channelName, HttpClient httpClient)
        {
            var config = await GetConfigByChannel(channelName);
            if (config == null || !config.IsEnabled) return null;

            if (config.Provider == "lastfm" && !string.IsNullOrEmpty(config.LastfmUsername))
            {
                return await GetLastfmNowPlaying(config.LastfmUsername, httpClient);
            }

            return null;
        }

        public async Task<object?> GetLastfmNowPlaying(string username, HttpClient httpClient)
        {
            try
            {
                var url = $"http://ws.audioscrobbler.com/2.0/?method=user.getRecentTracks&user={Uri.EscapeDataString(username)}&api_key={_lastfmApiKey}&format=json&limit=1";

                var response = await httpClient.GetAsync(url);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Last.fm API returned {StatusCode} for user {Username}", response.StatusCode, username);
                    return null;
                }

                var json = await response.Content.ReadAsStringAsync();
                var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                if (!root.TryGetProperty("recenttracks", out var recentTracks))
                    return null;

                if (!recentTracks.TryGetProperty("track", out var tracks))
                    return null;

                if (tracks.GetArrayLength() == 0)
                    return null;

                var track = tracks[0];

                // Check if currently playing
                bool isNowPlaying = false;
                if (track.TryGetProperty("@attr", out var attr) &&
                    attr.TryGetProperty("nowplaying", out var np))
                {
                    isNowPlaying = np.GetString() == "true";
                }

                if (!isNowPlaying)
                    return null;

                // Extract track info
                var songName = track.GetProperty("name").GetString() ?? "";
                var artist = track.TryGetProperty("artist", out var artistEl)
                    ? (artistEl.TryGetProperty("#text", out var at) ? at.GetString() : artistEl.GetString()) ?? ""
                    : "";
                var album = track.TryGetProperty("album", out var albumEl)
                    ? (albumEl.TryGetProperty("#text", out var al) ? al.GetString() : albumEl.GetString()) ?? ""
                    : "";

                // Get largest image
                string albumArtUrl = "";
                if (track.TryGetProperty("image", out var images) && images.GetArrayLength() > 0)
                {
                    // Last image is the largest (extralarge)
                    var lastImage = images[images.GetArrayLength() - 1];
                    albumArtUrl = lastImage.TryGetProperty("#text", out var imgUrl)
                        ? imgUrl.GetString() ?? ""
                        : "";
                }

                // Try to get track duration from track.getInfo
                int? durationMs = null;
                try
                {
                    var trackInfoUrl = $"http://ws.audioscrobbler.com/2.0/?method=track.getInfo&artist={Uri.EscapeDataString(artist)}&track={Uri.EscapeDataString(songName)}&api_key={_lastfmApiKey}&format=json";
                    var trackInfoResponse = await httpClient.GetAsync(trackInfoUrl);
                    if (trackInfoResponse.IsSuccessStatusCode)
                    {
                        var trackInfoJson = await trackInfoResponse.Content.ReadAsStringAsync();
                        var trackInfoDoc = JsonDocument.Parse(trackInfoJson);
                        if (trackInfoDoc.RootElement.TryGetProperty("track", out var trackInfo) &&
                            trackInfo.TryGetProperty("duration", out var duration))
                        {
                            var durStr = duration.GetString();
                            if (durStr != null && int.TryParse(durStr, out var durMs) && durMs > 0)
                            {
                                durationMs = durMs;
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Could not fetch track duration from Last.fm");
                }

                return new
                {
                    song = songName,
                    artist,
                    album,
                    albumArtUrl,
                    durationMs,
                    isPlaying = true,
                    provider = "lastfm"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching Last.fm now playing for {Username}", username);
                return null;
            }
        }

        public async Task<bool> ValidateLastfmUsername(string username, HttpClient httpClient)
        {
            try
            {
                var url = $"http://ws.audioscrobbler.com/2.0/?method=user.getInfo&user={Uri.EscapeDataString(username)}&api_key={_lastfmApiKey}&format=json";
                var response = await httpClient.GetAsync(url);
                if (!response.IsSuccessStatusCode) return false;

                var json = await response.Content.ReadAsStringAsync();
                var doc = JsonDocument.Parse(json);
                return doc.RootElement.TryGetProperty("user", out _);
            }
            catch
            {
                return false;
            }
        }

        // ========================================================================
        // SPOTIFY SLOTS
        // ========================================================================

        public async Task<object> GetSpotifySlotsInfo()
        {
            // Only count non-premium users as cupos used
            var used = await _context.NowPlayingConfigs.CountAsync(c => c.SpotifySlotAssigned);
            return new
            {
                total = MaxSpotifyUsers,
                used,
                available = MaxSpotifyUsers - used
            };
        }

        public async Task<(bool success, string message)> RequestSpotifySlot(long userId, string? spotifyEmail = null)
        {
            var config = await GetConfig(userId);
            if (config == null)
                return (false, "Primero debes crear tu configuración de Now Playing");

            if (string.IsNullOrEmpty(config.SpotifyRefreshToken))
                return (false, "Primero debes conectar tu cuenta de Spotify");

            if (config.SpotifySlotAssigned)
                return (false, "Ya tienes un cupo asignado");

            // If email was not captured via API, require it manually
            if (string.IsNullOrEmpty(config.SpotifySlotEmail) && string.IsNullOrWhiteSpace(spotifyEmail))
                return (false, "Debes proporcionar tu email de Spotify");

            // Check available slots (only non-premium count)
            var usedSlots = await _context.NowPlayingConfigs.CountAsync(c => c.SpotifySlotAssigned);
            if (usedSlots >= MaxSpotifyUsers)
                return (false, $"No hay cupos disponibles ({usedSlots}/{MaxSpotifyUsers} ocupados)");

            if (!string.IsNullOrWhiteSpace(spotifyEmail))
                config.SpotifySlotEmail = spotifyEmail.Trim();

            config.SpotifySlotRequested = true;
            config.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return (true, "Solicitud enviada. El admin activará tu slot pronto.");
        }

        public async Task<(bool success, string message)> AssignSpotifySlot(long userId)
        {
            var config = await GetConfig(userId);
            if (config == null)
                return (false, "No se encontró configuración para este usuario");

            if (config.SpotifySlotAssigned)
                return (false, "Este usuario ya tiene un cupo asignado");

            var usedSlots = await _context.NowPlayingConfigs.CountAsync(c => c.SpotifySlotAssigned);
            if (usedSlots >= MaxSpotifyUsers)
                return (false, $"No hay cupos disponibles ({usedSlots}/{MaxSpotifyUsers})");

            config.SpotifySlotAssigned = true;
            config.SpotifySlotAssignedAt = DateTime.UtcNow;
            config.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return (true, "Slot asignado exitosamente");
        }

        public async Task<(bool success, string message)> RevokeSpotifySlot(long userId)
        {
            var config = await GetConfig(userId);
            if (config == null)
                return (false, "No se encontró configuración para este usuario");

            if (!config.SpotifySlotAssigned)
                return (false, "Este usuario no tiene un slot asignado");

            config.SpotifySlotRequested = false;
            config.SpotifySlotAssigned = false;
            config.SpotifySlotAssignedAt = null;
            config.SpotifySlotEmail = null;
            config.SpotifyAccessToken = null;
            config.SpotifyRefreshToken = null;
            config.SpotifyTokenExpiresAt = null;
            if (config.Provider == "spotify")
                config.Provider = "lastfm";
            config.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return (true, "Slot revocado exitosamente");
        }

        public async Task<object> GetSpotifySlotRequests()
        {
            var configs = await _context.NowPlayingConfigs
                .Where(c => c.SpotifySlotRequested || c.SpotifySlotAssigned)
                .Include(c => c.User)
                .OrderByDescending(c => c.SpotifySlotAssigned)
                .ThenBy(c => c.UpdatedAt)
                .ToListAsync();

            var result = new List<object>();
            foreach (var c in configs)
            {
                var tier = await GetUserTier(c.UserId);
                result.Add(new
                {
                    userId = c.UserId,
                    displayName = c.User?.DisplayName ?? c.ChannelName,
                    login = c.User?.Login ?? c.ChannelName,
                    spotifyEmail = c.SpotifySlotEmail,
                    tier,
                    slotAssigned = c.SpotifySlotAssigned,
                    slotAssignedAt = c.SpotifySlotAssignedAt,
                    spotifyConnected = c.SpotifyRefreshToken != null,
                    requestedAt = c.UpdatedAt
                });
            }

            return result;
        }

        public async Task<string> GetUserTierPublic(long userId) => await GetUserTier(userId);

        private async Task<string> GetUserTier(long userId)
        {
            try
            {
                var connection = _context.Database.GetDbConnection();
                if (connection.State != System.Data.ConnectionState.Open)
                    await connection.OpenAsync();

                using var cmd = connection.CreateCommand();
                cmd.CommandText = @"
                    SELECT tier FROM user_subscription_tiers
                    WHERE user_id = @userId
                    AND (tier_expires_at IS NULL OR tier_expires_at > NOW())
                    LIMIT 1";
                cmd.Parameters.Add(new Npgsql.NpgsqlParameter("@userId", userId));

                var result = await cmd.ExecuteScalarAsync();
                return result?.ToString() ?? "free";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting tier for user {UserId}", userId);
                return "free";
            }
        }

        // ========================================================================
        // HELPERS
        // ========================================================================

        private static string GetStringProperty(JsonElement root, string name, string? defaultValue)
        {
            if (root.TryGetProperty(name, out var prop) && prop.ValueKind == JsonValueKind.String)
                return prop.GetString() ?? defaultValue ?? "";
            return defaultValue ?? "";
        }

        private static bool GetBoolProperty(JsonElement root, string name, bool defaultValue)
        {
            if (root.TryGetProperty(name, out var prop))
            {
                if (prop.ValueKind == JsonValueKind.True) return true;
                if (prop.ValueKind == JsonValueKind.False) return false;
            }
            return defaultValue;
        }

        private static int GetIntProperty(JsonElement root, string name, int defaultValue)
        {
            if (root.TryGetProperty(name, out var prop) && prop.TryGetInt32(out var val))
                return val;
            return defaultValue;
        }
    }

    public class NowPlayingTierLimits
    {
        public bool CanUseSpotify { get; set; }
        public bool AllowVertical { get; set; }
        public bool AllowToggleElements { get; set; }
        public bool AllowGradient { get; set; }
        public bool AllowTransparent { get; set; }
        public bool AllowCustomColors { get; set; }
        public bool AllowCustomOpacity { get; set; }
        public bool AllowCustomFonts { get; set; }
        public bool AllowFontSize { get; set; }
        public bool AllowTextShadow { get; set; }
        public bool AllowProgressBarColors { get; set; }
        public bool AllowProgressBarAnimation { get; set; }
        public bool AllowAnimationType { get; set; }
        public bool AllowAnimationDetails { get; set; }
        public bool AllowFreeMode { get; set; }
        public bool AllowMoveCard { get; set; }
        public string[] AllowedCanvasPresets { get; set; } = Array.Empty<string>();
        public int PollingInterval { get; set; } = 5;
    }
}
