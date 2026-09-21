using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using System.Linq;

namespace Decatron.Services.Tournament
{
    public class TeamActionResult
    {
        public bool Success { get; set; }
        public string? Error { get; set; }
        public TournamentTeam? Team { get; set; }
    }

    /// <summary>
    /// Registro de equipos para modos ARAM N vs N y Clash 5v5 — ver
    /// .dev/torneos/02-motor-de-torneo-formatos.md y la conversacion de esta sesion
    /// sobre las definiciones reales de cada modo: Clash es "cada streamer registra
    /// su equipo con validacion de suplentes", ARAM es bracket con tamaño de equipo
    /// configurable en lobby custom (1v1 a 5v5).
    ///
    /// Flujo: un capitan crea el equipo (queda con codigo de invitacion propio), el
    /// resto se suma con ese codigo como titular o suplente. Alta manual del
    /// organizador tambien soportada (mismo servicio, sin pasar por codigo).
    /// </summary>
    public class TournamentTeamService
    {
        private static readonly Random _random = new();
        private const string CodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I para evitar confusion

        public async Task<TeamActionResult> CreateTeamAsync(DecatronDbContext db, TournamentEdition edition, string teamName, CancellationToken ct = default)
        {
            // TeamSize == 1 es valido (torneo 1v1, cada "equipo" tiene un solo jugador) —
            // solo se rechaza si la edicion directamente no tiene tamaño de equipo
            // configurado (solo_q_climb, que no usa TournamentTeam en absoluto).
            if (edition.TeamSize == null || edition.TeamSize < 1)
                return new TeamActionResult { Success = false, Error = "Esta edición no es de formato por equipos" };

            if (string.IsNullOrWhiteSpace(teamName))
                return new TeamActionResult { Success = false, Error = "El nombre del equipo es requerido" };

            var team = new TournamentTeam
            {
                TournamentEditionId = edition.Id,
                Name = teamName.Trim(),
                JoinCode = await GenerateUniqueJoinCodeAsync(db, ct),
            };

            db.TournamentTeams.Add(team);
            await db.SaveChangesAsync(ct);

            return new TeamActionResult { Success = true, Team = team };
        }

        /// <summary>
        /// Cuenta a titulares (no suplentes) contra edition.TeamSize — "equipo
        /// completo" para habilitar check-in/bracket es tener exactamente TeamSize
        /// titulares. Los suplentes no cuentan para este numero, se permiten hasta
        /// TeamSize adicionales (roster total maximo = TeamSize * 2).
        /// </summary>
        public async Task<TeamActionResult> AddMemberAsync(
            DecatronDbContext db, TournamentEdition edition, long teamId, long? participantId, bool isSubstitute, CancellationToken ct = default)
        {
            var team = await db.TournamentTeams.FirstOrDefaultAsync(t => t.Id == teamId && t.TournamentEditionId == edition.Id, ct);
            if (team == null)
                return new TeamActionResult { Success = false, Error = "Equipo no encontrado" };

            var rosterCount = await db.TournamentParticipants.CountAsync(p => p.TeamId == teamId, ct);
            var maxRoster = (edition.TeamSize ?? 5) * 2;
            if (rosterCount >= maxRoster)
                return new TeamActionResult { Success = false, Error = $"El equipo ya tiene el roster completo (máx. {maxRoster})" };

            if (!isSubstitute)
            {
                var startersCount = await db.TournamentParticipants.CountAsync(p => p.TeamId == teamId && !p.IsSubstitute, ct);
                if (startersCount >= edition.TeamSize)
                    return new TeamActionResult { Success = false, Error = $"El equipo ya tiene sus {edition.TeamSize} titulares — sumalo como suplente" };
            }

            if (participantId.HasValue)
            {
                var participant = await db.TournamentParticipants.FirstOrDefaultAsync(p => p.Id == participantId && p.TournamentEditionId == edition.Id, ct);
                if (participant == null)
                    return new TeamActionResult { Success = false, Error = "Participante no encontrado" };
                if (participant.TeamId.HasValue)
                    return new TeamActionResult { Success = false, Error = "Ese participante ya pertenece a un equipo" };

                participant.TeamId = teamId;
                participant.IsSubstitute = isSubstitute;
                await db.SaveChangesAsync(ct);
            }

            return new TeamActionResult { Success = true, Team = team };
        }

