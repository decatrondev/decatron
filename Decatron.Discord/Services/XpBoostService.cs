using System.Collections.Concurrent;
using Decatron.Data;
using Decatron.Discord.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Discord.Services;

public class XpBoostService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<XpBoostService> _logger;
    private static readonly ConcurrentDictionary<string, (double multiplier, DateTime expiresAt)> _cache = new();

    public XpBoostService(IServiceProvider serviceProvider, ILogger<XpBoostService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task<XpBoost> CreateBoostAsync(string guildId, double multiplier, double durationHours, string userId, string username)
    {
        // Deactivate any existing active boosts for this guild
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

        var existing = await db.XpBoosts
            .Where(b => b.GuildId == guildId && b.IsActive && b.ExpiresAt > DateTime.UtcNow)
            .ToListAsync();

        foreach (var old in existing)
            old.IsActive = false;

        var boost = new XpBoost
        {
            GuildId = guildId,
            Multiplier = multiplier,
            ActivatedByUserId = userId,
            ActivatedByUsername = username,
            StartsAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(durationHours),
            IsActive = true,
        };

        db.XpBoosts.Add(boost);
        await db.SaveChangesAsync();

        // Update cache
        _cache[guildId] = (multiplier, boost.ExpiresAt);

        _logger.LogInformation("[XP-BOOST] {Multiplier}x boost activated in guild {Guild} by {User} for {Hours}h",
            multiplier, guildId, username, durationHours);

        return boost;
    }

    public async Task<XpBoost?> GetActiveBoostAsync(string guildId)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

        return await db.XpBoosts
            .Where(b => b.GuildId == guildId && b.IsActive && b.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(b => b.CreatedAt)
            .FirstOrDefaultAsync();
    }

    /// <summary>
    /// Fast multiplier lookup with in-memory cache. Returns 1.0 if no active boost.
    /// </summary>
    public double GetBoostMultiplier(string guildId)
    {
        if (_cache.TryGetValue(guildId, out var cached))
        {
            if (cached.expiresAt > DateTime.UtcNow)
                return cached.multiplier;

            // Expired, remove from cache
            _cache.TryRemove(guildId, out _);
        }

        return 1.0;
    }

    /// <summary>
    /// Load active boosts from DB into cache. Called on startup or when needed.
    /// </summary>
    public async Task WarmCacheAsync()
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            var activeBoosts = await db.XpBoosts
                .Where(b => b.IsActive && b.ExpiresAt > DateTime.UtcNow)
                .ToListAsync();

            foreach (var boost in activeBoosts)
                _cache[boost.GuildId] = (boost.Multiplier, boost.ExpiresAt);

            if (activeBoosts.Count > 0)
                _logger.LogInformation("[XP-BOOST] Loaded {Count} active boosts into cache", activeBoosts.Count);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error warming boost cache");
        }
    }

    public static string FormatDuration(double hours)
    {
        if (hours < 1) return $"{(int)(hours * 60)} minutos";
        if (hours == 1) return "1 hora";
        return $"{hours} horas";
    }

    public static string FormatTimeRemaining(DateTime expiresAt)
    {
        var remaining = expiresAt - DateTime.UtcNow;
        if (remaining.TotalMinutes < 1) return "menos de 1 minuto";
        if (remaining.TotalMinutes < 60) return $"{(int)remaining.TotalMinutes} min";
        return $"{(int)remaining.TotalHours}h {remaining.Minutes}min";
    }
}
