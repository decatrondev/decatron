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

        public string Name => "!crear";
        public string Description => "Crear comandos personalizados con o sin scripting";

        public CreateCommand(
            DecatronDbContext context,
            IConfiguration configuration,
            ScriptingService scriptingService)
        {
            _context = context;
            _configuration = configuration;
            _gameFunction = new GameFunction(configuration);
            _uptimeFunction = new UptimeFunction(configuration);
            _scriptingService = scriptingService;
        }

        public async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            var username = context.Username;
            var channel = context.Channel;
            var message = context.Message;

            var parts = message.Split(' ');

            if (parts.Length < 3)
            {
                await messageSender.SendMessageAsync(channel,
                    "Uso: !crear <nombre_comando> <respuesta/script> [restricción] [activo/inactivo]\n" +
                    "Para scripting usa: set, when, then, else, end, send, roll(), pick(), count()");
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
                    await messageSender.SendMessageAsync(channel, "No tienes permiso para usar este comando.");
                    return;
                }

                var broadcasterId = await Utils.GetBroadcasterIdFromDatabaseAsync(_configuration, channel.ToLower());
                if (broadcasterId == null)
                {
                    await messageSender.SendMessageAsync(channel, "No se encontró el broadcaster ID.");
                    return;
                }


                // Detectar si es un script o comando normal
                bool isScript = IsScriptContent(response);

                if (isScript)
                {
                    await CreateScriptedCommand(commandName, response, channel, Convert.ToInt64(broadcasterId), restriction, isActive, username, messageSender);
                }
                else
                {
                    await CreateNormalCommand(commandName, response, channel, broadcasterId, restriction, isActive, username, messageSender);
                }
            }
            catch (Exception ex)
            {
                await messageSender.SendMessageAsync(channel, "Ocurrió un error al crear el comando. Por favor, inténtalo de nuevo más tarde.");
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
        private async Task CreateScriptedCommand(string commandName, string response, string channelName, long broadcasterId, string restriction, bool isActive, string createdBy, IMessageSender messageSender)
        {
            try
            {
                if (await CommandExists(commandName, channelName))
                {
                    await messageSender.SendMessageAsync(channelName, $"El comando {commandName} ya existe. Usa !editar para modificarlo.");
                    return;
                }

                var formattedScript = FormatScriptForStorage(response);

                // SOLO guardar en scripted_commands, NO en custom_commands
                try
                {
                    await _scriptingService.CreateScriptedCommandAsync(channelName, commandName, formattedScript, broadcasterId);
                    await messageSender.SendMessageAsync(channelName, $"Comando con script {commandName} creado correctamente para el canal {channelName} con restricción: {restriction} y estado: {(isActive ? "activo" : "inactivo")}.");
                }
                catch (ScriptParseException ex)
                {
                    await messageSender.SendMessageAsync(channelName, $"Error en el script: {ex.Message}");
                }
            }
            catch (Exception ex)
            {
                await messageSender.SendMessageAsync(channelName, "Error al crear el comando con script.");
            }
        }

        // Crear comando normal - SOLO en custom_commands
        private async Task CreateNormalCommand(string commandName, string response, string channelName, string broadcasterId, string restriction, bool isActive, string createdBy, IMessageSender messageSender)
        {
            try
            {
                if (await CommandExists(commandName, channelName))
                {
                    await messageSender.SendMessageAsync(channelName, $"El comando {commandName} ya existe. Usa !editar para modificarlo.");
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
                    await messageSender.SendMessageAsync(channelName, $"Comando {commandName} creado correctamente para el canal {channelName} con restricción: {restriction} y estado: {(isActive ? "activo" : "inactivo")}.");
                }
                else
                {
                    await messageSender.SendMessageAsync(channelName, "No se pudo crear el comando. Por favor, inténtalo de nuevo.");
                }
            }
            catch (Exception ex)
            {
                await messageSender.SendMessageAsync(channelName, "Error al crear el comando.");
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