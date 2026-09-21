using Decatron.Data;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.Helpers
{
    /// <summary>
    /// Resuelve el <b>dueño de cuenta</b> de un user_id de login.
    ///
    /// <para>Una persona tiene una fila en <c>accounts</c> y una fila en <c>users</c> por
    /// cada plataforma vinculada (Twitch, Kick, Discord). El JWT trae el user_id de la
    /// plataforma por la que entró, así que sin resolver esto la misma persona ve datos
    /// distintos según por dónde se logueó: entrando por Kick, su colección de TCG y su
    /// saldo de DecaCoins aparecían vacíos.</para>
    ///
    /// <para>El dueño es el <b>user_id más bajo de la cuenta</b>, que es la fila original
    /// (las vinculadas se crean después). Todo lo que sea de la persona y no del canal
    /// —cartas, sobres, coins— se guarda y se lee contra ese id.</para>
    ///
    /// <para>Complementa a <c>GetAccountUserIdsAsync</c> de FortniteService/TierResolver:
    /// aquel sirve para <b>leer</b> lo disperso entre varias filas; este define contra
    /// cuál sola fila <b>escribir</b>, que es lo que necesita cualquier cosa con saldo.
    /// Ver .dev/plans/UNIFICACION_MULTIPLATAFORMA_PLAN.md sección 8.11.</para>
    /// </summary>
    public static class AccountResolver
    {
        public static async Task<long> GetAccountOwnerIdAsync(DecatronDbContext db, long userId)
        {
            var accountId = await db.Users
                .Where(u => u.Id == userId)
                .Select(u => u.AccountId)
                .FirstOrDefaultAsync();

            // Sin cuenta vinculada no hay nada que unificar: la fila es la persona.
            if (accountId == null)
                return userId;

            var ownerId = await db.Users
                .Where(u => u.AccountId == accountId)
                .OrderBy(u => u.Id)
                .Select(u => u.Id)
                .FirstOrDefaultAsync();

            return ownerId == 0 ? userId : ownerId;
        }
    }
}
