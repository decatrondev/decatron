using System.Collections.Concurrent;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Core.Models.Promo;
using Decatron.Core.Settings;
using Decatron.Data;
using Decatron.Services.Accounts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Services.Promo
{
    /// <summary>
    /// Comando de chat de Promociones (por defecto !dpromo, apagado hasta que el streamer lo active): mostrar &lt;nombre&gt;, lista,
    /// pausar y reanudar. Twitch y Kick. Las reglas puras están en <see cref="PromoCommand"/>. Plan: .dev/plans/overlay-promo/PLAN.md §9.3.
    /// Devuelve true si el mensaje era el comando de un canal que lo tiene activo (ya atendido); false para que siga su camino.
    /// </summary>
    public class PromoCommandService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly AccountChannelResolver _accounts;
        private readonly IOptionsMonitor<PromoOverlaySettings> _settings;
        private readonly ILogger<PromoCommandService> _logger;

        private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(20);
        private readonly ConcurrentDictionary<long, (DateTime At, PromoChannelSettings? Row)> _cache = new();
        private readonly ConcurrentDictionary<long, DateTime> _lastUse = new();

        public PromoCommandService(IServiceScopeFactory scopeFactory, AccountChannelResolver accounts,
            IOptionsMonitor<PromoOverlaySettings> settings, ILogger<PromoCommandService> logger)
        {
            _scopeFactory = scopeFactory;
            _accounts = accounts;
            _settings = settings;
            _logger = logger;
        }

        /// <summary>El panel llama esto al guardar para que el cambio se note de inmediato.</summary>
        public void Invalidate(long principalUserId) => _cache.TryRemove(principalUserId, out _);

        private async Task<PromoChannelSettings?> ActiveRowAsync(long principalUserId)
        {
            if (_cache.TryGetValue(principalUserId, out var hit) && DateTime.UtcNow - hit.At < CacheTtl) return hit.Row;
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var row = await db.PromoChannelSettings.AsNoTracking().FirstOrDefaultAsync(c => c.UserId == principalUserId);
            var active = row is { CmdEnabled: true } ? row : null;
            _cache[principalUserId] = (DateTime.UtcNow, active);
            return active;
        }

        public async Task<bool> TryHandleAsync(CommandContext ctx, IMessageSender sender)
        {
            if (!_settings.CurrentValue.Enabled) return false;
            var parts = ctx.Message.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 0 || !parts[0].StartsWith('!') || ctx.ChannelUserId is not long rowUserId) return false;
            var typed = parts[0][1..].ToLowerInvariant();

            try
            {
                var account = await _accounts.ResolveByUserIdAsync(rowUserId);
                var principalId = account?.Principal.UserId ?? rowUserId;
                var row = await ActiveRowAsync(principalId);
                if (row == null || account == null || typed != row.CmdName) return false;

                using var catScope = _scopeFactory.CreateScope();
                var messages = catScope.ServiceProvider.GetRequiredService<ICommandMessagesService>();
                var db0 = catScope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var pref = await db0.Users.AsNoTracking().Where(u => u.Id == principalId).Select(u => u.PreferredLanguage).FirstOrDefaultAsync();
                var lang = pref != null && pref.StartsWith("en", StringComparison.OrdinalIgnoreCase) ? "en" : "es";
                string Say(string key, params object[] args) => messages.GetMessage("dpromo", key, lang, args);

                if (!PromoCommand.IsAllowed(row.CmdMinRole, ctx.IsBroadcaster, ctx.IsLeadModerator, ctx.IsModerator, ctx.IsVip, ctx.IsSubscriber))
                {
                    await sender.SendMessageAsync(ctx.Channel, Say("no_permission", ctx.Username));
                    return true;
                }

                var now = DateTime.UtcNow;
                if (_lastUse.TryGetValue(principalId, out var last) && (now - last).TotalSeconds < row.CmdCooldownSeconds) return true; // en silencio: no llenar el chat
                _lastUse[principalId] = now;

                var rest = parts.Length > 1 ? parts[1].Trim() : "";
                var sub = rest.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
                var verb = sub.Length > 0 ? sub[0].ToLowerInvariant() : "";
                var arg = sub.Length > 1 ? sub[1].Trim() : "";

                var snap = await catScope.ServiceProvider.GetRequiredService<PromoCatalogService>().GetPublishedAsync();
                var logins = account.Members.Select(m => m.Login).ToList();
                var variant = ctx.Metadata != null && ctx.Metadata.TryGetValue("platform", out var pl) && string.Equals(pl?.ToString(), "kick", StringComparison.OrdinalIgnoreCase) ? "kick" : "twitch";
                var mine = snap.Pieces
                    .Where(p => p.Kind != PromoPlayback.EmergencyKind && p.Status == "published" && p.Weight > 0
                        && (p.StartsAt == null || now >= p.StartsAt) && (p.EndsAt == null || now <= p.EndsAt)
                        && (string.IsNullOrWhiteSpace(p.OnlyChannels)
                            || p.OnlyChannels.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Any(c => logins.Any(l => string.Equals(l, c, StringComparison.OrdinalIgnoreCase)))))
                    .ToList();
                var en = lang == "en";
                // Tarjetas propias del streamer: `mostrar` las saca aunque estén apagadas; `lista` solo las encendidas.
                var ownAll = (await db0.PromoOwnCards.AsNoTracking().Where(c => c.UserId == principalId && !c.HiddenByAdmin).ToListAsync())
                    .Select(c => (Card: c, Piece: PromoOwnCards.ToPiece(c, snap.Templates, snap.Limits))).Where(x => x.Piece.TemplateId != null).ToList();

                switch (verb)
                {
                    case "lista":
                    case "list":
                    {
                        var disabled = PromoPlayback.DisabledIds(row);
                        var names = mine.Where(p => !disabled.Contains(p.Id)).Concat(ownAll.Where(x => x.Card.IsEnabled).Select(x => x.Piece))
                            .Select(p => PromoCommand.DisplayName(p, en)).Where(n => n != "").Distinct().ToList();
                        await sender.SendMessageAsync(ctx.Channel, names.Count == 0 ? Say("list_empty") : Say("list", string.Join(", ", names)));
                        break;
                    }
                    case "mostrar":
                    case "show":
                    {
                        if (arg == "") { await sender.SendMessageAsync(ctx.Channel, Say("show_usage", row.CmdName)); break; }
                        var piece = PromoCommand.FindByName(mine.Concat(ownAll.Select(x => x.Piece)).ToList(), arg);
                        if (piece == null) { await sender.SendMessageAsync(ctx.Channel, Say("not_found", arg)); break; }
                        PromoCommand.Force(PromoPlayback.StateOf(account.OverlayKey), piece, now);
                        await sender.SendMessageAsync(ctx.Channel, Say("shown", PromoCommand.DisplayName(piece, en)));
                        break;
                    }
                    case "pausar":
                    case "pause":
                    case "reanudar":
                    case "resume":
                        {
                            var pause = verb is "pausar" or "pause";
                            using var scope = _scopeFactory.CreateScope();
                            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                            var cur = await db.PromoChannelSettings.FirstOrDefaultAsync(c => c.UserId == principalId);
                            if (cur == null) break;
                            cur.Paused = pause;
                            cur.UpdatedAt = DateTime.UtcNow;
                            await db.SaveChangesAsync();
                            await sender.SendMessageAsync(ctx.Channel, Say(pause ? "paused" : "resumed"));
                            break;
                        }
                    default:
                        await sender.SendMessageAsync(ctx.Channel, Say("usage", row.CmdName));
                        break;
                }
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "!dpromo falló en {Channel}", ctx.Channel);
                return true;
            }
        }
    }
}
