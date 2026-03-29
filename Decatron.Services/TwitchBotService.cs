using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Core.Settings;
using Decatron.Data;
using Decatron.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TwitchLib.Client;
using TwitchLib.Client.Events;
using TwitchLib.Client.Models;
using TwitchLib.Communication.Events;
using ChatMessage = Decatron.Core.Models.ChatMessage;

namespace Decatron.Services
{
    public class TwitchBotService
    {
        private readonly TwitchClient _client;
        private readonly ILogger<TwitchBotService> _logger;
        private readonly IConfiguration _configuration;
        private readonly TwitchSettings _twitchSettings;
        private readonly IServiceProvider _serviceProvider;
        private readonly IMessageSender _messageSender;
        private readonly TwitchApiService _apiService;
        private readonly CommandService _commandService;

        private bool _isRunning = false;
        private DateTime _lastReconnectAttempt = DateTime.MinValue;
        private int _reconnectAttempts = 0;
        private const int MAX_RECONNECT_ATTEMPTS = 3;
        private const int RECONNECT_DELAY_MINUTES = 10;

        public TwitchBotService(
            TwitchClient client,
            ILogger<TwitchBotService> logger,
            IConfiguration configuration,
            IOptions<TwitchSettings> twitchSettings,
            IServiceProvider serviceProvider,
            IMessageSender messageSender,
            TwitchApiService apiService,
            CommandService commandService)
        {
            _client = client;
            _logger = logger;
            _configuration = configuration;
            _twitchSettings = twitchSettings.Value;
            _serviceProvider = serviceProvider;
            _messageSender = messageSender;
            _apiService = apiService;
            _commandService = commandService;

            ValidateSettings();
        }

        private void ValidateSettings()
        {
            if (string.IsNullOrEmpty(_twitchSettings.BotUsername))
                throw new InvalidOperationException("Bot username is missing in TwitchSettings");
           
        }

        private async Task<string> GetBotTokenFromDb()
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var botTokenRepo = scope.ServiceProvider.GetRequiredService<IBotTokenRepository>();

                var botToken = await botTokenRepo.GetByBotUsernameAsync(_twitchSettings.BotUsername);
                if (botToken != null && !string.IsNullOrEmpty(botToken.ChatToken))
                {
                    var token = botToken.ChatToken;
                    _logger.LogInformation($"Token del bot obtenido desde BD: {token.Substring(0, Math.Min(10, token.Length))}...");
                    return token.StartsWith("oauth:") ? token : "oauth:" + token;
                }

