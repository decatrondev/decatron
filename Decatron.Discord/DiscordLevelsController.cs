using System.Text.Json;
using Decatron.Attributes;
using Decatron.Data;
using Decatron.Discord.Models;
using Decatron.Discord.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Discord;

[ApiController]
[Route("api/discord/levels")]
[Authorize]
[RequirePermission("settings", "control_total")]
public class DiscordLevelsController : ControllerBase
{
    private readonly DecatronDbContext _db;
    private readonly XpService _xpService;
    private readonly XpRoleService _xpRoleService;
    private readonly XpBoostService _xpBoostService;
    private readonly AchievementService _achievementService;
    private readonly SeasonalService _seasonalService;
    private readonly ILogger<DiscordLevelsController> _logger;

    public DiscordLevelsController(
        DecatronDbContext db,
        XpService xpService,
        XpRoleService xpRoleService,
        XpBoostService xpBoostService,
        AchievementService achievementService,
        SeasonalService seasonalService,
        ILogger<DiscordLevelsController> logger)
    {
        _db = db;
        _xpService = xpService;
        _xpRoleService = xpRoleService;
        _xpBoostService = xpBoostService;
        _achievementService = achievementService;
        _seasonalService = seasonalService;
        _logger = logger;
    }

    // ============================================
    // CONFIG
    // ============================================

