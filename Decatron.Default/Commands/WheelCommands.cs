using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Core.Models.WheelOfLuck;
using Decatron.Data;
using Decatron.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Default.Commands
{
    /// <summary>
    /// Base de los comandos de la Rueda de la Suerte.
    ///
    /// <para>El nombre del comando es configurable por rueda, pero el bot registra los
    /// comandos una sola vez al arrancar y no puede tener uno por canal. Así que estos
    /// dos escuchan sus nombres por defecto (<c>!dgirar</c> y <c>!dcreditos</c>) y, ya
    /// dentro, buscan la rueda del canal que responda a ese nombre. Un canal que
    /// renombró su comando simplemente no matchea, que es el comportamiento correcto.</para>
    /// </summary>
    public abstract class WheelCommandBase : ICommand
    {
        protected readonly ILogger _logger;
        protected readonly IServiceScopeFactory _scopes;

        public abstract string Name { get; }
        public abstract string Description { get; }

        protected WheelCommandBase(ILogger logger, IServiceScopeFactory scopes)
        {
            _logger = logger;
            _scopes = scopes;
        }

        public abstract Task ExecuteAsync(CommandContext context, IMessageSender messageSender);

        /// <summary>
        /// La rueda de modo Premios del canal que responde a este comando. Si el canal
        /// tiene varias, gana la marcada como activa; si ninguna lo está, la primera.
        /// </summary>
        /// <summary>Qué comando de la rueda se está resolviendo.</summary>
        protected enum PorComando { Girar, Saldo, Comprar }

        protected async Task<(Wheel? Wheel, long ChannelId)> ResolveWheelAsync(
            DecatronDbContext db, CommandContext context, string commandName, bool porSaldo)
            => await ResolveWheelAsync(db, context, commandName, porSaldo ? PorComando.Saldo : PorComando.Girar);

        protected async Task<(Wheel? Wheel, long ChannelId)> ResolveWheelAsync(
            DecatronDbContext db, CommandContext context, string commandName, PorComando cual)
        {
            var channelId = context.ChannelUserId
                ?? await db.Users.Where(u => u.Login == context.Channel.ToLower())
                                 .Select(u => (long?)u.Id).FirstOrDefaultAsync() ?? 0;
            if (channelId == 0) return (null, 0);

            var candidatas = await db.Wheels
                .Where(w => w.ChannelId == channelId
                         && w.IsEnabled
                         && w.CommandEnabled
                         && w.Mode == WheelModes.Prizes
                         && (cual == PorComando.Saldo ? w.BalanceCommand
                           : cual == PorComando.Comprar ? w.BuyCommand
                           : w.SpinCommand) == commandName)
                .OrderByDescending(w => w.IsActive)
                .ThenBy(w => w.Id)
                .ToListAsync();

            return (candidatas.FirstOrDefault(), channelId);
        }

        /// <summary>
        /// La rueda de modo Sorteo del canal cuyo comando de inscripción coincide.
        ///
        /// <para>No reusa <see cref="ResolveWheelAsync"/> porque el comando del sorteo
        /// vive en <c>wheel_raffle_configs</c> y no en <c>wheels</c>: son dos tablas
        /// distintas y una rueda de Premios no tiene comando de inscripción.</para>
        /// </summary>
        protected async Task<(Wheel? Wheel, WheelRaffleConfig? Config, long ChannelId)> ResolveRaffleAsync(
            DecatronDbContext db, CommandContext context, string commandName)
        {
            var channelId = context.ChannelUserId
                ?? await db.Users.Where(u => u.Login == context.Channel.ToLower())
                                 .Select(u => (long?)u.Id).FirstOrDefaultAsync() ?? 0;
            if (channelId == 0) return (null, null, 0);

            var par = await (from w in db.Wheels
                             join c in db.WheelRaffleConfigs on w.Id equals c.WheelId
                             where w.ChannelId == channelId
                                && w.IsEnabled
                                && w.Mode == WheelModes.Raffle
                                && c.EntryCommand == commandName
                             orderby w.IsActive descending, w.Id
                             select new { w, c }).FirstOrDefaultAsync();

            return par == null ? (null, null, channelId) : (par.w, par.c, channelId);
        }

        /// <summary>
        /// La rueda de Sorteo del canal para los comandos de mod, que no llevan el
        /// nombre del comando de inscripción. Gana la marcada como activa.
        /// </summary>
        protected async Task<(Wheel? Wheel, long ChannelId)> ResolveAnyRaffleAsync(
            DecatronDbContext db, CommandContext context)
        {
            var channelId = context.ChannelUserId
                ?? await db.Users.Where(u => u.Login == context.Channel.ToLower())
                                 .Select(u => (long?)u.Id).FirstOrDefaultAsync() ?? 0;
            if (channelId == 0) return (null, 0);

            var wheel = await db.Wheels
                .Where(w => w.ChannelId == channelId && w.IsEnabled && w.Mode == WheelModes.Raffle)
                .OrderByDescending(w => w.IsActive).ThenBy(w => w.Id)
                .FirstOrDefaultAsync();

            return (wheel, channelId);
        }

        protected async Task<string> LanguageAsync(DecatronDbContext db, CommandContext context)
        {
            var lang = await db.Users
                .Where(u => context.ChannelUserId != null
                    ? u.Id == context.ChannelUserId
                    : u.Login == context.Channel.ToLower())
                .Select(u => u.PreferredLanguage)
                .FirstOrDefaultAsync();
            return string.IsNullOrEmpty(lang) ? "es" : lang;
        }
    }

    /// <summary>!dgirar — gasta créditos de la Billetera de Aportes y gira la rueda.</summary>
    public class WheelSpinCommand : WheelCommandBase
    {
        public override string Name => "!dgirar";
        public override string Description => "Gira la Rueda de la Suerte gastando tus créditos";

        public WheelSpinCommand(ILogger<WheelSpinCommand> logger, IServiceScopeFactory scopes)
            : base(logger, scopes) { }

        public override async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var wheels = scope.ServiceProvider.GetRequiredService<WheelService>();

                var lang = await LanguageAsync(db, context);
                var (wheel, channelId) = await ResolveWheelAsync(db, context, Name, porSaldo: false);
                if (wheel == null) return;   // este canal no usa el comando: silencio

                // "!dgirar 5". Un argumento que no sea un numero se ignora en vez de
                // rechazar el comando: quien escribio "!dgirar ya" queria girar.
                var partes = context.Message.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                var veces = 1;
                if (partes.Length > 1 && int.TryParse(partes[1].TrimStart('x', 'X'), out var pedidas) && pedidas > 1)
                    veces = pedidas;

                var multi = await wheels.SpinManyAsync(
                    channelId, context.Channel.ToLower(), wheel.Id, context.Username,
                    WheelSpinTriggers.Command, veces);

                var valores = new Dictionary<string, object?>
                {
                    ["user"] = context.Username,
                    ["wheel"] = wheel.Name,
                    ["credits"] = wheel.CreditLabel,
                    ["price"] = wheel.SpinPrice,
                    ["balance"] = multi.Balance,
                    ["seconds"] = multi.SecondsLeft,
                    ["label"] = multi.Labels.FirstOrDefault(),
                    ["coins"] = multi.CoinsAwarded,
                    ["spins"] = multi.Spins,
                    ["labels"] = string.Join(", ", multi.Labels),
                };

                var clave = multi.Reason switch
                {
                    WheelWalletService.SpendResult.SinSaldo => WheelMessages.NoCredits,
                    WheelWalletService.SpendResult.EnCooldown => WheelMessages.Cooldown,
                    WheelWalletService.SpendResult.TopeDeStream => WheelMessages.StreamLimit,
                    WheelWalletService.SpendResult.RuedaApagada => WheelMessages.WheelOff,
                    // Un solo mensaje para toda la tanda: uno por giro seria diez
                    // lineas seguidas del bot y el chat dejaria de leerse.
                    _ => multi.Spins > 1 ? WheelMessages.WinMulti
                       : multi.CoinsAwarded > 0 ? WheelMessages.WinCoins
                       : multi.Pending > 0 ? WheelMessages.WinPending
                       : WheelMessages.Win,
                };

                var msg = WheelMessages.Render(wheel.AnnounceConfig, clave, lang, valores);
                if (!string.IsNullOrWhiteSpace(msg))
                    await messageSender.SendMessageAsync(context.Channel, msg);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error en !dgirar de {User} en {Channel}", context.Username, context.Channel);
            }
        }
    }

    /// <summary>
    /// !dcomprar — cambia deca coins por créditos de la Rueda.
    ///
    /// <para>Es la única fuente que el espectador dispara: las otras son aportes que
    /// llegan (bits, subs de regalo, canjes) y esta es una compra. Solo responde si
    /// el streamer encendió la fuente <c>deca_coins</c> en la rueda.</para>
    /// </summary>
    public class WheelBuyCommand : WheelCommandBase
    {
        public override string Name => "!dcomprar";
        public override string Description => "Cambia deca coins por créditos de la Rueda de la Suerte";

        public WheelBuyCommand(ILogger<WheelBuyCommand> logger, IServiceScopeFactory scopes)
            : base(logger, scopes) { }

        public override async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var wheels = scope.ServiceProvider.GetRequiredService<WheelService>();

                var lang = await LanguageAsync(db, context);
                var (wheel, channelId) = await ResolveWheelAsync(db, context, Name, PorComando.Comprar);
                if (wheel == null) return;   // este canal no usa el comando: silencio

                var partes = context.Message.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (partes.Length < 2 || !int.TryParse(partes[1], out var coins) || coins <= 0)
                {
                    // Sin cantidad no se adivina: es dinero del espectador y elegir por
                    // el un numero por defecto seria gastarselo sin que lo pidiera.
                    var ayuda = WheelMessages.Render(wheel.AnnounceConfig, WheelMessages.BuyTooSmall, lang,
                        new Dictionary<string, object?> { ["user"] = context.Username, ["credits"] = wheel.CreditLabel, ["wheel"] = wheel.Name });
                    if (!string.IsNullOrWhiteSpace(ayuda)) await messageSender.SendMessageAsync(context.Channel, ayuda);
                    return;
                }

                // Los deca coins son de la cuenta de Decatron, no del canal: sin cuenta
                // no hay coins que gastar.
                var login = context.Username.ToLowerInvariant();
                var userId = await db.Users.Where(u => u.Login == login).Select(u => (long?)u.Id).FirstOrDefaultAsync();

                if (userId == null)
                {
                    var msgSinCuenta = WheelMessages.Render(wheel.AnnounceConfig, WheelMessages.BuyNoAccount, lang,
                        new Dictionary<string, object?> { ["user"] = context.Username });
                    if (!string.IsNullOrWhiteSpace(msgSinCuenta)) await messageSender.SendMessageAsync(context.Channel, msgSinCuenta);
                    return;
                }

                var r = await wheels.BuyCreditsAsync(
                    channelId, context.Channel.ToLower(), wheel.Id, login, userId.Value, coins);

                var valores = new Dictionary<string, object?>
                {
                    ["user"] = context.Username,
                    ["wheel"] = wheel.Name,
                    ["credits"] = r.CreditLabel,
                    ["coins"] = r.Ok ? r.CoinsSpent : r.CoinBalance,
                    ["added"] = r.CreditsAdded,
                    ["balance"] = r.Balance,
                };

                var clave = r.Ok ? WheelMessages.Bought
                    : r.Reason switch
                    {
                        "no_coins" => WheelMessages.NotEnoughCoins,
                        "too_small" => WheelMessages.BuyTooSmall,
                        _ => WheelMessages.WheelOff,
                    };

                var msg = WheelMessages.Render(wheel.AnnounceConfig, clave, lang, valores);
                if (!string.IsNullOrWhiteSpace(msg))
                    await messageSender.SendMessageAsync(context.Channel, msg);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error en !dcomprar de {User} en {Channel}", context.Username, context.Channel);
            }
        }
    }

    /// <summary>!dcreditos — consulta el saldo de la Billetera de Aportes.</summary>
    public class WheelBalanceCommand : WheelCommandBase
    {
        public override string Name => "!dcreditos";
        public override string Description => "Consulta tus créditos de la Rueda de la Suerte";

        public WheelBalanceCommand(ILogger<WheelBalanceCommand> logger, IServiceScopeFactory scopes)
            : base(logger, scopes) { }

        public override async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var wallets = scope.ServiceProvider.GetRequiredService<WheelWalletService>();

                var lang = await LanguageAsync(db, context);
                var (wheel, channelId) = await ResolveWheelAsync(db, context, Name, porSaldo: true);
                if (wheel == null) return;

                var saldo = await wallets.GetBalanceAsync(channelId, context.Username);
                var giros = wheel.SpinPrice > 0 ? saldo / wheel.SpinPrice : 0;

                var msg = WheelMessages.Render(
                    wheel.AnnounceConfig,
                    giros > 0 ? WheelMessages.Balance : WheelMessages.BalanceLow,
                    lang,
                    new Dictionary<string, object?>
                    {
                        ["user"] = context.Username,
                        ["wheel"] = wheel.Name,
                        ["credits"] = wheel.CreditLabel,
                        ["balance"] = saldo,
                        ["spins"] = giros,
                        ["price"] = wheel.SpinPrice,
                    });

                if (!string.IsNullOrWhiteSpace(msg))
                    await messageSender.SendMessageAsync(context.Channel, msg);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error en !dcreditos de {User} en {Channel}", context.Username, context.Channel);
            }
        }
    }
    /// <summary>!djoin — entra al sorteo del canal.</summary>
    public class WheelJoinCommand : WheelCommandBase
    {
        public override string Name => "!djoin";
        public override string Description => "Entra al sorteo de la Rueda de la Suerte";

        public WheelJoinCommand(ILogger<WheelJoinCommand> logger, IServiceScopeFactory scopes)
            : base(logger, scopes) { }

        public override async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var raffle = scope.ServiceProvider.GetRequiredService<WheelRaffleService>();

                var lang = await LanguageAsync(db, context);
                var (wheel, cfg, channelId) = await ResolveRaffleAsync(db, context, Name);
                if (wheel == null || cfg == null) return;   // este canal no usa el comando: silencio

                // El estado de sub sale del badge del mensaje y no de la base: un sub
                // recién hecho aparece en el badge antes que en ninguna tabla.
                var outcome = await raffle.JoinAsync(
                    channelId, wheel.Id, context.Username,
                    esSub: context.IsSubscriber,
                    esFollower: null,
                    viewerTwitchId: context.UserId);

                var valores = new Dictionary<string, object?>
                {
                    ["user"] = context.Username,
                    ["wheel"] = wheel.Name,
                    ["entries"] = outcome.Entries,
                    ["weight"] = outcome.Weight,
                    ["pool"] = outcome.PoolSize,
                    ["minutes"] = outcome.MinutosQueFaltan,
                };

                var clave = outcome.Result switch
                {
                    WheelRaffleService.JoinResult.Ok               => WheelMessages.RaffleJoined,
                    WheelRaffleService.JoinResult.YaTeniasElMaximo => WheelMessages.RaffleAlready,
                    WheelRaffleService.JoinResult.Cerrado          => WheelMessages.RaffleClosed,
                    WheelRaffleService.JoinResult.SoloSubs         => WheelMessages.RaffleNeedSub,
                    WheelRaffleService.JoinResult.SoloFollowers    => WheelMessages.RaffleNeedFollow,
                    WheelRaffleService.JoinResult.PocoWatchtime    => WheelMessages.RaffleNeedTime,
                    WheelRaffleService.JoinResult.SinCreditos      => WheelMessages.NoCredits,
                    _ => null,
                };
                if (clave == null) return;

                if (clave == WheelMessages.NoCredits)
                {
                    valores["balance"] = outcome.Balance;
                    valores["price"] = outcome.Cost;
                    valores["credits"] = wheel.CreditLabel;
                }

                var msg = WheelMessages.Render(wheel.AnnounceConfig, clave, lang, valores);
                if (!string.IsNullOrWhiteSpace(msg))
                    await messageSender.SendMessageAsync(context.Channel, msg);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Sorteo] Error en !djoin de {User} en {Channel}", context.Username, context.Channel);
            }
        }
    }

    /// <summary>
    /// !drueda — comandos de mod del sorteo: abrir, cerrar, sortear y reset.
    ///
    /// <para>Sin argumentos no hace nada: <c>!drueda</c> a secas está reservado para
    /// el comando de info del plan, que todavía no existe. Responder algo genérico
    /// ahora obligaría a cambiarlo después.</para>
    /// </summary>
    public class WheelRaffleModCommand : WheelCommandBase
    {
        public override string Name => "!drueda";
        public override string Description => "Abre, cierra, sortea o resetea el sorteo (moderadores)";

        public WheelRaffleModCommand(ILogger<WheelRaffleModCommand> logger, IServiceScopeFactory scopes)
            : base(logger, scopes) { }

        public override async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            try
            {
                // Lead Moderator es un nivel propio de Twitch y IsModerator no lo cubre.
                if (!context.IsModerator && !context.IsLeadModerator && !context.IsBroadcaster) return;

                var partes = context.Message.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (partes.Length < 2) return;

                var accion = partes[1].ToLowerInvariant();

                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var raffle = scope.ServiceProvider.GetRequiredService<WheelRaffleService>();

                var lang = await LanguageAsync(db, context);
                var (wheel, channelId) = await ResolveAnyRaffleAsync(db, context);
                if (wheel == null) return;

                var valores = new Dictionary<string, object?>
                {
                    ["user"] = context.Username,
                    ["wheel"] = wheel.Name,
                };

                switch (accion)
                {
                    case "abrir":
                    case "open":
                    {
                        var cfg = await raffle.AbrirAsync(wheel.Id);
                        valores["command"] = cfg.EntryCommand;
                        await ResponderAsync(messageSender, context, wheel, WheelMessages.RaffleOpened, lang, valores);
                        break;
                    }

                    case "cerrar":
                    case "close":
                        await raffle.CerrarAsync(wheel.Id);
                        await ResponderAsync(messageSender, context, wheel, WheelMessages.RaffleClosed, lang, valores);
                        break;

                    case "sortear":
                    case "draw":
                    {
                        var outcome = await raffle.SortearAsync(
                            channelId, context.Channel.ToLower(), wheel.Id, WheelSpinTriggers.RaffleDraw);

                        if (outcome.Result != WheelRaffleService.DrawResult.Ok)
                        {
                            await ResponderAsync(messageSender, context, wheel, WheelMessages.RaffleEmpty, lang, valores);
                            break;
                        }

                        // Un mensaje por ganador: en 'remove_and_continue' el chat tiene
                        // que poder seguir la tanda, y una lista en una línea se pierde.
                        foreach (var ganador in outcome.Ganadores)
                        {
                            valores["winner"] = ganador;
                            valores["pool"] = outcome.PoolSize;
                            await ResponderAsync(messageSender, context, wheel, WheelMessages.RaffleWinner, lang, valores);
                        }
                        break;
                    }

                    case "reset":
                        await raffle.LimpiarPoolAsync(wheel.Id);
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Sorteo] Error en !drueda de {User} en {Channel}", context.Username, context.Channel);
            }
        }

        private static async Task ResponderAsync(
            IMessageSender sender, CommandContext context, Wheel wheel,
            string clave, string lang, Dictionary<string, object?> valores)
        {
            var msg = WheelMessages.Render(wheel.AnnounceConfig, clave, lang, valores);
            if (!string.IsNullOrWhiteSpace(msg))
                await sender.SendMessageAsync(context.Channel, msg);
        }
    }
}
