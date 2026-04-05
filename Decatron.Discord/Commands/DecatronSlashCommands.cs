using System.Text.Json;
using DSharpPlus;
using DSharpPlus.Entities;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Discord.Models;
using Decatron.Discord.Services;
using Decatron.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Discord.Commands;

/// <summary>
/// Handles all Decatron slash commands.
/// Methods return DiscordEmbedBuilder (or null with content set on webhook).
/// Called from DiscordBotService's raw interaction handler.
/// </summary>
public class DecatronSlashCommands
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

    public async Task<DiscordEmbedBuilder?> HandleLive(DiscordInteraction interaction, string? canal)
    {
        var channelName = await ResolveChannel(interaction.Guild.Id, canal);
        if (channelName == null) return NoLinkEmbed();

        var user = await _twitchApi.GetUserByLoginAsync(channelName);
        if (user == null) return ErrorEmbed($"Canal no encontrado: {channelName}");

        var stream = await _twitchApi.GetStreamAsync(user.id);

        if (stream != null)
        {
            var startedAt = DateTime.TryParse(stream.started_at, out var dt) ? dt : DateTime.UtcNow;
            var uptime = DateTime.UtcNow - startedAt;

            return new DiscordEmbedBuilder()
                .WithTitle($"🔴 {user.display_name} esta EN VIVO!")
                .WithDescription(Safe(stream.title, "Sin titulo"))
                .WithColor(LiveColor)
                .WithThumbnail(user.profile_image_url)
                .AddField("Juego", Safe(stream.game_name, "Sin categoria"), true)
                .AddField("Viewers", stream.viewer_count.ToString("N0"), true)
                .AddField("Uptime", FormatTime(uptime), true)
                .WithUrl($"https://twitch.tv/{channelName}")
                .WithFooter("Decatron Bot • twitch.decatron.net")
                .WithTimestamp(DateTimeOffset.UtcNow);
        }

        return new DiscordEmbedBuilder()
            .WithTitle($"⚫ {user.display_name} esta Offline")
            .WithDescription($"No esta en vivo. Visitalo en [twitch.tv/{channelName}](https://twitch.tv/{channelName})")
            .WithColor(DecatronColor)
            .WithThumbnail(user.profile_image_url)
            .WithFooter("Decatron Bot • twitch.decatron.net")
            .WithTimestamp(DateTimeOffset.UtcNow);
    }

    public async Task<DiscordEmbedBuilder?> HandleTimer(DiscordInteraction interaction, string? canal)
    {
        var channelName = await ResolveChannel(interaction.Guild.Id, canal);
        if (channelName == null) return NoLinkEmbed();

        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
        var timerState = await db.TimerStates.FirstOrDefaultAsync(t => t.ChannelName == channelName);

        if (timerState == null || timerState.Status == "stopped" || timerState.Status == "finished")
        {
            return new DiscordEmbedBuilder()
                .WithTitle("⏹ Timer no activo")
                .WithDescription($"No hay un timer corriendo en {channelName}.")
                .WithColor(DecatronColor)
                .WithFooter("Decatron Bot • twitch.decatron.net")
                .WithTimestamp(DateTimeOffset.UtcNow);
        }

        var statusEmoji = timerState.Status switch { "running" => "▶", _ => "⏸" };
        var statusText = timerState.Status switch
        {
            "running" => "Corriendo", "paused" => "Pausado",
            "stream_paused" => "Pausado (stream offline)", "auto_paused" => "Pausado (automatico)", _ => timerState.Status
        };

        var currentTime = TimeSpan.FromSeconds(timerState.CurrentTime);
        var totalTime = TimeSpan.FromSeconds(timerState.TotalTime);

        var embed = new DiscordEmbedBuilder()
            .WithTitle($"{statusEmoji} Timer de {channelName}")
            .WithColor(timerState.Status == "running" ? GreenColor : AmberColor)
            .AddField("Estado", statusText, true)
            .AddField("Tiempo actual", FormatTime(currentTime), true)
            .AddField("Tiempo total", FormatTime(totalTime), true)
            .WithFooter("Decatron Bot • twitch.decatron.net")
            .WithTimestamp(DateTimeOffset.UtcNow);

        if (timerState.TotalTime > 0)
        {
            var elapsed = timerState.TotalTime - timerState.CurrentTime;
            var progress = Math.Min(100, Math.Max(0, (int)((double)elapsed / timerState.TotalTime * 100)));
            embed.AddField("Progreso", $"{ProgressBar(progress)} {progress}%", false);
        }

        return embed;
    }

    public async Task<DiscordEmbedBuilder?> HandleStats(DiscordInteraction interaction, string? canal)
    {
        var channelName = await ResolveChannel(interaction.Guild.Id, canal);
        if (channelName == null) return NoLinkEmbed();

        var user = await _twitchApi.GetUserByLoginAsync(channelName);
        if (user == null) return ErrorEmbed($"Canal no encontrado: {channelName}");

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
            embed.AddField("Uptime", FormatTime(DateTime.UtcNow - startedAt), true);
            embed.AddField("Titulo", Safe(stream.title, "Sin titulo"), false);
        }
        else
        {
            embed.AddField("Estado", "⚫ Offline", true);
        }

        if (channel != null)
            embed.AddField("Juego", Safe(channel.game_name, "Sin categoria"), true);

        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
        var timerState = await db.TimerStates.FirstOrDefaultAsync(t => t.ChannelName == channelName);
        if (timerState != null && timerState.Status != "stopped" && timerState.Status != "finished")
            embed.AddField("Timer", $"{FormatTime(TimeSpan.FromSeconds(timerState.CurrentTime))} ({timerState.Status})", true);

        return embed;
    }

    public async Task<DiscordEmbedBuilder?> HandleFollowage(DiscordInteraction interaction, DiscordUser? discordUser, string? twitchUser, string? canal)
    {
        var channelName = await ResolveChannel(interaction.Guild.Id, canal);

        var targetUser = discordUser ?? interaction.User;
        DiscordMember? targetMember = null;
        try { targetMember = await interaction.Guild.GetMemberAsync(targetUser.Id); } catch { }

        var joinedAt = targetMember?.JoinedAt ?? DateTimeOffset.UtcNow;
        var memberSince = DateTimeOffset.UtcNow - joinedAt;

        var embed = new DiscordEmbedBuilder()
            .WithAuthor(targetUser.Username, null, targetUser.AvatarUrl)
            .WithTitle($"Followage — {interaction.Guild.Name}")
            .WithColor(DecatronColor)
            .WithFooter("Decatron Bot • twitch.decatron.net")
            .WithTimestamp(DateTimeOffset.UtcNow)
            .AddField("En el servidor de Discord", $"{targetUser.Mention} desde {joinedAt:dd/MM/yyyy} ({FormatTime(memberSince)})", false);

        // Twitch part — only if channel is linked
        if (channelName != null)
        {
            var streamer = await _twitchApi.GetUserByLoginAsync(channelName);
            if (streamer != null)
            {
                embed.WithTitle($"Followage — {streamer.display_name}");
                embed.WithThumbnail(streamer.profile_image_url);
                embed.WithUrl($"https://twitch.tv/{channelName}");

                var resolvedTwitch = twitchUser?.ToLower().Trim();
                if (string.IsNullOrEmpty(resolvedTwitch))
                {
                    using var scope = _serviceProvider.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                    var match = await db.Users
                        .Where(u => u.Login.ToLower() == targetUser.Username.ToLower() || u.DisplayName.ToLower() == targetUser.Username.ToLower())
                        .FirstOrDefaultAsync();
                    if (match != null) resolvedTwitch = match.Login.ToLower();
                }

                if (!string.IsNullOrEmpty(resolvedTwitch))
                {
                    var followData = await GetFollowageAsync(streamer.id, resolvedTwitch);
                    if (followData != null)
                    {
                        var followAge = DateTime.UtcNow - followData.FollowedAt;
                        embed.AddField("Followage en Twitch", $"**{followData.UserName}** sigue a **{streamer.display_name}** desde {followData.FollowedAt:dd/MM/yyyy} ({FormatTime(followAge)})", false);
                    }
                    else
                    {
                        embed.AddField("Twitch", $"**{resolvedTwitch}** no sigue a {streamer.display_name} o no esta en los registros", false);
                    }
                }
                else
                {
                    embed.AddField("Twitch", "No se pudo detectar cuenta de Twitch. Usa `/followage twitch:tu_nombre`", false);
                }
            }
        }
        else
        {
            embed.AddField("Twitch", "No hay canal de Twitch vinculado a este servidor. El streamer puede vincular desde twitch.decatron.net/discord", false);
        }

        return embed;
    }

    public async Task<DiscordEmbedBuilder?> HandleSong(DiscordInteraction interaction, string? canal)
    {
        var channelName = await ResolveChannel(interaction.Guild.Id, canal);
        if (channelName == null) return NoLinkEmbed();

        using var scope = _serviceProvider.CreateScope();
        var nowPlayingService = scope.ServiceProvider.GetRequiredService<NowPlayingService>();
        var httpClientFactory = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>();
        var httpClient = httpClientFactory.CreateClient();

        var nowPlaying = await nowPlayingService.GetNowPlaying(channelName, httpClient);

        if (nowPlaying == null)
        {
            return new DiscordEmbedBuilder()
                .WithTitle("🔇 Sin musica")
                .WithDescription($"No hay ninguna cancion sonando en {channelName}.")
                .WithColor(DecatronColor)
                .WithFooter("Decatron Bot • twitch.decatron.net")
                .WithTimestamp(DateTimeOffset.UtcNow);
        }

        var json = JsonSerializer.Serialize(nowPlaying);
        var data = JsonDocument.Parse(json).RootElement;
        var trackName = data.TryGetProperty("track", out var t) ? t.GetString() : "Desconocido";
        var artistName = data.TryGetProperty("artist", out var a) ? a.GetString() : "Desconocido";
        var albumArt = data.TryGetProperty("albumArt", out var art) ? art.GetString() : null;

        var embed = new DiscordEmbedBuilder()
            .WithTitle("🎵 Now Playing")
            .WithDescription($"**{trackName}**\npor {artistName}")
            .WithColor(GreenColor)
            .WithFooter($"Decatron Bot • {channelName}")
            .WithTimestamp(DateTimeOffset.UtcNow);

        if (!string.IsNullOrEmpty(albumArt))
            embed.WithThumbnail(albumArt);

        return embed;
    }

    public async Task HandleAutocomplete(DiscordInteraction interaction)
    {
        var focusedOption = interaction.Data.Options?.FirstOrDefault(o => o.Focused);
        if (focusedOption == null || focusedOption.Name != "canal") return;

        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

        var guildId = interaction.Guild.Id.ToString();
        var input = focusedOption.Value?.ToString()?.ToLower() ?? "";

        var configs = await db.DiscordGuildConfigs
            .Where(g => g.GuildId == guildId && g.IsActive)
            .OrderByDescending(g => g.IsDefault)
            .Select(g => g.ChannelName)
            .ToListAsync();

        var choices = configs
            .Where(c => string.IsNullOrEmpty(input) || c.Contains(input))
            .Take(25)
            .Select(c => new DiscordAutoCompleteChoice(c, c))
            .ToList();

        await interaction.CreateResponseAsync(InteractionResponseType.AutoCompleteResult,
            new DiscordInteractionResponseBuilder().AddAutoCompleteChoices(choices));
    }

    // --- Helpers ---

    private async Task<string?> ResolveChannel(ulong guildId, string? requestedChannel)
    {
        if (!string.IsNullOrEmpty(requestedChannel))
            return requestedChannel.ToLower().Trim();

        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
        var defaultConfig = await db.DiscordGuildConfigs
            .Where(g => g.GuildId == guildId.ToString() && g.IsActive)
            .OrderByDescending(g => g.IsDefault)
            .ThenBy(g => g.CreatedAt)
            .FirstOrDefaultAsync();
        return defaultConfig?.ChannelName;
    }

    private async Task<ChannelFollower?> GetFollowageAsync(string broadcasterId, string userLogin)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            return await db.ChannelFollowers
                .FirstOrDefaultAsync(f => f.BroadcasterId == broadcasterId && f.UserLogin == userLogin && f.IsFollowing == 0);
        }
        catch { return null; }
    }

    private static DiscordEmbedBuilder NoLinkEmbed() => new DiscordEmbedBuilder()
        .WithTitle("Sin vincular")
        .WithDescription("No hay un canal de Twitch vinculado a este servidor.\nEl streamer debe vincular Discord desde twitch.decatron.net/discord")
        .WithColor(new DiscordColor("#64748b"));

    private static DiscordEmbedBuilder ErrorEmbed(string msg) => new DiscordEmbedBuilder()
        .WithTitle("Error")
        .WithDescription(msg)
        .WithColor(new DiscordColor("#ef4444"));

    private static string Safe(string? value, string fallback) =>
        string.IsNullOrWhiteSpace(value) ? fallback : value;

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

    // ============================================
    // XP / LEVEL COMMANDS
    // ============================================

    /// <summary>
    /// /level — Shows rank card image. Sends directly via interaction (not embed).
    /// </summary>
    public async Task HandleLevel(DiscordInteraction interaction, DiscordUser? targetUser)
    {
        var user = targetUser ?? interaction.User;
        var guildId = interaction.Guild.Id.ToString();
        var userId = user.Id.ToString();

        var xpService = _serviceProvider.GetRequiredService<Services.XpService>();
        using var scope = _serviceProvider.CreateScope();
        var rankCardGen = scope.ServiceProvider.GetRequiredService<RankCardGenerator>();

        var userXp = await xpService.GetUserXpAsync(guildId, userId);

        if (userXp == null)
        {
            await interaction.EditOriginalResponseAsync(new DiscordWebhookBuilder()
                .AddEmbed(new DiscordEmbedBuilder()
                    .WithTitle($"{user.Username}")
                    .WithDescription("Este usuario aun no tiene XP. Envia mensajes para empezar a ganar!")
                    .WithColor(DecatronColor)
                    .WithThumbnail(user.GetAvatarUrl(ImageFormat.Png, 128))
                    .WithFooter("Decatron Bot • twitch.decatron.net")));
            return;
        }

        var config = await xpService.GetOrCreateConfigAsync(guildId);
        var rank = await xpService.GetUserRankAsync(guildId, userId);
        var totalUsers = await xpService.GetTotalUsersAsync(guildId);
        var requiredXp = Services.XpService.CalculateRequiredXp(userXp.Level + 1);

        var cardStream = await rankCardGen.GenerateAsync(
            username: userXp.Username,
            avatarUrl: user.GetAvatarUrl(ImageFormat.Png, 256),
            level: userXp.Level,
            currentXp: userXp.Xp,
            requiredXp: requiredXp,
            rank: rank,
            totalUsers: totalUsers,
            tier: null,
            guildId: guildId);

        if (cardStream != null)
        {
            await interaction.EditOriginalResponseAsync(new DiscordWebhookBuilder()
                .AddFile("rank-card.png", cardStream));
            cardStream.Dispose();
        }
        else
        {
            // Fallback: text embed
            var progress = requiredXp > 0 ? (int)(userXp.Xp * 100 / requiredXp) : 0;
            await interaction.EditOriginalResponseAsync(new DiscordWebhookBuilder()
                .AddEmbed(new DiscordEmbedBuilder()
                    .WithAuthor(userXp.Username, null, user.GetAvatarUrl(ImageFormat.Png, 128))
                    .WithTitle($"Nivel {userXp.Level}")
                    .WithColor(DecatronColor)
                    .AddField("XP", $"{userXp.Xp:N0} / {requiredXp:N0}", true)
                    .AddField("Ranking", $"#{rank} de {totalUsers}", true)
                    .AddField("Progreso", ProgressBar(progress), false)
                    .WithFooter("Decatron Bot • twitch.decatron.net")
                    .WithTimestamp(DateTimeOffset.UtcNow)));
        }
    }

    /// <summary>
    /// /top — Shows leaderboard embed.
    /// </summary>
    public async Task<DiscordEmbedBuilder?> HandleTop(DiscordInteraction interaction, string? type, int? page)
    {
        var pageNum = Math.Max(1, page ?? 1);
        var guildId = interaction.Guild.Id.ToString();
        var xpService = _serviceProvider.GetRequiredService<Services.XpService>();

        if (type == "monthly")
        {
            var seasonalService = _serviceProvider.GetRequiredService<SeasonalService>();
            var monthly = await seasonalService.GetMonthlyLeaderboardAsync(guildId, null, pageNum);
            if (monthly.Count == 0)
            {
                return new DiscordEmbedBuilder()
                    .WithTitle("📅 Ranking Mensual")
                    .WithDescription("Aun no hay actividad este mes.")
                    .WithColor(DecatronColor);
            }

            var monthDesc = "";
            for (int i = 0; i < monthly.Count; i++)
            {
                var u = monthly[i];
                var pos = (pageNum - 1) * 10 + i + 1;
                var medal = pos switch { 1 => "🥇", 2 => "🥈", 3 => "🥉", _ => $"**{pos}.**" };
                monthDesc += $"{medal} <@{u.UserId}> — **{u.XpGained:N0} XP** ({u.MessagesCount} msgs)\n";
            }

            var monthName = DateTime.UtcNow.ToString("MMMM yyyy", System.Globalization.CultureInfo.GetCultureInfo("es-ES"));
            return new DiscordEmbedBuilder()
                .WithTitle($"📅 Ranking Mensual — {monthName}")
                .WithDescription(monthDesc)
                .WithColor(AmberColor)
                .WithFooter($"Pagina {pageNum} • Decatron Bot")
                .WithTimestamp(DateTimeOffset.UtcNow);
        }

        if (type == "global")
        {
            var globalTop = await xpService.GetGlobalLeaderboardAsync(pageNum);
            if (globalTop.Count == 0)
            {
                return new DiscordEmbedBuilder()
                    .WithTitle("🌍 Ranking Global Decatron")
                    .WithDescription("Aun no hay usuarios con XP global.")
                    .WithColor(DecatronColor);
            }

            var desc = "";
            for (int i = 0; i < globalTop.Count; i++)
            {
                var u = globalTop[i];
                var pos = (pageNum - 1) * 10 + i + 1;
                var medal = pos switch { 1 => "🥇", 2 => "🥈", 3 => "🥉", _ => $"**{pos}.**" };
                desc += $"{medal} <@{u.UserId}> — Nivel **{u.Level}**\n";
            }

            return new DiscordEmbedBuilder()
                .WithTitle("🌍 Ranking Global Decatron")
                .WithDescription(desc)
                .WithColor(AmberColor)
                .WithFooter($"Pagina {pageNum} • Decatron Bot")
                .WithTimestamp(DateTimeOffset.UtcNow);
        }

        // Server leaderboard (default)
        var top = await xpService.GetLeaderboardAsync(guildId, pageNum);
        if (top.Count == 0)
        {
            return new DiscordEmbedBuilder()
                .WithTitle("🏆 Ranking del Servidor")
                .WithDescription("Aun no hay usuarios con XP. Envia mensajes para empezar!")
                .WithColor(DecatronColor);
        }

        var description = "";
        for (int i = 0; i < top.Count; i++)
        {
            var u = top[i];
            var pos = (pageNum - 1) * 10 + i + 1;
            var medal = pos switch { 1 => "🥇", 2 => "🥈", 3 => "🥉", _ => $"**{pos}.**" };
            var totalXp = Services.XpService.CalculateTotalXpForLevel(u.Level) + u.Xp;
            description += $"{medal} <@{u.UserId}> — Nivel **{u.Level}** ({totalXp:N0} XP)\n";
        }

        return new DiscordEmbedBuilder()
            .WithTitle("🏆 Ranking del Servidor")
            .WithDescription(description)
            .WithColor(AmberColor)
            .WithFooter($"Pagina {pageNum} • Decatron Bot")
            .WithTimestamp(DateTimeOffset.UtcNow);
    }

    // ============================================
    // XP ADMIN COMMANDS
    // ============================================

    private async Task<bool> HasXpAdminPermission(DiscordInteraction interaction)
    {
        try
        {
            var member = await interaction.Guild.GetMemberAsync(interaction.User.Id);
            return member.Permissions.HasPermission(Permissions.ManageGuild);
        }
        catch { return false; }
    }

    private static DiscordEmbedBuilder NoPermissionEmbed() =>
        new DiscordEmbedBuilder()
            .WithTitle("⛔ Sin permisos")
            .WithDescription("Necesitas el permiso **Manage Server** para usar este comando.")
            .WithColor(new DiscordColor("#ef4444"));

    public async Task<DiscordEmbedBuilder?> HandleXpGive(DiscordInteraction interaction, DiscordUser? target, int amount)
    {
        if (!await HasXpAdminPermission(interaction)) return NoPermissionEmbed();
        if (target == null || amount <= 0)
            return new DiscordEmbedBuilder().WithTitle("Uso: /xp give @user cantidad").WithColor(DecatronColor);

        var xpService = _serviceProvider.GetRequiredService<XpService>();
        var roleService = _serviceProvider.GetRequiredService<XpRoleService>();
        var guildId = interaction.Guild.Id.ToString();

        // Get old level
        var oldXp = await xpService.GetUserXpAsync(guildId, target.Id.ToString());
        var oldLevel = oldXp?.Level ?? 0;

        var (userXp, newAchievements) = await xpService.GiveXpAsync(guildId, target.Id.ToString(), target.Username, amount);

        // Assign roles + send level-up notification if leveled up
        if (userXp.Level > oldLevel)
        {
            try
            {
                var member = await interaction.Guild.GetMemberAsync(target.Id);
                await roleService.AssignRolesForLevelAsync(interaction.Guild, member, userXp.Level);
            }
            catch { }

            // Send level-up card notification
            try
            {
                var config = await xpService.GetOrCreateConfigAsync(guildId);
                DiscordChannel? targetChannel = null;
                if (!string.IsNullOrEmpty(config.LevelupChannelId) && ulong.TryParse(config.LevelupChannelId, out var chId))
                {
                    try { targetChannel = interaction.Guild.GetChannel(chId); } catch { }
                }
                targetChannel ??= interaction.Channel;

                var rank = await xpService.GetUserRankAsync(guildId, target.Id.ToString());
                var totalUsers = await xpService.GetTotalUsersAsync(guildId);
                var requiredXp = XpService.CalculateRequiredXp(userXp.Level + 1);

                using var scope = _serviceProvider.CreateScope();
                var rankCardGen = scope.ServiceProvider.GetRequiredService<RankCardGenerator>();
                var cardStream = await rankCardGen.GenerateAsync(
                    username: userXp.Username,
                    avatarUrl: target.GetAvatarUrl(DSharpPlus.ImageFormat.Png, 256),
                    level: userXp.Level,
                    currentXp: userXp.Xp,
                    requiredXp: requiredXp,
                    rank: rank,
                    totalUsers: totalUsers,
                    tier: null,
                    guildId: guildId);

                if (cardStream != null)
                {
                    await targetChannel.SendMessageAsync(new DiscordMessageBuilder()
                        .WithContent($"🎉 **{target.Mention} subio a nivel {userXp.Level}!**")
                        .AddFile("rank-card.png", cardStream));
                    cardStream.Dispose();
                }
            }
            catch { }
        }

        var achievementText = newAchievements.Count > 0
            ? "\n" + string.Join("\n", newAchievements.Select(a => $"{a.Icon} **{a.Name}** desbloqueado!"))
            : "";

        return new DiscordEmbedBuilder()
            .WithTitle("✅ XP otorgado")
            .WithDescription($"**+{amount:N0} XP** a {target.Mention}" + (userXp.Level > oldLevel ? $"\n⬆️ Subio a nivel **{userXp.Level}**!" : "") + achievementText)
            .AddField("Nivel", userXp.Level.ToString(), true)
            .AddField("XP actual", userXp.Xp.ToString("N0"), true)
            .WithColor(GreenColor)
            .WithFooter($"Por {interaction.User.Username}")
            .WithTimestamp(DateTimeOffset.UtcNow);
    }

    public async Task<DiscordEmbedBuilder?> HandleXpRemove(DiscordInteraction interaction, DiscordUser? target, int amount)
    {
        if (!await HasXpAdminPermission(interaction)) return NoPermissionEmbed();
        if (target == null || amount <= 0)
            return new DiscordEmbedBuilder().WithTitle("Uso: /xp remove @user cantidad").WithColor(DecatronColor);

        var xpService = _serviceProvider.GetRequiredService<XpService>();
        var roleService = _serviceProvider.GetRequiredService<XpRoleService>();
        var guildId = interaction.Guild.Id.ToString();

        var oldXp = await xpService.GetUserXpAsync(guildId, target.Id.ToString());
        var oldLevel = oldXp?.Level ?? 0;

        var userXp = await xpService.RemoveXpAsync(guildId, target.Id.ToString(), amount);
        if (userXp == null)
            return new DiscordEmbedBuilder().WithTitle("Usuario no encontrado").WithDescription("Este usuario no tiene XP.").WithColor(DecatronColor);

        // Remove excess roles if level dropped
        if (userXp.Level < oldLevel)
        {
            try
            {
                var member = await interaction.Guild.GetMemberAsync(target.Id);
                await roleService.RemoveExcessRolesAsync(interaction.Guild, member, userXp.Level);
            }
            catch { }
        }

        return new DiscordEmbedBuilder()
            .WithTitle("✅ XP removido")
            .WithDescription($"**-{amount:N0} XP** de {target.Mention}" + (userXp.Level < oldLevel ? $"\n⬇️ Bajo a nivel **{userXp.Level}**" : ""))
            .AddField("Nivel", userXp.Level.ToString(), true)
            .AddField("XP actual", userXp.Xp.ToString("N0"), true)
            .WithColor(AmberColor)
            .WithFooter($"Por {interaction.User.Username}")
            .WithTimestamp(DateTimeOffset.UtcNow);
    }

    public async Task<DiscordEmbedBuilder?> HandleXpReset(DiscordInteraction interaction, DiscordUser? target)
    {
        if (!await HasXpAdminPermission(interaction)) return NoPermissionEmbed();
        if (target == null)
            return new DiscordEmbedBuilder().WithTitle("Uso: /xp reset @user").WithColor(DecatronColor);

        var xpService = _serviceProvider.GetRequiredService<XpService>();
        var roleService = _serviceProvider.GetRequiredService<XpRoleService>();
        var guildId = interaction.Guild.Id.ToString();

        var oldXp = await xpService.GetUserXpAsync(guildId, target.Id.ToString());
        var oldLevel = oldXp?.Level ?? 0;

        var result = await xpService.ResetXpAsync(guildId, target.Id.ToString());
        if (!result)
            return new DiscordEmbedBuilder().WithTitle("Usuario no encontrado").WithDescription("Este usuario no tiene XP.").WithColor(DecatronColor);

        // Remove all XP roles
        if (oldLevel > 0)
        {
            try
            {
                var member = await interaction.Guild.GetMemberAsync(target.Id);
                await roleService.RemoveExcessRolesAsync(interaction.Guild, member, 0);
            }
            catch { }
        }

        return new DiscordEmbedBuilder()
            .WithTitle("🔄 XP reseteado")
            .WithDescription($"Se reseteo el XP de {target.Mention} a **0**\nSe removieron los roles de nivel.")
            .WithColor(AmberColor)
            .WithFooter($"Por {interaction.User.Username}")
            .WithTimestamp(DateTimeOffset.UtcNow);
    }

    public async Task<DiscordEmbedBuilder?> HandleXpSet(DiscordInteraction interaction, DiscordUser? target, long amount)
    {
        if (!await HasXpAdminPermission(interaction)) return NoPermissionEmbed();
        if (target == null || amount < 0)
            return new DiscordEmbedBuilder().WithTitle("Uso: /xp set @user cantidad").WithColor(DecatronColor);

        var xpService = _serviceProvider.GetRequiredService<XpService>();
        var roleService = _serviceProvider.GetRequiredService<XpRoleService>();
        var guildId = interaction.Guild.Id.ToString();

        var oldXp = await xpService.GetUserXpAsync(guildId, target.Id.ToString());
        var oldLevel = oldXp?.Level ?? 0;

        var (userXp, newAchievements) = await xpService.SetXpAsync(guildId, target.Id.ToString(), target.Username, amount);

        // Assign or remove roles based on level change
        try
        {
            var member = await interaction.Guild.GetMemberAsync(target.Id);
            if (userXp.Level > oldLevel)
                await roleService.AssignRolesForLevelAsync(interaction.Guild, member, userXp.Level);
            else if (userXp.Level < oldLevel)
                await roleService.RemoveExcessRolesAsync(interaction.Guild, member, userXp.Level);
        }
        catch { }

        var achievementText = newAchievements.Count > 0
            ? "\n" + string.Join("\n", newAchievements.Select(a => $"{a.Icon} **{a.Name}** desbloqueado!"))
            : "";

        return new DiscordEmbedBuilder()
            .WithTitle("✅ XP establecido")
            .WithDescription($"XP de {target.Mention} seteado a **{amount:N0}**" + achievementText)
            .AddField("Nivel", userXp.Level.ToString(), true)
            .AddField("XP actual", userXp.Xp.ToString("N0"), true)
            .WithColor(GreenColor)
            .WithFooter($"Por {interaction.User.Username}")
            .WithTimestamp(DateTimeOffset.UtcNow);
    }

    public async Task<DiscordEmbedBuilder?> HandleXpBoost(DiscordInteraction interaction, string? multiplierStr, string? durationStr)
    {
        if (!await HasXpAdminPermission(interaction)) return NoPermissionEmbed();

        if (!double.TryParse(multiplierStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var multiplier) ||
            !double.TryParse(durationStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var duration))
            return new DiscordEmbedBuilder().WithTitle("Uso: /xp boost multiplier duration").WithColor(DecatronColor);

        var boostService = _serviceProvider.GetRequiredService<XpBoostService>();
        var guildId = interaction.Guild.Id.ToString();
        var boost = await boostService.CreateBoostAsync(guildId, multiplier, duration,
            interaction.User.Id.ToString(), interaction.User.Username);

        return new DiscordEmbedBuilder()
            .WithTitle("⚡ XP BOOST ACTIVO!")
            .WithDescription($"**{multiplier}x XP** por las proximas **{XpBoostService.FormatDuration(duration)}**!")
            .AddField("Activado por", interaction.User.Mention, true)
            .AddField("Expira", $"<t:{((DateTimeOffset)boost.ExpiresAt).ToUnixTimeSeconds()}:R>", true)
            .WithColor(AmberColor)
            .WithFooter("Todos los mensajes otorgan XP multiplicado")
            .WithTimestamp(DateTimeOffset.UtcNow);
    }

    // ============================================
    // ACHIEVEMENTS
    // ============================================

    public async Task<DiscordEmbedBuilder?> HandleAchievements(DiscordInteraction interaction)
    {
        var achievementService = _serviceProvider.GetRequiredService<AchievementService>();
        var guildId = interaction.Guild.Id.ToString();
        var userId = interaction.User.Id.ToString();

        var userAchievements = await achievementService.GetUserAchievementsAsync(guildId, userId);

        if (userAchievements.Count == 0)
        {
            return new DiscordEmbedBuilder()
                .WithTitle("🏆 Achievements")
                .WithDescription("No hay achievements configurados en este servidor.")
                .WithColor(DecatronColor);
        }

        var unlocked = userAchievements.Where(a => a.unlocked).ToList();
        var locked = userAchievements.Where(a => !a.unlocked).ToList();

        var desc = "";

        if (unlocked.Count > 0)
        {
            desc += "**Desbloqueados:**\n";
            foreach (var (a, _, unlockedAt) in unlocked)
                desc += $"{a.Icon} **{a.Name}** — _{a.Description}_\n";
            desc += "\n";
        }

        if (locked.Count > 0)
        {
            desc += "**Bloqueados:**\n";
            foreach (var (a, _, _) in locked)
                desc += $"🔒 ~~{a.Name}~~ — _{a.Description}_\n";
        }

        return new DiscordEmbedBuilder()
            .WithAuthor(interaction.User.Username, null, interaction.User.GetAvatarUrl(DSharpPlus.ImageFormat.Png, 128))
            .WithTitle($"🏆 Achievements ({unlocked.Count}/{userAchievements.Count})")
            .WithDescription(desc)
            .WithColor(AmberColor)
            .WithFooter("Decatron Bot • twitch.decatron.net")
            .WithTimestamp(DateTimeOffset.UtcNow);
    }

    // ============================================
    // SHOP
    // ============================================

    public async Task<DiscordEmbedBuilder?> HandleShop(DiscordInteraction interaction, string? buyItemName)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
        var guildId = interaction.Guild.Id.ToString();

        // Buy mode
        if (!string.IsNullOrEmpty(buyItemName))
        {
            var item = await db.XpStoreItems
                .FirstOrDefaultAsync(i => i.GuildId == guildId && i.Enabled &&
                    i.Name.ToLower().Contains(buyItemName.ToLower()));

            if (item == null)
                return new DiscordEmbedBuilder()
                    .WithTitle("❌ Item no encontrado")
                    .WithDescription($"No se encontro un item con el nombre \"{buyItemName}\".\nUsa `/shop` sin parametros para ver los items disponibles.")
                    .WithColor(new DiscordColor("#ef4444"));

            var userId = interaction.User.Id.ToString();
            var userXp = await db.UserXps.FirstOrDefaultAsync(u => u.GuildId == guildId && u.UserId == userId);

            if (userXp == null || userXp.Xp < item.Cost)
                return new DiscordEmbedBuilder()
                    .WithTitle("❌ XP insuficiente")
                    .WithDescription($"Necesitas **{item.Cost:N0} XP** pero tienes **{userXp?.Xp ?? 0:N0} XP**.")
                    .WithColor(new DiscordColor("#ef4444"));

            if (item.MaxStock > 0 && item.CurrentStock <= 0)
                return new DiscordEmbedBuilder()
                    .WithTitle("❌ Agotado")
                    .WithDescription($"**{item.Name}** esta agotado.")
                    .WithColor(new DiscordColor("#ef4444"));

            // Process purchase
            userXp.Xp -= item.Cost;
            userXp.UpdatedAt = DateTime.UtcNow;

            if (item.MaxStock > 0)
                item.CurrentStock = Math.Max(0, item.CurrentStock - 1);

            db.XpStorePurchases.Add(new Discord.Models.XpStorePurchase
            {
                GuildId = guildId,
                UserId = userId,
                Username = interaction.User.Username,
                ItemId = item.Id,
                CostPaid = item.Cost,
                ExpiresAt = item.DurationHours.HasValue ? DateTime.UtcNow.AddHours(item.DurationHours.Value) : null,
                Status = item.ItemType == "custom" ? "pending" : "completed",
            });

            db.XpTransactions.Add(new Discord.Models.XpTransaction
            {
                GuildId = guildId,
                UserId = userId,
                XpAmount = -item.Cost,
                Source = "store",
                Description = $"Purchased: {item.Name}",
            });

            await db.SaveChangesAsync();

            // Execute reward action
            var rewardError = await ExecuteShopReward(interaction.Guild, userId, interaction.User.Username, item);

            var rewardStatus = rewardError != null
                ? $"\n⚠️ {rewardError}"
                : item.ItemType switch
                {
                    "role_temp" => "\n✅ Rol asignado!",
                    "channel_access" => "\n✅ Acceso al canal otorgado!",
                    "shoutout" => "\n✅ Shoutout enviado!",
                    _ => "",
                };

            return new DiscordEmbedBuilder()
                .WithTitle($"{item.Icon} Compra exitosa!")
                .WithDescription($"Compraste **{item.Name}**\n_{item.Description}_\n\nGastaste **{item.Cost:N0} XP** — Te quedan **{userXp.Xp:N0} XP**{rewardStatus}")
                .WithColor(rewardError != null ? AmberColor : GreenColor)
                .WithFooter("Decatron Bot • /shop")
                .WithTimestamp(DateTimeOffset.UtcNow);
        }

        // List mode (no buy parameter)
        var items = await db.XpStoreItems
            .Where(i => i.GuildId == guildId && i.Enabled)
            .OrderBy(i => i.Cost)
            .ToListAsync();

        if (items.Count == 0)
            return new DiscordEmbedBuilder()
                .WithTitle("🛒 XP Store")
                .WithDescription("No hay items en la tienda de este servidor.")
                .WithColor(DecatronColor);

        var listDesc = "";
        foreach (var item in items)
        {
            var stock = item.MaxStock > 0 ? $" ({item.CurrentStock}/{item.MaxStock})" : "";
            listDesc += $"{item.Icon} **{item.Name}** — `{item.Cost:N0} XP`{stock}\n_{item.Description}_\n\n";
        }

        listDesc += "\n*Para comprar: `/shop buy:[nombre del item]`*";

        return new DiscordEmbedBuilder()
            .WithTitle("🛒 XP Store")
            .WithDescription(listDesc)
            .WithColor(AmberColor)
            .WithFooter("Decatron Bot • twitch.decatron.net")
            .WithTimestamp(DateTimeOffset.UtcNow);
    }

    private async Task<string?> ExecuteShopReward(DiscordGuild guild, string userId, string username, Discord.Models.XpStoreItem item)
    {
        try
        {
            if (!ulong.TryParse(userId, out var userUlong)) return "No se pudo resolver el usuario";

            switch (item.ItemType)
            {
                case "role_temp":
                    if (string.IsNullOrEmpty(item.RoleId))
                        return "El item no tiene un rol configurado. El admin debe configurar el rol.";
                    if (!ulong.TryParse(item.RoleId, out var roleUlong))
                        return "ID de rol invalido";
                    var role = guild.GetRole(roleUlong);
                    if (role == null) return "El rol no existe en Discord";
                    try
                    {
                        var member = await guild.GetMemberAsync(userUlong);
                        await member.GrantRoleAsync(role, $"Decatron Store — Purchased {item.Name}");
                    }
                    catch (DSharpPlus.Exceptions.UnauthorizedException)
                    {
                        return $"El bot no tiene permisos para asignar el rol \"{role.Name}\". El rol del bot debe estar arriba en la jerarquia de roles.";
                    }
                    break;

                case "channel_access":
                    if (string.IsNullOrEmpty(item.ChannelId))
                        return "El item no tiene un canal configurado.";
                    if (!ulong.TryParse(item.ChannelId, out var channelUlong))
                        return "ID de canal invalido";
                    var channel = guild.GetChannel(channelUlong);
                    if (channel == null) return "El canal no existe en Discord";
                    try
                    {
                        var member = await guild.GetMemberAsync(userUlong);
                        await channel.AddOverwriteAsync(member,
                            allow: Permissions.AccessChannels | Permissions.SendMessages,
                            reason: $"Decatron Store — Purchased {item.Name}");
                    }
                    catch (DSharpPlus.Exceptions.UnauthorizedException)
                    {
                        return "El bot no tiene permisos para modificar permisos del canal.";
                    }
                    break;

                case "shoutout":
                case "custom":
                    break;
            }

            // Send announcement to channel (for all types)
            DiscordChannel? announceChannel = null;
            if (!string.IsNullOrEmpty(item.AnnouncementChannelId) && ulong.TryParse(item.AnnouncementChannelId, out var annChId))
                announceChannel = guild.GetChannel(annChId);

            if (announceChannel != null)
            {
                var message = item.CustomMessage ?? item.Description ?? "";
                message = message.Replace("{user}", username).Replace("{mention}", $"<@{userId}>").Replace("{item}", item.Name);

                string title;
                string color;
                switch (item.ItemType)
                {
                    case "shoutout":
                        title = "📢 Shoutout!";
                        color = "#f59e0b";
                        if (string.IsNullOrWhiteSpace(message)) message = $"Shoutout para **{username}** (<@{userId}>)!";
                        break;
                    case "custom":
                        title = $"{item.Icon} Nuevo canje pendiente!";
                        color = "#8b5cf6";
                        message = $"**{username}** canjeo **{item.Name}**\n{message}\n\n⏳ *Pendiente de entregar*";
                        break;
                    default:
                        title = $"{item.Icon} Compra en la Store!";
                        color = "#22c55e";
                        message = $"**{username}** compro **{item.Name}**";
                        break;
                }

                var embed = new DiscordEmbedBuilder()
                    .WithTitle(title)
                    .WithDescription(message)
                    .WithColor(new DiscordColor(color))
                    .WithFooter("Decatron XP Store")
                    .WithTimestamp(DateTimeOffset.UtcNow);
                await announceChannel.SendMessageAsync(embed);
            }
            else if (item.ItemType == "shoutout")
            {
                return "No hay canal de anuncio configurado para este item.";
            }

            return null; // Success
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[STORE] Error executing reward for {User}: {Item}", username, item.Name);
            return $"Error al ejecutar la recompensa: {ex.Message}";
        }
    }
}
