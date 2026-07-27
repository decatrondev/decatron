using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Core.Models.Gacha;
using Decatron.Data;
using Decatron.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;

namespace Decatron.Default.Commands
{
    /// <summary>
    /// !gacha / !gc — Sistema Gacha de cartas coleccionables
    /// Subcomandos:
    ///   !gacha              — Mostrar ayuda
    ///   !gacha pull [n]     — Tirar 1 o N veces (alias: !gcpull)
    ///   !gacha pulls [user] — Ver tiros disponibles (alias: !gcpulls)
    ///   !gacha col [user]   — Ver coleccion (alias: !gccol)
    ///   !gacha pause        — Pausar multi-pull (alias: !gcpause)
    ///   !gacha resume       — Reanudar multi-pull (alias: !gcresume)
    /// </summary>
    public class GachaCommand : ICommand
    {
        private readonly ILogger<GachaCommand> _logger;
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly ICommandMessagesService _messagesService;

        // State for multi-pulls (in-memory, per participant)
        private static readonly ConcurrentDictionary<string, MultiPullState> _autoPullStates = new();
        // Anti-duplicate: prevent same user pulling twice within 3 seconds
        private static readonly ConcurrentDictionary<string, DateTime> _recentPulls = new();
        // Cooldown tracking: key = "channel:command" (global) or "channel:command:user" (per-user)
        private static readonly ConcurrentDictionary<string, DateTime> _cooldowns = new();

        public string Name => "!gacha";
        public string Description => "Sistema Gacha (!gacha pull, !gacha pulls, !gacha col, !gacha pause, !gacha resume)";

        public GachaCommand(ILogger<GachaCommand> logger, IServiceScopeFactory serviceScopeFactory, ICommandMessagesService messagesService)
        {
            _logger = logger;
            _serviceScopeFactory = serviceScopeFactory;
            _messagesService = messagesService;
        }

