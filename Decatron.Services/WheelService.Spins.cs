using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Decatron.Core.Helpers;
using Decatron.Core.Models.WheelOfLuck;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    /// <summary>El giro: elegir gajo, créditos y giros, compra, giro de regalo y multi-giro. Parte de <see cref="WheelService"/>.</summary>
    public partial class WheelService
    {
        // ====================================================================
        // EL GIRO
        // ====================================================================

        /// <summary>
        /// Elige un gajo por peso y lo empuja al overlay.
        ///
        /// <para>El resultado se decide acá y el overlay solo anima hasta el ángulo que
        /// le llega. Nunca al revés.</para>
        ///
        /// <para><paramref name="dryRun"/> es el "Probar giro" del panel: anima el
        /// overlay pero no escribe historial ni entrega el premio, para que el streamer
        /// pueda ajustar la escena de OBS sin ensuciar sus datos.</para>
        /// </summary>
        public async Task<WheelSpinPayload?> SpinAsync(long channelId, string channelLogin, int wheelId, string trigger, string? spinnerLogin, bool dryRun)
        {
            var wheel = await GetWheelAsync(channelId, wheelId);
            if (wheel == null) return null;

            // Estos son exactamente los gajos que dibuja el overlay (ver
            // GetOverlayDataAsync): tiene que ser el MISMO filtro, porque el índice del
            // ganador se calcula sobre esta lista y la aguja se para por índice. Si acá
            // se filtrara además por peso o por stock, un gajo de peso 0 correría los
            // índices y la rueda pararía en el gajo de al lado.
            var candidatos = await _db.WheelSegments
                .Where(s => s.WheelId == wheelId && s.IsEnabled)
                .OrderBy(s => s.DisplayOrder).ThenBy(s => s.Id)
                .ToListAsync();

            // Las ventanas de stock vencidas se reinician ANTES de mirar quién puede
            // salir: un gajo de "3 por día" que se agotó ayer tiene que volver a estar
            // disponible hoy, y eso no puede depender de que alguien abra el panel.
            var reinicios = ReiniciarVentanasDeStock(candidatos, dryRun);

            // Un gajo sin peso o sin stock sigue dibujándose en la rueda, pero no sale.
            var elegibles = candidatos
                .Where(s => s.Weight > 0 && (s.StockTotal == null || s.StockRemaining > 0))
                .ToList();

            // Las tres reglas de la Fase 7 solo ESTRECHAN esta lista; ninguna toca
            // `candidatos`. El índice del ganador se calcula sobre `candidatos`, así que
            // sacar un gajo de ahí correría los índices y la aguja pararía en el de al
            // lado — es el bug de la Fase 1, y la única defensa es no volver a filtrarla.
            elegibles = await SinStockDelEspectadorAsync(wheelId, spinnerLogin, elegibles);
            elegibles = await SinRepetirAsync(wheel, spinnerLogin, elegibles);
            elegibles = await ConPiedadAsync(wheel, channelId, spinnerLogin, elegibles);

            if (elegibles.Count == 0)
            {
                if (reinicios) await _db.SaveChangesAsync();
                return null;
            }

            var ganador = PickWeighted(elegibles);

            WheelSpin? spin = null;
            if (!dryRun)
            {
                if (ganador.StockTotal != null && ganador.StockRemaining != null)
                    ganador.StockRemaining = Math.Max(0, ganador.StockRemaining.Value - 1);

                await ActualizarPiedadAsync(wheel, channelId, spinnerLogin, ganador);

                spin = new WheelSpin
                {
                    WheelId = wheel.Id,
                    Mode = wheel.Mode,
                    SpinnerLogin = spinnerLogin,
                    TriggerSource = trigger,
                    ResultSegmentId = ganador.Id,
                    ResultPrize = ganador.Prize,
                    // Arranca como entregado y lo baja a "pending" el handler que no
                    // pudo cumplirlo. Adivinarlo acá era posible cuando el único premio
                    // pendiente era manual_message; con los handlers de Fase 3 el que
                    // sabe si se pudo entregar es el handler, y solo después de intentarlo.
                    DeliveryStatus = "delivered",
                    CreatedAt = DateTime.UtcNow
                };
                _db.WheelSpins.Add(spin);
                await _db.SaveChangesAsync();
            }

            // Un reinicio de ventana se guarda aunque el giro sea de prueba: el
            // calendario avanzó igual, y dejarlo sin guardar haría que el mismo gajo
            // se "reiniciara" otra vez en el siguiente giro de verdad.
            if (dryRun && reinicios) await _db.SaveChangesAsync();

            var indice = candidatos.FindIndex(s => s.Id == ganador.Id);

            var payload = new WheelSpinPayload
            {
                Slug = wheel.Slug,
                SpinId = spin?.Id,
                DryRun = dryRun,
                SegmentId = ganador.Id,
                SegmentIndex = indice,
                SegmentCount = candidatos.Count,
                Label = ganador.Label,
                Color = ganador.Color,
                Icon = ganador.Icon,
                Prize = ParseJson(ganador.Prize),
                Spinner = spinnerLogin,
                Trigger = trigger,
                PrizeJson = ganador.Prize,
                WheelSegments = candidatos
                    .Select(s => new WheelOverlaySegment { Id = s.Id, Label = s.Label, Color = s.Color, Icon = s.Icon })
                    .ToList(),
            };

            await _overlays.SendWheelSpinAsync(channelLogin, payload);
            return payload;
        }

        /// <summary>Lo que un aporte produjo en una rueda: cuánto acreditó y si giró.</summary>
        public class ContributionOutcome
        {
            public int WheelId { get; init; }
            public string WheelName { get; init; } = string.Empty;
            public string CreditLabel { get; init; } = string.Empty;
            public int CreditsAdded { get; init; }
            public int Balance { get; init; }
            public int SpinsOwed { get; init; }
            public bool Spun { get; init; }
            public string? SpinLabel { get; init; }
        }

        /// <summary>
        /// Acredita un aporte y, si la rueda tiene auto-girar, la hace girar.
        ///
        /// <para>Este es el camino real de los bits, los subs de regalo y los canjes:
        /// lo llaman tanto el handler de EventSub como el simulador del panel, a
        /// propósito. Un simulador que reprodujera la lógica por su cuenta probaría
        /// su propia copia y no lo que pasa en vivo.</para>
        /// </summary>
        public async Task<List<ContributionOutcome>> CreditAndMaybeSpinAsync(
            string channelLogin, string viewerLogin, string source, long amount,
            string? rewardId = null, string? subTier = null)
        {
            var salida = new List<ContributionOutcome>();

            var channel = channelLogin.ToLowerInvariant();
            var viewer = viewerLogin.ToLowerInvariant().TrimStart('@');

            var acreditados = await _wallets.CreditAsync(channel, viewer, source, amount, rewardId, subTier);
            if (acreditados.Count == 0) return salida;

            var channelId = await ChannelResolver.ResolveUserIdAsync(_db, channel);
            if (channelId == null) return salida;

            foreach (var r in acreditados)
            {
                var giro = false;
                string? etiqueta = null;

                // Un solo giro por evento aunque el aporte alcance para varios: la rueda
                // es una animación de varios segundos en pantalla y encadenar diez
                // seguidas por un cheer grande tapa el stream. El resto queda de saldo.
                // Con `viewer_choice` no se gira solo aunque el auto-giro este
                // encendido: la politica dice exactamente que el que decide cuantos
                // giros gasta es el espectador, y girarle uno se lo decide igual.
                if (r.AutoSpin && r.SpinsOwed > 0 && r.MultiFitPolicy != WheelMultiFitPolicies.ViewerChoice)
                {
                    var outcome = await SpinForViewerAsync(
                        channelId.Value, channel, r.WheelId, viewer, WheelSpinTriggers.Auto);

                    giro = outcome.Ok;
                    etiqueta = outcome.Label;

                    if (giro)
                        _logger.LogInformation("🎡 [Rueda] Auto-giro de {Viewer} en '{Rueda}': {Label}",
                            viewer, r.WheelName, outcome.Label);
                }

                // Con `viewer_choice` hay que avisar: si no, el espectador ve que la
                // rueda no giro y no tiene forma de saber que le quedaron giros para
                // gastar. Es la unica politica que necesita decir algo, porque es la
                // unica en la que la pelota queda del lado del espectador.
                if (!giro && r.MultiFitPolicy == WheelMultiFitPolicies.ViewerChoice && r.SpinsOwed > 0)
                    await AvisarEleccionAsync(channelId.Value, channel, r, viewer);

                salida.Add(new ContributionOutcome
                {
                    WheelId = r.WheelId,
                    WheelName = r.WheelName,
                    CreditLabel = r.CreditLabel,
                    CreditsAdded = r.CreditsAdded,
                    Balance = giro ? await _wallets.GetBalanceAsync(channelId.Value, viewer) : r.Balance,
                    SpinsOwed = r.SpinsOwed,
                    Spun = giro,
                    SpinLabel = etiqueta,
                });
            }

            return salida;
        }

        /// <summary>Cómo le fue a un espectador que pidió girar.</summary>
        public class ViewerSpinOutcome
        {
            public bool Ok { get; init; }
            public WheelWalletService.SpendResult Reason { get; init; }
            public int Balance { get; init; }
            public int SecondsLeft { get; init; }
            public string? Label { get; init; }
            public int CoinsAwarded { get; init; }
            public bool Pending { get; init; }
        }

        /// <summary>
        /// El giro completo de un espectador: cobra, sortea, entrega y anuncia.
        ///
        /// <para>Si el sorteo falla después de cobrar (una rueda sin gajos elegibles,
        /// por ejemplo) se devuelven los créditos. Cobrar y no girar es la única falla
        /// que el espectador vive como un robo.</para>
        /// </summary>
        public async Task<ViewerSpinOutcome> SpinForViewerAsync(
            long channelId, string channelLogin, int wheelId, string viewerLogin, string trigger)
        {
            var wheel = await GetWheelAsync(channelId, wheelId);
            if (wheel == null)
                return new ViewerSpinOutcome { Ok = false, Reason = WheelWalletService.SpendResult.RuedaApagada };

            var (result, balance, secondsLeft) = await _wallets.TrySpendAsync(channelId, viewerLogin, wheel);
            if (result != WheelWalletService.SpendResult.Ok)
                return new ViewerSpinOutcome { Ok = false, Reason = result, Balance = balance, SecondsLeft = secondsLeft };

            var payload = await SpinAsync(channelId, channelLogin, wheelId, trigger, viewerLogin, dryRun: false);
            if (payload == null)
            {
                await _wallets.RefundAsync(channelId, viewerLogin, wheel.SpinPrice);
                _logger.LogWarning("🎡 [Rueda] '{Rueda}' no tenía ningún gajo elegible; se devolvieron {Precio} créditos a {Viewer}",
                    wheel.Name, wheel.SpinPrice, viewerLogin);
                return new ViewerSpinOutcome { Ok = false, Reason = WheelWalletService.SpendResult.RuedaApagada, Balance = balance + wheel.SpinPrice };
            }

            var entrega = await EntregarPremioAsync(wheel, channelLogin, viewerLogin, payload.SpinId, payload.PrizeJson);

            return new ViewerSpinOutcome
            {
                Ok = true,
                Reason = WheelWalletService.SpendResult.Ok,
                Balance = balance,
                Label = payload.Label,
                CoinsAwarded = entrega.Coins,
                Pending = entrega.Pending,
            };
        }

        /// <summary>El resultado de un "girar x N".</summary>
        public class MultiSpinOutcome
        {
            public bool Ok { get; init; }
            public WheelWalletService.SpendResult Reason { get; init; }
            public int Balance { get; init; }
            public int SecondsLeft { get; init; }
            /// <summary>Cuántos giros se resolvieron de verdad.</summary>
            public int Spins { get; init; }
            /// <summary>Las etiquetas ganadoras, en orden.</summary>
            public List<string> Labels { get; init; } = new();
            public int CoinsAwarded { get; init; }
            public int Pending { get; init; }
        }

        /// <summary>
        /// Girar x N: cobra los N de una y resuelve N giros independientes.
        ///
        /// <para>Cada giro es un sorteo aparte con sus propias reglas, así que el stock
        /// se va gastando entre uno y otro y la piedad puede saltar a mitad de la tanda
        /// — que es justo lo que tiene que pasar. El overlay recibe N eventos y ya sabe
        /// encolarlos: no hay nada nuevo del lado del dibujo.</para>
        ///
        /// <para>El cobro es todo o nada (ver <c>TrySpendManyAsync</c>), pero si a mitad
        /// de la tanda la rueda se queda sin gajos elegibles se devuelve lo que no se
        /// llegó a usar. Cobrar por un giro que no ocurrió sería quedarse con el dinero
        /// por un fallo nuestro.</para>
        /// </summary>
        public async Task<MultiSpinOutcome> SpinManyAsync(
            long channelId, string channelLogin, int wheelId, string viewerLogin, string trigger, int veces)
        {
            var wheel = await GetWheelAsync(channelId, wheelId);
            if (wheel == null)
                return new MultiSpinOutcome { Ok = false, Reason = WheelWalletService.SpendResult.RuedaApagada };

            // Pedir x5 en una rueda que no lo habilita gira una vez, no cero: el
            // espectador quiso girar y el número de más es un detalle que no entendió.
            var pedidas = Math.Max(1, veces);
            if (!wheel.AllowMultiSpin) pedidas = 1;
            else pedidas = Math.Min(pedidas, Math.Max(1, wheel.MaxMultiSpin));

            var (result, balance, secondsLeft) = await _wallets.TrySpendManyAsync(channelId, viewerLogin, wheel, pedidas);
            if (result != WheelWalletService.SpendResult.Ok)
                return new MultiSpinOutcome { Ok = false, Reason = result, Balance = balance, SecondsLeft = secondsLeft };

            var etiquetas = new List<string>();
            var coins = 0;
            var pendientes = 0;
            var hechos = 0;

            for (var i = 0; i < pedidas; i++)
            {
                var payload = await SpinAsync(channelId, channelLogin, wheelId, trigger, viewerLogin, dryRun: false);
                if (payload == null) break;

                hechos++;
                etiquetas.Add(payload.Label);

                var entrega = await EntregarPremioAsync(wheel, channelLogin, viewerLogin, payload.SpinId, payload.PrizeJson);
                coins += entrega.Coins;
                if (entrega.Pending) pendientes++;
            }

            if (hechos == 0)
            {
                await _wallets.RefundManyAsync(channelId, viewerLogin, wheel.SpinPrice * pedidas, pedidas);
                _logger.LogWarning("🎡 [Rueda] '{Rueda}' no tenía gajos elegibles; se devolvieron {N} giros a {Viewer}",
                    wheel.Name, pedidas, viewerLogin);
                return new MultiSpinOutcome
                {
                    Ok = false,
                    Reason = WheelWalletService.SpendResult.RuedaApagada,
                    Balance = balance + wheel.SpinPrice * pedidas,
                };
            }

            if (hechos < pedidas)
            {
                var sinUsar = pedidas - hechos;
                await _wallets.RefundManyAsync(channelId, viewerLogin, wheel.SpinPrice * sinUsar, sinUsar);
                balance += wheel.SpinPrice * sinUsar;
            }

            return new MultiSpinOutcome
            {
                Ok = true,
                Reason = WheelWalletService.SpendResult.Ok,
                Balance = balance,
                Spins = hechos,
                Labels = etiquetas,
                CoinsAwarded = coins,
                Pending = pendientes,
            };
        }

        /// <summary>El idioma configurado por el canal. "es" si no eligió ninguno.</summary>
        private async Task<string> IdiomaDelCanalAsync(long channelId)
        {
            var lang = await _db.Users.AsNoTracking()
                .Where(u => u.Id == channelId)
                .Select(u => u.PreferredLanguage)
                .FirstOrDefaultAsync();
            return string.IsNullOrEmpty(lang) ? "es" : lang;
        }

        /// <summary>
        /// Le dice al espectador cuántos giros tiene y que decide él.
        /// </summary>
        private async Task AvisarEleccionAsync(
            long channelId, string channelLogin, WheelCreditResult r, string viewer)
        {
            try
            {
                var wheel = await _db.Wheels.AsNoTracking()
                    .FirstOrDefaultAsync(w => w.Id == r.WheelId && w.ChannelId == channelId);
                if (wheel == null || !wheel.CommandEnabled) return;

                var lang = await IdiomaDelCanalAsync(channelId);

                var texto = WheelMessages.Render(wheel.AnnounceConfig, WheelMessages.ChoiceReady, lang,
                    new Dictionary<string, object?>
                    {
                        ["user"] = viewer,
                        ["wheel"] = r.WheelName,
                        ["credits"] = r.CreditLabel,
                        ["balance"] = r.Balance,
                        ["spins"] = r.SpinsOwed,
                        ["command"] = wheel.SpinCommand,
                    });

                if (!string.IsNullOrWhiteSpace(texto))
                    await _chat.SendMessageAsync(channelLogin, texto);
            }
            catch (Exception ex)
            {
                // Un aviso que no sale no puede tumbar la acreditacion, que ya ocurrio.
                _logger.LogWarning(ex, "🎡 [Rueda] No se pudo avisar la eleccion de giros a {Viewer}", viewer);
            }
        }

        /// <summary>Lo que dejó una compra de créditos con deca coins.</summary>
        public class PurchaseOutcome
        {
            public bool Ok { get; init; }
            /// <summary>`no_wheel`, `source_off`, `no_account`, `no_coins`, `too_small`.</summary>
            public string Reason { get; init; } = string.Empty;
            public int CoinsSpent { get; init; }
            public int CreditsAdded { get; init; }
            public int Balance { get; init; }
            public int CoinBalance { get; init; }
            public string CreditLabel { get; init; } = string.Empty;
        }

        /// <summary>
        /// Compra créditos gastando deca coins.
        ///
        /// <para><c>deca_coins</c> es la única fuente que no es un aporte que llega
        /// sino una <b>compra</b>: nadie la dispara desde fuera, la dispara el
        /// espectador. Por eso necesitaba un comando y no un enganche de EventSub.</para>
        ///
        /// <para>Se cobra primero y se acredita después. Al revés, un fallo al gastar
        /// los coins dejaría los créditos regalados; así, un fallo al acreditar deja
        /// los coins gastados sin contrapartida — que también es malo, y por eso el
        /// camino de acreditación se ejecuta antes de confirmar nada que no se pueda
        /// deshacer: si no acredita, se devuelven los coins.</para>
        /// </summary>
        public async Task<PurchaseOutcome> BuyCreditsAsync(
            long channelId, string channelLogin, int wheelId, string viewerLogin, long userId, int coins)
        {
            if (coins <= 0) return new PurchaseOutcome { Reason = "too_small" };

            var wheel = await GetWheelAsync(channelId, wheelId);
            if (wheel == null) return new PurchaseOutcome { Reason = "no_wheel" };

            var fuente = await _db.WheelWalletSources.AsNoTracking()
                .FirstOrDefaultAsync(f => f.WheelId == wheelId && f.Source == WheelSources.DecaCoins);

            if (fuente == null || !fuente.IsEnabled)
                return new PurchaseOutcome { Reason = "source_off", CreditLabel = wheel.CreditLabel };

            // Cuánto daría, ANTES de cobrar. Cobrar coins para acreditar cero seria
            // quedarse con el dinero por un redondeo de la tasa.
            var previstos = fuente.Convertir(coins);
            if (previstos <= 0)
                return new PurchaseOutcome { Reason = "too_small", CreditLabel = wheel.CreditLabel };

            try
            {
                await _coins.SpendCoinsAsync(userId, coins, "wheel_credits",
                    $"Créditos de la Rueda de la Suerte ({wheel.Name})");
            }
            catch (InvalidOperationException)
            {
                // Saldo insuficiente o cuenta suspendida: lo dice CoinService y no hay
                // nada que deshacer porque todavía no se acreditó nada.
                var saldo = await _coins.GetBalanceAsync(userId);
                return new PurchaseOutcome
                {
                    Reason = "no_coins",
                    CoinBalance = (int)Math.Min(saldo, int.MaxValue),
                    CreditLabel = wheel.CreditLabel,
                };
            }

            var resultados = await _wallets.CreditAsync(channelLogin, viewerLogin, WheelSources.DecaCoins, coins);
            var mio = resultados.FirstOrDefault(r => r.WheelId == wheelId);

            if (mio == null)
            {
                // No acreditó (la rueda se apagó entre medio, por ejemplo). Se devuelven
                // los coins: cobrar por algo que no se entregó no es una opción.
                // Se devuelve con GiveCoinsAsync, que deja la transacción escrita. Suma
                // al "total ganado" del espectador, que para una devolución no es exacto;
                // se acepta porque la alternativa —tocar el balance a mano— dejaría el
                // movimiento sin rastro, y en un camino de dinero el rastro pesa más.
                await _coins.GiveCoinsAsync(userId, coins,
                    $"Devolución: no se pudieron acreditar créditos de '{wheel.Name}'", null);
                _logger.LogWarning("🎡 [Rueda] Compra de {Viewer} devuelta: '{Rueda}' no acredito", viewerLogin, wheel.Name);
                return new PurchaseOutcome { Reason = "no_wheel", CreditLabel = wheel.CreditLabel };
            }

            var coinsRestantes = await _coins.GetBalanceAsync(userId);

            return new PurchaseOutcome
            {
                Ok = true,
                CoinsSpent = coins,
                CreditsAdded = mio.CreditsAdded,
                Balance = mio.Balance,
                CoinBalance = (int)Math.Min(coinsRestantes, int.MaxValue),
                CreditLabel = mio.CreditLabel,
            };
        }

        /// <summary>
        /// Giro de regalo del streamer: gira y <b>entrega</b>, sin cobrar créditos ni
        /// tocar los topes del espectador.
        ///
        /// <para>Existe porque el panel tenía un camino que giraba llamando a
        /// <see cref="SpinAsync"/> directo y nunca entregaba nada: la rueda se veía
        /// girar en OBS y el espectador no recibía el premio.</para>
        /// </summary>
        public async Task<ViewerSpinOutcome> SpinFreeAsync(
            long channelId, string channelLogin, int wheelId, string viewerLogin, string trigger)
        {
            var wheel = await GetWheelAsync(channelId, wheelId);
            if (wheel == null)
                return new ViewerSpinOutcome { Ok = false, Reason = WheelWalletService.SpendResult.RuedaApagada };

            var payload = await SpinAsync(channelId, channelLogin, wheelId, trigger, viewerLogin, dryRun: false);
            if (payload == null)
                return new ViewerSpinOutcome { Ok = false, Reason = WheelWalletService.SpendResult.RuedaApagada };

            var entrega = await EntregarPremioAsync(wheel, channelLogin, viewerLogin, payload.SpinId, payload.PrizeJson);

            return new ViewerSpinOutcome
            {
                Ok = true,
                Reason = WheelWalletService.SpendResult.Ok,
                Balance = await _wallets.GetBalanceAsync(channelId, viewerLogin),
                Label = payload.Label,
                CoinsAwarded = entrega.Coins,
                Pending = entrega.Pending,
            };
        }
    }
}
