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
                var lang = await GetChannelLanguageAsync(channel);

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

                switch (subcommand)
                {
                    case "pull":
                    case "tirar":
                    case "p":
                        await HandlePull(username, channel, args, context, lang, messageSender);
                        break;

                    case "pulls":
                    case "tiros":
                    case "ps":
                        await HandlePulls(username, channel, args, lang, messageSender);
                        break;

                    case "col":
                    case "collection":
                    case "coleccion":
                    case "c":
                        await HandleCollection(username, channel, args, lang, messageSender);
                        break;

                    case "pause":
                    case "pausa":
                        await HandlePause(username, channel, lang, messageSender);
                        break;

                    case "resume":
                    case "reanudar":
                        await HandleResume(username, channel, lang, messageSender);
                        break;

                    case "buy":
                    case "comprar":
                        await HandleBuyWithCoins(username, channel, args, context, lang, messageSender);
                        break;

                    case "price":
                    case "precio":
                        await HandlePrice(username, channel, lang, messageSender);
                        break;

                    case "donate":
                    case "donar":
                    case "add":
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
            var msg = lang switch
            {
                "en" => "Gacha: !gacha pull [n] — Pull | pulls — Available | col — Collection | buy [n] — Buy pulls with coins | price — Coin price | donate <user> <$> — Add donation (mod) | Shortcuts: !gc...",
                "pt" => "Gacha: !gacha pull [n] — Puxar | pulls — Disponiveis | col — Colecao | buy [n] — Comprar com coins | price — Preco | donate <user> <$> — Doacao (mod) | Atalhos: !gc...",
                _ => "Gacha: !gacha pull [n] — Tirar | pulls — Disponibles | col — Coleccion | buy [n] — Comprar con coins | price — Precio | donar <user> <$> — Donacion (mod) | Atajos: !gc..."
            };
            await messageSender.SendMessageAsync(channel, msg);
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

            // Parse quantity
            int quantity = 1;
            if (args.Length > 0 && int.TryParse(args[0], out var q))
                quantity = Math.Clamp(q, 1, 10);

            using var scope = _serviceScopeFactory.CreateScope();
            var gachaService = scope.ServiceProvider.GetRequiredService<IGachaService>();
            var channelName = channel.ToLower();

            // Find or create participant
            var participant = await gachaService.GetParticipantByNameAsync(channelName, username);
            var available = participant != null ? (int)participant.EffectiveDonation : 0;

            if (available < quantity)
            {
                var msg = lang switch
                {
                    "en" => available == 0
                        ? $"@{username}, you have no pulls available. You need a donation to start!"
                        : $"@{username}, you have {available} pull(s) available. Need {quantity}.",
                    "pt" => available == 0
                        ? $"@{username}, voce nao tem puxadas disponiveis. Precisa de uma doacao para comecar!"
                        : $"@{username}, voce tem {available} puxada(s). Precisa {quantity}.",
                    _ => available == 0
                        ? $"@{username}, no tienes tiros disponibles. Necesitas una donacion para empezar!"
                        : $"@{username}, tienes {available} tiro(s) disponible(s). Necesitas {quantity}."
                };
                await messageSender.SendMessageAsync(channel, msg);
                return;
            }

            // Single pull
            if (quantity == 1)
            {
                await ExecuteSinglePull(gachaService, channelName, participant, username, channel, lang, messageSender);
                return;
            }

            // Multi-pull: start state
            var stateKey = $"{channelName}:{username}";
            _autoPullStates.TryRemove(stateKey, out _); // Clean old state

            var state = new MultiPullState
            {
                ParticipantId = participant.Id,
                Remaining = quantity - 1,
                Total = quantity,
                IsPaused = false,
                Results = new List<string>()
            };

            // Do first pull immediately
            var result = await ExecuteSinglePull(gachaService, channelName, participant, username, channel, lang, messageSender);
            if (result != null)
                state.Results.Add(result);

            if (state.Remaining > 0)
            {
                _autoPullStates[stateKey] = state;
                var startMsg = lang switch
                {
                    "en" => $"@{username} Starting {quantity} pulls! Use !gacha pause to pause.",
                    "pt" => $"@{username} Iniciando {quantity} puxadas! Use !gacha pause para pausar.",
                    _ => $"@{username} Iniciando {quantity} tiradas! Usa !gacha pause para pausar."
                };
                await messageSender.SendMessageAsync(channel, startMsg);

                // Schedule continuation
                _ = Task.Run(async () => await ContinueAutoPulls(stateKey, channelName, username, channel, lang, messageSender));
            }
        }

        private async Task<string?> ExecuteSinglePull(IGachaService gachaService, string channelName, GachaParticipant participant, string username, string channel, string lang, IMessageSender messageSender)
        {
            try
            {
                var result = await gachaService.PerformPullAsync(channelName, participant.Id);
                var rc = result.Item.Rarity;
                var stars = rc switch
                {
                    "legendary" => "★★★★★",
                    "epic" => "★★★★",
                    "rare" => "★★★",
                    "uncommon" => "★★",
                    _ => "★"
                };

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

                await Task.Delay(10000); // 10 second delay between pulls

                if (state.IsPaused) continue;

                try
                {
                    using var scope = _serviceScopeFactory.CreateScope();
                    var gachaService = scope.ServiceProvider.GetRequiredService<IGachaService>();
                    var participant = await gachaService.GetParticipantByNameAsync(channelName, username);

                    if (participant == null || participant.EffectiveDonation < 1)
                    {
                        var msg = lang switch
                        {
                            "en" => $"@{username}, no more pulls available. Stopping.",
                            "pt" => $"@{username}, sem mais puxadas. Parando.",
                            _ => $"@{username}, no quedan mas tiros. Deteniendo."
                        };
                        await messageSender.SendMessageAsync(channel, msg);
                        break;
                    }

                    var result = await ExecuteSinglePull(gachaService, channelName, participant, username, channel, lang, messageSender);
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
            var available = participant != null ? (int)participant.EffectiveDonation : 0;
            var total = participant?.DonationAmount ?? 0;
            var used = participant?.Pulls ?? 0;

            var msg = lang switch
            {
                "en" => $"@{targetUser} — Available: {available} pulls | Total donated: ${total:F2} | Used: {used}",
                "pt" => $"@{targetUser} — Disponiveis: {available} puxadas | Total doado: ${total:F2} | Usadas: {used}",
                _ => $"@{targetUser} — Disponibles: {available} tiros | Total donado: ${total:F2} | Usados: {used}"
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
            if (_autoPullStates.TryGetValue(stateKey, out var state) && !state.IsPaused)
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

        private async Task HandleResume(string username, string channel, string lang, IMessageSender messageSender)
        {
            var stateKey = $"{channel.ToLower()}:{username.ToLower()}";
            if (_autoPullStates.TryGetValue(stateKey, out var state) && state.IsPaused)
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

                if (config == null || !config.CoinsEnabled)
                {
                    var msg = lang switch
                    {
                        "en" => $"@{username}, coin purchases are not enabled in this channel.",
                        "pt" => $"@{username}, compras com coins nao estao habilitadas neste canal.",
                        _ => $"@{username}, las compras con coins no estan habilitadas en este canal."
                    };
                    await messageSender.SendMessageAsync(channel, msg);
                    return;
                }

                var limitText = config.CoinsDailyLimit > 0
                    ? config.CoinsDailyLimit.ToString()
                    : lang switch
                    {
                        "en" => "unlimited",
                        "pt" => "ilimitado",
                        _ => "sin limite"
                    };

                var msg2 = lang switch
                {
                    "en" => $"@{username} In this channel: {config.CoinsPerPull} coins per pull | Daily limit: {limitText}",
                    "pt" => $"@{username} Neste canal: {config.CoinsPerPull} coins por puxada | Limite diario: {limitText}",
                    _ => $"@{username} En este canal: {config.CoinsPerPull} coins por tiro | Limite diario: {limitText}"
                };
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

        private async Task<string> GetChannelLanguageAsync(string channel)
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var lang = await db.Users
                    .Where(u => u.Login == channel.ToLower())
                    .Select(u => u.PreferredLanguage)
                    .FirstOrDefaultAsync();
                return lang ?? "es";
            }
            catch { return "es"; }
        }

        private class MultiPullState
        {
            public int ParticipantId { get; set; }
            public int Remaining { get; set; }
            public int Total { get; set; }
            public bool IsPaused { get; set; }
            public List<string> Results { get; set; } = new();
        }
    }
}
