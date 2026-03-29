using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace Decatron.Services
{
    public interface ITipsService
    {
        Task<TipsConfig?> GetConfig(long userId);
        Task<TipsConfig?> GetConfigByChannel(string channelName);
        Task<TipsConfig> SaveConfig(long userId, string channelName, TipsConfig config);
        Task<TipHistory> RecordTip(string channelName, string donorName, string? donorEmail, decimal amount, string currency, string? message, string? transactionId);
        Task<List<TipHistory>> GetRecentTips(string channelName, int limit = 50);
        Task<(List<TipHistory> Tips, int TotalCount)> GetPaginatedTips(string channelName, int page, int pageSize, string? search = null);
        Task<List<TopDonorResult>> GetTopDonors(string channelName, DateTime? since = null, int limit = 20);
        Task<TipStatistics> GetStatistics(string channelName, DateTime? since = null);
        Task MarkAlertShown(int tipId);
        Task<TipHistory?> GetPendingAlert(string channelName);
        Task SendAlertForTest(string channelName, string donorName, decimal amount, string currency, string? message);
    }

    public class TipStatistics
    {
        public decimal TotalAmount { get; set; }
        public int TotalCount { get; set; }
        public decimal AverageAmount { get; set; }
        public decimal LargestTip { get; set; }
        public string? TopDonor { get; set; }
        public decimal TopDonorTotal { get; set; }
        public int TotalTimeAdded { get; set; } // seconds
    }

    public class TopDonorResult
    {
        public string DonorName { get; set; } = "";
        public decimal TotalAmount { get; set; }
        public int DonationCount { get; set; }
        public decimal AverageAmount { get; set; }
        public DateTime LastDonation { get; set; }
    }

    public class TipsService : ITipsService
    {
        private readonly DecatronDbContext _context;
        private readonly ILogger<TipsService> _logger;
        private readonly OverlayNotificationService _overlayNotificationService;
        private readonly TimerEventService _timerEventService;
        private readonly ITtsService _ttsService;

        public TipsService(
            DecatronDbContext context,
            ILogger<TipsService> logger,
            OverlayNotificationService overlayNotificationService,
            TimerEventService timerEventService,
            ITtsService ttsService)
        {
            _context = context;
            _logger = logger;
            _overlayNotificationService = overlayNotificationService;
            _timerEventService = timerEventService;
            _ttsService = ttsService;
        }

        public async Task<TipsConfig?> GetConfig(long userId)
        {
            return await _context.TipsConfigs
                .FirstOrDefaultAsync(c => c.UserId == userId);
        }

        public async Task<TipsConfig?> GetConfigByChannel(string channelName)
        {
            return await _context.TipsConfigs
                .FirstOrDefaultAsync(c => c.ChannelName.ToLower() == channelName.ToLower());
        }

        public async Task<TipsConfig> SaveConfig(long userId, string channelName, TipsConfig config)
        {
            var existing = await GetConfig(userId);

            if (existing != null)
            {
                existing.ChannelName = channelName;
                existing.IsEnabled = config.IsEnabled;
                existing.PayPalEmail = config.PayPalEmail;
                existing.PayPalConnected = config.PayPalConnected;
                existing.Currency = config.Currency;
                existing.MinAmount = config.MinAmount;
                existing.MaxAmount = config.MaxAmount;
                existing.SuggestedAmounts = config.SuggestedAmounts;
                existing.PageTitle = config.PageTitle;
                existing.PageDescription = config.PageDescription;
                existing.PageAccentColor = config.PageAccentColor;
                existing.PageBackgroundImage = config.PageBackgroundImage;
                existing.AlertConfig = config.AlertConfig;
                existing.AlertMode = config.AlertMode;
                existing.BasicAlertSound = config.BasicAlertSound;
                existing.BasicAlertVolume = config.BasicAlertVolume;
                existing.BasicAlertDuration = config.BasicAlertDuration;
                existing.BasicAlertAnimation = config.BasicAlertAnimation;
                existing.BasicAlertMessage = config.BasicAlertMessage;
                existing.BasicAlertTts = config.BasicAlertTts;
                existing.BasicAlertOverlay = config.BasicAlertOverlay;
                existing.TipsAlertConfig = config.TipsAlertConfig;
                existing.TimerIntegrationEnabled = config.TimerIntegrationEnabled;
                existing.SecondsPerCurrency = config.SecondsPerCurrency;
                existing.TimeUnit = config.TimeUnit ?? "seconds";
                existing.MaxMessageLength = config.MaxMessageLength;
                existing.CooldownSeconds = config.CooldownSeconds;
                existing.BadWordsFilter = config.BadWordsFilter;
                existing.RequireMessage = config.RequireMessage;
                existing.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                return existing;
            }
            else
            {
                config.UserId = userId;
                config.ChannelName = channelName;
                config.CreatedAt = DateTime.UtcNow;
                config.UpdatedAt = DateTime.UtcNow;

                _context.TipsConfigs.Add(config);
                await _context.SaveChangesAsync();
                return config;
            }
        }

        public async Task<TipHistory> RecordTip(
            string channelName,
            string donorName,
            string? donorEmail,
            decimal amount,
            string currency,
            string? message,
            string? transactionId)
        {
            var config = await GetConfigByChannel(channelName);
            int timeAdded = 0;

            // Calculate time to add if timer integration is enabled
            if (config?.TimerIntegrationEnabled == true && config.SecondsPerCurrency > 0)
            {
                int unitMultiplier = (config.TimeUnit ?? "seconds") switch
                {
                    "minutes" => 60,
                    "hours"   => 3600,
                    "days"    => 86400,
                    _         => 1, // seconds
                };
                timeAdded = (int)(amount * config.SecondsPerCurrency * unitMultiplier);
            }

            var tip = new TipHistory
            {
                ChannelName = channelName,
                DonorName = donorName,
                DonorEmail = donorEmail,
                Amount = amount,
                Currency = currency,
                Message = message,
                PayPalTransactionId = transactionId,
                Status = "completed",
                TimeAdded = timeAdded,
                AlertShown = false,
                DonatedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            };

            _context.TipsHistory.Add(tip);
            await _context.SaveChangesAsync();

            _logger.LogInformation("[Tips] Recorded tip: {Amount} {Currency} from {Donor} to {Channel}",
                amount, currency, donorName, channelName);

            // Determinar si usar sistema del Timer o alertas básicas
            var useTimerSystem = config?.AlertMode == "timer";

            if (useTimerSystem)
            {
                // Usar el sistema de alertas del Timer (con variantes, multimedia, etc.)
                var timerResult = await _timerEventService.ProcessTipEventAsync(
                    channelName,
                    donorName,
                    amount,
                    currency,
                    message);

                if (timerResult)
                {
                    _logger.LogInformation("[Tips] Processed via Timer system: {Amount} {Currency} from {Donor}",
                        amount, currency, donorName);
                }
                else
                {
                    _logger.LogWarning("[Tips] Timer system did not process tip (timer may be disabled or stopped)");
                    // Fallback: enviar alerta básica si el timer no lo procesó
                    await SendTipAlert(tip, config);
                }
            }
            else
            {
                // Usar alertas básicas independientes (Sistema Principal)
                await SendTipAlert(tip, config);

                // CABLE DE CONEXIÓN: Si la integración con Timer está activa y hay tiempo calculado, enviarlo al reloj.
                if (timeAdded > 0)
                {
                    try 
                    {
                        var channelLower = channelName.ToLower();
                        var timerState = await _context.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);
                        
                        // Solo sumar si el timer está activo (corriendo o pausado)
                        if (timerState != null && (timerState.Status == "running" || timerState.Status == "paused"))
                        {
                            timerState.CurrentTime += timeAdded;
                            timerState.TotalTime += timeAdded;
                            timerState.UpdatedAt = DateTime.UtcNow;

                            // Actualizar sesión y logs si corresponde
                            if (timerState.CurrentSessionId.HasValue)
                            {
                                var session = await _context.TimerSessions.FindAsync(timerState.CurrentSessionId.Value);
                                if (session != null) session.TotalAddedTime += timeAdded;

                                _context.TimerEventLogs.Add(new TimerEventLog
                                {
                                    ChannelName = channelLower,
                                    EventType = "tips",
                                    Username = donorName,
                                    TimeAdded = timeAdded,
                                    Details = $"Tip (Independent Alert) {amount} {currency}",
                                    TimerSessionId = timerState.CurrentSessionId,
                                    CreatedAt = DateTime.UtcNow,
                                    OccurredAt = DateTime.UtcNow
                                });
                            }

                            await _context.SaveChangesAsync();

                            // Notificar al overlay del timer que el tiempo cambió
                            await _overlayNotificationService.SendAddTimeAsync(channelLower, timeAdded);
                            _logger.LogInformation("[Tips] Time added to timer (Independent Mode): +{Seconds}s", timeAdded);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "[Tips] Error adding time to timer in Independent Mode");
                    }
                }
            }

            return tip;
        }

        private async Task SendTipAlert(TipHistory tip, TipsConfig? config)
        {
            try
            {
                // Check if we have the new tips alert config with tiers
                TipsAlertConfigDto? tipsAlertConfig = null;
                TipsBaseAlertDto? selectedAlert = null;
                TipsTierDto? matchedTier = null;

                _logger.LogInformation("[Tips] TipsAlertConfig raw: {Config}", config?.TipsAlertConfig ?? "NULL");

                if (!string.IsNullOrEmpty(config?.TipsAlertConfig))
                {
                    try
                    {
                        tipsAlertConfig = JsonSerializer.Deserialize<TipsAlertConfigDto>(config.TipsAlertConfig, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                        _logger.LogInformation("[Tips] TipsAlertConfig parsed: Enabled={Enabled}, TiersCount={TiersCount}",
                            tipsAlertConfig?.Enabled, tipsAlertConfig?.Tiers?.Count ?? 0);

                        if (tipsAlertConfig?.Enabled == true)
                        {
                            // Find matching tier for the amount
                            matchedTier = FindMatchingTier(tipsAlertConfig.Tiers, tip.Amount);

                            // Use matched tier or base alert
                            if (matchedTier != null && matchedTier.Enabled)
                            {
                                _logger.LogInformation("[Tips] Using tier '{TierName}' for amount {Amount}", matchedTier.Name, tip.Amount);
                            }

                            // Log base alert info
                            if (tipsAlertConfig.BaseAlert != null)
                            {
                                _logger.LogInformation("[Tips] BaseAlert: Enabled={Enabled}, Sound={Sound}, TTS={TtsEnabled}",
                                    tipsAlertConfig.BaseAlert.Enabled,
                                    tipsAlertConfig.BaseAlert.Sound ?? "none",
                                    tipsAlertConfig.BaseAlert.Tts?.Enabled ?? false);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "[Tips] Failed to parse TipsAlertConfig");
                    }
                }

                // Generate TTS URLs
                string? ttsTemplateUrl = null;
                int ttsTemplateVolume = 80;
                string? ttsUserMessageUrl = null;
                int ttsUserMessageVolume = 80;

                // Determine which TTS config to use
                TtsConfigDto? ttsConfig = null;

                // Priority: Matched Tier > Base Alert (new system) > BasicAlertTts (legacy)
                if (matchedTier?.Tts?.Enabled == true)
                {
                    ttsConfig = matchedTier.Tts;
                }
                else if (tipsAlertConfig?.BaseAlert?.Tts?.Enabled == true)
                {
                    ttsConfig = tipsAlertConfig.BaseAlert.Tts;
                }
                else if (!string.IsNullOrEmpty(config?.BasicAlertTts))
                {
                    try
                    {
                        ttsConfig = JsonSerializer.Deserialize<TtsConfigDto>(config.BasicAlertTts, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    }
                    catch { }
                }

                if (ttsConfig?.Enabled == true)
                {
                    // Generate TTS for template
                    if (!string.IsNullOrEmpty(ttsConfig.Template))
                    {
                        var templateText = ttsConfig.Template
                            .Replace("{donorName}", tip.DonorName)
                            .Replace("{amount}", FormatAmount(tip.Amount, tip.Currency))
                            .Replace("{message}", tip.Message ?? "");

                        ttsTemplateUrl = await _ttsService.GenerateAsync(
                            templateText,
                            ttsConfig.Voice ?? "Lupe",
                            ttsConfig.Engine ?? "standard",
                            ttsConfig.LanguageCode ?? "es-US",
                            tip.ChannelName);
                        ttsTemplateVolume = ttsConfig.TemplateVolume ?? 80;
                    }

                    // Generate TTS for user message if enabled
                    if (ttsConfig.ReadUserMessage == true && !string.IsNullOrEmpty(tip.Message))
                    {
                        var userMessage = tip.Message;
                        if (ttsConfig.MaxChars > 0 && userMessage.Length > ttsConfig.MaxChars)
                        {
                            userMessage = userMessage.Substring(0, ttsConfig.MaxChars);
                        }

                        ttsUserMessageUrl = await _ttsService.GenerateAsync(
                            userMessage,
                            ttsConfig.Voice ?? "Lupe",
                            ttsConfig.Engine ?? "standard",
                            ttsConfig.LanguageCode ?? "es-US",
                            tip.ChannelName);
                        ttsUserMessageVolume = ttsConfig.UserMessageVolume ?? 80;
                    }
                }

                // Determine sound URL and volume
                string? soundUrl = null;
                int soundVolume = 80;

                // Priority: Matched Tier > Base Alert (new system) > BasicAlertSound (legacy)
                if (matchedTier != null && !string.IsNullOrEmpty(matchedTier.Sound))
                {
                    soundUrl = matchedTier.Sound;
                    soundVolume = matchedTier.Volume ?? 80;
                }
                else if (tipsAlertConfig?.BaseAlert != null && !string.IsNullOrEmpty(tipsAlertConfig.BaseAlert.Sound))
                {
                    soundUrl = tipsAlertConfig.BaseAlert.Sound;
                    soundVolume = tipsAlertConfig.BaseAlert.Volume ?? 80;
                }
                else
                {
                    soundUrl = config?.BasicAlertSound;
                    soundVolume = config?.BasicAlertVolume ?? 80;
                }

                // Determine duration
                int duration = matchedTier?.Duration != null
                    ? matchedTier.Duration.Value * 1000
                    : (tipsAlertConfig?.BaseAlert?.Duration != null
                        ? tipsAlertConfig.BaseAlert.Duration.Value * 1000
                        : (config?.BasicAlertDuration ?? 5000));

                // Determine message
                string message = matchedTier?.Message
                    ?? tipsAlertConfig?.BaseAlert?.Message
                    ?? config?.BasicAlertMessage
                    ?? "¡{donorName} donó {amount}!";

                // Process message template
                message = message
                    .Replace("{donorName}", tip.DonorName)
                    .Replace("{amount}", FormatAmount(tip.Amount, tip.Currency))
                    .Replace("{message}", tip.Message ?? "")
                    .Replace("{time}", tip.TimeAdded > 0 ? $"+{tip.TimeAdded / 60}m {tip.TimeAdded % 60}s" : "");

                // Get media config and extract flat URL/type
                AlertMediaConfigDto? resolvedMedia = null;
                bool playVideoAudio = false;
                int videoVolume = 80;
                bool videoMuted = true;

                if (matchedTier?.Media?.Enabled == true)
                {
                    resolvedMedia = matchedTier.Media;
                    playVideoAudio = matchedTier.PlayVideoAudio ?? false;
                    videoVolume = matchedTier.VideoVolume ?? 80;
                }
                else if (tipsAlertConfig?.BaseAlert?.Media?.Enabled == true)
                {
                    resolvedMedia = tipsAlertConfig.BaseAlert.Media;
                    playVideoAudio = tipsAlertConfig.BaseAlert.PlayVideoAudio ?? false;
                    videoVolume = tipsAlertConfig.BaseAlert.VideoVolume ?? 80;
                }

                string? mediaUrl = null;
                string? mediaType = null;

                if (resolvedMedia?.Enabled == true && resolvedMedia.Mode == "advanced" && resolvedMedia.Advanced != null)
                {
                    if (!string.IsNullOrEmpty(resolvedMedia.Advanced.Video?.Url))
                    {
                        mediaUrl = resolvedMedia.Advanced.Video.Url;
                        mediaType = "video";
                        videoVolume = resolvedMedia.Advanced.Video.Volume ?? videoVolume;
                    }
                    else if (!string.IsNullOrEmpty(resolvedMedia.Advanced.Image?.Url))
                    {
                        mediaUrl = resolvedMedia.Advanced.Image.Url;
                        mediaType = "image";
                    }

                    // Backing audio
                    if (string.IsNullOrEmpty(soundUrl) && !string.IsNullOrEmpty(resolvedMedia.Advanced.Audio?.Url))
                    {
                        soundUrl = resolvedMedia.Advanced.Audio.Url;
                        soundVolume = resolvedMedia.Advanced.Audio.Volume ?? soundVolume;
                    }
                }

                // Auto-detect video type by URL extension if not set
                if (!string.IsNullOrEmpty(mediaUrl) && string.IsNullOrEmpty(mediaType))
                {
                    var ext = mediaUrl.ToLower().Split('?')[0].Split('.').LastOrDefault() ?? "";
                    mediaType = new[] { "mp4", "webm", "mov" }.Contains(ext) ? "video" : "image";
                }

                // Sync video audio flags
                if (mediaType == "video" && videoVolume > 0)
                {
                    playVideoAudio = true;
                    videoMuted = false;
                }
                else
                {
                    videoMuted = !playVideoAudio || videoVolume == 0;
                }

                // Animation: map type name to animationIn/Out
                var animationType = matchedTier?.Animation?.Type
                    ?? tipsAlertConfig?.BaseAlert?.Animation?.Type
                    ?? config?.BasicAlertAnimation
                    ?? "fade";

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

                // Overlay elements (from legacy BasicAlertOverlay)
                object? overlayElements = null;
                if (!string.IsNullOrEmpty(config?.BasicAlertOverlay))
                {
                    try
                    {
                        overlayElements = JsonSerializer.Deserialize<JsonElement>(config.BasicAlertOverlay);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "[Tips] Failed to parse overlay config");
                    }
                }

                var alertData = new
                {
                    eventType = "tip",
                    tipId = tip.Id,
                    donorName = tip.DonorName,
                    amount = tip.Amount,
                    currency = tip.Currency,
                    message = tip.Message ?? "",
                    processedMessage = message,
                    timeAdded = tip.TimeAdded,
                    formattedAmount = FormatAmount(tip.Amount, tip.Currency),
                    tierName = matchedTier?.Name,

                    // [1/4] Alert sound
                    soundUrl = soundUrl ?? "",
                    soundVolume,

                    // [2/4] Video audio
                    mediaUrl = mediaUrl ?? "",
                    mediaType = mediaType ?? "",
                    playVideoAudio,
                    videoVolume,
                    videoMuted,

                    // [3/4] TTS template
                    ttsTemplateUrl = ttsTemplateUrl ?? "",
                    ttsTemplateVolume,

                    // [4/4] TTS user message
                    ttsUserMessageUrl = ttsUserMessageUrl ?? "",
                    ttsUserMessageVolume,

                    // Display
                    duration,
                    animationIn,
                    animationOut,
                    effects = Array.Empty<string>(),
                    overlayElements
                };

                _logger.LogInformation("[Tips] Sending alert data: Sound={Sound}, Duration={Duration}, TTS={HasTTS}",
                    soundUrl ?? "none",
                    duration,
                    !string.IsNullOrEmpty(ttsTemplateUrl));

                await _overlayNotificationService.SendToChannel(tip.ChannelName, "ShowTipAlert", alertData);
                _logger.LogInformation("[Tips] Alert sent for tip from {Donor} (tier: {Tier})", tip.DonorName, matchedTier?.Name ?? "base");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Tips] Failed to send tip alert");
            }
        }

        public async Task SendAlertForTest(string channelName, string donorName, decimal amount, string currency, string? message)
        {
            var config = await GetConfigByChannel(channelName);

            // Build a fake TipHistory (not saved to DB)
            var fakeTip = new TipHistory
            {
                ChannelName = channelName,
                DonorName = donorName,
                Amount = amount,
                Currency = currency,
                Message = message,
                TimeAdded = 0,
                Id = 0
            };

            await SendTipAlert(fakeTip, config);
        }

        private TipsTierDto? FindMatchingTier(List<TipsTierDto>? tiers, decimal amount)
        {
            if (tiers == null || !tiers.Any()) return null;

            // Find matching tier based on condition
            foreach (var tier in tiers.Where(t => t.Enabled).OrderByDescending(t => t.Condition?.Min ?? 0))
            {
                var condition = tier.Condition;
                if (condition == null) continue;

                switch (condition.Type)
                {
                    case "minimum":
                        if (amount >= (condition.Min ?? 0))
                            return tier;
                        break;
                    case "exact":
                        if (amount == (condition.Exact ?? 0))
                            return tier;
                        break;
                    case "range":
                        if (amount >= (condition.Min ?? 0) && amount <= (condition.Max ?? decimal.MaxValue))
                            return tier;
                        break;
                }
            }

            return null;
        }

        // DTOs for new alert config
        private class TipsAlertConfigDto
        {
            public bool Enabled { get; set; }
            public TipsBaseAlertDto? BaseAlert { get; set; }
            public List<TipsTierDto>? Tiers { get; set; }
            public int Cooldown { get; set; }
        }

        private class TipsBaseAlertDto
        {
            public bool Enabled { get; set; }
            public string? Message { get; set; }
            public int? Duration { get; set; }
            public AlertMediaConfigDto? Media { get; set; }
            public AnimationConfigDto? Animation { get; set; }
            public string? Sound { get; set; }
            public int? Volume { get; set; }
            public TtsConfigDto? Tts { get; set; }
            public bool? PlayVideoAudio { get; set; }
            public int? VideoVolume { get; set; }
        }

        private class TipsTierDto
        {
            public string? Id { get; set; }
            public string? Name { get; set; }
            public bool Enabled { get; set; }
            public TierConditionDto? Condition { get; set; }
            public string? Message { get; set; }
            public int? Duration { get; set; }
            public AlertMediaConfigDto? Media { get; set; }
            public AnimationConfigDto? Animation { get; set; }
            public string? Sound { get; set; }
            public int? Volume { get; set; }
            public TtsConfigDto? Tts { get; set; }
            public bool? PlayVideoAudio { get; set; }
            public int? VideoVolume { get; set; }
        }

        private class TierConditionDto
        {
            public string? Type { get; set; } // "range", "minimum", "exact"
            public decimal? Min { get; set; }
            public decimal? Max { get; set; }
            public decimal? Exact { get; set; }
        }

        private class AlertMediaConfigDto
        {
            public bool Enabled { get; set; }
            public string? Mode { get; set; }
            public AdvancedMediaDto? Advanced { get; set; }
        }

        private class AdvancedMediaDto
        {
            public MediaAssetDto? Video { get; set; }
            public MediaAssetDto? Audio { get; set; }
            public MediaAssetDto? Image { get; set; }
        }

        private class MediaAssetDto
        {
            public string? Url { get; set; }
            public int? Volume { get; set; }
            public bool? Loop { get; set; }
        }

        private class AnimationConfigDto
        {
            public string? Type { get; set; }
            public string? Direction { get; set; }
            public int? Duration { get; set; }
        }

        // DTO for TTS config deserialization
        private class TtsConfigDto
        {
            public bool Enabled { get; set; }
            public string? Voice { get; set; }
            public string? Engine { get; set; }
            public string? LanguageCode { get; set; }
            public string? Template { get; set; }
            public int? TemplateVolume { get; set; }
            public bool? ReadUserMessage { get; set; }
            public int? UserMessageVolume { get; set; }
            public int MaxChars { get; set; } = 150;
        }

        private static string FormatAmount(decimal amount, string currency)
        {
            return currency.ToUpper() switch
            {
                "USD" => $"${amount:F2}",
                "EUR" => $"{amount:F2}",
                "GBP" => $"£{amount:F2}",
                "MXN" => $"${amount:F2} MXN",
                "BRL" => $"R${amount:F2}",
                "ARS" => $"${amount:F2} ARS",
                "CLP" => $"${amount:F0} CLP",
                "COP" => $"${amount:F0} COP",
                _ => $"{amount:F2} {currency}"
            };
        }

        public async Task<List<TipHistory>> GetRecentTips(string channelName, int limit = 50)
        {
            return await _context.TipsHistory
                .Where(t => t.ChannelName.ToLower() == channelName.ToLower())
                .OrderByDescending(t => t.DonatedAt)
                .Take(limit)
                .ToListAsync();
        }

        public async Task<(List<TipHistory> Tips, int TotalCount)> GetPaginatedTips(
            string channelName, int page, int pageSize, string? search = null)
        {
            var query = _context.TipsHistory
                .Where(t => t.ChannelName.ToLower() == channelName.ToLower()
                         && t.Status == "completed");

            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(t => t.DonorName.ToLower().Contains(search.ToLower()));

            var total = await query.CountAsync();

            var tips = await query
                .OrderByDescending(t => t.DonatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (tips, total);
        }

        public async Task<List<TopDonorResult>> GetTopDonors(
            string channelName, DateTime? since = null, int limit = 20)
        {
            var query = _context.TipsHistory
                .Where(t => t.ChannelName.ToLower() == channelName.ToLower()
                         && t.Status == "completed");

            if (since.HasValue)
                query = query.Where(t => t.DonatedAt >= since.Value);

            var donors = await query
                .GroupBy(t => t.DonorName.ToLower())
                .Select(g => new TopDonorResult
                {
                    DonorName    = g.OrderByDescending(t => t.DonatedAt).First().DonorName,
                    TotalAmount  = g.Sum(t => t.Amount),
                    DonationCount = g.Count(),
                    AverageAmount = g.Average(t => t.Amount),
                    LastDonation = g.Max(t => t.DonatedAt)
                })
                .OrderByDescending(x => x.TotalAmount)
                .Take(limit)
                .ToListAsync();

            return donors;
        }

        public async Task<TipStatistics> GetStatistics(string channelName, DateTime? since = null)
        {
            var query = _context.TipsHistory
                .Where(t => t.ChannelName.ToLower() == channelName.ToLower() && t.Status == "completed");

            if (since.HasValue)
            {
                query = query.Where(t => t.DonatedAt >= since.Value);
            }

            var tips = await query.ToListAsync();

            if (!tips.Any())
            {
                return new TipStatistics();
            }

            var topDonor = tips
                .GroupBy(t => t.DonorName.ToLower())
                .Select(g => new { Name = g.First().DonorName, Total = g.Sum(t => t.Amount) })
                .OrderByDescending(x => x.Total)
                .FirstOrDefault();

            return new TipStatistics
            {
                TotalAmount = tips.Sum(t => t.Amount),
                TotalCount = tips.Count,
                AverageAmount = tips.Average(t => t.Amount),
                LargestTip = tips.Max(t => t.Amount),
                TopDonor = topDonor?.Name,
                TopDonorTotal = topDonor?.Total ?? 0,
                TotalTimeAdded = tips.Sum(t => t.TimeAdded)
            };
        }

        public async Task MarkAlertShown(int tipId)
        {
            var tip = await _context.TipsHistory.FindAsync(tipId);
            if (tip != null)
            {
                tip.AlertShown = true;
                await _context.SaveChangesAsync();
            }
        }

        public async Task<TipHistory?> GetPendingAlert(string channelName)
        {
            return await _context.TipsHistory
                .Where(t => t.ChannelName.ToLower() == channelName.ToLower()
                         && !t.AlertShown
                         && t.Status == "completed")
                .OrderBy(t => t.DonatedAt)
                .FirstOrDefaultAsync();
        }
    }
}
