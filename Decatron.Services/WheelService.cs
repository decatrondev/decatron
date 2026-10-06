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
    public partial class WheelService
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

            // El estado del sorteo que el overlay necesita para decidir si se muestra y
            // que numero de inscritos poner en la tarjeta. En Premios no hay nada de esto.
            object? raffle = null;
            if (wheel.Mode == WheelModes.Raffle)
            {
                var cfg = await _db.WheelRaffleConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.WheelId == wheel.Id);
                var inscritos = await _db.WheelRaffleEntries.AsNoTracking().CountAsync(e => e.WheelId == wheel.Id && !e.HasWon);
                raffle = new
                {
                    isOpen = cfg?.AceptaInscripciones ?? false,
                    // Una ventana temporizada se cierra sola, sin que nadie escriba nada:
                    // el overlay necesita la hora para esconderse por su cuenta.
                    closesAt = cfg is { WindowMode: "timed" } ? cfg.WindowClosesAt : null,
                    count = inscritos,
                };
            }

            return new
            {
                wheel = new
                {
                    id = wheel.Id,
                    slug = wheel.Slug,
                    name = wheel.Name,
                    mode = wheel.Mode,
                    creditLabel = wheel.CreditLabel,
                    lang = await IdiomaDelCanalAsync(channelId.Value),
                    visual = ParseJson(wheel.VisualConfig),
                    announce = ParseJson(wheel.AnnounceConfig)
                },
                raffle,
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
