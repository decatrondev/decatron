using System.Collections.Concurrent;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Services.Platforms.Kick;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    public class KickTokenRefreshService : IKickTokenRefreshService
    {
        private readonly IUserRepository _userRepository;
        private readonly KickOAuthClient _kickOAuthClient;
        private readonly ILogger<KickTokenRefreshService> _logger;

        // Kick rota el refresh_token en cada uso: dos refresh concurrentes para el mismo
        // usuario (el ciclo de background y el "red de seguridad" de MessageSenderRouter
        // pisandose) harian que el segundo use un refresh_token que el primero ya invalido.
        // Un semaforo por usuario serializa esos dos casos sin bloquear a otros usuarios.
        private static readonly ConcurrentDictionary<long, SemaphoreSlim> _locks = new();

        public KickTokenRefreshService(
            IUserRepository userRepository,
            KickOAuthClient kickOAuthClient,
            ILogger<KickTokenRefreshService> logger)
        {
            _userRepository = userRepository;
            _kickOAuthClient = kickOAuthClient;
            _logger = logger;
        }

        public Task<bool> IsTokenExpiringSoonAsync(User user, TimeSpan threshold)
        {
            if (user.KickTokenExpiration == null)
                return Task.FromResult(false);

            var timeUntilExpiration = user.KickTokenExpiration.Value - DateTime.UtcNow;
            return Task.FromResult(timeUntilExpiration <= threshold);
        }

        public async Task<User> RefreshUserTokenAsync(User user)
        {
            if (string.IsNullOrEmpty(user.KickRefreshToken))
                throw new KickTokenException($"Usuario {user.Id} no tiene refresh token de Kick", isTerminal: false);

            var userLock = _locks.GetOrAdd(user.Id, _ => new SemaphoreSlim(1, 1));
            await userLock.WaitAsync();

            try
            {
                // Releida despues de tomar el lock: si otro refresh ya corrio mientras
                // esperabamos, el token en memoria (user.KickRefreshToken) puede estar
                // desactualizado. Volver a buscar el usuario evita reintentar con un
                // refresh_token que ya fue rotado por la otra llamada.
                var freshUser = await _userRepository.GetByIdAsync(user.Id);
                if (freshUser == null || string.IsNullOrEmpty(freshUser.KickRefreshToken))
                    throw new KickTokenException($"Usuario {user.Id} ya no tiene refresh token de Kick", isTerminal: false);

                _logger.LogInformation("[KickTokenRefresh] Refrescando token de Kick para usuario {UserId}", freshUser.Id);

                try
                {
                    var tokenResponse = await _kickOAuthClient.RefreshTokenAsync(freshUser.KickRefreshToken);

                    if (string.IsNullOrEmpty(tokenResponse.RefreshToken))
                        throw new KickTokenException(
                            $"Kick no devolvio un refresh_token nuevo para el usuario {freshUser.Id} — no se puede continuar sin romper la rotacion",
                            isTerminal: false);

                    freshUser.KickAccessToken = tokenResponse.AccessToken;
                    freshUser.KickRefreshToken = tokenResponse.RefreshToken;
                    freshUser.KickTokenExpiration = DateTime.UtcNow.AddSeconds(tokenResponse.ExpiresIn);
                    freshUser.UpdatedAt = DateTime.UtcNow;

                    await _userRepository.UpdateAsync(freshUser);

                    _logger.LogInformation(
                        "[KickTokenRefresh] Token de Kick renovado para usuario {UserId}. Nueva expiracion: {Expiration}",
                        freshUser.Id, freshUser.KickTokenExpiration);

                    return freshUser;
                }
                catch (KickTokenException ex) when (ex.IsTerminal)
                {
                    // Kick dijo explicitamente que este refresh token ya no sirve (revocado,
                    // o alguien mas lo roto primero). Dejarlo en la fila es peor que
                    // limpiarlo: cualquier intento futuro va a fallar igual, pero limpio le
                    // permite al frontend detectar "sin token" y pedir un re-login en vez de
                    // reintentar contra un secreto muerto para siempre.
                    _logger.LogWarning(ex,
                        "[KickTokenRefresh] Token de Kick del usuario {UserId} invalidado por Kick — limpiando, requiere re-login",
                        freshUser.Id);

                    freshUser.KickAccessToken = null;
                    freshUser.KickRefreshToken = null;
                    freshUser.KickTokenExpiration = null;
                    freshUser.UpdatedAt = DateTime.UtcNow;
                    await _userRepository.UpdateAsync(freshUser);

                    throw;
                }
            }
            finally
            {
                userLock.Release();
            }
        }

        public async Task RefreshExpiringTokensAsync()
        {
            var expiringUsers = await _userRepository.GetUsersWithKickTokensExpiringWithinAsync(TimeSpan.FromHours(1));

            if (expiringUsers.Count == 0)
            {
                _logger.LogInformation("[KickTokenRefresh] Ningun token de Kick vence pronto");
                return;
            }

            _logger.LogInformation("[KickTokenRefresh] {Count} token(s) de Kick vencen pronto", expiringUsers.Count);

            foreach (var user in expiringUsers)
            {
                try
                {
                    await RefreshUserTokenAsync(user);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[KickTokenRefresh] Fallo el refresh de Kick para usuario {UserId}", user.Id);
                    // Sigue con el resto — un usuario con problemas no debe frenar a los demas.
                }
            }
        }
    }
}
