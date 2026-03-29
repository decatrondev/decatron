using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Core.Helpers;
using Decatron.Default.Helpers;
using Decatron.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;

namespace Decatron.Default.Commands
{
    public class GameCommand : ICommand
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<GameCommand> _logger;
        private readonly ICommandStateService _commandStateService;
        private readonly ICommandMessagesService _messagesService;
        private readonly IServiceScopeFactory _serviceScopeFactory;

        public string Name => "!game";
        public string Description => "Cambia o consulta la categoría/juego del stream";

        public GameCommand(
            IConfiguration configuration,
            ILogger<GameCommand> logger,
            ICommandStateService commandStateService,
            ICommandMessagesService messagesService,
            IServiceScopeFactory serviceScopeFactory = null)
        {
            _configuration = configuration;
            _logger = logger;
            _commandStateService = commandStateService;
            _messagesService = messagesService;
            _serviceScopeFactory = serviceScopeFactory;
        }

        public async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            var username = context.Username;
            var channel = context.Channel;
            var message = context.Message;
            try
            {
                _logger.LogInformation($"[GameCommand] 1️⃣ Iniciando comando !game por {username} en {channel}");

                // NOTA: La verificación de bot habilitado ya se hace en TwitchBotService ANTES de llamar a este comando
                // No es necesario verificarlo aquí de nuevo (causa problemas de estado)

                var isCommandEnabled = await IsCommandEnabledForChannel(channel);
                _logger.LogInformation($"[GameCommand] 2️⃣ Comando habilitado para canal {channel}: {isCommandEnabled}");
                if (!isCommandEnabled)
                {
                    _logger.LogWarning($"[GameCommand] ❌ Comando !game deshabilitado para el canal {channel}");
                    return;
                }

                var messageWithoutPrefix = message.StartsWith("!") ? message.Substring(1) : message;
                var newCategory = Utils.ParseCommandArgumentsAsString(messageWithoutPrefix);
                _logger.LogInformation($"[GameCommand] 3️⃣ Categoría solicitada: '{newCategory}' (vacío={string.IsNullOrEmpty(newCategory)})");

                // Obtener idioma del DUEÑO DEL CANAL (no del usuario que ejecuta el comando)
                var userLang = await GetChannelLanguageAsync(channel);
                _logger.LogInformation($"[GameCommand] 🌐 Idioma del canal {channel}: '{userLang}'");

                var userInfo = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channel);
                if (userInfo == null)
                {
                    _logger.LogError($"[GameCommand] ❌ No se pudo obtener información del canal {channel}");
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("game", "error_channel_info", userLang));
                    return;
                }
                _logger.LogInformation($"[GameCommand] 4️⃣ UserInfo obtenido: ID={userInfo.Id}, TwitchId={userInfo.TwitchId}");

                if (string.IsNullOrEmpty(newCategory))
                {
                    _logger.LogInformation($"[GameCommand] 5️⃣ Consultando categoría actual (sin argumentos)");
                    var currentCategory = await GameUtils.GetCurrentCategoryAsync(_configuration, userInfo.TwitchId, userInfo.AccessToken);
                    _logger.LogInformation($"[GameCommand] 6️⃣ Categoría obtenida: '{currentCategory}'");
                    if (!string.IsNullOrEmpty(currentCategory))
                    {
                        _logger.LogInformation($"[GameCommand] ✅ Enviando respuesta: Categoría actual: {currentCategory}");
                        await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("game", "current_category", userLang, currentCategory));
                    }
                    else
                    {
                        _logger.LogWarning($"[GameCommand] ⚠️ No se pudo obtener categoría actual");
                        await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("game", "error_get_category", userLang));
                    }
                    return;
                }

                // Verificar permisos para cambiar categoría
                // 1. PRIORIDAD MÁXIMA: Badges de Twitch (Contexto)
                bool hasPermission = context.IsBroadcaster || context.IsModerator;
                
                if (hasPermission)
                {
                    _logger.LogDebug($"[GameCommand] {username} autorizado por badges (Mod/Broadcaster)");
                }

                // 2. RESPALDO INTERNO: Permisos del Bot (Base de Datos)
                if (!hasPermission && _serviceScopeFactory != null)
                {
                    using (var scope = _serviceScopeFactory.CreateScope())
                    {
                        var permissionService = scope.ServiceProvider.GetService<IPermissionService>();
                        if (permissionService != null)
                        {
                            var commandUser = await Utils.GetUserInfoFromDatabaseAsync(_configuration, username);
                            if (commandUser != null)
                            {
                                 hasPermission = await permissionService.HasPermissionLevelAsync(commandUser.Id, userInfo.Id, "moderation");
                                 if (hasPermission) _logger.LogInformation($"[GameCommand] {username} autorizado por permisos internos del bot");
                            }
                        }
                    }
                }

                // 3. RESPALDO FINAL: API de Twitch (Lento y propenso a fallar)
                if (!hasPermission)
                {
                     hasPermission = await GameUtils.HasPermissionToChangeCategoryAsync(_configuration, username, channel, _logger);
                }

                if (!hasPermission)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("game", "permission_denied", userLang));
                    return;
                }

                var validationResult = GameUtils.ValidateCategory(newCategory);
                if (!validationResult.isValid)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("game", "error_validation", userLang, validationResult.errorMessage));
                    return;
                }

                var realCategoryName = await GameUtils.UpdateCategoryAsync(_configuration, userInfo.TwitchId, newCategory, userInfo.AccessToken, _logger);
                if (realCategoryName != null)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("game", "success", userLang, realCategoryName));
                    await GameUtils.SaveCategoryToHistoryAsync(_configuration, channel, realCategoryName, username);
                    _logger.LogInformation($"Categoría cambiada por {username} en {channel}: {realCategoryName}");
                }
                else
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("game", "error_change", userLang));
                    _logger.LogWarning($"Error al cambiar categoría en {channel} por {username}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error en comando game para {channel}");
                var userLang = await GetChannelLanguageAsync(channel);
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("game", "error_generic", userLang));
            }
        }

        private async Task<string> GetChannelLanguageAsync(string channelLogin)
        {
            try
            {
                // Obtener información del canal (dueño) incluyendo idioma
                var channelUser = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channelLogin);
                if (channelUser == null)
                {
                    _logger.LogWarning($"[GameCommand] No se pudo obtener info del canal: {channelLogin}");
                    return "es"; // Default to Spanish
                }

                // El modelo User ya tiene PreferredLanguage
                var language = channelUser.PreferredLanguage ?? "es";
                _logger.LogInformation($"[GameCommand] Idioma del canal {channelLogin}: '{language}'");
                return language;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[GameCommand] Error obteniendo idioma del canal: {channelLogin}");
                return "es";
            }
        }

        private async Task<bool> IsCommandEnabledForChannel(string channelLogin)
        {
            try
            {
                var userInfo = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channelLogin);
                if (userInfo == null)
                {
                    return true;
                }

                return await _commandStateService.IsCommandEnabledAsync(userInfo.Id, "game");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando si comando está habilitado para {channelLogin}");
                return true;
            }
        }
    }
}