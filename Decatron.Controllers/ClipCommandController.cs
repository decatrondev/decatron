using System.Security.Claims;
using System.Text.Json;
using Decatron.Attributes;
using Decatron.Core.Models.ClipCommand;
using Decatron.Core.Settings;
using Decatron.Data;
using Decatron.Services.ClipCommand;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Text.RegularExpressions;

namespace Decatron.Controllers
{
    /// <summary>
    /// Panel del comando !clip (plan: .dev/plans/CLIP_COMANDO_PLAN.md). Con <c>ClipCommand:Enabled</c> en false
    /// responde 404. El canal sale de la sesión, nunca de un id que mande el cliente.
    /// </summary>
    [ApiController]
    [Route("api/clipcommand")]
    [Authorize]
    public class ClipCommandController : ControllerBase
    {
        private readonly DecatronDbContext _db;
        private readonly ClipCommandService _clips;
        private readonly ClipCommandSettings _settings;
        private readonly string _downloadsPath;
        private readonly ILogger<ClipCommandController> _logger;

        public ClipCommandController(DecatronDbContext db, ClipCommandService clips,
            IOptions<ClipCommandSettings> settings, IConfiguration configuration, ILogger<ClipCommandController> logger)
        {
            _downloadsPath = configuration["ClipSettings:DownloadsPath"] ?? "/var/www/html/decatron/clips";
            _db = db;
            _clips = clips;
            _settings = settings.Value;
            _logger = logger;
        }

        private long GetChannelOwnerId()
        {
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
                return sessionId;

            var claim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(claim, out var channelOwnerId)) return channelOwnerId;

