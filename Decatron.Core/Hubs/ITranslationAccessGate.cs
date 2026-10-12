namespace Decatron.Hubs
{
    /// <summary>Los límites de acceso de un canal que el hub aplica al entrar un oyente (los resuelve el servicio de acceso).</summary>
    public sealed record TranslationLimits(bool Paused, int MaxListenersTotal, int MaxListenersPerLanguage, int MaxActiveLanguages, int MaxConnectionsPerIp, IReadOnlyList<string> Languages);

    public interface ITranslationAccessGate
    {
        /// <summary>Los límites del canal; null si el canal no tiene la traducción encendida.</summary>
        Task<TranslationLimits?> GetLimitsAsync(string login);
    }
}
