using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.Tournament.BracketGenerators
{
    /// <summary>
    /// Unico formato con un ejemplo real observado (LoL Classic del audit —
    /// cuartos/semis BO1, final BO3). Logica sin cambios respecto de la version
    /// original de Milestone 4 (antes vivia directo en TournamentBracketService).
    /// </summary>
    public class SingleEliminationBracketGenerator : IBracketGenerator
    {
        private readonly TournamentTeamService _teamService;

        public SingleEliminationBracketGenerator(TournamentTeamService teamService)
        {
            _teamService = teamService;
        }

        public string Format => "single_elimination";

        public async Task<BracketResult> GenerateAsync(DecatronDbContext db, TournamentEdition edition, CancellationToken ct = default)
        {
            var alreadyGenerated = await db.TournamentMatches.AnyAsync(m => m.TournamentEditionId == edition.Id, ct);
            if (alreadyGenerated)
                return new BracketResult { Success = false, Error = "El bracket de esta edición ya fue generado" };

            // ARAM N vs N: los equipos NO se arman de antemano (a diferencia de Clash,
            // donde ya existen porque un capitan los creo) — se sortean aca mismo, una
            // sola vez, la primera vez que se genera el bracket. Decision de producto
            // de esta sesion (15-08-2026), no el diseno original de fase 2.
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
                return new BracketResult
                {
                    Success = false,
                    Error = edition.Mode == "aram_teams"
                        ? $"No hay suficientes participantes aprobados para armar al menos 2 equipos de {edition.TeamSize} (sobraron {leftOverCount} sin equipo)"
                        : "Hacen falta al menos 2 equipos para generar un bracket"
                };

            // Asigna seed 1..N por orden de registro si no estaba cargado a mano.
            for (var i = 0; i < teams.Count; i++)
            {
                if (teams[i].Seed == null) teams[i].Seed = (short)(i + 1);
                teams[i].SeedLocked = true;
            }

            var bracketSize = 1;
            while (bracketSize < teams.Count) bracketSize *= 2;
            var byes = bracketSize - teams.Count;
            var totalRounds = (int)Math.Log2(bracketSize);

            var matches = new List<TournamentMatch>();

            // Ronda 1: los primeros `byes` seeds pasan directo (bye), el resto se
            // empareja secuencialmente.
            var slot = 1;
            var teamIndex = 0;

            for (; teamIndex < byes; teamIndex++, slot++)
            {
                matches.Add(new TournamentMatch
                {
                    TournamentEditionId = edition.Id,
                    RoundNumber = 1,
                    BracketPosition = (short)slot,
                    TeamAId = teams[teamIndex].Id,
                    TeamBId = null,
                    WinnerTeamId = teams[teamIndex].Id,
                    Status = "walkover",
                });
            }

            while (teamIndex < teams.Count)
            {
                matches.Add(new TournamentMatch
                {
                    TournamentEditionId = edition.Id,
                    RoundNumber = 1,
                    BracketPosition = (short)slot,
                    TeamAId = teams[teamIndex].Id,
                    TeamBId = teams.Count > teamIndex + 1 ? teams[teamIndex + 1].Id : null,
                    Status = "scheduled",
                });
                teamIndex += 2;
                slot++;
            }

            // Rondas siguientes: matches vacios, se van llenando a medida que se
            // cargan resultados (PropagateResultAsync).
            var matchesInRound = bracketSize / 2;
            for (var round = 2; round <= totalRounds; round++)
            {
                matchesInRound /= 2;
                for (var pos = 1; pos <= matchesInRound; pos++)
                {
                    matches.Add(new TournamentMatch
                    {
                        TournamentEditionId = edition.Id,
                        RoundNumber = (short)round,
                        BracketPosition = (short)pos,
                        Status = "scheduled",
                    });
                }
            }

            db.TournamentMatches.AddRange(matches);
            await db.SaveChangesAsync(ct);

            // Propaga los byes de ronda 1 a ronda 2 (si el bracket tiene mas de 1 ronda).
            foreach (var byeMatch in matches.Where(m => m.RoundNumber == 1 && m.Status == "walkover"))
                await PropagateResultAsync(db, edition, byeMatch, ct);

            return new BracketResult { Success = true, MatchesCreated = matches.Count, LeftOverParticipants = leftOverCount };
        }

        public async Task PropagateResultAsync(DecatronDbContext db, TournamentEdition edition, TournamentMatch match, CancellationToken ct = default)
        {
            var nextRound = match.RoundNumber + 1;
            var nextPosition = (int)Math.Ceiling(match.BracketPosition / 2.0);

            var nextMatch = await db.TournamentMatches.FirstOrDefaultAsync(m =>
                m.TournamentEditionId == edition.Id && m.RoundNumber == nextRound && m.BracketPosition == nextPosition, ct);

            if (nextMatch == null) return; // era la final, no hay ronda siguiente

            var isOddSlot = match.BracketPosition % 2 == 1;
            if (isOddSlot) nextMatch.TeamAId = match.WinnerTeamId;
            else nextMatch.TeamBId = match.WinnerTeamId;

            nextMatch.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }
    }
}
