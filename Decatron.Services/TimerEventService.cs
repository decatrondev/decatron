using Decatron.Core.Helpers;
using System;
using System.Text.Json;
using System.Threading.Tasks;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Core.Interfaces; // Added
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    // ============================================================================
    // CLASES PARA DESERIALIZAR eventsConfig JSON
    // ============================================================================

    public class EventRule
    {
        public string id { get; set; }
        public int minAmount { get; set; }
        public int timeAdded { get; set; }
        public bool isPerUnit { get; set; } // True = Multiplicar por cantidad, False = Tiempo fijo
        public bool exactAmount { get; set; } // True = Solo si es cantidad exacta
    }

    public class EventConfig
    {
        public bool enabled { get; set; }
        public int time { get; set; } // Tiempo base por unidad
        public int cooldown { get; set; } = 0;
        public List<EventRule> rules { get; set; } = new List<EventRule>();
    }

    // Legacy support for Bits specific fields if needed, but EventConfig covers it
    public class BitsEventConfig : EventConfig
    {
        public int perBits { get; set; }
        // rules from base class will handle tiers now
    }

    public class RaidEventConfig : EventConfig
    {
        public int timePerParticipant { get; set; }
    }

    public class TipsEventConfig : EventConfig
    {
        public decimal perCurrency { get; set; } = 1; // Cada X unidades de moneda
        public string currency { get; set; } = "USD";
    }

    public class EventsConfig
    {
        public BitsEventConfig bits { get; set; } = new BitsEventConfig();
        public EventConfig follow { get; set; } = new EventConfig();
        public EventConfig subPrime { get; set; } = new EventConfig();
        public EventConfig subTier1 { get; set; } = new EventConfig();
        public EventConfig subTier2 { get; set; } = new EventConfig();
        public EventConfig subTier3 { get; set; } = new EventConfig();
        public EventConfig giftSub { get; set; } = new EventConfig();
        public RaidEventConfig raid { get; set; } = new RaidEventConfig();
        public EventConfig hypeTrain { get; set; } = new EventConfig();
        public TipsEventConfig tips { get; set; } = new TipsEventConfig();
    }

    // ============================================================================
    // CLASES PARA DESERIALIZAR alertsConfig JSON
    // ============================================================================

    public class MediaItemConfig
    {
        public string url { get; set; }
        public bool loop { get; set; }
        public int volume { get; set; } = 100;
    }

    public class AdvancedMediaConfig
    {
        // Nuevo formato (objetos anidados)
        public MediaItemConfig video { get; set; }
        public MediaItemConfig audio { get; set; }
        public MediaItemConfig image { get; set; }

        // Legacy formato (propiedades directas)
        public string primaryUrl { get; set; }
        public string primaryType { get; set; } // 'video', 'audio', 'image', 'none'
        public int? primaryVolume { get; set; } // Volume for the primary file
        public bool? muteVideo { get; set; }
        public bool? hasAudio { get; set; }
        public string audioUrl { get; set; }
        public int? audioVolume { get; set; }
        public bool? hasImage { get; set; }
        public string imageUrl { get; set; }
    }

    public class SoundConfig
    {
        public bool enabled { get; set; }
        public string url { get; set; }
        public int volume { get; set; }
    }

    public class TtsEventConfig
    {
        public bool enabled { get; set; }
        public string voice { get; set; } = "Lupe";
        public string engine { get; set; } = "standard";
        public string languageCode { get; set; } = "es-US";
        public string template { get; set; } = "";
        public int templateVolume { get; set; } = 80;
        public bool readUserMessage { get; set; }
        public int userMessageVolume { get; set; } = 80;
        public int maxChars { get; set; } = 150;
        public bool waitForSound { get; set; } = true;
    }

    public class AlertDefaultConfig
    {
        public string icon { get; set; }
        public string customIcon { get; set; }
        public string message { get; set; }
        public int? duration { get; set; }
        public bool useGlobalStyle { get; set; }

        // Multimedia
        public AlertMediaConfig media { get; set; }

        // TTS (Text-to-Speech)
        public TtsEventConfig tts { get; set; }
    }

    public class AlertMediaConfig
    {
        public bool enabled { get; set; }
        public string mode { get; set; } // "simple" or "advanced"
        public AdvancedMediaConfig advanced { get; set; }
    }

    public class AlertEventConfig
    {
        public bool enabled { get; set; }
        public bool useGlobalStyle { get; set; }
        public string icon { get; set; }
        public string customIcon { get; set; }
        public string message { get; set; }
        public int? duration { get; set; }
        public int cooldown { get; set; }

        // Configuración default (contiene tts, media, etc.)
        public AlertDefaultConfig @default { get; set; }

        // Modo simple - objeto anidado (para coincidir con frontend)
        public SoundConfig sound { get; set; }

        // Multimedia avanzada (nuevo sistema) - legacy, usar default.media
        public bool? advancedMediaEnabled { get; set; }
        public AdvancedMediaConfig advancedMedia { get; set; }

        // TTS (Text-to-Speech) - legacy, usar default.tts
        public TtsEventConfig tts { get; set; }

        // Helpers para obtener config desde default o legacy
        public TtsEventConfig GetTts() => @default?.tts ?? tts;
        public AdvancedMediaConfig GetAdvancedMedia() => @default?.media?.advanced ?? advancedMedia;
        public bool GetAdvancedMediaEnabled() => @default?.media?.enabled ?? advancedMediaEnabled ?? false;
    }

    public class AlertsEventsConfig
    {
        public AlertEventConfig bits { get; set; } = new AlertEventConfig();
        public AlertEventConfig follow { get; set; } = new AlertEventConfig();
        public AlertEventConfig sub { get; set; } = new AlertEventConfig();      // Suscripciones (cualquier tier)
        public AlertEventConfig gift { get; set; } = new AlertEventConfig();     // Gift Subs
        public AlertEventConfig raid { get; set; } = new AlertEventConfig();
        public AlertEventConfig hypetrain { get; set; } = new AlertEventConfig(); // Hype Train
        public AlertEventConfig tips { get; set; } = new AlertEventConfig();     // Donaciones/Tips
    }

    public class AlertsConfig
    {
        public string template { get; set; }
        public object global { get; set; } // No lo necesitamos parsear en detalle
        public AlertsEventsConfig events { get; set; } = new AlertsEventsConfig();
    }

    // ============================================================================
    // SERVICIO DE EVENTOS DEL TIMER
    // ============================================================================

    /// <summary>
    /// Servicio para procesar eventos de Twitch y añadir tiempo al timer
    /// </summary>
    public class ManualHappyHour
    {
        public double Multiplier { get; set; }
        public DateTime ExpiresAt { get; set; }
    }

    public class TimerEventService
    {
        // Static storage for manual Happy Hour activations (channel -> ManualHappyHour)
        public static readonly ConcurrentDictionary<string, ManualHappyHour> ManualHappyHours = new();

        private readonly DecatronDbContext _dbContext;
        private readonly OverlayNotificationService _overlayNotificationService;
        private readonly ILogger<TimerEventService> _logger;
        private readonly IMessageSender _messageSender;
        private readonly ITtsService _ttsService;

        public TimerEventService(
            DecatronDbContext dbContext,
            OverlayNotificationService overlayNotificationService,
            ILogger<TimerEventService> logger,
            IMessageSender messageSender,
            ITtsService ttsService)
        {
            _dbContext = dbContext;
            _overlayNotificationService = overlayNotificationService;
            _logger = logger;
            _messageSender = messageSender;
            _ttsService = ttsService;
        }

        // ========================================================================
        // HELPERS DE CÁLCULO (NUEVA LÓGICA UNIVERSAL)
        // ========================================================================

        /// <summary>
        /// Calcula el tiempo a añadir basado en la configuración y las reglas (Tiers)
        /// Soporta lógica de tiempo fijo, multiplicadores (per unit) y reglas específicas.
        /// </summary>
        private int CalculateTimeWithRules(EventConfig config, int amount, int defaultPerUnit = 1)
        {
            if (config == null || !config.enabled) return 0;

            int secondsToAdd = 0;
            bool ruleMatched = false;

            // 1. Buscar coincidencia en reglas (Tiers)
            if (config.rules != null && config.rules.Count > 0)
            {
                // Ordenar descendente por cantidad mínima para encontrar la mejor coincidencia
                var sortedRules = config.rules.OrderByDescending(r => r.minAmount).ToList();

                foreach (var rule in sortedRules)
                {
                    bool matches = rule.exactAmount ? (amount == rule.minAmount) : (amount >= rule.minAmount);
                    
                    if (matches)
                    {
                        if (rule.isPerUnit)
                        {
                            // Modo Multiplicador: TiempoRegla * Cantidad
                            secondsToAdd = rule.timeAdded * amount;
                            _logger.LogInformation($"[TIMER RULE] Match Multiplier Rule: {amount} >= {rule.minAmount}. {rule.timeAdded}s * {amount} = {secondsToAdd}s");
                        }
                        else
                        {
                            // Modo Fijo: TiempoRegla (Total)
                            secondsToAdd = rule.timeAdded;
                            _logger.LogInformation($"[TIMER RULE] Match Fixed Rule: {amount} >= {rule.minAmount} -> +{secondsToAdd}s");
                        }
                        ruleMatched = true;
                        break; // Ya encontramos la regla más alta
                    }
                }
            }

            // 2. Fallback: Cálculo Base si no hubo coincidencia de reglas
            if (!ruleMatched)
            {
                // Cálculo estándar: (Cantidad / Unidad) * TiempoBase
                // Ej para bits: (500 / 100) * 60s
                // Ej para subs: (1 / 1) * 300s
                
                // Evitar división por cero
                if (defaultPerUnit <= 0) defaultPerUnit = 1;

                var multiplier = (double)amount / defaultPerUnit;
                secondsToAdd = (int)(multiplier * config.time);

                _logger.LogInformation($"[TIMER BASE] No rules matched. Base Calc: ({amount}/{defaultPerUnit}) * {config.time}s = {secondsToAdd}s");
            }

            return secondsToAdd;
        }

        // ========================================================================
        // MÉTODOS DE PROCESAMIENTO
        // ========================================================================

        /// <summary>
        /// Procesa un evento de Bits (Cheer) y añade tiempo al timer
        /// </summary>
        public async Task<bool> ProcessCheerEventAsync(string channelName, string userName, int bitsAmount, bool isTest = false)
        {
            try
            {
                _logger.LogInformation($"[TIMER EVENT] Procesando Cheer: {bitsAmount} bits de {userName} en {channelName}");

                if (string.IsNullOrEmpty(channelName) || bitsAmount <= 0) return false;

                var channelLower = channelName.ToLower();
                var config = await _dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == channelLower);
                if (config == null) return false;

                var eventsConfig = ParseEventsConfig(config.EventsConfig);
                if (eventsConfig == null) return false;

                // --- CÁLCULO DE TIEMPO (USANDO NUEVO HELPER) ---
                // Para bits, la unidad por defecto suele ser 100 bits (Legacy perBits) o 1 si se migró.
                // Usamos perBits si existe y es > 0, sino 100.
                int perBitsUnit = eventsConfig.bits.perBits > 0 ? eventsConfig.bits.perBits : 100;
                
                int secondsToAdd = CalculateTimeWithRules(eventsConfig.bits, bitsAmount, perBitsUnit);

                if (secondsToAdd <= 0) return false;

                // Happy Hour
                var happyHourMultiplier = await GetActiveHappyHourMultiplierAsync(channelLower);
                if (happyHourMultiplier > 1.0)
                {
                    secondsToAdd = (int)Math.Round(secondsToAdd * happyHourMultiplier);
                }

                // Alertas
                var alertsConfig = ParseAlertsConfig(config.AlertsConfig);
                var alertEventConfig = alertsConfig?.events?.bits;

                // Generar TTS
                var (ttsTemplateUrl, ttsTemplateVolume, ttsUserMessageUrl, ttsUserMessageVolume) =
                    await GenerateTtsUrlsAsync(alertEventConfig?.GetTts(), channelLower, userName, bitsAmount, null);

                if (isTest) {
                    await _overlayNotificationService.SendTimerEventAlertAsync(
                        channelLower,
                        new {
                            eventType = "bits",
                            userName = userName,
                            amount = bitsAmount,
                            secondsAdded = secondsToAdd,
                            message = $"+{FormatTime(secondsToAdd)} por {bitsAmount} bits de {userName}! 💎",
                            advancedMediaEnabled = alertEventConfig?.GetAdvancedMediaEnabled(),
                            advancedMedia = alertEventConfig?.GetAdvancedMedia(),
                            ttsTemplateUrl,
                            ttsTemplateVolume,
                            ttsUserMessageUrl,
                            ttsUserMessageVolume
                        });
                    return true;
                }

                var timerState = await _dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);
                if (timerState == null || timerState.Status == "stopped") return false;

                var result = await AddTimeToTimerAsync(
                    timerState,
                    secondsToAdd,
                    "bits",
                    userName,
                    new { bits = bitsAmount } 
                );

                if (!result) return false;

                await _overlayNotificationService.SendAddTimeAsync(channelLower, secondsToAdd);

                await _overlayNotificationService.SendTimerEventAlertAsync(
                    channelLower,
                    new {
                        eventType = "bits",
                        userName = userName,
                        amount = bitsAmount,
                        secondsAdded = secondsToAdd,
                        message = $"+{FormatTime(secondsToAdd)} por {bitsAmount} bits de {userName}! 💎",
                        advancedMediaEnabled = alertEventConfig?.advancedMediaEnabled,
                        advancedMedia = alertEventConfig?.advancedMedia,
                        ttsTemplateUrl,
                        ttsTemplateVolume,
                        ttsUserMessageUrl,
                        ttsUserMessageVolume
                    });

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[TIMER EVENT] Error procesando Cheer");
                return false;
            }
        }

        /// <summary>
        /// Procesa un evento de Subscripción y añade tiempo al timer
        /// </summary>
        public async Task<bool> ProcessSubscribeEventAsync(string channelName, string userName, string tier, int months = 1, bool isPrime = false, bool isTest = false)
        {
            try
            {
                var subType = isPrime ? "Prime Gaming Sub" : $"Sub Tier {tier}";
                _logger.LogInformation($"[TIMER EVENT] Procesando {subType}: {userName} ({months} meses) en {channelName}");

                if (string.IsNullOrEmpty(channelName) || string.IsNullOrEmpty(tier)) return false;

                var channelLower = channelName.ToLower();
                var config = await _dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == channelLower);
                if (config == null) return false;

                var eventsConfig = ParseEventsConfig(config.EventsConfig);
                if (eventsConfig == null) return false;

                // --- CÁLCULO DE TIEMPO ---
                EventConfig targetConfig = null;
                string tierName = "";
                string eventType = "subscribe";

                if (isPrime && tier == "1000")
                {
                    targetConfig = (eventsConfig.subPrime != null && eventsConfig.subPrime.enabled) ? eventsConfig.subPrime : eventsConfig.subTier1;
                    tierName = (eventsConfig.subPrime != null && eventsConfig.subPrime.enabled) ? "Prime Gaming" : "Tier 1";
                    if (eventsConfig.subPrime != null && eventsConfig.subPrime.enabled) eventType = "subscribe_prime";
                }
                else
                {
                    switch (tier)
                    {
                        case "1000": targetConfig = eventsConfig.subTier1; tierName = "Tier 1"; break;
                        case "2000": targetConfig = eventsConfig.subTier2; tierName = "Tier 2"; break;
                        case "3000": targetConfig = eventsConfig.subTier3; tierName = "Tier 3"; break;
                        default: return false;
                    }
                }

                // Usamos 'months' como la cantidad para las reglas (ej: Regla para veteranos de 12 meses)
                int secondsToAdd = CalculateTimeWithRules(targetConfig, months, 1);

                if (secondsToAdd <= 0 && !isTest) return false; // Permitimos test incluso si es 0 para debug

                // Happy Hour
                var happyHourMultiplier = await GetActiveHappyHourMultiplierAsync(channelLower);
                if (happyHourMultiplier > 1.0)
                {
                    secondsToAdd = (int)Math.Round(secondsToAdd * happyHourMultiplier);
                }

                var alertsConfig = ParseAlertsConfig(config.AlertsConfig);
                var alertEventConfig = alertsConfig?.events?.sub;
                var emoji = isPrime ? "👑" : "🎉";

                // Generar TTS
                var (ttsTemplateUrl, ttsTemplateVolume, ttsUserMessageUrl, ttsUserMessageVolume) =
                    await GenerateTtsUrlsAsync(alertEventConfig?.GetTts(), channelLower, userName, months, null);

                if (isTest)
                {
                     await _overlayNotificationService.SendTimerEventAlertAsync(
                        channelLower,
                        new
                        {
                            eventType = eventType,
                            userName = userName,
                            tier = tierName,
                            months = months,
                            isPrime = isPrime,
                            secondsAdded = secondsToAdd,
                            message = $"+{FormatTime(secondsToAdd)} por sub {tierName} de {userName}! {emoji}",
                            soundUrl = alertEventConfig?.sound?.enabled == true ? alertEventConfig?.sound?.url : null,
                            soundVolume = alertEventConfig?.sound?.volume ?? 100,
                            advancedMediaEnabled = alertEventConfig?.GetAdvancedMediaEnabled(),
                            advancedMedia = alertEventConfig?.GetAdvancedMedia(),
                            ttsTemplateUrl,
                            ttsTemplateVolume,
                            ttsUserMessageUrl,
                            ttsUserMessageVolume
                        });
                    return true;
                }

                var timerState = await _dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);
                if (timerState == null || timerState.Status == "stopped") return false;

                var result = await AddTimeToTimerAsync(
                    timerState,
                    secondsToAdd,
                    eventType,
                    userName,
                    new { tier = tier, tierName = tierName, months = months, isPrime = isPrime }
                );
                if (!result) return false;

                await _overlayNotificationService.SendAddTimeAsync(channelLower, secondsToAdd);

                await _overlayNotificationService.SendTimerEventAlertAsync(
                    channelLower,
                    new
                    {
                        eventType = eventType,
                        userName = userName,
                        tier = tierName,
                        months = months,
                        isPrime = isPrime,
                        secondsAdded = secondsToAdd,
                        message = $"+{FormatTime(secondsToAdd)} por sub {tierName} de {userName}! {emoji}",
                        soundUrl = alertEventConfig?.sound?.enabled == true ? alertEventConfig?.sound?.url : null,
                        soundVolume = alertEventConfig?.sound?.volume ?? 100,
                        advancedMediaEnabled = alertEventConfig?.advancedMediaEnabled,
                        advancedMedia = alertEventConfig?.advancedMedia,
                        ttsTemplateUrl,
                        ttsTemplateVolume,
                        ttsUserMessageUrl,
                        ttsUserMessageVolume
                    });

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[TIMER EVENT] Error procesando Subscribe event");
                return false;
            }
        }

        /// <summary>
        /// Procesa un evento de Gift Sub y añade tiempo al timer
        /// </summary>
        public async Task<bool> ProcessGiftSubEventAsync(string channelName, string userName, int total, bool isTest = false)
        {
            try
            {
                _logger.LogInformation($"[TIMER EVENT] Procesando Gift Sub: {total} subs de {userName} en {channelName}");

                var channelLower = channelName.ToLower();
                var config = await _dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == channelLower);
                if (config == null) return false;

                var eventsConfig = ParseEventsConfig(config.EventsConfig);
                if (eventsConfig == null) return false;

                // --- CÁLCULO DE TIEMPO ---
                // 'total' es la cantidad de subs regaladas. 
                // Default logic: multiplicar time * total.
                // Nueva logic: Rules check (ej: 5 subs -> bonus).
                int secondsToAdd = CalculateTimeWithRules(eventsConfig.giftSub, total, 1);

                var happyHourMultiplier = await GetActiveHappyHourMultiplierAsync(channelLower);
                if (happyHourMultiplier > 1.0)
                {
                    secondsToAdd = (int)Math.Round(secondsToAdd * happyHourMultiplier);
                }

                var alertsConfig = ParseAlertsConfig(config.AlertsConfig);
                var alertEventConfig = alertsConfig?.events?.gift;

                // Generar TTS
                var (ttsTemplateUrl, ttsTemplateVolume, ttsUserMessageUrl, ttsUserMessageVolume) =
                    await GenerateTtsUrlsAsync(alertEventConfig?.GetTts(), channelLower, userName, total, null);

                if (isTest)
                {
                    await _overlayNotificationService.SendTimerEventAlertAsync(
                        channelLower,
                        new
                        {
                            eventType = "giftsub",
                            userName = userName,
                            total = total,
                            secondsAdded = secondsToAdd,
                            message = $"+{FormatTime(secondsToAdd)} por {total} subs regaladas de {userName}! 🎁",
                            soundUrl = alertEventConfig?.sound?.enabled == true ? alertEventConfig?.sound?.url : null,
                            soundVolume = alertEventConfig?.sound?.volume ?? 100,
                            advancedMediaEnabled = alertEventConfig?.GetAdvancedMediaEnabled(),
                            advancedMedia = alertEventConfig?.GetAdvancedMedia(),
                            ttsTemplateUrl,
                            ttsTemplateVolume,
                            ttsUserMessageUrl,
                            ttsUserMessageVolume
                        });
                    return true;
                }

                var timerState = await _dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);
                if (timerState == null || timerState.Status == "stopped") return false;

                var result = await AddTimeToTimerAsync(
                    timerState,
                    secondsToAdd,
                    "giftsub",
                    userName,
                    new { total = total }
                );
                if (!result) return false;

                await _overlayNotificationService.SendAddTimeAsync(channelLower, secondsToAdd);

                await _overlayNotificationService.SendTimerEventAlertAsync(
                    channelLower,
                    new
                    {
                        eventType = "giftsub",
                        userName = userName,
                        total = total,
                        secondsAdded = secondsToAdd,
                        message = $"+{FormatTime(secondsToAdd)} por {total} subs regaladas de {userName}! 🎁",
                        soundUrl = alertEventConfig?.sound?.enabled == true ? alertEventConfig?.sound?.url : null,
                        soundVolume = alertEventConfig?.sound?.volume ?? 100,
                        advancedMediaEnabled = alertEventConfig?.advancedMediaEnabled,
                        advancedMedia = alertEventConfig?.advancedMedia,
                        ttsTemplateUrl,
                        ttsTemplateVolume,
                        ttsUserMessageUrl,
                        ttsUserMessageVolume
                    });

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[TIMER EVENT] Error procesando GiftSub event");
                return false;
            }
        }

        /// <summary>
        /// Procesa un evento de Raid y añade tiempo al timer
        /// </summary>
        public async Task<bool> ProcessRaidEventAsync(string channelName, string raiderName, int viewers, bool isTest = false)
        {
            try
            {
                _logger.LogInformation($"[TIMER EVENT] Procesando Raid: {viewers} viewers de {raiderName} en {channelName}");

                var channelLower = channelName.ToLower();
                var config = await _dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == channelLower);
                if (config == null) return false;

                var eventsConfig = ParseEventsConfig(config.EventsConfig);
                if (eventsConfig == null) return false;

                // --- CÁLCULO DE TIEMPO ---
                // Raid tiene lógica especial: Base + (Viewer * TimePerViewer)
                // Pero ahora también soporta reglas (ej: >100 viewers = premio gordo).
                
                int secondsToAdd = 0;
                
                // Primero intentamos reglas especiales (EventRule)
                // Usamos 'viewers' como la cantidad para evaluar reglas
                secondsToAdd = CalculateTimeWithRules(eventsConfig.raid, viewers, 1);

                // Si CalculateTimeWithRules usó el fallback (reglas no matched), 
                // el fallback por defecto es (viewers * baseTime). 
                // Pero Raid tiene lógica diferente: Base + (PerViewer * Viewers).
                // Así que si NO hubo regla matched, recalculamos manualmente.
                bool customRaidLogicNeeded = true;
                if (eventsConfig.raid.rules != null && eventsConfig.raid.rules.Count > 0)
                {
                    // Verificar si alguna regla hizo match
                    foreach(var r in eventsConfig.raid.rules) {
                        if ((r.exactAmount && viewers == r.minAmount) || (!r.exactAmount && viewers >= r.minAmount)) {
                            customRaidLogicNeeded = false; // Ya se calculó con regla
                            break;
                        }
                    }
                }

                if (customRaidLogicNeeded)
                {
                    // Lógica Raid Base: BaseTime + (Viewers * TimePerViewer)
                    secondsToAdd = eventsConfig.raid.time + (viewers * eventsConfig.raid.timePerParticipant);
                    _logger.LogInformation($"[TIMER RAID] Using Standard Raid Calc: {eventsConfig.raid.time} + ({viewers} * {eventsConfig.raid.timePerParticipant}) = {secondsToAdd}");
                }

                var happyHourMultiplier = await GetActiveHappyHourMultiplierAsync(channelLower);
                if (happyHourMultiplier > 1.0)
                {
                    secondsToAdd = (int)Math.Round(secondsToAdd * happyHourMultiplier);
                }

                var alertsConfig = ParseAlertsConfig(config.AlertsConfig);
                var alertEventConfig = alertsConfig?.events?.raid;

                // Generar TTS
                var (ttsTemplateUrl, ttsTemplateVolume, ttsUserMessageUrl, ttsUserMessageVolume) =
                    await GenerateTtsUrlsAsync(alertEventConfig?.GetTts(), channelLower, raiderName, viewers, null);

                if (isTest)
                {
                    await _overlayNotificationService.SendTimerEventAlertAsync(
                        channelLower,
                        new
                        {
                            eventType = "raid",
                            userName = raiderName,
                            viewers = viewers,
                            secondsAdded = secondsToAdd,
                            message = $"+{FormatTime(secondsToAdd)} por raid de {viewers} viewers de {raiderName}! 👥",
                            soundUrl = alertEventConfig?.sound?.enabled == true ? alertEventConfig?.sound?.url : null,
                            soundVolume = alertEventConfig?.sound?.volume ?? 100,
                            advancedMediaEnabled = alertEventConfig?.GetAdvancedMediaEnabled(),
                            advancedMedia = alertEventConfig?.GetAdvancedMedia(),
                            ttsTemplateUrl,
                            ttsTemplateVolume,
                            ttsUserMessageUrl,
                            ttsUserMessageVolume
                        });
                    return true;
                }

                var timerState = await _dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);
                if (timerState == null || timerState.Status == "stopped") return false;

                var result = await AddTimeToTimerAsync(
                    timerState,
                    secondsToAdd,
                    "raid",
                    raiderName,
                    new { viewers = viewers }
                );
                if (!result) return false;

                await _overlayNotificationService.SendAddTimeAsync(channelLower, secondsToAdd);

                await _overlayNotificationService.SendTimerEventAlertAsync(
                    channelLower,
                    new
                    {
                        eventType = "raid",
                        userName = raiderName,
                        viewers = viewers,
                        secondsAdded = secondsToAdd,
                        message = $"+{FormatTime(secondsToAdd)} por raid de {viewers} viewers de {raiderName}! 👥",
                        soundUrl = alertEventConfig?.sound?.enabled == true ? alertEventConfig?.sound?.url : null,
                        soundVolume = alertEventConfig?.sound?.volume ?? 100,
                        advancedMediaEnabled = alertEventConfig?.advancedMediaEnabled,
                        advancedMedia = alertEventConfig?.advancedMedia,
                        ttsTemplateUrl,
                        ttsTemplateVolume,
                        ttsUserMessageUrl,
                        ttsUserMessageVolume
                    });

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[TIMER EVENT] Error procesando Raid event");
                return false;
            }
        }

        /// <summary>
        /// Procesa un evento de Hype Train y añade tiempo al timer
        /// </summary>
        public async Task<bool> ProcessHypeTrainEventAsync(string channelName, int level, bool isTest = false)
        {
            try
            {
                _logger.LogInformation($"[TIMER EVENT] Procesando Hype Train nivel {level} en {channelName}");

                var channelLower = channelName.ToLower();
                var config = await _dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == channelLower);
                if (config == null) return false;

                var eventsConfig = ParseEventsConfig(config.EventsConfig);
                if (eventsConfig == null || !eventsConfig.hypeTrain.enabled) return false;

                // --- CÁLCULO DE TIEMPO ---
                // Usamos 'level' como amount.
                int secondsToAdd = CalculateTimeWithRules(eventsConfig.hypeTrain, level, 1);

                var happyHourMultiplier = await GetActiveHappyHourMultiplierAsync(channelLower);
                if (happyHourMultiplier > 1.0)
                {
                    secondsToAdd = (int)Math.Round(secondsToAdd * happyHourMultiplier);
                }

                var alertsConfig = ParseAlertsConfig(config.AlertsConfig);
                var alertEventConfig = alertsConfig?.events?.hypetrain;

                // Generar TTS
                var (ttsTemplateUrl, ttsTemplateVolume, ttsUserMessageUrl, ttsUserMessageVolume) =
                    await GenerateTtsUrlsAsync(alertEventConfig?.GetTts(), channelLower, channelName, level, null);

                if (isTest)
                {
                    await _overlayNotificationService.SendTimerEventAlertAsync(
                        channelLower,
                        new
                        {
                            eventType = "hypetrain",
                            level = level,
                            secondsAdded = secondsToAdd,
                            message = $"+{FormatTime(secondsToAdd)} por Hype Train nivel {level}! 🚂",
                            soundUrl = alertEventConfig?.sound?.enabled == true ? alertEventConfig?.sound?.url : null,
                            soundVolume = alertEventConfig?.sound?.volume ?? 100,
                            advancedMediaEnabled = alertEventConfig?.GetAdvancedMediaEnabled(),
                            advancedMedia = alertEventConfig?.GetAdvancedMedia(),
                            ttsTemplateUrl,
                            ttsTemplateVolume,
                            ttsUserMessageUrl,
                            ttsUserMessageVolume
                        });
                    return true;
                }

                var timerState = await _dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);
                if (timerState == null || timerState.Status == "stopped") return false;

                var result = await AddTimeToTimerAsync(
                    timerState,
                    secondsToAdd,
                    "hypetrain",
                    channelName,
                    new { level = level }
                );
                if (!result) return false;

                await _overlayNotificationService.SendAddTimeAsync(channelLower, secondsToAdd);

                await _overlayNotificationService.SendTimerEventAlertAsync(
                    channelLower,
                    new
                    {
                        eventType = "hypetrain",
                        level = level,
                        secondsAdded = secondsToAdd,
                        message = $"+{FormatTime(secondsToAdd)} por Hype Train nivel {level}! 🚂",
                        soundUrl = alertEventConfig?.sound?.enabled == true ? alertEventConfig?.sound?.url : null,
                        soundVolume = alertEventConfig?.sound?.volume ?? 100,
                        advancedMediaEnabled = alertEventConfig?.advancedMediaEnabled,
                        advancedMedia = alertEventConfig?.advancedMedia,
                        ttsTemplateUrl,
                        ttsTemplateVolume,
                        ttsUserMessageUrl,
                        ttsUserMessageVolume
                    });

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[TIMER EVENT] Error procesando HypeTrain event");
                return false;
            }
        }

        /// <summary>
        /// Procesa un evento de Tip/Donación y añade tiempo al timer
        /// </summary>
        public async Task<bool> ProcessTipEventAsync(
            string channelName,
            string donorName,
            decimal amount,
            string currency,
            string message = null,
            bool isTest = false)
        {
            try
            {
                _logger.LogInformation($"[TIMER EVENT] Procesando Tip: {amount} {currency} de {donorName} en {channelName}");

                if (string.IsNullOrEmpty(channelName) || amount <= 0) return false;

                var channelLower = channelName.ToLower();
                var config = await _dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == channelLower);
                if (config == null) return false;

                var eventsConfig = ParseEventsConfig(config.EventsConfig);
                if (eventsConfig == null || !eventsConfig.tips.enabled) return false;

                // --- CÁLCULO DE TIEMPO ---
                // Similar a bits: (amount / perCurrency) * time
                decimal perCurrencyUnit = eventsConfig.tips.perCurrency > 0 ? eventsConfig.tips.perCurrency : 1;

                // Convertir amount a int para usar con las reglas
                int amountInt = (int)Math.Floor(amount);
                int secondsToAdd = CalculateTimeWithRules(eventsConfig.tips, amountInt, (int)perCurrencyUnit);

                // Si no hubo match de reglas, calcular manualmente con decimales
                if (secondsToAdd == 0 && eventsConfig.tips.time > 0)
                {
                    var multiplier = amount / perCurrencyUnit;
                    secondsToAdd = (int)(multiplier * eventsConfig.tips.time);
                    _logger.LogInformation($"[TIMER TIP] Base Calc: ({amount}/{perCurrencyUnit}) * {eventsConfig.tips.time}s = {secondsToAdd}s");
                }

                if (secondsToAdd <= 0 && !isTest) return false;

                // Happy Hour
                var happyHourMultiplier = await GetActiveHappyHourMultiplierAsync(channelLower);
                if (happyHourMultiplier > 1.0)
                {
                    secondsToAdd = (int)Math.Round(secondsToAdd * happyHourMultiplier);
                }

                // Alertas
                var alertsConfig = ParseAlertsConfig(config.AlertsConfig);
                var alertEventConfig = alertsConfig?.events?.tips;

                var formattedAmount = FormatCurrency(amount, currency);

                // Generar TTS (con moneda formateada)
                var (ttsTemplateUrl, ttsTemplateVolume, ttsUserMessageUrl, ttsUserMessageVolume) =
                    await GenerateTtsUrlsAsync(alertEventConfig?.GetTts(), channelLower, donorName, (int)amount, message, formattedAmount, currency);
                var alertMessage = $"+{FormatTime(secondsToAdd)} por {formattedAmount} de {donorName}! 💰";
                if (!string.IsNullOrEmpty(message))
                {
                    alertMessage += $" \"{message}\"";
                }

                if (isTest)
                {
                    await _overlayNotificationService.SendTimerEventAlertAsync(
                        channelLower,
                        new
                        {
                            eventType = "tips",
                            userName = donorName,
                            amount = amount,
                            currency = currency,
                            tipMessage = message,
                            secondsAdded = secondsToAdd,
                            message = alertMessage,
                            soundUrl = alertEventConfig?.sound?.enabled == true ? alertEventConfig?.sound?.url : null,
                            soundVolume = alertEventConfig?.sound?.volume ?? 100,
                            advancedMediaEnabled = alertEventConfig?.GetAdvancedMediaEnabled(),
                            advancedMedia = alertEventConfig?.GetAdvancedMedia(),
                            ttsTemplateUrl,
                            ttsTemplateVolume,
                            ttsUserMessageUrl,
                            ttsUserMessageVolume
                        });
                    return true;
                }

                var timerState = await _dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);
                if (timerState == null || timerState.Status == "stopped") return false;

                var result = await AddTimeToTimerAsync(
                    timerState,
                    secondsToAdd,
                    "tips",
                    donorName,
                    new { amount = amount, currency = currency, message = message }
                );

                if (!result) return false;

                await _overlayNotificationService.SendAddTimeAsync(channelLower, secondsToAdd);

                await _overlayNotificationService.SendTimerEventAlertAsync(
                    channelLower,
                    new
                    {
                        eventType = "tips",
                        userName = donorName,
                        amount = amount,
                        currency = currency,
                        tipMessage = message,
                        secondsAdded = secondsToAdd,
                        message = alertMessage,
                        soundUrl = alertEventConfig?.sound?.enabled == true ? alertEventConfig?.sound?.url : null,
                        soundVolume = alertEventConfig?.sound?.volume ?? 100,
                        advancedMediaEnabled = alertEventConfig?.advancedMediaEnabled,
                        advancedMedia = alertEventConfig?.advancedMedia,
                        ttsTemplateUrl,
                        ttsTemplateVolume,
                        ttsUserMessageUrl,
                        ttsUserMessageVolume
                    });

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[TIMER EVENT] Error procesando Tip event");
                return false;
            }
        }

        /// <summary>
        /// Formatea un monto con su moneda
        /// </summary>
        private string FormatCurrency(decimal amount, string currency)
        {
            return currency?.ToUpper() switch
            {
                "USD" => $"${amount:F2}",
                "EUR" => $"€{amount:F2}",
                "GBP" => $"£{amount:F2}",
                "MXN" => $"${amount:F2} MXN",
                "BRL" => $"R${amount:F2}",
                "ARS" => $"${amount:F2} ARS",
                "CLP" => $"${amount:F0} CLP",
                "COP" => $"${amount:F0} COP",
                "PEN" => $"S/{amount:F2}",
                _ => $"{amount:F2} {currency}"
            };
        }

        /// <summary>
        /// Procesa un evento de Follow y añade tiempo al timer
        /// </summary>
        public async Task<bool> ProcessFollowEventAsync(string channelName, string userName, string userId = null, bool isTest = false)
        {
            try
            {
                _logger.LogInformation($"[TIMER EVENT] Procesando Follow: {userName} (ID: {userId}) en {channelName}");

                var channelLower = channelName.ToLower();

                // 1. Obtener configuración
                var config = await _dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == channelLower);
                if (config == null) return false;

                // 2. Parsear eventsConfig
                var eventsConfig = ParseEventsConfig(config.EventsConfig);
                if (eventsConfig == null || !eventsConfig.follow.enabled) return false;

                var secondsToAdd = eventsConfig.follow.time;
                var cooldownSeconds = eventsConfig.follow.cooldown;

                // 2.5 Aplicar multiplicador de Happy Hour
                var happyHourMultiplier = await GetActiveHappyHourMultiplierAsync(channelLower);
                if (happyHourMultiplier > 1.0)
                {
                    secondsToAdd = (int)Math.Round(secondsToAdd * happyHourMultiplier);
                }

                var alertsConfig = ParseAlertsConfig(config.AlertsConfig);
                var alertEventConfig = alertsConfig?.events?.follow;

                // Generar TTS
                var (ttsTemplateUrl, ttsTemplateVolume, ttsUserMessageUrl, ttsUserMessageVolume) =
                    await GenerateTtsUrlsAsync(alertEventConfig?.GetTts(), channelLower, userName, null, null);

                if (isTest)
                {
                    await _overlayNotificationService.SendTimerEventAlertAsync(
                        channelLower,
                        new
                        {
                            eventType = "follow",
                            userName = userName,
                            secondsAdded = secondsToAdd,
                            message = $"+{FormatTime(secondsToAdd)} por follow de {userName}! ❤️",
                            soundUrl = alertEventConfig?.sound?.enabled == true ? alertEventConfig?.sound?.url : null,
                            soundVolume = alertEventConfig?.sound?.volume ?? 100,
                            advancedMediaEnabled = alertEventConfig?.GetAdvancedMediaEnabled(),
                            advancedMedia = alertEventConfig?.GetAdvancedMedia(),
                            ttsTemplateUrl,
                            ttsTemplateVolume,
                            ttsUserMessageUrl,
                            ttsUserMessageVolume
                        });
                    return true;
                }

                // 3. Verificar cooldown
                if (!string.IsNullOrEmpty(userId))
                {
                    var isInCooldown = await IsInCooldownAsync(channelLower, "follow", userId, cooldownSeconds);
                    if (isInCooldown) return false;
                }

                // 4. Validar timer activo
                var timerState = await _dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);
                if (timerState == null || timerState.Status == "stopped") return false;

                // 5. Añadir tiempo
                var result = await AddTimeToTimerAsync(
                    timerState,
                    secondsToAdd,
                    "follow",
                    userName,
                    new { time = secondsToAdd }
                );
                if (!result) return false;

                // 6. Actualizar cooldown
                if (!string.IsNullOrEmpty(userId))
                {
                    await UpdateCooldownAsync(channelLower, "follow", userId, userName);
                }

                // 7. Emitir evento SignalR
                await _overlayNotificationService.SendAddTimeAsync(channelLower, secondsToAdd);

                // 9. Emitir alerta visual al overlay
                await _overlayNotificationService.SendTimerEventAlertAsync(
                    channelLower,
                    new
                    {
                        eventType = "follow",
                        userName = userName,
                        secondsAdded = secondsToAdd,
                        message = $"+{FormatTime(secondsToAdd)} por follow de {userName}! ❤️",
                        soundUrl = alertEventConfig?.sound?.enabled == true ? alertEventConfig?.sound?.url : null,
                        soundVolume = alertEventConfig?.sound?.volume ?? 100,
                        advancedMediaEnabled = alertEventConfig?.advancedMediaEnabled,
                        advancedMedia = alertEventConfig?.advancedMedia,
                        ttsTemplateUrl,
                        ttsTemplateVolume,
                        ttsUserMessageUrl,
                        ttsUserMessageVolume
                    });

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[TIMER EVENT] Error procesando Follow event");
                return false;
            }
        }

        // ========================================================================
        // MÉTODOS PRIVADOS / HELPERS
        // ========================================================================

        /// <summary>
        /// Añade tiempo al timer y registra en el log de eventos
        /// Utiliza una transacción con bloqueo de fila (FOR UPDATE) para prevenir condiciones de carrera
        /// </summary>
        private async Task<bool> AddTimeToTimerAsync(
            TimerState initialState, 
            int secondsToAdd,
            string eventType = "unknown",
            string username = "Unknown",
            object? eventData = null)
        {
            var channelName = initialState.ChannelName;

            // Iniciar transacción para asegurar atomicidad y bloqueo
            using var transaction = await _dbContext.Database.BeginTransactionAsync();
            try
            {
                // 🔒 BLOQUEO DE BASE DE DATOS (Pessimistic Locking)
                // Esto bloquea la fila del timer hasta que se complete la transacción.
                await _dbContext.Database.ExecuteSqlRawAsync(
                    "SELECT 1 FROM timer_states WHERE channel_name = {0} FOR UPDATE", 
                    channelName);

                // Obtener el estado (ahora seguro y actualizado)
                var state = await _dbContext.TimerStates
                    .FirstOrDefaultAsync(s => s.ChannelName == channelName);

                if (state == null)
                {
                    _logger.LogDebug($"No active timer state for {channelName}, skipping time addition");
                    return false;
                }

                // Solo añadir tiempo si el timer está corriendo o pausado
                bool isResurrection = false;
                if (state.Status != "running" && state.Status != "paused")
                {
                    // VERIFICAR CHANCES (Vidas Extra)
                    var config = await _dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == channelName);
                    
                    if (config != null && config.MaxChances > 0 && state.UsedChances < config.MaxChances)
                    {
                        // GASTAR UNA VIDA
                        state.UsedChances++;
                        state.Status = "running"; // Resucitar
                        state.StartedAt = TimerDateTimeHelper.NowForDb(); // Reiniciar timestamp
                        state.ElapsedPausedTime = 0;
                        state.CurrentTime = 0; // Base 0
                        isResurrection = true;
                        
                        _logger.LogInformation($"[TIMER EVENT] 🍄 RESURRECCIÓN ACTIVADA! Vida {state.UsedChances}/{config.MaxChances} usada por evento {eventType}.");
                        
                        var msg = config.ResurrectionMessage ?? "🍄 ¡1UP! Se ha usado una vida extra ({lives}/{max}). El timer resucita.";
                        msg = msg.Replace("{lives}", state.UsedChances.ToString()).Replace("{max}", config.MaxChances.ToString());
                        // Fire and forget chat message to avoid blocking transaction
                        _ = _messageSender.SendMessageAsync(channelName, msg);
                    }
                    else
                    {
                        _logger.LogDebug($"Timer for {channelName} is {state.Status}, skipping time addition (No chances left).");
                        
                        var msg = config.GameOverMessage ?? "💀 El timer ha finalizado y no quedan vidas extra ({lives}/{max}).";
                        msg = msg.Replace("{lives}", state.UsedChances.ToString()).Replace("{max}", config.MaxChances.ToString());
                        _ = _messageSender.SendMessageAsync(channelName, msg);
                        
                        return false;
                    }
                }

                // Añadir tiempo
                state.CurrentTime += secondsToAdd;
                state.TotalTime += secondsToAdd;
                state.UpdatedAt = TimerDateTimeHelper.NowForDb();

                // 🕒 HISTORIAL: Actualizar TimerSession si existe
                if (state.CurrentSessionId.HasValue)
                {
                    var session = await _dbContext.TimerSessions.FindAsync(state.CurrentSessionId.Value);
                    if (session != null)
                    {
                        session.TotalAddedTime += secondsToAdd;
                        // No es necesario llamar a Update explícitamente, EF Core rastrea los cambios
                    }
                }

                await _dbContext.SaveChangesAsync();

                // Registrar en el log de eventos (dentro de la misma transacción)
                var eventLog = new TimerEventLog
                {
                    ChannelName = channelName,
                    EventType = eventType,
                    Username = username,
                    TimeAdded = secondsToAdd,
                    EventData = JsonSerializer.Serialize(eventData ?? new { }),
                    TimerSessionId = state.CurrentSessionId, // Vincular a la sesión actual
                    OccurredAt = TimerDateTimeHelper.NowForDb(),
                    CreatedAt = DateTime.UtcNow
                };

                _dbContext.TimerEventLogs.Add(eventLog);
                await _dbContext.SaveChangesAsync();

                // Confirmar transacción
                await transaction.CommitAsync();

                // Emitir evento SignalR (fuera de la transacción crítica)
                // Si hubo resurrección, enviamos StartTimer para que el frontend reaccione al cambio de estado
                if (isResurrection)
                {
                    await _overlayNotificationService.SendStartTimerAsync(channelName, state.CurrentTime);
                }
                
                await _overlayNotificationService.SendTimerStateUpdateAsync(channelName, new
                {
                    status = state.Status,
                    currentTime = state.CurrentTime,
                    totalTime = state.TotalTime,
                    startedAt = state.StartedAt,
                    pausedAt = state.PausedAt,
                    isVisible = state.IsVisible
                });

                await _overlayNotificationService.SendTimerCommandAsync(channelName, "event_time_added", new
                {
                    eventType,
                    username,
                    secondsAdded = secondsToAdd,
                    timestamp = DateTime.UtcNow
                });

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error crítico añadiendo tiempo al timer de {channelName} (Rollback)");
                await transaction.RollbackAsync();
                return false;
            }
        }

        /// <summary>
        /// Parsea el JSON de eventsConfig
        /// </summary>
        private EventsConfig ParseEventsConfig(string eventsConfigJson)
        {
            try
            {
                if (string.IsNullOrEmpty(eventsConfigJson))
                {
                    _logger.LogWarning("[TIMER EVENT] eventsConfig está vacío");
                    return null;
                }

                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };

                return JsonSerializer.Deserialize<EventsConfig>(eventsConfigJson, options);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[TIMER EVENT] Error parseando eventsConfig");
                return null;
            }
        }

        /// <summary>
        /// Parsea el JSON de alertsConfig
        /// </summary>
        private AlertsConfig ParseAlertsConfig(string alertsConfigJson)
        {
            try
            {
                if (string.IsNullOrEmpty(alertsConfigJson))
                {
                    _logger.LogDebug("[TIMER EVENT] alertsConfig está vacío");
                    return null;
                }

                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };

                return JsonSerializer.Deserialize<AlertsConfig>(alertsConfigJson, options);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[TIMER EVENT] Error parseando alertsConfig");
                return null;
            }
        }

        /// <summary>
        /// Verifica si un evento está en cooldown para un usuario específico
        /// </summary>
        /// <param name="channelName">Nombre del canal</param>
        /// <param name="eventType">Tipo de evento (follow, bits, sub, etc.)</param>
        /// <param name="userId">ID de Twitch del usuario</param>
        /// <param name="cooldownSeconds">Tiempo de cooldown en segundos (0 = sin cooldown)</param>
        /// <returns>True si está en cooldown, False si puede procesar el evento</returns>
        private async Task<bool> IsInCooldownAsync(string channelName, string eventType, string userId, int cooldownSeconds)
        {
            // Si no hay cooldown configurado, permitir el evento
            if (cooldownSeconds <= 0)
            {
                return false;
            }

            try
            {
                var cooldown = await _dbContext.TimerEventCooldowns
                    .FirstOrDefaultAsync(c =>
                        c.ChannelName == channelName &&
                        c.EventType == eventType &&
                        c.UserId == userId);

                if (cooldown == null)
                {
                    // No existe registro de cooldown, permitir el evento
                    return false;
                }

                // Calcular tiempo transcurrido desde el último trigger
                var timeSinceLastTrigger = (DateTime.UtcNow - cooldown.LastTriggeredAt).TotalSeconds;

                // Si no ha pasado suficiente tiempo, está en cooldown
                if (timeSinceLastTrigger < cooldownSeconds)
                {
                    var timeRemaining = cooldownSeconds - timeSinceLastTrigger;
                    _logger.LogInformation(
                        $"[TIMER EVENT] 🔒 Cooldown activo para {eventType} de user {userId} en {channelName}. " +
                        $"Tiempo restante: {FormatTime((int)timeRemaining)}");
                    return true;
                }

                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[TIMER EVENT] Error verificando cooldown para {eventType}");
                // En caso de error, permitir el evento para no bloquear la funcionalidad
                return false;
            }
        }

        /// <summary>
        /// Actualiza el timestamp del último trigger de un evento para un usuario
        /// </summary>
        /// <param name="channelName">Nombre del canal</param>
        /// <param name="eventType">Tipo de evento</param>
        /// <param name="userId">ID de Twitch del usuario</param>
        /// <param name="userName">Nombre del usuario (para logs)</param>
        private async Task UpdateCooldownAsync(string channelName, string eventType, string userId, string userName)
        {
            try
            {
                var cooldown = await _dbContext.TimerEventCooldowns
                    .FirstOrDefaultAsync(c =>
                        c.ChannelName == channelName &&
                        c.EventType == eventType &&
                        c.UserId == userId);

                if (cooldown == null)
                {
                    // Crear nuevo registro de cooldown
                    cooldown = new TimerEventCooldown
                    {
                        ChannelName = channelName,
                        EventType = eventType,
                        UserId = userId,
                        UserName = userName,
                        LastTriggeredAt = TimerDateTimeHelper.NowForDb(),
                        CreatedAt = DateTime.UtcNow
                    };
                    _dbContext.TimerEventCooldowns.Add(cooldown);
                    _logger.LogDebug($"[TIMER EVENT] Nuevo cooldown registrado: {eventType} para user {userId}");
                }
                else
                {
                    // Actualizar registro existente
                    cooldown.LastTriggeredAt = TimerDateTimeHelper.NowForDb();
                    cooldown.UserName = userName; // Actualizar por si cambió el username
                    _logger.LogDebug($"[TIMER EVENT] Cooldown actualizado: {eventType} para user {userId}");
                }

                await _dbContext.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[TIMER EVENT] Error actualizando cooldown para {eventType}");
                // No lanzar excepción, el evento ya se procesó correctamente
            }
        }

        /// <summary>
        /// Verifica si hay un Happy Hour activo y retorna el multiplicador a aplicar
        /// </summary>
        /// <param name="channelName">Nombre del canal</param>
        /// <returns>Multiplicador (1.0 si no hay Happy Hour activo, o el multiplicador configurado)</returns>
        private async Task<double> GetActiveHappyHourMultiplierAsync(string channelName)
        {
            try
            {
                // Check manual Happy Hour first
                if (ManualHappyHours.TryGetValue(channelName, out var manual))
                {
                    if (DateTime.UtcNow < manual.ExpiresAt)
                    {
                        _logger.LogInformation($"[HAPPY HOUR] Manual Happy Hour activo para {channelName} con multiplicador {manual.Multiplier}x (expira {manual.ExpiresAt:HH:mm:ss} UTC)");
                        return manual.Multiplier;
                    }
                    else
                    {
                        // Expired, remove it
                        ManualHappyHours.TryRemove(channelName, out _);
                    }
                }

                // Obtener el UserId a partir del channelName
                var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Login.ToLower() == channelName);
                if (user == null)
                {
                    _logger.LogWarning($"[HAPPY HOUR] Usuario no encontrado para canal: {channelName}");
                    return 1.0;
                }

                // Obtener configuración de Timer para la Zona Horaria
                var config = await _dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.UserId == user.Id);
                
                var now = TimerDateTimeHelper.NowForDb();
                if (config != null && !string.IsNullOrEmpty(config.TimeZone))
                {
                    try
                    {
                        var tz = TimeZoneInfo.FindSystemTimeZoneById(config.TimeZone);
                        now = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
                    }
                    catch 
                    {
                        // Fallback a UTC si falla la conversión
                    }
                }

                var currentTime = now.TimeOfDay;
                var currentDayOfWeek = (int)now.DayOfWeek; // 0 = Domingo, 6 = Sábado

                // Buscar Happy Hours activos para este usuario
                var activeHappyHours = await _dbContext.TimerHappyHours
                    .Where(hh =>
                        hh.UserId == user.Id &&
                        hh.Enabled)
                    .ToListAsync();

                if (!activeHappyHours.Any())
                {
                    return 1.0; // Sin multiplicador
                }

                // Verificar cada Happy Hour
                foreach (var hh in activeHappyHours)
                {
                    // Parsear días de la semana desde JSON
                    bool[] daysOfWeek;
                    try
                    {
                        daysOfWeek = System.Text.Json.JsonSerializer.Deserialize<bool[]>(hh.DaysOfWeek);
                    }
                    catch
                    {
                        _logger.LogWarning($"[HAPPY HOUR] Error parseando daysOfWeek para Happy Hour ID {hh.Id}");
                        continue;
                    }

                    // Verificar si hoy está habilitado
                    if (daysOfWeek == null || daysOfWeek.Length < 7 || !daysOfWeek[currentDayOfWeek])
                    {
                        continue;
                    }

                    // Verificar si la hora actual está dentro del rango
                    var startTime = hh.StartTime;
                    var endTime = hh.EndTime;

                    bool isInTimeRange;
                    if (endTime >= startTime)
                    {
                        // Rango normal (ej: 10:00 - 18:00)
                        isInTimeRange = currentTime >= startTime && currentTime <= endTime;
                    }
                    else
                    {
                        // Rango que cruza medianoche (ej: 22:00 - 02:00)
                        isInTimeRange = currentTime >= startTime || currentTime <= endTime;
                    }

                    if (isInTimeRange)
                    {
                        _logger.LogInformation($"[HAPPY HOUR] ✨ Happy Hour activo: '{hh.Name}' con multiplicador {hh.Multiplier}x");
                        return (double)hh.Multiplier;
                    }
                }

                return 1.0; // Sin multiplicador activo
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[HAPPY HOUR] Error verificando Happy Hours activos");
                return 1.0; // En caso de error, no aplicar multiplicador
            }
        }

        /// <summary>
        /// Genera URLs TTS para template y mensaje del usuario
        /// </summary>
        private async Task<(string ttsTemplateUrl, int ttsTemplateVolume, string ttsUserMessageUrl, int ttsUserMessageVolume)> GenerateTtsUrlsAsync(
            TtsEventConfig ttsConfig,
            string channelName,
            string userName,
            int? amount = null,
            string userMessage = null,
            string formattedAmount = null,
            string currency = null)
        {
            string ttsTemplateUrl = null;
            string ttsUserMessageUrl = null;
            int ttsTemplateVolume = ttsConfig?.templateVolume ?? 80;
            int ttsUserMessageVolume = ttsConfig?.userMessageVolume ?? 80;

            if (ttsConfig == null || !ttsConfig.enabled)
            {
                return (null, 80, null, 80);
            }

            // Formatear moneda para TTS (texto legible, no símbolos)
            var currencyText = currency?.ToUpper() switch
            {
                "USD" => "dólares",
                "EUR" => "euros",
                "GBP" => "libras",
                "MXN" => "pesos mexicanos",
                "ARS" => "pesos argentinos",
                "COP" => "pesos colombianos",
                "CLP" => "pesos chilenos",
                "PEN" => "soles",
                "BRL" => "reales",
                _ => currency ?? ""
            };

            // Para TTS siempre usar formato legible (número + moneda en texto)
            // Ignoramos formattedAmount porque tiene símbolos como $ que no se leen bien
            var displayAmount = !string.IsNullOrEmpty(currencyText)
                ? $"{amount} {currencyText}"
                : amount?.ToString() ?? "0";

            try
            {
                // Generar TTS del template
                if (!string.IsNullOrWhiteSpace(ttsConfig.template))
                {
                    var templateText = ttsConfig.template
                        // Variaciones de nombre de usuario
                        .Replace("{userName}", userName ?? "Anónimo")
                        .Replace("{username}", userName ?? "Anónimo")
                        .Replace("{user}", userName ?? "Anónimo")
                        .Replace("{name}", userName ?? "Anónimo")
                        .Replace("{donor}", userName ?? "Anónimo")
                        .Replace("{donorName}", userName ?? "Anónimo")
                        // Cantidad con moneda (para tips/donaciones)
                        .Replace("{amount}", displayAmount)
                        .Replace("{formattedAmount}", displayAmount)
                        // Cantidad numérica (para bits, viewers, etc.)
                        .Replace("{bits}", amount?.ToString() ?? "0")
                        .Replace("{viewers}", amount?.ToString() ?? "0")
                        .Replace("{months}", amount?.ToString() ?? "0")
                        .Replace("{subs}", amount?.ToString() ?? "0")
                        .Replace("{level}", amount?.ToString() ?? "0")
                        // Moneda sola
                        .Replace("{currency}", currencyText)
                        // Tiempo (placeholder)
                        .Replace("{time}", "tiempo");

                    ttsTemplateUrl = await _ttsService.GenerateAsync(
                        templateText,
                        ttsConfig.voice ?? "Lupe",
                        ttsConfig.engine ?? "standard",
                        ttsConfig.languageCode ?? "es-US",
                        channelName
                    );
                    _logger.LogInformation("[TIMER TTS] Template URL generada: {Url}", ttsTemplateUrl);
                }

                // Generar TTS del mensaje del usuario (si habilitado y existe mensaje)
                if (ttsConfig.readUserMessage && !string.IsNullOrWhiteSpace(userMessage))
                {
                    var maxChars = ttsConfig.maxChars > 0 ? ttsConfig.maxChars : 150;
                    var truncatedMessage = userMessage.Length > maxChars
                        ? userMessage.Substring(0, maxChars)
                        : userMessage;

                    ttsUserMessageUrl = await _ttsService.GenerateAsync(
                        truncatedMessage,
                        ttsConfig.voice ?? "Lupe",
                        ttsConfig.engine ?? "standard",
                        ttsConfig.languageCode ?? "es-US",
                        channelName
                    );
                    _logger.LogInformation("[TIMER TTS] User message URL generada: {Url}", ttsUserMessageUrl);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[TIMER TTS] Error generando TTS");
            }

            return (ttsTemplateUrl, ttsTemplateVolume, ttsUserMessageUrl, ttsUserMessageVolume);
        }

        /// <summary>
        /// Formatea segundos a formato legible (5m 30s, 1h 20m, etc.)
        /// </summary>
        private string FormatTime(int totalSeconds)
        {
            if (totalSeconds < 60)
            {
                return $"{totalSeconds}s";
            }

            var hours = totalSeconds / 3600;
            var minutes = (totalSeconds % 3600) / 60;
            var seconds = totalSeconds % 60;

            var parts = new System.Collections.Generic.List<string>();
            if (hours > 0) parts.Add($"{hours}h");
            if (minutes > 0) parts.Add($"{minutes}m");
            if (seconds > 0) parts.Add($"{seconds}s");

            return string.Join(" ", parts);
        }
    }
}
