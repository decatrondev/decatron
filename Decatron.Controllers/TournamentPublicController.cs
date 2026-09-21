using Decatron.Data;
using Decatron.Services.Tournament;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Linq;

namespace Decatron.Controllers
{
    /// <summary>
    /// Milestone 1 del modulo de Torneos — frontend publico, sin auth. Ver
    /// .dev/torneos/11-frontend-publico.md. Cubre home/ranking, detalle de
    /// participante, premios y normas — Pick'em y Tier List quedan afuera
    /// (diferidos, ver 11-frontend-publico.md #7 y #8).
    ///
    /// Rutas por /torneos/{channelName}/{editionSlug}/... (login de Twitch como
    /// identificador de canal, mismo patron que /commands/:channelName ya usado en
    /// la plataforma — confirmado en el checklist tecnico de ESTADO.md).
    /// </summary>
    [ApiController]
    [Route("api/public/tournament")]
    public class TournamentPublicController : ControllerBase
    {
        public class PublicRankingRow
        {
            public long Id { get; set; }
            public string DisplayName { get; set; } = "";
            public string? RiotId { get; set; }
            public string? RiotTagLine { get; set; }
            public string? PrimaryRole { get; set; }
            public string? Nationality { get; set; }
            public string? TwitchChannel { get; set; }
            public string? KickChannel { get; set; }
            public int? CurrentLp { get; set; }
            public int Wins { get; set; }
            public int Losses { get; set; }
            public int MatchesPlayed { get; set; }
            // Ultimas N, mas vieja primero — "win"/"loss". Usado por el frontend para
            // la mini-linea de racha acumulada (senal de momentum, no LP crudo — el LP
            // historico backfillado no varia entre partidas viejas, ver ESTADO.md).
            public List<string> RecentForm { get; set; } = new();
        }

        private readonly DecatronDbContext _dbContext;
        private readonly TournamentPrizeService _prizeService;
        private readonly Decatron.Services.IStreamStatusService _streamStatusService;

        public TournamentPublicController(DecatronDbContext dbContext, TournamentPrizeService prizeService, Decatron.Services.IStreamStatusService streamStatusService)
        {
            _dbContext = dbContext;
            _prizeService = prizeService;
            _streamStatusService = streamStatusService;
        }

        private async Task<Core.Models.Tournament.TournamentEdition?> ResolveEditionAsync(string channelName, string editionSlug)
        {
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Login.ToLower() == channelName.ToLower());
            if (user == null) return null;

            var edition = await _dbContext.TournamentEditions.FirstOrDefaultAsync(e =>
                e.ChannelOwnerId == user.Id && e.Slug == editionSlug && e.Status != "draft");

            return edition;
        }

        [HttpGet("{channelName}/{editionSlug}")]
        public async Task<IActionResult> GetHome(string channelName, string editionSlug)
        {
            var edition = await ResolveEditionAsync(channelName, editionSlug);
            if (edition == null)
                return NotFound(new { success = false, message = "Torneo no encontrado" });

            var channelOwnerTwitchId = await _dbContext.Users
                .Where(u => u.Id == edition.ChannelOwnerId)
                .Select(u => u.TwitchId)
                .FirstOrDefaultAsync();
            var isLive = !string.IsNullOrEmpty(channelOwnerTwitchId) && _streamStatusService.IsLive(channelOwnerTwitchId);

            var participants = await _dbContext.TournamentParticipants
                .Where(p => p.TournamentEditionId == edition.Id && p.Status == "approved")
                .ToListAsync();

            var ranking = new List<PublicRankingRow>();
            foreach (var p in participants)
            {
                var snapshots = await _dbContext.TournamentLpSnapshots
                    .Where(s => s.TournamentParticipantId == p.Id)
                    .OrderByDescending(s => s.OccurredAt)
                    .ToListAsync();

                ranking.Add(new PublicRankingRow
                {
                    Id = p.Id,
                    DisplayName = p.DisplayName,
                    RiotId = p.RiotId,
                    RiotTagLine = p.RiotTagLine,
                    PrimaryRole = p.PrimaryRole,
                    Nationality = p.Nationality,
                    TwitchChannel = p.TwitchChannel,
                    KickChannel = p.KickChannel,
                    CurrentLp = snapshots.FirstOrDefault()?.LpAfter,
                    Wins = snapshots.Count(s => s.Result == "win"),
                    Losses = snapshots.Count(s => s.Result == "loss"),
                    MatchesPlayed = snapshots.Count,
                    RecentForm = snapshots.Take(10).Select(s => s.Result).Reverse().ToList(),
                });
            }

            var ordered = ranking.OrderByDescending(r => r.CurrentLp ?? -1).ToList();

            return Ok(new
            {
                success = true,
                edition = new
                {
                    edition.Name,
                    edition.Slug,
                    edition.Mode,
                    edition.Region,
                    edition.Status,
                    edition.BracketFormat,
                    edition.TeamSize,
                    edition.StartsAt,
                    edition.EndsAt,
                    edition.LogoUrl,
                    edition.PrimaryColor,
                    edition.ShellItemName,
                    edition.AegisMechanicName,
                },
                isLive = isLive,
                ranking = ordered,
                sponsors = await GetActiveSponsorsAsync(edition.Id),
            });
        }

