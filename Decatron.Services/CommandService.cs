using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Decatron.Core.Functions;
using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Core.Resolvers;
using Decatron.Data;
using Decatron.Default.Commands;
using Decatron.Default.Helpers;
using Decatron.Scripting.Services;
using Decatron.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    public class CommandService
    {
        private static int _instanceCount = 0;
        private readonly int _instanceId;
        private readonly ILogger<CommandService> _logger;
        private readonly IMessageSender _messageSender;
        private readonly IConfiguration _configuration;
        private readonly ILoggerFactory _loggerFactory;
        private readonly ICommandStateService _commandStateService;
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly Dictionary<string, ICommand> _commands;
        private readonly Dictionary<string, Dictionary<string, string>> _microCommandsCache;

        public CommandService(
            ILogger<CommandService> logger,
            IMessageSender messageSender,
            IConfiguration configuration,
            ILoggerFactory loggerFactory,
            ICommandStateService commandStateService,
            IServiceScopeFactory serviceScopeFactory)
        {
            _instanceId = ++_instanceCount;
            _logger = logger;
            _messageSender = messageSender;
            _configuration = configuration;
            _loggerFactory = loggerFactory;
            _commandStateService = commandStateService;
            _serviceScopeFactory = serviceScopeFactory;
            _commands = new Dictionary<string, ICommand>();
            _microCommandsCache = new Dictionary<string, Dictionary<string, string>>();

            _logger.LogWarning($"🏗️ [CommandService#{_instanceId}] Constructor llamado. Instancias totales: {_instanceCount}");
            LoadCommands();
        }

        private void LoadCommands()
        {
            // Comandos básicos
            // Comandos con servicios de traducción
            using (var scope = _serviceScopeFactory.CreateScope())
            {
                var messagesService = scope.ServiceProvider.GetRequiredService<ICommandMessagesService>();

                // Comandos básicos
                RegisterCommand(new Commands.HolaCommand(_configuration, messagesService));

                // Comandos por defecto
                RegisterCommand(new TitleCommand(_configuration, _loggerFactory.CreateLogger<TitleCommand>(), _commandStateService, messagesService));
                RegisterCommand(new TCommand(_configuration, _loggerFactory.CreateLogger<TCommand>(), _commandStateService, messagesService));
                RegisterCommand(new GameCommand(_configuration, _loggerFactory.CreateLogger<GameCommand>(), _commandStateService, messagesService));
            }

            RegisterShoutoutCommand();


            // Registrar DecatronAICommand (necesita resolver dependencias del scope)
            RegisterDecatronAICommand();

            // Registrar comandos del Timer
            RegisterTimerCommands();

            // Registrar comando Followage
            RegisterFollowageCommand();

            // Cargar micro comandos asíncronamente
            _ = Task.Run(LoadMicroCommandsAsync);

            _logger.LogInformation($"Comandos base cargados: {_commands.Count}");
            foreach (var cmd in _commands.Keys)
            {
                _logger.LogDebug($"  - {cmd}");
            }
        }

        private void RegisterShoutoutCommand()
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var serviceProvider = scope.ServiceProvider;
                var twitchApiService = serviceProvider.GetRequiredService<TwitchApiService>();
                var clipDownloadService = serviceProvider.GetRequiredService<ClipDownloadService>();
                var overlayNotificationService = serviceProvider.GetRequiredService<OverlayNotificationService>();
                var messagesService = serviceProvider.GetRequiredService<ICommandMessagesService>();

                // Pasar IServiceProvider en vez de DbContext para que cree su propio scope
                var shoutoutCommand = new ShoutoutCommand(
                    _configuration,
                    _loggerFactory.CreateLogger<ShoutoutCommand>(),
                    _commandStateService,
                    _serviceScopeFactory.CreateScope().ServiceProvider,
                    twitchApiService,
                    clipDownloadService,
                    overlayNotificationService,
                    messagesService
                );

                RegisterCommand(shoutoutCommand);
                _logger.LogInformation("✅ ShoutoutCommand registrado correctamente");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error registrando ShoutoutCommand");
            }
        }

        private void RegisterDecatronAICommand()
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var messagesService = scope.ServiceProvider.GetRequiredService<ICommandMessagesService>();

                // Pasar IServiceScopeFactory para que el comando cree su propio scope en cada ejecución
                var decatronAICommand = new Decatron.Default.Commands.DecatronAICommand(
                    _serviceScopeFactory,
                    _loggerFactory.CreateLogger<Decatron.Default.Commands.DecatronAICommand>(),
                    messagesService
                );

                RegisterCommand(decatronAICommand);
                _logger.LogInformation("✅ DecatronAICommand (!ia) registrado correctamente");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error registrando DecatronAICommand");
            }
        }

        private void RegisterFollowageCommand()
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var httpClientFactory = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>();
                var messagesService = scope.ServiceProvider.GetRequiredService<ICommandMessagesService>();

                var followageCommand = new FollowageCommand(
                    _configuration,
                    _loggerFactory.CreateLogger<FollowageCommand>(),
                    _commandStateService,
                    httpClientFactory,
                    messagesService,
                    _serviceScopeFactory
                );

                RegisterCommand(followageCommand);
                _logger.LogInformation("✅ FollowageCommand (!followage) registrado correctamente");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error registrando FollowageCommand");
            }
        }

        private void RegisterTimerCommands()
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var serviceProvider = scope.ServiceProvider;
                var overlayNotificationService = serviceProvider.GetRequiredService<OverlayNotificationService>();
                var messagesService = serviceProvider.GetRequiredService<ICommandMessagesService>();

                // Registrar DStartCommand
                var dStartCommand = new DStartCommand(
                    _configuration,
                    _loggerFactory.CreateLogger<DStartCommand>(),
                    _commandStateService,
                    _serviceScopeFactory.CreateScope().ServiceProvider,
                    overlayNotificationService,
                    messagesService
                );
                RegisterCommand(dStartCommand);

                // Registrar DPauseCommand
                var dPauseCommand = new DPauseCommand(
                    _configuration,
                    _loggerFactory.CreateLogger<DPauseCommand>(),
                    _commandStateService,
                    _serviceScopeFactory.CreateScope().ServiceProvider,
                    overlayNotificationService,
                    messagesService
                );
                RegisterCommand(dPauseCommand);

                // Registrar DPlayCommand
                var dPlayCommand = new DPlayCommand(
                    _configuration,
                    _loggerFactory.CreateLogger<DPlayCommand>(),
                    _commandStateService,
                    _serviceScopeFactory.CreateScope().ServiceProvider,
                    overlayNotificationService,
                    messagesService
                );
                RegisterCommand(dPlayCommand);

                // Registrar DResetCommand
                var dResetCommand = new DResetCommand(
                    _configuration,
                    _loggerFactory.CreateLogger<DResetCommand>(),
                    _commandStateService,
                    _serviceScopeFactory.CreateScope().ServiceProvider,
                    overlayNotificationService,
                    messagesService
                );
                RegisterCommand(dResetCommand);

                // Registrar DStopCommand
                var dStopCommand = new DStopCommand(
                    _configuration,
                    _loggerFactory.CreateLogger<DStopCommand>(),
                    _commandStateService,
                    _serviceScopeFactory.CreateScope().ServiceProvider,
                    overlayNotificationService,
                    messagesService
                );
                RegisterCommand(dStopCommand);

                // Registrar DTimerCommand
                var dTimerCommand = new DTimerCommand(
                    _configuration,
                    _loggerFactory.CreateLogger<DTimerCommand>(),
                    _commandStateService,
                    _serviceScopeFactory.CreateScope().ServiceProvider,
                    overlayNotificationService,
                    messagesService
                );
                RegisterCommand(dTimerCommand);

                // Registrar DtiempoCommand
                var dTiempoCommand = new DtiempoCommand(
                    _configuration,
                    _loggerFactory.CreateLogger<DtiempoCommand>(),
                    _commandStateService,
                    _serviceScopeFactory.CreateScope().ServiceProvider,
                    overlayNotificationService
                );
                RegisterCommand(dTiempoCommand);

                // Registrar DcuandoCommand
                var dCuandoCommand = new DcuandoCommand(
                    _configuration,
                    _loggerFactory.CreateLogger<DcuandoCommand>(),
                    _commandStateService,
                    _serviceScopeFactory.CreateScope().ServiceProvider,
                    overlayNotificationService
                );
                RegisterCommand(dCuandoCommand);

                // Registrar DstatsCommand
                var dStatsCommand = new DstatsCommand(
                    _configuration,
                    _loggerFactory.CreateLogger<DstatsCommand>(),
                    _commandStateService,
                    _serviceScopeFactory.CreateScope().ServiceProvider,
                    overlayNotificationService,
                    messagesService
                );
                RegisterCommand(dStatsCommand);

                // Registrar DrecordCommand
                var dRecordCommand = new DrecordCommand(
                    _configuration,
                    _loggerFactory.CreateLogger<DrecordCommand>(),
                    _commandStateService,
                    _serviceScopeFactory.CreateScope().ServiceProvider,
                    overlayNotificationService,
                    messagesService
                );
                RegisterCommand(dRecordCommand);

                // Registrar DtopCommand
                var dTopCommand = new DtopCommand(
                    _configuration,
                    _loggerFactory.CreateLogger<DtopCommand>(),
                    _commandStateService,
                    _serviceScopeFactory.CreateScope().ServiceProvider,
                    overlayNotificationService,
                    messagesService
                );
                RegisterCommand(dTopCommand);

                _logger.LogInformation("✅ Comandos del Timer registrados correctamente: !dstart, !dpause, !dplay, !dreset, !dstop, !dtimer, !dtiempo, !dcuando, !dstats, !drecord, !dtop");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error registrando comandos del Timer");
            }

            // Gacha commands
            try
            {
                using var gachaScope = _serviceScopeFactory.CreateScope();
                var gachaMessagesService = gachaScope.ServiceProvider.GetRequiredService<ICommandMessagesService>();
                var gachaCommand = new GachaCommand(
                    _loggerFactory.CreateLogger<GachaCommand>(),
                    _serviceScopeFactory,
                    gachaMessagesService
                );
                RegisterCommand(gachaCommand);
                RegisterCommand(new GcCommand(gachaCommand));
                _logger.LogInformation("✅ Comandos Gacha registrados: !gacha, !gc");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error registrando comandos Gacha");
            }
        }

        private async Task LoadMicroCommandsAsync()
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var microCommands = await dbContext.MicroGameCommands
                    .Select(mc => new { mc.ChannelName, mc.ShortCommand, mc.CategoryName })
                    .ToListAsync();

                foreach (var mc in microCommands)
                {
                    await RegisterMicroCommand(mc.ChannelName, mc.ShortCommand, mc.CategoryName);
                }

                _logger.LogInformation($"Micro comandos cargados: {microCommands.Count}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cargando micro comandos");
            }
        }

        private async Task RegisterMicroCommand(string channelName, string commandName, string categoryName)
        {
            try
            {
                var normalizedCommand = commandName.StartsWith("!") ? commandName.Substring(1) : commandName;

                if (!_microCommandsCache.ContainsKey(channelName))
                {
                    _microCommandsCache[channelName] = new Dictionary<string, string>();
                }
                _microCommandsCache[channelName][normalizedCommand] = categoryName;

                _logger.LogDebug($"Micro comando registrado: {commandName} -> {categoryName} para canal {channelName}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error registrando micro comando {commandName}");
            }
        }

        private void RegisterCommand(ICommand command)
        {
            _commands[command.Name.ToLower()] = command;
        }

        public async Task ProcessMessageAsync(string username, string channel, string chatMessage, string userId = "", string? messageId = null,
            bool isModerator = false, bool isVip = false, bool isSubscriber = false, bool isBroadcaster = false, Dictionary<string, object>? metadata = null)
        {
            try
            {
                _logger.LogWarning($"🎯 [CommandService#{_instanceId}] ProcessMessageAsync llamado: [{channel}] [{username}] {chatMessage}");

                // =====================================================
                // SISTEMA DE MODERACIÓN - Verificar palabras prohibidas
                // Debe ejecutarse ANTES de procesar comandos
                // =====================================================
                await CheckMessageModerationAsync(username, channel, chatMessage, messageId,
                    isModerator, isVip, isSubscriber, isBroadcaster);
                // Si el mensaje fue moderado, CheckMessageModerationAsync ya envió el timeout/ban
                // Continuamos procesando comandos normalmente (el mensaje ya fue registrado)

                var parts = chatMessage.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length == 0)
                    return;

                var commandName = parts[0].ToLower();

                // Log para debug: ver qué comandos están registrados
                if (commandName.StartsWith("!"))
                {
                    _logger.LogDebug($"[Instance#{_instanceId}] Buscando comando '{commandName}'. Comandos registrados: {string.Join(", ", _commands.Keys)}");
                }

                // 1. COMANDOS DEL SERVIDOR (registrados en _commands)
                if (_commands.TryGetValue(commandName, out var command))
                {
                    _logger.LogInformation($"✅ Ejecutando comando del servidor {commandName} por {username} en {channel}");
                    var ctx = new CommandContext(username, channel, chatMessage, userId) { MessageId = messageId, IsModerator = isModerator, IsVip = isVip, IsSubscriber = isSubscriber, IsBroadcaster = isBroadcaster, Metadata = metadata };
                    await command.ExecuteAsync(ctx, _messageSender);
                    return;
                }

                // 1b. GACHA SHORTHAND — !gcpull, !gcpulls, !gccol, etc. → rutear a !gc
                if (commandName.StartsWith("!gc") && commandName != "!gc" && _commands.TryGetValue("!gc", out var gcCommand))
                {
                    _logger.LogInformation($"✅ Ruteando {commandName} a !gc por {username} en {channel}");
                    var ctx = new CommandContext(username, channel, chatMessage, userId) { MessageId = messageId, IsModerator = isModerator, IsVip = isVip, IsSubscriber = isSubscriber, IsBroadcaster = isBroadcaster, Metadata = metadata };
                    await gcCommand.ExecuteAsync(ctx, _messageSender);
                    return;
                }

                if (commandName.StartsWith("!") && !commandName.StartsWith("!gc"))
                {
                    _logger.LogDebug($"❌ Comando '{commandName}' no encontrado en _commands");
                }

                // 2. COMANDOS ESPECIALES del servidor
                if (commandName == "!crear")
                {
                    _logger.LogInformation($"Ejecutando comando !crear por {username} en {channel}");
                    await ProcessCreateCommand(username, channel, chatMessage);
                    return;
                }

                if (commandName == "!g")
                {
                    _logger.LogInformation($"Ejecutando comando !g por {username} en {channel}");
                    await ProcessGCommand(username, channel, chatMessage);
                    return;
                }

                // 3. MICRO COMANDOS (requieren !)
                if (commandName.StartsWith("!"))
                {
                    var baseCommand = commandName.Substring(1);
                    if (_microCommandsCache.ContainsKey(channel) &&
                        _microCommandsCache[channel].ContainsKey(baseCommand))
                    {
                        await ProcessMicroCommand(username, channel, commandName, _microCommandsCache[channel][baseCommand]);
                        return;
                    }
                }

                // 4. COMANDOS CUSTOM del streamer (de la BD)
                await ProcessCustomCommandAsync(username, channel, commandName, chatMessage);

                _logger.LogDebug($"Comando desconocido: {commandName} por {username} en {channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error procesando comando de {username} en {channel}: {chatMessage}");
            }
        }

        public async Task ProcessCustomCommandAsync(string username, string channel, string commandName, string fullMessage)
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var scriptingService = scope.ServiceProvider.GetRequiredService<ScriptingService>();

                // Verificar si es un comando con script
                _logger.LogInformation("[DEBUG] Checking scripted command: channel={Channel}, cmd={Cmd}", channel, commandName);
                var isScripted = await scriptingService.IsScriptedCommandAsync(channel, commandName);
                _logger.LogInformation("[DEBUG] IsScripted result: {Result}", isScripted);
                if (isScripted)
                {
                    _logger.LogInformation("[DEBUG] Executing scripted command {Cmd}", commandName);
                    await ExecuteScriptedCommand(commandName, username, channel, fullMessage, scriptingService);
                    return;
                }

                // Verificar comando normal en la base de datos
                var customCommand = await dbContext.CustomCommands
                    .FirstOrDefaultAsync(c => c.CommandName == commandName && c.ChannelName == channel && c.IsActive);

                if (customCommand != null)
                {
                    await ExecuteNormalCustomCommand(customCommand, username, channel, fullMessage);
                    return;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error procesando comando personalizado {commandName} en {channel}");
            }
        }

        private async Task ExecuteScriptedCommand(string commandName, string username, string channel, string fullMessage, ScriptingService scriptingService)
        {
            try
            {
                var commandArgs = fullMessage.Split(' ').Skip(1).ToArray();
                _logger.LogInformation("[DEBUG-SCRIPT] Calling ExecuteScriptedCommandAsync for {Cmd} in {Channel}", commandName, channel);
                var result = await scriptingService.ExecuteScriptedCommandAsync(channel, commandName, username, commandArgs);
                _logger.LogInformation("[DEBUG-SCRIPT] Result: Success={Success}, Messages={Count}, Error={Error}",
                    result.Success, result.OutputMessages?.Count ?? 0, result.ErrorMessage ?? "none");

                if (result.Success && result.OutputMessages != null && result.OutputMessages.Any())
                {
                    foreach (var message in result.OutputMessages)
                    {
                        if (!string.IsNullOrEmpty(message))
                        {
                            _logger.LogInformation("[DEBUG-SCRIPT] Sending message: {Msg}", message);
                            await _messageSender.SendMessageAsync(channel, message);
                        }
                    }
                }
                else if (!result.Success)
                {
                    _logger.LogWarning("[DEBUG-SCRIPT] Script failed: {Error}", result.ErrorMessage);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error ejecutando comando con script {commandName}");
            }
        }

        private async Task ExecuteNormalCustomCommand(CustomCommand command, string username, string channel, string fullMessage)
        {
            try
            {
                var commandArgs = fullMessage.Split(' ').Skip(1).ToArray();
                var processedResponse = await ProcessCustomFunctions(command.Response, channel, command.CommandName, username, commandArgs);
                await _messageSender.SendMessageAsync(channel, processedResponse);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error ejecutando comando normal {command.CommandName}");
                using var scope = _serviceScopeFactory.CreateScope();
                var messagesService = scope.ServiceProvider.GetRequiredService<ICommandMessagesService>();
                var lang = await GetChannelLanguageAsync(channel);
                await _messageSender.SendMessageAsync(channel, messagesService.GetMessage("command_service", "error_generic", lang));
            }
        }

        private async Task<string> ProcessCustomFunctions(string response, string channelName, string commandName, string username, string[] args)
        {
            if (string.IsNullOrEmpty(response)) return response;

            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var variableResolver = scope.ServiceProvider.GetRequiredService<VariableResolver>();

                var context = new VariableContext(channelName, commandName, username)
                {
                    Args = args
                };

                return await variableResolver.ResolveAsync(response, context);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error procesando funciones personalizadas");
                return response;
            }
        }

        private async Task ProcessGCommand(string username, string channel, string chatMessage)
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var messagesService = scope.ServiceProvider.GetRequiredService<ICommandMessagesService>();

                var gCommand = new GCommand(
                    _configuration,
                    _loggerFactory.CreateLogger<GCommand>(),
                    _commandStateService,
                    messagesService,
                    dbContext);

                var ctx = new CommandContext(username, channel, chatMessage, "");
                await gCommand.ExecuteAsync(ctx, _messageSender);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error procesando comando !g de {username} en {channel}: {chatMessage}");
            }
        }

        private async Task ProcessMicroCommand(string username, string channel, string commandName, string categoryName)
        {
            try
            {
                _logger.LogInformation($"Ejecutando micro comando {commandName} por {username} en {channel}");

                // NOTA: La verificación de bot habilitado ya se hace en TwitchBotService ANTES de llamar a este comando

                var userInfo = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channel);
                if (userInfo == null)
                {
                    using var scopeErr = _serviceScopeFactory.CreateScope();
                    var messagesServiceErr = scopeErr.ServiceProvider.GetRequiredService<ICommandMessagesService>();
                    await _messageSender.SendMessageAsync(channel, messagesServiceErr.GetMessage("micro", "error_channel_info", "es"));
                    return;
                }

                // Obtener idioma del canal
                var userLang = userInfo.PreferredLanguage ?? "es";

                using var scope = _serviceScopeFactory.CreateScope();
                var messagesService = scope.ServiceProvider.GetRequiredService<ICommandMessagesService>();

                var isCommandEnabled = await _commandStateService.IsCommandEnabledAsync(userInfo.Id, "game");
                if (!isCommandEnabled)
                {
                    _logger.LogDebug($"Comando !game (micro comandos) deshabilitado para el canal {channel}");
                    return;
                }

                var hasPermission = await GameUtils.HasPermissionToChangeCategoryAsync(_configuration, username, channel, _logger);
                if (!hasPermission)
                {
                    await _messageSender.SendMessageAsync(channel, messagesService.GetMessage("micro", "permission_denied", userLang, commandName));
                    return;
                }

                var validationResult = GameUtils.ValidateCategory(categoryName);
                if (!validationResult.isValid)
                {
                    await _messageSender.SendMessageAsync(channel, messagesService.GetMessage("micro", "error_validation", userLang, categoryName));
                    return;
                }

                var realCategoryName = await GameUtils.UpdateCategoryAsync(_configuration, userInfo.TwitchId, categoryName, userInfo.AccessToken, _logger);
                if (realCategoryName != null)
                {
                    await _messageSender.SendMessageAsync(channel, messagesService.GetMessage("micro", "success", userLang, realCategoryName, commandName));
                    await GameUtils.SaveCategoryToHistoryAsync(_configuration, channel, realCategoryName, username);
                    _logger.LogInformation($"Categoría cambiada por {username} en {channel} usando micro comando {commandName}: {realCategoryName}");
                }
                else
                {
                    await _messageSender.SendMessageAsync(channel, messagesService.GetMessage("micro", "error_change", userLang, commandName));
                    _logger.LogWarning($"Error al cambiar categoría en {channel} por {username} con micro comando {commandName}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error procesando micro comando {commandName} para {channel}");
                using var scopeEx = _serviceScopeFactory.CreateScope();
                var messagesServiceEx = scopeEx.ServiceProvider.GetRequiredService<ICommandMessagesService>();
                await _messageSender.SendMessageAsync(channel, messagesServiceEx.GetMessage("micro", "error_generic", "es"));
            }
        }

        public async Task RefreshMicroCommandsForChannelAsync(string channelName)
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var microCommands = await dbContext.MicroGameCommands
                    .Where(mc => mc.ChannelName == channelName)
                    .Select(mc => new { mc.ShortCommand, mc.CategoryName })
                    .ToListAsync();

                if (_microCommandsCache.ContainsKey(channelName))
                {
                    _microCommandsCache[channelName].Clear();
                }
                else
                {
                    _microCommandsCache[channelName] = new Dictionary<string, string>();
                }

                foreach (var mc in microCommands)
                {
                    await RegisterMicroCommand(channelName, mc.ShortCommand, mc.CategoryName);
                }

                _logger.LogInformation($"Micro comandos refrescados para canal {channelName}: {microCommands.Count}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error refrescando micro comandos para canal {channelName}");
            }
        }

        private async Task ProcessCreateCommand(string username, string channel, string chatMessage)
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var scriptingService = scope.ServiceProvider.GetRequiredService<ScriptingService>();

                var messagesService = scope.ServiceProvider.GetRequiredService<ICommandMessagesService>();
                var createCommand = new Decatron.Custom.Commands.CreateCommand(dbContext, _configuration, scriptingService, messagesService);
                var ctx = new CommandContext(username, channel, chatMessage, "");
                await createCommand.ExecuteAsync(ctx, _messageSender);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error procesando comando !crear de {username} en {channel}");
                using var errScope = _serviceScopeFactory.CreateScope();
                var messagesService = errScope.ServiceProvider.GetRequiredService<ICommandMessagesService>();
                var lang = await GetChannelLanguageAsync(channel);
                await _messageSender.SendMessageAsync(channel, messagesService.GetMessage("command_service", "error_generic", lang));
            }
        }

        public List<string> GetAvailableCommands()
        {
            var commands = _commands.Keys.ToList();
            commands.Add("!g"); // Agregar !g manualmente
            commands.Add("!crear"); // Agregar !crear manualmente
            return commands;
        }

        public List<string> GetAvailableMicroCommands(string channel)
        {
            if (_microCommandsCache.ContainsKey(channel))
            {
                return _microCommandsCache[channel].Keys.ToList();
            }
            return new List<string>();
        }

        public ICommand GetCommand(string name)
        {
            _commands.TryGetValue(name.ToLower(), out var command);
            return command;
        }

        /// <summary>
        /// Verifica si el mensaje contiene palabras prohibidas y ejecuta acciones de moderación
        /// </summary>
        private async Task CheckMessageModerationAsync(string username, string channel, string message, string? messageId = null,
            bool isModerator = false, bool isVip = false, bool isSubscriber = false, bool isBroadcaster = false)
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var moderationService = scope.ServiceProvider.GetRequiredService<Decatron.Core.Services.ModerationService>();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                // =====================================================
                // PASO 1: VERIFICAR INMUNIDAD PRIMERO
                // Broadcaster, Moderadores y Whitelist tienen inmunidad TOTAL
                // =====================================================

                // Broadcaster siempre tiene inmunidad total
                if (isBroadcaster)
                {
                    _logger.LogDebug($"✅ [MODERACIÓN] Usuario {username} es el broadcaster, inmunidad total - NO verificar palabras");
                    return;
                }

                // Moderadores siempre tienen inmunidad total
                if (isModerator)
                {
                    _logger.LogDebug($"✅ [MODERACIÓN] Usuario {username} es moderador, inmunidad total - NO verificar palabras");
                    return;
                }

                // Verificar inmunidad (VIPs, Subs, Whitelist) ANTES de detectar palabras
                var (hasImmunity, hasEscalamiento, reason) = await moderationService.CheckImmunityAsync(
                    channel, username, isModerator, isVip, isSubscriber);

                if (hasImmunity)
                {
                    _logger.LogInformation($"✅ [MODERACIÓN] Usuario {username} tiene inmunidad TOTAL: {reason} - NO verificar palabras");
                    return;
                }

                // =====================================================
                // PASO 2: DETECTAR PALABRAS PROHIBIDAS
                // Solo si el usuario NO tiene inmunidad total
                // =====================================================

                var (hasMatch, matchedWord) = await moderationService.DetectBannedWordAsync(channel, message);

                if (!hasMatch || matchedWord == null)
                {
                    return; // No hay palabras prohibidas, continuar normal
                }

                _logger.LogWarning($"⚠️ [MODERACIÓN] Palabra prohibida detectada en [{channel}] por [{username}]: '{matchedWord.Word}' (severidad: {matchedWord.Severity})");

                // Log de badges detectados
                _logger.LogInformation($"🎭 [MODERACIÓN] Badges de {username}: VIP={isVip}, Sub={isSubscriber}, Mod={isModerator}, Broadcaster={isBroadcaster}, Escalamiento={hasEscalamiento}");

                // Reducir severidad si tiene escalamiento (VIP/Sub con escalamiento)
                var severidadFinal = matchedWord.Severity;
                if (hasEscalamiento)
                {
                    severidadFinal = matchedWord.Severity switch
                    {
                        "severo" => "medio",
                        "medio" => "leve",
                        "leve" => "leve",
                        _ => matchedWord.Severity
                    };
                    _logger.LogInformation($"🔽 [MODERACIÓN] Escalamiento aplicado para {username}: {matchedWord.Severity} → {severidadFinal} ({reason})");
                }

                // Incrementar contador de detecciones
                await moderationService.IncrementWordDetectionAsync(matchedWord.Id);

                // Procesar strike y obtener acción (con severidad reducida si tiene escalamiento)
                var (strikeLevel, action) = await moderationService.ProcessStrikeAsync(
                    channel, username, severidadFinal);

                _logger.LogWarning($"🔨 [MODERACIÓN] Acción ejecutada en [{channel}] para [{username}]: {action} (Strike nivel: {strikeLevel})");

                // Ejecutar acción en Twitch (pasar severidad original para mensaje correcto)
                await ExecuteModerationActionAsync(channel, username, action, strikeLevel, matchedWord, messageId, matchedWord.Severity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando moderación para mensaje de {username} en {channel}");
                // No lanzar excepción para no interrumpir el flujo normal del bot
            }
        }

        /// <summary>
        /// Ejecuta la acción de moderación en Twitch (timeout, ban, warning)
        /// </summary>
        private async Task ExecuteModerationActionAsync(string channel, string username, string action, int strikeLevel, BannedWord matchedWord, string? messageId = null, string originalSeverity = "leve")
        {
            try
            {
                // Obtener configuración para mensajes personalizados
                using var scope = _serviceScopeFactory.CreateScope();
                var moderationService = scope.ServiceProvider.GetRequiredService<Decatron.Core.Services.ModerationService>();
                var twitchApiService = scope.ServiceProvider.GetRequiredService<TwitchApiService>();
                var config = await moderationService.GetModerationConfigAsync(channel);

                // Función helper para preparar mensaje
                string PrepareMessage(string template, string defaultMsg)
                {
                    var msg = template ?? defaultMsg;
                    return msg
                        .Replace("$(user)", username)
                        .Replace("$(strike)", strikeLevel.ToString())
                        .Replace("$(word)", matchedWord.Word);
                }

                switch (action)
                {
                    case "warning":
                        // Usar mensaje de warning
                        var warningMsg = PrepareMessage(
                            config?.WarningMessage,
                            "⚠️ $(user), evita usar ese lenguaje. Strike $(strike)/5");
                        await _messageSender.SendMessageAsync(channel, warningMsg);
                        break;

                    case "delete":
                        // Borrar mensaje via API si tenemos el messageId
                        if (!string.IsNullOrEmpty(messageId))
                        {
                            var deleted = await twitchApiService.DeleteMessageAsync(channel, messageId);
                            if (deleted)
                            {
                                _logger.LogInformation($"🗑️ [MODERACIÓN] Mensaje de {username} eliminado: {messageId}");
                            }
                        }
                        else
                        {
                            _logger.LogWarning($"⚠️ [MODERACIÓN] No se puede borrar mensaje de {username}: messageId no disponible");
                        }

                        // Usar mensaje de delete
                        var deleteMsg = PrepareMessage(
                            config?.DeleteMessage,
                            "🗑️ $(user), mensaje borrado por lenguaje inapropiado. Strike $(strike)/5");
                        await _messageSender.SendMessageAsync(channel, deleteMsg);
                        break;

                    case "timeout_30s":
                    case "timeout_1m":
                    case "timeout_5m":
                    case "timeout_10m":
                    case "timeout_30m":
                    case "timeout_1h":
                        // Determinar duración en segundos
                        int duration = action switch
                        {
                            "timeout_30s" => 30,
                            "timeout_1m" => 60,
                            "timeout_5m" => 300,
                            "timeout_10m" => 600,
                            "timeout_30m" => 1800,
                            "timeout_1h" => 3600,
                            _ => 60
                        };

                        await twitchApiService.TimeoutUserAsync(channel, username, duration, "Palabra prohibida detectada");

                        // Usar mensaje de timeout
                        var timeoutMsg = PrepareMessage(
                            config?.TimeoutMessage,
                            "⏱️ $(user), timeout aplicado por lenguaje inapropiado. Strike $(strike)/5");
                        await _messageSender.SendMessageAsync(channel, timeoutMsg);
                        break;

                    case "ban":
                        await twitchApiService.BanUserAsync(channel, username, "Palabra prohibida grave detectada");

                        // Si la severidad original era "severo" (ban directo), usar mensaje especial
                        // Si no, usar el mensaje normal de ban por strikes
                        string banMsg;
                        if (originalSeverity == "severo")
                        {
                            banMsg = PrepareMessage(
                                config?.SeveroMessage,
                                "🔨 $(user), has sido baneado por usar: $(word)");
                            _logger.LogWarning($"🚨 [MODERACIÓN SEVERA] Ban directo por palabra severa: {matchedWord.Word}");
                        }
                        else
                        {
                            banMsg = PrepareMessage(
                                config?.BanMessage,
                                "🔨 $(user), has sido baneado por lenguaje inapropiado. Strike $(strike)/5");
                        }
                        await _messageSender.SendMessageAsync(channel, banMsg);
                        break;

                    default:
                        _logger.LogWarning($"⚠️ [MODERACIÓN] Acción desconocida: {action}");
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error ejecutando acción de moderación {action} para {username} en {channel}");
            }
        }

        private async Task<string> GetChannelLanguageAsync(string channel)
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var lang = await db.Users
                    .Where(u => u.Login == channel.ToLower())
                    .Select(u => u.PreferredLanguage)
                    .FirstOrDefaultAsync();
                return lang ?? "es";
            }
            catch { return "es"; }
        }
    }
}