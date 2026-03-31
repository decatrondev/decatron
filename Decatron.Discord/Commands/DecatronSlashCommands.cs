using System.Text.Json;
using DSharpPlus;
using DSharpPlus.Entities;
using DSharpPlus.SlashCommands;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Discord.Models;
using Decatron.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Discord.Commands;

/// <summary>
/// Autocomplete provider for the "canal" parameter.
/// Returns channels linked to the current Discord guild.
/// </summary>
public class ChannelAutocompleteProvider : IAutocompleteProvider
{
    public async Task<IEnumerable<DiscordAutoCompleteChoice>> Provider(AutocompleteContext ctx)
    {
        var serviceProvider = ctx.Services;
        using var scope = serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

        var guildId = ctx.Guild.Id.ToString();
        var configs = await db.DiscordGuildConfigs
            .Where(g => g.GuildId == guildId && g.IsActive)
            .OrderByDescending(g => g.IsDefault)
            .Select(g => g.ChannelName)
            .ToListAsync();

        var input = ctx.OptionValue?.ToString()?.ToLower() ?? "";

        return configs
            .Where(c => string.IsNullOrEmpty(input) || c.Contains(input))
            .Take(25)
            .Select(c => new DiscordAutoCompleteChoice(c, c));
    }
}

public class DecatronSlashCommands : ApplicationCommandModule
{
    private readonly TwitchApiService _twitchApi;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<DecatronSlashCommands> _logger;

    private static readonly DiscordColor DecatronColor = new("#2563eb");
    private static readonly DiscordColor LiveColor = new("#ff0000");
    private static readonly DiscordColor GreenColor = new("#22c55e");
    private static readonly DiscordColor AmberColor = new("#f59e0b");

