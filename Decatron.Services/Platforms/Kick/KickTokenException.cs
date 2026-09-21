namespace Decatron.Services.Platforms.Kick
{
    /// <summary>
    /// Error al hablar con <c>id.kick.com/oauth/token</c>. La distincion entre terminal y no
    /// terminal es lo que le permite a <see cref="KickTokenRefreshService"/> decidir si limpiar
    /// los tokens del usuario (Kick dijo explicitamente que el refresh token ya no sirve) o
    /// dejarlos intactos para reintentar en el proximo ciclo (timeout, 5xx, red caida — no es
    /// culpa del token).
    /// </summary>
    public class KickTokenException : Exception
    {
        /// <summary>
        /// True cuando Kick respondio con un error que dice explicitamente que el refresh token
        /// ya no es valido (401/400 con invalid_grant, tipico de una revocacion o de haber usado
        /// un refresh token ya rotado). False para timeouts, errores 5xx o de red: ahi no sabemos
        /// si el token sigue siendo valido, asi que no se toca nada.
        /// </summary>
        public bool IsTerminal { get; }

        public KickTokenException(string message, bool isTerminal, Exception? inner = null)
            : base(message, inner)
        {
            IsTerminal = isTerminal;
        }
    }
}
