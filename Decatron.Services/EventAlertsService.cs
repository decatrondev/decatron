using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace Decatron.Services
{
    public class EventAlertsService : IEventAlertsService
    {
        private readonly DecatronDbContext _context;
        private readonly ILogger<EventAlertsService> _logger;
        private readonly OverlayNotificationService _overlayNotificationService;
        private readonly ITtsService _ttsService;
        private readonly IMessageSender _messageSender;

        // Cooldown tracking: key = "channelName:eventType", value = last trigger time
        private static readonly ConcurrentDictionary<string, DateTime> _lastAlertTimes = new();

        // Anti-spam tracking for follows: key = "channelName:userId", value = last follow alert time
        private static readonly ConcurrentDictionary<string, DateTime> _lastFollowByUser = new();

        public EventAlertsService(
            DecatronDbContext context,
            ILogger<EventAlertsService> logger,
            OverlayNotificationService overlayNotificationService,
            ITtsService ttsService,
            IMessageSender messageSender)
        {
            _context = context;
            _logger = logger;
            _overlayNotificationService = overlayNotificationService;
            _ttsService = ttsService;
            _messageSender = messageSender;
        }

        public async Task<EventAlertsConfig?> GetConfig(long userId)
        {
            return await _context.EventAlertsConfigs
                .FirstOrDefaultAsync(c => c.UserId == userId);
        }

        public async Task<EventAlertsConfig?> GetConfigByChannel(string channelName)
        {
            return await _context.EventAlertsConfigs
                .FirstOrDefaultAsync(c => c.ChannelName.ToLower() == channelName.ToLower());
        }

        public async Task<EventAlertsConfig> SaveConfig(long userId, string channelName, string configJson)
        {
            var existing = await GetConfig(userId);

            if (existing != null)
            {
                existing.ChannelName = channelName;
                existing.ConfigJson = configJson;
                existing.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                await NotifyConfigChanged(channelName);

                return existing;
            }
            else
            {
                var config = new EventAlertsConfig
                {
                    UserId = userId,
                    ChannelName = channelName,
                    ConfigJson = configJson,
                    IsEnabled = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.EventAlertsConfigs.Add(config);
                await _context.SaveChangesAsync();
                await NotifyConfigChanged(channelName);

                return config;
            }
        }

        private async Task NotifyConfigChanged(string channelName)
        {
            try
            {
                await _overlayNotificationService.SendToChannel(channelName, "EventAlertsConfigChanged", new { });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to notify overlay of event alerts config change");
            }
        }

        // ====================================================================
        // TRIGGER ALERT FROM REAL TWITCH EVENT
        // ====================================================================

        public async Task TriggerAlertAsync(
            string channelName,
            string eventType,
            string username,
            string? userMessage = null,
            int amount = 0,
            string? subTier = null,
            int? months = null,
            int? level = null)
        {
            try
            {
                var config = await GetConfigByChannel(channelName);
                if (config == null || !config.IsEnabled)
                    return;

                var configData = JsonSerializer.Deserialize<JsonElement>(config.ConfigJson);

                // Check global enabled
                if (configData.TryGetProperty("global", out var globalCfg) &&
                    globalCfg.TryGetProperty("enabled", out var globalEnabled) &&
                    !globalEnabled.GetBoolean())
                    return;

                if (!configData.TryGetProperty(eventType, out var eventConfig))
                {
                    _logger.LogWarning("[EventAlerts] Event type not found in config: {EventType}", eventType);
                    return;
                }

                if (eventConfig.TryGetProperty("enabled", out var eventEnabled) && !eventEnabled.GetBoolean())
                    return;

                // Check cooldown
                var cooldownSeconds = eventConfig.TryGetProperty("cooldown", out var cdP) ? cdP.GetInt32() : 0;
                if (cooldownSeconds > 0 && IsOnCooldown(channelName, eventType, cooldownSeconds))
                {
                    _logger.LogDebug("[EventAlerts] Alert on cooldown: {EventType} in {Channel} (cooldown: {Cooldown}s)",
                        eventType, channelName, cooldownSeconds);
                    return;
                }

                // Anti-spam check for follows (per-user cooldown)
                if (eventType == "follow" && !string.IsNullOrEmpty(username))
                {
                    if (eventConfig.TryGetProperty("antiSpam", out var antiSpamCfg))
                    {
                        var antiSpamEnabled = antiSpamCfg.TryGetProperty("enabled", out var asEnabled) && asEnabled.GetBoolean();
                        var perUserCooldown = antiSpamCfg.TryGetProperty("perUserCooldown", out var pucP) ? pucP.GetInt32() : 86400;

                        if (antiSpamEnabled && perUserCooldown > 0)
                        {
                            if (IsUserOnFollowCooldown(channelName, username, perUserCooldown))
                            {
                                _logger.LogDebug("[EventAlerts] Follow anti-spam: {User} in {Channel} (cooldown: {Cooldown}s)",
                                    username, channelName, perUserCooldown);
                                return;
                            }
                        }
                    }
                }

                // Select the correct alert config based on event type
                JsonElement alertConfig;
                if (eventType == "follow")
                {
                    if (!eventConfig.TryGetProperty("alert", out alertConfig)) return;
                }
                else if (eventType == "subs")
                {
                    var tierKey = MapSubTierKey(subTier);
                    if (!eventConfig.TryGetProperty("subTypes", out var subTypes) ||
                        !subTypes.TryGetProperty(tierKey, out alertConfig)) return;
                }
                else if (eventType == "hypeTrain")
                {
                    var levelKey = (level ?? 1).ToString();
                    if (!eventConfig.TryGetProperty("levels", out var levels) ||
                        !levels.TryGetProperty(levelKey, out alertConfig)) return;
                }
                else
                {
                    alertConfig = FindMatchingTierOrBase(eventConfig, amount);
                }

                // Debug: mostrar qué config se seleccionó
                var selectedName = alertConfig.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : "(base)";
                var selectedSound = alertConfig.TryGetProperty("sound", out var sndProp) ? sndProp.GetString() : "(none)";
                _logger.LogInformation("[EventAlerts] Selected config: Name={Name}, Sound={Sound}, Amount={Amount}",
                    selectedName, selectedSound ?? "(empty)", amount);

                // Sistema de Variantes: verificar si hay variantes habilitadas
                var alertId = alertConfig.TryGetProperty("id", out var alertIdProp) ? alertIdProp.GetString() ?? eventType : eventType;
                _logger.LogInformation("[EventAlerts] Checking variants for alertId={AlertId}, tierName={TierName}",
                    alertId, selectedName);

                var selectedVariant = SelectVariantIfEnabled(alertConfig, channelName, alertId);
                if (selectedVariant.HasValue)
                {
                    // Usar la variante en lugar de la configuración base para media, sonido, mensaje, etc.
                    // Los valores de la variante sobrescriben los del alertConfig
                    var variantName = selectedVariant.Value.TryGetProperty("name", out var vn) ? vn.GetString() : "?";
                    var variantMsg = selectedVariant.Value.TryGetProperty("message", out var vm) ? vm.GetString() : "?";
                    _logger.LogInformation("[EventAlerts] ✅ VARIANT SELECTED: Name={Name}, Message={Message}", variantName, variantMsg);
                    alertConfig = selectedVariant.Value;
                }
                else
                {
                    _logger.LogInformation("[EventAlerts] ❌ No variant selected, using tier/base config");
                }

                if (alertConfig.TryGetProperty("enabled", out var alertEnabled) && !alertEnabled.GetBoolean())
                    return;

                // Replace template variables in message
                var tierLabel = MapSubTierLabel(subTier);
                var message = alertConfig.TryGetProperty("message", out var msgProp) ? msgProp.GetString() ?? "" : "";
                message = ReplaceVariables(message, username, amount, tierLabel, months ?? amount, level ?? 1, userMessage);

                // TTS - Ahora separado en dos URLs: template y user message
                string? ttsTemplateUrl = null;
                string? ttsUserMessageUrl = null;
                int ttsTemplateVolume = 80;
                int ttsUserMessageVolume = 80;
                // Legacy (compatibilidad hacia atrás)
                string? ttsUrl = null;
                int ttsVolume = 80;

                if (alertConfig.TryGetProperty("tts", out var ttsCfg) &&
                    ttsCfg.TryGetProperty("enabled", out var ttsOn) &&
                    ttsOn.GetBoolean())
                {
                    var voice = ttsCfg.TryGetProperty("voice", out var vp) ? vp.GetString() ?? "Lupe" : "Lupe";
                    var engine = ttsCfg.TryGetProperty("engine", out var ep) ? ep.GetString() ?? "standard" : "standard";
                    var lang = ttsCfg.TryGetProperty("languageCode", out var lp) ? lp.GetString() ?? "es-US" : "es-US";

                    // Volúmenes separados (con fallback a volume legacy)
                    var legacyVolume = ttsCfg.TryGetProperty("volume", out var volP) ? volP.GetInt32() : 80;
                    ttsTemplateVolume = ttsCfg.TryGetProperty("templateVolume", out var tvP) ? tvP.GetInt32() : legacyVolume;
                    ttsUserMessageVolume = ttsCfg.TryGetProperty("userMessageVolume", out var uvP) ? uvP.GetInt32() : legacyVolume;
                    ttsVolume = legacyVolume; // Legacy

                    // [3/4] TTS del template ("¡Gracias {username}!")
                    var ttsTemplate = ttsCfg.TryGetProperty("template", out var tp) ? tp.GetString() ?? "" : "";
                    if (!string.IsNullOrWhiteSpace(ttsTemplate))
                    {
                        var templateText = ReplaceVariables(ttsTemplate, username, amount, tierLabel, months ?? amount, level ?? 1, null);
                        if (!string.IsNullOrWhiteSpace(templateText))
                        {
                            ttsTemplateUrl = await _ttsService.GenerateAsync(templateText, voice, engine, lang, channelName);
                        }
                    }

                    // [4/4] TTS del mensaje del usuario (bits, subs con mensaje)
                    if (ttsCfg.TryGetProperty("readUserMessage", out var readMsg) && readMsg.GetBoolean() &&
                        !string.IsNullOrEmpty(userMessage))
                    {
                        var maxChars = ttsCfg.TryGetProperty("maxChars", out var mc) ? mc.GetInt32() : 150;
                        var truncated = userMessage.Length > maxChars ? userMessage[..maxChars] : userMessage;
                        if (!string.IsNullOrWhiteSpace(truncated))
                        {
                            ttsUserMessageUrl = await _ttsService.GenerateAsync(truncated, voice, engine, lang, channelName);
                        }
                    }

                    // Legacy: combinar ambos para compatibilidad hacia atrás
                    ttsUrl = ttsTemplateUrl ?? ttsUserMessageUrl;
                }

                // Media
                string? mediaUrl = null;
                string? mediaType = null;
                bool videoMuted = true;
                bool playVideoAudio = false;
                int videoVolume = 80;
                string? soundUrl = null;
                int soundVolume = 80;

                // Helper para detectar tipo de media por URL
                string DetectMediaType(string url)
                {
                    if (string.IsNullOrEmpty(url)) return "image";
                    var lowerUrl = url.ToLower();
                    var urlWithoutParams = lowerUrl.Split('?')[0];
                    var ext = urlWithoutParams.Split('.').LastOrDefault() ?? "";

                    // Video
                    if (new[] { "mp4", "webm", "mov", "mkv", "avi", "m4v" }.Contains(ext)) return "video";
                    // Imagen/GIF
                    if (new[] { "jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif" }.Contains(ext)) return "image";
                    // GIF providers
                    if (lowerUrl.Contains("tenor.com") || lowerUrl.Contains("giphy.com") ||
                        lowerUrl.Contains("gfycat.com") || lowerUrl.Contains("format=gif"))
                        return "image";
                    return "image"; // Default
                }

                _logger.LogInformation("[EventAlerts] Checking media config...");

                // Función para extraer media de una config
                void ExtractMediaFromConfig(JsonElement cfg, string source)
                {
                    if (!cfg.TryGetProperty("media", out var mediaCfg))
                    {
                        _logger.LogWarning("[EventAlerts] No 'media' property found in {Source}", source);
                        return;
                    }

                    var mediaEnabled = mediaCfg.TryGetProperty("enabled", out var mediaOn) && mediaOn.GetBoolean();
                    var mediaMode = mediaCfg.TryGetProperty("mode", out var mediaModeProp) ? mediaModeProp.GetString() : "simple";

                    // DEBUG: Log completo de la configuración de media
                    _logger.LogInformation("[EventAlerts] Media ({Source}): enabled={Enabled}, mode={Mode}, raw={Raw}",
                        source, mediaEnabled, mediaMode, mediaCfg.ToString());

                    if (!mediaEnabled)
                    {
                        _logger.LogInformation("[EventAlerts] Media disabled for {Source}", source);
                        return;
                    }

                    if (mediaMode == "advanced" && mediaCfg.TryGetProperty("advanced", out var advMedia))
                    {
                        _logger.LogInformation("[EventAlerts] Processing ADVANCED mode, advMedia={AdvMedia}", advMedia.ToString());

                        // Video principal
                        var hasVideo = advMedia.TryGetProperty("video", out var advVideo);
                        string? videoUrlValue = null;
                        if (hasVideo && advVideo.TryGetProperty("url", out var advVideoUrl))
                        {
                            videoUrlValue = advVideoUrl.GetString();
                        }

                        _logger.LogInformation("[EventAlerts] Video check: hasVideo={HasVideo}, videoUrlValue={VideoUrl}",
                            hasVideo, videoUrlValue ?? "(null)");

                        if (hasVideo && !string.IsNullOrEmpty(videoUrlValue))
                        {
                            mediaUrl = videoUrlValue;
                            mediaType = "video";
                            videoVolume = advVideo.TryGetProperty("volume", out var advVideoVol) ? advVideoVol.GetInt32() : 80;
                            videoMuted = videoVolume == 0;
                            playVideoAudio = videoVolume > 0;
                            _logger.LogInformation("[EventAlerts] Video found ({Source}): URL={Url}, Volume={Vol}, PlayAudio={PlayAudio}",
                                source, mediaUrl, videoVolume, playVideoAudio);
                        }
                        // Imagen principal
                        else if (advMedia.TryGetProperty("image", out var advImage) &&
                                 advImage.TryGetProperty("url", out var advImageUrl) &&
                                 !string.IsNullOrEmpty(advImageUrl.GetString()))
                        {
                            mediaUrl = advImageUrl.GetString();
                            mediaType = DetectMediaType(mediaUrl ?? "");
                            _logger.LogInformation("[EventAlerts] Image found ({Source}): URL={Url}", source, mediaUrl);
                        }
                        // Audio
                        if (advMedia.TryGetProperty("audio", out var advAudio) &&
                            advAudio.TryGetProperty("url", out var advAudioUrl) &&
                            !string.IsNullOrEmpty(advAudioUrl.GetString()))
                        {
                            soundUrl = advAudioUrl.GetString();
                            soundVolume = advAudio.TryGetProperty("volume", out var advAudioVol) ? advAudioVol.GetInt32() : 80;
                            _logger.LogInformation("[EventAlerts] Audio found ({Source}): URL={Url}", source, soundUrl);
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
                        _logger.LogInformation("[EventAlerts] NOT in advanced mode, falling back to simple/legacy. Mode={Mode}, HasAdvanced={HasAdv}",
                            mediaMode, mediaCfg.TryGetProperty("advanced", out _));

                        // Modo simple: buscar en media.simple.url/type (estructura actual)
                        // y fallback a media.url/type (legacy)
                        if (mediaCfg.TryGetProperty("simple", out var simpleCfg))
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

                            _logger.LogInformation("[EventAlerts] Simple mode: URL={Url}, Type={Type}, Volume={Vol}",
                                mediaUrl ?? soundUrl ?? "(none)", mediaType ?? "audio", simpleVolume);
                        }
                        else
                        {
                            // Legacy: media.url/type directamente
                            mediaUrl = mediaCfg.TryGetProperty("url", out var mup) ? mup.GetString() : null;
                            var legacyType = mediaCfg.TryGetProperty("type", out var mtp) ? mtp.GetString() : null;

                            // Si no hay type definido, detectar por extensión
                            if (string.IsNullOrEmpty(legacyType) && !string.IsNullOrEmpty(mediaUrl))
                            {
                                legacyType = DetectMediaType(mediaUrl);
                            }
                            mediaType = legacyType ?? "image";

                            // Si es video, configurar playVideoAudio
                            if (mediaType == "video")
                            {
                                // Usar videoVolume de la config o default 80
                                videoVolume = mediaCfg.TryGetProperty("videoVolume", out var vvP) ? vvP.GetInt32() : 80;
                                videoMuted = mediaCfg.TryGetProperty("muteVideo", out var mvP) && mvP.GetBoolean();
                                playVideoAudio = !videoMuted && videoVolume > 0;
                                _logger.LogInformation("[EventAlerts] Legacy video: URL={Url}, Volume={Vol}, PlayAudio={Play}",
                                    mediaUrl, videoVolume, playVideoAudio);
                            }
                        }

                        // muteVideo y soundUrl/soundVolume (campos legacy adicionales)
                        if (mediaType != "video" && mediaCfg.TryGetProperty("muteVideo", out var muteP))
                            videoMuted = muteP.GetBoolean();
                        if (string.IsNullOrEmpty(soundUrl))
                        {
                            soundUrl = mediaCfg.TryGetProperty("soundUrl", out var sndP) ? sndP.GetString() : null;
                            soundVolume = mediaCfg.TryGetProperty("soundVolume", out var sndVP) ? sndVP.GetInt32() : 80;
                        }
                    }
                }

                // 1. Primero intentar extraer del tier/alerta seleccionada
                ExtractMediaFromConfig(alertConfig, "tier/alert");

                // DEBUG: Log de lo extraído hasta ahora
                _logger.LogInformation("[EventAlerts] After tier/alert extraction: mediaUrl={MediaUrl}, mediaType={MediaType}, soundUrl={SoundUrl}, playVideoAudio={PlayVideoAudio}, videoVolume={VideoVolume}",
                    mediaUrl ?? "(null)", mediaType ?? "(null)", soundUrl ?? "(null)", playVideoAudio, videoVolume);

                // También puede haber sound en el campo legacy de BaseAlertConfig o en tier.sound
                if (string.IsNullOrEmpty(soundUrl) && alertConfig.TryGetProperty("sound", out var legacySnd))
                {
                    soundUrl = legacySnd.GetString();
                    _logger.LogInformation("[EventAlerts] Found sound in alertConfig.sound: {Sound}", soundUrl ?? "(empty)");
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
                        _logger.LogInformation("[EventAlerts] No media in tier, trying baseAlert fallback...");
                        ExtractMediaFromConfig(baseAlert, "baseAlert (media fallback)");
                    }

                    // Si no hay soundUrl, intentar extraer del baseAlert
                    if (string.IsNullOrEmpty(soundUrl))
                    {
                        _logger.LogInformation("[EventAlerts] No sound in tier, trying baseAlert fallback...");
                        // Nota: ExtractMediaFromConfig ya extrae soundUrl si está en modo simple o avanzado
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

                _logger.LogInformation("[EventAlerts] Final sound config: URL={SoundUrl}, Volume={Volume}", soundUrl ?? "(none)", soundVolume);

                // waitForSound: TTS siempre espera al sonido de alerta (secuencial por defecto)
                var waitForSound = true;
                if (ttsCfg.ValueKind != JsonValueKind.Undefined &&
                    ttsCfg.TryGetProperty("waitForSound", out var wfsP))
                {
                    waitForSound = wfsP.GetBoolean();
                }

                // Duration (seconds → ms)
                var durationSec = alertConfig.TryGetProperty("duration", out var durP) ? durP.GetInt32() : 5;
                var duration = durationSec * 1000;

                // Animation type
                var animType = "fade";
                if (alertConfig.TryGetProperty("animation", out var animP) &&
                    animP.TryGetProperty("type", out var animT))
                    animType = animT.GetString() ?? "fade";

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

                // Position
                int posX = 50, posY = 50;
                if (alertConfig.TryGetProperty("position", out var posCfg))
                {
                    posX = posCfg.TryGetProperty("x", out var xp) ? xp.GetInt32() : 50;
                    posY = posCfg.TryGetProperty("y", out var yp) ? yp.GetInt32() : 50;
                }

                // Style (primero global, luego específico del evento)
                var style = ExtractStyleConfig(configData, alertConfig);

                // overlayElements: posiciones independientes de CARD, MEDIA y TEXT
                var overlayElements = ExtractOverlayElements(configData);

                // queueSettings: configuración de cola de alertas
                var queueSettings = ExtractQueueSettings(configData);

                // CORRECCIÓN FINAL: Si hay video con volumen, forzar playVideoAudio
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
                    mediaType = "video";
                    _logger.LogWarning("🔴 [EventAlerts] FORCED playVideoAudio=true for video");
                }

                var alertData = new
                {
                    eventType,
                    username,
                    amount,
                    tier = tierLabel,
                    months = months ?? amount,
                    viewers = amount,
                    level = level ?? 1,
                    message,
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
                    animationIn = animType switch { "slide" => "slideIn", "bounce" => "bounceIn", "zoom" => "zoomIn", _ => "fadeIn" },
                    animationOut = animType switch { "slide" => "slideOut", "bounce" => "bounceOut", "zoom" => "zoomOut", _ => "fadeOut" },
                    effects,
                    position = new { x = posX, y = posY },
                    style,
                    overlayElements,
                    queueSettings
                };

                _logger.LogInformation("[EventAlerts] Sending alert: Type={EventType}, User={Username}, Channel={Channel}, MediaType={MediaType}, MediaUrl={MediaUrl}, SoundUrl={SoundUrl}",
                    eventType, username, channelName, mediaType ?? "(null)", mediaUrl ?? "(null)", soundUrl ?? "(null)");

                await _overlayNotificationService.SendToChannel(channelName, "ShowEventAlert", alertData);
                _logger.LogInformation("[EventAlerts] Alert sent successfully");

                // Enviar mensaje al chat si está configurado
                await SendChatMessageIfEnabled(alertConfig, channelName, username, amount, tierLabel, months ?? amount, level ?? 1, userMessage);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[EventAlerts] Error triggering alert for {EventType} in {Channel}", eventType, channelName);
            }
        }

        /// <summary>
        /// Envía un mensaje al chat de Twitch si está habilitado en la configuración
        /// </summary>
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
                // Verificar si chatMessage está habilitado
                if (!alertConfig.TryGetProperty("chatMessage", out var chatCfg))
                    return;

                var chatEnabled = chatCfg.TryGetProperty("enabled", out var enabledProp) && enabledProp.GetBoolean();
                if (!chatEnabled)
                    return;

                var chatTemplate = chatCfg.TryGetProperty("template", out var templateProp) ? templateProp.GetString() : null;
                if (string.IsNullOrWhiteSpace(chatTemplate))
                    return;

                // Reemplazar variables en el template
                var chatMessage = ReplaceVariables(chatTemplate, username, amount, tierLabel, months, level, userMessage);

                if (!string.IsNullOrWhiteSpace(chatMessage))
                {
                    await _messageSender.SendMessageAsync(channelName, chatMessage);
                    _logger.LogInformation("[EventAlerts] Chat message sent: {Message}", chatMessage);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[EventAlerts] Failed to send chat message");
            }
        }

        // ====================================================================
        // HELPERS
        // ====================================================================

        /// <summary>
        /// Extrae la configuración de estilo, primero de global.defaultStyle y luego sobrescribe con alertConfig.style
        /// </summary>
        private static object ExtractStyleConfig(JsonElement configData, JsonElement alertConfig)
        {
            // Defaults
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

        private static string ReplaceVariables(string template, string username, int amount, string tier, int months, int level, string? userMessage)
        {
            return template
                .Replace("{username}", username)
                .Replace("{amount}", amount.ToString())
                .Replace("{viewers}", amount.ToString())
                .Replace("{months}", months.ToString())
                .Replace("{tier}", tier)
                .Replace("{level}", level.ToString())
                .Replace("{message}", userMessage ?? "");
        }

        private static string MapSubTierKey(string? twitchTier) => twitchTier switch
        {
            "2000" => "tier2",
            "3000" => "tier3",
            "Prime" => "prime",
            _ => "tier1"
        };

        private static string MapSubTierLabel(string? twitchTier) => twitchTier switch
        {
            "2000" => "Tier 2",
            "3000" => "Tier 3",
            "Prime" => "Prime",
            _ => "Tier 1"
        };

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

        /// <summary>
        /// Checks if an alert is on cooldown. If not on cooldown, records the current time.
        /// Also periodically cleans up stale entries older than 24 hours to prevent unbounded memory growth.
        /// </summary>
        private static bool IsOnCooldown(string channelName, string eventType, int cooldownSeconds)
        {
            var key = $"{channelName.ToLower()}:{eventType}";

            if (_lastAlertTimes.TryGetValue(key, out var lastTime))
            {
                var elapsed = (DateTime.UtcNow - lastTime).TotalSeconds;
                if (elapsed < cooldownSeconds)
                    return true;
            }

            // Record this trigger time
            _lastAlertTimes[key] = DateTime.UtcNow;

            // Periodic cleanup: remove entries older than 24 hours (runs every ~100 entries to avoid overhead)
            if (_lastAlertTimes.Count > 100)
            {
                CleanupStaleEntries(_lastAlertTimes, TimeSpan.FromHours(24));
            }

            return false;
        }

        // ============================================
        // SISTEMA DE VARIANTES
        // ============================================

        // Almacena el índice de la última variante usada para modo secuencial
        private static readonly ConcurrentDictionary<string, int> _sequentialIndexes = new();

        // Almacena las variantes usadas para modo "sin repetir"
        private static readonly ConcurrentDictionary<string, List<string>> _usedVariants = new();
        private static readonly ConcurrentDictionary<string, DateTime> _variantResetTimes = new();

        /// <summary>
        /// Verifica si hay variantes habilitadas y selecciona una según el modo configurado.
        /// IMPORTANTE: El tier principal TAMBIÉN participa en la rotación.
        /// Si hay 5 variantes, hay 6 opciones en total (tier + 5 variantes).
        /// Retorna null cuando debe usarse el tier principal.
        /// </summary>
        private JsonElement? SelectVariantIfEnabled(JsonElement alertConfig, string channelName, string alertId)
        {
            _logger.LogInformation("[EventAlerts] SelectVariantIfEnabled called for alertId={AlertId}", alertId);

            // Verificar si hay configuración de variantes
            if (!alertConfig.TryGetProperty("variants", out var variantsConfig))
            {
                _logger.LogInformation("[EventAlerts] No 'variants' property found in alertConfig");
                return null;
            }

            if (!variantsConfig.TryGetProperty("enabled", out var enabledProp) || !enabledProp.GetBoolean())
            {
                _logger.LogInformation("[EventAlerts] Variants not enabled");
                return null;
            }

            if (!variantsConfig.TryGetProperty("variants", out var variants) || variants.GetArrayLength() == 0)
            {
                _logger.LogInformation("[EventAlerts] Variants array is empty or missing");
                return null;
            }

            var variantCount = variants.GetArrayLength();
            var totalOptions = variantCount + 1; // +1 por el tier principal
            _logger.LogInformation("[EventAlerts] Found {Count} variants + tier = {Total} options", variantCount, totalOptions);

            var mode = variantsConfig.TryGetProperty("mode", out var modeProp) ? modeProp.GetString() ?? "random" : "random";
            var variantList = variants.EnumerateArray().ToList();
            var variantKey = $"{channelName}:{alertId}";

            // Periodic cleanup of variant tracking dictionaries to prevent unbounded growth
            if (_variantResetTimes.Count > 200)
            {
                CleanupStaleEntries(_variantResetTimes, TimeSpan.FromHours(24));
                // Also clean up companion dictionaries for keys no longer in reset times
                foreach (var key in _sequentialIndexes.Keys)
                {
                    if (!_variantResetTimes.ContainsKey(key))
                        _sequentialIndexes.TryRemove(key, out _);
                }
                foreach (var key in _usedVariants.Keys)
                {
                    if (!_variantResetTimes.ContainsKey(key))
                        _usedVariants.TryRemove(key, out _);
                }
            }

            // Seleccionar índice (0 = tier principal, 1+ = variantes)
            int selectedIndex = mode switch
            {
                "random" => SelectRandomIndex(totalOptions),
                "weighted" => SelectWeightedIndex(variantList),
                "sequential" => SelectSequentialIndex(totalOptions, variantKey),
                "noRepeat" => SelectNoRepeatIndex(totalOptions, variantKey, variantsConfig),
                _ => SelectRandomIndex(totalOptions)
            };

            // Índice 0 = usar tier principal (retornar null)
            if (selectedIndex == 0)
            {
                var tierName = alertConfig.TryGetProperty("name", out var tn) ? tn.GetString() : "tier";
                _logger.LogInformation("[EventAlerts] Selected: TIER '{Name}' (index 0 of {Total})", tierName, totalOptions);
                return null;
            }

            // Índice 1+ = usar variante
            var selectedVariant = variantList[selectedIndex - 1];
            var variantName = selectedVariant.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : "?";
            _logger.LogInformation("[EventAlerts] Selected: VARIANT '{Name}' (index {Index} of {Total})", variantName, selectedIndex, totalOptions);

            return selectedVariant;
        }

        private static readonly Random _random = new();

        private int SelectRandomIndex(int totalOptions)
        {
            return _random.Next(totalOptions);
        }

        private int SelectWeightedIndex(List<JsonElement> variants)
        {
            int tierWeight = 100;
            int totalWeight = tierWeight;

            foreach (var v in variants)
            {
                var weight = v.TryGetProperty("weight", out var wp) ? wp.GetInt32() : 100;
                totalWeight += weight;
            }

            var randomValue = _random.Next(totalWeight);

            if (randomValue < tierWeight)
                return 0;

            int cumulative = tierWeight;
            for (int i = 0; i < variants.Count; i++)
            {
                var weight = variants[i].TryGetProperty("weight", out var wp) ? wp.GetInt32() : 100;
                cumulative += weight;
                if (randomValue < cumulative)
                    return i + 1;
            }

            return variants.Count;
        }

        private int SelectSequentialIndex(int totalOptions, string variantKey)
        {
            var currentIndex = _sequentialIndexes.GetOrAdd(variantKey, 0);
            var selectedIndex = currentIndex % totalOptions;
            _sequentialIndexes[variantKey] = (currentIndex + 1) % totalOptions;
            return selectedIndex;
        }

        private int SelectNoRepeatIndex(int totalOptions, string variantKey, JsonElement variantsConfig)
        {
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

            var used = _usedVariants.GetOrAdd(variantKey, _ => new List<string>());

            var availableIndexes = new List<int>();
            for (int i = 0; i < totalOptions; i++)
            {
                if (!used.Contains(i.ToString()))
                    availableIndexes.Add(i);
            }

            if (availableIndexes.Count == 0)
            {
                used.Clear();
                for (int i = 0; i < totalOptions; i++)
                    availableIndexes.Add(i);
                _variantResetTimes[variantKey] = DateTime.UtcNow;
            }

            var selectedIndex = availableIndexes[_random.Next(availableIndexes.Count)];
            used.Add(selectedIndex.ToString());

            return selectedIndex;
        }

        /// <summary>
        /// Checks if a specific user is on follow cooldown (anti-spam).
        /// This prevents the same user from triggering multiple follow alerts by follow/unfollow spam.
        /// Also periodically cleans up stale entries to prevent unbounded memory growth.
        /// </summary>
        private static bool IsUserOnFollowCooldown(string channelName, string username, int cooldownSeconds)
        {
            var key = $"{channelName.ToLower()}:follow:{username.ToLower()}";

            if (_lastFollowByUser.TryGetValue(key, out var lastTime))
            {
                var elapsed = (DateTime.UtcNow - lastTime).TotalSeconds;
                if (elapsed < cooldownSeconds)
                    return true;
            }

            // Record this follow time for the user
            _lastFollowByUser[key] = DateTime.UtcNow;

            // Periodic cleanup: remove entries older than 24 hours
            if (_lastFollowByUser.Count > 500)
            {
                CleanupStaleEntries(_lastFollowByUser, TimeSpan.FromHours(24));
            }

            return false;
        }

        /// <summary>
        /// Removes entries older than maxAge from a ConcurrentDictionary to prevent unbounded memory growth.
        /// </summary>
        private static void CleanupStaleEntries(ConcurrentDictionary<string, DateTime> dict, TimeSpan maxAge)
        {
            var cutoff = DateTime.UtcNow - maxAge;
            foreach (var kvp in dict)
            {
                if (kvp.Value < cutoff)
                {
                    dict.TryRemove(kvp.Key, out _);
                }
            }
        }
    }
}
