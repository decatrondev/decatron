using System.Text.Json;
using System.Threading.Tasks;

namespace Decatron.Core.Interfaces
{
    /// <summary>
    /// Lo que hace falta saber de un mensaje de chat entrante, ya traducido de la forma
    /// especifica de cada plataforma a los mismos campos que espera
    /// <c>CommandService.ProcessMessageAsync</c>. Cada <see cref="IPlatformConnector"/> es
    /// responsable de esta traduccion — el resto del bot no sabe de que plataforma vino.
    /// </summary>
    public record IncomingChatMessage(
        string Username,
        string Channel,
        string Message,
        string UserId,
        string? MessageId,
        bool IsModerator,
        bool IsVip,
        bool IsSubscriber,
        bool IsBroadcaster
    );

    /// <summary>
    /// Interfaz comun para conectar el bot a una plataforma de chat (Twitch, Kick, a futuro
    /// YouTube). Disenada el 6 de agosto de 2026 — ver
    /// .dev/plans/UNIFICACION_MULTIPLATAFORMA_PLAN.md seccion 8 para el porque.
    ///
    /// El motor de comandos (ICommand, CommandContext, CommandService) ya era practicamente
    /// agnostico de plataforma antes de que existiera esta interfaz — solo faltaba esta pieza
    /// del lado de "como entra un evento". Una implementacion de este contrato traduce los
    /// conceptos propios de su plataforma (badges, roles, formato del webhook) a los booleans
    /// genericos que el resto del bot ya entiende.
    /// </summary>
    public interface IPlatformConnector
    {
        /// <summary>Nombre corto de la plataforma ("twitch", "kick", "youtube"), usado para enrutar IMessageSender.</summary>
        string PlatformName { get; }

        /// <summary>Envia un mensaje de chat al canal indicado. El "canal" es el identificador propio de esa plataforma (login de Twitch, slug de Kick).</summary>
        Task SendMessageAsync(string channel, string message);

        /// <summary>
        /// Traduce el payload crudo de un evento de chat de esta plataforma al formato comun.
        /// Devuelve null si el payload no es un evento de chat procesable (otro tipo de evento,
        /// o datos incompletos).
        /// </summary>
        IncomingChatMessage? ParseChatMessage(JsonElement rawPayload);
    }
}
