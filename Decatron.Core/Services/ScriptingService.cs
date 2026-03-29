// Scripting/Services/ScriptingService.cs
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Decatron.Core.Functions;
using Decatron.Core.Helpers;
using Decatron.Core.Models;
using Decatron.Core.Resolvers;
using Decatron.Scripting.Core;
using Decatron.Scripting.Exceptions;
using Decatron.Scripting.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Scripting.Services
{
    public class ScriptingService
    {
        private readonly ILogger<ScriptingService> _logger;
        private readonly IServiceProvider _serviceProvider;
        private readonly ScriptParser _parser;
        private readonly ScriptExecutor _executor;

        public ScriptingService(
            ILogger<ScriptingService> logger,
            IServiceProvider serviceProvider)
        {
            _logger = logger;
            _serviceProvider = serviceProvider;
            _parser = new ScriptParser();
            _executor = new ScriptExecutor();
        }

        /// <summary>
        /// Crear un nuevo comando con script
        /// </summary>
        public async Task<bool> CreateScriptedCommandAsync(string channelName, string commandName, string scriptContent, long userId)
        {
            try
            {
                // Validar sintaxis del script
                _parser.Parse(scriptContent);

                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var normalizedChannel = channelName.ToLower();
                var normalizedCommand = commandName.ToLower();

                var existing = await dbContext.ScriptedCommands
                    .FirstOrDefaultAsync(c => c.ChannelName == normalizedChannel && c.CommandName == normalizedCommand);

                if (existing != null)
                {
                    existing.ScriptContent = scriptContent;
                    existing.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    dbContext.ScriptedCommands.Add(new ScriptCommand
                    {
                        UserId = userId,
                        ChannelName = normalizedChannel,
                        CommandName = normalizedCommand,
                        ScriptContent = scriptContent,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    });
                }

                var rowsAffected = await dbContext.SaveChangesAsync();
                return rowsAffected > 0;
            }
            catch (ScriptParseException ex)
            {
                _logger.LogWarning($"Error de sintaxis en script para comando {commandName}: {ex.Message}");
                throw new ScriptingServiceException($"Error de sintaxis: {ex.Message}", ex);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error creando comando con script {commandName} en {channelName}");
                throw new ScriptingServiceException($"Error creando comando: {ex.Message}", ex);
            }
        }


        /// <summary>
        /// Ejecutar un comando con script
        /// </summary>
        public async Task<ScriptExecutionResult> ExecuteScriptedCommandAsync(
            string channelName,
            string commandName,
            string executingUser,
            string[]? commandArgs = null)
        {
            try
            {
                // Obtener script de BD
                var scriptCommand = await GetScriptedCommand(channelName, commandName);
                if (scriptCommand == null)
                {
                    return new ScriptExecutionResult
                    {
                        Success = false,
                        ErrorMessage = "Comando con script no encontrado"
                    };
                }

                if (!scriptCommand.IsActive)
                {
                    return new ScriptExecutionResult
                    {
                        Success = false,
                        ErrorMessage = "Comando desactivado"
                    };
                }

                // Parsear script
                var program = _parser.Parse(scriptCommand.ScriptContent);

                // Create execution context — only resolves API variables the script actually uses
                var context = await CreateExecutionContext(channelName, commandName, executingUser, commandArgs, scriptCommand.ScriptContent);

                // Ejecutar script
                return await _executor.ExecuteAsync(program, context);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error ejecutando comando con script {commandName} en {channelName}");
                return new ScriptExecutionResult
                {
                    Success = false,
                    ErrorMessage = $"Error de ejecución: {ex.Message}"
                };
            }
        }

        /// <summary>
        /// Verificar si un comando tiene script asociado
        /// </summary>
        public async Task<bool> IsScriptedCommandAsync(string channelName, string commandName)
        {
            try
            {
                var scriptCommand = await GetScriptedCommand(channelName, commandName);
                return scriptCommand != null && scriptCommand.IsActive;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando comando con script {commandName} en {channelName}");
                return false;
            }
        }

        /// <summary>
        /// Validar sintaxis de un script sin ejecutarlo
        /// </summary>
        public async Task<ScriptValidationResult> ValidateScriptAsync(string scriptContent)
        {
            try
            {

                _parser.Parse(scriptContent);

                return new ScriptValidationResult { IsValid = true };
            }
            catch (ScriptParseException ex)
            {
                return new ScriptValidationResult
                {
                    IsValid = false,
                    ErrorMessage = ex.Message,
                    ErrorLine = ex.LineNumber
                };
            }
            catch (Exception ex)
            {
                return new ScriptValidationResult
                {
                    IsValid = false,
                    ErrorMessage = $"Error inesperado: {ex.Message}"
                };
            }
        }

        /// <summary>
        /// Ejecutar preview de un script con datos de prueba (sin guardar en BD)
        /// </summary>
        public async Task<ScriptExecutionResult> ExecuteScriptPreviewAsync(
            string scriptContent,
            string commandName = "test")
        {
            try
            {
                _logger.LogInformation($"Ejecutando preview de script para comando {commandName}");

                // Parsear el script
                var program = _parser.Parse(scriptContent);

                // Crear contexto de prueba con datos simulados
                var context = new ScriptExecutionContext
                {
                    ChannelName = "test_channel",
                    CommandName = commandName,
                    ExecutingUser = "TestUser"
                };

                // Poblar variables builtin con datos de prueba realistas
                context.BuiltinVariables["user"] = "TestUser";
                context.BuiltinVariables["channel"] = "test_channel";
                context.BuiltinVariables["game"] = "Just Chatting";
                context.BuiltinVariables["uptime"] = "2h 30m";
                context.BuiltinVariables["ruser"] = "RandomViewer";
                context.BuiltinVariables["touser"] = "MentionedUser";

                // Ejecutar el script
                var result = await _executor.ExecuteAsync(program, context);

                _logger.LogInformation($"Preview completado. Success: {result.Success}, Mensajes: {result.OutputMessages?.Count ?? 0}");

                return result;
            }
            catch (ScriptParseException ex)
            {
                _logger.LogWarning($"Error de sintaxis en preview: {ex.Message}");
                return new ScriptExecutionResult
                {
                    Success = false,
                    ErrorMessage = $"Error de sintaxis en línea {ex.LineNumber}: {ex.Message}",
                    ErrorLine = ex.LineNumber
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error ejecutando preview del script");
                return new ScriptExecutionResult
                {
                    Success = false,
                    ErrorMessage = $"Error de ejecución: {ex.Message}"
                };
            }
        }

        private async Task<ScriptCommand?> GetScriptedCommand(string channelName, string commandName)
        {
            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            return await dbContext.ScriptedCommands
                .FirstOrDefaultAsync(c => c.ChannelName == channelName.ToLower() && c.CommandName == commandName.ToLower());
        }


        private async Task<ScriptExecutionContext> CreateExecutionContext(
            string channelName,
            string commandName,
            string executingUser,
            string[] commandArgs,
            string scriptContent = "")
        {
            var context = new ScriptExecutionContext
            {
                ChannelName = channelName,
                CommandName = commandName,
                ExecutingUser = executingUser
            };

            // Variables síncronas — siempre disponibles, instantáneas
            context.BuiltinVariables["user"] = executingUser;
            context.BuiltinVariables["channel"] = channelName;
            context.BuiltinVariables["touser"] = ExtractMentionedUser(commandArgs) ?? executingUser;

            // Solo resolver variables dinámicas (API calls) si el script las usa
            var needsGame = scriptContent.Contains("$(game)");
            var needsUptime = scriptContent.Contains("$(uptime)");
            var needsRuser = scriptContent.Contains("$(ruser)");

            if (needsGame || needsUptime || needsRuser)
            {
                try
                {
                    using var scope = _serviceProvider.CreateScope();
                    var variableResolver = scope.ServiceProvider.GetRequiredService<VariableResolver>();
                    var varContext = new VariableContext(channelName, commandName, executingUser)
                    {
                        ToUser = ExtractMentionedUser(commandArgs),
                        Args = commandArgs
                    };

                    if (needsGame)
                        context.BuiltinVariables["game"] = await variableResolver.ResolveAsync("$(game)", varContext);
                    if (needsUptime)
                        context.BuiltinVariables["uptime"] = await variableResolver.ResolveAsync("$(uptime)", varContext);
                    if (needsRuser)
                        context.BuiltinVariables["ruser"] = await variableResolver.ResolveAsync("$(ruser)", varContext);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("Error resolving dynamic variables: {Error}", ex.Message);
                    if (needsGame) context.BuiltinVariables.TryAdd("game", "Unknown");
                    if (needsUptime) context.BuiltinVariables.TryAdd("uptime", "Unknown");
                    if (needsRuser) context.BuiltinVariables.TryAdd("ruser", executingUser);
                }
            }

            return context;
        }

        private string ExtractMentionedUser(string[] args)
        {
            if (args == null || args.Length == 0) return null;

            foreach (var arg in args)
            {
                if (arg.StartsWith("@"))
                {
                    return arg.Substring(1).ToLower(); // Remover @ del inicio y convertir a minúsculas
                }
            }

            // Si no hay @ pero hay argumentos, tomar el primer argumento como usuario mencionado
            if (args.Length > 0 && !string.IsNullOrWhiteSpace(args[0]))
            {
                return args[0].ToLower();
            }

            return null;
        }
    }

    // Excepciones específicas del servicio
    public class ScriptingServiceException : Exception
    {
        public ScriptingServiceException(string message) : base(message) { }
        public ScriptingServiceException(string message, Exception innerException) : base(message, innerException) { }
    }

    public class ScriptValidationResult
    {
        public bool IsValid { get; set; }
        public string ErrorMessage { get; set; }
        public int ErrorLine { get; set; }
    }
}