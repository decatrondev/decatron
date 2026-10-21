using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using Decatron.Attributes;
using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Data;
using Decatron.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/speakchat")]
    [Authorize]
    [Decatron.Core.Interfaces.RequiresModule("module.tts")]
    public class SpeakChatController : ControllerBase
    {
        private readonly ISpeakChatService _speakChatService;
        private readonly ITtsService _ttsService;
        private readonly ITtsCreditService _creditService;
        private readonly OverlayNotificationService _overlayNotificationService;
        private readonly ILogger<SpeakChatController> _logger;
        private readonly DecatronDbContext _dbContext;
        private readonly Decatron.Core.Services.ChannelAudioGate _audioGate;
        private readonly Decatron.Services.Accounts.AccountChannelResolver _accounts;

        public SpeakChatController(
            ISpeakChatService speakChatService,
            ITtsService ttsService,
            ITtsCreditService creditService,
            OverlayNotificationService overlayNotificationService,
            ILogger<SpeakChatController> logger,
            DecatronDbContext dbContext,
            Decatron.Core.Services.ChannelAudioGate audioGate,
            Decatron.Services.Accounts.AccountChannelResolver accounts)
        {
            _accounts = accounts;
            _audioGate = audioGate;
            _speakChatService = speakChatService;
            _ttsService = ttsService;
            _creditService = creditService;
            _overlayNotificationService = overlayNotificationService;
            _logger = logger;
            _dbContext = dbContext;
        }

        // ============================
        // GET /api/speakchat/config
        // ============================
        [HttpGet("config")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetConfig()
        {
            try
            {
                var channelOwnerId = await OwnerAsync();
                var config = await _speakChatService.GetConfigAsync(channelOwnerId);

                if (config == null)
                    return Ok(new { success = true, config = (object?)null, limits = await VoiceCommandLimitsAsync(channelOwnerId, null) });

                return Ok(new
                {
                    success = true,
                    config = new
                    {
                        data = JsonSerializer.Deserialize<JsonElement>(config.ConfigJson),
                        isEnabled = config.IsEnabled
                    },
                    limits = await VoiceCommandLimitsAsync(channelOwnerId, config.ConfigJson)
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpeakChat] Error al obtener config");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        private async Task<(int max, int used)> VoiceCommandLimitsAsync(long channelOwnerId, string? configJson)
        {
            var tier = await TierResolver.GetEffectiveTierAsync(_dbContext, channelOwnerId);
            return (SpeakChatCommandVoice.MaxVoiceCommandsFor(tier), SpeakChatCommandVoice.CountVoiceCommands(configJson));
        }

        // ============================
        // POST /api/speakchat/config
        // ============================
        [HttpPost("config")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SaveConfig([FromBody] SpeakChatSaveRequest body)
        {
            try
            {
                if (body?.Config == null)
                    return BadRequest(new { success = false, message = "Config es requerida" });

                var channelOwnerId = await OwnerAsync();
                var channelName = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(channelName))
                    return Unauthorized(new { success = false, message = "No se pudo identificar el canal" });

                var configJson = JsonSerializer.Serialize(body.Config);
                var configAnterior = (await _speakChatService.GetConfigAsync(channelOwnerId))?.ConfigJson;

                // Comandos con voz propia: el rango pone el tope. Una config que ya lo superaba no se recorta,
                // solo se impide agregar más.
                var limites = await VoiceCommandLimitsAsync(channelOwnerId, configAnterior);
                var despues = SpeakChatCommandVoice.CountVoiceCommands(configJson);
                if (!SpeakChatCommandVoice.CanSave(limites.used, despues, limites.max))
                    return BadRequest(new { success = false, message = $"Tu rango permite {limites.max} comandos con voz propia; esta configuración tiene {despues}" });
                await _speakChatService.SaveConfigAsync(channelOwnerId, channelName, configJson);
                await RegistrarCambiosAsync(channelOwnerId, channelName, configAnterior, configJson);

                // Qué reglas quedaron encendidas, para poder reconstruir después quién cambió qué
                var reglas = "";
                try
                {
                    var cfgGuardada = JsonSerializer.Deserialize<JsonElement>(configJson);
                    if (cfgGuardada.TryGetProperty("activation", out var act) && act.TryGetProperty("rules", out var rs) && rs.ValueKind == JsonValueKind.Array)
                        reglas = string.Join(", ", rs.EnumerateArray().Select(r =>
                            (r.TryGetProperty("type", out var t) ? t.GetString() : "?") + "=" +
                            (r.TryGetProperty("enabled", out var en) && en.ValueKind == JsonValueKind.True ? "sí" : "no")));
                }
                catch { /* el registro nunca rompe el guardado */ }
                _logger.LogInformation("[SpeakChat] Config guardada para {Channel} (usuario {UserId}). Reglas: {Reglas}", channelName, channelOwnerId, reglas);
                return Ok(new { success = true, message = "Configuración guardada" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpeakChat] Error al guardar config");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ============================
        // GET /api/speakchat/history
        // Últimos cambios de la configuración: quién, cuándo y qué campos
        // ============================
        [HttpGet("history")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetHistory([FromQuery] int limit = 20)
        {
            try
            {
                var channelOwnerId = await OwnerAsync();
                limit = Math.Clamp(limit, 1, 100);
                var rows = await _dbContext.SpeakChatConfigHistory.AsNoTracking()
                    .Where(h => h.UserId == channelOwnerId)
                    .OrderByDescending(h => h.CreatedAt).ThenByDescending(h => h.Id)
                    .Take(limit)
                    .ToListAsync();

                return Ok(new
                {
                    success = true,
                    items = rows.Select(h => new
                    {
                        id = h.Id,
                        changedBy = h.ChangedByLogin,
                        createdAt = DateTime.SpecifyKind(h.CreatedAt, DateTimeKind.Utc),
                        changes = JsonSerializer.Deserialize<JsonElement>(h.Changes)
                    })
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpeakChat] Error al leer el historial de cambios");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ====================================================
        // GET /api/speakchat/config/overlay/{channelName}
        // Anónimo — usado por el OBS Browser Source
        // ====================================================
        [HttpGet("config/overlay/{channelName}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetOverlayConfig(string channelName)
        {
            try
            {
                // El enlace del overlay puede traer el login de Twitch, kick_<id> o el id de Kick: se lee la config de la cuenta
                var resolvedAlias = await _accounts.ResolveAliasAsync(channelName);
                var config = await _speakChatService.GetConfigByChannelAsync(resolvedAlias?.Account.OverlayKey ?? channelName);

                if (config == null || !config.IsEnabled)
                    return Ok(new { success = true, config = (object?)null });

                // Retornar solo lo necesario para el overlay (no datos sensibles)
                var full = JsonSerializer.Deserialize<JsonElement>(config.ConfigJson);
                var safeConfig = new
                {
                    voice = full.TryGetProperty("voice", out var v) ? JsonSerializer.Deserialize<object>(v.GetRawText()) : null,
                    overlay = full.TryGetProperty("overlay", out var o) ? JsonSerializer.Deserialize<object>(o.GetRawText()) : null,
                    global = full.TryGetProperty("global", out var g) ? JsonSerializer.Deserialize<object>(g.GetRawText()) : null
                };

                return Ok(new { success = true, config = safeConfig });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpeakChat] Error al obtener config overlay para {Channel}", channelName);
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ============================
        // GET /api/speakchat/resolve/{alias}
        // A qué clave unirse y qué mostraba ese enlace antes (público, sin sesión). Lo pregunta el overlay de OBS.
        // ============================
        [HttpGet("resolve/{alias}")]
        [AllowAnonymous]
        public async Task<IActionResult> ResolveChannel(string alias)
        {
            try
            {
                var resolved = await _accounts.ResolveAliasAsync(alias);
                if (resolved == null) return Ok(new { success = true, found = false });
                return Ok(new { success = true, found = true, overlayKey = resolved.Account.OverlayKey, variant = resolved.LegacyVariant });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpeakChat] Error resolviendo el canal del overlay");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ============================
        // GET /api/speakchat/status
        // Qué overlays de Speak Chat hay conectados en OBS, por variante, y si se pisan.
        // ============================
        [HttpGet("status")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetStatus()
        {
            try
            {
                var account = await _accounts.ResolveByUserIdAsync(GetChannelOwnerId());
                if (account == null) return NotFound(new { success = false, message = "Canal no encontrado" });

                var counts = Decatron.Hubs.OverlayHub.CountOverlayVariants(account.OverlayKey, "speak_chat");
                var warnings = new List<string>();
                if (counts["all"] > 0 && (counts["twitch"] > 0 || counts["kick"] > 0)) warnings.Add("mixed");
                if (counts.Values.Any(c => c > 1)) warnings.Add("repeated");
                return Ok(new
                {
                    success = true, overlayKey = account.OverlayKey, hasTwitch = account.HasTwitch, hasKick = account.HasKick,
                    total = counts.Values.Sum(), all = counts["all"], twitch = counts["twitch"], kick = counts["kick"], warnings
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpeakChat] Error obteniendo el estado de los overlays");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ============================
        // POST /api/speakchat/test
        // ============================
        [HttpPost("test")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SendTest([FromBody] SpeakChatTestRequest body)
        {
            Decatron.Core.Services.AudioTurn? audioTurn = null;
            try
            {
                var channelOwnerId = await OwnerAsync();
                var channelName = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(channelName))
                    return BadRequest(new { success = false, message = "No se pudo identificar el canal" });

                // Con Speak Chat apagado no se genera nada. Antes la prueba llamaba a AWS
                // y descontaba créditos con la función desactivada: el usuario apaga el
                // interruptor esperando dejar de gastar, y seguía gastando.
                var config = await _speakChatService.GetConfigAsync(channelOwnerId);
                if (config == null || !config.IsEnabled || !IsGloballyEnabled(config.ConfigJson))
                {
                    _logger.LogInformation(
                        "[SpeakChat] Prueba rechazada en {Channel}: Speak Chat está desactivado", channelName);
                    return BadRequest(new
                    {
                        success = false,
                        message = "Speak Chat está desactivado. Actívalo para poder probar la voz."
                    });
                }

                var text = body?.Message ?? "Mensaje de prueba del Speak Chat";
                // La prueba pasa por la misma limpieza que un mensaje real
                text = await _speakChatService.CleanForSpeechAsync(channelName, config.ConfigJson, text);
                if (string.IsNullOrWhiteSpace(text))
                    return BadRequest(new { success = false, message = "Tras la limpieza no queda nada que leer. Cambia el texto o la limpieza en Filtros." });
                var languageCode = body?.LanguageCode ?? "es-US";

                // El panel manda en `engine` el proveedor elegido. Cualquier cosa que no
                // sea "polly" es voz estándar, incluido el "browser" de configuraciones
                // viejas: ese motor ya no existe.
                var provider = body?.Engine is "polly" or "fish" ? body.Engine : "piper";

                // Con Piper, vacío significa "la voz por defecto de ese idioma"; con
                // Polly hace falta un nombre concreto.
                var voiceId = string.IsNullOrWhiteSpace(body?.Voice)
                    ? (provider == "polly" ? "Lupe" : "")
                    : body!.Voice!;

                // La prueba cobra igual que un mensaje real, o no sirve para probar nada
                var pollyEngine = body?.PollyEngine ?? "standard";

                // Misma regla que un mensaje real: una voz a la vez por canal
                audioTurn = await _audioGate.RequestAsync(channelName, "speak_chat");
                if (audioTurn == null)
                    return StatusCode(429, new { success = false, message = "El canal tiene demasiadas voces en espera. Prueba de nuevo en unos segundos." });
                _audioGate.Remember(channelName, "speak_chat", text);

                var audioUrl = await _creditService.GenerateWithCreditsAsync(
                    channelOwnerId, text, voiceId, pollyEngine, languageCode, "speak_chat", channelName,
                    provider);

                var ttsEngine = audioUrl != null ? provider : "none";

                if (audioUrl == null)
                    _logger.LogInformation(
                        "[SpeakChat] Test sin audio ({Provider}) para {Channel}", provider, channelName);

                await _overlayNotificationService.SendToChannel(channelName, "SpeakChatMessage", new
                {
                    username = channelName,
                    message = text,
                    audioUrl,
                    audioTurnId = audioUrl != null ? audioTurn.Id : null,
                    volume = 80,
                    ttsEngine,
                    voice = voiceId,
                    languageCode,
                    overlay = new { showBubble = true, position = "bottom-left", fontSize = 16, duration = 5000 },
                    timestamp = DateTime.UtcNow,
                    isTest = true
                });

                if (audioUrl == null || Decatron.Hubs.OverlayHub.CountOverlays(channelName, "speak_chat") == 0) audioTurn.Release();
                else audioTurn.Arm(TimeSpan.FromSeconds(Math.Clamp(text.Length / 12.0 + 6, 8, 60)));

                return Ok(new { success = true, message = "Test enviado al overlay" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpeakChat] Error al enviar test");
                audioTurn?.Release();
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ============================
        // GET /api/speakchat/usage-log?days=7
        // Quién usó qué comando, cuánto costó y qué se descartó. Sale de speak_chat_usage_log (30 días, sin el texto).
        // ============================
        [HttpGet("usage-log")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetUsageLog([FromQuery] int days = 7)
        {
            try
            {
                var ownerId = await OwnerAsync();
                days = Math.Clamp(days, 1, 30);
                var since = DateTime.UtcNow.AddDays(-days);
                var rows = await _dbContext.SpeakChatUsageLog.AsNoTracking()
                    .Where(l => l.UserId == ownerId && l.CreatedAt >= since)
                    .OrderByDescending(l => l.CreatedAt)
                    .Take(5000)
                    .ToListAsync();

                var outcomes = rows.GroupBy(r => r.Outcome).ToDictionary(g => g.Key, g => g.Count());
                var spoken = rows.Where(r => r.Outcome == "spoken").ToList();

                return Ok(new
                {
                    success = true,
                    days,
                    total = rows.Count,
                    truncated = rows.Count >= 5000,
                    outcomes,
                    credits = spoken.Sum(r => r.Credits ?? 0),
                    byCommand = rows.GroupBy(r => string.IsNullOrEmpty(r.Command) ? r.RuleType : r.Command)
                        .Select(g => new
                        {
                            command = g.Key,
                            count = g.Count(),
                            spoken = g.Count(r => r.Outcome == "spoken"),
                            discarded = g.Count(r => r.Outcome != "spoken" && r.Outcome != "no_audio"),
                            credits = g.Where(r => r.Outcome == "spoken").Sum(r => r.Credits ?? 0)
                        })
                        .OrderByDescending(x => x.count).Take(15).ToList(),
                    byUser = spoken.GroupBy(r => r.Username)
                        .Select(g => new { username = g.Key, count = g.Count(), credits = g.Sum(r => r.Credits ?? 0) })
                        .OrderByDescending(x => x.count).Take(10).ToList(),
                    recent = rows.Take(25).Select(r => new
                    {
                        createdAt = DateTime.SpecifyKind(r.CreatedAt, DateTimeKind.Utc),
                        r.Username, r.Platform, r.Command, r.RuleType, r.Outcome, r.Engine, r.Voice, r.Credits
                    }).ToList()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpeakChat] Error al consultar el registro de uso");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ============================
        // GET /api/speakchat/fallbacks
        // Lecturas de los últimos 7 días que cayeron a la voz estándar porque la elegida no pudo generarse.
        // Sale del libro mayor de créditos: no hay tabla nueva.
        // ============================
        [HttpGet("fallbacks")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetFallbacks()
        {
            try
            {
                var ownerId = await OwnerAsync();
                var since = DateTimeOffset.UtcNow.AddDays(-7);
                const string prefix = "Respaldo de voz premium:";
                var rows = await _dbContext.TtsCreditLedger.AsNoTracking()
                    .Where(e => e.UserId == ownerId && e.Feature == "speak_chat" && e.CreatedAt >= since
                                && e.Note != null && e.Note.StartsWith(prefix))
                    .Select(e => new { e.CreatedAt, e.Note })
                    .ToListAsync();

                static string Code(string? note)
                {
                    var reason = (note ?? "").Substring(prefix.Length).Trim();
                    if (reason.Contains("sin créditos")) return "noCredits";
                    if (reason.Contains("no está configurado")) return "notConfigured";
                    if (reason.Contains("no devolvió audio")) return "noAudio";
                    if (reason.Contains("error del motor")) return "engineError";
                    return "other";
                }

                var top = rows.GroupBy(r => Code(r.Note)).OrderByDescending(g => g.Count()).FirstOrDefault();
                return Ok(new
                {
                    success = true,
                    days = 7,
                    count = rows.Count,
                    lastAt = rows.Count == 0 ? (DateTimeOffset?)null : rows.Max(r => r.CreatedAt),
                    topReason = top?.Key
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpeakChat] Error al consultar los respaldos de voz");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ============================
        // POST /api/speakchat/estimate
        // Lo que costaría leer un texto con la limpieza guardada del canal, sin generar audio ni cobrar.
        // ============================
        [HttpPost("estimate")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Estimate([FromBody] SpeakChatEstimateRequest body)
        {
            try
            {
                var channelOwnerId = await OwnerAsync();
                var channelName = await GetChannelUsernameAsync(channelOwnerId);
                if (string.IsNullOrEmpty(channelName))
                    return BadRequest(new { success = false, message = "No se pudo identificar el canal" });

                var text = (body?.Message ?? "").Trim();
                if (text.Length > 600) text = text[..600];
                var config = await _speakChatService.GetConfigAsync(channelOwnerId);
                var cleaned = config == null ? text : await _speakChatService.CleanForSpeechAsync(channelName, config.ConfigJson, text);

                // Mismas unidades que el cobro real: Fish por bytes de texto, Polly y la voz estándar por caracteres
                var provider = body?.Engine is "polly" or "fish" ? body.Engine : "piper";
                var units = provider == "fish" ? Decatron.Services.Tts.FishTtsClient.BillableBytes(cleaned) : cleaned.Length;
                long? credits = null;
                if (provider != "piper")
                {
                    var rateEngine = provider == "fish" ? "fish" : (body?.PollyEngine == "neural" ? "neural" : "standard");
                    credits = await _creditService.CalculateCostAsync(units, rateEngine);
                }

                return Ok(new
                {
                    success = true,
                    cleanedText = cleaned,
                    units,
                    unit = provider == "fish" ? "bytes" : "chars",
                    engine = provider,
                    credits
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpeakChat] Error al estimar el costo");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ============================
        // GET /api/speakchat/usage
        // ============================
        [HttpGet("usage")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetUsage()
        {
            try
            {
                var channelOwnerId = await OwnerAsync();
                var balance = await _creditService.GetBalanceAsync(channelOwnerId);
                var expiresAt = await TierResolver.GetTierExpiryAsync(_dbContext, channelOwnerId);

                // La cuota mensual se muestra como "límite" para que la barra de progreso
                // siga funcionando; los créditos comprados van aparte porque no caducan.
                var charLimit = balance.IsUnlimited ? -1 : balance.MonthlyGranted;

                return Ok(new
                {
                    success = true,
                    tier = balance.Tier,
                    isUnlimited = balance.IsUnlimited,

                    // Cartera de créditos
                    monthlyGranted   = balance.MonthlyGranted,
                    monthlyUsed      = balance.MonthlyUsed,
                    monthlyRemaining = balance.MonthlyRemaining,
                    purchasedBalance = balance.PurchasedBalance,
                    totalAvailable   = balance.TotalAvailable,

                    // Bolsa de voz estándar (Piper), independiente de la premium
                    standardGranted   = balance.StandardGranted,
                    standardUsed      = balance.StandardUsed,
                    standardRemaining = balance.StandardRemaining,
                    standardPercentage = !balance.IsUnlimited && balance.StandardGranted > 0
                        ? (double)balance.StandardUsed / balance.StandardGranted * 100
                        : 0,

                    // Ventana de transición
                    inTransitionWindow = balance.InTransitionWindow,
                    transitionEndsAt   = balance.TransitionEndsAt,

                    tierExpiresAt = expiresAt,

                    // Compatibilidad con la UI anterior
                    charsUsed = balance.MonthlyUsed,
                    charLimit,
                    percentage = !balance.IsUnlimited && balance.MonthlyGranted > 0
                        ? (double)balance.MonthlyUsed / balance.MonthlyGranted * 100
                        : 0
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpeakChat] Error al obtener usage");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ==========================================================
        // POST /api/speakchat/overlay/reload
        // Fuerza la recarga de los overlays abiertos. Los overlays se auto-actualizan
        // solos al detectar un despliegue nuevo, pero esto lo hace al instante.
        // ==========================================================
        [HttpPost("overlay/reload")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ReloadOverlays()
        {
            try
            {
                var channelOwnerId = await OwnerAsync();
                var channelName = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(channelName))
                    return BadRequest(new { success = false, message = "No se pudo identificar el canal" });

                await _overlayNotificationService.NotifyOverlayRefresh(channelName);

                return Ok(new { success = true, message = "Recarga solicitada" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpeakChat] Error solicitando recarga de overlays");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ============================
        // HELPERS
        // ============================

        private const int MaxHistoryPerChannel = 100;

        /// <summary>
        /// Guarda qué campos cambió este guardado y quién lo hizo. Nunca rompe el guardado de la
        /// configuración: si el historial falla, solo queda el aviso en el registro.
        /// </summary>
        private async Task RegistrarCambiosAsync(long channelOwnerId, string channelName, string? antes, string despues)
        {
            try
            {
                var cambios = SpeakChatConfigDiff.Compute(antes, despues);
                if (cambios.Count == 0) return;

                var actorId = GetUserId();
                var actorLogin = actorId == 0 ? "" : await _dbContext.Users.AsNoTracking()
                    .Where(u => u.Id == actorId).Select(u => u.Login).FirstOrDefaultAsync() ?? "";

                _dbContext.SpeakChatConfigHistory.Add(new Decatron.Core.Models.SpeakChatConfigHistory
                {
                    UserId = channelOwnerId,
                    ChannelName = channelName,
                    ChangedByUserId = actorId,
                    ChangedByLogin = actorLogin,
                    Changes = JsonSerializer.Serialize(cambios.Select(c => new { path = c.Path, before = c.Before, after = c.After })),
                    CreatedAt = DateTime.UtcNow
                });
                await _dbContext.SaveChangesAsync();

                // Poda: se conservan solo las últimas filas del canal
                var sobrantes = await _dbContext.SpeakChatConfigHistory
                    .Where(h => h.UserId == channelOwnerId)
                    .OrderByDescending(h => h.CreatedAt).ThenByDescending(h => h.Id)
                    .Skip(MaxHistoryPerChannel)
                    .ToListAsync();
                if (sobrantes.Count > 0)
                {
                    _dbContext.SpeakChatConfigHistory.RemoveRange(sobrantes);
                    await _dbContext.SaveChangesAsync();
                }

                _logger.LogInformation("[SpeakChat] Cambios en {Channel} por {Actor}: {Campos}",
                    channelName, actorLogin, string.Join("; ", cambios.Take(10).Select(c => $"{c.Path} {c.Before ?? "∅"}→{c.After ?? "∅"}")));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[SpeakChat] No se pudo guardar el historial de cambios de {Channel}", channelName);
            }
        }

        private long GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(userIdClaim, out var userId))
                return userId;
            return 0;
        }

        /// <summary>
        /// El interruptor general que hay dentro del JSON, aparte del `IsEnabled` de la
        /// fila. Los dos tienen que estar puestos para que Speak Chat funcione, y la
        /// prueba debe respetar exactamente lo mismo que un mensaje real.
        /// </summary>
        private static bool IsGloballyEnabled(string? configJson)
        {
            if (string.IsNullOrWhiteSpace(configJson)) return false;
            try
            {
                var cfg = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(configJson);
                if (cfg.TryGetProperty("global", out var global) &&
                    global.TryGetProperty("enabled", out var enabled))
                    return enabled.GetBoolean();

                // Sin el campo se asume activo: es como se comporta el camino del chat.
                return true;
            }
            catch { return false; }
        }

        /// <summary>
        /// El dueño de la configuración y los créditos: la fila principal de la cuenta. Una sesión de Kick edita
        /// lo mismo que una de Twitch (patrón multiplataforma, un solo lugar de configuración).
        /// </summary>
        private async Task<long> OwnerAsync()
        {
            var id = GetChannelOwnerId();
            var account = await _accounts.ResolveByUserIdAsync(id);
            return account?.Principal.UserId ?? id;
        }

        private long GetChannelOwnerId()
        {
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
                return sessionId;

            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
                return channelOwnerId;

            return GetUserId();
        }

        private async Task<string?> GetChannelUsernameAsync(long channelOwnerId)
        {
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == channelOwnerId);
            return user?.Login?.ToLower();
        }
    }

    public record SpeakChatSaveRequest(JsonElement Config);
    public record SpeakChatEstimateRequest(string? Message, string? Engine, string? PollyEngine);
    public record SpeakChatTestRequest(string? Message, string? Voice, string? Engine, string? LanguageCode, string? PollyEngine);

}
