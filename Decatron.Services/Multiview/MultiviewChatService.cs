using System.Collections.Concurrent;
using System.Text.Json;
using Decatron.Services.ChatOverlay;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Multiview
{
    /// <summary>
    /// Reparte el chat de los canales que alguien tiene abiertos en el Multi-view. Cuenta cuántos espectadores miran
    /// cada canal (clave «twitch:login» o «kick:slug»): al primero se une al chat, al último sale. Cada mensaje se
    /// traduce al formato del chat en pantalla y sale por SignalR al grupo de ese canal; además guarda los últimos
    /// para que quien llega no vea un chat vacío. Plan: .dev/plans/MULTIVIEW_PLAN.md, Fase 2.
    /// </summary>
    public sealed class MultiviewChatService : BackgroundService
    {
        public const int HistorySize = 40;
        public const int MaxPerConnection = MultiviewTierLimits.HardMaxSlots;

        private readonly IHubContext<MultiviewChatHub> _hub;
        private readonly MultiviewStatusService _status;
        private readonly MultiviewChatMapper _mapper;
        private readonly ILogger<MultiviewChatService> _logger;
        private readonly TwitchIrcReader _twitch;
        private readonly KickPusherReader _kick;

        private readonly object _gate = new();
        private readonly Dictionary<string, int> _refs = new();
        private readonly ConcurrentDictionary<string, long> _kickRooms = new();
        private readonly ConcurrentDictionary<string, string> _twitchRoomIds = new();
        private readonly ConcurrentDictionary<string, LinkedList<ChatOverlayMessage>> _history = new();
        private readonly ConcurrentDictionary<string, CancellationTokenSource> _kickResolvers = new();

        public MultiviewChatService(IHubContext<MultiviewChatHub> hub, MultiviewStatusService status, MultiviewChatMapper mapper, ILogger<MultiviewChatService> logger)
        {
            _hub = hub;
            _status = status;
            _mapper = mapper;
            _logger = logger;
            _twitch = new TwitchIrcReader(OnTwitchLineAsync, logger);
            _kick = new KickPusherReader(OnKickEventAsync, logger);
        }

        public static bool TryParseKey(string? key, out string platform, out string channel)
        {
            platform = channel = "";
            if (string.IsNullOrEmpty(key)) return false;
            var i = key.IndexOf(':');
            if (i <= 0) return false;
            platform = key[..i];
            channel = key[(i + 1)..];
            return platform is "twitch" or "kick" && MultiviewStatusService.IsValidSlug(channel) && channel.Length >= 2 && channel == channel.ToLowerInvariant();
        }

        protected override Task ExecuteAsync(CancellationToken stoppingToken) =>
            Task.WhenAll(_twitch.RunAsync(stoppingToken), _kick.RunAsync(stoppingToken));

        public void Acquire(string key)
        {
            if (!TryParseKey(key, out var platform, out var channel)) return;
            bool first;
            lock (_gate) { _refs.TryGetValue(key, out var n); _refs[key] = n + 1; first = n == 0; }
            if (!first) return;
            if (platform == "twitch") _twitch.Join(channel);
            else StartKickResolver(key, channel);
        }

        public void Release(string key)
        {
            if (!TryParseKey(key, out var platform, out var channel)) return;
            bool last;
            lock (_gate)
            {
                if (!_refs.TryGetValue(key, out var n)) return;
                last = n <= 1;
                if (last) _refs.Remove(key); else _refs[key] = n - 1;
            }
            if (!last) return;
            if (platform == "twitch") _twitch.Part(channel);
            else
            {
                if (_kickResolvers.TryRemove(key, out var cts)) cts.Cancel();
                if (_kickRooms.TryRemove(key, out var room)) _kick.Unsubscribe(room);
            }
            _history.TryRemove(key, out _);
        }

        /// <summary>El id numérico de un canal de Twitch, conocido al unirse (ROOMSTATE) o con su primer mensaje.</summary>
        public string? TryGetTwitchRoomId(string login) => _twitchRoomIds.TryGetValue(login, out var id) ? id : null;

        public IReadOnlyList<ChatOverlayMessage> GetHistory(string key)
        {
            if (!_history.TryGetValue(key, out var list)) return Array.Empty<ChatOverlayMessage>();
            lock (list) return list.ToList();
        }

        // Kick: hay que averiguar el id de la sala; si Kick no responde se reintenta mientras alguien lo mire.
        private void StartKickResolver(string key, string slug)
        {
            var cts = new CancellationTokenSource();
            _kickResolvers[key] = cts;
            _ = Task.Run(async () =>
            {
                while (!cts.IsCancellationRequested)
                {
                    var info = await _status.GetKickAsync(slug, cts.Token);
                    if (info is { Exists: true, ChatroomId: { } room })
                    {
                        _kickRooms[key] = room;
                        _kick.Subscribe(room, new KickPusherReader.Room(key, slug, info.UserId));
                        return;
                    }
                    if (info is { Exists: false }) return;
                    try { await Task.Delay(TimeSpan.FromSeconds(20), cts.Token); } catch (OperationCanceledException) { return; }
                }
            });
        }

        private async Task OnTwitchLineAsync(IrcLine line)
        {
            switch (line.Command)
            {
                case "ROOMSTATE" when line.Params.Length > 0 && line.Tag("room-id").Length > 0:
                    _twitchRoomIds[line.Params[0].TrimStart('#').ToLowerInvariant()] = line.Tag("room-id");
                    break;
                case "PRIVMSG":
                    if (line.Params.Length > 0 && line.Tag("room-id").Length > 0)
                        _twitchRoomIds[line.Params[0].TrimStart('#').ToLowerInvariant()] = line.Tag("room-id");
                    var msg = await _mapper.FromTwitchAsync(line);
                    if (msg != null) await PublishAsync($"twitch:{msg.Channel.Login}", msg);
                    break;
                case "CLEARMSG" when line.Params.Length > 0:
                    await _hub.Clients.Group($"twitch:{line.Params[0].TrimStart('#').ToLowerInvariant()}")
                        .SendAsync("Deleted", $"twitch:{line.Params[0].TrimStart('#').ToLowerInvariant()}", line.Tag("target-msg-id"), null);
                    break;
                case "CLEARCHAT" when line.Params.Length > 0:
                    var key = $"twitch:{line.Params[0].TrimStart('#').ToLowerInvariant()}";
                    await _hub.Clients.Group(key).SendAsync("Deleted", key, null, line.Trailing?.ToLowerInvariant() ?? "");
                    break;
            }
        }

        private async Task OnKickEventAsync(string ev, KickPusherReader.Room room, JsonElement data)
        {
            if (ev.EndsWith("ChatMessageEvent", StringComparison.Ordinal))
            {
                var msg = await _mapper.FromKickAsync(data, room.Slug, room.UserId);
                if (msg != null) await PublishAsync(room.Key, msg);
            }
            else if (ev.EndsWith("MessageDeletedEvent", StringComparison.Ordinal))
            {
                string? id = null;
                if (data.TryGetProperty("message", out var m) && m.ValueKind == JsonValueKind.Object && m.TryGetProperty("id", out var mid)) id = mid.GetString();
                id ??= data.TryGetProperty("id", out var did) ? did.GetString() : null;
                if (!string.IsNullOrEmpty(id)) await _hub.Clients.Group(room.Key).SendAsync("Deleted", room.Key, id, null);
            }
            else if (ev.EndsWith("UserBannedEvent", StringComparison.Ordinal)
                && data.TryGetProperty("user", out var u) && u.ValueKind == JsonValueKind.Object && u.TryGetProperty("username", out var un))
            {
                await _hub.Clients.Group(room.Key).SendAsync("Deleted", room.Key, null, (un.GetString() ?? "").ToLowerInvariant());
            }
        }

        private async Task PublishAsync(string key, ChatOverlayMessage msg)
        {
            var list = _history.GetOrAdd(key, _ => new LinkedList<ChatOverlayMessage>());
            lock (list) { list.AddLast(msg); while (list.Count > HistorySize) list.RemoveFirst(); }
            await _hub.Clients.Group(key).SendAsync("Message", key, msg);
        }
    }
}
