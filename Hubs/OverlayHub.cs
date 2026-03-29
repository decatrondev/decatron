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

        public static bool HasActiveClients(string channel) => _activeChannels.TryGetValue(channel, out var count) && count > 0;
        public static IEnumerable<string> GetActiveChannels() => _activeChannels.Where(kv => kv.Value > 0).Select(kv => kv.Key);

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
                _logger.LogInformation("Client {ConnectionId} joined overlay_{Channel} (active: {Count})", Context.ConnectionId, channel, _activeChannels.GetValueOrDefault(channel));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al unir cliente {Context.ConnectionId} al canal overlay_{channel}");
            }
        }


        public async Task LeaveChannel(string channel)
        {
            try
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"overlay_{channel}");
                _activeChannels.AddOrUpdate(channel, 0, (_, count) => Math.Max(0, count - 1));
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
