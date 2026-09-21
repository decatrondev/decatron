using System;
using System.Linq;
using System.Threading.Tasks;
using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Custom.Commands
{
    /// <summary>
    /// !editcom — edita un comando personalizado (normal o con script) ya
    /// existente, sin pasar por el dashboard. Hermano de CreateCommand, mismo
    /// modelo de permisos y misma resolucion de canal generica (ChannelResolver),
    /// para no repetir el bug de "!crear" que solo funcionaba en Twitch.
    /// </summary>
    public class EditCommand : ICommand
    {
        private readonly DecatronDbContext _context;
        private readonly ICommandMessagesService _messagesService;

        public string Name => "!editcom";
        public string Description => "Editar un comando personalizado existente";

        public EditCommand(DecatronDbContext context, ICommandMessagesService messagesService)
        {
            _context = context;
            _messagesService = messagesService;
        }

        private async Task<string> GetChannelLanguageAsync(string channel)
        {
            try
            {
                var info = await ChannelResolver.ResolveChannelInfoAsync(_context, channel);
                return info?.PreferredLanguage ?? "es";
            }
            catch { return "es"; }
        }

        public async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            var username = context.Username;
            var channel = context.Channel;
            var message = context.Message;

            var lang = await GetChannelLanguageAsync(channel);
            var parts = message.Split(' ', StringSplitOptions.RemoveEmptyEntries);

            if (parts.Length < 3)
            {
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("editcom", "usage", lang));
                return;
            }

            var commandName = parts[1].ToLower();
            string restriction = "all";
            bool isActive = true;
            var words = parts.Skip(2).ToList();

            // Misma logica de CreateCommand para no leer distinto la restriccion
            // y el estado segun con que comando se toco el mismo dato por ultimo.
            if (words.Count >= 2)
            {
                var lastWord = words.Last().ToLower();
                var secondLastWord = words[words.Count - 2].ToLower();

                if (lastWord == "activo" || lastWord == "inactivo")
                {
                    isActive = lastWord == "activo";
                    words.RemoveAt(words.Count - 1);

                    if (secondLastWord == "all" || secondLastWord == "mod" || secondLastWord == "vip" || secondLastWord == "sub")
                    {
                        restriction = secondLastWord;
                        words.RemoveAt(words.Count - 1);
                    }
                }
                else if (lastWord == "all" || lastWord == "mod" || lastWord == "vip" || lastWord == "sub")
                {
                    restriction = lastWord;
                    words.RemoveAt(words.Count - 1);
                }
            }

            var response = string.Join(' ', words);

            try
            {
                var isSystemAdmin = await _context.SystemAdmins
                    .AnyAsync(a => a.Username.ToLower() == username.ToLower());
                var isOwnerOrModerator = context.IsBroadcaster || context.IsModerator || isSystemAdmin;
                if (!isOwnerOrModerator)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("editcom", "no_permission", lang));
                    return;
                }

                var channelInfo = await ChannelResolver.ResolveChannelInfoAsync(_context, channel);
                if (channelInfo == null)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("editcom", "no_broadcaster_id", lang));
                    return;
                }

                var displayChannelName = channelInfo.DisplayName ?? channel;

                var normalCommand = await _context.CustomCommands
                    .FirstOrDefaultAsync(c => c.CommandName == commandName && c.UserId == channelInfo.UserId);

                if (normalCommand != null)
                {
                    normalCommand.Response = response;
                    normalCommand.Restriction = restriction;
                    normalCommand.IsActive = isActive;
                    normalCommand.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();

                    var statusText = _messagesService.GetMessage("editcom", isActive ? "active" : "inactive", lang);
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("editcom", "command_updated", lang, commandName, displayChannelName, restriction, statusText));
                    return;
                }

                var scriptCommand = await _context.ScriptedCommands
                    .FirstOrDefaultAsync(c => c.CommandName == commandName && c.UserId == channelInfo.UserId);

                if (scriptCommand != null)
                {
                    scriptCommand.ScriptContent = response;
                    scriptCommand.IsActive = isActive;
                    scriptCommand.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();

                    var statusText = _messagesService.GetMessage("editcom", isActive ? "active" : "inactive", lang);
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("editcom", "script_updated", lang, commandName, displayChannelName, statusText));
                    return;
                }

                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("editcom", "not_found", lang, commandName));
            }
            catch (Exception)
            {
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("editcom", "error_generic", lang));
            }
        }
    }
}
