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
    /// !delcom — borra un comando personalizado (normal o con script) existente.
    /// Mismo modelo de permisos y resolucion de canal que CreateCommand/EditCommand.
    /// </summary>
    public class DeleteCommand : ICommand
    {
        private readonly DecatronDbContext _context;
        private readonly ICommandMessagesService _messagesService;

        public string Name => "!delcom";
        public string Description => "Borrar un comando personalizado existente";

        public DeleteCommand(DecatronDbContext context, ICommandMessagesService messagesService)
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

            if (parts.Length < 2)
            {
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("delcom", "usage", lang));
                return;
            }

            var commandName = parts[1].ToLower();

            try
            {
                var isSystemAdmin = await _context.SystemAdmins
                    .AnyAsync(a => a.Username.ToLower() == username.ToLower());
                var isOwnerOrModerator = context.IsBroadcaster || context.IsModerator || isSystemAdmin;
                if (!isOwnerOrModerator)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("delcom", "no_permission", lang));
                    return;
                }

                var channelInfo = await ChannelResolver.ResolveChannelInfoAsync(_context, channel);
                if (channelInfo == null)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("delcom", "no_broadcaster_id", lang));
                    return;
                }

                var normalCommand = await _context.CustomCommands
                    .FirstOrDefaultAsync(c => c.CommandName == commandName && c.UserId == channelInfo.UserId);

                if (normalCommand != null)
                {
                    _context.CustomCommands.Remove(normalCommand);
                    await _context.SaveChangesAsync();
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("delcom", "deleted", lang, commandName));
                    return;
                }

                var scriptCommand = await _context.ScriptedCommands
                    .FirstOrDefaultAsync(c => c.CommandName == commandName && c.UserId == channelInfo.UserId);

                if (scriptCommand != null)
                {
                    _context.ScriptedCommands.Remove(scriptCommand);
                    await _context.SaveChangesAsync();
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("delcom", "deleted", lang, commandName));
                    return;
                }

                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("delcom", "not_found", lang, commandName));
            }
            catch (Exception)
            {
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("delcom", "error_generic", lang));
            }
        }
    }
}
