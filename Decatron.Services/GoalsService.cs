using Decatron.Core.Models;
using Decatron.Core.Interfaces;
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
    public class GoalsService
    {
        private readonly DecatronDbContext _context;
        private readonly ILogger<GoalsService> _logger;
        private readonly OverlayNotificationService _overlayNotificationService;

        private static readonly JsonSerializerOptions JsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        };

        public GoalsService(
            DecatronDbContext context,
            ILogger<GoalsService> logger,
            OverlayNotificationService overlayNotificationService)
        {
            _context = context;
            _logger = logger;
            _overlayNotificationService = overlayNotificationService;
        }

        // ========================================================================
        // CONFIG METHODS
        // ========================================================================

        public async Task<GoalsConfig?> GetConfig(long userId)
        {
            return await _context.GoalsConfigs
                .FirstOrDefaultAsync(c => c.UserId == userId);
        }

        public async Task<GoalsConfig?> GetConfigByChannel(string channelName)
        {
            return await _context.GoalsConfigs
                .FirstOrDefaultAsync(c => c.ChannelName.ToLower() == channelName.ToLower());
        }

        public async Task<GoalsConfig> SaveConfig(long userId, string channelName, object configData)
        {
            var existing = await GetConfig(userId);

            // Extract individual fields from configData
            var json = JsonSerializer.Serialize(configData, JsonOptions);
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (existing != null)
            {
                // Update existing
                existing.ChannelName = channelName;
                existing.CanvasWidth = GetIntProperty(root, "canvasWidth", 1000);
                existing.CanvasHeight = GetIntProperty(root, "canvasHeight", 300);
                existing.Goals = GetJsonProperty(root, "goals", "[]");
                existing.ActiveGoalIds = GetJsonProperty(root, "activeGoalIds", "[]");
                existing.GoalPositions = GetJsonProperty(root, "goalPositions", "{}");
                existing.DefaultSources = GetJsonProperty(root, "defaultSources", "{}");
                existing.DesignConfig = GetJsonProperty(root, "design", "{}");
                existing.NotificationsConfig = GetJsonProperty(root, "notifications", "{}");
                existing.TimerIntegrationConfig = GetJsonProperty(root, "timerIntegration", "{}");
                existing.CommandsConfig = GetJsonProperty(root, "commands", "{}");
                existing.HistoryEnabled = GetBoolProperty(root, "historyEnabled", true);
                existing.HistoryRetentionDays = GetIntProperty(root, "historyRetentionDays", 30);
                existing.ResetOnStreamEnd = GetBoolProperty(root, "resetOnStreamEnd", true);
                existing.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                // Notify overlay of config change
                await NotifyConfigChanged(channelName);

                return existing;
            }
            else
            {
                // Create new
                var config = new GoalsConfig
                {
                    UserId = userId,
                    ChannelName = channelName,
                    CanvasWidth = GetIntProperty(root, "canvasWidth", 1000),
                    CanvasHeight = GetIntProperty(root, "canvasHeight", 300),
                    Goals = GetJsonProperty(root, "goals", "[]"),
                    ActiveGoalIds = GetJsonProperty(root, "activeGoalIds", "[]"),
                    GoalPositions = GetJsonProperty(root, "goalPositions", "{}"),
                    DefaultSources = GetJsonProperty(root, "defaultSources", "{}"),
                    DesignConfig = GetJsonProperty(root, "design", "{}"),
                    NotificationsConfig = GetJsonProperty(root, "notifications", "{}"),
                    TimerIntegrationConfig = GetJsonProperty(root, "timerIntegration", "{}"),
                    CommandsConfig = GetJsonProperty(root, "commands", "{}"),
                    HistoryEnabled = GetBoolProperty(root, "historyEnabled", true),
                    HistoryRetentionDays = GetIntProperty(root, "historyRetentionDays", 30),
                    ResetOnStreamEnd = GetBoolProperty(root, "resetOnStreamEnd", true),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.GoalsConfigs.Add(config);
                await _context.SaveChangesAsync();

                // Notify overlay of config change
                await NotifyConfigChanged(channelName);

                return config;
            }
        }

        // ========================================================================
        // OVERLAY DATA
        // ========================================================================

        public async Task<object?> GetOverlayData(string channelName)
        {
            var config = await GetConfigByChannel(channelName);
            if (config == null) return null;

            return new
            {
                goals = JsonSerializer.Deserialize<JsonElement>(config.Goals),
                activeGoalIds = JsonSerializer.Deserialize<JsonElement>(config.ActiveGoalIds),
                design = JsonSerializer.Deserialize<JsonElement>(config.DesignConfig),
                canvasWidth = config.CanvasWidth,
                canvasHeight = config.CanvasHeight,
                goalPositions = JsonSerializer.Deserialize<JsonElement>(config.GoalPositions)
            };
        }

        // ========================================================================
        // PROGRESS MANAGEMENT
        // ========================================================================

        public async Task<bool> UpdateProgress(long userId, string goalId, int amount, string source, string? triggeredBy = null)
        {
            var config = await GetConfig(userId);
            if (config == null) return false;

            // Parse goals array
            var goals = JsonSerializer.Deserialize<List<JsonElement>>(config.Goals);
            if (goals == null) return false;

            // Find goal index
            var goalIndex = -1;
            JsonElement? targetGoal = null;
            for (int i = 0; i < goals.Count; i++)
            {
                if (goals[i].TryGetProperty("id", out var idProp) && idProp.GetString() == goalId)
                {
                    goalIndex = i;
                    targetGoal = goals[i];
                    break;
                }
            }

            if (goalIndex == -1 || !targetGoal.HasValue) return false;

            var goal = targetGoal.Value;
            var currentValue = goal.GetProperty("currentValue").GetInt32();
            var targetValue = goal.GetProperty("targetValue").GetInt32();
            var goalName = goal.GetProperty("name").GetString() ?? "Unknown";
            var newValue = Math.Min(currentValue + amount, targetValue);

            // Update goal in array using raw JSON manipulation
            var goalsJson = JsonSerializer.Deserialize<List<Dictionary<string, object>>>(config.Goals);
            if (goalsJson != null && goalIndex < goalsJson.Count)
            {
                goalsJson[goalIndex]["currentValue"] = newValue;

                // Check if completed
                if (newValue >= targetValue && currentValue < targetValue)
                {
                    goalsJson[goalIndex]["status"] = "completed";
                    goalsJson[goalIndex]["completedAt"] = DateTime.UtcNow.ToString("o");
                }

                config.Goals = JsonSerializer.Serialize(goalsJson, JsonOptions);
                config.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                // Log progress
                await LogProgress(config.Id, goalId, goalName, "progress", currentValue, newValue, source, triggeredBy);

                // Check milestones
                await CheckMilestones(config, goalId, currentValue, newValue);

                // Notify overlay
                await NotifyProgressUpdate(config.ChannelName, goalId, currentValue, newValue, source, newValue >= targetValue);

                return true;
            }

            return false;
        }

        public async Task<bool> SetProgress(long userId, string goalId, int newValue, string? triggeredBy = null)
        {
            var config = await GetConfig(userId);
            if (config == null) return false;

            var goalsJson = JsonSerializer.Deserialize<List<Dictionary<string, object>>>(config.Goals);
            if (goalsJson == null) return false;

            var goalIndex = -1;
            int currentValue = 0;
            int targetValue = 0;
            string goalName = "Unknown";

            for (int i = 0; i < goalsJson.Count; i++)
            {
                if (goalsJson[i].TryGetValue("id", out var id) && id?.ToString() == goalId)
                {
                    goalIndex = i;
                    if (goalsJson[i].TryGetValue("currentValue", out var cv))
                        currentValue = Convert.ToInt32(cv);
                    if (goalsJson[i].TryGetValue("targetValue", out var tv))
                        targetValue = Convert.ToInt32(tv);
                    if (goalsJson[i].TryGetValue("name", out var n))
                        goalName = n?.ToString() ?? "Unknown";
                    break;
                }
            }

            if (goalIndex == -1) return false;

            newValue = Math.Max(0, Math.Min(newValue, targetValue));
            goalsJson[goalIndex]["currentValue"] = newValue;

            if (newValue >= targetValue && currentValue < targetValue)
            {
                goalsJson[goalIndex]["status"] = "completed";
                goalsJson[goalIndex]["completedAt"] = DateTime.UtcNow.ToString("o");
            }

            config.Goals = JsonSerializer.Serialize(goalsJson, JsonOptions);
            config.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            await LogProgress(config.Id, goalId, goalName, "progress", currentValue, newValue, "manual", triggeredBy);
            await NotifyProgressUpdate(config.ChannelName, goalId, currentValue, newValue, "manual", newValue >= targetValue);

            return true;
        }

        public async Task<bool> ResetGoal(long userId, string goalId, string? triggeredBy = null)
        {
            var config = await GetConfig(userId);
            if (config == null) return false;

            var goalsJson = JsonSerializer.Deserialize<List<Dictionary<string, object>>>(config.Goals);
            if (goalsJson == null) return false;

            var goalIndex = -1;
            int currentValue = 0;
            string goalName = "Unknown";

            for (int i = 0; i < goalsJson.Count; i++)
            {
                if (goalsJson[i].TryGetValue("id", out var id) && id?.ToString() == goalId)
                {
                    goalIndex = i;
                    if (goalsJson[i].TryGetValue("currentValue", out var cv))
                        currentValue = Convert.ToInt32(cv);
                    if (goalsJson[i].TryGetValue("name", out var n))
                        goalName = n?.ToString() ?? "Unknown";
                    break;
                }
            }

            if (goalIndex == -1) return false;

            goalsJson[goalIndex]["currentValue"] = 0;
            goalsJson[goalIndex]["status"] = "active";
            goalsJson[goalIndex]["completedAt"] = null;

            // Reset milestones
            if (goalsJson[goalIndex].TryGetValue("milestones", out var milestones) && milestones != null)
            {
                var milestonesList = JsonSerializer.Deserialize<List<Dictionary<string, object>>>(JsonSerializer.Serialize(milestones));
                if (milestonesList != null)
                {
                    foreach (var m in milestonesList)
                    {
                        m["completed"] = false;
                        m["completedAt"] = null;
                    }
                    goalsJson[goalIndex]["milestones"] = milestonesList;
                }
            }

            config.Goals = JsonSerializer.Serialize(goalsJson, JsonOptions);
            config.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            await LogProgress(config.Id, goalId, goalName, "reset", currentValue, 0, null, triggeredBy);
            await NotifyConfigChanged(config.ChannelName);

            return true;
        }

        // ========================================================================
        // MILESTONE CHECKING
        // ========================================================================

        private async Task CheckMilestones(GoalsConfig config, string goalId, int previousValue, int newValue)
        {
            var goalsJson = JsonSerializer.Deserialize<List<Dictionary<string, object>>>(config.Goals);
            if (goalsJson == null) return;

            var goalIndex = -1;
            for (int i = 0; i < goalsJson.Count; i++)
            {
                if (goalsJson[i].TryGetValue("id", out var id) && id?.ToString() == goalId)
                {
                    goalIndex = i;
                    break;
                }
            }

            if (goalIndex == -1) return;

            var goal = goalsJson[goalIndex];
            if (!goal.TryGetValue("milestones", out var milestonesObj) || milestonesObj == null) return;
            if (!goal.TryGetValue("targetValue", out var targetValueObj)) return;

            var targetValue = Convert.ToInt32(targetValueObj);
            var milestones = JsonSerializer.Deserialize<List<Dictionary<string, object>>>(JsonSerializer.Serialize(milestonesObj));
            if (milestones == null) return;

            var goalName = goal.TryGetValue("name", out var n) ? n?.ToString() ?? "Unknown" : "Unknown";
            var updated = false;

            foreach (var milestone in milestones)
            {
                if (milestone.TryGetValue("completed", out var completed) && Convert.ToBoolean(completed)) continue;

                var targetMilestone = 0;
                if (milestone.TryGetValue("targetValue", out var tv))
                    targetMilestone = Convert.ToInt32(tv);

                var isPercentage = false;
                if (milestone.TryGetValue("isPercentage", out var ip))
                    isPercentage = Convert.ToBoolean(ip);

                var milestoneValue = isPercentage ? (int)(targetValue * (targetMilestone / 100.0)) : targetMilestone;

                if (previousValue < milestoneValue && newValue >= milestoneValue)
                {
                    milestone["completed"] = true;
                    milestone["completedAt"] = DateTime.UtcNow.ToString("o");
                    updated = true;

                    var milestoneName = milestone.TryGetValue("name", out var mn) ? mn?.ToString() ?? "Milestone" : "Milestone";
                    var milestoneId = milestone.TryGetValue("id", out var mid) ? mid?.ToString() ?? "" : "";

                    // Log milestone
                    await LogProgress(config.Id, goalId, goalName, "milestone", previousValue, newValue, null, null, milestoneId, milestoneName);

                    // Notify overlay
                    await NotifyMilestone(config.ChannelName, goalId, milestoneName);

                    _logger.LogInformation($"[GOALS] Milestone reached: {milestoneName} for goal {goalName}");
                }
            }

            if (updated)
            {
                goalsJson[goalIndex]["milestones"] = milestones;
                config.Goals = JsonSerializer.Serialize(goalsJson, JsonOptions);
                await _context.SaveChangesAsync();
            }
        }

        // ========================================================================
        // HISTORY
        // ========================================================================

        public async Task<List<GoalsProgressLog>> GetHistory(long userId, int limit = 50)
        {
            var config = await GetConfig(userId);
            if (config == null) return new List<GoalsProgressLog>();

            return await _context.GoalsProgressLogs
                .Where(l => l.ConfigId == config.Id)
                .OrderByDescending(l => l.Timestamp)
                .Take(limit)
                .ToListAsync();
        }

        private async Task LogProgress(int configId, string goalId, string goalName, string action,
            int? previousValue, int? newValue, string? source, string? triggeredBy,
            string? milestoneId = null, string? milestoneName = null)
        {
            var log = new GoalsProgressLog
            {
                ConfigId = configId,
                GoalId = goalId,
                GoalName = goalName,
                Action = action,
                PreviousValue = previousValue,
                NewValue = newValue,
                MilestoneId = milestoneId,
                MilestoneName = milestoneName,
                Source = source,
                TriggeredBy = triggeredBy,
                Timestamp = DateTime.UtcNow
            };

            _context.GoalsProgressLogs.Add(log);
            await _context.SaveChangesAsync();
        }

        // ========================================================================
        // NOTIFICATIONS
        // ========================================================================

        private async Task NotifyConfigChanged(string channelName)
        {
            try
            {
                await _overlayNotificationService.SendToChannel(channelName, "GoalsConfigChanged", new { });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to notify overlay of config change");
            }
        }

        private async Task NotifyProgressUpdate(string channelName, string goalId, int previousValue, int newValue, string source, bool isCompleted)
        {
            try
            {
                await _overlayNotificationService.SendToChannel(channelName, "GoalProgress", new
                {
                    goalId,
                    previousValue,
                    newValue,
                    source,
                    isCompleted
                });

                if (isCompleted)
                {
                    await _overlayNotificationService.SendToChannel(channelName, "GoalCompleted", goalId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to notify overlay of progress update");
            }
        }

        private async Task NotifyMilestone(string channelName, string goalId, string milestoneName)
        {
            try
            {
                await _overlayNotificationService.SendToChannel(channelName, "GoalMilestone", new
                {
                    goalId,
                    milestoneName
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to notify overlay of milestone");
            }
        }

        // ========================================================================
        // HELPERS
        // ========================================================================

        private static string GetJsonProperty(JsonElement root, string propertyName, string defaultValue)
        {
            if (root.TryGetProperty(propertyName, out var prop))
            {
                return prop.GetRawText();
            }
            return defaultValue;
        }

        private static int GetIntProperty(JsonElement root, string propertyName, int defaultValue)
        {
            if (root.TryGetProperty(propertyName, out var prop) && prop.ValueKind == JsonValueKind.Number)
            {
                return prop.GetInt32();
            }
            return defaultValue;
        }

        private static bool GetBoolProperty(JsonElement root, string propertyName, bool defaultValue)
        {
            if (root.TryGetProperty(propertyName, out var prop))
            {
                if (prop.ValueKind == JsonValueKind.True) return true;
                if (prop.ValueKind == JsonValueKind.False) return false;
            }
            return defaultValue;
        }
    }
}
