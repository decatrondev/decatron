using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Multiview
{
    /// <summary>
    /// Lector del chat de Kick por el WebSocket público de Pusher que usa su propia web (no es la API oficial: puede
    /// cambiar sin aviso, por eso vive aislado aquí). Una conexión; cada sala es una suscripción
    /// <c>chatrooms.{id}.v2</c>. Verificado el 2026-10-11: sin sesión, los mensajes llegan con color, insignias con
    /// imagen y emotes como <c>[emote:id:nombre]</c>.
    /// </summary>
    internal sealed class KickPusherReader : SocketLoop
    {
        private const string AppKey = "32cbd69e4b950bf97679";

        public sealed record Room(string Key, string Slug, long? UserId);

        private readonly object _gate = new();
        private readonly Dictionary<long, Room> _rooms = new();
        private readonly Func<string, Room, JsonElement, Task> _onEvent;

        public KickPusherReader(Func<string, Room, JsonElement, Task> onEvent, ILogger logger) : base(logger) { _onEvent = onEvent; }

        protected override string Name => "Kick Pusher";
        protected override Uri Url => new($"wss://ws-us2.pusher.com/app/{AppKey}?protocol=7&client=js&version=8.4.0&flash=false");

        public void Subscribe(long chatroomId, Room room)
        {
            lock (_gate) { if (_rooms.ContainsKey(chatroomId)) return; _rooms[chatroomId] = room; }
            _ = SendAsync(SubscribeFrame(chatroomId));
        }

        public void Unsubscribe(long chatroomId)
        {
            lock (_gate) { if (!_rooms.Remove(chatroomId)) return; }
            _ = SendAsync(JsonSerializer.Serialize(new { @event = "pusher:unsubscribe", data = new { channel = $"chatrooms.{chatroomId}.v2" } }));
        }

        private static string SubscribeFrame(long id) =>
            JsonSerializer.Serialize(new { @event = "pusher:subscribe", data = new { auth = "", channel = $"chatrooms.{id}.v2" } });

        protected override async Task OnOpenAsync(CancellationToken ct)
        {
            long[] ids;
            lock (_gate) ids = _rooms.Keys.ToArray();
            foreach (var id in ids) await SendAsync(SubscribeFrame(id), ct);
        }

        protected override async Task OnTextAsync(string text, CancellationToken ct)
        {
            using var doc = JsonDocument.Parse(text);
            var root = doc.RootElement;
            var ev = root.TryGetProperty("event", out var e) ? e.GetString() ?? "" : "";
            if (ev == "pusher:ping") { await SendAsync("{\"event\":\"pusher:pong\",\"data\":{}}", ct); return; }
            if (ev.StartsWith("pusher", StringComparison.Ordinal)) return;
            if (!root.TryGetProperty("channel", out var ch) || ch.GetString() is not { } channel) return;
            // chatrooms.{id}.v2
            var parts = channel.Split('.');
            if (parts.Length != 3 || !long.TryParse(parts[1], out var id)) return;
            Room? room;
            lock (_gate) _rooms.TryGetValue(id, out room);
            if (room == null || !root.TryGetProperty("data", out var data)) return;

            // «data» llega como texto con JSON dentro
            using var inner = data.ValueKind == JsonValueKind.String ? JsonDocument.Parse(data.GetString() ?? "{}") : null;
            await _onEvent(ev, room, inner?.RootElement ?? data);
        }
    }
}
