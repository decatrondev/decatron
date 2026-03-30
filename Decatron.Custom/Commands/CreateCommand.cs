using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
//using Decatron.Core.Exceptions;
using Decatron.Core.Functions;
using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Scripting.Exceptions;
using Decatron.Scripting.Services;
using Decatron.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json;

namespace Decatron.Custom.Commands
{
    public class CreateCommand : ICommand
    {
        private readonly DecatronDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly GameFunction _gameFunction;
        private readonly UptimeFunction _uptimeFunction;
        private readonly ScriptingService _scriptingService;
        private readonly ICommandMessagesService _messagesService;

        public string Name => "!crear";
        public string Description => "Crear comandos personalizados con o sin scripting";

        public CreateCommand(
            DecatronDbContext context,
            IConfiguration configuration,
            ScriptingService scriptingService,
            ICommandMessagesService messagesService)
        {
            _context = context;
            _configuration = configuration;
            _gameFunction = new GameFunction(configuration);
            _uptimeFunction = new UptimeFunction(configuration);
            _scriptingService = scriptingService;
            _messagesService = messagesService;
        }

        private async Task<string> GetChannelLanguageAsync(string channel)
        {
            try
            {
                var lang = await _context.Users
                    .Where(u => u.Login == channel.ToLower())
                    .Select(u => u.PreferredLanguage)
                    .FirstOrDefaultAsync();
                return lang ?? "es";
            }
            catch { return "es"; }
        }

        public async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            var username = context.Username;
            var channel = context.Channel;
            var message = context.Message;

            var parts = message.Split(' ');

            var lang = await GetChannelLanguageAsync(channel);

            if (parts.Length < 3)
            {
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("crear", "usage", lang));
                return;
            }

            var commandName = parts[1].ToLower();
            var response = string.Join(' ', parts.Skip(2));
            string restriction = "all";
            bool isActive = true;

