using DSharpPlus;
using DSharpPlus.Entities;
using DSharpPlus.EventArgs;
using Decatron.Discord.Services;
using Microsoft.Extensions.Logging;

namespace Decatron.Discord.Events;

public class MessageXpHandler
{
    private readonly DiscordClientProvider _clientProvider;
    private readonly XpService _xpService;
    private readonly XpRoleService _xpRoleService;
    private readonly RankCardGenerator _rankCardGenerator;
    private readonly ILogger<MessageXpHandler> _logger;

    public MessageXpHandler(
        DiscordClientProvider clientProvider,
        XpService xpService,
        XpRoleService xpRoleService,
        RankCardGenerator rankCardGenerator,
        ILogger<MessageXpHandler> logger)
    {
        _clientProvider = clientProvider;
        _xpService = xpService;
        _xpRoleService = xpRoleService;
        _rankCardGenerator = rankCardGenerator;
        _logger = logger;
    }

    public void RegisterEvents()
    {
        var client = _clientProvider.Client;
        client.MessageCreated += OnMessageCreated;
        _logger.LogInformation("Message XP handler registered");
    }

    private async Task OnMessageCreated(DiscordClient sender, MessageCreateEventArgs e)
    {
        try
        {
            // Ignore bots and DMs
            if (e.Author == null || e.Author.IsBot) return;
            if (e.Guild == null) return;

            var guildId = e.Guild.Id.ToString();
            var userId = e.Author.Id.ToString();
            var content = e.Message.Content ?? "";

            // Load config to check filters
            var config = await _xpService.GetOrCreateConfigAsync(guildId);
            if (!config.Enabled) return;

            // Min message length
            if (content.Length < config.MinMessageLength) return;

            // Excluded channels
            if (_xpService.IsChannelExcluded(config, e.Channel.Id.ToString())) return;

            // Award XP
            var result = await _xpService.AwardMessageXpAsync(
                guildId, userId, e.Author.Username, e.Author.GetAvatarUrl(ImageFormat.Png, 256));

            if (result == null) return;

            var (userXp, leveledUp, xpAwarded, newAchievements) = result.Value;

            // Send level-up notification + assign roles
            if (leveledUp)
            {
                try
                {
                    var member = await e.Guild.GetMemberAsync(e.Author.Id);
                    await _xpRoleService.AssignRolesForLevelAsync(e.Guild, member, userXp.Level);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error assigning XP roles for {User}", e.Author.Username);
                }

                await SendLevelUpNotification(e, userXp, config, guildId);
            }

            // Send achievement notifications
            if (newAchievements.Count > 0)
            {
                await SendAchievementNotification(e, newAchievements, config);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in MessageXpHandler for {User}", e.Author?.Username);
        }
    }

    private async Task SendLevelUpNotification(MessageCreateEventArgs e, Models.UserXp userXp, Models.XpConfig config, string guildId)
    {
        try
        {
            // Determine target channel
            DiscordChannel? targetChannel = null;

            if (!string.IsNullOrEmpty(config.LevelupChannelId) && ulong.TryParse(config.LevelupChannelId, out var channelId))
            {
                try { targetChannel = e.Guild.GetChannel(channelId); } catch { }
            }
            targetChannel ??= e.Channel;

            // Get rank info
            var rank = await _xpService.GetUserRankAsync(guildId, userXp.UserId);
            var totalUsers = await _xpService.GetTotalUsersAsync(guildId);
            var difficulty = 1.0; // TODO: pull from config
            var requiredXp = XpService.CalculateRequiredXp(userXp.Level + 1, difficulty);

            // Generate rank card
            var cardStream = await _rankCardGenerator.GenerateAsync(
                username: userXp.Username,
                avatarUrl: userXp.AvatarUrl,
                level: userXp.Level,
                currentXp: userXp.Xp,
                requiredXp: requiredXp,
                rank: rank,
                totalUsers: totalUsers,
                tier: null);

            if (cardStream != null)
            {
                var builder = new DiscordMessageBuilder()
                    .WithContent($"🎉 **{e.Author.Mention} subio a nivel {userXp.Level}!**")
                    .AddFile("rank-card.png", cardStream);

                await targetChannel.SendMessageAsync(builder);
                cardStream.Dispose();
            }
            else
            {
                // Fallback: simple embed
                var embed = new DiscordEmbedBuilder()
                    .WithTitle($"⬆️ Level Up!")
                    .WithDescription($"{e.Author.Mention} subio a **nivel {userXp.Level}**!")
                    .WithColor(new DiscordColor("#f59e0b"))
                    .WithThumbnail(e.Author.GetAvatarUrl(ImageFormat.Png, 128))
                    .WithFooter("Decatron Bot • twitch.decatron.net")
                    .WithTimestamp(DateTimeOffset.UtcNow);

                await targetChannel.SendMessageAsync(embed);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error sending level-up notification for {User}", userXp.Username);
        }
    }

    private async Task SendAchievementNotification(MessageCreateEventArgs e, List<Models.XpAchievement> achievements, Models.XpConfig config)
    {
        try
        {
            // Determine target channel: achievement channel > level-up channel > current channel
            DiscordChannel? targetChannel = null;

            if (!string.IsNullOrEmpty(config.AchievementChannelId) && ulong.TryParse(config.AchievementChannelId, out var achChId))
            {
                try { targetChannel = e.Guild.GetChannel(achChId); } catch { }
            }
            if (targetChannel == null && !string.IsNullOrEmpty(config.LevelupChannelId) && ulong.TryParse(config.LevelupChannelId, out var lvlChId))
            {
                try { targetChannel = e.Guild.GetChannel(lvlChId); } catch { }
            }
            targetChannel ??= e.Channel;

            foreach (var achievement in achievements)
            {
                var embed = new DiscordEmbedBuilder()
                    .WithTitle($"{achievement.Icon} Achievement Desbloqueado!")
                    .WithDescription($"**{e.Author.Username}** ({e.Author.Mention}) desbloqueo **{achievement.Name}**!\n_{achievement.Description}_")
                    .WithColor(new DiscordColor("#f59e0b"))
                    .WithThumbnail(e.Author.GetAvatarUrl(ImageFormat.Png, 128))
                    .WithFooter("Decatron Bot • twitch.decatron.net")
                    .WithTimestamp(DateTimeOffset.UtcNow);

                await targetChannel.SendMessageAsync(embed);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error sending achievement notification for {User}", e.Author.Username);
        }
    }
}
