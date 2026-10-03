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
        private enum Action { Request, WrongSong, Queue, Song, MyQueue, Skip, Remove, Open, Close, Pause, Resume, Ban, Volume, Promote, Video, Cover, PlaylistAdd, Approve, Reject, Play, Mode, PlaylistInfo, PlaylistStop, PlaylistNext, PlaylistShuffle, PlaylistLink, Clear, LastSong }

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
            ["!srban"] = Action.Ban,
            ["!srvolume"] = Action.Volume,
            ["!srpromote"] = Action.Promote,
            ["!srvideo"] = Action.Video,
            ["!srcover"] = Action.Cover,
            ["!pladd"] = Action.PlaylistAdd,
            ["!srapprove"] = Action.Approve,
            ["!srreject"] = Action.Reject,
            // Playlist de fondo (fase 0b): familia !pl; !srplay sigue valiendo igual que !plplay
            ["!srplay"] = Action.Play,
            ["!plplay"] = Action.Play,
            ["!pl"] = Action.PlaylistInfo,
            ["!plstop"] = Action.PlaylistStop,
            ["!plnext"] = Action.PlaylistNext,
            ["!plshuffle"] = Action.PlaylistShuffle,
            ["!srmode"] = Action.Mode,
            // El enlace a las playlists para escucharlas en la web (fase 1, etapa 3)
            ["!playlist"] = Action.PlaylistLink,
            // Alias y comandos del cierre de la etapa 3: parar = pausar, saltar con prefijo, vaciar la cola y la canción anterior
            ["!srstop"] = Action.Pause,
            ["!srskip"] = Action.Skip,
            ["!srnext"] = Action.Skip,
            ["!srclear"] = Action.Clear,
            ["!lastsong"] = Action.LastSong,
            ["!prevsong"] = Action.LastSong
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
            "opened", "closed_now", "paused", "resumed", "ban_user", "ban_track", "ban_nothing",
            "volume_current", "volume_set", "volume_usage",
            "promote_usage", "promote_invalid", "promoted", "video_on", "cover_on",
            "pl_usage", "pl_which", "pl_none", "pl_added", "pl_closed", "pl_slow_down", "pl_role", "pl_unverifiable",
            "pl_account_age", "pl_follow_age", "pl_cooldown", "pl_user_limit", "pl_viewers_full", "playlist_full", "already_in_playlist",
            "pending_added", "pl_pending", "already_pending", "pending_full", "pending_approved", "pl_pending_approved", "pending_rejected", "pending_none",
            "play_started", "play_off", "play_already_off", "play_usage", "pl_jump_now", "pl_jump_after", "pl_jump_no_player",
            "pl_info", "pl_info_idle", "pl_info_none", "pl_next_not_playlist", "pl_shuffle_on", "pl_shuffle_off", "pl_no_active", "pl_number_invalid", "only_playlists",
            "mode_set", "mode_usage", "hour_limit",
            "playlist_link", "playlist_link_one", "playlist_link_none", "playlist_link_notfound", "playlist_link_play", "playlist_link_stop",
            "cleared", "clear_none", "last_song", "last_song_fallback", "last_none"
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
                    Action.Volume => null, // decide adentro: ver el volumen o cambiarlo
                    Action.PlaylistAdd => null, // decide la playlist: sus requisitos
                    Action.Remove or Action.Promote or Action.PlaylistNext => run.Settings.Permissions.Skip,
                    Action.Open or Action.Close or Action.Pause or Action.Resume or Action.Ban
                        or Action.Video or Action.Cover or Action.Play or Action.Mode or Action.Clear
                        or Action.PlaylistStop or Action.PlaylistShuffle => run.Settings.Permissions.Manage,
                    Action.Approve or Action.Reject => run.Settings.Permissions.Review,
                    Action.PlaylistLink => run.Settings.Permissions.Playlist,
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
                    case Action.Volume: await VolumeAsync(run); break;
                    case Action.Promote: await PromoteAsync(run); break;
                    case Action.Video: await SetVideoModeAsync(run, true); break;
                    case Action.Cover: await SetVideoModeAsync(run, false); break;
                    case Action.PlaylistAdd: await PlaylistAddAsync(run); break;
                    case Action.Approve: await DecideAsync(run, approve: true); break;
                    case Action.Reject: await DecideAsync(run, approve: false); break;
                    case Action.Play: await PlayAsync(run); break;
                    case Action.Mode: await ModeAsync(run); break;
                    case Action.PlaylistInfo: await PlaylistInfoAsync(run); break;
                    case Action.PlaylistStop: await PlaylistStopAsync(run); break;
                    case Action.PlaylistNext: await PlaylistNextAsync(run); break;
                    case Action.PlaylistShuffle: await PlaylistShuffleAsync(run); break;
                    case Action.PlaylistLink: await PlaylistLinkAsync(run); break;
                    case Action.Clear: await ClearAsync(run); break;
                    case Action.LastSong: await LastSongAsync(run); break;
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
            // Modo revisión (fase 3): queda pendiente, salvo quien puede revisar y los de confianza
            var review = run.Settings.RequestReview && !unlimited
                && !await run.HasRoleAsync(run.Settings.Permissions.Review)
                && !await run.Services.GetRequiredService<SongRequestContributionService>().IsTrustedAsync(run.Config.UserId, run.Channel.Platform, run.Context.Username);
            var result = await run.Songs.AddAsync(run.Config, run.Requester, run.Args, unlimited, review: review, replyChannel: run.Context.Channel);
            if (!result.Success)
            {
                var vars = Vars(result.Track)
                    .With("number", run.Args.TrimStart('#').Trim())
                    .With("url", run.Songs.PublicQueueUrl(run.Config.ChannelName))
                    .With("max", result.ErrorKey switch
                    {
                        "too_long" => FormatDuration(run.Settings.MaxDurationSeconds),
                        "hour_limit" => run.Settings.MaxPerUserPerHour.ToString(),
                        _ => run.Settings.MaxPerUser.ToString()
                    })
                    .With("views", run.Settings.MinViews.ToString("N0"))
                    .With("minutes", run.Settings.NoRepeatMinutes.ToString());
                await run.ReplyAsync(result.ErrorKey!, vars);
                return;
            }

            if (result.Pending != null)
            {
                await run.ReplyAsync("pending_added", Vars(result.Track).With("position", result.Position.ToString()));
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

        /// <summary>!srclear: vacía la cola de pedidos (el que suena sigue). Sin confirmación: quien administra sabe lo que hace.</summary>
        private static async Task ClearAsync(Run run)
        {
            var removed = await run.Songs.ClearQueueAsync(run.Config);
            await run.ReplyAsync(removed == 0 ? "clear_none" : "cleared", new() { ["count"] = removed.ToString() });
        }

        /// <summary>!lastsong / !prevsong: la que sonó justo antes de la actual.</summary>
        private static async Task LastSongAsync(Run run)
        {
            var last = await run.Songs.GetLastPlayedAsync(run.Config.UserId);
            if (last?.Track == null)
            {
                await run.ReplyAsync("last_none");
                return;
            }
            var vars = Vars(last.Track);
            vars["requester"] = last.RequestedByName ?? "";
            vars["url"] = last.OriginUrl ?? SongResolverService.PublicUrlFor(last.Track);
            await run.ReplyAsync(last.RequestedPlatform == SongRequestPlatforms.Fallback ? "last_song_fallback" : "last_song", vars);
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

        /// <summary>!srpromote 3 sube el pedido #3 al primer lugar de la cola.</summary>
        private static async Task PromoteAsync(Run run)
        {
            if (!int.TryParse(run.Args.Split(' ', 2)[0].TrimStart('#'), out var position))
            {
                await run.ReplyAsync("promote_usage");
                return;
            }

            var promoted = await run.Songs.PromoteAtPositionAsync(run.Config, position);
            await run.ReplyAsync(promoted == null ? "promote_invalid" : "promoted",
                Vars(promoted).With("position", position.ToString()));
        }

        /// <summary>!srvideo / !srcover: el reproductor muestra el video o la portada, sin cortar la música.</summary>
        private static async Task SetVideoModeAsync(Run run, bool video)
        {
            await run.Songs.SetVideoModeAsync(run.Config, video);
            await run.ReplyAsync(video ? "video_on" : "cover_on");
        }

        /// <summary>
        /// !pladd [playlist] &lt;link o nombre&gt;: agrega a una playlist colaborativa (fase 2 de
        /// SONG_REQUEST_PLAYLISTS_PLAN.md). Los mods (permiso de saltar) agregan a cualquiera y sin requisitos.
        /// </summary>
        private static async Task PlaylistAddAsync(Run run)
        {
            var contributions = run.Services.GetRequiredService<SongRequestContributionService>();
            var privileged = run.Context.IsBroadcaster || await run.HasRoleAsync(run.Settings.Permissions.Skip);
            var playlists = await contributions.GetWritablePlaylistsAsync(run.Config.UserId, privileged);
            if (playlists.Count == 0)
            {
                await run.ReplyAsync("pl_none");
                return;
            }

            var names = string.Join(" · ", playlists.Select(p => p.Name));
            if (run.Args.Length == 0)
            {
                await run.ReplyAsync("pl_usage", new() { ["playlists"] = names });
                return;
            }
            var (playlist, input) = SongRequestContributionService.MatchPlaylist(playlists, run.Args);
            if (playlist == null || input.Length == 0)
            {
                await run.ReplyAsync(playlist == null ? "pl_which" : "pl_usage", new() { ["playlists"] = names });
                return;
            }

            var who = new SongRequestContributor(run.Channel.Platform, run.Context.UserId, run.Context.Username, run.Context.Username,
                run.RoleLevel, privileged || await run.HasControlTotalAsync());
            var result = await contributions.AddAsync(run.Config, playlist, who, input, replyChannel: run.Context.Channel);

            var vars = Vars(result.Track).With("playlist", playlist.Name);
            foreach (var (k, v) in result.Vars ?? new())
                vars[k] = k == "role" ? await run.RoleNameAsync(v) : v;
            if (!result.Success && result.ErrorKey is "too_long")
                vars["max"] = FormatDuration(run.Settings.MaxDurationSeconds);
            if (!result.Success && result.ErrorKey is "too_few_views")
                vars["views"] = run.Settings.MinViews.ToString("N0");
            await run.ReplyAsync(result.ErrorKey ?? (result.Pending ? "pl_pending" : "pl_added"), vars);
        }

        /// <summary>
        /// !srapprove [n] / !srreject [n]: decide el pendiente n (1 = el más viejo, el que va si no se dice).
        /// El aviso al viewer lo manda el servicio en su chat.
        /// </summary>
        private static async Task DecideAsync(Run run, bool approve)
        {
            var reviews = run.Services.GetRequiredService<SongRequestReviewService>();
            var number = int.TryParse(run.Args.Split(' ', 2)[0].TrimStart('#'), out var n) ? n : 1;
            var pending = await reviews.FindByNumberAsync(run.Config.UserId, number);
            if (pending == null)
            {
                await run.ReplyAsync("pending_none");
                return;
            }
            if (approve)
                await reviews.ApproveAsync(run.Config, pending);
            else
                await reviews.RejectAsync(run.Config, pending, notify: true);
        }

        /// <summary>!srplay &lt;playlist&gt; la pone a sonar con la cola vacía; !srplay off vuelve a la de respaldo.</summary>
        private static async Task<List<SongRequestPlaylist>> ChannelPlaylistsAsync(Run run) =>
            await run.Services.GetRequiredService<DecatronDbContext>().SongRequestPlaylists.AsNoTracking()
                .Where(p => p.UserId == run.Config.UserId)
                .OrderByDescending(p => p.Id == run.Config.ActivePlaylistId).ThenBy(p => p.CreatedAt).ThenBy(p => p.Id).ToListAsync();

        private static string Names(List<SongRequestPlaylist> playlists) => string.Join(" · ", playlists.Select(p => p.Name));

        /// <summary>
        /// !plplay (o !srplay): &lt;playlist&gt; la pone de fondo; #n salta a esa canción de la de fondo; &lt;playlist&gt; #n
        /// las dos cosas; off (o stop, parar…) al final la para, como !plstop.
        /// </summary>
        private static async Task PlayAsync(Run run)
        {
            var playlists = await ChannelPlaylistsAsync(run);
            var arg = run.Args.Trim();
            if (arg.Length == 0)
            {
                await run.ReplyAsync("play_usage", new() { ["playlists"] = Names(playlists) });
                return;
            }
            // El nombre exacto gana, aunque termine en "off" o en "#n"
            var exact = playlists.FirstOrDefault(p => string.Equals(p.Name, arg, StringComparison.OrdinalIgnoreCase));
            var lastWord = arg.Split(' ', StringSplitOptions.RemoveEmptyEntries)[^1];
            if (exact == null && OffWords.Contains(lastWord))
            {
                await PlaylistStopAsync(run);
                return;
            }

            // "#19", "# 19", "TEST #19"
            int? number = null;
            var name = arg;
            if (exact == null)
            {
                var m = JumpRegex.Match(arg);
                if (m.Success)
                {
                    number = int.Parse(m.Groups[2].Value);
                    name = m.Groups[1].Value.Trim();
                }
            }

            SongRequestPlaylist? playlist;
            if (exact != null)
                playlist = exact;
            else if (name.Length == 0)
            {
                playlist = playlists.FirstOrDefault(p => p.Id == run.Config.ActivePlaylistId);
                if (playlist == null)
                {
                    await run.ReplyAsync("pl_no_active");
                    return;
                }
            }
            else
                playlist = playlists.FirstOrDefault(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase))
                    ?? playlists.FirstOrDefault(p => p.Name.StartsWith(name, StringComparison.OrdinalIgnoreCase));
            if (playlist == null)
            {
                await run.ReplyAsync("play_usage", new() { ["playlists"] = Names(playlists) });
                return;
            }

            if (number == null)
            {
                await run.Songs.SetActivePlaylistAsync(run.Config, playlist.Id);
                await run.ReplyAsync("play_started", new() { ["playlist"] = playlist.Name });
                return;
            }

            var (result, track) = await run.Songs.JumpToAsync(run.Config, playlist, number.Value);
            var vars = Vars(track).With("number", number.Value.ToString()).With("playlist", playlist.Name)
                .With("url", run.Songs.PublicQueueUrl(run.Config.ChannelName));
            await run.ReplyAsync(result switch
            {
                SongRequestService.JumpResult.Now => "pl_jump_now",
                SongRequestService.JumpResult.AfterRequests => "pl_jump_after",
                SongRequestService.JumpResult.NoPlayer => "pl_jump_no_player",
                _ => "pl_number_invalid"
            }, vars);
        }

        private static readonly System.Text.RegularExpressions.Regex JumpRegex = new(@"^(.*?)#\s*(\d{1,5})$");

        /// <summary>!plstop: sin playlist de fondo; con la cola vacía no suena nada.</summary>
        private static async Task PlaylistStopAsync(Run run)
        {
            if (run.Config.ActivePlaylistId == null)
            {
                await run.ReplyAsync("play_already_off");
                return;
            }
            await run.Songs.SetActivePlaylistAsync(run.Config, null);
            await run.ReplyAsync("play_off");
        }

        /// <summary>!pl: cuál es la playlist de fondo y en qué número va.</summary>
        private static async Task PlaylistInfoAsync(Run run)
        {
            var status = await run.Songs.GetBackgroundStatusAsync(run.Config);
            if (status == null)
            {
                // Cualquiera puede usar !pl: solo se nombran las públicas
                var visible = (await ChannelPlaylistsAsync(run)).Where(p => p.Visibility == SongRequestPlaylistVisibility.Public).ToList();
                await run.ReplyAsync("pl_info_none", new() { ["playlists"] = visible.Count > 0 ? Names(visible) : "—" });
                return;
            }
            var (playlist, count, number) = status.Value;
            var vars = new Dictionary<string, string>
            {
                ["playlist"] = playlist.Name,
                ["count"] = count.ToString(),
                ["url"] = run.Songs.PublicQueueUrl(run.Config.ChannelName)
            };
            if (number != null)
                vars["number"] = number.Value.ToString();
            await run.ReplyAsync(number != null ? "pl_info" : "pl_info_idle", vars);
        }

        /// <summary>
        /// !playlist: el enlace a las playlists públicas; con un nombre, el de esa playlist. Las "solo con enlace" nunca salen
        /// acá (el chat es público): el streamer o un mod comparten ese enlace a mano.
        /// </summary>
        private static async Task PlaylistLinkAsync(Run run)
        {
            // "!playlist play test" no inicia nada: este comando solo da el enlace. Se orienta hacia !plplay / !plstop
            var words = run.Args.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
            if (words.Length > 0)
            {
                var first = words[0].ToLowerInvariant();
                if (first is "play" or "start" or "iniciar" or "inicia" or "poner" or "pon" or "reproducir" or "sonar")
                {
                    await run.ReplyAsync("playlist_link_play", new() { ["name"] = words.Length > 1 ? words[1].Trim() : "<playlist>" });
                    return;
                }
                if (first is "stop" or "parar" or "para" or "detener" or "off")
                {
                    await run.ReplyAsync("playlist_link_stop");
                    return;
                }
            }

            var baseUrl = run.Songs.PublicQueueUrl(run.Config.ChannelName);
            var visible = (await ChannelPlaylistsAsync(run)).Where(p => p.Visibility == SongRequestPlaylistVisibility.Public).ToList();
            if (visible.Count == 0)
            {
                await run.ReplyAsync("playlist_link_none");
                return;
            }

            if (run.Args.Length == 0)
            {
                await run.ReplyAsync("playlist_link", new() { ["playlists"] = Names(visible), ["url"] = $"{baseUrl}?tab=playlists" });
                return;
            }

            var wanted = run.Args.Trim();
            var match = visible.FirstOrDefault(p => p.Name.Equals(wanted, StringComparison.OrdinalIgnoreCase))
                ?? visible.FirstOrDefault(p => p.Name.StartsWith(wanted, StringComparison.OrdinalIgnoreCase));
            if (match == null)
            {
                await run.ReplyAsync("playlist_link_notfound", new() { ["playlists"] = Names(visible) });
                return;
            }
            await run.ReplyAsync("playlist_link_one", new() { ["playlist"] = match.Name, ["url"] = $"{baseUrl}/p/{match.ShareCode}" });
        }

        /// <summary>!plnext: la siguiente de la playlist; un pedido no se salta con esto (para eso !skip).</summary>
        private static async Task PlaylistNextAsync(Run run)
        {
            if (run.Config.ActivePlaylistId == null)
            {
                await run.ReplyAsync("pl_no_active");
                return;
            }
            if (!await run.Songs.NextInPlaylistAsync(run.Config))
                await run.ReplyAsync("pl_next_not_playlist");
        }

        /// <summary>!plshuffle [on|off]: la playlist de fondo al azar o en orden; sin nada, la cambia.</summary>
        private static async Task PlaylistShuffleAsync(Run run)
        {
            var arg = run.Args.Split(' ', 2)[0].ToLowerInvariant();
            bool? wanted = arg is "on" or "si" or "sí" ? true : OffWords.Contains(arg) ? false : null;
            var playlist = await run.Songs.GetRequestPlaylistAsync(run.Config);
            var result = await run.Songs.SetShuffleAsync(run.Config, wanted);
            if (result == null || playlist == null)
            {
                await run.ReplyAsync("pl_no_active");
                return;
            }
            await run.ReplyAsync(result.Value ? "pl_shuffle_on" : "pl_shuffle_off", new() { ["playlist"] = playlist.Name });
        }

        /// <summary>Lo que para la playlist de fondo con !plplay/!srplay, o apaga !plshuffle, en inglés y en español.</summary>
        private static readonly HashSet<string> OffWords = new(StringComparer.OrdinalIgnoreCase) { "off", "stop", "parar", "detener", "apagar" };

        /// <summary>Nombres que acepta !srmode, en inglés y en español.</summary>
        private static readonly Dictionary<string, string> ModeAliases = new(StringComparer.OrdinalIgnoreCase)
        {
            ["open"] = "open", ["abierto"] = "open", ["abiertos"] = "open",
            ["playlists"] = "playlists", ["playlist"] = "playlists",
            ["review"] = "review", ["revision"] = "review", ["revisión"] = "review",
            ["closed"] = "closed", ["close"] = "closed", ["cerrado"] = "closed", ["cerrados"] = "closed"
        };

        /// <summary>!srmode open|playlists|review|closed: cambia el modo de pedidos (fase 5). Sin nada, dice el actual.</summary>
        private static async Task ModeAsync(Run run)
        {
            var arg = run.Args.Split(' ', 2)[0];
            if (arg.Length == 0 || !ModeAliases.TryGetValue(arg, out var mode))
            {
                var currentMode = SongRequestService.ModeOf(run.Config, run.Settings);
                await run.ReplyAsync("mode_usage", new() { ["mode"] = await run.ModeNameAsync(currentMode) });
                return;
            }
            await run.Songs.SetModeAsync(run.Config, mode);
            await run.ReplyAsync("mode_set", new() { ["mode"] = await run.ModeNameAsync(mode) });
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

        /// <summary>!srvolume dice el volumen (quien puede pedir); !srvolume 40 lo cambia (quien puede administrar).</summary>
        private static async Task VolumeAsync(Run run)
        {
            if (run.Args.Length == 0)
            {
                if (await run.HasRoleAsync(run.Settings.Permissions.Request))
                    await run.ReplyAsync("volume_current", new() { ["volume"] = run.Config.Volume.ToString() });
                return;
            }

            if (!await run.HasRoleAsync(run.Settings.Permissions.Manage))
                return;
            if (!int.TryParse(run.Args.Split(' ', 2)[0].TrimEnd('%'), out var volume) || volume is < 0 or > 100)
            {
                await run.ReplyAsync("volume_usage");
                return;
            }

            await run.Songs.SetVolumeAsync(run.Config, volume);
            await run.ReplyAsync("volume_set", new() { ["volume"] = volume.ToString() });
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

            /// <summary>0 everyone, 1 sub, 2 vip, 3 mod, 4 lead mod, 5 streamer (el orden de RoleOrder).</summary>
            public int RoleLevel => Context.IsBroadcaster ? 5
                : Context.IsLeadModerator ? 4
                : Context.IsModerator ? 3
                : Context.IsVip ? 2
                : Context.IsSubscriber ? 1
                : 0;

            /// <summary>El nombre del modo de pedidos en el idioma del canal.</summary>
            public async Task<string> ModeNameAsync(string mode)
            {
                var name = await GetTemplateAsync($"mode_{mode}");
                return string.IsNullOrWhiteSpace(name) ? mode : name;
            }

            /// <summary>El nombre del rol en el idioma del canal, para los mensajes.</summary>
            public async Task<string> RoleNameAsync(string role)
            {
                var name = await GetTemplateAsync($"role_{role}");
                return string.IsNullOrWhiteSpace(name) ? role : name;
            }

            public async Task<bool> HasRoleAsync(string requiredRole)
            {
                var required = Array.IndexOf(RoleOrder, requiredRole);
                if (required <= 0)
                    return true;

                if (RoleLevel >= required)
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
