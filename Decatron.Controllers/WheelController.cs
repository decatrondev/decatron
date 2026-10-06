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
    public partial class WheelController : ControllerBase
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

                // Aspecto, encendido y todo lo que se ve en pantalla: el overlay se
                // recarga solo en vez de esperar a que refresquen la fuente de OBS.
                await _wheels.NotifyOverlayAsync(channelId, actual.Slug);
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
                var slug = await _db.Wheels.AsNoTracking()
                    .Where(w => w.Id == id && w.ChannelId == channelId)
                    .Select(w => w.Slug)
                    .FirstOrDefaultAsync();

                var ok = await _wheels.DeleteWheelAsync(channelId, id);
                if (!ok) return NotFound(new { success = false, message = "Rueda no encontrada" });

                // El overlay recarga, recibe 404 y se vacía: una rueda borrada no puede
                // quedarse dibujada en la escena hasta el próximo refresco.
                if (slug != null) await _wheels.NotifyOverlayAsync(channelId, slug);
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error borrando rueda {Id}", id);
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
                var anterior = await _db.Wheels.AsNoTracking()
                    .Where(w => w.Id == id && w.ChannelId == channelId)
                    .Select(w => w.Slug)
                    .FirstOrDefaultAsync();

                var final = await _wheels.ChangeSlugAsync(channelId, id, dto.Slug);
                if (final == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                // Al que hay que avisar es a la fuente con el slug VIEJO: recarga, no
                // encuentra la rueda y se vacía, en vez de seguir mostrando una rueda
                // que ya no va a girar nunca más con esa URL.
                if (anterior != null && anterior != final) await _wheels.NotifyOverlayAsync(channelId, anterior);

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
    }
}
