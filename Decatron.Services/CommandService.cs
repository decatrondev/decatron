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
        private readonly Decatron.Services.Pets.PetEventBridge _petEventBridge;

        public CommandService(
            ILogger<CommandService> logger,
            IMessageSender messageSender,
            IConfiguration configuration,
            ILoggerFactory loggerFactory,
            ICommandStateService commandStateService,
            IServiceScopeFactory serviceScopeFactory,
            Decatron.Services.Pets.PetEventBridge petEventBridge)
        {
            _instanceId = ++_instanceCount;
            _petEventBridge = petEventBridge;
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

                // HolaCommand (comando de prueba) queda desactivado: no se registra para que !hola no exista de cara al usuario

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

            // Registrar comando Watchtime
            RegisterWatchtimeCommand();
            RegisterRuletaCommand();
            RegisterModerationCommands();
            RegisterGameOverlayCommands();

            // Registrar comando de link a vista pública de comandos
            RegisterCommandsLinkCommand();

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

        private void RegisterWatchtimeCommand()
        {
            try
            {
                var watchtimeCommand = new Commands.WatchtimeCommand(
                    _loggerFactory.CreateLogger<Commands.WatchtimeCommand>(),
                    _serviceScopeFactory
                );

                RegisterCommand(watchtimeCommand);
                _logger.LogInformation("✅ WatchtimeCommand (!watchtime) registrado correctamente");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error registrando WatchtimeCommand");
            }
        }

        /// <summary>Comandos de Game Overlays (plan §3). Cada alias es una instancia con otro Name.</summary>
        private void RegisterGameOverlayCommands()
        {
            try
            {
                var log = _loggerFactory.CreateLogger("GameOverlayCommands");
                foreach (var name in new[] { "rango", "rank" }) RegisterCommand(new Commands.RangoCommand(name, log, _serviceScopeFactory));
                foreach (var name in new[] { "lp", "puntos" }) RegisterCommand(new Commands.LpCommand(name, log, _serviceScopeFactory));
                foreach (var name in new[] { "sesion", "session" }) RegisterCommand(new Commands.SesionCommand(name, log, _serviceScopeFactory));
                foreach (var name in new[] { "ultimas", "recent" }) RegisterCommand(new Commands.UltimasCommand(name, log, _serviceScopeFactory));
                foreach (var name in new[] { "cuentas", "accounts" }) RegisterCommand(new Commands.CuentasCommand(name, log, _serviceScopeFactory));
                RegisterCommand(new Commands.JuegoCommand("juego", log, _serviceScopeFactory));
                // Coach de LoL (leen lo último que dijo el coach; no llaman a la IA desde el chat)
                RegisterCommand(new Commands.MatchupCommand("matchup", log, _serviceScopeFactory));
                foreach (var name in new[] { "build", "runas" }) RegisterCommand(new Commands.BuildCommand(name, log, _serviceScopeFactory));
                RegisterCommand(new Commands.CoachCommand("coach", log, _serviceScopeFactory));
                RegisterCommand(new Commands.VsCommand("vs", log, _serviceScopeFactory));
                RegisterCommand(new Commands.DuoCommand("duo", log, _serviceScopeFactory));
                RegisterCommand(new Commands.PoolCommand("pool", log, _serviceScopeFactory));
                RegisterCommand(new Commands.MetaCommand("meta", log, _serviceScopeFactory));
                RegisterCommand(new Commands.PredCommand("pred", log, _serviceScopeFactory));
                RegisterCommand(new Commands.PredTopCommand("predtop", log, _serviceScopeFactory));
                RegisterCommand(new Commands.SetRangoCommand("setrango", log, _serviceScopeFactory));
                RegisterCommand(new Commands.RankStepCommand("rankup", +1, log, _serviceScopeFactory));
                RegisterCommand(new Commands.RankStepCommand("rankdown", -1, log, _serviceScopeFactory));
                RegisterCommand(new Commands.WinLossCommand("win", true, log, _serviceScopeFactory));
                RegisterCommand(new Commands.WinLossCommand("loss", false, log, _serviceScopeFactory));
                _logger.LogInformation("✅ Comandos de Game Overlays registrados (!rango !lp !sesion !ultimas !cuentas !juego !setrango !rankup !rankdown !win !loss)");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error registrando comandos de Game Overlays");
            }
        }

        private void RegisterModerationCommands()
        {
            RegisterCommand(new Commands.PermitCommand(_loggerFactory.CreateLogger<Commands.PermitCommand>(), _serviceScopeFactory));
            RegisterCommand(new Commands.StrikesCommand(_loggerFactory.CreateLogger<Commands.StrikesCommand>(), _serviceScopeFactory));
            RegisterCommand(new Commands.ResetStrikesCommand(_loggerFactory.CreateLogger<Commands.ResetStrikesCommand>(), _serviceScopeFactory));
            RegisterCommand(new Commands.AddWordCommand(_loggerFactory.CreateLogger<Commands.AddWordCommand>(), _serviceScopeFactory));
            RegisterCommand(new Commands.DelWordCommand(_loggerFactory.CreateLogger<Commands.DelWordCommand>(), _serviceScopeFactory));
            RegisterCommand(new Commands.LinkDomainCommand(true, _loggerFactory.CreateLogger<Commands.LinkDomainCommand>(), _serviceScopeFactory));
            RegisterCommand(new Commands.LinkDomainCommand(false, _loggerFactory.CreateLogger<Commands.LinkDomainCommand>(), _serviceScopeFactory));
            RegisterCommand(new Commands.NukeCommand(_loggerFactory.CreateLogger<Commands.NukeCommand>(), _serviceScopeFactory));
        }

        private void RegisterRuletaCommand()
        {
            try
            {
                var ruletaCommand = new Commands.RuletaCommand(
                    _loggerFactory.CreateLogger<Commands.RuletaCommand>(),
                    _serviceScopeFactory
                );

                RegisterCommand(ruletaCommand);
                _logger.LogInformation("✅ RuletaCommand (!ruleta) registrado correctamente");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error registrando RuletaCommand");
            }
        }

        private void RegisterCommandsLinkCommand()
        {
            try
            {
                var commandsLinkCommand = new Commands.CommandsLinkCommand(
                    _loggerFactory.CreateLogger<Commands.CommandsLinkCommand>(),
                    _serviceScopeFactory
                );

                RegisterCommand(commandsLinkCommand);
                _logger.LogInformation("✅ CommandsLinkCommand (!commands) registrado correctamente");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error registrando CommandsLinkCommand");
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

            // Rueda de la Suerte
            try
            {
                RegisterCommand(new WheelSpinCommand(
                    _loggerFactory.CreateLogger<WheelSpinCommand>(), _serviceScopeFactory));
                RegisterCommand(new WheelBalanceCommand(
                    _loggerFactory.CreateLogger<WheelBalanceCommand>(), _serviceScopeFactory));
                RegisterCommand(new WheelBuyCommand(
                    _loggerFactory.CreateLogger<WheelBuyCommand>(), _serviceScopeFactory));
                RegisterCommand(new WheelJoinCommand(
                    _loggerFactory.CreateLogger<WheelJoinCommand>(), _serviceScopeFactory));
                RegisterCommand(new WheelRaffleModCommand(
                    _loggerFactory.CreateLogger<WheelRaffleModCommand>(), _serviceScopeFactory));
                _logger.LogInformation("✅ Comandos de la Rueda registrados: !dgirar, !dcreditos, !dcomprar, !djoin, !drueda");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error registrando comandos de la Rueda");
            }

            // Fortnite Spirits commands
            try
            {
                RegisterCommand(new SpiritsCommand(
                    _loggerFactory.CreateLogger<SpiritsCommand>(),
                    _serviceScopeFactory
                ));
                RegisterCommand(new SpiritCommand(
                    _loggerFactory.CreateLogger<SpiritCommand>(),
                    _serviceScopeFactory
                ));
                _logger.LogInformation("✅ Comandos Spirits registrados: !spirits, !spirit");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error registrando comandos Spirits");
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
            bool isModerator = false, bool isLeadModerator = false, bool isVip = false, bool isSubscriber = false, bool isBroadcaster = false, Dictionary<string, object>? metadata = null)
        {
            try
            {
                _logger.LogWarning($"🎯 [CommandService#{_instanceId}] ProcessMessageAsync llamado: [{channel}] [{username}] {chatMessage}");

                // =====================================================
                // SISTEMA DE MODERACIÓN - Verificar palabras prohibidas
                // Debe ejecutarse ANTES de procesar comandos
                // =====================================================
                // Si el mensaje salió del chat (borrado, timeout, ban), el comando que traía no se ejecuta
                if (await CheckMessageModerationAsync(username, channel, chatMessage, userId, messageId,
                    isModerator, isLeadModerator, isVip, isSubscriber, isBroadcaster, metadata))
                    return;

                var parts = chatMessage.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length == 0)
                    return;

                var commandName = parts[0].ToLower();

                // Resolve channel userId once for all commands
                long? channelUserId = null;
                string? channelTwitchId = null;
                try
                {
                    using var resolveScope = _serviceScopeFactory.CreateScope();
                    var resolveDb = resolveScope.ServiceProvider.GetRequiredService<Decatron.Data.DecatronDbContext>();
                    var chInfo = await Decatron.Core.Helpers.ChannelResolver.ResolveChannelInfoAsync(resolveDb, channel);
                    if (chInfo != null)
                    {
                        channelUserId = chInfo.UserId;
                        channelTwitchId = chInfo.TwitchId;
                    }
                }
                catch { /* non-blocking */ }

                // Log para debug: ver qué comandos están registrados
                if (commandName.StartsWith("!"))
                {
                    _logger.LogDebug($"[Instance#{_instanceId}] Buscando comando '{commandName}'. Comandos registrados: {string.Join(", ", _commands.Keys)}");
                }

                // 1. COMANDOS DEL SERVIDOR (registrados en _commands)
                if (_commands.TryGetValue(commandName, out var command))
                {
                    _logger.LogInformation($"✅ Ejecutando comando del servidor {commandName} por {username} en {channel}");
                    var ctx = new CommandContext(username, channel, chatMessage, userId) { MessageId = messageId, IsModerator = isModerator, IsLeadModerator = isLeadModerator, IsVip = isVip, IsSubscriber = isSubscriber, IsBroadcaster = isBroadcaster, Metadata = metadata, ChannelUserId = channelUserId, ChannelTwitchId = channelTwitchId };
                    await command.ExecuteAsync(ctx, _messageSender);
                    return;
                }

                // 1b. GACHA SHORTHAND — !gcpull, !gcpulls, !gccol, etc. → rutear a !gc
                if (commandName.StartsWith("!gc") && commandName != "!gc" && _commands.TryGetValue("!gc", out var gcCommand))
                {
                    _logger.LogInformation($"✅ Ruteando {commandName} a !gc por {username} en {channel}");
                    var ctx = new CommandContext(username, channel, chatMessage, userId) { MessageId = messageId, IsModerator = isModerator, IsLeadModerator = isLeadModerator, IsVip = isVip, IsSubscriber = isSubscriber, IsBroadcaster = isBroadcaster, Metadata = metadata, ChannelUserId = channelUserId, ChannelTwitchId = channelTwitchId };
                    await gcCommand.ExecuteAsync(ctx, _messageSender);
                    return;
                }

                // 1c. GACHA CUSTOM ALIASES — !go, !tirar, etc. → rutear a !gacha
                if (commandName.StartsWith("!") && _commands.TryGetValue("!gacha", out var gachaCmd))
                {
                    try
                    {
                        using var aliasScope = _serviceScopeFactory.CreateScope();
                        var aliasDb = aliasScope.ServiceProvider.GetRequiredService<Decatron.Data.DecatronDbContext>();
                        var aliasName = commandName.Substring(1).ToLower();
                        var gachaAlias = await aliasDb.GachaCommandAliases
                            .FirstOrDefaultAsync(a => (channelUserId != null ? a.UserId == channelUserId : a.ChannelName == channel.ToLower()) && a.Alias == aliasName);

                        if (gachaAlias != null)
                        {
                            // Rewrite message to !gacha <targetCommand> <rest of args>
                            var restOfMessage = chatMessage.Contains(' ') ? chatMessage.Substring(chatMessage.IndexOf(' ')) : "";
                            var rewrittenMessage = $"!gacha {gachaAlias.TargetCommand}{restOfMessage}";
                            _logger.LogInformation($"✅ Alias gacha: !{aliasName} → {rewrittenMessage} por {username} en {channel}");
                            var ctx = new CommandContext(username, channel, rewrittenMessage, userId) { MessageId = messageId, IsModerator = isModerator, IsLeadModerator = isLeadModerator, IsVip = isVip, IsSubscriber = isSubscriber, IsBroadcaster = isBroadcaster, Metadata = metadata, ChannelUserId = channelUserId, ChannelTwitchId = channelTwitchId };
                            await gachaCmd.ExecuteAsync(ctx, _messageSender);
                            return;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogDebug(ex, "Error checking gacha alias for {Cmd}", commandName);
                    }
                }

                // 1d. WATCHTIME CUSTOM ALIAS — permite renombrar !watchtime (ej. !tiempo) por streamer
                if (commandName.StartsWith("!") && commandName != "!watchtime" && channelUserId != null
                    && _commands.TryGetValue("!watchtime", out var watchtimeCmd))
                {
                    try
                    {
                        using var wtAliasScope = _serviceScopeFactory.CreateScope();
                        var wtAliasDb = wtAliasScope.ServiceProvider.GetRequiredService<Decatron.Data.DecatronDbContext>();
                        var wtConfig = await wtAliasDb.WatchtimeCommandConfigs
                            .FirstOrDefaultAsync(c => c.UserId == channelUserId && c.CommandName.ToLower() == commandName);

                        if (wtConfig != null)
                        {
                            _logger.LogInformation($"✅ Alias watchtime: {commandName} → !watchtime por {username} en {channel}");
                            var ctx = new CommandContext(username, channel, "!watchtime", userId) { MessageId = messageId, IsModerator = isModerator, IsLeadModerator = isLeadModerator, IsVip = isVip, IsSubscriber = isSubscriber, IsBroadcaster = isBroadcaster, Metadata = metadata, ChannelUserId = channelUserId, ChannelTwitchId = channelTwitchId };
                            await watchtimeCmd.ExecuteAsync(ctx, _messageSender);
                            return;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogDebug(ex, "Error checking watchtime alias for {Cmd}", commandName);
                    }
                }

                if (commandName.StartsWith("!") && !commandName.StartsWith("!gc"))
                {
                    _logger.LogDebug($"❌ Comando '{commandName}' no encontrado en _commands");
                }

                // 2. COMANDOS ESPECIALES del servidor
                if (commandName == "!crear")
                {
                    _logger.LogInformation($"Ejecutando comando !crear por {username} en {channel}");
                    await ProcessCreateCommand(username, channel, chatMessage, userId, isModerator, isLeadModerator, isVip, isSubscriber, isBroadcaster);
                    return;
                }

                if (commandName == "!editcom")
                {
                    _logger.LogInformation($"Ejecutando comando !editcom por {username} en {channel}");
                    await ProcessEditCommand(username, channel, chatMessage, userId, isModerator, isLeadModerator, isVip, isSubscriber, isBroadcaster);
                    return;
                }

                if (commandName == "!delcom")
                {
                    _logger.LogInformation($"Ejecutando comando !delcom por {username} en {channel}");
                    await ProcessDeleteCommand(username, channel, chatMessage, userId, isModerator, isLeadModerator, isVip, isSubscriber, isBroadcaster);
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

                // 3b. COMANDOS DE LA MASCOTA (definidos por el streamer en /overlays/pets)
                if (commandName.StartsWith("!"))
                {
                    if (await _petEventBridge.TryHandleCommandAsync(channel, username, commandName.Substring(1), isBroadcaster, isModerator || isLeadModerator, isVip, isSubscriber))
                        return;
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
                if (isScripted)
                {
                    _logger.LogInformation("[DEBUG] Executing scripted command {Cmd}", commandName);
                    await ExecuteScriptedCommand(commandName, username, channel, fullMessage, scriptingService);
                    return;
                }

                // Comparar por ChannelName (string) nunca fue confiable entre
                // plataformas: CustomCommandsController.GetActiveChannelContext
                // guarda el "Login" crudo de la fila (para Kick eso es el
                // placeholder "kick_<id>", no el username real), mientras que
                // "channel" que llega aca es el kick_id numerico (via
                // KickConnector.ParseChatMessage) y ChannelResolver devuelve el
                // KickUsername real — tres formas de texto distintas para el mismo
                // canal, ninguna garantizada a coincidir con las otras. En vez de
                // perseguir cual convencion de texto es la correcta, se compara por
                // "user_id": CustomCommand ya tiene esa columna con FK real a
                // Users, poblada siempre (ver custom_commands.user_id, NOT NULL).
                // Es el mismo identificador sin importar la plataforma, asi que
                // tambien queda listo para YouTube sin tocar esta linea.
                var channelInfo = await ChannelResolver.ResolveChannelInfoAsync(dbContext, channel);
                if (channelInfo == null)
                    return;

                // Verificar comando normal en la base de datos
                var customCommand = await dbContext.CustomCommands
                    .FirstOrDefaultAsync(c => c.CommandName == commandName && c.UserId == channelInfo.UserId && c.IsActive);

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

        private async Task ProcessCreateCommand(string username, string channel, string chatMessage, string userId, bool isModerator, bool isLeadModerator, bool isVip, bool isSubscriber, bool isBroadcaster)
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var scriptingService = scope.ServiceProvider.GetRequiredService<ScriptingService>();

                var messagesService = scope.ServiceProvider.GetRequiredService<ICommandMessagesService>();
                var createCommand = new Decatron.Custom.Commands.CreateCommand(dbContext, _configuration, scriptingService, messagesService);
                // Antes se armaba con el constructor corto, sin badges — IsBroadcaster/
                // IsModerator quedaban siempre en false, asi que !crear solo funcionaba
                // para system admins. Encontrado el 6 ago 2026 al construir !editcom/!delcom
                // sobre el mismo patron y notar que heredaban el mismo bug.
                var ctx = new CommandContext(username, channel, chatMessage, userId)
                {
                    IsModerator = isModerator,
                    IsLeadModerator = isLeadModerator,
                    IsVip = isVip,
                    IsSubscriber = isSubscriber,
                    IsBroadcaster = isBroadcaster
                };
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

        private async Task ProcessEditCommand(string username, string channel, string chatMessage, string userId, bool isModerator, bool isLeadModerator, bool isVip, bool isSubscriber, bool isBroadcaster)
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var messagesService = scope.ServiceProvider.GetRequiredService<ICommandMessagesService>();
                var editCommand = new Decatron.Custom.Commands.EditCommand(dbContext, messagesService);
                var ctx = new CommandContext(username, channel, chatMessage, userId)
                {
                    IsModerator = isModerator,
                    IsLeadModerator = isLeadModerator,
                    IsVip = isVip,
                    IsSubscriber = isSubscriber,
                    IsBroadcaster = isBroadcaster
                };
                await editCommand.ExecuteAsync(ctx, _messageSender);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error procesando comando !editcom de {username} en {channel}");
                using var errScope = _serviceScopeFactory.CreateScope();
                var messagesService = errScope.ServiceProvider.GetRequiredService<ICommandMessagesService>();
                var lang = await GetChannelLanguageAsync(channel);
                await _messageSender.SendMessageAsync(channel, messagesService.GetMessage("command_service", "error_generic", lang));
            }
        }

        private async Task ProcessDeleteCommand(string username, string channel, string chatMessage, string userId, bool isModerator, bool isLeadModerator, bool isVip, bool isSubscriber, bool isBroadcaster)
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var messagesService = scope.ServiceProvider.GetRequiredService<ICommandMessagesService>();
                var deleteCommand = new Decatron.Custom.Commands.DeleteCommand(dbContext, messagesService);
                var ctx = new CommandContext(username, channel, chatMessage, userId)
                {
                    IsModerator = isModerator,
                    IsLeadModerator = isLeadModerator,
                    IsVip = isVip,
                    IsSubscriber = isSubscriber,
                    IsBroadcaster = isBroadcaster
                };
                await deleteCommand.ExecuteAsync(ctx, _messageSender);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error procesando comando !delcom de {username} en {channel}");
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
            commands.Add("!editcom");
            commands.Add("!delcom");
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
        /// Pasa el mensaje por la cadena de moderación y ejecuta la acción en Twitch.
        /// Devuelve true si el mensaje salió del chat (borrado, timeout o ban): ahí no se
        /// ejecuta el comando que traía.
        /// </summary>
        private async Task<bool> CheckMessageModerationAsync(string username, string channel, string message, string userId, string? messageId,
            bool isModerator, bool isLeadModerator, bool isVip, bool isSubscriber, bool isBroadcaster, Dictionary<string, object>? metadata)
        {
            try
            {
                // Kick todavía no tiene acciones de moderación (fase K del plan de moderación)
                if (metadata != null && metadata.TryGetValue("platform", out var platform) && platform?.ToString() == "kick")
                    return false;

                // Búfer para !nuke: solo quien puede ser sancionado
                if (!isBroadcaster && !isLeadModerator && !isModerator)
                    Decatron.Core.Services.Moderation.RecentChatBuffer.Add(channel, username, message);

                using var scope = _serviceScopeFactory.CreateScope();
                var moderationService = scope.ServiceProvider.GetRequiredService<Decatron.Core.Services.ModerationService>();

                var verdict = await moderationService.EvaluateAsync(
                    new Decatron.Core.Services.Moderation.ModerationMessage
                    {
                        Channel = channel,
                        Username = username,
                        Text = message,
                        MessageId = messageId,
                        IsBroadcaster = isBroadcaster,
                        IsLeadModerator = isLeadModerator,
                        IsModerator = isModerator,
                        IsVip = isVip,
                        IsSubscriber = isSubscriber
                    },
                    () => Moderation.ModerationPermissions.HasControlTotalAsync(scope.ServiceProvider, channel, userId));

                if (verdict == null)
                    return false;

                await ExecuteModerationActionAsync(scope.ServiceProvider, channel, username, messageId, verdict);
                return verdict.RemovesMessage;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando moderación para mensaje de {username} en {channel}");
                return false;
            }
        }

        /// <summary>
        /// Ejecuta en Twitch la acción que decidió la moderación y avisa en el chat
        /// </summary>
        private async Task ExecuteModerationActionAsync(IServiceProvider services, string channel, string username, string? messageId,
            Decatron.Core.Services.Moderation.ModerationVerdict verdict)
        {
            var action = verdict.Action;
            try
            {
                var twitchApiService = services.GetRequiredService<TwitchApiService>();
                var config = verdict.Config;

                string Prepare(string template) => template
                    .Replace("$(user)", username)
                    .Replace("$(strike)", verdict.StrikeLevel.ToString())
                    .Replace("$(word)", verdict.Hit.Detail);

                // Un filtro con mensaje propio lo usa para cualquier acción; si no, el de cada acción
                string ChatMessage(string actionMessage) => Prepare(verdict.FilterMessage ?? actionMessage);

                switch (action)
                {
                    case "warning":
                        await _messageSender.SendMessageAsync(channel, ChatMessage(config.WarningMessage));
                        break;

                    case "delete":
                        if (!string.IsNullOrEmpty(messageId))
                            await twitchApiService.DeleteMessageAsync(channel, messageId);
                        else
                            _logger.LogWarning($"⚠️ [MODERACIÓN] No se puede borrar mensaje de {username}: messageId no disponible");
                        await _messageSender.SendMessageAsync(channel, ChatMessage(config.DeleteMessage));
                        break;

                    case "timeout_30s":
                    case "timeout_1m":
                    case "timeout_5m":
                    case "timeout_10m":
                    case "timeout_30m":
                    case "timeout_1h":
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
                        await twitchApiService.TimeoutUserAsync(channel, username, duration, verdict.Hit.Reason);
                        await _messageSender.SendMessageAsync(channel, ChatMessage(config.TimeoutMessage));
                        break;

                    case "ban":
                        await twitchApiService.BanUserAsync(channel, username, verdict.Hit.Reason);
                        // Ban directo por severidad "severo" (sin strikes) tiene su propio mensaje
                        await _messageSender.SendMessageAsync(channel,
                            ChatMessage(verdict.StrikeLevel == 0 ? config.SeveroMessage : config.BanMessage));
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