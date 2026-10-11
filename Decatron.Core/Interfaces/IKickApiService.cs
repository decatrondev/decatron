using Decatron.Core.Models;

namespace Decatron.Core.Interfaces
{
    /// <summary>
    /// Llamadas a la API pública de Kick que no son de chat ni de auth (esas ya
    /// tienen su propio lugar: <see cref="IPlatformConnector"/> y
    /// KickAuthController). Arranca con solo channel rewards — se suma acá lo
    /// que haga falta despues (categorias, etc.), no un service generico
    /// pre-armado para todo lo que Kick pueda exponer a futuro.
    /// </summary>
    public interface IKickApiService
    {
        Task<List<KickReward>> GetChannelRewardsAsync(string accessToken);

        /// <summary>Ban (sin duración) o timeout (1-10080 minutos). Scope moderation:ban.</summary>
        Task<bool> BanAsync(string accessToken, long broadcasterUserId, long userId, int? durationMinutes, string reason);

        /// <summary>Quita ban o timeout. true si se quitó, false si no estaba sancionado, null si falló.</summary>
        Task<bool?> UnbanAsync(string accessToken, long broadcasterUserId, long userId);

        /// <summary>Borra un mensaje del chat. Scope moderation:chat_message:manage.</summary>
        Task<bool> DeleteMessageAsync(string accessToken, string messageId);

        /// <summary>Título y categoría actuales del canal del token (GET /channels, scope channel:read). null si falla.</summary>
        Task<KickChannelInfo?> GetOwnChannelAsync(string accessToken);

        /// <summary>Cambia título y/o categoría (PATCH /channels, scope channel:write). Pasar solo lo que cambia.</summary>
        Task<KickUpdateResult> UpdateChannelAsync(string accessToken, string? streamTitle, long? categoryId);

        /// <summary>Busca categorías por nombre: v2 (vigente, por prefijo) y, si no hay nada, v1 (obsoleta, por texto).</summary>
        Task<List<KickCategory>> SearchCategoriesAsync(string accessToken, string name);
    }
}
