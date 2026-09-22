using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Decatron.Core.Interfaces;
using Decatron.Data;
using Decatron.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;
using Npgsql;

namespace Decatron.Services
{
    /// <summary>
    /// Despacha los eventos de negocio de EventSub (chat, follows, canjes, cheers,
    /// subs, raids, hype train, stream online/offline) a los servicios reales.
    ///
    /// Extraído de TwitchWebhookController tal cual, sin cambiar comportamiento —
    /// el controller solo desempaqueta el sobre HTTP y llama a ManejarEvento. Vive
    /// en Decatron.Services porque el futuro EventSubWebSocketService (transporte
    /// WebSocket/Conduit) necesita el mismo dispatcher sin depender de un
    /// controller ni de HttpContext.
    /// </summary>
    public class EventSubNotificationHandler
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<EventSubNotificationHandler> _logger;
        private readonly TwitchBotService _twitchBotService;
        private readonly IHubContext<OverlayHub> _hubContext;
        private readonly DecatronDbContext _dbContext;
        private readonly Decatron.Core.Services.FollowersService _followersService;
        private readonly TimerEventService _timerEventService;
        private readonly IEventAlertsService _eventAlertsService;
        private readonly Decatron.Services.Pets.PetEventBridge _petEventBridge;
        private readonly IStreamStatusService _streamStatusService;
        private readonly ILiveAlertHandler _liveAlertHandler;
        private readonly ISpeakChatService _speakChatService;
        private readonly GiveawayService _giveawayService;
        private readonly IGachaService _gachaService;
        private readonly IServiceScopeFactory _serviceScopeFactory;

        // Cache para evitar procesar el mismo mensaje de chat dos veces
        private static readonly ConcurrentDictionary<string, DateTime> _processedMessages = new ConcurrentDictionary<string, DateTime>();

        public EventSubNotificationHandler(
            IConfiguration configuration,
            ILogger<EventSubNotificationHandler> logger,
            TwitchBotService twitchBotService,
            IHubContext<OverlayHub> hubContext,
            DecatronDbContext dbContext,
            Decatron.Core.Services.FollowersService followersService,
            TimerEventService timerEventService,
            IEventAlertsService eventAlertsService,
            IStreamStatusService streamStatusService,
            ILiveAlertHandler liveAlertHandler,
            ISpeakChatService speakChatService,
            GiveawayService giveawayService,
            IGachaService gachaService,
            IServiceScopeFactory serviceScopeFactory,
            Decatron.Services.Pets.PetEventBridge petEventBridge)
        {
            _configuration = configuration;
            _logger = logger;
            _twitchBotService = twitchBotService;
            _hubContext = hubContext;
            _dbContext = dbContext;
            _followersService = followersService;
            _timerEventService = timerEventService;
            _eventAlertsService = eventAlertsService;
            _petEventBridge = petEventBridge;
            _streamStatusService = streamStatusService;
            _liveAlertHandler = liveAlertHandler;
            _speakChatService = speakChatService;
            _giveawayService = giveawayService;
            _gachaService = gachaService;
            _serviceScopeFactory = serviceScopeFactory;

            CleanupOldMessages();
        }

        private void CleanupOldMessages()
        {
            var currentTime = DateTime.UtcNow;
            foreach (var msg in _processedMessages)
            {
                if (currentTime - msg.Value > TimeSpan.FromMinutes(5))
                {
                    _processedMessages.TryRemove(msg.Key, out _);
                }
            }
        }

        private void LogToFile(string message)
        {
            _logger.LogInformation("[EventSub] {Message}", message);
        }

        /// <summary>
        /// Punto de entrada único, sea el evento entregado por webhook o por
        /// WebSocket/Conduit. El "event" de EventSub es idéntico entre transportes;
        /// lo único que cambia es cómo llega el sobre exterior, y eso ya se resolvió
        /// antes de llamar a este método.
        /// </summary>
        public async Task ManejarEvento(string tipoEvento, JObject datosEvento)
        {
            var broadcasterId = datosEvento?["broadcaster_user_id"]?.ToString() ?? "?";
            _logger.LogWarning($"📨 [EVENTSUB] Evento recibido: {tipoEvento} | broadcaster: {broadcasterId}");

            if (tipoEvento == "channel.follow")
            {
                await ManejarEventoSeguidor(datosEvento);
            }
            else if (tipoEvento == "channel.chat.message")
            {
                await ManejarEventoChat(datosEvento);
            }
            else if (tipoEvento == "channel.channel_points_custom_reward_redemption.add")
            {
                await ManejarEventoCanje(datosEvento);
            }
            else if (tipoEvento == "channel.cheer")
            {
                await ManejarEventoCheer(datosEvento);
            }
            else if (tipoEvento == "channel.subscribe")
            {
                await ManejarEventoSubscribe(datosEvento);
            }
            else if (tipoEvento == "channel.subscription.gift")
            {
                await ManejarEventoGiftSub(datosEvento);
            }
            else if (tipoEvento == "channel.subscription.message")
            {
                await ManejarEventoResub(datosEvento);
            }
            else if (tipoEvento == "channel.raid")
            {
                await ManejarEventoRaid(datosEvento);
            }
            else if (tipoEvento == "channel.hype_train.begin")
            {
                await ManejarEventoHypeTrain(datosEvento);
            }
            else if (tipoEvento == "stream.online")
            {
                await ManejarStreamOnline(datosEvento);
            }
            else if (tipoEvento == "stream.offline")
            {
                await ManejarStreamOffline(datosEvento);
            }
            else if (tipoEvento == "channel.update")
            {
                await ManejarChannelUpdate(datosEvento);
            }
            else
            {
                _logger.LogWarning($"⚠️ Evento no manejado: {tipoEvento}");
            }
        }

