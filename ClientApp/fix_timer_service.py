
import os

file_path = "../Decatron.Services/TimerEventService.cs"

new_method_body = """        public async Task<bool> ProcessCheerEventAsync(string channelName, string userName, int bitsAmount, bool isTest = false)
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

                // Pre-cargar alertas
                var alertsConfig = ParseAlertsConfig(config.AlertsConfig);
                var alertEventConfig = alertsConfig?.events?.bits;

                int secondsToAdd = 0;
                int perBits = 100;
                int timePerBits = 0;

                // Lógica de Tiers
                if (eventsConfig.bits.tiers != null && eventsConfig.bits.tiers.Count > 0)
                {
                    var sortedTiers = new System.Collections.Generic.List<BitTier>(eventsConfig.bits.tiers);
                    sortedTiers.Sort((a, b) => b.minAmount.CompareTo(a.minAmount)); // Orden descendente
                    
                    foreach (var tier in sortedTiers)
                    {
                        bool matches = tier.exactAmount ? (bitsAmount == tier.minAmount) : (bitsAmount >= tier.minAmount);
                        if (matches)
                        {
                            secondsToAdd = tier.timeAdded;
                            _logger.LogInformation($"[TIMER DEBUG] Match Tier: {bitsAmount} >= {tier.minAmount} -> +{secondsToAdd}s");
                            break; 
                        }
                    }
                }
                
                // Fallback Legacy
                if (secondsToAdd == 0)
                {
                    perBits = eventsConfig.bits.perBits > 0 ? eventsConfig.bits.perBits : 100;
                    timePerBits = eventsConfig.bits.time;
                    var multiplier = (double)bitsAmount / perBits;
                    secondsToAdd = (int)(multiplier * timePerBits);
                }

                if (secondsToAdd <= 0) return false;

                // Happy Hour
                var happyHourMultiplier = await GetActiveHappyHourMultiplierAsync(channelLower);
                if (happyHourMultiplier > 1.0)
                {
                    secondsToAdd = (int)(secondsToAdd * happyHourMultiplier);
                }

                var timerState = await _dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);
                if (timerState == null || timerState.Status == "stopped") return false;

                if (isTest) {
                    await _overlayNotificationService.SendTimerEventAlertAsync(
                        channelLower,
                        new {
                            eventType = "bits",
                            userName = userName,
                            amount = bitsAmount,
                            secondsAdded = secondsToAdd,
                            message = $"+{FormatTime(secondsToAdd)} por {bitsAmount} bits de {userName}! 💎 (TEST)",
                            advancedMediaEnabled = alertEventConfig?.advancedMediaEnabled,
                            advancedMedia = alertEventConfig?.advancedMedia
                        });
                    return true;
                }

                var result = await AddTimeToTimerAsync(
                    timerState,
                    secondsToAdd,
                    "bits",
                    userName,
                    new { bits = bitsAmount, timePerBits = timePerBits } 
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
                        advancedMedia = alertEventConfig?.advancedMedia
                    });

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[TIMER EVENT] Error procesando Cheer");
                return false;
            }
        }"""

with open(file_path, "r") as f:
    content = f.read()

start_marker = "public async Task<bool> ProcessCheerEventAsync(string channelName, string userName, int bitsAmount, bool isTest = false)"
start_idx = content.find(start_marker)

if start_idx != -1:
    open_braces = 0
    end_idx = -1
    found_start_brace = False
    
    for i in range(start_idx, len(content)):
        if content[i] == '{':
            open_braces += 1
            found_start_brace = True
        elif content[i] == '}':
            open_braces -= 1
            if found_start_brace and open_braces == 0:
                end_idx = i + 1
                break
    
    if end_idx != -1:
        new_content = content[:start_idx] + new_method_body + content[end_idx:]
        with open(file_path, "w") as f:
            f.write(new_content)
        print("Success")
    else:
        print("Error: Could not find end of method block")
else:
    print("Error: Method not found")