            var own = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(own, out var userId)) return userId;
            throw new UnauthorizedAccessException("User not found");
        }

        // ====================================================================
        // CONFIG
        // ====================================================================

        /// <summary>La config del canal (o la de partida si todavía no hay), con lo que el panel necesita para dibujarla.</summary>
        [HttpGet("config")]
        [RequirePermission("settings")]
        public async Task<IActionResult> GetConfig()
        {
            if (!_settings.Enabled) return NotFound();
            try
            {
                var channelId = GetChannelOwnerId();
                var cfg = await _db.ClipCommandConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.UserId == channelId)
                          ?? new ClipCommandConfig { UserId = channelId };

                var custom = ClipMessages.Keys.ToDictionary(k => k, k => new
                {
                    es = Decatron.Core.Models.WheelOfLuck.WheelMessages.Custom(cfg.Messages, k, "es"),
                    en = Decatron.Core.Models.WheelOfLuck.WheelMessages.Custom(cfg.Messages, k, "en"),
                });

                return Ok(new
                {
                    success = true,
                    config = ToDto(cfg),
                    messages = custom,
                    defaults = ClipMessages.AllDefaults(),
                    placeholders = ClipMessages.Placeholders,
                    roles = ClipRoles.Ordered,
                    limits = new { minDuration = 5, maxDuration = 60, maxTitleLength = 100 },
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Clip] Error leyendo la config");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpPut("config")]
        [RequirePermission("settings")]
        public async Task<IActionResult> SaveConfig([FromBody] ClipConfigDto dto)
        {
            if (!_settings.Enabled) return NotFound();

            var error = Validate(dto);
            if (error != null) return BadRequest(new { success = false, message = error });

            try
            {
                var channelId = GetChannelOwnerId();
                var login = await _db.Users.Where(u => u.Id == channelId).Select(u => u.Login).FirstOrDefaultAsync();
                if (login == null) return NotFound(new { success = false, message = "Canal no encontrado" });

                var cfg = await _db.ClipCommandConfigs.FirstOrDefaultAsync(c => c.UserId == channelId);
                if (cfg == null)
                {
                    cfg = new ClipCommandConfig { UserId = channelId, ChannelName = login };
                    _db.ClipCommandConfigs.Add(cfg);
                }

                cfg.ChannelName = login;
                cfg.Enabled = dto.Enabled;
                cfg.Language = dto.Language;
                cfg.MinRole = dto.MinRole;
                cfg.GlobalCooldownSeconds = dto.GlobalCooldownSeconds;
                cfg.UserCooldownSeconds = dto.UserCooldownSeconds;
                cfg.StaffSkipUserCooldown = dto.StaffSkipUserCooldown;
                cfg.MaxPerUserPerStream = dto.MaxPerUserPerStream;
                cfg.DefaultDuration = dto.DefaultDuration;
                cfg.MinDuration = dto.MinDuration;
                cfg.MaxDuration = dto.MaxDuration;
                cfg.AllowViewerDuration = dto.AllowViewerDuration;
                cfg.AllowTitle = dto.AllowTitle;
                cfg.MaxTitleLength = dto.MaxTitleLength;
                cfg.Aliases = NormalizeAliases(dto.Aliases);
                cfg.UnsupportedPlatformMode = dto.UnsupportedPlatformMode;
                cfg.DownloadEnabled = dto.DownloadEnabled;
                cfg.HistoryRetentionDays = dto.HistoryRetentionDays;
                // download_monthly_cap lo fija solo el admin: este endpoint no lo toca
                cfg.UpdatedAt = DateTime.UtcNow;

                await _db.SaveChangesAsync();
                _clips.InvalidateConfig(channelId);
                return Ok(new { success = true, config = ToDto(cfg) });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Clip] Error guardando la config");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpPut("messages")]
        [RequirePermission("settings")]
        public async Task<IActionResult> SaveMessages([FromBody] Dictionary<string, ClipMessageDto> dtos)
        {
            if (!_settings.Enabled) return NotFound();
            try
            {
                var chat = new Dictionary<string, object>();
                foreach (var (key, dto) in dtos ?? new Dictionary<string, ClipMessageDto>())
                {
                    if (!ClipMessages.Keys.Contains(key)) continue;
                    var es = dto?.Es?.Trim();
                    var en = dto?.En?.Trim();
                    // Vacío no se guarda: la ausencia es lo que devuelve la base de Decatron
                    if (string.IsNullOrWhiteSpace(es) && string.IsNullOrWhiteSpace(en)) continue;
                    if ((es?.Length ?? 0) > 400 || (en?.Length ?? 0) > 400)
                        return BadRequest(new { success = false, message = "Un mensaje de chat no puede pasar de 400 caracteres" });
                    chat[key] = new { es, en };
                }

                var channelId = GetChannelOwnerId();
                var cfg = await _db.ClipCommandConfigs.FirstOrDefaultAsync(c => c.UserId == channelId);
                if (cfg == null)
                    return NotFound(new { success = false, message = "Guarda primero la configuración del comando" });

                cfg.Messages = JsonSerializer.Serialize(new { chat });
                cfg.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                _clips.InvalidateConfig(channelId);
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Clip] Error guardando mensajes");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        // ====================================================================
        // BLOQUEADOS
        // ====================================================================

        [HttpGet("blocks")]
        [RequirePermission("settings")]
        public async Task<IActionResult> GetBlocks()
        {
            if (!_settings.Enabled) return NotFound();
            var channelId = GetChannelOwnerId();
            var blocks = await _db.ClipCommandBlocks.AsNoTracking()
                .Where(b => b.UserId == channelId).OrderBy(b => b.TwitchLogin)
                .Select(b => new { id = b.Id, twitchUserId = b.TwitchUserId, login = b.TwitchLogin, createdAt = b.CreatedAt })
                .ToListAsync();
            return Ok(new { success = true, blocks });
        }

        [HttpPost("blocks")]
        [RequirePermission("settings")]
        public async Task<IActionResult> AddBlock([FromBody] ClipBlockDto dto, [FromServices] Decatron.Services.TwitchApiService twitch)
        {
            if (!_settings.Enabled) return NotFound();
            var login = (dto?.Login ?? "").Trim().TrimStart('@').ToLowerInvariant();
            if (login.Length is < 1 or > 25 || !login.All(ch => char.IsLetterOrDigit(ch) || ch == '_'))
                return BadRequest(new { success = false, message = "Nombre de usuario no válido" });

            try
            {
                // El id sale de Twitch: un nombre puede cambiar, el id no
                var user = await twitch.GetUserByLoginAsync(login);
                if (user == null) return NotFound(new { success = false, message = "Usuario no encontrado" });

                var channelId = GetChannelOwnerId();
                if (await _db.ClipCommandBlocks.AnyAsync(b => b.UserId == channelId && b.TwitchUserId == user.id))
                    return Ok(new { success = true });

                _db.ClipCommandBlocks.Add(new ClipCommandBlock { UserId = channelId, TwitchUserId = user.id, TwitchLogin = user.login });
                await _db.SaveChangesAsync();
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Clip] Error bloqueando a {Login}", login);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpDelete("blocks/{id:long}")]
        [RequirePermission("settings")]
        public async Task<IActionResult> RemoveBlock(long id)
        {
            if (!_settings.Enabled) return NotFound();
            var channelId = GetChannelOwnerId();
            var block = await _db.ClipCommandBlocks.FirstOrDefaultAsync(b => b.Id == id && b.UserId == channelId);
            if (block == null) return NotFound(new { success = false, message = "No encontrado" });
            _db.ClipCommandBlocks.Remove(block);
            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }

        // ====================================================================
        // HISTORIAL
        // ====================================================================

        /// <summary>Historial paginado. Filtros: status (created|failed) y user (login de quien lo pidió).</summary>
        [HttpGet("history")]
        [RequirePermission("settings")]
        public async Task<IActionResult> GetHistory([FromQuery] int page = 1, [FromQuery] int pageSize = 25,
            [FromQuery] string? status = null, [FromQuery] string? user = null)
        {
            if (!_settings.Enabled) return NotFound();
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);
            var channelId = GetChannelOwnerId();

            var query = _db.ClipCommandHistory.AsNoTracking().Where(h => h.UserId == channelId);
            if (status is ClipCommandHistoryItem.StatusCreated or ClipCommandHistoryItem.StatusFailed)
                query = query.Where(h => h.Status == status);
            if (!string.IsNullOrWhiteSpace(user))
            {
                var login = user.Trim().TrimStart('@').ToLowerInvariant();
                query = query.Where(h => h.RequestedByLogin.ToLower() == login);
            }

            var total = await query.CountAsync();
            var items = await query.OrderByDescending(h => h.CreatedAt)
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(h => new
                {
                    id = h.Id,
                    status = h.Status,
                    clipId = h.ClipId,
                    clipUrl = h.ClipUrl,
                    errorCode = h.ErrorCode,
                    title = h.Title,
                    duration = h.DurationSeconds,
                    requestedBy = h.RequestedByLogin,
                    requestedByRole = h.RequestedByRole,
                    downloaded = h.Downloaded,
                    createdAt = h.CreatedAt
                }).ToListAsync();

            return Ok(new { success = true, total, page, pageSize, items });
        }

        /// <summary>
        /// Quita una fila del historial. Con <c>deleteFile=true</c> borra además el video descargado, pero solo si es seguro:
        /// está dentro de la carpeta de este canal, tiene el nombre esperado y ninguna otra fila del historial lo usa.
        /// </summary>
        [HttpDelete("history/{id:long}")]
        [RequirePermission("settings")]
        public async Task<IActionResult> DeleteHistory(long id, [FromQuery] bool deleteFile = false)
        {
            if (!_settings.Enabled) return NotFound();
            var channelId = GetChannelOwnerId();
            var row = await _db.ClipCommandHistory.FirstOrDefaultAsync(h => h.Id == id && h.UserId == channelId);
            if (row == null) return NotFound(new { success = false, message = "No encontrado" });

            var fileDeleted = false;
            if (deleteFile && row.Downloaded && !string.IsNullOrEmpty(row.LocalPath))
            {
                var sharedWithOthers = await _db.ClipCommandHistory.AnyAsync(h => h.Id != row.Id && h.LocalPath == row.LocalPath);
                if (!sharedWithOthers) fileDeleted = TryDeleteDownloadedFile(row);
            }

            _db.ClipCommandHistory.Remove(row);
            await _db.SaveChangesAsync();
            return Ok(new { success = true, fileDeleted });
        }

        private static readonly Regex SafeFileName = new(@"^clip_[A-Za-z0-9_-]+\.mp4$", RegexOptions.Compiled);

        private bool TryDeleteDownloadedFile(ClipCommandHistoryItem row)
        {
            try
            {
                // local_path es la ruta web: /downloads/{canal}/clip_{id}.mp4
                var parts = (row.LocalPath ?? "").Split('/', StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length != 3 || parts[0] != "downloads") return false;
                if (!string.Equals(parts[1], row.ChannelName, StringComparison.OrdinalIgnoreCase) || !SafeFileName.IsMatch(parts[2])) return false;

                var root = Path.GetFullPath(_downloadsPath);
                var full = Path.GetFullPath(Path.Combine(root, parts[1].ToLowerInvariant(), parts[2]));
                if (!full.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.Ordinal) || !System.IO.File.Exists(full)) return false;

                System.IO.File.Delete(full);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Clip] No se pudo borrar el archivo de {Path}", row.LocalPath);
                return false;
            }
        }

        // ====================================================================
        // VALIDACIÓN
        // ====================================================================

        private static string? Validate(ClipConfigDto d)
        {
            if (d == null) return "Datos no válidos";
            if (!ClipRoles.IsValid(d.MinRole)) return "Rango no válido";
            if (d.Language is not ("es" or "en")) return "Idioma no válido";
            if (d.UnsupportedPlatformMode is not ("message" or "silent")) return "Modo para otras plataformas no válido";
            if (d.GlobalCooldownSeconds is < 0 or > 86400 || d.UserCooldownSeconds is < 0 or > 86400)
                return "El cooldown debe estar entre 0 y 86400 segundos";
            if (d.MinDuration < 5 || d.MaxDuration > 60 || d.MinDuration > d.MaxDuration)
                return "La duración debe estar entre 5 y 60 segundos (mínimo no mayor que el máximo)";
            if (d.DefaultDuration < d.MinDuration || d.DefaultDuration > d.MaxDuration)
                return "La duración por defecto debe estar entre el mínimo y el máximo";
            if (d.MaxTitleLength is < 1 or > 100) return "El título puede tener entre 1 y 100 caracteres";
            if (d.MaxPerUserPerStream is <= 0) return "El tope por usuario debe ser mayor que 0";
            if (d.HistoryRetentionDays is <= 0) return "Los días de historial deben ser mayores que 0";
            if (NormalizeAliases(d.Aliases).Length > 300) return "Los alias son demasiado largos";
            return null;
        }

        /// <summary>Alias en minúsculas, sin "!", sin repetidos ni el nombre "clip", solo letras, números y guion bajo.</summary>
        private static string NormalizeAliases(string? raw) => string.Join(",",
            (raw ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(a => a.TrimStart('!').ToLowerInvariant())
                .Where(a => a.Length is >= 1 and <= 20 && a != "clip" && a.All(ch => char.IsLetterOrDigit(ch) || ch == '_'))
                .Distinct().Take(10));

        private static object ToDto(ClipCommandConfig c) => new
        {
            enabled = c.Enabled,
            language = c.Language,
            minRole = c.MinRole,
            globalCooldownSeconds = c.GlobalCooldownSeconds,
            userCooldownSeconds = c.UserCooldownSeconds,
            staffSkipUserCooldown = c.StaffSkipUserCooldown,
            maxPerUserPerStream = c.MaxPerUserPerStream,
            defaultDuration = c.DefaultDuration,
            minDuration = c.MinDuration,
            maxDuration = c.MaxDuration,
            allowViewerDuration = c.AllowViewerDuration,
            allowTitle = c.AllowTitle,
            maxTitleLength = c.MaxTitleLength,
            aliases = c.Aliases,
            unsupportedPlatformMode = c.UnsupportedPlatformMode,
            downloadEnabled = c.DownloadEnabled,
            downloadMonthlyCap = c.DownloadMonthlyCap,
            historyRetentionDays = c.HistoryRetentionDays
        };
    }

    public class ClipConfigDto
    {
        public bool Enabled { get; set; }
        public string Language { get; set; } = "es";
        public string MinRole { get; set; } = ClipRoles.Everyone;
        public int GlobalCooldownSeconds { get; set; } = 30;
        public int UserCooldownSeconds { get; set; } = 120;
        public bool StaffSkipUserCooldown { get; set; } = true;
        public int? MaxPerUserPerStream { get; set; }
        public decimal DefaultDuration { get; set; } = 30m;
        public decimal MinDuration { get; set; } = 5m;
        public decimal MaxDuration { get; set; } = 60m;
        public bool AllowViewerDuration { get; set; } = true;
        public bool AllowTitle { get; set; } = true;
        public int MaxTitleLength { get; set; } = 100;
        public string? Aliases { get; set; }
        public string UnsupportedPlatformMode { get; set; } = "message";
        public bool DownloadEnabled { get; set; }
        public int? HistoryRetentionDays { get; set; } = 90;
    }

    public class ClipMessageDto
    {
        public string? Es { get; set; }
        public string? En { get; set; }
    }

    public class ClipBlockDto
    {
        public string? Login { get; set; }
    }
}
