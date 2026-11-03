using Decatron.Core.Helpers;
using Decatron.Core.Models;
using Decatron.Core.Services;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    /// <summary>Resultado de sincronizar los seguidores de un canal de Twitch.</summary>
    public record FollowersSyncResult(
        bool Success,
        string? FetchFailure,
        int Processed,
        int NewFollowers,
        int Returned,
        int Unfollowed,
        int Renamed,
        SyncUnfollowSkipReason UnfollowSkipped,
        int Missing,
        int Received,
        int TwitchTotal,
        FollowerStats? Current);

    /// <summary>
    /// Sincroniza los seguidores de un canal con la lista real de Twitch: altas, regresos, renombres y unfollows,
    /// decididos por <see cref="FollowersSyncPlanner"/> (que no detecta unfollows con una lista dudosa).
    /// Lo usan el botón de la pantalla y la sincronización automática del servidor.
    /// </summary>
    public class FollowersSyncService
    {
        private readonly DecatronDbContext _context;
        private readonly FollowersService _followersService;
        private readonly TwitchApiService _twitchApiService;
        private readonly ILogger<FollowersSyncService> _logger;

        public FollowersSyncService(
            DecatronDbContext context,
            FollowersService followersService,
            TwitchApiService twitchApiService,
            ILogger<FollowersSyncService> logger)
        {
            _context = context;
            _followersService = followersService;
            _twitchApiService = twitchApiService;
            _logger = logger;
        }

        /// <param name="maxNewFollowers">
        /// Si se indica (sincronización automática), no se baja la lista cuando Twitch tiene más de este número de seguidores
        /// que los guardados: las importaciones grandes se hacen a mano con el botón, no sin que nadie mire.
        /// </param>
        public async Task<FollowersSyncResult> SyncAsync(string broadcasterId, int? maxNewFollowers = null, string source = "manual")
        {
            _logger.LogInformation($"🔄 Iniciando sincronización de followers para broadcaster {broadcasterId}");

            Func<int, bool>? stopIfTotal = null;
            if (maxNewFollowers.HasValue)
            {
                var savedActive = await _context.ChannelFollowers.CountAsync(f => f.BroadcasterId == broadcasterId && f.Platform == FollowerPlatforms.Twitch && f.IsFollowing == 0);
                stopIfTotal = total => total - savedActive > maxNewFollowers.Value;
            }

            var fetch = await _twitchApiService.FetchChannelFollowersAsync(broadcasterId, stopIfTotal);
            var twitchFollowers = fetch.Followers;

            if (fetch.Failure == "skipped_large")
            {
                _logger.LogInformation($"👥 [FOLLOWERS] Canal {broadcasterId}: Twitch tiene {fetch.Total} seguidores y faltan demasiados por importar; se omite en automático (usar el botón Sincronizar)");
                await _followersService.RecordSyncStatusAsync(FollowerPlatforms.Twitch, broadcasterId, source, "skipped_large", null, false, 0, 0, 0, 0);
                return new FollowersSyncResult(false, "skipped_large", 0, 0, 0, 0, 0, SyncUnfollowSkipReason.None, 0, 0, fetch.Total, null);
            }

            if (!twitchFollowers.Any() && !fetch.Complete)
            {
                _logger.LogWarning($"⚠️ No se pudo obtener la lista de followers de Twitch para {broadcasterId} ({fetch.Failure})");
                await _followersService.RecordSyncStatusAsync(FollowerPlatforms.Twitch, broadcasterId, source, "fetch_failed", fetch.Failure, false, 0, 0, 0, 0);
                return new FollowersSyncResult(false, fetch.Failure ?? "unknown", 0, 0, 0, 0, 0, SyncUnfollowSkipReason.None, 0, 0, fetch.Total, null);
            }

            _logger.LogInformation($"✅ Obtenidos {twitchFollowers.Count} followers de Twitch API (completa={fetch.Complete}, total Twitch={fetch.Total})");

            var user = await _context.Users.FirstOrDefaultAsync(u => u.TwitchId == broadcasterId);
            var broadcasterName = user?.DisplayName ?? "Unknown";

            var dbFollowers = await _context.ChannelFollowers
                .Where(f => f.BroadcasterId == broadcasterId && f.Platform == FollowerPlatforms.Twitch)
                .ToListAsync();

            var plan = FollowersSyncPlanner.Plan(
                twitchFollowers.Select(f => new SyncRemoteFollower(f.user_id, f.user_name, f.user_login)).ToList(),
                dbFollowers.Select(f => new SyncKnownFollower(f.UserId, f.UserName, f.UserLogin, f.IsFollowing == 1)).ToList(),
                fetch.Complete,
                fetch.Total);

            var twitchById = twitchFollowers.GroupBy(f => f.user_id).ToDictionary(g => g.Key, g => g.First());
            var dbById = dbFollowers.GroupBy(f => f.UserId).ToDictionary(g => g.Key, g => g.First());

            // Altas (fecha real del follow que entrega Twitch)
            foreach (var id in plan.NewIds)
            {
                var tf = twitchById[id];
                var followedAt = DateTime.Parse(tf.followed_at);
                await _followersService.UpsertFollowerAsync(new ChannelFollower
                {
                    BroadcasterId = broadcasterId,
                    BroadcasterName = broadcasterName,
                    UserId = tf.user_id,
                    UserName = tf.user_name,
                    UserLogin = tf.user_login,
                    FollowedAt = followedAt,
                    IsFollowing = 0,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
                await _followersService.AddHistoryEntryAsync(broadcasterId, tf.user_id, 0, followedAt);
            }

            // Regresos
            foreach (var id in plan.ReturnedIds)
            {
                var existing = dbById[id];
                existing.IsFollowing = 0;
                existing.UpdatedAt = DateTime.UtcNow;
                await _followersService.UpsertFollowerAsync(existing);
                await _followersService.AddHistoryEntryAsync(broadcasterId, id, 0);
            }

            // Renombres (el id no cambia; el nombre sí)
            foreach (var rn in plan.Renames)
            {
                var existing = dbById[rn.UserId];
                _logger.LogInformation($"✏️ [FOLLOWERS] Renombre {existing.UserLogin} -> {rn.NewLogin} (id {rn.UserId})");
                existing.UserName = rn.NewName;
                existing.UserLogin = rn.NewLogin;
                existing.UpdatedAt = DateTime.UtcNow;
                await _followersService.UpsertFollowerAsync(existing);
            }

            // Unfollows (solo si la regla confió en la lista)
            foreach (var id in plan.UnfollowIds)
            {
                var dbFollower = dbById[id];
                dbFollower.IsFollowing = 1;
                dbFollower.UnfollowedAt = DateTime.UtcNow;
                dbFollower.UpdatedAt = DateTime.UtcNow;
                await _followersService.UpsertFollowerAsync(dbFollower);
                await _followersService.AddHistoryEntryAsync(broadcasterId, id, 1);
            }

            if (plan.UnfollowSkipped != SyncUnfollowSkipReason.None)
                _logger.LogWarning($"🛡️ [FOLLOWERS] Unfollows omitidos para {broadcasterId}: {plan.UnfollowSkipped} (faltarían {plan.MissingCount})");

            _logger.LogInformation($"✅ Sincronización completada: {plan.NewIds.Count} nuevos, {plan.ReturnedIds.Count} retornados, {plan.Renames.Count} renombrados, {plan.UnfollowIds.Count} unfollowed");

            await _followersService.RecordSyncStatusAsync(FollowerPlatforms.Twitch, broadcasterId, source,
                plan.UnfollowSkipped == SyncUnfollowSkipReason.None ? "ok" : "unfollows_skipped",
                plan.UnfollowSkipped == SyncUnfollowSkipReason.None ? null : plan.UnfollowSkipped.ToString(),
                true, plan.NewIds.Count, plan.ReturnedIds.Count, plan.UnfollowIds.Count, plan.Renames.Count);

            var stats = await _followersService.GetFollowerStatsAsync(broadcasterId);
            return new FollowersSyncResult(true, null, twitchFollowers.Count, plan.NewIds.Count, plan.ReturnedIds.Count,
                plan.UnfollowIds.Count, plan.Renames.Count, plan.UnfollowSkipped, plan.MissingCount, twitchFollowers.Count, fetch.Total, stats);
        }
    }
}