    public DecatronSlashCommands(TwitchApiService twitchApi, IServiceProvider serviceProvider, ILogger<DecatronSlashCommands> logger)
    {
        _twitchApi = twitchApi;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    [SlashCommand("live", "Muestra si el streamer esta en vivo")]
    public async Task LiveCommand(InteractionContext ctx,
        [Option("canal", "Canal de Twitch (opcional)")][Autocomplete(typeof(ChannelAutocompleteProvider))] string? canal = null)
    {
        try
        {
            await ctx.DeferAsync();

            var channelName = await ResolveChannel(ctx.Guild.Id, canal);
            if (channelName == null) { await NoLinkResponse(ctx); return; }

            var user = await _twitchApi.GetUserByLoginAsync(channelName);
            if (user == null) { await ctx.EditResponseAsync(new DiscordWebhookBuilder().WithContent($"Canal no encontrado: {channelName}")); return; }

            var stream = await _twitchApi.GetStreamAsync(user.id);

            if (stream != null)
            {
                var startedAt = DateTime.TryParse(stream.started_at, out var dt) ? dt : DateTime.UtcNow;
                var uptime = DateTime.UtcNow - startedAt;

                var embed = new DiscordEmbedBuilder()
                    .WithTitle($"🔴 {user.display_name} esta EN VIVO!")
                    .WithDescription(stream.title ?? "Sin titulo")
                    .WithColor(LiveColor)
                    .WithThumbnail(user.profile_image_url)
                    .AddField("Juego", stream.game_name ?? "Sin categoria", true)
                    .AddField("Viewers", stream.viewer_count.ToString("N0"), true)
                    .AddField("Uptime", FormatTime(uptime), true)
                    .WithUrl($"https://twitch.tv/{channelName}")
                    .WithFooter("Decatron Bot • twitch.decatron.net")
                    .WithTimestamp(DateTimeOffset.UtcNow);

                await ctx.EditResponseAsync(new DiscordWebhookBuilder().AddEmbed(embed));
            }
            else
            {
                var embed = new DiscordEmbedBuilder()
                    .WithTitle($"⚫ {user.display_name} esta Offline")
                    .WithDescription($"No esta en vivo. Visitalo en [twitch.tv/{channelName}](https://twitch.tv/{channelName})")
                    .WithColor(DecatronColor)
                    .WithThumbnail(user.profile_image_url)
                    .WithFooter("Decatron Bot • twitch.decatron.net")
                    .WithTimestamp(DateTimeOffset.UtcNow);

                await ctx.EditResponseAsync(new DiscordWebhookBuilder().AddEmbed(embed));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en /live");
            await SafeError(ctx, "Error al consultar el estado del stream.");
        }
    }

    [SlashCommand("timer", "Muestra el estado actual del timer")]
    public async Task TimerCommand(InteractionContext ctx,
        [Option("canal", "Canal de Twitch (opcional)")][Autocomplete(typeof(ChannelAutocompleteProvider))] string? canal = null)
    {
        try
        {
            await ctx.DeferAsync();

            var channelName = await ResolveChannel(ctx.Guild.Id, canal);
            if (channelName == null) { await NoLinkResponse(ctx); return; }

            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            var timerState = await db.TimerStates.FirstOrDefaultAsync(t => t.ChannelName == channelName);

            if (timerState == null || timerState.Status == "stopped" || timerState.Status == "finished")
            {
                var embed = new DiscordEmbedBuilder()
                    .WithTitle("⏹ Timer no activo")
                    .WithDescription($"No hay un timer corriendo en el canal de {channelName}.")
                    .WithColor(DecatronColor)
                    .WithFooter("Decatron Bot • twitch.decatron.net")
                    .WithTimestamp(DateTimeOffset.UtcNow);

                await ctx.EditResponseAsync(new DiscordWebhookBuilder().AddEmbed(embed));
                return;
            }

            var statusEmoji = timerState.Status switch
            {
                "running" => "▶",
                "paused" or "stream_paused" or "auto_paused" => "⏸",
                _ => "⏱"
            };

            var statusText = timerState.Status switch
            {
                "running" => "Corriendo",
                "paused" => "Pausado",
                "stream_paused" => "Pausado (stream offline)",
                "auto_paused" => "Pausado (automatico)",
                _ => timerState.Status
            };

            var currentTime = TimeSpan.FromSeconds(timerState.CurrentTime);
            var totalTime = TimeSpan.FromSeconds(timerState.TotalTime);

            var embed2 = new DiscordEmbedBuilder()
                .WithTitle($"{statusEmoji} Timer de {channelName}")
                .WithColor(timerState.Status == "running" ? GreenColor : AmberColor)
                .AddField("Estado", statusText, true)
                .AddField("Tiempo actual", FormatTime(currentTime), true)
                .AddField("Tiempo total", FormatTime(totalTime), true)
                .WithFooter("Decatron Bot • twitch.decatron.net")
                .WithTimestamp(DateTimeOffset.UtcNow);

            if (timerState.TotalTime > 0)
            {
                var progress = Math.Min(100, (int)((double)timerState.CurrentTime / timerState.TotalTime * 100));
                embed2.AddField("Progreso", $"{ProgressBar(progress)} {progress}%", false);
            }

            await ctx.EditResponseAsync(new DiscordWebhookBuilder().AddEmbed(embed2));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en /timer");
            await SafeError(ctx, "Error al consultar el timer.");
        }
    }

    [SlashCommand("stats", "Muestra estadisticas del stream")]
    public async Task StatsCommand(InteractionContext ctx,
        [Option("canal", "Canal de Twitch (opcional)")][Autocomplete(typeof(ChannelAutocompleteProvider))] string? canal = null)
    {
        try
        {
            await ctx.DeferAsync();

            var channelName = await ResolveChannel(ctx.Guild.Id, canal);
            if (channelName == null) { await NoLinkResponse(ctx); return; }

            var user = await _twitchApi.GetUserByLoginAsync(channelName);
            if (user == null) { await ctx.EditResponseAsync(new DiscordWebhookBuilder().WithContent($"Canal no encontrado: {channelName}")); return; }

            var stream = await _twitchApi.GetStreamAsync(user.id);
            var channel = await _twitchApi.GetChannelAsync(user.id);

            var embed = new DiscordEmbedBuilder()
                .WithTitle($"Estadisticas de {user.display_name}")
                .WithColor(stream != null ? LiveColor : DecatronColor)
                .WithThumbnail(user.profile_image_url)
                .WithUrl($"https://twitch.tv/{channelName}")
                .WithFooter("Decatron Bot • twitch.decatron.net")
                .WithTimestamp(DateTimeOffset.UtcNow);

            if (stream != null)
            {
                embed.AddField("Estado", "🔴 EN VIVO", true);
                embed.AddField("Viewers", stream.viewer_count.ToString("N0"), true);

                var startedAt = DateTime.TryParse(stream.started_at, out var dt) ? dt : DateTime.UtcNow;
                var uptime = DateTime.UtcNow - startedAt;
                embed.AddField("Uptime", FormatTime(uptime), true);
                embed.AddField("Titulo", stream.title ?? "Sin titulo", false);
            }
            else
            {
                embed.AddField("Estado", "⚫ Offline", true);
            }

            if (channel != null)
            {
                embed.AddField("Juego", channel.game_name ?? "Sin categoria", true);
            }

            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var timerState = await db.TimerStates.FirstOrDefaultAsync(t => t.ChannelName == channelName);

            if (timerState != null && timerState.Status != "stopped" && timerState.Status != "finished")
            {
                var time = TimeSpan.FromSeconds(timerState.CurrentTime);
                embed.AddField("Timer", $"{FormatTime(time)} ({timerState.Status})", true);
            }

            await ctx.EditResponseAsync(new DiscordWebhookBuilder().AddEmbed(embed));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en /stats");
            await SafeError(ctx, "Error al obtener estadisticas.");
        }
    }

    [SlashCommand("followage", "Muestra desde cuando sigues un canal o info del servidor")]
    public async Task FollowageCommand(InteractionContext ctx,
        [Option("canal", "Canal de Twitch (opcional)")][Autocomplete(typeof(ChannelAutocompleteProvider))] string? canal = null,
        [Option("twitch", "Tu nombre de Twitch para ver followage")] string? twitchUser = null)
    {
        try
        {
            await ctx.DeferAsync();

            var channelName = await ResolveChannel(ctx.Guild.Id, canal);
            if (channelName == null) { await NoLinkResponse(ctx); return; }

            var streamer = await _twitchApi.GetUserByLoginAsync(channelName);
            if (streamer == null) { await ctx.EditResponseAsync(new DiscordWebhookBuilder().WithContent($"Canal no encontrado: {channelName}")); return; }

            var member = ctx.Member;
            var joinedAt = member?.JoinedAt ?? DateTimeOffset.UtcNow;
            var memberSince = DateTimeOffset.UtcNow - joinedAt;

            var embed = new DiscordEmbedBuilder()
                .WithTitle($"Followage — {streamer.display_name}")
                .WithColor(DecatronColor)
                .WithThumbnail(streamer.profile_image_url)
                .WithUrl($"https://twitch.tv/{channelName}")
                .WithFooter($"Decatron Bot • {ctx.User.Username}")
                .WithTimestamp(DateTimeOffset.UtcNow);

            // Discord server info
            embed.AddField("En el servidor de Discord", $"Desde {joinedAt:dd/MM/yyyy} ({FormatTime(memberSince)})", false);

            // Twitch followage if username provided
            if (!string.IsNullOrEmpty(twitchUser))
            {
                var cleanUser = twitchUser.ToLower().Trim();
                var followData = await GetFollowageAsync(streamer.id, cleanUser);

                if (followData != null)
                {
                    var followAge = DateTime.UtcNow - followData.FollowedAt;
                    embed.AddField($"Followage en Twitch ({followData.UserName})",
                        $"Sigue a {streamer.display_name} desde {followData.FollowedAt:dd/MM/yyyy} ({FormatTime(followAge)})", false);
                }
                else
                {
                    embed.AddField($"Twitch ({cleanUser})", $"No sigue a {streamer.display_name} o no esta en los registros", false);
                }
            }
            else
            {
                embed.AddField("Tip", "Usa `/followage twitch:tu_nombre` para ver desde cuando sigues el canal en Twitch", false);
            }

            await ctx.EditResponseAsync(new DiscordWebhookBuilder().AddEmbed(embed));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en /followage");
            await SafeError(ctx, "Error al consultar followage.");
        }
    }

    /// <summary>
    /// Checks if a user follows a broadcaster using the local DB.
    /// Returns the ChannelFollower or null.
    /// </summary>
    private async Task<ChannelFollower?> GetFollowageAsync(string broadcasterId, string userLogin)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            return await db.ChannelFollowers
                .FirstOrDefaultAsync(f => f.BroadcasterId == broadcasterId && f.UserLogin == userLogin && f.IsFollowing == 0);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error checking followage for {UserLogin} on broadcaster {BroadcasterId}", userLogin, broadcasterId);
            return null;
        }
    }

