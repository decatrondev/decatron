using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Default.Commands
{
    /// <summary>
    /// !spirits — Tracker de Fortnite Spirits
    /// Por defecto todo es por la temporada actual (IFortniteService.CurrentSeason);
    /// "all" muestra el historico de todas las temporadas, y el nombre de una
    /// temporada puntual (ej "runners") filtra solo esa.
    /// Subcomandos:
    ///   !spirits [@usuario] [all|temporada]  — Ver progreso
    ///   !spirits top [all|temporada]         — Leaderboard global (top 5)
    ///   !spirits missing [@usuario] [all|temporada] — Primeros spirits faltantes
    ///   !spirit &lt;nombre&gt;                     — Marcar spirit como obtenido
    ///   !spirit remove &lt;nombre&gt;              — Desmarcar spirit
    /// </summary>
    public class SpiritsCommand : ICommand
    {
        private readonly ILogger<SpiritsCommand> _logger;
        private readonly IServiceScopeFactory _serviceScopeFactory;

        public string Name => "!spirits";
        public string Description => "Tracker de Fortnite Spirits (!spirits, !spirits top, !spirits missing, !spirit <nombre>)";

        public SpiritsCommand(ILogger<SpiritsCommand> logger, IServiceScopeFactory serviceScopeFactory)
        {
            _logger = logger;
            _serviceScopeFactory = serviceScopeFactory;
        }

        public async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            try
            {
                var username = context.Username.ToLower();
                var channel = context.Channel;
                var message = context.Message.Trim();

                var parts = message.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                var sub = parts.Length > 1 ? parts[1].ToLower() : "";

                if (sub == "help")
                {
                    await messageSender.SendMessageAsync(channel,
                        "🎮 Spirits: !spirits [usuario] [all|temporada] · !spirits top [all|temporada] · !spirits missing [usuario] [all|temporada] · !spirit <nombre> · !spirit remove <nombre> · !spirit check <nombre>");
                    return;
                }

                using var scope = _serviceScopeFactory.CreateScope();
                var fortnite = scope.ServiceProvider.GetRequiredService<IFortniteService>();

                if (sub == "top")
                {
                    var (season, seasonLabel) = await ResolveSeason(fortnite, parts.Skip(2));
                    await HandleTop(channel, fortnite, messageSender, season, seasonLabel);
                    return;
                }

                if (sub == "missing")
                {
                    var (target, season, seasonLabel) = await ResolveTargetAndSeason(fortnite, parts.Skip(2), username);
                    await HandleMissing(channel, target ?? username, messageSender, isOther: target != null, season, seasonLabel);
                    return;
                }

                // !spirits [@usuario] [all|temporada]
                var (targetUser, targetSeason, targetSeasonLabel) = await ResolveTargetAndSeason(fortnite, parts.Skip(1), username);
                await HandleProgress(channel, targetUser ?? username, messageSender, isOther: targetUser != null, targetSeason, targetSeasonLabel);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpiritsCommand] Error en !spirits");
            }
        }

        // ── Resolucion de argumentos: usuario objetivo + temporada ────────────

        /// <summary>
        /// Un token es "@user" (usuario), "all" (historico), el nombre de una
        /// temporada existente, o — si no matchea nada de eso — se asume que es
        /// un nombre de usuario sin @ (comportamiento previo, se mantiene por
        /// compatibilidad). null en season = temporada actual (default).
        /// </summary>
        private static async Task<(string? user, string? season, string seasonLabel)> ResolveTargetAndSeason(
            IFortniteService fortnite, IEnumerable<string> tokens, string selfUsername)
        {
            var seasons = await fortnite.GetAvailableSeasonsAsync();
            string? user = null;
            string? season = null;
            var allTime = false;

            foreach (var tok in tokens)
            {
                if (tok.StartsWith("@"))
                {
                    user = tok.TrimStart('@').ToLower();
                    continue;
                }
                if (tok.Equals("all", StringComparison.OrdinalIgnoreCase))
                {
                    allTime = true;
                    continue;
                }
                var match = seasons.FirstOrDefault(s => s.Equals(tok, StringComparison.OrdinalIgnoreCase));
                if (match != null)
                {
                    season = match;
                    continue;
                }
                user ??= tok.ToLower();
            }

            var seasonLabel = allTime ? "todas las temporadas" : (season ?? fortnite.CurrentSeason);
            return (user, allTime ? null : (season ?? fortnite.CurrentSeason), seasonLabel);
        }

        private static async Task<(string? season, string seasonLabel)> ResolveSeason(IFortniteService fortnite, IEnumerable<string> tokens)
        {
            var (_, season, label) = await ResolveTargetAndSeason(fortnite, tokens, "");
            return (season, label);
        }

        // ── !spirits / !spirits @user ──────────────────────────────────────────

        private async Task HandleProgress(string channel, string username, IMessageSender sender, bool isOther, string? season, string seasonLabel)
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var fortnite = scope.ServiceProvider.GetRequiredService<IFortniteService>();

            var collection = await fortnite.GetPublicCollectionAsync(username);
            if (collection == null || collection.Count == 0)
            {
                await sender.SendMessageAsync(channel, isOther
                    ? $"@{username} no tiene una cuenta en Decatron o aún no tiene spirits."
                    : $"No tienes cuenta en Decatron todavía. Regístrate en twitch.decatron.net");
                return;
            }

            if (season != null)
                collection = collection.Where(c => c.Sprite.Season == season).ToList();

            var total = collection.Count(c => !c.Sprite.IsUnreleased);
            var obtained = collection.Count(c => c.IsObtained && !c.Sprite.IsUnreleased);
            var pct = total > 0 ? (int)Math.Round(obtained * 100.0 / total) : 0;
            var missing = total - obtained;

            var prefix = $"@{username}";
            await sender.SendMessageAsync(channel,
                $"{prefix} tiene {obtained}/{total} Spirits de {seasonLabel} ({pct}%) · Faltan {missing} · twitch.decatron.net/sprites/{username}");
        }

        // ── !spirits top ───────────────────────────────────────────────────────

        private async Task HandleTop(string channel, IFortniteService fortnite, IMessageSender sender, string? season, string seasonLabel)
        {
            var leaders = await fortnite.GetGlobalLeaderboardAsync(top: 5, season: season);
            if (leaders == null || leaders.Count == 0)
            {
                await sender.SendMessageAsync(channel, $"Aún no hay datos en el leaderboard de Spirits de {seasonLabel}.");
                return;
            }

            var medals = new[] { "🥇", "🥈", "🥉", "4.", "5." };
            var parts = leaders.Select((e, i) =>
            {
                var pct = e.Total > 0 ? (int)Math.Round(e.Count * 100.0 / e.Total) : 0;
                return $"{medals[i]} {e.Username} {e.Count}/{e.Total} ({pct}%)";
            });

            await sender.SendMessageAsync(channel, $"🏆 Spirits Top 5 ({seasonLabel}): " + string.Join(" | ", parts));
        }

        // ── !spirits missing ───────────────────────────────────────────────────

        private async Task HandleMissing(string channel, string username, IMessageSender sender, bool isOther, string? season, string seasonLabel)
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var fortnite = scope.ServiceProvider.GetRequiredService<IFortniteService>();

            var collection = await fortnite.GetPublicCollectionAsync(username);
            if (collection == null || collection.Count == 0)
            {
                await sender.SendMessageAsync(channel, isOther
                    ? $"@{username} no tiene cuenta en Decatron o aún no tiene spirits."
                    : $"No tienes cuenta en Decatron todavía. Regístrate en twitch.decatron.net");
                return;
            }

            if (season != null)
                collection = collection.Where(c => c.Sprite.Season == season).ToList();

            var missing = collection
                .Where(c => !c.IsObtained && !c.Sprite.IsUnreleased)
                .OrderBy(c => c.Sprite.Name)
                .Take(5)
                .Select(c => c.Sprite.Name)
                .ToList();

            var total = collection.Count(c => !c.IsObtained && !c.Sprite.IsUnreleased);

            if (total == 0)
            {
                await sender.SendMessageAsync(channel,
                    $"@{username} ¡Colección completa de {seasonLabel}! 🎉 Tienes todos los spirits.");
                return;
            }

            var shown = string.Join(", ", missing);
            var extra = total > 5 ? $" (+{total - 5} más)" : "";
            var verb = isOther ? "le faltan" : "te faltan";
            await sender.SendMessageAsync(channel,
                $"@{username} {verb} {total} spirits de {seasonLabel}: {shown}{extra}");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // !spirit <nombre> / !spirit remove <nombre>
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// !spirit — Marcar/desmarcar un spirit individual
    /// </summary>
    public class SpiritCommand : ICommand
    {
        private readonly ILogger<SpiritCommand> _logger;
        private readonly IServiceScopeFactory _serviceScopeFactory;

        public string Name => "!spirit";
        public string Description => "Marcar o desmarcar un spirit (!spirit <nombre>, !spirit remove <nombre>)";

        public SpiritCommand(ILogger<SpiritCommand> logger, IServiceScopeFactory serviceScopeFactory)
        {
            _logger = logger;
            _serviceScopeFactory = serviceScopeFactory;
        }

        public async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            try
            {
                var username = context.Username.ToLower();
                var channel = context.Channel;
                var message = context.Message.Trim();

                // parts[0] = "!spirit", parts[1] = "remove"? or name start
                var parts = message.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length < 2)
                {
                    await messageSender.SendMessageAsync(channel,
                        $"@{context.Username} Uso: !spirit <nombre> para marcar · !spirit remove <nombre> para desmarcar");
                    return;
                }

                bool isRemove = parts[1].StartsWith("remove ", StringComparison.OrdinalIgnoreCase);
                bool isCheck = parts[1].StartsWith("check ", StringComparison.OrdinalIgnoreCase);
                var query = isRemove
                    ? parts[1].Substring("remove ".Length).Trim()
                    : isCheck
                        ? parts[1].Substring("check ".Length).Trim()
                        : parts[1].Trim();

                if (string.IsNullOrWhiteSpace(query))
                {
                    await messageSender.SendMessageAsync(channel,
                        $"@{context.Username} Especifica el nombre del spirit.");
                    return;
                }

                using var scope = _serviceScopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var fortnite = scope.ServiceProvider.GetRequiredService<IFortniteService>();

                // Look up Decatron user
                var user = await db.Users.FirstOrDefaultAsync(u => u.Login == username);
                if (user == null)
                {
                    await messageSender.SendMessageAsync(channel,
                        $"@{context.Username} No tienes cuenta en Decatron. Regístrate en twitch.decatron.net");
                    return;
                }

                // Fuzzy search: exact name first, then contains
                var queryLower = query.ToLower();
                var sprite = await db.FortniteSprites
                    .Where(s => s.Name.ToLower() == queryLower)
                    .FirstOrDefaultAsync()
                    ?? await db.FortniteSprites
                        .Where(s => s.Name.ToLower().Contains(queryLower) || s.Character.ToLower().Contains(queryLower))
                        .FirstOrDefaultAsync();

                if (sprite == null)
                {
                    await messageSender.SendMessageAsync(channel,
                        $"@{context.Username} No encontré ningún spirit con ese nombre. Revisa tu colección en twitch.decatron.net/me/spirits");
                    return;
                }

                if (isCheck)
                {
                    var hasIt = await db.UserFortniteSprites
                        .AnyAsync(u => u.UserId == user.Id && u.SpriteId == sprite.Id);
                    var status = hasIt ? "✅ ya lo tienes" : "❌ aún no lo tienes";
                    await messageSender.SendMessageAsync(channel,
                        $"@{context.Username} {sprite.Name} ({sprite.Rarity}) — {status} · twitch.decatron.net/me/spirits");
                    return;
                }

                if (isRemove)
                {
                    await fortnite.UnmarkSpriteAsync(user.Id, sprite.SpriteKey);
                    await messageSender.SendMessageAsync(channel,
                        $"@{context.Username} ❌ {sprite.Name} desmarcado de tu colección.");
                    return;
                }

                if (sprite.IsUnreleased)
                {
                    await messageSender.SendMessageAsync(channel,
                        $"@{context.Username} {sprite.Name} todavía no salió en el juego, no se puede marcar todavía.");
                    return;
                }

                // Check if already obtained
                var alreadyHas = await db.UserFortniteSprites
                    .AnyAsync(u => u.UserId == user.Id && u.SpriteId == sprite.Id);

                if (alreadyHas)
                {
                    await messageSender.SendMessageAsync(channel,
                        $"@{context.Username} Ya tienes {sprite.Name} en tu colección. Usa !spirit remove {sprite.Name} para desmarcarlo.");
                    return;
                }

                await fortnite.MarkSpriteAsync(user.Id, sprite.SpriteKey, platform: "twitch");
                await messageSender.SendMessageAsync(channel,
                    $"@{context.Username} ✅ {sprite.Name} ({sprite.Rarity}) marcado como obtenido!");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpiritCommand] Error en !spirit");
            }
        }
    }
}
