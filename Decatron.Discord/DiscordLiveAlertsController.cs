using System.Security.Claims;
using Decatron.Attributes;
using Decatron.Data;
using Decatron.Discord.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Discord;

[ApiController]
[Route("api/discord/alerts")]
[Authorize]
[RequirePermission("settings", "control_total")]
public class DiscordLiveAlertsController : ControllerBase
{
    private readonly DecatronDbContext _dbContext;
    private readonly ILogger<DiscordLiveAlertsController> _logger;

    public DiscordLiveAlertsController(DecatronDbContext dbContext, ILogger<DiscordLiveAlertsController> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <summary>
    /// Gets all live alerts for a guild.
    /// </summary>
    [HttpGet("{guildId}")]
    public async Task<IActionResult> GetAlerts(string guildId)
    {
        var channelOwnerId = GetChannelOwnerId();
        var owner = await _dbContext.Users.FindAsync(channelOwnerId);
        if (owner == null) return Unauthorized(new { success = false });

        // Verify guild belongs to this owner
        var guildConfig = await _dbContext.DiscordGuildConfigs
            .FirstOrDefaultAsync(g => g.GuildId == guildId && g.ChannelName == owner.Login.ToLower() && g.IsActive);
        if (guildConfig == null) return NotFound(new { success = false, error = "Servidor no vinculado" });

        var alerts = await _dbContext.DiscordLiveAlerts
            .Where(a => a.GuildId == guildId)
            .OrderByDescending(a => a.IsOwnChannel)
            .ThenBy(a => a.ChannelName)
            .Select(a => new
            {
                a.Id,
                a.ChannelName,
                a.DiscordChannelId,
                a.DiscordChannelName,
                a.CustomMessage,
                a.MentionEveryone,
                a.Enabled,
                a.IsOwnChannel,
                a.ThumbnailMode,
                a.StaticThumbnailUrl,
                a.EmbedColor,
                a.FooterText,
                a.ShowButton,
                a.ShowStartTime,
                a.SendMode,
                a.DelayMinutes,
                a.UpdateIntervalMinutes,
                a.OnOfflineAction
            })
            .ToListAsync();

        return Ok(new { success = true, alerts });
    }

    /// <summary>
    /// Adds a new live alert for a channel in a guild.
    /// </summary>
    [HttpPost("{guildId}")]
    public async Task<IActionResult> AddAlert(string guildId, [FromBody] AddAlertRequest request)
    {
        var channelOwnerId = GetChannelOwnerId();
        var owner = await _dbContext.Users.FindAsync(channelOwnerId);
        if (owner == null) return Unauthorized(new { success = false });

        var guildConfig = await _dbContext.DiscordGuildConfigs
            .FirstOrDefaultAsync(g => g.GuildId == guildId && g.ChannelName == owner.Login.ToLower() && g.IsActive);
        if (guildConfig == null) return NotFound(new { success = false, error = "Servidor no vinculado" });

        // Check if alert already exists for this channel in this guild
        var existing = await _dbContext.DiscordLiveAlerts
            .FirstOrDefaultAsync(a => a.GuildId == guildId && a.ChannelName == request.ChannelName.ToLower());
        if (existing != null)
            return BadRequest(new { success = false, error = "Ya existe una alerta para este canal" });

        var isOwn = request.ChannelName.ToLower() == owner.Login.ToLower();

        var alert = new DiscordLiveAlert
        {
            GuildConfigId = guildConfig.Id,
            GuildId = guildId,
            ChannelName = request.ChannelName.ToLower(),
            DiscordChannelId = request.DiscordChannelId,
            DiscordChannelName = request.DiscordChannelName,
            CustomMessage = request.CustomMessage,
            MentionEveryone = request.MentionEveryone,
            Enabled = true,
            IsOwnChannel = isOwn,
            ThumbnailMode = request.ThumbnailMode,
            StaticThumbnailUrl = request.StaticThumbnailUrl,
            EmbedColor = request.EmbedColor,
            FooterText = request.FooterText,
            ShowButton = request.ShowButton,
            ShowStartTime = request.ShowStartTime,
            SendMode = request.SendMode,
            DelayMinutes = request.DelayMinutes,
            UpdateIntervalMinutes = request.UpdateIntervalMinutes,
            OnOfflineAction = request.OnOfflineAction
        };

        _dbContext.DiscordLiveAlerts.Add(alert);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Live alert added: {Channel} → #{DiscordChannel} in guild {Guild}",
            alert.ChannelName, alert.DiscordChannelName, guildConfig.GuildName);

        return Ok(new { success = true, alert = new { alert.Id, alert.ChannelName, alert.DiscordChannelId, alert.DiscordChannelName, alert.MentionEveryone, alert.Enabled, alert.IsOwnChannel, alert.ThumbnailMode, alert.StaticThumbnailUrl, alert.EmbedColor, alert.FooterText, alert.ShowButton, alert.ShowStartTime, alert.SendMode, alert.DelayMinutes, alert.UpdateIntervalMinutes, alert.OnOfflineAction } });
    }

