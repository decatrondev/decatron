using System.Collections.Concurrent;
using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;

namespace Decatron.Services.Multiview
{
    /// <summary>
    /// Hub público del chat del Multi-view (/hubs/multiview). El navegador dice qué canales mira
    /// (<c>Follow(["twitch:canal","kick:canal"])</c>, como máximo 12) y recibe <c>History</c> al empezar y <c>Message</c>
    /// por cada mensaje nuevo. Solo lectura y sin sesión: escribir y moderar llegan en las fases siguientes.
    /// </summary>
    public sealed class MultiviewChatHub : Hub
    {
        private static readonly ConcurrentDictionary<string, HashSet<string>> Following = new();
        private readonly MultiviewChatService _chat;
        private readonly MultiviewSendService _send;
        private readonly MultiviewAccountService _accounts;
        private readonly TwitchPresenceService _presence;
        private readonly MultiviewModerationService _moderation;

        public MultiviewChatHub(MultiviewChatService chat, MultiviewSendService send, MultiviewAccountService accounts, TwitchPresenceService presence, MultiviewModerationService moderation)
        {
            _moderation = moderation;
            _chat = chat;
            _send = send;
            _accounts = accounts;
            _presence = presence;
        }

        /// <summary>La persona que inició sesión (el token viaja al conectar); null si mira sin cuenta.</summary>
        private long? CurrentUserId() =>
            long.TryParse(Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;

        /// <summary>Qué cuentas tiene vinculadas quien mira (para saber dónde puede escribir).</summary>
        public async Task<object> Me()
        {
            var id = CurrentUserId();
            if (id == null) return new { authenticated = false, twitch = (string?)null, kick = (string?)null };
            var linked = await _accounts.GetLinkedAsync(id.Value);
            return new { authenticated = true, twitch = linked.TwitchLogin, kick = linked.KickLogin };
        }

        /// <summary>Modera un canal abierto como quien mira (borrar, timeout, ban, quitar sanción); solo si es moderador o dueña del canal.</summary>
        public Task<SendResult> Moderate(ModRequest request) =>
            _moderation.ModerateAsync(CurrentUserId(), request, Context.ConnectionAborted);

        /// <summary>Escribe en el chat de un canal abierto, como quien mira (con su token). <c>replyTo</c> = id del mensaje al que responde.</summary>
        public Task<SendResult> Send(string key, string text, string? replyTo) =>
            _send.SendAsync(CurrentUserId(), (key ?? "").Trim().ToLowerInvariant(), text, replyTo, Context.ConnectionAborted);

        /// <summary>
        /// Fija la lista completa de canales de esta pestaña; devuelve cuántos se aceptaron. Con <c>present</c> y sesión
        /// iniciada, la persona también queda conectada al chat de esos canales de Twitch (aparece en su lista).
        /// </summary>
        public async Task<int> Follow(string[] keys, bool present)
        {
            var wanted = (keys ?? Array.Empty<string>())
                .Select(k => (k ?? "").Trim().ToLowerInvariant())
                .Where(k => MultiviewChatService.TryParseKey(k, out _, out _))
                .Distinct()
                .Take(MultiviewChatService.MaxPerConnection)
                .ToHashSet();

            var current = Following.GetOrAdd(Context.ConnectionId, _ => new HashSet<string>());
            string[] add, remove;
            lock (current)
            {
                add = wanted.Except(current).ToArray();
                remove = current.Except(wanted).ToArray();
                current.Clear();
                current.UnionWith(wanted);
            }

            foreach (var key in remove)
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, key);
                _chat.Release(key);
            }
            foreach (var key in add)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, key);
                _chat.Acquire(key);
                await Clients.Caller.SendAsync("History", key, _chat.GetHistory(key));
            }

            var userId = CurrentUserId();
            if (userId != null)
            {
                var twitch = present ? wanted.Where(k => k.StartsWith("twitch:", StringComparison.Ordinal)).Select(k => k[7..]).ToArray() : Array.Empty<string>();
                _presence.Update(userId.Value, Context.ConnectionId, twitch);

                // Roles ya conocidos de Twitch (los nuevos llegan solos cuando Twitch los manda) y los de Kick.
                foreach (var (channel, role) in _presence.GetRoles(userId.Value, twitch))
                    if (role != "none") await Clients.Caller.SendAsync("Role", $"twitch:{channel}", role);
                foreach (var key in add.Where(k => k.StartsWith("kick:", StringComparison.Ordinal)))
                    _ = _moderation.NotifyKickRoleAsync(userId.Value, Context.ConnectionId, key, key[5..]);
            }
            return wanted.Count;
        }

        public override Task OnDisconnectedAsync(Exception? exception)
        {
            if (CurrentUserId() is { } uid) _presence.Remove(uid, Context.ConnectionId);
            if (Following.TryRemove(Context.ConnectionId, out var keys))
            {
                string[] left;
                lock (keys) left = keys.ToArray();
                foreach (var key in left) _chat.Release(key);
            }
            return base.OnDisconnectedAsync(exception);
        }
    }
}
