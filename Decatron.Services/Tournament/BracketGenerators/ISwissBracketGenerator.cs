using Decatron.Core.Models.Tournament;
using Decatron.Data;

namespace Decatron.Services.Tournament.BracketGenerators
{
    /// <summary>
    /// Swiss es el unico formato que genera rondas incrementalmente en vez de todo
    /// de una vez — interfaz separada para que el dispatcher (TournamentBracketService)
    /// pueda ofrecer el endpoint "siguiente ronda" solo cuando el formato es swiss.
    /// </summary>
    public interface ISwissBracketGenerator : IBracketGenerator
    {
        Task<BracketResult> GenerateNextRoundAsync(DecatronDbContext db, TournamentEdition edition, CancellationToken ct = default);
    }
}
