using Decatron.Data;
using Decatron.Discord.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Discord.Services;

public class SeasonalService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<SeasonalService> _logger;

    public SeasonalService(IServiceProvider serviceProvider, ILogger<SeasonalService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public static string GetCurrentMonth() => DateTime.UtcNow.ToString("yyyy-MM");

    /// <summary>
    /// Track XP gained this month for the seasonal leaderboard.
    /// </summary>
    public async Task TrackXpAsync(string guildId, string userId, string username, int xpAmount)
    {
        try
        {
            var yearMonth = GetCurrentMonth();

            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            var entry = await db.XpSeasonals
                .FirstOrDefaultAsync(s => s.GuildId == guildId && s.UserId == userId && s.YearMonth == yearMonth);

            if (entry == null)
            {
                entry = new XpSeasonal
                {
                    GuildId = guildId,
                    UserId = userId,
                    Username = username,
                    YearMonth = yearMonth,
                    XpGained = xpAmount,
                    MessagesCount = 1,
                };
                db.XpSeasonals.Add(entry);
            }
            else
            {
                entry.XpGained += xpAmount;
                entry.MessagesCount++;
                entry.Username = username;
                entry.UpdatedAt = DateTime.UtcNow;
            }

            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error tracking seasonal XP for {User} in {Guild}", userId, guildId);
        }
    }

    /// <summary>
    /// Get monthly leaderboard.
    /// </summary>
    public async Task<List<XpSeasonal>> GetMonthlyLeaderboardAsync(string guildId, string? yearMonth = null, int page = 1, int pageSize = 10)
    {
        yearMonth ??= GetCurrentMonth();

        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

        return await db.XpSeasonals
            .Where(s => s.GuildId == guildId && s.YearMonth == yearMonth)
            .OrderByDescending(s => s.XpGained)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    /// <summary>
    /// Get seasonal stats for a month.
    /// </summary>
    public async Task<(int totalUsers, int totalXp, string? topUser)> GetMonthlyStatsAsync(string guildId, string? yearMonth = null)
    {
        yearMonth ??= GetCurrentMonth();

        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

        var entries = db.XpSeasonals.Where(s => s.GuildId == guildId && s.YearMonth == yearMonth);
        var totalUsers = await entries.CountAsync();
        var totalXp = totalUsers > 0 ? await entries.SumAsync(s => s.XpGained) : 0;
        var top = await entries.OrderByDescending(s => s.XpGained).FirstOrDefaultAsync();

        return (totalUsers, totalXp, top?.Username);
    }
}
