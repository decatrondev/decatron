namespace Decatron.Core.Helpers
{
    /// <summary>
    /// Plataforma de un seguidor guardado (columna platform de channel_followers y follower_history).
    /// Los ids de Twitch y de Kick son números sin relación: toda consulta por (canal, usuario) lleva la plataforma.
    /// </summary>
    public static class FollowerPlatforms
    {
        public const string Twitch = "twitch";
        public const string Kick = "kick";

        /// <summary>Minúsculas y solo valores conocidos; cualquier otra cosa (o nada) es Twitch, que es lo histórico.</summary>
        public static string Normalize(string? value)
            => string.Equals(value?.Trim(), Kick, System.StringComparison.OrdinalIgnoreCase) ? Kick : Twitch;
    }
}