            // Buscar la restricción y el estado de activación al final del comando
            var words = response.Split(' ').ToList();
            if (words.Count >= 2)
            {
                var lastWord = words.Last().ToLower();
                var secondLastWord = words[words.Count - 2].ToLower();

                if (lastWord == "activo" || lastWord == "inactivo")
                {
                    isActive = lastWord == "activo";
                    words.RemoveAt(words.Count - 1);

                    if (secondLastWord != "all" && secondLastWord != "mod" && secondLastWord != "vip" && secondLastWord != "sub")
                    {
                        restriction = "all";
                    }
                    else
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

            response = string.Join(' ', words);


            try
            {
                var isOwnerOrModerator = await Utils.IsOwnerOrModerator(_configuration, username, channel);
                if (!isOwnerOrModerator)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("crear", "no_permission", lang));
                    return;
                }

                var broadcasterId = await Utils.GetBroadcasterIdFromDatabaseAsync(_configuration, channel.ToLower());
                if (broadcasterId == null)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("crear", "no_broadcaster_id", lang));
                    return;
                }


                // Detectar si es un script o comando normal
                bool isScript = IsScriptContent(response);

                if (isScript)
                {
                    await CreateScriptedCommand(commandName, response, channel, Convert.ToInt64(broadcasterId), restriction, isActive, username, messageSender, lang);
                }
                else
                {
                    await CreateNormalCommand(commandName, response, channel, broadcasterId, restriction, isActive, username, messageSender, lang);
                }
            }
            catch (Exception ex)
            {
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("crear", "error_generic", lang));
            }
        }

        // Detectar si el contenido es un script
        private bool IsScriptContent(string content)
        {
            // Solo detectar como script si tiene keywords específicos de scripting
            // NO usar palabras sueltas como "then", "else", "end" que pueden aparecer en texto normal
            var scriptKeywords = new[] { "set ", "when ", " then", " else", " end", "send ", "roll(", "pick(" };
            var contentLower = content.ToLower();

            return scriptKeywords.Any(keyword => contentLower.Contains(keyword));
        }

        // Formatear script para almacenamiento
        private string FormatScriptForStorage(string rawScript)
        {
            var script = rawScript.Trim();

            script = script.Replace(" when ", "\nwhen ");
            script = script.Replace(" then ", " then\n    ");
            script = script.Replace(" else ", "\nelse\n    ");
            script = script.Replace(" end", "\nend");
            script = script.Replace(" send ", "\nsend ");

            var lines = script.Split('\n');
            for (int i = 0; i < lines.Length; i++)
            {
                var line = lines[i].Trim();
                if (line.Contains(" set ") && !line.TrimStart().StartsWith("set"))
                {
                    var setIndex = line.IndexOf(" set ");
                    if (setIndex > 0)
                    {
                        var firstPart = line.Substring(0, setIndex).Trim();
                        var secondPart = line.Substring(setIndex + 1).Trim();
                        lines[i] = firstPart + "\n" + secondPart;
                    }
                }
            }

            script = string.Join('\n', lines);

            while (script.Contains("\n\n\n"))
            {
                script = script.Replace("\n\n\n", "\n\n");
            }

            return script.Trim();
        }

        // Crear comando con script - SOLO en scripted_commands
        private async Task CreateScriptedCommand(string commandName, string response, string channelName, long broadcasterId, string restriction, bool isActive, string createdBy, IMessageSender messageSender, string lang)
        {
            try
            {
                if (await CommandExists(commandName, channelName))
                {
                    await messageSender.SendMessageAsync(channelName, _messagesService.GetMessage("crear", "already_exists", lang, commandName));
                    return;
                }

                var formattedScript = FormatScriptForStorage(response);

                try
                {
                    await _scriptingService.CreateScriptedCommandAsync(channelName, commandName, formattedScript, broadcasterId);
                    var statusText = _messagesService.GetMessage("crear", isActive ? "active" : "inactive", lang);
                    await messageSender.SendMessageAsync(channelName, _messagesService.GetMessage("crear", "script_created", lang, commandName, channelName, restriction, statusText));
                }
                catch (ScriptParseException ex)
                {
                    await messageSender.SendMessageAsync(channelName, _messagesService.GetMessage("crear", "script_error", lang, ex.Message));
                }
            }
            catch (Exception ex)
            {
                await messageSender.SendMessageAsync(channelName, _messagesService.GetMessage("crear", "script_error_generic", lang));
            }
        }

        // Crear comando normal - SOLO en custom_commands
        private async Task CreateNormalCommand(string commandName, string response, string channelName, string broadcasterId, string restriction, bool isActive, string createdBy, IMessageSender messageSender, string lang)
        {
            try
            {
                if (await CommandExists(commandName, channelName))
                {
                    await messageSender.SendMessageAsync(channelName, _messagesService.GetMessage("crear", "already_exists", lang, commandName));
                    return;
                }

                var customCommand = new CustomCommand
                {
                    ChannelName = channelName,
                    CommandName = commandName,
                    Response = response,
                    Restriction = restriction,
                    IsActive = isActive,
                    CreatedBy = createdBy,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    IsScripted = false,
                    ScriptContent = null
                };

                var success = await UtilsCrear.CreateCustomCommand(_context, customCommand);

                if (success)
                {
                    var statusText = _messagesService.GetMessage("crear", isActive ? "active" : "inactive", lang);
                    await messageSender.SendMessageAsync(channelName, _messagesService.GetMessage("crear", "command_created", lang, commandName, channelName, restriction, statusText));
                }
                else
                {
                    await messageSender.SendMessageAsync(channelName, _messagesService.GetMessage("crear", "command_create_failed", lang));
                }
            }
            catch (Exception ex)
            {
                await messageSender.SendMessageAsync(channelName, _messagesService.GetMessage("crear", "command_error_generic", lang));
            }
        }

        // Verificar si comando existe
        private async Task<bool> CommandExists(string commandName, string channelName)
        {
            try
            {
                var normalCommand = await UtilsCrear.GetCustomCommand(_context, commandName, channelName.ToLower());
                if (normalCommand != null) return true;

                bool scriptExists = await _scriptingService.IsScriptedCommandAsync(channelName, commandName);
                return scriptExists;
            }
            catch (Exception ex)
            {
                return false;
            }
        }
    }
}