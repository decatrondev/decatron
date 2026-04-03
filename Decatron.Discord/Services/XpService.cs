using System.Collections.Concurrent;
using System.Text.Json;
using Decatron.Data;
using Decatron.Discord.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Discord.Services;

public class XpService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<XpService> _logger;
    private readonly XpBoostService _boostService;
    private static readonly ConcurrentDictionary<string, DateTime> _cooldowns = new();
    private static readonly ConcurrentDictionary<string, XpConfig> _configCache = new();
    private static readonly Random _random = new();

    // Live stream status cache: guildId -> (isLive, lastChecked)
    private static readonly ConcurrentDictionary<string, (bool isLive, DateTime checkedAt)> _liveStatusCache = new();
    private static readonly TimeSpan LiveCacheExpiry = TimeSpan.FromMinutes(2);

    // Difficulty presets: multiplier applied to base XP requirement per level
    private static readonly Dictionary<string, double> DifficultyPresets = new()
    {
        ["easy"] = 0.7,
        ["normal"] = 1.0,
        ["hard"] = 1.5,
        ["hardcore"] = 2.0,
    };

    // Tier multipliers for Decatron supporters
    private static readonly Dictionary<string, double> TierMultipliers = new()
    {
        ["free"] = 1.0,
        ["supporter"] = 1.25,
        ["premium"] = 1.5,
        ["fundador"] = 2.0,
    };

    public XpService(IServiceProvider serviceProvider, XpBoostService boostService, ILogger<XpService> logger)
    {
        _serviceProvider = serviceProvider;
        _boostService = boostService;
        _logger = logger;
    }

    /// <summary>
    /// Award XP for a Discord message. Returns (userXp, leveledUp, xpAwarded, newAchievements) or null if on cooldown/filtered.
    /// </summary>
    public async Task<(UserXp userXp, bool leveledUp, int xpAwarded, List<XpAchievement> newAchievements)?> AwardMessageXpAsync(
        string guildId, string userId, string username, string? avatarUrl)
    {
        try
        {
            var config = await GetOrCreateConfigAsync(guildId);
            if (!config.Enabled) return null;

            // Check cooldown
            var cooldownKey = $"{guildId}:{userId}";
            if (_cooldowns.TryGetValue(cooldownKey, out var lastXp))
            {
                if ((DateTime.UtcNow - lastXp).TotalSeconds < config.CooldownSeconds)
                    return null;
            }

            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            // Check max XP per hour
            var oneHourAgo = DateTime.UtcNow.AddHours(-1);
            var xpLastHour = await db.XpTransactions
                .Where(t => t.GuildId == guildId && t.UserId == userId && t.CreatedAt >= oneHourAgo && t.Source == "message")
                .SumAsync(t => t.XpAmount);

            if (xpLastHour >= config.MaxXpPerHour) return null;

            // Calculate XP (base * difficulty * boost * live bonus)
            var baseXp = _random.Next(config.XpMin, config.XpMax + 1);
            var boostMultiplier = _boostService.GetBoostMultiplier(guildId);
            var liveMultiplier = 1.0;
            if (config.NightModeEnabled)
            {
                var isLive = await IsStreamerLiveAsync(guildId);
                if (isLive) liveMultiplier = config.NightModeMultiplier;
            }
            var xpAmount = (int)Math.Round(baseXp * config.CustomMultiplier * boostMultiplier * liveMultiplier);

            // Cap to not exceed hourly limit
            if (xpLastHour + xpAmount > config.MaxXpPerHour)
                xpAmount = config.MaxXpPerHour - xpLastHour;
            if (xpAmount <= 0) return null;

            // Update cooldown
            _cooldowns[cooldownKey] = DateTime.UtcNow;

            // Get or create user XP record
            var userXp = await db.UserXps
                .FirstOrDefaultAsync(x => x.GuildId == guildId && x.UserId == userId);

            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            if (userXp == null)
            {
                userXp = new UserXp
                {
                    GuildId = guildId,
                    UserId = userId,
                    Username = username,
                    AvatarUrl = avatarUrl,
                    Xp = xpAmount,
                    Level = 0,
                    TotalMessages = 1,
                    LastXpAt = DateTime.UtcNow,
                    StreakDays = 1,
                    LastActiveDate = today,
                };
                db.UserXps.Add(userXp);
            }
            else
            {
                userXp.Xp += xpAmount;
                userXp.TotalMessages++;
                userXp.Username = username;
                userXp.AvatarUrl = avatarUrl;
                userXp.LastXpAt = DateTime.UtcNow;
                userXp.UpdatedAt = DateTime.UtcNow;

                // Streak logic
                if (userXp.LastActiveDate.HasValue)
                {
                    var daysDiff = today.DayNumber - userXp.LastActiveDate.Value.DayNumber;
                    if (daysDiff == 1)
                        userXp.StreakDays++;
                    else if (daysDiff > 1)
                        userXp.StreakDays = 1;
                    // daysDiff == 0 means same day, keep streak
                }
                userXp.LastActiveDate = today;
            }

            // Check level up
            var oldLevel = userXp.Level;
            var leveledUp = CheckAndApplyLevelUp(userXp, config);

            // Log transaction
            db.XpTransactions.Add(new XpTransaction
            {
                GuildId = guildId,
                UserId = userId,
                XpAmount = xpAmount,
                Source = "message",
                Description = leveledUp ? $"Message XP + Level up to {userXp.Level}" : null,
            });

            // Update global XP
            await UpdateGlobalXpAsync(db, userId, xpAmount);

            await db.SaveChangesAsync();

            // Check achievements (after save so TotalMessages is updated)
            var achievementService = _serviceProvider.GetRequiredService<AchievementService>();
            var newAchievements = await achievementService.CheckAndUnlockAsync(guildId, userId, userXp);

            // Track seasonal XP
            var seasonalService = _serviceProvider.GetRequiredService<SeasonalService>();
            await seasonalService.TrackXpAsync(guildId, userId, username, xpAmount);

            return (userXp, leveledUp, xpAmount, newAchievements);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error awarding XP to {User} in {Guild}", userId, guildId);
            return null;
        }
    }

    /// <summary>
    /// Check if user should level up and apply it. Returns true if leveled up.
    /// </summary>
    public bool CheckAndApplyLevelUp(UserXp userXp, XpConfig config)
    {
        var leveled = false;
        var difficulty = GetDifficultyMultiplier(config);

        while (true)
        {
            var required = CalculateRequiredXp(userXp.Level + 1, difficulty);
            if (userXp.Xp >= required)
            {
                userXp.Xp -= required;
                userXp.Level++;
                leveled = true;
            }
            else break;
        }

        return leveled;
    }

    /// <summary>
    /// XP needed to reach a specific level. Formula: 100 * level^2 * difficulty
    /// </summary>
    public static long CalculateRequiredXp(int level, double difficulty = 1.0)
    {
        return (long)Math.Round(100.0 * level * level * difficulty);
    }

    /// <summary>
    /// Total XP needed from level 0 to reach a target level.
    /// </summary>
    public static long CalculateTotalXpForLevel(int targetLevel, double difficulty = 1.0)
    {
        long total = 0;
        for (int i = 1; i <= targetLevel; i++)
            total += CalculateRequiredXp(i, difficulty);
        return total;
    }

    public async Task<UserXp?> GetUserXpAsync(string guildId, string userId)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
        return await db.UserXps.FirstOrDefaultAsync(x => x.GuildId == guildId && x.UserId == userId);
    }

    public async Task<List<UserXp>> GetLeaderboardAsync(string guildId, int page = 1, int pageSize = 10)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
        return await db.UserXps
            .Where(x => x.GuildId == guildId)
            .OrderByDescending(x => x.Level)
            .ThenByDescending(x => x.Xp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    public async Task<int> GetUserRankAsync(string guildId, string userId)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
        var user = await db.UserXps.FirstOrDefaultAsync(x => x.GuildId == guildId && x.UserId == userId);
        if (user == null) return 0;

        return await db.UserXps
            .CountAsync(x => x.GuildId == guildId &&
                (x.Level > user.Level || (x.Level == user.Level && x.Xp > user.Xp))) + 1;
    }

    public async Task<int> GetTotalUsersAsync(string guildId)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
        return await db.UserXps.CountAsync(x => x.GuildId == guildId);
    }

    public async Task<List<UserXpGlobal>> GetGlobalLeaderboardAsync(int page = 1, int pageSize = 10)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
        return await db.UserXpGlobals
            .OrderByDescending(x => x.Level)
            .ThenByDescending(x => x.Xp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    public async Task<XpConfig> GetOrCreateConfigAsync(string guildId)
    {
        // Check cache first
        if (_configCache.TryGetValue(guildId, out var cached))
            return cached;

        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

        var config = await db.XpConfigs.FirstOrDefaultAsync(c => c.GuildId == guildId);
        if (config == null)
        {
            config = new XpConfig { GuildId = guildId };
            db.XpConfigs.Add(config);
            await db.SaveChangesAsync();
        }

        _configCache[guildId] = config;
        return config;
    }

    public void InvalidateConfigCache(string guildId)
    {
        _configCache.TryRemove(guildId, out _);
    }

    public bool IsChannelExcluded(XpConfig config, string channelId)
    {
        try
        {
            var excluded = JsonSerializer.Deserialize<List<string>>(config.ExcludedChannels);
            return excluded?.Contains(channelId) == true;
        }
        catch { return false; }
    }

    // ============================================
    // ADMIN XP OPERATIONS
    // ============================================

    public async Task<(UserXp userXp, List<XpAchievement> newAchievements)> GiveXpAsync(string guildId, string userId, string username, int amount)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

        var userXp = await db.UserXps.FirstOrDefaultAsync(x => x.GuildId == guildId && x.UserId == userId);
        if (userXp == null)
        {
            userXp = new UserXp { GuildId = guildId, UserId = userId, Username = username, Xp = amount };
            db.UserXps.Add(userXp);
        }
        else
        {
            userXp.Xp += amount;
            userXp.UpdatedAt = DateTime.UtcNow;
        }

        var config = await GetOrCreateConfigAsync(guildId);
        CheckAndApplyLevelUp(userXp, config);

        db.XpTransactions.Add(new XpTransaction
        {
            GuildId = guildId, UserId = userId, XpAmount = amount,
            Source = "admin", Description = $"Admin give +{amount}"
        });

        await UpdateGlobalXpAsync(db, userId, amount);
        await db.SaveChangesAsync();

        var achievementService = _serviceProvider.GetRequiredService<AchievementService>();
        var newAchievements = await achievementService.CheckAndUnlockAsync(guildId, userId, userXp);

        return (userXp, newAchievements);
    }

    public async Task<UserXp?> RemoveXpAsync(string guildId, string userId, int amount)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

        var userXp = await db.UserXps.FirstOrDefaultAsync(x => x.GuildId == guildId && x.UserId == userId);
        if (userXp == null) return null;

        userXp.Xp = Math.Max(0, userXp.Xp - amount);
        userXp.UpdatedAt = DateTime.UtcNow;

        // Recalculate level from total XP
        RecalculateLevel(userXp);

        db.XpTransactions.Add(new XpTransaction
        {
            GuildId = guildId, UserId = userId, XpAmount = -amount,
            Source = "admin", Description = $"Admin remove -{amount}"
        });

        await db.SaveChangesAsync();
        return userXp;
    }

    public async Task<bool> ResetXpAsync(string guildId, string userId)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

        var userXp = await db.UserXps.FirstOrDefaultAsync(x => x.GuildId == guildId && x.UserId == userId);
        if (userXp == null) return false;

        var oldLevel = userXp.Level;
        userXp.Xp = 0;
        userXp.Level = 0;
        userXp.TotalMessages = 0;
        userXp.VoiceMinutes = 0;
        userXp.StreakDays = 0;
        userXp.UpdatedAt = DateTime.UtcNow;

        db.XpTransactions.Add(new XpTransaction
        {
            GuildId = guildId, UserId = userId, XpAmount = 0,
            Source = "admin", Description = $"Admin reset (was level {oldLevel})"
        });

        await db.SaveChangesAsync();
        return true;
    }

    public async Task<(UserXp userXp, List<XpAchievement> newAchievements)> SetXpAsync(string guildId, string userId, string username, long amount)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

        var userXp = await db.UserXps.FirstOrDefaultAsync(x => x.GuildId == guildId && x.UserId == userId);
        if (userXp == null)
        {
            userXp = new UserXp { GuildId = guildId, UserId = userId, Username = username };
            db.UserXps.Add(userXp);
        }

        userXp.Xp = amount;
        userXp.UpdatedAt = DateTime.UtcNow;

        // Recalculate level
        RecalculateLevel(userXp);

        var config = await GetOrCreateConfigAsync(guildId);
        CheckAndApplyLevelUp(userXp, config);

        db.XpTransactions.Add(new XpTransaction
        {
            GuildId = guildId, UserId = userId, XpAmount = (int)amount,
            Source = "admin", Description = $"Admin set to {amount} XP (Level {userXp.Level})"
        });

        await db.SaveChangesAsync();

        var achievementService = _serviceProvider.GetRequiredService<AchievementService>();
        var newAchievements = await achievementService.CheckAndUnlockAsync(guildId, userId, userXp);

        return (userXp, newAchievements);
    }

    private void RecalculateLevel(UserXp userXp)
    {
        // Reset level and recalculate from XP
        var totalXp = userXp.Xp;
        userXp.Level = 0;
        while (true)
        {
            var required = CalculateRequiredXp(userXp.Level + 1);
            if (totalXp >= required)
            {
                totalXp -= required;
                userXp.Level++;
            }
            else
            {
                userXp.Xp = totalXp;
                break;
            }
        }
    }

    /// <summary>
    /// Checks if the streamer linked to this guild is currently live on Twitch.
    /// Uses a 2-minute cache to avoid spamming the Twitch API.
    /// </summary>
    public async Task<bool> IsStreamerLiveAsync(string guildId)
    {
        // Check cache first
        if (_liveStatusCache.TryGetValue(guildId, out var cached) && DateTime.UtcNow - cached.checkedAt < LiveCacheExpiry)
            return cached.isLive;

        try
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            // Find the Twitch channel linked to this guild
            var guildConfig = await db.DiscordGuildConfigs
                .Where(g => g.GuildId == guildId && g.IsActive)
                .FirstOrDefaultAsync();

            if (guildConfig == null || string.IsNullOrEmpty(guildConfig.TwitchUserId))
            {
                _liveStatusCache[guildId] = (false, DateTime.UtcNow);
                return false;
            }

            // Check if there's an active alert message (means stream is live)
            var isLive = await db.DiscordAlertMessages
                .AnyAsync(m => m.GuildId == guildId && m.IsActive);

            // If no alert messages, try checking via active stream data
            if (!isLive)
            {
                // Fallback: check the Twitch API via TwitchApiService
                try
                {
                    var twitchApi = scope.ServiceProvider.GetRequiredService<Decatron.Services.TwitchApiService>();
                    var stream = await twitchApi.GetStreamAsync(guildConfig.TwitchUserId);
                    isLive = stream != null;
                }
                catch { }
            }

            _liveStatusCache[guildId] = (isLive, DateTime.UtcNow);
            return isLive;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error checking live status for guild {Guild}", guildId);
            _liveStatusCache[guildId] = (false, DateTime.UtcNow);
            return false;
        }
    }

    private double GetDifficultyMultiplier(XpConfig config)
    {
        if (config.DifficultyPreset == "custom")
            return config.CustomMultiplier;
        return DifficultyPresets.GetValueOrDefault(config.DifficultyPreset, 1.0);
    }

    private async Task UpdateGlobalXpAsync(DecatronDbContext db, string userId, int xpAmount)
    {
        var global = await db.UserXpGlobals.FirstOrDefaultAsync(g => g.UserId == userId);
        if (global == null)
        {
            global = new UserXpGlobal
            {
                UserId = userId,
                Xp = xpAmount,
                TotalServersActive = 1,
            };
            db.UserXpGlobals.Add(global);
        }
        else
        {
            global.Xp += xpAmount;
            global.UpdatedAt = DateTime.UtcNow;
        }

        // Check global level up (harder curve: 150 * level^2.2)
        while (true)
        {
            var required = (long)Math.Round(150.0 * Math.Pow(global.Level + 1, 2.2));
            if (global.Xp >= required)
            {
                global.Xp -= required;
                global.Level++;
            }
            else break;
        }
    }
}
