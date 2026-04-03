using DSharpPlus;
using DSharpPlus.Entities;
using DSharpPlus.EventArgs;
using Decatron.Data;
using Decatron.Discord.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Discord.Events;

public class WelcomeHandler
{
    private readonly DiscordClientProvider _clientProvider;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<WelcomeHandler> _logger;

    public WelcomeHandler(DiscordClientProvider clientProvider, IServiceProvider serviceProvider, ILogger<WelcomeHandler> logger)
    {
        _clientProvider = clientProvider;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public void RegisterEvents()
    {
        var client = _clientProvider.Client;
        client.GuildMemberAdded += OnMemberJoined;
        client.GuildMemberRemoved += OnMemberLeft;
        _logger.LogInformation("Welcome/goodbye events registered");
    }

    private async Task OnMemberJoined(DiscordClient sender, GuildMemberAddEventArgs e)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            var config = await db.DiscordWelcomeConfigs
                .FirstOrDefaultAsync(c => c.GuildId == e.Guild.Id.ToString() && c.WelcomeEnabled);

            if (config == null || string.IsNullOrEmpty(config.WelcomeChannelId)) return;

            if (!e.Guild.Channels.TryGetValue(ulong.Parse(config.WelcomeChannelId), out var channel)) return;

            var message = FormatMessage(config.WelcomeMessage, e.Member, e.Guild);
            var mention = config.WelcomeMentionUser ? e.Member.Mention + " " : "";

            await SendWithFallback(channel, mention, message, config.WelcomeEmbedColor,
                e.Member, e.Guild, config.WelcomeShowAvatar, config.WelcomeImageMode, config.WelcomeImageUrl,
                config.WelcomeGeneratedImage);

            // Auto role
            if (!string.IsNullOrEmpty(config.WelcomeAutoRoleId))
            {
                try
                {
                    var role = e.Guild.GetRole(ulong.Parse(config.WelcomeAutoRoleId));
                    if (role != null)
                        await e.Member.GrantRoleAsync(role, "Decatron auto-role on join");
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error assigning auto role in {Guild}", e.Guild.Name);
                }
            }

            // DM
            if (config.WelcomeDmEnabled && !string.IsNullOrEmpty(config.WelcomeDmMessage))
            {
                try
                {
                    var dm = await e.Member.CreateDmChannelAsync();
                    var dmMsg = FormatMessage(config.WelcomeDmMessage, e.Member, e.Guild);
                    await dm.SendMessageAsync(dmMsg);
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Could not send DM to {User} (DMs may be disabled)", e.Member.Username);
                }
            }

            _logger.LogInformation("Welcome sent for {User} in {Guild}", e.Member.Username, e.Guild.Name);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling member join in {Guild}", e.Guild.Name);
        }
    }

    private async Task OnMemberLeft(DiscordClient sender, GuildMemberRemoveEventArgs e)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            var config = await db.DiscordWelcomeConfigs
                .FirstOrDefaultAsync(c => c.GuildId == e.Guild.Id.ToString() && c.GoodbyeEnabled);

            if (config == null || string.IsNullOrEmpty(config.GoodbyeChannelId)) return;

            if (!e.Guild.Channels.TryGetValue(ulong.Parse(config.GoodbyeChannelId), out var channel)) return;

            var message = FormatMessage(config.GoodbyeMessage, e.Member, e.Guild);

            await SendWithFallback(channel, "", message, config.GoodbyeEmbedColor,
                e.Member, e.Guild, config.GoodbyeShowAvatar, config.GoodbyeImageMode, config.GoodbyeImageUrl,
                config.GoodbyeGeneratedImage);

            _logger.LogInformation("Goodbye sent for {User} in {Guild}", e.Member.Username, e.Guild.Name);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling member leave in {Guild}", e.Guild.Name);
        }
    }

    public async Task SendTestWelcome(string guildId, string type)
    {
        var client = _clientProvider.Client;
        if (!client.Guilds.TryGetValue(ulong.Parse(guildId), out var guild))
            throw new Exception("Bot not in guild");

        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

        var config = await db.DiscordWelcomeConfigs.FirstOrDefaultAsync(c => c.GuildId == guildId);
        if (config == null) throw new Exception("No config found");

        var botMember = guild.CurrentMember;

        if (type == "welcome" && !string.IsNullOrEmpty(config.WelcomeChannelId))
        {
            if (!guild.Channels.TryGetValue(ulong.Parse(config.WelcomeChannelId), out var channel)) return;
            var message = FormatMessage(config.WelcomeMessage, botMember, guild);
            await SendWithFallback(channel, "**[PRUEBA]**", message, config.WelcomeEmbedColor,
                botMember, guild, config.WelcomeShowAvatar, config.WelcomeImageMode, config.WelcomeImageUrl,
                config.WelcomeGeneratedImage, "Esto es una prueba • Decatron Bot");
        }
        else if (type == "goodbye" && !string.IsNullOrEmpty(config.GoodbyeChannelId))
        {
            if (!guild.Channels.TryGetValue(ulong.Parse(config.GoodbyeChannelId), out var channel)) return;
            var message = FormatMessage(config.GoodbyeMessage, botMember, guild);
            await SendWithFallback(channel, "**[PRUEBA]**", message, config.GoodbyeEmbedColor,
                botMember, guild, config.GoodbyeShowAvatar, config.GoodbyeImageMode, config.GoodbyeImageUrl,
                config.GoodbyeGeneratedImage, "Esto es una prueba • Decatron Bot");
        }
    }

    // ============================================
    // SEND WITH FALLBACK (attachment → embed)
    // ============================================

    private async Task SendWithFallback(DiscordChannel channel, string content, string message,
        string embedColor, DiscordMember member, DiscordGuild guild,
        bool showAvatar, string imageMode, string? imageUrl,
        string? generatedImage, string? footerOverride = null)
    {
        var sent = false;

        // 1. Intentar imagen generada del canvas como attachment
        if (!string.IsNullOrEmpty(generatedImage))
        {
            try
            {
                var msgBuilder = new DiscordMessageBuilder().WithContent(content);
                var attached = await AttachGeneratedImage(msgBuilder, generatedImage);
                if (attached)
                {
                    await channel.SendMessageAsync(msgBuilder);
                    sent = true;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Generated image attachment failed in {Guild}", guild.Name);
            }
        }

        // 2. Generar imagen sobre la marcha con ImageSharp
        if (!sent)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var generator = scope.ServiceProvider.GetRequiredService<WelcomeImageGenerator>();
                var bgPath = (imageMode == "custom" && !string.IsNullOrEmpty(imageUrl)) ? imageUrl : null;
                var avatarUrl = member.AvatarUrl ?? member.DefaultAvatarUrl;
                var imgStream = await generator.GenerateImage(bgPath, avatarUrl, member.DisplayName,
                    guild.Name, message, embedColor, showAvatar);

                if (imgStream != null)
                {
                    var msgBuilder = new DiscordMessageBuilder().WithContent(content);
                    msgBuilder.AddFile("welcome.png", imgStream);
                    await channel.SendMessageAsync(msgBuilder);
                    sent = true;
                    await imgStream.DisposeAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ImageSharp generation failed in {Guild}", guild.Name);
            }
        }

        // 3. Fallback final: embed clasico
        if (!sent)
        {
            var msgBuilder = new DiscordMessageBuilder().WithContent(content);
            var embed = BuildEmbed(message, embedColor, member, guild, showAvatar, imageMode, imageUrl);
            if (!string.IsNullOrEmpty(footerOverride))
                embed.WithFooter(footerOverride);
            msgBuilder.AddEmbed(embed);
            await channel.SendMessageAsync(msgBuilder);
        }
    }

    // ============================================
    // ATTACH IMAGE AS FILE (se ve grande en Discord)
    // ============================================

    private async Task<bool> AttachGeneratedImage(DiscordMessageBuilder msgBuilder, string imageUrl)
    {
        try
        {
            // Construir ruta absoluta al archivo
            var basePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "ClientApp", "public");
            var localPath = Path.GetFullPath(Path.Combine(basePath, imageUrl.TrimStart('/')));

            // Fallback: ruta relativa desde working directory
            if (!File.Exists(localPath))
                localPath = Path.Combine("ClientApp", "public", imageUrl.TrimStart('/'));

            // Fallback: ruta absoluta directa
            if (!File.Exists(localPath))
                localPath = Path.Combine("/var/www/html/decatron/Decatron/decatron/ClientApp/public", imageUrl.TrimStart('/'));

            if (!File.Exists(localPath))
            {
                _logger.LogWarning("Generated image not found. Tried paths for: {Url}", imageUrl);
                return false;
            }

            var stream = new FileStream(localPath, FileMode.Open, FileAccess.Read);
            msgBuilder.AddFile("welcome.png", stream);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to attach generated image: {Url}", imageUrl);
            return false;
        }
    }

    // ============================================
    // HELPERS
    // ============================================

    private static string FormatMessage(string template, DiscordMember member, DiscordGuild guild)
    {
        return template
            .Replace("{user}", member.DisplayName)
            .Replace("{username}", member.Username)
            .Replace("{server}", guild.Name)
            .Replace("{memberCount}", guild.MemberCount.ToString("N0"));
    }

    private static DiscordEmbedBuilder BuildEmbed(string message, string color, DiscordMember member, DiscordGuild guild,
        bool showAvatar, string imageMode, string? imageUrl)
    {
        var embed = new DiscordEmbedBuilder()
            .WithDescription(message)
            .WithColor(new DiscordColor(color))
            .WithTimestamp(DateTimeOffset.UtcNow);

        if (showAvatar)
            embed.WithThumbnail(member.AvatarUrl ?? member.DefaultAvatarUrl);

        if (imageMode == "custom" && !string.IsNullOrEmpty(imageUrl))
        {
            var url = imageUrl;
            if (url.StartsWith("/")) url = $"https://twitch.decatron.net{url}";
            embed.WithImageUrl(url);
        }
        else if (imageMode == "avatar")
        {
            embed.WithImageUrl(member.AvatarUrl ?? member.DefaultAvatarUrl);
        }

        embed.WithFooter($"{guild.Name} • Decatron Bot");

        return embed;
    }
}
