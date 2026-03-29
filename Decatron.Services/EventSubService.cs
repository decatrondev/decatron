using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Services
{
    public class EventSubService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<EventSubService> _logger;
        private readonly HttpClient _httpClient;

        public EventSubService(
            IConfiguration configuration,
            ILogger<EventSubService> logger,
            HttpClient httpClient)
        {
            _configuration = configuration;
            _logger = logger;
            _httpClient = httpClient;
        }

        /// <summary>
        /// Obtiene el App Access Token del bot desde la tabla bot_tokens
        /// </summary>
        private async Task<string> GetBotAppAccessTokenAsync()
        {
            try
            {
                var connectionString = _configuration.GetConnectionString("DefaultConnection");
                using var connection = new NpgsqlConnection(connectionString);
                await connection.OpenAsync();

                const string query = @"
                    SELECT access_token, token_expiration
                    FROM bot_tokens
                    WHERE is_active = true
                    ORDER BY updated_at DESC
                    LIMIT 1";

                using var command = new NpgsqlCommand(query, connection);
                using var reader = await command.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    var rawToken = reader.GetString(0);
                    var accessToken = Decatron.Data.Encryption.TokenEncryption.Decrypt(rawToken, _configuration["JwtSettings:SecretKey"] ?? "");
                    var expiration = reader.IsDBNull(1) ? (DateTime?)null : reader.GetDateTime(1);

                    // Verificar si el token está expirado
                    if (expiration.HasValue && expiration.Value <= DateTime.UtcNow)
                    {
                        _logger.LogWarning("App Access Token del bot está expirado. Debe refrescarse.");
                        throw new InvalidOperationException("App Access Token expirado");
                    }

                    return accessToken;
                }

                throw new InvalidOperationException("No se encontró App Access Token del bot en la base de datos");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo App Access Token del bot");
                throw;
            }
        }

        /// <summary>
        /// Obtiene el User Access Token del broadcaster desde la tabla users
        /// </summary>
        private async Task<string> GetUserAccessTokenAsync(string broadcasterUserId)
        {
            try
            {
                var connectionString = _configuration.GetConnectionString("DefaultConnection");
                using var connection = new NpgsqlConnection(connectionString);
                await connection.OpenAsync();

                const string query = @"
                    SELECT access_token, token_expiration
                    FROM users
                    WHERE twitch_id = @twitchId
                    AND is_active = true
                    LIMIT 1";

                using var command = new NpgsqlCommand(query, connection);
                command.Parameters.AddWithValue("@twitchId", broadcasterUserId);
                using var reader = await command.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    var rawToken = reader.GetString(0);
                    var accessToken = Decatron.Data.Encryption.TokenEncryption.Decrypt(rawToken, _configuration["JwtSettings:SecretKey"] ?? "");
                    var expiration = reader.IsDBNull(1) ? (DateTime?)null : reader.GetDateTime(1);

                    // Verificar si el token está expirado
                    if (expiration.HasValue && expiration.Value <= DateTime.UtcNow)
                    {
                        _logger.LogWarning($"User Access Token del broadcaster {broadcasterUserId} está expirado. Debe refrescarse.");
                        throw new InvalidOperationException("User Access Token expirado");
                    }

                    return accessToken;
                }

                throw new InvalidOperationException($"No se encontró User Access Token para broadcaster {broadcasterUserId} en la base de datos");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error obteniendo User Access Token para broadcaster {broadcasterUserId}");
                throw;
            }
        }

        /// <summary>
        /// Registra una suscripción EventSub para channel.chat.message
        /// </summary>
        public async Task<EventSubSubscriptionResult> SubscribeToChatMessagesAsync(string broadcasterUserId)
        {
            try
            {
                var accessToken = await GetBotAppAccessTokenAsync();
                var clientId = _configuration["TwitchSettings:ClientId"];
                var webhookUrl = _configuration["TwitchSettings:WebhookCallbackUrl"];
                var webhookSecret = _configuration["TwitchSettings:WebhookSecret"];

                if (string.IsNullOrEmpty(webhookUrl))
                {
                    throw new InvalidOperationException("WebhookCallbackUrl no configurado en appsettings.json");
                }

                if (string.IsNullOrEmpty(webhookSecret))
                {
                    throw new InvalidOperationException("WebhookSecret no configurado en appsettings.json");
                }

                var payload = new
                {
                    type = "channel.chat.message",
                    version = "1",
                    condition = new
                    {
                        broadcaster_user_id = broadcasterUserId,
                        user_id = await GetBotUserIdAsync(accessToken)
                    },
                    transport = new
                    {
                        method = "webhook",
                        callback = webhookUrl,
                        secret = webhookSecret
                    }
                };

                var jsonContent = JsonSerializer.Serialize(payload);
                var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

                var request = new HttpRequestMessage(HttpMethod.Post, "https://api.twitch.tv/helix/eventsub/subscriptions")
                {
                    Content = content
                };

                request.Headers.Add("Client-ID", clientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");

                var response = await _httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"✅ Suscripción EventSub creada para broadcaster {broadcasterUserId}: channel.chat.message");
                    return new EventSubSubscriptionResult
                    {
                        Success = true,
                        Message = "Suscripción creada exitosamente",
                        ResponseBody = responseBody
                    };
                }
                else
                {
                    _logger.LogError($"❌ Error al crear suscripción EventSub: {response.StatusCode} - {responseBody}");
                    return new EventSubSubscriptionResult
                    {
                        Success = false,
                        Message = $"Error: {response.StatusCode}",
                        ResponseBody = responseBody
                    };
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear suscripción EventSub para channel.chat.message");
                return new EventSubSubscriptionResult
                {
                    Success = false,
                    Message = ex.Message,
                    ResponseBody = null
                };
            }
        }

        /// <summary>
        /// Registra una suscripción EventSub para channel.channel_points_custom_reward_redemption.add
        /// </summary>
        public async Task<EventSubSubscriptionResult> SubscribeToChannelPointsRedemptionAsync(string broadcasterUserId)
        {
            try
            {
                var accessToken = await GetBotAppAccessTokenAsync();
                var clientId = _configuration["TwitchSettings:ClientId"];
                var webhookUrl = _configuration["TwitchSettings:WebhookCallbackUrl"];
                var webhookSecret = _configuration["TwitchSettings:WebhookSecret"];

                if (string.IsNullOrEmpty(webhookUrl))
                {
                    throw new InvalidOperationException("WebhookCallbackUrl no configurado en appsettings.json");
                }

                if (string.IsNullOrEmpty(webhookSecret))
                {
                    throw new InvalidOperationException("WebhookSecret no configurado en appsettings.json");
                }

                var payload = new
                {
                    type = "channel.channel_points_custom_reward_redemption.add",
                    version = "1",
                    condition = new
                    {
                        broadcaster_user_id = broadcasterUserId
                    },
                    transport = new
                    {
                        method = "webhook",
                        callback = webhookUrl,
                        secret = webhookSecret
                    }
                };

                var jsonContent = JsonSerializer.Serialize(payload);
                var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

                var request = new HttpRequestMessage(HttpMethod.Post, "https://api.twitch.tv/helix/eventsub/subscriptions")
                {
                    Content = content
                };

                request.Headers.Add("Client-ID", clientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");

                var response = await _httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"✅ Suscripción EventSub creada para broadcaster {broadcasterUserId}: channel.channel_points_custom_reward_redemption.add");
                    return new EventSubSubscriptionResult
                    {
                        Success = true,
                        Message = "Suscripción creada exitosamente",
                        ResponseBody = responseBody
                    };
                }
                else
                {
                    _logger.LogError($"❌ Error al crear suscripción EventSub: {response.StatusCode} - {responseBody}");
                    return new EventSubSubscriptionResult
                    {
                        Success = false,
                        Message = $"Error: {response.StatusCode}",
                        ResponseBody = responseBody
                    };
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear suscripción EventSub para channel.channel_points_custom_reward_redemption.add");
                return new EventSubSubscriptionResult
                {
                    Success = false,
                    Message = ex.Message,
                    ResponseBody = null
                };
            }
        }

        /// <summary>
        /// Registra una suscripción EventSub para channel.follow
        /// </summary>
        public async Task<EventSubSubscriptionResult> SubscribeToFollowsAsync(string broadcasterUserId, string moderatorUserId)
        {
            try
            {
                var accessToken = await GetBotAppAccessTokenAsync();
                var clientId = _configuration["TwitchSettings:ClientId"];
                var webhookUrl = _configuration["TwitchSettings:WebhookCallbackUrl"];
                var webhookSecret = _configuration["TwitchSettings:WebhookSecret"];

                if (string.IsNullOrEmpty(webhookUrl))
                {
                    throw new InvalidOperationException("WebhookCallbackUrl no configurado en appsettings.json");
                }

                if (string.IsNullOrEmpty(webhookSecret))
                {
                    throw new InvalidOperationException("WebhookSecret no configurado en appsettings.json");
                }

                var payload = new
                {
                    type = "channel.follow",
                    version = "2",
                    condition = new
                    {
                        broadcaster_user_id = broadcasterUserId,
                        moderator_user_id = moderatorUserId
                    },
                    transport = new
                    {
                        method = "webhook",
                        callback = webhookUrl,
                        secret = webhookSecret
                    }
                };

                var jsonContent = JsonSerializer.Serialize(payload);
                var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

                var request = new HttpRequestMessage(HttpMethod.Post, "https://api.twitch.tv/helix/eventsub/subscriptions")
                {
                    Content = content
                };

                request.Headers.Add("Client-ID", clientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");

                var response = await _httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"✅ Suscripción EventSub creada para broadcaster {broadcasterUserId}: channel.follow");
                    return new EventSubSubscriptionResult
                    {
                        Success = true,
                        Message = "Suscripción creada exitosamente",
                        ResponseBody = responseBody
                    };
                }
                else
                {
                    _logger.LogError($"❌ Error al crear suscripción EventSub: {response.StatusCode} - {responseBody}");
                    return new EventSubSubscriptionResult
                    {
                        Success = false,
                        Message = $"Error: {response.StatusCode}",
                        ResponseBody = responseBody
                    };
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear suscripción EventSub para channel.follow");
                return new EventSubSubscriptionResult
                {
                    Success = false,
                    Message = ex.Message,
                    ResponseBody = null
                };
            }
        }

        /// <summary>
        /// Registra una suscripción EventSub para channel.cheer (Bits)
        /// El broadcaster debe tener scope bits:read autorizado, pero la suscripción se crea con App Access Token
        /// </summary>
        public async Task<EventSubSubscriptionResult> SubscribeToCheerAsync(string broadcasterUserId)
        {
            try
            {
                var accessToken = await GetBotAppAccessTokenAsync();
                var clientId = _configuration["TwitchSettings:ClientId"];
                var webhookUrl = _configuration["TwitchSettings:WebhookCallbackUrl"];
                var webhookSecret = _configuration["TwitchSettings:WebhookSecret"];

                var payload = new
                {
                    type = "channel.cheer",
                    version = "1",
                    condition = new
                    {
                        broadcaster_user_id = broadcasterUserId
                    },
                    transport = new
                    {
                        method = "webhook",
                        callback = webhookUrl,
                        secret = webhookSecret
                    }
                };

                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var request = new HttpRequestMessage(HttpMethod.Post, "https://api.twitch.tv/helix/eventsub/subscriptions");
                request.Headers.Add("Client-ID", clientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");
                request.Content = content;

                var response = await _httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"✅ Suscripción a channel.cheer creada para broadcaster: {broadcasterUserId}");
                    return new EventSubSubscriptionResult { Success = true, Message = "Suscripción creada", ResponseBody = responseBody };
                }
                else
                {
                    _logger.LogError($"❌ Error al suscribirse a channel.cheer: {response.StatusCode} - {responseBody}");
                    return new EventSubSubscriptionResult { Success = false, Message = $"Error: {response.StatusCode}", ResponseBody = responseBody };
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al suscribirse a channel.cheer");
                return new EventSubSubscriptionResult { Success = false, Message = ex.Message, ResponseBody = null };
            }
        }

        /// <summary>
        /// Registra una suscripción EventSub para channel.subscribe (Subscriptions)
        /// </summary>
        public async Task<EventSubSubscriptionResult> SubscribeToSubscriptionsAsync(string broadcasterUserId)
        {
            try
            {
                var accessToken = await GetBotAppAccessTokenAsync();
                var clientId = _configuration["TwitchSettings:ClientId"];
                var webhookUrl = _configuration["TwitchSettings:WebhookCallbackUrl"];
                var webhookSecret = _configuration["TwitchSettings:WebhookSecret"];

                var payload = new
                {
                    type = "channel.subscribe",
                    version = "1",
                    condition = new
                    {
                        broadcaster_user_id = broadcasterUserId
                    },
                    transport = new
                    {
                        method = "webhook",
                        callback = webhookUrl,
                        secret = webhookSecret
                    }
                };

                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var request = new HttpRequestMessage(HttpMethod.Post, "https://api.twitch.tv/helix/eventsub/subscriptions");
                request.Headers.Add("Client-ID", clientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");
                request.Content = content;

                var response = await _httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"✅ Suscripción a channel.subscribe creada para broadcaster: {broadcasterUserId}");
                    return new EventSubSubscriptionResult { Success = true, Message = "Suscripción creada", ResponseBody = responseBody };
                }
                else
                {
                    _logger.LogError($"❌ Error al suscribirse a channel.subscribe: {response.StatusCode} - {responseBody}");
                    return new EventSubSubscriptionResult { Success = false, Message = $"Error: {response.StatusCode}", ResponseBody = responseBody };
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al suscribirse a channel.subscribe");
                return new EventSubSubscriptionResult { Success = false, Message = ex.Message, ResponseBody = null };
            }
        }

        /// <summary>
        /// Registra una suscripción EventSub para channel.subscription.gift (Gift Subscriptions)
        /// </summary>
        public async Task<EventSubSubscriptionResult> SubscribeToGiftSubsAsync(string broadcasterUserId)
        {
            try
            {
                var accessToken = await GetBotAppAccessTokenAsync();
                var clientId = _configuration["TwitchSettings:ClientId"];
                var webhookUrl = _configuration["TwitchSettings:WebhookCallbackUrl"];
                var webhookSecret = _configuration["TwitchSettings:WebhookSecret"];

                var payload = new
                {
                    type = "channel.subscription.gift",
                    version = "1",
                    condition = new
                    {
                        broadcaster_user_id = broadcasterUserId
                    },
                    transport = new
                    {
                        method = "webhook",
                        callback = webhookUrl,
                        secret = webhookSecret
                    }
                };

                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var request = new HttpRequestMessage(HttpMethod.Post, "https://api.twitch.tv/helix/eventsub/subscriptions");
                request.Headers.Add("Client-ID", clientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");
                request.Content = content;

                var response = await _httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"✅ Suscripción a channel.subscription.gift creada para broadcaster: {broadcasterUserId}");
                    return new EventSubSubscriptionResult { Success = true, Message = "Suscripción creada", ResponseBody = responseBody };
                }
                else
                {
                    _logger.LogError($"❌ Error al suscribirse a channel.subscription.gift: {response.StatusCode} - {responseBody}");
                    return new EventSubSubscriptionResult { Success = false, Message = $"Error: {response.StatusCode}", ResponseBody = responseBody };
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al suscribirse a channel.subscription.gift");
                return new EventSubSubscriptionResult { Success = false, Message = ex.Message, ResponseBody = null };
            }
        }

        /// <summary>
        /// Registra una suscripción EventSub para channel.raid
        /// </summary>
        public async Task<EventSubSubscriptionResult> SubscribeToRaidAsync(string toBroadcasterUserId)
        {
            try
            {
                var accessToken = await GetBotAppAccessTokenAsync();
                var clientId = _configuration["TwitchSettings:ClientId"];
                var webhookUrl = _configuration["TwitchSettings:WebhookCallbackUrl"];
                var webhookSecret = _configuration["TwitchSettings:WebhookSecret"];

                var payload = new
                {
                    type = "channel.raid",
                    version = "1",
                    condition = new
                    {
                        to_broadcaster_user_id = toBroadcasterUserId
                    },
                    transport = new
                    {
                        method = "webhook",
                        callback = webhookUrl,
                        secret = webhookSecret
                    }
                };

                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var request = new HttpRequestMessage(HttpMethod.Post, "https://api.twitch.tv/helix/eventsub/subscriptions");
                request.Headers.Add("Client-ID", clientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");
                request.Content = content;

                var response = await _httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"✅ Suscripción a channel.raid creada para broadcaster: {toBroadcasterUserId}");
                    return new EventSubSubscriptionResult { Success = true, Message = "Suscripción creada", ResponseBody = responseBody };
                }
                else
                {
                    _logger.LogError($"❌ Error al suscribirse a channel.raid: {response.StatusCode} - {responseBody}");
                    return new EventSubSubscriptionResult { Success = false, Message = $"Error: {response.StatusCode}", ResponseBody = responseBody };
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al suscribirse a channel.raid");
                return new EventSubSubscriptionResult { Success = false, Message = ex.Message, ResponseBody = null };
            }
        }

        /// <summary>
        /// Registra una suscripción EventSub para channel.hype_train.begin
        /// El broadcaster debe tener scope channel:read:hype_train autorizado, pero la suscripción se crea con App Access Token
        /// </summary>
        public async Task<EventSubSubscriptionResult> SubscribeToHypeTrainBeginAsync(string broadcasterUserId)
        {
            try
            {
                var accessToken = await GetBotAppAccessTokenAsync();
                var clientId = _configuration["TwitchSettings:ClientId"];
                var webhookUrl = _configuration["TwitchSettings:WebhookCallbackUrl"];
                var webhookSecret = _configuration["TwitchSettings:WebhookSecret"];

                var payload = new
                {
                    type = "channel.hype_train.begin",
                    version = "1",
                    condition = new
                    {
                        broadcaster_user_id = broadcasterUserId
                    },
                    transport = new
                    {
                        method = "webhook",
                        callback = webhookUrl,
                        secret = webhookSecret
                    }
                };

                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var request = new HttpRequestMessage(HttpMethod.Post, "https://api.twitch.tv/helix/eventsub/subscriptions");
                request.Headers.Add("Client-ID", clientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");
                request.Content = content;

                var response = await _httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"✅ Suscripción a channel.hype_train.begin creada para broadcaster: {broadcasterUserId}");
                    return new EventSubSubscriptionResult { Success = true, Message = "Suscripción creada", ResponseBody = responseBody };
                }
                else
                {
                    _logger.LogError($"❌ Error al suscribirse a channel.hype_train.begin: {response.StatusCode} - {responseBody}");
                    return new EventSubSubscriptionResult { Success = false, Message = $"Error: {response.StatusCode}", ResponseBody = responseBody };
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al suscribirse a channel.hype_train.begin");
                return new EventSubSubscriptionResult { Success = false, Message = ex.Message, ResponseBody = null };
            }
        }

        /// <summary>
        /// Lista todas las suscripciones EventSub activas
        /// </summary>
        public async Task<EventSubSubscriptionListResult> ListSubscriptionsAsync()
        {
            try
            {
                var accessToken = await GetBotAppAccessTokenAsync();
                var clientId = _configuration["TwitchSettings:ClientId"];

                var request = new HttpRequestMessage(HttpMethod.Get, "https://api.twitch.tv/helix/eventsub/subscriptions");
                request.Headers.Add("Client-ID", clientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");

                var response = await _httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("✅ Lista de suscripciones EventSub obtenida exitosamente");
                    return new EventSubSubscriptionListResult
                    {
                        Success = true,
                        Message = "Lista obtenida exitosamente",
                        ResponseBody = responseBody
                    };
                }
                else
                {
                    _logger.LogError($"❌ Error al listar suscripciones EventSub: {response.StatusCode} - {responseBody}");
                    return new EventSubSubscriptionListResult
                    {
                        Success = false,
                        Message = $"Error: {response.StatusCode}",
                        ResponseBody = responseBody
                    };
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al listar suscripciones EventSub");
                return new EventSubSubscriptionListResult
                {
                    Success = false,
                    Message = ex.Message,
                    ResponseBody = null
                };
            }
        }

        /// <summary>
        /// Elimina una suscripción EventSub por ID
        /// </summary>
        public async Task<EventSubSubscriptionResult> DeleteSubscriptionAsync(string subscriptionId)
        {
            try
            {
                var accessToken = await GetBotAppAccessTokenAsync();
                var clientId = _configuration["TwitchSettings:ClientId"];

                var request = new HttpRequestMessage(HttpMethod.Delete, $"https://api.twitch.tv/helix/eventsub/subscriptions?id={subscriptionId}");
                request.Headers.Add("Client-ID", clientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");

                var response = await _httpClient.SendAsync(request);

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"✅ Suscripción EventSub eliminada: {subscriptionId}");
                    return new EventSubSubscriptionResult
                    {
                        Success = true,
                        Message = "Suscripción eliminada exitosamente",
                        ResponseBody = null
                    };
                }
                else
                {
                    var responseBody = await response.Content.ReadAsStringAsync();
                    _logger.LogError($"❌ Error al eliminar suscripción EventSub: {response.StatusCode} - {responseBody}");
                    return new EventSubSubscriptionResult
                    {
                        Success = false,
                        Message = $"Error: {response.StatusCode}",
                        ResponseBody = responseBody
                    };
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al eliminar suscripción EventSub");
                return new EventSubSubscriptionResult
                {
                    Success = false,
                    Message = ex.Message,
                    ResponseBody = null
                };
            }
        }

        /// <summary>
        /// Verifica si ya existe una suscripción activa para un broadcaster
        /// </summary>
        public async Task<bool> HasActiveSubscriptionAsync(string broadcasterUserId, string eventType = "channel.chat.message")
        {
            try
            {
                var result = await ListSubscriptionsAsync();

                if (!result.Success || string.IsNullOrEmpty(result.ResponseBody))
                    return false;

                var json = JsonSerializer.Deserialize<JsonElement>(result.ResponseBody);
                var data = json.GetProperty("data");

                foreach (var subscription in data.EnumerateArray())
                {
                    var type = subscription.GetProperty("type").GetString();
                    var status = subscription.GetProperty("status").GetString();

                    if (type == eventType && (status == "enabled" || status == "webhook_callback_verification_pending"))
                    {
                        var condition = subscription.GetProperty("condition");

                        // channel.raid usa to_broadcaster_user_id en lugar de broadcaster_user_id
                        string subBroadcasterId = null;
                        if (eventType == "channel.raid")
                        {
                            if (condition.TryGetProperty("to_broadcaster_user_id", out var toId))
                                subBroadcasterId = toId.GetString();
                        }
                        else
                        {
                            if (condition.TryGetProperty("broadcaster_user_id", out var broadcasterId))
                                subBroadcasterId = broadcasterId.GetString();
                        }

                        if (subBroadcasterId == broadcasterUserId)
                        {
                            _logger.LogInformation($"✅ Suscripción {eventType} ya existe para broadcaster {broadcasterUserId}");
                            return true;
                        }
                    }
                }

                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando suscripción para broadcaster {broadcasterUserId}");
                return false;
            }
        }

        /// <summary>
        /// Registra suscripción solo si no existe
        /// </summary>
        public async Task<EventSubSubscriptionResult> EnsureSubscriptionAsync(string broadcasterUserId)
        {
            try
            {
                // Verificar si ya existe
                var hasSubscription = await HasActiveSubscriptionAsync(broadcasterUserId);

                if (hasSubscription)
                {
                    _logger.LogInformation($"⏭️ Suscripción ya existe para broadcaster {broadcasterUserId}, omitiendo");
                    return new EventSubSubscriptionResult
                    {
                        Success = true,
                        Message = "Suscripción ya existe",
                        ResponseBody = null
                    };
                }

                // No existe, crear nueva
                return await SubscribeToChatMessagesAsync(broadcasterUserId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error asegurando suscripción para broadcaster {broadcasterUserId}");
                return new EventSubSubscriptionResult
                {
                    Success = false,
                    Message = ex.Message,
                    ResponseBody = null
                };
            }
        }

        /// <summary>
        /// Registra suscripción de channel points solo si no existe
        /// </summary>
        public async Task<EventSubSubscriptionResult> EnsureChannelPointsSubscriptionAsync(string broadcasterUserId)
        {
            try
            {
                // Verificar si ya existe
                var hasSubscription = await HasActiveSubscriptionAsync(broadcasterUserId, "channel.channel_points_custom_reward_redemption.add");

                if (hasSubscription)
                {
                    _logger.LogInformation($"⏭️ Suscripción de channel points ya existe para broadcaster {broadcasterUserId}, omitiendo");
                    return new EventSubSubscriptionResult
                    {
                        Success = true,
                        Message = "Suscripción de channel points ya existe",
                        ResponseBody = null
                    };
                }

                // No existe, crear nueva
                return await SubscribeToChannelPointsRedemptionAsync(broadcasterUserId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error asegurando suscripción de channel points para broadcaster {broadcasterUserId}");
                return new EventSubSubscriptionResult
                {
                    Success = false,
                    Message = ex.Message,
                    ResponseBody = null
                };
            }
        }

        /// <summary>
        /// Registra suscripción de follows solo si no existe
        /// </summary>
        public async Task<EventSubSubscriptionResult> EnsureFollowsSubscriptionAsync(string broadcasterUserId)
        {
            try
            {
                // Verificar si ya existe
                var hasSubscription = await HasActiveSubscriptionAsync(broadcasterUserId, "channel.follow");

                if (hasSubscription)
                {
                    _logger.LogInformation($"⏭️ Suscripción de follows ya existe para broadcaster {broadcasterUserId}, omitiendo");
                    return new EventSubSubscriptionResult
                    {
                        Success = true,
                        Message = "Suscripción de follows ya existe",
                        ResponseBody = null
                    };
                }

                // No existe, crear nueva (moderator_user_id = broadcaster_user_id)
                return await SubscribeToFollowsAsync(broadcasterUserId, broadcasterUserId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error asegurando suscripción de follows para broadcaster {broadcasterUserId}");
                return new EventSubSubscriptionResult
                {
                    Success = false,
                    Message = ex.Message,
                    ResponseBody = null
                };
            }
        }

        /// <summary>
        /// Obtiene el bot_twitch_id desde la tabla bot_tokens
        /// </summary>
        private async Task<string> GetBotUserIdAsync(string accessToken)
        {
            try
            {
                // Primero intentar obtener desde la base de datos
                var connectionString = _configuration.GetConnectionString("DefaultConnection");
                using var connection = new NpgsqlConnection(connectionString);
                await connection.OpenAsync();

                const string query = @"
                    SELECT bot_twitch_id
                    FROM bot_tokens
                    WHERE is_active = true
                    ORDER BY updated_at DESC
                    LIMIT 1";

                using var command = new NpgsqlCommand(query, connection);
                var result = await command.ExecuteScalarAsync();

                if (result != null && !string.IsNullOrEmpty(result.ToString()))
                {
                    return result.ToString();
                }

                // Si no está en BD, obtener desde la API de Twitch
                _logger.LogWarning("bot_twitch_id no encontrado en BD, obteniendo desde API de Twitch");
                var clientId = _configuration["TwitchSettings:ClientId"];

                var request = new HttpRequestMessage(HttpMethod.Get, "https://api.twitch.tv/helix/users");
                request.Headers.Add("Client-ID", clientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");

                var response = await _httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    var json = JsonSerializer.Deserialize<JsonElement>(responseBody);
                    var data = json.GetProperty("data");
                    if (data.GetArrayLength() > 0)
                    {
                        var userId = data[0].GetProperty("id").GetString();
                        _logger.LogInformation($"Bot User ID obtenido desde API: {userId}");
                        return userId;
                    }
                }

                throw new InvalidOperationException("No se pudo obtener bot_twitch_id");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo bot_twitch_id");
                throw;
            }
        }

        // ============================================================================
        // MÉTODOS "ENSURE" PARA EVENTOS DEL TIMER
        // ============================================================================

        /// <summary>
        /// Registra suscripción de cheer (bits) solo si no existe
        /// </summary>
        public async Task<EventSubSubscriptionResult> EnsureCheerSubscriptionAsync(string broadcasterUserId)
        {
            try
            {
                var hasSubscription = await HasActiveSubscriptionAsync(broadcasterUserId, "channel.cheer");
                if (hasSubscription)
                {
                    _logger.LogInformation($"⏭️ Suscripción de cheer ya existe para broadcaster {broadcasterUserId}, omitiendo");
                    return new EventSubSubscriptionResult { Success = true, Message = "Suscripción de cheer ya existe", ResponseBody = null };
                }
                return await SubscribeToCheerAsync(broadcasterUserId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error asegurando suscripción de cheer para broadcaster {broadcasterUserId}");
                return new EventSubSubscriptionResult { Success = false, Message = ex.Message, ResponseBody = null };
            }
        }

        /// <summary>
        /// Registra suscripción de subscriptions (subs) solo si no existe
        /// </summary>
        public async Task<EventSubSubscriptionResult> EnsureSubscriptionsSubscriptionAsync(string broadcasterUserId)
        {
            try
            {
                var hasSubscription = await HasActiveSubscriptionAsync(broadcasterUserId, "channel.subscribe");
                if (hasSubscription)
                {
                    _logger.LogInformation($"⏭️ Suscripción de subscribe ya existe para broadcaster {broadcasterUserId}, omitiendo");
                    return new EventSubSubscriptionResult { Success = true, Message = "Suscripción de subscribe ya existe", ResponseBody = null };
                }
                return await SubscribeToSubscriptionsAsync(broadcasterUserId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error asegurando suscripción de subscribe para broadcaster {broadcasterUserId}");
                return new EventSubSubscriptionResult { Success = false, Message = ex.Message, ResponseBody = null };
            }
        }

        /// <summary>
        /// Registra suscripción de gift subs solo si no existe
        /// </summary>
        public async Task<EventSubSubscriptionResult> EnsureGiftSubsSubscriptionAsync(string broadcasterUserId)
        {
            try
            {
                var hasSubscription = await HasActiveSubscriptionAsync(broadcasterUserId, "channel.subscription.gift");
                if (hasSubscription)
                {
                    _logger.LogInformation($"⏭️ Suscripción de gift subs ya existe para broadcaster {broadcasterUserId}, omitiendo");
                    return new EventSubSubscriptionResult { Success = true, Message = "Suscripción de gift subs ya existe", ResponseBody = null };
                }
                return await SubscribeToGiftSubsAsync(broadcasterUserId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error asegurando suscripción de gift subs para broadcaster {broadcasterUserId}");
                return new EventSubSubscriptionResult { Success = false, Message = ex.Message, ResponseBody = null };
            }
        }

        /// <summary>
        /// Registra suscripción de raids solo si no existe
        /// </summary>
        public async Task<EventSubSubscriptionResult> EnsureRaidSubscriptionAsync(string broadcasterUserId)
        {
            try
            {
                var hasSubscription = await HasActiveSubscriptionAsync(broadcasterUserId, "channel.raid");
                if (hasSubscription)
                {
                    _logger.LogInformation($"⏭️ Suscripción de raid ya existe para broadcaster {broadcasterUserId}, omitiendo");
                    return new EventSubSubscriptionResult { Success = true, Message = "Suscripción de raid ya existe", ResponseBody = null };
                }
                return await SubscribeToRaidAsync(broadcasterUserId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error asegurando suscripción de raid para broadcaster {broadcasterUserId}");
                return new EventSubSubscriptionResult { Success = false, Message = ex.Message, ResponseBody = null };
            }
        }

        /// <summary>
        /// Registra suscripción de hype train solo si no existe
        /// </summary>
        public async Task<EventSubSubscriptionResult> EnsureHypeTrainSubscriptionAsync(string broadcasterUserId)
        {
            try
            {
                var hasSubscription = await HasActiveSubscriptionAsync(broadcasterUserId, "channel.hype_train.begin");
                if (hasSubscription)
                {
                    _logger.LogInformation($"⏭️ Suscripción de hype train ya existe para broadcaster {broadcasterUserId}, omitiendo");
                    return new EventSubSubscriptionResult { Success = true, Message = "Suscripción de hype train ya existe", ResponseBody = null };
                }
                return await SubscribeToHypeTrainBeginAsync(broadcasterUserId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error asegurando suscripción de hype train para broadcaster {broadcasterUserId}");
                return new EventSubSubscriptionResult { Success = false, Message = ex.Message, ResponseBody = null };
            }
        }

        // ── stream.online ─────────────────────────────────────────────────────────

        public async Task<EventSubSubscriptionResult> EnsureStreamOnlineSubscriptionAsync(string broadcasterUserId)
        {
            try
            {
                var hasSubscription = await HasActiveSubscriptionAsync(broadcasterUserId, "stream.online");
                if (hasSubscription)
                {
                    _logger.LogInformation($"⏭️ Suscripción stream.online ya existe para broadcaster {broadcasterUserId}, omitiendo");
                    return new EventSubSubscriptionResult { Success = true, Message = "Suscripción stream.online ya existe", ResponseBody = null };
                }
                return await SubscribeToStreamEventAsync(broadcasterUserId, "stream.online");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error asegurando suscripción stream.online para broadcaster {broadcasterUserId}");
                return new EventSubSubscriptionResult { Success = false, Message = ex.Message, ResponseBody = null };
            }
        }

        // ── stream.offline ────────────────────────────────────────────────────────

        public async Task<EventSubSubscriptionResult> EnsureStreamOfflineSubscriptionAsync(string broadcasterUserId)
        {
            try
            {
                var hasSubscription = await HasActiveSubscriptionAsync(broadcasterUserId, "stream.offline");
                if (hasSubscription)
                {
                    _logger.LogInformation($"⏭️ Suscripción stream.offline ya existe para broadcaster {broadcasterUserId}, omitiendo");
                    return new EventSubSubscriptionResult { Success = true, Message = "Suscripción stream.offline ya existe", ResponseBody = null };
                }
                return await SubscribeToStreamEventAsync(broadcasterUserId, "stream.offline");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error asegurando suscripción stream.offline para broadcaster {broadcasterUserId}");
                return new EventSubSubscriptionResult { Success = false, Message = ex.Message, ResponseBody = null };
            }
        }

        private async Task<EventSubSubscriptionResult> SubscribeToStreamEventAsync(string broadcasterUserId, string eventType)
        {
            try
            {
                var accessToken  = await GetBotAppAccessTokenAsync();
                var clientId     = _configuration["TwitchSettings:ClientId"];
                var webhookUrl   = _configuration["TwitchSettings:WebhookCallbackUrl"];
                var webhookSecret = _configuration["TwitchSettings:WebhookSecret"];

                var payload = new
                {
                    type = eventType,
                    version = "1",
                    condition = new { broadcaster_user_id = broadcasterUserId },
                    transport = new
                    {
                        method   = "webhook",
                        callback = webhookUrl,
                        secret   = webhookSecret
                    }
                };

                var json    = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var request = new HttpRequestMessage(HttpMethod.Post, "https://api.twitch.tv/helix/eventsub/subscriptions");
                request.Headers.Add("Client-ID", clientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");
                request.Content = content;

                var response     = await _httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"✅ Suscripción {eventType} creada para broadcaster: {broadcasterUserId}");
                    return new EventSubSubscriptionResult { Success = true, Message = "Suscripción creada", ResponseBody = responseBody };
                }
                else
                {
                    _logger.LogError($"❌ Error al suscribirse a {eventType}: {response.StatusCode} - {responseBody}");
                    return new EventSubSubscriptionResult { Success = false, Message = $"Error: {response.StatusCode}", ResponseBody = responseBody };
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al suscribirse a {eventType}");
                return new EventSubSubscriptionResult { Success = false, Message = ex.Message, ResponseBody = null };
            }
        }
    }

    public class EventSubSubscriptionResult
    {
        public bool Success { get; set; }
        public string Message { get; set; }
        public string ResponseBody { get; set; }
    }

    public class EventSubSubscriptionListResult
    {
        public bool Success { get; set; }
        public string Message { get; set; }
        public string ResponseBody { get; set; }
    }
}