        private async Task<List<object>> GetActiveSponsorsAsync(long editionId)
        {
            var sponsors = await _dbContext.TournamentSponsors
                .Where(s => s.TournamentEditionId == editionId && s.Status == "active")
                .OrderBy(s => s.SortOrder)
                .ToListAsync();

            return sponsors.Select(s => (object)new
            {
                s.Name,
                s.LogoUrl,
                s.CtaText,
                s.CtaUrl,
                Slots = System.Text.Json.JsonSerializer.Deserialize<List<string>>(s.Slots) ?? new List<string>(),
            }).ToList();
        }

        [HttpGet("{channelName}/{editionSlug}/participants/{participantId}")]
        public async Task<IActionResult> GetParticipantDetail(string channelName, string editionSlug, long participantId)
        {
            var edition = await ResolveEditionAsync(channelName, editionSlug);
            if (edition == null)
                return NotFound(new { success = false, message = "Torneo no encontrado" });

            var participant = await _dbContext.TournamentParticipants
                .FirstOrDefaultAsync(p => p.Id == participantId && p.TournamentEditionId == edition.Id);
            if (participant == null)
                return NotFound(new { success = false, message = "Participante no encontrado" });

            var history = await _dbContext.TournamentLpSnapshots
                .Where(s => s.TournamentParticipantId == participantId)
                .OrderByDescending(s => s.OccurredAt)
                .Take(20)
                .Select(s => new
                {
                    s.RiotMatchId,
                    s.OccurredAt,
                    s.Result,
                    s.Champion,
                    s.Kills,
                    s.Deaths,
                    s.Assists,
                    s.CsPerMin,
                    s.DurationSeconds,
                    s.LpBefore,
                    s.LpAfter,
                    s.AegisTriggered,
                    s.PentaKills,
                })
                .ToListAsync();

            var inventory = await _dbContext.TournamentShellInventories
                .FirstOrDefaultAsync(i => i.TournamentParticipantId == participantId);

            var shellEvents = await _dbContext.TournamentShellEvents
                .Where(e => e.TournamentEditionId == edition.Id && (e.SourceParticipantId == participantId || e.TargetParticipantId == participantId))
                .OrderByDescending(e => e.CreatedAt)
                .Take(15)
                .Select(e => new { e.Type, e.SourceParticipantId, e.TargetParticipantId, e.WasReverse, e.FulfilledAt, e.CreatedAt })
                .ToListAsync();

            return Ok(new
            {
                success = true,
                participant = new
                {
                    participant.Id,
                    participant.DisplayName,
                    participant.RiotId,
                    participant.RiotTagLine,
                    participant.PrimaryRole,
                    participant.Nationality,
                    participant.TwitchChannel,
                    participant.KickChannel,
                    participant.TwitterHandle,
                },
                history,
                inventory = inventory != null ? new { inventory.Count, inventory.TotalObtained, inventory.TotalThrown, inventory.TotalReceived, inventory.TotalStolen } : null,
                shellEvents,
            });
        }

        /// <summary>
        /// Milestone 4 — equipos + bracket para ediciones ARAM N vs N / Clash 5v5.
        /// No aplica a solo_q_climb (esas ediciones usan /participants + ranking).
        /// </summary>
        [HttpGet("{channelName}/{editionSlug}/bracket")]
        public async Task<IActionResult> GetBracket(string channelName, string editionSlug)
        {
            var edition = await ResolveEditionAsync(channelName, editionSlug);
            if (edition == null)
                return NotFound(new { success = false, message = "Torneo no encontrado" });

            var teams = await _dbContext.TournamentTeams
                .Where(t => t.TournamentEditionId == edition.Id)
                .OrderBy(t => t.Seed ?? short.MaxValue)
                .ToListAsync();

            var members = await _dbContext.TournamentParticipants
                .Where(p => p.TournamentEditionId == edition.Id && p.TeamId != null)
                .ToListAsync();

            var teamDtos = teams.Select(t => new
            {
                t.Id,
                t.Name,
                t.Seed,
                Roster = members.Where(m => m.TeamId == t.Id).Select(m => new { m.DisplayName, m.IsCaptain, m.IsSubstitute }).ToList(),
            });

            var matches = await _dbContext.TournamentMatches
                .Where(m => m.TournamentEditionId == edition.Id)
                .OrderBy(m => m.RoundNumber).ThenBy(m => m.BracketPosition)
                .ToListAsync();

            var teamNames = teams.ToDictionary(t => t.Id, t => t.Name);

            var matchDtos = matches.Select(m => new
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
                WinnerName = m.WinnerTeamId.HasValue ? teamNames.GetValueOrDefault(m.WinnerTeamId.Value) : null,
            });

