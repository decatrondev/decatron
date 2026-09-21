using Decatron.Core.Models.Tournament;
using Decatron.Data;

namespace Decatron.Services.Tournament.BracketGenerators
{
    /// <summary>
    /// El modo (SoloQ/ARAM/Clash) decide QUE se juega, el formato de bracket decide
    /// COMO se empareja — ver .dev/torneos/02-motor-de-torneo-formatos.md seccion 5.
    /// Cada formato tiene su propio generador para no terminar con
    /// modos x formatos clases redundantes.
    /// </summary>
    public interface IBracketGenerator
    {
        string Format { get; }

        Task<BracketResult> GenerateAsync(DecatronDbContext db, TournamentEdition edition, CancellationToken ct = default);

        /// <summary>
        /// Se llama despues de que un match queda "finished"/"walkover" (carga manual
        /// de resultado). Cada formato decide que hacer: single_elimination avanza al
        /// ganador a la ronda siguiente, double_elimination ademas manda al perdedor
        /// al losers bracket, round_robin no hace nada (no hay ronda siguiente que
        /// dependa de este resultado), swiss tampoco (la ronda siguiente se genera a
        /// mano via GenerateNextRoundAsync una vez que la ronda actual cierra entera).
        /// </summary>
        Task PropagateResultAsync(DecatronDbContext db, TournamentEdition edition, TournamentMatch match, CancellationToken ct = default);
    }
}
