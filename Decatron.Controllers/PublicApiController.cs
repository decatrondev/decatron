using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Default.Helpers;
using Decatron.Hubs;
using Decatron.OAuth.Attributes;
using Decatron.OAuth.Handlers;
using Decatron.Services;

namespace Decatron.Controllers
{
    /// <summary>
    /// API pública para desarrolladores externos.
    /// Requiere autenticación OAuth2 Bearer token.
    /// </summary>
    [ApiController]
    [Route("api/v1")]
    [OAuthAuthorize] // Requiere token OAuth válido
    public class PublicApiController : ControllerBase
    {
        private readonly DecatronDbContext _db;
        private readonly IMessageSender _messageSender;
        private readonly GameSearchService _gameSearchService;
        private readonly TwitchApiService _twitchApiService;
        private readonly IHubContext<OverlayHub> _hubContext;
        private readonly IEventAlertsService _eventAlertsService;
        private readonly IConfiguration _configuration;
        private readonly ILogger<PublicApiController> _logger;

        public PublicApiController(
            DecatronDbContext db,
            IMessageSender messageSender,
            GameSearchService gameSearchService,
            TwitchApiService twitchApiService,
            IHubContext<OverlayHub> hubContext,
            IEventAlertsService eventAlertsService,
            IConfiguration configuration,
            ILogger<PublicApiController> logger)
        {
            _db = db;
            _messageSender = messageSender;
            _gameSearchService = gameSearchService;
            _twitchApiService = twitchApiService;
            _hubContext = hubContext;
            _eventAlertsService = eventAlertsService;
            _configuration = configuration;
            _logger = logger;
        }

        /// <summary>
        /// Usuario completo del token OAuth — a diferencia de
        /// GetChannelUsernameAsync, trae TwitchId y AccessToken (necesarios
        /// para las acciones que hablan directo con Twitch en nombre del
        /// streamer, no solo con el chat vía el bot).
        /// </summary>
        private async Task<Decatron.Core.Models.User?> GetUserAsync()
        {
            var userId = GetUserId();
            return await _db.Users.FindAsync(userId);
        }

        /// <summary>
        /// Obtiene el userId del token OAuth
        /// </summary>
        private long GetUserId()
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(userIdClaim, out var userId) ? userId : 0;
        }

        /// <summary>
        /// Obtiene el username del canal
        /// </summary>
        private async Task<string?> GetChannelUsernameAsync()
        {
            var userId = GetUserId();
            var user = await _db.Users.FindAsync(userId);
            return user?.Login;
        }

        // ═══════════════════════════════════════════════════════════════════
        // TIMER ENDPOINTS
        // ═══════════════════════════════════════════════════════════════════

        /// <summary>
        /// Obtiene el estado actual del timer
        /// </summary>
        [HttpGet("timer")]
        [RequireScope("read:timer")]
        public async Task<IActionResult> GetTimerState()
        {
            var username = await GetChannelUsernameAsync();
            if (string.IsNullOrEmpty(username))
            {
                return NotFound(new { error = "channel_not_found" });
            }

            var state = await _db.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == username);

            if (state == null)
            {
                return Ok(new
                {
                    status = "stopped",
                    currentTime = 0,
                    totalTime = 0,
                    isRunning = false,
                    isPaused = false
                });
            }

            // Calcular tiempo actual si está corriendo
            int currentTime = state.CurrentTime;
            if (state.Status == "running" && state.StartedAt.HasValue)
            {
                var totalElapsed = (DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(state.StartedAt.Value)).TotalSeconds;
                var elapsedSeconds = (int)(totalElapsed - state.ElapsedPausedTime);
                currentTime = Math.Max(0, state.TotalTime - elapsedSeconds);
            }

