using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Concurrent;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Decatron.Services
{
    public class NowPlayingBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<NowPlayingBackgroundService> _logger;
        private readonly IConfiguration _configuration;
        private readonly HttpClient _httpClient;
        private readonly string _lastfmApiKey;

        // Cache: channelName -> last known track data (to detect changes)
        private readonly ConcurrentDictionary<string, string> _lastTrackCache = new();
        // Cache: channelName -> last poll time (for per-user interval)
        private readonly ConcurrentDictionary<string, DateTime> _lastPollTime = new();
        // Cache: channelName -> consecutive empty poll count
        private readonly ConcurrentDictionary<string, int> _emptyPollCount = new();

        public NowPlayingBackgroundService(
            IServiceProvider serviceProvider,
            ILogger<NowPlayingBackgroundService> logger,
            IConfiguration configuration)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
            _configuration = configuration;
            _httpClient = new HttpClient();
            _httpClient.Timeout = TimeSpan.FromSeconds(10);
            _lastfmApiKey = configuration["LastFmSettings:ApiKey"] ?? "";
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("🎵 NowPlayingBackgroundService iniciado");

            // Wait for app to start
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

            _logger.LogInformation("🎵 NowPlayingBackgroundService comenzando polling");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await PollAllActiveChannels(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "❌ Error en NowPlayingBackgroundService");
                }

                // Poll every 3 seconds (minimum interval — per-channel throttling inside)
                await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
            }

            _logger.LogInformation("🎵 NowPlayingBackgroundService detenido");
        }

        private async Task PollAllActiveChannels(CancellationToken stoppingToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var overlayService = scope.ServiceProvider.GetRequiredService<OverlayNotificationService>();
            var nowPlayingService = scope.ServiceProvider.GetRequiredService<NowPlayingService>();

            // Get all enabled configs
            var configs = await context.NowPlayingConfigs
                .Where(c => c.IsEnabled)
                .ToListAsync(stoppingToken);

            foreach (var config in configs)
            {
                if (stoppingToken.IsCancellationRequested) break;

                // Only poll if someone is actually viewing the overlay
                if (!Hubs.OverlayHub.HasActiveClients(config.ChannelName))
                {
                    continue; // No overlay viewers — skip to save API calls
                }

                // Per-channel throttling based on tier
                var intervalSeconds = await GetPollingInterval(config.UserId, nowPlayingService);
                if (_lastPollTime.TryGetValue(config.ChannelName, out var lastPoll)
                    && (DateTime.UtcNow - lastPoll).TotalSeconds < intervalSeconds)
                {
                    continue; // Skip — not enough time since last poll
                }

                _lastPollTime[config.ChannelName] = DateTime.UtcNow;

                try
                {
                    if (config.Provider == "spotify" && config.SpotifyRefreshToken != null && config.SpotifySlotAssigned)
                    {
                        await PollSpotifyChannel(config, overlayService, nowPlayingService);
                    }
                    else if (config.Provider == "lastfm" && config.LastfmUsername != null)
                    {
                        await PollChannel(config.ChannelName, config.LastfmUsername, overlayService);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Error polling now playing for channel {Channel}", config.ChannelName);
                }
            }
        }

        // Tier cache: userId -> (tier, cachedAt)
        private readonly ConcurrentDictionary<long, (string tier, DateTime cachedAt)> _tierCache = new();

        private async Task<int> GetPollingInterval(long userId, NowPlayingService nowPlayingService)
        {
            // Cache tier for 5 minutes to avoid DB spam
            if (_tierCache.TryGetValue(userId, out var cached)
                && (DateTime.UtcNow - cached.cachedAt).TotalMinutes < 5)
            {
                return cached.tier is "premium" or "fundador" or "admin" ? 10 : 15;
            }

            try
            {
                var connectionString = _configuration.GetConnectionString("DefaultConnection");
                using var connection = new Npgsql.NpgsqlConnection(connectionString);
                await connection.OpenAsync();

                using var cmd = new Npgsql.NpgsqlCommand(@"
                    SELECT tier FROM user_subscription_tiers
                    WHERE user_id = @userId
                    AND (tier_expires_at IS NULL OR tier_expires_at > NOW())
                    LIMIT 1", connection);
                cmd.Parameters.AddWithValue("@userId", userId);

                var result = await cmd.ExecuteScalarAsync();
                var tier = result?.ToString() ?? "free";

                _tierCache[userId] = (tier, DateTime.UtcNow);
                return tier is "premium" or "fundador" or "admin" ? 3 : 5;
            }
            catch
            {
                return 15; // Default to 15s on error
            }
        }

        private async Task PollChannel(string channelName, string lastfmUsername, OverlayNotificationService overlayService)
        {
            var url = $"http://ws.audioscrobbler.com/2.0/?method=user.getRecentTracks&user={Uri.EscapeDataString(lastfmUsername)}&api_key={_lastfmApiKey}&format=json&limit=1";

            var response = await _httpClient.GetAsync(url);
            if (!response.IsSuccessStatusCode) return;

            var json = await response.Content.ReadAsStringAsync();
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (!root.TryGetProperty("recenttracks", out var recentTracks)) return;
            if (!recentTracks.TryGetProperty("track", out var tracks)) return;
            if (tracks.GetArrayLength() == 0) return;

            var track = tracks[0];

            // Check if currently playing
            bool isNowPlaying = false;
            if (track.TryGetProperty("@attr", out var attr) &&
                attr.TryGetProperty("nowplaying", out var np))
            {
                isNowPlaying = np.GetString() == "true";
            }

            if (!isNowPlaying)
            {
                // Not playing - check if we need to send stop
                if (_lastTrackCache.TryRemove(channelName, out _))
                {
                    _logger.LogDebug("🎵 Music stopped for channel {Channel}", channelName);
                    await overlayService.SendToChannel(channelName, "NowPlayingStopped", new
                    {
                        timestamp = DateTime.UtcNow
                    });
                }
                return;
            }

            // Extract track info
            var songName = track.GetProperty("name").GetString() ?? "";
            var artist = track.TryGetProperty("artist", out var artistEl)
                ? (artistEl.TryGetProperty("#text", out var at) ? at.GetString() : "") ?? ""
                : "";
            var album = track.TryGetProperty("album", out var albumEl)
                ? (albumEl.TryGetProperty("#text", out var al) ? al.GetString() : "") ?? ""
                : "";

            string albumArtUrl = "";
            if (track.TryGetProperty("image", out var images) && images.GetArrayLength() > 0)
            {
                var lastImage = images[images.GetArrayLength() - 1];
                albumArtUrl = lastImage.TryGetProperty("#text", out var imgUrl)
                    ? imgUrl.GetString() ?? ""
                    : "";
            }

            // Create a cache key to detect changes
            var trackKey = $"{songName}|{artist}|{album}";

            // Check if track changed
            var isNewTrack = !_lastTrackCache.TryGetValue(channelName, out var lastTrack) || lastTrack != trackKey;

            if (isNewTrack)
            {
                _lastTrackCache[channelName] = trackKey;
                _logger.LogDebug("🎵 Now playing for {Channel}: {Song} - {Artist}", channelName, songName, artist);

                // Try to get duration
                int? durationMs = null;
                try
                {
                    var trackInfoUrl = $"http://ws.audioscrobbler.com/2.0/?method=track.getInfo&artist={Uri.EscapeDataString(artist)}&track={Uri.EscapeDataString(songName)}&api_key={_lastfmApiKey}&format=json";
                    var trackInfoResponse = await _httpClient.GetAsync(trackInfoUrl);
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
                catch { }

                await overlayService.SendToChannel(channelName, "NowPlayingUpdate", new
                {
                    song = songName,
                    artist,
                    album,
                    albumArtUrl,
                    durationMs,
                    isPlaying = true,
                    provider = "lastfm",
                    isNewTrack = true,
                    timestamp = DateTime.UtcNow
                });
            }
        }

        private async Task PollSpotifyChannel(
            Decatron.Core.Models.NowPlayingConfig config,
            OverlayNotificationService overlayService,
            NowPlayingService nowPlayingService)
        {
            var accessToken = config.SpotifyAccessToken;

            // Refresh token if expired
            if (config.SpotifyTokenExpiresAt.HasValue && config.SpotifyTokenExpiresAt.Value <= DateTime.UtcNow)
            {
                accessToken = await nowPlayingService.RefreshSpotifyToken(
                    config.UserId, config.SpotifyRefreshToken!, _httpClient, _configuration);

                if (accessToken == null)
                {
                    _logger.LogDebug("Failed to refresh Spotify token for channel {Channel}", config.ChannelName);
                    return;
                }
            }

            if (string.IsNullOrEmpty(accessToken)) return;

            // Call Spotify currently-playing endpoint
            var request = new HttpRequestMessage(HttpMethod.Get, "https://api.spotify.com/v1/me/player/currently-playing");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            var response = await _httpClient.SendAsync(request);

            // 204 = no content (nothing playing)
            if (response.StatusCode == System.Net.HttpStatusCode.NoContent ||
                response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                var emptyCount = _emptyPollCount.AddOrUpdate(config.ChannelName, 1, (_, c) => c + 1);
                // Send stop after 2 consecutive empty polls
                if (emptyCount >= 2 && _lastTrackCache.TryRemove(config.ChannelName, out _))
                {
                    await overlayService.SendToChannel(config.ChannelName, "NowPlayingStopped", new
                    {
                        timestamp = DateTime.UtcNow
                    });
                }
                return;
            }
            // Reset empty counter on successful response
            _emptyPollCount.TryRemove(config.ChannelName, out _);

            // 401 = token expired, try refresh
            if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            {
                accessToken = await nowPlayingService.RefreshSpotifyToken(
                    config.UserId, config.SpotifyRefreshToken!, _httpClient, _configuration);
                if (accessToken == null) return;

                // Retry with new token
                request = new HttpRequestMessage(HttpMethod.Get, "https://api.spotify.com/v1/me/player/currently-playing");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                response = await _httpClient.SendAsync(request);
            }

            // 403 = user not registered in Spotify dashboard or app blocked
            if (response.StatusCode == System.Net.HttpStatusCode.Forbidden)
            {
                _logger.LogWarning("⚠️ Spotify 403 Forbidden para canal {Channel}. Usuario no registrado en Spotify Dashboard.", config.ChannelName);
                return;
            }

            if (response.StatusCode == (System.Net.HttpStatusCode)429)
            {
                // Skip this channel for now — the per-channel throttle will prevent immediate retry
                // Cap backoff at 60 seconds to avoid blocking the entire service
                var retryAfter = Math.Min(response.Headers.RetryAfter?.Delta?.TotalSeconds ?? 30, 60);
                _logger.LogWarning("Spotify 429 for {Channel}. Backing off {Seconds}s", config.ChannelName, retryAfter);
                _lastPollTime[config.ChannelName] = DateTime.UtcNow.AddSeconds(retryAfter);
                return;
            }

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("⚠️ Spotify API error {StatusCode} para canal {Channel}", response.StatusCode, config.ChannelName);
                return;
            }

            var json = await response.Content.ReadAsStringAsync();
            if (string.IsNullOrWhiteSpace(json)) return;

            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            // Check if actually playing
            var isPlaying = root.TryGetProperty("is_playing", out var ip) && ip.GetBoolean();

            if (!isPlaying)
            {
                var emptyCount = _emptyPollCount.AddOrUpdate(config.ChannelName, 1, (_, c) => c + 1);
                if (emptyCount >= 2 && _lastTrackCache.TryRemove(config.ChannelName, out _))
                {
                    await overlayService.SendToChannel(config.ChannelName, "NowPlayingStopped", new
                    {
                        timestamp = DateTime.UtcNow
                    });
                }
                return;
            }

            // Must be a track (not podcast/ad)
            var currentlyPlayingType = root.TryGetProperty("currently_playing_type", out var cpt)
                ? cpt.GetString() : "track";
            if (currentlyPlayingType != "track") return;

            if (!root.TryGetProperty("item", out var item)) return;

            var songName = item.GetProperty("name").GetString() ?? "";
            var durationMs = item.TryGetProperty("duration_ms", out var dur) ? dur.GetInt32() : 0;
            var progressMs = root.TryGetProperty("progress_ms", out var prog) ? prog.GetInt32() : 0;

            // Artist
            var artist = "";
            if (item.TryGetProperty("artists", out var artists) && artists.GetArrayLength() > 0)
            {
                artist = artists[0].GetProperty("name").GetString() ?? "";
            }

            // Album
            var album = "";
            var albumArtUrl = "";
            if (item.TryGetProperty("album", out var albumEl))
            {
                album = albumEl.TryGetProperty("name", out var an) ? an.GetString() ?? "" : "";
                if (albumEl.TryGetProperty("images", out var images) && images.GetArrayLength() > 0)
                {
                    albumArtUrl = images[0].TryGetProperty("url", out var imgUrl)
                        ? imgUrl.GetString() ?? ""
                        : "";
                }
            }

            var trackKey = $"{songName}|{artist}|{album}";
            var isNewTrack = !_lastTrackCache.TryGetValue(config.ChannelName, out var lastTrack) || lastTrack != trackKey;

            // Always send update for Spotify (includes progressMs for accurate progress bar)
            _lastTrackCache[config.ChannelName] = trackKey;

            if (isNewTrack)
            {
                _logger.LogDebug("🎵 Spotify now playing for {Channel}: {Song} - {Artist}", config.ChannelName, songName, artist);
            }

            await overlayService.SendToChannel(config.ChannelName, "NowPlayingUpdate", new
            {
                song = songName,
                artist,
                album,
                albumArtUrl,
                durationMs,
                progressMs,
                isPlaying = true,
                provider = "spotify",
                isNewTrack,
                timestamp = DateTime.UtcNow
            });
        }

        public override void Dispose()
        {
            _httpClient?.Dispose();
            base.Dispose();
        }
    }
}
