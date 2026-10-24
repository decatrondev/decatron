using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace Decatron.Services.Commands
{
    /// <summary>
    /// Comandos de chat del giveaway, en Twitch y Kick: control para el streamer y los moderadores
    /// («!giveaway start|end|cancel|reroll|pick|status») y los de los viewers («&lt;entrada&gt; salir», «&lt;entrada&gt; yo», «!ganadores»).
    /// Nombres, rol mínimo y textos salen de GiveawaySettings.Commands (configuración guardada del canal).
    /// Los avisos del propio giveaway (inicio, ganadores, cancelación) los manda el servicio a todas las plataformas;
    /// aquí solo se responde a quien escribió, en su misma plataforma.
    /// </summary>
    public class GiveawayChatCommands
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<GiveawayChatCommands> _logger;

        // Frena el spam de los comandos abiertos a todos (clave -> hasta cuándo no responder)
        private static readonly ConcurrentDictionary<string, DateTime> _cooldowns = new();

        private static readonly Regex DurationToken = new(@"^(\d{1,5})(s|seg|m|min|h)$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

        public GiveawayChatCommands(IServiceScopeFactory scopeFactory, ILogger<GiveawayChatCommands> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        private static bool Cooldown(string key, int seconds)
        {
            var now = DateTime.UtcNow;
            if (_cooldowns.TryGetValue(key, out var until) && until > now) return false;
            _cooldowns[key] = now.AddSeconds(seconds);
            if (_cooldowns.Count > 5000)
                foreach (var k in _cooldowns.Where(kv => kv.Value < now).Select(kv => kv.Key).ToList())
                    _cooldowns.TryRemove(k, out _);
            return true;
        }

        private static string Fill(string text, params (string Key, string Value)[] vars)
        {
            foreach (var (key, value) in vars) text = text.Replace("{" + key + "}", value);
            return text;
        }

        private static int RankOf(CommandContext c) => c.IsBroadcaster ? 3 : c.IsLeadModerator ? 2 : c.IsModerator ? 1 : 0;

        private static Task Reply(CommandContext ctx, string platform, GiveawayService svc, IMessageSender sender, string text) =>
            string.IsNullOrWhiteSpace(text) ? Task.CompletedTask
            : platform == "kick" ? svc.ReplyAsync(ctx.Channel, "kick", text)
            : sender.SendMessageAsync(ctx.Channel, text);

        /// <summary>Atiende el comando raíz de control y el de ganadores. Devuelve true si el mensaje era uno de ellos.</summary>
        public async Task<bool> TryHandleAsync(CommandContext ctx, string platform, string channelId, string commandName, string message,
            IMessageSender sender, Func<Task<bool>> moduleOn)
        {
            // Camino rápido: con las reglas en caché, un «!comando» ajeno no cuesta ni un scope ni una consulta
            if (GiveawayService.TryGetCachedCommandRules(channelId, out var cachedRules) && !Matches(cachedRules, commandName)) return false;

            using var scope = _scopeFactory.CreateScope();
            var svc = scope.ServiceProvider.GetRequiredService<GiveawayService>();
            var rules = await svc.GetCommandRules(channelId);
            if (!Matches(rules, commandName)) return false;
            if (!await moduleOn()) return false;

            var root = GiveawayCommandRules.Normalize(rules.Root, "!giveaway");
            var winnersCmd = string.IsNullOrWhiteSpace(rules.WinnersCommand) ? null : GiveawayCommandRules.Normalize(rules.WinnersCommand, "!ganadores");

            try
            {
                if (commandName == root) { await HandleControlAsync(ctx, platform, channelId, message, rules, root, svc, sender); return true; }
                if (winnersCmd != null && commandName == winnersCmd)
                {
                    if (!Cooldown($"w:{channelId}:{platform}", 15)) return true;
                    var names = await svc.RecentWinnerNamesAsync(channelId, 5);
                    await Reply(ctx, platform, svc, sender, names.Count == 0
                        ? rules.Text("winners_none")
                        : Fill(rules.Text("winners"), ("list", string.Join(", ", names.Select(n => "@" + n)))));
                    return true;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en el comando {Cmd} del giveaway en {Channel}", commandName, ctx.Channel);
            }
            return false;
        }

        private static bool Matches(GiveawayCommandRules rules, string commandName) =>
            rules.Enabled && (commandName == GiveawayCommandRules.Normalize(rules.Root, "!giveaway")
                || (!string.IsNullOrWhiteSpace(rules.WinnersCommand) && commandName == GiveawayCommandRules.Normalize(rules.WinnersCommand, "!ganadores")));

        /// <summary>«&lt;comando de entrada&gt; salir» y «&lt;comando de entrada&gt; yo». Devuelve true si lo atendió.</summary>
        public async Task<bool> TryHandleEntrySubcommandAsync(CommandContext ctx, string platform, string channelId, string message, IMessageSender sender)
        {
            var parts = message.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 2) return false;
            var sub = parts[1].ToLowerInvariant();
            var isLeave = sub is "salir" or "leave";
            var isMe = sub is "yo" or "me";
            if (!isLeave && !isMe) return false;

            using var scope = _scopeFactory.CreateScope();
            var svc = scope.ServiceProvider.GetRequiredService<GiveawayService>();
            var rules = await svc.GetCommandRules(channelId);
            if (!rules.Enabled || (isLeave && !rules.ViewerLeave) || (isMe && !rules.ViewerStatus)) return false;
            if (!Cooldown($"v:{channelId}:{platform}:{ctx.UserId}:{sub}", 10)) return true;

            try
            {
                var user = ctx.Username;
                if (isLeave)
                {
                    var result = await svc.LeaveAsync(channelId, ctx.UserId, platform);
                    var key = result switch { "left" => "leave_done", "closed" => "leave_closed", "winner_locked" => "leave_winner", _ => "leave_not_in" };
                    await Reply(ctx, platform, svc, sender, Fill(rules.Text(key), ("user", user)));
                }
                else
                {
                    var info = await svc.ParticipationAsync(channelId, ctx.UserId, platform);
                    if (info == null) await Reply(ctx, platform, svc, sender, rules.Text("status_none"));
                    else await Reply(ctx, platform, svc, sender,
                        Fill(rules.Text(info.Value.Participating ? "me_in" : "me_out"), ("user", user), ("prize", info.Value.Prize), ("command", info.Value.Command)));
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en el subcomando {Sub} del giveaway en {Channel}", sub, ctx.Channel);
            }
            return true;
        }

        private async Task HandleControlAsync(CommandContext ctx, string platform, string channelId, string message,
            GiveawayCommandRules rules, string root, GiveawayService svc, IMessageSender sender)
        {
            // Quien no tiene el rol no recibe respuesta: cualquier viewer puede escribir el comando por curiosidad
            if (RankOf(ctx) < rules.MinRank) return;

            var args = message.Split(' ', StringSplitOptions.RemoveEmptyEntries).Skip(1).ToList();
            var sub = args.Count > 0 ? args[0].ToLowerInvariant() : "start"; // sin nada: inicia lo que ya está configurado
            var rest = args.Skip(1).ToList();
            string Say(string key, params (string, string)[] vars) =>
                Fill(rules.Text(key), vars.Append(("root", root)).Append(("user", ctx.Username)).ToArray());

            try
            {
                switch (sub)
                {
                    case "start" or "iniciar":
                    {
                        // Al final puede ir la duración («10m», «2h») o la palabra «manual»; lo anterior es el premio
                        int? seconds = null; var manual = false;
                        if (rest.Count > 0)
                        {
                            var last = rest[^1];
                            if (last.Equals("manual", StringComparison.OrdinalIgnoreCase)) { manual = true; rest.RemoveAt(rest.Count - 1); }
                            else
                            {
                                var m = DurationToken.Match(last);
                                if (m.Success)
                                {
                                    var n = int.Parse(m.Groups[1].Value);
                                    var unit = m.Groups[2].Value.ToLowerInvariant();
                                    var total = unit is "s" or "seg" ? n : unit == "h" ? n * 3600 : n * 60;
                                    seconds = Math.Clamp(total, 10, 7 * 24 * 3600);
                                    rest.RemoveAt(rest.Count - 1);
                                }
                            }
                        }
                        try { await svc.StartFromChatAsync(channelId, string.Join(' ', rest), seconds, manual); }
                        catch (InvalidOperationException ex) when (ex.Message == "no_config") { await Reply(ctx, platform, svc, sender, Say("no_config")); }
                        catch (InvalidOperationException ex) when (ex.Message == "no_prize") { await Reply(ctx, platform, svc, sender, Say("no_prize")); }
                        catch (InvalidOperationException) { await Reply(ctx, platform, svc, sender, Say("already_active")); }
                        // El aviso de inicio lo manda el servicio según la configuración del giveaway
                        break;
                    }
                    case "choose" or "elegir" or "end" or "fin" or "sortear" or "terminar":
                    {
                        // Sin nombre: sortea al azar. Con nombre: esa persona ocupa el lugar. El anuncio lo hace el servicio
                        var target = rest.FirstOrDefault()?.TrimStart('@');
                        try { await svc.ChooseAsync(channelId, target); }
                        catch (InvalidOperationException ex) when (ex.Message == "none_active") { await Reply(ctx, platform, svc, sender, Say("none_active")); }
                        catch (InvalidOperationException ex) when (ex.Message == "places_full") { await Reply(ctx, platform, svc, sender, Say("places_full")); }
                        catch (InvalidOperationException ex) when (ex.Message == "pick_not_found") { await Reply(ctx, platform, svc, sender, Say("pick_not_found", ("user", target ?? ""))); }
                        catch (InvalidOperationException ex) when (ex.Message == "already_winner") { await Reply(ctx, platform, svc, sender, Say("already_winner", ("user", target ?? ""))); }
                        catch (InvalidOperationException) { await Reply(ctx, platform, svc, sender, Say("no_one_to_choose")); }
                        break;
                    }
                    case "cancel" or "cancelar":
                        try
                        {
                            var current = await svc.GetCommandStatusAsync(channelId);
                            if (current.Phase == "none") { await Reply(ctx, platform, svc, sender, Say("none_active")); break; }
                            await svc.CancelGiveaway(channelId, "Cancelado desde el chat");
                            // El servicio solo avisa si el streamer escribió un mensaje de cancelación; aquí siempre se confirma a quien lo pidió
                            await Reply(ctx, platform, svc, sender, Say("cancel_done"));
                        }
                        catch (InvalidOperationException) { await Reply(ctx, platform, svc, sender, Say("none_active")); }
                        break;
                    case "finish" or "finalizar" or "listo":
                    {
                        var done = await svc.FinishAsync(channelId);
                        // El aviso de cierre lo manda el servicio; aquí solo se responde si no había nada que terminar
                        if (!done) await Reply(ctx, platform, svc, sender, Say("no_drawn"));
                        break;
                    }
                    case "close" or "cerrar" or "open" or "abrir":
                    {
                        var close = sub is "close" or "cerrar";
                        var done = await svc.SetEntriesClosedAsync(channelId, close);
                        await Reply(ctx, platform, svc, sender, Say(!done ? "none_active" : close ? "entries_closed" : "entries_opened"));
                        break;
                    }
                    case "reroll" or "resortear":
                    {
                        // Reemplaza al ganador que no respondió: con un nombre, por esa persona; sin nombre, por un respaldo o al azar
                        var target = rest.FirstOrDefault()?.TrimStart('@');
                        try
                        {
                            // El servicio revela y anuncia a los ganadores nuevos
                            await svc.RerollFromChatAsync(channelId, target);
                        }
                        catch (InvalidOperationException ex) when (ex.Message == "none_active") { await Reply(ctx, platform, svc, sender, Say("no_drawn")); }
                        catch (InvalidOperationException ex) when (ex.Message == "all_responded") { await Reply(ctx, platform, svc, sender, Say("all_responded")); }
                        catch (InvalidOperationException ex) when (ex.Message == "confirmed_locked") { await Reply(ctx, platform, svc, sender, Say("confirmed_locked", ("user", target ?? ""))); }
                        catch (InvalidOperationException ex) when (ex.Message == "pick_not_found") { await Reply(ctx, platform, svc, sender, Say("pick_not_found", ("user", target ?? ""))); }
                        catch (InvalidOperationException ex) when (ex.Message == "already_winner") { await Reply(ctx, platform, svc, sender, Say("already_winner", ("user", target ?? ""))); }
                        catch (InvalidOperationException) { await Reply(ctx, platform, svc, sender, Say("no_one_to_reroll")); }
                        break;
                    }
                    case "pick":
                    {
                        var target = rest.FirstOrDefault()?.TrimStart('@');
                        if (string.IsNullOrWhiteSpace(target)) { await Reply(ctx, platform, svc, sender, Say("pick_missing")); break; }
                        try
                        {
                            await svc.PickFromChatAsync(channelId, target);
                        }
                        catch (InvalidOperationException ex) when (ex.Message == "pick_not_found") { await Reply(ctx, platform, svc, sender, Say("pick_not_found", ("user", target))); }
                        catch (InvalidOperationException ex) when (ex.Message == "already_winner") { await Reply(ctx, platform, svc, sender, Say("already_winner", ("user", target))); }
                        catch (InvalidOperationException ex) when (ex.Message == "all_responded") { await Reply(ctx, platform, svc, sender, Say("all_responded")); }
                        catch (InvalidOperationException) { await Reply(ctx, platform, svc, sender, Say("no_drawn")); }
                        break;
                    }
                    case "status" or "estado":
                    {
                        var st = await svc.GetCommandStatusAsync(channelId);
                        if (st.Phase == "none") { await Reply(ctx, platform, svc, sender, Say("status_none")); break; }
                        var remaining = st.Phase == "open"
                            ? (st.MinutesLeft.HasValue ? Say("remaining_timed", ("minutes", st.MinutesLeft.Value.ToString())) : Say("remaining_manual"))
                            : "";
                        await Reply(ctx, platform, svc, sender,
                            Say(!st.EntriesOpen && st.Phase == "open" ? "status_closed" : st.Phase == "open" ? "status_open" : "status_drawing",
                                ("prize", st.Prize), ("count", st.Participants.ToString()), ("remaining", remaining), ("command", st.Command)));
                        break;
                    }
                    default:
                        await Reply(ctx, platform, svc, sender, Say("usage"));
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ejecutando «{Root} {Sub}» en {Channel}", root, sub, ctx.Channel);
            }
        }
    }
}
