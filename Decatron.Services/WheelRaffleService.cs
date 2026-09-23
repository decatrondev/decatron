using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Decatron.Core.Models.WheelOfLuck;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    /// <summary>
    /// Lo que viaja al overlay cuando se sortea.
    ///
    /// <para>A diferencia del modo Premios, el payload lleva <b>la lista completa de
    /// gajos que hay que dibujar</b>. En Premios el overlay ya tiene los gajos (son
    /// configuración y no cambian entre giros) y basta con mandarle el índice; acá el
    /// pool cambia con cada inscripción, así que mandar solo el índice reviviría el
    /// mismo bug de gajos desalineados de la Fase 1, pero peor: el overlay podría
    /// tener una lista de hace treinta segundos. Con la lista dentro del payload no
    /// hay dos fuentes que puedan discrepar.</para>
    /// </summary>
    public class WheelRaffleDrawPayload
    {
        [JsonPropertyName("slug")]          public string Slug { get; init; } = string.Empty;
        [JsonPropertyName("mode")]          public string Mode { get; init; } = WheelModes.Raffle;
        [JsonPropertyName("spinId")]        public long? SpinId { get; init; }
        [JsonPropertyName("dryRun")]        public bool DryRun { get; init; }

        /// <summary>Los gajos a dibujar, en orden. Ya vienen comprimidos si el pool era grande.</summary>
        [JsonPropertyName("segments")]      public List<RaffleSlice> Segments { get; init; } = new();

        [JsonPropertyName("segmentIndex")]  public int SegmentIndex { get; init; }
        [JsonPropertyName("segmentCount")]  public int SegmentCount { get; init; }
        [JsonPropertyName("label")]         public string Label { get; init; } = string.Empty;
        [JsonPropertyName("winner")]        public string Winner { get; init; } = string.Empty;

        /// <summary>Participantes reales del pool, que puede ser mayor que <c>segments</c>.</summary>
        [JsonPropertyName("poolSize")]      public int PoolSize { get; init; }

        /// <summary>Nº de ganador dentro de una tanda (1 de 3, 2 de 3…).</summary>
        [JsonPropertyName("drawIndex")]     public int DrawIndex { get; init; }
        [JsonPropertyName("drawTotal")]     public int DrawTotal { get; init; }
        [JsonPropertyName("trigger")]       public string Trigger { get; init; } = string.Empty;
    }

    /// <summary>Un gajo del sorteo: un participante, o el grupo de "los demás".</summary>
    public class RaffleSlice
    {
        [JsonPropertyName("label")]   public string Label { get; init; } = string.Empty;
        /// <summary>Cuántos participantes representa. &gt; 1 solo en el gajo agrupado.</summary>
        [JsonPropertyName("count")]   public int Count { get; init; } = 1;
        [JsonPropertyName("grouped")] public bool Grouped { get; init; }
    }

    /// <summary>
    /// Rueda de la Suerte — modo Sorteo (Fase 4).
    ///
    /// <para>Vive aparte de <see cref="WheelService"/> a propósito: comparte las
    /// tablas <c>wheels</c> y <c>wheel_spins</c> pero no comparte ni una regla. Una
    /// rueda de Premios cobra créditos y entrega premios; una de Sorteo no cobra nada,
    /// no entrega nada y su "gajo" es una persona. Meter las dos en la misma clase
    /// habría sido un <c>if (mode == ...)</c> en cada método.</para>
    ///
    /// <para>Ver <c>.dev/plans/RUEDA_DE_LA_SUERTE_PLAN.md</c>, sección 7.</para>
    /// </summary>
    public class WheelRaffleService
    {
        private readonly DecatronDbContext _db;
        private readonly OverlayNotificationService _overlays;
        private readonly WheelWalletService _wallets;
        private readonly ILogger<WheelRaffleService> _logger;

        /// <summary>
        /// Cuántos gajos como máximo dibuja la rueda. Con más, los nombres dejan de
        /// leerse y la rueda se vuelve una tarta de rayas. El pool real sigue entero:
        /// lo que se comprime es el dibujo, nunca el sorteo (sección 7.3 del plan).
        /// </summary>
        public const int MaxGajosVisibles = 24;

        public WheelRaffleService(
            DecatronDbContext db,
            OverlayNotificationService overlays,
            WheelWalletService wallets,
            ILogger<WheelRaffleService> logger)
        {
            _db = db;
            _overlays = overlays;
            _wallets = wallets;
            _logger = logger;
        }

        // ====================================================================
        // CONFIGURACIÓN
        // ====================================================================

        /// <summary>
        /// La config del sorteo de una rueda, creándola con los defaults si es la
        /// primera vez. Una rueda de Sorteo sin config no puede hacer nada, así que
        /// no tiene sentido devolver null y obligar a cada llamador a decidir.
        /// </summary>
        public async Task<WheelRaffleConfig> GetOrCreateConfigAsync(int wheelId)
        {
            var cfg = await _db.WheelRaffleConfigs.FirstOrDefaultAsync(c => c.WheelId == wheelId);
            if (cfg != null) return cfg;

            cfg = new WheelRaffleConfig { WheelId = wheelId };
            _db.WheelRaffleConfigs.Add(cfg);
            await _db.SaveChangesAsync();
            return cfg;
        }

        // ====================================================================
        // VENTANA DE INSCRIPCIÓN
        // ====================================================================

        public async Task<WheelRaffleConfig> AbrirAsync(int wheelId)
        {
            var cfg = await GetOrCreateConfigAsync(wheelId);

            cfg.IsOpen = true;
            cfg.WindowOpenedAt = DateTime.UtcNow;
            cfg.WindowClosesAt = cfg.WindowMode == "timed" && cfg.WindowSeconds > 0
                ? DateTime.UtcNow.AddSeconds(cfg.WindowSeconds!.Value)
                : null;
            cfg.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return cfg;
        }

        public async Task<WheelRaffleConfig> CerrarAsync(int wheelId)
        {
            var cfg = await GetOrCreateConfigAsync(wheelId);

            cfg.IsOpen = false;
            cfg.WindowClosesAt = null;
            cfg.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return cfg;
        }

        // ====================================================================
        // INSCRIPCIÓN
        // ====================================================================

        public enum JoinResult
        {
            Ok,
            YaTeniasElMaximo,
            Cerrado,
            NoEsSorteo,
            SoloSubs,
            SoloFollowers,
            PocoWatchtime,
            SinCreditos,
        }

        public class JoinOutcome
        {
            public JoinResult Result { get; init; }
            public int Entries { get; init; }
            public decimal Weight { get; init; }
            public int PoolSize { get; init; }
            public int Balance { get; init; }
            public int Cost { get; init; }
            public int MinutosQueFaltan { get; init; }
        }

        /// <summary>
        /// Mete a un espectador en el pool, o le suma un boleto si ya estaba.
        ///
        /// <para><paramref name="esSub"/> y <paramref name="esFollower"/> llegan de
        /// afuera porque el comando de chat los sabe por los badges del mensaje y la
        /// base no siempre: un sub recién hecho aparece en el badge antes que en
        /// ninguna tabla. Cuando el llamador no los sabe (alta manual desde el panel)
        /// manda null y se resuelven contra la base.</para>
        /// </summary>
        public async Task<JoinOutcome> JoinAsync(
            long channelId,
            int wheelId,
            string viewerLogin,
            bool? esSub = null,
            bool? esFollower = null,
            string? viewerTwitchId = null)
        {
            var viewer = viewerLogin.ToLowerInvariant().TrimStart('@');

            var wheel = await _db.Wheels.FirstOrDefaultAsync(w => w.Id == wheelId && w.ChannelId == channelId);
            if (wheel == null || wheel.Mode != WheelModes.Raffle)
                return new JoinOutcome { Result = JoinResult.NoEsSorteo };

            var cfg = await GetOrCreateConfigAsync(wheelId);
            if (!wheel.IsEnabled || !cfg.AceptaInscripciones)
                return new JoinOutcome { Result = JoinResult.Cerrado };

            var reqs = LeerJson(cfg.Requirements);

            // --- requisitos -------------------------------------------------
            var sub = esSub ?? false;
            if (LeerBool(reqs, "subsOnly") && !sub)
                return new JoinOutcome { Result = JoinResult.SoloSubs };

            if (LeerBool(reqs, "followersOnly"))
            {
                var sigue = esFollower ?? await EsFollowerAsync(channelId, viewerTwitchId);
                if (!sigue) return new JoinOutcome { Result = JoinResult.SoloFollowers };
            }

            var minutosMinimos = LeerInt(reqs, "minWatchtimeMinutes", 0);
            var minutos = minutosMinimos > 0 || TieneFuente(cfg, "watchtime")
                ? await MinutosDeWatchtimeAsync(channelId, viewer)
                : 0;

            if (minutosMinimos > 0 && minutos < minutosMinimos)
                return new JoinOutcome
                {
                    Result = JoinResult.PocoWatchtime,
                    MinutosQueFaltan = minutosMinimos - minutos,
                };

            // --- boletos ----------------------------------------------------
            var entrada = await _db.WheelRaffleEntries
                .FirstOrDefaultAsync(e => e.WheelId == wheelId && e.ViewerLogin == viewer);

            var boletosActuales = entrada?.Entries ?? 0;
            if (boletosActuales >= cfg.MaxEntriesPerViewer)
                return new JoinOutcome
                {
                    Result = JoinResult.YaTeniasElMaximo,
                    Entries = boletosActuales,
                    Weight = entrada?.Weight ?? 0,
                    PoolSize = await TamanoDelPoolAsync(wheelId),
                };

            // --- costo ------------------------------------------------------
            // Se cobra ANTES de escribir la entrada: si no alcanza, el pool no se toca.
            if (cfg.EntryCostCredits > 0)
            {
                var cobrado = await _wallets.TryChargeAsync(channelId, viewer, cfg.EntryCostCredits);
                if (!cobrado)
                    return new JoinOutcome
                    {
                        Result = JoinResult.SinCreditos,
                        Balance = await _wallets.GetBalanceAsync(channelId, viewer),
                        Cost = cfg.EntryCostCredits,
                    };
            }

            var esNueva = entrada == null;
            if (entrada == null)
            {
                entrada = new WheelRaffleEntry
                {
                    WheelId = wheelId,
                    ViewerLogin = viewer,
                    ViewerUserId = await BuscarUserIdAsync(viewer),
                    Entries = 0,
                };
                _db.WheelRaffleEntries.Add(entrada);
            }

            entrada.Entries += 1;

            var (peso, desglose) = await CalcularPesoAsync(cfg, entrada, channelId, viewer, sub, minutos);
            entrada.Weight = peso;
            entrada.WeightBreakdown = desglose;

            await _db.SaveChangesAsync();

            // Solo un inscrito nuevo cambia lo que se dibuja; un boleto extra de alguien
            // que ya estaba pesa distinto pero ocupa el mismo gajo.
            if (esNueva) await AvisarOverlayAsync(wheelId);

            return new JoinOutcome
            {
                Result = JoinResult.Ok,
                Entries = entrada.Entries,
                Weight = entrada.Weight,
                PoolSize = await TamanoDelPoolAsync(wheelId),
                Balance = cfg.EntryCostCredits > 0 ? await _wallets.GetBalanceAsync(channelId, viewer) : 0,
                Cost = cfg.EntryCostCredits,
            };
        }

        // ====================================================================
        // PESOS
        // ====================================================================

        /// <summary>
        /// El peso de una entrada: arranca en 1 (o en los boletos que tenga) y se
        /// multiplica por lo que el streamer haya activado.
        ///
        /// <para>Se guarda el desglose completo porque el peso solo es un número que
        /// nadie puede discutir: con el desglose el streamer puede explicarle a un
        /// espectador por qué otro tenía más probabilidad, que es la única forma de
        /// que un sorteo con pesos no parezca amañado.</para>
        /// </summary>
        private async Task<(decimal Peso, string Desglose)> CalcularPesoAsync(
            WheelRaffleConfig cfg, WheelRaffleEntry entrada,
            long channelId, string viewer, bool esSub, int minutos)
        {
            var fuentes = LeerJson(cfg.WeightSources);
            var desglose = new Dictionary<string, object?>();

            // Los boletos son la base: dos boletos valen el doble que uno.
            decimal peso = entrada.Entries;
            desglose["boletos"] = entrada.Entries;

            // El multiplicador manual del mod sobrevive a los recálculos: vive en el
            // desglose anterior y se vuelve a aplicar acá.
            var manual = LeerDecimal(LeerJson(entrada.WeightBreakdown), "manual", 1m);
            if (manual != 1m)
            {
                peso *= manual;
                desglose["manual"] = manual;
            }

            if (Habilitada(fuentes, "watchtime"))
            {
                var porPunto = Math.Max(1, LeerInt(SubObjeto(fuentes, "watchtime"), "minutesPerPoint", 60));
                var tope = Math.Max(1m, LeerDecimal(SubObjeto(fuentes, "watchtime"), "max", 5m));
                var mult = Math.Min(1m + minutos / porPunto, tope);
                if (mult > 1m)
                {
                    peso *= mult;
                    desglose["watchtime"] = new { minutos, multiplicador = mult };
                }
            }

            // El estado de sub se guarda SIEMPRE, esté o no encendido el multiplicador.
            // Es un hecho del momento en que se inscribió, no un resultado del cálculo:
            // el streamer configura los pesos DESPUÉS de que la gente entró, y sin este
            // dato el recálculo no tendría cómo saber quién era sub.
            desglose["esSub"] = esSub;

            if (Habilitada(fuentes, "subscriber") && esSub)
            {
                var mult = LeerDecimal(SubObjeto(fuentes, "subscriber"), "multiplier", 2m);
                peso *= mult;
                desglose["sub"] = mult;
            }

            if (Habilitada(fuentes, "supporterTier"))
            {
                // Es el tier de supporter DE DECATRON (free/supporter/premium/fundador),
                // no el tier de sub de Twitch: el badge del chat trae los meses de sub,
                // no el tier, así que ese dato no existe por este camino.
                var tier = await TierDeSupporterAsync(entrada.ViewerUserId);
                var mult = LeerDecimal(SubObjeto(fuentes, "supporterTier"), tier, 1m);
                if (mult != 1m)
                {
                    peso *= mult;
                    desglose["tierSupporter"] = new { tier, multiplicador = mult };
                }
            }

            if (Habilitada(fuentes, "coins") && entrada.ViewerUserId != null)
            {
                // total_spent es global de la cuenta de Decatron, no por canal: la
                // economía de coins no lleva un gastado por canal. Se documenta acá
                // para que nadie lo lea como "lo que gastó en este canal".
                var gastados = await _db.UserCoins
                    .Where(c => c.UserId == entrada.ViewerUserId)
                    .Select(c => c.TotalSpent)
                    .FirstOrDefaultAsync();

                var porPunto = Math.Max(1, LeerInt(SubObjeto(fuentes, "coins"), "coinsPerPoint", 1000));
                var tope = Math.Max(1m, LeerDecimal(SubObjeto(fuentes, "coins"), "max", 5m));
                var mult = Math.Min(1m + (decimal)gastados / porPunto, tope);
                if (mult > 1m)
                {
                    peso *= mult;
                    desglose["coins"] = new { gastados, multiplicador = mult };
                }
            }

            // La columna es DECIMAL(7,3): sin redondear, un peso con más decimales
            // hace fallar el INSERT entero y el espectador se queda fuera del pool.
            peso = Math.Round(Math.Min(peso, 9999.999m), 3);
            desglose["total"] = peso;

            return (peso, JsonSerializer.Serialize(desglose));
        }

        /// <summary>
        /// Vuelve a calcular el peso de todo el pool. Hace falta porque los
        /// multiplicadores se configuran <b>después</b> de que la gente ya se
        /// inscribió: sin esto, cambiar un peso en el panel no afectaría a nadie
        /// que ya estuviera dentro.
        /// </summary>
        public async Task<int> RecalcularPesosAsync(long channelId, int wheelId)
        {
            var cfg = await GetOrCreateConfigAsync(wheelId);
            var entradas = await _db.WheelRaffleEntries.Where(e => e.WheelId == wheelId).ToListAsync();

            foreach (var e in entradas)
            {
                var minutos = TieneFuente(cfg, "watchtime")
                    ? await MinutosDeWatchtimeAsync(channelId, e.ViewerLogin)
                    : 0;

                // El estado de sub no se puede saber desde acá (no hay badge fuera del
                // chat), así que se lee el hecho que se guardó al inscribirse.
                var esSub = LeerBool(LeerJson(e.WeightBreakdown), "esSub");

                var (peso, desglose) = await CalcularPesoAsync(cfg, e, channelId, e.ViewerLogin, esSub, minutos);
                e.Weight = peso;
                e.WeightBreakdown = desglose;
            }

            await _db.SaveChangesAsync();
            return entradas.Count;
        }

        /// <summary>Multiplicador manual de un mod sobre un participante concreto.</summary>
        public async Task<bool> SetMultiplicadorManualAsync(int wheelId, string viewerLogin, decimal multiplicador)
        {
            var viewer = viewerLogin.ToLowerInvariant().TrimStart('@');
            var entrada = await _db.WheelRaffleEntries
                .FirstOrDefaultAsync(e => e.WheelId == wheelId && e.ViewerLogin == viewer);
            if (entrada == null) return false;

            var desglose = LeerJson(entrada.WeightBreakdown);
            var anterior = LeerDecimal(desglose, "manual", 1m);

            // El peso guardado ya trae el multiplicador anterior aplicado; se deshace
            // antes de poner el nuevo para que dos cambios seguidos no se acumulen.
            var baseSinManual = anterior == 0 ? entrada.Weight : entrada.Weight / anterior;
            entrada.Weight = Math.Round(Math.Min(baseSinManual * multiplicador, 9999.999m), 3);

            // El desglose se reescribe como objetos y no como JsonElement porque los
            // JsonElement leídos son de solo lectura: hay que armar el diccionario nuevo.
            var salida = desglose.ToDictionary(kv => kv.Key, kv => (object?)kv.Value);
            salida["manual"] = multiplicador;
            salida["total"] = entrada.Weight;
            entrada.WeightBreakdown = JsonSerializer.Serialize(salida);

            await _db.SaveChangesAsync();
            return true;
        }

        // ====================================================================
        // POOL
        // ====================================================================

        /// <summary>
        /// Avisa al overlay que el pool cambió, para que la rueda en reposo muestre a
        /// los inscritos de ahora y no a los de cuando se abrió la escena.
        /// </summary>
        private async Task AvisarOverlayAsync(int wheelId)
        {
            try
            {
                var destino = await _db.Wheels.AsNoTracking()
                    .Where(w => w.Id == wheelId)
                    .Join(_db.Users, w => w.ChannelId, u => u.Id, (w, u) => new { w.Slug, u.Login })
                    .FirstOrDefaultAsync();
                if (destino != null)
                    await _overlays.NotifyWheelChangedAsync(destino.Login.ToLowerInvariant(), destino.Slug);
            }
            catch (Exception ex)
            {
                // Un aviso que no sale no puede tumbar una inscripción ya guardada.
                _logger.LogWarning(ex, "🎡 [Sorteo] No se pudo avisar al overlay de la rueda {Id}", wheelId);
            }
        }

        public async Task<List<WheelRaffleEntry>> GetEntriesAsync(int wheelId, bool soloEnJuego = false)
        {
            var q = _db.WheelRaffleEntries.AsNoTracking().Where(e => e.WheelId == wheelId);
            if (soloEnJuego) q = q.Where(e => !e.HasWon);

            return await q.OrderByDescending(e => e.Weight).ThenBy(e => e.JoinedAt).ToListAsync();
        }

        public async Task<bool> QuitarAsync(int wheelId, string viewerLogin)
        {
            var viewer = viewerLogin.ToLowerInvariant().TrimStart('@');
            var entrada = await _db.WheelRaffleEntries
                .FirstOrDefaultAsync(e => e.WheelId == wheelId && e.ViewerLogin == viewer);
            if (entrada == null) return false;

            _db.WheelRaffleEntries.Remove(entrada);
            await _db.SaveChangesAsync();
            await AvisarOverlayAsync(wheelId);
            return true;
        }

        /// <summary>Vacía el pool entero. Lo llama el mod y también el fin de stream.</summary>
        public async Task<int> LimpiarPoolAsync(int wheelId)
        {
            var borradas = await _db.WheelRaffleEntries.Where(e => e.WheelId == wheelId).ExecuteDeleteAsync();

            // ExecuteDelete no toca el rastreador de EF; sin esto, un lector del mismo
            // scope seguiría viendo el pool viejo. Es el mismo tropiezo de la Fase 2.
            foreach (var seguida in _db.ChangeTracker.Entries<WheelRaffleEntry>().ToList())
                seguida.State = EntityState.Detached;

            if (borradas > 0) await AvisarOverlayAsync(wheelId);
            return borradas;
        }

        /// <summary>
        /// Limpia los pools de las ruedas del canal que lo pidieron. Lo llama
        /// <c>stream.offline</c>: es el único momento en que "fin de stream" significa algo.
        /// </summary>
        public async Task LimpiarPorFinDeStreamAsync(long channelId)
        {
            var ruedas = await _db.Wheels
                .Where(w => w.ChannelId == channelId && w.Mode == WheelModes.Raffle)
                .Select(w => w.Id)
                .ToListAsync();
            if (ruedas.Count == 0) return;

            var aLimpiar = await _db.WheelRaffleConfigs
                .Where(c => ruedas.Contains(c.WheelId) && c.ClearOnStreamEnd)
                .Select(c => c.WheelId)
                .ToListAsync();

            foreach (var wheelId in aLimpiar)
            {
                await LimpiarPoolAsync(wheelId);
                _logger.LogInformation("🎡 [Sorteo] Pool de la rueda {Id} limpiado por fin de stream", wheelId);
            }
        }

        // ====================================================================
        // SORTEO
        // ====================================================================

        public enum DrawResult { Ok, NoEsSorteo, PoolVacio, PoolInsuficiente }

        public class DrawOutcome
        {
            public DrawResult Result { get; init; }
            public List<string> Ganadores { get; init; } = new();
            public int PoolSize { get; init; }
        }

        /// <summary>
        /// Sortea. Según <c>draw_mode</c>: uno solo, N de una tanda, o uno y sigue.
        ///
        /// <para>Los tres modos hacen lo mismo por dentro — sacar un ganador del pool
        /// por peso — y se diferencian en cuántas veces se repite y en si el ganador
        /// sale del pool. Cada ganador es un giro propio en pantalla y una fila propia
        /// en <c>wheel_spins</c>, porque un sorteo de tres ganadores que se registra
        /// como un solo evento no se puede auditar después.</para>
        /// </summary>
        public async Task<DrawOutcome> SortearAsync(long channelId, string channelLogin, int wheelId, string trigger)
        {
            var wheel = await _db.Wheels.FirstOrDefaultAsync(w => w.Id == wheelId && w.ChannelId == channelId);
            if (wheel == null || wheel.Mode != WheelModes.Raffle)
                return new DrawOutcome { Result = DrawResult.NoEsSorteo };

            var cfg = await GetOrCreateConfigAsync(wheelId);

            var pool = await _db.WheelRaffleEntries
                .Where(e => e.WheelId == wheelId && !e.HasWon)
                .OrderBy(e => e.JoinedAt).ThenBy(e => e.Id)
                .ToListAsync();

            // Un sorteo con una sola persona no es un sorteo; el plan lo bloquea con
            // aviso claro en vez de dejar que el streamer "sortee" a un ganador único.
            if (pool.Count == 0) return new DrawOutcome { Result = DrawResult.PoolVacio };
            if (pool.Count < 2) return new DrawOutcome { Result = DrawResult.PoolInsuficiente, PoolSize = pool.Count };

            var cuantos = cfg.DrawMode switch
            {
                "single" => 1,
                _        => Math.Max(1, cfg.WinnersCount),
            };
            cuantos = Math.Min(cuantos, pool.Count);

            var ganadores = new List<string>();

            for (var i = 0; i < cuantos; i++)
            {
                var candidatos = pool.Where(e => !e.HasWon).ToList();
                if (candidatos.Count == 0) break;

                var ganador = PickWeighted(candidatos);

                // El pool que se dibuja se arma ANTES de marcar al ganador, para que
                // el espectador vea la rueda con su propio nombre todavía dentro.
                var gajos = ArmarGajos(candidatos, ganador, out var indice);

                var spin = new WheelSpin
                {
                    WheelId = wheel.Id,
                    Mode = WheelModes.Raffle,
                    SpinnerLogin = null,
                    TriggerSource = trigger,
                    ResultSegmentId = null,
                    ResultPrize = null,
                    DeliveryStatus = "delivered",
                    RaffleWinner = JsonSerializer.Serialize(new
                    {
                        login = ganador.ViewerLogin,
                        weight = ganador.Weight,
                        entries = ganador.Entries,
                        poolSize = candidatos.Count,
                        drawIndex = i + 1,
                        drawTotal = cuantos,
                    }),
                    CreatedAt = DateTime.UtcNow,
                };
                _db.WheelSpins.Add(spin);

                // remove_and_continue saca al ganador sí o sí: es lo que significa.
                // En los otros modos manda remove_winner_from_pool.
                if (cfg.DrawMode == "remove_and_continue" || cfg.RemoveWinnerFromPool)
                {
                    ganador.HasWon = true;
                    ganador.WonAt = DateTime.UtcNow;
                }
                else if (cuantos > 1)
                {
                    // Sin sacarlo del pool, una tanda de N lo elegiría N veces. Se marca
                    // solo para esta tanda y se deshace al terminar.
                    ganador.HasWon = true;
                    ganador.WonAt = DateTime.UtcNow;
                }

                await _db.SaveChangesAsync();

                await _overlays.SendWheelSpinAsync(channelLogin, new WheelRaffleDrawPayload
                {
                    Slug = wheel.Slug,
                    SpinId = spin.Id,
                    Segments = gajos,
                    SegmentIndex = indice,
                    SegmentCount = gajos.Count,
                    Label = ganador.ViewerLogin,
                    Winner = ganador.ViewerLogin,
                    PoolSize = candidatos.Count,
                    DrawIndex = i + 1,
                    DrawTotal = cuantos,
                    Trigger = trigger,
                });

                ganadores.Add(ganador.ViewerLogin);
            }

            // Si el streamer NO quería sacar a los ganadores del pool, se deshace la
            // marca que se usó para no repetirlos dentro de esta misma tanda.
            if (cfg.DrawMode != "remove_and_continue" && !cfg.RemoveWinnerFromPool)
            {
                foreach (var g in pool.Where(e => ganadores.Contains(e.ViewerLogin)))
                {
                    g.HasWon = false;
                    g.WonAt = null;
                }
                await _db.SaveChangesAsync();
            }

            // Los ganadores que salieron del pool no pueden quedar dibujados en reposo.
            // El overlay aplica la recarga cuando termina de mostrar la tanda, no en
            // mitad de un giro.
            await AvisarOverlayAsync(wheelId);

            _logger.LogInformation("🎡 [Sorteo] '{Rueda}' sorteó {Cuantos} ganador(es) de {Pool}: {Ganadores}",
                wheel.Name, ganadores.Count, pool.Count, string.Join(", ", ganadores));

            return new DrawOutcome
            {
                Result = DrawResult.Ok,
                Ganadores = ganadores,
                PoolSize = pool.Count,
            };
        }

        /// <summary>
        /// Los gajos que se dibujan y la posición del ganador entre ellos.
        ///
        /// <para>Con un pool grande la rueda muestra <see cref="MaxGajosVisibles"/>
        /// gajos: el ganador siempre, y el resto son los primeros del pool más un gajo
        /// agrupado con los que no entraron. El sorteo ya está resuelto cuando esto
        /// corre, así que comprimir el dibujo <b>no</b> cambia la probabilidad de
        /// nadie — solo lo que se ve.</para>
        /// </summary>
        private static List<RaffleSlice> ArmarGajos(
            List<WheelRaffleEntry> pool, WheelRaffleEntry ganador, out int indiceGanador)
        {
            if (pool.Count <= MaxGajosVisibles)
            {
                var todos = pool.Select(e => new RaffleSlice { Label = e.ViewerLogin }).ToList();
                indiceGanador = pool.FindIndex(e => e.Id == ganador.Id);
                return todos;
            }

            // Se reservan dos huecos: uno para el ganador y otro para el agrupado.
            var visibles = pool.Where(e => e.Id != ganador.Id).Take(MaxGajosVisibles - 2).ToList();
            var restantes = pool.Count - visibles.Count - 1;

            var gajos = visibles.Select(e => new RaffleSlice { Label = e.ViewerLogin }).ToList();

            // El ganador va en medio y no al final: pegado al gajo agrupado se leería
            // como si hubiera salido "del montón".
            indiceGanador = gajos.Count / 2;
            gajos.Insert(indiceGanador, new RaffleSlice { Label = ganador.ViewerLogin });

            if (restantes > 0)
                gajos.Add(new RaffleSlice { Label = $"+{restantes}", Count = restantes, Grouped = true });

            return gajos;
        }

        /// <summary>
        /// Sorteo por peso con <see cref="RandomNumberGenerator"/> y no con
        /// <c>Random</c>, por lo mismo que el modo Premios: acá se reparten cosas de
        /// valor real y un PRNG predecible es una invitación.
        /// </summary>
        private static WheelRaffleEntry PickWeighted(List<WheelRaffleEntry> entradas)
        {
            var total = entradas.Sum(e => e.Weight);

            // Todos en cero es un reparto uniforme, no un error (sección 13 del plan).
            if (total <= 0) return entradas[RandomNumberGenerator.GetInt32(entradas.Count)];

            Span<byte> buffer = stackalloc byte[8];
            RandomNumberGenerator.Fill(buffer);
            var fraccion = (decimal)(BitConverter.ToUInt64(buffer) / (double)ulong.MaxValue);
            var objetivo = fraccion * total;

            decimal acumulado = 0;
            foreach (var e in entradas)
            {
                acumulado += e.Weight;
                if (objetivo < acumulado) return e;
            }

            return entradas[^1];
        }

        // ====================================================================
        // AUXILIARES
        // ====================================================================

        public async Task<int> TamanoDelPoolAsync(int wheelId) =>
            await _db.WheelRaffleEntries.CountAsync(e => e.WheelId == wheelId && !e.HasWon);

        private async Task<long?> BuscarUserIdAsync(string login) =>
            await _db.Users.Where(u => u.Login == login).Select(u => (long?)u.Id).FirstOrDefaultAsync();

        private async Task<bool> EsFollowerAsync(long channelId, string? viewerTwitchId)
        {
            if (string.IsNullOrWhiteSpace(viewerTwitchId)) return false;

            var broadcasterId = await _db.Users.Where(u => u.Id == channelId)
                .Select(u => u.TwitchId).FirstOrDefaultAsync();
            if (string.IsNullOrWhiteSpace(broadcasterId)) return false;

            // IsFollowing == 0 es la convención de la tabla (la usa GiveawayCommand):
            // 0 significa que sigue. No es un bool invertido por accidente.
            return await _db.ChannelFollowers.AsNoTracking()
                .AnyAsync(f => f.BroadcasterId == broadcasterId && f.UserId == viewerTwitchId && f.IsFollowing == 0);
        }

        private async Task<int> MinutosDeWatchtimeAsync(long channelId, string viewer)
        {
            var channelTwitchId = await _db.Users.Where(u => u.Id == channelId)
                .Select(u => u.TwitchId).FirstOrDefaultAsync();
            if (string.IsNullOrWhiteSpace(channelTwitchId)) return 0;

            return await _db.StreamWatchTimes.AsNoTracking()
                .Where(w => w.ChannelId == channelTwitchId && w.Username.ToLower() == viewer)
                .SumAsync(w => (int?)w.TotalMinutes) ?? 0;
        }

        private async Task<string> TierDeSupporterAsync(long? userId)
        {
            if (userId == null) return "free";

            var tier = await _db.UserSubscriptionTiers.AsNoTracking()
                .Where(t => t.UserId == userId
                         && (t.TierExpiresAt == null || t.TierExpiresAt > DateTimeOffset.UtcNow))
                .OrderByDescending(t => t.TierStartedAt)
                .Select(t => t.Tier)
                .FirstOrDefaultAsync();

            return string.IsNullOrWhiteSpace(tier) ? "free" : tier;
        }

        private static bool TieneFuente(WheelRaffleConfig cfg, string nombre) =>
            Habilitada(LeerJson(cfg.WeightSources), nombre);

        // --- lectura defensiva de los jsonb de configuración ----------------
        // Son campos que edita el streamer desde el panel: una clave que falta o que
        // vino con otro tipo no puede tirar abajo una inscripción.

        private static Dictionary<string, JsonElement> LeerJson(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return new();
            try
            {
                return JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json) ?? new();
            }
            catch { return new(); }
        }

        private static Dictionary<string, JsonElement> SubObjeto(Dictionary<string, JsonElement> raiz, string clave)
        {
            if (!raiz.TryGetValue(clave, out var v) || v.ValueKind != JsonValueKind.Object) return new();
            try
            {
                return JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(v.GetRawText()) ?? new();
            }
            catch { return new(); }
        }

        private static bool Habilitada(Dictionary<string, JsonElement> raiz, string clave) =>
            LeerBool(SubObjeto(raiz, clave), "enabled");

        private static bool LeerBool(Dictionary<string, JsonElement> o, string clave) =>
            o.TryGetValue(clave, out var v) && v.ValueKind == JsonValueKind.True;

        private static int LeerInt(Dictionary<string, JsonElement> o, string clave, int porDefecto)
        {
            if (!o.TryGetValue(clave, out var v)) return porDefecto;
            return v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var n) ? n : porDefecto;
        }

        private static decimal LeerDecimal(Dictionary<string, JsonElement> o, string clave, decimal porDefecto)
        {
            if (!o.TryGetValue(clave, out var v)) return porDefecto;
            return v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var n) ? n : porDefecto;
        }
    }
}
