using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Decatron.Services;
using Decatron.Services.Tournament;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    /// <summary>
    /// Condiciones de victoria configurables para torneos ARAM N vs N — Tema 2,
    /// pedido del usuario 24-08-2026 (combinables: el organizador puede activar
    /// varias a la vez y gana quien cumpla CUALQUIERA primero). Ver
    /// Decatron.Services/Tournament/TournamentWinConditionEngine.cs para el catalogo
    /// completo de condition_type soportados y como se evaluan.
    /// </summary>
    [ApiController]
    [Route("api/admin/tournament")]
    [Authorize]
    public class TournamentWinConditionAdminController : TournamentControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly TournamentWinConditionSyncService _syncService;

        public TournamentWinConditionAdminController(DecatronDbContext dbContext, TournamentWinConditionSyncService syncService, IPermissionService permissionService) : base(dbContext, permissionService)
        {
            _dbContext = dbContext;
            _syncService = syncService;
        }

        [HttpGet("editions/{editionId}/win-conditions")]
        public async Task<IActionResult> GetWinConditions(long editionId)
        {
            var channelOwnerId = GetChannelOwnerId();
            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var conditions = await _dbContext.TournamentWinConditions
                .Where(c => c.TournamentEditionId == editionId)
                .OrderBy(c => c.CreatedAt)
                .ToListAsync();

            return Ok(new { success = true, conditions });
        }

        public class CreateWinConditionRequest
        {
            public string Name { get; set; } = "";
            public string ConditionType { get; set; } = "first_tower";
            public decimal ThresholdValue { get; set; } = 1;
        }

        [HttpPost("editions/{editionId}/win-conditions")]
        public async Task<IActionResult> CreateWinCondition(long editionId, [FromBody] CreateWinConditionRequest request)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede configurar condiciones de victoria" });

            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            if (edition.Mode != "aram_teams")
                return BadRequest(new { success = false, message = "Las condiciones de victoria solo aplican al modo ARAM N vs N" });

            var condition = new TournamentWinCondition
            {
                TournamentEditionId = editionId,
                Name = request.Name,
                ConditionType = request.ConditionType,
                ThresholdValue = request.ThresholdValue,
                IsActive = true,
            };
            _dbContext.TournamentWinConditions.Add(condition);
            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true, condition });
        }

        public class UpdateWinConditionRequest
        {
            public string Name { get; set; } = "";
            public string ConditionType { get; set; } = "first_tower";
            public decimal ThresholdValue { get; set; } = 1;
            public bool IsActive { get; set; } = true;
        }

        [HttpPut("win-conditions/{conditionId}")]
        public async Task<IActionResult> UpdateWinCondition(long conditionId, [FromBody] UpdateWinConditionRequest request)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede editar condiciones de victoria" });

            var condition = await _dbContext.TournamentWinConditions
                .Join(_dbContext.TournamentEditions, c => c.TournamentEditionId, ed => ed.Id, (c, ed) => new { c, ed })
                .Where(x => x.c.Id == conditionId && x.ed.ChannelOwnerId == channelOwnerId)
                .Select(x => x.c)
                .FirstOrDefaultAsync();

            if (condition == null)
                return NotFound(new { success = false, message = "Condicion no encontrada" });

            condition.Name = request.Name;
            condition.ConditionType = request.ConditionType;
            condition.ThresholdValue = request.ThresholdValue;
            condition.IsActive = request.IsActive;
            condition.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true, condition });
        }

        [HttpDelete("win-conditions/{conditionId}")]
        public async Task<IActionResult> DeleteWinCondition(long conditionId)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede borrar condiciones de victoria" });

            var condition = await _dbContext.TournamentWinConditions
                .Join(_dbContext.TournamentEditions, c => c.TournamentEditionId, ed => ed.Id, (c, ed) => new { c, ed })
                .Where(x => x.c.Id == conditionId && x.ed.ChannelOwnerId == channelOwnerId)
                .Select(x => x.c)
                .FirstOrDefaultAsync();

            if (condition == null)
                return NotFound(new { success = false, message = "Condicion no encontrada" });

            _dbContext.TournamentWinConditions.Remove(condition);
            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true });
        }

        /// <summary>
        /// Corre la misma deteccion que hace el poller automatico (cada 3 min), pero
        /// ahora mismo — mismo patron que POST .../riot-resync para SoloQ Climb.
        /// </summary>
        [HttpPost("editions/{editionId}/win-conditions/resync")]
        public async Task<IActionResult> ResyncWinConditions(long editionId)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede resincronizar" });

            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            if (edition.Mode != "aram_teams")
                return BadRequest(new { success = false, message = "Las condiciones de victoria solo aplican al modo ARAM N vs N" });

            var riotConfig = await _dbContext.TournamentRiotConfigs.FirstOrDefaultAsync(c => c.ChannelOwnerId == channelOwnerId);
            if (riotConfig == null || !riotConfig.IsActive)
                return BadRequest(new { success = false, message = "No hay una Riot API key activa configurada para este canal" });

            await _syncService.SyncEditionAsync(_dbContext, riotConfig, edition);
            return Ok(new { success = true });
        }
    }
}
