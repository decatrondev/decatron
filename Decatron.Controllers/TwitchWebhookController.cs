using System;
using System.Collections.Concurrent;

using System.IO;
using System.Linq;

using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Core.Helpers;
using Decatron.Data;
using Decatron.Hubs;
using Decatron.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Npgsql;
using TwitchLib.Client;
using TwitchLib.Client.Events;
using TwitchLib.Client.Models;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/twitch")]
    public class TwitchWebhookController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<TwitchWebhookController> _logger;
        private readonly TwitchClient _twitchClient;
        private readonly TwitchBotService _twitchBotService;
        private readonly EventSubService _eventSubService;
        private readonly IHubContext<OverlayHub> _hubContext;
        private readonly DecatronDbContext _dbContext;
        private readonly Decatron.Core.Services.FollowersService _followersService;
        private readonly TimerEventService _timerEventService;
        private readonly Decatron.Core.Interfaces.IEventAlertsService _eventAlertsService;
        private readonly IStreamStatusService _streamStatusService;


        // ✨ NUEVO: Cache para evitar procesar el mismo mensaje dos veces
        private static readonly ConcurrentDictionary<string, DateTime> _processedMessages = new ConcurrentDictionary<string, DateTime>();

        public TwitchWebhookController(IConfiguration configuration, ILogger<TwitchWebhookController> logger, TwitchClient twitchClient, TwitchBotService twitchBotService, EventSubService eventSubService, IHubContext<OverlayHub> hubContext, DecatronDbContext dbContext, Decatron.Core.Services.FollowersService followersService, TimerEventService timerEventService, Decatron.Core.Interfaces.IEventAlertsService eventAlertsService, IStreamStatusService streamStatusService)
        {
            _configuration = configuration;
            _logger = logger;
            _twitchClient = twitchClient;
            _twitchBotService = twitchBotService;
            _eventSubService = eventSubService;
            _hubContext = hubContext;
            _dbContext = dbContext;
            _followersService = followersService;
            _timerEventService = timerEventService;
            _eventAlertsService = eventAlertsService;
            _streamStatusService = streamStatusService;

            // Initial cleanup on construction (no infinite loop — cleanup happens per-request via cache expiration)
            CleanupOldMessages();
        }

        // Limpiar mensajes procesados (más de 5 minutos)
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
            _logger.LogInformation("[Webhook] {Message}", message);
        }

        [HttpPost("webhook")]
        public async Task<IActionResult> ManejadorWebhook()
        {
            string cuerpo;
            using (var lector = new StreamReader(Request.Body, Encoding.UTF8))
            {
                cuerpo = await lector.ReadToEndAsync();
            }

            var tipoMensaje = Request.Headers["Twitch-Eventsub-Message-Type"].ToString();
            var idMensaje = Request.Headers["Twitch-Eventsub-Message-Id"].ToString();
            var marcaTiempo = Request.Headers["Twitch-Eventsub-Message-Timestamp"].ToString();
            var encabezadoFirma = Request.Headers["Twitch-Eventsub-Message-Signature"].ToString();

            if (!VerificarFirma(idMensaje, marcaTiempo, cuerpo, encabezadoFirma))
            {
                LogToFile("ERROR: Verificación de firma fallida");
                _logger.LogWarning("❌ Verificación de firma fallida");
                return Unauthorized();
            }

            var json = JObject.Parse(cuerpo);

            switch (tipoMensaje)
            {
                case "webhook_callback_verification":
                    var desafio = json["challenge"].ToString();
                    LogToFile($"✅ Respondiendo desafío de verificación");
                    _logger.LogInformation($"✅ Webhook verificado correctamente");
                    return Content(desafio);

                case "notification":
                    await ManejarNotificacion(json);
                    return Ok();

                default:
                    LogToFile($"ALERTA: Tipo de mensaje desconocido: {tipoMensaje}");
                    _logger.LogWarning($"⚠️ Tipo de mensaje desconocido: {tipoMensaje}");
                    return BadRequest();
            }
        }

        // download-logs endpoint removed — use centralized Serilog logging instead

        private bool VerificarFirma(string idMensaje, string marcaTiempo, string cuerpo, string encabezadoFirma)
        {
            var secreto = _configuration["TwitchSettings:WebhookSecret"];
            if (string.IsNullOrEmpty(secreto))
            {
                LogToFile("ERROR: WebhookSecret no configurado");
                _logger.LogError("❌ WebhookSecret no configurado");
                return false;
            }
            var mensaje = idMensaje + marcaTiempo + cuerpo;
            using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secreto)))
            {
                var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(mensaje));
                var firmaCalculada = BitConverter.ToString(hash).Replace("-", "").ToLower();
                return encabezadoFirma == $"sha256={firmaCalculada}";
            }
        }

        private async Task ManejarNotificacion(JObject json)
        {
            var tipoEvento = json["subscription"]["type"].ToString();
            var datosEvento = json["event"] as JObject;

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
            else
            {
                _logger.LogWarning($"⚠️ Evento no manejado: {tipoEvento}");
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
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error procesando stream.offline");
            }
        }

        // ✨ NUEVO: Procesar eventos de chat desde EventSub
        private async Task ManejarEventoChat(JObject datosEvento)
        {
            try
            {
                // Extraer datos del evento
                var messageId = datosEvento["message_id"]?.ToString();
                var broadcasterUserId = datosEvento["broadcaster_user_id"]?.ToString();
                var broadcasterUserName = datosEvento["broadcaster_user_name"]?.ToString();
                var chatterUserId = datosEvento["chatter_user_id"]?.ToString();
                var chatterUserName = datosEvento["chatter_user_name"]?.ToString();
                var messageText = datosEvento["message"]?["text"]?.ToString();

                // ✨ FIX SHARED CHAT: Extraer source_broadcaster_user_id si existe
                // Este campo indica el canal REAL donde se escribió el mensaje (en shared chat)
                var sourceBroadcasterUserId = datosEvento["source_broadcaster_user_id"]?.ToString();

                // El roomId debe ser el source (si existe) o broadcaster (si no hay source)
                var roomId = !string.IsNullOrEmpty(sourceBroadcasterUserId)
                    ? sourceBroadcasterUserId
                    : broadcasterUserId;

                // Log para debugging de shared chat
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

                // Evitar procesar duplicados
                if (_processedMessages.ContainsKey(messageId))
                {
                    return;
                }
                _processedMessages[messageId] = DateTime.UtcNow;

                // Extraer badges para determinar roles
                var badges = datosEvento["badges"] as JArray;
                bool isModerator = false;
                bool isVip = false;
                bool isSubscriber = false;
                bool isBroadcaster = chatterUserId == broadcasterUserId;

                // 🎯 NUEVO: Construir badge-info para sub streak
                var metadata = new Dictionary<string, object>();
                string badgeInfoStr = "";
                var allBadgesLog = new List<string>(); // Para debug

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

                        // Check expanded moderator roles
                        // Incluye 'moderator', 'lead_moderator', y cualquier variante futura que contenga 'moderator'
                        if (badgeId == "moderator" || badgeId == "staff" || badgeId == "admin" || badgeId == "global_mod" || 
                            badgeId == "lead_moderator" || badgeId.Contains("moderator")) 
                        {
                            isModerator = true;
                        }
                        
                        if (badgeId == "vip") isVip = true;
                        if (badgeId == "subscriber" || badgeId == "founder")
                        {
                            isSubscriber = true;
                            // Construir badge-info con formato "subscriber/X"
                            if (!string.IsNullOrEmpty(badgeVersion))
                            {
                                if (!string.IsNullOrEmpty(badgeInfoStr))
                                    badgeInfoStr += ",";
                                badgeInfoStr += $"subscriber/{badgeVersion}";
                            }
                        }
                        if (badgeId == "broadcaster") isBroadcaster = true;
                    }

                    // Log de todas las medallas detectadas para depuración
                    if (allBadgesLog.Any())
                    {
                         _logger.LogInformation($"🏷️ [BADGES DETECTADOS] {chatterUserName}: {string.Join(", ", allBadgesLog)} | EsMod={isModerator}");
                    }

                    // Guardar badge-info en metadata
                    if (!string.IsNullOrEmpty(badgeInfoStr))
                    {
                        metadata["badge-info"] = badgeInfoStr;
                        _logger.LogDebug($"🎯 [BADGE-INFO] {chatterUserName}: {badgeInfoStr}");
                    }
                }

                // Procesar el mensaje usando el mismo flujo que IRC
                await _twitchBotService.ProcessMessageFromEventSubAsync(
                    messageId: messageId,
                    channel: broadcasterUserName.ToLower(),
                    username: chatterUserName,
                    userId: chatterUserId,
                    roomId: roomId, // ✅ FIX: Usar source_broadcaster_user_id si existe
                    message: messageText,
                    isModerator: isModerator,
                    isVip: isVip,
                    isSubscriber: isSubscriber,
                    isBroadcaster: isBroadcaster,
                    metadata: metadata // ✅ Pasar badge-info para sub streak
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error procesando evento de chat desde EventSub");
            }
        }

        // ✨ NUEVO: Procesar eventos de canjes de Channel Points
        private async Task ManejarEventoCanje(JObject datosEvento)
        {
            try
            {
                // Extraer datos del evento
                var rewardId = datosEvento["reward"]?["id"]?.ToString();
                var rewardTitle = datosEvento["reward"]?["title"]?.ToString();
                var broadcasterUserId = datosEvento["broadcaster_user_id"]?.ToString();
                var broadcasterUserName = datosEvento["broadcaster_user_login"]?.ToString();
                var redeemerUserId = datosEvento["user_id"]?.ToString();
                var redeemerUserName = datosEvento["user_login"]?.ToString();
                var redeemedAt = datosEvento["redeemed_at"]?.ToString();

                // Validar datos mínimos
                if (string.IsNullOrEmpty(rewardId) || string.IsNullOrEmpty(broadcasterUserName) ||
                    string.IsNullOrEmpty(redeemerUserName))
                {
                    _logger.LogWarning("Evento de canje con datos incompletos");
                    return;
                }

                LogToFile($"EVENTO CANJE: {redeemerUserName} canjeó '{rewardTitle}' en el canal {broadcasterUserName}");
                _logger.LogInformation($"Channel Points Redemption - Reward: {rewardTitle}, Redeemer: {redeemerUserName}, Channel: {broadcasterUserName}");

                // Buscar archivo de sound alert asociado a esta recompensa
                var connectionString = _configuration.GetConnectionString("DefaultConnection");
                using var conn = new NpgsqlConnection(connectionString);
                await conn.OpenAsync();

                const string fileQuery = @"
                    SELECT id, file_type, file_path, file_name, volume, enabled, image_path, image_name, is_system_file
                    FROM sound_alert_files
                    WHERE username = @username AND reward_id = @rewardId
                    LIMIT 1";

                using var fileCmd = new NpgsqlCommand(fileQuery, conn);
                fileCmd.Parameters.AddWithValue("@username", broadcasterUserName.ToLower());
                fileCmd.Parameters.AddWithValue("@rewardId", rewardId);

                using var reader = await fileCmd.ExecuteReaderAsync();

                if (!await reader.ReadAsync())
                {
                    _logger.LogInformation($"No hay archivo de sound alert configurado para reward {rewardId} en canal {broadcasterUserName}");
                    await reader.CloseAsync();

                    // Registrar en historial aunque no haya archivo
                    await RegistrarHistorialCanje(conn, broadcasterUserName, rewardId, rewardTitle ?? "",
                        null, redeemerUserName, redeemerUserId, redeemedAt, false, "No hay archivo configurado");
                    return;
                }

                var fileId = reader.GetInt64(0);
                var fileType = reader.GetString(1);
                var filePath = reader.GetString(2);
                var fileName = reader.GetString(3);
                var volume = reader.IsDBNull(4) ? (int?)null : reader.GetInt32(4);
                var enabled = reader.GetBoolean(5);
                var imagePath = reader.IsDBNull(6) ? (string?)null : reader.GetString(6);
                var imageName = reader.IsDBNull(7) ? (string?)null : reader.GetString(7);
                var isSystemFile = reader.IsDBNull(8) ? false : reader.GetBoolean(8);

                await reader.CloseAsync();

                _logger.LogInformation($"🎵 [DEBUG] Archivo - ID: {fileId}, Type: {fileType}, FileName: {fileName}, FilePath: {filePath}, IsSystemFile: {isSystemFile}");

                if (!enabled)
                {
                    _logger.LogInformation($"Sound alert deshabilitado para reward {rewardId}");
                    await RegistrarHistorialCanje(conn, broadcasterUserName, rewardId, rewardTitle ?? "",
                        filePath, redeemerUserName, redeemerUserId, redeemedAt, false, "Alerta deshabilitada");
                    return;
                }

                // Obtener configuración global del canal
                const string configQuery = @"
                    SELECT global_volume, global_enabled, duration, text_lines, styles, layout,
                           animation_type, animation_speed, text_outline_enabled, text_outline_color,
                           text_outline_width
                    FROM sound_alert_configs
                    WHERE username = @username
                    LIMIT 1";

                using var configCmd = new NpgsqlCommand(configQuery, conn);
                configCmd.Parameters.AddWithValue("@username", broadcasterUserName.ToLower());

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
                        filePath, redeemerUserName, redeemerUserId, redeemedAt, false, "Sistema deshabilitado");
                    return;
                }

                // Incrementar contador de reproducciones
                const string updatePlayCountQuery = @"
                    UPDATE sound_alert_files
                    SET play_count = play_count + 1, updated_at = NOW()
                    WHERE id = @id";

                using var updateCmd = new NpgsqlCommand(updatePlayCountQuery, conn);
                updateCmd.Parameters.AddWithValue("@id", fileId);
                await updateCmd.ExecuteNonQueryAsync();

                // Construir URLs correctamente dependiendo si es archivo del sistema o de usuario
                string fileUrl;
                string? imageUrl = null;

                if (isSystemFile)
                {
                    // Archivo del sistema: usar la ruta almacenada directamente
                    // filePath es algo como "ClientApp/public/system-files/videos/fbi.mp4"
                    // Convertir a URL: "/system-files/videos/fbi.mp4"
                    var relativePath = filePath.Replace("ClientApp/public", "").Replace("\\", "/");
                    if (!relativePath.StartsWith("/"))
                        relativePath = "/" + relativePath;
                    fileUrl = relativePath;
                    _logger.LogInformation($"🎵 [SoundAlerts] Archivo del sistema - FilePath: {filePath} → URL: {fileUrl}");

                    // Para archivos del sistema, imagePath también sería un path del sistema si existe
                    if (!string.IsNullOrEmpty(imagePath))
                    {
                        var relativeImagePath = imagePath.Replace("ClientApp/public", "").Replace("\\", "/");
                        if (!relativeImagePath.StartsWith("/"))
                            relativeImagePath = "/" + relativeImagePath;
                        imageUrl = relativeImagePath;
                    }
                }
                else
                {
                    // Archivo de usuario: construir URL con username
                    // IMPORTANTE: Usar el nombre real del archivo físico (con GUID), no el fileName original
                    var physicalFileName = Path.GetFileName(filePath);
                    fileUrl = $"/uploads/soundalerts/{broadcasterUserName.ToLower()}/{physicalFileName}";
                    _logger.LogInformation($"🎵 [SoundAlerts] Archivo de usuario - FilePath: {filePath}, PhysicalFileName: {physicalFileName} → URL: {fileUrl}");

                    // También usar el nombre físico real para la imagen (si existe)
                    if (!string.IsNullOrEmpty(imagePath))
                    {
                        var physicalImageName = Path.GetFileName(imagePath);
                        imageUrl = $"/uploads/soundalerts/{broadcasterUserName.ToLower()}/{physicalImageName}";
                    }
                }

                _logger.LogInformation($"🎵 [DEBUG] URL Final - FileUrl: {fileUrl}, FileType: {fileType}, IsSystemFile: {isSystemFile}");

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
                LogToFile($"ALERTA ENVIADA: {redeemerUserName} → {rewardTitle} → {fileName}");

                // Registrar en historial
                await RegistrarHistorialCanje(conn, broadcasterUserName, rewardId, rewardTitle ?? "",
                    filePath, redeemerUserName, redeemerUserId, redeemedAt, true, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error procesando evento de canje de Channel Points");
                LogToFile($"ERROR EN EVENTO CANJE: {ex.Message}");
            }
        }

        private async Task RegistrarHistorialCanje(NpgsqlConnection conn, string channelName, string rewardId,
            string rewardTitle, string? filePath, string redeemedBy, string? redeemedById,
            string? redeemedAt, bool playedSuccessfully, string? errorMessage)
        {
            try
            {
                const string insertQuery = @"
                    INSERT INTO sound_alert_history
                        (channel_name, reward_id, reward_title, file_path, redeemed_by, redeemed_by_id,
                         redeemed_at, played_successfully, error_message)
                    VALUES
                        (@channelName, @rewardId, @rewardTitle, @filePath, @redeemedBy, @redeemedById,
                         @redeemedAt, @playedSuccessfully, @errorMessage)";

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

                await cmd.ExecuteNonQueryAsync();

                _logger.LogInformation($"Historial de canje registrado para {redeemedBy} - {rewardTitle}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error registrando historial de canje");
            }
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

                _logger.LogInformation($"❤️ [FOLLOW] {userName} siguió a {broadcasterName}");

                // ✨ NUEVO: Guardar en sistema de followers
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

                // Obtener configuración de follow alerts
                var config = await _dbContext.FollowAlertConfigs
                    .FirstOrDefaultAsync(c => c.ChannelName == channelNameLower);

                if (config == null || !config.Enabled)
                {
                    _logger.LogInformation($"Follow alerts desactivados para {broadcasterName}");

                    // Guardar en historial sin enviar mensaje
                    _dbContext.FollowAlertHistories.Add(new Decatron.Core.Models.FollowAlertHistory
                    {
                        ChannelName = channelNameLower,
                        FollowerUsername = userName.ToLower(),
                        FollowedAt = followedAt,
                        MessageSent = false,
                        CreatedAt = DateTime.UtcNow
                    });
                    await _dbContext.SaveChangesAsync();
                    return;
                }

                // Verificar cooldown
                var cooldownMinutes = config.CooldownMinutes;
                var cooldownCutoff = DateTime.UtcNow.AddMinutes(-cooldownMinutes);

                var recentFollow = await _dbContext.FollowAlertHistories
                    .Where(f => f.ChannelName == channelNameLower &&
                                f.FollowerUsername == userName.ToLower() &&
                                f.FollowedAt >= cooldownCutoff)
                    .OrderByDescending(f => f.FollowedAt)
                    .FirstOrDefaultAsync();

                bool shouldSendMessage = recentFollow == null;

                if (!shouldSendMessage)
                {
                    var minutesSinceLastFollow = (DateTime.UtcNow - recentFollow.FollowedAt).TotalMinutes;
                    _logger.LogInformation($"⏱️ [FOLLOW] {userName} en cooldown ({minutesSinceLastFollow:F1}/{cooldownMinutes} minutos)");
                }

                // Guardar en historial
                _dbContext.FollowAlertHistories.Add(new Decatron.Core.Models.FollowAlertHistory
                {
                    ChannelName = channelNameLower,
                    FollowerUsername = userName.ToLower(),
                    FollowedAt = followedAt,
                    MessageSent = shouldSendMessage,
                    CreatedAt = DateTime.UtcNow
                });
                await _dbContext.SaveChangesAsync();

                // Enviar mensaje si debe
                if (shouldSendMessage)
                {
                    var message = config.Message.Replace("{username}", userName);
                    await _twitchBotService.SendMessage(channelNameLower, message);
                    _logger.LogInformation($"✅ [FOLLOW] Mensaje enviado: {message}");
                }

                // ⚡ NUEVO: Procesar evento de follow para el timer
                try
                {
                    await _timerEventService.ProcessFollowEventAsync(broadcasterName, userName, userId);
                }
                catch (Exception timerEx)
                {
                    _logger.LogError(timerEx, $"Error procesando follow para timer: {userName}");
                }

                // 🎉 Event Alert
                try
                {
                    await _eventAlertsService.TriggerAlertAsync(channelNameLower, "follow", userName);
                }
                catch (Exception alertEx)
                {
                    _logger.LogError(alertEx, "[EventAlerts] Error triggering follow alert for {User}", userName);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error procesando evento de follow");
            }
        }

        // ==================== TIMER EVENT HANDLERS ====================

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

                // Procesar evento de cheer para timer
                await _timerEventService.ProcessCheerEventAsync(broadcasterUserName, userName, bits);

                // 🎉 Event Alert
                try
                {
                    await _eventAlertsService.TriggerAlertAsync(broadcasterUserName.ToLower(), "bits", userName, amount: bits);
                }
                catch (Exception alertEx)
                {
                    _logger.LogError(alertEx, "[EventAlerts] Error triggering bits alert for {User}", userName);
                }

                // 🎁 NUEVO: Actualizar bits en giveaway activo si el usuario es participante
                if (!string.IsNullOrEmpty(broadcasterUserId) && !string.IsNullOrEmpty(userId))
                {
                    try
                    {
                        using (var scope = _dbContext.Database.BeginTransaction())
                        {
                            var giveawayService = HttpContext.RequestServices.GetRequiredService<GiveawayService>();
                            var updated = await giveawayService.UpdateParticipantBits(broadcasterUserId, userId, bits);

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

                // 🎉 Event Alert
                try
                {
                    await _eventAlertsService.TriggerAlertAsync(broadcasterUserName.ToLower(), "subs", userName, subTier: tier);
                }
                catch (Exception alertEx)
                {
                    _logger.LogError(alertEx, "[EventAlerts] Error triggering sub alert for {User}", userName);
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

                if (string.IsNullOrEmpty(broadcasterUserName) || string.IsNullOrEmpty(userName) || total <= 0)
                {
                    _logger.LogWarning("Evento de Gift Sub con datos incompletos");
                    return;
                }

                _logger.LogInformation($"🎁 [GIFT SUB] {userName} regaló {total} suscripciones en {broadcasterUserName}");

                await _timerEventService.ProcessGiftSubEventAsync(broadcasterUserName, userName, total);

                // 🎉 Event Alert
                try
                {
                    await _eventAlertsService.TriggerAlertAsync(broadcasterUserName.ToLower(), "giftSubs", userName, amount: total);
                }
                catch (Exception alertEx)
                {
                    _logger.LogError(alertEx, "[EventAlerts] Error triggering giftSub alert for {User}", userName);
                }
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

                // 🎉 Event Alert
                try
                {
                    await _eventAlertsService.TriggerAlertAsync(toBroadcasterUserName.ToLower(), "raids", fromBroadcasterUserName, amount: viewers);
                }
                catch (Exception alertEx)
                {
                    _logger.LogError(alertEx, "[EventAlerts] Error triggering raid alert for {User}", fromBroadcasterUserName);
                }
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

                // 🎉 Event Alert
                try
                {
                    await _eventAlertsService.TriggerAlertAsync(broadcasterUserName.ToLower(), "hypeTrain", broadcasterUserName, level: level);
                }
                catch (Exception alertEx)
                {
                    _logger.LogError(alertEx, "[EventAlerts] Error triggering hypeTrain alert for {Channel}", broadcasterUserName);
                }
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

                // 🎉 Event Alert
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
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error procesando evento de Resub");
            }
        }

        // ==================== END TIMER EVENT HANDLERS ====================

        // ==================== ENDPOINTS EVENTSUB ====================

        /// <summary>
        /// Registra una suscripción EventSub para channel.chat.message
        /// </summary>
        [HttpPost("eventsub/subscribe/chat")]
        [RequirePermission("settings", "control_total")]
        public async Task<IActionResult> SubscribeToChatMessages([FromBody] EventSubSubscribeRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.BroadcasterUserId))
                {
                    return BadRequest(new { error = "broadcaster_user_id es requerido" });
                }

                var result = await _eventSubService.SubscribeToChatMessagesAsync(request.BroadcasterUserId);

                if (result.Success)
                {
                    return Ok(new
                    {
                        message = result.Message,
                        data = result.ResponseBody != null ? JsonConvert.DeserializeObject(result.ResponseBody) : null
                    });
                }
                else
                {
                    return BadRequest(new
                    {
                        message = result.Message,
                        error = result.ResponseBody != null ? JsonConvert.DeserializeObject(result.ResponseBody) : null
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en SubscribeToChatMessages");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Registra una suscripción EventSub para channel.channel_points_custom_reward_redemption.add
        /// </summary>
        [HttpPost("eventsub/subscribe/channel-points")]
        [RequirePermission("settings", "control_total")]
        public async Task<IActionResult> SubscribeToChannelPoints([FromBody] EventSubSubscribeRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.BroadcasterUserId))
                {
                    return BadRequest(new { error = "broadcaster_user_id es requerido" });
                }

                var result = await _eventSubService.EnsureChannelPointsSubscriptionAsync(request.BroadcasterUserId);

                if (result.Success)
                {
                    return Ok(new
                    {
                        message = result.Message,
                        data = result.ResponseBody != null ? JsonConvert.DeserializeObject(result.ResponseBody) : null
                    });
                }
                else
                {
                    return BadRequest(new
                    {
                        message = result.Message,
                        error = result.ResponseBody != null ? JsonConvert.DeserializeObject(result.ResponseBody) : null
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en SubscribeToChannelPoints");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Registra una suscripción EventSub para channel.follow
        /// </summary>
        [HttpPost("eventsub/subscribe/follow")]
        [RequirePermission("settings", "control_total")]
        public async Task<IActionResult> SubscribeToFollows([FromBody] EventSubSubscribeFollowRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.BroadcasterUserId))
                {
                    return BadRequest(new { error = "broadcaster_user_id es requerido" });
                }

                if (string.IsNullOrEmpty(request.ModeratorUserId))
                {
                    return BadRequest(new { error = "moderator_user_id es requerido" });
                }

                var result = await _eventSubService.SubscribeToFollowsAsync(request.BroadcasterUserId, request.ModeratorUserId);

                if (result.Success)
                {
                    return Ok(new
                    {
                        message = result.Message,
                        data = result.ResponseBody != null ? JsonConvert.DeserializeObject(result.ResponseBody) : null
                    });
                }
                else
                {
                    return BadRequest(new
                    {
                        message = result.Message,
                        error = result.ResponseBody != null ? JsonConvert.DeserializeObject(result.ResponseBody) : null
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en SubscribeToFollows");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Lista todas las suscripciones EventSub activas
        /// </summary>
        [HttpGet("eventsub/subscriptions")]
        [RequirePermission("settings", "control_total")]
        public async Task<IActionResult> ListSubscriptions()
        {
            try
            {
                var result = await _eventSubService.ListSubscriptionsAsync();

                if (result.Success)
                {
                    return Ok(new
                    {
                        message = result.Message,
                        data = result.ResponseBody != null ? JsonConvert.DeserializeObject(result.ResponseBody) : null
                    });
                }
                else
                {
                    return BadRequest(new
                    {
                        message = result.Message,
                        error = result.ResponseBody != null ? JsonConvert.DeserializeObject(result.ResponseBody) : null
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en ListSubscriptions");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Elimina una suscripción EventSub por ID
        /// </summary>
        [HttpDelete("eventsub/subscriptions/{subscriptionId}")]
        [RequirePermission("settings", "control_total")]
        public async Task<IActionResult> DeleteSubscription(string subscriptionId)
        {
            try
            {
                if (string.IsNullOrEmpty(subscriptionId))
                {
                    return BadRequest(new { error = "subscription_id es requerido" });
                }

                var result = await _eventSubService.DeleteSubscriptionAsync(subscriptionId);

                if (result.Success)
                {
                    return Ok(new { message = result.Message });
                }
                else
                {
                    return BadRequest(new
                    {
                        message = result.Message,
                        error = result.ResponseBody != null ? JsonConvert.DeserializeObject(result.ResponseBody) : null
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en DeleteSubscription");
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }

    // Modelos de request para EventSub
    public class EventSubSubscribeRequest
    {
        public string BroadcasterUserId { get; set; }
    }

    public class EventSubSubscribeFollowRequest
    {
        public string BroadcasterUserId { get; set; }
        public string ModeratorUserId { get; set; }
    }
}