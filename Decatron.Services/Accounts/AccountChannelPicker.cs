namespace Decatron.Services.Accounts
{
    /// <summary>Variante de un overlay multiplataforma: qué plataformas escucha</summary>
    public static class OverlayVariant
    {
        public const string All = "all";
        public const string Twitch = "twitch";
        public const string Kick = "kick";

        /// <summary>Normaliza el valor de <c>?source=</c>; null si no es una variante conocida</summary>
        public static string? Parse(string? value) => value?.Trim().ToLowerInvariant() switch
        {
            All => All,
            Twitch => Twitch,
            Kick => Kick,
            _ => null
        };
    }

    /// <summary>Lo mínimo que se necesita de una fila de <c>users</c> para decidir la fila principal</summary>
    public sealed record ChannelRow(long UserId, long? AccountId, string Login, string? TwitchId, string? KickId, string? KickUsername);

    /// <summary>Un canal de la cuenta. Platform: twitch | kick | other (p. ej. una cuenta solo de Discord)</summary>
    public sealed record AccountChannel(long UserId, string Login, string Platform, string? TwitchId, string? KickId, string? KickUsername);

    /// <summary>
    /// Todos los canales de una persona y cuál es el principal. La clave de overlay de la cuenta es el login de la
    /// fila principal: es el grupo SignalR (<c>overlay_{OverlayKey}</c>) donde se emite cada evento, una sola vez.
    /// </summary>
    public sealed record AccountChannels(AccountChannel Principal, IReadOnlyList<AccountChannel> Members)
    {
        public string OverlayKey => Principal.Login;
        public bool HasTwitch => Members.Any(m => !string.IsNullOrEmpty(m.TwitchId));
        public bool HasKick => Members.Any(m => !string.IsNullOrEmpty(m.KickId));
        public string? TwitchId => Members.FirstOrDefault(m => !string.IsNullOrEmpty(m.TwitchId))?.TwitchId;
        public string? KickId => Members.FirstOrDefault(m => !string.IsNullOrEmpty(m.KickId))?.KickId;
    }

    /// <summary>
    /// Resultado de resolver un alias (lo que trae la URL del overlay o el canal de un comando).
    /// LegacyVariant es lo que ese alias mostraba antes de unificar: un enlace viejo no cambia de comportamiento.
    /// </summary>
    public sealed record ResolvedAlias(AccountChannels Account, AccountChannel Matched, string LegacyVariant);

    /// <summary>
    /// Reglas puras (sin base de datos) para agrupar filas en una cuenta y elegir la principal.
    /// Plan: .dev/plans/CHAT_UNIFICADO_PLAN.md, fase 1.
    /// </summary>
    public static class AccountChannelPicker
    {
        public static string PlatformOf(ChannelRow row) =>
            !string.IsNullOrEmpty(row.TwitchId) ? "twitch" :
            !string.IsNullOrEmpty(row.KickId) ? "kick" : "other";

        private static int Rank(string platform) => platform switch { "twitch" => 0, "kick" => 1, _ => 2 };

        public static AccountChannel ToChannel(ChannelRow row) =>
            new(row.UserId, row.Login.ToLowerInvariant(), PlatformOf(row), row.TwitchId, row.KickId, row.KickUsername);

        /// <summary>
        /// La principal es la fila de Twitch si existe; si no, la de Kick; si no, cualquier otra. Con varias del mismo
        /// tipo gana la de menor id, para que la elección no cambie de un momento a otro.
        /// </summary>
        public static AccountChannels? Build(IEnumerable<ChannelRow> rows)
        {
            var members = rows.DistinctBy(r => r.UserId).Select(ToChannel)
                .OrderBy(m => Rank(m.Platform)).ThenBy(m => m.UserId).ToList();
            return members.Count == 0 ? null : new AccountChannels(members[0], members);
        }

        /// <summary>
        /// Qué muestra un enlace que no trae <c>?source=</c>. El enlace del login de la cuenta reúne las plataformas
        /// que el streamer activó en Fuentes del panel (así lo promete la pantalla), o sea "all". Solo los alias de
        /// una fila de Kick (kick_&lt;id&gt; o el KickId) siguen mostrando únicamente Kick, como antes de unificar.
        /// </summary>
        public static string LegacyVariant(ChannelRow matched)
        {
            var hasTwitch = !string.IsNullOrEmpty(matched.TwitchId);
            var hasKick = !string.IsNullOrEmpty(matched.KickId);
            return hasKick && !hasTwitch ? OverlayVariant.Kick : OverlayVariant.All;
        }
    }
}