    [SlashCommand("song", "Muestra la cancion que esta sonando")]
    public async Task SongCommand(InteractionContext ctx,
        [Option("canal", "Canal de Twitch (opcional)")][Autocomplete(typeof(ChannelAutocompleteProvider))] string? canal = null)
    {
        try
        {
            await ctx.DeferAsync();

            var channelName = await ResolveChannel(ctx.Guild.Id, canal);
            if (channelName == null) { await NoLinkResponse(ctx); return; }

            using var scope = _serviceProvider.CreateScope();
            var nowPlayingService = scope.ServiceProvider.GetRequiredService<NowPlayingService>();
            var httpClientFactory = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>();
            var httpClient = httpClientFactory.CreateClient();

            var nowPlaying = await nowPlayingService.GetNowPlaying(channelName, httpClient);

            if (nowPlaying == null)
            {
                var embed = new DiscordEmbedBuilder()
                    .WithTitle("🔇 Sin musica")
                    .WithDescription($"No hay ninguna cancion sonando en {channelName}.")
                    .WithColor(DecatronColor)
                    .WithFooter("Decatron Bot • twitch.decatron.net")
                    .WithTimestamp(DateTimeOffset.UtcNow);

                await ctx.EditResponseAsync(new DiscordWebhookBuilder().AddEmbed(embed));
                return;
            }

            var json = JsonSerializer.Serialize(nowPlaying);
            var data = JsonDocument.Parse(json).RootElement;

            var trackName = data.TryGetProperty("track", out var t) ? t.GetString() : "Desconocido";
            var artistName = data.TryGetProperty("artist", out var a) ? a.GetString() : "Desconocido";
            var albumArt = data.TryGetProperty("albumArt", out var art) ? art.GetString() : null;

            var embed2 = new DiscordEmbedBuilder()
                .WithTitle("🎵 Now Playing")
                .WithDescription($"**{trackName}**\npor {artistName}")
                .WithColor(GreenColor)
                .WithFooter($"Decatron Bot • {channelName}")
                .WithTimestamp(DateTimeOffset.UtcNow);

            if (!string.IsNullOrEmpty(albumArt))
                embed2.WithThumbnail(albumArt);

            await ctx.EditResponseAsync(new DiscordWebhookBuilder().AddEmbed(embed2));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en /song");
            await SafeError(ctx, "Error al consultar la cancion actual.");
        }
    }

