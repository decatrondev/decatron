using Decatron.Attributes;
using Decatron.Core.Models.ClipCommand;
using Decatron.Core.Settings;
using Decatron.Data;
using Decatron.Services.ClipCommand;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Decatron.Controllers
{
    /// <summary>
    /// Administración de !clip (plan: .dev/plans/CLIP_COMANDO_PLAN.md): estado del disco, uso por canal y tope
    /// mensual de descargas. El interruptor global y el umbral de espacio viven en appsettings (sección ClipCommand,
    /// se recargan en caliente) y aquí solo se muestran.
    /// </summary>
    [ApiController]
    [Route("api/admin/clipcommand")]
    [Authorize]
    [RequireSystemOwner]
    public class ClipCommandAdminController : ControllerBase
    {
        private readonly DecatronDbContext _db;
        private readonly ClipCommandService _clips;
        private readonly IOptionsMonitor<ClipCommandSettings> _settings;
        private readonly string _downloadsPath;
        private readonly ILogger<ClipCommandAdminController> _logger;

        public ClipCommandAdminController(DecatronDbContext db, ClipCommandService clips,
            IOptionsMonitor<ClipCommandSettings> settings, IConfiguration configuration, ILogger<ClipCommandAdminController> logger)
        {
            _db = db;
            _clips = clips;
            _settings = settings;
            _downloadsPath = configuration["ClipSettings:DownloadsPath"] ?? "/var/www/html/decatron/clips";
            _logger = logger;
        }

        [HttpGet("overview")]
        public async Task<IActionResult> Overview()
        {
            try
            {
                var s = _settings.CurrentValue;
                double? freeGb = null, totalGb = null;
                try
                {
                    var drive = new DriveInfo(Path.GetFullPath(_downloadsPath));
                    freeGb = Math.Round(drive.AvailableFreeSpace / 1024d / 1024 / 1024, 1);
                    totalGb = Math.Round(drive.TotalSize / 1024d / 1024 / 1024, 1);
                }
                catch (Exception ex) { _logger.LogWarning(ex, "[Clip] No se pudo medir el disco"); }

                var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);

                var stats = await _db.ClipCommandHistory.AsNoTracking()
                    .GroupBy(h => h.UserId)
                    .Select(g => new
                    {
                        userId = g.Key,
                        created = g.Count(h => h.Status == ClipCommandHistoryItem.StatusCreated),
                        failed = g.Count(h => h.Status == ClipCommandHistoryItem.StatusFailed),
                        downloaded = g.Count(h => h.Downloaded),
                        downloadedThisMonth = g.Count(h => h.Downloaded && h.CreatedAt >= monthStart),
                        last = g.Max(h => h.CreatedAt)
                    }).ToDictionaryAsync(x => x.userId);

                var channels = (await _db.ClipCommandConfigs.AsNoTracking().OrderBy(c => c.ChannelName).ToListAsync())
                    .Select(c =>
                    {
                        stats.TryGetValue(c.UserId, out var st);
                        return new
                        {
                            userId = c.UserId,
                            channel = c.ChannelName,
                            enabled = c.Enabled,
                            downloadEnabled = c.DownloadEnabled,
                            downloadMonthlyCap = c.DownloadMonthlyCap,
                            created = st?.created ?? 0,
                            failed = st?.failed ?? 0,
                            downloaded = st?.downloaded ?? 0,
                            downloadedThisMonth = st?.downloadedThisMonth ?? 0,
                            lastUsed = st?.last
                        };
                    }).ToList();

                return Ok(new
                {
                    success = true,
                    settings = new { enabled = s.Enabled, minFreeDiskGb = s.MinFreeDiskGb },
                    disk = new { freeGb, totalGb, belowThreshold = s.MinFreeDiskGb > 0 && freeGb.HasValue && freeGb.Value < s.MinFreeDiskGb },
                    totals = new
                    {
                        channels = channels.Count,
                        enabled = channels.Count(c => c.enabled),
                        created = channels.Sum(c => c.created),
                        failed = channels.Sum(c => c.failed),
                        downloaded = channels.Sum(c => c.downloaded)
                    },
                    channels
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Clip] Error en el resumen de admin");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>Tope mensual de descargas de un canal. null o vacío = sin tope.</summary>
        [HttpPut("channels/{userId:long}/download-cap")]
        public async Task<IActionResult> SetDownloadCap(long userId, [FromBody] DownloadCapDto dto)
        {
            if (dto?.Cap is <= 0) return BadRequest(new { success = false, message = "El tope debe ser mayor que 0" });
            var cfg = await _db.ClipCommandConfigs.FirstOrDefaultAsync(c => c.UserId == userId);
            if (cfg == null) return NotFound(new { success = false, message = "Canal sin configuración de !clip" });

            cfg.DownloadMonthlyCap = dto?.Cap;
            cfg.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            _clips.InvalidateConfig(userId);
            return Ok(new { success = true });
        }
    }

    public class DownloadCapDto
    {
        public int? Cap { get; set; }
    }
}
