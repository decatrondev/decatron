using Decatron.Core.Helpers;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
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
        private readonly Decatron.Services.Tenancy.TenantTaskRunner _tenants;
        private readonly ConcurrentDictionary<string, string> _lastTrackCache = new();
        // Cache: channelName -> last poll time (for per-user interval)
        private readonly ConcurrentDictionary<string, DateTime> _lastPollTime = new();
        // Cache: channelName -> consecutive empty poll count
        private readonly ConcurrentDictionary<string, int> _emptyPollCount = new();
        // Cuándo se puede volver a llamar a Spotify (429, 403 y fallos temporales)
        private readonly SpotifyPollGuard _spotifyGuard = new();
        private readonly IMemoryCache _cache;

        private static readonly TimeSpan LiveTrackTtl = TimeSpan.FromSeconds(15);
        private static readonly TimeSpan TransientBase = TimeSpan.FromSeconds(15);
        private static readonly TimeSpan TransientMax = TimeSpan.FromMinutes(5);
        private static readonly TimeSpan ForbiddenBase = TimeSpan.FromMinutes(1);
        private static readonly TimeSpan ForbiddenMax = TimeSpan.FromMinutes(5);
        // Fecha de autorización vista en cada canal: si cambia, la persona reconectó
        private readonly ConcurrentDictionary<string, DateTime?> _authorizedSeen = new();

        public NowPlayingBackgroundService(
            IServiceProvider serviceProvider,
            ILogger<NowPlayingBackgroundService> logger,
            IConfiguration configuration,
            Decatron.Services.Tenancy.TenantTaskRunner tenants,
            IMemoryCache cache)
        {
            _cache = cache;
            _tenants = tenants;
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
                    await _tenants.ForEachTenantAsync("nowplaying", _ => PollAllActiveChannels(stoppingToken), stoppingToken, module: "module.ov_now_playing");
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

            var tenantShadow = scope.ServiceProvider.GetService<Decatron.Services.Tenancy.TenantShadow>();
            foreach (var config in configs)
            {
                if (stoppingToken.IsCancellationRequested) break;
                using var tenantScope = tenantShadow?.EnterUser("Bg.NowPlaying", config.UserId);

                var isSpotify = config.Provider == "spotify";

                // Spotify solo se consulta con el overlay de Now Playing abierto, no con cualquier overlay del canal
                var hasViewers = isSpotify
                    ? Hubs.OverlayHub.CountOverlays(config.ChannelName, "now_playing") > 0
                    : Hubs.OverlayHub.HasActiveClients(config.ChannelName);
                if (!hasViewers)
                {
                    continue; // No overlay viewers — skip to save API calls
                }

                // Reconectó: una espera por el token viejo ya no aplica
                if (isSpotify && _authorizedSeen.TryGetValue(config.ChannelName, out var seen) && seen != config.SpotifyAuthorizedAt)
                {
                    _spotifyGuard.ForgetChannel(config.ChannelName);
                }
                _authorizedSeen[config.ChannelName] = config.SpotifyAuthorizedAt;

                // Autorización vencida: no se insiste hasta reconectar. En pausa: se espera lo que corresponde.
                if (isSpotify && (config.SpotifyStatus == SpotifyConnectionStatus.ReauthRequired || !_spotifyGuard.CanCall(config.ChannelName, DateTime.UtcNow)))
                {
                    continue;
                }

                // Cada 3 s para todos (antes dependía del tier y en la práctica quedaba en 10-15 s)
                if (_lastPollTime.TryGetValue(config.ChannelName, out var lastPoll)
                    && (DateTime.UtcNow - lastPoll).TotalSeconds < NowPlayingService.PollingIntervalSeconds)
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
                    else if (config.Provider == "lastfm" && !string.IsNullOrWhiteSpace(config.LastfmUsername))
                    {
                        await PollChannel(config.ChannelName, config.LastfmUsername, overlayService);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Error polling now playing for channel {Channel}", config.ChannelName);
                    if (isSpotify)
                    {
                        var wait = _spotifyGuard.RecordFailure(config.ChannelName, DateTime.UtcNow, TransientBase, TransientMax);
                        _logger.LogWarning("Spotify: fallo al consultar {Channel} ({Error}). Espera {Seconds}s", config.ChannelName, ex.GetType().Name, wait.TotalSeconds);
                    }
                }
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

            // Create a cache key to detect changes (con el proveedor: al cambiar de fuente la misma canción se vuelve a avisar)
            var trackKey = $"lastfm|{NowPlayingService.TrackIdentity(songName, artist, album)}";

            // Check if track changed
            var isNewTrack = !_lastTrackCache.TryGetValue(channelName, out var lastTrack) || lastTrack != trackKey;

            if (isNewTrack)
            {
                _lastTrackCache[channelName] = trackKey;
                _logger.LogDebug("🎵 Now playing for {Channel}: {Song} - {Artist}", channelName, songName, artist);
                // Last.fm no da la posición: se cuenta desde acá, para que recargar el overlay no vuelva a 0:00
                var startedAt = DateTime.UtcNow;
                _cache.Set(NowPlayingService.LastfmStartCacheKey(channelName), new NowPlayingService.LastfmTrackStart(NowPlayingService.TrackIdentity(songName, artist, album), startedAt), NowPlayingService.LastfmStartTtl);

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
                    timestamp = startedAt
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
                accessToken = await RefreshToken(config, overlayService, nowPlayingService);
                if (accessToken == null) return;
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
                await MarkHealthy(config, nowPlayingService);
                var emptyCount = _emptyPollCount.AddOrUpdate(config.ChannelName, 1, (_, c) => c + 1);
                // Send stop after 2 consecutive empty polls
                if (emptyCount >= 2 && _lastTrackCache.TryRemove(config.ChannelName, out _))
                {
                    await SendStopped(config.ChannelName, overlayService);
                }
                return;
            }
            // Reset empty counter on successful response
            _emptyPollCount.TryRemove(config.ChannelName, out _);

            // 401 = token expired, try refresh
            if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            {
                accessToken = await RefreshToken(config, overlayService, nowPlayingService);
                if (accessToken == null) return;

                // Retry with new token
                request = new HttpRequestMessage(HttpMethod.Get, "https://api.spotify.com/v1/me/player/currently-playing");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                response = await _httpClient.SendAsync(request);
            }

            // 403 = user not registered in Spotify dashboard or app blocked
            if (response.StatusCode == System.Net.HttpStatusCode.Forbidden)
            {
                var body = await response.Content.ReadAsStringAsync();
                var wait = _spotifyGuard.RecordFailure(config.ChannelName, DateTime.UtcNow, ForbiddenBase, ForbiddenMax);
                _logger.LogWarning("Spotify 403 para {Channel}: {Body}. Espera {Seconds}s", config.ChannelName, Shorten(body), wait.TotalSeconds);
                await nowPlayingService.SetSpotifyStatus(config.UserId, SpotifyConnectionStatus.Forbidden);
                return;
            }

            if (response.StatusCode == (System.Net.HttpStatusCode)429)
            {
                // El límite es de la app: se detienen todos los canales y se espera lo que pida Spotify, sin tope
                var body = await response.Content.ReadAsStringAsync();
                var retryAfter = SpotifyTokenResponse.ParseRetryAfter(response.Headers.RetryAfter, DateTimeOffset.UtcNow);
                var wait = _spotifyGuard.PauseApp(retryAfter, DateTime.UtcNow);
                _logger.LogWarning("Spotify 429 en {Channel}: {Body}. Todo Spotify en pausa {Seconds}s", config.ChannelName, Shorten(body), wait.TotalSeconds);
                return;
            }

            if (!response.IsSuccessStatusCode)
            {
                var wait = _spotifyGuard.RecordFailure(config.ChannelName, DateTime.UtcNow, TransientBase, TransientMax);
                _logger.LogWarning("Spotify API error {StatusCode} para {Channel}. Espera {Seconds}s", response.StatusCode, config.ChannelName, wait.TotalSeconds);
                return;
            }

            await MarkHealthy(config, nowPlayingService);

            var json = await response.Content.ReadAsStringAsync();
            if (string.IsNullOrWhiteSpace(json)) return;

            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            // En pausa Spotify sigue dando la canción: el overlay decide si se queda quieto o se oculta
            var isPlaying = root.TryGetProperty("is_playing", out var ip) && ip.ValueKind == JsonValueKind.True;

            // Must be a track (not podcast/ad). Spotify manda item y progress_ms en null en anuncios y sesiones privadas
            var currentlyPlayingType = root.TryGetProperty("currently_playing_type", out var cpt)
                ? cpt.GetString() : "track";
            if (currentlyPlayingType != "track" || !root.TryGetProperty("item", out var item) || item.ValueKind != JsonValueKind.Object)
            {
                if (!isPlaying)
                {
                    var emptyCount = _emptyPollCount.AddOrUpdate(config.ChannelName, 1, (_, c) => c + 1);
                    if (emptyCount >= 2 && _lastTrackCache.TryRemove(config.ChannelName, out _))
                    {
                        await SendStopped(config.ChannelName, overlayService);
                    }
                }
                return;
            }

            var songName = item.GetProperty("name").GetString() ?? "";
            var durationMs = item.TryGetProperty("duration_ms", out var dur) ? dur.GetInt32() : 0;
            var progressMs = root.TryGetProperty("progress_ms", out var prog) && prog.ValueKind == JsonValueKind.Number ? prog.GetInt32() : 0;

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
                if (albumEl.TryGetProperty("images", out var images) && images.ValueKind == JsonValueKind.Array && images.GetArrayLength() > 0)
                {
                    albumArtUrl = images[0].TryGetProperty("url", out var imgUrl)
                        ? imgUrl.GetString() ?? ""
                        : "";
                }
            }

            var trackKey = $"spotify|{NowPlayingService.TrackIdentity(songName, artist, album)}";
            var isNewTrack = !_lastTrackCache.TryGetValue(config.ChannelName, out var lastTrack) || lastTrack != trackKey;

            // Always send update for Spotify (includes progressMs for accurate progress bar)
            _lastTrackCache[config.ChannelName] = trackKey;

            if (isNewTrack)
            {
                _logger.LogDebug("🎵 Spotify now playing for {Channel}: {Song} - {Artist}", config.ChannelName, songName, artist);
            }

            var update = new
            {
                song = songName,
                artist,
                album,
                albumArtUrl,
                durationMs,
                progressMs,
                isPlaying,
                provider = "spotify",
                isNewTrack,
                timestamp = DateTime.UtcNow
            };
            _cache.Set(NowPlayingService.LiveTrackCacheKey(config.ChannelName), (object)update, LiveTrackTtl);
            await overlayService.SendToChannel(config.ChannelName, "NowPlayingUpdate", update);
        }

        /// <summary>Renueva el token y aplica lo que corresponda si falla. Devuelve null si no hay token nuevo.</summary>
        private async Task<string?> RefreshToken(
            Decatron.Core.Models.NowPlayingConfig config,
            OverlayNotificationService overlayService,
            NowPlayingService nowPlayingService)
        {
            var result = await nowPlayingService.RefreshSpotifyToken(
                config.UserId, config.SpotifyRefreshToken!, _httpClient, _configuration);

            switch (result.Outcome)
            {
                case SpotifyRefreshOutcome.Ok:
                    return result.AccessToken;

                case SpotifyRefreshOutcome.ReauthRequired:
                    // Una sola línea por cuenta: a partir de acá el canal no se consulta hasta que reconecte
                    _logger.LogWarning("Spotify pide autorizar de nuevo a {Channel} ({Error}). Sin más intentos hasta que reconecte", config.ChannelName, result.Error);
                    if (_lastTrackCache.TryRemove(config.ChannelName, out _))
                        await SendStopped(config.ChannelName, overlayService);
                    break;

                case SpotifyRefreshOutcome.RateLimited:
                    var pause = _spotifyGuard.PauseApp(result.RetryAfter, DateTime.UtcNow);
                    _logger.LogWarning("Spotify 429 al renovar el token de {Channel}. Todo Spotify en pausa {Seconds}s", config.ChannelName, pause.TotalSeconds);
                    break;

                default:
                    var wait = _spotifyGuard.RecordFailure(config.ChannelName, DateTime.UtcNow, TransientBase, TransientMax);
                    _logger.LogWarning("Spotify: no se pudo renovar el token de {Channel} ({Error}). Espera {Seconds}s", config.ChannelName, result.Error, wait.TotalSeconds);
                    break;
            }
            return null;
        }

        /// <summary>Spotify respondió bien: se olvidan los fallos y, si estaba rechazada, la cuenta vuelve a «ok».</summary>
        private async Task MarkHealthy(Decatron.Core.Models.NowPlayingConfig config, NowPlayingService nowPlayingService)
        {
            _spotifyGuard.RecordSuccess(config.ChannelName);
            if (config.SpotifyStatus != SpotifyConnectionStatus.Ok)
                await nowPlayingService.SetSpotifyStatus(config.UserId, SpotifyConnectionStatus.Ok);
        }

        private Task SendStopped(string channelName, OverlayNotificationService overlayService)
        {
            _cache.Remove(NowPlayingService.LiveTrackCacheKey(channelName));
            return overlayService.SendToChannel(channelName, "NowPlayingStopped", new { timestamp = DateTime.UtcNow });
        }

        /// <summary>El cuerpo de un error de Spotify, recortado para el log (nunca lleva tokens).</summary>
        private static string Shorten(string body) => body.Length <= 200 ? body : body[..200];

        public override void Dispose()
        {
            _httpClient?.Dispose();
            base.Dispose();
        }
    }
}
