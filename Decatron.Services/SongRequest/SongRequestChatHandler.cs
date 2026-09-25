using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Core.Models.SongRequest;
using Decatron.Data;
using Decatron.Services.Moderation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.SongRequest
{
    /// <summary>
    /// Los comandos de song request en el chat. No se registran como comandos fijos: CommandService
    /// pregunta acá antes de los comandos custom, y si el módulo está apagado en el canal el mensaje
    /// sigue de largo. Así un streamer que ya tiene su propio !song no lo pierde por no usar el módulo.
    /// </summary>
    public sealed class SongRequestChatHandler
    {
        private enum Action { Request, WrongSong, Queue, Song, MyQueue, Skip, Remove, Open, Close, Pause, Resume, Ban }

        private static readonly Dictionary<string, Action> Commands = new()
        {
            ["!sr"] = Action.Request,
            ["!songrequest"] = Action.Request,
            ["!wrongsong"] = Action.WrongSong,
            ["!queue"] = Action.Queue,
            ["!song"] = Action.Song,
            ["!currentsong"] = Action.Song,
            ["!myqueue"] = Action.MyQueue,
            ["!skip"] = Action.Skip,
            ["!srremove"] = Action.Remove,
            ["!sropen"] = Action.Open,
            ["!srclose"] = Action.Close,
            ["!srpause"] = Action.Pause,
            ["!srresume"] = Action.Resume,
            ["!srban"] = Action.Ban
        };

        private static readonly string[] RoleOrder = { "everyone", "subscriber", "vip", "moderator", "lead_moderator", "broadcaster" };

        private const int MaxChatTitle = 80;
        private const int MaxChatMessage = 480;

        /// <summary>Votos de !skip por canal, para la canción que suena en ese momento.</summary>
        private static readonly ConcurrentDictionary<long, SkipVotes> _skipVotes = new();

        private sealed class SkipVotes
        {
            public long ItemId { get; init; }
            public HashSet<string> Voters { get; } = new();
        }

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<SongRequestChatHandler> _logger;

        public SongRequestChatHandler(IServiceScopeFactory scopeFactory, ILogger<SongRequestChatHandler> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        public static bool IsSongRequestCommand(string commandName) => Commands.ContainsKey(commandName);

        /// <summary>Mensajes del bot que el streamer puede editar (Resources/bot-messages → songrequest).</summary>
        public static readonly string[] MessageKeys =
        {
            "added", "usage", "closed", "already_queued", "user_limit", "queue_full", "banned_user", "banned_track", "banned_author",
            "unsupported", "invalid_link", "not_found", "private", "live", "upcoming", "not_embeddable", "age_restricted", "preview_only", "no_match", "failed",
            "too_long", "unknown_duration", "too_few_views", "recently_played",
            "wrongsong_removed", "no_requests", "queue_empty", "queue_list", "song_current", "song_current_fallback", "song_none", "myqueue",
            "skip_nothing", "skip_done", "skip_vote", "skip_voted_done", "remove_usage", "remove_invalid", "removed",
            "opened", "closed_now", "paused", "resumed", "ban_user", "ban_track", "ban_nothing"
        };

        public static IEnumerable<string> CommandNames => Commands.Keys;

        /// <returns>true si el mensaje era de song request y el módulo está activo en el canal.</returns>
        public async Task<bool> TryHandleAsync(CommandContext context, IMessageSender sender)
        {
            var parts = context.Message.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 0 || !Commands.TryGetValue(parts[0].ToLowerInvariant(), out var action))
                return false;

            try
            {
                using var scope = _scopeFactory.CreateScope();
                var services = scope.ServiceProvider;

                var channel = await services.GetRequiredService<ChatModeratorFactory>().ResolveAsync(context.Channel);
                if (channel == null)
                    return false;

                // Kick vinculado a Twitch cae en la cola del canal de Twitch
                var songs = services.GetRequiredService<SongRequestService>();
                var config = await songs.GetConfigAsync(await songs.GetQueueOwnerIdAsync(channel.UserId));
                if (config == null || !config.Enabled)
                    return false;

                var run = new Run(context, sender, services, songs, config, SongRequestService.ParseSettings(config), channel,
                    parts[0].ToLowerInvariant(), parts.Length > 1 ? parts[1].Trim() : "");

                var required = action switch
                {
                    Action.Skip => null, // decide adentro: directo o voto
                    Action.Remove => run.Settings.Permissions.Skip,
                    Action.Open or Action.Close or Action.Pause or Action.Resume or Action.Ban => run.Settings.Permissions.Manage,
                    _ => run.Settings.Permissions.Request
                };
                if (required != null && !await run.HasRoleAsync(required))
                    return true;

                switch (action)
                {
                    case Action.Request: await RequestAsync(run); break;
                    case Action.WrongSong: await WrongSongAsync(run); break;
                    case Action.Queue: await QueueAsync(run); break;
                    case Action.Song: await SongAsync(run); break;
                    case Action.MyQueue: await MyQueueAsync(run); break;
                    case Action.Skip: await SkipAsync(run); break;
                    case Action.Remove: await RemoveAsync(run); break;
                    case Action.Open: await SetOpenAsync(run, true); break;
                    case Action.Close: await SetOpenAsync(run, false); break;
                    case Action.Pause: await SetPausedAsync(run, true); break;
                    case Action.Resume: await SetPausedAsync(run, false); break;
                    case Action.Ban: await BanAsync(run); break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SongRequest] Error con {Command} de {User} en {Channel}", parts[0], context.Username, context.Channel);
            }
            return true;
        }

        // ── Comandos ─────────────────────────────────────────────────────────

        private static async Task RequestAsync(Run run)
        {
            if (run.Args.Length == 0)
            {
                await run.ReplyAsync("usage");
                return;
            }
            if (!run.Config.RequestsOpen)
            {
                await run.ReplyAsync("closed");
                return;
            }

            var unlimited = run.Context.IsBroadcaster || await run.HasControlTotalAsync();
            var result = await run.Songs.AddAsync(run.Config, run.Requester, run.Args, unlimited);
            if (!result.Success)
            {
                var vars = Vars(result.Track)
                    .With("max", result.ErrorKey == "too_long" ? FormatDuration(run.Settings.MaxDurationSeconds) : run.Settings.MaxPerUser.ToString())
                    .With("views", run.Settings.MinViews.ToString("N0"))
                    .With("minutes", run.Settings.NoRepeatMinutes.ToString());
                await run.ReplyAsync(result.ErrorKey!, vars);
                return;
            }

            await run.ReplyAsync("added", Vars(result.Item!).With("position", result.Position.ToString()));
        }

        private static async Task WrongSongAsync(Run run)
        {
            var removed = await run.Songs.RemoveLastByUserAsync(run.Config, run.Channel.Platform, run.Context.Username);
            await run.ReplyAsync(removed == null ? "no_requests" : "wrongsong_removed", Vars(removed));
        }

        private static async Task QueueAsync(Run run)
        {
            var queued = await run.Songs.GetQueuedAsync(run.Config.UserId);
            var url = run.Songs.PublicQueueUrl(run.Config.ChannelName);
            if (queued.Count == 0)
            {
                await run.ReplyAsync("queue_empty", new() { ["url"] = url });
                return;
            }

            var preview = Math.Clamp(run.Settings.QueuePreviewCount, 1, 10);
            var list = string.Join(" · ", queued.Take(preview)
                .Select((q, i) => $"{i + 1}. {Short(DisplayTitle(q))} ({q.RequestedByName})"));
            await run.ReplyAsync("queue_list", new()
            {
                ["list"] = list,
                ["count"] = queued.Count.ToString(),
                ["url"] = url
            });
        }

        private static async Task SongAsync(Run run)
        {
            var current = await run.Songs.GetCurrentAsync(run.Config.UserId);
            var key = current == null ? "song_none"
                : current.RequestedPlatform == SongRequestPlatforms.Fallback ? "song_current_fallback" : "song_current";
            await run.ReplyAsync(key, Vars(current));
        }

        private static async Task MyQueueAsync(Run run)
        {
            var login = run.Context.Username.ToLowerInvariant();
            var queued = await run.Songs.GetQueuedAsync(run.Config.UserId);
            var mine = queued
                .Select((q, i) => (Item: q, Position: i + 1))
                .Where(x => x.Item.RequestedPlatform == run.Channel.Platform && x.Item.RequestedByLogin == login)
                .ToList();
            if (mine.Count == 0)
            {
                await run.ReplyAsync("no_requests");
                return;
            }

            var list = string.Join(" · ", mine.Select(x => $"#{x.Position} {Short(DisplayTitle(x.Item))}"));
            await run.ReplyAsync("myqueue", new() { ["list"] = list, ["count"] = mine.Count.ToString() });
        }

        private static async Task SkipAsync(Run run)
        {
            var current = await run.Songs.GetCurrentAsync(run.Config.UserId);
            if (current == null)
            {
                await run.ReplyAsync("skip_nothing");
                return;
            }

            if (await run.HasRoleAsync(run.Settings.Permissions.Skip))
            {
                await SkipNowAsync(run, "skip_done", current);
                return;
            }

            if (!run.Settings.SkipVoteEnabled || !await run.HasRoleAsync(run.Settings.Permissions.Request))
                return;

            var votes = _skipVotes.AddOrUpdate(run.Config.UserId,
                _ => new SkipVotes { ItemId = current.Id },
                (_, existing) => existing.ItemId == current.Id ? existing : new SkipVotes { ItemId = current.Id });

            int count;
            lock (votes)
            {
                if (!votes.Voters.Add($"{run.Channel.Platform}:{run.Context.Username.ToLowerInvariant()}"))
                    return; // ya votó
                count = votes.Voters.Count;
            }

            var needed = Math.Max(1, run.Settings.SkipVotesRequired);
            if (count >= needed)
            {
                await SkipNowAsync(run, "skip_voted_done", current);
                return;
            }

            await run.ReplyAsync("skip_vote", Vars(current)
                .With("votes", count.ToString())
                .With("needed", needed.ToString()));
        }

        private static async Task SkipNowAsync(Run run, string messageKey, SongRequestQueueItem current)
        {
            var skipped = await run.Songs.AdvanceAsync(run.Config, "skipped");
            _skipVotes.TryRemove(run.Config.UserId, out _);
            await run.ReplyAsync(messageKey, Vars(skipped ?? current));
        }

        private static async Task RemoveAsync(Run run)
        {
            if (!int.TryParse(run.Args.TrimStart('#'), out var position))
            {
                await run.ReplyAsync("remove_usage");
                return;
            }

            var removed = await run.Songs.RemoveAtPositionAsync(run.Config, position);
            await run.ReplyAsync(removed == null ? "remove_invalid" : "removed",
                Vars(removed).With("position", position.ToString()));
        }

        private static async Task SetOpenAsync(Run run, bool open)
        {
            await run.Songs.SetOpenAsync(run.Config, open);
            await run.ReplyAsync(open ? "opened" : "closed_now");
        }

        private static async Task SetPausedAsync(Run run, bool paused)
        {
            await run.Songs.SetPausedAsync(run.Config, paused);
            await run.ReplyAsync(paused ? "paused" : "resumed");
        }

        /// <summary>!srban @usuario veta a alguien; !srban solo veta la canción que suena y la salta.</summary>
        private static async Task BanAsync(Run run)
        {
            var by = run.Context.Username;
            var target = run.Args.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault()?.TrimStart('@').ToLowerInvariant();

            if (!string.IsNullOrEmpty(target))
            {
                if (target == run.Channel.Key || await run.IsKickBroadcasterAsync(target))
                    return;
                await run.Songs.BanAsync(run.Config.UserId, "user", $"{run.Channel.Platform}:{target}", target, by);
                await run.Songs.RemoveAllByUserAsync(run.Config, run.Channel.Platform, target);
                await run.ReplyAsync("ban_user", new() { ["target"] = target });
                return;
            }

            var current = await run.Songs.GetCurrentAsync(run.Config.UserId);
            if (current?.Track == null)
            {
                await run.ReplyAsync("ban_nothing");
                return;
            }

            var track = current.Track;
            await run.Songs.BanAsync(run.Config.UserId, "track", $"{track.Source}:{track.SourceId}", track.Title, by);
            await run.Songs.AdvanceAsync(run.Config, "skipped");
            _skipVotes.TryRemove(run.Config.UserId, out _);
            await run.ReplyAsync("ban_track", Vars(current));
        }

        // ── Mensajes ─────────────────────────────────────────────────────────

        private static string FormatDuration(int seconds) =>
            seconds >= 3600 ? $"{seconds / 3600}:{seconds % 3600 / 60:00}:{seconds % 60:00}" : $"{seconds / 60}:{seconds % 60:00}";

        private static string DisplayTitle(SongRequestQueueItem item) => item.OriginTitle ?? item.Track?.Title ?? "";

        private static string Short(string text) =>
            text.Length <= MaxChatTitle ? text : text[..(MaxChatTitle - 1)].TrimEnd() + "…";

        private static Dictionary<string, string> Vars(SongTrack? track) => track == null
            ? new()
            : new() { ["title"] = Short(track.Title), ["artist"] = track.Artist };

        private static Dictionary<string, string> Vars(SongRequestQueueItem? item)
        {
            if (item == null)
                return new();
            var vars = Vars(item.Track);
            vars["title"] = Short(DisplayTitle(item));
            vars["artist"] = item.OriginArtist ?? item.Track?.Artist ?? "";
            vars["requester"] = item.RequestedByName;
            vars["url"] = item.OriginUrl ?? (item.Track == null ? "" : SongResolverService.PublicUrlFor(item.Track));
            return vars;
        }

        private sealed record Run(
            CommandContext Context,
            IMessageSender Sender,
            IServiceProvider Services,
            SongRequestService Songs,
            SongRequestConfig Config,
            SongRequestSettings Settings,
            ModerationChannel Channel,
            string CommandName,
            string Args)
        {
            private bool? _controlTotal;

            // El chat nos da el login, no el nombre visible
            public SongRequester Requester => new(Channel.Platform, Context.UserId, Context.Username, Context.Username);

            /// <summary>En Kick la clave del canal es "kick_&lt;id&gt;": el nombre del streamer es otra columna.</summary>
            public async Task<bool> IsKickBroadcasterAsync(string login)
            {
                if (!Channel.IsKick)
                    return false;
                var kickUsername = await Services.GetRequiredService<DecatronDbContext>().Users.AsNoTracking()
                    .Where(u => u.Id == Channel.UserId)
                    .Select(u => u.KickUsername)
                    .FirstOrDefaultAsync();
                return string.Equals(kickUsername, login, StringComparison.OrdinalIgnoreCase);
            }

            public async Task<bool> HasControlTotalAsync() =>
                _controlTotal ??= await ModerationPermissions.HasControlTotalAsync(Services, Channel, Context.UserId);

            public async Task<bool> HasRoleAsync(string requiredRole)
            {
                var required = Array.IndexOf(RoleOrder, requiredRole);
                if (required <= 0)
                    return true;

                var level = Context.IsBroadcaster ? 5
                    : Context.IsLeadModerator ? 4
                    : Context.IsModerator ? 3
                    : Context.IsVip ? 2
                    : Context.IsSubscriber ? 1
                    : 0;
                if (level >= required)
                    return true;

                // control_total = actuar como el streamer
                return await HasControlTotalAsync();
            }

            public async Task ReplyAsync(string key, Dictionary<string, string>? vars = null)
            {
                var template = await GetTemplateAsync(key);
                if (string.IsNullOrWhiteSpace(template))
                    return;

                vars ??= new();
                vars.TryAdd("user", Context.Username);
                vars.TryAdd("command", CommandName);

                var message = vars.Aggregate(template, (text, kv) => text.Replace("{" + kv.Key + "}", kv.Value));
                if (message.Length > MaxChatMessage)
                    message = message[..(MaxChatMessage - 1)] + "…";
                await Sender.SendMessageAsync(Context.Channel, message);
            }

            /// <summary>Lo que editó el streamer; si no, el mensaje por defecto en el idioma del canal.</summary>
            private async Task<string> GetTemplateAsync(string key)
            {
                if (Settings.Messages.TryGetValue(key, out var custom))
                    return custom; // vacío = el streamer lo apagó

                var db = Services.GetRequiredService<DecatronDbContext>();
                var language = await db.Users.AsNoTracking()
                    .Where(u => u.Id == Config.UserId)
                    .Select(u => u.PreferredLanguage)
                    .FirstOrDefaultAsync() ?? "es";
                return Services.GetRequiredService<ICommandMessagesService>().GetMessage("songrequest", key, language);
            }
        }
    }

    internal static class SongRequestVarsExtensions
    {
        public static Dictionary<string, string> With(this Dictionary<string, string> vars, string key, string value)
        {
            vars[key] = value;
            return vars;
        }
    }
}