    // --- Helpers ---

    /// <summary>
    /// Resolves the Twitch channel name.
    /// If canal param is provided, uses it directly (public data).
    /// Otherwise uses the default linked channel for this guild.
    /// </summary>
    private async Task<string?> ResolveChannel(ulong guildId, string? requestedChannel)
    {
        // If a specific channel was requested, use it directly (public data)
        if (!string.IsNullOrEmpty(requestedChannel))
            return requestedChannel.ToLower().Trim();

        // No channel specified — use default linked to this guild
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

        var defaultConfig = await db.DiscordGuildConfigs
            .Where(g => g.GuildId == guildId.ToString() && g.IsActive)
            .OrderByDescending(g => g.IsDefault)
            .ThenBy(g => g.CreatedAt)
            .FirstOrDefaultAsync();

        return defaultConfig?.ChannelName;
    }

    private static async Task NoLinkResponse(InteractionContext ctx)
    {
        await ctx.EditResponseAsync(new DiscordWebhookBuilder()
            .WithContent("No hay un canal de Twitch vinculado a este servidor. El streamer debe vincular Discord desde twitch.decatron.net/discord"));
    }

    private static async Task SafeError(InteractionContext ctx, string message)
    {
        try { await ctx.EditResponseAsync(new DiscordWebhookBuilder().WithContent(message)); }
        catch { /* interaction expired */ }
    }

    private static string FormatTime(TimeSpan ts)
    {
        var parts = new List<string>();

        var totalDays = (int)ts.TotalDays;
        var years = totalDays / 365;
        var months = (totalDays % 365) / 30;
        var weeks = ((totalDays % 365) % 30) / 7;
        var days = ((totalDays % 365) % 30) % 7;

        if (years > 0) parts.Add($"{years} año{(years > 1 ? "s" : "")}");
        if (months > 0) parts.Add($"{months} mes{(months > 1 ? "es" : "")}");
        if (weeks > 0) parts.Add($"{weeks} sem");
        if (days > 0) parts.Add($"{days}d");
        if (ts.Hours > 0) parts.Add($"{ts.Hours}h");
        if (ts.Minutes > 0) parts.Add($"{ts.Minutes}min");
        if (parts.Count == 0) parts.Add($"{ts.Seconds}s");

        return string.Join(" ", parts);
    }

    private static string ProgressBar(int percent)
    {
        var filled = percent / 10;
        var empty = 10 - filled;
        return $"[{'█'.ToString().PadRight(filled, '█')}{'░'.ToString().PadRight(empty, '░')}]";
    }
}
