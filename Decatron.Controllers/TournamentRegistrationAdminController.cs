using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;

namespace Decatron.Controllers
{
    /// <summary>
    /// Milestone 2 del modulo de Torneos — bandeja de inscripciones (fase 5). El
    /// alta manual directa (status=approved) sigue viviendo en
    /// TournamentAdminController.AddParticipant — esto es solo para las que entraron
    /// por el form publico o el bot de Discord, en "pending_approval".
    /// </summary>
    [ApiController]
    [Route("api/admin/tournament")]
    [Authorize]
    public class TournamentRegistrationAdminController : TournamentControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly ILogger<TournamentRegistrationAdminController> _logger;

        public TournamentRegistrationAdminController(DecatronDbContext dbContext, ILogger<TournamentRegistrationAdminController> logger, IPermissionService permissionService) : base(dbContext, permissionService)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        [HttpGet("editions/{editionId}/registrations")]
        public async Task<IActionResult> ListPending(long editionId)
        {
            var channelOwnerId = GetChannelOwnerId();
            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var pending = await _dbContext.TournamentParticipants
                .Where(p => p.TournamentEditionId == editionId && p.Status == "pending_approval")
                .OrderBy(p => p.CreatedAt)
                .ToListAsync();

            return Ok(new { success = true, pending });
        }

        [HttpPost("participants/{participantId}/approve")]
        public async Task<IActionResult> Approve(long participantId)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede aprobar inscripciones" });

            var participant = await _dbContext.TournamentParticipants
                .Join(_dbContext.TournamentEditions, p => p.TournamentEditionId, e => e.Id, (p, e) => new { p, e })
                .Where(x => x.p.Id == participantId && x.e.ChannelOwnerId == channelOwnerId)
                .Select(x => x.p)
                .FirstOrDefaultAsync();

            if (participant == null)
                return NotFound(new { success = false, message = "Participante no encontrado" });

            if (participant.Status != "pending_approval")
                return BadRequest(new { success = false, message = $"Ya está en estado '{participant.Status}', no se puede aprobar de nuevo" });

            participant.Status = "approved";
            participant.ApprovedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();

            _logger.LogInformation("Torneo: participante {ParticipantId} ({DisplayName}) aprobado por canal {ChannelOwnerId}", participantId, participant.DisplayName, channelOwnerId);

            return Ok(new { success = true, participant });
        }

        [HttpPost("participants/{participantId}/reject")]
        public async Task<IActionResult> Reject(long participantId)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede rechazar inscripciones" });

            var participant = await _dbContext.TournamentParticipants
                .Join(_dbContext.TournamentEditions, p => p.TournamentEditionId, e => e.Id, (p, e) => new { p, e })
                .Where(x => x.p.Id == participantId && x.e.ChannelOwnerId == channelOwnerId)
                .Select(x => x.p)
                .FirstOrDefaultAsync();

            if (participant == null)
                return NotFound(new { success = false, message = "Participante no encontrado" });

            if (participant.Status != "pending_approval")
                return BadRequest(new { success = false, message = $"Ya está en estado '{participant.Status}', no se puede rechazar" });

            participant.Status = "rejected";
            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true });
        }
    }
}
