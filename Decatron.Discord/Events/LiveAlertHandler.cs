using DSharpPlus;
using DSharpPlus.Entities;
using Decatron.Data;
using Decatron.Discord.Models;
using Decatron.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Discord.Events;

public class LiveAlertHandler
{
    private readonly DiscordClientProvider _clientProvider;
    private readonly TwitchApiService _twitchApi;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<LiveAlertHandler> _logger;

    private static readonly Dictionary<string, DateTime> _recentAlerts = new();
    private static readonly TimeSpan AlertCooldown = TimeSpan.FromMinutes(5);

    public LiveAlertHandler(
        DiscordClientProvider clientProvider,
        TwitchApiService twitchApi,
        IServiceProvider serviceProvider,
        ILogger<LiveAlertHandler> logger)
    {
        _clientProvider = clientProvider;
        _twitchApi = twitchApi;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task SendLiveAlertAsync(string channelName, string broadcasterUserId)
    {
        lock (_recentAlerts)
        {
            if (_recentAlerts.TryGetValue(channelName, out var lastAlert) && DateTime.UtcNow - lastAlert < AlertCooldown)
            {
                _logger.LogDebug("Live alert cooldown active for {Channel}", channelName);
                return;
            }
            _recentAlerts[channelName] = DateTime.UtcNow;
        }

        try
        {
            var client = _clientProvider.Client;
            if (client == null || !client.Guilds.Any()) return;

            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            var alerts = await db.DiscordLiveAlerts
                .Where(a => a.ChannelName == channelName.ToLower() && a.Enabled)
                .ToListAsync();

            if (alerts.Count == 0) return;

            foreach (var alert in alerts)
            {
                _ = Task.Run(async () =>
                {
                    try
                    {
                        switch (alert.SendMode)
                        {
                            case "instant":
                                await SendAlert(alert, channelName, broadcasterUserId, useThumbnail: false);
                                break;

                            case "instant_update":
                                var sentMsg = await SendAlert(alert, channelName, broadcasterUserId, useThumbnail: false);
                                if (sentMsg != null && alert.DelayMinutes > 0)
                                {
                                    await Task.Delay(TimeSpan.FromMinutes(alert.DelayMinutes));
                                    await UpdateAlertWithThumbnail(sentMsg, alert, channelName, broadcasterUserId);
                                }
                                break;

                            case "wait":
                            default:
                                if (alert.DelayMinutes > 0)
                                    await Task.Delay(TimeSpan.FromMinutes(alert.DelayMinutes));
                                await SendAlert(alert, channelName, broadcasterUserId, useThumbnail: true);
                                break;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Error processing live alert for {Channel} in guild {Guild}", channelName, alert.GuildId);
                    }
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending live alerts for {Channel}", channelName);
        }
    }

    private async Task<DiscordMessage?> SendAlert(DiscordLiveAlert alert, string channelName, string broadcasterUserId, bool useThumbnail)
    {
        var client = _clientProvider.Client;

        if (!client.Guilds.TryGetValue(ulong.Parse(alert.GuildId), out var guild))
        {
            _logger.LogWarning("Bot not in guild {GuildId}", alert.GuildId);
            return null;
        }

        if (!guild.Channels.TryGetValue(ulong.Parse(alert.DiscordChannelId), out var discordChannel))
        {
            _logger.LogWarning("Channel {ChannelId} not found in guild {Guild}", alert.DiscordChannelId, guild.Name);
            return null;
        }

        var user = await _twitchApi.GetUserByLoginAsync(channelName);
        var stream = await _twitchApi.GetStreamAsync(broadcasterUserId);

        if (user == null)
        {
            _logger.LogWarning("Could not fetch user data for {Channel}", channelName);
            return null;
        }

        var embed = BuildEmbed(alert, user, stream, channelName, useThumbnail);

        var message = alert.CustomMessage ?? $"{user.display_name} esta en vivo!";
        var mention = alert.MentionEveryone ? "@everyone " : "";

        var msgBuilder = new DiscordMessageBuilder()
            .AddEmbed(embed)
            .WithContent($"{mention}{message}");

        if (alert.ShowButton)
        {
            msgBuilder.AddComponents(new DiscordLinkButtonComponent(
                $"https://twitch.tv/{channelName}", "Ver Stream", false,
                new DiscordComponentEmoji("📺")));
        }

        var sentMsg = await discordChannel.SendMessageAsync(msgBuilder);
        _logger.LogInformation("Live alert sent ({Mode}): {Channel} → #{DiscordChannel} in {Guild}",
            alert.SendMode, channelName, alert.DiscordChannelName, guild.Name);

        return sentMsg;
    }

    private async Task UpdateAlertWithThumbnail(DiscordMessage sentMsg, DiscordLiveAlert alert, string channelName, string broadcasterUserId)
    {
        try
        {
            var user = await _twitchApi.GetUserByLoginAsync(channelName);
            var stream = await _twitchApi.GetStreamAsync(broadcasterUserId);

            if (user == null || stream == null)
            {
                _logger.LogDebug("Stream offline before thumbnail update for {Channel}", channelName);
                return;
            }

            var embed = BuildEmbed(alert, user, stream, channelName, useThumbnail: true);

            await sentMsg.ModifyAsync(new DiscordMessageBuilder()
                .AddEmbed(embed)
                .WithContent(sentMsg.Content));

            _logger.LogInformation("Live alert updated with thumbnail: {Channel} in {Guild}", channelName, alert.GuildId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error updating alert with thumbnail for {Channel}", channelName);
        }
    }

    private DiscordEmbedBuilder BuildEmbed(DiscordLiveAlert alert, TwitchUserData user, TwitchStreamData? stream, string channelName, bool useThumbnail)
    {
        var embedColor = new DiscordColor(alert.EmbedColor ?? "#ff0000");
        var title = stream != null ? $"🔴 EN VIVO — {stream.title ?? "Sin titulo"}" : $"🔴 {user.display_name} esta EN VIVO!";

        var embed = new DiscordEmbedBuilder()
            .WithAuthor(user.display_name, $"https://twitch.tv/{channelName}", user.profile_image_url)
            .WithTitle(title)
            .WithColor(embedColor)
            .WithUrl($"https://twitch.tv/{channelName}");

        if (stream != null)
        {
            embed.AddField("Juego", stream.game_name ?? "Sin categoria", true);
            embed.AddField("Viewers", stream.viewer_count.ToString("N0"), true);

            if (alert.ShowStartTime && !string.IsNullOrEmpty(stream.started_at))
            {
                if (DateTimeOffset.TryParse(stream.started_at, out var startedAt))
                    embed.AddField("Inicio", $"<t:{startedAt.ToUnixTimeSeconds()}:R>", true);
            }
        }

        var footerText = !string.IsNullOrEmpty(alert.FooterText) ? alert.FooterText : "Decatron Bot • twitch.decatron.net";
        embed.WithFooter(footerText);
        embed.WithTimestamp(DateTimeOffset.UtcNow);

        // Thumbnail — use static CDN URL (always available when live, no delay)
        if (alert.ThumbnailMode == "live")
        {
            var liveThumb = $"https://static-cdn.jtvnw.net/previews-ttv/live_user_{channelName}-440x248.jpg?t={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
            embed.WithImageUrl(liveThumb);
        }
        else if (alert.ThumbnailMode == "static" && !string.IsNullOrEmpty(alert.StaticThumbnailUrl))
        {
            var staticUrl = alert.StaticThumbnailUrl;
            if (staticUrl.StartsWith("/")) staticUrl = $"https://twitch.decatron.net{staticUrl}";
            embed.WithImageUrl(staticUrl);
        }

        return embed;
    }
}
