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

    // --- STREAM ONLINE ---

    public async Task SendLiveAlertAsync(string channelName, string broadcasterUserId)
    {
        lock (_recentAlerts)
        {
            if (_recentAlerts.TryGetValue(channelName, out var lastAlert) && DateTime.UtcNow - lastAlert < AlertCooldown)
                return;
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
                                await SendAndTrack(alert, channelName, broadcasterUserId, useLiveThumbnail: true);
                                break;

                            case "instant_update":
                                await SendAndTrack(alert, channelName, broadcasterUserId, useLiveThumbnail: true);
                                if (alert.DelayMinutes > 0)
                                {
                                    await Task.Delay(TimeSpan.FromMinutes(alert.DelayMinutes));
                                    await UpdateTrackedMessage(alert, channelName, broadcasterUserId);
                                }
                                break;

                            case "wait":
                            default:
                                if (alert.DelayMinutes > 0)
                                    await Task.Delay(TimeSpan.FromMinutes(alert.DelayMinutes));
                                await SendAndTrack(alert, channelName, broadcasterUserId, useLiveThumbnail: true);
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

    private async Task SendAndTrack(DiscordLiveAlert alert, string channelName, string broadcasterUserId, bool useLiveThumbnail)
    {
        var client = _clientProvider.Client;

        if (!client.Guilds.TryGetValue(ulong.Parse(alert.GuildId), out var guild)) return;
        if (!guild.Channels.TryGetValue(ulong.Parse(alert.DiscordChannelId), out var discordChannel)) return;

        var user = await _twitchApi.GetUserByLoginAsync(channelName);
        var stream = await _twitchApi.GetStreamAsync(broadcasterUserId);
        if (user == null) return;

        var embed = BuildLiveEmbed(alert, user, stream, channelName, useLiveThumbnail);
        var msgBuilder = BuildMessage(alert, embed, channelName, user);
        var sentMsg = await discordChannel.SendMessageAsync(msgBuilder);

        _logger.LogInformation("Live alert sent ({Mode}): {Channel} → #{Discord} in {Guild}", alert.SendMode, channelName, alert.DiscordChannelName, guild.Name);

        // Save to DB for polling updates
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

        DateTime? startedAt = null;
        if (stream != null && DateTimeOffset.TryParse(stream.started_at, out var dto))
            startedAt = dto.UtcDateTime;

        db.DiscordAlertMessages.Add(new DiscordAlertMessage
        {
            AlertId = alert.Id,
            GuildId = alert.GuildId,
            ChannelId = alert.DiscordChannelId,
            MessageId = sentMsg.Id.ToString(),
            ChannelName = channelName,
            BroadcasterUserId = broadcasterUserId,
            PeakViewers = stream?.viewer_count ?? 0,
            TotalViewerSamples = stream != null ? 1 : 0,
            TotalViewersSum = stream?.viewer_count ?? 0,
            LastGame = stream?.game_name,
            StreamStartedAt = startedAt,
            IsActive = true
        });
        await db.SaveChangesAsync();
    }

    // --- POLLING UPDATE (called by background service) ---

    public async Task UpdateActiveAlerts()
    {
        try
        {
            var client = _clientProvider.Client;
            if (client == null || !client.Guilds.Any()) return;

            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            var activeMessages = await db.DiscordAlertMessages
                .Where(m => m.IsActive)
                .ToListAsync();

            if (activeMessages.Count == 0) return;

            foreach (var msg in activeMessages)
            {
                try
                {
                    var alert = await db.DiscordLiveAlerts.FindAsync(msg.AlertId);
                    if (alert == null || !alert.Enabled) continue;

                    // Check if enough time passed since last update
                    var minInterval = TimeSpan.FromMinutes(Math.Max(alert.UpdateIntervalMinutes, 10));
                    if (msg.LastUpdatedAt.HasValue && DateTime.UtcNow - msg.LastUpdatedAt.Value < minInterval)
                        continue;

                    var stream = await _twitchApi.GetStreamAsync(msg.BroadcasterUserId);

                    if (stream == null)
                    {
                        // Stream is offline — handle it
                        await HandleStreamOffline(db, msg, alert);
                        continue;
                    }

                    // Update viewer stats
                    msg.TotalViewerSamples++;
                    msg.TotalViewersSum += stream.viewer_count;
                    if (stream.viewer_count > msg.PeakViewers)
                        msg.PeakViewers = stream.viewer_count;
                    msg.LastGame = stream.game_name;
                    msg.LastUpdatedAt = DateTime.UtcNow;

                    // Edit the Discord message
                    await UpdateTrackedMessageDirect(client, msg, alert, stream);
                    await db.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error updating alert message {MsgId}", msg.MessageId);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in UpdateActiveAlerts");
        }
    }

    // --- STREAM OFFLINE ---

    public async Task HandleStreamOfflineAsync(string channelName)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            var activeMessages = await db.DiscordAlertMessages
                .Where(m => m.ChannelName == channelName.ToLower() && m.IsActive)
                .ToListAsync();

            foreach (var msg in activeMessages)
            {
                var alert = await db.DiscordLiveAlerts.FindAsync(msg.AlertId);
                if (alert != null)
                    await HandleStreamOffline(db, msg, alert);
            }

            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling stream offline for {Channel}", channelName);
        }
    }

    private async Task HandleStreamOffline(DecatronDbContext db, DiscordAlertMessage msg, DiscordLiveAlert alert)
    {
        var client = _clientProvider.Client;
        msg.IsActive = false;
        msg.LastUpdatedAt = DateTime.UtcNow;

        try
        {
            if (!client.Guilds.TryGetValue(ulong.Parse(msg.GuildId), out var guild)) return;
            if (!guild.Channels.TryGetValue(ulong.Parse(msg.ChannelId), out var discordChannel)) return;

            var discordMsg = await discordChannel.GetMessageAsync(ulong.Parse(msg.MessageId));
            if (discordMsg == null) return;

            switch (alert.OnOfflineAction)
            {
                case "delete":
                    await discordMsg.DeleteAsync();
                    _logger.LogInformation("Live alert deleted (stream offline): {Channel} in {Guild}", msg.ChannelName, guild.Name);
                    break;

                case "summary":
                    var duration = msg.StreamStartedAt.HasValue
                        ? DateTime.UtcNow - msg.StreamStartedAt.Value
                        : TimeSpan.Zero;
                    var avgViewers = msg.TotalViewerSamples > 0
                        ? (int)(msg.TotalViewersSum / msg.TotalViewerSamples)
                        : 0;

                    var user = await _twitchApi.GetUserByLoginAsync(msg.ChannelName);

                    var embed = new DiscordEmbedBuilder()
                        .WithAuthor(user?.display_name ?? msg.ChannelName, $"https://twitch.tv/{msg.ChannelName}", user?.profile_image_url)
                        .WithTitle($"⚫ Stream finalizado — {msg.ChannelName}")
                        .WithColor(new DiscordColor(alert.EmbedColor ?? "#64748b"))
                        .AddField("Duracion", FormatTime(duration), true)
                        .AddField("Viewers max", msg.PeakViewers.ToString("N0"), true)
                        .AddField("Viewers promedio", avgViewers.ToString("N0"), true);

                    if (!string.IsNullOrEmpty(msg.LastGame))
                        embed.AddField("Ultimo juego", msg.LastGame, true);

                    var footerText = !string.IsNullOrEmpty(alert.FooterText) ? alert.FooterText : "Decatron Bot • twitch.decatron.net";
                    embed.WithFooter(footerText);
                    embed.WithTimestamp(DateTimeOffset.UtcNow);

                    await discordMsg.ModifyAsync(new DiscordMessageBuilder()
                        .AddEmbed(embed)
                        .WithContent(discordMsg.Content?.Replace("@everyone ", "") ?? ""));

                    _logger.LogInformation("Live alert updated with summary (offline): {Channel} in {Guild} — Peak: {Peak}, Avg: {Avg}, Duration: {Dur}",
                        msg.ChannelName, guild.Name, msg.PeakViewers, avgViewers, FormatTime(duration));
                    break;

                case "none":
                default:
                    _logger.LogInformation("Live alert left as-is (stream offline): {Channel} in {Guild}", msg.ChannelName, guild.Name);
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error handling offline for message {MsgId}", msg.MessageId);
        }
    }

    // --- HELPERS ---

    private async Task UpdateTrackedMessage(DiscordLiveAlert alert, string channelName, string broadcasterUserId)
    {
        try
        {
            var client = _clientProvider.Client;
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            var tracked = await db.DiscordAlertMessages
                .Where(m => m.AlertId == alert.Id && m.ChannelName == channelName && m.IsActive)
                .OrderByDescending(m => m.SentAt)
                .FirstOrDefaultAsync();

            if (tracked == null) return;

            var stream = await _twitchApi.GetStreamAsync(broadcasterUserId);
            if (stream == null) return;

            tracked.TotalViewerSamples++;
            tracked.TotalViewersSum += stream.viewer_count;
            if (stream.viewer_count > tracked.PeakViewers)
                tracked.PeakViewers = stream.viewer_count;
            tracked.LastGame = stream.game_name;
            tracked.LastUpdatedAt = DateTime.UtcNow;

            await UpdateTrackedMessageDirect(client, tracked, alert, stream);
            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error updating tracked message for {Channel}", channelName);
        }
    }

    private async Task UpdateTrackedMessageDirect(DiscordClient client, DiscordAlertMessage tracked, DiscordLiveAlert alert, TwitchStreamData stream)
    {
        if (!client.Guilds.TryGetValue(ulong.Parse(tracked.GuildId), out var guild)) return;
        if (!guild.Channels.TryGetValue(ulong.Parse(tracked.ChannelId), out var channel)) return;

        var discordMsg = await channel.GetMessageAsync(ulong.Parse(tracked.MessageId));
        if (discordMsg == null) return;

        var user = await _twitchApi.GetUserByLoginAsync(tracked.ChannelName);
        if (user == null) return;

        var embed = BuildLiveEmbed(alert, user, stream, tracked.ChannelName, true);
        await discordMsg.ModifyAsync(new DiscordMessageBuilder()
            .AddEmbed(embed)
            .WithContent(discordMsg.Content ?? ""));

        _logger.LogInformation("Live alert updated: {Channel} — {Viewers} viewers", tracked.ChannelName, stream.viewer_count);
    }

    private DiscordEmbedBuilder BuildLiveEmbed(DiscordLiveAlert alert, TwitchUserData user, TwitchStreamData? stream, string channelName, bool useLiveThumbnail)
    {
        var embedColor = new DiscordColor(alert.EmbedColor ?? "#ff0000");
        var streamTitle = string.IsNullOrWhiteSpace(stream?.title) ? "Sin titulo" : stream.title;
        var title = stream != null ? $"🔴 EN VIVO — {streamTitle}" : $"🔴 {user.display_name} esta EN VIVO!";

        var embed = new DiscordEmbedBuilder()
            .WithAuthor(user.display_name, $"https://twitch.tv/{channelName}", user.profile_image_url)
            .WithTitle(title)
            .WithColor(embedColor)
            .WithUrl($"https://twitch.tv/{channelName}");

        if (stream != null)
        {
            embed.AddField("Juego", string.IsNullOrWhiteSpace(stream.game_name) ? "Sin categoria" : stream.game_name, true);
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

        if (useLiveThumbnail && alert.ThumbnailMode == "live")
        {
            embed.WithImageUrl($"https://static-cdn.jtvnw.net/previews-ttv/live_user_{channelName}-440x248.jpg?t={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}");
        }
        else if (alert.ThumbnailMode == "static" && !string.IsNullOrEmpty(alert.StaticThumbnailUrl))
        {
            var staticUrl = alert.StaticThumbnailUrl;
            if (staticUrl.StartsWith("/")) staticUrl = $"https://twitch.decatron.net{staticUrl}";
            embed.WithImageUrl(staticUrl);
        }

        return embed;
    }

    private DiscordMessageBuilder BuildMessage(DiscordLiveAlert alert, DiscordEmbedBuilder embed, string channelName, TwitchUserData user)
    {
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

        return msgBuilder;
    }

    private static string FormatTime(TimeSpan ts)
    {
        var parts = new List<string>();
        if ((int)ts.TotalDays > 0) parts.Add($"{(int)ts.TotalDays}d");
        if (ts.Hours > 0) parts.Add($"{ts.Hours}h");
        if (ts.Minutes > 0) parts.Add($"{ts.Minutes}min");
        if (parts.Count == 0) parts.Add($"{ts.Seconds}s");
        return string.Join(" ", parts);
    }
}
