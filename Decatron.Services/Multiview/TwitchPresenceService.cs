using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Multiview
{
    /// <summary>
    /// Mantiene a quien mira conectado al chat de los canales de Twitch que tiene abiertos, como lo haría la página de
    /// Twitch: así aparece en la lista de conectados del canal. Una conexión de IRC por persona (con su propio token,
    /// el mismo permiso de chat con el que ya inició sesión) mientras tenga alguna pestaña abierta; no lee mensajes
    /// (eso ya lo hace el lector anónimo) y se cierra sola al cerrar la última pestaña. Solo Twitch: Kick no tiene
    /// lista de conectados pública.
    /// </summary>
    public sealed class TwitchPresenceService
    {
        private sealed class Session
        {
            public readonly object Gate = new();
            public readonly Dictionary<string, HashSet<string>> ByConnection = new();
            public CancellationTokenSource Cts = new();
            public PresenceIrc? Irc;
            /// <summary>Rol de la persona en cada canal, según el USERSTATE que manda Twitch al unirse: mod | broadcaster | none.</summary>
            public readonly ConcurrentDictionary<string, string> Roles = new();
        }

        private readonly MultiviewAccountService _accounts;
        private readonly IHubContext<MultiviewChatHub> _hub;
        private readonly ILogger<TwitchPresenceService> _logger;
        private readonly ConcurrentDictionary<long, Session> _sessions = new();

        public TwitchPresenceService(MultiviewAccountService accounts, IHubContext<MultiviewChatHub> hub, ILogger<TwitchPresenceService> logger)
        {
            _accounts = accounts;
            _hub = hub;
            _logger = logger;
        }

        /// <summary>El rol de la persona en un canal de Twitch, si ya se conoce («mod», «broadcaster» o «none»).</summary>
        public string? GetRole(long userId, string channel) =>
            _sessions.TryGetValue(userId, out var s) && s.Roles.TryGetValue(channel, out var r) ? r : null;

        /// <summary>Roles ya conocidos de los canales dados (para avisar a una pestaña que acaba de abrirse).</summary>
        public IReadOnlyDictionary<string, string> GetRoles(long userId, IEnumerable<string> channels)
        {
            var result = new Dictionary<string, string>();
            if (!_sessions.TryGetValue(userId, out var s)) return result;
            foreach (var c in channels) if (s.Roles.TryGetValue(c, out var r)) result[c] = r;
            return result;
        }

        private async Task OnRoleAsync(long userId, Session s, string channel, string role)
        {
            s.Roles[channel] = role;
            string[] connections;
            lock (s.Gate) connections = s.ByConnection.Where(kv => kv.Value.Contains(channel)).Select(kv => kv.Key).ToArray();
            if (connections.Length > 0)
                await _hub.Clients.Clients(connections).SendAsync("Role", $"twitch:{channel}", role);
        }

        /// <summary>Canales de Twitch que esta pestaña tiene abiertos (lista vacía = salir de todos).</summary>
        public void Update(long userId, string connectionId, IReadOnlyCollection<string> twitchChannels)
        {
            if (twitchChannels.Count == 0) { Remove(userId, connectionId); return; }
            var s = _sessions.GetOrAdd(userId, _ => new Session());
            lock (s.Gate)
            {
                s.ByConnection[connectionId] = new HashSet<string>(twitchChannels);
                if (s.Irc == null)
                {
                    var session = s;
                    var irc = new PresenceIrc(() => _accounts.GetTwitchAsync(userId), s.Cts, (c, r) => OnRoleAsync(userId, session, c, r), _logger);
                    s.Irc = irc;
                    _ = Task.Run(() => irc.RunAsync(s.Cts.Token));
                }
                s.Irc.SetChannels(Union(s));
            }
        }

        public void Remove(long userId, string connectionId)
        {
            if (!_sessions.TryGetValue(userId, out var s)) return;
            lock (s.Gate)
            {
                s.ByConnection.Remove(connectionId);
                if (s.ByConnection.Count > 0) { s.Irc?.SetChannels(Union(s)); return; }
                s.Cts.Cancel();
                _sessions.TryRemove(userId, out _);
            }
        }

        private static HashSet<string> Union(Session s)
        {
            var all = new HashSet<string>();
            foreach (var set in s.ByConnection.Values) all.UnionWith(set);
            return all;
        }
    }

    /// <summary>La conexión de IRC de una persona. Solo mantiene la presencia: ignora lo que recibe, salvo PING y el rechazo del token.</summary>
    internal sealed class PresenceIrc : SocketLoop
    {
        private readonly Func<Task<TwitchIdentity?>> _identity;
        private readonly CancellationTokenSource _owner;
        private readonly Func<string, string, Task> _onRole;
        private readonly object _gate = new();
        private HashSet<string> _channels = new();

        public PresenceIrc(Func<Task<TwitchIdentity?>> identity, CancellationTokenSource owner, Func<string, string, Task> onRole, ILogger logger) : base(logger)
        {
            _identity = identity;
            _owner = owner;
            _onRole = onRole;
        }

        /// <summary>Quien puede moderar: broadcaster, moderador y moderador principal (lead_moderator); el resto, none.</summary>
        internal static string RoleFromBadges(string badges)
        {
            if (string.IsNullOrEmpty(badges)) return "none";
            var sets = badges.Split(',').Select(b => b.Split('/')[0]).ToHashSet();
            if (sets.Contains("broadcaster")) return "broadcaster";
            return sets.Contains("moderator") || sets.Contains("lead_moderator") ? "mod" : "none";
        }

        protected override string Name => "Twitch IRC (presencia)";
        protected override Uri Url => new("wss://irc-ws.chat.twitch.tv:443");

        public void SetChannels(HashSet<string> wanted)
        {
            string[] join, part;
            lock (_gate)
            {
                join = wanted.Except(_channels).ToArray();
                part = _channels.Except(wanted).ToArray();
                _channels = wanted;
            }
            foreach (var c in part) _ = SendAsync($"PART #{c}");
            foreach (var c in join) _ = SendAsync($"JOIN #{c}");
        }

        protected override async Task OnOpenAsync(CancellationToken ct)
        {
            var me = await _identity();
            if (me == null) { _owner.Cancel(); return; }
            // Con las etiquetas, Twitch manda USERSTATE al unirse: trae las insignias de la persona en ese canal.
            await SendAsync("CAP REQ :twitch.tv/tags twitch.tv/commands", ct);
            await SendAsync($"PASS oauth:{me.Token}", ct);
            await SendAsync($"NICK {me.Login.ToLowerInvariant()}", ct);
            string[] pending;
            lock (_gate) pending = _channels.ToArray();
            for (var i = 0; i < pending.Length; i++)
            {
                await SendAsync($"JOIN #{pending[i]}", ct);
                if ((i + 1) % 10 == 0) await Task.Delay(TimeSpan.FromSeconds(11), ct);
            }
        }

        protected override async Task OnTextAsync(string text, CancellationToken ct)
        {
            foreach (var raw in text.Split("\r\n", StringSplitOptions.RemoveEmptyEntries))
            {
                if (raw.StartsWith("PING", StringComparison.Ordinal)) { await SendAsync("PONG :tmi.twitch.tv", ct); continue; }
                if (raw.Contains(" USERSTATE ", StringComparison.Ordinal))
                {
                    var line = IrcLine.Parse(raw);
                    if (line is { Command: "USERSTATE" } && line.Params.Length > 0)
                        await _onRole(line.Params[0].TrimStart('#').ToLowerInvariant(), RoleFromBadges(line.Tag("badges")));
                    continue;
                }
                // Token vencido o sin el permiso de chat: no se insiste (se vuelve a intentar al reabrir la pestaña).
                if (raw.Contains("Login authentication failed", StringComparison.Ordinal) || raw.Contains("Improperly formatted auth", StringComparison.Ordinal))
                {
                    Logger.LogInformation("[Multiview] Twitch rechazó el token de presencia de un usuario");
                    _owner.Cancel();
                    return;
                }
            }
        }
    }
}
