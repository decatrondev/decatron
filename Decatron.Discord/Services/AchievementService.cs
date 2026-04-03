using System.Collections.Concurrent;
using Decatron.Data;
using Decatron.Discord.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Discord.Services;

public class AchievementService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<AchievementService> _logger;
    private static readonly ConcurrentDictionary<string, List<XpAchievement>> _cache = new();

    private static readonly (string key, string name, string desc, string icon, string condType, int condValue)[] SystemAchievements = new[]
    {
        ("first_message", "First Message",  "Envia tu primer mensaje",             "💬", "messages", 1),
        ("chatterbox",    "Chatterbox",     "Envia 1,000 mensajes",                "🗣️", "messages", 1000),
        ("marathon",      "Marathon",       "Envia 10,000 mensajes",               "🏃", "messages", 10000),
        ("level_10",      "Rising Star",    "Alcanza nivel 10",                    "⭐", "level",    10),
        ("level_25",      "Dedicated",      "Alcanza nivel 25",                    "💎", "level",    25),
        ("level_50",      "Legend",         "Alcanza nivel 50",                    "🔥", "level",    50),
        ("streak_7",      "Week Warrior",   "7 dias consecutivos activo",          "📅", "streak",   7),
        ("streak_30",     "Streak Master",  "30 dias consecutivos activo",         "🔥", "streak",   30),
        ("linked",        "Connected",      "Vincula tu cuenta Twitch y Discord",  "🔗", "custom",   0),
        ("og",            "OG Member",      "1 año en el servidor",                "👑", "custom",   0),
    };

    public AchievementService(IServiceProvider serviceProvider, ILogger<AchievementService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    /// <summary>
    /// Creates the 10 default system achievements for a guild if they don't exist.
    /// </summary>
    public async Task<List<XpAchievement>> InitializeDefaultsAsync(string guildId)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

        var existing = await db.XpAchievements.Where(a => a.GuildId == guildId).ToListAsync();
        if (existing.Count > 0) return existing;

        var achievements = new List<XpAchievement>();
        foreach (var (key, name, desc, icon, condType, condValue) in SystemAchievements)
        {
            var a = new XpAchievement
            {
                GuildId = guildId,
                AchievementKey = key,
                Name = name,
                Description = desc,
                Icon = icon,
                ConditionType = condType,
                ConditionValue = condValue,
                IsSystem = true,
                Enabled = condType != "custom", // custom ones disabled by default
            };
            achievements.Add(a);
            db.XpAchievements.Add(a);
        }

        await db.SaveChangesAsync();
        _cache[guildId] = achievements;
        _logger.LogInformation("[ACHIEVEMENTS] Created {Count} default achievements for guild {Guild}", achievements.Count, guildId);
        return achievements;
    }

    /// <summary>
    /// Check all achievements and unlock any that are newly met.
    /// Returns list of newly unlocked achievements.
    /// </summary>
    public async Task<List<XpAchievement>> CheckAndUnlockAsync(string guildId, string userId, UserXp userXp)
    {
        var newlyUnlocked = new List<XpAchievement>();

        try
        {
            var achievements = await GetAchievementsForGuildAsync(guildId);
            if (achievements.Count == 0) return newlyUnlocked;

            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            // Get already unlocked achievement IDs
            var unlockedIds = await db.UserAchievements
                .Where(ua => ua.GuildId == guildId && ua.UserId == userId)
                .Select(ua => ua.AchievementId)
                .ToHashSetAsync();

            foreach (var achievement in achievements.Where(a => a.Enabled && !unlockedIds.Contains(a.Id)))
            {
                var met = achievement.ConditionType switch
                {
                    "messages" => userXp.TotalMessages >= achievement.ConditionValue,
                    "level" => userXp.Level >= achievement.ConditionValue,
                    "streak" => userXp.StreakDays >= achievement.ConditionValue,
                    _ => false, // "custom" and "voice" not auto-checked
                };

                if (met)
                {
                    db.UserAchievements.Add(new UserAchievement
                    {
                        GuildId = guildId,
                        UserId = userId,
                        AchievementId = achievement.Id,
                    });
                    newlyUnlocked.Add(achievement);
                }
            }

            if (newlyUnlocked.Count > 0)
                await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking achievements for {User} in {Guild}", userId, guildId);
        }

        return newlyUnlocked;
    }

    /// <summary>
    /// Get all achievements for a guild (with cache). Initializes defaults if empty.
    /// </summary>
    public async Task<List<XpAchievement>> GetAchievementsForGuildAsync(string guildId)
    {
        if (_cache.TryGetValue(guildId, out var cached))
            return cached;

        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

        var achievements = await db.XpAchievements
            .Where(a => a.GuildId == guildId)
            .OrderBy(a => a.ConditionType)
            .ThenBy(a => a.ConditionValue)
            .ToListAsync();

        if (achievements.Count == 0)
            achievements = await InitializeDefaultsAsync(guildId);

        _cache[guildId] = achievements;
        return achievements;
    }

    /// <summary>
    /// Get user achievements with unlock status.
    /// </summary>
    public async Task<List<(XpAchievement achievement, bool unlocked, DateTime? unlockedAt)>> GetUserAchievementsAsync(string guildId, string userId)
    {
        var achievements = await GetAchievementsForGuildAsync(guildId);

        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

        var unlocked = await db.UserAchievements
            .Where(ua => ua.GuildId == guildId && ua.UserId == userId)
            .ToDictionaryAsync(ua => ua.AchievementId, ua => ua.UnlockedAt);

        return achievements
            .Where(a => a.Enabled)
            .Select(a => (a, unlocked.ContainsKey(a.Id), unlocked.ContainsKey(a.Id) ? (DateTime?)unlocked[a.Id] : null))
            .ToList();
    }

    public void InvalidateCache(string guildId)
    {
        _cache.TryRemove(guildId, out _);
    }
}
