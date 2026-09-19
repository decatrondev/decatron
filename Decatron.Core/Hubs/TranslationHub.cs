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

        private static readonly ConcurrentDictionary<string, (string Login, string Lang)> _connections = new();

        public static string GroupName(string login, string lang) => $"lt:{login.ToLowerInvariant()}:{lang.ToLowerInvariant()}";

        public static int CountListeners(string login, string lang) =>
            _connections.Values.Count(v => v.Login == login.ToLowerInvariant() && v.Lang == lang.ToLowerInvariant());

        public static int CountListeners(string login) =>
            _connections.Values.Count(v => v.Login == login.ToLowerInvariant());

        public static IReadOnlyDictionary<string, int> ListenersByLanguage(string login) =>
            _connections.Values.Where(v => v.Login == login.ToLowerInvariant())
                .GroupBy(v => v.Lang).ToDictionary(g => g.Key, g => g.Count());

        public TranslationHub(ILogger<TranslationHub> logger, ITranslationListenerNotifier notifier)
        {
            _logger = logger;
            _notifier = notifier;
        }

        /// <summary>El espectador eligió un idioma para un canal. Devuelve el estado del canal.</summary>
        public async Task<object> Join(string login, string lang)
        {
            login = (login ?? "").Trim().ToLowerInvariant();
            lang = (lang ?? "").Trim().ToLowerInvariant();
            if (login.Length is 0 or > 40 || lang.Length is 0 or > 10)
                return new { ok = false, error = "invalid" };

            await LeaveCurrentAsync();
            await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(login, lang));
            _connections[Context.ConnectionId] = (login, lang);

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
            if (!_connections.TryRemove(Context.ConnectionId, out var cur)) return;
            try { await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(cur.Login, cur.Lang)); } catch { }
            await _notifier.OnListenerChangedAsync(cur.Login, cur.Lang, CountListeners(cur.Login, cur.Lang), joined: false);
        }
    }
}
