using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Decatron.Services;
using Decatron.Services.Tournament;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;

namespace Decatron.Controllers
{
    /// <summary>
    /// Milestone 4 del modulo de Torneos — equipos y bracket (ARAM N vs N, Clash 5v5).
    /// Ver .dev/torneos/02-motor-de-torneo-formatos.md y
    /// .dev/torneos/ESTADO.md (cobertura real: solo single_elimination).
    /// </summary>
    [ApiController]
    [Route("api/admin/tournament")]
    [Authorize]
    public class TournamentTeamAdminController : TournamentControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly TournamentTeamService _teamService;
        private readonly TournamentBracketService _bracketService;
        private readonly TournamentBracketStandingsService _standingsService;

        public TournamentTeamAdminController(
            DecatronDbContext dbContext, TournamentTeamService teamService, TournamentBracketService bracketService,
            TournamentBracketStandingsService standingsService, IPermissionService permissionService) : base(dbContext, permissionService)
        {
            _dbContext = dbContext;
            _teamService = teamService;
            _bracketService = bracketService;
            _standingsService = standingsService;
        }

        [HttpGet("editions/{editionId}/teams")]
        public async Task<IActionResult> ListTeams(long editionId)
        {
            var channelOwnerId = GetChannelOwnerId();
            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var teams = await _dbContext.TournamentTeams
                .Where(t => t.TournamentEditionId == editionId)
                .OrderBy(t => t.Seed ?? short.MaxValue)
                .ToListAsync();

            var members = await _dbContext.TournamentParticipants
                .Where(p => p.TournamentEditionId == editionId && p.TeamId != null)
                .ToListAsync();

            var teamsWithRoster = teams.Select(t => new
            {
                t.Id,
                t.Name,
                t.Seed,
                t.JoinCode,
                Roster = members.Where(m => m.TeamId == t.Id).Select(m => new { m.Id, m.DisplayName, m.IsCaptain, m.IsSubstitute }).ToList(),
                StartersCount = members.Count(m => m.TeamId == t.Id && !m.IsSubstitute),
            });

            return Ok(new { success = true, teams = teamsWithRoster, teamSize = edition.TeamSize });
        }

        public class CreateTeamRequest
        {
            public string Name { get; set; } = "";
        }

        [HttpPost("editions/{editionId}/teams")]
        public async Task<IActionResult> CreateTeam(long editionId, [FromBody] CreateTeamRequest request)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede administrar equipos" });

            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var result = await _teamService.CreateTeamAsync(_dbContext, edition, request.Name);
            if (!result.Success)
                return BadRequest(new { success = false, message = result.Error });

            return Ok(new { success = true, team = result.Team });
        }

        public class AddMemberRequest
        {
            public long? ParticipantId { get; set; }
            public bool IsSubstitute { get; set; }
        }

        [HttpPost("editions/{editionId}/teams/{teamId}/members")]
        public async Task<IActionResult> AddMember(long editionId, long teamId, [FromBody] AddMemberRequest request)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede administrar equipos" });

            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var result = await _teamService.AddMemberAsync(_dbContext, edition, teamId, request.ParticipantId, request.IsSubstitute);
            if (!result.Success)
                return BadRequest(new { success = false, message = result.Error });

            return Ok(new { success = true });
        }

        [HttpPost("editions/{editionId}/bracket/generate")]
        public async Task<IActionResult> GenerateBracket(long editionId)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede generar el bracket" });

            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var result = await _bracketService.GenerateAsync(_dbContext, edition);
            if (!result.Success)
                return BadRequest(new { success = false, message = result.Error });

            return Ok(new { success = true, matchesCreated = result.MatchesCreated, leftOverParticipants = result.LeftOverParticipants });
        }

        [HttpPost("editions/{editionId}/bracket/next-round")]
        public async Task<IActionResult> GenerateNextRound(long editionId)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede generar la siguiente ronda" });

            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var result = await _bracketService.GenerateNextRoundAsync(_dbContext, edition);
            if (!result.Success)
                return BadRequest(new { success = false, message = result.Error });

            return Ok(new { success = true, matchesCreated = result.MatchesCreated });
        }

        [HttpGet("editions/{editionId}/bracket")]
        public async Task<IActionResult> GetBracket(long editionId)
        {
            var channelOwnerId = GetChannelOwnerId();
            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var matches = await _dbContext.TournamentMatches
                .Where(m => m.TournamentEditionId == editionId)
                .OrderBy(m => m.RoundNumber).ThenBy(m => m.BracketPosition)
                .ToListAsync();

            var teamNames = await _dbContext.TournamentTeams
                .Where(t => t.TournamentEditionId == editionId)
                .ToDictionaryAsync(t => t.Id, t => t.Name);

            var dtos = matches.Select(m => new
            {
                m.Id,
                m.RoundNumber,
                m.BracketPosition,
                m.BracketSide,
                m.Status,
                TeamAId = m.TeamAId,
                TeamAName = m.TeamAId.HasValue ? teamNames.GetValueOrDefault(m.TeamAId.Value) : null,
                TeamBId = m.TeamBId,
                TeamBName = m.TeamBId.HasValue ? teamNames.GetValueOrDefault(m.TeamBId.Value) : null,
                m.WinnerTeamId,
            });

            object? standings = null;
            if (edition.BracketFormat == "round_robin" || edition.BracketFormat == "swiss")
            {
                var raw = await _standingsService.GetStandingsAsync(_dbContext, editionId);
                standings = raw.Select(s => new { s.TeamId, TeamName = teamNames.GetValueOrDefault(s.TeamId), s.Wins, s.Losses, s.Rank });
            }

            return Ok(new { success = true, matches = dtos, bracketFormat = edition.BracketFormat, standings });
        }

        public class RecordResultRequest
        {
            public long WinnerTeamId { get; set; }
        }

        [HttpPost("bracket/matches/{matchId}/result")]
        public async Task<IActionResult> RecordResult(long matchId, [FromBody] RecordResultRequest request)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede cargar resultados" });

            var match = await _dbContext.TournamentMatches
                .Join(_dbContext.TournamentEditions, m => m.TournamentEditionId, e => e.Id, (m, e) => new { m, e })
                .Where(x => x.m.Id == matchId && x.e.ChannelOwnerId == channelOwnerId)
                .Select(x => new { x.m, x.e })
                .FirstOrDefaultAsync();

            if (match == null)
                return NotFound(new { success = false, message = "Match no encontrado" });

            var result = await _bracketService.RecordResultAsync(_dbContext, match.e, matchId, request.WinnerTeamId);
            if (!result.Success)
                return BadRequest(new { success = false, message = result.Error });

            return Ok(new { success = true });
        }
    }
}