    /// <summary>
    /// Updates an existing live alert.
    /// </summary>
    [HttpPut("{alertId}")]
    public async Task<IActionResult> UpdateAlert(long alertId, [FromBody] UpdateAlertRequest request)
    {
        var alert = await _dbContext.DiscordLiveAlerts.FindAsync(alertId);
        if (alert == null) return NotFound(new { success = false });

        if (request.DiscordChannelId != null)
        {
            alert.DiscordChannelId = request.DiscordChannelId;
            alert.DiscordChannelName = request.DiscordChannelName ?? alert.DiscordChannelName;
        }
        if (request.CustomMessage != null)
            alert.CustomMessage = request.CustomMessage == "" ? null : request.CustomMessage;
        if (request.MentionEveryone.HasValue)
            alert.MentionEveryone = request.MentionEveryone.Value;
        if (request.Enabled.HasValue)
            alert.Enabled = request.Enabled.Value;
        if (request.ThumbnailMode != null)
            alert.ThumbnailMode = request.ThumbnailMode;
        if (request.StaticThumbnailUrl != null)
            alert.StaticThumbnailUrl = request.StaticThumbnailUrl == "" ? null : request.StaticThumbnailUrl;
        if (request.EmbedColor != null)
            alert.EmbedColor = request.EmbedColor;
        if (request.FooterText != null)
            alert.FooterText = request.FooterText == "" ? null : request.FooterText;
        if (request.ShowButton.HasValue)
            alert.ShowButton = request.ShowButton.Value;
        if (request.ShowStartTime.HasValue)
            alert.ShowStartTime = request.ShowStartTime.Value;
        if (request.SendMode != null)
            alert.SendMode = request.SendMode;
        if (request.DelayMinutes.HasValue)
            alert.DelayMinutes = request.DelayMinutes.Value;
        if (request.UpdateIntervalMinutes.HasValue)
            alert.UpdateIntervalMinutes = Math.Max(request.UpdateIntervalMinutes.Value, 10);
        if (request.OnOfflineAction != null)
            alert.OnOfflineAction = request.OnOfflineAction;

        alert.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        return Ok(new { success = true });
    }

    /// <summary>
    /// Deletes a live alert.
    /// </summary>
    [HttpDelete("{alertId}")]
    public async Task<IActionResult> DeleteAlert(long alertId)
    {
        var alert = await _dbContext.DiscordLiveAlerts.FindAsync(alertId);
        if (alert == null) return NotFound(new { success = false });

        _dbContext.DiscordLiveAlerts.Remove(alert);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Live alert deleted: {Channel} in guild {GuildId}", alert.ChannelName, alert.GuildId);

        return Ok(new { success = true });
    }

