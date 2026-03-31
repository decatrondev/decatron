using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text.Json;
using Decatron.Attributes;
using Decatron.Data;
using Decatron.Discord.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Discord;

[ApiController]
[Route("api/discord")]
public class DiscordOAuthController : ControllerBase
{
    private readonly DiscordSettings _settings;
    private readonly DecatronDbContext _dbContext;
    private readonly ILogger<DiscordOAuthController> _logger;
    private readonly IHttpClientFactory _httpClientFactory;

    private const string DiscordApiBase = "https://discord.com/api/v10";

    public DiscordOAuthController(
        IOptions<DiscordSettings> settings,
        DecatronDbContext dbContext,
        ILogger<DiscordOAuthController> logger,
        IHttpClientFactory httpClientFactory)
    {
        _settings = settings.Value;
        _dbContext = dbContext;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
    }

    /// <summary>
    /// Returns the Discord OAuth URL for the frontend to redirect to.
    /// </summary>
    [HttpGet("auth")]
    [Authorize]
    [RequirePermission("settings", "control_total")]
    public async Task<IActionResult> GetAuthUrl()
    {
        var state = Guid.NewGuid().ToString("N");
        HttpContext.Session.SetString("discord_oauth_state", state);

        // Save channel owner info in session for the callback
        var channelOwnerId = GetChannelOwnerId();
        var owner = await _dbContext.Users.FindAsync(channelOwnerId);
        if (owner != null)
        {
            HttpContext.Session.SetString("discord_channel_name", owner.Login.ToLower());
            HttpContext.Session.SetString("discord_twitch_user_id", owner.TwitchId);
        }

        var url = $"https://discord.com/api/oauth2/authorize" +
                  $"?client_id={_settings.AppId}" +
                  $"&redirect_uri={Uri.EscapeDataString(_settings.RedirectUri)}" +
                  $"&response_type=code" +
                  $"&scope=identify%20guilds%20bot%20applications.commands" +
                  $"&permissions=2147732544" +
                  $"&state={state}";

        return Ok(new { success = true, url });
    }

