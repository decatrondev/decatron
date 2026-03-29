using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Decatron.Core.Helpers;
using Decatron.Data;
using Decatron.Core.Models;
using Decatron.OAuth.Attributes;
using Decatron.OAuth.Handlers;

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
        private readonly ILogger<PublicApiController> _logger;

        public PublicApiController(DecatronDbContext db, ILogger<PublicApiController> logger)
        {
            _db = db;
            _logger = logger;
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
                    Status = "running",
                    CurrentTime = duration,
                    TotalTime = duration,
                    StartedAt = DateTime.UtcNow,
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
                state.StartedAt = DateTime.UtcNow;
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
            state.PausedAt = DateTime.UtcNow;
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
    }

    // ═══════════════════════════════════════════════════════════════════
    // REQUEST DTOs
    // ═══════════════════════════════════════════════════════════════════

    public class TimerStartRequest
    {
        public int? Duration { get; set; }
    }

    public class TimerAddTimeRequest
    {
        public int Seconds { get; set; }
    }
}
