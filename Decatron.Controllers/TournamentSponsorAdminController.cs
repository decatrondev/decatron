using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Text.Json;

namespace Decatron.Controllers
{
    /// <summary>
    /// Milestone 1 del modulo de Torneos — sponsors, alta manual del organizador.
    /// Ver .dev/torneos/06-premios-pagos-sponsors.md #3. Fuera de este corte:
    /// leads publicos y metricas de impresiones/clics (Milestone 5).
    /// </summary>
    [ApiController]
    [Route("api/admin/tournament")]
    [Authorize]
    public class TournamentSponsorAdminController : TournamentControllerBase
    {
        private readonly DecatronDbContext _dbContext;

        public TournamentSponsorAdminController(DecatronDbContext dbContext, IPermissionService permissionService) : base(dbContext, permissionService)
        {
            _dbContext = dbContext;
        }

        private static readonly string[] ValidSlots = { "home-banner", "prizes", "footer" };

        // Sin esto, un admin que carga "midominio.com" (sin protocolo) en el link del
        // boton termina con un href relativo — el navegador arma
        // "decatron.net/midominio.com" en vez de mandar al sitio externo. Bug
        // reportado por el usuario 24-08-2026.
        private static string? NormalizeUrl(string? url)
        {
            if (string.IsNullOrWhiteSpace(url)) return null;
            var trimmed = url.Trim();
            return trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || trimmed.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
                ? trimmed
                : $"https://{trimmed}";
        }

        [HttpGet("editions/{editionId}/sponsors")]
        public async Task<IActionResult> ListSponsors(long editionId)
        {
            var channelOwnerId = GetChannelOwnerId();
            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var sponsors = await _dbContext.TournamentSponsors
                .Where(s => s.TournamentEditionId == editionId)
                .OrderBy(s => s.SortOrder)
                .ToListAsync();

            return Ok(new
            {
                success = true,
                sponsors = sponsors.Select(s => new
                {
                    s.Id,
                    s.Name,
                    s.LogoUrl,
                    s.CtaText,
                    s.CtaUrl,
                    s.AmountSponsored,
                    s.Status,
                    Slots = JsonSerializer.Deserialize<List<string>>(s.Slots) ?? new List<string>(),
                }),
            });
        }

        public class SponsorRequest
        {
            public string Name { get; set; } = "";
            public string? LogoUrl { get; set; }
            public string? CtaText { get; set; }
            public string? CtaUrl { get; set; }
            public decimal? AmountSponsored { get; set; }
            public List<string> Slots { get; set; } = new();
        }

        [HttpPost("editions/{editionId}/sponsors")]
        public async Task<IActionResult> CreateSponsor(long editionId, [FromBody] SponsorRequest request)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede administrar sponsors" });

            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new { success = false, message = "El nombre es requerido" });

            var invalidSlots = request.Slots.Except(ValidSlots).ToList();
            if (invalidSlots.Count > 0)
                return BadRequest(new { success = false, message = $"Slot(s) invalido(s): {string.Join(", ", invalidSlots)}" });

            var maxOrder = await _dbContext.TournamentSponsors
                .Where(s => s.TournamentEditionId == editionId)
                .Select(s => (short?)s.SortOrder)
                .MaxAsync() ?? 0;

            var sponsor = new TournamentSponsor
            {
                TournamentEditionId = editionId,
                Name = request.Name.Trim(),
                LogoUrl = request.LogoUrl,
                CtaText = request.CtaText,
                CtaUrl = NormalizeUrl(request.CtaUrl),
                AmountSponsored = request.AmountSponsored,
                Slots = JsonSerializer.Serialize(request.Slots),
                SortOrder = (short)(maxOrder + 1),
            };

            _dbContext.TournamentSponsors.Add(sponsor);
            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true, sponsor });
        }

        [HttpPut("sponsors/{sponsorId}")]
        public async Task<IActionResult> UpdateSponsor(long sponsorId, [FromBody] SponsorRequest request)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede administrar sponsors" });

            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new { success = false, message = "El nombre es requerido" });

            var invalidSlots = request.Slots.Except(ValidSlots).ToList();
            if (invalidSlots.Count > 0)
                return BadRequest(new { success = false, message = $"Slot(s) invalido(s): {string.Join(", ", invalidSlots)}" });

            var sponsor = await _dbContext.TournamentSponsors
                .Join(_dbContext.TournamentEditions, s => s.TournamentEditionId, e => e.Id, (s, e) => new { s, e })
                .Where(x => x.s.Id == sponsorId && x.e.ChannelOwnerId == channelOwnerId)
                .Select(x => x.s)
                .FirstOrDefaultAsync();

            if (sponsor == null)
                return NotFound(new { success = false, message = "Sponsor no encontrado" });

            sponsor.Name = request.Name.Trim();
            sponsor.LogoUrl = request.LogoUrl;
            sponsor.CtaText = request.CtaText;
            sponsor.CtaUrl = NormalizeUrl(request.CtaUrl);
            sponsor.AmountSponsored = request.AmountSponsored;
            sponsor.Slots = JsonSerializer.Serialize(request.Slots);
            sponsor.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true, sponsor });
        }

        public class UpdateSponsorStatusRequest
        {
            public string Status { get; set; } = "active";
        }

        [HttpPut("sponsors/{sponsorId}/status")]
        public async Task<IActionResult> UpdateStatus(long sponsorId, [FromBody] UpdateSponsorStatusRequest request)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede administrar sponsors" });

            if (request.Status != "active" && request.Status != "archived")
                return BadRequest(new { success = false, message = "Estado invalido" });

            var sponsor = await _dbContext.TournamentSponsors
                .Join(_dbContext.TournamentEditions, s => s.TournamentEditionId, e => e.Id, (s, e) => new { s, e })
                .Where(x => x.s.Id == sponsorId && x.e.ChannelOwnerId == channelOwnerId)
                .Select(x => x.s)
                .FirstOrDefaultAsync();

            if (sponsor == null)
                return NotFound(new { success = false, message = "Sponsor no encontrado" });

            sponsor.Status = request.Status;
            sponsor.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true });
        }

        [HttpDelete("sponsors/{sponsorId}")]
        public async Task<IActionResult> DeleteSponsor(long sponsorId)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede administrar sponsors" });

            var sponsor = await _dbContext.TournamentSponsors
                .Join(_dbContext.TournamentEditions, s => s.TournamentEditionId, e => e.Id, (s, e) => new { s, e })
                .Where(x => x.s.Id == sponsorId && x.e.ChannelOwnerId == channelOwnerId)
                .Select(x => x.s)
                .FirstOrDefaultAsync();

            if (sponsor == null)
                return NotFound(new { success = false, message = "Sponsor no encontrado" });

            _dbContext.TournamentSponsors.Remove(sponsor);
            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true });
        }
    }
}
