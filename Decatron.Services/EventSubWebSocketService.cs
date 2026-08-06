using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;
using TwitchLib.EventSub.Core.SubscriptionTypes.Channel;
using TwitchLib.EventSub.Core.SubscriptionTypes.Stream;
using TwitchLib.EventSub.Websockets;

namespace Decatron.Services
{
    /// <summary>
    /// Transporte WebSocket/Conduit de EventSub. Convive con EventSubBackgroundService
    /// (webhook) mientras dura la migración (Fase B.4 del roadmap) — no borra ni toca
    /// las suscripciones webhook por sí solo.
    ///
    /// Cada shard es una sesión EventSubWebsocketClient independiente asociada a un
    /// shard del Conduit vía UpdateConduitShardsAsync. Las suscripciones se crean con
    /// transport {method: "conduit", conduit_id} — sin session_id — así que una
    /// reconexión de shard solo reasocia sesión, nunca recrea suscripciones.
    /// </summary>
    public class EventSubWebSocketService : BackgroundService
    {
        private static readonly Uri EventSubWebSocketUrl = new("wss://eventsub.wss.twitch.tv/ws");

        private readonly ILogger<EventSubWebSocketService> _logger;
        private readonly ILoggerFactory _loggerFactory;
        private readonly IServiceProvider _serviceProvider;
        private readonly IConfiguration _configuration;
        private readonly List<EventSubWebsocketClient> _shards = new();

        private string? _conduitId;