                throw new InvalidOperationException("No se encontró token para el bot en la base de datos");
            }
            catch (Exception ex) when (ex is not InvalidOperationException)
            {
                _logger.LogError(ex, "Error obteniendo token de BD");
                throw new InvalidOperationException("Token del bot no disponible", ex);
            }
        }

        private async Task InitializeClientAsync()
        {
            try
            {
                var botToken = await GetBotTokenFromDb();
                var credentials = new ConnectionCredentials(_twitchSettings.BotUsername, botToken);
                _client.Initialize(credentials);

                _client.OnMessageReceived += Client_OnMessageReceived;
                _client.OnConnected += Client_OnConnected;
                _client.OnDisconnected += Client_OnDisconnected;
                _client.OnJoinedChannel += Client_OnJoinedChannel;
                _client.OnConnectionError += Client_OnConnectionError;

                _logger.LogInformation($"TwitchBotService inicializado - Bot: {_twitchSettings.BotUsername}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error inicializando TwitchClient");
                throw;
            }
        }

        public async Task Start()
        {
            if (_isRunning)
            {
                _logger.LogWarning("TwitchBotService ya está en ejecución");
                return;
            }

            _isRunning = true;
            _logger.LogInformation("Iniciando TwitchBotService...");

            try
            {
                // IMPORTANTE: Refrescar tokens ANTES de conectar
                await RefreshAllTokensOnStartup();

                await InitializeClientAsync();

                if (!_client.IsConnected)
                {
                    _client.Connect();
                    await WaitForConnection();
                }

                await ConnectToEnabledChannels();
                _logger.LogInformation("TwitchBotService iniciado correctamente");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error iniciando TwitchBotService");
                _isRunning = false;
                throw;
            }
        }

        /// <summary>
        /// Refresca todos los tokens del bot y usuarios al iniciar la aplicación
        /// </summary>
        private async Task RefreshAllTokensOnStartup()
        {
            _logger.LogInformation("====================================================");
            _logger.LogInformation("🔄 INICIANDO REFRESH DE TOKENS AL ARRANCAR");
            _logger.LogInformation("====================================================");

            try
            {
                using (var scope = _serviceProvider.CreateScope())
                {
                    // ============ REFRESCAR TOKENS DEL BOT ============
                    try
                    {
                        _logger.LogInformation("📦 Obteniendo servicio de refresh de tokens del bot...");
                        var botTokenService = scope.ServiceProvider.GetRequiredService<IBotTokenRefreshService>();
                        var botTokenRepo = scope.ServiceProvider.GetRequiredService<IBotTokenRepository>();

                        _logger.LogInformation("🔍 Buscando tokens del bot activos...");
                        var botTokens = await botTokenRepo.GetAllActiveAsync();
                        _logger.LogInformation($"📊 Encontrados {botTokens.Count} token(s) del bot activos");

                        foreach (var botToken in botTokens)
                        {
                            try
                            {
                                _logger.LogInformation($"🔄 Refrescando token para bot: {botToken.BotUsername}");
                                _logger.LogInformation($"   Token actual expira: {botToken.TokenExpiration}");

                                await botTokenService.RefreshBotTokenAsync(botToken);

                                _logger.LogInformation($"✅ Token del bot {botToken.BotUsername} refrescado exitosamente");
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, $"❌ ERROR refrescando token del bot {botToken.BotUsername}");
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "❌ ERROR CRÍTICO en refresh de tokens del bot");
                    }

                    // ============ REFRESCAR TOKENS DE USUARIOS ============
                    try
                    {
                        _logger.LogInformation("📦 Obteniendo servicio de refresh de tokens de usuarios...");
                        var userTokenService = scope.ServiceProvider.GetRequiredService<IUserTokenRefreshService>();
                        var userRepo = scope.ServiceProvider.GetRequiredService<IUserRepository>();

                        _logger.LogInformation("🔍 Buscando usuarios activos...");
                        var users = await userRepo.GetAllActiveAsync();
                        _logger.LogInformation($"📊 Encontrados {users.Count} usuario(s) activos");

                        int refreshedCount = 0;
                        int skippedCount = 0;

                        foreach (var user in users)
                        {
                            if (!string.IsNullOrEmpty(user.RefreshToken))
                            {
                                try
                                {
                                    _logger.LogInformation($"🔄 Refrescando token para usuario: {user.Login}");
                                    _logger.LogInformation($"   Token actual expira: {user.TokenExpiration}");

                                    await userTokenService.RefreshUserTokenAsync(user);
                                    refreshedCount++;

                                    _logger.LogInformation($"✅ Token del usuario {user.Login} refrescado exitosamente");
                                }
                                catch (Exception ex)
                                {
                                    _logger.LogError(ex, $"❌ ERROR refrescando token del usuario {user.Login}");
                                }
                            }
                            else
                            {
                                _logger.LogWarning($"⚠️ Usuario {user.Login} no tiene refresh_token, saltando...");
                                skippedCount++;
                            }
                        }

                        _logger.LogInformation($"📊 Resumen usuarios: {refreshedCount} refrescados, {skippedCount} saltados");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "❌ ERROR CRÍTICO en refresh de tokens de usuarios");
                    }
                }

                _logger.LogInformation("====================================================");
                _logger.LogInformation("✅ PROCESO DE REFRESH COMPLETADO");
                _logger.LogInformation("====================================================");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ ERROR CRÍTICO GENERAL en refresh de tokens al iniciar");
                _logger.LogError("⚠️ El bot intentará arrancar de todos modos...");
            }
        }

        private async Task WaitForConnection()
        {
            int attempts = 0;
            while (!_client.IsConnected && attempts < 10)
            {
                await Task.Delay(1000);
                attempts++;
            }

            if (!_client.IsConnected)
                throw new Exception("No se pudo conectar al cliente de Twitch después de varios intentos");

            _logger.LogInformation("Cliente Twitch conectado exitosamente");
        }

        /// <summary>
        /// Conecta a todos los canales que tienen el bot habilitado (Users.IsActive = true Y SystemSettings.BotEnabled = true)
        /// </summary>
        private async Task ConnectToEnabledChannels()
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var settingsService = scope.ServiceProvider.GetRequiredService<ISettingsService>();

                var enabledChannels = await settingsService.GetEnabledBotChannelsAsync();

                _logger.LogInformation($"Conectando a {enabledChannels.Count} canales desde configuración de settings");

                foreach (var channelName in enabledChannels)
                {
                    if (!_client.JoinedChannels.Any(c => c.Channel.Equals(channelName, StringComparison.OrdinalIgnoreCase)))
                    {
                        _client.JoinChannel(channelName);
                        _logger.LogInformation($"Conectado al canal: {channelName}");

                        await Task.Delay(100);
                    }
                    else
                    {
                        _logger.LogDebug($"Ya conectado al canal: {channelName}");
                    }
                }

                _logger.LogInformation($"Bot conectado a {_client.JoinedChannels.Count} canales habilitados");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error conectando a canales habilitados, intentando canal por defecto");

                try
                {
                    var defaultChannel = _twitchSettings.ChannelId;
                    if (!string.IsNullOrEmpty(defaultChannel))
                    {
                        _client.JoinChannel(defaultChannel);
                        _logger.LogInformation($"Conectado al canal por defecto: {defaultChannel}");
                    }
                }
                catch (Exception fallbackEx)
                {
                    _logger.LogError(fallbackEx, "Error conectando al canal por defecto");
                }
            }
        }

        private void Client_OnConnected(object sender, OnConnectedArgs e)
        {
            _logger.LogInformation("IRC conectado exitosamente");
            _reconnectAttempts = 0;
        }

        private void Client_OnDisconnected(object sender, OnDisconnectedEventArgs e)
        {
            var timeSinceLastAttempt = DateTime.Now - _lastReconnectAttempt;

            if (_reconnectAttempts < MAX_RECONNECT_ATTEMPTS &&
                timeSinceLastAttempt.TotalMinutes >= RECONNECT_DELAY_MINUTES)
            {
                _lastReconnectAttempt = DateTime.Now;
                _reconnectAttempts++;

                _logger.LogWarning($"IRC disconnected. Intento {_reconnectAttempts}/{MAX_RECONNECT_ATTEMPTS}");

                Task.Run(async () =>
                {
                    await Task.Delay(5000);
                    try
                    {
                        _client.Connect();
                        // Reconectar a canales habilitados después de reconectar IRC
                        await Task.Delay(2000);
                        await ConnectToEnabledChannels();
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error reconectando IRC");
                    }
                });
            }
        }

        private void Client_OnJoinedChannel(object sender, OnJoinedChannelArgs e)
        {
            _logger.LogInformation($"Bot unido al canal: {e.Channel}");
        }

        private void Client_OnConnectionError(object sender, OnConnectionErrorArgs e)
        {
            _logger.LogError($"Error de conexión IRC: {e.Error.Message}");
        }

        private void Client_OnMessageReceived(object sender, OnMessageReceivedArgs e)
        {
            try
            {
                var message = e.ChatMessage.Message.Trim();
                var username = e.ChatMessage.Username;
                var channel = e.ChatMessage.Channel;
                var userId = e.ChatMessage.UserId;
                var roomId = e.ChatMessage.RoomId; // ID del chat real (para validar shared chat)
                var messageId = e.ChatMessage.Id; // ID del mensaje para borrado
                var timestamp = DateTime.UtcNow;

                // Obtener badges del usuario desde TwitchLib
                var isModerator = e.ChatMessage.IsModerator;
                var isVip = e.ChatMessage.IsVip;
                var isSubscriber = e.ChatMessage.IsSubscriber;
                var isBroadcaster = e.ChatMessage.IsBroadcaster;

                // FILTRO CRÍTICO: Ignorar mensajes del propio bot para evitar loops infinitos
                if (username.Equals(_twitchSettings.BotUsername, StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogDebug($"⏭️ Ignorando mensaje del propio bot en [{channel}]");
                    return;
                }

                // Verificar si el bot está habilitado para este canal antes de procesar
                _ = Task.Run(async () =>
                {
                    try
                    {
                        using var scope = _serviceProvider.CreateScope();
                        var settingsService = scope.ServiceProvider.GetRequiredService<ISettingsService>();

                        var isBotEnabled = await settingsService.IsBotEnabledForChannelAsync(channel);
                        if (!isBotEnabled)
                        {
                            _logger.LogDebug($"⏭️ Bot deshabilitado para canal [{channel}], ignorando mensaje");
                            return;
                        }

                        var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                        // VALIDACIÓN DE SHARED CHAT: Verificar que el mensaje sea del chat real de este canal
                        var channelUser = await dbContext.Users
                            .Where(u => u.Login == channel.ToLower())
                            .Select(u => u.TwitchId)
                            .FirstOrDefaultAsync();

                        if (channelUser == null)
                        {
                            _logger.LogWarning($"⚠️ Canal [{channel}] no encontrado en BD, ignorando mensaje");
                            return;
                        }

                        // Comparar RoomId con el TwitchId del canal
                        if (roomId != channelUser)
                        {
                            _logger.LogDebug($"⏭️ [SHARED CHAT] Mensaje de canal compartido ignorado. " +
                                            $"Canal=[{channel}] RoomId={roomId} ChannelId={channelUser}");
                            return;
                        }

                        // ✅ Mensaje válido - Log informativo
                        _logger.LogInformation($"📩 [IRC] [{channel}] {username}: {message}");

                        // Guardar mensaje en BD (para logs históricos)
                        var chatMessage = new ChatMessage
                        {
                            Channel = channel,
                            Username = username,
                            UserId = userId,
                            Message = message,
                            Timestamp = timestamp
                        };

                        dbContext.ChatMessages.Add(chatMessage);
                        await dbContext.SaveChangesAsync();

                        // Incrementar contadores de timers
                        var timerService = scope.ServiceProvider.GetService<ITimerService>();
                        if (timerService != null)
                        {
                            await timerService.IncrementMessageCountersAsync(channel);
                        }

                        // Track user presence for watchtime (marca al usuario como activo)
                        var watchTimeService = scope.ServiceProvider.GetService<IWatchTimeTrackingService>();
                        if (watchTimeService != null)
                        {
                            await watchTimeService.TrackUserPresence(channelUser, userId, username);
                        }

                        // Track chat activity (incrementa contador de mensajes)
                        var chatActivityService = scope.ServiceProvider.GetService<IChatActivityService>();
                        if (chatActivityService != null)
                        {
                            await chatActivityService.TrackMessage(channelUser, userId, username);
                        }

                        // NOTA: IRC solo registra logs. EventSub procesa comandos.
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "❌ Error procesando mensaje");
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error procesando mensaje");
            }
        }

        public async Task SendMessage(string channel, string message)
        {
            // Verificar si el bot está habilitado para este canal antes de enviar mensaje
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var settingsService = scope.ServiceProvider.GetRequiredService<ISettingsService>();

                var isBotEnabled = await settingsService.IsBotEnabledForChannelAsync(channel);
                if (!isBotEnabled)
                {
                    _logger.LogDebug($"Bot deshabilitado para canal {channel}, no enviando mensaje");
                    return;
                }

                await _messageSender.SendMessageAsync(channel, message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando estado del bot para canal {channel}");
                // En caso de error, enviar el mensaje de todas formas para no romper funcionalidad
                await _messageSender.SendMessageAsync(channel, message);
            }
        }

        public bool IsConnected => _client.IsConnected;

        public List<string> GetConnectedChannels()
        {
            return _client.JoinedChannels.Select(c => c.Channel).ToList();
        }

        public void JoinChannel(string channel)
        {
            if (_client.IsConnected)
            {
                _client.JoinChannel(channel);
                _logger.LogInformation($"Unido al canal: {channel}");
            }
            else
            {
                _logger.LogWarning($"Cliente no conectado, no se puede unir al canal: {channel}");
            }
        }

        /// <summary>
        /// Procesa mensajes recibidos desde EventSub (canal bot con App Access Token)
        /// </summary>
        public async Task ProcessMessageFromEventSubAsync(
            string messageId,
            string channel,
            string username,
            string userId,
            string roomId,
            string message,
            bool isModerator = false,
            bool isVip = false,
            bool isSubscriber = false,
            bool isBroadcaster = false,
            Dictionary<string, object>? metadata = null)
        {
            try
            {
                var timestamp = DateTime.UtcNow;

                // FILTRO CRÍTICO: Ignorar mensajes del propio bot para evitar loops infinitos
                if (username.Equals(_twitchSettings.BotUsername, StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogDebug($"⏭️ [EventSub] Ignorando mensaje del propio bot en [{channel}]");
                    return;
                }

                using var scope = _serviceProvider.CreateScope();
                var settingsService = scope.ServiceProvider.GetRequiredService<ISettingsService>();

                var isBotEnabled = await settingsService.IsBotEnabledForChannelAsync(channel);
                if (!isBotEnabled)
                {
                    _logger.LogDebug($"⏭️ [EventSub] Bot deshabilitado para canal [{channel}], ignorando mensaje");
                    return;
                }

                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                // VALIDACIÓN DE SHARED CHAT: Verificar que el mensaje sea del chat real de este canal
                var channelUser = await dbContext.Users
                    .Where(u => u.Login == channel.ToLower())
                    .Select(u => u.TwitchId)
                    .FirstOrDefaultAsync();

                if (channelUser == null)
                {
                    _logger.LogWarning($"⚠️ [EventSub] Canal [{channel}] no encontrado en BD, ignorando mensaje");
                    return;
                }

                // Comparar RoomId con el TwitchId del canal
                if (roomId != channelUser)
                {
                    _logger.LogDebug($"⏭️ [EventSub][SHARED CHAT] Mensaje de canal compartido ignorado. " +
                                    $"Canal=[{channel}] RoomId={roomId} ChannelId={channelUser}");
                    return;
                }

                // NOTA: IRC ya guardó el mensaje en BD (para logs), no duplicar

                // Log indicando procesamiento desde EventSub
                _logger.LogInformation($"📩 [EventSub] [{channel}] {username}: {message}");

                // Procesar comandos usando CommandService
                await _commandService.ProcessMessageAsync(username, channel, message, userId, messageId,
                    isModerator, isVip, isSubscriber, isBroadcaster, metadata);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ [EventSub] Error procesando mensaje");
            }
        }

        public void LeaveChannel(string channel)
        {
            if (_client.JoinedChannels.Any(c => c.Channel.Equals(channel, StringComparison.OrdinalIgnoreCase)))
            {
                _client.LeaveChannel(channel);
                _logger.LogInformation($"Salido del canal: {channel}");
            }
            else
            {
                _logger.LogDebug($"Bot no estaba conectado al canal: {channel}");
            }
        }

        /// <summary>
        /// Refresca las conexiones de canales según la configuración actual.
        /// Desconecta de canales deshabilitados y conecta a canales habilitados.
        /// </summary>
        public async Task RefreshChannelConnectionsAsync()
        {
            if (!_isRunning || !_client.IsConnected)
            {
                _logger.LogWarning("No se puede refrescar conexiones: bot no está corriendo o conectado");
                return;
            }

            try
            {
                using var scope = _serviceProvider.CreateScope();
                var settingsService = scope.ServiceProvider.GetRequiredService<ISettingsService>();

                var enabledChannels = await settingsService.GetEnabledBotChannelsAsync();
                _logger.LogInformation($"🔄 Refrescando conexiones de canales. {enabledChannels.Count} canales habilitados");

                // Obtener lista de canales actualmente conectados
                var currentChannels = _client.JoinedChannels.Select(c => c.Channel.ToLower()).ToList();

                // Desconectar de canales que ya no están habilitados
                foreach (var currentChannel in currentChannels)
                {
                    if (!enabledChannels.Any(e => e.Equals(currentChannel, StringComparison.OrdinalIgnoreCase)))
                    {
                        _client.LeaveChannel(currentChannel);
                        _logger.LogInformation($"❌ Desconectado del canal: {currentChannel} (bot deshabilitado)");
                        await Task.Delay(100);
                    }
                }

                // Conectar a canales nuevos que están habilitados
                foreach (var channelName in enabledChannels)
                {
                    if (!_client.JoinedChannels.Any(c => c.Channel.Equals(channelName, StringComparison.OrdinalIgnoreCase)))
                    {
                        _client.JoinChannel(channelName);
                        _logger.LogInformation($"✅ Conectado al canal: {channelName} (bot habilitado)");
                        await Task.Delay(100);
                    }
                }

                _logger.LogInformation($"✅ Refresh completado. Bot conectado a {_client.JoinedChannels.Count} canales");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error refrescando conexiones de canales");
            }
        }

        public void Stop()
        {
            _isRunning = false;
            if (_client.IsConnected)
            {
                _client.Disconnect();
                _logger.LogInformation("TwitchBotService detenido");
            }
        }
    }
}