        public async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            try
            {
                var username = context.Username;
                var channel = context.Channel;
                var message = context.Message;
                var lang = await GetChannelLanguageAsync(channel, context);

                // Parse: "!gacha pull 5" or "!gcpull 5"
                var raw = message.TrimStart('!');
                string subcommand;
                string[] args;

                if (raw.StartsWith("gc", StringComparison.OrdinalIgnoreCase) && !raw.StartsWith("gacha", StringComparison.OrdinalIgnoreCase))
                {
                    // Short form: !gcpull, !gcpulls, !gccol, !gcpause, !gcresume
                    var shortCmd = raw.Substring(2).Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    subcommand = shortCmd.Length > 0 ? shortCmd[0].ToLower() : "";
                    args = shortCmd.Length > 1 ? shortCmd[1..] : Array.Empty<string>();
                }
                else
                {
                    // Long form: !gacha pull 5
                    var parts = raw.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    subcommand = parts.Length > 1 ? parts[1].ToLower() : "";
                    args = parts.Length > 2 ? parts[2..] : Array.Empty<string>();
                }

                // Map built-in aliases to canonical command names
                var canonicalCommand = subcommand switch
                {
                    "pull" or "tirar" or "p" => "pull",
                    "pulls" or "tiros" or "ps" => "pulls",
                    "col" or "collection" or "coleccion" or "c" => "col",
                    "pause" or "pausa" => "pause",
                    "resume" or "reanudar" => "resume",
                    "buy" or "comprar" => "buy",
                    "price" or "precio" => "price",
                    "donate" or "donar" or "add" => "donate",
                    _ => subcommand
                };

                // Resolve custom aliases if not a built-in command
                if (string.IsNullOrEmpty(canonicalCommand) || !new[] { "pull", "pulls", "col", "pause", "resume", "buy", "price", "donate" }.Contains(canonicalCommand))
                {
                    if (!string.IsNullOrEmpty(subcommand))
                    {
                        using var aliasScope = _serviceScopeFactory.CreateScope();
                        var aliasCtx = aliasScope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                        var alias = await aliasCtx.GachaCommandAliases
                            .FirstOrDefaultAsync(a => a.ChannelName == channel.ToLower() && a.Alias == subcommand);
                        if (alias != null)
                        {
                            canonicalCommand = alias.TargetCommand;
                        }
                    }
                }

                // Check command config (enabled, permissions, cooldowns)
                if (!string.IsNullOrEmpty(canonicalCommand) && canonicalCommand != "help")
                {
                    using var cfgScope = _serviceScopeFactory.CreateScope();
                    var cfgCtx = cfgScope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                    var cmdConfig = await cfgCtx.GachaCommandConfigs
                        .FirstOrDefaultAsync(c => c.ChannelName == channel.ToLower() && c.Command == canonicalCommand);

                    if (cmdConfig != null)
                    {
                        // Check enabled
                        if (!cmdConfig.Enabled) return;

                        // Check permission
                        var userLevel = GetUserLevel(context);
                        if (!HasPermission(userLevel, cmdConfig.Permission)) return;

                        // Check cooldowns
                        var now = DateTime.UtcNow;
                        if (cmdConfig.CooldownGlobal > 0)
                        {
                            var globalKey = $"{channel.ToLower()}:{canonicalCommand}:global";
                            if (_cooldowns.TryGetValue(globalKey, out var lastGlobal) && (now - lastGlobal).TotalSeconds < cmdConfig.CooldownGlobal)
                                return;
                            _cooldowns[globalKey] = now;
                        }
                        if (cmdConfig.CooldownUser > 0)
                        {
                            var userKey = $"{channel.ToLower()}:{canonicalCommand}:{username.ToLower()}";
                            if (_cooldowns.TryGetValue(userKey, out var lastUser) && (now - lastUser).TotalSeconds < cmdConfig.CooldownUser)
                                return;
                            _cooldowns[userKey] = now;
                        }
                    }
                }

                switch (canonicalCommand)
                {
                    case "pull":
                        await HandlePull(username, channel, args, context, lang, messageSender);
                        break;

                    case "pulls":
                        await HandlePulls(username, channel, args, lang, messageSender);
                        break;

                    case "col":
                        await HandleCollection(username, channel, args, lang, messageSender);
                        break;

                    case "pause":
                        await HandlePause(username, channel, lang, messageSender);
                        break;

                    case "resume":
                        await HandleResume(username, channel, lang, messageSender);
                        break;

                    case "buy":
                        await HandleBuyWithCoins(username, channel, args, context, lang, messageSender);
                        break;

                    case "price":
                        await HandlePrice(username, channel, lang, messageSender);
                        break;

                    case "donate":
                        await HandleDonate(username, channel, args, context, lang, messageSender);
                        break;

                    default:
                        await ShowHelp(channel, lang, messageSender);
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[GACHA] Error en comando gacha en {Channel}", context.Channel);
            }
        }

        // ========================================================================
        // HELP
        // ========================================================================

        private async Task ShowHelp(string channel, string lang, IMessageSender messageSender)
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var gachaService = scope.ServiceProvider.GetRequiredService<IGachaService>();
                var channelName = channel.ToLower();

                // Load enabled commands and aliases
                var configs = await gachaService.GetCommandConfigsAsync(channelName);
                var aliases = await gachaService.GetCommandAliasesAsync(channelName);

                var cmdLabels = new Dictionary<string, (string es, string en, string pt)>
                {
                    ["pull"] = ("!gcpull [n] — Tirar", "!gcpull [n] — Pull", "!gcpull [n] — Puxar"),
                    ["pulls"] = ("!gcpulls — Disponibles", "!gcpulls — Available", "!gcpulls — Disponiveis"),
                    ["col"] = ("!gccol — Coleccion", "!gccol — Collection", "!gccol — Colecao"),
                    ["buy"] = ("!gcbuy [n] — Comprar con coins", "!gcbuy [n] — Buy with coins", "!gcbuy [n] — Comprar com coins"),
                    ["price"] = ("!gcprice — Precio", "!gcprice — Price", "!gcprice — Preco"),
                    ["donate"] = ("!gacha donate <user> <$> — Donacion (mod)", "!gacha donate <user> <$> — Donation (mod)", "!gacha donate <user> <$> — Doacao (mod)"),
                    ["pause"] = ("!gcpause — Pausar", "!gcpause — Pause", "!gcpause — Pausar"),
                    ["resume"] = ("!gcresume — Reanudar", "!gcresume — Resume", "!gcresume — Retomar"),
                };

