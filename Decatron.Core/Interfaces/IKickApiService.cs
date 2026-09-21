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
    }
}
