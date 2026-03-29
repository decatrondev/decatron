using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Decatron.Core.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Core.Services
{
    public class ModerationService
    {
        private readonly string _connectionString;
        private readonly ILogger<ModerationService> _logger;

        public ModerationService(
            IConfiguration configuration,
            ILogger<ModerationService> logger)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
            _logger = logger;
        }

        /// <summary>
        /// Detecta si un mensaje contiene palabras prohibidas
        /// </summary>
        public async Task<(bool hasMatch, BannedWord? matchedWord)> DetectBannedWordAsync(string channelName, string message)
        {
            if (string.IsNullOrWhiteSpace(message))
                return (false, null);

            try
            {
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();

                var sql = @"
                    SELECT id, user_id, channel_name, word, severity, detections, created_at, updated_at
                    FROM banned_words
                    WHERE channel_name = @channelName
                    ORDER BY severity DESC";

                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("channelName", channelName.ToLower());

                await using var reader = await cmd.ExecuteReaderAsync();
                var messageLower = message.ToLower();

                _logger.LogInformation($"🔍 [MODERACIÓN] Verificando mensaje: '{message}' (lowercase: '{messageLower}')");

                while (await reader.ReadAsync())
                {
                    var word = reader.GetString(3); // word column
                    var wordPattern = word.ToLower();
                    var severity = reader.GetString(4);

                    _logger.LogDebug($"🔍 [MODERACIÓN] Verificando palabra: '{word}' (pattern: '{wordPattern}', severity: {severity})");

                    // Detectar si hay coincidencia
                    bool isMatch = false;

                    if (wordPattern.Contains("*"))
                    {
                        // Modo wildcard: usar regex
                        // Colapsar wildcards consecutivos para evitar backtracking: ***a*** -> *a*
                        var sanitized = Regex.Replace(wordPattern, @"\*+", "*");
                        var regexPattern = "^" + Regex.Escape(sanitized).Replace("\\*", ".*") + "$";
                        try
                        {
                            isMatch = new System.Text.RegularExpressions.Regex(regexPattern, System.Text.RegularExpressions.RegexOptions.None, TimeSpan.FromMilliseconds(100)).IsMatch(messageLower);
                        }
                        catch (RegexMatchTimeoutException)
                        {
                            _logger.LogWarning($"⚠️ [MODERACIÓN] Regex timeout para patrón: '{wordPattern}'");
                            isMatch = messageLower.Contains(word.ToLower());
                        }

                        if (isMatch)
                        {
                            _logger.LogWarning($"⚠️ [MODERACIÓN] ✅ MATCH con wildcard: '{word}' detectada en '{message}' (regex: {regexPattern})");
                        }
                    }
                    else
                    {
                        // Modo substring: buscar la palabra en el mensaje
                        // IMPORTANTE: Usar Contains para detectar la palabra en cualquier posición
                        isMatch = messageLower.Contains(wordPattern);

                        if (isMatch)
                        {
                            _logger.LogWarning($"⚠️ [MODERACIÓN] ✅ MATCH substring: '{word}' detectada en '{message}'");
                        }
                        else
                        {
                            _logger.LogDebug($"🔍 [MODERACIÓN] ❌ NO MATCH: '{wordPattern}' NO encontrada en '{messageLower}'");
                        }
                    }

                    if (isMatch)
                    {
                        var bannedWord = new BannedWord
                        {
                            Id = reader.GetInt64(0),
                            UserId = reader.GetInt64(1),
                            ChannelName = reader.GetString(2),
                            Word = word,
                            Severity = severity,
                            Detections = reader.GetInt32(5),
                            CreatedAt = reader.GetDateTime(6),
                            UpdatedAt = reader.GetDateTime(7)
                        };
                        return (true, bannedWord);
                    }
                }

                _logger.LogDebug($"🔍 [MODERACIÓN] Ninguna palabra prohibida detectada en: '{message}'");
                return (false, null);
            }
            catch (Exception ex)
            {
                _logger.LogError($"❌ Error detectando palabra prohibida: {ex.Message}");
                _logger.LogError($"❌ Stack trace: {ex.StackTrace}");
                return (false, null);
            }
        }

        /// <summary>
        /// Verifica si un usuario tiene inmunidad o escalamiento
        /// </summary>
        public async Task<(bool hasImmunity, bool hasEscalamiento, string reason)> CheckImmunityAsync(
            string channelName,
            string username,
            bool isModerator,
            bool isVip,
            bool isSubscriber)
        {
            try
            {
                _logger.LogInformation($"🔍 [INMUNIDAD] Verificando inmunidad para {username} en {channelName} (Mod={isModerator}, VIP={isVip}, Sub={isSubscriber})");

                // 1. Moderadores SIEMPRE tienen inmunidad total
                if (isModerator)
                {
                    _logger.LogInformation($"✅ [INMUNIDAD] {username} es MODERADOR → Inmunidad total");
                    return (true, false, "Moderador tiene inmunidad total");
                }

                // 2. Obtener configuración del canal
                var config = await GetModerationConfigAsync(channelName);
                if (config == null)
                {
                    _logger.LogWarning($"⚠️ [INMUNIDAD] No hay configuración de moderación para {channelName} → Sin inmunidad");
                    // Si no hay config, usar defaults (sin inmunidad)
                    return (false, false, "Sin inmunidad (default)");
                }

                // 3. Verificar whitelist (SIEMPRE inmune)
                var whitelistUsers = JsonSerializer.Deserialize<List<string>>(config.WhitelistUsers) ?? new List<string>();
                var usernameLower = username.ToLower();

                _logger.LogInformation($"🔍 [WHITELIST] Verificando si '{usernameLower}' está en whitelist. Usuarios en whitelist: [{string.Join(", ", whitelistUsers)}]");

                if (whitelistUsers.Contains(usernameLower))
                {
                    _logger.LogInformation($"✅ [WHITELIST] {username} está en WHITELIST → Inmunidad TOTAL");
                    return (true, false, "Usuario en whitelist (inmunidad total)");
                }
                else
                {
                    _logger.LogDebug($"❌ [WHITELIST] {username} NO está en whitelist");
                }

                // 4. Verificar VIP
                if (isVip)
                {
                    _logger.LogInformation($"🔍 [VIP] {username} es VIP. Configuración VIP inmunidad: {config.VipImmunity}");

                    if (config.VipImmunity == "total")
                    {
                        _logger.LogInformation($"✅ [VIP] {username} tiene inmunidad TOTAL como VIP");
                        return (true, false, "VIP con inmunidad total");
                    }
                    else if (config.VipImmunity == "escalamiento")
                    {
                        _logger.LogInformation($"⚖️ [VIP] {username} tiene ESCALAMIENTO como VIP (severidad reducida)");
                        return (false, true, "VIP con escalamiento (severidad reducida)");
                    }
                    else
                    {
                        _logger.LogDebug($"❌ [VIP] {username} es VIP pero NO tiene inmunidad ni escalamiento (config: {config.VipImmunity})");
                    }
                }

                // 5. Verificar Suscriptor
                if (isSubscriber)
                {
                    _logger.LogInformation($"🔍 [SUB] {username} es Suscriptor. Configuración Sub inmunidad: {config.SubImmunity}");

                    if (config.SubImmunity == "total")
                    {
                        _logger.LogInformation($"✅ [SUB] {username} tiene inmunidad TOTAL como Suscriptor");
                        return (true, false, "Suscriptor con inmunidad total");
                    }
                    else if (config.SubImmunity == "escalamiento")
                    {
                        _logger.LogInformation($"⚖️ [SUB] {username} tiene ESCALAMIENTO como Suscriptor (severidad reducida)");
                        return (false, true, "Suscriptor con escalamiento (severidad reducida)");
                    }
                    else
                    {
                        _logger.LogDebug($"❌ [SUB] {username} es Sub pero NO tiene inmunidad ni escalamiento (config: {config.SubImmunity})");
                    }
                }

                _logger.LogInformation($"❌ [INMUNIDAD] {username} NO tiene inmunidad ni escalamiento");
                return (false, false, "Sin inmunidad");
            }
            catch (Exception ex)
            {
                _logger.LogError($"❌ Error verificando inmunidad para {username}: {ex.Message}");
                _logger.LogError($"❌ Stack trace: {ex.StackTrace}");
                return (false, false, "Error verificando inmunidad");
            }
        }

        /// <summary>
        /// Procesa un strike para un usuario
        /// </summary>
        public async Task<(int strikeLevel, string action)> ProcessStrikeAsync(
            string channelName,
            string username,
            string severity)
        {
            try
            {
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();

                // Obtener configuración de moderación
                var config = await GetModerationConfigAsync(channelName);
                if (config == null)
                {
                    _logger.LogWarning($"No se encontró configuración de moderación para {channelName}");
                    return (1, "warning");
                }

                // Severidad "severo" = ban directo (no entra en escalamiento)
                if (severity == "severo")
                {
                    await LogModerationActionAsync(channelName, username, "severo", "ban", 0, null);
                    return (0, "ban");
                }

                // Para "medio" y "leve": entrar en sistema de escalamiento
                var userStrike = await GetOrCreateUserStrikeAsync(conn, channelName, username);

                // Reducción continua de strikes según tiempo configurado por el streamer
                var expirationTime = GetExpirationTimeSpan(config.StrikeExpiration);
                var timeSinceLastInfraction = DateTime.Now - userStrike.LastInfractionAt;
                var timeSinceCreated = DateTime.Now - userStrike.CreatedAt;

                // Reducir strikes si tiene strikes previos y ha pasado el tiempo configurado
                if (userStrike.StrikeLevel > 0 &&
                    expirationTime.HasValue &&
                    timeSinceCreated.TotalSeconds > 10)
                {
                    // Calcular cuántos períodos de expiración han pasado
                    int periodosTranscurridos = (int)(timeSinceLastInfraction.TotalMinutes / expirationTime.Value.TotalMinutes);

                    if (periodosTranscurridos > 0)
                    {
                        var oldLevel = userStrike.StrikeLevel;
                        userStrike.StrikeLevel = Math.Max(0, userStrike.StrikeLevel - periodosTranscurridos);
                        _logger.LogInformation($"⏱️ Strike reducido para {username} en {channelName}: {oldLevel} → {userStrike.StrikeLevel} (pasaron {timeSinceLastInfraction.TotalMinutes:F1} min, -{periodosTranscurridos} strikes)");
                    }
                }

                // SIEMPRE incrementar +1 strike (sin importar severidad)
                userStrike.StrikeLevel = Math.Min(5, userStrike.StrikeLevel + 1);
                _logger.LogInformation($"📈 Strike incrementado para {username} en {channelName}: nivel {userStrike.StrikeLevel}");

                // Actualizar timestamps
                userStrike.LastInfractionAt = DateTime.Now;
                userStrike.ExpiresAt = CalculateStrikeExpiration(config.StrikeExpiration);
                userStrike.UpdatedAt = DateTime.Now;

                // Actualizar strike en DB
                await UpdateUserStrikeAsync(conn, userStrike);

                // Obtener acción correspondiente al nivel de strike
                var action = GetStrikeAction(config, userStrike.StrikeLevel);

                // Log de moderación
                await LogModerationActionAsync(channelName, username, severity, action, userStrike.StrikeLevel, null);

                return (userStrike.StrikeLevel, action);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error procesando strike: {ex.Message}");
                return (1, "warning");
            }
        }

        /// <summary>
        /// Incrementa el contador de detecciones de una palabra
        /// </summary>
        public async Task IncrementWordDetectionAsync(long wordId)
        {
            try
            {
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();

                var sql = @"
                    UPDATE banned_words
                    SET detections = detections + 1,
                        updated_at = @updatedAt
                    WHERE id = @wordId";

                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("wordId", wordId);
                cmd.Parameters.AddWithValue("updatedAt", DateTime.Now);

                await cmd.ExecuteNonQueryAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error incrementando detecciones: {ex.Message}");
            }
        }

        /// <summary>
        /// Obtiene la configuración de moderación de un canal
        /// </summary>
        public async Task<ModerationConfig?> GetModerationConfigAsync(string channelName)
        {
            try
            {
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();

                var sql = @"
                    SELECT id, user_id, channel_name, vip_immunity, sub_immunity, whitelist_users,
                           warning_message, strike_expiration, strike1_action, strike2_action,
                           strike3_action, strike4_action, strike5_action, created_at, updated_at
                    FROM moderation_configs
                    WHERE channel_name = @channelName";

                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("channelName", channelName.ToLower());

                await using var reader = await cmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    return new ModerationConfig
                    {
                        Id = reader.GetInt64(0),
                        UserId = reader.GetInt64(1),
                        ChannelName = reader.GetString(2),
                        VipImmunity = reader.GetString(3),
                        SubImmunity = reader.GetString(4),
                        WhitelistUsers = reader.GetString(5),
                        WarningMessage = reader.GetString(6),
                        StrikeExpiration = reader.GetString(7),
                        Strike1Action = reader.GetString(8),
                        Strike2Action = reader.GetString(9),
                        Strike3Action = reader.GetString(10),
                        Strike4Action = reader.GetString(11),
                        Strike5Action = reader.GetString(12),
                        CreatedAt = reader.GetDateTime(13),
                        UpdatedAt = reader.GetDateTime(14)
                    };
                }

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error obteniendo configuración de moderación: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// Registra una acción de moderación
        /// </summary>
        private async Task LogModerationActionAsync(
            string channelName,
            string username,
            string severity,
            string actionTaken,
            int strikeLevel,
            string? fullMessage)
        {
            try
            {
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();

                var sql = @"
                    INSERT INTO moderation_logs
                    (channel_name, username, detected_word, severity, action_taken, strike_level, full_message, created_at)
                    VALUES (@channelName, @username, @detectedWord, @severity, @actionTaken, @strikeLevel, @fullMessage, @createdAt)";

                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("channelName", channelName.ToLower());
                cmd.Parameters.AddWithValue("username", username.ToLower());
                cmd.Parameters.AddWithValue("detectedWord", "");
                cmd.Parameters.AddWithValue("severity", severity);
                cmd.Parameters.AddWithValue("actionTaken", actionTaken);
                cmd.Parameters.AddWithValue("strikeLevel", strikeLevel);
                cmd.Parameters.AddWithValue("fullMessage", (object?)fullMessage ?? DBNull.Value);
                cmd.Parameters.AddWithValue("createdAt", DateTime.Now);

                await cmd.ExecuteNonQueryAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error registrando log de moderación: {ex.Message}");
            }
        }

        /// <summary>
        /// Obtiene o crea el registro de strike de un usuario
        /// </summary>
        private async Task<UserStrike> GetOrCreateUserStrikeAsync(NpgsqlConnection conn, string channelName, string username)
        {
            var sql = @"
                SELECT id, channel_name, username, strike_level, last_infraction_at, expires_at, created_at, updated_at
                FROM user_strikes
                WHERE channel_name = @channelName AND username = @username";

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("channelName", channelName.ToLower());
            cmd.Parameters.AddWithValue("username", username.ToLower());

            await using var reader = await cmd.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                var existingStrike = new UserStrike
                {
                    Id = reader.GetInt64(0),
                    ChannelName = reader.GetString(1),
                    Username = reader.GetString(2),
                    StrikeLevel = reader.GetInt32(3),
                    LastInfractionAt = reader.GetDateTime(4),
                    ExpiresAt = reader.IsDBNull(5) ? null : reader.GetDateTime(5),
                    CreatedAt = reader.GetDateTime(6),
                    UpdatedAt = reader.GetDateTime(7)
                };

                return existingStrike;
            }

            // Crear nuevo registro
            await reader.CloseAsync();

            var insertSql = @"
                INSERT INTO user_strikes (channel_name, username, strike_level, last_infraction_at, expires_at, created_at, updated_at)
                VALUES (@channelName, @username, 0, @now, NULL, @now, @now)
                RETURNING id, channel_name, username, strike_level, last_infraction_at, expires_at, created_at, updated_at";

            await using var insertCmd = new NpgsqlCommand(insertSql, conn);
            insertCmd.Parameters.AddWithValue("channelName", channelName.ToLower());
            insertCmd.Parameters.AddWithValue("username", username.ToLower());
            insertCmd.Parameters.AddWithValue("now", DateTime.Now);

            await using var insertReader = await insertCmd.ExecuteReaderAsync();
            await insertReader.ReadAsync();

            var newStrike = new UserStrike
            {
                Id = insertReader.GetInt64(0),
                ChannelName = insertReader.GetString(1),
                Username = insertReader.GetString(2),
                StrikeLevel = insertReader.GetInt32(3),
                LastInfractionAt = insertReader.GetDateTime(4),
                ExpiresAt = insertReader.IsDBNull(5) ? null : insertReader.GetDateTime(5),
                CreatedAt = insertReader.GetDateTime(6),
                UpdatedAt = insertReader.GetDateTime(7)
            };

            return newStrike;
        }

        /// <summary>
        /// Actualiza el strike de un usuario
        /// </summary>
        private async Task UpdateUserStrikeAsync(NpgsqlConnection conn, UserStrike userStrike)
        {
            var sql = @"
                UPDATE user_strikes
                SET strike_level = @strikeLevel,
                    last_infraction_at = @lastInfractionAt,
                    expires_at = @expiresAt,
                    updated_at = @updatedAt
                WHERE id = @id";

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("id", userStrike.Id);
            cmd.Parameters.AddWithValue("strikeLevel", userStrike.StrikeLevel);
            cmd.Parameters.AddWithValue("lastInfractionAt", userStrike.LastInfractionAt);
            cmd.Parameters.AddWithValue("expiresAt", (object?)userStrike.ExpiresAt ?? DBNull.Value);
            cmd.Parameters.AddWithValue("updatedAt", userStrike.UpdatedAt);

            await cmd.ExecuteNonQueryAsync();
        }

        /// <summary>
        /// Calcula la fecha de expiración de un strike
        /// </summary>
        private DateTime? CalculateStrikeExpiration(string expiration)
        {
            return expiration switch
            {
                "5min" => DateTime.Now.AddMinutes(5),
                "10min" => DateTime.Now.AddMinutes(10),
                "15min" => DateTime.Now.AddMinutes(15),
                "30min" => DateTime.Now.AddMinutes(30),
                "1hour" => DateTime.Now.AddHours(1),
                "never" => null,
                _ => DateTime.Now.AddMinutes(15)
            };
        }

        /// <summary>
        /// Convierte el string de expiración a TimeSpan
        /// </summary>
        private TimeSpan? GetExpirationTimeSpan(string expiration)
        {
            return expiration switch
            {
                "5min" => TimeSpan.FromMinutes(5),
                "10min" => TimeSpan.FromMinutes(10),
                "15min" => TimeSpan.FromMinutes(15),
                "30min" => TimeSpan.FromMinutes(30),
                "1hour" => TimeSpan.FromHours(1),
                "never" => null,
                _ => TimeSpan.FromMinutes(15)
            };
        }

        /// <summary>
        /// Obtiene la acción correspondiente a un nivel de strike
        /// </summary>
        private string GetStrikeAction(ModerationConfig config, int strikeLevel)
        {
            return strikeLevel switch
            {
                1 => config.Strike1Action,
                2 => config.Strike2Action,
                3 => config.Strike3Action,
                4 => config.Strike4Action,
                5 => config.Strike5Action,
                _ => "warning"
            };
        }
    }
}
