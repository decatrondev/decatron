namespace Decatron.Core.Helpers
{
    /// <summary>Un follow de Kick listo para guardar como seguidor.</summary>
    public sealed record KickFollowRecord(string BroadcasterId, string UserId, string UserName, string UserLogin, DateTime FollowedAtUtc);

    /// <summary>
    /// Regla pura (sin red ni base de datos): decide si un evento común de Kick se guarda como seguidor y con qué datos.
    /// Los follows anónimos o sin id no se guardan. Kick no entrega el «login» aparte del nombre en este evento, así que
    /// el login se guarda en minúsculas a partir del nombre.
    /// </summary>
    public static class KickFollowMapper
    {
        public static KickFollowRecord? FromEvent(PlatformEvent? e, DateTime nowUtc)
        {
            if (e == null || e.Type != PlatformEventType.Follow || e.IsAnonymous) return null;
            if (string.IsNullOrWhiteSpace(e.BroadcasterId) || string.IsNullOrWhiteSpace(e.UserId)) return null;

            var name = string.IsNullOrWhiteSpace(e.UserName) ? e.UserId! : e.UserName!.Trim();
            var at = e.OccurredAtUtc ?? nowUtc;
            at = at.Kind switch
            {
                DateTimeKind.Local => at.ToUniversalTime(),
                DateTimeKind.Unspecified => DateTime.SpecifyKind(at, DateTimeKind.Utc),
                _ => at
            };
            return new KickFollowRecord(e.BroadcasterId.Trim(), e.UserId!.Trim(), name, name.ToLowerInvariant(), at);
        }
    }
}
