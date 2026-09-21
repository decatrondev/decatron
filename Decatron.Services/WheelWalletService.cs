using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Decatron.Core.Helpers;
using Decatron.Core.Models.WheelOfLuck;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    /// <summary>Lo que un aporte produjo, para poder anunciarlo y decidir si girar.</summary>
    public class WheelCreditResult
    {
        public int WheelId { get; init; }
        public string WheelName { get; init; } = string.Empty;
        public string CreditLabel { get; init; } = string.Empty;
        public int CreditsAdded { get; init; }
        public int Balance { get; init; }
        public int SpinsOwed { get; init; }
        public bool AutoSpin { get; init; }
        /// <summary>La politica de la rueda, para que quien decide girar la vea.</summary>
        public string MultiFitPolicy { get; init; } = WheelMultiFitPolicies.MostSpins;
    }

    /// <summary>
    /// Billetera de Aportes — Fase 2.
    ///
    /// <para>Convierte lo que un espectador aporta al canal (bits, subs de regalo,
    /// canjes de puntos) en créditos, según las tasas que el streamer configuró en
    /// cada rueda. Ver <c>.dev/plans/RUEDA_DE_LA_SUERTE_PLAN.md</c> sección 6.1.</para>
    ///
    /// <para>La billetera es del CANAL, no de la rueda: el espectador aporta una vez
    /// y puede gastar en cualquier rueda de ese streamer. Las tasas, en cambio, son
    /// por rueda, porque cada una decide qué acepta y a cuánto.</para>
    /// </summary>
    public class WheelWalletService
    {
        private readonly DecatronDbContext _db;
        private readonly ILogger<WheelWalletService> _logger;

        public WheelWalletService(DecatronDbContext db, ILogger<WheelWalletService> logger)
        {
            _db = db;
            _logger = logger;
        }

        // ====================================================================
        // ACREDITAR
        // ====================================================================

        /// <summary>
        /// Reparte un aporte entre las ruedas del canal que aceptan esa fuente.
        ///
        /// <para><paramref name="amount"/> va en la unidad de la fuente: bits, cantidad
        /// de subs regalados, o canjes de la recompensa. Para donaciones, el monto en
        /// la moneda que el streamer haya configurado.</para>
        /// </summary>
        public async Task<List<WheelCreditResult>> CreditAsync(
            string channelLogin, string viewerLogin, string source, long amount,
            string? rewardId = null, string? subTier = null)
        {
            var resultados = new List<WheelCreditResult>();
            if (amount <= 0 || string.IsNullOrWhiteSpace(viewerLogin)) return resultados;

            var channelId = await ChannelResolver.ResolveUserIdAsync(_db, channelLogin);
            if (channelId == null) return resultados;

            var configuradas = await _db.WheelWalletSources
                .Include(ws => ws.Wheel)
                .Where(ws => ws.IsEnabled
                          && ws.Source == source
                          && ws.Wheel!.ChannelId == channelId
                          && ws.Wheel.IsEnabled
                          && ws.Wheel.Mode == WheelModes.Prizes)
                .ToListAsync();

            if (configuradas.Count == 0) return resultados;

            var wallet = await GetOrCreateWalletAsync(channelId.Value, viewerLogin);

            foreach (var cfg in configuradas)
            {
                var wheel = cfg.Wheel!;

                // Un canje de puntos solo cuenta si es LA recompensa que el streamer
                // eligió; si no, cualquier canje del canal cargaría la billetera.
                if (source == WheelSources.ChannelPoints
                    && !string.IsNullOrEmpty(cfg.ChannelPointsRewardId)
                    && !string.Equals(cfg.ChannelPointsRewardId, rewardId, StringComparison.OrdinalIgnoreCase))
                    continue;

                var creditos = cfg.Convertir(amount, subTier);
                if (creditos <= 0) continue;

                int acreditados;
                int giros = 0;

                if (wheel.IsAccumulable)
                {
                    // Se guarda todo; el espectador gira cuando junte el precio.
                    acreditados = creditos;
                }
                else if (creditos < wheel.SpinPrice)
                {
                    // No alcanzó en este único evento. Con `discard` el aporte se
                    // pierde, que es justo lo que el streamer eligió al apagar el
                    // acumulable, y por eso se registra: es la queja más probable.
                    _logger.LogInformation(
                        "🎡 [Rueda] {Viewer} aportó {Creditos} a '{Rueda}' pero el giro cuesta {Precio} y la rueda no acumula: se descarta",
                        viewerLogin, creditos, wheel.Name, wheel.SpinPrice);
                    continue;
                }
                else if (wheel.MultiFitPolicy == WheelMultiFitPolicies.ViewerChoice)
                {
                    // El espectador decide. Se le acredita TODO, incluido el sobrante:
                    // recortar lo que le sobra seria decidir por el, que es lo contrario
                    // de lo que pidio esta politica. Y no se gira solo — de eso se
                    // encarga WheelService, que ve la politica y no dispara el auto-giro.
                    giros = creditos / wheel.SpinPrice;
                    acreditados = creditos;
                }
                else
                {
                    // Alcanzó en este único evento. Cuántos giros da manda multi_fit_policy.
                    giros = wheel.MultiFitPolicy == WheelMultiFitPolicies.MostExpensive
                        ? 1                                  // el giro más caro posible
                        : creditos / wheel.SpinPrice;        // most_spins

                    // Con el sobrante manda overflow_policy: `discard` lo tira, que es
                    // justo lo que el streamer pidió al apagar el acumulable; con
                    // `cheapest_spins` se guarda para que sirva en una rueda más barata.
                    acreditados = wheel.OverflowPolicy == "discard"
                        ? giros * wheel.SpinPrice
                        : creditos;
                }

                wallet.Credits += acreditados;
                wallet.LifetimeCredits += acreditados;
                wallet.LastActivityAt = DateTime.UtcNow;

                resultados.Add(new WheelCreditResult
                {
                    WheelId = wheel.Id,
                    WheelName = wheel.Name,
                    CreditLabel = wheel.CreditLabel,
                    CreditsAdded = acreditados,
                    Balance = wallet.Credits,
                    SpinsOwed = wheel.IsAccumulable ? wallet.Credits / wheel.SpinPrice : giros,
                    MultiFitPolicy = wheel.MultiFitPolicy,
                    AutoSpin = wheel.AutoSpin,
                });
            }

            if (resultados.Count > 0) await _db.SaveChangesAsync();
            return resultados;
        }

        // ====================================================================
        // GASTAR
        // ====================================================================

        /// <summary>
        /// Por qué no se pudo girar. El chat necesita distinguirlos: "no te alcanza"
        /// y "espera 20 segundos" son problemas distintos para el espectador.
        /// </summary>
        public enum SpendResult { Ok, SinSaldo, EnCooldown, TopeDeStream, RuedaApagada }

        /// <summary>
        /// Cobra un giro. Devuelve por qué no se pudo, si no se pudo, y cuántos
        /// segundos faltan cuando el motivo es el cooldown.
        /// </summary>
        public async Task<(SpendResult Result, int Balance, int SecondsLeft)> TrySpendAsync(
            long channelId, string viewerLogin, Wheel wheel)
        {
            var wallet = await GetOrCreateWalletAsync(channelId, viewerLogin);

            if (!wheel.IsEnabled) return (SpendResult.RuedaApagada, wallet.Credits, 0);

            if (wheel.SpinCooldownSeconds > 0 && wallet.LastSpinAt.HasValue)
            {
                var pasados = (DateTime.UtcNow - wallet.LastSpinAt.Value).TotalSeconds;
                var faltan = wheel.SpinCooldownSeconds - pasados;
                if (faltan > 0) return (SpendResult.EnCooldown, wallet.Credits, (int)Math.Ceiling(faltan));
            }

            if (wheel.MaxSpinsPerStream.HasValue && wallet.SpinsThisStream >= wheel.MaxSpinsPerStream.Value)
                return (SpendResult.TopeDeStream, wallet.Credits, 0);

            if (wallet.Credits < wheel.SpinPrice)
                return (SpendResult.SinSaldo, wallet.Credits, 0);

            wallet.Credits -= wheel.SpinPrice;
            wallet.SpinsThisStream += 1;
            wallet.LastSpinAt = DateTime.UtcNow;
            wallet.LastActivityAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return (SpendResult.Ok, wallet.Credits, 0);
        }

        /// <summary>
        /// Cobra varios giros de una. Es <b>todo o nada</b>: si no alcanza el saldo o
        /// el tope de stream para las <paramref name="veces"/> pedidas, no cobra nada.
        ///
        /// <para>Girar "las que se puedan" sería más amable en apariencia y peor en la
        /// práctica: el espectador pidió diez, se le cobrarían siete y se enteraría
        /// después. Cuando hay saldo de por medio, previsible gana a amable.</para>
        ///
        /// <para>El cooldown se comprueba <b>una vez</b>, no por giro: un x10 es una
        /// sola acción del espectador, y aplicarlo por giro haría que el segundo
        /// fallara siempre.</para>
        /// </summary>
        public async Task<(SpendResult Result, int Balance, int SecondsLeft)> TrySpendManyAsync(
            long channelId, string viewerLogin, Wheel wheel, int veces)
        {
            if (veces <= 1) return await TrySpendAsync(channelId, viewerLogin, wheel);

            var wallet = await GetOrCreateWalletAsync(channelId, viewerLogin);

            if (!wheel.IsEnabled) return (SpendResult.RuedaApagada, wallet.Credits, 0);

            if (wheel.SpinCooldownSeconds > 0 && wallet.LastSpinAt.HasValue)
            {
                var pasados = (DateTime.UtcNow - wallet.LastSpinAt.Value).TotalSeconds;
                var faltan = wheel.SpinCooldownSeconds - pasados;
                if (faltan > 0) return (SpendResult.EnCooldown, wallet.Credits, (int)Math.Ceiling(faltan));
            }

            if (wheel.MaxSpinsPerStream.HasValue &&
                wallet.SpinsThisStream + veces > wheel.MaxSpinsPerStream.Value)
                return (SpendResult.TopeDeStream, wallet.Credits, 0);

            var total = wheel.SpinPrice * veces;
            if (wallet.Credits < total) return (SpendResult.SinSaldo, wallet.Credits, 0);

            wallet.Credits -= total;
            wallet.SpinsThisStream += veces;
            wallet.LastSpinAt = DateTime.UtcNow;
            wallet.LastActivityAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return (SpendResult.Ok, wallet.Credits, 0);
        }

        /// <summary>Devuelve el precio de un giro que no se pudo resolver.</summary>
        public Task RefundAsync(long channelId, string viewerLogin, int amount) =>
            RefundManyAsync(channelId, viewerLogin, amount, 1);

        /// <summary>
        /// Devuelve créditos y cupo de stream de varios giros que no se resolvieron.
        /// El cupo también vuelve: si el giro no ocurrió, no consumió el tope del stream.
        /// </summary>
        public async Task RefundManyAsync(long channelId, string viewerLogin, int amount, int spins)
        {
            var wallet = await GetOrCreateWalletAsync(channelId, viewerLogin);
            wallet.Credits += amount;
            wallet.SpinsThisStream = Math.Max(0, wallet.SpinsThisStream - Math.Max(0, spins));
            await _db.SaveChangesAsync();
        }

        /// <summary>
        /// Suma créditos sin pasar por una tasa de conversión. Lo usa el premio
        /// <c>free_spin</c>, que regala giros y no aportes: el espectador no aportó
        /// nada, así que <c>lifetime_credits</c> no se toca — ese contador mide cuánto
        /// aportó de verdad y es lo que miran los leaderboards.
        /// </summary>
        public async Task GrantCreditsAsync(long channelId, string viewerLogin, int amount)
        {
            if (amount <= 0) return;

            var wallet = await GetOrCreateWalletAsync(channelId, viewerLogin);
            wallet.Credits += amount;
            wallet.LastActivityAt = DateTime.UtcNow;
            wallet.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        /// <summary>
        /// Cobra créditos y dice si alcanzó. Existe aparte de
        /// <see cref="GrantCreditsAsync"/> porque esa ignora los importes negativos
        /// a propósito (regalar "menos que nada" no significa nada), así que usarla
        /// para cobrar no cobra: no falla, simplemente no hace nada.
        /// </summary>
        public async Task<bool> TryChargeAsync(long channelId, string viewerLogin, int amount)
        {
            if (amount <= 0) return true;

            var wallet = await GetOrCreateWalletAsync(channelId, viewerLogin);
            if (wallet.Credits < amount) return false;

            wallet.Credits -= amount;
            wallet.LastActivityAt = DateTime.UtcNow;
            wallet.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return true;
        }

        // ====================================================================
        // CONSULTAS
        // ====================================================================

        public async Task<int> GetBalanceAsync(long channelId, string viewerLogin)
        {
            var login = viewerLogin.ToLowerInvariant();
            return await _db.WheelWallets
                .Where(w => w.ChannelId == channelId && w.ViewerLogin == login)
                .Select(w => w.Credits)
                .FirstOrDefaultAsync();
        }

        /// <summary>
        /// Pone en cero los contadores "por stream" del canal. Lo llama stream.online:
        /// es el único momento en que "por stream" significa algo verificable.
        /// </summary>
        public async Task ResetStreamCountersAsync(long channelId)
        {
            var afectadas = await _db.WheelWallets
                .Where(w => w.ChannelId == channelId && w.SpinsThisStream > 0)
                .ExecuteUpdateAsync(s => s.SetProperty(w => w.SpinsThisStream, 0));

            SincronizarLocal(channelId, nameof(WheelWallet.SpinsThisStream), 0);

            if (afectadas > 0)
                _logger.LogInformation("🎡 [Rueda] Contadores de giros por stream reiniciados en {N} billeteras", afectadas);

            // El stock de ventana "stream" se reinicia acá y no al girar: es el único
            // momento del sistema en que "empezó un stream" es un hecho y no una
            // suposición sobre cuánto tiempo pasó desde el último giro.
            var gajos = await _db.WheelSegments
                .Where(sg => sg.Wheel != null
                          && sg.Wheel.ChannelId == channelId
                          && sg.StockTotal != null
                          && sg.StockWindow == WheelStockWindows.Stream)
                .ExecuteUpdateAsync(u => u
                    .SetProperty(sg => sg.StockRemaining, sg => sg.StockTotal)
                    .SetProperty(sg => sg.StockResetAt, DateTime.UtcNow));

            if (gajos > 0)
                _logger.LogInformation("🎡 [Rueda] Stock por stream repuesto en {N} gajos", gajos);
        }

        /// <summary>
        /// Caducidad por fin de stream: las ruedas con <c>credit_expiry = stream_end</c>
        /// vacían el saldo de su canal. El histórico (`lifetime_credits`) no se toca.
        /// </summary>
        public async Task ExpireOnStreamEndAsync(long channelId)
        {
            var caduca = await _db.Wheels
                .AnyAsync(w => w.ChannelId == channelId && w.CreditExpiry == "stream_end");
            if (!caduca) return;

            var afectadas = await _db.WheelWallets
                .Where(w => w.ChannelId == channelId && w.Credits > 0)
                .ExecuteUpdateAsync(s => s.SetProperty(w => w.Credits, 0));

            SincronizarLocal(channelId, nameof(WheelWallet.Credits), 0);

            _logger.LogInformation("🎡 [Rueda] Créditos caducados al cerrar stream en {N} billeteras", afectadas);
        }

        /// <summary>
        /// Pone al día las billeteras que este DbContext ya tenía cargadas después de
        /// un <c>ExecuteUpdate</c>.
        ///
        /// <para>ExecuteUpdate escribe directo en la base sin pasar por el rastreador,
        /// así que sin esto un lector del mismo scope seguiría viendo el valor viejo.</para>
        ///
        /// <para>Se toca también el valor ORIGINAL, no solo el actual: en EF Core poner
        /// <c>IsModified = false</c> devuelve la propiedad a su valor original, así que
        /// actualizar solo el actual se deshace solo en la línea siguiente.</para>
        /// </summary>
        private void SincronizarLocal(long channelId, string propiedad, int valor)
        {
            foreach (var w in _db.WheelWallets.Local.Where(x => x.ChannelId == channelId).ToList())
            {
                var entry = _db.Entry(w);
                if (entry.State == EntityState.Detached || entry.State == EntityState.Added) continue;

                var prop = entry.Property(propiedad);
                prop.OriginalValue = valor;   // es lo que la base tiene ahora
                prop.CurrentValue = valor;
                prop.IsModified = false;      // ya no revierte nada: original == actual
            }
        }

        private async Task<WheelWallet> GetOrCreateWalletAsync(long channelId, string viewerLogin)
        {
            var login = viewerLogin.ToLowerInvariant();

            // Primero entre las que este DbContext ya tiene en memoria. Una billetera
            // creada acá puede quedar sin guardar (un aporte que no acredita nada no
            // llama a SaveChanges), y sin esta comprobación el siguiente aporte del
            // mismo scope crearía una segunda y las dos chocarían contra
            // uq_wheel_wallets_channel_viewer al guardar.
            var local = _db.WheelWallets.Local
                .FirstOrDefault(w => w.ChannelId == channelId && w.ViewerLogin == login);
            if (local != null) return local;

            var wallet = await _db.WheelWallets
                .FirstOrDefaultAsync(w => w.ChannelId == channelId && w.ViewerLogin == login);

            if (wallet != null) return wallet;

            wallet = new WheelWallet
            {
                ChannelId = channelId,
                ViewerLogin = login,
                // Puede no existir en users todavía: el espectador aporta antes de
                // tener cuenta en Decatron, y su saldo no puede esperar a eso.
                ViewerUserId = await _db.Users
                    .Where(u => u.Login == login)
                    .Select(u => (long?)u.Id)
                    .FirstOrDefaultAsync(),
            };

            _db.WheelWallets.Add(wallet);
            return wallet;
        }
    }
}
