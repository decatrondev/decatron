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
[Route("api/discord/welcome")]
[Authorize]
[RequirePermission("settings", "control_total")]
public class DiscordWelcomeController : ControllerBase
{
    private readonly DecatronDbContext _dbContext;
    private readonly ILogger<DiscordWelcomeController> _logger;

    public DiscordWelcomeController(DecatronDbContext dbContext, ILogger<DiscordWelcomeController> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    [HttpGet("{guildId}")]
    public async Task<IActionResult> GetConfig(string guildId)
    {
        var config = await _dbContext.DiscordWelcomeConfigs
            .FirstOrDefaultAsync(c => c.GuildId == guildId);

        if (config == null)
            return Ok(new { success = true, config = (object?)null });

        // Devolver explícitamente todos los campos (WhenWritingNull omite nulls)
        return Ok(new
        {
            success = true,
            config = new
            {
                config.Id,
                config.GuildConfigId,
                config.GuildId,
                config.WelcomeEnabled,
                config.WelcomeChannelId,
                config.WelcomeMessage,
                config.WelcomeEmbedColor,
                config.WelcomeImageMode,
                config.WelcomeImageUrl,
                config.WelcomeShowAvatar,
                config.WelcomeAutoRoleId,
                config.WelcomeDmEnabled,
                config.WelcomeDmMessage,
                config.WelcomeMentionUser,
                config.GoodbyeEnabled,
                config.GoodbyeChannelId,
                config.GoodbyeMessage,
                config.GoodbyeEmbedColor,
                config.GoodbyeImageMode,
                config.GoodbyeImageUrl,
                config.GoodbyeShowAvatar,
                config.EditorLayout,
                welcomeGeneratedImage = config.WelcomeGeneratedImage ?? "",
                goodbyeGeneratedImage = config.GoodbyeGeneratedImage ?? "",
                config.CreatedAt,
                config.UpdatedAt,
            }
        });
    }

    [HttpPut("{guildId}")]
    public async Task<IActionResult> SaveConfig(string guildId, [FromBody] DiscordWelcomeConfig request)
    {
        var channelOwnerId = GetChannelOwnerId();
        var owner = await _dbContext.Users.FindAsync(channelOwnerId);
        if (owner == null) return Unauthorized(new { success = false });

        var guildConfig = await _dbContext.DiscordGuildConfigs
            .FirstOrDefaultAsync(g => g.GuildId == guildId && g.ChannelName == owner.Login.ToLower() && g.IsActive);
        if (guildConfig == null) return NotFound(new { success = false, error = "Servidor no vinculado" });

        var existing = await _dbContext.DiscordWelcomeConfigs
            .FirstOrDefaultAsync(c => c.GuildId == guildId);

        if (existing != null)
        {
            existing.WelcomeEnabled = request.WelcomeEnabled;
            existing.WelcomeChannelId = request.WelcomeChannelId;
            existing.WelcomeMessage = request.WelcomeMessage;
            existing.WelcomeEmbedColor = request.WelcomeEmbedColor;
            existing.WelcomeImageMode = request.WelcomeImageMode;
            existing.WelcomeImageUrl = request.WelcomeImageUrl;
            existing.WelcomeShowAvatar = request.WelcomeShowAvatar;
            existing.WelcomeAutoRoleId = request.WelcomeAutoRoleId;
            existing.WelcomeDmEnabled = request.WelcomeDmEnabled;
            existing.WelcomeDmMessage = request.WelcomeDmMessage;
            existing.WelcomeMentionUser = request.WelcomeMentionUser;
            existing.GoodbyeEnabled = request.GoodbyeEnabled;
            existing.GoodbyeChannelId = request.GoodbyeChannelId;
            existing.GoodbyeMessage = request.GoodbyeMessage;
            existing.GoodbyeEmbedColor = request.GoodbyeEmbedColor;
            existing.GoodbyeImageMode = request.GoodbyeImageMode;
            existing.GoodbyeImageUrl = request.GoodbyeImageUrl;
            existing.GoodbyeShowAvatar = request.GoodbyeShowAvatar;
            existing.EditorLayout = request.EditorLayout;
            existing.WelcomeGeneratedImage = request.WelcomeGeneratedImage;
            existing.GoodbyeGeneratedImage = request.GoodbyeGeneratedImage;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            request.GuildConfigId = guildConfig.Id;
            request.GuildId = guildId;
            request.CreatedAt = DateTime.UtcNow;
            request.UpdatedAt = DateTime.UtcNow;
            _dbContext.DiscordWelcomeConfigs.Add(request);
        }

        await _dbContext.SaveChangesAsync();
        _logger.LogInformation("Welcome config saved for guild {GuildId}", guildId);
        return Ok(new { success = true });
    }

    /// <summary>
    /// Gets available roles from the Discord guild (via bot).
    /// </summary>
    [HttpGet("{guildId}/roles")]
    public async Task<IActionResult> GetRoles(string guildId)
    {
        try
        {
            var clientProvider = HttpContext.RequestServices.GetRequiredService<DiscordClientProvider>();
            var client = clientProvider.Client;

            if (!client.Guilds.TryGetValue(ulong.Parse(guildId), out var guild))
                return Ok(new { success = false, error = "Bot no esta en este servidor" });

            var roles = guild.Roles.Values
                .Where(r => !r.IsManaged && r.Name != "@everyone")
                .OrderByDescending(r => r.Position)
                .Select(r => new { id = r.Id.ToString(), name = r.Name, color = r.Color.ToString() })
                .ToList();

            return Ok(new { success = true, roles });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching roles for {GuildId}", guildId);
            return Ok(new { success = false, error = "Error al obtener roles" });
        }
    }

    /// <summary>
    /// Sends a test welcome message.
    /// </summary>
    [HttpPost("{guildId}/test")]
    public async Task<IActionResult> TestWelcome(string guildId, [FromBody] TestWelcomeRequest request)
    {
        try
        {
            _logger.LogInformation("[TEST] Starting test welcome for guild {GuildId}, type: {Type}", guildId, request.Type);
            var welcomeHandler = HttpContext.RequestServices.GetRequiredService<Events.WelcomeHandler>();
            await welcomeHandler.SendTestWelcome(guildId, request.Type);
            _logger.LogInformation("[TEST] Test welcome sent successfully for guild {GuildId}", guildId);
            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TEST] Error sending test welcome for {GuildId}: {Message} | Inner: {Inner}", guildId, ex.Message, ex.InnerException?.Message);
            return Ok(new { success = false, error = $"{ex.Message}" });
        }
    }

