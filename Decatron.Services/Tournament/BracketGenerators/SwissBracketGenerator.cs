using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.Tournament.BracketGenerators
{
    /// <summary>
    /// Swiss: no se genera todo de una — GenerateAsync arma solo la ronda 1 (por
    /// seed, sin eliminar a nadie), y GenerateNextRoundAsync arma cada ronda
    /// siguiente recien despues de que la anterior cierra entera. Emparejamiento v1:
    /// ordena por victorias (TournamentBracketStandingsService) y empareja
    /// consecutivos, con un swap simple si el par natural ya jugo entre si — no es el
    /// algoritmo suizo optimo de teoria de grafos, documentado como simplificacion.
    ///
    /// Cierre del torneo: manual — no hay numero fijo de rondas en el modelo, el
    /// organizador decide cuantas jugar y cierra la edicion el mismo cuando termina.
    /// </summary>
    public class SwissBracketGenerator : ISwissBracketGenerator
    {
        private readonly TournamentTeamService _teamService;
        private readonly TournamentBracketStandingsService _standingsService;

        public SwissBracketGenerator(TournamentTeamService teamService, TournamentBracketStandingsService standingsService)
        {
            _teamService = teamService;
            _standingsService = standingsService;
        }

        public string Format => "swiss";

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
                return new BracketResult { Success = false, Error = "Hacen falta al menos 2 equipos para generar la ronda 1" };

            var matches = BuildRoundMatches(edition.Id, 1, teams.Select(t => t.Id).ToList(), new HashSet<(long, long)>());

            db.TournamentMatches.AddRange(matches);
            await db.SaveChangesAsync(ct);

            return new BracketResult { Success = true, MatchesCreated = matches.Count, LeftOverParticipants = leftOverCount };
        }

        public async Task<BracketResult> GenerateNextRoundAsync(DecatronDbContext db, TournamentEdition edition, CancellationToken ct = default)
        {
            var existingMatches = await db.TournamentMatches
                .Where(m => m.TournamentEditionId == edition.Id)
                .ToListAsync(ct);

            if (existingMatches.Count == 0)
                return new BracketResult { Success = false, Error = "Todavía no se generó la ronda 1" };

            var currentRound = existingMatches.Max(m => m.RoundNumber);
            var unfinished = existingMatches.Any(m => m.RoundNumber == currentRound && m.Status != "finished" && m.Status != "walkover");
            if (unfinished)
                return new BracketResult { Success = false, Error = $"Todavía hay matches sin resultado en la ronda {currentRound}" };

            var standings = await _standingsService.GetStandingsAsync(db, edition.Id, ct);
            var orderedTeamIds = standings.OrderByDescending(s => s.Wins).ThenBy(s => s.Rank).Select(s => s.TeamId).ToList();
            var playedPairs = await _standingsService.GetPlayedPairsAsync(db, edition.Id, ct);

            var nextRound = currentRound + 1;
            var matches = BuildRoundMatches(edition.Id, nextRound, orderedTeamIds, playedPairs);

            db.TournamentMatches.AddRange(matches);
            await db.SaveChangesAsync(ct);

            return new BracketResult { Success = true, MatchesCreated = matches.Count };
        }

        public Task PropagateResultAsync(DecatronDbContext db, TournamentEdition edition, TournamentMatch match, CancellationToken ct = default)
        {
            // Swiss no propaga automaticamente — la ronda siguiente se arma a mano
            // (GenerateNextRoundAsync) una vez que la ronda actual cierra entera.
            return Task.CompletedTask;
        }

        private static List<TournamentMatch> BuildRoundMatches(long editionId, int roundNumber, List<long> orderedTeamIds, HashSet<(long, long)> playedPairs)
        {
            var pending = new List<long>(orderedTeamIds);
            var matches = new List<TournamentMatch>();
            var slot = 1;

            while (pending.Count > 0)
            {
                var teamA = pending[0];
                pending.RemoveAt(0);

                if (pending.Count == 0)
                {
                    // Numero impar de equipos: el que sobra descansa esta ronda.
                    matches.Add(new TournamentMatch
                    {
                        TournamentEditionId = editionId,
                        RoundNumber = (short)roundNumber,
                        BracketPosition = (short)slot,
                        TeamAId = teamA,
                        TeamBId = null,
                        WinnerTeamId = null,
                        Status = "walkover",
                    });
                    slot++;
                    break;
                }

                // Empareja con el siguiente disponible que no haya jugado ya contra teamA.
                var opponentIndex = 0;
                for (var i = 0; i < pending.Count; i++)
                {
                    var pair = teamA < pending[i] ? (teamA, pending[i]) : (pending[i], teamA);
                    if (!playedPairs.Contains(pair)) { opponentIndex = i; break; }
                }

                var teamB = pending[opponentIndex];
                pending.RemoveAt(opponentIndex);

                matches.Add(new TournamentMatch
                {
                    TournamentEditionId = editionId,
                    RoundNumber = (short)roundNumber,
                    BracketPosition = (short)slot,
                    TeamAId = teamA,
                    TeamBId = teamB,
                    Status = "scheduled",
                });
                slot++;
            }

            return matches;
        }
    }
}
