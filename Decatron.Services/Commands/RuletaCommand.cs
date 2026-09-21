using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace Decatron.Services.Commands
{
    /// <summary>
    /// !ruleta — Ruleta rusa: probabilidad configurable de darle timeout a uno mismo
    /// o a un usuario objetivo. Si el objetivo ya es moderador, Twitch rechaza el
    /// timeout directo — hay que quitarle el mod, aplicar el timeout, y encolar la
    /// restauración (ver RuletaBackgroundService). El nivel de "Permisos" del canal
    /// es la única fuente de verdad sobre quién puede usar el comando y a quién
    /// puede apuntarle (incluyendo a un moderador, si AllowTargetModerators está
    /// activo) — no hay un requisito de rol de Twitch aparte para ese caso.
    /// </summary>
    public class RuletaCommand : ICommand
    {
        private readonly ILogger<RuletaCommand> _logger;
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private static readonly Random _rng = Random.Shared;

        // Cooldown tracking: key = "channel:global" o "channel:username" — mismo patrón que WatchtimeCommand
        private static readonly ConcurrentDictionary<string, DateTime> _cooldowns = new();

        public string Name => "!ruleta";
        public string Description => "Ruleta rusa: probabilidad de darte (o darle a otro) timeout";

        public RuletaCommand(ILogger<RuletaCommand> logger, IServiceScopeFactory serviceScopeFactory)
        {
            _logger = logger;
            _serviceScopeFactory = serviceScopeFactory;
        }

        public async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var twitchApiService = scope.ServiceProvider.GetRequiredService<TwitchApiService>();

                var channelInfo = await ChannelResolver.ResolveChannelInfoAsync(db, context.Channel);
                if (channelInfo == null)
                {
                    _logger.LogWarning($"[Ruleta] Canal {context.Channel} no resuelto");
                    return;
                }

                var config = await db.RuletaCommandConfigs
                    .FirstOrDefaultAsync(c => c.UserId == channelInfo.UserId)
                    ?? new RuletaCommandConfig();

                if (!config.Enabled)
                {
                    _logger.LogDebug($"[Ruleta] {context.Channel}: comando deshabilitado");
                    return;
                }

                var userLevel = GetUserLevel(context);
                if (!HasPermission(userLevel, config.Permission))
                {
                    _logger.LogDebug($"[Ruleta] {context.Channel}: {context.Username} sin permiso ({userLevel} < {config.Permission})");
                    return;
                }

                if (IsInList(config.BlockedUsers, context.Username))
                {
                    _logger.LogDebug($"[Ruleta] {context.Channel}: {context.Username} está bloqueado para usar el comando");
                    return;
                }

                // Cooldowns
                var now = DateTime.UtcNow;
                var channelKey = context.Channel.ToLower();
                if (config.CooldownGlobal > 0)
                {
                    var globalKey = $"{channelKey}:ruleta:global";
                    if (_cooldowns.TryGetValue(globalKey, out var lastGlobal) && (now - lastGlobal).TotalSeconds < config.CooldownGlobal)
                    {
                        return;
                    }
                }
                if (config.CooldownUser > 0)
                {
                    var userKey = $"{channelKey}:ruleta:{context.Username.ToLower()}";
                    if (_cooldowns.TryGetValue(userKey, out var lastUser) && (now - lastUser).TotalSeconds < config.CooldownUser)
                    {
                        return;
                    }
                }

                // Parsear objetivo: "!ruleta" (a uno mismo) o "!ruleta usuario"
                var messageWithoutPrefix = context.Message.StartsWith("!") ? context.Message.Substring(1) : context.Message;
                var args = messageWithoutPrefix.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                var explicitTarget = args.Length > 1 ? args[1].TrimStart('@').ToLower() : null;
                var target = explicitTarget ?? context.Username.ToLower();
                var isSelf = target == context.Username.ToLower();

                if (isSelf && !config.AllowSelfTarget)
                {
                    await messageSender.SendMessageAsync(context.Channel, $"🔫 @{context.Username}, apuntarte a ti mismo está desactivado en este canal — usa {config.CommandName} @usuario");
                    return;
                }

                // Inmunidad global a nivel plataforma, en cualquier canal — no es configurable
                // por streamer. Por ahora solo protege la cuenta del creador (control_total del
                // sistema); a futuro se puede armar una vista propia para gestionar más cuentas.
                if (!isSelf && target == "anthonydeca")
                {
                    await messageSender.SendMessageAsync(context.Channel, $"🔫 @{context.Username}, esa bala rebota — @anthonydeca es intocable");
                    return;
                }

                if (target == context.Channel.ToLower())
                {
                    await messageSender.SendMessageAsync(context.Channel, $"🔫 @{context.Username}, el streamer es inmune a {config.CommandName}");
                    return;
                }

                if (!isSelf && IsInList(config.ProtectedUsers, target))
                {
                    await messageSender.SendMessageAsync(context.Channel, $"🔫 @{context.Username}, @{target} está protegido y no puede ser el objetivo de {config.CommandName}");
                    return;
                }

                // Marcar cooldowns recién acá — de este punto en adelante el comando se ejecuta de verdad
                if (config.CooldownGlobal > 0) _cooldowns[$"{channelKey}:ruleta:global"] = now;
                if (config.CooldownUser > 0) _cooldowns[$"{channelKey}:ruleta:{context.Username.ToLower()}"] = now;

                var hit = _rng.Next(1, 101) <= config.ChancePercent;
                if (!hit)
                {
                    var missTemplate = PickRandom((isSelf && config.UseSelfMessages) ? config.SelfMissMessages : config.MissMessages);
                    await messageSender.SendMessageAsync(context.Channel, ApplyVariables(missTemplate, context.Username, target, 0, config.ChancePercent));
                    return;
                }

                var seconds = config.MinTimeoutSeconds >= config.MaxTimeoutSeconds
                    ? config.MinTimeoutSeconds
                    : _rng.Next(config.MinTimeoutSeconds, config.MaxTimeoutSeconds + 1);

                var applied = await twitchApiService.TimeoutUserAsync(context.Channel, target, seconds, "!ruleta");

                if (!applied)
                {
                    // El timeout falló — la causa más probable es que el objetivo ya es moderador
                    // (Twitch rechaza el timeout directo a un mod). El único requisito para
                    // intentar "quitar mod → timeout → restaurar" es que el canal lo tenga
                    // habilitado (AllowTargetModerators) — el nivel de Permisos ya filtró quién
                    // llegó hasta acá, no hay un requisito extra de rol para este caso puntual.
                    if (!isSelf && config.AllowTargetModerators)
                    {
                        var removed = await twitchApiService.RemoveModeratorAsync(context.Channel, target);
                        if (removed)
                        {
                            applied = await twitchApiService.TimeoutUserAsync(context.Channel, target, seconds, "!ruleta");
                            if (applied)
                            {
                                db.RuletaModRestores.Add(new RuletaModRestore
                                {
                                    ChannelLogin = context.Channel.ToLower(),
                                    TargetUsername = target,
                                    ExpiresAt = now.AddSeconds(seconds),
                                });
                                await db.SaveChangesAsync();

                                var modHitMsg = ApplyVariables(PickRandom(config.HitMessages), context.Username, target, seconds, config.ChancePercent)
                                    + " (mod suspendido temporalmente, se le restaura solo)";
                                await messageSender.SendMessageAsync(context.Channel, modHitMsg);
                            }
                            else
                            {
                                // Falló el timeout aun sin el mod — devolverle el mod para no dejarlo colgado
                                await twitchApiService.AddModeratorAsync(context.Channel, target);
                                await messageSender.SendMessageAsync(context.Channel, $"🔫 No se pudo aplicar el timeout a @{target}");
                            }
                        }
                        else
                        {
                            await messageSender.SendMessageAsync(context.Channel, $"🔫 No se pudo apuntarle a @{target} — ¿el bot tiene permisos de moderador en el canal?");
                        }
                        return;
                    }

                    if (!isSelf)
                    {
                        await messageSender.SendMessageAsync(context.Channel,
                            $"🔫 No se pudo apuntarle a @{target} — si es moderador, este canal no permite apuntarle a moderadores con {config.CommandName}");
                    }
                    else
                    {
                        await messageSender.SendMessageAsync(context.Channel, $"🔫 No se pudo aplicar el timeout a @{target}");
                    }
                    return;
                }

                var hitTemplate = PickRandom((isSelf && config.UseSelfMessages) ? config.SelfHitMessages : config.HitMessages);
                await messageSender.SendMessageAsync(context.Channel, ApplyVariables(hitTemplate, context.Username, target, seconds, config.ChancePercent));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[Ruleta] Error ejecutando comando para {context.Username} en {context.Channel}");
            }
        }

        // ── Helpers ───────────────────────────────────────────────────────────────

        private static bool IsInList(string usersJson, string username)
        {
            try
            {
                var list = JsonSerializer.Deserialize<List<string>>(usersJson);
                return list != null && list.Any(u => string.Equals(u.TrimStart('@'), username, StringComparison.OrdinalIgnoreCase));
            }
            catch
            {
                return false;
            }
        }

        private static string PickRandom(string messagesJson)
        {
            List<string>? messages = null;
            try
            {
                messages = JsonSerializer.Deserialize<List<string>>(messagesJson);
            }
            catch { /* fallback abajo */ }

            if (messages == null || messages.Count == 0)
                return "🔫 @{shooter} → @{target}";

            return messages[_rng.Next(messages.Count)];
        }

        private static string ApplyVariables(string template, string shooter, string target, int seconds, int chance)
        {
            return template
                .Replace("{shooter}", shooter)
                .Replace("{target}", target)
                .Replace("{seconds}", seconds.ToString())
                .Replace("{chance}", chance.ToString());
        }

        private static string GetUserLevel(CommandContext context)
        {
            if (context.IsBroadcaster) return "broadcaster";
            if (context.IsLeadModerator) return "lead_moderator";
            if (context.IsModerator) return "moderator";
            if (context.IsVip) return "vip";
            if (context.IsSubscriber) return "subscriber";
            return "everyone";
        }

        private static bool HasPermission(string userLevel, string requiredPermission)
        {
            var levels = new[] { "everyone", "subscriber", "vip", "moderator", "lead_moderator", "broadcaster" };
            var userIdx = Array.IndexOf(levels, userLevel);
            var reqIdx = Array.IndexOf(levels, requiredPermission);
            if (userIdx < 0 || reqIdx < 0) return true;
            return userIdx >= reqIdx;
        }
    }
}
