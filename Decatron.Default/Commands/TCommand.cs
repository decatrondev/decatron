using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Core.Helpers;
using Decatron.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;

namespace Decatron.Default.Commands
{
    public class TCommand : ICommand
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<TCommand> _logger;
        private readonly ICommandStateService _commandStateService;
        private readonly ICommandMessagesService _messagesService;
        private readonly IServiceScopeFactory _serviceScopeFactory;

        public string Name => "!t";
        public string Description => "Alias de !title - Cambia o consulta el título del stream";

        public TCommand(
            IConfiguration configuration,
            ILogger<TCommand> logger,
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
                _logger.LogInformation($"Ejecutando comando !t (alias de !title) por {username} en {channel}");

                // Convertir comando !t a formato !title para delegar
                var titleMessage = message.Replace("!t", "!title");
                if (message.StartsWith("t "))
                {
                    titleMessage = message.Replace("t ", "title ");
                }

                // Crear instancia de TitleCommand para delegar
                var titleCommand = new TitleCommand(
                    _configuration,
                    Microsoft.Extensions.Logging.LoggerFactory.Create(b => b.AddConsole()).CreateLogger<TitleCommand>(),
                    _commandStateService,
                    _messagesService,
                    _serviceScopeFactory); // Pasar el factory

                // Crear nuevo contexto con el mensaje modificado
                var newContext = new CommandContext(context.Username, context.Channel, titleMessage, context.UserId)
                {
                    MessageId = context.MessageId,
                    IsModerator = context.IsModerator,
                    IsVip = context.IsVip,
                    IsSubscriber = context.IsSubscriber,
                    IsBroadcaster = context.IsBroadcaster,
                    Metadata = context.Metadata
                };

                // Delegar al comando TitleCommand
                await titleCommand.ExecuteAsync(newContext, messageSender);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error en comando !t para {channel} por {username}");
                var channelLang = await GetChannelLanguageAsync(channel);
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("title", "error_generic", channelLang));
            }
        }

        private async Task<string> GetChannelLanguageAsync(string channelLogin)
        {
            try
            {
                var channelUser = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channelLogin);
                return channelUser?.PreferredLanguage ?? "es";
            }
            catch
            {
                return "es";
            }
        }
    }
}