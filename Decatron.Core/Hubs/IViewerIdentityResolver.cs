using System.Security.Claims;

namespace Decatron.Hubs
{
    /// <summary>Quién es el espectador que se conecta al hub de traducción (si inició sesión).</summary>
    public sealed record ViewerIdentity(long UserId, string Login, string? TwitchId);

    public interface IViewerIdentityResolver
    {
        /// <summary>
        /// La identidad a partir de la sesión normal de decatron.net (la página del Multi-view) o de un token de espectador (la
        /// extensión). null = anónimo: un token vencido, revocado o inválido no es un error, solo no identifica a nadie.
        /// </summary>
        Task<ViewerIdentity?> ResolveAsync(string? accessToken, ClaimsPrincipal? user);
    }
}