            return Ok(new
            {
                status = state.Status,
                currentTime = currentTime,
                totalTime = state.TotalTime,
                isRunning = state.Status == "running",
                isPaused = state.Status == "paused" || state.Status == "auto_paused",
                isVisible = state.IsVisible,
                startedAt = state.StartedAt,
                pausedAt = state.PausedAt
            });
        }

        /// <summary>
        /// Inicia el timer
        /// </summary>
        [HttpPost("timer/start")]
        [RequireScope("action:timer")]
        public async Task<IActionResult> StartTimer([FromBody] TimerStartRequest? request = null)
        {
            var username = await GetChannelUsernameAsync();
            if (string.IsNullOrEmpty(username))
            {
                return NotFound(new { error = "channel_not_found" });
            }

            var state = await _db.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == username);
            var duration = request?.Duration ?? 300; // Default 5 minutos

            if (state == null)
            {
                state = new TimerState
                {
                    ChannelName = username,
                    UserId = GetUserId(),
                    Status = "running",
                    CurrentTime = duration,
                    TotalTime = duration,
                    StartedAt = TimerDateTimeHelper.NowForDb(),
                    IsVisible = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _db.TimerStates.Add(state);
            }
            else
            {
                state.Status = "running";
                state.CurrentTime = request?.Duration ?? state.CurrentTime;
                state.TotalTime = request?.Duration ?? state.TotalTime;
                state.StartedAt = TimerDateTimeHelper.NowForDb();
                state.ElapsedPausedTime = 0;
                state.PausedAt = null;
                state.IsVisible = true;
                state.UpdatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();

            _logger.LogInformation("Timer started via API for channel {Channel}", username);

            return Ok(new { success = true, message = "Timer started" });
        }

        /// <summary>
        /// Pausa el timer
        /// </summary>
        [HttpPost("timer/pause")]
        [RequireScope("action:timer")]
        public async Task<IActionResult> PauseTimer()
        {
            var username = await GetChannelUsernameAsync();
            if (string.IsNullOrEmpty(username))
            {
                return NotFound(new { error = "channel_not_found" });
            }

            var state = await _db.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == username);

            if (state == null || state.Status != "running")
            {
                return BadRequest(new { error = "timer_not_running" });
            }

            // Calcular tiempo restante
            if (state.StartedAt.HasValue)
            {
                var totalElapsed = (DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(state.StartedAt.Value)).TotalSeconds;
                var elapsedSeconds = (int)(totalElapsed - state.ElapsedPausedTime);
                state.CurrentTime = Math.Max(0, state.TotalTime - elapsedSeconds);
            }

            state.Status = "paused";
            state.PausedAt = TimerDateTimeHelper.NowForDb();
            state.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            _logger.LogInformation("Timer paused via API for channel {Channel}", username);

            return Ok(new { success = true, message = "Timer paused" });
        }

        /// <summary>
        /// Reanuda el timer
        /// </summary>
        [HttpPost("timer/resume")]
        [RequireScope("action:timer")]
        public async Task<IActionResult> ResumeTimer()
        {
            var username = await GetChannelUsernameAsync();
            if (string.IsNullOrEmpty(username))
            {
                return NotFound(new { error = "channel_not_found" });
            }

            var state = await _db.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == username);

            if (state == null || (state.Status != "paused" && state.Status != "auto_paused"))
            {
                return BadRequest(new { error = "timer_not_paused" });
            }

            // Acumular tiempo pausado
            if (state.PausedAt.HasValue && state.StartedAt.HasValue)
            {
                var pausedDuration = (int)(DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(state.PausedAt.Value)).TotalSeconds;
                state.ElapsedPausedTime += pausedDuration;
            }

            state.Status = "running";
            state.PausedAt = null;
            state.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            _logger.LogInformation("Timer resumed via API for channel {Channel}", username);

            return Ok(new { success = true, message = "Timer resumed" });
        }

        /// <summary>
        /// Detiene el timer
        /// </summary>
        [HttpPost("timer/stop")]
        [RequireScope("action:timer")]
        public async Task<IActionResult> StopTimer()
        {
            var username = await GetChannelUsernameAsync();
            if (string.IsNullOrEmpty(username))
            {
                return NotFound(new { error = "channel_not_found" });
            }

            var state = await _db.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == username);

            if (state == null)
            {
                return Ok(new { success = true, message = "Timer already stopped" });
            }

            state.Status = "stopped";
            state.CurrentTime = 0;
            state.StartedAt = null;
            state.PausedAt = null;
            state.ElapsedPausedTime = 0;
            state.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            _logger.LogInformation("Timer stopped via API for channel {Channel}", username);

            return Ok(new { success = true, message = "Timer stopped" });
        }

        /// <summary>
        /// Agrega tiempo al timer
        /// </summary>
        [HttpPost("timer/add")]
        [RequireScope("action:timer")]
        public async Task<IActionResult> AddTime([FromBody] TimerAddTimeRequest request)
        {
            var username = await GetChannelUsernameAsync();
            if (string.IsNullOrEmpty(username))
            {
                return NotFound(new { error = "channel_not_found" });
            }

            var state = await _db.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == username);

            if (state == null)
            {
                return BadRequest(new { error = "timer_not_found" });
            }

            state.TotalTime += request.Seconds;
            state.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            _logger.LogInformation("Added {Seconds}s to timer via API for channel {Channel}",
                request.Seconds, username);

            return Ok(new { success = true, message = $"Added {request.Seconds} seconds", newTotalTime = state.TotalTime });
        }

        // ═══════════════════════════════════════════════════════════════════
        // CHAT ENDPOINTS
        // ═══════════════════════════════════════════════════════════════════

        /// <summary>
        /// Envía un mensaje al chat de Twitch del canal del usuario, usando
        /// la misma conexión que ya usa el bot para sus propios comandos
        /// (IMessageSender/MessageSenderRouter) — no abre ninguna conexión
        /// nueva ni toca la lógica existente del bot.
        /// </summary>
        [HttpPost("chat/send")]
        [RequireScope("action:chat")]
        public async Task<IActionResult> SendChatMessage([FromBody] SendChatMessageRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(new { error = "message_required" });
            }

            var username = await GetChannelUsernameAsync();
            if (string.IsNullOrEmpty(username))
            {
                return NotFound(new { error = "channel_not_found" });
            }

            await _messageSender.SendMessageAsync(username, request.Message);

            _logger.LogInformation("Chat message sent via API for channel {Channel}", username);

            return Ok(new { success = true, message = "Message sent" });
        }

        // ═══════════════════════════════════════════════════════════════════
        // TWITCH CHANNEL ENDPOINTS (categoría, título)
        // ═══════════════════════════════════════════════════════════════════

        /// <summary>
        /// Busca categorías/juegos de Twitch por nombre — misma búsqueda
        /// híbrida (alias → cache → API Twitch) que ya usan !game y los
        /// micro-comandos del dashboard. Devuelve coincidencias exactas de
        /// Twitch, no adivina: el llamador elige una de la lista.
        /// </summary>
        [HttpGet("twitch/games/search")]
        [RequireScope("read:games")]
        public async Task<IActionResult> SearchGames([FromQuery] string query)
        {
            var results = await _gameSearchService.SearchGamesAsync(query);

            return Ok(new
            {
                success = true,
                games = results.Select(g => new { id = g.Id, name = g.Name, box_art_url = g.BoxArtUrl })
            });
        }

        /// <summary>
        /// Cambia la categoría/juego del canal — usa el mismo access token de
        /// Twitch que el bot ya tiene guardado del streamer (el que se usa
        /// para !game), no pide ni guarda ningún permiso nuevo.
        /// </summary>
        [HttpPost("twitch/category")]
        [RequireScope("action:category")]
        public async Task<IActionResult> SetCategory([FromBody] SetCategoryRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.GameId) && string.IsNullOrWhiteSpace(request.GameName))
            {
                return BadRequest(new { error = "game_id_or_game_name_required" });
            }

            var user = await GetUserAsync();
            if (user?.TwitchId == null || string.IsNullOrEmpty(user.AccessToken))
            {
                return NotFound(new { error = "channel_not_found" });
            }

            string realCategoryName;

            if (!string.IsNullOrWhiteSpace(request.GameId))
            {
                // game_id exacto (el camino normal — viene de haber elegido
                // un resultado de /twitch/games/search) — se aplica directo,
                // sin pasar por la búsqueda difusa de UpdateCategoryAsync,
                // que podría confundir juegos con nombres parecidos.
                using var httpClient = new HttpClient();
                Utils.ConfigureTwitchApiHeaders(httpClient, _configuration, user.AccessToken);
                var content = new StringContent(
                    System.Text.Json.JsonSerializer.Serialize(new { game_id = request.GameId }),
                    System.Text.Encoding.UTF8, "application/json");
                var response = await httpClient.PatchAsync(
                    $"https://api.twitch.tv/helix/channels?broadcaster_id={user.TwitchId}", content);

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Twitch rejected category update ({Status}): {Body}", response.StatusCode, errorBody);
                    return BadRequest(new { error = "twitch_rejected_update" });
                }

                realCategoryName = request.GameName ?? request.GameId;
            }
            else
            {
                // Sin game_id — cae a la búsqueda difusa por nombre (mismo
                // camino que !game <nombre> en el chat).
                var resolved = await GameUtils.UpdateCategoryAsync(_configuration, user.TwitchId, request.GameName!, user.AccessToken, _logger);
                if (resolved == null)
                {
                    return BadRequest(new { error = "category_not_found_or_update_failed" });
                }

                realCategoryName = resolved;
            }

            _logger.LogInformation("Category changed via API for channel {Channel}: {Category}", user.Login, realCategoryName);

            return Ok(new { success = true, message = "Category updated", category = realCategoryName });
        }

        /// <summary>
        /// Cambia el título del canal — mismo access token guardado que usa !title.
        /// </summary>
        [HttpPost("twitch/title")]
        [RequireScope("action:title")]
        public async Task<IActionResult> SetTitle([FromBody] SetTitleRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Title))
            {
                return BadRequest(new { error = "title_required" });
            }

            var user = await GetUserAsync();
            if (user?.TwitchId == null || string.IsNullOrEmpty(user.AccessToken))
            {
                return NotFound(new { error = "channel_not_found" });
            }

            var success = await TitleUtils.UpdateTitleAsync(_configuration, user.TwitchId, request.Title, user.AccessToken);
            if (!success)
            {
                return BadRequest(new { error = "update_failed" });
            }

            _logger.LogInformation("Title changed via API for channel {Channel}", user.Login);

            return Ok(new { success = true, message = "Title updated" });
        }

        /// <summary>
        /// Crea un marcador en el stream (VOD) — mismo access token guardado
        /// que categoría/título. Twitch devuelve 404 acá cuando el canal no
        /// está en vivo (los marcadores solo existen sobre un VOD que se está
        /// grabando en ese momento), así que ese caso se distingue del resto
        /// de errores para que el llamador pueda mostrar un mensaje claro.
        /// </summary>
        [HttpPost("twitch/marker")]
        [RequireScope("action:marker")]
        public async Task<IActionResult> CreateMarker([FromBody] CreateMarkerRequest request)
        {
            var user = await GetUserAsync();
            if (user?.TwitchId == null || string.IsNullOrEmpty(user.AccessToken))
            {
                return NotFound(new { error = "channel_not_found" });
            }

            using var httpClient = new HttpClient();
            Utils.ConfigureTwitchApiHeaders(httpClient, _configuration, user.AccessToken);
            var content = new StringContent(
                System.Text.Json.JsonSerializer.Serialize(new { user_id = user.TwitchId, description = request.Description }),
                System.Text.Encoding.UTF8, "application/json");
            var response = await httpClient.PostAsync("https://api.twitch.tv/helix/streams/markers", content);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Twitch rejected stream marker ({Status}): {Body}", response.StatusCode, errorBody);

                if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    return NotFound(new { error = "stream_not_live" });
                }

                return BadRequest(new { error = "twitch_rejected_marker" });
            }

            _logger.LogInformation("Stream marker created via API for channel {Channel}", user.Login);

            return Ok(new { success = true, message = "Marker created" });
        }

        /// <summary>
        /// Info en vivo del canal — categoría, título, espectadores (vía app
        /// token, igual que el resto del bot lee esto) y último seguidor (vía
        /// el access token del streamer, que ya tiene el scope
        /// moderator:read:followers desde que se conectó el bot).
        /// </summary>
        [HttpGet("twitch/live-info")]
        [RequireScope("read:stream")]
        public async Task<IActionResult> GetLiveInfo()
        {
            var user = await GetUserAsync();
            if (user?.TwitchId == null)
            {
                return NotFound(new { error = "channel_not_found" });
            }

            var stream = await _twitchApiService.GetStreamAsync(user.TwitchId);
            var lastFollower = string.IsNullOrEmpty(user.AccessToken)
                ? null
                : await GetLastFollowerAsync(user.TwitchId, user.AccessToken);

            return Ok(new
            {
                success = true,
                isLive = stream != null,
                category = stream?.game_name,
                title = stream?.title,
                viewers = stream?.viewer_count,
                lastFollower
            });
        }

        private async Task<string?> GetLastFollowerAsync(string broadcasterId, string accessToken)
        {
            try
            {
                using var httpClient = new HttpClient();
                Utils.ConfigureTwitchApiHeaders(httpClient, _configuration, accessToken);

                var response = await httpClient.GetAsync(
                    $"https://api.twitch.tv/helix/channels/followers?broadcaster_id={broadcasterId}&first=1");
                if (!response.IsSuccessStatusCode) return null;

                using var doc = System.Text.Json.JsonDocument.Parse(await response.Content.ReadAsStringAsync());
                var data = doc.RootElement.GetProperty("data");
                return data.GetArrayLength() > 0 ? data[0].GetProperty("user_name").GetString() : null;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo obtener el último seguidor para {BroadcasterId}", broadcasterId);
                return null;
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // SOUND ALERTS ENDPOINTS
        // ═══════════════════════════════════════════════════════════════════

        /// <summary>
        /// Lista los Sound Alerts ya configurados por el usuario en el
        /// dashboard (Sound Alerts → mapeos de recompensa→archivo) — para que
        /// el llamador pueda elegir cuál disparar.
        /// </summary>
        [HttpGet("sounds")]
        [RequireScope("read:sounds")]
        public async Task<IActionResult> GetSounds()
        {
            var userId = GetUserId();

            var mappings = await _db.SoundAlertRewardFiles
                .Where(m => m.UserId == userId && m.Enabled)
                .OrderByDescending(m => m.CreatedAt)
                .Select(m => new { id = m.RewardId, name = m.RewardTitle })
                .ToListAsync();

            return Ok(new { success = true, sounds = mappings });
        }

        /// <summary>
        /// Dispara un Sound Alert ya configurado — mismo mecanismo que el
        /// botón "Probar" del dashboard (SoundAlertsController.SendTestAlert),
        /// pero eligiendo el mapeo por RewardId en vez de tomar "el primero
        /// disponible".
        /// </summary>
        [HttpPost("sounds/play")]
        [RequireScope("action:sounds")]
        public async Task<IActionResult> PlaySound([FromBody] PlaySoundRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.SoundId))
            {
                return BadRequest(new { error = "sound_id_required" });
            }

            var userId = GetUserId();
            var username = await GetChannelUsernameAsync();
            if (string.IsNullOrEmpty(username))
            {
                return NotFound(new { error = "channel_not_found" });
            }

            var mapping = await _db.SoundAlertRewardFiles
                .Include(m => m.MediaFile)
                .FirstOrDefaultAsync(m => m.UserId == userId && m.RewardId == request.SoundId && m.Enabled);

            if (mapping == null)
            {
                return NotFound(new { error = "sound_not_found" });
            }

            var config = await _db.SoundAlertConfigs.FirstOrDefaultAsync(c => c.UserId == userId);

            var fileUrl = MediaPathHelpers.ToPublicPath(mapping.MediaFile?.FilePath ?? mapping.SystemFilePath ?? "");
            var fileType = mapping.MediaFile?.FileType ?? MediaPathHelpers.InferSystemFileType(mapping.SystemFilePath ?? "");
            string? imageUrl = mapping.ShowImage
                ? (mapping.ImageSource == "url" ? mapping.ImageUrl : MediaPathHelpers.ToPublicPath(mapping.ImagePath ?? ""))
                : null;

            var alertData = new
            {
                type = "soundalert",
                redeemer = "Flowdeck",
                reward = mapping.RewardTitle,
                fileUrl,
                imageUrl,
                showImage = mapping.ShowImage,
                fileType,
                volume = mapping.Volume,
                duration = config?.Duration ?? 10,
                textLines = config?.TextLines ?? "[]",
                styles = config?.Styles ?? "{}",
                layout = config?.Layout ?? "{}",
                animation = new { type = config?.AnimationType ?? "fade", speed = config?.AnimationSpeed ?? "normal" },
                textOutline = new
                {
                    enabled = config?.TextOutlineEnabled ?? false,
                    color = config?.TextOutlineColor ?? "#000000",
                    width = config?.TextOutlineWidth ?? 2
                }
            };

            await _hubContext.Clients.Group($"overlay_{username}").SendAsync("ShowSoundAlert", alertData);

            _logger.LogInformation("Sound alert '{RewardTitle}' triggered via API for channel {Channel}", mapping.RewardTitle, username);

            return Ok(new { success = true, message = "Sound alert triggered" });
        }

        // ═══════════════════════════════════════════════════════════════════
        // EVENT ALERTS ENDPOINTS
        // ═══════════════════════════════════════════════════════════════════

        /// <summary>
        /// Dispara una alerta de evento (follow/subs/bits/giftSubs/raids/resubs/
        /// hypeTrain) con la configuración que el usuario ya tiene armada en el
        /// dashboard — mismo motor que usan los eventos reales de Twitch
        /// (EventAlertsService.TriggerAlertAsync), no uno nuevo.
        /// </summary>
        [HttpPost("alerts/trigger")]
        [RequireScope("action:alerts")]
        public async Task<IActionResult> TriggerAlert([FromBody] TriggerAlertRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.EventType))
            {
                return BadRequest(new { error = "event_type_required" });
            }

            var username = await GetChannelUsernameAsync();
            if (string.IsNullOrEmpty(username))
            {
                return NotFound(new { error = "channel_not_found" });
            }

            await _eventAlertsService.TriggerAlertAsync(
                username,
                request.EventType,
                string.IsNullOrWhiteSpace(request.Username) ? "Flowdeck" : request.Username,
                request.Message,
                request.Amount ?? 0);

            _logger.LogInformation("Event alert '{EventType}' triggered via API for channel {Channel}", request.EventType, username);

            return Ok(new { success = true, message = "Alert triggered" });
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // REQUEST DTOs
    // ═══════════════════════════════════════════════════════════════════

    public class SendChatMessageRequest
    {
        public string Message { get; set; } = "";
    }

    public class SetCategoryRequest
    {
        public string? GameId { get; set; }
        public string? GameName { get; set; }
    }

    public class SetTitleRequest
    {
        public string Title { get; set; } = "";
    }

    public class CreateMarkerRequest
    {
        public string? Description { get; set; }
    }

    public class PlaySoundRequest
    {
        public string SoundId { get; set; } = "";
    }

    public class TriggerAlertRequest
    {
        public string EventType { get; set; } = "";
        public string? Username { get; set; }
        public string? Message { get; set; }
        public int? Amount { get; set; }
    }

    public class TimerStartRequest
    {
        public int? Duration { get; set; }
    }

    public class TimerAddTimeRequest
    {
        public int Seconds { get; set; }
    }
}
