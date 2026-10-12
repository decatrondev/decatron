using Decatron.Hubs;

namespace Decatron.Services.LiveTranslation
{
    /// <summary>Lo que Twitch dice de una persona en un canal: moderador, VIP, nivel de suscripción (0 = no) y desde cuándo lo sigue.</summary>
    public sealed record ViewerRole(bool IsMod, bool IsVip, int SubTier, DateTime? FollowedAt);

    /// <summary>
    /// Las reglas de quién puede escuchar según el nivel del canal. Cada nivel incluye a los de arriba: seguidores ⊇ suscriptores ⊇ VIPs ⊇
    /// moderadores. El dueño del canal y la lista de permitidos siempre entran; la lista de bloqueados nunca. Lógica pura (sin red ni base
    /// de datos): el rol de Twitch llega por <c>getRole</c>, que solo se llama si hace falta y devuelve null si no se pudo comprobar.
    /// </summary>
    public static class AccessEvaluator
    {
        public static readonly string[] Modes = { "everyone", "logged_in", "followers", "subscribers", "vip", "mods", "list" };

        /// <summary>Los niveles que se comprueban con Twitch (necesitan el id de Twitch del espectador y un permiso del streamer).</summary>
        public static bool NeedsTwitch(string mode) => mode is "followers" or "subscribers" or "vip" or "mods";

        public static async Task<ViewerCheckResult> EvaluateAsync(AccessPolicy p, ViewerIdentity? who, Func<Task<ViewerRole?>> getRole)
        {
            var login = who?.Login.ToLowerInvariant();
            if (login != null && p.BlockList.Contains(login)) return new ViewerCheckResult("blocked");
            if (who != null && (who.UserId == p.UserId || login == p.Login.ToLowerInvariant())) return ViewerCheckResult.Allowed;
            if (login != null && p.AllowList.Contains(login)) return ViewerCheckResult.Allowed;

            switch (p.Mode)
            {
                case "everyone":
                    return ViewerCheckResult.Allowed;
                case "logged_in":
                    return who == null ? new ViewerCheckResult("login") : ViewerCheckResult.Allowed;
                case "list":
                    return who == null ? new ViewerCheckResult("login") : new ViewerCheckResult("list");
            }

            if (who == null) return new ViewerCheckResult("login");
            if (string.IsNullOrEmpty(who.TwitchId)) return new ViewerCheckResult("link_twitch");

            var role = await getRole();
            if (role == null) return new ViewerCheckResult("check_failed");

            switch (p.Mode)
            {
                case "mods":
                    return role.IsMod ? ViewerCheckResult.Allowed : new ViewerCheckResult("mod");
                case "vip":
                    return role.IsVip || role.IsMod ? ViewerCheckResult.Allowed : new ViewerCheckResult("vip");
                case "subscribers":
                    return role.SubTier >= p.MinSubTier || role.IsVip || role.IsMod ? ViewerCheckResult.Allowed : new ViewerCheckResult("sub", MinSubTier: p.MinSubTier);
                case "followers":
                    var followsLongEnough = role.FollowedAt != null && (DateTime.UtcNow - role.FollowedAt.Value).TotalDays >= p.MinFollowDays;
                    return followsLongEnough || role.SubTier > 0 || role.IsVip || role.IsMod ? ViewerCheckResult.Allowed : new ViewerCheckResult("follow", MinFollowDays: p.MinFollowDays);
            }
            return new ViewerCheckResult("check_failed");
        }

        /// <summary>«@Pepe, ana\nLuis» → {pepe, ana, luis}: minúsculas, sin @, solo nombres de usuario válidos, máximo 200.</summary>
        public static HashSet<string> ParseList(string? raw)
        {
            var set = new HashSet<string>(StringComparer.Ordinal);
            foreach (var part in (raw ?? "").Split(new[] { ',', '\n', '\r', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                var name = part.TrimStart('@').ToLowerInvariant();
                if (name.Length is >= 2 and <= 25 && name.All(c => char.IsAsciiLetterOrDigit(c) || c is '_' or '-')) set.Add(name);
                if (set.Count >= 200) break;
            }
            return set;
        }

        public static string NormalizeList(string? raw) => string.Join(",", ParseList(raw).OrderBy(x => x, StringComparer.Ordinal));
    }
}
