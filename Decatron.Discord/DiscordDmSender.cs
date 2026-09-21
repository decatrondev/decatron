using Decatron.Core.Interfaces;
using DSharpPlus;
using Microsoft.Extensions.Logging;

namespace Decatron.Discord
{
    public class DiscordDmSender : IDiscordDmSender
    {
        private readonly DiscordClientProvider _provider;
        private readonly ILogger<DiscordDmSender> _logger;

        public DiscordDmSender(DiscordClientProvider provider, ILogger<DiscordDmSender> logger)
        {
            _provider = provider;
            _logger = logger;
        }

        public async Task<bool> SendDmAsync(string discordUserId, string message)
        {
            if (!ulong.TryParse(discordUserId, out var id))
                return false;

            // DSharpPlus solo permite abrir DM a traves de un DiscordMember (no
            // hay CreateDmChannelAsync directo sobre DiscordUser) — hay que
            // encontrarlo como miembro en alguno de los guilds donde esta el bot.
            foreach (var guild in _provider.Client.Guilds.Values)
            {
                try
                {
                    var member = await guild.GetMemberAsync(id);
                    var dm = await member.CreateDmChannelAsync();
                    await dm.SendMessageAsync(message);
                    return true;
                }
                catch (Exception)
                {
                    // No es miembro de este guild (o DMs cerrados) — se prueba el siguiente
                }
            }

            _logger.LogInformation("No se pudo mandar DM de Discord a {DiscordUserId}: no comparte ningun guild con el bot o tiene los DMs cerrados", discordUserId);
            return false;
        }
    }
}