    [HttpGet("{guildId}")]
    public async Task<IActionResult> GetConfig(string guildId)
    {
        var config = await _db.XpConfigs.FirstOrDefaultAsync(c => c.GuildId == guildId);

        // Stats
        var totalUsers = await _db.UserXps.CountAsync(u => u.GuildId == guildId);
        var avgLevel = totalUsers > 0
            ? await _db.UserXps.Where(u => u.GuildId == guildId).AverageAsync(u => (double)u.Level)
            : 0;
        var totalMessages = totalUsers > 0
            ? await _db.UserXps.Where(u => u.GuildId == guildId).SumAsync(u => u.TotalMessages)
            : 0;

        // Active boost
        var activeBoost = await _db.XpBoosts
            .Where(b => b.GuildId == guildId && b.IsActive && b.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(b => b.CreatedAt)
            .FirstOrDefaultAsync();

        return Ok(new
        {
            success = true,
            config = config != null ? new
            {
                config.Enabled,
                config.DifficultyPreset,
                config.CustomMultiplier,
                config.XpMin,
                config.XpMax,
                config.CooldownSeconds,
                config.MaxXpPerHour,
                config.MinMessageLength,
                config.ExcludedChannels,
                config.NightModeEnabled,
                config.NightModeMultiplier,
                config.LevelupChannelId,
                config.AchievementChannelId,
            } : (object?)null,
            stats = new
            {
                totalUsers,
                avgLevel = Math.Round(avgLevel, 1),
                totalMessages,
            },
            activeBoost = activeBoost != null ? new
            {
                activeBoost.Multiplier,
                activeBoost.ActivatedByUsername,
                startsAt = DateTime.SpecifyKind(activeBoost.StartsAt, DateTimeKind.Utc),
                expiresAt = DateTime.SpecifyKind(activeBoost.ExpiresAt, DateTimeKind.Utc),
            } : (object?)null,
        });
    }

    [HttpPut("{guildId}")]
    public async Task<IActionResult> SaveConfig(string guildId, [FromBody] JsonElement body)
    {
        var config = await _db.XpConfigs.FirstOrDefaultAsync(c => c.GuildId == guildId);
        if (config == null)
        {
            config = new XpConfig { GuildId = guildId };
            _db.XpConfigs.Add(config);
        }

        if (body.TryGetProperty("enabled", out var en)) config.Enabled = en.GetBoolean();
        if (body.TryGetProperty("difficultyPreset", out var dp)) config.DifficultyPreset = dp.GetString() ?? "normal";
        if (body.TryGetProperty("customMultiplier", out var cm)) config.CustomMultiplier = cm.GetDouble();
        if (body.TryGetProperty("xpMin", out var xmin)) config.XpMin = xmin.GetInt32();
        if (body.TryGetProperty("xpMax", out var xmax)) config.XpMax = xmax.GetInt32();
        if (body.TryGetProperty("cooldownSeconds", out var cs)) config.CooldownSeconds = cs.GetInt32();
        if (body.TryGetProperty("maxXpPerHour", out var mxh)) config.MaxXpPerHour = mxh.GetInt32();
        if (body.TryGetProperty("minMessageLength", out var mml)) config.MinMessageLength = mml.GetInt32();
        if (body.TryGetProperty("excludedChannels", out var ec)) config.ExcludedChannels = ec.GetRawText();
        if (body.TryGetProperty("nightModeEnabled", out var nme)) config.NightModeEnabled = nme.GetBoolean();
        if (body.TryGetProperty("nightModeMultiplier", out var nmm)) config.NightModeMultiplier = nmm.GetDouble();
        if (body.TryGetProperty("levelupChannelId", out var lci)) config.LevelupChannelId = lci.ValueKind == JsonValueKind.Null ? null : lci.GetString();
        if (body.TryGetProperty("achievementChannelId", out var aci)) config.AchievementChannelId = aci.ValueKind == JsonValueKind.Null ? null : aci.GetString();

        config.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Invalidate cached config
        _xpService.InvalidateConfigCache(guildId);

        return Ok(new { success = true });
    }

    // ============================================
    // ROLES
    // ============================================

    [HttpGet("{guildId}/roles")]
    public async Task<IActionResult> GetRoles(string guildId)
    {
        var roles = await _db.XpRoles
            .Where(r => r.GuildId == guildId)
            .OrderBy(r => r.LevelRequired)
            .Select(r => new
            {
                r.Id,
                r.LevelRequired,
                r.RoleName,
                r.RoleColor,
                r.DiscordRoleId,
                r.Position,
                createdInDiscord = r.DiscordRoleId != null,
            })
            .ToListAsync();

        return Ok(new { success = true, roles });
    }

    [HttpPost("{guildId}/roles/create-defaults")]
    public async Task<IActionResult> CreateDefaultRoles(string guildId)
    {
        var roles = await _xpRoleService.CreateDefaultRolesAsync(guildId);
        return Ok(new { success = true, count = roles.Count });
    }

    [HttpPost("{guildId}/roles/sync-discord")]
    public async Task<IActionResult> SyncRolesToDiscord(string guildId)
    {
        _logger.LogInformation("[LEVELS-API] SyncRolesToDiscord called for guild {GuildId}", guildId);

        var clientProvider = HttpContext.RequestServices.GetRequiredService<DiscordClientProvider>();
        var client = clientProvider.Client;

        _logger.LogInformation("[LEVELS-API] Bot has {Count} guilds cached", client.Guilds.Count);

        if (!ulong.TryParse(guildId, out var guildUlong))
            return BadRequest(new { success = false, error = "Invalid guild ID" });

        if (!client.Guilds.TryGetValue(guildUlong, out var guild))
        {
            _logger.LogWarning("[LEVELS-API] Guild {GuildId} not found in bot cache. Available: {Guilds}",
                guildId, string.Join(", ", client.Guilds.Keys));
            return BadRequest(new { success = false, error = "Bot is not in this server" });
        }

        _logger.LogInformation("[LEVELS-API] Found guild {Name}, calling EnsureRolesCreatedInDiscordAsync", guild.Name);
        await _xpRoleService.EnsureRolesCreatedInDiscordAsync(guild, guildId);

        // Verify results
        var updated = await _db.XpRoles.CountAsync(r => r.GuildId == guildId && r.DiscordRoleId != null && r.DiscordRoleId != "");
        _logger.LogInformation("[LEVELS-API] After sync: {Count} roles have discord_role_id", updated);

        return Ok(new { success = true, synced = updated });
    }

    [HttpPut("{guildId}/roles/{roleId}")]
    public async Task<IActionResult> UpdateRole(string guildId, long roleId, [FromBody] JsonElement body)
    {
        var role = await _db.XpRoles.FirstOrDefaultAsync(r => r.Id == roleId && r.GuildId == guildId);
        if (role == null) return NotFound(new { success = false, error = "Role not found" });

        if (body.TryGetProperty("roleName", out var rn)) role.RoleName = rn.GetString() ?? role.RoleName;
        if (body.TryGetProperty("roleColor", out var rc)) role.RoleColor = rc.GetString() ?? role.RoleColor;
        if (body.TryGetProperty("levelRequired", out var lr)) role.LevelRequired = lr.GetInt32();
        if (body.TryGetProperty("position", out var pos)) role.Position = pos.GetInt32();

        role.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Also update in Discord if the role exists there
        if (!string.IsNullOrWhiteSpace(role.DiscordRoleId))
        {
            try
            {
                var clientProvider = HttpContext.RequestServices.GetRequiredService<DiscordClientProvider>();
                var client = clientProvider.Client;
                if (ulong.TryParse(guildId, out var guildUlong) && client.Guilds.TryGetValue(guildUlong, out var guild))
                {
                    if (ulong.TryParse(role.DiscordRoleId, out var roleUlong))
                    {
                        var discordRole = guild.GetRole(roleUlong);
                        if (discordRole != null)
                        {
                            await discordRole.ModifyAsync(r =>
                            {
                                r.Name = $"✦ {role.RoleName}";
                                r.Color = new DSharpPlus.Entities.DiscordColor(role.RoleColor);
                            });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[XP-ROLES] Could not update Discord role '{Name}'", role.RoleName);
            }
        }

        return Ok(new { success = true });
    }

    [HttpDelete("{guildId}/roles/{roleId}")]
    public async Task<IActionResult> DeleteRole(string guildId, long roleId)
    {
        try
        {
            var role = await _db.XpRoles.FirstOrDefaultAsync(r => r.Id == roleId && r.GuildId == guildId);
            if (role == null) return NotFound(new { success = false });

            // Try to delete from Discord (best effort — don't block DB deletion)
            if (!string.IsNullOrWhiteSpace(role.DiscordRoleId))
            {
                try
                {
                    var clientProvider = HttpContext.RequestServices.GetRequiredService<DiscordClientProvider>();
                    var client = clientProvider.Client;
                    if (ulong.TryParse(guildId, out var guildUlong) && client.Guilds.TryGetValue(guildUlong, out var guild))
                    {
                        if (ulong.TryParse(role.DiscordRoleId, out var roleUlong))
                        {
                            var discordRole = guild.GetRole(roleUlong);
                            if (discordRole != null)
                            {
                                await discordRole.DeleteAsync("Decatron XP — Role removed from dashboard");
                                _logger.LogInformation("[XP-ROLES] Deleted Discord role '{Name}' from {Guild}", role.RoleName, guild.Name);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[XP-ROLES] Could not delete Discord role '{Name}' — removing from DB anyway", role.RoleName);
                }
            }

            _db.XpRoles.Remove(role);
            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[XP-ROLES] Error deleting role {RoleId} from guild {Guild}", roleId, guildId);
            // Last resort: try to delete from DB directly
            try
            {
                var roleToDelete = await _db.XpRoles.FindAsync(roleId);
                if (roleToDelete != null)
                {
                    _db.XpRoles.Remove(roleToDelete);
                    await _db.SaveChangesAsync();
                }
                return Ok(new { success = true, warning = "Deleted from DB but Discord role may still exist" });
            }
            catch
            {
                return StatusCode(500, new { success = false, error = "Could not delete role" });
            }
        }
    }

    [HttpDelete("{guildId}/roles")]
    public async Task<IActionResult> DeleteAllRoles(string guildId)
    {
        var roles = await _db.XpRoles.Where(r => r.GuildId == guildId).ToListAsync();
        if (roles.Count == 0) return Ok(new { success = true, deleted = 0 });

        // Try to delete from Discord
        try
        {
            var clientProvider = HttpContext.RequestServices.GetRequiredService<DiscordClientProvider>();
            var client = clientProvider.Client;
            if (ulong.TryParse(guildId, out var guildUlong) && client.Guilds.TryGetValue(guildUlong, out var guild))
            {
                foreach (var role in roles.Where(r => !string.IsNullOrWhiteSpace(r.DiscordRoleId)))
                {
                    try
                    {
                        if (ulong.TryParse(role.DiscordRoleId, out var roleUlong))
                        {
                            var discordRole = guild.GetRole(roleUlong);
                            if (discordRole != null)
                                await discordRole.DeleteAsync("Decatron XP — All roles removed");
                        }
                    }
                    catch { }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[XP-ROLES] Error deleting some Discord roles");
        }

        // Delete all from DB
        _db.XpRoles.RemoveRange(roles);
        await _db.SaveChangesAsync();
        return Ok(new { success = true, deleted = roles.Count });
    }

    [HttpPost("{guildId}/roles/sync-users")]
    public async Task<IActionResult> SyncAllUsersRoles(string guildId)
    {
        var clientProvider = HttpContext.RequestServices.GetRequiredService<DiscordClientProvider>();
        var client = clientProvider.Client;

        if (!ulong.TryParse(guildId, out var guildUlong) || !client.Guilds.TryGetValue(guildUlong, out var guild))
            return BadRequest(new { success = false, error = "Bot is not in this server" });

        await _xpRoleService.SyncAllUsersRolesAsync(guild, guildId);
        return Ok(new { success = true });
    }

    [HttpPost("{guildId}/roles/cleanup-discord")]
    public async Task<IActionResult> CleanupOrphanedDiscordRoles(string guildId)
    {
        try
        {
            var clientProvider = HttpContext.RequestServices.GetRequiredService<DiscordClientProvider>();
            var client = clientProvider.Client;

            if (!ulong.TryParse(guildId, out var guildUlong) || !client.Guilds.TryGetValue(guildUlong, out var guild))
                return BadRequest(new { success = false, error = "Bot is not in this server" });

            // Find all Discord roles with ✦ prefix that belong to Decatron XP
            var xpRoleIds = await _db.XpRoles
                .Where(r => r.GuildId == guildId && r.DiscordRoleId != null && r.DiscordRoleId != "")
                .Select(r => r.DiscordRoleId)
                .ToListAsync();

            var deleted = 0;
            foreach (var discordRole in guild.Roles.Values)
            {
                if (discordRole.Name.StartsWith("✦ ") && !xpRoleIds.Contains(discordRole.Id.ToString()))
                {
                    try
                    {
                        await discordRole.DeleteAsync("Decatron XP — Cleanup orphaned role");
                        deleted++;
                    }
                    catch { }
                }
            }

            return Ok(new { success = true, deleted });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cleaning up orphaned roles");
            return StatusCode(500, new { success = false, error = ex.Message });
        }
    }

    [HttpPost("{guildId}/roles")]
    public async Task<IActionResult> AddRole(string guildId, [FromBody] JsonElement body)
    {
        var role = new XpRole
        {
            GuildId = guildId,
            RoleName = body.TryGetProperty("roleName", out var rn) ? rn.GetString() ?? "New Role" : "New Role",
            RoleColor = body.TryGetProperty("roleColor", out var rc) ? rc.GetString() ?? "#95a5a6" : "#95a5a6",
            LevelRequired = body.TryGetProperty("levelRequired", out var lr) ? lr.GetInt32() : 1,
            Position = body.TryGetProperty("position", out var pos) ? pos.GetInt32() : 0,
        };

        _db.XpRoles.Add(role);
        await _db.SaveChangesAsync();
        return Ok(new { success = true, roleId = role.Id });
    }

    // ============================================
    // BOOSTS
    // ============================================

    [HttpGet("{guildId}/boosts")]
    public async Task<IActionResult> GetBoosts(string guildId)
    {
        var boosts = await _db.XpBoosts
            .Where(b => b.GuildId == guildId)
            .OrderByDescending(b => b.CreatedAt)
            .Take(20)
            .Select(b => new
            {
                b.Id,
                b.Multiplier,
                b.ActivatedByUsername,
                startsAt = DateTime.SpecifyKind(b.StartsAt, DateTimeKind.Utc),
                expiresAt = DateTime.SpecifyKind(b.ExpiresAt, DateTimeKind.Utc),
                b.IsActive,
                isExpired = b.ExpiresAt <= DateTime.UtcNow,
            })
            .ToListAsync();

        return Ok(new { success = true, boosts });
    }

    [HttpPost("{guildId}/boosts")]
    public async Task<IActionResult> CreateBoost(string guildId, [FromBody] JsonElement body)
    {
        var multiplier = body.TryGetProperty("multiplier", out var m) ? m.GetDouble() : 2.0;
        var hours = body.TryGetProperty("hours", out var h) ? h.GetDouble() : 1.0;
        var username = User.FindFirst("login")?.Value ?? "Admin";
        var userId = User.FindFirst("sub")?.Value ?? "0";

        var boost = await _xpBoostService.CreateBoostAsync(guildId, multiplier, hours, userId, username);
        return Ok(new { success = true, boost = new { boost.Multiplier, boost.ExpiresAt } });
    }

    // ============================================
    // USERS
    // ============================================

    [HttpGet("{guildId}/users")]
    public async Task<IActionResult> GetUsers(string guildId, [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _db.UserXps.Where(u => u.GuildId == guildId);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(u => u.Username.ToLower().Contains(search.ToLower()));

        var total = await query.CountAsync();
        var users = await query
            .OrderByDescending(u => u.Level)
            .ThenByDescending(u => u.Xp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new
            {
                u.UserId,
                u.Username,
                u.AvatarUrl,
                u.Level,
                u.Xp,
                u.TotalMessages,
                u.StreakDays,
                u.LastXpAt,
            })
            .ToListAsync();

        return Ok(new { success = true, users, total, page, pageSize });
    }

    [HttpPut("{guildId}/users/{userId}")]
    public async Task<IActionResult> UpdateUserXp(string guildId, string userId, [FromBody] JsonElement body)
    {
        var action = body.TryGetProperty("action", out var a) ? a.GetString() : null;
        var amount = body.TryGetProperty("amount", out var amt) ? amt.GetInt64() : 0;

        // Get old level to detect level-up
        var oldXp = await _db.UserXps.AsNoTracking().FirstOrDefaultAsync(u => u.GuildId == guildId && u.UserId == userId);
        var oldLevel = oldXp?.Level ?? 0;

        switch (action)
        {
            case "give":
                var (given, givenAch) = await _xpService.GiveXpAsync(guildId, userId, oldXp?.Username ?? "", (int)amount);
                await HandleLevelChange(guildId, userId, oldLevel, given.Level);
                return Ok(new { success = true, level = given.Level, xp = given.Xp, leveledUp = given.Level > oldLevel });

            case "remove":
                var removed = await _xpService.RemoveXpAsync(guildId, userId, (int)amount);
                if (removed == null) return NotFound(new { success = false });
                if (removed.Level < oldLevel) await HandleLevelDown(guildId, userId, removed.Level);
                return Ok(new { success = true, level = removed.Level, xp = removed.Xp });

            case "reset":
                var reset = await _xpService.ResetXpAsync(guildId, userId);
                if (oldLevel > 0) await HandleLevelDown(guildId, userId, 0);
                return Ok(new { success = reset });

            case "set":
                var (set, setAch) = await _xpService.SetXpAsync(guildId, userId, oldXp?.Username ?? "", amount);
                await HandleLevelChange(guildId, userId, oldLevel, set.Level);
                return Ok(new { success = true, level = set.Level, xp = set.Xp, leveledUp = set.Level > oldLevel });

            default:
                return BadRequest(new { success = false, error = "Invalid action. Use: give, remove, reset, set" });
        }
    }

    /// <summary>
    /// Remove excess roles when user drops level (remove/reset XP).
    /// </summary>
    private async Task HandleLevelDown(string guildId, string userId, int newLevel)
    {
        try
        {
            _logger.LogInformation("[LEVELS-API] HandleLevelDown called: guild={Guild} user={User} newLevel={Level}", guildId, userId, newLevel);
            var clientProvider = HttpContext.RequestServices.GetRequiredService<DiscordClientProvider>();
            var client = clientProvider.Client;
            if (!ulong.TryParse(guildId, out var guildUlong) || !client.Guilds.TryGetValue(guildUlong, out var guild))
            {
                _logger.LogWarning("[LEVELS-API] HandleLevelDown: guild not found in bot cache");
                return;
            }
            if (!ulong.TryParse(userId, out var userUlong)) return;

            var member = await guild.GetMemberAsync(userUlong);
            await _xpRoleService.RemoveExcessRolesAsync(guild, member, newLevel);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error removing roles on level down for {User}", userId);
        }
    }

    /// <summary>
    /// After admin gives XP, assign roles and send level-up notification if level changed.
    /// </summary>
    private async Task HandleLevelChange(string guildId, string userId, int oldLevel, int newLevel)
    {
        if (newLevel <= oldLevel) return;

        try
        {
            var clientProvider = HttpContext.RequestServices.GetRequiredService<DiscordClientProvider>();
            var rankCardGen = HttpContext.RequestServices.GetRequiredService<RankCardGenerator>();
            var client = clientProvider.Client;

            if (!ulong.TryParse(guildId, out var guildUlong) || !client.Guilds.TryGetValue(guildUlong, out var guild))
                return;

            // Assign accumulated roles
            if (ulong.TryParse(userId, out var userUlong))
            {
                try
                {
                    var member = await guild.GetMemberAsync(userUlong);
                    await _xpRoleService.AssignRolesForLevelAsync(guild, member, newLevel);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Could not assign roles for user {User}", userId);
                }
            }

            // Send level-up notification
            var config = await _db.XpConfigs.FirstOrDefaultAsync(c => c.GuildId == guildId);
            if (config != null && !string.IsNullOrEmpty(config.LevelupChannelId) && ulong.TryParse(config.LevelupChannelId, out var channelUlong))
            {
                var channel = guild.GetChannel(channelUlong);
                if (channel != null)
                {
                    var userXp = await _db.UserXps.FirstOrDefaultAsync(u => u.GuildId == guildId && u.UserId == userId);
                    if (userXp != null)
                    {
                        var rank = await _xpService.GetUserRankAsync(guildId, userId);
                        var totalUsers = await _xpService.GetTotalUsersAsync(guildId);
                        var requiredXp = Services.XpService.CalculateRequiredXp(newLevel + 1);

                        var cardStream = await rankCardGen.GenerateAsync(
                            username: userXp.Username,
                            avatarUrl: userXp.AvatarUrl,
                            level: newLevel,
                            currentXp: userXp.Xp,
                            requiredXp: requiredXp,
                            rank: rank,
                            totalUsers: totalUsers,
                            tier: null);

                        if (cardStream != null)
                        {
                            var msg = new DSharpPlus.Entities.DiscordMessageBuilder()
                                .WithContent($"⬆️ **{userXp.Username} subio a nivel {newLevel}!**")
                                .AddFile("rank-card.png", cardStream);
                            await channel.SendMessageAsync(msg);
                            cardStream.Dispose();
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error handling level change for {User} in {Guild}", userId, guildId);
        }
    }

    // ============================================
    // TESTING
    // ============================================

    [HttpPost("{guildId}/test/levelup")]
    public async Task<IActionResult> TestLevelUp(string guildId)
    {
        var config = await _db.XpConfigs.FirstOrDefaultAsync(c => c.GuildId == guildId);
        if (config == null)
            return BadRequest(new { success = false, error = "XP system not configured for this server" });

        if (string.IsNullOrEmpty(config.LevelupChannelId))
            return BadRequest(new { success = false, error = "No level-up channel configured" });

        try
        {
            var clientProvider = HttpContext.RequestServices.GetRequiredService<DiscordClientProvider>();
            var rankCardGen = HttpContext.RequestServices.GetRequiredService<RankCardGenerator>();
            var client = clientProvider.Client;

            if (!ulong.TryParse(guildId, out var guildUlong) || !client.Guilds.TryGetValue(guildUlong, out var guild))
                return BadRequest(new { success = false, error = "Bot is not in this server" });

            if (!ulong.TryParse(config.LevelupChannelId, out var channelUlong))
                return BadRequest(new { success = false, error = "Invalid channel ID" });

            var channel = guild.GetChannel(channelUlong);
            if (channel == null)
                return BadRequest(new { success = false, error = "Channel not found" });

            // Generate test rank card
            var cardStream = await rankCardGen.GenerateAsync(
                username: "TestUser",
                avatarUrl: null,
                level: 10,
                currentXp: 7500,
                requiredXp: 12100,
                rank: 1,
                totalUsers: 42,
                tier: null);

            if (cardStream != null)
            {
                var msg = new DSharpPlus.Entities.DiscordMessageBuilder()
                    .WithContent("🧪 **Test Level Up!** TestUser subio a nivel 10!")
                    .AddFile("rank-card.png", cardStream);
                await channel.SendMessageAsync(msg);
                cardStream.Dispose();
            }

            return Ok(new { success = true, message = "Test level-up sent!" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending test level-up");
            return StatusCode(500, new { success = false, error = ex.Message });
        }
    }

    // ============================================
    // ACHIEVEMENTS
    // ============================================

    [HttpGet("{guildId}/achievements")]
    public async Task<IActionResult> GetAchievements(string guildId)
    {
        var achievements = await _achievementService.GetAchievementsForGuildAsync(guildId);
        return Ok(new
        {
            success = true,
            achievements = achievements.Select(a => new
            {
                a.Id, a.AchievementKey, a.Name, a.Description, a.Icon,
                a.ConditionType, a.ConditionValue, a.IsSystem, a.Enabled,
            }),
        });
    }

    [HttpPost("{guildId}/achievements")]
    public async Task<IActionResult> CreateAchievement(string guildId, [FromBody] JsonElement body)
    {
        var achievement = new XpAchievement
        {
            GuildId = guildId,
            AchievementKey = body.TryGetProperty("key", out var k) ? k.GetString() ?? $"custom_{DateTime.UtcNow.Ticks}" : $"custom_{DateTime.UtcNow.Ticks}",
            Name = body.TryGetProperty("name", out var n) ? n.GetString() ?? "New Badge" : "New Badge",
            Description = body.TryGetProperty("description", out var d) ? d.GetString() ?? "" : "",
            Icon = body.TryGetProperty("icon", out var i) ? i.GetString() ?? "🏆" : "🏆",
            ConditionType = body.TryGetProperty("conditionType", out var ct) ? ct.GetString() ?? "messages" : "messages",
            ConditionValue = body.TryGetProperty("conditionValue", out var cv) ? cv.GetInt32() : 1,
            IsSystem = false,
            Enabled = true,
        };

        _db.XpAchievements.Add(achievement);
        await _db.SaveChangesAsync();
        _achievementService.InvalidateCache(guildId);
        return Ok(new { success = true, id = achievement.Id });
    }

    [HttpPut("{guildId}/achievements/{achievementId}")]
    public async Task<IActionResult> UpdateAchievement(string guildId, long achievementId, [FromBody] JsonElement body)
    {
        var achievement = await _db.XpAchievements.FirstOrDefaultAsync(a => a.Id == achievementId && a.GuildId == guildId);
        if (achievement == null) return NotFound(new { success = false });

        if (body.TryGetProperty("name", out var n)) achievement.Name = n.GetString() ?? achievement.Name;
        if (body.TryGetProperty("description", out var d)) achievement.Description = d.GetString() ?? achievement.Description;
        if (body.TryGetProperty("icon", out var i)) achievement.Icon = i.GetString() ?? achievement.Icon;
        if (body.TryGetProperty("conditionType", out var ct)) achievement.ConditionType = ct.GetString() ?? achievement.ConditionType;
        if (body.TryGetProperty("conditionValue", out var cv)) achievement.ConditionValue = cv.GetInt32();
        if (body.TryGetProperty("enabled", out var en)) achievement.Enabled = en.GetBoolean();

        await _db.SaveChangesAsync();
        _achievementService.InvalidateCache(guildId);
        return Ok(new { success = true });
    }

    [HttpDelete("{guildId}/achievements/{achievementId}")]
    public async Task<IActionResult> DeleteAchievement(string guildId, long achievementId)
    {
        var achievement = await _db.XpAchievements.FirstOrDefaultAsync(a => a.Id == achievementId && a.GuildId == guildId);
        if (achievement == null) return NotFound(new { success = false });

        _db.XpAchievements.Remove(achievement);
        await _db.SaveChangesAsync();
        _achievementService.InvalidateCache(guildId);
        return Ok(new { success = true });
    }

    // ============================================
    // SEASONAL
    // ============================================

    [HttpGet("{guildId}/seasonal")]
    public async Task<IActionResult> GetSeasonalLeaderboard(string guildId, [FromQuery] string? month, [FromQuery] int page = 1)
    {
        var yearMonth = month ?? SeasonalService.GetCurrentMonth();
        var leaderboard = await _seasonalService.GetMonthlyLeaderboardAsync(guildId, yearMonth, page);
        var stats = await _seasonalService.GetMonthlyStatsAsync(guildId, yearMonth);

        return Ok(new
        {
            success = true,
            yearMonth,
            leaderboard = leaderboard.Select((s, idx) => new
            {
                rank = (page - 1) * 10 + idx + 1,
                s.UserId, s.Username, s.XpGained, s.MessagesCount,
            }),
            stats = new { stats.totalUsers, stats.totalXp, stats.topUser },
        });
    }

    // ============================================
    // RESETS
    // ============================================

    /// <summary>Reset achievements for a specific user</summary>
    [HttpDelete("{guildId}/achievements/user/{userId}")]
    public async Task<IActionResult> ResetUserAchievements(string guildId, string userId)
    {
        var count = await _db.UserAchievements
            .Where(ua => ua.GuildId == guildId && ua.UserId == userId)
            .ExecuteDeleteAsync();
        return Ok(new { success = true, deleted = count });
    }

    /// <summary>Reset ALL achievements for ALL users in this guild</summary>
    [HttpDelete("{guildId}/achievements/all-users")]
    public async Task<IActionResult> ResetAllAchievements(string guildId)
    {
        var count = await _db.UserAchievements
            .Where(ua => ua.GuildId == guildId)
            .ExecuteDeleteAsync();
        return Ok(new { success = true, deleted = count });
    }

    /// <summary>Full reset: XP + achievements + seasonal for a specific user</summary>
    [HttpDelete("{guildId}/users/{userId}/full-reset")]
    public async Task<IActionResult> FullResetUser(string guildId, string userId)
    {
        // Get old level for role removal
        var oldXp = await _db.UserXps.FirstOrDefaultAsync(u => u.GuildId == guildId && u.UserId == userId);
        var oldLevel = oldXp?.Level ?? 0;

        // Reset XP
        await _xpService.ResetXpAsync(guildId, userId);

        // Reset achievements
        await _db.UserAchievements
            .Where(ua => ua.GuildId == guildId && ua.UserId == userId)
            .ExecuteDeleteAsync();

        // Reset seasonal
        await _db.XpSeasonals
            .Where(s => s.GuildId == guildId && s.UserId == userId)
            .ExecuteDeleteAsync();

        // Remove roles
        if (oldLevel > 0)
            await HandleLevelDown(guildId, userId, 0);

        return Ok(new { success = true });
    }

    /// <summary>Reset seasonal leaderboard for a month (or current month)</summary>
    [HttpDelete("{guildId}/seasonal")]
    public async Task<IActionResult> ResetSeasonal(string guildId, [FromQuery] string? month)
    {
        var yearMonth = month ?? Services.SeasonalService.GetCurrentMonth();
        var count = await _db.XpSeasonals
            .Where(s => s.GuildId == guildId && s.YearMonth == yearMonth)
            .ExecuteDeleteAsync();
        return Ok(new { success = true, deleted = count, month = yearMonth });
    }

    // ============================================
    // STORE
    // ============================================

    [HttpGet("{guildId}/store")]
    public async Task<IActionResult> GetStoreItems(string guildId)
    {
        var items = await _db.XpStoreItems
            .Where(i => i.GuildId == guildId)
            .OrderBy(i => i.Cost)
            .Select(i => new
            {
                i.Id, i.Name, i.Description, i.Icon, i.Cost, i.ItemType,
                i.DurationHours, i.MaxStock, i.CurrentStock, i.Enabled,
                i.RoleId, i.ChannelId, i.AnnouncementChannelId, i.CustomMessage,
            })
            .ToListAsync();

        return Ok(new { success = true, items });
    }

    [HttpPost("{guildId}/store")]
    public async Task<IActionResult> CreateStoreItem(string guildId, [FromBody] JsonElement body)
    {
        var item = new XpStoreItem
        {
            GuildId = guildId,
            Name = body.TryGetProperty("name", out var n) ? n.GetString() ?? "Item" : "Item",
            Description = body.TryGetProperty("description", out var d) ? d.GetString() ?? "" : "",
            Icon = body.TryGetProperty("icon", out var ic) ? ic.GetString() ?? "🎁" : "🎁",
            Cost = body.TryGetProperty("cost", out var c) ? c.GetInt32() : 100,
            ItemType = body.TryGetProperty("itemType", out var it) ? it.GetString() ?? "custom" : "custom",
            DurationHours = body.TryGetProperty("durationHours", out var dh) && dh.ValueKind != JsonValueKind.Null ? dh.GetDouble() : null,
            MaxStock = body.TryGetProperty("maxStock", out var ms) ? ms.GetInt32() : 0,
            CurrentStock = body.TryGetProperty("maxStock", out var cs2) ? cs2.GetInt32() : 0,
            RoleId = body.TryGetProperty("roleId", out var ri) ? ri.GetString() : null,
            ChannelId = body.TryGetProperty("channelId", out var ci) ? ci.GetString() : null,
            AnnouncementChannelId = body.TryGetProperty("announcementChannelId", out var aci) ? aci.GetString() : null,
            CustomMessage = body.TryGetProperty("customMessage", out var cm) ? cm.GetString() : null,
        };

        _db.XpStoreItems.Add(item);
        await _db.SaveChangesAsync();
        return Ok(new { success = true, id = item.Id });
    }

    [HttpPut("{guildId}/store/{itemId}")]
    public async Task<IActionResult> UpdateStoreItem(string guildId, long itemId, [FromBody] JsonElement body)
    {
        var item = await _db.XpStoreItems.FirstOrDefaultAsync(i => i.Id == itemId && i.GuildId == guildId);
        if (item == null) return NotFound(new { success = false });

        if (body.TryGetProperty("name", out var n)) item.Name = n.GetString() ?? item.Name;
        if (body.TryGetProperty("description", out var d)) item.Description = d.GetString() ?? item.Description;
        if (body.TryGetProperty("icon", out var ic)) item.Icon = ic.GetString() ?? item.Icon;
        if (body.TryGetProperty("cost", out var c)) item.Cost = c.GetInt32();
        if (body.TryGetProperty("enabled", out var en)) item.Enabled = en.GetBoolean();
        if (body.TryGetProperty("maxStock", out var ms2)) item.MaxStock = ms2.GetInt32();
        if (body.TryGetProperty("currentStock", out var cs3)) item.CurrentStock = cs3.GetInt32();
        if (body.TryGetProperty("roleId", out var ri2)) item.RoleId = ri2.ValueKind == JsonValueKind.Null ? null : ri2.GetString();
        if (body.TryGetProperty("channelId", out var ci2)) item.ChannelId = ci2.ValueKind == JsonValueKind.Null ? null : ci2.GetString();
        if (body.TryGetProperty("announcementChannelId", out var aci2)) item.AnnouncementChannelId = aci2.ValueKind == JsonValueKind.Null ? null : aci2.GetString();
        if (body.TryGetProperty("customMessage", out var cm2)) item.CustomMessage = cm2.ValueKind == JsonValueKind.Null ? null : cm2.GetString();

        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    [HttpDelete("{guildId}/store/{itemId}")]
    public async Task<IActionResult> DeleteStoreItem(string guildId, long itemId)
    {
        var item = await _db.XpStoreItems.FirstOrDefaultAsync(i => i.Id == itemId && i.GuildId == guildId);
        if (item == null) return NotFound(new { success = false });

        _db.XpStoreItems.Remove(item);
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    [HttpPost("{guildId}/store/{itemId}/buy")]
    public async Task<IActionResult> BuyStoreItem(string guildId, long itemId, [FromBody] JsonElement body)
    {
        var buyerUserId = body.TryGetProperty("userId", out var uid) ? uid.GetString() : null;
        var buyerUsername = body.TryGetProperty("username", out var un) ? un.GetString() ?? "" : "";

        if (string.IsNullOrEmpty(buyerUserId))
            return BadRequest(new { success = false, error = "userId required" });

        var item = await _db.XpStoreItems.FirstOrDefaultAsync(i => i.Id == itemId && i.GuildId == guildId && i.Enabled);
        if (item == null) return NotFound(new { success = false, error = "Item not found or disabled" });

        // Check stock
        if (item.MaxStock > 0 && item.CurrentStock <= 0)
            return BadRequest(new { success = false, error = "Item out of stock" });

        // Check user has enough XP
        var userXp = await _db.UserXps.FirstOrDefaultAsync(u => u.GuildId == guildId && u.UserId == buyerUserId);
        if (userXp == null || userXp.Xp < item.Cost)
            return BadRequest(new { success = false, error = "Not enough XP", required = item.Cost, current = userXp?.Xp ?? 0 });

        // Deduct XP (only from current level XP, don't change level)
        userXp.Xp -= item.Cost;
        userXp.UpdatedAt = DateTime.UtcNow;

        // Decrement stock
        if (item.MaxStock > 0)
            item.CurrentStock = Math.Max(0, item.CurrentStock - 1);

        // Create purchase record
        var purchase = new XpStorePurchase
        {
            GuildId = guildId,
            UserId = buyerUserId,
            Username = buyerUsername,
            ItemId = itemId,
            CostPaid = item.Cost,
            ExpiresAt = item.DurationHours.HasValue ? DateTime.UtcNow.AddHours(item.DurationHours.Value) : null,
            Status = item.ItemType == "custom" ? "pending" : "completed",
        };
        _db.XpStorePurchases.Add(purchase);

        // Log transaction
        _db.XpTransactions.Add(new XpTransaction
        {
            GuildId = guildId,
            UserId = buyerUserId,
            XpAmount = -item.Cost,
            Source = "store",
            Description = $"Purchased: {item.Name}",
        });

        await _db.SaveChangesAsync();

        // Execute reward action
        await ExecuteStoreReward(guildId, buyerUserId, buyerUsername, item);

        return Ok(new { success = true, remaining_xp = userXp.Xp, item = item.Name });
    }

    /// <summary>
    /// Execute the reward action based on item type: assign role, grant channel access, send shoutout.
    /// </summary>
    private async Task ExecuteStoreReward(string guildId, string userId, string username, XpStoreItem item)
    {
        try
        {
            var clientProvider = HttpContext.RequestServices.GetRequiredService<DiscordClientProvider>();
            var client = clientProvider.Client;

            if (!ulong.TryParse(guildId, out var guildUlong) || !client.Guilds.TryGetValue(guildUlong, out var guild))
                return;

            if (!ulong.TryParse(userId, out var userUlong))
                return;

            switch (item.ItemType)
            {
                case "role_temp":
                    if (!string.IsNullOrEmpty(item.RoleId) && ulong.TryParse(item.RoleId, out var roleUlong))
                    {
                        var member = await guild.GetMemberAsync(userUlong);
                        var role = guild.GetRole(roleUlong);
                        if (role != null)
                        {
                            await member.GrantRoleAsync(role, $"Decatron Store — Purchased {item.Name}");
                            _logger.LogInformation("[STORE] Assigned role '{Role}' to {User}", role.Name, username);
                        }
                    }
                    break;

                case "channel_access":
                    if (!string.IsNullOrEmpty(item.ChannelId) && ulong.TryParse(item.ChannelId, out var channelUlong))
                    {
                        var member = await guild.GetMemberAsync(userUlong);
                        var channel = guild.GetChannel(channelUlong);
                        if (channel != null)
                        {
                            await channel.AddOverwriteAsync(member,
                                allow: DSharpPlus.Permissions.AccessChannels | DSharpPlus.Permissions.SendMessages,
                                reason: $"Decatron Store — Purchased {item.Name}");
                            _logger.LogInformation("[STORE] Granted channel access to {User} in {Channel}", username, channel.Name);
                        }
                    }
                    break;

                case "shoutout":
                    break;

                // "custom" — marked as pending, streamer delivers manually
            }

            // Send announcement for ALL types that have a channel configured
            var announceChannel = ResolveAnnouncementChannel(guild, item, guildId);
            if (announceChannel != null)
            {
                // Build message with variables
                var message = item.CustomMessage ?? item.Description ?? "";
                message = message
                    .Replace("{user}", username)
                    .Replace("{mention}", $"<@{userId}>")
                    .Replace("{item}", item.Name);

                string title;
                string color;
                switch (item.ItemType)
                {
                    case "shoutout":
                        title = "📢 Shoutout!";
                        color = "#f59e0b";
                        if (string.IsNullOrWhiteSpace(message))
                            message = $"Shoutout para **{username}** (<@{userId}>)!";
                        break;
                    case "custom":
                        title = $"{item.Icon} Nuevo canje pendiente!";
                        color = "#8b5cf6";
                        message = $"**{username}** canjeo **{item.Name}**\n{message}\n\n⏳ *Pendiente de entregar*";
                        break;
                    default:
                        var durationText = item.DurationHours.HasValue ? $" por {FormatDurationHours(item.DurationHours.Value)}" : "";
                        title = $"{item.Icon} Compra en la Store!";
                        color = "#22c55e";
                        message = $"**{username}** compro **{item.Name}**{durationText}";
                        break;
                }

                var embed = new DSharpPlus.Entities.DiscordEmbedBuilder()
                    .WithTitle(title)
                    .WithDescription(message)
                    .WithColor(new DSharpPlus.Entities.DiscordColor(color))
                    .WithFooter("Decatron XP Store")
                    .WithTimestamp(DateTimeOffset.UtcNow);
                await announceChannel.SendMessageAsync(embed);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[STORE] Error executing reward for {User}: {Item}", username, item.Name);
        }
    }

    private DSharpPlus.Entities.DiscordChannel? ResolveAnnouncementChannel(DSharpPlus.Entities.DiscordGuild guild, XpStoreItem item, string guildId)
    {
        // Item-specific channel
        if (!string.IsNullOrEmpty(item.AnnouncementChannelId) && ulong.TryParse(item.AnnouncementChannelId, out var annChId))
        {
            var ch = guild.GetChannel(annChId);
            if (ch != null) return ch;
        }

        // Fallback to XP config channels
        var config = _db.XpConfigs.FirstOrDefault(c => c.GuildId == guildId);
        if (config?.AchievementChannelId != null && ulong.TryParse(config.AchievementChannelId, out var achChId))
        {
            var ch = guild.GetChannel(achChId);
            if (ch != null) return ch;
        }
        if (config?.LevelupChannelId != null && ulong.TryParse(config.LevelupChannelId, out var lvlChId))
        {
            var ch = guild.GetChannel(lvlChId);
            if (ch != null) return ch;
        }

        return null;
    }

    private static string FormatDurationHours(double hours)
    {
        if (hours < 1) return $"{Math.Round(hours * 60)} min";
        if (hours < 24) return $"{Math.Round(hours)} horas";
        if (hours < 168) return $"{Math.Round(hours / 24)} dias";
        if (hours < 720) return $"{Math.Round(hours / 168)} semanas";
        return $"{Math.Round(hours / 720)} meses";
    }

    [HttpGet("{guildId}/store/purchases")]
    public async Task<IActionResult> GetStorePurchases(string guildId)
    {
        var purchases = await _db.XpStorePurchases
            .Where(p => p.GuildId == guildId)
            .OrderByDescending(p => p.PurchasedAt)
            .Take(50)
            .Join(_db.XpStoreItems, p => p.ItemId, i => i.Id, (p, i) => new
            {
                p.Id, p.UserId, p.Username, p.CostPaid, p.Status,
                purchasedAt = DateTime.SpecifyKind(p.PurchasedAt, DateTimeKind.Utc),
                itemName = i.Name, itemIcon = i.Icon,
            })
            .ToListAsync();

        return Ok(new { success = true, purchases });
    }

    [HttpGet("{guildId}/store/pending")]
    public async Task<IActionResult> GetPendingPurchases(string guildId)
    {
        var pending = await _db.XpStorePurchases
            .Where(p => p.GuildId == guildId && p.Status == "pending")
            .OrderBy(p => p.PurchasedAt)
            .Join(_db.XpStoreItems, p => p.ItemId, i => i.Id, (p, i) => new
            {
                p.Id, p.UserId, p.Username, p.CostPaid,
                purchasedAt = DateTime.SpecifyKind(p.PurchasedAt, DateTimeKind.Utc),
                itemName = i.Name, itemIcon = i.Icon, itemDescription = i.Description,
            })
            .ToListAsync();

        return Ok(new { success = true, pending });
    }

    [HttpPut("{guildId}/store/purchases/{purchaseId}/deliver")]
    public async Task<IActionResult> DeliverPurchase(string guildId, long purchaseId)
    {
        var purchase = await _db.XpStorePurchases
            .FirstOrDefaultAsync(p => p.Id == purchaseId && p.GuildId == guildId && p.Status == "pending");

        if (purchase == null)
            return NotFound(new { success = false, error = "Purchase not found or already delivered" });

        purchase.Status = "delivered";
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    /// <summary>Reset all store purchases</summary>
    [HttpDelete("{guildId}/store/purchases")]
    public async Task<IActionResult> ResetAllPurchases(string guildId)
    {
        var count = await _db.XpStorePurchases
            .Where(p => p.GuildId == guildId)
            .ExecuteDeleteAsync();
        return Ok(new { success = true, deleted = count });
    }

    /// <summary>Reset store purchases for a specific user</summary>
    [HttpDelete("{guildId}/store/purchases/{userId}")]
    public async Task<IActionResult> ResetUserPurchases(string guildId, string userId)
    {
        var count = await _db.XpStorePurchases
            .Where(p => p.GuildId == guildId && p.UserId == userId)
            .ExecuteDeleteAsync();
        return Ok(new { success = true, deleted = count });
    }
}
