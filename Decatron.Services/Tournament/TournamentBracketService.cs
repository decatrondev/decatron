using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Decatron.Services.Tournament.BracketGenerators;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.Tournament
{
    /// <summary>
    /// Dispatcher por TournamentEdition.BracketFormat — ver
    /// .dev/torneos/02-motor-de-torneo-formatos.md seccion 5 y BracketGenerators/
    /// (IBracketGenerator). No conoce la logica de ningun formato en particular, solo
    /// elige el generador correcto y orquesta el entrypoint compartido de resultados
    /// (RecordResultAsync) que usa el controller.
    /// </summary>
    public class TournamentBracketService
    {
        private readonly Dictionary<string, IBracketGenerator> _generators;

        public TournamentBracketService(
            SingleEliminationBracketGenerator singleElimination,
            RoundRobinBracketGenerator roundRobin,
            DoubleEliminationBracketGenerator doubleElimination,
            SwissBracketGenerator swiss)
        {
            _generators = new List<IBracketGenerator> { singleElimination, roundRobin, doubleElimination, swiss }
                .ToDictionary(g => g.Format);
        }

        public async Task<BracketResult> GenerateAsync(DecatronDbContext db, TournamentEdition edition, CancellationToken ct = default)
        {
            if (edition.BracketFormat == null || !_generators.TryGetValue(edition.BracketFormat, out var generator))
                return new BracketResult { Success = false, Error = $"Formato de bracket no reconocido: '{edition.BracketFormat}'" };

            var validationError = await ValidateTeamCountAsync(db, edition, ct);
            if (validationError != null)
                return new BracketResult { Success = false, Error = validationError };

            return await generator.GenerateAsync(db, edition, ct);
        }

        /// <summary>
        /// Bloqueo duro antes de generar llaves — pedido explicito del usuario
        /// (24-08-2026): "no debería salir... si son 52 y armo 5vs5 quedan 2 afuera,
        /// avisame antes con recomendaciones", en vez del comportamiento anterior
        /// (AutoAssignRandomTeamsAsync dejaba a los sobrantes sin equipo en silencio
        /// y generaba las llaves igual). Dos reglas:
        /// 1. La cantidad de jugadores aprobados tiene que ser multiplo exacto de
        ///    TeamSize (si no, nadie sabe de antemano cuantos quedan afuera).
        /// 2. Para single/double elimination, la cantidad de EQUIPOS resultante
        ///    tiene que ser potencia de 2 — es la unica forma de que no haya ningun
        ///    equipo que avance de ronda sin jugar (bye). round_robin y swiss no
        ///    tienen este problema (siempre hay rival real en cada partido).
        /// </summary>
        private static async Task<string?> ValidateTeamCountAsync(DecatronDbContext db, TournamentEdition edition, CancellationToken ct)
        {
            var teamSize = edition.TeamSize ?? 1;

            var totalPlayers = await db.TournamentParticipants.CountAsync(p =>
                p.TournamentEditionId == edition.Id && p.Status == "approved", ct);

            if (totalPlayers == 0)
                return "No hay participantes aprobados todavía";

            var remainder = totalPlayers % teamSize;
            if (remainder != 0)
            {
                var toAdd = teamSize - remainder;
                return $"No se pueden crear las llaves: con {totalPlayers} jugadores y equipos de {teamSize} quedarían {remainder} sin equipo. " +
                       $"Agregá {toAdd} jugador(es) más (para llegar a {totalPlayers + toAdd}) o dejá {remainder} afuera (para quedar en {totalPlayers - remainder}).";
            }

            var teamCount = totalPlayers / teamSize;
            if (teamCount < 2)
                return "Hace falta más de un equipo para generar las llaves";

            if (edition.BracketFormat is "single_elimination" or "double_elimination" && !IsPowerOfTwo(teamCount))
            {
                var lower = HighestPowerOfTwoAtMost(teamCount);
                var upper = lower * 2;
                return $"No se pueden crear las llaves: {teamCount} equipos no es potencia de 2 (única forma de que ningún equipo avance de ronda sin jugar). " +
                       $"Agregá {(upper - teamCount) * teamSize} jugador(es) más para llegar a {upper} equipos, o esperá a que queden {lower} equipos.";
            }

            return null;
        }

        private static bool IsPowerOfTwo(int n) => n > 0 && (n & (n - 1)) == 0;

        private static int HighestPowerOfTwoAtMost(int n)
        {
            var p = 1;
            while (p * 2 <= n) p *= 2;
            return p;
        }

        public async Task<BracketResult> GenerateNextRoundAsync(DecatronDbContext db, TournamentEdition edition, CancellationToken ct = default)
        {
            if (edition.BracketFormat == null || !_generators.TryGetValue(edition.BracketFormat, out var generator))
                return new BracketResult { Success = false, Error = $"Formato de bracket no reconocido: '{edition.BracketFormat}'" };

            if (generator is not ISwissBracketGenerator swissGenerator)
                return new BracketResult { Success = false, Error = "Este formato genera el bracket entero de una vez, no usa rondas manuales" };

            return await swissGenerator.GenerateNextRoundAsync(db, edition, ct);
        }

        public async Task<BracketResult> RecordResultAsync(DecatronDbContext db, TournamentEdition edition, long matchId, long winnerTeamId, CancellationToken ct = default)
        {
            var match = await db.TournamentMatches.FirstOrDefaultAsync(m => m.Id == matchId && m.TournamentEditionId == edition.Id, ct);
            if (match == null)
                return new BracketResult { Success = false, Error = "Match no encontrado" };

            if (match.Status == "finished" || match.Status == "walkover")
                return new BracketResult { Success = false, Error = "Este match ya tiene resultado cargado" };

            if (winnerTeamId != match.TeamAId && winnerTeamId != match.TeamBId)
                return new BracketResult { Success = false, Error = "El ganador tiene que ser uno de los dos equipos del match" };

            match.WinnerTeamId = winnerTeamId;
            match.Status = "finished";
            match.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);

            if (edition.BracketFormat != null && _generators.TryGetValue(edition.BracketFormat, out var generator))
                await generator.PropagateResultAsync(db, edition, match, ct);

            return new BracketResult { Success = true };
        }
    }
}
