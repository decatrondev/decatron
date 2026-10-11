using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Default.Helpers;
using Decatron.Services.Accounts;
using Decatron.Services.Platforms;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Platforms.Kick
{
    /// <summary>
    /// !title / !t / !game / !g y los micro comandos en el chat de Kick (plan: .dev/plans/KICK_TITULO_CATEGORIA_PLAN.md). Se engancha en
    /// CommandService antes de buscar el comando, así no hay que tocar las copias de Twitch. Sin argumento dice lo actual; con
    /// argumento lo cambia (streamer, moderadores y quien tenga permiso de moderación en el panel). Usa el token de Kick del streamer.
    /// Los micro comandos son por cuenta: se guardan bajo el login de la fila principal (Twitch si existe), igual que las demás
    /// configuraciones multiplataforma.
    /// </summary>
    public class KickTitleCategoryHandler
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ICommandStateService _commandState;
        private readonly ICommandMessagesService _messages;
        private readonly AccountChannelResolver _accounts;
        private readonly ChannelSyncService _sync;
        private readonly ILogger<KickTitleCategoryHandler> _logger;

        /// <summary>Lo pone CommandService para que recargue su caché de micro comandos tras un !g set / !g remove (evita una dependencia circular).</summary>
        public Func<string, Task>? OnMicroCommandsChanged { get; set; }

        public KickTitleCategoryHandler(IServiceScopeFactory scopeFactory, ICommandStateService commandState,
            ICommandMessagesService messages, AccountChannelResolver accounts, ChannelSyncService sync, ILogger<KickTitleCategoryHandler> logger)
        {
            _scopeFactory = scopeFactory;
            _commandState = commandState;
            _messages = messages;
            _accounts = accounts;
            _sync = sync;
            _logger = logger;
        }

        private static readonly string[] ReservedWords = { "!g", "!game", "!set", "!remove", "!delete", "!list", "!help", "!title", "!t" };

        private static string? KindOf(string name) => name switch
        {
            "!title" or "!t" => "title",
            "!game" or "!g" => "game",
            _ => null
        };

        private static bool IsKick(CommandContext ctx) =>
            ctx.Metadata != null && ctx.Metadata.TryGetValue("platform", out var p)
            && string.Equals(p?.ToString(), "kick", StringComparison.OrdinalIgnoreCase);

        /// <summary>Login bajo el que se guardan los micro comandos de la cuenta (fila principal).</summary>
        public async Task<string?> MicroOwnerLoginAsync(long channelUserId)
        {
            var account = await _accounts.ResolveByUserIdAsync(channelUserId);
            return account?.Principal.Login;
        }

        /// <summary>true si el mensaje era uno de estos comandos en Kick y ya se atendió.</summary>
        public async Task<bool> TryHandleAsync(CommandContext ctx, IMessageSender sender)
        {
            if (!IsKick(ctx) || ctx.ChannelUserId is not long channelUserId) return false;

            var parts = ctx.Message.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 0) return false;
            var name = parts[0].ToLowerInvariant();
            var kind = KindOf(name);
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

                // !g set / list / remove / help: gestión de micro comandos
                if (name == "!g" && arg.Length > 0)
                {
                    var sub = arg.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries)[0].ToLowerInvariant();
                    if (sub is "help" or "list" or "set" or "remove" or "delete")
                    {
                        await HandleMicroManagementAsync(sp, db, ctx, sender, user, lang, sub, arg);
                        return true;
                    }
                }

                var kickApi = sp.GetRequiredService<IKickApiService>();
                var token = await KickChannelTokens.GetValidAsync(sp, user, _logger);

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
                    if (res.Ok) await MirrorAsync(ctx, sender, user.Id, "title", arg, Say);
                    return true;
                }

                var (catValid, catError) = GameUtils.ValidateCategory(arg);
                if (!catValid) { await sender.SendMessageAsync(ctx.Channel, Say("error_validation", catError)); return true; }

                var category = await sp.GetRequiredService<KickCategoryService>().ResolveAsync(arg, token);
                if (category == null) { await sender.SendMessageAsync(ctx.Channel, Say("not_found", arg)); return true; }

                var upd = await kickApi.UpdateChannelAsync(token, null, category.Id);
                await sender.SendMessageAsync(ctx.Channel, upd.Ok ? Say("success", category.Name) : Say(upd.NeedsRelink ? "relink" : "error_change"));
                if (upd.Ok) await MirrorAsync(ctx, sender, user.Id, "game", category.Name, Say);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Kick] Error en {Command} de {Channel}", kind, ctx.Channel);
                try { await sender.SendMessageAsync(ctx.Channel, Say("error_generic")); } catch { /* sin respuesta */ }
                return true;
            }
        }

        /// <summary>Ejecuta un micro comando (por ejemplo !apex → Apex Legends) en el chat de Kick.</summary>
        public async Task RunMicroAsync(CommandContext ctx, IMessageSender sender, string commandName, string categoryName)
        {
            var lang = "es";
            string Say(string key, params object[] args) => _messages.GetMessage("micro", key, lang, args);
            try
            {
                if (ctx.ChannelUserId is not long channelUserId) return;
                using var scope = _scopeFactory.CreateScope();
                var sp = scope.ServiceProvider;
                var db = sp.GetRequiredService<DecatronDbContext>();
                var user = await db.Users.FirstOrDefaultAsync(u => u.Id == channelUserId);
                if (user == null) return;
                lang = user.PreferredLanguage ?? "es";

                // Los micro comandos dependen del comando !game, igual que en Twitch
                if (!await _commandState.IsCommandEnabledAsync(user.Id, "game")) return;

                if (!await HasPermissionAsync(sp, db, ctx, user))
                {
                    await sender.SendMessageAsync(ctx.Channel, Say("permission_denied", commandName));
                    return;
                }

                var (valid, _) = GameUtils.ValidateCategory(categoryName);
                if (!valid) { await sender.SendMessageAsync(ctx.Channel, Say("error_validation", categoryName)); return; }

                var token = await KickChannelTokens.GetValidAsync(sp, user, _logger);
                if (string.IsNullOrEmpty(token)) { await sender.SendMessageAsync(ctx.Channel, Say("relink")); return; }

                var category = await sp.GetRequiredService<KickCategoryService>().ResolveAsync(categoryName, token);
                if (category == null) { await sender.SendMessageAsync(ctx.Channel, Say("error_validation", categoryName)); return; }

                var upd = await sp.GetRequiredService<IKickApiService>().UpdateChannelAsync(token, null, category.Id);
                await sender.SendMessageAsync(ctx.Channel, upd.Ok ? Say("success", category.Name, commandName) : Say(upd.NeedsRelink ? "relink" : "error_change", commandName));
                if (upd.Ok) await MirrorAsync(ctx, sender, user.Id, "game", category.Name, Say);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Kick] Error en el micro comando {Command} de {Channel}", commandName, ctx.Channel);
                try { await sender.SendMessageAsync(ctx.Channel, Say("error_generic")); } catch { /* sin respuesta */ }
            }
        }

        /// <summary>Si la cuenta tiene activado aplicar en las dos plataformas, copia el cambio a Twitch y avisa solo si falló.</summary>
        private async Task MirrorAsync(CommandContext ctx, IMessageSender sender, long kickRowUserId, string kind, string value, Func<string, object[], string> say)
        {
            var res = await _sync.MirrorFromKickAsync(kickRowUserId, kind, value);
            if (res.Attempted && !res.Ok) await sender.SendMessageAsync(ctx.Channel, say("sync_failed", new object[] { "Twitch" }));
        }

        private async Task HandleMicroManagementAsync(IServiceProvider sp, DecatronDbContext db, CommandContext ctx, IMessageSender sender,
            User channelUser, string lang, string sub, string arg)
        {
            string Say(string key, params object[] args) => _messages.GetMessage("g", key, lang, args);
            var send = (string text) => sender.SendMessageAsync(ctx.Channel, text);

            var account = await _accounts.ResolveByUserIdAsync(channelUser.Id);
            var owner = account?.Principal;
            if (owner == null) return;
            var tokens = arg.Split(' ', StringSplitOptions.RemoveEmptyEntries); // [sub, comando, categoría...]

            if (sub == "help") { await send(Say("help")); return; }

            if (sub == "list")
            {
                var list = await db.MicroGameCommands.AsNoTracking().Where(m => m.ChannelName == owner.Login)
                    .OrderBy(m => m.ShortCommand).Take(10).Select(m => m.ShortCommand).ToListAsync();
                await send(list.Count > 0 ? Say("micro_list", string.Join(", ", list)) : Say("micro_list_empty"));
                return;
            }

            // set y remove cambian la configuración del canal: mismos permisos que para cambiar la categoría
            if (!await HasPermissionAsync(sp, db, ctx, channelUser)) { await send(Say("permission_denied_micro")); return; }

            if (sub == "set")
            {
                if (tokens.Length < 3) { await send(Say("micro_set_usage")); return; }
                var command = tokens[1].StartsWith('!') ? tokens[1] : "!" + tokens[1];
                var category = string.Join(" ", tokens.Skip(2));
                if (!System.Text.RegularExpressions.Regex.IsMatch(command, @"^![a-zA-Z0-9]+$") || ReservedWords.Contains(command.ToLowerInvariant()))
                { await send(Say("micro_reserved", command)); return; }
                var (valid, error) = GameUtils.ValidateCategory(category);
                if (!valid) { await send(Say("error_validation", error)); return; }

                var existing = await db.MicroGameCommands.FirstOrDefaultAsync(m => m.ChannelName == owner.Login && m.ShortCommand == command);
                if (existing != null)
                {
                    existing.CategoryName = category;
                    existing.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    db.MicroGameCommands.Add(new MicroGameCommands
                    {
                        ChannelName = owner.Login, UserId = owner.UserId, ShortCommand = command, CategoryName = category,
                        CreatedBy = ctx.Username, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
                    });
                }
                await db.SaveChangesAsync();
                if (OnMicroCommandsChanged != null) await OnMicroCommandsChanged(owner.Login);
                await send(existing != null ? Say("micro_updated", command, category) : Say("micro_created", command, category));
                return;
            }

            // remove / delete
            if (tokens.Length < 2) { await send(Say("micro_remove_usage")); return; }
            var rm = tokens[1].StartsWith('!') ? tokens[1] : "!" + tokens[1];
            var row = await db.MicroGameCommands.FirstOrDefaultAsync(m => m.ChannelName == owner.Login && m.ShortCommand == rm);
            if (row == null) { await send(Say("micro_not_found", rm)); return; }
            db.MicroGameCommands.Remove(row);
            await db.SaveChangesAsync();
            if (OnMicroCommandsChanged != null) await OnMicroCommandsChanged(owner.Login);
            await send(Say("micro_removed", rm));
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
    }
}
