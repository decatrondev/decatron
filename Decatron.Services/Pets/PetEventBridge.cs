using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Core.Models.Pets;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Pets
{
    /// <summary>
    /// Único punto por el que los eventos del canal (alertas, chat, comandos) llegan a la mascota.
    /// Singleton: resuelve la config del canal (caché 20 s) y manda el estímulo por PetService.
    /// NUNCA lanza: una mascota no puede tirar una alerta, el timer ni un comando.
    /// Plan: .dev/plans/PETS_PLAN.md D1/D2/D5
    /// </summary>
    public class PetEventBridge
    {
        private static readonly TimeSpan ConfigTtl = TimeSpan.FromSeconds(20);
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        public sealed class Reaction
        {
            public bool Enabled { get; set; } = true;
            public string State { get; set; } = "react";
            public int DurationSec { get; set; } = 4;
            public int MinAmount { get; set; } = 0;
            public string? Bubble { get; set; }
        }

        public sealed class PetCommand
        {
            public string Name { get; set; } = string.Empty;
            public bool Enabled { get; set; } = true;
            public string State { get; set; } = "react";
            public int DurationSec { get; set; } = 4;
            public string? Bubble { get; set; }
            public string? Reply { get; set; }
            public int CooldownSec { get; set; } = 30;
            /// <summary>everyone | subs | vips | mods | streamer</summary>
            public string Permission { get; set; } = "everyone";
        }

        private sealed class ChannelPets
        {
            public long UserId;
            public string Login = string.Empty;
            public bool Enabled;
            public string PetName = string.Empty;
            public Dictionary<string, Reaction> Reactions = new(StringComparer.OrdinalIgnoreCase);
            public List<PetCommand> Commands = new();
            public DateTime LoadedAt;
        }

        /// <summary>Defaults por reacción cuando el streamer aún no la tocó (el panel muestra los mismos).</summary>
        public static readonly IReadOnlyDictionary<string, Reaction> DefaultReactions = new Dictionary<string, Reaction>(StringComparer.OrdinalIgnoreCase)
        {
            ["follow"]    = new() { State = "react", DurationSec = 4, Bubble = "¡Gracias por el follow, {user}!" },
            ["bits"]      = new() { State = "react", DurationSec = 5, MinAmount = 50, Bubble = "{user} tiró {amount} bits 💎" },
            ["sub"]       = new() { State = "react", DurationSec = 6, Bubble = "¡{user} se suscribió! 🎉" },
            ["resub"]     = new() { State = "react", DurationSec = 6, Bubble = "¡{user} lleva {months} meses! 💜" },
            ["giftSub"]   = new() { State = "react", DurationSec = 6, Bubble = "{user} regaló {amount} subs 🎁" },
            ["raid"]      = new() { State = "react", DurationSec = 8, Bubble = "¡Raid de {user} con {viewers}! 🚀" },
            ["hypeTrain"] = new() { State = "react", DurationSec = 8, Bubble = "¡Hype Train nivel {level}! 🚂" },
            ["firstChat"] = new() { State = "react", DurationSec = 4, Bubble = "Hola {user} 👋" },
        };

        private readonly IServiceScopeFactory _scopes;
        private readonly IMessageSender _messageSender;
        private readonly ILogger<PetEventBridge> _logger;
        private readonly ConcurrentDictionary<string, ChannelPets> _cache = new(StringComparer.OrdinalIgnoreCase);
        private readonly ConcurrentDictionary<string, HashSet<string>> _seen = new(StringComparer.OrdinalIgnoreCase);
        private readonly ConcurrentDictionary<string, DateTime> _cooldowns = new(StringComparer.OrdinalIgnoreCase);

        public PetEventBridge(IServiceScopeFactory scopes, IMessageSender messageSender, ILogger<PetEventBridge> logger)
        {
            _scopes = scopes;
            _messageSender = messageSender;
            _logger = logger;
        }

        public void Invalidate(string login) => _cache.TryRemove(login.ToLowerInvariant(), out _);

        // ------------------------------------------------------------------
        // Alertas (mismo set que Event Alerts). Las llama EventSubNotificationHandler.
        // ------------------------------------------------------------------

        /// <param name="type">follow | bits | sub | resub | giftSub | raid | hypeTrain</param>
        public async Task OnAlertAsync(string channelLogin, string type, string userName, int amount = 0, int? months = null, int? level = null, string? tier = null)
        {
            try
            {
                var ch = await GetAsync(channelLogin);
                if (ch == null || !ch.Enabled) return;
                if (!ch.Reactions.TryGetValue(type, out var r) || !r.Enabled) return;
                if (r.MinAmount > 0 && amount < r.MinAmount) return;

                var vars = new Dictionary<string, string>
                {
                    ["user"] = userName, ["amount"] = amount.ToString(), ["viewers"] = amount.ToString(),
                    ["months"] = (months ?? 0).ToString(), ["level"] = (level ?? 0).ToString(),
                    ["tier"] = TierLabel(tier), ["pet"] = ch.PetName,
                };
                await SendAsync(ch, r.State, r.DurationSec, Render(r.Bubble, vars), type);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[PETS] OnAlert {Type} en {Channel} falló", type, channelLogin);
            }
        }

        // ------------------------------------------------------------------
        // Chat: saludo a quien escribe por primera vez. La llama TwitchBotService.
        // ------------------------------------------------------------------

        public async Task OnChatMessageAsync(string channelLogin, string userName)
        {
            try
            {
                var ch = await GetAsync(channelLogin);
                if (ch == null || !ch.Enabled) return;

                var login = userName.ToLowerInvariant();
                var seen = _seen.GetOrAdd(ch.Login, _ => new HashSet<string>(StringComparer.OrdinalIgnoreCase));
                lock (seen) { if (seen.Contains(login)) return; }

                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var exists = await db.PetSeenChatters.AnyAsync(s => s.ChannelUserId == ch.UserId && s.ChatterLogin == login);
                if (!exists)
                {
                    db.PetSeenChatters.Add(new PetSeenChatter { ChannelUserId = ch.UserId, ChatterLogin = login });
                    try { await db.SaveChangesAsync(); }
                    catch (DbUpdateException) { exists = true; } // carrera: otro hilo lo insertó
                }
                lock (seen) { seen.Add(login); }
                if (exists) return;

                if (!ch.Reactions.TryGetValue("firstChat", out var r) || !r.Enabled) return;
                await SendAsync(ch, r.State, r.DurationSec, Render(r.Bubble, new() { ["user"] = userName, ["pet"] = ch.PetName }), "firstChat");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[PETS] OnChatMessage en {Channel} falló", channelLogin);
            }
        }

        // ------------------------------------------------------------------
        // Comandos del streamer (!acariciar…). La llama CommandService. Devuelve true si el comando era de la mascota.
        // ------------------------------------------------------------------

        public async Task<bool> TryHandleCommandAsync(string channelLogin, string userName, string commandWithoutBang,
            bool isBroadcaster, bool isModerator, bool isVip, bool isSubscriber)
        {
            try
            {
                var ch = await GetAsync(channelLogin);
                if (ch == null || !ch.Enabled || ch.Commands.Count == 0) return false;
                var cmd = ch.Commands.FirstOrDefault(c => c.Enabled && c.Name.Equals(commandWithoutBang, StringComparison.OrdinalIgnoreCase));
                if (cmd == null) return false;

                if (!Allowed(cmd.Permission, isBroadcaster, isModerator, isVip, isSubscriber)) return true; // era nuestro, pero sin permiso: silencio

                var key = $"{ch.Login}:{cmd.Name.ToLowerInvariant()}";
                var now = DateTime.UtcNow;
                if (cmd.CooldownSec > 0 && _cooldowns.TryGetValue(key, out var until) && until > now && !isBroadcaster) return true;
                _cooldowns[key] = now.AddSeconds(Math.Max(0, cmd.CooldownSec));

                var vars = new Dictionary<string, string> { ["user"] = userName, ["pet"] = ch.PetName };
                await SendAsync(ch, cmd.State, cmd.DurationSec, Render(cmd.Bubble, vars), "command");
                var reply = Render(cmd.Reply, vars);
                if (!string.IsNullOrWhiteSpace(reply))
                {
                    try { await _messageSender.SendMessageAsync(ch.Login, reply); }
                    catch (Exception ex) { _logger.LogWarning(ex, "[PETS] No se pudo responder al comando {Cmd} en {Channel}", cmd.Name, ch.Login); }
                }
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[PETS] Comando {Cmd} en {Channel} falló", commandWithoutBang, channelLogin);
                return false;
            }
        }

        // ------------------------------------------------------------------

        private static bool Allowed(string permission, bool broadcaster, bool mod, bool vip, bool sub) => permission?.ToLowerInvariant() switch
        {
            "streamer" => broadcaster,
            "mods" => broadcaster || mod,
            "vips" => broadcaster || mod || vip,
            "subs" => broadcaster || mod || vip || sub,
            _ => true,
        };

        private static string TierLabel(string? tier) => tier switch { "2000" => "Tier 2", "3000" => "Tier 3", "1000" => "Tier 1", null or "" => "", _ => tier };

        private static string? Render(string? template, Dictionary<string, string> vars)
        {
            if (string.IsNullOrWhiteSpace(template)) return null;
            var s = template;
            foreach (var (k, v) in vars) s = s.Replace("{" + k + "}", v, StringComparison.OrdinalIgnoreCase);
            return s;
        }

        private async Task SendAsync(ChannelPets ch, string state, int durationSec, string? bubble, string source)
        {
            using var scope = _scopes.CreateScope();
            var pets = scope.ServiceProvider.GetRequiredService<PetService>();
            await pets.SendEventAsync(ch.Login, state, durationSec, bubble, source);
        }

        private async Task<ChannelPets?> GetAsync(string channelLogin)
        {
            var login = channelLogin.Trim().ToLowerInvariant();
            if (_cache.TryGetValue(login, out var cached) && DateTime.UtcNow - cached.LoadedAt < ConfigTtl) return cached;

            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var info = await ChannelResolver.ResolveChannelInfoAsync(db, login);
            if (info == null) return null;
            var config = await db.PetConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.UserId == info.UserId);

            var ch = new ChannelPets { UserId = info.UserId, Login = login, Enabled = config?.IsEnabled ?? false, LoadedAt = DateTime.UtcNow };
            if (config != null) Parse(ch, config.ConfigJson);
            _cache[login] = ch;
            return ch;
        }

        private void Parse(ChannelPets ch, string json)
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                if (root.TryGetProperty("pets", out var pets) && pets.ValueKind == JsonValueKind.Array && pets.GetArrayLength() > 0
                    && pets[0].TryGetProperty("name", out var name) && name.ValueKind == JsonValueKind.String)
                    ch.PetName = name.GetString() ?? string.Empty;

                foreach (var (key, def) in DefaultReactions)
                    ch.Reactions[key] = new Reaction { Enabled = def.Enabled, State = def.State, DurationSec = def.DurationSec, MinAmount = def.MinAmount, Bubble = def.Bubble };
                if (root.TryGetProperty("reactions", out var reactions) && reactions.ValueKind == JsonValueKind.Object)
                {
                    foreach (var prop in reactions.EnumerateObject())
                    {
                        var r = JsonSerializer.Deserialize<Reaction>(prop.Value.GetRawText(), Json);
                        if (r != null) ch.Reactions[prop.Name] = r;
                    }
                }

                if (root.TryGetProperty("commands", out var commands) && commands.ValueKind == JsonValueKind.Array)
                {
                    ch.Commands = (JsonSerializer.Deserialize<List<PetCommand>>(commands.GetRawText(), Json) ?? new())
                        .Where(c => !string.IsNullOrWhiteSpace(c.Name))
                        .Select(c => { c.Name = c.Name.TrimStart('!').Trim(); return c; })
                        .ToList();
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[PETS] config_json inválido para {Login}", ch.Login);
            }
        }
    }
}
