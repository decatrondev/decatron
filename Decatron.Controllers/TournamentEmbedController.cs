using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Decatron.Services.Tournament;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Text.Json;

namespace Decatron.Controllers
{
    /// <summary>
    /// Milestone 3 del modulo de Torneos — overlays y widget embebible, fase 12.
    /// Sin auth, CORS abierto (politica "TournamentEmbed", Program.cs) porque estos
    /// dos endpoints se consumen desde fuera de decatron.net (OBS, la web de un
    /// tercero) — a diferencia del resto de la API publica que ya vive bajo el mismo
    /// origen del propio sitio.
    /// </summary>
    [ApiController]
    [EnableCors("TournamentEmbed")]
    public class TournamentEmbedController : ControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly TournamentStandingsService _standings;

        public TournamentEmbedController(DecatronDbContext dbContext, TournamentStandingsService standings)
        {
            _dbContext = dbContext;
            _standings = standings;
        }

        /// <summary>
        /// Estado en vivo de UN participante para su overlay personal (OBS). El
        /// token ES la autenticacion — no hay [Authorize], no hace falta sesion.
        /// </summary>
        [HttpGet("api/overlay/torneo/{token}")]
        public async Task<IActionResult> GetOverlayState(string token)
        {
            var config = await _dbContext.TournamentOverlayConfigs.FirstOrDefaultAsync(c => c.Token == token);
            if (config == null)
                return NotFound(new { success = false, message = "Overlay no encontrado" });

            var participant = await _dbContext.TournamentParticipants
                .FirstOrDefaultAsync(p => p.Id == config.TournamentParticipantId);
            if (participant == null)
                return NotFound(new { success = false, message = "Overlay no encontrado" });

            var edition = await _dbContext.TournamentEditions.FirstAsync(e => e.Id == participant.TournamentEditionId);
            var enabledWidgets = JsonSerializer.Deserialize<List<string>>(config.EnabledWidgets) ?? new List<string>();

            var lastSnapshot = await _dbContext.TournamentLpSnapshots
                .Where(s => s.TournamentParticipantId == participant.Id)
                .OrderByDescending(s => s.OccurredAt)
                .FirstOrDefaultAsync();

            var rank = await _standings.GetRankAsync(_dbContext, edition.Id, participant.Id);

            var inventory = await _dbContext.TournamentShellInventories
                .FirstOrDefaultAsync(i => i.TournamentParticipantId == participant.Id);

            var activePunishment = await _dbContext.TournamentShellEvents
                .AnyAsync(e => e.TargetParticipantId == participant.Id && e.Type == "received" && e.FulfilledAt == null);

            var recentForm = await _dbContext.TournamentLpSnapshots
                .Where(s => s.TournamentParticipantId == participant.Id)
                .OrderByDescending(s => s.OccurredAt)
                .Take(10)
                .Select(s => s.Result)
                .ToListAsync();
            recentForm.Reverse();

            return Ok(new
            {
                success = true,
                theme = config.Theme,
                enabledWidgets,
                displayName = participant.DisplayName,
                shellItemName = edition.ShellItemName,
                currentLp = lastSnapshot?.LpAfter,
                rank,
                shellCount = inventory?.Count ?? 0,
                activePunishment,
                recentForm,
            });
        }

        /// <summary>
        /// Ranking completo de una edicion, pensado para <iframe> en la web de un
        /// tercero. Mismo dato que TournamentPublicController.GetHome, servido aparte
        /// porque este si necesita CORS abierto.
        /// </summary>
        [HttpGet("api/embed/torneo/{channelName}/{editionSlug}/ranking")]
        [EnableRateLimiting("tournament-embed")]
        public async Task<IActionResult> GetRankingWidget(string channelName, string editionSlug, [FromQuery] string theme = "dark", [FromQuery] int limit = 20)
        {
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Login.ToLower() == channelName.ToLower());
            if (user == null)
                return NotFound(new { success = false, message = "Torneo no encontrado" });

            var edition = await _dbContext.TournamentEditions.FirstOrDefaultAsync(e =>
                e.ChannelOwnerId == user.Id && e.Slug == editionSlug && e.Status != "draft");
            if (edition == null)
                return NotFound(new { success = false, message = "Torneo no encontrado" });

            var participants = await _dbContext.TournamentParticipants
                .Where(p => p.TournamentEditionId == edition.Id && p.Status == "approved")
                .ToListAsync();

            var rows = new List<(string name, int? lp)>();
            foreach (var p in participants)
            {
                var lp = await _dbContext.TournamentLpSnapshots
                    .Where(s => s.TournamentParticipantId == p.Id)
                    .OrderByDescending(s => s.OccurredAt)
                    .Select(s => (int?)s.LpAfter)
                    .FirstOrDefaultAsync();
                rows.Add((p.DisplayName, lp));
            }

            var ranking = rows
                .OrderByDescending(r => r.lp ?? -1)
                .Take(Math.Clamp(limit, 1, 50))
                .Select((r, idx) => new { rank = idx + 1, displayName = r.name, currentLp = r.lp })
                .ToList();

            return Ok(new
            {
                success = true,
                editionName = edition.Name,
                theme = theme == "light" ? "light" : "dark",
                ranking,
            });
        }
    }
}
