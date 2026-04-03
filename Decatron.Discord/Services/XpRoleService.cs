using Decatron.Data;
using Decatron.Discord.Models;
using DSharpPlus.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Discord.Services;

public class XpRoleService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<XpRoleService> _logger;

    private static readonly (int level, string name, string color)[] DefaultRoles = new[]
    {
        (1,   "Newcomer",     "#95a5a6"),
        (5,   "Chatter",      "#2ecc71"),
        (10,  "Regular",      "#27ae60"),
        (15,  "Active",       "#3498db"),
        (20,  "Dedicated",    "#2980b9"),
        (30,  "Veteran",      "#9b59b6"),
        (40,  "Elite",        "#f39c12"),
        (50,  "Legend",       "#e67e22"),
        (65,  "Champion",     "#e74c3c"),
        (80,  "Master",       "#e91e63"),
        (90,  "Grandmaster",  "#00bcd4"),
        (100, "Mythic",       "#ffffff"),
    };

    public XpRoleService(IServiceProvider serviceProvider, ILogger<XpRoleService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    /// <summary>
    /// Creates the 12 default XP roles in the database for a guild (if they don't exist yet).
    /// </summary>
    public async Task<List<XpRole>> CreateDefaultRolesAsync(string guildId)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

        var existing = await db.XpRoles.Where(r => r.GuildId == guildId).ToListAsync();
        if (existing.Count > 0) return existing;

        var roles = new List<XpRole>();
        for (int i = 0; i < DefaultRoles.Length; i++)
        {
            var (level, name, color) = DefaultRoles[i];
            var role = new XpRole
            {
                GuildId = guildId,
                LevelRequired = level,
                RoleName = name,
                RoleColor = color,
                Position = i,
            };
            roles.Add(role);
            db.XpRoles.Add(role);
        }

        await db.SaveChangesAsync();
        _logger.LogInformation("[XP-ROLES] Created {Count} default roles for guild {Guild}", roles.Count, guildId);
        return roles;
    }

    /// <summary>
    /// Gets all XP roles for a guild, creating defaults if none exist.
    /// </summary>
    public async Task<List<XpRole>> GetRolesForGuildAsync(string guildId)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

        var roles = await db.XpRoles
            .Where(r => r.GuildId == guildId)
            .OrderBy(r => r.LevelRequired)
            .ToListAsync();

        if (roles.Count == 0)
            roles = await CreateDefaultRolesAsync(guildId);

        return roles;
    }

    /// <summary>
    /// Ensures XP roles exist in Discord, creating them if needed.
    /// Updates discord_role_id in the database.
    /// </summary>
    public async Task EnsureRolesCreatedInDiscordAsync(DiscordGuild guild, string guildId)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            var xpRoles = await db.XpRoles
                .Where(r => r.GuildId == guildId && (r.DiscordRoleId == null || r.DiscordRoleId == ""))
                .OrderBy(r => r.LevelRequired)
                .ToListAsync();

            _logger.LogInformation("[XP-ROLES] Found {Count} roles to create in Discord for guild {Guild}", xpRoles.Count, guild.Name);

            if (xpRoles.Count == 0) return;

            foreach (var xpRole in xpRoles)
            {
                try
                {
                    var color = ParseColor(xpRole.RoleColor);
                    var discordRole = await guild.CreateRoleAsync(
                        name: $"✦ {xpRole.RoleName}",
                        color: color,
                        mentionable: false,
                        reason: $"Decatron XP System — Level {xpRole.LevelRequired} role");

                    xpRole.DiscordRoleId = discordRole.Id.ToString();
                    xpRole.UpdatedAt = DateTime.UtcNow;

                    _logger.LogInformation("[XP-ROLES] Created Discord role '{Name}' (Level {Level}) in {Guild}",
                        xpRole.RoleName, xpRole.LevelRequired, guild.Name);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[XP-ROLES] Failed to create role '{Name}' in {Guild}", xpRole.RoleName, guild.Name);
                }
            }

            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[XP-ROLES] Error ensuring roles in Discord for guild {Guild}", guildId);
        }
    }

    /// <summary>
    /// Assigns all accumulated XP roles to a member based on their level.
    /// Roles are accumulative — previous roles are NOT removed.
    /// </summary>
    public async Task AssignRolesForLevelAsync(DiscordGuild guild, DiscordMember member, int level)
    {
        try
        {
            var guildId = guild.Id.ToString();

            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            // Get all roles this user should have (level_required <= current level)
            var xpRoles = await db.XpRoles
                .Where(r => r.GuildId == guildId && r.LevelRequired <= level)
                .OrderBy(r => r.LevelRequired)
                .ToListAsync();

            if (xpRoles.Count == 0) return;

            // Get member's current role IDs for quick lookup
            var memberRoleIds = member.Roles.Select(r => r.Id.ToString()).ToHashSet();

            foreach (var xpRole in xpRoles)
            {
                // Create role in Discord if it doesn't exist yet
                if (string.IsNullOrWhiteSpace(xpRole.DiscordRoleId))
                {
                    try
                    {
                        var color = ParseColor(xpRole.RoleColor);
                        var discordRole = await guild.CreateRoleAsync(
                            name: $"✦ {xpRole.RoleName}",
                            color: color,
                            mentionable: false,
                            reason: $"Decatron XP System — Level {xpRole.LevelRequired} role");

                        xpRole.DiscordRoleId = discordRole.Id.ToString();
                        xpRole.UpdatedAt = DateTime.UtcNow;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "[XP-ROLES] Failed to create role '{Name}'", xpRole.RoleName);
                        continue;
                    }
                }

                // Skip if member already has this role
                if (memberRoleIds.Contains(xpRole.DiscordRoleId)) continue;

                // Assign role
                try
                {
                    var role = guild.GetRole(ulong.Parse(xpRole.DiscordRoleId));
                    if (role != null)
                    {
                        await member.GrantRoleAsync(role, $"Decatron XP — Reached level {level}");
                        _logger.LogInformation("[XP-ROLES] Assigned '{Role}' to {User} (Level {Level})",
                            xpRole.RoleName, member.Username, level);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[XP-ROLES] Failed to assign role '{Role}' to {User}",
                        xpRole.RoleName, member.Username);
                }
            }

            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[XP-ROLES] Error assigning roles for {User} in guild {Guild}",
                member.Username, guild.Name);
        }
    }

    /// <summary>
    /// Removes XP roles that the user should NOT have (level_required > current level).
    /// Called when user loses XP or gets reset.
    /// </summary>
    public async Task RemoveExcessRolesAsync(DiscordGuild guild, DiscordMember member, int level)
    {
        try
        {
            var guildId = guild.Id.ToString();
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            // Roles the user should NOT have anymore
            var excessRoles = await db.XpRoles
                .Where(r => r.GuildId == guildId && r.LevelRequired > level)
                .Where(r => r.DiscordRoleId != null && r.DiscordRoleId != "")
                .ToListAsync();

            _logger.LogInformation("[XP-ROLES] RemoveExcess: {Count} roles to check for {User} (level {Level})", excessRoles.Count, member.Username, level);

            var memberRoleIds = member.Roles.Select(r => r.Id.ToString()).ToHashSet();

            foreach (var xpRole in excessRoles)
            {
                if (!memberRoleIds.Contains(xpRole.DiscordRoleId!)) continue;

                try
                {
                    var role = guild.GetRole(ulong.Parse(xpRole.DiscordRoleId!));
                    if (role != null)
                    {
                        await member.RevokeRoleAsync(role, $"Decatron XP — Level dropped below {xpRole.LevelRequired}");
                        _logger.LogInformation("[XP-ROLES] Removed '{Role}' from {User} (Level {Level})",
                            xpRole.RoleName, member.Username, level);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[XP-ROLES] Failed to remove role '{Role}' from {User}", xpRole.RoleName, member.Username);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[XP-ROLES] Error removing excess roles for {User}", member.Username);
        }
    }

    /// <summary>
    /// Sync roles for ALL users in a guild — assign missing roles based on their current level.
    /// </summary>
    public async Task SyncAllUsersRolesAsync(DiscordGuild guild, string guildId)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            var users = await db.UserXps
                .Where(u => u.GuildId == guildId && u.Level > 0)
                .ToListAsync();

            _logger.LogInformation("[XP-ROLES] Syncing roles for {Count} users in {Guild}", users.Count, guild.Name);

            var synced = 0;
            foreach (var userXp in users)
            {
                try
                {
                    if (!ulong.TryParse(userXp.UserId, out var userId)) continue;
                    var member = await guild.GetMemberAsync(userId);
                    await AssignRolesForLevelAsync(guild, member, userXp.Level);
                    synced++;
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "[XP-ROLES] Could not sync roles for user {User}", userXp.Username);
                }
            }

            _logger.LogInformation("[XP-ROLES] Synced roles for {Count}/{Total} users", synced, users.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[XP-ROLES] Error syncing all user roles for guild {Guild}", guildId);
        }
    }

    private static DiscordColor ParseColor(string hex)
    {
        try
        {
            return new DiscordColor(hex);
        }
        catch
        {
            return new DiscordColor("#95a5a6");
        }
    }
}
