using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.Tournament.BracketGenerators
{
    /// <summary>
    /// Doble eliminacion: dos arboles (winners/losers) + gran final. Alcance v1:
    /// SOLO cantidades de equipos potencia de 2 (4, 8, 16, 32...) — evita el problema
    /// de byes en el losers bracket, que complica bastante la topologia estandar sin
    /// aportar nada para el volumen de equipos esperado (torneos chicos entre
    /// streamers). Si no es potencia de 2, error explicito (mismo criterio que
    /// single_elimination con formatos no soportados: documentado, no silencioso).
    ///
    /// TODOS los matches (winners, losers, gran final ronda 1) se pre-generan vacios
    /// de una — igual que ya hace single_elimination con las rondas futuras — la
    /// unica excepcion es la gran final "de vuelta" (bracket reset), que solo se crea
    /// si el campeon del losers bracket gana la primera gran final (comportamiento
    /// estandar de doble eliminacion, no opcional).
    ///
    /// La topologia del losers bracket se deriva con BuildLrRoundPlan — ver ese
    /// metodo para la explicacion de por que alterna rondas "drop" (nuevos
    /// eliminados de winners entran) y "survivor" (los que ya estaban en losers se
    /// emparejan entre si).
    /// </summary>
    public class DoubleEliminationBracketGenerator : IBracketGenerator
    {
        private enum LrRoundType { DropOnly, Drop, Survivor }
        private record LrRoundPlanEntry(int RoundNumber, LrRoundType Type, int MatchCount, int WrRound);

        private readonly TournamentTeamService _teamService;

        public DoubleEliminationBracketGenerator(TournamentTeamService teamService)
        {
            _teamService = teamService;
        }

        public string Format => "double_elimination";

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

            var n = teams.Count;
            if (n < 4 || (n & (n - 1)) != 0)
                return new BracketResult
                {
                    Success = false,
                    Error = $"double_elimination requiere una cantidad de equipos potencia de 2 (4, 8, 16, 32...) — hoy hay {n}."
                };

            for (var i = 0; i < teams.Count; i++)
            {
                if (teams[i].Seed == null) teams[i].Seed = (short)(i + 1);
                teams[i].SeedLocked = true;
            }

            var k = (int)Math.Log2(n);
            var plan = BuildLrRoundPlan(n, k);
            var matches = new List<TournamentMatch>();

            // Winners ronda 1: poblada con equipos reales, sin byes (n es potencia de 2).
            for (var p = 1; p <= n / 2; p++)
            {
                matches.Add(new TournamentMatch
                {
                    TournamentEditionId = edition.Id,
                    RoundNumber = 1,
                    BracketPosition = (short)p,
                    BracketSide = "winners",
                    TeamAId = teams[2 * p - 2].Id,
                    TeamBId = teams[2 * p - 1].Id,
                    Status = "scheduled",
                });
            }
            // Winners rondas 2..k: vacias, se llenan via PropagateResultAsync.
            for (var round = 2; round <= k; round++)
            {
                var matchesInRound = n / (1 << round);
                for (var pos = 1; pos <= matchesInRound; pos++)
                {
                    matches.Add(new TournamentMatch
                    {
                        TournamentEditionId = edition.Id,
                        RoundNumber = (short)round,
                        BracketPosition = (short)pos,
                        BracketSide = "winners",
                        Status = "scheduled",
                    });
                }
            }

            // Losers: todas las rondas del plan, vacias.
            foreach (var entry in plan)
            {
                for (var pos = 1; pos <= entry.MatchCount; pos++)
                {
                    matches.Add(new TournamentMatch
                    {
                        TournamentEditionId = edition.Id,
                        RoundNumber = (short)entry.RoundNumber,
                        BracketPosition = (short)pos,
                        BracketSide = "losers",
                        Status = "scheduled",
                    });
                }
            }

            // Gran final (ronda 1) — el "bracket reset" (ronda 2) se crea solo si hace falta.
            matches.Add(new TournamentMatch
            {
                TournamentEditionId = edition.Id,
                RoundNumber = 1,
                BracketPosition = 1,
                BracketSide = "grand_final",
                Status = "scheduled",
            });

            db.TournamentMatches.AddRange(matches);
            await db.SaveChangesAsync(ct);

            return new BracketResult { Success = true, MatchesCreated = matches.Count, LeftOverParticipants = leftOverCount };
        }

        public async Task PropagateResultAsync(DecatronDbContext db, TournamentEdition edition, TournamentMatch match, CancellationToken ct = default)
        {
            if (match.BracketSide == "grand_final")
            {
                if (match.RoundNumber == 1 && match.WinnerTeamId == match.TeamBId)
                {
                    // El campeon del losers bracket le gano al de winners en la
                    // primera gran final — "bracket reset": segunda y ultima gran
                    // final, rematch entre los mismos dos.
                    var resetExists = await db.TournamentMatches.AnyAsync(m =>
                        m.TournamentEditionId == edition.Id && m.BracketSide == "grand_final" && m.RoundNumber == 2, ct);
                    if (!resetExists)
                    {
                        db.TournamentMatches.Add(new TournamentMatch
                        {
                            TournamentEditionId = edition.Id,
                            RoundNumber = 2,
                            BracketPosition = 1,
                            BracketSide = "grand_final",
                            TeamAId = match.TeamAId,
                            TeamBId = match.TeamBId,
                            Status = "scheduled",
                        });
                        await db.SaveChangesAsync(ct);
                    }
                }
                return; // ronda 1 sin reset, o ronda 2 (reset ya jugado): torneo terminado
            }

            var k = await db.TournamentMatches
                .Where(m => m.TournamentEditionId == edition.Id && m.BracketSide == "winners")
                .MaxAsync(m => m.RoundNumber, ct);
            var n = 1 << k;
            var plan = BuildLrRoundPlan(n, k);

            if (match.BracketSide == "winners")
            {
                var wrRound = match.RoundNumber;

                // Ganador: avanza en winners, o pasa a la gran final si era la final.
                if (wrRound < k)
                {
                    await SetSlotAsync(db, edition.Id, "winners", wrRound + 1, (int)Math.Ceiling(match.BracketPosition / 2.0),
                        match.BracketPosition % 2 == 1, match.WinnerTeamId, ct);
                }
                else
                {
                    await SetSlotAsync(db, edition.Id, "grand_final", 1, 1, true, match.WinnerTeamId, ct);
                }

                // Perdedor: cae al losers bracket.
                var loserId = match.TeamAId == match.WinnerTeamId ? match.TeamBId : match.TeamAId;
                if (wrRound == 1)
                {
                    var dropOnly = plan[0]; // siempre la primera entrada
                    await SetSlotAsync(db, edition.Id, "losers", dropOnly.RoundNumber, (int)Math.Ceiling(match.BracketPosition / 2.0),
                        match.BracketPosition % 2 == 1, loserId, ct);
                }
                else
                {
                    var dropEntry = plan.First(e => e.Type == LrRoundType.Drop && e.WrRound == wrRound);
                    await SetSlotAsync(db, edition.Id, "losers", dropEntry.RoundNumber, match.BracketPosition, isSlotA: false, loserId, ct);
                }

                await db.SaveChangesAsync(ct);
            }
            else if (match.BracketSide == "losers")
            {
                var entryIndex = plan.FindIndex(e => e.RoundNumber == match.RoundNumber);
                var nextEntry = entryIndex >= 0 && entryIndex + 1 < plan.Count ? plan[entryIndex + 1] : null;

                if (nextEntry == null)
                {
                    // Era la final del losers bracket: el ganador es el campeon del
                    // losers bracket, va a la gran final (lado B).
                    await SetSlotAsync(db, edition.Id, "grand_final", 1, 1, isSlotA: false, match.WinnerTeamId, ct);
                }
                else if (nextEntry.Type == LrRoundType.Survivor)
                {
                    await SetSlotAsync(db, edition.Id, "losers", nextEntry.RoundNumber, (int)Math.Ceiling(match.BracketPosition / 2.0),
                        match.BracketPosition % 2 == 1, match.WinnerTeamId, ct);
                }
                else // Drop
                {
                    await SetSlotAsync(db, edition.Id, "losers", nextEntry.RoundNumber, match.BracketPosition, isSlotA: true, match.WinnerTeamId, ct);
                }

                await db.SaveChangesAsync(ct);
            }
        }

        private static async Task SetSlotAsync(DecatronDbContext db, long editionId, string side, int roundNumber, int position, bool isSlotA, long? teamId, CancellationToken ct)
        {
            var target = await db.TournamentMatches.FirstOrDefaultAsync(m =>
                m.TournamentEditionId == editionId && m.BracketSide == side && m.RoundNumber == roundNumber && m.BracketPosition == position, ct);
            if (target == null) return; // no deberia pasar — todo el bracket se pre-genera en GenerateAsync

            if (isSlotA) target.TeamAId = teamId; else target.TeamBId = teamId;
            target.UpdatedAt = DateTime.UtcNow;
        }

        /// <summary>
        /// Deriva la secuencia de rondas del losers bracket para N equipos (potencia
        /// de 2), k = log2(N) rondas de winners:
        ///   - Ronda 1 del losers: "drop-only" — empareja entre si a los N/2 perdedores
        ///     de winners-ronda-1 (no hay sobrevivientes previos que sumar todavia).
        ///   - Para cada ronda de winners r = 2..k: una ronda "drop" (sobrevivientes
        ///     del losers bracket vs los nuevos perdedores de winners-ronda-r) y,
        ///     si todavia queda mas de 1 sobreviviente despues, una ronda "survivor"
        ///     (los sobrevivientes se emparejan entre si, sin nuevos ingresos).
        /// La ultima ronda "drop" (la de winners-ronda-k, la final de winners) es la
        /// final del losers bracket — su ganador pasa a la gran final.
        /// </summary>
        private static List<LrRoundPlanEntry> BuildLrRoundPlan(int n, int k)
        {
            var plan = new List<LrRoundPlanEntry>();
            var roundNum = 0;
            var survivors = 0;

            for (var wr = 1; wr <= k; wr++)
            {
                var newLosers = n / (1 << wr);
                if (wr == 1)
                {
                    roundNum++;
                    var matchCount = newLosers / 2;
                    plan.Add(new LrRoundPlanEntry(roundNum, LrRoundType.DropOnly, matchCount, wr));
                    survivors = matchCount;
                }
                else
                {
                    roundNum++;
                    plan.Add(new LrRoundPlanEntry(roundNum, LrRoundType.Drop, newLosers, wr));
                    survivors = newLosers;

                    if (survivors > 1)
                    {
                        roundNum++;
                        var matchCount = survivors / 2;
                        plan.Add(new LrRoundPlanEntry(roundNum, LrRoundType.Survivor, matchCount, wr));
                        survivors = matchCount;
                    }
                }
            }

            return plan;
        }
    }
}
