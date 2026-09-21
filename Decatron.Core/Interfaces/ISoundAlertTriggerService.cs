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
    /// Busca el archivo configurado para una recompensa, arma la alerta y la
    /// manda al overlay por SignalR — la parte de Sound Alerts que es igual
    /// sin importar de que plataforma vino el canje. Hoy la usa
    /// KickWebhookController; el path de Twitch (EventSubNotificationHandler)
    /// sigue con su propia implementacion en SQL crudo — unificar los dos es
    /// un refactor aparte, no forzado por este cambio.
    /// </summary>
    public interface ISoundAlertTriggerService
    {
        Task TriggerAsync(SoundAlertRedemption redemption);
    }
}