        /// <summary>
        /// Armado de equipos para ARAM N vs N: no es capitan-arma-roster completo como
        /// Clash, pero desde el 23-08-2026 SI admite duos/grupos pre-armados (join
        /// code, ver CreateGroupAsync/JoinGroupAsync) para quien quiera anotarse con un
        /// amigo — el resto sigue viniendo solo y se sortea. Se llama una sola vez, al
        /// generar el bracket (TournamentBracketService controla eso vía
        /// `alreadyGenerated`, no hace falta un segundo guard acá).
        ///
        /// Primero completa los grupos parciales que ya existan (creados por
        /// jugadores vía join code) con participantes sueltos al azar, y recien
        /// despues arma equipos totalmente nuevos con lo que sobra — así un solo
        /// dúo pre-armado no le impide al resto de los solos entrar al bracket (bug
        /// real: antes, la sola existencia de CUALQUIER equipo hacia que este metodo
        /// ni se llamara, dejando a todos los demas sin equipo).
        ///
        /// Si al final sobran participantes sin completar un equipo de TeamSize,
        /// quedan sin equipo (no se arma uno incompleto) — se informa en el resultado.
        /// </summary>
        public async Task<(List<TournamentTeam> teams, int leftOver)> AutoAssignRandomTeamsAsync(
            DecatronDbContext db, TournamentEdition edition, CancellationToken ct = default)
        {
            var teamSize = edition.TeamSize ?? 1;

            var participants = await db.TournamentParticipants
                .Where(p => p.TournamentEditionId == edition.Id && p.Status == "approved" && p.TeamId == null)
                .ToListAsync(ct);

            // Fisher-Yates simple — el azar es el punto (ARAM = All Random).
            for (var i = participants.Count - 1; i > 0; i--)
            {
                var j = _random.Next(i + 1);
                (participants[i], participants[j]) = (participants[j], participants[i]);
            }

            var createdTeams = new List<TournamentTeam>();
            var cursor = 0;

            // 1) Completar grupos parciales pre-armados por los propios jugadores.
            var partialTeams = await db.TournamentTeams
                .Where(t => t.TournamentEditionId == edition.Id)
                .ToListAsync(ct);
            foreach (var team in partialTeams)
            {
                var rosterCount = await db.TournamentParticipants.CountAsync(p => p.TeamId == team.Id, ct);
                var missing = teamSize - rosterCount;
                for (var m = 0; m < missing && cursor < participants.Count; m++, cursor++)
                    participants[cursor].TeamId = team.Id;
            }
            if (cursor > 0) await db.SaveChangesAsync(ct);

            var remaining = participants.Skip(cursor).ToList();
            var fullTeamsCount = remaining.Count / teamSize;
            var leftOver = remaining.Count - fullTeamsCount * teamSize;
            var seedStart = partialTeams.Count;

            for (var t = 0; t < fullTeamsCount; t++)
            {
                var team = new TournamentTeam
                {
                    TournamentEditionId = edition.Id,
                    Name = $"Equipo {seedStart + t + 1}",
                    Seed = (short)(seedStart + t + 1),
                    SeedLocked = true,
                };
                db.TournamentTeams.Add(team);
                createdTeams.Add(team);
            }
            await db.SaveChangesAsync(ct); // asigna Id a cada team antes de linkear participantes

            for (var t = 0; t < fullTeamsCount; t++)
            {
                for (var m = 0; m < teamSize; m++)
                {
                    remaining[t * teamSize + m].TeamId = createdTeams[t].Id;
                }
            }
            await db.SaveChangesAsync(ct);

            return (createdTeams, leftOver);
        }

        public async Task<bool> IsRosterCompleteAsync(DecatronDbContext db, TournamentEdition edition, long teamId, CancellationToken ct = default)
        {
            var startersCount = await db.TournamentParticipants.CountAsync(p => p.TeamId == teamId && !p.IsSubstitute, ct);
            return startersCount == edition.TeamSize;
        }

