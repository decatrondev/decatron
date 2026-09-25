using System;
using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Decatron.Data;

namespace Decatron.Services.SongRequest
{
    /// <summary>
    /// Qué conexión es el reproductor activo de cada canal. Solo uno suena a la vez: el último
    /// que se registra toma el control y el anterior recibe <c>PlayerReplaced</c> y se detiene.
    /// </summary>
    public sealed class SongRequestPlayerRegistry
    {
        private readonly ConcurrentDictionary<string, string> _activeByChannel = new();

        /// <returns>La conexión que tenía el control antes, si era otra.</returns>
        public string? SetActive(string channel, string connectionId)
        {
            string? previous = null;
            _activeByChannel.AddOrUpdate(channel,
                connectionId,
                (_, old) => { previous = old == connectionId ? null : old; return connectionId; });
            return previous;
        }

        public bool IsActive(string channel, string connectionId) =>
            _activeByChannel.TryGetValue(channel, out var active) && active == connectionId;

        public bool HasPlayer(string channel) => _activeByChannel.ContainsKey(channel);

        /// <returns>El canal que dejó sin reproductor, o null si esa conexión no era un reproductor activo.</returns>
        public string? Remove(string connectionId)
        {
            foreach (var kv in _activeByChannel)
            {
                if (kv.Value == connectionId && _activeByChannel.TryRemove(new(kv.Key, kv.Value)))
                    return kv.Key;
            }
            return null;
        }
    }

    /// <summary>
    /// /hubs/songrequest. Todos escuchan el grupo <c>sr_{canal}</c> (cola pública, overlays y dashboard).
    /// El reproductor además se registra con la clave del canal y es el único que puede avanzar la cola.
    /// Plan: .dev/plans/SONG_REQUEST_PLAN.md (fase 2).
    /// </summary>
    public sealed class SongRequestHub : Hub
    {
        public const string PlayerReplacedEvent = "PlayerReplaced";
        /// <summary>El reproductor activo se fue: los que habían sido reemplazados pueden volver a tomar el control.</summary>
        public const string PlayerReleasedEvent = "PlayerReleased";
        public const string ProgressEvent = "SongRequestProgress";

        private readonly DecatronDbContext _db;
        private readonly SongRequestService _songs;
        private readonly SongRequestPlayerRegistry _players;
        private readonly ILogger<SongRequestHub> _logger;

        public SongRequestHub(DecatronDbContext db, SongRequestService songs, SongRequestPlayerRegistry players, ILogger<SongRequestHub> logger)
        {
            _db = db;
            _songs = songs;
            _players = players;
            _logger = logger;
        }

        public static string Group(string channel) => $"sr_{channel.ToLowerInvariant()}";

        /// <summary>Solo mirar (cola pública, overlay de "sonando ahora", dashboard). Devuelve el estado actual.</summary>
        public async Task<object?> Watch(string channel)
        {
            channel = channel.ToLowerInvariant();
            await Groups.AddToGroupAsync(Context.ConnectionId, Group(channel));
            var config = await FindConfigAsync(channel);
            return config == null ? null : await _songs.BuildSnapshotAsync(config);
        }

        /// <summary>
        /// El overlay que suena (o "escuchar aquí" del dashboard) toma el control del canal.
        /// Devuelve el estado actual, o null si la clave no es válida.
        /// </summary>
        public async Task<object?> RegisterPlayer(string channel, string key)
        {
            channel = channel.ToLowerInvariant();
            var config = await FindConfigAsync(channel);
            if (config == null || !KeyMatches(config.PlayerKey, key))
                return null;

            await Groups.AddToGroupAsync(Context.ConnectionId, Group(channel));
            var previous = _players.SetActive(channel, Context.ConnectionId);
            if (previous != null)
                await Clients.Client(previous).SendAsync(PlayerReplacedEvent);

            _logger.LogInformation("[SongRequest] Reproductor activo en {Channel} ({Connection})", channel, Context.ConnectionId);
            await _songs.NotifyAsync(config); // el dashboard ve "reproductor conectado"
            return await _songs.BuildSnapshotAsync(config);
        }

        /// <summary>El reproductor no tiene nada que sonar: pasa la primera de la cola a "sonando".</summary>
        public async Task PlayerIdle(string channel)
        {
            var config = await ActivePlayerConfigAsync(channel);
            if (config != null)
                await _songs.StartNextIfIdleAsync(config);
        }

        /// <summary>Terminó la canción <paramref name="itemId"/>. Si ya no era la actual (alguien la saltó), no hace nada.</summary>
        public async Task PlayerEnded(string channel, long itemId)
        {
            var config = await ActivePlayerConfigAsync(channel);
            if (config != null)
                await _songs.AdvanceIfCurrentAsync(config, itemId, "finished");
        }

        /// <summary>YouTube no pudo reproducirla (bloqueada, restricción de edad, borrada…): se salta sola.</summary>
        public async Task PlayerError(string channel, long itemId, int code)
        {
            var config = await ActivePlayerConfigAsync(channel);
            if (config == null)
                return;
            _logger.LogInformation("[SongRequest] {Channel}: error {Code} del reproductor en el pedido {Item}; se salta", channel, code, itemId);
            await _songs.AdvanceIfCurrentAsync(config, itemId, "error");
        }

        /// <summary>Avance de la canción, para la barra de progreso del overlay y del dashboard (~1 por segundo).</summary>
        public async Task PlayerProgress(string channel, long itemId, double position, double duration, bool playing)
        {
            channel = channel.ToLowerInvariant();
            if (!_players.IsActive(channel, Context.ConnectionId))
                return;
            await Clients.OthersInGroup(Group(channel)).SendAsync(ProgressEvent, new { itemId, position, duration, playing });
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var channel = _players.Remove(Context.ConnectionId);
            if (channel != null)
            {
                var config = await FindConfigAsync(channel);
                if (config != null)
                    await _songs.NotifyAsync(config);
                await Clients.Group(Group(channel)).SendAsync(PlayerReleasedEvent);
            }
            await base.OnDisconnectedAsync(exception);
        }

        private async Task<Core.Models.SongRequest.SongRequestConfig?> ActivePlayerConfigAsync(string channel)
        {
            channel = channel.ToLowerInvariant();
            return _players.IsActive(channel, Context.ConnectionId) ? await FindConfigAsync(channel) : null;
        }

        private Task<Core.Models.SongRequest.SongRequestConfig?> FindConfigAsync(string channel) =>
            _db.SongRequestConfigs.FirstOrDefaultAsync(c => c.ChannelName == channel);

        private static bool KeyMatches(string? expected, string? given) =>
            !string.IsNullOrEmpty(expected) && !string.IsNullOrEmpty(given)
            && CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(expected), Encoding.UTF8.GetBytes(given));
    }
}
