using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Concurrent;
using System.Linq;
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

                // En un tenant de la plataforma el enlace va a su subdominio (slug.decatron.top); el bot propio (#1) sigue en decatron.net.
                var site = "https://decatron.net";
                if (TenantAmbient.Current is long tid && tid != 1)
                {
                    var slug = await db.Tenants.AsNoTracking().Where(t => t.Id == tid).Select(t => t.Slug).FirstOrDefaultAsync();
                    if (!string.IsNullOrEmpty(slug)) site = $"https://{slug}.{TenantResolver.PlatformDomain}";
                }
                var message = $"@{context.Username} mira todos mis comandos aquí: {site}/commands/{channelInfo.Login}";
                await messageSender.SendMessageAsync(context.Channel, message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[Commands] Error ejecutando comando para {context.Username} en {context.Channel}");
            }
        }
    }
}
