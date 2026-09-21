using Decatron.Core.Models;

namespace Decatron.Core.Interfaces
{
    /// <summary>
    /// Equivalente Kick de <see cref="IUserTokenRefreshService"/> (que es solo Twitch). Interfaz
    /// separada, no un metodo mas en la de Twitch: la mecanica difiere lo suficiente (rotacion
    /// obligatoria de refresh_token, campos nullable, distinto endpoint) como para que forzarlas
    /// a compartir un solo metodo con ifs por plataforma fuera mas fragil que dos chicos y
    /// simples.
    /// </summary>
    public interface IKickTokenRefreshService
    {
        Task<bool> IsTokenExpiringSoonAsync(User user, TimeSpan threshold);

        /// <summary>
        /// Refresca el token de Kick del usuario. Lanza <see cref="Decatron.Services.Platforms.Kick.KickTokenException"/>
        /// — con <c>IsTerminal = true</c> si Kick invalido el refresh token (en ese caso ya se
        /// limpiaron KickAccessToken/KickRefreshToken/KickTokenExpiration antes de relanzar, para
        /// que el frontend pueda pedirle al streamer que vuelva a loguearse con Kick), o
        /// <c>IsTerminal = false</c> si fue un problema transitorio (red, 5xx) y el usuario no se
        /// tocó.
        /// </summary>
        Task<User> RefreshUserTokenAsync(User user);

        Task RefreshExpiringTokensAsync();
    }
}
