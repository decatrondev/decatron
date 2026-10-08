namespace Decatron.Core.Interfaces
{
    /// <summary>
    /// Datos de un canje ya traducidos a lo que hace falta para disparar una
    /// Sound Alert — el resto no sabe (ni le importa) de que plataforma vino.
    /// </summary>
    /// <param name="ChannelUserId">Id interno del canal (users.id), nunca el string visible — evita colisiones de nombre entre plataformas.</param>
    /// <param name="OverlayGroupKey">Clave exacta que el overlay usa para unirse al grupo de SignalR (mismo valor que "channelName" en la URL del overlay).</param>
    public record SoundAlertRedemption(
        long ChannelUserId,
        string OverlayGroupKey,
        string RewardId,
        string RewardTitle,
        string RedeemerUsername,
        string? RedeemerId,
        DateTimeOffset RedeemedAt
    );

    /// <summary>
    /// Busca el archivo configurado para una recompensa, arma la alerta y la manda al overlay por SignalR: la
    /// parte de Sound Alerts que es igual sin importar de qué plataforma vino el canje. La usan el webhook de Kick,
    /// el canje de puntos de Twitch (EventSubNotificationHandler) y la Rueda; el aviso lleva un id único y la
    /// plataforma de origen.
    /// </summary>
    public interface ISoundAlertTriggerService
    {
        Task TriggerAsync(SoundAlertRedemption redemption);

        /// <summary>
        /// Manda una alerta ya armada (la de prueba del panel, la de la API pública) a los overlays de la cuenta: al grupo
        /// de siempre y al grupo v2. Le agrega el id único y la plataforma de origen si no los trae.
        /// </summary>
        /// <param name="legacyKey">La clave con la que ese caller emitía antes (login de la fila).</param>
        Task SendAlertAsync(long channelUserId, string legacyKey, object alertData);

        /// <summary>Avisa a los overlays de la cuenta (grupo de siempre y v2) que la configuración cambió.</summary>
        Task NotifyConfigChangedAsync(long channelUserId, string legacyKey);
    }
}