    /// <summary>
    /// Upload generated welcome/goodbye image from canvas.
    /// </summary>
    [HttpPost("{guildId}/upload-image")]
    [RequestSizeLimit(10485760)] // 10MB
    public async Task<IActionResult> UploadGeneratedImage(string guildId, [FromForm] IFormFile file, [FromForm] string type)
    {
        try
        {
            if (file == null || file.Length == 0)
                return Ok(new { success = false, error = "No file provided" });

            if (file.Length > 10 * 1024 * 1024)
                return Ok(new { success = false, error = "File too large (max 10MB)" });

            var channelOwnerId = GetChannelOwnerId();
            var owner = await _dbContext.Users.FindAsync(channelOwnerId);
            if (owner == null) return Unauthorized(new { success = false });

            // Save to disk
            var uploadDir = Path.Combine("ClientApp", "public", "timerextensible", owner.Login.ToLower(), "welcome");
            Directory.CreateDirectory(uploadDir);

            var fileName = $"{type}_{guildId}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}.png";
            var filePath = Path.Combine(uploadDir, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var fileUrl = $"/timerextensible/{owner.Login.ToLower()}/welcome/{fileName}";
            return Ok(new { success = true, fileUrl });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading welcome image for {GuildId}", guildId);
            return Ok(new { success = false, error = "Error al subir imagen" });
        }
    }

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

public class TestWelcomeRequest
{
    public string Type { get; set; } = "welcome";
}
