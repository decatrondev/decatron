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
    /// <summary>
    /// Lo que viaja al overlay cuando la rueda gira. Es un tipo real y no anónimo
    /// porque el servicio necesita leer sus campos: con un anónimo habría que hacerlo
    /// por reflexión, y un renombre lo rompería en silencio.
    /// </summary>
    public class WheelSpinPayload
    {
        // Los nombres JSON van fijados a mano y no dependen de la convención global:
        // este objeto sale por dos caminos distintos (SignalR al overlay y MVC al
        // panel) y el overlay lee las claves en minúscula. Un cambio de política de
        // serialización en cualquiera de los dos lo rompería en silencio.
        [JsonPropertyName("slug")]         public string Slug { get; init; } = string.Empty;
        [JsonPropertyName("spinId")]       public long? SpinId { get; init; }
        [JsonPropertyName("dryRun")]       public bool DryRun { get; init; }
        [JsonPropertyName("segmentId")]    public int SegmentId { get; init; }

        /// <summary>Posición del gajo en la MISMA lista que dibuja el overlay.</summary>
        [JsonPropertyName("segmentIndex")] public int SegmentIndex { get; init; }
        [JsonPropertyName("segmentCount")] public int SegmentCount { get; init; }

        [JsonPropertyName("label")]        public string Label { get; init; } = string.Empty;
        [JsonPropertyName("color")]        public string? Color { get; init; }
        [JsonPropertyName("icon")]         public string? Icon { get; init; }
        [JsonPropertyName("prize")]        public object? Prize { get; init; }
        [JsonPropertyName("spinner")]      public string? Spinner { get; init; }
        [JsonPropertyName("trigger")]      public string Trigger { get; init; } = string.Empty;

        /// <summary>
        /// Los gajos sobre los que se calculó <c>segmentIndex</c>, en el mismo orden.
        /// El overlay los adopta antes de girar: si el streamer editó los gajos y la
        /// fuente de OBS todavía tenía la lista vieja, la aguja pararía en el gajo de
        /// al lado del que anuncia la tarjeta. Con la lista dentro del evento no hay
        /// dos fuentes de verdad, igual que en el modo Sorteo.
        /// </summary>
        [JsonPropertyName("wheelSegments")] public List<WheelOverlaySegment> WheelSegments { get; init; } = new();

        /// <summary>El premio sin parsear, para el handler de entrega. No viaja al overlay.</summary>
        [JsonIgnore]
        public string? PrizeJson { get; init; }
    }

    /// <summary>Un gajo tal como lo dibuja el overlay: nada de pesos, stock ni premio.</summary>
    public class WheelOverlaySegment
    {
        [JsonPropertyName("id")]    public int Id { get; init; }
        [JsonPropertyName("label")] public string Label { get; init; } = string.Empty;
        [JsonPropertyName("color")] public string? Color { get; init; }
        [JsonPropertyName("icon")]  public string? Icon { get; init; }
    }

    /// <summary>
    /// Rueda de la Suerte — Fase 1 (modo Premios).
    ///
    /// <para>Ver <c>.dev/plans/RUEDA_DE_LA_SUERTE_PLAN.md</c>.</para>
    /// </summary>
    public class WheelService
    {
        private readonly DecatronDbContext _db;
        private readonly OverlayNotificationService _overlays;
        private readonly WheelWalletService _wallets;
        private readonly CoinService _coins;
        private readonly TwitchApiService _twitch;
        private readonly Decatron.Core.Interfaces.ISoundAlertTriggerService _soundAlerts;
        private readonly Decatron.Core.Interfaces.IMessageSender _chat;
        private readonly ILogger<WheelService> _logger;

        private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

        public WheelService(
            DecatronDbContext db,
            OverlayNotificationService overlays,
            WheelWalletService wallets,
            CoinService coins,
            TwitchApiService twitch,
            Decatron.Core.Interfaces.ISoundAlertTriggerService soundAlerts,
            Decatron.Core.Interfaces.IMessageSender chat,
            ILogger<WheelService> logger)
        {
            _db = db;
            _overlays = overlays;
            _wallets = wallets;
            _coins = coins;
            _twitch = twitch;
            _soundAlerts = soundAlerts;
            _chat = chat;
            _logger = logger;
        }

        // ====================================================================
        // LECTURA
        // ====================================================================

        public async Task<List<Wheel>> GetWheelsAsync(long channelId) =>
            await _db.Wheels.AsNoTracking()
                .Where(w => w.ChannelId == channelId)
                .OrderBy(w => w.Id)
                .ToListAsync();

        public async Task<Wheel?> GetWheelAsync(long channelId, int wheelId) =>
            await _db.Wheels.FirstOrDefaultAsync(w => w.Id == wheelId && w.ChannelId == channelId);

        public async Task<List<WheelSegment>> GetSegmentsAsync(int wheelId) =>
            await _db.WheelSegments.AsNoTracking()
                .Where(s => s.WheelId == wheelId)
                .OrderBy(s => s.DisplayOrder).ThenBy(s => s.Id)
                .ToListAsync();

        /// <summary>
        /// Lo que necesita el overlay para dibujarse: la rueda y sus gajos visibles.
        /// Va sin autenticación, así que devuelve solo lo que se ve en pantalla —
        /// nada de pesos, stock ni payload de premios.
        /// </summary>
        public async Task<object?> GetOverlayDataAsync(string channelLogin, string slug)
        {
            var channelId = await ChannelResolver.ResolveUserIdAsync(_db, channelLogin);
            if (channelId == null) return null;

            var wheel = await _db.Wheels.AsNoTracking()
                .FirstOrDefaultAsync(w => w.ChannelId == channelId && w.Slug == slug && w.IsEnabled);
            if (wheel == null) return null;

            // En modo Sorteo los "gajos" son los inscritos, no configuración. Se
            // devuelven para que la rueda se vea llena en reposo mientras la gente
            // entra; el sorteo en sí manda su propia lista en el payload, que es la
            // que manda (ver WheelRaffleDrawPayload).
            var segments = wheel.Mode == WheelModes.Raffle
                ? await _db.WheelRaffleEntries.AsNoTracking()
                    .Where(e => e.WheelId == wheel.Id && !e.HasWon)
                    .OrderBy(e => e.JoinedAt).ThenBy(e => e.Id)
                    .Take(WheelRaffleService.MaxGajosVisibles)
                    .Select(e => new { id = e.Id, label = e.ViewerLogin, color = (string?)null, icon = (string?)null })
                    .ToListAsync()
                : await _db.WheelSegments.AsNoTracking()
                    .Where(s => s.WheelId == wheel.Id && s.IsEnabled)
                    .OrderBy(s => s.DisplayOrder).ThenBy(s => s.Id)
                    .Select(s => new { id = s.Id, label = s.Label, color = s.Color, icon = s.Icon })
                    .ToListAsync();

            return new
            {
                wheel = new
                {
                    id = wheel.Id,
                    slug = wheel.Slug,
                    name = wheel.Name,
                    mode = wheel.Mode,
                    creditLabel = wheel.CreditLabel,
                    visual = ParseJson(wheel.VisualConfig),
                    announce = ParseJson(wheel.AnnounceConfig)
                },
                segments
            };
        }

        // ====================================================================
        // ESCRITURA
        // ====================================================================

        public async Task<Wheel> CreateWheelAsync(long channelId, string name, string mode, string? slug)
        {
            if (mode != WheelModes.Prizes && mode != WheelModes.Raffle)
                throw new ArgumentException("Modo inválido", nameof(mode));

            var baseSlug = Slugify(string.IsNullOrWhiteSpace(slug) ? name : slug!);
            var finalSlug = baseSlug;
            var n = 2;
            while (await _db.Wheels.AnyAsync(w => w.ChannelId == channelId && w.Slug == finalSlug))
                finalSlug = $"{baseSlug}-{n++}";

            var wheel = new Wheel
            {
                ChannelId = channelId,
                Name = name.Trim(),
                Mode = mode,
                Slug = finalSlug,
                // Las ruedas nuevas solo aparecen en OBS cuando giran. Las que ya
                // existían no traen la clave y siguen siempre visibles, como las dejó
                // su streamer: cambiarles el comportamiento sin pedirlo haría
                // desaparecer una rueda de una escena que ya estaba armada.
                VisualConfig = "{\"visibility\":\"spin\"}",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _db.Wheels.Add(wheel);
            await _db.SaveChangesAsync();
            return wheel;
        }

        /// <summary>
        /// Un slug libre para este canal, a partir del texto que se pida.
        /// </summary>
        private async Task<string> SlugLibreAsync(long channelId, string texto, int? exceptoWheelId = null)
        {
            var baseSlug = Slugify(texto);
            if (string.IsNullOrWhiteSpace(baseSlug)) baseSlug = "rueda";

            var final = baseSlug;
            var n = 2;
            while (await _db.Wheels.AnyAsync(w => w.ChannelId == channelId
                                               && w.Slug == final
                                               && (exceptoWheelId == null || w.Id != exceptoWheelId.Value)))
                final = $"{baseSlug}-{n++}";

            return final;
        }

        /// <summary>
        /// Cambia el slug de una rueda. Devuelve el que quedó, que puede no ser el
        /// pedido si ya estaba tomado.
        ///
        /// <para>Cambiarlo <b>rompe la URL que el streamer ya pegó en su escena de OBS</b>.
        /// Por eso es una acción aparte y explícita, y no un efecto de renombrar la
        /// rueda: el nombre es para él y el slug es para el overlay.</para>
        /// </summary>
        public async Task<string?> ChangeSlugAsync(long channelId, int wheelId, string nuevoSlug)
        {
            var wheel = await GetWheelAsync(channelId, wheelId);
            if (wheel == null) return null;

            var final = await SlugLibreAsync(channelId, nuevoSlug, wheelId);
            wheel.Slug = final;
            wheel.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return final;
        }

        /// <summary>
        /// Duplica una rueda con sus gajos, sus fuentes de créditos y sus mensajes.
        ///
        /// <para>La copia nace <b>apagada</b>: encenderla consume cupo del tier, y una
        /// duplicación que enciende sola podría dejar al streamer por encima de su tope
        /// sin haber pedido nada. También nace con su propio slug, porque dos ruedas
        /// con la misma URL de overlay serían la misma rueda para OBS.</para>
        ///
        /// <para>Lo que NO se copia: el historial de giros, las billeteras, las entregas
        /// pendientes y el pool del sorteo. Son hechos de la rueda vieja, no configuración.</para>
        /// </summary>
        public async Task<Wheel?> DuplicateWheelAsync(long channelId, int wheelId, string nuevoNombre)
        {
            var origen = await GetWheelAsync(channelId, wheelId);
            if (origen == null) return null;

            var copia = new Wheel
            {
                ChannelId = channelId,
                Name = nuevoNombre.Trim(),
                Mode = origen.Mode,
                Slug = await SlugLibreAsync(channelId, nuevoNombre),
                IsEnabled = false,
                IsActive = false,
                CreditLabel = origen.CreditLabel,
                SpinPrice = origen.SpinPrice,
                IsAccumulable = origen.IsAccumulable,
                OverflowPolicy = origen.OverflowPolicy,
                MultiFitPolicy = origen.MultiFitPolicy,
                CreditExpiry = origen.CreditExpiry,
                CreditExpiryDays = origen.CreditExpiryDays,
                NoRepeatScope = origen.NoRepeatScope,
                PityEnabled = origen.PityEnabled,
                PityThreshold = origen.PityThreshold,
                AllowMultiSpin = origen.AllowMultiSpin,
                MaxMultiSpin = origen.MaxMultiSpin,
                CreditsPublic = origen.CreditsPublic,
                VisualConfig = origen.VisualConfig,
                AnnounceConfig = origen.AnnounceConfig,
                // Los comandos se copian tal cual pero llegan APAGADOS.
                //
                // Dos ruedas encendidas del mismo canal escuchando `!dgirar` es un
                // empate que resuelve el orden de la tabla, o sea al azar desde el
                // punto de vista del streamer. Dejarlos en blanco sería lo obvio y no
                // se puede: la base exige que los dos comandos existan, empiecen por
                // `!` y sean distintos entre sí (chk_wheels_spin_command,
                // chk_wheels_balance_command y chk_wheels_commands_differ). Así que se
                // copian y se desactivan, que además es lo que el resolvedor de
                // comandos mira: filtra por `CommandEnabled`, no por el texto.
                SpinCommand = origen.SpinCommand,
                BalanceCommand = origen.BalanceCommand,
                BuyCommand = origen.BuyCommand,
                CommandEnabled = false,
                AutoSpin = origen.AutoSpin,
                SpinCooldownSeconds = origen.SpinCooldownSeconds,
                MaxSpinsPerStream = origen.MaxSpinsPerStream,
                MaxCoinsPerHour = origen.MaxCoinsPerHour,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };

            _db.Wheels.Add(copia);
            await _db.SaveChangesAsync();

            var gajos = await _db.WheelSegments.AsNoTracking()
                .Where(sg => sg.WheelId == wheelId)
                .OrderBy(sg => sg.DisplayOrder).ThenBy(sg => sg.Id)
                .ToListAsync();

            foreach (var g in gajos)
            {
                _db.WheelSegments.Add(new WheelSegment
                {
                    WheelId = copia.Id,
                    Label = g.Label,
                    Weight = g.Weight,
                    Color = g.Color,
                    Icon = g.Icon,
                    DisplayOrder = g.DisplayOrder,
                    Prize = g.Prize,
                    IsEnabled = g.IsEnabled,
                    StockTotal = g.StockTotal,
                    StockPerViewer = g.StockPerViewer,
                    StockWindow = g.StockWindow,
                    // El stock arranca lleno: lo que ya se gastó es de la rueda vieja.
                    StockRemaining = g.StockTotal,
                    StockResetAt = g.StockTotal != null ? DateTime.UtcNow : null,
                });
            }

            var fuentes = await _db.WheelWalletSources.AsNoTracking()
                .Where(f => f.WheelId == wheelId)
                .ToListAsync();

            foreach (var f in fuentes)
            {
                _db.WheelWalletSources.Add(new WheelWalletSource
                {
                    WheelId = copia.Id,
                    Source = f.Source,
                    IsEnabled = f.IsEnabled,
                    RateNumerator = f.RateNumerator,
                    RateDenominator = f.RateDenominator,
                    CapPerEvent = f.CapPerEvent,
                    ChannelPointsRewardId = f.ChannelPointsRewardId,
                    ChannelPointsRewardTitle = f.ChannelPointsRewardTitle,
                });
            }

            await _db.SaveChangesAsync();
            return copia;
        }

        public async Task<bool> UpdateWheelAsync(long channelId, int wheelId, Action<Wheel> apply)
        {
            var wheel = await GetWheelAsync(channelId, wheelId);
            if (wheel == null) return false;

            apply(wheel);
            // El modo es inmutable tras crear (sección 4 del plan): cambiarlo dejaría
            // el historial y la configuración hablando de otra cosa.
            _db.Entry(wheel).Property(w => w.Mode).IsModified = false;
            wheel.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return true;
        }

        /// <summary>
        /// Avisa al overlay de esta rueda que se recargue. Se llama después de cada
        /// cambio que se ve en pantalla; sin esto el streamer tenía que refrescar la
        /// fuente de OBS a mano para ver lo que acababa de guardar.
        /// </summary>
        public async Task NotifyOverlayAsync(long channelId, int wheelId)
        {
            var slug = await _db.Wheels.AsNoTracking()
                .Where(w => w.Id == wheelId && w.ChannelId == channelId)
                .Select(w => w.Slug)
                .FirstOrDefaultAsync();
            if (slug != null) await NotifyOverlayAsync(channelId, slug);
        }

        /// <summary>
        /// Igual que la otra, pero con el slug a mano: al borrar la rueda o cambiarle
        /// el slug, al que hay que avisar es al overlay que tiene el VIEJO en la URL.
        /// </summary>
        public async Task NotifyOverlayAsync(long channelId, string slug)
        {
            var login = await _db.Users.AsNoTracking()
                .Where(u => u.Id == channelId)
                .Select(u => u.Login)
                .FirstOrDefaultAsync();
            if (login != null) await _overlays.NotifyWheelChangedAsync(login.ToLowerInvariant(), slug);
        }

        public async Task<bool> DeleteWheelAsync(long channelId, int wheelId)
        {
            var wheel = await GetWheelAsync(channelId, wheelId);
            if (wheel == null) return false;

            _db.Wheels.Remove(wheel);
            await _db.SaveChangesAsync();
            return true;
        }

        /// <summary>
        /// Reemplaza la lista de gajos de una rueda.
        ///
        /// <para>Los gajos que ya existían se actualizan en vez de borrarse y recrearse:
        /// <c>wheel_spins.result_segment_id</c> los apunta, y recrearlos convertiría todo
        /// el historial en giros sin gajo.</para>
        /// </summary>
        /// <summary>
        /// Copia la configuración de stock de un gajo entrante al que se guarda.
        ///
        /// <para>El contador vivo se recalcula, no se copia: el panel manda el tope y no
        /// lo que queda. Subir el tope de 3 a 5 repone; bajarlo no puede dejar un
        /// "quedan 5 de 3". Y solo se repone si el tope cambió — guardar la pestaña de
        /// gajos por cualquier otro motivo no puede resucitar un stock agotado.</para>
        /// </summary>
        private static void AplicarStock(WheelSegment destino, WheelSegment dto)
        {
            var topeCambio = destino.StockTotal != dto.StockTotal;
            var ventanaCambio = destino.StockWindow != dto.StockWindow;

            destino.StockTotal = dto.StockTotal;
            destino.StockPerViewer = dto.StockPerViewer;
            destino.StockWindow = WheelStockWindows.EsValida(dto.StockWindow)
                ? dto.StockWindow
                : WheelStockWindows.Ever;

            if (dto.StockTotal == null)
            {
                destino.StockRemaining = null;
                destino.StockResetAt = null;
                return;
            }

            if (topeCambio || ventanaCambio || destino.StockRemaining == null)
            {
                destino.StockRemaining = dto.StockTotal;
                destino.StockResetAt = DateTime.UtcNow;
            }
            else
            {
                destino.StockRemaining = Math.Min(destino.StockRemaining.Value, dto.StockTotal.Value);
            }
        }

        public async Task<bool> ReplaceSegmentsAsync(long channelId, int wheelId, List<WheelSegment> incoming)
        {
            var wheel = await GetWheelAsync(channelId, wheelId);
            if (wheel == null) return false;

            var current = await _db.WheelSegments.Where(s => s.WheelId == wheelId).ToListAsync();
            var seen = new HashSet<int>();

            for (var i = 0; i < incoming.Count; i++)
            {
                var dto = incoming[i];
                var existing = dto.Id > 0 ? current.FirstOrDefault(s => s.Id == dto.Id) : null;

                if (existing != null)
                {
                    existing.Label = dto.Label;
                    existing.Weight = dto.Weight;
                    existing.Color = dto.Color;
                    existing.Icon = dto.Icon;
                    existing.DisplayOrder = i;
                    existing.Prize = dto.Prize;
                    existing.IsEnabled = dto.IsEnabled;
                    AplicarStock(existing, dto);
                    existing.UpdatedAt = DateTime.UtcNow;
                    seen.Add(existing.Id);
                }
                else
                {
                    var nuevo = new WheelSegment
                    {
                        WheelId = wheelId,
                        Label = dto.Label,
                        Weight = dto.Weight,
                        Color = dto.Color,
                        Icon = dto.Icon,
                        DisplayOrder = i,
                        Prize = dto.Prize,
                        IsEnabled = dto.IsEnabled
                    };
                    AplicarStock(nuevo, dto);
                    _db.WheelSegments.Add(nuevo);
                }
            }

            // Un gajo que el streamer quitó del editor pero que ya salió en algún giro
            // se apaga en vez de borrarse, para no romper ese historial.
            foreach (var sobrante in current.Where(s => !seen.Contains(s.Id)))
            {
                var usado = await _db.WheelSpins.AnyAsync(sp => sp.ResultSegmentId == sobrante.Id);
                if (usado)
                {
                    sobrante.IsEnabled = false;
                    sobrante.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    _db.WheelSegments.Remove(sobrante);
                }
            }

            wheel.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return true;
        }

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

        /// <summary>Lo que dejó la entrega de un premio, para el chat y para el log.</summary>
        public class PrizeDelivery
        {
            /// <summary>Coins efectivamente entregados (solo el premio <c>coins</c>).</summary>
            public int Coins { get; init; }

            /// <summary>El premio quedó en la bandeja del streamer.</summary>
            public bool Pending { get; init; }

            /// <summary>Por qué quedó pendiente. Se guarda en la bandeja.</summary>
            public string? PendingReason { get; init; }
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

        /// <summary>
        /// Entrega el premio del gajo. Un tipo por handler; el catálogo es modular
        /// (sección 5.3 del plan) y agregar uno nuevo es agregar un <c>case</c>.
        ///
        /// <para>Un premio que no se puede entregar <b>nunca</b> rompe el giro
        /// (sección 6.3): la rueda ya giró en pantalla y el espectador ya pagó. Cuando
        /// la integración no está disponible el premio va a la bandeja de entregas
        /// pendientes con el motivo, que es lo único que le permite al streamer
        /// cumplirlo a mano.</para>
        /// </summary>
        private async Task<PrizeDelivery> EntregarPremioAsync(
            Wheel wheel, string channelLogin, string viewerLogin, long? spinId, string? prizeJson)
        {
            if (string.IsNullOrWhiteSpace(prizeJson)) return new PrizeDelivery();

            try
            {
                using var doc = JsonDocument.Parse(prizeJson);
                var root = doc.RootElement;
                if (!root.TryGetProperty("type", out var tipoProp)) return new PrizeDelivery();

                var tipo = tipoProp.GetString();
                var pars = root.TryGetProperty("params", out var p) ? p : default;

                return tipo switch
                {
                    WheelPrizeTypes.Coins         => await EntregarCoinsAsync(wheel, viewerLogin, spinId, prizeJson, pars),
                    WheelPrizeTypes.FreeSpin      => await EntregarFreeSpinAsync(wheel, viewerLogin, pars),
                    WheelPrizeTypes.GachaPull     => await EntregarGachaPullAsync(wheel, channelLogin, viewerLogin, spinId, prizeJson, pars),
                    WheelPrizeTypes.TimerTime     => await EntregarTimerTimeAsync(wheel, channelLogin, viewerLogin, spinId, prizeJson, pars),
                    WheelPrizeTypes.Timeout       => await EntregarTimeoutAsync(wheel, channelLogin, viewerLogin, spinId, prizeJson, pars),
                    WheelPrizeTypes.SoundAlert    => await EntregarSoundAlertAsync(wheel, channelLogin, viewerLogin, spinId, prizeJson, pars),
                    WheelPrizeTypes.ManualMessage => await EntregarManualAsync(wheel, channelLogin, viewerLogin, spinId, prizeJson, pars),
                    _                             => new PrizeDelivery(),   // "nothing" y cualquier tipo que no conozcamos
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error entregando el premio de {Viewer} en '{Rueda}'", viewerLogin, wheel.Name);
                await MarcarPendienteAsync(wheel, viewerLogin, spinId, prizeJson, "Error al entregar el premio");
                return new PrizeDelivery { Pending = true, PendingReason = "Error al entregar el premio" };
            }
        }

        // --------------------------------------------------------------------
        // Los handlers, uno por tipo del catálogo
        // --------------------------------------------------------------------

        /// <summary>Coins a la cuenta de Decatron del espectador, con el techo horario de la rueda.</summary>
        private async Task<PrizeDelivery> EntregarCoinsAsync(
            Wheel wheel, string viewerLogin, long? spinId, string prizeJson, JsonElement pars)
        {
            var monto = LeerInt(pars, "amount", 0);
            if (monto <= 0) return new PrizeDelivery();

            // Techo horario: es el freno que evita que una mala configuración de
            // pesos vacíe la economía del canal en una tarde.
            if (wheel.MaxCoinsPerHour.HasValue)
            {
                var desde = DateTime.UtcNow.AddHours(-1);
                var recientes = await _db.WheelSpins
                    .Where(s2 => s2.WheelId == wheel.Id && s2.CreatedAt >= desde && s2.Id != spinId)
                    .Select(s2 => s2.ResultPrize)
                    .ToListAsync();

                var yaRepartidos = recientes.Sum(MontoDeCoins);
                if (yaRepartidos + monto > wheel.MaxCoinsPerHour.Value)
                {
                    _logger.LogWarning(
                        "🎡 [Rueda] '{Rueda}' llegó a su techo de {Techo} coins/hora ({Ya} repartidos); el premio de {Viewer} queda pendiente",
                        wheel.Name, wheel.MaxCoinsPerHour.Value, yaRepartidos, viewerLogin);
                    return await PendienteAsync(wheel, viewerLogin, spinId, prizeJson, "Techo de coins por hora alcanzado");
                }
            }

            // Los coins viven en la cuenta de Decatron del espectador. Quien todavía
            // no tiene cuenta no puede recibirlos, así que el premio queda en la
            // bandeja del streamer en vez de evaporarse.
            var viewerUserId = await BuscarUserIdAsync(viewerLogin);
            if (viewerUserId == null)
                return await PendienteAsync(wheel, viewerLogin, spinId, prizeJson, "El espectador no tiene cuenta de Decatron");

            await _coins.GiveCoinsAsync(viewerUserId.Value, monto, $"Rueda de la Suerte: {wheel.Name}", null);
            return new PrizeDelivery { Coins = monto };
        }

        /// <summary>
        /// Giros gratis: se acreditan como créditos, no como un giro inmediato.
        ///
        /// <para>Encadenar un giro dentro de otro haría que la rueda se dispare sola en
        /// pantalla mientras el espectador todavía está viendo el primero, y con un gajo
        /// de free_spin en la propia rueda sería un bucle. Acreditando, el espectador
        /// gira cuando quiera y todos los topes (cooldown, tope por stream) se siguen
        /// aplicando.</para>
        /// </summary>
        private async Task<PrizeDelivery> EntregarFreeSpinAsync(Wheel wheel, string viewerLogin, JsonElement pars)
        {
            var cantidad = Math.Max(1, LeerInt(pars, "count", 1));

            // Por defecto los giros son de esta misma rueda; el streamer puede regalar
            // giros de otra suya (una rueda "premium", por ejemplo).
            var destinoId = LeerInt(pars, "wheel_id", 0);
            var precio = wheel.SpinPrice;

            if (destinoId > 0 && destinoId != wheel.Id)
            {
                var otra = await _db.Wheels.AsNoTracking()
                    .FirstOrDefaultAsync(w => w.Id == destinoId && w.ChannelId == wheel.ChannelId);
                if (otra != null) precio = otra.SpinPrice;
            }

            // La billetera es por canal, no por rueda: lo que cambia entre ruedas es el
            // precio, así que "N giros" se traduce a N veces el precio de la rueda destino.
            var creditos = cantidad * Math.Max(1, precio);
            await _wallets.GrantCreditsAsync(wheel.ChannelId, viewerLogin, creditos);

            _logger.LogInformation("🎡 [Rueda] {Viewer} ganó {Giros} giro(s) gratis en '{Rueda}' (+{Creditos} créditos)",
                viewerLogin, cantidad, wheel.Name, creditos);

            return new PrizeDelivery();
        }

        /// <summary>
        /// Tiros de gachapón. No dispara el tiro: le deja los tiros disponibles al
        /// espectador para que los use cuando quiera, que es como funciona el gachapón
        /// en el resto del bot.
        /// </summary>
        private async Task<PrizeDelivery> EntregarGachaPullAsync(
            Wheel wheel, string channelLogin, string viewerLogin, long? spinId, string prizeJson, JsonElement pars)
        {
            var cantidad = Math.Max(1, LeerInt(pars, "count", 1));
            var tipo = LeerString(pars, "pull_type", "coins") == "donation" ? "donation" : "coins";

            // Sin items configurados el tiro no puede resolverse nunca, así que el
            // premio va a la bandeja en vez de quedar como un saldo que da error.
            var hayItems = await _db.GachaItems.AnyAsync(i => i.ChannelName == channelLogin && i.Available);
            if (!hayItems)
                return await PendienteAsync(wheel, viewerLogin, spinId, prizeJson, "El gachapón del canal no tiene items disponibles");

            var participante = await _db.GachaParticipants
                .FirstOrDefaultAsync(g => g.ChannelName == channelLogin && g.Name.ToLower() == viewerLogin);

            if (participante == null)
            {
                participante = new Decatron.Core.Models.Gacha.GachaParticipant
                {
                    ChannelName = channelLogin,
                    UserId = wheel.ChannelId,
                    Name = viewerLogin,
                    DisplayName = viewerLogin,
                };
                _db.GachaParticipants.Add(participante);
            }

            // Los tiros de la rueda no son dinero: van a la billetera bonus para no
            // inflar el monto donado ni los hitos por acumulado del gachapón. Los de
            // coins siguen en su propio contador.
            if (tipo == "coins") participante.CoinPullsAvailable += cantidad;
            else participante.BonusPullsAvailable += cantidad;

            participante.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            _logger.LogInformation("🎡 [Rueda] {Viewer} ganó {Tiros} tiro(s) de gachapón ({Tipo}) en '{Rueda}'",
                viewerLogin, cantidad, tipo, wheel.Name);

            return new PrizeDelivery();
        }

        /// <summary>
        /// Suma segundos al timer extensible. Solo si el timer está corriendo o en
        /// pausa: sumarle tiempo a un timer detenido no se ve en ningún lado y el
        /// espectador creería que su premio se perdió.
        /// </summary>
        private async Task<PrizeDelivery> EntregarTimerTimeAsync(
            Wheel wheel, string channelLogin, string viewerLogin, long? spinId, string prizeJson, JsonElement pars)
        {
            var segundos = LeerInt(pars, "seconds", 0);
            if (segundos <= 0) return new PrizeDelivery();

            var estado = await _db.TimerStates.FirstOrDefaultAsync(s2 => s2.ChannelName == channelLogin);
            if (estado == null || (estado.Status != "running" && estado.Status != "paused"))
                return await PendienteAsync(wheel, viewerLogin, spinId, prizeJson, "El timer del canal no está activo");

            estado.CurrentTime += segundos;
            estado.TotalTime += segundos;
            estado.UpdatedAt = DateTime.UtcNow;

            if (estado.CurrentSessionId.HasValue)
            {
                var sesion = await _db.TimerSessions.FindAsync(estado.CurrentSessionId.Value);
                if (sesion != null) sesion.TotalAddedTime += segundos;

                _db.TimerEventLogs.Add(new Decatron.Core.Models.TimerEventLog
                {
                    ChannelName = channelLogin,
                    EventType = "wheel",
                    Username = viewerLogin,
                    TimeAdded = segundos,
                    Details = $"Rueda de la Suerte: {wheel.Name}",
                    TimerSessionId = estado.CurrentSessionId,
                    CreatedAt = DateTime.UtcNow,
                    OccurredAt = TimerDateTimeHelper.NowForDb(),
                });
            }

            await _db.SaveChangesAsync();
            await _overlays.SendAddTimeAsync(channelLogin, segundos);

            _logger.LogInformation("🎡 [Rueda] {Viewer} sumó {Segundos}s al timer de {Canal} desde '{Rueda}'",
                viewerLogin, segundos, channelLogin, wheel.Name);

            return new PrizeDelivery();
        }

        /// <summary>
        /// Timeout por gracia del gajo. Necesita que el bot sea moderador del canal;
        /// si no lo es la API de Twitch responde 401 y el premio queda en la bandeja
        /// como aviso, sin romper el giro (caso borde de la sección 13).
        /// </summary>
        private async Task<PrizeDelivery> EntregarTimeoutAsync(
            Wheel wheel, string channelLogin, string viewerLogin, long? spinId, string prizeJson, JsonElement pars)
        {
            var segundos = LeerInt(pars, "seconds", 0);
            var objetivo = LeerString(pars, "target", "spinner");

            if (segundos <= 0 || objetivo == "none") return new PrizeDelivery();

            string? victima = objetivo == "spinner" ? viewerLogin : null;

            if (objetivo == "random_chatter")
            {
                var chatters = await _twitch.GetChattersAsync(channelLogin);

                // El streamer nunca: silenciar al dueño del canal por un gajo es
                // exactamente el accidente que nadie quiere en vivo.
                var elegibles = chatters
                    .Where(c => !string.Equals(c, channelLogin, StringComparison.OrdinalIgnoreCase))
                    .ToList();

                if (elegibles.Count == 0)
                    return await PendienteAsync(wheel, viewerLogin, spinId, prizeJson, "No había nadie en el chat para elegir");

                victima = elegibles[RandomNumberGenerator.GetInt32(elegibles.Count)];
            }

            if (victima == null) return new PrizeDelivery();

            var aplicado = await _twitch.TimeoutUserAsync(channelLogin, victima, segundos, $"Rueda de la Suerte: {wheel.Name}");
            if (!aplicado)
                return await PendienteAsync(wheel, viewerLogin, spinId, prizeJson,
                    $"No se pudo aplicar el timeout a {victima} (¿el bot es moderador?)");

            _logger.LogInformation("🎡 [Rueda] Timeout de {Segundos}s a {Victima} por el gajo de {Viewer} en '{Rueda}'",
                segundos, victima, viewerLogin, wheel.Name);

            return new PrizeDelivery();
        }

        /// <summary>
        /// Dispara una Sound Alert ya configurada del canal. El parámetro es el id de
        /// la alerta (la fila de <c>sound_alert_reward_files</c>), no el de la
        /// recompensa de Twitch: el streamer elige de una lista, no escribe un GUID.
        /// </summary>
        private async Task<PrizeDelivery> EntregarSoundAlertAsync(
            Wheel wheel, string channelLogin, string viewerLogin, long? spinId, string prizeJson, JsonElement pars)
        {
            var alertaId = (long)LeerInt(pars, "sound_alert_id", 0);
            if (alertaId <= 0) return new PrizeDelivery();

            var alerta = await _db.SoundAlertRewardFiles
                .FirstOrDefaultAsync(m => m.Id == alertaId && m.UserId == wheel.ChannelId);

            if (alerta == null)
                return await PendienteAsync(wheel, viewerLogin, spinId, prizeJson, "La alerta de sonido ya no existe");

            if (!alerta.Enabled)
                return await PendienteAsync(wheel, viewerLogin, spinId, prizeJson, "La alerta de sonido está desactivada");

            await _soundAlerts.TriggerAsync(new Decatron.Core.Interfaces.SoundAlertRedemption(
                ChannelUserId: wheel.ChannelId,
                OverlayGroupKey: channelLogin,
                RewardId: alerta.RewardId,
                RewardTitle: alerta.RewardTitle,
                RedeemerUsername: viewerLogin,
                RedeemerId: null,
                RedeemedAt: DateTimeOffset.UtcNow));

            return new PrizeDelivery();
        }

        /// <summary>
        /// Premio manual: publica el texto en el chat y deja la entrega en la bandeja
        /// para que el streamer la resuelva. Las dos cosas, no una: el anuncio es para
        /// el espectador y la bandeja es para que al streamer no se le pase.
        /// </summary>
        private async Task<PrizeDelivery> EntregarManualAsync(
            Wheel wheel, string channelLogin, string viewerLogin, long? spinId, string prizeJson, JsonElement pars)
        {
            var plantilla = LeerString(pars, "template", "");

            if (!string.IsNullOrWhiteSpace(plantilla))
            {
                var texto = plantilla
                    .Replace("{user}", viewerLogin)
                    .Replace("{wheel}", wheel.Name);

                try
                {
                    await _chat.SendMessageAsync(channelLogin, texto);
                }
                catch (Exception ex)
                {
                    // El chat caído no puede costarle el premio al espectador: la
                    // entrega pendiente de abajo se crea igual.
                    _logger.LogWarning(ex, "🎡 [Rueda] No se pudo anunciar el premio manual de {Viewer} en {Canal}",
                        viewerLogin, channelLogin);
                }
            }

            return await PendienteAsync(wheel, viewerLogin, spinId, prizeJson, "Premio manual: lo entrega el streamer");
        }

        // --------------------------------------------------------------------
        // Auxiliares de entrega
        // --------------------------------------------------------------------

        private async Task<PrizeDelivery> PendienteAsync(
            Wheel wheel, string viewerLogin, long? spinId, string? prizeJson, string motivo)
        {
            await MarcarPendienteAsync(wheel, viewerLogin, spinId, prizeJson, motivo);
            return new PrizeDelivery { Pending = true, PendingReason = motivo };
        }

        private async Task<long?> BuscarUserIdAsync(string viewerLogin) =>
            await _db.Users
                .Where(u => u.Login == viewerLogin.ToLowerInvariant())
                .Select(u => (long?)u.Id)
                .FirstOrDefaultAsync();

        private static int LeerInt(JsonElement pars, string nombre, int porDefecto)
        {
            if (pars.ValueKind != JsonValueKind.Object) return porDefecto;
            if (!pars.TryGetProperty(nombre, out var v)) return porDefecto;

            return v.ValueKind switch
            {
                JsonValueKind.Number => v.TryGetInt32(out var n) ? n : porDefecto,
                // El panel manda números, pero un premio escrito a mano por la API
                // puede traerlos como texto y no vale la pena perder el premio por eso.
                JsonValueKind.String => int.TryParse(v.GetString(), out var t) ? t : porDefecto,
                _ => porDefecto,
            };
        }

        // ================================================================
        // FASE 7 — VENTANAS DE STOCK, STOCK POR ESPECTADOR, NO-REPETIR Y PIEDAD
        // ================================================================
        //
        // Las cuatro reglas comparten una forma: reciben la lista de elegibles y
        // devuelven una MÁS CHICA, nunca una distinta. Y si una regla dejaría la
        // lista vacía, se descarta esa regla en vez de no girar: el espectador ya
        // pagó, y un giro que no ocurre es peor que un premio repetido.

        /// <summary>
        /// Reinicia el stock de los gajos cuya ventana ya venció. Devuelve si tocó algo.
        ///
        /// <para>Solo se ocupa de <c>day</c>: <c>ever</c> no vence nunca y <c>stream</c>
        /// lo reinicia el handler de <c>stream.online</c>, que es el único momento en
        /// que "por stream" significa algo verificable.</para>
        /// </summary>
        private static bool ReiniciarVentanasDeStock(List<WheelSegment> segmentos, bool dryRun)
        {
            var hoy = DateTime.UtcNow.Date;
            var toco = false;

            foreach (var s in segmentos)
            {
                if (s.StockTotal == null || s.StockWindow != WheelStockWindows.Day) continue;
                if (s.StockResetAt != null && s.StockResetAt.Value.Date >= hoy) continue;

                s.StockRemaining = s.StockTotal;
                s.StockResetAt = DateTime.UtcNow;
                toco = true;
            }

            // En un giro de prueba igual se reinicia en memoria, para que el panel no
            // muestre agotado un gajo que en el próximo giro real va a estar disponible.
            return toco && !dryRun ? true : toco;
        }

        /// <summary>Desde cuándo cuenta la ventana de este gajo. <c>null</c> = desde siempre.</summary>
        private static DateTime? InicioDeVentana(WheelSegment s) => s.StockWindow switch
        {
            WheelStockWindows.Day => DateTime.UtcNow.Date,
            WheelStockWindows.Stream => s.StockResetAt,
            _ => null,
        };

        /// <summary>
        /// Saca los gajos que este espectador ya se llevó tantas veces como permite
        /// <c>stock_per_viewer</c> dentro de su ventana.
        ///
        /// <para>Se cuenta contra <c>wheel_spins</c> y no contra un contador propio:
        /// el historial ya guarda quién ganó qué y cuándo, y un contador paralelo sería
        /// un segundo sitio donde la misma verdad puede quedar desincronizada.</para>
        /// </summary>
        private async Task<List<WheelSegment>> SinStockDelEspectadorAsync(
            int wheelId, string? spinnerLogin, List<WheelSegment> elegibles)
        {
            if (string.IsNullOrWhiteSpace(spinnerLogin)) return elegibles;

            var conTope = elegibles.Where(s => s.StockPerViewer is > 0).ToList();
            if (conTope.Count == 0) return elegibles;

            // Una sola consulta para todos: se trae desde la ventana más vieja que haga
            // falta y después cada gajo aplica la suya en memoria. Son los giros de UNA
            // persona en UNA rueda, así que la lista es corta por definición.
            var desdes = conTope.Select(InicioDeVentana).ToList();
            DateTime? masVieja = desdes.Any(d => d == null) ? null : desdes.Min();

            var ids = conTope.Select(s => s.Id).ToList();
            var query = _db.WheelSpins.AsNoTracking()
                .Where(sp => sp.WheelId == wheelId
                          && sp.SpinnerLogin == spinnerLogin
                          && sp.ResultSegmentId != null
                          && ids.Contains(sp.ResultSegmentId.Value));

            if (masVieja != null) query = query.Where(sp => sp.CreatedAt >= masVieja);

            var suyos = await query
                .Select(sp => new { SegmentId = sp.ResultSegmentId!.Value, sp.CreatedAt })
                .ToListAsync();

            var agotados = conTope
                .Where(s =>
                {
                    var desde = InicioDeVentana(s);
                    var veces = suyos.Count(x => x.SegmentId == s.Id && (desde == null || x.CreatedAt >= desde));
                    return veces >= s.StockPerViewer!.Value;
                })
                .Select(s => s.Id)
                .ToHashSet();

            if (agotados.Count == 0) return elegibles;

            var quedan = elegibles.Where(s => !agotados.Contains(s.Id)).ToList();
            return quedan.Count > 0 ? quedan : elegibles;
        }

        /// <summary>
        /// Evita repetir el último resultado, según <c>no_repeat_scope</c>.
        ///
        /// <para><c>global</c> mira el último giro de la rueda y <c>per_viewer</c> el
        /// último de esa persona. Con dos gajos elegibles y alcance global la regla se
        /// descarta sola —dejaría uno solo posible, que ya no es azar— y por eso el
        /// estrechamiento se descarta si vacía la lista.</para>
        /// </summary>
        private async Task<List<WheelSegment>> SinRepetirAsync(
            Wheel wheel, string? spinnerLogin, List<WheelSegment> elegibles)
        {
            if (wheel.NoRepeatScope == WheelNoRepeatScopes.Off || elegibles.Count <= 1) return elegibles;
            if (wheel.NoRepeatScope == WheelNoRepeatScopes.PerViewer && string.IsNullOrWhiteSpace(spinnerLogin))
                return elegibles;

            var query = _db.WheelSpins.AsNoTracking()
                .Where(sp => sp.WheelId == wheel.Id && sp.ResultSegmentId != null);

            if (wheel.NoRepeatScope == WheelNoRepeatScopes.PerViewer)
                query = query.Where(sp => sp.SpinnerLogin == spinnerLogin);

            var ultimo = await query
                .OrderByDescending(sp => sp.Id)
                .Select(sp => sp.ResultSegmentId)
                .FirstOrDefaultAsync();

            if (ultimo == null) return elegibles;

            var quedan = elegibles.Where(s => s.Id != ultimo.Value).ToList();
            return quedan.Count > 0 ? quedan : elegibles;
        }

        /// <summary>
        /// Piedad: pasados <c>pity_threshold</c> giros seguidos sin premio, el siguiente
        /// no puede volver a ser "nada".
        ///
        /// <para>El plan habla de "un segmento marcado como premio de piedad" pero no
        /// hay ninguna columna que lo marque, y agregarla obligaría al streamer a
        /// declarar dos veces lo mismo. Acá "premio" es cualquier gajo cuyo tipo NO sea
        /// <c>nothing</c>, que es exactamente lo que el contador de la billetera venía
        /// midiendo desde la Fase 2: giros seguidos sin premio.</para>
        /// </summary>
        private async Task<List<WheelSegment>> ConPiedadAsync(
            Wheel wheel, long channelId, string? spinnerLogin, List<WheelSegment> elegibles)
        {
            if (!wheel.PityEnabled || wheel.PityThreshold is not > 0) return elegibles;
            if (string.IsNullOrWhiteSpace(spinnerLogin) || elegibles.Count <= 1) return elegibles;

            var contador = await _db.WheelWallets.AsNoTracking()
                .Where(w => w.ChannelId == channelId && w.ViewerLogin == spinnerLogin)
                .Select(w => (int?)w.PityCounter)
                .FirstOrDefaultAsync() ?? 0;

            if (contador < wheel.PityThreshold.Value) return elegibles;

            var conPremio = elegibles.Where(s => !EsNada(s.Prize)).ToList();
            return conPremio.Count > 0 ? conPremio : elegibles;
        }

        /// <summary>Sube o resetea el contador de piedad según lo que salió.</summary>
        private async Task ActualizarPiedadAsync(Wheel wheel, long channelId, string? spinnerLogin, WheelSegment ganador)
        {
            if (!wheel.PityEnabled || string.IsNullOrWhiteSpace(spinnerLogin)) return;

            var wallet = await _db.WheelWallets
                .FirstOrDefaultAsync(w => w.ChannelId == channelId && w.ViewerLogin == spinnerLogin);
            if (wallet == null) return;

            wallet.PityCounter = EsNada(ganador.Prize) ? wallet.PityCounter + 1 : 0;
        }

        /// <summary>Si el premio de un gajo es "nada". Un JSON ilegible cuenta como nada.</summary>
        private static bool EsNada(string? prizeJson)
        {
            if (string.IsNullOrWhiteSpace(prizeJson)) return true;
            try
            {
                using var doc = JsonDocument.Parse(prizeJson);
                return !doc.RootElement.TryGetProperty("type", out var t)
                    || t.GetString() == WheelPrizeTypes.Nothing;
            }
            catch { return true; }
        }

        private static string LeerString(JsonElement pars, string nombre, string porDefecto)
        {
            if (pars.ValueKind != JsonValueKind.Object) return porDefecto;
            if (!pars.TryGetProperty(nombre, out var v) || v.ValueKind != JsonValueKind.String) return porDefecto;
            return v.GetString() ?? porDefecto;
        }

        private static int MontoDeCoins(string? prizeJson)
        {
            if (string.IsNullOrWhiteSpace(prizeJson)) return 0;
            try
            {
                using var doc = JsonDocument.Parse(prizeJson);
                var root = doc.RootElement;
                if (!root.TryGetProperty("type", out var t) || t.GetString() != WheelPrizeTypes.Coins) return 0;
                if (!root.TryGetProperty("params", out var p) || !p.TryGetProperty("amount", out var a)) return 0;
                return a.TryGetInt32(out var v) ? v : 0;
            }
            catch { return 0; }
        }

        private async Task MarcarPendienteAsync(
            Wheel wheel, string viewerLogin, long? spinId, string? prizeJson, string? motivo = null)
        {
            if (spinId == null) return;

            var spin = await _db.WheelSpins.FirstOrDefaultAsync(s2 => s2.Id == spinId);
            if (spin != null) spin.DeliveryStatus = "pending";

            var yaEsta = await _db.WheelPendingDeliveries.AnyAsync(d => d.SpinId == spinId);
            if (!yaEsta)
            {
                _db.WheelPendingDeliveries.Add(new WheelPendingDelivery
                {
                    WheelId = wheel.Id,
                    SpinId = spinId.Value,
                    ViewerLogin = viewerLogin.ToLowerInvariant(),
                    Prize = prizeJson ?? "{}",
                    Reason = motivo,
                });
            }

            await _db.SaveChangesAsync();
        }

        /// <summary>
        /// Sorteo por peso con <see cref="RandomNumberGenerator"/> y no con
        /// <c>Random</c>: acá se reparten premios que cuestan dinero real, y un PRNG
        /// predecible es una invitación a que alguien calcule cuándo girar.
        /// </summary>
        private static WheelSegment PickWeighted(List<WheelSegment> segments)
        {
            var total = segments.Sum(s => s.Weight);
            if (total <= 0) return segments[0];

            // 8 bytes de entropía llevados a [0,1) y escalados al total de pesos.
            Span<byte> buffer = stackalloc byte[8];
            RandomNumberGenerator.Fill(buffer);
            var fraccion = (decimal)(BitConverter.ToUInt64(buffer) / (double)ulong.MaxValue);
            var objetivo = fraccion * total;

            decimal acumulado = 0;
            foreach (var s in segments)
            {
                acumulado += s.Weight;
                if (objetivo < acumulado) return s;
            }

            // Solo se llega acá por el redondeo del último tramo.
            return segments[^1];
        }

        // ====================================================================
        // AUXILIARES
        // ====================================================================

        /// <summary>Los pesos crudos llevados a porcentaje, que es lo que muestra el panel.</summary>
        public static Dictionary<int, decimal> EffectivePercentages(List<WheelSegment> segments)
        {
            var elegibles = segments.Where(s => s.PuedeSalir).ToList();
            var total = elegibles.Sum(s => s.Weight);

            var result = new Dictionary<int, decimal>();
            foreach (var s in segments)
                result[s.Id] = total <= 0 || !s.PuedeSalir ? 0m : Math.Round(s.Weight / total * 100m, 2);

            return result;
        }

        private static object? ParseJson(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            try { return JsonSerializer.Deserialize<JsonElement>(json); }
            catch { return null; }
        }

        /// <summary>Deja el texto como lo exige <c>chk_wheels_slug</c>: minúsculas, números y guiones.</summary>
        public static string Slugify(string texto)
        {
            var normalizado = texto.Trim().ToLowerInvariant()
                .Replace('á', 'a').Replace('é', 'e').Replace('í', 'i')
                .Replace('ó', 'o').Replace('ú', 'u').Replace('ñ', 'n');

            var sb = new System.Text.StringBuilder();
            foreach (var c in normalizado)
            {
                if (char.IsLetterOrDigit(c) && c < 128) sb.Append(c);
                else if (sb.Length > 0 && sb[^1] != '-') sb.Append('-');
            }

            var slug = sb.ToString().Trim('-');
            if (slug.Length > 40) slug = slug[..40].Trim('-');
            // El CHECK exige que empiece por letra o número; un slug vacío no pasa.
            return string.IsNullOrEmpty(slug) ? "rueda" : slug;
        }
    }
}
