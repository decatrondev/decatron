namespace Decatron.Hubs
{
    /// <summary>
    /// Vigila los intentos de entrada a un canal para detectar abuso (un pico de rechazos o de intentos) y recuerda las IPs que el
    /// streamer sacó de su canal. El hub lo alimenta en cada <c>Join</c>.
    /// </summary>
    public interface ITranslationAbuseGuard
    {
        /// <summary>Anota un intento de entrada. <paramref name="reason"/> es el motivo del rechazo (null si entró); <paramref name="capacity"/>, el tope de oyentes del canal.</summary>
        void Record(string login, bool accepted, string? reason, int capacity);

        /// <summary>¿El streamer sacó esta IP de su canal hace poco?</summary>
        bool IsIpBanned(string login, string ip);
    }
}