        public EventSubWebSocketService(
            ILogger<EventSubWebSocketService> logger,
            ILoggerFactory loggerFactory,
            IServiceProvider serviceProvider,
            IConfiguration configuration)
        {
            _logger = logger;
            _loggerFactory = loggerFactory;
            _serviceProvider = serviceProvider;
            _configuration = configuration;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // Mismo warm-up que EventSubBackgroundService: deja terminar el arranque del host.
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

            var shardCount = _configuration.GetValue<int?>("EventSubSettings:ShardCount") ?? 1;

            using (var scope = _serviceProvider.CreateScope())
            {
                var eventSubService = scope.ServiceProvider.GetRequiredService<EventSubService>();
                _conduitId = await EnsureConduitAsync(eventSubService, shardCount);
            }

            if (string.IsNullOrEmpty(_conduitId))
            {
                _logger.LogError("❌ No se pudo obtener ni crear el conduit de EventSub. El transporte WebSocket no arranca — el webhook sigue siendo el único canal activo.");
                return;
            }

            _logger.LogInformation($"🚀 Iniciando {shardCount} shard(s) del conduit {_conduitId}");

            for (var shardIndex = 0; shardIndex < shardCount; shardIndex++)
            {
                var shardId = shardIndex.ToString();
                var client = CreateShardClient(shardId);
                _shards.Add(client);

                try
                {
                    var connected = await client.ConnectAsync(EventSubWebSocketUrl);
                    if (!connected)
                    {
                        _logger.LogError($"❌ Shard {shardId}: ConnectAsync devolvió false");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error conectando el shard {shardId}");
                }
            }

            try
            {
                await Task.Delay(Timeout.Infinite, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                // Apagado normal del host
            }

            foreach (var client in _shards)
            {
                try
                {
                    await client.DisconnectAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error desconectando shard de EventSub durante el apagado");
                }
            }
        }

        /// <summary>
        /// Reusa el conduit existente de este client_id si ya hay uno (no se recrean
        /// suscripciones en cada reinicio del bot). Si el shard_count configurado no
        /// coincide, escala el conduit existente en vez de crear uno nuevo.
        /// </summary>
        private async Task<string?> EnsureConduitAsync(EventSubService eventSubService, int shardCount)
        {
            var existing = await eventSubService.GetConduitsAsync();

            if (existing.Success && !string.IsNullOrEmpty(existing.ResponseBody))
            {
                try
                {
                    var json = JsonDocument.Parse(existing.ResponseBody);
                    var data = json.RootElement.GetProperty("data");

                    if (data.GetArrayLength() > 0)
                    {
                        var conduitId = data[0].GetProperty("id").GetString();
                        var existingShardCount = data[0].GetProperty("shard_count").GetInt32();
                        _logger.LogInformation($"✅ Reusando conduit existente {conduitId} ({existingShardCount} shards)");

                        if (existingShardCount != shardCount)
                        {
                            _logger.LogWarning($"⚠️ El conduit existente tiene {existingShardCount} shards, configurado ShardCount={shardCount}. Escalando...");
                            var updated = await eventSubService.UpdateConduitAsync(conduitId!, shardCount);
                            if (!updated.Success)
                            {
                                _logger.LogError($"❌ No se pudo escalar el conduit a {shardCount} shards, se sigue usando {existingShardCount}");
                            }
                        }

                        return conduitId;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error parseando la lista de conduits existentes");
                }
            }

            _logger.LogInformation($"No hay conduit existente para este client_id. Creando uno con {shardCount} shard(s)...");
            var created = await eventSubService.CreateConduitAsync(shardCount);

            if (!created.Success || string.IsNullOrEmpty(created.ResponseBody))
            {
                _logger.LogError($"❌ No se pudo crear el conduit: {created.Message}");
                return null;
            }

            try
            {
                var json = JsonDocument.Parse(created.ResponseBody);
                var data = json.RootElement.GetProperty("data");
                return data[0].GetProperty("id").GetString();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error parseando la respuesta de creación de conduit");
                return null;
            }
        }

        private EventSubWebsocketClient CreateShardClient(string shardId)
        {
            var client = new EventSubWebsocketClient(_loggerFactory);

            client.WebsocketConnected += async (_, e) =>
            {
                _logger.LogInformation($"✅ [Conduit shard {shardId}] Conectado (reconexión solicitada: {e.IsRequestedReconnect}). SessionId: {client.SessionId}");
                await AssociateShardAsync(shardId, client.SessionId);
            };

            client.WebsocketReconnected += async (_, __) =>
            {
                _logger.LogWarning($"🔄 [Conduit shard {shardId}] Reconectado por Twitch. Nueva SessionId: {client.SessionId}");
                await AssociateShardAsync(shardId, client.SessionId);
            };

            client.WebsocketDisconnected += async (_, __) =>
            {
                _logger.LogWarning($"⚠️ [Conduit shard {shardId}] Desconectado. Intentando reconectar...");
                try
                {
                    var reconnected = await client.ReconnectAsync();
                    if (!reconnected)
                    {
                        _logger.LogError($"❌ [Conduit shard {shardId}] ReconnectAsync devolvió false — el shard queda sin sesión hasta el próximo reinicio del bot");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error reconectando el shard {shardId}");
                }
            };

            client.ErrorOccurred += (_, e) =>
            {
                _logger.LogError(e.Exception, $"❌ [Conduit shard {shardId}] {e.Message}");
                return Task.CompletedTask;
            };

            client.ChannelChatMessage += (_, e) =>
                DespacharEvento(shardId, "channel.chat.message", BuildChatMessageJObject(e.Payload.Event));
            client.ChannelFollow += (_, e) =>
                DespacharEvento(shardId, "channel.follow", BuildFollowJObject(e.Payload.Event));
            client.ChannelPointsCustomRewardRedemptionAdd += (_, e) =>
                DespacharEvento(shardId, "channel.channel_points_custom_reward_redemption.add", BuildRedemptionJObject(e.Payload.Event));
            client.ChannelCheer += (_, e) =>
                DespacharEvento(shardId, "channel.cheer", BuildCheerJObject(e.Payload.Event));
            client.ChannelSubscribe += (_, e) =>
                DespacharEvento(shardId, "channel.subscribe", BuildSubscribeJObject(e.Payload.Event));
            client.ChannelSubscriptionGift += (_, e) =>
                DespacharEvento(shardId, "channel.subscription.gift", BuildGiftSubJObject(e.Payload.Event));
            client.ChannelSubscriptionMessage += (_, e) =>
                DespacharEvento(shardId, "channel.subscription.message", BuildResubJObject(e.Payload.Event));
            client.ChannelRaid += (_, e) =>
                DespacharEvento(shardId, "channel.raid", BuildRaidJObject(e.Payload.Event));
            client.ChannelHypeTrainBeginV2 += (_, e) =>
                DespacharEvento(shardId, "channel.hype_train.begin", BuildHypeTrainJObject(e.Payload.Event));
            client.StreamOnline += (_, e) =>
                DespacharEvento(shardId, "stream.online", BuildStreamOnlineJObject(e.Payload.Event));
            client.StreamOffline += (_, e) =>
                DespacharEvento(shardId, "stream.offline", BuildStreamOfflineJObject(e.Payload.Event));

            return client;
        }

        private async Task AssociateShardAsync(string shardId, string? sessionId)
        {
            if (string.IsNullOrEmpty(_conduitId) || string.IsNullOrEmpty(sessionId))
            {
                _logger.LogError($"No se puede asociar el shard {shardId}: conduitId o sessionId vacío");
                return;
            }

            try
            {
                using var scope = _serviceProvider.CreateScope();
                var eventSubService = scope.ServiceProvider.GetRequiredService<EventSubService>();
                await eventSubService.UpdateConduitShardsAsync(_conduitId, shardId, sessionId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error asociando el shard {shardId} al conduit {_conduitId}");
            }
        }

        /// <summary>
        /// Resuelve EventSubNotificationHandler en un scope nuevo (patrón estándar de
        /// los BackgroundService de este proyecto) y le entrega el mismo par
        /// (tipo, JObject) que ya procesa el webhook — cero lógica de negocio duplicada.
        /// </summary>
        private async Task DespacharEvento(string shardId, string eventType, JObject datosEvento)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var handler = scope.ServiceProvider.GetRequiredService<EventSubNotificationHandler>();
                await handler.ManejarEvento(eventType, datosEvento);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error despachando evento {eventType} desde el shard {shardId}");
            }
        }

        // ============================================================================
        // Adaptadores: modelo tipado del SDK -> el mismo JObject que ya arma el
        // webhook a partir del JSON crudo de Twitch. El "event" de EventSub es
        // idéntico entre transportes; esto solo reconstruye ese sobre.
        // ============================================================================

        private static JObject BuildChatMessageJObject(ChannelChatMessage e)
        {
            var badges = new JArray();
            if (e.Badges != null)
            {
                foreach (var badge in e.Badges)
                {
                    badges.Add(new JObject
                    {
                        ["set_id"] = badge.SetId,
                        ["id"] = badge.Id
                    });
                }
            }

            var obj = new JObject
            {
                ["message_id"] = e.MessageId,
                ["broadcaster_user_id"] = e.BroadcasterUserId,
                ["broadcaster_user_login"] = e.BroadcasterUserLogin,
                ["broadcaster_user_name"] = e.BroadcasterUserName,
                ["chatter_user_id"] = e.ChatterUserId,
                ["chatter_user_login"] = e.ChatterUserLogin,
                ["chatter_user_name"] = e.ChatterUserName,
                ["message"] = new JObject { ["text"] = e.Message?.Text },
                ["source_broadcaster_user_id"] = e.SourceBroadcasterUserId,
                ["badges"] = badges,
                ["channel_points_custom_reward_id"] = e.ChannelPointsCustomRewardId
            };

            if (e.Cheer != null)
            {
                obj["cheer"] = new JObject { ["bits"] = e.Cheer.Bits };
            }

            return obj;
        }

        private static JObject BuildFollowJObject(ChannelFollow e) => new()
        {
            ["user_id"] = e.UserId,
            ["user_name"] = e.UserName,
            ["user_login"] = e.UserLogin,
            ["broadcaster_user_id"] = e.BroadcasterUserId,
            ["broadcaster_user_name"] = e.BroadcasterUserName,
            ["followed_at"] = e.FollowedAt.UtcDateTime.ToString("o")
        };

        private static JObject BuildRedemptionJObject(ChannelPointsCustomRewardRedemption e) => new()
        {
            ["reward"] = new JObject
            {
                ["id"] = e.Reward?.Id,
                ["title"] = e.Reward?.Title
            },
            ["broadcaster_user_id"] = e.BroadcasterUserId,
            ["broadcaster_user_login"] = e.BroadcasterUserLogin,
            ["user_id"] = e.UserId,
            ["user_login"] = e.UserLogin,
            ["redeemed_at"] = e.RedeemedAt.UtcDateTime.ToString("o"),
            ["user_input"] = e.UserInput
        };

        private static JObject BuildCheerJObject(ChannelCheer e) => new()
        {
            ["broadcaster_user_id"] = e.BroadcasterUserId,
            ["broadcaster_user_login"] = e.BroadcasterUserLogin,
            ["user_id"] = e.UserId,
            ["user_name"] = e.UserName,
            ["bits"] = e.Bits
        };

        private static JObject BuildSubscribeJObject(ChannelSubscribe e) => new()
        {
            ["broadcaster_user_login"] = e.BroadcasterUserLogin,
            ["user_name"] = e.UserName,
            ["tier"] = e.Tier,
            ["is_gift"] = e.IsGift
        };

        private static JObject BuildGiftSubJObject(ChannelSubscriptionGift e) => new()
        {
            ["broadcaster_user_login"] = e.BroadcasterUserLogin,
            ["user_name"] = e.UserName,
            ["total"] = e.Total
        };

        private static JObject BuildResubJObject(ChannelSubscriptionMessage e) => new()
        {
            ["broadcaster_user_login"] = e.BroadcasterUserLogin,
            ["user_name"] = e.UserName,
            ["tier"] = e.Tier,
            ["cumulative_months"] = e.CumulativeMonths,
            ["message"] = new JObject { ["text"] = e.Message?.Text }
        };

        private static JObject BuildRaidJObject(ChannelRaid e) => new()
        {
            ["to_broadcaster_user_login"] = e.ToBroadcasterUserLogin,
            ["from_broadcaster_user_name"] = e.FromBroadcasterUserName,
            ["viewers"] = e.Viewers
        };

        private static JObject BuildHypeTrainJObject(HypeTrainBeginV2 e) => new()
        {
            ["broadcaster_user_login"] = e.BroadcasterUserLogin,
            ["level"] = e.Level
        };

        private static JObject BuildStreamOnlineJObject(StreamOnline e) => new()
        {
            ["broadcaster_user_id"] = e.BroadcasterUserId,
            ["broadcaster_user_login"] = e.BroadcasterUserLogin
        };

        private static JObject BuildStreamOfflineJObject(StreamOffline e) => new()
        {
            ["broadcaster_user_id"] = e.BroadcasterUserId,
            ["broadcaster_user_login"] = e.BroadcasterUserLogin
        };
    }
}
