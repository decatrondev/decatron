using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    /// <summary>
    /// Dashboard de resumen — ver .dev/torneos/09-panel-admin-backend.md #2. No es
    /// una tabla nueva, es una query compuesta sobre lo que ya existe.
    ///
    /// NO incluye "jugadores en directo ahora mismo" (si estaba en el diseno
    /// original): el unico detector de "en vivo" que ya existe en la plataforma
    /// (IStreamStatusService) resuelve por Twitch broadcaster ID de canales que SON
    /// usuarios de Decatron con EventSub propio — un participante de torneo es
    /// tipicamente un streamer externo sin esa suscripcion, asi que no hay senal de
    /// "en vivo" para el sin construir eso especifico (fase 3 seccion 6, Live Games,
    /// no implementado). Se omite el widget en vez de simularlo con datos falsos.
    /// </summary>
    [ApiController]
    [Route("api/admin/tournament")]
    [Authorize]
    public class TournamentDashboardAdminController : TournamentControllerBase
    {
        private readonly DecatronDbContext _dbContext;

        public TournamentDashboardAdminController(DecatronDbContext dbContext, IPermissionService permissionService) : base(dbContext, permissionService)
        {
            _dbContext = dbContext;
        }

        [HttpGet("editions/{editionId}/dashboard")]
        public async Task<IActionResult> GetDashboard(long editionId)
        {
            var channelOwnerId = GetChannelOwnerId();
            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var totalParticipants = await _dbContext.TournamentParticipants
                .CountAsync(p => p.TournamentEditionId == editionId && p.Status != "rejected" && p.Status != "withdrawn");

            var totalMatchesTracked = await _dbContext.TournamentLpSnapshots
                .CountAsync(s => _dbContext.TournamentParticipants.Any(p => p.Id == s.TournamentParticipantId && p.TournamentEditionId == editionId));

            var leaderRow = await (
                from p in _dbContext.TournamentParticipants
                where p.TournamentEditionId == editionId
                let lastLp = _dbContext.TournamentLpSnapshots
                    .Where(s => s.TournamentParticipantId == p.Id)
                    .OrderByDescending(s => s.OccurredAt)
                    .Select(s => (int?)s.LpAfter)
                    .FirstOrDefault()
                where lastLp != null
                orderby lastLp descending
                select new { p.DisplayName, Lp = lastLp }
            ).FirstOrDefaultAsync();

            var recentShellEvents = await _dbContext.TournamentShellEvents
                .Where(e => e.TournamentEditionId == editionId)
                .OrderByDescending(e => e.CreatedAt)
                .Take(5)
                .Select(e => new { e.Id, e.Type, e.CreatedAt, e.WasReverse })
                .ToListAsync();

            var unfulfilledThreshold = DateTime.UtcNow.AddHours(-24);
            var unfulfilledCount = await _dbContext.TournamentShellEvents
                .CountAsync(e => e.TournamentEditionId == editionId && e.Type == "thrown" && e.FulfilledAt == null && e.CreatedAt < unfulfilledThreshold);

            var riotConfig = await _dbContext.TournamentRiotConfigs.FirstOrDefaultAsync(c => c.ChannelOwnerId == channelOwnerId);

            var alerts = new List<string>();
            if (unfulfilledCount > 0)
                alerts.Add($"{unfulfilledCount} castigo(s) sin marcar como cumplido hace mas de 24h");
            if (riotConfig == null)
                alerts.Add("No hay Riot API key configurada para este canal");
            else if (riotConfig.LastErrorAt != null && riotConfig.LastErrorAt > DateTime.UtcNow.AddHours(-1))
                alerts.Add($"Riot API con error reciente: {riotConfig.LastErrorMessage}");
            else if (!riotConfig.IsActive)
                alerts.Add("Riot API key desactivada");

            var daysUntilEnd = edition.EndsAt.HasValue ? (edition.EndsAt.Value - DateTime.UtcNow).TotalDays : (double?)null;

            return Ok(new
            {
                success = true,
                dashboard = new
                {
                    editionName = edition.Name,
                    editionStatus = edition.Status,
                    endsAt = edition.EndsAt,
                    daysUntilEnd,
                    totalParticipants,
                    totalMatchesTracked,
                    currentLeaderName = leaderRow?.DisplayName,
                    currentLeaderLp = leaderRow?.Lp,
                    recentShellEvents,
                    unfulfilledPunishments = unfulfilledCount,
                    alerts,
                    riotKeyConfigured = riotConfig != null,
                    riotKeyActive = riotConfig?.IsActive ?? false,
                    riotLastValidatedAt = riotConfig?.LastValidatedAt,
                }
            });
        }
    }
}
