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
    /// <summary>
    /// Comando para cambiar o consultar el título del stream
    /// Uso: !title [nuevo título] o !t [nuevo título] 
    /// También funciona: title [nuevo título] o t [nuevo título] (sin !)
    /// </summary>
    public class TitleCommand : ICommand
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<TitleCommand> _logger;
        private readonly ICommandStateService _commandStateService;
        private readonly ICommandMessagesService _messagesService;
        private readonly IServiceScopeFactory _serviceScopeFactory;

        public string Name => "!title";
        public string Description => "Cambia o consulta el título del stream";

        public TitleCommand(
            IConfiguration configuration,
            ILogger<TitleCommand> logger,
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
                // NOTA: La verificación de bot habilitado ya se hace en TwitchBotService ANTES de llamar a este comando
                // No es necesario verificarlo aquí de nuevo (causa problemas de estado)

                // Verificar si el comando específico está habilitado para este canal
                var isCommandEnabled = await IsCommandEnabledForChannel(channel);
                if (!isCommandEnabled)
                {
                    _logger.LogDebug($"Comando !title deshabilitado para el canal {channel}");
                    return; // Comando deshabilitado, no responder
                }

                // Parsear argumentos del comando (sin el prefijo !)
                var messageWithoutPrefix = message.StartsWith("!") ? message.Substring(1) : message;
                var newTitle = Utils.ParseCommandArgumentsAsString(messageWithoutPrefix);

                // Obtener idioma del canal
                var channelLang = await GetChannelLanguageAsync(channel);

                // Obtener información del usuario/canal
                var userInfo = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channel);
                if (userInfo == null)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("title", "error_channel_info", channelLang));
                    return;
                }

                // Si no hay nuevo título, mostrar el actual
                if (string.IsNullOrEmpty(newTitle))
                {
                    var currentTitle = await TitleUtils.GetCurrentTitleAsync(_configuration, userInfo.TwitchId, userInfo.AccessToken);
                    if (!string.IsNullOrEmpty(currentTitle))
                    {
                        await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("title", "current_title", channelLang, currentTitle));
                    }
                    else
                    {
                        await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("title", "error_get_title", channelLang));
                    }
                    return;
                }

                // Verificar permisos para cambiar título
                // 1. PRIORIDAD MÁXIMA: Badges de Twitch (Contexto)
                // Esto es lo más rápido y seguro. Si Twitch dice que es mod, es mod.
                bool hasPermission = context.IsBroadcaster || context.IsModerator;

                if (hasPermission)
                {
                    _logger.LogDebug($"[TitleCommand] {username} autorizado por badges (Mod/Broadcaster)");
                }

                // 2. RESPALDO INTERNO: Permisos del Bot (Base de Datos)
                // Si la detección de badges falla, verificamos si el usuario tiene permiso explícito en el bot.
                if (!hasPermission && _serviceScopeFactory != null)
                {
                    using (var scope = _serviceScopeFactory.CreateScope())
                    {
                        var permissionService = scope.ServiceProvider.GetService<IPermissionService>();
                        if (permissionService != null)
                        {
                            // Necesitamos el UserId numérico (DB ID) del usuario que ejecuta el comando.
                            // Nota: Esto solo funciona si el usuario moderador se ha registrado en el dashboard alguna vez.
                            var commandUser = await Utils.GetUserInfoFromDatabaseAsync(_configuration, username);
                            if (commandUser != null)
                            {
                                 // "commands" es el nivel base, "moderation" es para mods.
                                 hasPermission = await permissionService.HasPermissionLevelAsync(commandUser.Id, userInfo.Id, "moderation");
                                 if (hasPermission) _logger.LogInformation($"[TitleCommand] {username} autorizado por permisos internos del bot");
                            }
                        }
                    }
                }

                // 3. RESPALDO FINAL: API de Twitch (Lento y propenso a fallar por tokens)
                // Solo si todo lo anterior falla.
                if (!hasPermission)
                {
                    _logger.LogDebug($"[TitleCommand] {username} no tiene badge ni permiso interno, verificando via API...");
                    hasPermission = await TitleUtils.HasPermissionToChangeTitleAsync(_configuration, username, channel, _logger);
                }

                if (!hasPermission)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("title", "permission_denied", channelLang));
                    return;
                }

                // Validar el nuevo título
                var (isValid, errorMessage) = TitleUtils.ValidateTitle(newTitle);
                if (!isValid)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("title", "error_validation", channelLang, errorMessage));
                    return;
                }

                // Actualizar el título
                var success = await TitleUtils.UpdateTitleAsync(_configuration, userInfo.TwitchId, newTitle, userInfo.AccessToken);
                if (success)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("title", "success", channelLang, newTitle));

                    // Guardar en historial (opcional)
                    await TitleUtils.SaveTitleToHistoryAsync(_configuration, channel, newTitle, username);

                    _logger.LogInformation($"Título cambiado por {username} en {channel}: {newTitle}");
                }
                else
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("title", "error_change", channelLang));
                    _logger.LogWarning($"Error al cambiar título en {channel} por {username}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error en comando title para {channel}");
                var channelLang = await GetChannelLanguageAsync(channel);
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("title", "error_generic", channelLang));
            }
        }

        private async Task<string> GetChannelLanguageAsync(string channelLogin)
        {
            try
            {
                var channelUser = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channelLogin);
                if (channelUser == null)
                {
                    _logger.LogWarning($"[TitleCommand] No se pudo obtener info del canal: {channelLogin}");
                    return "es";
                }

                var language = channelUser.PreferredLanguage ?? "es";
                return language;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[TitleCommand] Error obteniendo idioma del canal: {channelLogin}");
                return "es";
            }
        }

        /// <summary>
        /// Verifica si el comando title está habilitado para un canal específico
        /// </summary>
        private async Task<bool> IsCommandEnabledForChannel(string channelLogin)
        {
            try
            {
                // Obtener el UserId del canal
                var userInfo = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channelLogin);
                if (userInfo == null)
                {
                    // Si no se encuentra el usuario, asumir que está habilitado por defecto
                    return true;
                }

                // Usar el servicio para verificar el estado del comando
                return await _commandStateService.IsCommandEnabledAsync(userInfo.Id, "title");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando si comando está habilitado para {channelLogin}");
                // En caso de error, asumir que está habilitado para no bloquear funcionamiento
                return true;
            }
        }
    }
}