    /// <summary>
    /// Discord OAuth callback — exchanges code for token, fetches guilds.
    /// </summary>
    [HttpGet("callback")]
    public async Task<IActionResult> Callback([FromQuery] string code, [FromQuery] string state)
    {
        var client = _httpClientFactory.CreateClient();
        var tokenResponse = await client.PostAsync($"{DiscordApiBase}/oauth2/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = _settings.AppId,
            ["client_secret"] = _settings.ClientSecret,
            ["grant_type"] = "authorization_code",
            ["code"] = code,
            ["redirect_uri"] = _settings.RedirectUri
        }));

        if (!tokenResponse.IsSuccessStatusCode)
        {
            _logger.LogError("Discord OAuth token exchange failed: {Status}", tokenResponse.StatusCode);
            return Redirect("/discord?discord=error");
        }

        var tokenJson = await tokenResponse.Content.ReadAsStringAsync();
        var tokenData = JsonSerializer.Deserialize<JsonElement>(tokenJson);
        var accessToken = tokenData.GetProperty("access_token").GetString();

        HttpContext.Session.SetString("discord_access_token", accessToken!);

        // Auto-link: Discord returns the guild object when bot scope is used
        var channelName = HttpContext.Session.GetString("discord_channel_name");
        var twitchUserId = HttpContext.Session.GetString("discord_twitch_user_id");

        if (tokenData.TryGetProperty("guild", out var guildData) &&
            !string.IsNullOrEmpty(channelName) && !string.IsNullOrEmpty(twitchUserId))
        {
            var guildId = guildData.GetProperty("id").GetString()!;
            var guildName = guildData.GetProperty("name").GetString() ?? "";
            var guildIcon = guildData.TryGetProperty("icon", out var ic) && ic.ValueKind != JsonValueKind.Null
                ? $"https://cdn.discordapp.com/icons/{guildId}/{ic.GetString()}.png"
                : null;

            // Check if already linked
            var existing = await _dbContext.DiscordGuildConfigs
                .FirstOrDefaultAsync(g => g.GuildId == guildId && g.ChannelName == channelName);

            if (existing != null)
            {
                existing.GuildName = guildName;
                existing.GuildIcon = guildIcon;
                existing.IsActive = true;
                existing.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                // Check if this is the first link for this guild (make it default)
                var hasOtherLinks = await _dbContext.DiscordGuildConfigs
                    .AnyAsync(g => g.GuildId == guildId && g.IsActive);

                _dbContext.DiscordGuildConfigs.Add(new DiscordGuildConfig
                {
                    GuildId = guildId,
                    GuildName = guildName,
                    GuildIcon = guildIcon,
                    ChannelName = channelName,
                    TwitchUserId = twitchUserId,
                    IsDefault = !hasOtherLinks,
                    IsActive = true
                });
            }

            await _dbContext.SaveChangesAsync();
            _logger.LogInformation("Auto-linked Discord guild {Guild} to channel {Channel}", guildName, channelName);

            return Redirect("/discord?discord=linked");
        }

        // No guild in response — fallback to manual selection
        return Redirect("/discord?discord=select");
    }

    /// <summary>
    /// Returns the user's Discord guilds where they are admin/owner.
    /// </summary>
    [HttpGet("guilds")]
    [Authorize]
    [RequirePermission("settings", "control_total")]
    public async Task<IActionResult> GetGuilds()
    {
        var discordToken = HttpContext.Session.GetString("discord_access_token");
        if (string.IsNullOrEmpty(discordToken))
        {
            return Ok(new { success = false, error = "No Discord session. Please authenticate first." });
        }

        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", discordToken);

        var guildsResponse = await client.GetAsync($"{DiscordApiBase}/users/@me/guilds");
        if (!guildsResponse.IsSuccessStatusCode)
        {
            return Ok(new { success = false, error = "Failed to fetch guilds" });
        }

        var guildsJson = await guildsResponse.Content.ReadAsStringAsync();
        var allGuilds = JsonSerializer.Deserialize<List<DiscordGuildDto>>(guildsJson) ?? new();

        var adminGuilds = allGuilds
            .Where(g => g.owner || (g.permissions != null && (long.Parse(g.permissions) & 0x8) != 0))
            .Select(g => new
            {
                g.id,
                g.name,
                icon = g.icon != null ? $"https://cdn.discordapp.com/icons/{g.id}/{g.icon}.png" : null
            })
            .ToList();

        return Ok(new { success = true, guilds = adminGuilds });
    }

    /// <summary>
    /// Links a Discord guild to the channel owner's Twitch channel.
    /// </summary>
    [HttpPost("link")]
    [Authorize]
    [RequirePermission("settings", "control_total")]
    public async Task<IActionResult> LinkGuild([FromBody] LinkGuildRequest request)
    {
        var channelOwnerId = GetChannelOwnerId();
        var owner = await _dbContext.Users.FindAsync(channelOwnerId);
        if (owner == null)
            return Unauthorized(new { success = false, error = "Channel owner not found" });

        var existing = await _dbContext.DiscordGuildConfigs
            .FirstOrDefaultAsync(g => g.GuildId == request.GuildId && g.ChannelName == owner.Login.ToLower());

        if (existing != null)
        {
            existing.GuildName = request.GuildName;
            existing.GuildIcon = request.GuildIcon;
            existing.IsActive = true;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            _dbContext.DiscordGuildConfigs.Add(new DiscordGuildConfig
            {
                GuildId = request.GuildId,
                GuildName = request.GuildName,
                GuildIcon = request.GuildIcon,
                ChannelName = owner.Login.ToLower(),
                TwitchUserId = owner.TwitchId,
                IsActive = true
            });
        }

        await _dbContext.SaveChangesAsync();
        _logger.LogInformation("Discord guild {Guild} linked to channel {Channel}", request.GuildName, owner.Login);

        return Ok(new { success = true });
    }

    /// <summary>
    /// Gets the linked Discord guilds for the channel owner.
    /// </summary>
    [HttpGet("linked")]
    [Authorize]
    [RequirePermission("settings", "control_total")]
    public async Task<IActionResult> GetLinkedGuilds()
    {
        var channelOwnerId = GetChannelOwnerId();
        var owner = await _dbContext.Users.FindAsync(channelOwnerId);
        if (owner == null)
            return Unauthorized(new { success = false });

        var guilds = await _dbContext.DiscordGuildConfigs
            .Where(g => g.ChannelName == owner.Login.ToLower() && g.IsActive)
            .Select(g => new
            {
                g.Id,
                g.GuildId,
                g.GuildName,
                g.GuildIcon,
                g.LiveAlertsEnabled,
                g.LiveAlertChannelId,
                g.CreatedAt
            })
            .ToListAsync();

        return Ok(new { success = true, guilds });
    }

    /// <summary>
    /// Unlinks a Discord guild from the channel owner's channel.
    /// </summary>
    [HttpDelete("unlink/{guildId}")]
    [Authorize]
    [RequirePermission("settings", "control_total")]
    public async Task<IActionResult> UnlinkGuild(string guildId)
    {
        var channelOwnerId = GetChannelOwnerId();
        var owner = await _dbContext.Users.FindAsync(channelOwnerId);
        if (owner == null)
            return Unauthorized(new { success = false });

        var config = await _dbContext.DiscordGuildConfigs
            .FirstOrDefaultAsync(g => g.GuildId == guildId && g.ChannelName == owner.Login.ToLower());

        if (config != null)
        {
            config.IsActive = false;
            config.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();
        }

        return Ok(new { success = true });
    }

    /// <summary>
    /// Gets text channels from a linked Discord guild (via bot).
    /// </summary>
    [HttpGet("channels/{guildId}")]
    [Authorize]
    [RequirePermission("settings", "control_total")]
    public async Task<IActionResult> GetGuildChannels(string guildId)
    {
        try
        {
            var clientProvider = HttpContext.RequestServices.GetRequiredService<DiscordClientProvider>();
            var client = clientProvider.Client;

            if (!client.Guilds.TryGetValue(ulong.Parse(guildId), out var guild))
            {
                return Ok(new { success = false, error = "Bot no esta en este servidor" });
            }

            var textChannels = guild.Channels.Values
                .Where(c => c.Type == DSharpPlus.ChannelType.Text)
                .OrderBy(c => c.Position)
                .Select(c => new { id = c.Id.ToString(), name = c.Name })
                .ToList();

            return Ok(new { success = true, channels = textChannels });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching guild channels for {GuildId}", guildId);
            return Ok(new { success = false, error = "Error al obtener canales" });
        }
    }

    /// <summary>
    /// Updates alert configuration for a linked guild.
    /// </summary>
    [HttpPut("config/{guildId}")]
    [Authorize]
    [RequirePermission("settings", "control_total")]
    public async Task<IActionResult> UpdateGuildConfig(string guildId, [FromBody] UpdateGuildConfigRequest request)
    {
        var channelOwnerId = GetChannelOwnerId();
        var owner = await _dbContext.Users.FindAsync(channelOwnerId);
        if (owner == null)
            return Unauthorized(new { success = false });

        var config = await _dbContext.DiscordGuildConfigs
            .FirstOrDefaultAsync(g => g.GuildId == guildId && g.ChannelName == owner.Login.ToLower() && g.IsActive);

        if (config == null)
            return NotFound(new { success = false, error = "Servidor no vinculado" });

        config.LiveAlertsEnabled = request.LiveAlertsEnabled;
        config.LiveAlertChannelId = request.LiveAlertChannelId;
        config.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        _logger.LogInformation("Discord config updated for guild {Guild}: alerts={Enabled}, channel={Channel}",
            config.GuildName, request.LiveAlertsEnabled, request.LiveAlertChannelId);

        return Ok(new { success = true });
    }

    /// <summary>
    /// Gets bot connection status and linked guild count for the channel owner.
    /// </summary>
    [HttpGet("status")]
    [Authorize]
    public async Task<IActionResult> GetBotStatus()
    {
        try
        {
            var clientProvider = HttpContext.RequestServices.GetRequiredService<DiscordClientProvider>();
            var client = clientProvider.Client;
            var botConnected = client.Guilds.Count > 0;

            // Count linked guilds for this channel owner
            var channelOwnerId = GetChannelOwnerId();
            var owner = await _dbContext.Users.FindAsync(channelOwnerId);
            var linkedCount = 0;
            if (owner != null)
            {
                linkedCount = await _dbContext.DiscordGuildConfigs
                    .CountAsync(g => g.ChannelName == owner.Login.ToLower() && g.IsActive);
            }

            return Ok(new
            {
                success = true,
                connected = botConnected,
                linkedCount,
                botUser = client.CurrentUser?.Username ?? "Decatron"
            });
        }
        catch
        {
            return Ok(new { success = true, connected = false, linkedCount = 0, botUser = "Decatron" });
        }
    }

    // --- Helpers ---

    private long GetChannelOwnerId()
    {
        // Priority 1: Active channel from session (after channel switch)
        var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
        if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
            return sessionId;

        // Priority 2: ChannelOwnerId from JWT claim
        var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
        if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
            return channelOwnerId;

        // Priority 3: User's own channel
        return GetUserId();
    }

    private long GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (long.TryParse(userIdClaim, out var userId))
            return userId;
        throw new UnauthorizedAccessException("User not found");
    }
}

public class LinkGuildRequest
{
    public string GuildId { get; set; } = string.Empty;
    public string GuildName { get; set; } = string.Empty;
    public string? GuildIcon { get; set; }
}

public class UpdateGuildConfigRequest
{
    public bool LiveAlertsEnabled { get; set; }
    public string? LiveAlertChannelId { get; set; }
}

public class DiscordGuildDto
{
    public string id { get; set; } = string.Empty;
    public string name { get; set; } = string.Empty;
    public string? icon { get; set; }
    public bool owner { get; set; }
    public string? permissions { get; set; }
}
