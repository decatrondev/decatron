using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
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
            DateTime? createDateTo = null)
        {
            var followers = new List<ChannelFollower>();

            try
            {
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();

                var sql = @"
                    SELECT id, broadcaster_id, broadcaster_name, user_id, user_name, user_login,
                           followed_at, account_created_at, is_following, unfollowed_at,
                           is_blocked, was_blocked, created_at, updated_at
                    FROM channel_followers
                    WHERE broadcaster_id = @broadcasterId";

                var parameters = new List<NpgsqlParameter>
                {
                    new("broadcasterId", broadcasterId)
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
        public async Task<List<FollowerHistory>> GetFollowerHistoryAsync(string broadcasterId, string userId)
        {
            var history = new List<FollowerHistory>();

            try
            {
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();

                var sql = @"
                    SELECT id, broadcaster_id, user_id, action, action_timestamp, created_at
                    FROM follower_history
                    WHERE broadcaster_id = @broadcasterId AND user_id = @userId
                    ORDER BY action_timestamp ASC";

                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("broadcasterId", broadcasterId);
                cmd.Parameters.AddWithValue("userId", userId);

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
                        CreatedAt = reader.GetDateTime(5)
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
        public async Task<bool> IsReturnedFollowerAsync(string broadcasterId, string userId)
        {
            try
            {
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();

                // Verificar si está actualmente siguiendo
                var sqlFollower = @"
                    SELECT is_following
                    FROM channel_followers
                    WHERE broadcaster_id = @broadcasterId AND user_id = @userId";

                await using var cmdFollower = new NpgsqlCommand(sqlFollower, conn);
                cmdFollower.Parameters.AddWithValue("broadcasterId", broadcasterId);
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
                      AND action = 1";

                await using var cmdHistory = new NpgsqlCommand(sqlHistory, conn);
                cmdHistory.Parameters.AddWithValue("broadcasterId", broadcasterId);
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
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();

                // Verificar si existe
                var sqlCheck = @"
                    SELECT id FROM channel_followers
                    WHERE broadcaster_id = @broadcasterId AND user_id = @userId";

                await using var cmdCheck = new NpgsqlCommand(sqlCheck, conn);
                cmdCheck.Parameters.AddWithValue("broadcasterId", follower.BroadcasterId);
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
                            is_blocked, was_blocked, created_at, updated_at
                        ) VALUES (
                            @broadcasterId, @broadcasterName, @userId, @userName, @userLogin,
                            @followedAt, @accountCreatedAt, @isFollowing, @unfollowedAt,
                            @isBlocked, @wasBlocked, @createdAt, @updatedAt
                        ) RETURNING id";

                    await using var cmdInsert = new NpgsqlCommand(sqlInsert, conn);
                    cmdInsert.Parameters.AddWithValue("broadcasterId", follower.BroadcasterId);
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
        /// Agrega una entrada al historial de seguimiento
        /// </summary>
        public async Task AddHistoryEntryAsync(string broadcasterId, string userId, int action, DateTime? actionTimestamp = null)
        {
            try
            {
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();

                var sql = @"
                    INSERT INTO follower_history (broadcaster_id, user_id, action, action_timestamp, created_at)
                    VALUES (@broadcasterId, @userId, @action, @actionTimestamp, @createdAt)";

                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("broadcasterId", broadcasterId);
                cmd.Parameters.AddWithValue("userId", userId);
                cmd.Parameters.AddWithValue("action", action);
                cmd.Parameters.AddWithValue("actionTimestamp", actionTimestamp ?? DateTime.UtcNow);
                cmd.Parameters.AddWithValue("createdAt", DateTime.UtcNow);

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
        public async Task UpdateBlockStatusAsync(string broadcasterId, string userId, bool isBlocked)
        {
            try
            {
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();

                var sql = @"
                    UPDATE channel_followers
                    SET is_blocked = @isBlocked,
                        was_blocked = CASE WHEN @isBlocked = 1 THEN 1 ELSE was_blocked END,
                        updated_at = @updatedAt
                    WHERE broadcaster_id = @broadcasterId AND user_id = @userId";

                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("broadcasterId", broadcasterId);
                cmd.Parameters.AddWithValue("userId", userId);
                cmd.Parameters.AddWithValue("isBlocked", isBlocked ? 1 : 0);
                cmd.Parameters.AddWithValue("updatedAt", DateTime.UtcNow);

                await cmd.ExecuteNonQueryAsync();

                // Agregar al historial
                await AddHistoryEntryAsync(broadcasterId, userId, isBlocked ? 2 : 3);

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
        public async Task<FollowerStats> GetFollowerStatsAsync(string broadcasterId)
        {
            var stats = new FollowerStats();

            try
            {
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();

                var sql = @"
                    SELECT
                        COUNT(*) as total,
                        COUNT(CASE WHEN is_following = 0 AND is_blocked = 0 THEN 1 END) as active,
                        COUNT(CASE WHEN is_following = 1 THEN 1 END) as unfollowed,
                        COUNT(CASE WHEN is_blocked = 1 THEN 1 END) as blocked
                    FROM channel_followers
                    WHERE broadcaster_id = @broadcasterId";

                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("broadcasterId", broadcasterId);

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
                    INNER JOIN follower_history fh ON cf.broadcaster_id = fh.broadcaster_id AND cf.user_id = fh.user_id
                    WHERE cf.broadcaster_id = @broadcasterId
                      AND cf.is_following = 0
                      AND fh.action = 1";

                await using var cmdReturned = new NpgsqlCommand(sqlReturned, conn);
                cmdReturned.Parameters.AddWithValue("broadcasterId", broadcasterId);

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
                UpdatedAt = reader.GetDateTime(13)
            };
        }
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
}
