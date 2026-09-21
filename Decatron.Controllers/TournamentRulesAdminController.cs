using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;

namespace Decatron.Controllers
{
    /// <summary>
    /// Milestone 1 del modulo de Torneos — Normas (texto). Ver
    /// .dev/torneos/09-panel-admin-backend.md #4. v1 markdown simple, sin editor
    /// rich-text (no hay libreria instalada, ver ESTADO.md).
    /// </summary>
    [ApiController]
    [Route("api/admin/tournament")]
    [Authorize]
    public class TournamentRulesAdminController : TournamentControllerBase
    {
        private readonly DecatronDbContext _dbContext;

        public TournamentRulesAdminController(DecatronDbContext dbContext, IPermissionService permissionService) : base(dbContext, permissionService)
        {
            _dbContext = dbContext;
        }

        private static readonly string[] ValidTypes = { "general", "punishments" };

        [HttpGet("editions/{editionId}/rules")]
        public async Task<IActionResult> GetRules(long editionId)
        {
            var channelOwnerId = GetChannelOwnerId();
            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var docs = await _dbContext.TournamentRuleDocuments
                .Where(d => d.TournamentEditionId == editionId)
                .ToListAsync();

            return Ok(new
            {
                success = true,
                general = docs.FirstOrDefault(d => d.Type == "general"),
                punishments = docs.FirstOrDefault(d => d.Type == "punishments"),
            });
        }

        public class UpdateRulesRequest
        {
            public string Type { get; set; } = "general";
            public string ContentMarkdown { get; set; } = "";
        }

        [HttpPut("editions/{editionId}/rules")]
        public async Task<IActionResult> UpdateRules(long editionId, [FromBody] UpdateRulesRequest request)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede editar las normas" });

            if (!ValidTypes.Contains(request.Type))
                return BadRequest(new { success = false, message = "Tipo invalido" });

            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var doc = await _dbContext.TournamentRuleDocuments
                .FirstOrDefaultAsync(d => d.TournamentEditionId == editionId && d.Type == request.Type);

            if (doc == null)
            {
                doc = new TournamentRuleDocument { TournamentEditionId = editionId, Type = request.Type, Version = 1 };
                _dbContext.TournamentRuleDocuments.Add(doc);
            }
            else
            {
                doc.Version++;
            }

            doc.ContentMarkdown = request.ContentMarkdown;
            doc.UpdatedByUserId = channelOwnerId;
            doc.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true, document = doc });
        }
    }
}
