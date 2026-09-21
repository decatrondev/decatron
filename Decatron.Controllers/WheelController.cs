using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Core.Models.WheelOfLuck;
using Decatron.Core.Settings;
using Decatron.Data;
using Decatron.Services;
using Decatron.Core.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Controllers
{
    /// <summary>
    /// Rueda de la Suerte — Fase 1 (modo Premios).
    ///
    /// <para>Todo el controlador está detrás del flag <c>WheelOfLuck:Enabled</c>: con la
    /// feature apagada responde 404, igual que si la ruta no existiera. Eso permite tener
    /// las tablas aplicadas en producción mientras las fases siguientes se construyen.</para>
    /// </summary>
    [ApiController]
    [Route("api/wheel")]
    [Authorize]
    public class WheelController : ControllerBase
    {
        private readonly WheelService _wheels;
        private readonly WheelWalletService _walletService;
        private readonly WheelRaffleService _raffle;
        private readonly DecatronDbContext _db;
        private readonly WheelOfLuckSettings _settings;
        private readonly ILogger<WheelController> _logger;

        public WheelController(
            WheelService wheels,
            WheelWalletService walletService,
            WheelRaffleService raffle,
            DecatronDbContext db,
            IOptions<WheelOfLuckSettings> settings,
            ILogger<WheelController> logger)
        {
            _wheels = wheels;
            _walletService = walletService;
            _raffle = raffle;
            _db = db;
            _settings = settings.Value;
            _logger = logger;
        }

        // ====================================================================
        // RUEDAS
        // ====================================================================

        [HttpGet("wheels")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetWheels()
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheels = await _wheels.GetWheelsAsync(channelId);
                return Ok(new { success = true, wheels = wheels.Select(ToListDto) });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error listando ruedas");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Los topes del tier del canal. El panel los necesita para poder deshabilitar
        /// el botón de crear ANTES de que el usuario lo apriete: enterarse del tope por
        /// un error después de escribir el nombre es una forma fea de decírselo.
        /// </summary>
        [HttpGet("limits")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetLimits()
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var tier = await TierResolver.GetEffectiveTierAsync(_db, channelId);

                return Ok(new
                {
                    success = true,
                    tier,
                    maxWheels = await TierResolver.GetWheelLimitAsync(_db, tier),
                    maxSegments = await TierResolver.GetWheelSegmentLimitAsync(_db, tier),
                    canHideWatermark = TierResolver.PuedeOcultarMarcaDeAgua(tier),
                    historyDays = await TierResolver.GetWheelHistoryDaysAsync(_db, tier),
                    wheels = await _db.Wheels.CountAsync(w => w.ChannelId == channelId && w.IsEnabled),
                    wheelsTotal = await _db.Wheels.CountAsync(w => w.ChannelId == channelId),
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error leyendo los límites del tier");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpPost("wheels")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> CreateWheel([FromBody] CreateWheelDto dto)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                if (string.IsNullOrWhiteSpace(dto.Name))
                    return BadRequest(new { success = false, message = "La rueda necesita un nombre" });

                var channelId = GetChannelOwnerId();

                // Tope de ruedas por tier (sección 11 del plan). Se comprueba acá y no
                // en el servicio porque el tier es de la CUENTA y no del canal, y el
                // servicio no tiene por qué saber de suscripciones.
                var tier = await TierResolver.GetEffectiveTierAsync(_db, channelId);
                var tope = await TierResolver.GetWheelLimitAsync(_db, tier);

                if (tope != TierResolver.Unlimited)
                {
                    // El tope del plan es de ruedas HABILITADAS, no de ruedas guardadas
                    // (sección 11: "Ruedas habilitadas"). Así el streamer puede tener
                    // ruedas viejas apagadas sin que le ocupen cupo: lo que se limita es
                    // cuántas puede tener funcionando a la vez.
                    var actuales = await _db.Wheels.CountAsync(w => w.ChannelId == channelId && w.IsEnabled);
                    if (actuales >= tope)
                        return BadRequest(new
                        {
                            success = false,
                            message = $"Tu plan permite {tope} rueda(s). Borra una o mejora tu plan para crear más.",
                            limit = tope,
                            current = actuales,
                            tier,
                        });
                }

                var wheel = await _wheels.CreateWheelAsync(channelId, dto.Name, dto.Mode ?? WheelModes.Prizes, dto.Slug);

                return Ok(new { success = true, wheel = ToListDto(wheel) });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error creando rueda");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpGet("wheels/{id:int}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetWheel(int id)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var segments = await _wheels.GetSegmentsAsync(id);
                var pct = WheelService.EffectivePercentages(segments);

                return Ok(new
                {
                    success = true,
                    wheel = ToDetailDto(wheel),
                    segments = segments.Select(s => ToSegmentDto(s, pct.GetValueOrDefault(s.Id)))
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error obteniendo rueda {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpPut("wheels/{id:int}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> UpdateWheel(int id, [FromBody] UpdateWheelDto dto)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();

                // Encender una rueda cuenta contra el mismo tope que crearla; si no, el
                // límite se saltaría creando ruedas apagadas y prendiéndolas después.
                // Apagarla nunca se bloquea: bajar de cupo siempre tiene que poder hacerse.
                if (dto.IsEnabled == true)
                {
                    var tierEnc = await TierResolver.GetEffectiveTierAsync(_db, channelId);
                    var topeEnc = await TierResolver.GetWheelLimitAsync(_db, tierEnc);

                    if (topeEnc != TierResolver.Unlimited)
                    {
                        var encendidas = await _db.Wheels
                            .CountAsync(w => w.ChannelId == channelId && w.IsEnabled && w.Id != id);

                        if (encendidas >= topeEnc)
                            return BadRequest(new
                            {
                                success = false,
                                message = $"Tu plan permite {topeEnc} rueda(s) encendida(s). Apaga otra primero.",
                                limit = topeEnc,
                                current = encendidas,
                                tier = tierEnc,
                            });
                    }
                }

                // La marca de agua se fuerza en el servidor y no solo escondiendo el
                // toggle del panel: si la decisión viviera en el frontend, apagarla
                // sería cambiar un booleano en el navegador.
                string? visualJson = null;
                if (dto.VisualConfig != null)
                {
                    visualJson = dto.VisualConfig.Value.GetRawText();

                    var tierMarca = await TierResolver.GetEffectiveTierAsync(_db, channelId);
                    if (!TierResolver.PuedeOcultarMarcaDeAgua(tierMarca))
                        visualJson = ForzarMarcaDeAgua(visualJson);
                }

                // Los tres comandos tienen que ser distintos entre si. La base solo
                // comprueba girar != saldo (chk_wheels_commands_differ); el de compra
                // llego despues y validarlo aca permite decir CUAL se repitio, en vez
                // de devolver un error de base que no explica nada.
                var actual = await _db.Wheels.AsNoTracking()
                    .FirstOrDefaultAsync(w => w.Id == id && w.ChannelId == channelId);
                if (actual == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var cmdGirar = (dto.SpinCommand ?? actual.SpinCommand).Trim().ToLowerInvariant();
                var cmdSaldo = (dto.BalanceCommand ?? actual.BalanceCommand).Trim().ToLowerInvariant();
                var cmdCompra = (dto.BuyCommand ?? actual.BuyCommand).Trim().ToLowerInvariant();

                if (cmdGirar == cmdSaldo || cmdGirar == cmdCompra || cmdSaldo == cmdCompra)
                    return BadRequest(new { success = false, message = "Los tres comandos de la rueda tienen que ser distintos" });

                var ok = await _wheels.UpdateWheelAsync(channelId, id, w =>
                {
                    if (dto.Name != null) w.Name = dto.Name.Trim();
                    if (dto.IsEnabled.HasValue) w.IsEnabled = dto.IsEnabled.Value;
                    if (dto.IsActive.HasValue) w.IsActive = dto.IsActive.Value;
                    if (dto.CreditLabel != null) w.CreditLabel = dto.CreditLabel.Trim();
                    if (dto.SpinPrice.HasValue) w.SpinPrice = dto.SpinPrice.Value;
                    if (dto.IsAccumulable.HasValue) w.IsAccumulable = dto.IsAccumulable.Value;
                    if (dto.OverflowPolicy != null) w.OverflowPolicy = dto.OverflowPolicy;
                    // Las tres politicas estan construidas. "viewer_choice" estuvo
                    // fuera del selector hasta que existio el flujo de eleccion del
                    // espectador: hoy es acreditar todo y no girar solo, y el
                    // espectador decide con `!dgirar N`.
                    if (dto.MultiFitPolicy != null)
                        w.MultiFitPolicy = WheelMultiFitPolicies.EsValida(dto.MultiFitPolicy)
                            ? dto.MultiFitPolicy
                            : WheelMultiFitPolicies.MostSpins;
                    if (dto.CreditExpiry != null) w.CreditExpiry = dto.CreditExpiry;
                    if (dto.CreditExpiryDays.HasValue) w.CreditExpiryDays = dto.CreditExpiryDays.Value;
                    if (dto.SpinCommand != null) w.SpinCommand = dto.SpinCommand.Trim().ToLowerInvariant();
                    if (dto.BalanceCommand != null) w.BalanceCommand = dto.BalanceCommand.Trim().ToLowerInvariant();
                    if (dto.BuyCommand != null) w.BuyCommand = dto.BuyCommand.Trim().ToLowerInvariant();
                    if (dto.CommandEnabled.HasValue) w.CommandEnabled = dto.CommandEnabled.Value;
                    if (dto.AutoSpin.HasValue) w.AutoSpin = dto.AutoSpin.Value;
                    if (dto.SpinCooldownSeconds.HasValue) w.SpinCooldownSeconds = dto.SpinCooldownSeconds.Value;
                    w.MaxSpinsPerStream = dto.MaxSpinsPerStream;   // null = sin tope, es un valor válido
                    w.MaxCoinsPerHour = dto.MaxCoinsPerHour;

                    // Reglas de giro (Fase 7). El alcance se normaliza igual que
                    // multi_fit_policy: un valor que el servicio no sabe interpretar
                    // dejaria la rueda diciendo una cosa y haciendo otra.
                    if (dto.NoRepeatScope != null)
                        w.NoRepeatScope = WheelNoRepeatScopes.EsValido(dto.NoRepeatScope)
                            ? dto.NoRepeatScope
                            : WheelNoRepeatScopes.Off;
                    if (dto.PityEnabled.HasValue) w.PityEnabled = dto.PityEnabled.Value;
                    if (dto.PityThreshold.HasValue)
                        w.PityThreshold = dto.PityThreshold.Value > 0 ? dto.PityThreshold.Value : null;
                    if (dto.AllowMultiSpin.HasValue) w.AllowMultiSpin = dto.AllowMultiSpin.Value;
                    if (dto.MaxMultiSpin.HasValue) w.MaxMultiSpin = Math.Clamp(dto.MaxMultiSpin.Value, 1, 100);

                    if (visualJson != null) w.VisualConfig = visualJson;
                    if (dto.AnnounceConfig != null) w.AnnounceConfig = dto.AnnounceConfig.Value.GetRawText();
                });

                if (!ok) return NotFound(new { success = false, message = "Rueda no encontrada" });
                return Ok(new { success = true });
            }
            catch (DbUpdateException ex)
            {
                // Los CHECK de la migración son la última defensa; si saltan es que llegó
                // un valor que el panel no debería haber dejado mandar.
                _logger.LogWarning(ex, "🎡 [Rueda] Valor rechazado por la base al guardar la rueda {Id}", id);
                return BadRequest(new { success = false, message = "Alguno de los valores no es válido" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error actualizando rueda {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpDelete("wheels/{id:int}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> DeleteWheel(int id)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var ok = await _wheels.DeleteWheelAsync(channelId, id);
                if (!ok) return NotFound(new { success = false, message = "Rueda no encontrada" });
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error borrando rueda {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        // ====================================================================
        // GAJOS
        // ====================================================================

        [HttpPut("wheels/{id:int}/segments")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SaveSegments(int id, [FromBody] List<SegmentDto> dtos)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                if (dtos == null || dtos.Count < 2)
                    return BadRequest(new { success = false, message = "La rueda necesita al menos 2 gajos" });

                if (dtos.Any(d => string.IsNullOrWhiteSpace(d.Label)))
                    return BadRequest(new { success = false, message = "Todos los gajos necesitan un texto" });

                if (dtos.All(d => !d.IsEnabled || d.Weight <= 0))
                    return BadRequest(new { success = false, message = "Al menos un gajo tiene que estar activo y con peso" });

                var channelId = GetChannelOwnerId();

                var tierGajos = await TierResolver.GetEffectiveTierAsync(_db, channelId);
                var topeGajos = await TierResolver.GetWheelSegmentLimitAsync(_db, tierGajos);

                if (topeGajos != TierResolver.Unlimited && dtos.Count > topeGajos)
                    return BadRequest(new
                    {
                        success = false,
                        message = $"Tu plan permite {topeGajos} gajos por rueda.",
                        limit = topeGajos,
                        current = dtos.Count,
                        tier = tierGajos,
                    });

                var entities = dtos.Select(d => new WheelSegment
                {
                    Id = d.Id,
                    Label = d.Label.Trim(),
                    Weight = d.Weight,
                    Color = string.IsNullOrWhiteSpace(d.Color) ? null : d.Color,
                    Icon = string.IsNullOrWhiteSpace(d.Icon) ? null : d.Icon,
                    Prize = d.Prize?.GetRawText() ?? "{\"type\":\"nothing\",\"params\":{}}",
                    IsEnabled = d.IsEnabled,
                    // 0 y negativos se tratan como "sin tope": un campo vacío en el panel
                    // llega como 0, y un stock de cero seria un gajo que no puede salir
                    // nunca, que es lo que el interruptor de activo ya hace mejor.
                    StockTotal = d.StockTotal is > 0 ? d.StockTotal : null,
                    StockPerViewer = d.StockPerViewer is > 0 ? d.StockPerViewer : null,
                    StockWindow = d.StockWindow,
                }).ToList();

                var ok = await _wheels.ReplaceSegmentsAsync(channelId, id, entities);
                if (!ok) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var segments = await _wheels.GetSegmentsAsync(id);
                var pct = WheelService.EffectivePercentages(segments);
                return Ok(new { success = true, segments = segments.Select(s => ToSegmentDto(s, pct.GetValueOrDefault(s.Id))) });
            }
            catch (DbUpdateException ex)
            {
                _logger.LogWarning(ex, "🎡 [Rueda] Valor rechazado por la base al guardar gajos de {Id}", id);
                return BadRequest(new { success = false, message = "Alguno de los valores no es válido" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error guardando gajos de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        // ====================================================================
        // GIRO DE PRUEBA
        // ====================================================================

        /// <summary>
        /// El botón "Probar giro" del panel: anima el overlay con datos reales de la
        /// rueda pero sin escribir historial, tocar stock ni entregar nada.
        /// </summary>
        [HttpPost("wheels/{id:int}/test-spin")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> TestSpin(int id)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var channelLogin = await _db.Users
                    .Where(u => u.Id == channelId)
                    .Select(u => u.Login)
                    .FirstOrDefaultAsync();

                if (channelLogin == null)
                    return NotFound(new { success = false, message = "Canal no encontrado" });

                var result = await _wheels.SpinAsync(channelId, channelLogin, id, WheelSpinTriggers.Panel, null, dryRun: true);
                if (result == null)
                    return BadRequest(new { success = false, message = "La rueda no tiene ningún gajo que pueda salir" });

                return Ok(new { success = true, result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error en giro de prueba de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        // ====================================================================
        // FUENTES DE CRÉDITOS
        // ====================================================================

        /// <summary>
        /// Las cinco fuentes de la rueda. Devuelve siempre las cinco, existan o no en
        /// la base: el panel necesita poder encender una que nunca se configuró.
        /// </summary>
        [HttpGet("wheels/{id:int}/sources")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetSources(int id)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var guardadas = await _db.WheelWalletSources
                    .AsNoTracking()
                    .Where(ws => ws.WheelId == id)
                    .ToListAsync();

                // Las fuentes de aporte son una fila por rueda; si nunca se
                // configuraron, se devuelven igual apagadas para que el panel pueda
                // encenderlas. Solo se listan las que tienen productor real
                // (ver WheelSourceCatalog.Wired): ofrecer una fuente que nadie
                // dispara es prometer algo que no ocurre.
                var fijas = WheelSourceCatalog.Wired
                    .Where(n => n != WheelSources.ChannelPoints)
                    .Select(name =>
                    {
                        var s = guardadas.FirstOrDefault(g => g.Source == name);
                        return new
                        {
                            id = s?.Id ?? 0,
                            source = name,
                            isEnabled = s?.IsEnabled ?? false,
                            rateNumerator = s?.RateNumerator ?? DefaultRate(name).num,
                            rateDenominator = s?.RateDenominator ?? DefaultRate(name).den,
                            capPerEvent = s?.CapPerEvent,
                            tier2Multiplier = s?.Tier2Multiplier ?? 1m,
                            tier3Multiplier = s?.Tier3Multiplier ?? 1m,
                            channelPointsRewardId = (string?)null,
                            channelPointsRewardTitle = (string?)null,
                        };
                    });

                // Los puntos de canal son una fila POR RECOMPENSA: el streamer crea
                // variantes y cada una da distinto.
                var puntos = guardadas
                    .Where(g => g.Source == WheelSources.ChannelPoints)
                    .OrderBy(g => g.Id)
                    .Select(g => new
                    {
                        id = g.Id,
                        source = g.Source,
                        isEnabled = g.IsEnabled,
                        rateNumerator = g.RateNumerator,
                        rateDenominator = g.RateDenominator,
                        capPerEvent = g.CapPerEvent,
                        tier2Multiplier = g.Tier2Multiplier,
                        tier3Multiplier = g.Tier3Multiplier,
                        channelPointsRewardId = g.ChannelPointsRewardId,
                        channelPointsRewardTitle = g.ChannelPointsRewardTitle,
                    });

                return Ok(new { success = true, sources = fijas.Concat(puntos) });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error listando fuentes de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpPut("wheels/{id:int}/sources")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SaveSources(int id, [FromBody] List<SourceDto> dtos)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var entrantes = dtos ?? new List<SourceDto>();

                if (entrantes.Any(d => d.RateNumerator <= 0 || d.RateDenominator <= 0))
                    return BadRequest(new { success = false, message = "La tasa tiene que ser mayor que cero" });

                // Una recompensa de puntos encendida sin elegir cuál acreditaría
                // cualquier canje del canal, así que se rechaza antes de llegar al CHECK.
                if (entrantes.Any(d => d.Source == WheelSources.ChannelPoints
                                    && d.IsEnabled
                                    && string.IsNullOrWhiteSpace(d.ChannelPointsRewardId)))
                    return BadRequest(new { success = false, message = "Elige la recompensa de puntos de canal antes de activarla" });

                if (entrantes.Where(d => d.Source == WheelSources.ChannelPoints)
                             .GroupBy(d => d.ChannelPointsRewardId ?? "")
                             .Any(g => g.Key != "" && g.Count() > 1))
                    return BadRequest(new { success = false, message = "Esa recompensa ya está en la lista" });

                var existentes = await _db.WheelWalletSources.Where(ws => ws.WheelId == id).ToListAsync();
                var vistas = new HashSet<int>();

                foreach (var dto in entrantes)
                {
                    if (!WheelSourceCatalog.Wired.Contains(dto.Source)) continue;

                    var esPuntos = dto.Source == WheelSources.ChannelPoints;
                    var rewardId = string.IsNullOrWhiteSpace(dto.ChannelPointsRewardId) ? null : dto.ChannelPointsRewardId.Trim();

                    var fila = dto.Id > 0
                        ? existentes.FirstOrDefault(f => f.Id == dto.Id)
                        : existentes.FirstOrDefault(f => f.Source == dto.Source
                                                      && (!esPuntos || f.ChannelPointsRewardId == rewardId));

                    if (fila == null)
                    {
                        fila = new WheelWalletSource { WheelId = id, Source = dto.Source };
                        _db.WheelWalletSources.Add(fila);
                    }
                    else
                    {
                        vistas.Add(fila.Id);
                    }

                    fila.IsEnabled = dto.IsEnabled;
                    fila.RateNumerator = dto.RateNumerator;
                    fila.RateDenominator = esPuntos ? 1 : dto.RateDenominator;   // un canje es un evento
                    fila.CapPerEvent = dto.CapPerEvent;
                    // Los multiplicadores solo se guardan en gift_sub: en el resto no
                    // hay tier que leer, y dejarlos escritos ahi seria configuracion
                    // que no hace nada esperando a confundir a alguien.
                    var esRegalo = dto.Source == WheelSources.GiftSub;
                    fila.Tier2Multiplier = esRegalo ? ClampMultiplicador(dto.Tier2Multiplier) : 1m;
                    fila.Tier3Multiplier = esRegalo ? ClampMultiplicador(dto.Tier3Multiplier) : 1m;
                    fila.ChannelPointsRewardId = esPuntos ? rewardId : null;
                    fila.ChannelPointsRewardTitle = esPuntos
                        ? (string.IsNullOrWhiteSpace(dto.ChannelPointsRewardTitle) ? null : dto.ChannelPointsRewardTitle.Trim())
                        : null;
                    fila.UpdatedAt = DateTime.UtcNow;
                }

                // Una recompensa que el streamer quitó de la lista se borra. Solo aplica
                // a puntos de canal: las otras cuatro fuentes se apagan, no se quitan.
                foreach (var sobrante in existentes.Where(f => f.Source == WheelSources.ChannelPoints && !vistas.Contains(f.Id)))
                    _db.WheelWalletSources.Remove(sobrante);

                await _db.SaveChangesAsync();
                return Ok(new { success = true });
            }
            catch (DbUpdateException ex)
            {
                _logger.LogWarning(ex, "🎡 [Rueda] Valor rechazado por la base al guardar fuentes de {Id}", id);
                return BadRequest(new { success = false, message = "Alguno de los valores no es válido" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error guardando fuentes de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>Tasas de arranque con sentido, para que el panel no abra en ceros.</summary>
        private static (int num, int den) DefaultRate(string source) => source switch
        {
            WheelSources.Bits => (1, 1),            // 1 bit  = 1 crédito
            WheelSources.GiftSub => (500, 1),          // 1 sub  = 500 créditos
            WheelSources.Donation => (1000, 1),         // 1 unidad de moneda = 1000
            WheelSources.ChannelPoints => (100, 1),          // 1 canje = 100
            _ => (1, 1),
        };

        // ====================================================================
        // GIRO MANUAL DESDE EL PANEL
        // ====================================================================

        /// <summary>
        /// El streamer o un mod giran por un espectador. Sirve para quien no quiere
        /// comandos en su chat, y para arreglar a mano un giro que salió mal.
        /// </summary>
        [HttpPost("wheels/{id:int}/spin")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ManualSpin(int id, [FromBody] ManualSpinDto dto)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                if (string.IsNullOrWhiteSpace(dto?.ViewerLogin))
                    return BadRequest(new { success = false, message = "Falta el nombre del espectador" });

                var channelId = GetChannelOwnerId();
                var channelLogin = await _db.Users.Where(u => u.Id == channelId).Select(u => u.Login).FirstOrDefaultAsync();
                if (channelLogin == null) return NotFound(new { success = false, message = "Canal no encontrado" });

                var viewer = dto.ViewerLogin.Trim().TrimStart('@').ToLowerInvariant();

                if (dto.Free)
                {
                    // Regalo del streamer: gira y entrega, sin tocar la billetera ni
                    // los topes. Entrega igual que un giro pagado — un premio regalado
                    // que no llega es un premio que el espectador vio y no recibió.
                    var regalo = await _wheels.SpinFreeAsync(channelId, channelLogin, id, viewer, WheelSpinTriggers.Panel);
                    if (!regalo.Ok)
                        return BadRequest(new { success = false, message = "La rueda no tiene ningún gajo que pueda salir" });

                    return Ok(new { success = true, label = regalo.Label, coins = regalo.CoinsAwarded, pending = regalo.Pending, charged = false });
                }

                var outcome = await _wheels.SpinForViewerAsync(channelId, channelLogin, id, viewer, WheelSpinTriggers.Panel);
                if (!outcome.Ok)
                    return BadRequest(new { success = false, reason = outcome.Reason.ToString(), balance = outcome.Balance, secondsLeft = outcome.SecondsLeft });

                return Ok(new { success = true, label = outcome.Label, balance = outcome.Balance, coins = outcome.CoinsAwarded, pending = outcome.Pending, charged = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error en giro manual de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        // ====================================================================
        // MENSAJES DE CHAT
        // ====================================================================

        /// <summary>
        /// Los textos del chat: lo que el streamer escribió, la base de Decatron para
        /// comparar, y qué variable acepta cada mensaje.
        ///
        /// <para>Se mandan las tres cosas juntas porque el panel las necesita a la vez:
        /// el campo vacío tiene que mostrar la base como marcador, y las variables se
        /// listan al lado para no tener que adivinarlas.</para>
        /// </summary>
        [HttpGet("wheels/{id:int}/messages")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetMessages(int id)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var propios = WheelMessages.Keys.ToDictionary(k => k, k => new
                {
                    es = WheelMessages.Custom(wheel.AnnounceConfig, k, "es"),
                    en = WheelMessages.Custom(wheel.AnnounceConfig, k, "en"),
                });

                return Ok(new
                {
                    success = true,
                    messages = propios,
                    defaults = WheelMessages.AllDefaults(),
                    placeholders = WheelMessages.Placeholders,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error leyendo mensajes de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpPut("wheels/{id:int}/messages")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SaveMessages(int id, [FromBody] Dictionary<string, MessageDto> dtos)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var chat = new Dictionary<string, object>();
                foreach (var (clave, dto) in dtos ?? new Dictionary<string, MessageDto>())
                {
                    if (!WheelMessages.Keys.Contains(clave)) continue;

                    var es = dto?.Es?.Trim();
                    var en = dto?.En?.Trim();

                    // Un texto vacío no se guarda: la ausencia es lo que hace volver a la
                    // base de Decatron, así que borrar el campo es cómo se restaura.
                    if (string.IsNullOrWhiteSpace(es) && string.IsNullOrWhiteSpace(en)) continue;

                    if ((es?.Length ?? 0) > 400 || (en?.Length ?? 0) > 400)
                        return BadRequest(new { success = false, message = "Un mensaje de chat no puede pasar de 400 caracteres" });

                    chat[clave] = new { es, en };
                }

                // Se conserva lo que announce_config tenga fuera de "chat" (los textos del
                // overlay viven en el mismo jsonb).
                var raiz = new Dictionary<string, object>();
                if (!string.IsNullOrWhiteSpace(wheel.AnnounceConfig))
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(wheel.AnnounceConfig);
                        foreach (var prop in doc.RootElement.EnumerateObject())
                            if (prop.Name != "chat")
                                raiz[prop.Name] = JsonSerializer.Deserialize<JsonElement>(prop.Value.GetRawText());
                    }
                    catch { /* config ilegible: se reemplaza entera */ }
                }
                raiz["chat"] = chat;

                await _wheels.UpdateWheelAsync(channelId, id, w => w.AnnounceConfig = JsonSerializer.Serialize(raiz));
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error guardando mensajes de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        // ====================================================================
        // SIMULADOR
        // ====================================================================

        /// <summary>
        /// Simula un aporte real: bits, subs de regalo, donación o canje de puntos.
        ///
        /// <para>Llama exactamente a la misma función que usa el handler de EventSub,
        /// así que lo que se ve acá es lo que va a pasar en vivo. Acredita de verdad,
        /// gasta de verdad y gira de verdad: no es un ensayo, es el evento.</para>
        /// </summary>
        [HttpPost("wheels/{id:int}/simulate")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Simulate(int id, [FromBody] SimulateDto dto)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                if (dto == null || string.IsNullOrWhiteSpace(dto.Source))
                    return BadRequest(new { success = false, message = "Falta la fuente" });

                if (!WheelSourceCatalog.Wired.Contains(dto.Source))
                    return BadRequest(new { success = false, message = "Fuente desconocida" });

                if (dto.Amount <= 0)
                    return BadRequest(new { success = false, message = "La cantidad tiene que ser mayor que cero" });

                var channelId = GetChannelOwnerId();
                var channelLogin = await _db.Users.Where(u => u.Id == channelId).Select(u => u.Login).FirstOrDefaultAsync();
                if (channelLogin == null) return NotFound(new { success = false, message = "Canal no encontrado" });

                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var viewer = string.IsNullOrWhiteSpace(dto.ViewerLogin)
                    ? channelLogin
                    : dto.ViewerLogin.Trim().TrimStart('@').ToLowerInvariant();

                var saldoAntes = await _walletService.GetBalanceAsync(channelId, viewer);

                var resultados = await _wheels.CreditAndMaybeSpinAsync(
                    channelLogin, viewer, dto.Source, dto.Amount, dto.RewardId);

                var saldoDespues = await _walletService.GetBalanceAsync(channelId, viewer);
                var deEstaRueda = resultados.FirstOrDefault(r => r.WheelId == id);

                return Ok(new
                {
                    success = true,
                    viewer,
                    balanceBefore = saldoAntes,
                    balanceAfter = saldoDespues,
                    // Vacío no es un error: casi siempre significa que esa fuente está
                    // apagada, o que el aporte no llegó al precio y la rueda no acumula.
                    // El panel lo explica en vez de decir que algo falló.
                    credited = deEstaRueda != null,
                    creditsAdded = deEstaRueda?.CreditsAdded ?? 0,
                    spinsOwed = deEstaRueda?.SpinsOwed ?? 0,
                    spun = deEstaRueda?.Spun ?? false,
                    spinLabel = deEstaRueda?.SpinLabel,
                    otherWheels = resultados.Where(r => r.WheelId != id).Select(r => new { r.WheelName, r.CreditsAdded }),
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error simulando aporte en {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        // ====================================================================
        // MODO SORTEO
        // ====================================================================

        /// <summary>Config del sorteo + estado de la ventana + el pool.</summary>
        [HttpGet("wheels/{id:int}/raffle")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetRaffle(int id)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });
                if (wheel.Mode != WheelModes.Raffle)
                    return BadRequest(new { success = false, message = "Esta rueda no es de modo Sorteo" });

                var cfg = await _raffle.GetOrCreateConfigAsync(id);
                var entradas = await _raffle.GetEntriesAsync(id);

                return Ok(new
                {
                    success = true,
                    config = new
                    {
                        entryCommand = cfg.EntryCommand,
                        entryMethods = Parse(cfg.EntryMethods),
                        windowMode = cfg.WindowMode,
                        windowSeconds = cfg.WindowSeconds,
                        entryCostCredits = cfg.EntryCostCredits,
                        maxEntriesPerViewer = cfg.MaxEntriesPerViewer,
                        weightSources = Parse(cfg.WeightSources),
                        requirements = Parse(cfg.Requirements),
                        winnersCount = cfg.WinnersCount,
                        drawMode = cfg.DrawMode,
                        removeWinnerFromPool = cfg.RemoveWinnerFromPool,
                        clearOnStreamEnd = cfg.ClearOnStreamEnd,
                        isOpen = cfg.IsOpen,
                        windowClosesAt = cfg.WindowClosesAt,
                        acceptingEntries = cfg.AceptaInscripciones,
                    },
                    entries = entradas.Select(e => new
                    {
                        id = e.Id,
                        viewer = e.ViewerLogin,
                        entries = e.Entries,
                        weight = e.Weight,
                        breakdown = Parse(e.WeightBreakdown),
                        hasWon = e.HasWon,
                        wonAt = e.WonAt,
                        joinedAt = e.JoinedAt,
                    }),
                    poolSize = await _raffle.TamanoDelPoolAsync(id),
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Sorteo] Error leyendo el sorteo de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpPut("wheels/{id:int}/raffle")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SaveRaffle(int id, [FromBody] RaffleConfigDto dto)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var cfg = await _raffle.GetOrCreateConfigAsync(id);

                if (dto.EntryCommand != null)
                {
                    var comando = dto.EntryCommand.Trim().ToLowerInvariant();
                    if (!comando.StartsWith("!")) comando = "!" + comando;

                    // El CHECK de la tabla solo acepta esta forma; validarlo acá deja
                    // un mensaje entendible en vez de un 500 de Postgres.
                    if (!System.Text.RegularExpressions.Regex.IsMatch(comando, "^![a-zA-Z0-9_-]+$"))
                        return BadRequest(new { success = false, message = "El comando solo admite letras, números, guión y guión bajo" });

                    cfg.EntryCommand = comando;
                }

                if (dto.WindowMode != null)
                {
                    if (dto.WindowMode is not ("manual" or "timed" or "always_open"))
                        return BadRequest(new { success = false, message = "Modo de ventana no válido" });
                    cfg.WindowMode = dto.WindowMode;
                }

                if (dto.WindowSeconds.HasValue) cfg.WindowSeconds = dto.WindowSeconds;

                // El CHECK exige segundos cuando la ventana es temporizada; sin esto
                // el guardado explota al cambiar el modo antes de poner la duración.
                if (cfg.WindowMode == "timed" && (cfg.WindowSeconds == null || cfg.WindowSeconds <= 0))
                    return BadRequest(new { success = false, message = "Una ventana temporizada necesita una duración" });

                if (dto.EntryCostCredits.HasValue) cfg.EntryCostCredits = Math.Max(0, dto.EntryCostCredits.Value);
                if (dto.MaxEntriesPerViewer.HasValue) cfg.MaxEntriesPerViewer = Math.Max(1, dto.MaxEntriesPerViewer.Value);
                if (dto.WinnersCount.HasValue) cfg.WinnersCount = Math.Max(1, dto.WinnersCount.Value);

                if (dto.DrawMode != null)
                {
                    if (dto.DrawMode is not ("single" or "multi" or "remove_and_continue"))
                        return BadRequest(new { success = false, message = "Modo de sorteo no válido" });
                    cfg.DrawMode = dto.DrawMode;
                }

                if (dto.RemoveWinnerFromPool.HasValue) cfg.RemoveWinnerFromPool = dto.RemoveWinnerFromPool.Value;
                if (dto.ClearOnStreamEnd.HasValue) cfg.ClearOnStreamEnd = dto.ClearOnStreamEnd.Value;
                if (dto.EntryMethods != null) cfg.EntryMethods = dto.EntryMethods.Value.GetRawText();
                if (dto.WeightSources != null) cfg.WeightSources = dto.WeightSources.Value.GetRawText();
                if (dto.Requirements != null) cfg.Requirements = dto.Requirements.Value.GetRawText();

                cfg.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();

                // Los pesos se configuran DESPUÉS de que la gente ya se inscribió; sin
                // recalcular, cambiar un multiplicador no afectaría a nadie que ya esté.
                var recalculadas = dto.WeightSources != null
                    ? await _raffle.RecalcularPesosAsync(channelId, id)
                    : 0;

                return Ok(new { success = true, recalculated = recalculadas });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Sorteo] Error guardando el sorteo de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpPost("wheels/{id:int}/raffle/window")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> RaffleWindow(int id, [FromBody] RaffleWindowDto dto)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var cfg = dto?.Open == true
                    ? await _raffle.AbrirAsync(id)
                    : await _raffle.CerrarAsync(id);

                return Ok(new
                {
                    success = true,
                    isOpen = cfg.IsOpen,
                    windowClosesAt = cfg.WindowClosesAt,
                    acceptingEntries = cfg.AceptaInscripciones,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Sorteo] Error abriendo/cerrando la ventana de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>Alta manual de un participante por el streamer o un mod.</summary>
        [HttpPost("wheels/{id:int}/raffle/entries")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> AddRaffleEntry(int id, [FromBody] RaffleEntryDto dto)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                if (string.IsNullOrWhiteSpace(dto?.Viewer))
                    return BadRequest(new { success = false, message = "Falta el nombre del espectador" });

                var channelId = GetChannelOwnerId();

                // El alta manual del mod se salta requisitos y costo a propósito: es la
                // vía de escape para meter a alguien que el bot no pudo verificar.
                var outcome = await _raffle.JoinAsync(channelId, id, dto.Viewer, esSub: true, esFollower: true);

                if (outcome.Result == WheelRaffleService.JoinResult.NoEsSorteo)
                    return BadRequest(new { success = false, message = "Esta rueda no es de modo Sorteo" });

                return Ok(new { success = true, result = outcome.Result.ToString(), entries = outcome.Entries, poolSize = outcome.PoolSize });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Sorteo] Error agregando participante a {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpDelete("wheels/{id:int}/raffle/entries/{viewer}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> RemoveRaffleEntry(int id, string viewer)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var quitado = await _raffle.QuitarAsync(id, viewer);
                return Ok(new { success = quitado });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Sorteo] Error quitando participante de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>Multiplicador manual de un mod sobre un participante.</summary>
        [HttpPut("wheels/{id:int}/raffle/entries/{viewer}/multiplier")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SetRaffleMultiplier(int id, string viewer, [FromBody] RaffleMultiplierDto dto)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var mult = dto?.Multiplier ?? 1m;
                if (mult <= 0) return BadRequest(new { success = false, message = "El multiplicador tiene que ser mayor que cero" });

                var ok = await _raffle.SetMultiplicadorManualAsync(id, viewer, mult);
                return Ok(new { success = ok });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Sorteo] Error poniendo multiplicador en {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpPost("wheels/{id:int}/raffle/draw")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> DrawRaffle(int id)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var channelLogin = await _db.Users.Where(u => u.Id == channelId).Select(u => u.Login).FirstOrDefaultAsync();
                if (channelLogin == null) return NotFound(new { success = false, message = "Canal no encontrado" });

                var outcome = await _raffle.SortearAsync(channelId, channelLogin, id, WheelSpinTriggers.RaffleDraw);

                if (outcome.Result != WheelRaffleService.DrawResult.Ok)
                    return BadRequest(new { success = false, reason = outcome.Result.ToString(), poolSize = outcome.PoolSize });

                return Ok(new { success = true, winners = outcome.Ganadores, poolSize = outcome.PoolSize });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Sorteo] Error sorteando en {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpPost("wheels/{id:int}/raffle/reset")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ResetRaffle(int id)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var borradas = await _raffle.LimpiarPoolAsync(id);
                return Ok(new { success = true, removed = borradas });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Sorteo] Error reseteando el pool de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        // ====================================================================
        // BANDEJA DE ENTREGAS PENDIENTES
        // ====================================================================

        /// <summary>
        /// Los premios que el bot no pudo entregar solo. La bandeja es del canal, no
        /// de una rueda: al streamer le importa qué le debe a su gente, no en cuál de
        /// sus ruedas salió.
        /// </summary>
        [HttpGet("deliveries")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetDeliveries([FromQuery] string status = "pending", [FromQuery] int limit = 100)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var tope = Math.Clamp(limit, 1, 500);

                var query = _db.WheelPendingDeliveries
                    .AsNoTracking()
                    .Where(d => d.Wheel != null && d.Wheel.ChannelId == channelId);

                // "all" existe para que el streamer pueda revisar lo que ya resolvió;
                // el default es 'pending' porque es lo único sobre lo que hay que actuar.
                if (status != "all")
                    query = query.Where(d => d.Status == status);

                var filas = await query
                    .OrderByDescending(d => d.Id)
                    .Take(tope)
                    .Select(d => new
                    {
                        id = d.Id,
                        wheelId = d.WheelId,
                        wheelName = d.Wheel!.Name,
                        spinId = d.SpinId,
                        viewer = d.ViewerLogin,
                        prize = d.Prize,
                        status = d.Status,
                        reason = d.Reason,
                        notes = d.Notes,
                        resolvedAt = d.ResolvedAt,
                        createdAt = d.CreatedAt,
                    })
                    .ToListAsync();

                // El premio se devuelve ya parseado: el panel dibuja un widget por tipo
                // y no debería estar parseando JSON a mano.
                var salida = filas.Select(f => new
                {
                    f.id, f.wheelId, f.wheelName, f.spinId, f.viewer,
                    prize = Parse(f.prize),
                    f.status, f.reason, f.notes, f.resolvedAt, f.createdAt,
                });

                var pendientes = await _db.WheelPendingDeliveries
                    .CountAsync(d => d.Wheel != null && d.Wheel.ChannelId == channelId && d.Status == "pending");

                return Ok(new { success = true, data = salida, pendingCount = pendientes });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error listando entregas pendientes");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>Marca una entrega como resuelta o cancelada.</summary>
        [HttpPut("deliveries/{deliveryId:int}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ResolveDelivery(int deliveryId, [FromBody] DeliveryDto dto)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var estado = dto?.Status;
                if (estado != "done" && estado != "cancelled" && estado != "pending")
                    return BadRequest(new { success = false, message = "Estado no válido" });

                var channelId = GetChannelOwnerId();

                var entrega = await _db.WheelPendingDeliveries
                    .Include(d => d.Wheel)
                    .FirstOrDefaultAsync(d => d.Id == deliveryId && d.Wheel != null && d.Wheel.ChannelId == channelId);

                if (entrega == null) return NotFound(new { success = false, message = "Entrega no encontrada" });

                entrega.Status = estado;

                // El CHECK de la tabla exige que una entrega resuelta diga cuándo se
                // resolvió, y que una reabierta no lo diga.
                if (estado == "pending")
                {
                    entrega.ResolvedAt = null;
                    entrega.ResolvedBy = null;
                }
                else
                {
                    entrega.ResolvedAt = DateTime.UtcNow;
                    entrega.ResolvedBy = GetUserId();
                }

                if (dto?.Notes != null)
                    entrega.Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim();

                // El giro guarda su propio estado de entrega: si se quedan desalineados,
                // el historial diría "pendiente" para algo que el streamer ya entregó.
                var spin = await _db.WheelSpins.FirstOrDefaultAsync(s2 => s2.Id == entrega.SpinId);
                if (spin != null)
                    spin.DeliveryStatus = estado == "done" ? "delivered" : estado == "cancelled" ? "failed" : "pending";

                await _db.SaveChangesAsync();
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error resolviendo la entrega {Id}", deliveryId);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>Las Sound Alerts del canal, para elegirlas como premio.</summary>
        [HttpGet("sound-alerts")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetSoundAlerts()
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();

                var alertas = await _db.SoundAlertRewardFiles
                    .AsNoTracking()
                    .Where(m => m.UserId == channelId)
                    .OrderBy(m => m.RewardTitle)
                    .Select(m => new { id = m.Id, title = m.RewardTitle, enabled = m.Enabled })
                    .ToListAsync();

                return Ok(new { success = true, data = alertas });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error listando las alertas de sonido");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        // ====================================================================
        // OVERLAY (sin autenticación: una fuente de OBS no lleva token)
        // ====================================================================

        [HttpGet("overlay")]
        [AllowAnonymous]
        public async Task<IActionResult> GetOverlay([FromQuery] string channel, [FromQuery] string wheel)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                if (string.IsNullOrWhiteSpace(channel) || string.IsNullOrWhiteSpace(wheel))
                    return BadRequest(new { success = false, message = "Faltan channel y wheel" });

                var data = await _wheels.GetOverlayDataAsync(channel.ToLowerInvariant(), wheel.ToLowerInvariant());
                if (data == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                return Ok(new { success = true, data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error en datos de overlay de {Channel}/{Wheel}", channel, wheel);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        // ====================================================================
        // AUXILIARES
        // ====================================================================

        private long GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(claim, out var userId)) return userId;
            throw new UnauthorizedAccessException("User not found");
        }

        /// <summary>
        /// El canal sobre el que se está trabajando, que no siempre es el del usuario
        /// logueado: un moderador con permisos opera el canal del streamer.
        /// </summary>
        /// <summary>
        /// Duplica una rueda. La copia nace apagada y con su propio slug.
        /// </summary>
        [HttpPost("wheels/{id:int}/duplicate")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> DuplicateWheel(int id, [FromBody] DuplicateWheelDto? dto)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var origen = await _db.Wheels.AsNoTracking()
                    .FirstOrDefaultAsync(w => w.Id == id && w.ChannelId == channelId);
                if (origen == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                // El tope del tier cuenta ruedas ENCENDIDAS y la copia nace apagada,
                // así que duplicar nunca choca contra el cupo. Aun así se avisa: llegar
                // al tope y descubrirlo al intentar encenderla sería peor.
                var tier = await TierResolver.GetEffectiveTierAsync(_db, channelId);
                var tope = await TierResolver.GetWheelLimitAsync(_db, tier);
                var encendidas = await _db.Wheels.CountAsync(w => w.ChannelId == channelId && w.IsEnabled);

                var nombre = string.IsNullOrWhiteSpace(dto?.Name)
                    ? $"{origen.Name} (copia)"
                    : dto!.Name!.Trim();

                var copia = await _wheels.DuplicateWheelAsync(channelId, id, nombre);
                if (copia == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                return Ok(new
                {
                    success = true,
                    wheel = ToListDto(copia),
                    // true si al encenderla se pasaría del cupo.
                    quotaFull = tope != TierResolver.Unlimited && encendidas >= tope,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error duplicando la rueda {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Cambia el slug, o sea la URL del overlay.
        ///
        /// <para>Va aparte de <c>PUT wheels/{id}</c> a propósito: renombrar una rueda es
        /// inocuo y cambiarle el slug le rompe la escena de OBS al streamer. Dos cosas
        /// con consecuencias tan distintas no deberían compartir un botón de guardar.</para>
        /// </summary>
        [HttpPut("wheels/{id:int}/slug")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ChangeSlug(int id, [FromBody] ChangeSlugDto dto)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                if (string.IsNullOrWhiteSpace(dto?.Slug))
                    return BadRequest(new { success = false, message = "Falta el nuevo identificador" });

                var channelId = GetChannelOwnerId();
                var final = await _wheels.ChangeSlugAsync(channelId, id, dto.Slug);
                if (final == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                _logger.LogInformation("🎡 [Rueda] Slug de la rueda {Id} cambiado a '{Slug}'", id, final);

                return Ok(new
                {
                    success = true,
                    slug = final,
                    // Se avisa cuando no quedó el que pidió: el streamer va a copiar la
                    // URL y tiene que ver la de verdad, no la que escribió.
                    adjusted = !string.Equals(final, WheelService.Slugify(dto.Slug), StringComparison.Ordinal),
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error cambiando el slug de la rueda {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        // ====================================================================
        // FASE 6 — HISTORIAL, MÉTRICAS Y BILLETERAS
        // ====================================================================

        /// <summary>
        /// El historial de giros de una rueda, filtrado y paginado.
        ///
        /// <para>La ventana la pone el tier (sección 11). El recorte se aplica acá y
        /// no al guardar: las filas siguen en la base, así que subir de tier hace
        /// reaparecer el historial entero sin migrar nada.</para>
        /// </summary>
        [HttpGet("wheels/{id:int}/spins")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetSpins(
            int id,
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            [FromQuery] string? viewer = null,
            [FromQuery] string? trigger = null,
            [FromQuery] string? status = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                if (!await EsDelCanalAsync(id, channelId))
                    return NotFound(new { success = false, message = "Rueda no encontrada" });

                var (desdeTier, dias) = await VentanaDeHistorialAsync(channelId);

                var query = FiltrarGiros(id, desdeTier, from, to, viewer, trigger, status);

                var total = await query.CountAsync();
                var pagina = Math.Max(1, page);
                var tam = Math.Clamp(pageSize, 1, 200);

                var filas = await query
                    .OrderByDescending(s => s.Id)
                    .Skip((pagina - 1) * tam)
                    .Take(tam)
                    .Select(s => new
                    {
                        id = s.Id,
                        createdAt = s.CreatedAt,
                        mode = s.Mode,
                        viewer = s.SpinnerLogin,
                        trigger = s.TriggerSource,
                        creditsSpent = s.CreditsSpent,
                        segmentId = s.ResultSegmentId,
                        // El gajo puede haberse borrado después del giro: el snapshot del
                        // premio es lo único que siempre sobrevive, por eso la etiqueta
                        // se resuelve con lo que haya y no se asume que el gajo exista.
                        label = s.ResultSegment != null ? s.ResultSegment.Label : null,
                        prize = s.ResultPrize,
                        deliveryStatus = s.DeliveryStatus,
                        raffleWinner = s.RaffleWinner,
                    })
                    .ToListAsync();

                var items = filas.Select(f => new
                {
                    f.id, f.createdAt, f.mode, f.viewer, f.trigger, f.creditsSpent,
                    f.segmentId, f.label,
                    prize = Parse(f.prize),
                    f.deliveryStatus,
                    raffleWinner = Parse(f.raffleWinner),
                }).ToList();

                return Ok(new
                {
                    success = true,
                    items,
                    total,
                    page = pagina,
                    pageSize = tam,
                    historyDays = dias,
                    windowFrom = desdeTier,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error leyendo el historial de la rueda {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// El mismo historial, en CSV. Respeta los filtros y la ventana del tier: lo
        /// que el streamer no puede ver en el panel tampoco se lo puede descargar.
        /// </summary>
        [HttpGet("wheels/{id:int}/spins/export")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ExportSpins(
            int id,
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            [FromQuery] string? viewer = null,
            [FromQuery] string? trigger = null,
            [FromQuery] string? status = null)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var rueda = await _db.Wheels.AsNoTracking()
                    .FirstOrDefaultAsync(w => w.Id == id && w.ChannelId == channelId);
                if (rueda == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var (desdeTier, _) = await VentanaDeHistorialAsync(channelId);

                var filas = await FiltrarGiros(id, desdeTier, from, to, viewer, trigger, status)
                    .OrderByDescending(s => s.Id)
                    .Take(MaxFilasCsv)
                    .Select(s => new
                    {
                        s.Id, s.CreatedAt, s.Mode, s.SpinnerLogin, s.TriggerSource,
                        s.CreditsSpent, s.DeliveryStatus, s.ResultPrize, s.RaffleWinner,
                        Label = s.ResultSegment != null ? s.ResultSegment.Label : null,
                    })
                    .ToListAsync();

                var sb = new System.Text.StringBuilder();
                sb.Append("id,fecha_utc,modo,espectador,disparador,creditos,gajo,premio,entrega,ganador_sorteo\r\n");
                foreach (var f in filas)
                {
                    sb.Append(f.Id).Append(',')
                      .Append(f.CreatedAt.ToString("o")).Append(',')
                      .Append(Csv(f.Mode)).Append(',')
                      .Append(Csv(f.SpinnerLogin)).Append(',')
                      .Append(Csv(f.TriggerSource)).Append(',')
                      .Append(f.CreditsSpent).Append(',')
                      .Append(Csv(f.Label)).Append(',')
                      .Append(Csv(TipoDePremio(f.ResultPrize))).Append(',')
                      .Append(Csv(f.DeliveryStatus)).Append(',')
                      .Append(Csv(f.RaffleWinner))
                      .Append("\r\n");
                }

                // Con BOM: sin él Excel abre el CSV en la codificación del sistema y
                // cualquier tilde o emoji del nombre de un gajo sale roto.
                var bytes = new byte[] { 0xEF, 0xBB, 0xBF }
                    .Concat(System.Text.Encoding.UTF8.GetBytes(sb.ToString()))
                    .ToArray();

                var nombre = $"rueda-{rueda.Slug}-giros-{DateTime.UtcNow:yyyyMMdd}.csv";
                return File(bytes, "text/csv", nombre);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error exportando el historial de la rueda {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Métricas de una rueda. A diferencia del historial, usan <b>todo</b> el
        /// historial y no la ventana del tier: una distribución calculada sobre los
        /// últimos treinta días le mentiría al streamer sobre su propia rueda.
        /// </summary>
        [HttpGet("wheels/{id:int}/metrics")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetMetrics(int id)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                if (!await EsDelCanalAsync(id, channelId))
                    return NotFound(new { success = false, message = "Rueda no encontrada" });

                var giros = _db.WheelSpins.AsNoTracking().Where(s => s.WheelId == id);
                var ahora = DateTime.UtcNow;

                var total = await giros.CountAsync();
                var ultimos7 = await giros.CountAsync(s => s.CreatedAt >= ahora.AddDays(-7));
                var ultimos30 = await giros.CountAsync(s => s.CreatedAt >= ahora.AddDays(-30));
                var pendientes = await giros.CountAsync(s => s.DeliveryStatus == "pending");
                var creditosGastados = await giros.SumAsync(s => (int?)s.CreditsSpent) ?? 0;

                var porDisparador = await giros
                    .GroupBy(s => s.TriggerSource)
                    .Select(g => new { trigger = g.Key, spins = g.Count() })
                    .ToListAsync();

                // Distribución real: cuántas veces salió cada gajo. Se agrupa por id y
                // no por etiqueta porque dos gajos pueden llamarse igual.
                var reales = await giros
                    .Where(s => s.ResultSegmentId != null)
                    .GroupBy(s => s.ResultSegmentId!.Value)
                    .Select(g => new { segmentId = g.Key, spins = g.Count() })
                    .ToListAsync();

                var gajos = await _db.WheelSegments.AsNoTracking()
                    .Where(sg => sg.WheelId == id && sg.IsEnabled)
                    .OrderBy(sg => sg.DisplayOrder).ThenBy(sg => sg.Id)
                    .Select(sg => new { sg.Id, sg.Label, sg.Weight, sg.Color })
                    .ToListAsync();

                var pesoTotal = gajos.Sum(g => g.Weight);
                var conResultado = reales.Sum(r => r.spins);

                var distribucion = gajos.Select(g =>
                {
                    var salio = reales.FirstOrDefault(r => r.segmentId == g.Id)?.spins ?? 0;
                    return new
                    {
                        segmentId = g.Id,
                        label = g.Label,
                        color = g.Color,
                        spins = salio,
                        // La configurada es el peso relativo; la real, la frecuencia
                        // observada. Con pocos giros van a diferir mucho y eso es
                        // esperable: el panel lo dice al lado de la tabla.
                        configuredPct = pesoTotal > 0 ? (double)(g.Weight / pesoTotal) * 100 : 0,
                        realPct = conResultado > 0 ? (double)salio / conResultado * 100 : 0,
                    };
                }).ToList();

                // Los coins pagados salen del snapshot del premio, que es jsonb. Se
                // suma en Postgres y no en memoria: traer cien mil filas de historial
                // para sumar un número sería el camino corto a un timeout.
                var coinsPagados = await SumarCoinsPagadosAsync(id);

                var suertudos = await giros
                    .Where(s => s.SpinnerLogin != null && s.CreditsSpent > 0)
                    .GroupBy(s => s.SpinnerLogin!)
                    .Select(g => new { viewer = g.Key, spins = g.Count(), credits = g.Sum(x => x.CreditsSpent) })
                    .OrderByDescending(x => x.spins)
                    .Take(10)
                    .ToListAsync();

                var creditosPorFuente = await _db.WheelWalletSources.AsNoTracking()
                    .Where(f => f.WheelId == id)
                    .Select(f => new
                    {
                        source = f.Source,
                        isEnabled = f.IsEnabled,
                        rateNumerator = f.RateNumerator,
                        rateDenominator = f.RateDenominator,
                    })
                    .ToListAsync();

                return Ok(new
                {
                    success = true,
                    totals = new
                    {
                        spins = total,
                        spinsLast7 = ultimos7,
                        spinsLast30 = ultimos30,
                        pendingDeliveries = pendientes,
                        creditsSpent = creditosGastados,
                        coinsPaid = coinsPagados,
                    },
                    byTrigger = porDisparador,
                    distribution = distribucion,
                    luckiest = suertudos,
                    sources = creditosPorFuente,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error calculando métricas de la rueda {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Las billeteras del canal. Son del <b>canal</b> y no de la rueda: el
        /// espectador aporta una vez y puede gastar en cualquier rueda del streamer,
        /// así que este listado no cuelga de ninguna rueda en particular.
        /// </summary>
        [HttpGet("wallets")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetWallets(
            [FromQuery] string? search = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();

                var query = _db.WheelWallets.AsNoTracking().Where(w => w.ChannelId == channelId);

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var buscar = search.Trim().ToLowerInvariant();
                    query = query.Where(w => w.ViewerLogin.Contains(buscar));
                }

                var total = await query.CountAsync();
                var pagina = Math.Max(1, page);
                var tam = Math.Clamp(pageSize, 1, 200);

                var items = await query
                    .OrderByDescending(w => w.Credits).ThenByDescending(w => w.LastActivityAt)
                    .Skip((pagina - 1) * tam)
                    .Take(tam)
                    .Select(w => new
                    {
                        viewer = w.ViewerLogin,
                        credits = w.Credits,
                        lifetimeCredits = w.LifetimeCredits,
                        spinsThisStream = w.SpinsThisStream,
                        lastActivityAt = w.LastActivityAt,
                        lastSpinAt = w.LastSpinAt,
                    })
                    .ToListAsync();

                return Ok(new { success = true, items, total, page = pagina, pageSize = tam });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error listando billeteras");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Fija a mano el saldo de un espectador.
        ///
        /// <para>Se fija, no se suma: el streamer está corrigiendo un número que ve en
        /// pantalla, y un endpoint que sumara le obligaría a calcular la diferencia.
        /// <c>lifetime_credits</c> NO se toca — es histórico y no baja nunca, ni
        /// siquiera cuando alguien corrige un saldo a mano.</para>
        /// </summary>
        [HttpPut("wallets/{viewer}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SetWalletCredits(string viewer, [FromBody] SetWalletDto dto)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                if (dto.Credits < 0)
                    return BadRequest(new { success = false, message = "El saldo no puede ser negativo" });

                var channelId = GetChannelOwnerId();
                var login = (viewer ?? string.Empty).Trim().ToLowerInvariant();
                if (login.Length == 0)
                    return BadRequest(new { success = false, message = "Falta el espectador" });

                var wallet = await _db.WheelWallets
                    .FirstOrDefaultAsync(w => w.ChannelId == channelId && w.ViewerLogin == login);

                if (wallet == null)
                    return NotFound(new { success = false, message = "Ese espectador no tiene billetera" });

                wallet.Credits = dto.Credits;
                wallet.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();

                _logger.LogInformation(
                    "🎡 [Rueda] Saldo de {Viewer} en el canal {Channel} fijado a mano en {Credits}",
                    login, channelId, dto.Credits);

                return Ok(new { success = true, viewer = login, credits = wallet.Credits });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error fijando el saldo de {Viewer}", viewer);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        // --- ayudantes de la Fase 6 ---

        /// <summary>Tope de filas de una exportación. Un CSV no es un volcado de la base.</summary>
        private const int MaxFilasCsv = 5000;

        /// <summary>Un multiplicador razonable. 0 o negativo no significa nada: vale 1.</summary>
        private static decimal ClampMultiplicador(decimal v) =>
            v <= 0 ? 1m : Math.Round(Math.Min(v, 10m), 2);

        private Task<bool> EsDelCanalAsync(int wheelId, long channelId) =>
            _db.Wheels.AsNoTracking().AnyAsync(w => w.Id == wheelId && w.ChannelId == channelId);

        /// <summary>Desde cuándo puede ver el historial este canal, y cuántos días son.</summary>
        private async Task<(DateTime? desde, long dias)> VentanaDeHistorialAsync(long channelId)
        {
            var tier = await TierResolver.GetEffectiveTierAsync(_db, channelId);
            var dias = await TierResolver.GetWheelHistoryDaysAsync(_db, tier);
            return (dias == TierResolver.Unlimited ? null : DateTime.UtcNow.AddDays(-dias), dias);
        }

        /// <summary>
        /// El filtro del historial, compartido por el listado y la exportación: si
        /// fueran dos, el CSV podría terminar entregando filas que el panel esconde.
        /// </summary>
        private IQueryable<WheelSpin> FiltrarGiros(
            int wheelId, DateTime? desdeTier,
            DateTime? from, DateTime? to, string? viewer, string? trigger, string? status)
        {
            var q = _db.WheelSpins.AsNoTracking().Where(s => s.WheelId == wheelId);

            if (desdeTier != null) q = q.Where(s => s.CreatedAt >= desdeTier);
            if (from != null) q = q.Where(s => s.CreatedAt >= from.Value.ToUniversalTime());
            // El "hasta" que escribe el streamer es un día, no un instante: sin el
            // día completo, filtrar "hasta hoy" no devolvería nada de hoy.
            if (to != null) q = q.Where(s => s.CreatedAt < to.Value.ToUniversalTime().Date.AddDays(1));

            if (!string.IsNullOrWhiteSpace(viewer))
            {
                var v = viewer.Trim().ToLowerInvariant();
                q = q.Where(s => s.SpinnerLogin != null && s.SpinnerLogin.Contains(v));
            }

            if (!string.IsNullOrWhiteSpace(trigger) && trigger != "all")
                q = q.Where(s => s.TriggerSource == trigger);

            if (!string.IsNullOrWhiteSpace(status) && status != "all")
                q = q.Where(s => s.DeliveryStatus == status);

            return q;
        }

        /// <summary>
        /// Suma los coins pagados leyendo el snapshot jsonb del premio, en Postgres.
        ///
        /// <para>El <c>~ '^[0-9]+$'</c> no sobra: <c>amount</c> lo escribe el editor de
        /// premios del panel y un valor que no sea un entero haría fallar el cast de
        /// toda la consulta. Con la comprobación, una fila rota se ignora en vez de
        /// tumbar la pantalla de métricas entera.</para>
        /// </summary>
        private async Task<long> SumarCoinsPagadosAsync(int wheelId)
        {
            try
            {
                var filas = await _db.Database
                    .SqlQueryRaw<long>(
                        @"SELECT COALESCE(SUM((result_prize->'params'->>'amount')::bigint), 0) AS ""Value""
                          FROM wheel_spins
                          WHERE wheel_id = {0}
                            AND delivery_status = 'delivered'
                            AND result_prize->>'type' = 'coins'
                            AND result_prize->'params'->>'amount' ~ '^[0-9]+$'",
                        wheelId)
                    .ToListAsync();

                return filas.FirstOrDefault();
            }
            catch (Exception ex)
            {
                // Un número que no se puede calcular no puede dejar sin métricas al resto.
                _logger.LogWarning(ex, "🎡 [Rueda] No se pudieron sumar los coins pagados de la rueda {Id}", wheelId);
                return 0;
            }
        }

        /// <summary>El tipo del premio del snapshot, para la columna del CSV.</summary>
        private static string TipoDePremio(string? prizeJson)
        {
            if (string.IsNullOrWhiteSpace(prizeJson)) return string.Empty;
            try
            {
                using var doc = JsonDocument.Parse(prizeJson);
                return doc.RootElement.TryGetProperty("type", out var t) ? t.GetString() ?? string.Empty : string.Empty;
            }
            catch { return string.Empty; }
        }

        /// <summary>
        /// Una celda de CSV. Se entrecomilla siempre: las etiquetas de los gajos las
        /// escribe el streamer y cualquiera puede traer una coma, un salto de línea o
        /// una comilla sin que eso sea un error suyo.
        /// </summary>
        private static string Csv(string? valor)
        {
            var v = valor ?? string.Empty;
            return $"\"{v.Replace("\"", "\"\"")}\"";
        }

        private long GetChannelOwnerId()
        {
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
                return sessionId;

            var claim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(claim, out var channelOwnerId)) return channelOwnerId;

            return GetUserId();
        }

        private static object ToListDto(Wheel w) => new
        {
            id = w.Id,
            name = w.Name,
            mode = w.Mode,
            slug = w.Slug,
            isEnabled = w.IsEnabled,
            isActive = w.IsActive,
            createdAt = w.CreatedAt
        };

        private static object ToDetailDto(Wheel w) => new
        {
            id = w.Id,
            name = w.Name,
            mode = w.Mode,
            slug = w.Slug,
            isEnabled = w.IsEnabled,
            isActive = w.IsActive,
            creditLabel = w.CreditLabel,
            spinPrice = w.SpinPrice,
            isAccumulable = w.IsAccumulable,
            allowMultiSpin = w.AllowMultiSpin,
            maxMultiSpin = w.MaxMultiSpin,
            creditsPublic = w.CreditsPublic,
            overflowPolicy = w.OverflowPolicy,
            multiFitPolicy = w.MultiFitPolicy,
            creditExpiry = w.CreditExpiry,
            creditExpiryDays = w.CreditExpiryDays,
            spinCommand = w.SpinCommand,
            balanceCommand = w.BalanceCommand,
            buyCommand = w.BuyCommand,
            commandEnabled = w.CommandEnabled,
            autoSpin = w.AutoSpin,
            spinCooldownSeconds = w.SpinCooldownSeconds,
            maxSpinsPerStream = w.MaxSpinsPerStream,
            maxCoinsPerHour = w.MaxCoinsPerHour,
            noRepeatScope = w.NoRepeatScope,
            pityEnabled = w.PityEnabled,
            pityThreshold = w.PityThreshold,
            visualConfig = Parse(w.VisualConfig),
            announceConfig = Parse(w.AnnounceConfig)
        };

        private static object ToSegmentDto(WheelSegment s, decimal percentage) => new
        {
            id = s.Id,
            label = s.Label,
            weight = s.Weight,
            color = s.Color,
            icon = s.Icon,
            displayOrder = s.DisplayOrder,
            prize = Parse(s.Prize),
            isEnabled = s.IsEnabled,
            stockTotal = s.StockTotal,
            stockPerViewer = s.StockPerViewer,
            stockWindow = s.StockWindow,
            stockRemaining = s.StockRemaining,
            // El % que el panel muestra al lado de cada gajo. Se calcula, no se guarda:
            // depende de qué otros gajos estén activos en este momento.
            effectivePercentage = percentage
        };

        /// <summary>Las medidas del lienzo del overlay. Espejo de <c>visualConfig.ts</c>.</summary>
        private const int LienzoAncho = 1920;
        private const int LienzoAlto = 1080;

        /// <summary>
        /// Lo mínimo que puede medir la marca de agua para que se siga leyendo.
        /// Es el tamaño con el que se dibuja por defecto: encogerla más no es
        /// diseñar, es apagarla sin tener el tier.
        /// </summary>
        private const int MarcaAnchoMinimo = 150;
        private const int MarcaAltoMinimo = 12;

        /// <summary>
        /// Deja <c>showWatermark</c> en true dentro del jsonb de aspecto, respetando
        /// todo lo demás que el streamer haya configurado.
        ///
        /// Desde que existe el lienzo, el booleano no alcanza: con posiciones libres,
        /// sacar la marca fuera de la pantalla o encogerla hasta que no se lea es
        /// apagarla igual, y sin tocar el toggle. Así que acá también se le mete la
        /// caja dentro del lienzo y se le exige un tamaño mínimo.
        /// </summary>
        private static string ForzarMarcaDeAgua(string visualJson)
        {
            try
            {
                var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(visualJson)
                           ?? new Dictionary<string, JsonElement>();

                var salida = dict.ToDictionary(kv => kv.Key, kv => (object?)kv.Value);
                salida["showWatermark"] = true;

                if (dict.TryGetValue("layout", out var layout) && layout.ValueKind == JsonValueKind.Object)
                {
                    var capas = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(layout.GetRawText());
                    if (capas != null && capas.TryGetValue("watermark", out var marca)
                        && marca.ValueKind == JsonValueKind.Object)
                    {
                        var salidaCapas = capas.ToDictionary(kv => kv.Key, kv => (object?)kv.Value);
                        salidaCapas["watermark"] = CajaLegible(marca);
                        salida["layout"] = salidaCapas;
                    }
                }

                return JsonSerializer.Serialize(salida);
            }
            catch
            {
                // Un jsonb que no se puede leer se guarda tal cual: el overlay lo
                // completa con los defaults, que ya traen la marca encendida y la
                // dibujan en su sitio.
                return visualJson;
            }
        }

        /// <summary>
        /// La caja de la marca, con un tamaño que se lee y dentro de la pantalla.
        /// </summary>
        private static Dictionary<string, double> CajaLegible(JsonElement caja)
        {
            static double Leer(JsonElement o, string campo, double porDefecto) =>
                o.TryGetProperty(campo, out var v) && v.ValueKind == JsonValueKind.Number
                    ? v.GetDouble()
                    : porDefecto;

            var ancho = Math.Clamp(Leer(caja, "width", MarcaAnchoMinimo), MarcaAnchoMinimo, LienzoAncho);
            var alto = Math.Clamp(Leer(caja, "height", MarcaAltoMinimo), MarcaAltoMinimo, LienzoAlto);

            return new Dictionary<string, double>
            {
                ["x"] = Math.Clamp(Leer(caja, "x", 0), 0, LienzoAncho - ancho),
                ["y"] = Math.Clamp(Leer(caja, "y", 0), 0, LienzoAlto - alto),
                ["width"] = ancho,
                ["height"] = alto,
            };
        }

        private static object? Parse(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            try { return JsonSerializer.Deserialize<JsonElement>(json); }
            catch { return null; }
        }
    }

    public class DuplicateWheelDto
    {
        public string? Name { get; set; }
    }

    public class ChangeSlugDto
    {
        public string Slug { get; set; } = string.Empty;
    }

    /// <summary>Fija el saldo de una billetera. Se fija, no se suma.</summary>
    public class SetWalletDto
    {
        public int Credits { get; set; }
    }

    public class CreateWheelDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Mode { get; set; }
        public string? Slug { get; set; }
    }

    public class UpdateWheelDto
    {
        public string? Name { get; set; }
        public bool? IsEnabled { get; set; }
        public bool? IsActive { get; set; }
        public string? CreditLabel { get; set; }
        public int? SpinPrice { get; set; }

        // Economía (Fase 2)
        public bool? IsAccumulable { get; set; }
        public string? OverflowPolicy { get; set; }
        public string? MultiFitPolicy { get; set; }
        public string? CreditExpiry { get; set; }
        public int? CreditExpiryDays { get; set; }

        // Disparadores y topes (Fase 2)
        public string? SpinCommand { get; set; }
        public string? BalanceCommand { get; set; }
        public string? BuyCommand { get; set; }
        public bool? CommandEnabled { get; set; }
        public bool? AutoSpin { get; set; }
        public int? SpinCooldownSeconds { get; set; }
        public int? MaxSpinsPerStream { get; set; }
        public int? MaxCoinsPerHour { get; set; }

        // Reglas de giro (Fase 7)
        public string? Slug { get; set; }
        public string? NoRepeatScope { get; set; }
        public bool? PityEnabled { get; set; }
        public int? PityThreshold { get; set; }
        public bool? AllowMultiSpin { get; set; }
        public int? MaxMultiSpin { get; set; }

        public JsonElement? VisualConfig { get; set; }
        public JsonElement? AnnounceConfig { get; set; }
    }

    public class SourceDto
    {
        /// <summary>0 para una fila nueva. Las de puntos de canal se identifican por id.</summary>
        public int Id { get; set; }
        public string Source { get; set; } = string.Empty;
        public string? ChannelPointsRewardTitle { get; set; }
        public bool IsEnabled { get; set; }
        public int RateNumerator { get; set; } = 1;
        public int RateDenominator { get; set; } = 1;
        public int? CapPerEvent { get; set; }
        public string? ChannelPointsRewardId { get; set; }

        // Multiplicadores por tier de sub. Solo tienen efecto en gift_sub.
        public decimal Tier2Multiplier { get; set; } = 1m;
        public decimal Tier3Multiplier { get; set; } = 1m;
    }

    public class MessageDto
    {
        public string? Es { get; set; }
        public string? En { get; set; }
    }

    public class RaffleConfigDto
    {
        public string? EntryCommand { get; set; }
        public JsonElement? EntryMethods { get; set; }
        public string? WindowMode { get; set; }
        public int? WindowSeconds { get; set; }
        public int? EntryCostCredits { get; set; }
        public int? MaxEntriesPerViewer { get; set; }
        public JsonElement? WeightSources { get; set; }
        public JsonElement? Requirements { get; set; }
        public int? WinnersCount { get; set; }
        public string? DrawMode { get; set; }
        public bool? RemoveWinnerFromPool { get; set; }
        public bool? ClearOnStreamEnd { get; set; }
    }

    public class RaffleWindowDto
    {
        public bool Open { get; set; }
    }

    public class RaffleEntryDto
    {
        public string? Viewer { get; set; }
    }

    public class RaffleMultiplierDto
    {
        public decimal Multiplier { get; set; } = 1m;
    }

    public class DeliveryDto
    {
        /// <summary>done | cancelled | pending</summary>
        public string? Status { get; set; }
        public string? Notes { get; set; }
    }

    public class SimulateDto
    {
        /// <summary>bits | gift_sub | donation | channel_points | deca_coins</summary>
        public string Source { get; set; } = string.Empty;
        /// <summary>Bits, cantidad de subs regalados, monto donado, o 1 para un canje.</summary>
        public long Amount { get; set; }
        /// <summary>Vacío = se usa el propio canal, para probar sin involucrar a nadie.</summary>
        public string? ViewerLogin { get; set; }
        /// <summary>Solo para canjes: qué recompensa se simula.</summary>
        public string? RewardId { get; set; }
    }

    public class ManualSpinDto
    {
        public string ViewerLogin { get; set; } = string.Empty;
        /// <summary>Girar sin cobrarle: es un regalo del streamer, no una compra.</summary>
        public bool Free { get; set; }
    }

    public class SegmentDto
    {
        public int Id { get; set; }
        public string Label { get; set; } = string.Empty;
        public decimal Weight { get; set; } = 1m;
        public string? Color { get; set; }
        public string? Icon { get; set; }
        public JsonElement? Prize { get; set; }
        public bool IsEnabled { get; set; } = true;

        // Stock (Fase 7). null = ilimitado.
        public int? StockTotal { get; set; }
        public int? StockPerViewer { get; set; }
        public string StockWindow { get; set; } = "ever";
    }
}
