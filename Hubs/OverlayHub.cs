using Microsoft.AspNetCore.SignalR;

namespace Decatron.Hubs
{
    /// <summary>
    /// SignalR Hub for real-time overlay updates.
    /// JoinChannel/LeaveChannel are intentionally anonymous because OBS browser sources
    /// (overlays) cannot carry authentication tokens.
    /// All data pushing is done server-side via IHubContext in OverlayNotificationService.
    /// </summary>
    public class OverlayHub : Hub
    {
        private readonly ILogger<OverlayHub> _logger;

        // Track which channels have active overlay connections
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, int> _activeChannels = new();

        /// <summary>
        /// Qué overlay hay al otro lado de cada conexión.
        ///
        /// Todos los overlays de un canal se unen al mismo grupo `overlay_{canal}`, así
        /// que el contador de arriba no distingue una alerta de un Speak Chat. Cuando un
        /// streamer dice "no me suena", saber que su canal tiene ocho conexiones no
        /// responde nada: la pregunta es si alguna de ellas es la que debía sonar.
        /// </summary>
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, (string Channel, string Type)> _connections = new();

        public static bool HasActiveClients(string channel) => _activeChannels.TryGetValue(channel, out var count) && count > 0;
        public static IEnumerable<string> GetActiveChannels() => _activeChannels.Where(kv => kv.Value > 0).Select(kv => kv.Key);

        /// <summary>Cuántos overlays de un tipo concreto hay conectados a un canal.</summary>
        public static int CountOverlays(string channel, string type) =>
            _connections.Count(kv =>
                string.Equals(kv.Value.Channel, channel, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(kv.Value.Type, type, StringComparison.OrdinalIgnoreCase));

        /// <summary>Los tipos de overlay conectados a un canal, para diagnóstico.</summary>
        public static string DescribeOverlays(string channel)
        {
            var types = _connections
                .Where(kv => string.Equals(kv.Value.Channel, channel, StringComparison.OrdinalIgnoreCase))
                .GroupBy(kv => kv.Value.Type)
                .Select(g => $"{g.Key}={g.Count()}")
                .ToList();

            return types.Count == 0 ? "ninguno" : string.Join(", ", types);
        }

        public OverlayHub(ILogger<OverlayHub> logger)
        {
            _logger = logger;
        }

        public async Task JoinChannel(string channel)
        {
            try
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"overlay_{channel}");
                _activeChannels.AddOrUpdate(channel, 1, (_, count) => count + 1);
                // El tipo llega después, con RegisterOverlay. Los overlays viejos que
                // nunca lo llamen se quedan como "sin identificar", que ya dice algo.
                _connections[Context.ConnectionId] = (channel, "sin identificar");
                _logger.LogInformation("Client {ConnectionId} joined overlay_{Channel} (active: {Count})", Context.ConnectionId, channel, _activeChannels.GetValueOrDefault(channel));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al unir cliente {Context.ConnectionId} al canal overlay_{channel}");
            }
        }


        /// <summary>
        /// Dice qué overlay es esta conexión ("speak_chat", "event_alerts"…). Se llama
        /// justo después de JoinChannel.
        /// </summary>
        public Task RegisterOverlay(string channel, string overlayType)
        {
            _connections[Context.ConnectionId] = (channel, overlayType ?? "sin identificar");
            _logger.LogInformation(
                "Overlay {Type} registrado en {Channel} (conectados ahora: {Detalle})",
                overlayType, channel, DescribeOverlays(channel));
            return Task.CompletedTask;
        }

        public async Task LeaveChannel(string channel)
        {
            try
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"overlay_{channel}");
                _activeChannels.AddOrUpdate(channel, 0, (_, count) => Math.Max(0, count - 1));
                _connections.TryRemove(Context.ConnectionId, out _);
                _logger.LogInformation("Client {ConnectionId} left overlay_{Channel} (active: {Count})", Context.ConnectionId, channel, _activeChannels.GetValueOrDefault(channel));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error removing client {ConnectionId} from overlay_{Channel}", Context.ConnectionId, channel);
            }
        }

        public override async Task OnConnectedAsync()
        {
            try
            {
                _logger.LogDebug($"Cliente {Context.ConnectionId} conectado a SignalR");
                await base.OnConnectedAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error en OnConnectedAsync para {Context.ConnectionId}");
            }
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            try
            {
                // Una fuente de OBS que se cierra no llama a LeaveChannel: simplemente
                // desaparece. Sin esto el contador solo subía, y un canal sin nadie
                // mirando seguía diciendo que tenía ocho overlays conectados.
                if (_connections.TryRemove(Context.ConnectionId, out var info))
                {
                    _activeChannels.AddOrUpdate(info.Channel, 0, (_, count) => Math.Max(0, count - 1));
                    _logger.LogInformation(
                        "Overlay {Type} desconectado de {Channel} (quedan: {Detalle})",
                        info.Type, info.Channel, DescribeOverlays(info.Channel));
                }

                if (exception != null)
                {
                    _logger.LogWarning(exception, $"Cliente {Context.ConnectionId} desconectado con error");
                }
                else
                {
                    _logger.LogDebug($"Cliente {Context.ConnectionId} desconectado normalmente");
                }

                await base.OnDisconnectedAsync(exception);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error en OnDisconnectedAsync para {Context.ConnectionId}");
            }
        }
    }
}
