using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Decatron.Core.Helpers;
using Decatron.Core.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Core.Services
{
    public class FollowersService
    {
        private readonly string _connectionString;
        private readonly ILogger<FollowersService> _logger;

        public FollowersService(
            IConfiguration configuration,
            ILogger<FollowersService> logger)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
            _logger = logger;
        }

        /// <summary>
        /// Obtiene todos los seguidores de un broadcaster con filtros opcionales
        /// </summary>
        public async Task<List<ChannelFollower>> GetFollowersAsync(
            string broadcasterId,
            int? isFollowing = null,
            string? searchName = null,
            DateTime? followDateFrom = null,
            DateTime? followDateTo = null,
            DateTime? createDateFrom = null,
            DateTime? createDateTo = null,
            string platform = FollowerPlatforms.Twitch)
        {
            var followers = new List<ChannelFollower>();

            try
            {
                await using var conn = Decatron.Core.Interfaces.TenantNpgsql.Create(_connectionString);
                await conn.OpenAsync();

                var sql = @"
                    SELECT id, broadcaster_id, broadcaster_name, user_id, user_name, user_login,
                           followed_at, account_created_at, is_following, unfollowed_at,
                           is_blocked, was_blocked, created_at, updated_at, platform
                    FROM channel_followers
                    WHERE broadcaster_id = @broadcasterId AND platform = @platform";

                var parameters = new List<NpgsqlParameter>
                {
                    new("broadcasterId", broadcasterId),
                    new("platform", FollowerPlatforms.Normalize(platform))
                };

                if (isFollowing.HasValue)
                {
                    sql += " AND is_following = @isFollowing";
                    parameters.Add(new NpgsqlParameter("isFollowing", isFollowing.Value));
                }

                if (!string.IsNullOrWhiteSpace(searchName))
                {
                    sql += " AND (LOWER(user_name) LIKE @searchName OR LOWER(user_login) LIKE @searchName)";
                    parameters.Add(new NpgsqlParameter("searchName", $"%{searchName.ToLower()}%"));
                }

                if (followDateFrom.HasValue)
                {
                    sql += " AND followed_at >= @followDateFrom";
                    parameters.Add(new NpgsqlParameter("followDateFrom", followDateFrom.Value));
                }

                if (followDateTo.HasValue)
                {
                    sql += " AND followed_at <= @followDateTo";
                    parameters.Add(new NpgsqlParameter("followDateTo", followDateTo.Value));
                }

                if (createDateFrom.HasValue)
                {
                    sql += " AND account_created_at >= @createDateFrom";
                    parameters.Add(new NpgsqlParameter("createDateFrom", createDateFrom.Value));
                }

                if (createDateTo.HasValue)
                {
                    sql += " AND account_created_at <= @createDateTo";
                    parameters.Add(new NpgsqlParameter("createDateTo", createDateTo.Value));
                }

                sql += " ORDER BY followed_at DESC";

                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddRange(parameters.ToArray());

                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    followers.Add(MapFollowerFromReader(reader));
                }

                _logger.LogInformation($"✅ Se obtuvieron {followers.Count} seguidores para broadcaster {broadcasterId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al obtener seguidores para broadcaster {broadcasterId}");
                throw;
            }

            return followers;
        }

        /// <summary>
        /// Obtiene el historial de acciones de un seguidor específico
        /// </summary>
        public async Task<List<FollowerHistory>> GetFollowerHistoryAsync(string broadcasterId, string userId, string platform = FollowerPlatforms.Twitch)
        {
            var history = new List<FollowerHistory>();

            try
            {
                await using var conn = Decatron.Core.Interfaces.TenantNpgsql.Create(_connectionString);
                await conn.OpenAsync();

                var sql = @"
                    SELECT id, broadcaster_id, user_id, action, action_timestamp, created_at, platform
                    FROM follower_history
                    WHERE broadcaster_id = @broadcasterId AND user_id = @userId AND platform = @platform
                    ORDER BY action_timestamp ASC";

                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("broadcasterId", broadcasterId);
                cmd.Parameters.AddWithValue("userId", userId);
                cmd.Parameters.AddWithValue("platform", FollowerPlatforms.Normalize(platform));

                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    history.Add(new FollowerHistory
                    {
                        Id = reader.GetInt64(0),
                        BroadcasterId = reader.GetString(1),
                        UserId = reader.GetString(2),
                        Action = reader.GetInt32(3),
                        ActionTimestamp = reader.GetDateTime(4),
                        CreatedAt = reader.GetDateTime(5),
                        Platform = reader.GetString(6)
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al obtener historial para user {userId}");
                throw;
            }

            return history;
        }

        /// <summary>
        /// Verifica si un usuario es "retornado" (hizo unfollow y volvió)
        /// </summary>
        public async Task<bool> IsReturnedFollowerAsync(string broadcasterId, string userId, string platform = FollowerPlatforms.Twitch)
        {
            try
            {
                await using var conn = Decatron.Core.Interfaces.TenantNpgsql.Create(_connectionString);
                await conn.OpenAsync();

                // Verificar si está actualmente siguiendo
                var sqlFollower = @"
                    SELECT is_following
                    FROM channel_followers
                    WHERE broadcaster_id = @broadcasterId AND user_id = @userId AND platform = @platform";

                await using var cmdFollower = new NpgsqlCommand(sqlFollower, conn);
                cmdFollower.Parameters.AddWithValue("broadcasterId", broadcasterId);
                cmdFollower.Parameters.AddWithValue("platform", FollowerPlatforms.Normalize(platform));
                cmdFollower.Parameters.AddWithValue("userId", userId);

                var result = await cmdFollower.ExecuteScalarAsync();
                if (result == null) return false;

                var isFollowing = Convert.ToInt32(result);
                if (isFollowing != 0) return false; // No está activo, no puede ser retornado

                // Verificar si tiene al menos un unfollow en su historial
                var sqlHistory = @"
                    SELECT COUNT(*)
                    FROM follower_history
                    WHERE broadcaster_id = @broadcasterId
                      AND user_id = @userId
                      AND platform = @platform
                      AND action = 1";

                await using var cmdHistory = new NpgsqlCommand(sqlHistory, conn);
                cmdHistory.Parameters.AddWithValue("broadcasterId", broadcasterId);
                cmdHistory.Parameters.AddWithValue("platform", FollowerPlatforms.Normalize(platform));
                cmdHistory.Parameters.AddWithValue("userId", userId);

                var unfollowCount = Convert.ToInt32(await cmdHistory.ExecuteScalarAsync());
                return unfollowCount > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al verificar si user {userId} es retornado");
                return false;
            }
        }

        /// <summary>
        /// Crea o actualiza un seguidor en la base de datos
        /// </summary>
        public async Task<long> UpsertFollowerAsync(ChannelFollower follower)
        {
            try
            {
                await using var conn = Decatron.Core.Interfaces.TenantNpgsql.Create(_connectionString);
                await conn.OpenAsync();

                // Verificar si existe
                var sqlCheck = @"
                    SELECT id FROM channel_followers
                    WHERE broadcaster_id = @broadcasterId AND user_id = @userId AND platform = @platform";

                await using var cmdCheck = new NpgsqlCommand(sqlCheck, conn);
                cmdCheck.Parameters.AddWithValue("broadcasterId", follower.BroadcasterId);
                cmdCheck.Parameters.AddWithValue("platform", FollowerPlatforms.Normalize(follower.Platform));
                cmdCheck.Parameters.AddWithValue("userId", follower.UserId);

                var existingId = await cmdCheck.ExecuteScalarAsync();

                if (existingId != null)
                {
                    // Actualizar
                    var sqlUpdate = @"
                        UPDATE channel_followers
                        SET user_name = @userName,
                            user_login = @userLogin,
                            followed_at = @followedAt,
                            account_created_at = @accountCreatedAt,
                            is_following = @isFollowing,
                            unfollowed_at = @unfollowedAt,
                            is_blocked = @isBlocked,
                            was_blocked = @wasBlocked,
                            updated_at = @updatedAt
                        WHERE id = @id";

                    await using var cmdUpdate = new NpgsqlCommand(sqlUpdate, conn);
                    cmdUpdate.Parameters.AddWithValue("id", existingId);
                    cmdUpdate.Parameters.AddWithValue("userName", follower.UserName);
                    cmdUpdate.Parameters.AddWithValue("userLogin", follower.UserLogin);
                    cmdUpdate.Parameters.AddWithValue("followedAt", follower.FollowedAt);
                    cmdUpdate.Parameters.AddWithValue("accountCreatedAt", (object?)follower.AccountCreatedAt ?? DBNull.Value);
                    cmdUpdate.Parameters.AddWithValue("isFollowing", follower.IsFollowing);
                    cmdUpdate.Parameters.AddWithValue("unfollowedAt", (object?)follower.UnfollowedAt ?? DBNull.Value);
                    cmdUpdate.Parameters.AddWithValue("isBlocked", follower.IsBlocked);
                    cmdUpdate.Parameters.AddWithValue("wasBlocked", follower.WasBlocked);
                    cmdUpdate.Parameters.AddWithValue("updatedAt", DateTime.UtcNow);

                    await cmdUpdate.ExecuteNonQueryAsync();
                    return Convert.ToInt64(existingId);
                }
                else
                {
                    // Insertar
                    var sqlInsert = @"
                        INSERT INTO channel_followers (
                            broadcaster_id, broadcaster_name, user_id, user_name, user_login,
                            followed_at, account_created_at, is_following, unfollowed_at,
                            is_blocked, was_blocked, created_at, updated_at, platform
                        ) VALUES (
                            @broadcasterId, @broadcasterName, @userId, @userName, @userLogin,
                            @followedAt, @accountCreatedAt, @isFollowing, @unfollowedAt,
                            @isBlocked, @wasBlocked, @createdAt, @updatedAt, @platform
                        ) RETURNING id";

                    await using var cmdInsert = new NpgsqlCommand(sqlInsert, conn);
                    cmdInsert.Parameters.AddWithValue("broadcasterId", follower.BroadcasterId);
                    cmdInsert.Parameters.AddWithValue("platform", FollowerPlatforms.Normalize(follower.Platform));
                    cmdInsert.Parameters.AddWithValue("broadcasterName", follower.BroadcasterName);
                    cmdInsert.Parameters.AddWithValue("userId", follower.UserId);
                    cmdInsert.Parameters.AddWithValue("userName", follower.UserName);
                    cmdInsert.Parameters.AddWithValue("userLogin", follower.UserLogin);
                    cmdInsert.Parameters.AddWithValue("followedAt", follower.FollowedAt);
                    cmdInsert.Parameters.AddWithValue("accountCreatedAt", (object?)follower.AccountCreatedAt ?? DBNull.Value);
                    cmdInsert.Parameters.AddWithValue("isFollowing", follower.IsFollowing);
                    cmdInsert.Parameters.AddWithValue("unfollowedAt", (object?)follower.UnfollowedAt ?? DBNull.Value);
                    cmdInsert.Parameters.AddWithValue("isBlocked", follower.IsBlocked);
                    cmdInsert.Parameters.AddWithValue("wasBlocked", follower.WasBlocked);
                    cmdInsert.Parameters.AddWithValue("createdAt", DateTime.UtcNow);
                    cmdInsert.Parameters.AddWithValue("updatedAt", DateTime.UtcNow);

                    var newId = await cmdInsert.ExecuteScalarAsync();
                    return Convert.ToInt64(newId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al upsert follower {follower.UserId}");
                throw;
            }
        }

        /// <summary>
        /// Registra un follow recibido en vivo, en UNA sola operación atómica (sin «buscar y luego insertar»):
        /// dos eventos casi simultáneos, o un evento junto a una sincronización, nunca pierden el follow por la clave única.
        /// No toca el bloqueo ni la fecha de creación de la cuenta. Si ya estaba siguiendo (evento repetido) conserva la fecha
        /// original y no agrega historial; si había dejado de seguir, lo reactiva con la fecha nueva.
        /// </summary>
        public async Task<FollowRecordOutcome> RecordFollowAsync(
            string broadcasterId, string broadcasterName, string userId, string userName, string userLogin, DateTime followedAt,
            string platform = FollowerPlatforms.Twitch)
        {
            try
            {
                await using var conn = Decatron.Core.Interfaces.TenantNpgsql.Create(_connectionString);
                await conn.OpenAsync();

                const string sql = @"
                    WITH prev AS (
                        SELECT is_following FROM channel_followers
                        WHERE broadcaster_id = @broadcasterId AND user_id = @userId AND platform = @platform
                    ), up AS (
                        INSERT INTO channel_followers (
                            broadcaster_id, broadcaster_name, user_id, user_name, user_login,
                            followed_at, is_following, is_blocked, was_blocked, created_at, updated_at, platform
                        ) VALUES (
                            @broadcasterId, @broadcasterName, @userId, @userName, @userLogin,
                            @followedAt, 0, 0, 0, @now, @now, @platform
                        )
                        ON CONFLICT (tenant_id, platform, broadcaster_id, user_id) DO UPDATE SET
                            broadcaster_name = EXCLUDED.broadcaster_name,
                            user_name = EXCLUDED.user_name,
                            user_login = EXCLUDED.user_login,
                            followed_at = CASE WHEN channel_followers.is_following = 1 THEN EXCLUDED.followed_at ELSE channel_followers.followed_at END,
                            is_following = 0,
                            unfollowed_at = NULL,
                            updated_at = EXCLUDED.updated_at
                        RETURNING id
                    )
                    SELECT (SELECT is_following FROM prev), (SELECT count(*) FROM up)";

                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("broadcasterId", broadcasterId);
                cmd.Parameters.AddWithValue("broadcasterName", broadcasterName);
                cmd.Parameters.AddWithValue("userId", userId);
                cmd.Parameters.AddWithValue("userName", userName);
                cmd.Parameters.AddWithValue("userLogin", userLogin);
                cmd.Parameters.AddWithValue("followedAt", followedAt);
                cmd.Parameters.AddWithValue("now", DateTime.UtcNow);
                cmd.Parameters.AddWithValue("platform", FollowerPlatforms.Normalize(platform));

                await using var reader = await cmd.ExecuteReaderAsync();
                await reader.ReadAsync();
                if (reader.IsDBNull(0)) return FollowRecordOutcome.Created;
                return reader.GetInt32(0) == 1 ? FollowRecordOutcome.Reactivated : FollowRecordOutcome.AlreadyFollowing;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al registrar follow de {userId} en {broadcasterId}");
                throw;
            }
        }

        /// <summary>
        /// Anota el resultado del último intento de sincronización de un canal (una fila por canal y plataforma).
        /// Nunca lanza: es información accesoria y no debe romper la sincronización.
        /// </summary>
        public async Task RecordSyncStatusAsync(string platform, string broadcasterId, string source, string result, string? detail,
            bool readList, int newCount, int returnedCount, int unfollowedCount, int renamedCount)
        {
            try
            {
                await using var conn = Decatron.Core.Interfaces.TenantNpgsql.Create(_connectionString);
                await conn.OpenAsync();
                const string sql = @"
                    INSERT INTO follower_sync_status (platform, broadcaster_id, last_attempt_at, last_success_at, last_source, last_result,
                                                      last_detail, new_count, returned_count, unfollowed_count, renamed_count)
                    VALUES (@platform, @broadcasterId, @now, CASE WHEN @readList THEN @now ELSE NULL END, @source, @result,
                            @detail, @n, @r, @u, @rn)
                    ON CONFLICT (tenant_id, platform, broadcaster_id) DO UPDATE SET
                        last_attempt_at = EXCLUDED.last_attempt_at,
                        last_success_at = CASE WHEN @readList THEN EXCLUDED.last_attempt_at ELSE follower_sync_status.last_success_at END,
                        last_source = EXCLUDED.last_source,
                        last_result = EXCLUDED.last_result,
                        last_detail = EXCLUDED.last_detail,
                        new_count = EXCLUDED.new_count,
                        returned_count = EXCLUDED.returned_count,
                        unfollowed_count = EXCLUDED.unfollowed_count,
                        renamed_count = EXCLUDED.renamed_count";
                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("platform", FollowerPlatforms.Normalize(platform));
                cmd.Parameters.AddWithValue("broadcasterId", broadcasterId);
                cmd.Parameters.AddWithValue("now", DateTime.UtcNow);
                cmd.Parameters.AddWithValue("readList", readList);
                cmd.Parameters.AddWithValue("source", source);
                cmd.Parameters.AddWithValue("result", result);
                cmd.Parameters.AddWithValue("detail", (object?)detail ?? DBNull.Value);
                cmd.Parameters.AddWithValue("n", newCount);
                cmd.Parameters.AddWithValue("r", returnedCount);
                cmd.Parameters.AddWithValue("u", unfollowedCount);
                cmd.Parameters.AddWithValue("rn", renamedCount);
                await cmd.ExecuteNonQueryAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo anotar el estado de sincronización de {Broadcaster}", broadcasterId);
            }
        }

        /// <summary>Estado del último intento de sincronización de un canal, o null si nunca se sincronizó.</summary>
        public async Task<FollowerSyncStatus?> GetSyncStatusAsync(string platform, string broadcasterId)
        {
            try
            {
                await using var conn = Decatron.Core.Interfaces.TenantNpgsql.Create(_connectionString);
                await conn.OpenAsync();
                const string sql = @"
                    SELECT last_attempt_at, last_success_at, last_source, last_result, last_detail,
                           new_count, returned_count, unfollowed_count, renamed_count
                    FROM follower_sync_status
                    WHERE platform = @platform AND broadcaster_id = @broadcasterId";
                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("platform", FollowerPlatforms.Normalize(platform));
                cmd.Parameters.AddWithValue("broadcasterId", broadcasterId);
                await using var reader = await cmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync()) return null;
                return new FollowerSyncStatus
                {
                    LastAttemptAt = reader.GetDateTime(0),
                    LastSuccessAt = reader.IsDBNull(1) ? null : reader.GetDateTime(1),
                    Source = reader.GetString(2),
                    Result = reader.GetString(3),
                    Detail = reader.IsDBNull(4) ? null : reader.GetString(4),
                    NewCount = reader.GetInt32(5),
                    ReturnedCount = reader.GetInt32(6),
                    UnfollowedCount = reader.GetInt32(7),
                    RenamedCount = reader.GetInt32(8)
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo leer el estado de sincronización de {Broadcaster}", broadcasterId);
                return null;
            }
        }

        /// <summary>
        /// Agrega una entrada al historial de seguimiento
        /// </summary>
        public async Task AddHistoryEntryAsync(string broadcasterId, string userId, int action, DateTime? actionTimestamp = null, string platform = FollowerPlatforms.Twitch)
        {
            try
            {
                await using var conn = Decatron.Core.Interfaces.TenantNpgsql.Create(_connectionString);
                await conn.OpenAsync();

                var sql = @"
                    INSERT INTO follower_history (broadcaster_id, user_id, action, action_timestamp, created_at, platform)
                    VALUES (@broadcasterId, @userId, @action, @actionTimestamp, @createdAt, @platform)";

                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("broadcasterId", broadcasterId);
                cmd.Parameters.AddWithValue("userId", userId);
                cmd.Parameters.AddWithValue("action", action);
                cmd.Parameters.AddWithValue("actionTimestamp", actionTimestamp ?? DateTime.UtcNow);
                cmd.Parameters.AddWithValue("createdAt", DateTime.UtcNow);
                cmd.Parameters.AddWithValue("platform", FollowerPlatforms.Normalize(platform));

                await cmd.ExecuteNonQueryAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al agregar historial para user {userId}");
                throw;
            }
        }

        /// <summary>
        /// Actualiza el estado de bloqueo de un seguidor
        /// </summary>
        public async Task UpdateBlockStatusAsync(string broadcasterId, string userId, bool isBlocked, string platform = FollowerPlatforms.Twitch)
        {
            try
            {
                await using var conn = Decatron.Core.Interfaces.TenantNpgsql.Create(_connectionString);
                await conn.OpenAsync();

                var sql = @"
                    UPDATE channel_followers
                    SET is_blocked = @isBlocked,
                        was_blocked = CASE WHEN @isBlocked = 1 THEN 1 ELSE was_blocked END,
                        updated_at = @updatedAt
                    WHERE broadcaster_id = @broadcasterId AND user_id = @userId AND platform = @platform";

                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("broadcasterId", broadcasterId);
                cmd.Parameters.AddWithValue("userId", userId);
                cmd.Parameters.AddWithValue("platform", FollowerPlatforms.Normalize(platform));
                cmd.Parameters.AddWithValue("isBlocked", isBlocked ? 1 : 0);
                cmd.Parameters.AddWithValue("updatedAt", DateTime.UtcNow);

                await cmd.ExecuteNonQueryAsync();

                // Agregar al historial
                await AddHistoryEntryAsync(broadcasterId, userId, isBlocked ? 2 : 3, null, platform);

                _logger.LogInformation($"✅ Usuario {userId} {(isBlocked ? "bloqueado" : "desbloqueado")} para broadcaster {broadcasterId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al actualizar estado de bloqueo para user {userId}");
                throw;
            }
        }

        /// <summary>
        /// Obtiene estadísticas de seguidores para un broadcaster
        /// </summary>
        public async Task<FollowerStats> GetFollowerStatsAsync(string broadcasterId, string platform = FollowerPlatforms.Twitch)
        {
            var stats = new FollowerStats();

            try
            {
                await using var conn = Decatron.Core.Interfaces.TenantNpgsql.Create(_connectionString);
                await conn.OpenAsync();

                var sql = @"
                    SELECT
                        COUNT(*) as total,
                        COUNT(CASE WHEN is_following = 0 AND is_blocked = 0 THEN 1 END) as active,
                        COUNT(CASE WHEN is_following = 1 THEN 1 END) as unfollowed,
                        COUNT(CASE WHEN is_blocked = 1 THEN 1 END) as blocked
                    FROM channel_followers
                    WHERE broadcaster_id = @broadcasterId AND platform = @platform";

                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("broadcasterId", broadcasterId);
                cmd.Parameters.AddWithValue("platform", FollowerPlatforms.Normalize(platform));

                await using var reader = await cmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    stats.TotalFollowers = reader.GetInt32(0);
                    stats.ActiveFollowers = reader.GetInt32(1);
                    stats.UnfollowedCount = reader.GetInt32(2);
                    stats.BlockedCount = reader.GetInt32(3);
                }
                await reader.CloseAsync();

                // Calcular retornados
                var sqlReturned = @"
                    SELECT COUNT(DISTINCT cf.user_id)
                    FROM channel_followers cf
                    INNER JOIN follower_history fh ON cf.broadcaster_id = fh.broadcaster_id AND cf.user_id = fh.user_id AND cf.platform = fh.platform
                    WHERE cf.broadcaster_id = @broadcasterId
                      AND cf.platform = @platform
                      AND cf.is_following = 0
                      AND fh.action = 1";

                await using var cmdReturned = new NpgsqlCommand(sqlReturned, conn);
                cmdReturned.Parameters.AddWithValue("broadcasterId", broadcasterId);
                cmdReturned.Parameters.AddWithValue("platform", FollowerPlatforms.Normalize(platform));

                stats.ReturnedCount = Convert.ToInt32(await cmdReturned.ExecuteScalarAsync());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al obtener estadísticas para broadcaster {broadcasterId}");
                throw;
            }

            return stats;
        }

        private ChannelFollower MapFollowerFromReader(NpgsqlDataReader reader)
        {
            return new ChannelFollower
            {
                Id = reader.GetInt64(0),
                BroadcasterId = reader.GetString(1),
                BroadcasterName = reader.GetString(2),
                UserId = reader.GetString(3),
                UserName = reader.GetString(4),
                UserLogin = reader.GetString(5),
                FollowedAt = reader.GetDateTime(6),
                AccountCreatedAt = reader.IsDBNull(7) ? null : reader.GetDateTime(7),
                IsFollowing = reader.GetInt32(8),
                UnfollowedAt = reader.IsDBNull(9) ? null : reader.GetDateTime(9),
                IsBlocked = reader.GetInt32(10),
                WasBlocked = reader.GetInt32(11),
                CreatedAt = reader.GetDateTime(12),
                UpdatedAt = reader.GetDateTime(13),
                Platform = reader.GetString(14)
            };
        }
    }

    /// <summary>Resultado del último intento de sincronización de un canal (manual o automático).</summary>
    public class FollowerSyncStatus
    {
        public DateTime LastAttemptAt { get; set; }
        public DateTime? LastSuccessAt { get; set; }
        /// <summary>manual | auto</summary>
        public string Source { get; set; } = "manual";
        /// <summary>ok | unfollows_skipped | fetch_failed | skipped_large</summary>
        public string Result { get; set; } = "ok";
        public string? Detail { get; set; }
        public int NewCount { get; set; }
        public int ReturnedCount { get; set; }
        public int UnfollowedCount { get; set; }
        public int RenamedCount { get; set; }
    }

    /// <summary>
    /// Estadísticas de seguidores
    /// </summary>
    public class FollowerStats
    {
        public int TotalFollowers { get; set; }
        public int ActiveFollowers { get; set; }
        public int UnfollowedCount { get; set; }
        public int BlockedCount { get; set; }
        public int ReturnedCount { get; set; }
    }

    /// <summary>Qué pasó al registrar un follow en vivo.</summary>
    public enum FollowRecordOutcome
    {
        /// <summary>Persona nueva en el canal.</summary>
        Created = 0,
        /// <summary>Había dejado de seguir y volvió.</summary>
        Reactivated = 1,
        /// <summary>Evento repetido: ya figuraba como seguidor.</summary>
        AlreadyFollowing = 2,
    }
}
