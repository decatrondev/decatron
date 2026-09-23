using System;
using System.Linq;
using System.Threading.Tasks;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services.Platforms.Kick;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Moderation
{
    /// <summary>
    /// Un canal visto por la moderación.
    /// Key: con qué nombre se guardan filtros, strikes y el historial (users.login: el login de
    /// Twitch, o "kick_&lt;id&gt;" en un canal de Kick). Es el mismo nombre con el que guarda el dashboard.
    /// </summary>
    public record ModerationChannel(string Key, string Platform, long UserId, string? KickId)
    {
        public bool IsKick => Platform == "kick";
    }

    /// <summary>
    /// Alguien a sancionar: Twitch lo busca por nombre, Kick por id.
    /// </summary>
    public record ModerationTarget(string Username, string? UserId);

    /// <summary>
    /// Las acciones de moderación en la plataforma del canal
    /// </summary>
    public interface IChatModerator
    {
        Task<bool> TimeoutAsync(ModerationTarget target, int seconds, string reason);
        Task<bool> BanAsync(ModerationTarget target, string reason);
        Task<bool> DeleteMessageAsync(string messageId);
        /// <summary>true si se quitó, false si no estaba sancionado, null si falló</summary>
        Task<bool?> UnbanAsync(ModerationTarget target);
    }

    public class TwitchChatModerator : IChatModerator
    {
        private readonly TwitchApiService _twitch;
        private readonly string _channel;

        public TwitchChatModerator(TwitchApiService twitch, string channel)
        {
            _twitch = twitch;
            _channel = channel;
        }

        public Task<bool> TimeoutAsync(ModerationTarget target, int seconds, string reason) => _twitch.TimeoutUserAsync(_channel, target.Username, seconds, reason);
        public Task<bool> BanAsync(ModerationTarget target, string reason) => _twitch.BanUserAsync(_channel, target.Username, reason);
        public Task<bool> DeleteMessageAsync(string messageId) => _twitch.DeleteMessageAsync(_channel, messageId);
        public Task<bool?> UnbanAsync(ModerationTarget target) => _twitch.UnbanUserAsync(_channel, target.Username);
    }

    /// <summary>
    /// Kick sanciona con el token del propio streamer (no hace falta que el bot sea moderador).
    /// El timeout va en minutos: 30 s se redondea a 1 min.
    /// </summary>
    public class KickChatModerator : IChatModerator
    {
        private readonly IKickApiService _kick;
        private readonly IServiceProvider _services;
        private readonly long _channelUserId;
        private readonly ILogger _logger;

        public KickChatModerator(IKickApiService kick, IServiceProvider services, long channelUserId, ILogger logger)
        {
            _kick = kick;
            _services = services;
            _channelUserId = channelUserId;
            _logger = logger;
        }

        public async Task<bool> TimeoutAsync(ModerationTarget target, int seconds, string reason)
        {
            var (token, broadcasterId, userId) = await PrepareAsync(target);
            return token != null && userId != null && await _kick.BanAsync(token, broadcasterId, userId.Value, (int)Math.Ceiling(seconds / 60.0), reason);
        }

        public async Task<bool> BanAsync(ModerationTarget target, string reason)
        {
            var (token, broadcasterId, userId) = await PrepareAsync(target);
            return token != null && userId != null && await _kick.BanAsync(token, broadcasterId, userId.Value, null, reason);
        }

        public async Task<bool> DeleteMessageAsync(string messageId)
        {
            var (token, _, _) = await PrepareAsync(null);
            return token != null && await _kick.DeleteMessageAsync(token, messageId);
        }

        public async Task<bool?> UnbanAsync(ModerationTarget target)
        {
            var (token, broadcasterId, userId) = await PrepareAsync(target);
            if (token == null || userId == null) return null;
            return await _kick.UnbanAsync(token, broadcasterId, userId.Value);
        }

        /// <summary>Token del streamer (refrescado si está por vencer) y los ids numéricos</summary>
        private async Task<(string? Token, long BroadcasterId, long? UserId)> PrepareAsync(ModerationTarget? target)
        {
            var db = _services.GetRequiredService<DecatronDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == _channelUserId);
            if (user?.KickId == null || !long.TryParse(user.KickId, out var broadcasterId))
                return (null, 0, null);

            var token = user.KickAccessToken;
            if ((user.KickTokenExpiration == null || user.KickTokenExpiration.Value <= DateTime.UtcNow.AddMinutes(2))
                && !string.IsNullOrEmpty(user.KickRefreshToken))
            {
                try { token = (await _services.GetRequiredService<IKickTokenRefreshService>().RefreshUserTokenAsync(user)).KickAccessToken; }
                catch (KickTokenException ex) { _logger.LogWarning(ex, "[Moderación Kick] No se pudo refrescar el token de {Channel}", user.KickUsername); }
            }

            long? userId = target?.UserId != null && long.TryParse(target.UserId, out var id) ? id : null;
            if (target != null && userId == null)
                _logger.LogWarning("[Moderación Kick] Sin id de Kick para {User}: no se puede sancionar", target.Username);
            return (token, broadcasterId, userId);
        }
    }

    /// <summary>
    /// Resuelve el canal (por login de Twitch, kick_id numérico o "kick_&lt;id&gt;") y da el moderador de su plataforma.
    /// </summary>
    public class ChatModeratorFactory
    {
        private readonly IServiceProvider _services;
        private readonly ILogger<ChatModeratorFactory> _logger;

        public ChatModeratorFactory(IServiceProvider services, ILogger<ChatModeratorFactory> logger)
        {
            _services = services;
            _logger = logger;
        }

        public async Task<ModerationChannel?> ResolveAsync(string channel)
        {
            // Se consulta en cada mensaje: caché corta, igual que la config de moderación
            if (Decatron.Core.Services.Moderation.ModerationCache.TryGet<ModerationChannel>("resolve", channel, out var cached) && cached != null)
                return cached;

            var key = channel.ToLower();
            var db = _services.GetRequiredService<DecatronDbContext>();
            var user = await db.Users.AsNoTracking()
                .Where(u => u.IsActive && (u.Login == key || u.KickId == channel))
                .Select(u => new { u.Id, u.Login, u.KickId })
                .FirstOrDefaultAsync();
            if (user == null)
                return null;

            // Un canal de Kick es su propia fila con login "kick_<id>" (ver KickAuthController)
            var isKick = user.KickId != null && user.Login == $"kick_{user.KickId}";
            var resolved = new ModerationChannel(user.Login.ToLower(), isKick ? "kick" : "twitch", user.Id, user.KickId);
            Decatron.Core.Services.Moderation.ModerationCache.Set("resolve", channel, resolved);
            return resolved;
        }

        public IChatModerator For(ModerationChannel channel) => channel.IsKick
            ? new KickChatModerator(_services.GetRequiredService<IKickApiService>(), _services, channel.UserId, _logger)
            : new TwitchChatModerator(_services.GetRequiredService<TwitchApiService>(), channel.Key);
    }
}
