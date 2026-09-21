using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.Tournament.BracketGenerators
{
    /// <summary>
    /// Todos contra todos — genera los N*(N-1)/2 enfrentamientos de una sola vez,
    /// repartidos en jornadas con el metodo del circulo clasico (fijar un equipo,
    /// rotar el resto). Si N es impar se agrega un "bye" virtual: al equipo que le
    /// toca esa jornada se le carga un match "walkover" sin rival, no cuenta como
    /// victoria ni derrota (ver TournamentBracketStandingsService).
    ///
    /// No hay arbol — BracketPosition es solo el indice del match dentro de su
    /// jornada, no una posicion de bracket. RecordResultAsync no propaga nada
    /// (ver PropagateResultAsync): ninguna ronda depende del resultado de otra.
    /// </summary>
    public class RoundRobinBracketGenerator : IBracketGenerator
    {
        private readonly TournamentTeamService _teamService;

        public RoundRobinBracketGenerator(TournamentTeamService teamService)
        {
            _teamService = teamService;
        }

        public string Format => "round_robin";

        public async Task<BracketResult> GenerateAsync(DecatronDbContext db, TournamentEdition edition, CancellationToken ct = default)
        {
            var alreadyGenerated = await db.TournamentMatches.AnyAsync(m => m.TournamentEditionId == edition.Id, ct);
            if (alreadyGenerated)
                return new BracketResult { Success = false, Error = "El bracket de esta edición ya fue generado" };

            // Completa grupos parciales pre-armados por los jugadores (join code, ver
            // TournamentTeamService.CreateGroupAsync) con el resto de los solos, y arma
            // equipos nuevos con lo que sobra. Se puede llamar siempre (no solo si no
            // hay equipos todavia) — GenerateAsync ya evita correr esto dos veces via
            // el guard de `alreadyGenerated` mas arriba.
            var leftOverCount = 0;
            if (edition.Mode == "aram_teams")
            {
                var (_, leftOver) = await _teamService.AutoAssignRandomTeamsAsync(db, edition, ct);
                leftOverCount = leftOver;
            }

            var teams = await db.TournamentTeams
                .Where(t => t.TournamentEditionId == edition.Id)
                .OrderBy(t => t.Seed ?? short.MaxValue)
                .ThenBy(t => t.CreatedAt)
                .ToListAsync(ct);

            if (teams.Count < 2)
                return new BracketResult { Success = false, Error = "Hacen falta al menos 2 equipos para generar un round robin" };

            var ids = teams.Select(t => (long?)t.Id).ToList();
            var hasBye = ids.Count % 2 == 1;
            if (hasBye) ids.Add(null); // bye virtual

            var n = ids.Count;
            var rounds = n - 1;
            var matches = new List<TournamentMatch>();

            for (var round = 0; round < rounds; round++)
            {
                var slot = 1;
                for (var i = 0; i < n / 2; i++)
                {
                    var teamA = ids[i];
                    var teamB = ids[n - 1 - i];

                    if (teamA == null || teamB == null)
                    {
                        var present = teamA ?? teamB;
                        matches.Add(new TournamentMatch
                        {
                            TournamentEditionId = edition.Id,
                            RoundNumber = (short)(round + 1),
                            BracketPosition = (short)slot,
                            TeamAId = present,
                            TeamBId = null,
                            WinnerTeamId = null,
                            Status = "walkover",
                        });
                    }
                    else
                    {
                        matches.Add(new TournamentMatch
                        {
                            TournamentEditionId = edition.Id,
                            RoundNumber = (short)(round + 1),
                            BracketPosition = (short)slot,
                            TeamAId = teamA,
                            TeamBId = teamB,
                            Status = "scheduled",
                        });
                    }
                    slot++;
                }

                // Rota todos menos el primero (metodo del circulo).
                var fixedTeam = ids[0];
                var rest = ids.Skip(1).ToList();
                rest.Insert(0, rest[^1]);
                rest.RemoveAt(rest.Count - 1);
                ids = new List<long?> { fixedTeam }.Concat(rest).ToList();
            }

            db.TournamentMatches.AddRange(matches);
            await db.SaveChangesAsync(ct);

            return new BracketResult { Success = true, MatchesCreated = matches.Count, LeftOverParticipants = leftOverCount };
        }

        public Task PropagateResultAsync(DecatronDbContext db, TournamentEdition edition, TournamentMatch match, CancellationToken ct = default)
        {
            // Round robin: cada match es independiente, no hay ronda siguiente que
            // dependa de este resultado. Los standings se recalculan on-demand
            // (TournamentBracketStandingsService), no se cachean.
            return Task.CompletedTask;
        }
    }
}
