using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Default.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Platforms.Kick
{
    /// <summary>
    /// !title / !t / !game / !g en el chat de Kick (plan: .dev/plans/KICK_TITULO_CATEGORIA_PLAN.md). Se engancha en CommandService
    /// antes de buscar el comando, así no hay que tocar las copias de Twitch. Sin argumento dice lo actual; con argumento lo cambia
    /// (streamer, moderadores y quien tenga permiso de moderación en el panel). Usa el token de Kick del streamer.
    /// </summary>
    public class KickTitleCategoryHandler
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ICommandStateService _commandState;
        private readonly ICommandMessagesService _messages;
        private readonly ILogger<KickTitleCategoryHandler> _logger;

        public KickTitleCategoryHandler(IServiceScopeFactory scopeFactory, ICommandStateService commandState,
            ICommandMessagesService messages, ILogger<KickTitleCategoryHandler> logger)
        {
            _scopeFactory = scopeFactory;
            _commandState = commandState;
            _messages = messages;
            _logger = logger;
        }

        private static string? KindOf(string name) => name switch
        {
            "!title" or "!t" => "title",
            "!game" or "!g" => "game",
            _ => null
        };

        /// <summary>true si el mensaje era uno de estos comandos en Kick y ya se atendió.</summary>
        public async Task<bool> TryHandleAsync(CommandContext ctx, IMessageSender sender)
        {
            var isKick = ctx.Metadata != null && ctx.Metadata.TryGetValue("platform", out var p)
                && string.Equals(p?.ToString(), "kick", StringComparison.OrdinalIgnoreCase);
            if (!isKick || ctx.ChannelUserId is not long channelUserId) return false;

            var parts = ctx.Message.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 0) return false;
            var kind = KindOf(parts[0].ToLowerInvariant());
            if (kind == null) return false;
            var arg = parts.Length > 1 ? parts[1].Trim() : "";

            var lang = "es";
            string Say(string key, params object[] args) => _messages.GetMessage(kind, key, lang, args);
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var sp = scope.ServiceProvider;
                var db = sp.GetRequiredService<DecatronDbContext>();
                var user = await db.Users.FirstOrDefaultAsync(u => u.Id == channelUserId);
                if (user == null) return true;
                lang = user.PreferredLanguage ?? "es";

                // Desactivado en el panel: no responde (igual que en Twitch)
                if (!await _commandState.IsCommandEnabledAsync(user.Id, kind)) return true;

                var kickApi = sp.GetRequiredService<IKickApiService>();
                var token = await GetTokenAsync(sp, user);

                // Sin argumento: dice lo actual (lo puede pedir cualquiera)
                if (arg.Length == 0)
                {
                    var info = string.IsNullOrEmpty(token) ? null : await kickApi.GetOwnChannelAsync(token);
                    if (info == null)
                        await sender.SendMessageAsync(ctx.Channel, Say(string.IsNullOrEmpty(token) ? "relink" : (kind == "title" ? "error_get_title" : "error_get_category")));
                    // Kick solo devuelve el título y la categoría mientras el canal está en vivo; sin directo vienen vacíos
                    else if (kind == "title")
                        await sender.SendMessageAsync(ctx.Channel, string.IsNullOrWhiteSpace(info.StreamTitle) ? Say("read_offline") : Say("current_title", info.StreamTitle));
                    else
                        await sender.SendMessageAsync(ctx.Channel, string.IsNullOrWhiteSpace(info.CategoryName) ? Say("read_offline") : Say("current_category", info.CategoryName));
                    return true;
                }

                // Cambiar: streamer, moderadores (incluye a los líderes) o permiso de moderación en el panel
                if (!await HasPermissionAsync(sp, db, ctx, user))
                {
                    await sender.SendMessageAsync(ctx.Channel, Say("permission_denied"));
                    return true;
                }
                if (string.IsNullOrEmpty(token))
                {
                    await sender.SendMessageAsync(ctx.Channel, Say("relink"));
                    return true;
                }

                if (kind == "title")
                {
                    var (valid, error) = TitleUtils.ValidateTitle(arg);
                    if (!valid) { await sender.SendMessageAsync(ctx.Channel, Say("error_validation", error)); return true; }

                    var res = await kickApi.UpdateChannelAsync(token, arg, null);
                    await sender.SendMessageAsync(ctx.Channel, res.Ok ? Say("success", arg) : Say(res.NeedsRelink ? "relink" : "error_change"));
                    return true;
                }

                var (catValid, catError) = GameUtils.ValidateCategory(arg);
                if (!catValid) { await sender.SendMessageAsync(ctx.Channel, Say("error_validation", catError)); return true; }

                var category = await sp.GetRequiredService<KickCategoryService>().ResolveAsync(arg, token);
                if (category == null) { await sender.SendMessageAsync(ctx.Channel, Say("not_found", arg)); return true; }

                var upd = await kickApi.UpdateChannelAsync(token, null, category.Id);
                await sender.SendMessageAsync(ctx.Channel, upd.Ok ? Say("success", category.Name) : Say(upd.NeedsRelink ? "relink" : "error_change"));
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Kick] Error en {Command} de {Channel}", kind, ctx.Channel);
                try { await sender.SendMessageAsync(ctx.Channel, Say("error_generic")); } catch { /* sin respuesta */ }
                return true;
            }
        }

        private async Task<bool> HasPermissionAsync(IServiceProvider sp, DecatronDbContext db, CommandContext ctx, User channelUser)
        {
            if (ctx.IsBroadcaster || ctx.IsModerator) return true;
            // Permiso de moderación dado en el panel a alguien con cuenta de Decatron (se ubica por su id de Kick)
            var commander = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.KickId == ctx.UserId);
            if (commander == null) return false;
            if (commander.Id == channelUser.Id) return true;
            var perms = sp.GetService<IPermissionService>();
            return perms != null && await perms.HasPermissionLevelAsync(commander.Id, channelUser.Id, "moderation");
        }

        /// <summary>Token del streamer, refrescado si está por vencer (mismo criterio que la moderación de Kick).</summary>
        private async Task<string?> GetTokenAsync(IServiceProvider sp, User user)
        {
            var token = user.KickAccessToken;
            if ((user.KickTokenExpiration == null || user.KickTokenExpiration.Value <= DateTime.UtcNow.AddMinutes(2))
                && !string.IsNullOrEmpty(user.KickRefreshToken))
            {
                try { token = (await sp.GetRequiredService<IKickTokenRefreshService>().RefreshUserTokenAsync(user)).KickAccessToken; }
                catch (KickTokenException ex) { _logger.LogWarning(ex, "[Kick] No se pudo refrescar el token de {Channel}", user.KickUsername); }
            }
            return token;
        }
    }
}
