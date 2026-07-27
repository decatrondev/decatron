using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;

namespace Decatron.Services.Commands
{
    /// <summary>
    /// !commands — Postea el link a la vista pública de comandos del streamer (twitch.decatron.net/commands/{channel})
    /// </summary>
    public class CommandsLinkCommand : ICommand
    {
        private readonly ILogger<CommandsLinkCommand> _logger;
        private readonly IServiceScopeFactory _serviceScopeFactory;

        private static readonly ConcurrentDictionary<string, DateTime> _cooldowns = new();
        private const int GlobalCooldownSeconds = 10;

        public string Name => "!commands";
        public string Description => "Muestra el link a la lista pública de comandos del canal";

        public CommandsLinkCommand(ILogger<CommandsLinkCommand> logger, IServiceScopeFactory serviceScopeFactory)
        {
            _logger = logger;
            _serviceScopeFactory = serviceScopeFactory;
        }

        public async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            try
            {
                var channelKey = context.Channel.ToLower();
                var now = DateTime.UtcNow;
                if (_cooldowns.TryGetValue(channelKey, out var last) && (now - last).TotalSeconds < GlobalCooldownSeconds)
                    return;
                _cooldowns[channelKey] = now;

                using var scope = _serviceScopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var channelInfo = await ChannelResolver.ResolveChannelInfoAsync(db, context.Channel);
                if (channelInfo == null)
                {
                    _logger.LogWarning($"[Commands] Canal {context.Channel} no resuelto");
                    return;
                }

                var message = $"@{context.Username} mira todos mis comandos acá: https://twitch.decatron.net/commands/{channelInfo.Login}";
                await messageSender.SendMessageAsync(context.Channel, message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[Commands] Error ejecutando comando para {context.Username} en {context.Channel}");
            }
        }
    }
}