    /// <summary>
    /// Searches a Twitch channel by name and returns avatar + live status.
    /// Used when adding a new alert to validate the channel exists.
    /// </summary>
    [HttpGet("search/{channelName}")]
    public async Task<IActionResult> SearchChannel(string channelName)
    {
        try
        {
            var twitchApi = HttpContext.RequestServices.GetRequiredService<Decatron.Services.TwitchApiService>();
            var user = await twitchApi.GetUserByLoginAsync(channelName.ToLower().Trim());

            if (user == null)
                return Ok(new { success = false, error = "Canal no encontrado" });

            var stream = await twitchApi.GetStreamAsync(user.id);

            string? thumbnailUrl = null;
            if (stream != null && !string.IsNullOrEmpty(stream.thumbnail_url))
            {
                thumbnailUrl = stream.thumbnail_url
                    .Replace("{width}", "440")
                    .Replace("{height}", "248");
            }

            return Ok(new
            {
                success = true,
                channel = new
                {
                    login = user.login,
                    displayName = user.display_name,
                    profileImage = user.profile_image_url,
                    isLive = stream != null,
                    game = stream?.game_name,
                    viewers = stream?.viewer_count ?? 0,
                    title = stream?.title,
                    thumbnail = thumbnailUrl
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching channel {Channel}", channelName);
            return Ok(new { success = false, error = "Error al buscar canal" });
        }
    }

    /// <summary>
    /// Gets live status for all alert channels in a guild.
    /// Used by the dashboard to show live/offline status with thumbnails.
    /// </summary>
    [HttpGet("{guildId}/status")]
    public async Task<IActionResult> GetAlertsStatus(string guildId)
    {
        try
        {
            var alertChannels = await _dbContext.DiscordLiveAlerts
                .Where(a => a.GuildId == guildId)
                .Select(a => a.ChannelName)
                .Distinct()
                .ToListAsync();

            var twitchApi = HttpContext.RequestServices.GetRequiredService<Decatron.Services.TwitchApiService>();
            var statuses = new List<object>();

            foreach (var channelName in alertChannels)
            {
                var user = await twitchApi.GetUserByLoginAsync(channelName);
                if (user == null) continue;

                var stream = await twitchApi.GetStreamAsync(user.id);
                string? thumbnailUrl = null;
                if (stream != null && !string.IsNullOrEmpty(stream.thumbnail_url))
                {
                    thumbnailUrl = stream.thumbnail_url
                        .Replace("{width}", "440")
                        .Replace("{height}", "248")
                        + $"?t={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
                }

                statuses.Add(new
                {
                    channelName,
                    displayName = user.display_name,
                    profileImage = user.profile_image_url,
                    isLive = stream != null,
                    game = stream?.game_name,
                    viewers = stream?.viewer_count ?? 0,
                    thumbnail = thumbnailUrl
                });
            }

            return Ok(new { success = true, statuses });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting alerts status for guild {GuildId}", guildId);
            return Ok(new { success = true, statuses = Array.Empty<object>() });
        }
    }

    // --- Helpers ---

    private long GetChannelOwnerId()
    {
        var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
        if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
            return sessionId;

        var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
        if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
            return channelOwnerId;

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (long.TryParse(userIdClaim, out var userId))
            return userId;
        throw new UnauthorizedAccessException("User not found");
    }
}

public class AddAlertRequest
{
    public string ChannelName { get; set; } = string.Empty;
    public string DiscordChannelId { get; set; } = string.Empty;
    public string DiscordChannelName { get; set; } = string.Empty;
    public string? CustomMessage { get; set; }
    public bool MentionEveryone { get; set; } = true;
    public string ThumbnailMode { get; set; } = "live";
    public string? StaticThumbnailUrl { get; set; }
    public string EmbedColor { get; set; } = "#ff0000";
    public string? FooterText { get; set; }
    public bool ShowButton { get; set; } = true;
    public bool ShowStartTime { get; set; } = true;
    public string SendMode { get; set; } = "wait";
    public int DelayMinutes { get; set; } = 2;
    public int UpdateIntervalMinutes { get; set; } = 10;
    public string OnOfflineAction { get; set; } = "summary";
}

public class UpdateAlertRequest
{
    public string? DiscordChannelId { get; set; }
    public string? DiscordChannelName { get; set; }
    public string? CustomMessage { get; set; }
    public bool? MentionEveryone { get; set; }
    public bool? Enabled { get; set; }
    public string? ThumbnailMode { get; set; }
    public string? StaticThumbnailUrl { get; set; }
    public string? EmbedColor { get; set; }
    public string? FooterText { get; set; }
    public bool? ShowButton { get; set; }
    public bool? ShowStartTime { get; set; }
    public string? SendMode { get; set; }
    public int? DelayMinutes { get; set; }
    public int? UpdateIntervalMinutes { get; set; }
    public string? OnOfflineAction { get; set; }
}
