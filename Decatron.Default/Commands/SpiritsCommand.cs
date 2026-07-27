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
    /// Subcomandos:
    ///   !spirits              — Ver tu progreso (X/87, Y%)
    ///   !spirits @usuario     — Ver progreso de otro usuario
    ///   !spirits top          — Leaderboard global (top 5)
    ///   !spirits missing      — Tus primeros spirits faltantes
    ///   !spirit &lt;nombre&gt;      — Marcar spirit como obtenido
    ///   !spirit remove &lt;nombre&gt; — Desmarcar spirit
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

                // Parse subcommand: "!spirits top", "!spirits missing", "!spirits @user", "!spirits"
                var parts = message.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                var sub = parts.Length > 1 ? parts[1].ToLower() : "";

                if (sub == "help")
                {
                    await messageSender.SendMessageAsync(channel,
                        "🎮 Spirits: !spirits [usuario] · !spirits top · !spirits missing [usuario] · !spirit <nombre> · !spirit remove <nombre> · !spirit check <nombre>");
                    return;
                }

                if (sub == "top")
                {
                    await HandleTop(channel, messageSender);
                    return;
                }

                if (sub == "missing")
                {
                    // !spirits missing @user / !spirits missing user
                    var missingTarget = parts.Length > 2 ? parts[2].TrimStart('@').ToLower() : username;
                    var missingIsOther = parts.Length > 2;
                    await HandleMissing(channel, missingTarget, messageSender, missingIsOther);
                    return;
                }

                // !spirits @user / !spirits user (without @)
                if (sub.StartsWith("@") || (!string.IsNullOrEmpty(sub) && sub != "top"))
                {
                    var targetUser = sub.TrimStart('@').ToLower();
                    await HandleProgress(channel, targetUser, messageSender, isOther: true);
                    return;
                }

                // !spirits — own progress
                await HandleProgress(channel, username, messageSender, isOther: false);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpiritsCommand] Error en !spirits");
            }
        }

        // ── !spirits / !spirits @user ──────────────────────────────────────────

        private async Task HandleProgress(string channel, string username, IMessageSender sender, bool isOther)
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

            var total = collection.Count(c => !c.Sprite.IsUnreleased);
            var obtained = collection.Count(c => c.IsObtained && !c.Sprite.IsUnreleased);
            var pct = total > 0 ? (int)Math.Round(obtained * 100.0 / total) : 0;
            var missing = total - obtained;

            var prefix = isOther ? $"@{username}" : $"@{username}";
            await sender.SendMessageAsync(channel,
                $"{prefix} tiene {obtained}/{total} Fortnite Spirits ({pct}%) · Faltan {missing} · twitch.decatron.net/sprites/{username}");
        }

        // ── !spirits top ───────────────────────────────────────────────────────

        private async Task HandleTop(string channel, IMessageSender sender)
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var fortnite = scope.ServiceProvider.GetRequiredService<IFortniteService>();

            var leaders = await fortnite.GetGlobalLeaderboardAsync(top: 5);
            if (leaders == null || leaders.Count == 0)
            {
                await sender.SendMessageAsync(channel, "Aún no hay datos en el leaderboard de Spirits.");
                return;
            }

            var medals = new[] { "🥇", "🥈", "🥉", "4.", "5." };
            var parts = leaders.Select((e, i) =>
            {
                var pct = e.Total > 0 ? (int)Math.Round(e.Count * 100.0 / e.Total) : 0;
                return $"{medals[i]} {e.Username} {e.Count}/{e.Total} ({pct}%)";
            });

            await sender.SendMessageAsync(channel, "🏆 Spirits Top 5: " + string.Join(" | ", parts));
        }

        // ── !spirits missing ───────────────────────────────────────────────────

        private async Task HandleMissing(string channel, string username, IMessageSender sender, bool isOther = false)
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
                    $"@{username} ¡Colección completa! 🎉 Tienes todos los spirits.");
                return;
            }

            var shown = string.Join(", ", missing);
            var extra = total > 5 ? $" (+{total - 5} más)" : "";
            var verb = isOther ? "le faltan" : "te faltan";
            await sender.SendMessageAsync(channel,
                $"@{username} {verb} {total} spirits: {shown}{extra}");
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
                }
                else
                {
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
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpiritCommand] Error en !spirit");
            }
        }
    }
}
