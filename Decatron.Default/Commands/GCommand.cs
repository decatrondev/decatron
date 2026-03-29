using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Default.Helpers;
using Decatron.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Decatron.Default.Commands
{
    public class GCommand : ICommand
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<GCommand> _logger;
        private readonly ICommandStateService _commandStateService;
        private readonly ICommandMessagesService _messagesService;
        private readonly DecatronDbContext _dbContext;

        public string Name => "!g";
        public string Description => "Comando de gestión de categorías y micro comandos";

        public GCommand(
            IConfiguration configuration,
            ILogger<GCommand> logger,
            ICommandStateService commandStateService,
            ICommandMessagesService messagesService,
            DecatronDbContext dbContext)
        {
            _configuration = configuration;
            _logger = logger;
            _commandStateService = commandStateService;
            _messagesService = messagesService;
            _dbContext = dbContext;
        }

        public async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            var username = context.Username;
            var channel = context.Channel;
            var message = context.Message;
            try
            {
                _logger.LogInformation($"Ejecutando comando !g por {username} en {channel}");

                // NOTA: La verificación de bot habilitado ya se hace en TwitchBotService ANTES de llamar a este comando

                var isCommandEnabled = await IsCommandEnabledForChannel(channel);
                if (!isCommandEnabled)
                {
                    _logger.LogDebug($"Comando !g deshabilitado para el canal {channel}");
                    return;
                }

                // Obtener idioma del canal
                var userLang = await GetChannelLanguageAsync(channel);

                var messageWithoutPrefix = message.StartsWith("!") ? message.Substring(1) : message;
                var args = messageWithoutPrefix.Split(' ', StringSplitOptions.RemoveEmptyEntries);

                // Solo "!g" sin argumentos - mostrar categoría actual
                if (args.Length == 1)
                {
                    await ShowCurrentCategory(username, channel, userLang, messageSender);
                    return;
                }

                var subCommand = args[1].ToLower();

                switch (subCommand)
                {
                    case "help":
                        await ShowHelpMessage(channel, userLang, messageSender);
                        break;
                    case "list":
                        await ShowMicroCommandsList(channel, userLang, messageSender);
                        break;
                    case "set":
                        await HandleSetCommand(username, channel, userLang, args, messageSender);
                        break;
                    case "remove":
                    case "delete":
                        await HandleRemoveCommand(username, channel, userLang, args, messageSender);
                        break;
                    default:
                        // Si no es un subcomando, cambiar categoría directamente
                        await HandleDirectCategoryChange(username, channel, userLang, args, messageSender);
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error en comando !g para {channel}");
                var userLang = await GetChannelLanguageAsync(channel);
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "error_generic", userLang));
            }
        }

        private async Task ShowCurrentCategory(string username, string channel, string userLang, IMessageSender messageSender)
        {
            try
            {
                var userInfo = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channel);
                if (userInfo == null)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "error_channel_info", userLang));
                    return;
                }

                var currentCategory = await GameUtils.GetCurrentCategoryAsync(_configuration, userInfo.TwitchId, userInfo.AccessToken);
                if (!string.IsNullOrEmpty(currentCategory))
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "current_category", userLang, currentCategory));
                }
                else
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "error_get_category", userLang));
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error mostrando categoría actual para {channel}");
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "error_get_category", userLang));
            }
        }

        private async Task ShowHelpMessage(string channel, string userLang, IMessageSender messageSender)
        {
            await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "help", userLang));
        }

        private async Task ShowMicroCommandsList(string channel, string userLang, IMessageSender messageSender)
        {
            try
            {
                var microCommands = await _dbContext.MicroGameCommands
                    .Where(mc => mc.ChannelName == channel)
                    .Take(10)
                    .Select(mc => mc.ShortCommand)
                    .ToListAsync();

                if (microCommands.Any())
                {
                    var commandsList = string.Join(", ", microCommands);
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "micro_list", userLang, commandsList));
                }
                else
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "micro_list_empty", userLang));
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error listando micro comandos para {channel}");
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "micro_error_list", userLang));
            }
        }

        private async Task HandleSetCommand(string username, string channel, string userLang, string[] args, IMessageSender messageSender)
        {
            try
            {
                if (args.Length < 4)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "micro_set_usage", userLang));
                    return;
                }

                var hasPermission = await GameUtils.HasPermissionToChangeCategoryAsync(_configuration, username, channel, _logger);
                if (!hasPermission)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "permission_denied_micro", userLang));
                    return;
                }

                var command = args[2];
                var category = string.Join(" ", args.Skip(3));

                if (!command.StartsWith("!"))
                {
                    command = "!" + command;
                }

                // Verificar palabras reservadas
                var reservedWords = new[] { "!g", "!game", "!set", "!remove", "!delete", "!list", "!help", "!title", "!t" };
                if (reservedWords.Contains(command.ToLower()))
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "micro_reserved", userLang, command));
                    return;
                }

                var validationResult = GameUtils.ValidateCategory(category);
                if (!validationResult.isValid)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "error_validation", userLang, validationResult.errorMessage));
                    return;
                }

                var existingCommand = await _dbContext.MicroGameCommands
                    .FirstOrDefaultAsync(mc => mc.ChannelName == channel && mc.ShortCommand == command);

                if (existingCommand != null)
                {
                    existingCommand.CategoryName = category;
                    existingCommand.UpdatedAt = DateTime.UtcNow;
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "micro_updated", userLang, command, category));
                }
                else
                {
                    var newCommand = new MicroGameCommands
                    {
                        ChannelName = channel,
                        ShortCommand = command,
                        CategoryName = category,
                        CreatedBy = username,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    _dbContext.MicroGameCommands.Add(newCommand);
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "micro_created", userLang, command, category));
                }

                await _dbContext.SaveChangesAsync();
                _logger.LogInformation($"Micro comando {command} configurado por {username} en {channel}: {category}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error creando micro comando para {channel}");
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "micro_error_create", userLang));
            }
        }

        private async Task HandleRemoveCommand(string username, string channel, string userLang, string[] args, IMessageSender messageSender)
        {
            try
            {
                if (args.Length < 3)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "micro_remove_usage", userLang));
                    return;
                }

                var hasPermission = await GameUtils.HasPermissionToChangeCategoryAsync(_configuration, username, channel, _logger);
                if (!hasPermission)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "permission_denied_micro", userLang));
                    return;
                }

                var command = args[2];
                if (!command.StartsWith("!"))
                {
                    command = "!" + command;
                }

                var microCommand = await _dbContext.MicroGameCommands
                    .FirstOrDefaultAsync(mc => mc.ChannelName == channel && mc.ShortCommand == command);

                if (microCommand == null)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "micro_not_found", userLang, command));
                    return;
                }

                _dbContext.MicroGameCommands.Remove(microCommand);
                await _dbContext.SaveChangesAsync();

                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "micro_removed", userLang, command));
                _logger.LogInformation($"Micro comando {command} eliminado por {username} en {channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error eliminando micro comando para {channel}");
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "micro_error_remove", userLang));
            }
        }

        private async Task HandleDirectCategoryChange(string username, string channel, string userLang, string[] args, IMessageSender messageSender)
        {
            try
            {
                var hasPermission = await GameUtils.HasPermissionToChangeCategoryAsync(_configuration, username, channel, _logger);
                if (!hasPermission)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "permission_denied", userLang));
                    return;
                }

                var category = string.Join(" ", args.Skip(1));
                var validationResult = GameUtils.ValidateCategory(category);
                if (!validationResult.isValid)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "error_validation", userLang, validationResult.errorMessage));
                    return;
                }

                var userInfo = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channel);
                if (userInfo == null)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "error_channel_info", userLang));
                    return;
                }

                var realCategoryName = await GameUtils.UpdateCategoryAsync(_configuration, userInfo.TwitchId, category, userInfo.AccessToken, _logger);
                if (realCategoryName != null)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "success", userLang, realCategoryName));
                    await GameUtils.SaveCategoryToHistoryAsync(_configuration, channel, realCategoryName, username);
                    _logger.LogInformation($"Categoría cambiada por {username} en {channel} usando !g: {realCategoryName}");
                }
                else
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "error_change", userLang));
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error cambiando categoría directamente para {channel}");
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("g", "error_change", userLang));
            }
        }

        private async Task<string> GetChannelLanguageAsync(string channelLogin)
        {
            try
            {
                var channelUser = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channelLogin);
                if (channelUser == null)
                {
                    _logger.LogWarning($"[GCommand] No se pudo obtener info del canal: {channelLogin}");
                    return "es";
                }

                var language = channelUser.PreferredLanguage ?? "es";
                _logger.LogDebug($"[GCommand] Idioma del canal {channelLogin}: '{language}'");
                return language;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[GCommand] Error obteniendo idioma del canal: {channelLogin}");
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
                _logger.LogError(ex, $"Error verificando si comando !g está habilitado para {channelLogin}");
                return true;
            }
        }
    }
}