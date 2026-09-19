using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text.Json;
using Decatron.Attributes;
using Decatron.Core.Interfaces;
using Decatron.Core.Models.LiveTranslation;
using Decatron.Data;
using Decatron.Services.LiveTranslation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    /// <summary>
    /// Traducción en vivo (doblaje por espectador). Plan: .dev/plans/REALTIME_TRANSLATION_PLAN.md
    ///
    /// Dos públicos: el streamer (config, estado, historial) y la extensión del espectador
    /// (estado público del canal, anónimo). La app de escritorio no pasa por aquí: se
    /// vincula en <see cref="DesktopController"/> y manda el audio por el canal
    /// <c>translation</c> del WebSocket de escritorio (TranslationDesktopChannel).
    /// </summary>
    [ApiController]
    [Route("api/live-translation")]
    public class LiveTranslationController : ControllerBase
    {
        private readonly DecatronDbContext _db;
        private readonly LiveTranslationSessionManager _mgr;
        private readonly ITtsCreditService _credits;
        private readonly ILogger<LiveTranslationController> _logger;

        public LiveTranslationController(
            DecatronDbContext db,
            LiveTranslationSessionManager mgr,
            ITtsCreditService credits,
            ILogger<LiveTranslationController> logger)
        {
            _db = db; _mgr = mgr; _credits = credits; _logger = logger;
        }

        // ─────────────────────────────────────────────────────────────────────
        // Público (extensión del espectador)
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>¿Este canal ofrece traducción y está traduciendo ahora mismo?</summary>
        [HttpGet("public/{login}")]
        [AllowAnonymous]
        [EnableRateLimiting("live-translation-public")]
        public async Task<IActionResult> GetPublic(string login)
        {
            login = (login ?? "").Trim().ToLowerInvariant();
            if (login.Length is 0 or > 40) return BadRequest();

            var row = await (
                from u in _db.Users.AsNoTracking()
                join s in _db.LiveTranslationSettings.AsNoTracking() on u.Id equals s.UserId
                where u.Login.ToLower() == login && s.Enabled
                select new { u.Id, s.SourceLanguage, s.TargetLanguages, s.BackgroundVolume }
            ).FirstOrDefaultAsync();

            if (row == null)
                return Ok(new { enabled = false, live = false, login });

            var status = _mgr.GetStatus(row.Id);
            return Ok(new
            {
                enabled = true,
                live = status != null,
                login,
                source = row.SourceLanguage,
                languages = row.TargetLanguages.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
                backgroundVolume = row.BackgroundVolume,
                startedAt = status?.StartedAt,
            });
        }

        /// <summary>Catálogo de voces por motor, para el dashboard.</summary>
        [HttpGet("voices")]
        [Authorize]
        public IActionResult GetVoices() => Ok(new
        {
            configured = _mgr.IsConfigured,
            engines = _mgr.Engines.Select(e => new
            {
                name = e.Name,
                configured = e.IsConfigured,
                supportsCloning = e.Name == "fish",
                voices = e.Voices,
            }),
            languages = LiveTranslator.SupportedLanguages,
        });

        // ─────────────────────────────────────────────────────────────────────
        // Streamer (dashboard)
        // ─────────────────────────────────────────────────────────────────────

        public record SettingsDto(
            bool Enabled,
            [MaxLength(10)] string SourceLanguage,
            List<string> TargetLanguages,
            [MaxLength(20)] string VoiceEngine,
            Dictionary<string, string>? Voices,
            bool AnnounceInChat,
            [MaxLength(400)] string? AnnounceMessage,
            [Range(0, 100)] int BackgroundVolume);

        [HttpGet("settings")]
        [Authorize]
        [RequirePermission("settings")]
        public async Task<IActionResult> GetSettings()
        {
            var userId = GetChannelOwnerId();
            var s = await _db.LiveTranslationSettings.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId)
                    ?? new LiveTranslationSettings { UserId = userId };
            return Ok(ToDto(s));
        }

        [HttpPut("settings")]
        [Authorize]
        [RequirePermission("settings", "control_total")]
        public async Task<IActionResult> UpdateSettings([FromBody] SettingsDto dto)
        {
            var userId = GetChannelOwnerId();
            var maxLangs = _mgr.Options.MaxLanguagesPerChannel;

            var source = (dto.SourceLanguage ?? "es").Trim().ToLowerInvariant();
            var targets = (dto.TargetLanguages ?? new()).Select(l => l.Trim().ToLowerInvariant())
                .Where(l => l.Length > 0 && l != source && LiveTranslator.SupportedLanguages.Contains(l))
                .Distinct().Take(maxLangs).ToList();
            if (dto.Enabled && targets.Count == 0)
                return BadRequest(new { success = false, message = "Elige al menos un idioma destino" });

            var engineName = _mgr.Engines.Any(e => e.Name == dto.VoiceEngine) ? dto.VoiceEngine : "deepgram";
            var engine = _mgr.ResolveEngine(engineName);
            var voices = new Dictionary<string, string>();
            foreach (var lang in targets)
            {
                if (dto.Voices != null && dto.Voices.TryGetValue(lang, out var v) && !string.IsNullOrWhiteSpace(v))
                {
                    // Para motores con catálogo la voz tiene que existir; para Fish es un reference_id libre.
                    if (engine.Voices.Count == 0 || engine.Voices.Any(x => x.Id == v))
                        voices[lang] = v.Trim();
                }
            }

            var s = await _db.LiveTranslationSettings.FirstOrDefaultAsync(x => x.UserId == userId);
            if (s == null)
            {
                s = new LiveTranslationSettings { UserId = userId };
                _db.LiveTranslationSettings.Add(s);
            }
            s.Enabled = dto.Enabled;
            s.SourceLanguage = source;
            s.TargetLanguages = string.Join(",", targets);
            s.VoiceEngine = engineName;
            s.VoicesJson = JsonSerializer.Serialize(voices);
            s.AnnounceInChat = dto.AnnounceInChat;
            s.AnnounceMessage = string.IsNullOrWhiteSpace(dto.AnnounceMessage) ? null : dto.AnnounceMessage.Trim();
            s.BackgroundVolume = Math.Clamp(dto.BackgroundVolume, 0, 100);
            s.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            // Si se apaga con la app conectada, se corta la sesión: la app verá el motivo.
            if (!s.Enabled && _mgr.IsActive(userId))
                await _mgr.StopAsync(userId, "stopped_by_user");

            return Ok(ToDto(s));
        }

        /// <summary>Estado en vivo de la sesión actual (si hay) + saldo de créditos.</summary>
        [HttpGet("status")]
        [Authorize]
        [RequirePermission("settings")]
        public async Task<IActionResult> GetStatus()
        {
            var userId = GetChannelOwnerId();
            var balance = await _credits.GetBalanceAsync(userId);
            return Ok(new
            {
                configured = _mgr.IsConfigured,
                session = _mgr.GetStatus(userId),
                credits = new { balance.TotalAvailable, balance.IsUnlimited, balance.Tier },
            });
        }

        /// <summary>Corta la sesión en curso desde el dashboard.</summary>
        [HttpPost("stop")]
        [Authorize]
        [RequirePermission("settings", "control_total")]
        public async Task<IActionResult> Stop()
        {
            await _mgr.StopAsync(GetChannelOwnerId(), "stopped_by_user");
            return Ok(new { success = true });
        }

        [HttpGet("sessions")]
        [Authorize]
        [RequirePermission("settings")]
        public async Task<IActionResult> GetSessions([FromQuery] int limit = 30)
        {
            var userId = GetChannelOwnerId();
            var rows = await _db.LiveTranslationSessions.AsNoTracking()
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.StartedAt)
                .Take(Math.Clamp(limit, 1, 100))
                .ToListAsync();
            return Ok(rows.Select(ToDto));
        }

        // ─────────────────────────────────────────────────────────────────────
        // Admin
        // ─────────────────────────────────────────────────────────────────────

        [HttpGet("admin/active")]
        [Authorize]
        public IActionResult AdminActive()
        {
            if (!IsAdmin()) return Forbid();
            return Ok(new { configured = _mgr.IsConfigured, sessions = _mgr.GetAllStatuses() });
        }

        [HttpPost("admin/stop/{userId:long}")]
        [Authorize]
        public async Task<IActionResult> AdminStop(long userId)
        {
            if (!IsAdmin()) return Forbid();
            await _mgr.StopAsync(userId, "admin");
            return Ok(new { success = true });
        }

        [HttpGet("admin/sessions")]
        [Authorize]
        public async Task<IActionResult> AdminSessions([FromQuery] int days = 30)
        {
            if (!IsAdmin()) return Forbid();
            var since = DateTime.UtcNow.AddDays(-Math.Clamp(days, 1, 365));
            var rows = await (
                from s in _db.LiveTranslationSessions.AsNoTracking()
                join u in _db.Users.AsNoTracking() on s.UserId equals u.Id
                where s.StartedAt >= since
                orderby s.StartedAt descending
                select new { s, u.Login }
            ).Take(500).ToListAsync();
            return Ok(rows.Select(r => new
            {
                r.Login,
                session = ToDto(r.s),
            }));
        }

        // ─────────────────────────────────────────────────────────────────────

        private static object ToDto(LiveTranslationSettings s)
        {
            Dictionary<string, string> voices;
            try { voices = JsonSerializer.Deserialize<Dictionary<string, string>>(s.VoicesJson ?? "{}") ?? new(); }
            catch { voices = new(); }
            return new
            {
                s.Enabled,
                s.SourceLanguage,
                TargetLanguages = s.TargetLanguageList,
                s.VoiceEngine,
                Voices = voices,
                s.AnnounceInChat,
                s.AnnounceMessage,
                s.BackgroundVolume,
                s.UpdatedAt,
            };
        }

        private static object ToDto(LiveTranslationSession s)
        {
            Dictionary<string, long> chars;
            try { chars = JsonSerializer.Deserialize<Dictionary<string, long>>(s.CharsByLanguageJson ?? "{}") ?? new(); }
            catch { chars = new(); }
            return new
            {
                s.Id, s.StartedAt, s.EndedAt, s.SpeechSeconds, s.Segments,
                CharsByLanguage = chars, s.PeakListeners, s.CreditsUsed, s.EndReason,
            };
        }

        private long GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(claim, out var id)) return id;
            throw new UnauthorizedAccessException("User not found");
        }

        private long GetChannelOwnerId()
        {
            var session = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(session) && long.TryParse(session, out var sid)) return sid;
            var claim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(claim, out var cid)) return cid;
            return GetUserId();
        }

        private bool IsAdmin()
        {
            var username = User.FindFirst("login")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(username)) return false;
            return _db.SystemAdmins.Any(a => a.Username.ToLower() == username.ToLower() && a.Role == "owner");
        }
    }
}
