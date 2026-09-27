using System.Text.Json;
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
    /// Formato por puntos de Fortnite (.dev/torneos/15-fortnite.md F2): tabla de
    /// puntos, desempates, armado de equipos, grupos y sesiones. Solo para ediciones
    /// con game = fortnite. La logica vive en TournamentFortniteFormatService.
    /// </summary>
    [ApiController]
    [Route("api/admin/tournament/editions/{editionId}/fortnite")]
    [Authorize]
    public class TournamentFortniteAdminController : TournamentControllerBase
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        private readonly DecatronDbContext _dbContext;
        private readonly TournamentFortniteFormatService _format;
        private readonly TournamentFortniteMatchdayService _matchday;
        private readonly TournamentFortniteResultsService _results;

        public TournamentFortniteAdminController(
            DecatronDbContext dbContext, TournamentFortniteFormatService format, TournamentFortniteMatchdayService matchday,
            TournamentFortniteResultsService results, IPermissionService permissionService)
            : base(dbContext, permissionService)
        {
            _dbContext = dbContext;
            _format = format;
            _matchday = matchday;
            _results = results;
        }

        private async Task<(TournamentEdition? edition, IActionResult? error)> ResolveAsync(long editionId, bool write)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (write && !await IsChannelAuthorizedAsync(channelOwnerId))
                return (null, StatusCode(403, new { success = false, message = "Solo el dueño del canal o alguien con control total puede cambiar el formato" }));

            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return (null, NotFound(new { success = false, message = "Edición no encontrada" }));
            if (edition.Game != TournamentGames.Fortnite)
                return (null, BadRequest(new { success = false, message = "Esta edición no es de Fortnite" }));

            return (edition, null);
        }

        // ─── Lectura de todo el formato ────────────────────────────────────────

        [HttpGet]
        public async Task<IActionResult> GetFormat(long editionId)
        {
            var (edition, error) = await ResolveAsync(editionId, write: false);
            if (error != null) return error;

            var config = await _format.GetOrCreateConfigAsync(_dbContext, edition!);

            var teams = await _dbContext.TournamentTeams
                .Where(t => t.TournamentEditionId == editionId)
                .OrderBy(t => t.Id)
                .ToListAsync();
            var members = await _dbContext.TournamentParticipants
                .Where(p => p.TournamentEditionId == editionId && p.TeamId != null)
                .Select(p => new { p.TeamId, p.DisplayName, p.Status })
                .ToListAsync();

            var approvedWithoutTeam = await _dbContext.TournamentParticipants
                .CountAsync(p => p.TournamentEditionId == editionId && p.Status == "approved" && p.TeamId == null);

            var groups = await _dbContext.TournamentFortniteGroups
                .Where(g => g.TournamentEditionId == editionId)
                .OrderBy(g => g.SortOrder)
                .ToListAsync();
            var groupIds = groups.Select(g => g.Id).ToList();
            var groupTeams = await _dbContext.TournamentFortniteGroupTeams
                .Where(gt => groupIds.Contains(gt.GroupId))
                .ToListAsync();

            var sessions = await _dbContext.TournamentFortniteSessions
                .Where(s => s.TournamentEditionId == editionId)
                .OrderBy(s => s.SortOrder)
                .ToListAsync();
            var sessionIds = sessions.Select(s => s.Id).ToList();
            var games = await _dbContext.TournamentFortniteGames
                .Where(g => sessionIds.Contains(g.SessionId))
                .OrderBy(g => g.GameNumber)
                .ToListAsync();

            return Ok(new
            {
                success = true,
                teamSize = edition!.TeamSize ?? 1,
                teamsPerLobby = TournamentFortniteFormatService.TeamsPerLobby(config, edition),
                config = ToConfigDto(config),
                presets = TournamentFortniteFormatService.Presets,
                teams = teams.Select(t => new
                {
                    t.Id,
                    t.Name,
                    t.JoinCode,
                    members = members.Where(m => m.TeamId == t.Id).Select(m => new { m.DisplayName, m.Status }),
                    playing = members.Any(m => m.TeamId == t.Id && m.Status == "approved"),
                }),
                approvedWithoutTeam,
                groups = groups.Select(g => new
                {
                    g.Id,
                    g.Name,
                    g.IsFinal,
                    g.QualifyCount,
                    teamIds = groupTeams.Where(gt => gt.GroupId == g.Id).Select(gt => gt.TeamId),
                }),
                sessions = sessions.Select(s => new
                {
                    s.Id,
                    s.Name,
                    s.GroupId,
                    s.ScheduledAt,
                    s.Status,
                    games = games.Where(g => g.SessionId == s.Id).Select(g => new { g.Id, g.GameNumber, g.Status }),
                }),
            });
        }

        private static object ToConfigDto(TournamentFortniteConfig c) => new
        {
            placementPoints = TournamentFortniteFormatService.ParsePlacement(c.PlacementPoints),
            c.PointsPerElimination,
            c.Tiebreakers,
            c.MaxPlayersPerLobby,
            c.FillSolosRandomly,
            c.MatchPointThreshold,
            c.ProofMode,
            c.ReportWindowMinutes,
            c.MissingReportZero,
        };

        // ─── Tabla de puntos y reglas ──────────────────────────────────────────

        public class UpdateConfigRequest
        {
            public List<FortnitePlacementRange> PlacementPoints { get; set; } = new();
            public int PointsPerElimination { get; set; }
            public List<string> Tiebreakers { get; set; } = new();
            public short MaxPlayersPerLobby { get; set; } = 100;
            public bool FillSolosRandomly { get; set; } = true;
            public int? MatchPointThreshold { get; set; }
            public string ProofMode { get; set; } = "always";
            public int ReportWindowMinutes { get; set; } = 30;
            public bool MissingReportZero { get; set; } = true;
        }

        [HttpPut("config")]
        public async Task<IActionResult> UpdateConfig(long editionId, [FromBody] UpdateConfigRequest request)
        {
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            var placementError = TournamentFortniteFormatService.ValidatePlacement(request.PlacementPoints);
            if (placementError != null)
                return BadRequest(new { success = false, message = placementError });
            if (request.PointsPerElimination < 0 || request.PointsPerElimination > 100)
                return BadRequest(new { success = false, message = "Los puntos por eliminación tienen que estar entre 0 y 100" });
            if (request.MaxPlayersPerLobby < 2 || request.MaxPlayersPerLobby > 100)
                return BadRequest(new { success = false, message = "El lobby admite entre 2 y 100 jugadores" });
            if (request.MatchPointThreshold is <= 0)
                return BadRequest(new { success = false, message = "El match point tiene que ser mayor que 0" });

            if (!TournamentFortniteResultsService.ProofModes.Contains(request.ProofMode))
                return BadRequest(new { success = false, message = "Modo de pruebas no válido" });
            if (request.ReportWindowMinutes < 5 || request.ReportWindowMinutes > 24 * 60)
                return BadRequest(new { success = false, message = "El tiempo para reportar va de 5 minutos a 24 horas" });

            var tiebreakers = request.Tiebreakers.Distinct().ToList();
            if (tiebreakers.Any(t => !TournamentFortniteFormatService.ValidTiebreakers.Contains(t)))
                return BadRequest(new { success = false, message = "Desempate no válido" });

            var config = await _format.GetOrCreateConfigAsync(_dbContext, edition!);
            config.PlacementPoints = JsonSerializer.Serialize(request.PlacementPoints.OrderBy(r => r.From).ToList(), Json);
            config.PointsPerElimination = request.PointsPerElimination;
            config.Tiebreakers = tiebreakers.ToArray();
            config.MaxPlayersPerLobby = request.MaxPlayersPerLobby;
            config.FillSolosRandomly = request.FillSolosRandomly;
            config.MatchPointThreshold = request.MatchPointThreshold;
            config.ProofMode = request.ProofMode;
            config.ReportWindowMinutes = request.ReportWindowMinutes;
            config.MissingReportZero = request.MissingReportZero;
            config.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true, config = ToConfigDto(config) });
        }

        // ─── Equipos ───────────────────────────────────────────────────────────

        [HttpPost("teams/build")]
        public async Task<IActionResult> BuildTeams(long editionId)
        {
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            var config = await _format.GetOrCreateConfigAsync(_dbContext, edition!);
            var result = await _format.BuildTeamsAsync(_dbContext, edition!, config);
            return Ok(new { success = true, result });
        }

        // ─── Grupos ────────────────────────────────────────────────────────────

        public class GenerateGroupsRequest
        {
            public int? GroupCount { get; set; }
            public int? QualifyCount { get; set; }
        }

        [HttpPost("groups/generate")]
        public async Task<IActionResult> GenerateGroups(long editionId, [FromBody] GenerateGroupsRequest request)
        {
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            if (request.GroupCount is < 2 or > 50)
                return BadRequest(new { success = false, message = "La cantidad de grupos tiene que estar entre 2 y 50" });
            if (request.QualifyCount is < 1)
                return BadRequest(new { success = false, message = "Tiene que pasar al menos un equipo por grupo" });

            var config = await _format.GetOrCreateConfigAsync(_dbContext, edition!);
            var (groups, genError) = await _format.GenerateGroupsAsync(_dbContext, edition!, config, request.GroupCount, request.QualifyCount);
            if (genError != null)
                return BadRequest(new { success = false, message = genError });

            return Ok(new { success = true, groups = groups!.Count });
        }

        [HttpPost("groups/final")]
        public async Task<IActionResult> CreateFinal(long editionId)
        {
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            var final = await _format.CreateFinalAsync(_dbContext, edition!);
            return Ok(new { success = true, groupId = final.Id });
        }

        public class UpdateGroupRequest
        {
            public string Name { get; set; } = "";
            public short? QualifyCount { get; set; }
        }

        [HttpPut("groups/{groupId}")]
        public async Task<IActionResult> UpdateGroup(long editionId, long groupId, [FromBody] UpdateGroupRequest request)
        {
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            var group = await _dbContext.TournamentFortniteGroups.FirstOrDefaultAsync(g => g.Id == groupId && g.TournamentEditionId == editionId);
            if (group == null) return NotFound(new { success = false, message = "Grupo no encontrado" });
            if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 60)
                return BadRequest(new { success = false, message = "El nombre es requerido (máximo 60 caracteres)" });
            if (!group.IsFinal && request.QualifyCount is < 1)
                return BadRequest(new { success = false, message = "Tiene que pasar al menos un equipo" });

            group.Name = request.Name.Trim();
            group.QualifyCount = group.IsFinal ? null : request.QualifyCount;
            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("groups/{groupId}")]
        public async Task<IActionResult> DeleteGroup(long editionId, long groupId)
        {
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            var group = await _dbContext.TournamentFortniteGroups.FirstOrDefaultAsync(g => g.Id == groupId && g.TournamentEditionId == editionId);
            if (group == null) return NotFound(new { success = false, message = "Grupo no encontrado" });

            var started = await _dbContext.TournamentFortniteSessions.AnyAsync(s => s.GroupId == groupId && s.Status != "scheduled");
            if (started)
                return BadRequest(new { success = false, message = "Ese grupo ya tiene sesiones empezadas" });

            _dbContext.TournamentFortniteGroups.Remove(group);
            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true });
        }

        public class GroupTeamRequest
        {
            public long TeamId { get; set; }
        }

        [HttpPost("groups/{groupId}/teams")]
        public async Task<IActionResult> AddTeamToGroup(long editionId, long groupId, [FromBody] GroupTeamRequest request)
        {
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            var group = await _dbContext.TournamentFortniteGroups.FirstOrDefaultAsync(g => g.Id == groupId && g.TournamentEditionId == editionId);
            if (group == null) return NotFound(new { success = false, message = "Grupo no encontrado" });

            var addError = await _format.AddTeamToGroupAsync(_dbContext, edition!, group, request.TeamId);
            if (addError != null) return BadRequest(new { success = false, message = addError });
            return Ok(new { success = true });
        }

        [HttpDelete("groups/{groupId}/teams/{teamId}")]
        public async Task<IActionResult> RemoveTeamFromGroup(long editionId, long groupId, long teamId)
        {
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            var row = await _dbContext.TournamentFortniteGroupTeams.FirstOrDefaultAsync(gt =>
                gt.GroupId == groupId && gt.TeamId == teamId &&
                _dbContext.TournamentFortniteGroups.Any(g => g.Id == groupId && g.TournamentEditionId == editionId));
            if (row == null) return NotFound(new { success = false, message = "Ese equipo no está en el grupo" });

            _dbContext.TournamentFortniteGroupTeams.Remove(row);
            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true });
        }

        // ─── Sesiones ──────────────────────────────────────────────────────────

        public class SessionRequest
        {
            public long? GroupId { get; set; }
            public string Name { get; set; } = "";
            public DateTime? ScheduledAt { get; set; }
            public int Games { get; set; } = 1;
        }

        private async Task<string?> ValidateSessionAsync(long editionId, SessionRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 80)
                return "El nombre es requerido (máximo 80 caracteres)";
            if (request.Games < 1 || request.Games > TournamentFortniteFormatService.MaxGamesPerSession)
                return $"Una sesión tiene entre 1 y {TournamentFortniteFormatService.MaxGamesPerSession} partidas";
            if (request.GroupId != null &&
                !await _dbContext.TournamentFortniteGroups.AnyAsync(g => g.Id == request.GroupId && g.TournamentEditionId == editionId))
                return "Grupo no encontrado";
            return null;
        }

        [HttpPost("sessions")]
        public async Task<IActionResult> CreateSession(long editionId, [FromBody] SessionRequest request)
        {
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            var validation = await ValidateSessionAsync(editionId, request);
            if (validation != null) return BadRequest(new { success = false, message = validation });

            var session = await _format.CreateSessionAsync(_dbContext, edition!, request.GroupId, request.Name, request.ScheduledAt, request.Games);
            return Ok(new { success = true, sessionId = session.Id });
        }

        [HttpPut("sessions/{sessionId}")]
        public async Task<IActionResult> UpdateSession(long editionId, long sessionId, [FromBody] SessionRequest request)
        {
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            var session = await _dbContext.TournamentFortniteSessions.FirstOrDefaultAsync(s => s.Id == sessionId && s.TournamentEditionId == editionId);
            if (session == null) return NotFound(new { success = false, message = "Sesión no encontrada" });

            var validation = await ValidateSessionAsync(editionId, request);
            if (validation != null) return BadRequest(new { success = false, message = validation });
            if (session.Status != "scheduled" && request.GroupId != session.GroupId)
                return BadRequest(new { success = false, message = "La sesión ya empezó: no se puede cambiar de grupo" });

            var countError = await _format.SetGameCountAsync(_dbContext, session, request.Games);
            if (countError != null) return BadRequest(new { success = false, message = countError });

            session.Name = request.Name.Trim();
            session.ScheduledAt = request.ScheduledAt;
            session.GroupId = request.GroupId;
            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("sessions/{sessionId}")]
        public async Task<IActionResult> DeleteSession(long editionId, long sessionId)
        {
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            var session = await _dbContext.TournamentFortniteSessions.FirstOrDefaultAsync(s => s.Id == sessionId && s.TournamentEditionId == editionId);
            if (session == null) return NotFound(new { success = false, message = "Sesión no encontrada" });
            if (session.Status != "scheduled")
                return BadRequest(new { success = false, message = "La sesión ya empezó: no se puede borrar" });

            _dbContext.TournamentFortniteSessions.Remove(session);
            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true });
        }

        // ─── Dia de partida (F3) ───────────────────────────────────────────────

        private Task<TournamentFortniteSession?> GetSessionAsync(long editionId, long sessionId) =>
            _dbContext.TournamentFortniteSessions.FirstOrDefaultAsync(s => s.Id == sessionId && s.TournamentEditionId == editionId);

        private async Task<(TournamentFortniteSession? session, TournamentFortniteGame? game)> GetGameAsync(long editionId, long gameId)
        {
            var game = await _dbContext.TournamentFortniteGames.FirstOrDefaultAsync(g => g.Id == gameId);
            if (game == null) return (null, null);
            var session = await GetSessionAsync(editionId, game.SessionId);
            return session == null ? (null, null) : (session, game);
        }

        [HttpGet("sessions/{sessionId}/matchday")]
        public async Task<IActionResult> GetMatchday(long editionId, long sessionId)
        {
            var (edition, error) = await ResolveAsync(editionId, write: false);
            if (error != null) return error;

            var session = await GetSessionAsync(editionId, sessionId);
            if (session == null) return NotFound(new { success = false, message = "Sesión no encontrada" });

            var players = await _matchday.GetEligibleParticipantsAsync(_dbContext, session);
            var checkins = await _dbContext.TournamentFortniteSessionCheckins
                .Where(c => c.SessionId == sessionId)
                .ToDictionaryAsync(c => c.ParticipantId);
            var teamNames = await _dbContext.TournamentTeams
                .Where(t => t.TournamentEditionId == editionId)
                .ToDictionaryAsync(t => t.Id, t => t.Name);
            var games = await _dbContext.TournamentFortniteGames
                .Where(g => g.SessionId == sessionId)
                .OrderBy(g => g.GameNumber)
                .ToListAsync();

            return Ok(new
            {
                success = true,
                session = new { session.Id, session.Name, session.Status, session.ScheduledAt, session.GroupId },
                players = players.Select(p => new
                {
                    p.Id,
                    p.DisplayName,
                    p.GameAccountName,
                    p.TeamId,
                    teamName = p.TeamId != null ? teamNames.GetValueOrDefault(p.TeamId.Value) : null,
                    checkedIn = checkins.ContainsKey(p.Id),
                    checkedInBy = checkins.TryGetValue(p.Id, out var c) ? c.CheckedInBy : null,
                }),
                games = games.Select(g => new { g.Id, g.GameNumber, g.Status, g.CustomCode, g.RevealedAt, g.StartedAt, g.EndedAt }),
            });
        }

        public class StatusRequest
        {
            public string Status { get; set; } = "";
        }

        [HttpPost("sessions/{sessionId}/status")]
        public async Task<IActionResult> SetSessionStatus(long editionId, long sessionId, [FromBody] StatusRequest request)
        {
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            var session = await GetSessionAsync(editionId, sessionId);
            if (session == null) return NotFound(new { success = false, message = "Sesión no encontrada" });

            var transitionError = _matchday.ValidateSessionTransition(session.Status, request.Status);
            if (transitionError != null) return BadRequest(new { success = false, message = transitionError });

            session.Status = request.Status;
            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true });
        }

        public class CheckInRequest
        {
            public bool CheckedIn { get; set; }
        }

        [HttpPost("sessions/{sessionId}/checkins/{participantId}")]
        public async Task<IActionResult> SetCheckIn(long editionId, long sessionId, long participantId, [FromBody] CheckInRequest request)
        {
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            var session = await GetSessionAsync(editionId, sessionId);
            if (session == null) return NotFound(new { success = false, message = "Sesión no encontrada" });

            var participant = await _dbContext.TournamentParticipants.FirstOrDefaultAsync(p => p.Id == participantId && p.TournamentEditionId == editionId);
            if (participant == null) return NotFound(new { success = false, message = "Jugador no encontrado" });
            if (request.CheckedIn && !await _matchday.IsEligibleAsync(_dbContext, session, participant))
                return BadRequest(new { success = false, message = "Ese jugador no juega en esta sesión" });

            await _matchday.SetCheckInAsync(_dbContext, sessionId, participantId, request.CheckedIn, "staff");
            return Ok(new { success = true });
        }

        public class CodeRequest
        {
            public string Code { get; set; } = "";
        }

        [HttpPut("games/{gameId}/code")]
        public async Task<IActionResult> SetGameCode(long editionId, long gameId, [FromBody] CodeRequest request)
        {
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            var (session, game) = await GetGameAsync(editionId, gameId);
            if (game == null) return NotFound(new { success = false, message = "Partida no encontrada" });

            var code = request.Code.Trim();
            if (code.Length is 0 or > 60)
                return BadRequest(new { success = false, message = "El código tiene entre 1 y 60 caracteres" });
            if (game.Status is "reporting" or "closed")
                return BadRequest(new { success = false, message = "Esa partida ya terminó" });

            game.CustomCode = code;
            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true });
        }

        public class RevealRequest
        {
            public bool AnnounceInChat { get; set; } = true;
            public bool SendDiscordDm { get; set; } = true;
        }

        [HttpPost("games/{gameId}/reveal")]
        public async Task<IActionResult> RevealGame(long editionId, long gameId, [FromBody] RevealRequest request)
        {
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            var (session, game) = await GetGameAsync(editionId, gameId);
            if (game == null) return NotFound(new { success = false, message = "Partida no encontrada" });
            if (string.IsNullOrWhiteSpace(game.CustomCode))
                return BadRequest(new { success = false, message = "Primero pon el código de la partida personalizada" });
            if (session!.Status == "finished")
                return BadRequest(new { success = false, message = "La sesión ya terminó" });
            if (game.Status is "reporting" or "closed")
                return BadRequest(new { success = false, message = "Esa partida ya terminó" });

            var result = await _matchday.RevealAsync(_dbContext, edition!, session, game, request.AnnounceInChat, request.SendDiscordDm);
            return Ok(new { success = true, result });
        }

        [HttpPost("games/{gameId}/status")]
        public async Task<IActionResult> SetGameStatus(long editionId, long gameId, [FromBody] StatusRequest request)
        {
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            var (session, game) = await GetGameAsync(editionId, gameId);
            if (game == null) return NotFound(new { success = false, message = "Partida no encontrada" });

            var transitionError = _matchday.ValidateGameTransition(game, request.Status);
            if (transitionError != null) return BadRequest(new { success = false, message = transitionError });

            if (request.Status == "closed")
            {
                var config = await _format.GetOrCreateConfigAsync(_dbContext, edition!);
                var closeError = await _results.PrepareCloseAsync(_dbContext, editionId, config, session!, game);
                if (closeError != null) return BadRequest(new { success = false, message = closeError });
            }

            _matchday.ApplyGameStatus(game, request.Status);
            if (request.Status != "waiting" && session!.Status is "scheduled" or "check_in")
                session.Status = "in_progress";
            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true });
        }
    
        // ─── Resultados (F4) ───────────────────────────────────────────────────

        [HttpGet("games/{gameId}/review")]
        public async Task<IActionResult> GetReview(long editionId, long gameId)
        {
            var (edition, error) = await ResolveAsync(editionId, write: false);
            if (error != null) return error;

            var (session, game) = await GetGameAsync(editionId, gameId);
            if (game == null) return NotFound(new { success = false, message = "Partida no encontrada" });

            var config = await _format.GetOrCreateConfigAsync(_dbContext, edition!);
            var review = await _results.BuildReviewAsync(_dbContext, config, session!, game);

            return Ok(new
            {
                success = true,
                game = new { game.Id, game.GameNumber, game.Status },
                proofMode = config.ProofMode,
                review.Deadline,
                review.GameFlags,
                teams = review.Teams.Select(t => new
                {
                    t.TeamId,
                    t.TeamName,
                    t.Members,
                    t.ReportedPlacement,
                    t.ReportedEliminations,
                    t.Flags,
                    t.Points,
                    result = t.Result == null ? null : new { t.Result.Status, t.Result.Placement, t.Result.Eliminations, t.Result.Source },
                }),
            });
        }

        private async Task<(TournamentFortniteResultsService.GameReview? review, TournamentFortniteGame? game, IActionResult? error)> LoadReviewAsync(
            TournamentEdition edition, long gameId)
        {
            var (session, game) = await GetGameAsync(edition.Id, gameId);
            if (game == null) return (null, null, NotFound(new { success = false, message = "Partida no encontrada" }));
            var config = await _format.GetOrCreateConfigAsync(_dbContext, edition);
            return (await _results.BuildReviewAsync(_dbContext, config, session!, game), game, null);
        }

        [HttpPost("games/{gameId}/results/{teamId}/approve")]
        public async Task<IActionResult> ApproveResult(long editionId, long gameId, long teamId)
        {
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            var (review, game, loadError) = await LoadReviewAsync(edition!, gameId);
            if (loadError != null) return loadError;

            var team = review!.Teams.FirstOrDefault(t => t.TeamId == teamId);
            if (team == null) return NotFound(new { success = false, message = "Ese equipo no juega esta partida" });

            var approveError = await _results.ApproveAsync(_dbContext, editionId, game!, team, GetUserId());
            if (approveError != null) return BadRequest(new { success = false, message = approveError });
            return Ok(new { success = true });
        }

        /// <summary>Aprueba de una vez todos los equipos que reportaron sin ninguna alerta.</summary>
        [HttpPost("games/{gameId}/results/approve-clean")]
        public async Task<IActionResult> ApproveClean(long editionId, long gameId)
        {
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            var (review, game, loadError) = await LoadReviewAsync(edition!, gameId);
            if (loadError != null) return loadError;

            var approved = 0;
            foreach (var team in review!.Teams.Where(t => t.Result == null && t.Flags.Count == 0 && t.ReportedPlacement != null))
            {
                if (await _results.ApproveAsync(_dbContext, editionId, game!, team, GetUserId()) == null) approved++;
            }
            return Ok(new { success = true, approved });
        }

        /// <summary>
        /// Carga, correccion, rechazo o reapertura por parte del organizador.
        /// multipart: rows (JSON de StaffRow[]), reason, files (justificantes).
        /// </summary>
        [HttpPost("games/{gameId}/results/staff")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(60 * 1024 * 1024)]
        public async Task<IActionResult> StaffSetResults(long editionId, long gameId, [FromForm] string rows, [FromForm] string? reason, [FromForm] List<IFormFile>? files)
        {
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            var (review, game, loadError) = await LoadReviewAsync(edition!, gameId);
            if (loadError != null) return loadError;
            if (game!.Status is "waiting" or "revealed")
                return BadRequest(new { success = false, message = "La partida todavía no se jugó" });
            if (game.Status == "closed")
                return BadRequest(new { success = false, message = "La partida está cerrada: vuelve a abrir el reporte para cambiar resultados" });

            List<TournamentFortniteResultsService.StaffRow>? parsedRows;
            try { parsedRows = JsonSerializer.Deserialize<List<TournamentFortniteResultsService.StaffRow>>(rows, Json); }
            catch { parsedRows = null; }
            if (parsedRows == null) return BadRequest(new { success = false, message = "Filas inválidas" });

            // Validaciones baratas antes de guardar archivos, para no dejar justificantes
            // sueltos si el cambio igual se va a rechazar.
            if (string.IsNullOrWhiteSpace(reason))
                return BadRequest(new { success = false, message = "Escribe el motivo del cambio" });
            if (parsedRows.Any(r => r.Status == "approved") && (files?.Count ?? 0) == 0)
                return BadRequest(new { success = false, message = "Para cargar o corregir un resultado sube al menos un justificante (captura)" });
            if ((files?.Count ?? 0) > 10)
                return BadRequest(new { success = false, message = "Máximo 10 justificantes por cambio" });

            var evidenceIds = new List<long>();
            foreach (var f in files ?? new List<IFormFile>())
            {
                var (jpeg, imageError) = await TournamentImageProcessor.ToJpegAsync(f);
                if (jpeg == null) return BadRequest(new { success = false, message = imageError });
                var saved = await _results.StoreJpegAsync(_dbContext, editionId, jpeg, "evidence", GetUserId());
                evidenceIds.Add(saved.Id);
            }

            var validTeams = review!.Teams.Select(t => t.TeamId).ToHashSet();
            var setError = await _results.StaffSetAsync(_dbContext, editionId, game, parsedRows, reason, evidenceIds, GetUserId(), validTeams);
            if (setError != null) return BadRequest(new { success = false, message = setError });
            return Ok(new { success = true });
        }

        /// <summary>Capturas y justificantes de la edicion (solo organizador).</summary>
        [HttpGet("files/{fileId}")]
        public async Task<IActionResult> GetFile(long editionId, long fileId)
        {
            var (edition, error) = await ResolveAsync(editionId, write: false);
            if (error != null) return error;

            var file = await _dbContext.TournamentFortniteFiles.FirstOrDefaultAsync(f => f.Id == fileId && f.TournamentEditionId == editionId);
            if (file == null) return NotFound();
            var path = _results.PathFor(file);
            if (!System.IO.File.Exists(path)) return NotFound();
            return PhysicalFile(path, file.ContentType);
        }

        /// <summary>Historial de cambios del organizador en la edicion.</summary>
        [HttpGet("audit")]
        public async Task<IActionResult> GetAudit(long editionId)
        {
            var (edition, error) = await ResolveAsync(editionId, write: false);
            if (error != null) return error;
            return Ok(new { success = true, entries = await TournamentFortniteAuditQuery.ListAsync(_dbContext, editionId) });
        }
}
}