                var enabledParts = new List<string>();
                foreach (var cmd in configs.Where(c => c.Enabled))
                {
                    if (cmdLabels.TryGetValue(cmd.Command, out var labels))
                    {
                        enabledParts.Add(lang switch { "en" => labels.en, "pt" => labels.pt, _ => labels.es });
                    }
                }

                var aliasParts = aliases.Select(a => $"!{a.Alias}→{a.TargetCommand}").ToList();
                var aliasText = aliasParts.Count > 0
                    ? (lang switch { "en" => " | Aliases: ", "pt" => " | Atalhos: ", _ => " | Atajos: " }) + string.Join(", ", aliasParts)
                    : "";

                var msg = $"Gacha: {string.Join(" | ", enabledParts)}{aliasText}";
                await messageSender.SendMessageAsync(channel, msg);
            }
            catch
            {
                // Fallback to hardcoded
                var msg = lang switch
                {
                    "en" => "Gacha: !gcpull [n] — Pull | !gcpulls — Available | !gccol — Collection | !gcbuy — Buy | !gcprice — Price",
                    "pt" => "Gacha: !gcpull [n] — Puxar | !gcpulls — Disponiveis | !gccol — Colecao | !gcbuy — Comprar | !gcprice — Preco",
                    _ => "Gacha: !gcpull [n] — Tirar | !gcpulls — Disponibles | !gccol — Coleccion | !gcbuy — Comprar | !gcprice — Precio"
                };
                await messageSender.SendMessageAsync(channel, msg);
            }
        }

        // ========================================================================
        // PULL
        // ========================================================================

        private async Task HandlePull(string username, string channel, string[] args, CommandContext context, string lang, IMessageSender messageSender)
        {
            // Anti-duplicate (3 seconds)
            var dupeKey = $"{channel}:{username}";
            if (_recentPulls.TryGetValue(dupeKey, out var lastPull) && (DateTime.UtcNow - lastPull).TotalSeconds < 3)
                return;
            _recentPulls[dupeKey] = DateTime.UtcNow;

            using var scope = _serviceScopeFactory.CreateScope();
            var gachaService = scope.ServiceProvider.GetRequiredService<IGachaService>();
            var channelName = channel.ToLower();

            // Load multi-pull config
            var integrationConfig = await gachaService.GetIntegrationConfigAsync(channelName);
            var maxPulls = integrationConfig?.MultiPullMax ?? 10;
            var multiPullEnabled = integrationConfig?.MultiPullEnabled ?? true;

            // Parse quantity and optional pull type: !gcpull [coins|donation] [n] or !gcpull [n] [coins|donation]
            int quantity = 1;
            string? requestedType = null;
            foreach (var arg in args)
            {
                if (arg == "coins" || arg == "donation")
                    requestedType = arg;
                else if (int.TryParse(arg, out var q))
                    quantity = Math.Clamp(q, 1, maxPulls);
            }

            // Block multi-pull if disabled
            if (quantity > 1 && !multiPullEnabled)
                quantity = 1;

            // Find or create participant
            var participant = await gachaService.GetParticipantByNameAsync(channelName, username);
            var donationAvailable = participant != null ? (int)participant.EffectiveDonation : 0;
            var coinAvailable = participant != null ? participant.CoinPullsAvailable : 0;

            // Determine pull type: explicit > auto-detect (prioritize donation)
            string pullType;
            int available;
            if (requestedType != null)
            {
                pullType = requestedType;
                available = pullType == "coins" ? coinAvailable : donationAvailable;
            }
            else if (donationAvailable >= quantity)
            {
                pullType = "donation";
                available = donationAvailable;
            }
            else if (coinAvailable >= quantity)
            {
                pullType = "coins";
                available = coinAvailable;
            }
            else
            {
                available = donationAvailable + coinAvailable;
                pullType = "donation"; // fallback
            }

            if (available < quantity)
            {
                var totalAvailable = donationAvailable + coinAvailable;
                var msg = lang switch
                {
                    "en" => totalAvailable == 0
                        ? $"@{username}, you have no pulls available. Donate or buy with coins!"
                        : $"@{username}, you have {donationAvailable} donation + {coinAvailable} coin pull(s). Need {quantity}.",
                    "pt" => totalAvailable == 0
                        ? $"@{username}, voce nao tem puxadas. Doe ou compre com coins!"
                        : $"@{username}, voce tem {donationAvailable} doacao + {coinAvailable} coin puxada(s). Precisa {quantity}.",
                    _ => totalAvailable == 0
                        ? $"@{username}, no tienes tiros disponibles. Dona o compra con coins!"
                        : $"@{username}, tienes {donationAvailable} donacion + {coinAvailable} coin tiro(s). Necesitas {quantity}."
                };
                await messageSender.SendMessageAsync(channel, msg);
                return;
            }

            // Single pull
            if (quantity == 1)
            {
                await ExecuteSinglePull(gachaService, channelName, participant, username, channel, lang, messageSender, pullType);
                return;
            }

            // Multi-pull: start state
            var stateKey = $"{channelName}:{username.ToLower()}";
            _autoPullStates.TryRemove(stateKey, out _); // Clean old state

            var state = new MultiPullState
            {
                ParticipantId = participant.Id,
                Remaining = quantity - 1,
                Total = quantity,
                IsPaused = false,
                PullType = pullType,
                Results = new List<string>()
            };

            // Do first pull immediately
            var result = await ExecuteSinglePull(gachaService, channelName, participant, username, channel, lang, messageSender, pullType);
            if (result != null)
                state.Results.Add(result);

            if (state.Remaining > 0)
            {
                _autoPullStates[stateKey] = state;
                var startMsg = lang switch
                {
                    "en" => $"@{username} Starting {quantity} pulls ({pullType})! Use !gacha pause to pause.",
                    "pt" => $"@{username} Iniciando {quantity} puxadas ({pullType})! Use !gacha pause para pausar.",
                    _ => $"@{username} Iniciando {quantity} tiradas ({pullType})! Usa !gacha pause para pausar."
                };
                await messageSender.SendMessageAsync(channel, startMsg);

                // Schedule continuation
                _ = Task.Run(async () => await ContinueAutoPulls(stateKey, channelName, username, channel, lang, messageSender));
            }
        }

        private async Task<string?> ExecuteSinglePull(IGachaService gachaService, string channelName, GachaParticipant participant, string username, string channel, string lang, IMessageSender messageSender, string pullType = "donation")
        {
            try
            {
                var result = await gachaService.PerformPullAsync(channelName, participant.Id, pullType);
                var rc = result.Item.Rarity;
                var stars = rc switch
                {
                    "legendary" => "★★★★★",
                    "epic" => "★★★★",
                    "rare" => "★★★",
                    "uncommon" => "★★",
                    _ => "★"
                };

                // Wait for overlay animation before sending chat message
                // Flash(1.5s) + reveal(0.5s) + display start = ~3s for the card to show
                var overlayDelay = rc switch
                {
                    "legendary" => 4000, // Extra flash time for legendary
                    "epic" => 3500,
                    _ => 3000
                };
                await Task.Delay(overlayDelay);

                var msg = lang switch
                {
                    "en" => $"@{username} pulled {stars} {result.Item.Name} ({rc})! Pulls left: {result.PullsRemaining}",
                    "pt" => $"@{username} puxou {stars} {result.Item.Name} ({rc})! Puxadas restantes: {result.PullsRemaining}",
                    _ => $"@{username} obtuvo {stars} {result.Item.Name} ({rc})! Tiros restantes: {result.PullsRemaining}"
                };
                await messageSender.SendMessageAsync(channel, msg);

                // TODO: Emit SignalR event for overlay animation
                return $"{stars} {result.Item.Name}";
            }
            catch (InvalidOperationException ex)
            {
                await messageSender.SendMessageAsync(channel, $"@{username}, {ex.Message}");
                return null;
            }
        }

        private async Task ContinueAutoPulls(string stateKey, string channelName, string username, string channel, string lang, IMessageSender messageSender)
        {
            while (_autoPullStates.TryGetValue(stateKey, out var state) && state.Remaining > 0)
            {
                if (state.IsPaused)
                {
                    await Task.Delay(1000);
                    continue;
                }

                // Configurable delay between pulls
                try
                {
                    using var cfgScope = _serviceScopeFactory.CreateScope();
                    var cfgService = cfgScope.ServiceProvider.GetRequiredService<IGachaService>();
                    var cfg = await cfgService.GetIntegrationConfigAsync(channelName);
                    var delay = (cfg?.MultiPullDelay ?? 10) * 1000;
                    await Task.Delay(delay);
                }
                catch { await Task.Delay(10000); }

                if (state.IsPaused) continue;

                try
                {
                    using var scope = _serviceScopeFactory.CreateScope();
                    var gachaService = scope.ServiceProvider.GetRequiredService<IGachaService>();
                    var participant = await gachaService.GetParticipantByNameAsync(channelName, username);

                    var currentPullType = state.PullType;
                    var pullsLeft = currentPullType == "coins"
                        ? participant?.CoinPullsAvailable ?? 0
                        : (int)(participant?.EffectiveDonation ?? 0);

                    if (participant == null || pullsLeft < 1)
                    {
                        var msg = lang switch
                        {
                            "en" => $"@{username}, no more {currentPullType} pulls available. Stopping.",
                            "pt" => $"@{username}, sem mais puxadas de {currentPullType}. Parando.",
                            _ => $"@{username}, no quedan mas tiros de {currentPullType}. Deteniendo."
                        };
                        await messageSender.SendMessageAsync(channel, msg);
                        break;
                    }

                    var result = await ExecuteSinglePull(gachaService, channelName, participant, username, channel, lang, messageSender, currentPullType);
                    if (result != null)
                        state.Results.Add(result);

                    state.Remaining--;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[GACHA] Error in auto-pull for {User}", username);
                    break;
                }
            }

            // Send summary
            if (_autoPullStates.TryRemove(stateKey, out var finalState) && finalState.Results.Count > 0)
            {
                var summary = string.Join(" | ", finalState.Results);
                if (summary.Length > 450) summary = summary[..450] + "...";

                var msg = lang switch
                {
                    "en" => $"@{username} Completed {finalState.Results.Count}/{finalState.Total} pulls: {summary}",
                    "pt" => $"@{username} Completou {finalState.Results.Count}/{finalState.Total} puxadas: {summary}",
                    _ => $"@{username} Completo {finalState.Results.Count}/{finalState.Total} tiradas: {summary}"
                };
                await messageSender.SendMessageAsync(channel, msg);
            }
        }

        // ========================================================================
        // PULLS (check available)
        // ========================================================================

        private async Task HandlePulls(string username, string channel, string[] args, string lang, IMessageSender messageSender)
        {
            var targetUser = args.Length > 0 ? args[0].TrimStart('@').ToLower() : username.ToLower();

            using var scope = _serviceScopeFactory.CreateScope();
            var gachaService = scope.ServiceProvider.GetRequiredService<IGachaService>();

            var participant = await gachaService.GetParticipantByNameAsync(channel.ToLower(), targetUser);
            var donationPulls = participant != null ? (int)participant.EffectiveDonation : 0;
            var coinPulls = participant?.CoinPullsAvailable ?? 0;
            var total = participant?.DonationAmount ?? 0;
            var used = participant?.Pulls ?? 0;
            var coinsSpent = participant?.CoinsSpentTotal ?? 0;

            var msg = lang switch
            {
                "en" => $"@{targetUser} — Donation: {donationPulls} | Coins: {coinPulls} | Donated: ${total:F2} | Coins spent: {coinsSpent} | Used: {used}",
                "pt" => $"@{targetUser} — Doacao: {donationPulls} | Coins: {coinPulls} | Doado: ${total:F2} | Coins gastos: {coinsSpent} | Usadas: {used}",
                _ => $"@{targetUser} — Donacion: {donationPulls} | Coins: {coinPulls} | Donado: ${total:F2} | Coins gastados: {coinsSpent} | Usados: {used}"
            };
            await messageSender.SendMessageAsync(channel, msg);
        }

        // ========================================================================
        // COLLECTION
        // ========================================================================

        private async Task HandleCollection(string username, string channel, string[] args, string lang, IMessageSender messageSender)
        {
            var targetUser = args.Length > 0 ? args[0].TrimStart('@').ToLower() : username.ToLower();

            using var scope = _serviceScopeFactory.CreateScope();
            var gachaService = scope.ServiceProvider.GetRequiredService<IGachaService>();

            var participant = await gachaService.GetParticipantByNameAsync(channel.ToLower(), targetUser);

            var collectionUrl = $"https://twitch.decatron.net/gacha/collection?channel={channel.ToLower()}&user={targetUser}";

            if (participant == null)
            {
                var totalItems = await scope.ServiceProvider.GetRequiredService<DecatronDbContext>()
                    .GachaItems.CountAsync(i => i.ChannelName == channel.ToLower() && i.Available);

                var msg = lang switch
                {
                    "en" => $"@{targetUser} Collection: 0/{totalItems} cards. No pulls yet! {collectionUrl}",
                    "pt" => $"@{targetUser} Colecao: 0/{totalItems} cartas. Nenhuma puxada ainda! {collectionUrl}",
                    _ => $"@{targetUser} Coleccion: 0/{totalItems} cartas. Sin tiros aun! {collectionUrl}"
                };
                await messageSender.SendMessageAsync(channel, msg);
                return;
            }

            var stats = await gachaService.GetCollectionStatsAsync(channel.ToLower(), participant.Id);
            var msg2 = lang switch
            {
                "en" => $"@{targetUser} {stats.UniqueCards}/{stats.TotalAvailable} unique | {stats.TotalCards} total | Pulls: {participant.Pulls} → {collectionUrl}",
                "pt" => $"@{targetUser} {stats.UniqueCards}/{stats.TotalAvailable} unicas | {stats.TotalCards} total | Puxadas: {participant.Pulls} → {collectionUrl}",
                _ => $"@{targetUser} {stats.UniqueCards}/{stats.TotalAvailable} unicas | {stats.TotalCards} total | Tiros: {participant.Pulls} → {collectionUrl}"
            };
            await messageSender.SendMessageAsync(channel, msg2);
        }

        // ========================================================================
        // PAUSE / RESUME
        // ========================================================================

        private async Task HandlePause(string username, string channel, string lang, IMessageSender messageSender)
        {
            var stateKey = $"{channel.ToLower()}:{username.ToLower()}";
            if (_autoPullStates.TryGetValue(stateKey, out var state))
            {
                if (!state.IsPaused)
                {
                    state.IsPaused = true;
                    var msg = lang switch
                    {
                        "en" => $"@{username}, pulls paused! ({state.Total - state.Remaining}/{state.Total}). Use !gacha resume to continue.",
                        "pt" => $"@{username}, puxadas pausadas! ({state.Total - state.Remaining}/{state.Total}). Use !gacha resume para continuar.",
                        _ => $"@{username}, tiradas pausadas! ({state.Total - state.Remaining}/{state.Total}). Usa !gacha resume para continuar."
                    };
                    await messageSender.SendMessageAsync(channel, msg);
                }
            }
            else
            {
                var msg = lang switch
                {
                    "en" => $"@{username}, you don't have an active multi-pull to pause.",
                    "pt" => $"@{username}, voce nao tem uma multi-puxada ativa para pausar.",
                    _ => $"@{username}, no tienes una multi-tirada activa para pausar."
                };
                await messageSender.SendMessageAsync(channel, msg);
            }
        }

        private async Task HandleResume(string username, string channel, string lang, IMessageSender messageSender)
        {
            var stateKey = $"{channel.ToLower()}:{username.ToLower()}";
            if (_autoPullStates.TryGetValue(stateKey, out var state))
            {
                if (state.IsPaused)
                {
                    state.IsPaused = false;
                    var msg = lang switch
                    {
                        "en" => $"@{username}, pulls resumed! {state.Remaining} remaining.",
                        "pt" => $"@{username}, puxadas retomadas! {state.Remaining} restantes.",
                        _ => $"@{username}, tiradas reanudadas! {state.Remaining} restantes."
                    };
                    await messageSender.SendMessageAsync(channel, msg);
                }
            }
            else
            {
                var msg = lang switch
                {
                    "en" => $"@{username}, you don't have a paused multi-pull to resume.",
                    "pt" => $"@{username}, voce nao tem uma multi-puxada pausada para retomar.",
                    _ => $"@{username}, no tienes una multi-tirada pausada para reanudar."
                };
                await messageSender.SendMessageAsync(channel, msg);
            }
        }

        // ========================================================================
        // DONATE (broadcaster/mod only)
        // ========================================================================

        private async Task HandleDonate(string username, string channel, string[] args, CommandContext context, string lang, IMessageSender messageSender)
        {
            // Only broadcaster or moderator
            if (!context.IsBroadcaster && !context.IsModerator)
            {
                var msg = lang switch
                {
                    "en" => $"@{username}, only the broadcaster or mods can register donations.",
                    "pt" => $"@{username}, apenas o broadcaster ou mods podem registrar doacoes.",
                    _ => $"@{username}, solo el broadcaster o mods pueden registrar donaciones."
                };
                await messageSender.SendMessageAsync(channel, msg);
                return;
            }

            // Usage: !gacha donate <user> <amount>
            if (args.Length < 2)
            {
                var msg = lang switch
                {
                    "en" => $"@{username}, usage: !gacha donate <user> <amount>",
                    "pt" => $"@{username}, uso: !gacha donate <usuario> <valor>",
                    _ => $"@{username}, uso: !gacha donar <usuario> <monto>"
                };
                await messageSender.SendMessageAsync(channel, msg);
                return;
            }

            var targetUser = args[0].TrimStart('@').ToLower();
            if (!decimal.TryParse(args[1], System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var amount) || amount <= 0)
            {
                var msg = lang switch
                {
                    "en" => $"@{username}, invalid amount. Use a number greater than 0.",
                    "pt" => $"@{username}, valor invalido. Use um numero maior que 0.",
                    _ => $"@{username}, monto invalido. Usa un numero mayor a 0."
                };
                await messageSender.SendMessageAsync(channel, msg);
                return;
            }

            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var gachaService = scope.ServiceProvider.GetRequiredService<IGachaService>();

                var participant = await gachaService.AddDonationAsync(channel.ToLower(), targetUser, amount);
                var pulls = (int)participant.EffectiveDonation;

                var msg = lang switch
                {
                    "en" => $"@{targetUser} received ${amount:F2} donation! Available pulls: {pulls}",
                    "pt" => $"@{targetUser} recebeu doacao de ${amount:F2}! Puxadas disponiveis: {pulls}",
                    _ => $"@{targetUser} recibio donacion de ${amount:F2}! Tiros disponibles: {pulls}"
                };
                await messageSender.SendMessageAsync(channel, msg);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[GACHA] Error registering donation");
                await messageSender.SendMessageAsync(channel, $"@{username}, error registering donation.");
            }
        }

        // ========================================================================
        // BUY WITH COINS
        // ========================================================================

        private async Task HandleBuyWithCoins(string username, string channel, string[] args, CommandContext context, string lang, IMessageSender messageSender)
        {
            int quantity = 1;
            if (args.Length > 0 && int.TryParse(args[0], out var q))
                quantity = Math.Clamp(q, 1, 100);

            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var gachaService = scope.ServiceProvider.GetRequiredService<IGachaService>();

                // Look up Decatron user ID from username
                var user = await db.Users.FirstOrDefaultAsync(u => u.Login == username.ToLower());
                if (user == null)
                {
                    var msg = lang switch
                    {
                        "en" => $"@{username}, you don't have a DecaCoins account yet.",
                        "pt" => $"@{username}, voce ainda nao tem uma conta de DecaCoins.",
                        _ => $"@{username}, aun no tienes cuenta de DecaCoins."
                    };
                    await messageSender.SendMessageAsync(channel, msg);
                    return;
                }

                var result = await gachaService.PurchaseWithCoinsAsync(channel.ToLower(), username, user.Id, quantity);

                var msg2 = lang switch
                {
                    "en" => $"@{username} Bought {result.PullsGranted} pull(s) for {result.CoinsSpent} coins! Balance: {result.RemainingBalance} coins",
                    "pt" => $"@{username} Comprou {result.PullsGranted} puxada(s) por {result.CoinsSpent} coins! Saldo: {result.RemainingBalance} coins",
                    _ => $"@{username} Compraste {result.PullsGranted} tiro(s) por {result.CoinsSpent} coins! Balance: {result.RemainingBalance} coins"
                };
                await messageSender.SendMessageAsync(channel, msg2);
            }
            catch (InvalidOperationException ex)
            {
                var msg = lang switch
                {
                    "en" => $"@{username}, {ex.Message}",
                    "pt" => $"@{username}, {ex.Message}",
                    _ => $"@{username}, {ex.Message}"
                };
                await messageSender.SendMessageAsync(channel, msg);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[GACHA] Error in coin purchase for {User}", username);
                var innerMsg = ex.InnerException?.Message ?? ex.Message;
                await messageSender.SendMessageAsync(channel, $"@{username}, error: {innerMsg}");
            }
        }

        // ========================================================================
        // PRICE
        // ========================================================================

        private async Task HandlePrice(string username, string channel, string lang, IMessageSender messageSender)
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var config = await db.GachaIntegrationConfigs
                    .FirstOrDefaultAsync(c => c.ChannelName == channel.ToLower());

                var parts = new List<string>();

                // Donation info
                if (config != null)
                {
                    if (config.TipsEnabled)
                    {
                        var tipText = lang switch
                        {
                            "en" => $"Tips: {config.PullsPerDollar} pull(s)/$1",
                            "pt" => $"Tips: {config.PullsPerDollar} puxada(s)/$1",
                            _ => $"Tips: {config.PullsPerDollar} tiro(s)/$1"
                        };
                        parts.Add(tipText);
                    }
                    if (config.BitsEnabled)
                        parts.Add($"Bits: {config.BitsPerPull} bits/tiro");
                    if (config.SubsEnabled)
                        parts.Add(lang switch { "en" => $"Sub: T1={config.PullsSubTier1} T2={config.PullsSubTier2} T3={config.PullsSubTier3}", _ => $"Sub: T1={config.PullsSubTier1} T2={config.PullsSubTier2} T3={config.PullsSubTier3}" });
                    if (config.GiftSubsEnabled)
                        parts.Add($"Gift: {config.PullsPerGift}/gift");

                    // Coins info
                    if (config.CoinsEnabled)
                    {
                        var limitText = config.CoinsDailyLimit > 0 ? config.CoinsDailyLimit.ToString() : (lang switch { "en" => "unlimited", "pt" => "ilimitado", _ => "sin limite" });
                        parts.Add($"Coins: {config.CoinsPerPull}/tiro (max: {limitText})");
                    }
                }

                if (parts.Count == 0)
                {
                    var noConfig = lang switch
                    {
                        "en" => $"@{username}, no purchase methods are enabled in this channel.",
                        "pt" => $"@{username}, nenhum metodo de compra esta habilitado neste canal.",
                        _ => $"@{username}, no hay metodos de compra habilitados en este canal."
                    };
                    await messageSender.SendMessageAsync(channel, noConfig);
                    return;
                }

                var msg2 = $"@{username} {string.Join(" | ", parts)}";
                await messageSender.SendMessageAsync(channel, msg2);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[GACHA] Error getting price for {Channel}", channel);
            }
        }

        // ========================================================================
        // HELPERS
        // ========================================================================

        private async Task<string> GetChannelLanguageAsync(string channel, CommandContext context)
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var lang = await db.Users
                    .Where(u => context.ChannelUserId != null ? u.Id == context.ChannelUserId : u.Login == channel.ToLower())
                    .Select(u => u.PreferredLanguage)
                    .FirstOrDefaultAsync();
                return lang ?? "es";
            }
            catch { return "es"; }
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

        private class MultiPullState
        {
            public int ParticipantId { get; set; }
            public int Remaining { get; set; }
            public int Total { get; set; }
            public bool IsPaused { get; set; }
            public string PullType { get; set; } = "donation";
            public List<string> Results { get; set; } = new();
        }
    }
}
