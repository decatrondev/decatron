using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json;

namespace Decatron.Controllers
{
    /// <summary>
    /// Milestone 3 del modulo de Torneos — overlays de streamer, fase 12 #1.
    /// El token nunca se muestra en la app publica, solo en este panel de admin.
    /// </summary>
    [ApiController]
    [Route("api/admin/tournament")]
    [Authorize]
    public class TournamentOverlayAdminController : TournamentControllerBase
    {
        private readonly DecatronDbContext _dbContext;

        public TournamentOverlayAdminController(DecatronDbContext dbContext, IPermissionService permissionService) : base(dbContext, permissionService)
        {
            _dbContext = dbContext;
        }

        private static readonly string[] ValidWidgets = { "lp-actual", "shell-inventory", "castigo-activo", "racha" };

        private async Task<Core.Models.Tournament.TournamentParticipant?> GetOwnedParticipantOrNullAsync(long editionId, long participantId, long channelOwnerId)
        {
            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null) return null;

            return await _dbContext.TournamentParticipants
                .FirstOrDefaultAsync(p => p.Id == participantId && p.TournamentEditionId == editionId);
        }

        [HttpGet("editions/{editionId}/participants/{participantId}/overlay")]
        public async Task<IActionResult> GetOverlay(long editionId, long participantId)
        {
            var channelOwnerId = GetChannelOwnerId();
            var participant = await GetOwnedParticipantOrNullAsync(editionId, participantId, channelOwnerId);
            if (participant == null)
                return NotFound(new { success = false, message = "Participante no encontrado" });

            var config = await _dbContext.TournamentOverlayConfigs
                .FirstOrDefaultAsync(c => c.TournamentParticipantId == participantId);

            if (config == null)
                return Ok(new { success = true, configured = false });

            return Ok(new
            {
                success = true,
                configured = true,
                url = $"/overlay/torneo/{config.Token}",
                enabledWidgets = JsonSerializer.Deserialize<List<string>>(config.EnabledWidgets) ?? new List<string>(),
                theme = config.Theme,
            });
        }

        public class UpdateOverlayRequest
        {
            public List<string> EnabledWidgets { get; set; } = new();
            public string Theme { get; set; } = "dark";
        }

        [HttpPost("editions/{editionId}/participants/{participantId}/overlay")]
        public async Task<IActionResult> CreateOrRegenerate(long editionId, long participantId, [FromBody] UpdateOverlayRequest request)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede configurar overlays" });

            var participant = await GetOwnedParticipantOrNullAsync(editionId, participantId, channelOwnerId);
            if (participant == null)
                return NotFound(new { success = false, message = "Participante no encontrado" });

            var invalidWidgets = request.EnabledWidgets.Except(ValidWidgets).ToList();
            if (invalidWidgets.Count > 0)
                return BadRequest(new { success = false, message = $"Widget(s) invalido(s): {string.Join(", ", invalidWidgets)}" });

            var config = await _dbContext.TournamentOverlayConfigs
                .FirstOrDefaultAsync(c => c.TournamentParticipantId == participantId);

            var newToken = GenerateToken();

            if (config == null)
            {
                config = new TournamentOverlayConfig { TournamentParticipantId = participantId, Token = newToken };
                _dbContext.TournamentOverlayConfigs.Add(config);
            }
            else
            {
                // Regenerar token: el uso previsto es "el organizador la pide de nuevo
                // si se filtró la URL" — cada llamada a este endpoint invalida la anterior.
                config.Token = newToken;
            }

            config.EnabledWidgets = JsonSerializer.Serialize(request.EnabledWidgets.Count > 0 ? request.EnabledWidgets : ValidWidgets.Take(3).ToList());
            config.Theme = request.Theme;
            config.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true, url = $"/overlay/torneo/{config.Token}" });
        }

        private static string GenerateToken()
        {
            var bytes = RandomNumberGenerator.GetBytes(24);
            return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").Replace("=", "");
        }
    }
}
