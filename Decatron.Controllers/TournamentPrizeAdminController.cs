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
    /// Milestone 1 del modulo de Torneos — premios. Ver
    /// .dev/torneos/06-premios-pagos-sponsors.md (cobertura parcial, ver notas en
    /// Add_Tournament_Prizes.sql y ESTADO.md — sponsors/records de partida/pagos
    /// quedan afuera de este corte).
    /// </summary>
    [ApiController]
    [Route("api/admin/tournament")]
    [Authorize]
    public class TournamentPrizeAdminController : TournamentControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly TournamentPrizeService _prizeService;

        public TournamentPrizeAdminController(DecatronDbContext dbContext, TournamentPrizeService prizeService, IPermissionService permissionService) : base(dbContext, permissionService)
        {
            _dbContext = dbContext;
            _prizeService = prizeService;
        }

        [HttpGet("editions/{editionId}/prizes")]
        public async Task<IActionResult> ListPrizes(long editionId)
        {
            var channelOwnerId = GetChannelOwnerId();
            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var tiers = await _dbContext.TournamentPrizeTiers
                .Where(t => t.TournamentEditionId == editionId)
                .OrderBy(t => t.SortOrder)
                .ToListAsync();

            var results = new List<object>();
            foreach (var tier in tiers)
            {
                object? leader = null;
                if (tier.Scope == "by_metric" && !string.IsNullOrEmpty(tier.MetricKey))
                {
                    var leaderResult = await _prizeService.GetLeaderAsync(_dbContext, editionId, tier.MetricKey);
                    leader = new { leaderResult.ParticipantId, leaderResult.DisplayName, leaderResult.Value };
                }

                results.Add(new
                {
                    tier.Id,
                    tier.Name,
                    tier.Description,
                    Amount = tier.AmountHidden ? (decimal?)null : tier.Amount,
                    tier.AmountHidden,
                    tier.Scope,
                    tier.Rank,
                    tier.Role,
                    tier.MetricKey,
                    tier.TournamentDivisionId,
                    Leader = leader,
                });
            }

            return Ok(new { success = true, prizes = results, availableMetrics = TournamentPrizeService.MetricLabels });
        }

        public class CreatePrizeRequest
        {
            public string Name { get; set; } = "";
            public string? Description { get; set; }
            public decimal? Amount { get; set; }
            public bool AmountHidden { get; set; }
            public string Scope { get; set; } = "by_rank";
            public short? Rank { get; set; }
            public string? Role { get; set; }
            public string? MetricKey { get; set; }
            public long? TournamentDivisionId { get; set; }
        }

        // "custom" = el organizador decide a mano quien lo gana, sin atarlo a
        // puesto/rol/metrica — pedido del usuario 24-08-2026: "que cada quien pueda
        // gestionar como quiera, no solo seleccionar".
        private static readonly string[] ValidScopes = { "by_rank", "by_role", "by_metric", "custom" };

        [HttpPost("editions/{editionId}/prizes")]
        public async Task<IActionResult> CreatePrize(long editionId, [FromBody] CreatePrizeRequest request)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede administrar premios" });

            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new { success = false, message = "El nombre del premio es requerido" });

            if (!ValidScopes.Contains(request.Scope))
                return BadRequest(new { success = false, message = "Scope invalido" });

            if (request.Scope == "by_metric" && (string.IsNullOrEmpty(request.MetricKey) || !TournamentPrizeService.MetricLabels.ContainsKey(request.MetricKey)))
                return BadRequest(new { success = false, message = "Metrica invalida" });

            var maxOrder = await _dbContext.TournamentPrizeTiers
                .Where(t => t.TournamentEditionId == editionId)
                .Select(t => (short?)t.SortOrder)
                .MaxAsync() ?? 0;

            var tier = new TournamentPrizeTier
            {
                TournamentEditionId = editionId,
                TournamentDivisionId = request.TournamentDivisionId,
                Name = request.Name.Trim(),
                Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
                Amount = request.Amount,
                AmountHidden = request.AmountHidden,
                Scope = request.Scope,
                Rank = request.Rank,
                Role = request.Role,
                MetricKey = request.MetricKey,
                SortOrder = (short)(maxOrder + 1),
            };

            _dbContext.TournamentPrizeTiers.Add(tier);
            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true, prize = tier });
        }

        [HttpPut("prizes/{prizeId}")]
        public async Task<IActionResult> UpdatePrize(long prizeId, [FromBody] CreatePrizeRequest request)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede administrar premios" });

            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new { success = false, message = "El nombre del premio es requerido" });

            if (!ValidScopes.Contains(request.Scope))
                return BadRequest(new { success = false, message = "Scope invalido" });

            if (request.Scope == "by_metric" && (string.IsNullOrEmpty(request.MetricKey) || !TournamentPrizeService.MetricLabels.ContainsKey(request.MetricKey)))
                return BadRequest(new { success = false, message = "Metrica invalida" });

            var tier = await _dbContext.TournamentPrizeTiers
                .Join(_dbContext.TournamentEditions, t => t.TournamentEditionId, e => e.Id, (t, e) => new { t, e })
                .Where(x => x.t.Id == prizeId && x.e.ChannelOwnerId == channelOwnerId)
                .Select(x => x.t)
                .FirstOrDefaultAsync();

            if (tier == null)
                return NotFound(new { success = false, message = "Premio no encontrado" });

            tier.Name = request.Name.Trim();
            tier.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
            tier.Amount = request.Amount;
            tier.AmountHidden = request.AmountHidden;
            tier.Scope = request.Scope;
            tier.Rank = request.Scope == "by_rank" ? request.Rank : null;
            tier.Role = request.Scope == "by_role" ? request.Role : null;
            tier.MetricKey = request.Scope == "by_metric" ? request.MetricKey : null;
            tier.TournamentDivisionId = request.TournamentDivisionId;
            tier.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true, prize = tier });
        }

        [HttpDelete("prizes/{prizeId}")]
        public async Task<IActionResult> DeletePrize(long prizeId)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede administrar premios" });

            var tier = await _dbContext.TournamentPrizeTiers
                .Join(_dbContext.TournamentEditions, t => t.TournamentEditionId, e => e.Id, (t, e) => new { t, e })
                .Where(x => x.t.Id == prizeId && x.e.ChannelOwnerId == channelOwnerId)
                .Select(x => x.t)
                .FirstOrDefaultAsync();

            if (tier == null)
                return NotFound(new { success = false, message = "Premio no encontrado" });

            _dbContext.TournamentPrizeTiers.Remove(tier);
            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true });
        }
    }
}
