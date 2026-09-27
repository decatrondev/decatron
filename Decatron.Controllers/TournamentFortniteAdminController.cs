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

        public TournamentFortniteAdminController(
            DecatronDbContext dbContext, TournamentFortniteFormatService format, TournamentFortniteMatchdayService matchday, IPermissionService permissionService)
            : base(dbContext, permissionService)
        {
            _dbContext = dbContext;
            _format = format;
            _matchday = matchday;
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

            _matchday.ApplyGameStatus(game, request.Status);
            if (request.Status != "waiting" && session!.Status is "scheduled" or "check_in")
                session.Status = "in_progress";
            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true });
        }
    }
}