            return Ok(new { success = true, teams = teamDtos, matches = matchDtos, bracketFormat = edition.BracketFormat });
        }

        /// <summary>
        /// Lista plana de participantes de la edicion (jugador individual, con o sin
        /// equipo asignado) — para la tab "Jugadores" del frontend publico en modos
        /// de equipo (ARAM N vs N, Clash 5v5). Distinto de GetBracket, que solo trae
        /// participantes ya agrupados por equipo.
        /// </summary>
        [HttpGet("{channelName}/{editionSlug}/participants")]
        public async Task<IActionResult> GetParticipants(string channelName, string editionSlug)
        {
            var edition = await ResolveEditionAsync(channelName, editionSlug);
            if (edition == null)
                return NotFound(new { success = false, message = "Torneo no encontrado" });

            var participants = await _dbContext.TournamentParticipants
                .Where(p => p.TournamentEditionId == edition.Id && p.Status == "approved")
                .ToListAsync();

            var teamNames = await _dbContext.TournamentTeams
                .Where(t => t.TournamentEditionId == edition.Id)
                .ToDictionaryAsync(t => t.Id, t => t.Name);

            var result = participants.Select(p => new
            {
                p.Id,
                p.DisplayName,
                p.RiotId,
                p.RiotTagLine,
                p.PrimaryRole,
                p.Nationality,
                p.TwitchChannel,
                p.KickChannel,
                p.TeamId,
                TeamName = p.TeamId.HasValue ? teamNames.GetValueOrDefault(p.TeamId.Value) : null,
                p.IsCaptain,
                p.IsSubstitute,
            }).OrderBy(p => p.TeamName == null ? 1 : 0).ThenBy(p => p.TeamName).ThenByDescending(p => p.IsCaptain);

            return Ok(new { success = true, participants = result });
        }

        [HttpGet("{channelName}/{editionSlug}/prizes")]
        public async Task<IActionResult> GetPrizes(string channelName, string editionSlug)
        {
            var edition = await ResolveEditionAsync(channelName, editionSlug);
            if (edition == null)
                return NotFound(new { success = false, message = "Torneo no encontrado" });

            var tiers = await _dbContext.TournamentPrizeTiers
                .Where(t => t.TournamentEditionId == edition.Id)
                .OrderBy(t => t.SortOrder)
                .ToListAsync();

            var results = new List<object>();
            foreach (var tier in tiers)
            {
                object? leader = null;
                if (tier.Scope == "by_metric" && !string.IsNullOrEmpty(tier.MetricKey))
                {
                    var leaderResult = await _prizeService.GetLeaderAsync(_dbContext, edition.Id, tier.MetricKey);
                    leader = leaderResult.ParticipantId != null ? new { leaderResult.DisplayName, leaderResult.Value } : null;
                }

                results.Add(new
                {
                    tier.Name,
                    tier.Description,
                    Amount = tier.AmountHidden ? (decimal?)null : tier.Amount,
                    tier.AmountHidden,
                    tier.Scope,
                    tier.Rank,
                    tier.Role,
                    Leader = leader,
                });
            }

            return Ok(new { success = true, prizes = results });
        }

        [HttpGet("{channelName}/{editionSlug}/rules")]
        public async Task<IActionResult> GetRules(string channelName, string editionSlug)
        {
            var edition = await ResolveEditionAsync(channelName, editionSlug);
            if (edition == null)
                return NotFound(new { success = false, message = "Torneo no encontrado" });

            var docs = await _dbContext.TournamentRuleDocuments
                .Where(d => d.TournamentEditionId == edition.Id)
                .ToListAsync();

            return Ok(new
            {
                success = true,
                general = docs.FirstOrDefault(d => d.Type == "general")?.ContentMarkdown ?? "",
                punishments = docs.FirstOrDefault(d => d.Type == "punishments")?.ContentMarkdown ?? "",
            });
        }

        // La inscripcion publica anonima (POST .../register) se saco de acá —
        // ahora vive en TournamentMeController (api/me/tournament/.../register),
        // requiere sesion propia del participante. Decision de producto 15-08-2026:
        // "todos los participantes deben estar logeando... y luego vincular su
        // cuenta de riot", ver .dev/torneos/ESTADO.md.
    }
}
