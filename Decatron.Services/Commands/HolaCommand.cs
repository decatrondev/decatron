using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Core.Helpers;
using Decatron.Services;
using Microsoft.Extensions.Configuration;
using System.Threading.Tasks;

namespace Decatron.Services.Commands
{
    /// <summary>
    /// Comando de ejemplo: hola
    /// </summary>
    public class HolaCommand : ICommand
    {
        private readonly IConfiguration _configuration;
        private readonly ICommandMessagesService _messagesService;

        public string Name => "hola";
        public string Description => "Saluda al usuario";

        public HolaCommand(IConfiguration configuration, ICommandMessagesService messagesService)
        {
            _configuration = configuration;
            _messagesService = messagesService;
        }

        public async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            var channelLang = await GetChannelLanguageAsync(context.Channel);
            var response = _messagesService.GetMessage("hola", "greeting", channelLang, context.Username);
            await messageSender.SendMessageAsync(context.Channel, response);
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