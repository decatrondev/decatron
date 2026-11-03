namespace Decatron.Core.Interfaces
{
    public record KickSubscriptionResult(bool Success, int StatusCode, string Body);

    /// <summary>Resultado de asegurar varias suscripciones: cuáles ya estaban, cuáles se crearon y cuáles siguen faltando.</summary>
    public record KickEnsureResult(bool Success, IReadOnlyList<string> AlreadyActive, IReadOnlyList<string> Created, IReadOnlyList<string> Missing, string? Error);

    /// <summary>
    /// Suscribe canales de Kick a eventos de su EventSub por webhook (POST
    /// https://api.kick.com/public/v1/events/subscriptions). Antes esta lógica
    /// vivía duplicada como métodos privados por evento dentro de
    /// <c>KickAuthController</c> (uno para chat, casi copiado para rewards) —
    /// un solo lugar que sabe hablarle a esa API, el controller solo decide
    /// cuándo llamarlo y con qué evento.
    /// </summary>
    public interface IKickEventSubService
    {
        /// <summary>
        /// Suscribe al canal al evento indicado si todavía no está suscripto
        /// (Kick devuelve 400 si se reintenta una suscripción ya activa).
        /// </summary>
        Task<KickSubscriptionResult> SubscribeAsync(string kickId, string accessToken, string eventName, int version = 1);

        /// <summary>
        /// Deja suscripto al canal a todos los eventos pedidos con una sola consulta de las suscripciones
        /// existentes y, si falta alguno, una sola creación. Los que ya estaban no se tocan.
        /// </summary>
        Task<KickEnsureResult> EnsureSubscriptionsAsync(string kickId, string accessToken, IReadOnlyCollection<string> eventNames, int version = 1);
    }
}