        /// <summary>
        /// channel.update v2: cambio de categoria/titulo. Alimenta la deteccion de
        /// juego de Game Overlays (GameDetectionService). El overlay reacciona por
        /// SignalR cuando el poller recalcula el estado.
        /// </summary>
        private async Task ManejarChannelUpdate(JObject datosEvento)
        {
            try
            {
                var broadcasterUserId = datosEvento["broadcaster_user_id"]?.ToString();
                if (string.IsNullOrEmpty(broadcasterUserId)) return;

                var categoryId = datosEvento["category_id"]?.ToString();
                var categoryName = datosEvento["category_name"]?.ToString();

                using var scope = _serviceScopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<Decatron.Data.DecatronDbContext>();
                var userId = await db.Users.Where(u => u.TwitchId == broadcasterUserId).Select(u => (long?)u.Id).FirstOrDefaultAsync();
                if (userId == null) return;

                var detection = scope.ServiceProvider.GetRequiredService<Decatron.Services.GameData.GameDetectionService>();
                await detection.SetCategoryAsync(userId.Value, "twitch", categoryId, categoryName);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error procesando channel.update");
            }
        }

        private async Task ManejarStreamOnline(JObject datosEvento)
        {
            try
            {
                var broadcasterUserId   = datosEvento["broadcaster_user_id"]?.ToString();
                var broadcasterUserLogin = datosEvento["broadcaster_user_login"]?.ToString();

                if (string.IsNullOrEmpty(broadcasterUserId) || string.IsNullOrEmpty(broadcasterUserLogin))
                {
                    _logger.LogWarning("⚠️ stream.online con datos incompletos");
                    return;
                }

                _logger.LogInformation("🟢 [stream.online] {Login} inició stream", broadcasterUserLogin);
                await _streamStatusService.SetStreamOnlineAsync(broadcasterUserId, broadcasterUserLogin.ToLower());

                // Rueda de la Suerte: "giros por stream" solo significa algo si se
                // reinicia en algún momento verificable, y este es ese momento.
                try
                {
                    using var ruedaScope = _serviceScopeFactory.CreateScope();
                    var db2 = ruedaScope.ServiceProvider.GetRequiredService<Decatron.Data.DecatronDbContext>();
                    var wallets = ruedaScope.ServiceProvider.GetRequiredService<WheelWalletService>();

                    var ruedaChannelId = await db2.Users
                        .Where(u => u.TwitchId == broadcasterUserId)
                        .Select(u => (long?)u.Id)
                        .FirstOrDefaultAsync();

                    if (ruedaChannelId != null)
                        await wallets.ResetStreamCountersAsync(ruedaChannelId.Value);
                }
                catch (Exception ruedaEx)
                {
                    _logger.LogError(ruedaEx, "🎡 [Rueda] Error reiniciando contadores por stream de {Login}", broadcasterUserLogin);
                }

                // Discord live alerts (reads from discord_live_alerts table)
                _ = _liveAlertHandler.SendLiveAlertAsync(broadcasterUserLogin.ToLower(), broadcasterUserId);

                // Fortnite Spirits: si el streamer tiene el aviso de Twitch prendido
                // y hay sprites nuevos desde la ultima vez, se los anuncia en su chat.
                var localUserId = await _dbContext.Users
                    .Where(u => u.TwitchId == broadcasterUserId)
                    .Select(u => (long?)u.Id)
                    .FirstOrDefaultAsync();
                // Scope propio, no el de este handler: es fire-and-forget y el
                // scope de la request/evento se libera (junto con su DbContext)
                // antes de que esto termine si se comparte.
                if (localUserId != null)
                {
                    var login = broadcasterUserLogin.ToLower();
                    var uid = localUserId.Value;
                    _ = Task.Run(async () =>
                    {
                        using var scope = _serviceScopeFactory.CreateScope();
                        var delivery = scope.ServiceProvider.GetRequiredService<ISpiritNotificationDeliveryService>();
                        await delivery.NotifyStreamOnlineAsync(uid, login);
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error procesando stream.online");
            }
        }

        private async Task ManejarStreamOffline(JObject datosEvento)
        {
            try
            {
                var broadcasterUserId    = datosEvento["broadcaster_user_id"]?.ToString();
                var broadcasterUserLogin = datosEvento["broadcaster_user_login"]?.ToString();

                if (string.IsNullOrEmpty(broadcasterUserId) || string.IsNullOrEmpty(broadcasterUserLogin))
                {
                    _logger.LogWarning("⚠️ stream.offline con datos incompletos");
                    return;
                }

                _logger.LogInformation("🔴 [stream.offline] {Login} terminó stream", broadcasterUserLogin);
                await _streamStatusService.SetStreamOfflineAsync(broadcasterUserId, broadcasterUserLogin.ToLower());

                // Rueda de la Suerte: caducidad `stream_end`. El histórico
                // (lifetime_credits) no se toca, solo el saldo gastable.
                try
                {
                    using var ruedaScope = _serviceScopeFactory.CreateScope();
                    var db2 = ruedaScope.ServiceProvider.GetRequiredService<Decatron.Data.DecatronDbContext>();
                    var wallets = ruedaScope.ServiceProvider.GetRequiredService<WheelWalletService>();
                    var raffles = ruedaScope.ServiceProvider.GetRequiredService<WheelRaffleService>();

                    var ruedaChannelId = await db2.Users
                        .Where(u => u.TwitchId == broadcasterUserId)
                        .Select(u => (long?)u.Id)
                        .FirstOrDefaultAsync();

                    if (ruedaChannelId != null)
                    {
                        await wallets.ExpireOnStreamEndAsync(ruedaChannelId.Value);

                        // Modo Sorteo: los pools que pidieron `clear_on_stream_end`.
                        // Es el único momento en que "fin de stream" es verificable.
                        await raffles.LimpiarPorFinDeStreamAsync(ruedaChannelId.Value);
                    }
                }
                catch (Exception ruedaEx)
                {
                    _logger.LogError(ruedaEx, "🎡 [Rueda] Error caducando créditos al cerrar stream de {Login}", broadcasterUserLogin);
                }

                // Gachapón: tiros bonus con vencimiento `stream_end`.
                try
                {
                    using var gachaScope = _serviceScopeFactory.CreateScope();
                    var gacha = gachaScope.ServiceProvider.GetRequiredService<IGachaService>();
                    await gacha.ExpireBonusPullsOnStreamEndAsync(broadcasterUserLogin.ToLower());
                }
                catch (Exception gachaEx)
                {
                    _logger.LogError(gachaEx, "[GACHA] Error venciendo tiros bonus al cerrar stream de {Login}", broadcasterUserLogin);
                }

                // Discord offline handler (edit/delete/summary)
                _ = _liveAlertHandler.HandleStreamOfflineAsync(broadcasterUserLogin.ToLower());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error procesando stream.offline");
            }
        }

        private async Task ManejarEventoChat(JObject datosEvento)
        {
            try
            {
                // Extraer datos del evento
                var messageId = datosEvento["message_id"]?.ToString();
                var broadcasterUserId = datosEvento["broadcaster_user_id"]?.ToString();
                var broadcasterUserLogin = datosEvento["broadcaster_user_login"]?.ToString();
                var broadcasterUserName = !string.IsNullOrEmpty(broadcasterUserLogin) ? broadcasterUserLogin : datosEvento["broadcaster_user_name"]?.ToString();
                var chatterUserId = datosEvento["chatter_user_id"]?.ToString();
                var chatterUserName = datosEvento["chatter_user_login"]?.ToString() ?? datosEvento["chatter_user_name"]?.ToString();
                var messageText = datosEvento["message"]?["text"]?.ToString();

                // FIX SHARED CHAT: source_broadcaster_user_id indica el canal REAL donde
                // se escribió el mensaje (en shared chat)
                var sourceBroadcasterUserId = datosEvento["source_broadcaster_user_id"]?.ToString();

                // El roomId debe ser el source (si existe) o broadcaster (si no hay source)
                var roomId = !string.IsNullOrEmpty(sourceBroadcasterUserId)
                    ? sourceBroadcasterUserId
                    : broadcasterUserId;

                if (!string.IsNullOrEmpty(sourceBroadcasterUserId))
                {
                    _logger.LogDebug($"🔀 [SHARED CHAT] Mensaje de canal compartido: broadcaster={broadcasterUserName}, source={sourceBroadcasterUserId}");
                }

                // Validar datos mínimos
                if (string.IsNullOrEmpty(messageId) || string.IsNullOrEmpty(messageText) ||
                    string.IsNullOrEmpty(broadcasterUserName) || string.IsNullOrEmpty(chatterUserName))
                {
                    return;
                }

                // FILTRO CRÍTICO: Ignorar mensajes del propio bot para evitar loops
                var botUsername = _configuration["TwitchSettings:BotUsername"];
                if (!string.IsNullOrEmpty(botUsername) &&
                    chatterUserName.Equals(botUsername, StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }

                // Evitar procesar duplicados (mismo messageId, sea cual sea el transporte)
                if (_processedMessages.ContainsKey(messageId))
                {
                    return;
                }
                _processedMessages[messageId] = DateTime.UtcNow;

                // Extraer badges para determinar roles
                var badges = datosEvento["badges"] as JArray;
                bool isModerator = false;
                bool isLeadModerator = false;
                bool isVip = false;
                bool isSubscriber = false;
                bool isBroadcaster = chatterUserId == broadcasterUserId;

                var metadata = new Dictionary<string, object>();
                string badgeInfoStr = "";
                var allBadgesLog = new List<string>();

                if (badges != null)
                {
                    foreach (var badge in badges)
                    {
                        var badgeId = badge["set_id"]?.ToString();
                        var badgeVersion = badge["id"]?.ToString(); // Para subscriber, esto es el número de meses

                        if (!string.IsNullOrEmpty(badgeId))
                        {
                            allBadgesLog.Add($"{badgeId}/{badgeVersion}");
                        }

                        // Lead Moderator es un nivel propio, distinto de moderator normal (introducido por Twitch en dic 2025)
                        if (badgeId == "lead_moderator")
                        {
                            isLeadModerator = true;
                        }
                        else if (badgeId == "moderator" || badgeId == "staff" || badgeId == "admin" || badgeId == "global_mod" ||
                            badgeId.Contains("moderator"))
                        {
                            isModerator = true;
                        }

                        if (badgeId == "vip") isVip = true;
                        if (badgeId == "subscriber" || badgeId == "founder")
                        {
                            isSubscriber = true;
                            if (!string.IsNullOrEmpty(badgeVersion))
                            {
                                if (!string.IsNullOrEmpty(badgeInfoStr))
                                    badgeInfoStr += ",";
                                badgeInfoStr += $"subscriber/{badgeVersion}";
                            }
                        }
                        if (badgeId == "broadcaster") isBroadcaster = true;
                    }

                    if (allBadgesLog.Any())
                    {
                         _logger.LogInformation($"🏷️ [BADGES DETECTADOS] {chatterUserName}: {string.Join(", ", allBadgesLog)} | EsMod={isModerator} | EsLeadMod={isLeadModerator}");
                    }

                    if (!string.IsNullOrEmpty(badgeInfoStr))
                    {
                        metadata["badge-info"] = badgeInfoStr;
                        _logger.LogDebug($"🎯 [BADGE-INFO] {chatterUserName}: {badgeInfoStr}");
                    }
                }

                // Emotes de Twitch del mensaje (los de 7TV/BTTV/FFZ llegan como texto): para el filtro de emotes
                if (datosEvento["message"]?["fragments"] is JArray fragments)
                {
                    var emoteCount = fragments.Count(f => f?["type"]?.ToString() is "emote" or "cheermote");
                    if (emoteCount > 0)
                    {
                        metadata["emote-count"] = emoteCount;
                        // Sin los emotes, "KEKW LUL" no cuenta como gritar en mayúsculas
                        metadata["text-without-emotes"] = string.Concat(fragments
                            .Where(f => f?["type"]?.ToString() is not ("emote" or "cheermote"))
                            .Select(f => f?["text"]?.ToString() ?? ""));
                    }
                }

                // Canje de puntos de canal con texto obligatorio: el mensaje llega por
                // chat con el id de la recompensa. Lo pasamos para las reglas de Speak Chat.
                var chatRewardId = datosEvento["channel_points_custom_reward_id"]?.ToString();
                if (!string.IsNullOrEmpty(chatRewardId))
                {
                    metadata["channel_points_reward_id"] = chatRewardId;
                    _logger.LogInformation($"⭐ [CHANNEL POINTS] {chatterUserName} canjeó reward {chatRewardId} con mensaje");
                }

                // Bits enviados junto al mensaje (cheer).
                // Twitch manda "cheer": null en los mensajes normales, y eso llega como
                // JValue nulo: indexarlo con ["bits"] lanza excepción. Hay que castear.
                var cheerBits = (datosEvento["cheer"] as JObject)?["bits"]?.ToString();
                if (!string.IsNullOrEmpty(cheerBits) && int.TryParse(cheerBits, out var bitsFromChat) && bitsFromChat > 0)
                {
                    metadata["bits"] = bitsFromChat;
                    _logger.LogInformation($"💎 [BITS] {chatterUserName} envió {bitsFromChat} bits con el mensaje");
                }

                // Procesar el mensaje usando el mismo flujo que IRC
                await _twitchBotService.ProcessMessageFromEventSubAsync(
                    messageId: messageId,
                    channel: broadcasterUserName.ToLower(),
                    username: chatterUserName,
                    userId: chatterUserId,
                    roomId: roomId,
                    message: messageText,
                    isModerator: isModerator,
                    isLeadModerator: isLeadModerator,
                    isVip: isVip,
                    isSubscriber: isSubscriber,
                    isBroadcaster: isBroadcaster,
                    metadata: metadata
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error procesando evento de chat desde EventSub");
            }
        }

        private async Task ManejarEventoCanje(JObject datosEvento)
        {
            try
            {
                var rewardId = datosEvento["reward"]?["id"]?.ToString();
                var rewardTitle = datosEvento["reward"]?["title"]?.ToString();
                var broadcasterUserId = datosEvento["broadcaster_user_id"]?.ToString();
                var broadcasterUserName = datosEvento["broadcaster_user_login"]?.ToString();
                var redeemerUserId = datosEvento["user_id"]?.ToString();
                var redeemerUserName = datosEvento["user_login"]?.ToString();
                var redeemedAt = datosEvento["redeemed_at"]?.ToString();

                if (string.IsNullOrEmpty(rewardId) || string.IsNullOrEmpty(broadcasterUserName) ||
                    string.IsNullOrEmpty(redeemerUserName))
                {
                    _logger.LogWarning("Evento de canje con datos incompletos");
                    return;
                }

                LogToFile($"EVENTO CANJE: {redeemerUserName} canjeó '{rewardTitle}' en el canal {broadcasterUserName}");
                _logger.LogInformation($"Channel Points Redemption - Reward: {rewardTitle}, Redeemer: {redeemerUserName}, Channel: {broadcasterUserName}");

                // Rueda de la Suerte: solo cuenta si es LA recompensa que el streamer
                // eligió en la config de la rueda; el servicio filtra por rewardId.
                await AcreditarEnRuedaAsync(broadcasterUserName, redeemerUserName,
                    Decatron.Core.Models.WheelOfLuck.WheelSources.ChannelPoints, 1, rewardId);

                // Speak Chat TTS por canje (recompensas con texto que no pasan por el chat).
                // Si el canje ya se procesó por el mensaje de chat, el servicio lo deduplica.
                try
                {
                    var userInput = datosEvento["user_input"]?.ToString();
                    await _speakChatService.ProcessChannelPointRedemptionAsync(
                        channelName: broadcasterUserName.ToLower(),
                        username: redeemerUserName,
                        userId: redeemerUserId ?? "",
                        rewardId: rewardId,
                        userInput: userInput,
                        isBroadcaster: !string.IsNullOrEmpty(redeemerUserId) && redeemerUserId == broadcasterUserId);
                }
                catch (Exception speakEx)
                {
                    _logger.LogError(speakEx, "❌ [SpeakChat] Error procesando canje en [{Channel}]", broadcasterUserName);
                }

                // Buscar archivo de sound alert asociado a esta recompensa —
                // desde la unificacion con la galeria compartida (8 ago 2026),
                // vive en sound_alert_reward_files (el mapeo) + timer_media_files
                // (el archivo en si, si no es de sistema). Se resuelve por
                // twitch_id, no por username: mismo criterio de evitar
                // colisiones de nombre que ya se aplico en Kick.
                var connectionString = _configuration.GetConnectionString("DefaultConnection");
                using var conn = new NpgsqlConnection(connectionString);
                await conn.OpenAsync();

                const string fileQuery = @"
                    SELECT sarf.id, tmf.file_type, tmf.file_path, sarf.system_file_path,
                           sarf.volume, sarf.enabled, sarf.image_path, sarf.image_name,
                           sarf.show_image, sarf.image_url, sarf.image_source,
                           sarf.media_file_id, sarf.user_id
                    FROM sound_alert_reward_files sarf
                    JOIN users u ON u.id = sarf.user_id
                    LEFT JOIN timer_media_files tmf ON tmf.id = sarf.media_file_id
                    WHERE u.twitch_id = @broadcasterId AND sarf.reward_id = @rewardId
                    LIMIT 1";

                using var fileCmd = new NpgsqlCommand(fileQuery, conn);
                fileCmd.Parameters.AddWithValue("@broadcasterId", broadcasterUserId);
                fileCmd.Parameters.AddWithValue("@rewardId", rewardId);

                using var reader = await fileCmd.ExecuteReaderAsync();

                if (!await reader.ReadAsync())
                {
                    _logger.LogInformation($"No hay archivo de sound alert configurado para reward {rewardId} en canal {broadcasterUserName}");
                    await reader.CloseAsync();

                    await RegistrarHistorialCanje(conn, broadcasterUserName, rewardId, rewardTitle ?? "",
                        null, redeemerUserName, redeemerUserId, redeemedAt, false, "No hay archivo configurado", broadcasterUserId);
                    return;
                }

                var mappingId = reader.GetInt64(0);
                var mediaFileType = reader.IsDBNull(1) ? null : reader.GetString(1);
                var mediaFilePath = reader.IsDBNull(2) ? null : reader.GetString(2);
                var systemFilePath = reader.IsDBNull(3) ? null : reader.GetString(3);
                var volume = reader.IsDBNull(4) ? (int?)null : reader.GetInt32(4);
                var enabled = reader.GetBoolean(5);
                var imagePath = reader.IsDBNull(6) ? (string?)null : reader.GetString(6);
                var imageName = reader.IsDBNull(7) ? (string?)null : reader.GetString(7);
                var showImage = reader.GetBoolean(8);
                var imageUrlDb = reader.IsDBNull(9) ? (string?)null : reader.GetString(9);
                var imageSource = reader.GetString(10);
                var mediaFileId = reader.IsDBNull(11) ? (int?)null : reader.GetInt32(11);
                var channelUserId = reader.GetInt64(12);

                await reader.CloseAsync();

                var filePath = mediaFilePath ?? systemFilePath ?? "";
                var fileType = mediaFileType ?? InferSystemFileType(systemFilePath ?? "");

                _logger.LogInformation($"🎵 [DEBUG] Mapping - Id: {mappingId}, Type: {fileType}, FilePath: {filePath}, EsSistema: {mediaFileId == null}");

                if (!enabled)
                {
                    _logger.LogInformation($"Sound alert deshabilitado para reward {rewardId}");
                    await RegistrarHistorialCanje(conn, broadcasterUserName, rewardId, rewardTitle ?? "",
                        filePath, redeemerUserName, redeemerUserId, redeemedAt, false, "Alerta deshabilitada", broadcasterUserId);
                    return;
                }

                // Obtener configuración global del canal
                const string configQuery = @"
                    SELECT global_volume, global_enabled, duration, text_lines, styles, layout,
                           animation_type, animation_speed, text_outline_enabled, text_outline_color,
                           text_outline_width
                    FROM sound_alert_configs
                    WHERE user_id = @userId
                    LIMIT 1";

                using var configCmd = new NpgsqlCommand(configQuery, conn);
                configCmd.Parameters.AddWithValue("@userId", channelUserId);

                using var configReader = await configCmd.ExecuteReaderAsync();

                int globalVolume = 70;
                bool globalEnabled = true;
                int duration = 10;
                string textLines = "[]";
                string styles = "{}";
                string layout = "{}";
                string animationType = "fade";
                string animationSpeed = "normal";
                bool textOutlineEnabled = false;
                string textOutlineColor = "#000000";
                int textOutlineWidth = 2;

                if (await configReader.ReadAsync())
                {
                    globalVolume = configReader.GetInt32(0);
                    globalEnabled = configReader.GetBoolean(1);
                    duration = configReader.GetInt32(2);
                    textLines = configReader.GetString(3);
                    styles = configReader.GetString(4);
                    layout = configReader.GetString(5);
                    animationType = configReader.GetString(6);
                    animationSpeed = configReader.GetString(7);
                    textOutlineEnabled = configReader.GetBoolean(8);
                    textOutlineColor = configReader.GetString(9);
                    textOutlineWidth = configReader.GetInt32(10);
                }

                await configReader.CloseAsync();

                if (!globalEnabled)
                {
                    _logger.LogInformation($"Sound alerts deshabilitados globalmente para {broadcasterUserName}");
                    await RegistrarHistorialCanje(conn, broadcasterUserName, rewardId, rewardTitle ?? "",
                        filePath, redeemerUserName, redeemerUserId, redeemedAt, false, "Sistema deshabilitado", broadcasterUserId);
                    return;
                }

                // Incrementar contador de reproducciones — solo si es un
                // archivo de la galeria compartida (los de sistema no son
                // filas de BD, no tienen contador que incrementar).
                if (mediaFileId != null)
                {
                    const string updatePlayCountQuery = @"
                        UPDATE timer_media_files
                        SET usage_count = usage_count + 1, updated_at = NOW()
                        WHERE id = @id";

                    using var updateCmd = new NpgsqlCommand(updatePlayCountQuery, conn);
                    updateCmd.Parameters.AddWithValue("@id", mediaFileId.Value);
                    await updateCmd.ExecuteNonQueryAsync();
                }

                // Construir URLs — ToPublicPath funciona igual para ambos casos,
                // FilePath ya viene relativo a ClientApp/public/ en los dos.
                var fileUrl = ToPublicPath(filePath);
                string? imageUrl = null;

                if (showImage)
                {
                    if (imageSource == "url" && !string.IsNullOrEmpty(imageUrlDb))
                    {
                        imageUrl = imageUrlDb;
                    }
                    else if (!string.IsNullOrEmpty(imagePath))
                    {
                        imageUrl = ToPublicPath(imagePath);
                    }
                }

                _logger.LogInformation($"🎵 [DEBUG] URL Final - FileUrl: {fileUrl}, FileType: {fileType}, EsSistema: {mediaFileId == null}");

                // Enviar alerta a través de SignalR
                var alertData = new
                {
                    type = "soundalert",
                    redeemer = redeemerUserName,
                    reward = rewardTitle ?? "",
                    fileUrl = fileUrl,
                    fileType = fileType,
                    imageUrl = imageUrl,
                    volume = volume ?? globalVolume,
                    duration = duration,
                    textLines = textLines,
                    styles = styles,
                    layout = layout,
                    animation = new
                    {
                        type = animationType,
                        speed = animationSpeed
                    },
                    textOutline = new
                    {
                        enabled = textOutlineEnabled,
                        color = textOutlineColor,
                        width = textOutlineWidth
                    }
                };

                await _hubContext.Clients.Group($"overlay_{broadcasterUserName.ToLower()}")
                    .SendAsync("ShowSoundAlert", alertData);

                _logger.LogInformation($"✅ Sound alert enviado por SignalR para {broadcasterUserName} - Reward: {rewardTitle}");
                LogToFile($"ALERTA ENVIADA: {redeemerUserName} → {rewardTitle} → {Path.GetFileName(filePath)}");

                await RegistrarHistorialCanje(conn, broadcasterUserName, rewardId, rewardTitle ?? "",
                    filePath, redeemerUserName, redeemerUserId, redeemedAt, true, null, broadcasterUserId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error procesando evento de canje de Channel Points");
                LogToFile($"ERROR EN EVENTO CANJE: {ex.Message}");
            }
        }

        private async Task RegistrarHistorialCanje(NpgsqlConnection conn, string channelName, string rewardId,
            string rewardTitle, string? filePath, string redeemedBy, string? redeemedById,
            string? redeemedAt, bool playedSuccessfully, string? errorMessage, string? broadcasterTwitchId = null)
        {
            try
            {
                const string insertQuery = @"
                    INSERT INTO sound_alert_history
                        (channel_name, reward_id, reward_title, file_path, redeemed_by, redeemed_by_id,
                         redeemed_at, played_successfully, error_message, user_id)
                    VALUES
                        (@channelName, @rewardId, @rewardTitle, @filePath, @redeemedBy, @redeemedById,
                         @redeemedAt, @playedSuccessfully, @errorMessage,
                         (SELECT id FROM users WHERE twitch_id = @broadcasterTwitchId LIMIT 1))";

                using var cmd = new NpgsqlCommand(insertQuery, conn);
                cmd.Parameters.AddWithValue("@channelName", channelName.ToLower());
                cmd.Parameters.AddWithValue("@rewardId", rewardId);
                cmd.Parameters.AddWithValue("@rewardTitle", rewardTitle);
                cmd.Parameters.AddWithValue("@filePath", (object?)filePath ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@redeemedBy", redeemedBy);
                cmd.Parameters.AddWithValue("@redeemedById", (object?)redeemedById ?? DBNull.Value);

                if (!string.IsNullOrEmpty(redeemedAt))
                {
                    cmd.Parameters.AddWithValue("@redeemedAt", DateTime.Parse(redeemedAt, null, System.Globalization.DateTimeStyles.AssumeUniversal));
                }
                else
                {
                    cmd.Parameters.AddWithValue("@redeemedAt", DateTime.UtcNow);
                }

                cmd.Parameters.AddWithValue("@playedSuccessfully", playedSuccessfully);
                cmd.Parameters.AddWithValue("@errorMessage", (object?)errorMessage ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@broadcasterTwitchId", (object?)broadcasterTwitchId ?? DBNull.Value);

                await cmd.ExecuteNonQueryAsync();

                _logger.LogInformation($"Historial de canje registrado para {redeemedBy} - {rewardTitle}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error registrando historial de canje");
            }
        }

        // Una sola implementación en Decatron.Core: las cuatro copias privadas que
        // había tenían la misma lógica rota, así que arreglar una sola habría dejado
        // las otras tres generando URLs invalidas.
        private static string ToPublicPath(string filePath) =>
            Decatron.Core.Helpers.MediaPathHelpers.ToPublicPath(filePath);

        /// <summary>Los archivos de sistema no tienen fila de BD con FileType — se infiere de la carpeta (sounds/videos/images), igual que SoundAlertTriggerService.</summary>
        private static string InferSystemFileType(string systemFilePath)
        {
            if (systemFilePath.Contains("/sounds/")) return "sound";
            if (systemFilePath.Contains("/videos/")) return "video";
            if (systemFilePath.Contains("/images/")) return "image";
            return "sound";
        }

        private async Task ManejarEventoSeguidor(JObject datosEvento)
        {
            try
            {
                var userId = datosEvento["user_id"]?.ToString();
                var userName = datosEvento["user_name"]?.ToString();
                var broadcasterId = datosEvento["broadcaster_user_id"]?.ToString();
                var broadcasterName = datosEvento["broadcaster_user_name"]?.ToString();
                var followedAtStr = datosEvento["followed_at"]?.ToString();

                _logger.LogDebug($"[FOLLOW DEBUG] userId={userId}, userName={userName}, broadcasterId={broadcasterId}, broadcasterName={broadcasterName}, followedAt={followedAtStr}");

                if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(userName) ||
                    string.IsNullOrEmpty(broadcasterId) || string.IsNullOrEmpty(broadcasterName) ||
                    string.IsNullOrEmpty(followedAtStr))
                {
                    _logger.LogWarning($"⚠️ Evento de follow con datos incompletos - userId:{userId}, userName:{userName}, broadcasterId:{broadcasterId}, broadcasterName:{broadcasterName}, followedAt:{followedAtStr}");
                    return;
                }

                var followedAt = DateTime.Parse(followedAtStr, null, System.Globalization.DateTimeStyles.RoundtripKind);
                if (followedAt.Kind != DateTimeKind.Utc)
                {
                    followedAt = followedAt.ToUniversalTime();
                }
                var channelNameLower = broadcasterName.ToLower();

                // Obtener UserId del canal para FK constraint
                var channelUser = await _dbContext.Users
                    .FirstOrDefaultAsync(u => u.TwitchId == broadcasterId);
                var channelUserId = channelUser?.Id ?? 0;

                _logger.LogInformation($"❤️ [FOLLOW] {userName} siguió a {broadcasterName}");

                try
                {
                    _logger.LogInformation($"🔄 [FOLLOWERS] Iniciando guardado de follower {userName} (userId={userId}, broadcasterId={broadcasterId})");

                    var userLogin = datosEvento["user_login"]?.ToString() ?? userName.ToLower();

                    var newFollower = new Decatron.Core.Models.ChannelFollower
                    {
                        BroadcasterId = broadcasterId,
                        BroadcasterName = broadcasterName,
                        UserId = userId,
                        UserName = userName,
                        UserLogin = userLogin,
                        FollowedAt = followedAt,
                        IsFollowing = 0,  // 0 = activo
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    _logger.LogDebug($"[FOLLOWERS] Llamando UpsertFollowerAsync para {userName}");
                    await _followersService.UpsertFollowerAsync(newFollower);

                    _logger.LogDebug($"[FOLLOWERS] Llamando AddHistoryEntryAsync para {userName}");
                    await _followersService.AddHistoryEntryAsync(broadcasterId, userId, 0, followedAt); // 0 = Follow con fecha real

                    _logger.LogInformation($"✅ [FOLLOWERS] {userName} registrado exitosamente en sistema de followers");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"❌ [FOLLOWERS] Error guardando follower {userName} en sistema de followers");
                }

                try
                {
                    await _timerEventService.ProcessFollowEventAsync(broadcasterName, userName, userId);
                }
                catch (Exception timerEx)
                {
                    _logger.LogError(timerEx, $"Error procesando follow para timer: {userName}");
                }

                try
                {
                    await _eventAlertsService.TriggerAlertAsync(channelNameLower, "follow", userName);
                }
                catch (Exception alertEx)
                {
                    _logger.LogError(alertEx, "[EventAlerts] Error triggering follow alert for {User}", userName);
                }
                await _petEventBridge.OnAlertAsync(channelNameLower, "follow", userName); // mascota: nunca lanza
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error procesando evento de follow");
            }
        }


        /// <summary>
        /// Acredita un aporte en la Billetera de Aportes de la Rueda de la Suerte y,
        /// si la rueda tiene auto-girar, la hace girar sola.
        ///
        /// <para>Los tres aportes (bits, subs de regalo y canjes) hacen exactamente lo
        /// mismo con la rueda: cambia solo la fuente y la cantidad. La lógica vive en
        /// <see cref="WheelService.CreditAndMaybeSpinAsync"/> y no acá, porque el
        /// simulador del panel llama a esa misma función: si tuviera una copia, probaría
        /// su copia y no lo que pasa en vivo.</para>
        ///
        /// <para>Nunca lanza: un fallo de la rueda no puede tumbar el procesamiento del
        /// evento, del que dependen el timer, las alertas y el gachapón.</para>
        /// </summary>
        private async Task AcreditarEnRuedaAsync(
            string channelLogin, string viewerLogin, string source, long amount,
            string? rewardId = null, string? subTier = null)
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var wheels = scope.ServiceProvider.GetRequiredService<WheelService>();
                await wheels.CreditAndMaybeSpinAsync(channelLogin, viewerLogin, source, amount, rewardId, subTier);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error acreditando {Source} de {Viewer} en {Channel}",
                    source, viewerLogin, channelLogin);
            }
        }

        private async Task ManejarEventoCheer(JObject datosEvento)
        {
            try
            {
                var broadcasterUserId = datosEvento["broadcaster_user_id"]?.ToString();
                var broadcasterUserName = datosEvento["broadcaster_user_login"]?.ToString();
                var userId = datosEvento["user_id"]?.ToString();
                var userName = datosEvento["user_name"]?.ToString();
                var bits = datosEvento["bits"]?.ToObject<int>() ?? 0;

                if (string.IsNullOrEmpty(broadcasterUserName) || string.IsNullOrEmpty(userName) || bits <= 0)
                {
                    _logger.LogWarning("Evento de Cheer con datos incompletos");
                    return;
                }

                _logger.LogInformation($"💎 [CHEER] {userName} envió {bits} bits en {broadcasterUserName}");

                await _timerEventService.ProcessCheerEventAsync(broadcasterUserName, userName, bits);

                try
                {
                    await _eventAlertsService.TriggerAlertAsync(broadcasterUserName.ToLower(), "bits", userName, amount: bits);
                }
                catch (Exception alertEx)
                {
                    _logger.LogError(alertEx, "[EventAlerts] Error triggering bits alert for {User}", userName);
                }
                await _petEventBridge.OnAlertAsync(broadcasterUserName, "bits", userName, amount: bits); // mascota: nunca lanza

                // Actualizar bits en giveaway activo si el usuario es participante
                if (!string.IsNullOrEmpty(broadcasterUserId) && !string.IsNullOrEmpty(userId))
                {
                    try
                    {
                        using (var scope = _dbContext.Database.BeginTransaction())
                        {
                            var updated = await _giveawayService.UpdateParticipantBits(broadcasterUserId, userId, bits);

                            if (updated)
                            {
                                _logger.LogInformation($"✅ [GIVEAWAY] Bits de {userName} actualizados en giveaway activo: +{bits} bits");
                            }

                            await scope.CommitAsync();
                        }
                    }
                    catch (Exception giveawayEx)
                    {
                        _logger.LogError(giveawayEx, $"Error actualizando bits de giveaway para {userName}");
                    }
                }

                // Gacha: convertir bits en tiros
                try
                {
                    await _gachaService.ProcessBitsEventAsync(broadcasterUserName.ToLower(), userName, bits);
                }
                catch (Exception gachaEx)
                {
                    _logger.LogError(gachaEx, "[GACHA] Error procesando bits para gacha");
                }

                // Rueda de la Suerte: convertir bits en créditos
                await AcreditarEnRuedaAsync(broadcasterUserName, userName,
                    Decatron.Core.Models.WheelOfLuck.WheelSources.Bits, bits);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error procesando evento de Cheer");
            }
        }

        private async Task ManejarEventoSubscribe(JObject datosEvento)
        {
            try
            {
                var broadcasterUserName = datosEvento["broadcaster_user_login"]?.ToString();
                var userName = datosEvento["user_name"]?.ToString();
                var tier = datosEvento["tier"]?.ToString(); // "1000", "2000", "3000"
                var isGift = datosEvento["is_gift"]?.ToObject<bool>() ?? false;

                if (string.IsNullOrEmpty(broadcasterUserName) || string.IsNullOrEmpty(userName) || string.IsNullOrEmpty(tier))
                {
                    _logger.LogWarning("Evento de Subscribe con datos incompletos");
                    return;
                }

                // Si es un gift sub, ignorar — el evento channel.subscription.gift ya lo maneja
                if (isGift)
                {
                    _logger.LogInformation($"⭐ [SUB] Ignorando sub de {userName} en {broadcasterUserName} — es gift sub (manejado por channel.subscription.gift)");
                    return;
                }

                _logger.LogInformation($"⭐ [SUB] {userName} se suscribió en {broadcasterUserName} - Tier: {tier}");

                await _timerEventService.ProcessSubscribeEventAsync(broadcasterUserName, userName, tier);

                try
                {
                    await _eventAlertsService.TriggerAlertAsync(broadcasterUserName.ToLower(), "subs", userName, subTier: tier);
                }
                catch (Exception alertEx)
                {
                    _logger.LogError(alertEx, "[EventAlerts] Error triggering sub alert for {User}", userName);
                }
                await _petEventBridge.OnAlertAsync(broadcasterUserName, "sub", userName, tier: tier); // mascota: nunca lanza

                try
                {
                    await _gachaService.ProcessSubEventAsync(broadcasterUserName.ToLower(), userName, tier);
                }
                catch (Exception gachaEx)
                {
                    _logger.LogError(gachaEx, "[GACHA] Error procesando sub para gacha");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error procesando evento de Subscribe");
            }
        }

        private async Task ManejarEventoGiftSub(JObject datosEvento)
        {
            try
            {
                var broadcasterUserName = datosEvento["broadcaster_user_login"]?.ToString();
                var userName = datosEvento["user_name"]?.ToString();
                var total = datosEvento["total"]?.ToObject<int>() ?? 0;
                // "1000", "2000" o "3000". Este payload es el ÚNICO sitio del sistema
                // por el que llega el tier: el badge `subscriber` del chat trae los
                // meses de sub, no el tier. Si un día falta, la Rueda lo trata como
                // Tier 1 y el multiplicador simplemente no se aplica.
                var tierRegalo = datosEvento["tier"]?.ToString();

                if (string.IsNullOrEmpty(broadcasterUserName) || string.IsNullOrEmpty(userName) || total <= 0)
                {
                    _logger.LogWarning("Evento de Gift Sub con datos incompletos");
                    return;
                }

                _logger.LogInformation($"🎁 [GIFT SUB] {userName} regaló {total} suscripciones en {broadcasterUserName}");

                await _timerEventService.ProcessGiftSubEventAsync(broadcasterUserName, userName, total);

                try
                {
                    await _eventAlertsService.TriggerAlertAsync(broadcasterUserName.ToLower(), "giftSubs", userName, amount: total);
                }
                catch (Exception alertEx)
                {
                    _logger.LogError(alertEx, "[EventAlerts] Error triggering giftSub alert for {User}", userName);
                }
                await _petEventBridge.OnAlertAsync(broadcasterUserName, "giftSub", userName, amount: total); // mascota: nunca lanza

                // Gacha: convertir gift subs en tiros (al que regala)
                try
                {
                    await _gachaService.ProcessGiftSubEventAsync(broadcasterUserName.ToLower(), userName, total);
                }
                catch (Exception gachaEx)
                {
                    _logger.LogError(gachaEx, "[GACHA] Error procesando gift sub para gacha");
                }

                // Rueda de la Suerte: los créditos van a quien REGALA, no a quien recibe.
                await AcreditarEnRuedaAsync(broadcasterUserName, userName,
                    Decatron.Core.Models.WheelOfLuck.WheelSources.GiftSub, total, subTier: tierRegalo);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error procesando evento de Gift Sub");
            }
        }

        private async Task ManejarEventoRaid(JObject datosEvento)
        {
            try
            {
                var toBroadcasterUserName = datosEvento["to_broadcaster_user_login"]?.ToString();
                var fromBroadcasterUserName = datosEvento["from_broadcaster_user_name"]?.ToString();
                var viewers = datosEvento["viewers"]?.ToObject<int>() ?? 0;

                if (string.IsNullOrEmpty(toBroadcasterUserName) || string.IsNullOrEmpty(fromBroadcasterUserName) || viewers <= 0)
                {
                    _logger.LogWarning("Evento de Raid con datos incompletos");
                    return;
                }

                _logger.LogInformation($"🚀 [RAID] {fromBroadcasterUserName} raideó a {toBroadcasterUserName} con {viewers} viewers");

                await _timerEventService.ProcessRaidEventAsync(toBroadcasterUserName, fromBroadcasterUserName, viewers);

                try
                {
                    await _eventAlertsService.TriggerAlertAsync(toBroadcasterUserName.ToLower(), "raids", fromBroadcasterUserName, amount: viewers);
                }
                catch (Exception alertEx)
                {
                    _logger.LogError(alertEx, "[EventAlerts] Error triggering raid alert for {User}", fromBroadcasterUserName);
                }
                await _petEventBridge.OnAlertAsync(toBroadcasterUserName, "raid", fromBroadcasterUserName, amount: viewers); // mascota: nunca lanza
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error procesando evento de Raid");
            }
        }

        private async Task ManejarEventoHypeTrain(JObject datosEvento)
        {
            try
            {
                var broadcasterUserName = datosEvento["broadcaster_user_login"]?.ToString();
                var level = datosEvento["level"]?.ToObject<int>() ?? 1;

                if (string.IsNullOrEmpty(broadcasterUserName))
                {
                    _logger.LogWarning("Evento de Hype Train con datos incompletos");
                    return;
                }

                _logger.LogInformation($"🔥 [HYPE TRAIN] Iniciado en {broadcasterUserName} - Nivel: {level}");

                await _timerEventService.ProcessHypeTrainEventAsync(broadcasterUserName, level);

                try
                {
                    await _eventAlertsService.TriggerAlertAsync(broadcasterUserName.ToLower(), "hypeTrain", broadcasterUserName, level: level);
                }
                catch (Exception alertEx)
                {
                    _logger.LogError(alertEx, "[EventAlerts] Error triggering hypeTrain alert for {Channel}", broadcasterUserName);
                }
                await _petEventBridge.OnAlertAsync(broadcasterUserName, "hypeTrain", broadcasterUserName, level: level); // mascota: nunca lanza
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error procesando evento de Hype Train");
            }
        }

        private async Task ManejarEventoResub(JObject datosEvento)
        {
            try
            {
                var broadcasterUserName = datosEvento["broadcaster_user_login"]?.ToString();
                var userName = datosEvento["user_name"]?.ToString();
                var tier = datosEvento["tier"]?.ToString(); // "1000", "2000", "3000"
                var months = datosEvento["cumulative_months"]?.ToObject<int>() ?? 0;
                var message = datosEvento["message"]?["text"]?.ToString();

                if (string.IsNullOrEmpty(broadcasterUserName) || string.IsNullOrEmpty(userName))
                {
                    _logger.LogWarning("Evento de Resub con datos incompletos");
                    return;
                }

                _logger.LogInformation($"🎉 [RESUB] {userName} renovó en {broadcasterUserName} - Tier: {tier}, Meses: {months}");

                // Una renovación vale lo mismo que una sub nueva para el timer y el gachapón.
                // Twitch solo manda este evento cuando el viewer comparte su resub en el chat;
                // las renovaciones automáticas silenciosas no generan ningún evento.
                if (!string.IsNullOrEmpty(tier))
                {
                    await _timerEventService.ProcessSubscribeEventAsync(broadcasterUserName, userName, tier, months: Math.Max(1, months));
                }

                try
                {
                    await _eventAlertsService.TriggerAlertAsync(
                        broadcasterUserName.ToLower(), "resubs", userName,
                        userMessage: message, months: months, subTier: tier);
                }
                catch (Exception alertEx)
                {
                    _logger.LogError(alertEx, "[EventAlerts] Error triggering resub alert for {User}", userName);
                }
                await _petEventBridge.OnAlertAsync(broadcasterUserName, "resub", userName, months: months, tier: tier); // mascota: nunca lanza

                if (!string.IsNullOrEmpty(tier))
                {
                    try
                    {
                        await _gachaService.ProcessSubEventAsync(broadcasterUserName.ToLower(), userName, tier, isResub: true);
                    }
                    catch (Exception gachaEx)
                    {
                        _logger.LogError(gachaEx, "[GACHA] Error procesando resub para gacha");
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error procesando evento de Resub");
            }
        }
    }
}
