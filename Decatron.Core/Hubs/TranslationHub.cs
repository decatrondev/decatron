using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace Decatron.Hubs
{
    /// <summary>
    /// Lo que la extensión del espectador escucha cuando entra a un grupo.
    /// Solo lo implementa el gestor de sesiones; el hub en sí no manda nada.
    /// </summary>
    public interface ITranslationListenerNotifier
    {
        /// <summary>Un espectador entró o salió del idioma de un canal. Devuelve el estado actual para responderle.</summary>
        Task<object> OnListenerChangedAsync(string login, string lang, int listeners, bool joined);
    }

    /// <summary>
    /// SignalR para la traducción en vivo. Anónimo a propósito: el espectador no necesita
    /// cuenta para escuchar. El grupo es <c>lt:{login}:{lang}</c>; el servidor manda
    /// <c>Status</c>, <c>SegmentStart</c>/<c>SegmentChunk</c>/<c>SegmentEnd</c> y
    /// <c>SegmentDropped</c>. Los contadores son estáticos, igual que en OverlayHub, para
    /// que el gestor sepa si vale la pena traducir a un idioma (sin oyentes no se gasta).
    /// </summary>
    public class TranslationHub : Hub
    {
        private readonly ILogger<TranslationHub> _logger;
        private readonly ITranslationListenerNotifier _notifier;
        private readonly ITranslationAccessGate _gate;
        private readonly IViewerIdentityResolver _viewers;

        private static readonly ConcurrentDictionary<string, (string Login, string Lang)> _connections = new();
        // IP de cada conexión que escucha, y los intentos de entrada recientes por IP (límites contra abuso)
        private static readonly ConcurrentDictionary<string, string> _ips = new();
        // Quién es (si inició sesión) cada conexión que escucha: permite topar las conexiones por persona
        private static readonly ConcurrentDictionary<string, long> _users = new();
        private static readonly ConcurrentDictionary<string, Queue<DateTime>> _attempts = new();

        /// <summary>Intentos de Join por IP por minuto.</summary>
        public const int AttemptsPerMinute = 20;
        /// <summary>Conexiones que puede tener una misma IP escuchando (en todos los canales juntos).</summary>
        public const int MaxConnectionsPerIpGlobal = 6;
        /// <summary>Tope de conexiones escuchando en todo el servidor, por si algo se desborda.</summary>
        public const int MaxListeningConnections = 3000;

        public static string GroupName(string login, string lang) => $"lt:{login.ToLowerInvariant()}:{lang.ToLowerInvariant()}";

        public static int CountListeners(string login, string lang) =>
            _connections.Values.Count(v => v.Login == login.ToLowerInvariant() && v.Lang == lang.ToLowerInvariant());

        public static int CountListeners(string login) =>
            _connections.Values.Count(v => v.Login == login.ToLowerInvariant());

        public static IReadOnlyDictionary<string, int> ListenersByLanguage(string login) =>
            _connections.Values.Where(v => v.Login == login.ToLowerInvariant())
                .GroupBy(v => v.Lang).ToDictionary(g => g.Key, g => g.Count());

        public TranslationHub(ILogger<TranslationHub> logger, ITranslationListenerNotifier notifier, ITranslationAccessGate gate, IViewerIdentityResolver viewers)
        {
            _logger = logger;
            _notifier = notifier;
            _gate = gate;
            _viewers = viewers;
        }

        /// <summary>
        /// Al conectar se reconoce a quien inició sesión: con la sesión normal de decatron.net (Multi-view) o con el token de espectador
        /// de la extensión (<c>?access_token=</c>). Un token vencido, revocado o inválido no es un error: la conexión sigue como anónima.
        /// </summary>
        public override async Task OnConnectedAsync()
        {
            try
            {
                var token = Context.GetHttpContext()?.Request.Query["access_token"].ToString();
                var who = await _viewers.ResolveAsync(token, Context.User);
                if (who != null) Context.Items["viewer"] = who;
            }
            catch (Exception ex) { _logger.LogDebug(ex, "[LiveTranslation] No se pudo reconocer al espectador"); }
            await base.OnConnectedAsync();
        }

        /// <summary>Quién ve el servidor al otro lado: sirve para saber si la sesión de la extensión sigue valiendo.</summary>
        public object Whoami() =>
            Context.Items["viewer"] is ViewerIdentity v ? new { identified = true, login = v.Login } : new { identified = false, login = (string?)null };

        /// <summary>La IP real de quien se conecta (nginx la pasa en X-Forwarded-For).</summary>
        private string ClientIp()
        {
            var http = Context.GetHttpContext();
            var forwarded = http?.Request.Headers["X-Forwarded-For"].ToString();
            var ip = !string.IsNullOrWhiteSpace(forwarded) ? forwarded.Split(',')[0].Trim() : http?.Connection.RemoteIpAddress?.ToString();
            return string.IsNullOrEmpty(ip) ? "unknown" : ip;
        }

        private static bool AllowAttempt(string ip)
        {
            var q = _attempts.GetOrAdd(ip, _ => new Queue<DateTime>());
            var now = DateTime.UtcNow;
            lock (q)
            {
                while (q.Count > 0 && now - q.Peek() > TimeSpan.FromMinutes(1)) q.Dequeue();
                if (q.Count >= AttemptsPerMinute) return false;
                q.Enqueue(now);
                return true;
            }
        }

        private static object Denied(string reason) => new { ok = false, error = "denied", reason, active = false };

        /// <summary>
        /// Los límites duros contra abuso: el costo de la traducción lo marcan los IDIOMAS encendidos (cada uno con un oyente gasta
        /// voz y traducción del streamer), no el número de oyentes, así que además de topar oyentes se topean los idiomas a la vez
        /// y las conexiones por IP. Devuelve el motivo del rechazo o null si puede entrar.
        /// </summary>
        private static string? CheckLimits(TranslationLimits? limits, string login, string lang, string ip, long? userId)
        {
            var mine = _connections.Where(kv => kv.Value.Login == login).Select(kv => kv.Value.Lang).ToList();
            var ipAll = _ips.Count(kv => kv.Value == ip && _connections.ContainsKey(kv.Key));
            if (ipAll >= MaxConnectionsPerIpGlobal) return "ip_limit";
            if (_connections.Count >= MaxListeningConnections) return "busy";
            if (limits == null) return null;
            if (limits.Paused) return "paused";
            // Solo se puede pedir un idioma que el canal ofrece: si no, alguien podría ocupar los cupos de idiomas con códigos inventados.
            if (!limits.Languages.Contains(lang, StringComparer.OrdinalIgnoreCase)) return "language";
            var ipHere = _ips.Count(kv => kv.Value == ip && _connections.TryGetValue(kv.Key, out var c) && c.Login == login);
            if (ipHere >= limits.MaxConnectionsPerIp) return "ip_limit";
            // Una misma persona (con sesión) tiene un máximo de conexiones escuchando el canal, en el navegador que sea
            if (userId != null)
            {
                var userHere = _users.Count(kv => kv.Value == userId && _connections.TryGetValue(kv.Key, out var c) && c.Login == login);
                if (userHere >= limits.MaxConnectionsPerUser) return "user_limit";
            }
            if (mine.Count >= limits.MaxListenersTotal) return "full";
            if (mine.Count(l => l == lang) >= limits.MaxListenersPerLanguage) return "full";
            // Un idioma nuevo solo se enciende si hay lugar entre los idiomas activos.
            var active = mine.Distinct().ToList();
            if (!active.Contains(lang) && active.Count >= limits.MaxActiveLanguages) return "languages_full";
            return null;
        }

        /// <summary>El botón de pánico: saca a todos los que escuchan un canal y les avisa el motivo.</summary>
        public static async Task EvictChannelAsync(IHubContext<TranslationHub> hub, string login, string reason)
        {
            login = login.ToLowerInvariant();
            foreach (var (connId, cur) in _connections.Where(kv => kv.Value.Login == login).ToList())
            {
                if (!_connections.TryRemove(connId, out _)) continue;
                _ips.TryRemove(connId, out _);
                _users.TryRemove(connId, out _);
                try
                {
                    await hub.Groups.RemoveFromGroupAsync(connId, GroupName(cur.Login, cur.Lang));
                    await hub.Clients.Client(connId).SendAsync("Denied", new { reason });
                }
                catch { /* la conexión ya se cerró */ }
            }
        }

        /// <summary>El espectador eligió un idioma para un canal. Devuelve el estado del canal.</summary>
        public async Task<object> Join(string login, string lang)
        {
            login = (login ?? "").Trim().ToLowerInvariant();
            lang = (lang ?? "").Trim().ToLowerInvariant();
            if (login.Length is 0 or > 40 || lang.Length is 0 or > 10)
                return new { ok = false, error = "invalid" };

            var ip = ClientIp();
            if (!AllowAttempt(ip)) return Denied("rate_limited");

            await LeaveCurrentAsync();

            var who = Context.Items["viewer"] as ViewerIdentity;
            var reason = CheckLimits(await _gate.GetLimitsAsync(login), login, lang, ip, who?.UserId);
            if (reason != null)
            {
                _logger.LogInformation("[LiveTranslation] Entrada rechazada a {Login}/{Lang}: {Reason}", login, lang, reason);
                return Denied(reason);
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(login, lang));
            _connections[Context.ConnectionId] = (login, lang);
            _ips[Context.ConnectionId] = ip;
            if (who != null) _users[Context.ConnectionId] = who.UserId;

            var status = await _notifier.OnListenerChangedAsync(login, lang, CountListeners(login, lang), joined: true);
            _logger.LogDebug("[LiveTranslation] {Conn} escucha {Login}/{Lang} ({N})", Context.ConnectionId, login, lang, CountListeners(login, lang));
            return status;
        }

        public Task Leave() => LeaveCurrentAsync();

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            await LeaveCurrentAsync();
            await base.OnDisconnectedAsync(exception);
        }

        private async Task LeaveCurrentAsync()
        {
            _ips.TryRemove(Context.ConnectionId, out _);
            _users.TryRemove(Context.ConnectionId, out _);
            if (!_connections.TryRemove(Context.ConnectionId, out var cur)) return;
            try { await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(cur.Login, cur.Lang)); } catch { }
            await _notifier.OnListenerChangedAsync(cur.Login, cur.Lang, CountListeners(cur.Login, cur.Lang), joined: false);
        }
    }
}
