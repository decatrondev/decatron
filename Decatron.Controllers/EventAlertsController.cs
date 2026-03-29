using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using Decatron.Core.Interfaces;
using Decatron.Attributes;
using Decatron.Controllers.Dtos;
using Decatron.Data;
using Decatron.Services;
using System;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class EventAlertsController : ControllerBase
    {
        private readonly IEventAlertsService _eventAlertsService;
        private readonly ILogger<EventAlertsController> _logger;
        private readonly DecatronDbContext _dbContext;
        private readonly Decatron.Services.OverlayNotificationService _overlayNotificationService;
        private readonly ITtsService _ttsService;
        private readonly IMessageSender _messageSender;

        public EventAlertsController(
            IEventAlertsService eventAlertsService,
            ILogger<EventAlertsController> logger,
            DecatronDbContext dbContext,
            Decatron.Services.OverlayNotificationService overlayNotificationService,
            ITtsService ttsService,
            IMessageSender messageSender)
        {
            _eventAlertsService = eventAlertsService;
            _logger = logger;
            _dbContext = dbContext;
            _overlayNotificationService = overlayNotificationService;
            _ttsService = ttsService;
            _messageSender = messageSender;
        }

        // ========================================================================
        // CONFIG ENDPOINTS
        // ========================================================================

        [HttpGet("config")]
        public async Task<IActionResult> GetConfig()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var config = await _eventAlertsService.GetConfig(channelOwnerId);

                if (config == null)
                    return Ok(new { success = true, config = (object?)null });

                return Ok(new
                {
                    success = true,
                    config = new
                    {
                        data = JsonSerializer.Deserialize<JsonElement>(config.ConfigJson),
                        isEnabled = config.IsEnabled
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener config de event alerts");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        [HttpPost("config")]
        public async Task<IActionResult> SaveConfig([FromBody] EventAlertsSaveRequest body)
        {
            _logger.LogInformation("[EventAlerts] POST /config - Inicio");

            try
            {
                if (body?.Config == null)
                {
                    return BadRequest(new { success = false, message = "Config es requerida" });
                }

                var channelOwnerId = GetChannelOwnerId();
                var channelName = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(channelName))
                {
                    _logger.LogError("[EventAlerts] ChannelName vacío");
                    return Unauthorized(new { success = false, message = "No se pudo identificar el canal" });
                }

                // Validar la configuración
                var configJson = JsonSerializer.Serialize(body.Config);
                var validationErrors = ValidateConfig(configJson);
                if (validationErrors.Count > 0)
                {
                    _logger.LogWarning("[EventAlerts] Validación fallida: {Errors}", string.Join(", ", validationErrors));
                    return BadRequest(new { success = false, message = "Configuración inválida", errors = validationErrors });
                }

                await _eventAlertsService.SaveConfig(channelOwnerId, channelName, configJson);

                _logger.LogInformation("[EventAlerts] Config guardada para {Channel}", channelName);
                return Ok(new { success = true, message = "Configuración guardada" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[EventAlerts] Error al guardar config: {Message}", ex.Message);
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        /// <summary>
        /// Valida la configuración de Event Alerts.
        /// Retorna lista de errores (vacía si todo está bien).
        /// </summary>
        private static List<string> ValidateConfig(string configJson)
        {
            var errors = new List<string>();

            try
            {
                var config = JsonSerializer.Deserialize<JsonElement>(configJson);

                // Validar global
                if (config.TryGetProperty("global", out var global))
                {
                    if (global.TryGetProperty("defaultDuration", out var dur) &&
                        (dur.GetInt32() < 1 || dur.GetInt32() > 60))
                        errors.Add("defaultDuration debe estar entre 1 y 60 segundos");

                    if (global.TryGetProperty("defaultVolume", out var vol) &&
                        (vol.GetInt32() < 0 || vol.GetInt32() > 100))
                        errors.Add("defaultVolume debe estar entre 0 y 100");

                    if (global.TryGetProperty("cooldownSettings", out var cd))
                    {
                        if (cd.TryGetProperty("globalCooldown", out var gcd) && gcd.GetInt32() < 0)
                            errors.Add("globalCooldown no puede ser negativo");
                        if (cd.TryGetProperty("perEventCooldown", out var pcd) && pcd.GetInt32() < 0)
                            errors.Add("perEventCooldown no puede ser negativo");
                    }

                    // Validar TTS global
                    if (global.TryGetProperty("tts", out var globalTts))
                    {
                        ValidateTtsConfig(globalTts, "global.tts", errors);
                    }
                }

                // Validar cada tipo de evento
                string[] eventTypes = { "follow", "bits", "subs", "giftSubs", "raids", "resubs", "hypeTrain" };
                foreach (var eventType in eventTypes)
                {
                    if (config.TryGetProperty(eventType, out var eventCfg))
                    {
                        ValidateEventConfig(eventCfg, eventType, errors);
                    }
                }
            }
            catch (JsonException)
            {
                errors.Add("JSON de configuración inválido");
            }

            return errors;
        }

        private static void ValidateTtsConfig(JsonElement tts, string path, List<string> errors)
        {
            if (tts.TryGetProperty("templateVolume", out var tv) &&
                (tv.GetInt32() < 0 || tv.GetInt32() > 100))
                errors.Add($"{path}.templateVolume debe estar entre 0 y 100");

            if (tts.TryGetProperty("userMessageVolume", out var uv) &&
                (uv.GetInt32() < 0 || uv.GetInt32() > 100))
                errors.Add($"{path}.userMessageVolume debe estar entre 0 y 100");

            if (tts.TryGetProperty("maxChars", out var mc) &&
                (mc.GetInt32() < 10 || mc.GetInt32() > 500))
                errors.Add($"{path}.maxChars debe estar entre 10 y 500");

            // Validar volume legacy
            if (tts.TryGetProperty("volume", out var vol) &&
                (vol.GetInt32() < 0 || vol.GetInt32() > 100))
                errors.Add($"{path}.volume debe estar entre 0 y 100");
        }

        private static void ValidateAlertConfig(JsonElement alert, string path, List<string> errors)
        {
            if (alert.TryGetProperty("duration", out var dur) &&
                (dur.GetInt32() < 1 || dur.GetInt32() > 60))
                errors.Add($"{path}.duration debe estar entre 1 y 60 segundos");

            if (alert.TryGetProperty("volume", out var vol) &&
                (vol.GetInt32() < 0 || vol.GetInt32() > 100))
                errors.Add($"{path}.volume debe estar entre 0 y 100");

            if (alert.TryGetProperty("videoVolume", out var vv) &&
                (vv.GetInt32() < 0 || vv.GetInt32() > 100))
                errors.Add($"{path}.videoVolume debe estar entre 0 y 100");

            if (alert.TryGetProperty("tts", out var tts))
            {
                ValidateTtsConfig(tts, $"{path}.tts", errors);
            }
        }

        private static void ValidateEventConfig(JsonElement eventCfg, string eventType, List<string> errors)
        {
            // follow tiene "alert"
            if (eventCfg.TryGetProperty("alert", out var alert))
            {
                ValidateAlertConfig(alert, $"{eventType}.alert", errors);
            }

            // bits, giftSubs, raids, resubs tienen "baseAlert" y "tiers"
            if (eventCfg.TryGetProperty("baseAlert", out var baseAlert))
            {
                ValidateAlertConfig(baseAlert, $"{eventType}.baseAlert", errors);
            }

            if (eventCfg.TryGetProperty("tiers", out var tiers) && tiers.ValueKind == JsonValueKind.Array)
            {
                int i = 0;
                foreach (var tier in tiers.EnumerateArray())
                {
                    ValidateAlertConfig(tier, $"{eventType}.tiers[{i}]", errors);
                    i++;
                }
            }

            // subs tiene "subTypes" con tier1, tier2, tier3, prime
            if (eventCfg.TryGetProperty("subTypes", out var subTypes))
            {
                string[] subTiers = { "tier1", "tier2", "tier3", "prime" };
                foreach (var st in subTiers)
                {
                    if (subTypes.TryGetProperty(st, out var subTierCfg))
                    {
                        ValidateAlertConfig(subTierCfg, $"{eventType}.subTypes.{st}", errors);
                    }
                }
            }

            // hypeTrain tiene "levels" y "completionAlert"
            if (eventCfg.TryGetProperty("levels", out var levels))
            {
                for (int lvl = 1; lvl <= 5; lvl++)
                {
                    if (levels.TryGetProperty(lvl.ToString(), out var levelCfg))
                    {
                        ValidateAlertConfig(levelCfg, $"{eventType}.levels.{lvl}", errors);
                    }
                }
            }

            if (eventCfg.TryGetProperty("completionAlert", out var completion))
            {
                ValidateAlertConfig(completion, $"{eventType}.completionAlert", errors);
            }

            // Cooldown del evento
            if (eventCfg.TryGetProperty("cooldown", out var cd) && cd.GetInt32() < 0)
            {
                errors.Add($"{eventType}.cooldown no puede ser negativo");
            }
        }

        // ========================================================================
        // TESTING ENDPOINT
        // ========================================================================

        [HttpPost("test")]
        public async Task<IActionResult> TestAlert([FromBody] JsonElement body)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var channelName = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(channelName))
                    return BadRequest(new { success = false, message = "No se pudo identificar el canal" });

                // Obtener configuración del usuario
                var config = await _eventAlertsService.GetConfig(channelOwnerId);
                if (config == null)
                    return BadRequest(new { success = false, message = "No hay configuración guardada" });

                var configData = JsonSerializer.Deserialize<JsonElement>(config.ConfigJson);

                // Extraer parámetros del test
                var eventType = body.GetProperty("eventType").GetString() ?? "follow";
                var username = body.TryGetProperty("username", out var userProp) ? userProp.GetString() : "TestUser123";
                var message = body.TryGetProperty("message", out var msgProp) ? msgProp.GetString() : "¡Este es un mensaje de prueba!";
                var amount = body.TryGetProperty("amount", out var amountProp) ? amountProp.GetInt32() : 0;

                _logger.LogInformation("🧪 [EventAlerts] Testing: {EventType} user={User} amount={Amount}", eventType, username, amount);

                // Obtener configuración del evento específico
                var eventConfig = configData.GetProperty(eventType);

                // Extraer el objeto de alerta anidado según la estructura del evento:
                // - follow → alert
                // - subs → subTypes.tier1 (para testing)
                // - hypeTrain → levels.X según amount
                // - bits/giftSubs/raids/resubs → tier que coincida con amount, o baseAlert
                JsonElement alertConfig;
                if (eventType == "follow")
                {
                    alertConfig = eventConfig.TryGetProperty("alert", out var followAlert) ? followAlert : eventConfig;
                }
                else if (eventType == "subs")
                {
                    alertConfig = eventConfig.TryGetProperty("subTypes", out var subTypes) &&
                                  subTypes.TryGetProperty("tier1", out var tier1Alert) ? tier1Alert : eventConfig;
                }
                else if (eventType == "hypeTrain")
                {
                    // Usar amount como level (1-5)
                    var levelKey = Math.Clamp(amount > 0 ? amount : 1, 1, 5).ToString();
                    alertConfig = eventConfig.TryGetProperty("levels", out var levels) &&
                                  levels.TryGetProperty(levelKey, out var levelAlert) ? levelAlert : eventConfig;
                }
                else
                {
                    // bits, giftSubs, raids, resubs → buscar tier que coincida con amount
                    alertConfig = FindMatchingTierOrBase(eventConfig, amount);
                }

                var tierName = alertConfig.TryGetProperty("name", out var tierNameProp) ? tierNameProp.GetString() : "(base)";
                _logger.LogInformation("🧪 [EventAlerts] AlertConfig extraído para {EventType}, amount={Amount}, tier={Tier}", eventType, amount, tierName);

                // ========== SISTEMA DE VARIANTES ==========
                // Verificar si el tier/alerta tiene variantes habilitadas
                var alertId = alertConfig.TryGetProperty("id", out var alertIdProp) ? alertIdProp.GetString() ?? eventType : eventType;
                var selectedVariant = SelectVariantIfEnabled(alertConfig, channelName, alertId);
                if (selectedVariant.HasValue)
                {
                    var variantName = selectedVariant.Value.TryGetProperty("name", out var vn) ? vn.GetString() : "?";
                    _logger.LogInformation("🎲 [EventAlerts] ✅ VARIANTE SELECCIONADA: {Name}", variantName);
                    alertConfig = selectedVariant.Value;
                }
                else
                {
                    _logger.LogInformation("🎲 [EventAlerts] Sin variante, usando config del tier/base");
                }

                // TTS - Separado en dos URLs: template y user message
                string? ttsTemplateUrl = null;
                string? ttsUserMessageUrl = null;
                int ttsTemplateVolume = 80;
                int ttsUserMessageVolume = 80;
                // Legacy
                string? ttsUrl = null;
                int ttsVolume = 80;

                if (alertConfig.TryGetProperty("tts", out var ttsConfig) &&
                    ttsConfig.TryGetProperty("enabled", out var ttsEnabled) &&
                    ttsEnabled.GetBoolean())
                {
                    var template = ttsConfig.TryGetProperty("template", out var tmplProp) ? tmplProp.GetString() ?? "" : "";
                    var voice = ttsConfig.TryGetProperty("voice", out var voiceProp) ? voiceProp.GetString() ?? "Lupe" : "Lupe";
                    var engine = ttsConfig.TryGetProperty("engine", out var engineProp) ? engineProp.GetString() ?? "standard" : "standard";
                    var languageCode = ttsConfig.TryGetProperty("languageCode", out var langProp) ? langProp.GetString() ?? "es-US" : "es-US";

                    // Volúmenes separados (con fallback a volume legacy)
                    var legacyVolume = ttsConfig.TryGetProperty("volume", out var volProp) ? volProp.GetInt32() : 80;
                    ttsTemplateVolume = ttsConfig.TryGetProperty("templateVolume", out var tvP) ? tvP.GetInt32() : legacyVolume;
                    ttsUserMessageVolume = ttsConfig.TryGetProperty("userMessageVolume", out var uvP) ? uvP.GetInt32() : legacyVolume;
                    ttsVolume = legacyVolume;

                    // [3/4] TTS del template ("¡Gracias {username}!")
                    if (!string.IsNullOrWhiteSpace(template))
                    {
                        var templateText = template
                            .Replace("{username}", username ?? "TestUser")
                            .Replace("{amount}", amount.ToString())
                            .Replace("{viewers}", amount.ToString())
                            .Replace("{months}", amount.ToString())
                            .Replace("{tier}", "Tier 1")
                            .Replace("{level}", amount.ToString())
                            .Replace("{message}", ""); // No incluir mensaje en template

                        if (!string.IsNullOrWhiteSpace(templateText))
                        {
                            _logger.LogInformation("🔊 [EventAlerts] Generando TTS Template: '{Text}' con voz {Voice}", templateText, voice);
                            ttsTemplateUrl = await _ttsService.GenerateAsync(templateText, voice, engine, languageCode, channelName);
                        }
                    }

                    // [4/4] TTS del mensaje del usuario
                    var readUserMsg = ttsConfig.TryGetProperty("readUserMessage", out var rumProp) && rumProp.GetBoolean();
                    if (readUserMsg && !string.IsNullOrEmpty(message))
                    {
                        var maxChars = ttsConfig.TryGetProperty("maxChars", out var mcProp) ? mcProp.GetInt32() : 150;
                        var truncated = message.Length > maxChars ? message[..maxChars] : message;
                        if (!string.IsNullOrWhiteSpace(truncated))
                        {
                            _logger.LogInformation("🔊 [EventAlerts] Generando TTS UserMessage: '{Text}' con voz {Voice}", truncated, voice);
                            ttsUserMessageUrl = await _ttsService.GenerateAsync(truncated, voice, engine, languageCode, channelName);
                        }
                    }

                    // Legacy: primer URL disponible para compatibilidad hacia atrás
                    ttsUrl = ttsTemplateUrl ?? ttsUserMessageUrl;

                    if (string.IsNullOrWhiteSpace(ttsTemplateUrl) && string.IsNullOrWhiteSpace(ttsUserMessageUrl))
                    {
                        _logger.LogWarning("⚠️ [EventAlerts] TTS habilitado pero texto vacío para {EventType}", eventType);
                    }
                }

                // Media
                string? mediaUrl = null;
                string? mediaType = null;
                bool videoMuted = true;
                bool playVideoAudio = false;
                int videoVolume = 80;
                string? soundUrl = null;
                int soundVolume = 80;

                // TODO: ExtractMediaFromConfig is duplicated in EventAlertsService.cs — refactor to share a single implementation
                void ExtractMediaFromConfig(JsonElement cfg, string source)
                {
                    if (!cfg.TryGetProperty("media", out var mediaConfig)) return;

                    var isEnabled = mediaConfig.TryGetProperty("enabled", out var mediaEnabled) && mediaEnabled.GetBoolean();
                    var mediaMode = mediaConfig.TryGetProperty("mode", out var mediaModeProp) ? mediaModeProp.GetString() : "simple";
                    _logger.LogInformation("🧪 [EventAlerts] Media ({Source}): enabled={Enabled}, mode={Mode}", source, isEnabled, mediaMode);

                    if (!isEnabled) return;

                    _logger.LogInformation("🧪 [EventAlerts] Checking mode: mediaMode='{Mode}', hasAdvanced={HasAdv}",
                        mediaMode, mediaConfig.TryGetProperty("advanced", out _));

                    if (mediaMode == "advanced" && mediaConfig.TryGetProperty("advanced", out var advMedia))
                    {
                        _logger.LogInformation("🧪 [EventAlerts] ADVANCED mode, advMedia={AdvMedia}", advMedia.ToString());

                        // Video principal
                        var hasVideo = advMedia.TryGetProperty("video", out var advVideo);
                        string? videoUrlValue = null;
                        if (hasVideo && advVideo.TryGetProperty("url", out var advVideoUrl))
                        {
                            videoUrlValue = advVideoUrl.GetString();
                        }

                        _logger.LogInformation("🧪 [EventAlerts] Video check: hasVideo={HasVideo}, url={Url}",
                            hasVideo, videoUrlValue ?? "(null)");

                        if (hasVideo && !string.IsNullOrEmpty(videoUrlValue))
                        {
                            mediaUrl = videoUrlValue;
                            mediaType = "video";
                            videoVolume = advVideo.TryGetProperty("volume", out var advVideoVol) ? advVideoVol.GetInt32() : 80;
                            videoMuted = videoVolume == 0;
                            playVideoAudio = videoVolume > 0;
                            _logger.LogInformation("🧪 [EventAlerts] Video EXTRACTED: URL={Url}, Vol={Vol}, PlayAudio={Play}",
                                mediaUrl, videoVolume, playVideoAudio);
                        }
                        // Imagen principal
                        else if (advMedia.TryGetProperty("image", out var advImage) &&
                                 advImage.TryGetProperty("url", out var advImageUrl) &&
                                 !string.IsNullOrEmpty(advImageUrl.GetString()))
                        {
                            mediaUrl = advImageUrl.GetString();
                            mediaType = "image";
                            _logger.LogInformation("🧪 [EventAlerts] Image found ({Source}): URL={Url}", source, mediaUrl);
                        }
                        // Audio
                        if (advMedia.TryGetProperty("audio", out var advAudio) &&
                            advAudio.TryGetProperty("url", out var advAudioUrl) &&
                            !string.IsNullOrEmpty(advAudioUrl.GetString()))
                        {
                            soundUrl = advAudioUrl.GetString();
                            soundVolume = advAudio.TryGetProperty("volume", out var advAudioVol) ? advAudioVol.GetInt32() : 80;
                            _logger.LogInformation("🧪 [EventAlerts] Audio found ({Source}): URL={Url}", source, soundUrl);
                            // Audio-only con visual de fondo
                            if (string.IsNullOrEmpty(mediaUrl) &&
                                advMedia.TryGetProperty("image", out var backingImg) &&
                                backingImg.TryGetProperty("url", out var backingImgUrl) &&
                                !string.IsNullOrEmpty(backingImgUrl.GetString()))
                            {
                                mediaUrl = backingImgUrl.GetString();
                                mediaType = "image";
                            }
                        }
                    }
                    else
                    {
                        _logger.LogInformation("🧪 [EventAlerts] NOT advanced mode, using simple/legacy fallback");

                        // Modo simple: buscar en media.simple.url/type (estructura actual)
                        // y fallback a media.url/type (legacy)
                        if (mediaConfig.TryGetProperty("simple", out var simpleCfg))
                        {
                            mediaUrl = simpleCfg.TryGetProperty("url", out var simpleUrl) ? simpleUrl.GetString() : null;
                            mediaType = simpleCfg.TryGetProperty("type", out var simpleType) ? simpleType.GetString() : "image";
                            var simpleVolume = simpleCfg.TryGetProperty("volume", out var simpleVol) ? simpleVol.GetInt32() : 80;

                            // Si es video, configurar audio del video
                            if (mediaType == "video")
                            {
                                videoVolume = simpleVolume;
                                videoMuted = simpleVolume == 0;
                                playVideoAudio = simpleVolume > 0;
                            }
                            // Si es audio, usar como soundUrl
                            else if (mediaType == "audio")
                            {
                                soundUrl = mediaUrl;
                                soundVolume = simpleVolume;
                                mediaUrl = null; // El audio no es visual
                                mediaType = null;
                            }

                            _logger.LogInformation("🧪 [EventAlerts] Simple mode: URL={Url}, Type={Type}, Volume={Vol}",
                                mediaUrl ?? soundUrl ?? "(none)", mediaType ?? "audio", simpleVolume);
                        }
                        else
                        {
                            // Legacy: media.url/type directamente
                            mediaUrl = mediaConfig.TryGetProperty("url", out var urlProp) ? urlProp.GetString() : null;
                            var legacyType = mediaConfig.TryGetProperty("type", out var typeProp) ? typeProp.GetString() : null;

                            // Si no hay type definido, detectar por extensión
                            if (string.IsNullOrEmpty(legacyType) && !string.IsNullOrEmpty(mediaUrl))
                            {
                                var ext = mediaUrl.ToLower().Split('?')[0].Split('.').LastOrDefault() ?? "";
                                if (new[] { "mp4", "webm", "mov", "mkv", "avi", "m4v" }.Contains(ext))
                                    legacyType = "video";
                                else
                                    legacyType = "image";
                            }
                            mediaType = legacyType ?? "image";

                            // Si es video, configurar playVideoAudio
                            if (mediaType == "video")
                            {
                                videoVolume = mediaConfig.TryGetProperty("videoVolume", out var vvP) ? vvP.GetInt32() : 80;
                                videoMuted = mediaConfig.TryGetProperty("muteVideo", out var mvP) && mvP.GetBoolean();
                                playVideoAudio = !videoMuted && videoVolume > 0;
                                _logger.LogInformation("🧪 [EventAlerts] Legacy video: URL={Url}, Volume={Vol}, PlayAudio={Play}",
                                    mediaUrl, videoVolume, playVideoAudio);
                            }
                        }

                        // muteVideo y soundUrl/soundVolume (campos legacy adicionales)
                        if (mediaType != "video" && mediaConfig.TryGetProperty("muteVideo", out var muteProp))
                            videoMuted = muteProp.GetBoolean();
                        if (string.IsNullOrEmpty(soundUrl))
                        {
                            soundUrl = mediaConfig.TryGetProperty("soundUrl", out var sndProp) ? sndProp.GetString() : null;
                            soundVolume = mediaConfig.TryGetProperty("soundVolume", out var sndVolProp) ? sndVolProp.GetInt32() : 80;
                        }
                    }
                }

                // 1. Primero intentar extraer del tier/alerta seleccionada
                ExtractMediaFromConfig(alertConfig, "tier/alert");

                _logger.LogInformation("🧪 [EventAlerts] After tier/alert: mediaUrl={MediaUrl}, mediaType={MediaType}, playVideoAudio={PlayAudio}, videoVolume={Vol}",
                    mediaUrl ?? "(null)", mediaType ?? "(null)", playVideoAudio, videoVolume);

                // También puede haber sound en el campo legacy de BaseAlertConfig
                if (string.IsNullOrEmpty(soundUrl) && alertConfig.TryGetProperty("sound", out var legacySoundProp))
                {
                    soundUrl = legacySoundProp.GetString();
                    // Usar el volume del alertConfig como volumen del sound
                    if (alertConfig.TryGetProperty("volume", out var alertVolProp))
                        soundVolume = alertVolProp.GetInt32();
                }

                // 2. Si todavía falta media o sonido, intentar heredar del baseAlert
                if (eventConfig.TryGetProperty("baseAlert", out var baseAlert))
                {
                    // Si no hay mediaUrl, intentar extraer del baseAlert
                    if (string.IsNullOrEmpty(mediaUrl))
                    {
                        _logger.LogInformation("🧪 [EventAlerts] No media in tier, trying baseAlert fallback...");
                        ExtractMediaFromConfig(baseAlert, "baseAlert (media fallback)");
                    }

                    // Si no hay soundUrl, intentar extraer del baseAlert
                    if (string.IsNullOrEmpty(soundUrl))
                    {
                        _logger.LogInformation("🧪 [EventAlerts] No sound in tier, trying baseAlert fallback...");
                        if (baseAlert.TryGetProperty("media", out var baseMediaCfg))
                        {
                            var baseMediaMode = baseMediaCfg.TryGetProperty("mode", out var m) ? m.GetString() : "simple";
                            if (baseMediaMode == "advanced")
                            {
                                if (baseMediaCfg.TryGetProperty("advanced", out var adv) &&
                                    adv.TryGetProperty("audio", out var aud) &&
                                    aud.TryGetProperty("url", out var url) &&
                                    !string.IsNullOrEmpty(url.GetString()))
                                {
                                    soundUrl = url.GetString();
                                    soundVolume = aud.TryGetProperty("volume", out var vol) ? vol.GetInt32() : 80;
                                }
                            }
                            else
                            {
                                soundUrl = baseMediaCfg.TryGetProperty("soundUrl", out var url) ? url.GetString() : null;
                                soundVolume = baseMediaCfg.TryGetProperty("soundVolume", out var vol) ? vol.GetInt32() : 80;
                            }
                        }

                        // Fallback legacy para sound en baseAlert
                        if (string.IsNullOrEmpty(soundUrl) && baseAlert.TryGetProperty("sound", out var bSnd))
                        {
                            soundUrl = bSnd.GetString();
                            if (baseAlert.TryGetProperty("volume", out var bVol))
                                soundVolume = bVol.GetInt32();
                        }
                    }
                }

                _logger.LogInformation("🔊 [EventAlerts] Sound extraído: URL={SoundUrl}, Volume={Volume}",
                    soundUrl ?? "(none)", soundVolume);

                // waitForSound: TTS siempre espera al sonido de alerta (secuencial por defecto)
                var waitForSound = true;
                if (ttsConfig.ValueKind != JsonValueKind.Undefined &&
                    ttsConfig.TryGetProperty("waitForSound", out var wfsProp))
                {
                    waitForSound = wfsProp.GetBoolean();
                }

                // Duración: config almacena en segundos → convertir a milisegundos para el overlay
                var durationSeconds = alertConfig.TryGetProperty("duration", out var durProp) ? durProp.GetInt32() : 5;
                var duration = durationSeconds * 1000;

                // Animación: config almacena tipo (fade/slide/bounce/zoom) → mapear a animationIn/Out
                var animationType = "fade";
                if (alertConfig.TryGetProperty("animation", out var animProp) &&
                    animProp.TryGetProperty("type", out var animTypeProp))
                {
                    animationType = animTypeProp.GetString() ?? "fade";
                }
                var animationIn = animationType switch
                {
                    "slide" => "slideIn",
                    "bounce" => "bounceIn",
                    "zoom" => "zoomIn",
                    _ => "fadeIn"
                };
                var animationOut = animationType switch
                {
                    "slide" => "slideOut",
                    "bounce" => "bounceOut",
                    "zoom" => "zoomOut",
                    _ => "fadeOut"
                };

                // Posición (legado)
                var position = new { x = 50, y = 50 };

                if (alertConfig.TryGetProperty("position", out var posProp))
                {
                    position = new
                    {
                        x = posProp.TryGetProperty("x", out var xProp) ? xProp.GetInt32() : 50,
                        y = posProp.TryGetProperty("y", out var yProp) ? yProp.GetInt32() : 50
                    };
                }

                // Style (primero global, luego específico del evento)
                var style = ExtractStyleConfig(configData, alertConfig);

                // overlayElements: posiciones independientes de CARD, MEDIA y TEXT
                var overlayElements = ExtractOverlayElements(configData);

                // queueSettings: configuración de cola de alertas
                var queueSettings = ExtractQueueSettings(configData);

                // Effects
                string[] effects = Array.Empty<string>();
                if (alertConfig.TryGetProperty("effects", out var effectsCfg) &&
                    effectsCfg.TryGetProperty("enabled", out var effectsOn) &&
                    effectsOn.GetBoolean() &&
                    effectsCfg.TryGetProperty("effects", out var effectsList))
                {
                    effects = effectsList.EnumerateArray()
                        .Select(e => e.GetString() ?? "")
                        .Where(e => !string.IsNullOrEmpty(e))
                        .ToArray();
                }

                // CORRECCIÓN FINAL: Si hay video con volumen, forzar playVideoAudio
                // Detectar video por extensión de URL o por mediaType
                var isVideo = mediaType == "video" ||
                              (!string.IsNullOrEmpty(mediaUrl) &&
                               (mediaUrl.EndsWith(".mp4", StringComparison.OrdinalIgnoreCase) ||
                                mediaUrl.EndsWith(".webm", StringComparison.OrdinalIgnoreCase) ||
                                mediaUrl.EndsWith(".mov", StringComparison.OrdinalIgnoreCase)));

                _logger.LogWarning("🔴 [EventAlerts] FINAL CHECK: mediaType={MediaType}, mediaUrl={Url}, isVideo={IsVideo}, videoVolume={Vol}",
                    mediaType ?? "(null)", mediaUrl ?? "(null)", isVideo, videoVolume);

                if (isVideo && videoVolume > 0)
                {
                    playVideoAudio = true;
                    videoMuted = false;
                    mediaType = "video"; // Asegurar que mediaType sea video
                    _logger.LogWarning("🔴 [EventAlerts] FORCED playVideoAudio=true for video");
                }

                // Construir datos completos
                var testData = new
                {
                    eventType,
                    username = username ?? "TestUser123",
                    amount,
                    tier = "1",
                    months = amount > 0 ? amount : 1,
                    viewers = amount > 0 ? amount : 5,
                    level = amount > 0 ? amount : 1,
                    message = message ?? "",
                    mediaType,
                    mediaUrl = mediaUrl ?? "",

                    // [1/4] Sonido de alerta
                    soundUrl = soundUrl ?? "",
                    soundVolume,

                    // [2/4] Audio del video
                    playVideoAudio,
                    videoVolume,
                    videoMuted, // Legacy

                    // [3/4] TTS del template
                    ttsTemplateUrl = ttsTemplateUrl ?? "",
                    ttsTemplateVolume,

                    // [4/4] TTS del mensaje del usuario
                    ttsUserMessageUrl = ttsUserMessageUrl ?? "",
                    ttsUserMessageVolume,

                    // Legacy (compatibilidad hacia atrás)
                    ttsUrl = ttsUrl ?? "",
                    ttsVolume,
                    waitForSound,

                    duration,
                    animationIn = animationIn ?? "fadeIn",
                    animationOut = animationOut ?? "fadeOut",
                    effects,
                    position,
                    style,
                    overlayElements,
                    queueSettings
                };

                // Enviar via SignalR
                await _overlayNotificationService.SendToChannel(channelName, "ShowEventAlert", testData);

                // Enviar mensaje de chat si está configurado
                await SendChatMessageIfEnabled(alertConfig, channelName, username ?? "TestUser", amount, "Tier 1", amount, amount, message);

                _logger.LogInformation("✅ [EventAlerts] Test enviado: TTS={HasTTS} Media={HasMedia}",
                    !string.IsNullOrEmpty(ttsUrl), !string.IsNullOrEmpty(mediaUrl));

                return Ok(new { success = true, message = "Alerta de prueba enviada" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ [EventAlerts] Error enviando test alert");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ========================================================================
        // OVERLAY ENDPOINT (no auth)
        // ========================================================================

        [HttpGet("config/overlay/{channelName}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetOverlayConfig(string channelName)
        {
            try
            {
                var config = await _eventAlertsService.GetConfigByChannel(channelName);

                if (config == null || !config.IsEnabled)
                    return Ok(new { success = true, config = (object?)null });

                return Ok(new
                {
                    success = true,
                    config = JsonSerializer.Deserialize<JsonElement>(config.ConfigJson)
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener config de event alerts overlay para {Channel}", channelName);
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ========================================================================
        // HELPERS
        // ========================================================================

        /// <summary>
        /// Extrae la configuración de estilo, primero de global.defaultStyle y luego sobrescribe con alertConfig.style
        /// </summary>
        // TODO: ExtractStyleConfig is duplicated in EventAlertsService.cs — refactor to share a single implementation
        private static object ExtractStyleConfig(JsonElement configData, JsonElement alertConfig)
        {
            var bgType = "color";
            var bgColor = "rgba(0,0,0,0.85)";
            var bgGradColor1 = "#1a1a2e";
            var bgGradColor2 = "#16213e";
            var bgGradAngle = 135;
            var bgImage = "";
            var opacity = 100;
            var borderEnabled = true;
            var borderColor = "rgba(255,255,255,0.2)";
            var borderWidth = 2;
            var borderRadius = 16;
            var padding = 24;
            var width = 400;
            var height = 300;
            var mediaLayout = "top";
            var mediaObjectFit = "contain";
            var fontFamily = "Inter, sans-serif";
            var fontSize = 18;
            var fontWeight = "bold";
            var textColor = "#ffffff";
            var textShadow = "normal";
            var textAlign = "center";

            // Helper para aplicar estilos de un JsonElement
            void ApplyStyle(JsonElement styleCfg)
            {
                if (styleCfg.TryGetProperty("backgroundType", out var p)) bgType = p.GetString() ?? bgType;
                if (styleCfg.TryGetProperty("backgroundColor", out var p2)) bgColor = p2.GetString() ?? bgColor;
                if (styleCfg.TryGetProperty("backgroundImage", out var p3)) bgImage = p3.GetString() ?? bgImage;
                if (styleCfg.TryGetProperty("opacity", out var p4)) opacity = p4.GetInt32();
                if (styleCfg.TryGetProperty("borderEnabled", out var p5)) borderEnabled = p5.GetBoolean();
                if (styleCfg.TryGetProperty("borderColor", out var p6)) borderColor = p6.GetString() ?? borderColor;
                if (styleCfg.TryGetProperty("borderWidth", out var p7)) borderWidth = p7.GetInt32();
                if (styleCfg.TryGetProperty("borderRadius", out var p8)) borderRadius = p8.GetInt32();
                if (styleCfg.TryGetProperty("padding", out var p9)) padding = p9.GetInt32();
                if (styleCfg.TryGetProperty("width", out var p10)) width = p10.GetInt32();
                if (styleCfg.TryGetProperty("height", out var p11)) height = p11.GetInt32();
                if (styleCfg.TryGetProperty("mediaLayout", out var p12)) mediaLayout = p12.GetString() ?? mediaLayout;
                if (styleCfg.TryGetProperty("mediaObjectFit", out var p13)) mediaObjectFit = p13.GetString() ?? mediaObjectFit;
                if (styleCfg.TryGetProperty("fontFamily", out var p14)) fontFamily = p14.GetString() ?? fontFamily;
                if (styleCfg.TryGetProperty("fontSize", out var p15)) fontSize = p15.GetInt32();
                if (styleCfg.TryGetProperty("fontWeight", out var p16)) fontWeight = p16.GetString() ?? fontWeight;
                if (styleCfg.TryGetProperty("textColor", out var p17)) textColor = p17.GetString() ?? textColor;
                if (styleCfg.TryGetProperty("textShadow", out var p18)) textShadow = p18.GetString() ?? textShadow;
                if (styleCfg.TryGetProperty("textAlign", out var p19)) textAlign = p19.GetString() ?? textAlign;

                if (styleCfg.TryGetProperty("backgroundGradient", out var grad))
                {
                    if (grad.TryGetProperty("color1", out var gc1)) bgGradColor1 = gc1.GetString() ?? bgGradColor1;
                    if (grad.TryGetProperty("color2", out var gc2)) bgGradColor2 = gc2.GetString() ?? bgGradColor2;
                    if (grad.TryGetProperty("angle", out var ga)) bgGradAngle = ga.GetInt32();
                }
            }

            // 1. Primero aplicar estilos globales (global.defaultStyle)
            if (configData.TryGetProperty("global", out var globalCfg) &&
                globalCfg.TryGetProperty("defaultStyle", out var globalStyle))
            {
                ApplyStyle(globalStyle);
            }

            // 2. Luego sobrescribir con estilos específicos del evento (alertConfig.style)
            if (alertConfig.TryGetProperty("style", out var alertStyle))
            {
                ApplyStyle(alertStyle);
            }

            return new
            {
                backgroundType = bgType,
                backgroundColor = bgColor,
                backgroundGradient = new { color1 = bgGradColor1, color2 = bgGradColor2, angle = bgGradAngle },
                backgroundImage = bgImage,
                opacity,
                borderEnabled,
                borderColor,
                borderWidth,
                borderRadius,
                padding,
                width,
                height,
                mediaLayout,
                mediaObjectFit,
                fontFamily,
                fontSize,
                fontWeight,
                textColor,
                textShadow,
                textAlign,
            };
        }

        // TODO: ExtractOverlayElements is duplicated in EventAlertsService.cs — refactor to share a single implementation
        private static object ExtractOverlayElements(JsonElement configData)
        {
            // Defaults: card 600x500 centrado, media y texto proporcionados
            var card  = new { x = 660, y = 290, width = 600, height = 500, enabled = true };
            var media = new { x = 690, y = 320, width = 540, height = 220, enabled = true };
            var text  = new { x = 690, y = 560, width = 540, height = 200, enabled = true };

            if (!configData.TryGetProperty("global", out var globalEl) ||
                !globalEl.TryGetProperty("overlayElements", out var oeEl))
            {
                return new { card, media, text };
            }

            if (oeEl.TryGetProperty("card", out var cardEl))
            {
                card = new
                {
                    x       = cardEl.TryGetProperty("x",       out var cx)  ? cx.GetInt32()  : 760,
                    y       = cardEl.TryGetProperty("y",       out var cy)  ? cy.GetInt32()  : 390,
                    width   = cardEl.TryGetProperty("width",   out var cw)  ? cw.GetInt32()  : 400,
                    height  = cardEl.TryGetProperty("height",  out var ch)  ? ch.GetInt32()  : 300,
                    enabled = cardEl.TryGetProperty("enabled", out var cen) ? cen.GetBoolean() : true,
                };
            }

            if (oeEl.TryGetProperty("media", out var mediaEl))
            {
                media = new
                {
                    x       = mediaEl.TryGetProperty("x",       out var mx)  ? mx.GetInt32()  : 780,
                    y       = mediaEl.TryGetProperty("y",       out var my)  ? my.GetInt32()  : 410,
                    width   = mediaEl.TryGetProperty("width",   out var mw)  ? mw.GetInt32()  : 360,
                    height  = mediaEl.TryGetProperty("height",  out var mh)  ? mh.GetInt32()  : 120,
                    enabled = mediaEl.TryGetProperty("enabled", out var men) ? men.GetBoolean() : true,
                };
            }

            if (oeEl.TryGetProperty("text", out var textEl))
            {
                text = new
                {
                    x       = textEl.TryGetProperty("x",       out var tx)  ? tx.GetInt32()  : 780,
                    y       = textEl.TryGetProperty("y",       out var ty)  ? ty.GetInt32()  : 550,
                    width   = textEl.TryGetProperty("width",   out var tw)  ? tw.GetInt32()  : 360,
                    height  = textEl.TryGetProperty("height",  out var th)  ? th.GetInt32()  : 120,
                    enabled = textEl.TryGetProperty("enabled", out var ten) ? ten.GetBoolean() : true,
                };
            }

            return new { card, media, text };
        }

        /// <summary>
        /// Extrae la configuración de cola de alertas desde global.queueSettings
        /// </summary>
        // TODO: ExtractQueueSettings is duplicated in EventAlertsService.cs — refactor to share a single implementation
        private static object ExtractQueueSettings(JsonElement configData)
        {
            // Defaults
            var enabled = true;
            var maxQueueSize = 10;
            var delayBetweenAlerts = 1000;
            var showQueueCounter = false;

            if (configData.TryGetProperty("global", out var globalCfg) &&
                globalCfg.TryGetProperty("queueSettings", out var qsCfg))
            {
                if (qsCfg.TryGetProperty("enabled", out var e)) enabled = e.GetBoolean();
                if (qsCfg.TryGetProperty("maxQueueSize", out var mqs)) maxQueueSize = mqs.GetInt32();
                if (qsCfg.TryGetProperty("delayBetweenAlerts", out var dba)) delayBetweenAlerts = dba.GetInt32();
                if (qsCfg.TryGetProperty("showQueueCounter", out var sqc)) showQueueCounter = sqc.GetBoolean();
            }

            return new
            {
                enabled,
                maxQueueSize,
                delayBetweenAlerts,
                showQueueCounter
            };
        }

        private long GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(userIdClaim, out var userId))
                return userId;
            return 0;
        }

        private long GetChannelOwnerId()
        {
            // PRIORIDAD 1: Obtener canal activo desde la sesión (después de switch)
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
            {
                return sessionId;
            }

            // PRIORIDAD 2: Usar el claim del JWT si existe
            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
            {
                return channelOwnerId;
            }

            // PRIORIDAD 3: Por defecto, usar el propio canal del usuario
            var userId = GetUserId();
            return userId;
        }

        private async Task<string?> GetChannelUsernameAsync(long channelOwnerId)
        {
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == channelOwnerId);
            return user?.Login?.ToLower();
        }

        /// <summary>
        /// Busca el tier que coincida con el amount, o retorna baseAlert si no hay coincidencia.
        /// Misma lógica que EventAlertsService.
        /// </summary>
        // TODO: FindMatchingTierOrBase is duplicated in EventAlertsService.cs — refactor to share a single implementation
        private static JsonElement FindMatchingTierOrBase(JsonElement eventConfig, int amount)
        {
            if (eventConfig.TryGetProperty("tiers", out var tiers))
            {
                foreach (var tier in tiers.EnumerateArray())
                {
                    if (tier.TryGetProperty("enabled", out var te) && !te.GetBoolean()) continue;
                    if (!tier.TryGetProperty("condition", out var cond)) continue;

                    var condType = cond.TryGetProperty("type", out var ct) ? ct.GetString() : "range";
                    bool matches = condType switch
                    {
                        "exact" => cond.TryGetProperty("exact", out var ex) && ex.GetInt32() == amount,
                        "minimum" => cond.TryGetProperty("min", out var mn) && amount >= mn.GetInt32(),
                        "range" => cond.TryGetProperty("min", out var rMin) && amount >= rMin.GetInt32() &&
                                   (!cond.TryGetProperty("max", out var rMax) ||
                                    rMax.ValueKind == JsonValueKind.Null ||
                                    amount <= rMax.GetInt32()),
                        _ => false
                    };

                    if (matches) return tier;
                }
            }

            if (eventConfig.TryGetProperty("baseAlert", out var baseAlert))
                return baseAlert;

            return eventConfig;
        }

        // ========================================================================
        // SISTEMA DE VARIANTES
        // TODO: Entire variants system (SelectVariantIfEnabled, SelectRandomIndex, SelectWeightedIndex,
        // SelectSequentialIndex, SelectNoRepeatIndex) is duplicated in EventAlertsService.cs
        // — refactor to share a single implementation
        // ========================================================================

        // Almacena el índice de la última variante usada para modo secuencial
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, int> _sequentialIndexes = new();
        // Almacena las variantes usadas para modo "sin repetir"
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, System.Collections.Generic.List<string>> _usedVariants = new();
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, DateTime> _variantResetTimes = new();
        private static readonly Random _random = new();

        /// <summary>
        /// Verifica si hay variantes habilitadas y selecciona una según el modo configurado.
        /// IMPORTANTE: El tier principal TAMBIÉN participa en la rotación.
        /// Si hay 5 variantes, hay 6 opciones en total (tier + 5 variantes).
        /// Retorna null cuando debe usarse el tier principal.
        /// </summary>
        private JsonElement? SelectVariantIfEnabled(JsonElement alertConfig, string channelName, string alertId)
        {
            _logger.LogInformation("🎲 [Variants] Verificando variantes para alertId={AlertId}", alertId);

            // Verificar si hay configuración de variantes
            if (!alertConfig.TryGetProperty("variants", out var variantsConfig))
            {
                _logger.LogInformation("🎲 [Variants] No hay propiedad 'variants' en alertConfig");
                return null;
            }

            if (!variantsConfig.TryGetProperty("enabled", out var enabledProp) || !enabledProp.GetBoolean())
            {
                _logger.LogInformation("🎲 [Variants] Variantes no habilitadas");
                return null;
            }

            if (!variantsConfig.TryGetProperty("variants", out var variants) || variants.GetArrayLength() == 0)
            {
                _logger.LogInformation("🎲 [Variants] Array de variantes vacío o no existe");
                return null;
            }

            var variantCount = variants.GetArrayLength();
            var totalOptions = variantCount + 1; // +1 por el tier principal
            _logger.LogInformation("🎲 [Variants] Encontradas {Count} variantes + tier principal = {Total} opciones", variantCount, totalOptions);

            var mode = variantsConfig.TryGetProperty("mode", out var modeProp) ? modeProp.GetString() ?? "random" : "random";
            var variantList = variants.EnumerateArray().ToList();
            var variantKey = $"{channelName}:{alertId}";

            // Seleccionar índice (0 = tier principal, 1+ = variantes)
            int selectedIndex = mode switch
            {
                "random" => SelectRandomIndex(totalOptions),
                "weighted" => SelectWeightedIndex(variantList), // Weighted solo entre variantes, tier siempre puede salir
                "sequential" => SelectSequentialIndex(totalOptions, variantKey),
                "noRepeat" => SelectNoRepeatIndex(totalOptions, variantList, variantKey, variantsConfig),
                _ => SelectRandomIndex(totalOptions)
            };

            // Índice 0 = usar tier principal (retornar null)
            if (selectedIndex == 0)
            {
                var tierName = alertConfig.TryGetProperty("name", out var tn) ? tn.GetString() : "tier";
                _logger.LogInformation("🎲 [Variants] Seleccionado: TIER PRINCIPAL '{Name}' (índice 0 de {Total})", tierName, totalOptions);
                return null; // null significa "usa el tier"
            }

            // Índice 1+ = usar variante
            var selectedVariant = variantList[selectedIndex - 1]; // -1 porque índice 0 es el tier
            var variantName = selectedVariant.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : "?";
            _logger.LogInformation("🎲 [Variants] Seleccionada: VARIANTE '{Name}' (índice {Index} de {Total})", variantName, selectedIndex, totalOptions);

            return selectedVariant;
        }

        // Retorna índice 0 a totalOptions-1
        private int SelectRandomIndex(int totalOptions)
        {
            return _random.Next(totalOptions);
        }

        // Para weighted: el tier tiene weight implícito de 100, las variantes tienen su propio weight
        private int SelectWeightedIndex(System.Collections.Generic.List<JsonElement> variants)
        {
            int tierWeight = 100; // El tier siempre tiene peso 100
            int totalWeight = tierWeight;

            foreach (var v in variants)
            {
                var weight = v.TryGetProperty("weight", out var wp) ? wp.GetInt32() : 100;
                totalWeight += weight;
            }

            var randomValue = _random.Next(totalWeight);

            // Primero verificar si cayó en el tier
            if (randomValue < tierWeight)
                return 0; // Tier principal

            // Luego verificar variantes
            int cumulative = tierWeight;
            for (int i = 0; i < variants.Count; i++)
            {
                var weight = variants[i].TryGetProperty("weight", out var wp) ? wp.GetInt32() : 100;
                cumulative += weight;
                if (randomValue < cumulative)
                    return i + 1; // +1 porque índice 0 es el tier
            }

            return variants.Count; // Último índice como fallback
        }

        private int SelectSequentialIndex(int totalOptions, string variantKey)
        {
            var currentIndex = _sequentialIndexes.GetOrAdd(variantKey, 0);
            var selectedIndex = currentIndex % totalOptions;

            // Incrementar para la próxima vez
            _sequentialIndexes[variantKey] = (currentIndex + 1) % totalOptions;

            return selectedIndex;
        }

        private int SelectNoRepeatIndex(int totalOptions, System.Collections.Generic.List<JsonElement> variants, string variantKey, JsonElement variantsConfig)
        {
            // Verificar si necesitamos resetear
            var resetAfter = variantsConfig.TryGetProperty("resetAfter", out var ra) ? ra.GetString() : "all";
            var resetTimeMinutes = variantsConfig.TryGetProperty("resetTimeMinutes", out var rtm) ? rtm.GetInt32() : 60;

            if (resetAfter == "time" && _variantResetTimes.TryGetValue(variantKey, out var resetTime))
            {
                if ((DateTime.UtcNow - resetTime).TotalMinutes >= resetTimeMinutes)
                {
                    _usedVariants.TryRemove(variantKey, out _);
                    _variantResetTimes[variantKey] = DateTime.UtcNow;
                }
            }

            // Obtener lista de índices usados (guardamos como strings: "0" para tier, "1", "2", etc.)
            var used = _usedVariants.GetOrAdd(variantKey, _ => new System.Collections.Generic.List<string>());

            // Crear lista de índices disponibles
            var availableIndexes = new System.Collections.Generic.List<int>();
            for (int i = 0; i < totalOptions; i++)
            {
                if (!used.Contains(i.ToString()))
                    availableIndexes.Add(i);
            }

            // Si todos fueron usados, resetear
            if (availableIndexes.Count == 0)
            {
                used.Clear();
                for (int i = 0; i < totalOptions; i++)
                    availableIndexes.Add(i);
                _variantResetTimes[variantKey] = DateTime.UtcNow;
            }

            // Seleccionar uno aleatorio de los disponibles
            var selectedIndex = availableIndexes[_random.Next(availableIndexes.Count)];

            // Marcar como usado
            used.Add(selectedIndex.ToString());

            return selectedIndex;
        }

        /// <summary>
        /// Envía un mensaje al chat de Twitch si está configurado en la alerta.
        /// </summary>
        // TODO: SendChatMessageIfEnabled is duplicated in EventAlertsService.cs — refactor to share a single implementation
        private async Task SendChatMessageIfEnabled(
            JsonElement alertConfig,
            string channelName,
            string username,
            int amount,
            string tierLabel,
            int months,
            int level,
            string? userMessage)
        {
            try
            {
                if (!alertConfig.TryGetProperty("chatMessage", out var chatCfg))
                    return;

                var chatEnabled = chatCfg.TryGetProperty("enabled", out var enabledProp) && enabledProp.GetBoolean();
                if (!chatEnabled) return;

                var chatTemplate = chatCfg.TryGetProperty("template", out var templateProp) ? templateProp.GetString() : null;
                if (string.IsNullOrWhiteSpace(chatTemplate)) return;

                // Reemplazar variables
                var chatMessage = chatTemplate
                    .Replace("{username}", username)
                    .Replace("{amount}", amount.ToString())
                    .Replace("{viewers}", amount.ToString())
                    .Replace("{months}", months.ToString())
                    .Replace("{tier}", tierLabel)
                    .Replace("{level}", level.ToString())
                    .Replace("{message}", userMessage ?? "");

                if (!string.IsNullOrWhiteSpace(chatMessage))
                {
                    await _messageSender.SendMessageAsync(channelName, chatMessage);
                    _logger.LogInformation("💬 [EventAlerts] Chat message sent: {Message}", chatMessage);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "⚠️ [EventAlerts] Failed to send chat message");
            }
        }
    }
}