        /// <summary>
        /// Auto-servicio para ARAM N vs N (TeamSize >= 2): un participante arma un
        /// grupo parcial con un codigo para compartirle a un amigo — "quiero jugar
        /// con mi dúo/trío/squad" en vez de que el sistema lo sortee 100% al azar.
        /// Distinto del alta de equipo de Clash (admin-gated, roster completo con
        /// suplentes) — acá cualquier participante ya inscripto puede crear el suyo,
        /// sin aprobacion del organizador, y AutoAssignRandomTeamsAsync completa lo
        /// que falte con los que vinieron solos al generar el bracket.
        /// </summary>
        public async Task<TeamActionResult> CreateGroupAsync(DecatronDbContext db, TournamentEdition edition, long participantId, CancellationToken ct = default)
        {
            if (edition.Mode != "aram_teams" || edition.TeamSize is null or < 2)
                return new TeamActionResult { Success = false, Error = "Esta edición no admite armar grupos (solo ARAM N vs N con equipos de 2 o más)" };

            var participant = await db.TournamentParticipants.FirstOrDefaultAsync(p => p.Id == participantId && p.TournamentEditionId == edition.Id, ct);
            if (participant == null)
                return new TeamActionResult { Success = false, Error = "No estás inscripto en este torneo" };
            if (participant.TeamId != null)
                return new TeamActionResult { Success = false, Error = "Ya pertenecés a un grupo" };

            var team = new TournamentTeam
            {
                TournamentEditionId = edition.Id,
                Name = $"Grupo de {participant.DisplayName}",
                JoinCode = await GenerateUniqueJoinCodeAsync(db, ct),
            };
            db.TournamentTeams.Add(team);
            await db.SaveChangesAsync(ct);

            participant.TeamId = team.Id;
            await db.SaveChangesAsync(ct);

            return new TeamActionResult { Success = true, Team = team };
        }

        public async Task<TeamActionResult> JoinGroupAsync(DecatronDbContext db, TournamentEdition edition, long participantId, string joinCode, CancellationToken ct = default)
        {
            if (edition.Mode != "aram_teams" || edition.TeamSize is null or < 2)
                return new TeamActionResult { Success = false, Error = "Esta edición no admite armar grupos (solo ARAM N vs N con equipos de 2 o más)" };

            var participant = await db.TournamentParticipants.FirstOrDefaultAsync(p => p.Id == participantId && p.TournamentEditionId == edition.Id, ct);
            if (participant == null)
                return new TeamActionResult { Success = false, Error = "No estás inscripto en este torneo" };
            if (participant.TeamId != null)
                return new TeamActionResult { Success = false, Error = "Ya pertenecés a un grupo" };

            var team = await db.TournamentTeams.FirstOrDefaultAsync(t => t.TournamentEditionId == edition.Id && t.JoinCode == joinCode.Trim().ToUpperInvariant(), ct);
            if (team == null)
                return new TeamActionResult { Success = false, Error = "Código de grupo inválido" };

            var rosterCount = await db.TournamentParticipants.CountAsync(p => p.TeamId == team.Id, ct);
            if (rosterCount >= edition.TeamSize)
                return new TeamActionResult { Success = false, Error = "Ese grupo ya está completo" };

            participant.TeamId = team.Id;
            await db.SaveChangesAsync(ct);

            return new TeamActionResult { Success = true, Team = team };
        }

        private async Task<string> GenerateUniqueJoinCodeAsync(DecatronDbContext db, CancellationToken ct)
        {
            for (var attempt = 0; attempt < 10; attempt++)
            {
                var code = new string(Enumerable.Range(0, 6).Select(_ => CodeChars[_random.Next(CodeChars.Length)]).ToArray());
                var exists = await db.TournamentTeams.AnyAsync(t => t.JoinCode == code, ct);
                if (!exists) return code;
            }
            throw new InvalidOperationException("No se pudo generar un código de equipo único");
        }
    }
}
