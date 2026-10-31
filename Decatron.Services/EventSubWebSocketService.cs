using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
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
        private CancellationToken _stoppingToken;

        // Vigilante de shards (incidente 2026-10-31: 20 de 30 shards en websocket_failed_ping_pong
        // sin que nadie lo supiera). Se despierta cada WatchdogMinutes o cuando Twitch avisa.
        private static readonly HttpClient AlertHttp = new() { Timeout = TimeSpan.FromSeconds(10) };
        private readonly SemaphoreSlim _watchdogWake = new(0, int.MaxValue);
        private readonly object _shardsLock = new();
        private readonly HashSet<EventSubWebsocketClient> _retired = new();
        private DateTime _lastFailureAlertUtc = DateTime.MinValue;
        private int _shardCount;

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
            _stoppingToken = stoppingToken;

            // Mismo warm-up que EventSubBackgroundService: deja terminar el arranque del host.
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

            var shardCount = _configuration.GetValue<int?>("EventSubSettings:ShardCount") ?? 1;
            _shardCount = shardCount;

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

            using (var scope = _serviceProvider.CreateScope())
            {
                var eventSubService = scope.ServiceProvider.GetRequiredService<EventSubService>();
                await eventSubService.EnsureConduitShardDisabledSubscriptionAsync(_conduitId);
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
                await RunWatchdogAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                // Apagado normal del host
            }

            List<EventSubWebsocketClient> toStop;
            lock (_shardsLock) toStop = _shards.ToList();
            foreach (var client in toStop)
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
                if (IsRetired(client)) return;
                _logger.LogInformation($"✅ [Conduit shard {shardId}] Conectado (reconexión solicitada: {e.IsRequestedReconnect}). SessionId: {client.SessionId}");
                await AssociateShardAsync(shardId, client.SessionId);
            };

            client.WebsocketReconnected += async (_, __) =>
            {
                if (IsRetired(client)) return;
                _logger.LogWarning($"🔄 [Conduit shard {shardId}] Reconectado por Twitch. Nueva SessionId: {client.SessionId}");
                await AssociateShardAsync(shardId, client.SessionId);
            };

            client.WebsocketDisconnected += async (_, __) =>
            {
                if (IsRetired(client)) return;
                _logger.LogWarning($"⚠️ [Conduit shard {shardId}] Desconectado. Intentando reconectar...");
                await ReconnectWithBackoffAsync(client, shardId);
            };

            client.ErrorOccurred += (_, e) =>
            {
                _logger.LogError(e.Exception, $"❌ [Conduit shard {shardId}] {e.Message}");
                return Task.CompletedTask;
            };

            // Notificación server-side de Twitch, independiente de si este cliente detectó
            // su propia desconexión. Da visibilidad real: sin esto no hay forma de saber
            // cuándo Twitch deshabilitó un shard salvo que el propio cliente lo note primero.
            client.ConduitShardDisabled += (_, e) =>
            {
                var payload = e.Payload.Event;
                _logger.LogError($"🚨 [Conduit] Twitch reportó el shard {payload.ShardId} como deshabilitado (status={payload.Status}). Se despierta al vigilante para reasociarlo.");
                _watchdogWake.Release();
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
            client.ChannelHypeTrainProgressV2 += (_, e) =>
                DespacharEvento(shardId, "channel.hype_train.progress", new JObject { ["broadcaster_user_login"] = e.Payload.Event.BroadcasterUserLogin, ["level"] = e.Payload.Event.Level });
            client.ChannelHypeTrainEndV2 += (_, e) =>
                DespacharEvento(shardId, "channel.hype_train.end", new JObject { ["broadcaster_user_login"] = e.Payload.Event.BroadcasterUserLogin, ["level"] = e.Payload.Event.Level });
            client.StreamOnline += (_, e) =>
                DespacharEvento(shardId, "stream.online", BuildStreamOnlineJObject(e.Payload.Event));
            client.StreamOffline += (_, e) =>
                DespacharEvento(shardId, "stream.offline", BuildStreamOfflineJObject(e.Payload.Event));
            // channel.update v2 (categoria/titulo) -> Game Overlays. Ojo: TwitchLib
            // solo entrega los tipos que se cablean aca; una suscripcion sin handler
            // se pierde en silencio (paso asi el 18-09-2026 al agregar este evento).
            client.ChannelUpdate += (_, e) =>
                DespacharEvento(shardId, "channel.update", BuildChannelUpdateJObject(e.Payload.Event));

            return client;
        }

        /// <summary>
        /// Reintenta la reconexión del shard indefinidamente con backoff (5s → 60s).
        /// Antes, si ReconnectAsync devolvía false una sola vez, el shard quedaba
        /// muerto hasta reiniciar el bot y todos los canales que caían en él
        /// dejaban de recibir eventos en silencio (incidente 2026-09-11).
        /// </summary>
        private async Task ReconnectWithBackoffAsync(EventSubWebsocketClient client, string shardId)
        {
            var delay = TimeSpan.FromSeconds(5);
            var maxDelay = TimeSpan.FromSeconds(60);

            for (var attempt = 1; !_stoppingToken.IsCancellationRequested; attempt++)
            {
                try
                {
                    if (await client.ReconnectAsync())
                        return;

                    _logger.LogError($"❌ [Conduit shard {shardId}] ReconnectAsync devolvió false (intento {attempt}). Reintento en {delay.TotalSeconds:0}s");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error reconectando el shard {shardId} (intento {attempt}). Reintento en {delay.TotalSeconds:0}s");
                }

                try
                {
                    await Task.Delay(delay, _stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    return;
                }

                delay = TimeSpan.FromSeconds(Math.Min(delay.TotalSeconds * 2, maxDelay.TotalSeconds));
            }
        }

        private bool IsRetired(EventSubWebsocketClient client)
        {
            lock (_shardsLock) return _retired.Contains(client);
        }

        /// <summary>
        /// Bucle del vigilante: cada WatchdogMinutes (5 por defecto) o apenas Twitch avisa de un
        /// shard deshabilitado, compara contra Twitch y reasocia lo que esté caído.
        /// </summary>
        private async Task RunWatchdogAsync(CancellationToken ct)
        {
            var minutes = Math.Max(1, _configuration.GetValue<int?>("EventSubSettings:WatchdogMinutes") ?? 5);
            var interval = TimeSpan.FromMinutes(minutes);

            // Deja que los shards terminen de conectarse y asociarse antes de la primera revisión.
            await Task.Delay(TimeSpan.FromSeconds(60), ct);

            while (!ct.IsCancellationRequested)
            {
                try
                {
                    await CheckAndRecoverAsync(ct);
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[Conduit] Error en el vigilante de shards");
                }

                var woken = await _watchdogWake.WaitAsync(interval, ct);
                if (woken)
                {
                    // Twitch suele avisar de muchos shards a la vez: junta los avisos y revisa una sola vez.
                    await Task.Delay(TimeSpan.FromSeconds(5), ct);
                    while (_watchdogWake.Wait(0)) { }
                }
            }
        }

        /// <summary>Shards que Twitch no reporta como "enabled" (o que ni aparecen). Null si la consulta falla.</summary>
        private async Task<List<string>?> GetUnhealthyShardsAsync()
        {
            if (string.IsNullOrEmpty(_conduitId)) return null;

            List<(string Id, string Status)>? shards;
            using (var scope = _serviceProvider.CreateScope())
            {
                var eventSubService = scope.ServiceProvider.GetRequiredService<EventSubService>();
                shards = await eventSubService.GetConduitShardsAsync(_conduitId);
            }
            if (shards == null) return null;

            var bad = new List<string>();
            for (var i = 0; i < _shardCount; i++)
            {
                var id = i.ToString();
                var found = shards.FirstOrDefault(s => s.Id == id);
                if (found.Id == null || found.Status != "enabled") bad.Add(id);
            }
            return bad;
        }

        private async Task CheckAndRecoverAsync(CancellationToken ct)
        {
            var pending = await GetUnhealthyShardsAsync();
            if (pending == null)
            {
                _logger.LogWarning("[Conduit] El vigilante no pudo consultar el estado de los shards en Twitch; se reintenta en el próximo ciclo.");
                return;
            }
            if (pending.Count == 0) return;

            var initial = pending.ToList();
            _logger.LogWarning($"🛟 [Conduit] {initial.Count} shard(s) no están enabled en Twitch ({string.Join(",", initial)}). Reasociando...");
            var started = DateTime.UtcNow;

            for (var attempt = 1; attempt <= 3 && pending.Count > 0 && !ct.IsCancellationRequested; attempt++)
            {
                foreach (var id in pending)
                    await RestartShardAsync(id);

                await Task.Delay(TimeSpan.FromSeconds(10), ct);

                var still = await GetUnhealthyShardsAsync();
                if (still == null) break;
                pending = pending.Where(still.Contains).ToList();
                if (pending.Count > 0)
                    _logger.LogWarning($"[Conduit] Tras el intento {attempt} siguen caídos: {string.Join(",", pending)}");
            }

            var seconds = (int)(DateTime.UtcNow - started).TotalSeconds;
            var recovered = initial.Where(i => !pending.Contains(i)).ToList();

            if (recovered.Count > 0)
                _logger.LogInformation($"✅ [Conduit] Shards recuperados: {string.Join(",", recovered)} ({seconds}s)");

            if (pending.Count == 0)
            {
                await SendAlertAsync($"✅ **Decatron EventSub**: se cayeron {initial.Count} shard(s) del conduit ({string.Join(", ", initial)}) y el bot los recuperó solo en {seconds}s. Los canales en esos shards no recibieron eventos durante ese lapso.");
            }
            else
            {
                _logger.LogError($"🚨 [Conduit] No se pudieron recuperar los shards: {string.Join(",", pending)}");
                if (DateTime.UtcNow - _lastFailureAlertUtc > TimeSpan.FromMinutes(30))
                {
                    _lastFailureAlertUtc = DateTime.UtcNow;
                    await SendAlertAsync($"🚨 **Decatron EventSub**: {pending.Count} shard(s) siguen caídos tras 3 intentos de recuperación ({string.Join(", ", pending)}). Los canales en esos shards no reciben chat ni eventos. Reiniciar con `sudo /root/web-services.sh restart decatron-b`.");
                }
            }
        }

        /// <summary>
        /// Reemplaza el cliente del shard por uno nuevo. El viejo se marca "retirado" para que sus
        /// eventos de desconexión no lancen una reconexión paralela ni reasocien una sesión muerta.
        /// </summary>
        private async Task RestartShardAsync(string shardId)
        {
            if (!int.TryParse(shardId, out var index)) return;

            EventSubWebsocketClient? old;
            var fresh = CreateShardClient(shardId);
            lock (_shardsLock)
            {
                old = index < _shards.Count ? _shards[index] : null;
                if (old != null) _retired.Add(old);
                if (index < _shards.Count) _shards[index] = fresh;
                else _shards.Add(fresh);
            }

            if (old != null)
            {
                try { await old.DisconnectAsync(); }
                catch (Exception ex) { _logger.LogDebug(ex, $"[Conduit shard {shardId}] Error cerrando el cliente anterior (ignorado)"); }
            }

            try
            {
                // WebsocketConnected asocia el shard con la sesión nueva.
                var ok = await fresh.ConnectAsync(EventSubWebSocketUrl);
                if (!ok) _logger.LogError($"❌ [Conduit shard {shardId}] ConnectAsync devolvió false al recuperar el shard");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error reconectando el shard {shardId} desde el vigilante");
            }
        }

        /// <summary>Aviso a Discord (DiscordSettings:AlertWebhookUrl, se lee en cada envío: recarga en caliente). Nunca lanza.</summary>
        private async Task SendAlertAsync(string message)
        {
            try
            {
                var url = _configuration["DiscordSettings:AlertWebhookUrl"];
                if (string.IsNullOrWhiteSpace(url))
                {
                    _logger.LogWarning("[Conduit] Sin DiscordSettings:AlertWebhookUrl: no se envía el aviso a Discord.");
                    return;
                }

                var body = Newtonsoft.Json.JsonConvert.SerializeObject(new { content = message });
                using var response = await AlertHttp.PostAsync(url, new StringContent(body, Encoding.UTF8, "application/json"));
                if (!response.IsSuccessStatusCode)
                    _logger.LogWarning($"[Conduit] Discord respondió {(int)response.StatusCode} al enviar el aviso.");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Conduit] No se pudo enviar el aviso a Discord");
            }
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

                // Un streamer con cuenta en el #1 y bot activado en el tenant de su proyecto lo atiende ese tenant: aquí no se procesa
                // (su suscripción en el conduit del #1 puede seguir viva) para no responder dos veces.
                var canal = datosEvento?["broadcaster_user_id"]?.ToString() ?? datosEvento?["to_broadcaster_user_id"]?.ToString();
                if (scope.ServiceProvider.GetService<Decatron.Core.Interfaces.ITenantResolver>()?.IsServedByOtherTenant(canal) == true)
                {
                    _logger.LogDebug("eventsub.skip_served_elsewhere type={Type} broadcaster={Broadcaster}", eventType, canal);
                    return;
                }

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

        internal static JObject BuildChatMessageJObject(ChannelChatMessage e)
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
                ["message"] = new JObject { ["text"] = e.Message?.Text, ["fragments"] = BuildFragments(e.Message) },
                ["source_broadcaster_user_id"] = e.SourceBroadcasterUserId,
                ["source_broadcaster_user_login"] = e.SourceBroadcasterUserLogin,
                ["source_broadcaster_user_name"] = e.SourceBroadcasterUserName,
                ["badges"] = badges,
                ["color"] = e.Color,
                ["message_type"] = e.MessageType,
                ["channel_points_custom_reward_id"] = e.ChannelPointsCustomRewardId
            };

            if (e.SourceBadges != null)
            {
                var sourceBadges = new JArray();
                foreach (var badge in e.SourceBadges)
                    sourceBadges.Add(new JObject { ["set_id"] = badge.SetId, ["id"] = badge.Id });
                obj["source_badges"] = sourceBadges;
            }

            if (e.Reply != null)
            {
                obj["reply"] = new JObject
                {
                    ["parent_user_name"] = e.Reply.ParentUserName,
                    ["parent_message_body"] = e.Reply.ParentMessageBody
                };
            }

            if (e.Cheer != null)
            {
                obj["cheer"] = new JObject { ["bits"] = e.Cheer.Bits };
            }

            return obj;
        }

        /// <summary>
        /// Los trozos del mensaje (texto, emotes de Twitch, cheermotes): el overlay de chat los dibuja y el
        /// filtro de emotes de la moderación los cuenta. Sin esto, por el conduit solo llegaba el texto plano.
        /// </summary>
        internal static JArray BuildFragments(TwitchLib.EventSub.Core.Models.Chat.ChatMessage? message)
        {
            var fragments = new JArray();
            if (message?.Fragments == null) return fragments;

            foreach (var f in message.Fragments)
            {
                var item = new JObject { ["type"] = f.Type, ["text"] = f.Text };
                if (f.Emote != null)
                    item["emote"] = new JObject { ["id"] = f.Emote.Id, ["format"] = new JArray(f.Emote.Format ?? Array.Empty<string>()) };
                if (f.Cheermote != null)
                    item["cheermote"] = new JObject { ["prefix"] = f.Cheermote.Prefix, ["bits"] = f.Cheermote.Bits, ["tier"] = f.Cheermote.Tier };
                fragments.Add(item);
            }
            return fragments;
        }

        internal static JObject BuildFollowJObject(ChannelFollow e) => new()
        {
            ["user_id"] = e.UserId,
            ["user_name"] = e.UserName,
            ["user_login"] = e.UserLogin,
            ["broadcaster_user_id"] = e.BroadcasterUserId,
            ["broadcaster_user_name"] = e.BroadcasterUserName,
            ["followed_at"] = e.FollowedAt.UtcDateTime.ToString("o")
        };

        internal static JObject BuildRedemptionJObject(ChannelPointsCustomRewardRedemption e) => new()
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

        internal static JObject BuildCheerJObject(ChannelCheer e) => new()
        {
            ["broadcaster_user_id"] = e.BroadcasterUserId,
            ["broadcaster_user_login"] = e.BroadcasterUserLogin,
            ["user_id"] = e.UserId,
            ["user_name"] = e.UserName,
            ["bits"] = e.Bits
        };

        internal static JObject BuildSubscribeJObject(ChannelSubscribe e) => new()
        {
            ["broadcaster_user_id"] = e.BroadcasterUserId,
            ["broadcaster_user_login"] = e.BroadcasterUserLogin,
            ["user_name"] = e.UserName,
            ["tier"] = e.Tier,
            ["is_gift"] = e.IsGift
        };

        internal static JObject BuildGiftSubJObject(ChannelSubscriptionGift e) => new()
        {
            ["broadcaster_user_id"] = e.BroadcasterUserId,
            ["broadcaster_user_login"] = e.BroadcasterUserLogin,
            ["user_name"] = e.UserName,
            ["total"] = e.Total
        };

        internal static JObject BuildResubJObject(ChannelSubscriptionMessage e) => new()
        {
            ["broadcaster_user_id"] = e.BroadcasterUserId,
            ["broadcaster_user_login"] = e.BroadcasterUserLogin,
            ["user_name"] = e.UserName,
            ["tier"] = e.Tier,
            ["cumulative_months"] = e.CumulativeMonths,
            ["message"] = new JObject { ["text"] = e.Message?.Text }
        };

        internal static JObject BuildRaidJObject(ChannelRaid e) => new()
        {
            ["to_broadcaster_user_id"] = e.ToBroadcasterUserId,
            ["to_broadcaster_user_login"] = e.ToBroadcasterUserLogin,
            ["from_broadcaster_user_name"] = e.FromBroadcasterUserName,
            ["from_broadcaster_user_login"] = e.FromBroadcasterUserLogin,
            ["viewers"] = e.Viewers
        };

        internal static JObject BuildHypeTrainJObject(HypeTrainBeginV2 e) => new()
        {
            ["broadcaster_user_id"] = e.BroadcasterUserId,
            ["broadcaster_user_login"] = e.BroadcasterUserLogin,
            ["level"] = e.Level
        };

        internal static JObject BuildStreamOnlineJObject(StreamOnline e) => new()
        {
            ["broadcaster_user_id"] = e.BroadcasterUserId,
            ["broadcaster_user_login"] = e.BroadcasterUserLogin
        };

        internal static JObject BuildChannelUpdateJObject(ChannelUpdate e) => new()
        {
            ["broadcaster_user_id"] = e.BroadcasterUserId,
            ["broadcaster_user_login"] = e.BroadcasterUserLogin,
            ["title"] = e.Title,
            ["category_id"] = e.CategoryId,
            ["category_name"] = e.CategoryName
        };

        internal static JObject BuildStreamOfflineJObject(StreamOffline e) => new()
        {
            ["broadcaster_user_id"] = e.BroadcasterUserId,
            ["broadcaster_user_login"] = e.BroadcasterUserLogin
        };
    }
}
