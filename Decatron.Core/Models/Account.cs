namespace Decatron.Core.Models
{
    /// <summary>
    /// La persona real, separada del canal. Ver
    /// .dev/plans/UNIFICACION_MULTIPLATAFORMA_PLAN.md seccion 4.3 y 8.6.
    /// Cada fila de "users" (un canal de Twitch o de Kick) cuelga de una
    /// cuenta via User.AccountId — varias filas con el mismo AccountId son
    /// la misma persona con varios canales vinculados.
    /// </summary>
    public class Account
    {
        public long Id { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
