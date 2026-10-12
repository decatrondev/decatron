namespace Decatron.Hubs
{
    /// <summary>Los límites de acceso de un canal que el hub aplica al entrar un oyente (los resuelve el servicio de acceso).</summary>
    public sealed record TranslationLimits(bool Paused, int MaxListenersTotal, int MaxListenersPerLanguage, int MaxActiveLanguages, int MaxConnectionsPerIp, int MaxConnectionsPerUser, IReadOnlyList<string> Languages);

    /// <summary>
    /// Si un espectador puede escuchar el canal según el nivel que eligió el streamer. Reason null = puede. Si no: login, link_twitch,
    /// follow, sub, vip, mod, list, blocked o check_failed (no se pudo comprobar: nunca se abre de más). MinFollowDays y MinSubTier
    /// acompañan a follow y sub para que el cliente explique qué se pide.
    /// </summary>
    public sealed record ViewerCheckResult(string? Reason, int? MinFollowDays = null, int? MinSubTier = null)
    {
        public static readonly ViewerCheckResult Allowed = new((string?)null);
    }

    public interface ITranslationAccessGate
    {
        /// <summary>Los límites del canal; null si el canal no tiene la traducción encendida.</summary>
        Task<TranslationLimits?> GetLimitsAsync(string login);

        /// <summary>¿Puede esta persona (o un anónimo, si <paramref name="who"/> es null) escuchar el canal? Cuenta el nivel, las listas y el bloqueo.</summary>
        Task<ViewerCheckResult> CheckViewerAsync(string login, ViewerIdentity? who);
    }
}
