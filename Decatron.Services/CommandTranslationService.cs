using System.Collections.Generic;

namespace Decatron.Services
{
    /// <summary>
    /// Servicio para obtener traducciones de comandos basadas en el idioma del usuario
    /// </summary>
    public interface ICommandTranslationService
    {
        CommandMetadata GetCommandMetadata(string commandName, string language = "es");
        List<CommandMetadata> GetAllDefaultCommandsMetadata(string language = "es");
    }

    public class CommandMetadata
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string[] Aliases { get; set; } = Array.Empty<string>();
        public string[] UsageExamples { get; set; } = Array.Empty<string>();
    }

    public class CommandTranslationService : ICommandTranslationService
    {
        // Diccionario de traducciones: [commandName][language] => metadata
        private readonly Dictionary<string, Dictionary<string, CommandMetadata>> _translations;

        public CommandTranslationService()
        {
            _translations = InitializeTranslations();
        }

        public CommandMetadata GetCommandMetadata(string commandName, string language = "es")
        {
            var normalizedName = commandName.TrimStart('!').ToLower();

            if (_translations.TryGetValue(normalizedName, out var languageDict))
            {
                if (languageDict.TryGetValue(language, out var metadata))
                {
                    return metadata;
                }
                // Fallback a español si no existe el idioma
                if (languageDict.TryGetValue("es", out var fallback))
                {
                    return fallback;
                }
            }

            // Fallback genérico
            return new CommandMetadata
            {
                Name = commandName,
                Description = $"Comando {commandName}",
                Aliases = Array.Empty<string>(),
                UsageExamples = new[] { $"!{commandName}" }
            };
        }

        public List<CommandMetadata> GetAllDefaultCommandsMetadata(string language = "es")
        {
            var commands = new List<CommandMetadata>();

            foreach (var commandName in _translations.Keys)
            {
                commands.Add(GetCommandMetadata(commandName, language));
            }

            return commands;
        }

        private Dictionary<string, Dictionary<string, CommandMetadata>> InitializeTranslations()
        {
            return new Dictionary<string, Dictionary<string, CommandMetadata>>
            {
                ["title"] = new Dictionary<string, CommandMetadata>
                {
                    ["es"] = new CommandMetadata
                    {
                        Name = "title",
                        Description = "Cambia o consulta el título del stream",
                        Aliases = new[] { "t" },
                        UsageExamples = new[] { "!title", "!title Nuevo título del stream" }
                    },
                    ["en"] = new CommandMetadata
                    {
                        Name = "title",
                        Description = "Change or check the stream title",
                        Aliases = new[] { "t" },
                        UsageExamples = new[] { "!title", "!title New stream title" }
                    }
                },
                ["t"] = new Dictionary<string, CommandMetadata>
                {
                    ["es"] = new CommandMetadata
                    {
                        Name = "t",
                        Description = "Alias de !title - Cambia o consulta el título del stream",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!t", "!t Nuevo título" }
                    },
                    ["en"] = new CommandMetadata
                    {
                        Name = "t",
                        Description = "Alias for !title - Change or check the stream title",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!t", "!t New title" }
                    }
                },
                ["game"] = new Dictionary<string, CommandMetadata>
                {
                    ["es"] = new CommandMetadata
                    {
                        Name = "game",
                        Description = "Cambia o consulta la categoría/juego del stream",
                        Aliases = new[] { "g" },
                        UsageExamples = new[] { "!game", "!game Just Chatting" }
                    },
                    ["en"] = new CommandMetadata
                    {
                        Name = "game",
                        Description = "Change or check the stream category/game",
                        Aliases = new[] { "g" },
                        UsageExamples = new[] { "!game", "!game Just Chatting" }
                    }
                },
                ["g"] = new Dictionary<string, CommandMetadata>
                {
                    ["es"] = new CommandMetadata
                    {
                        Name = "g",
                        Description = "Comando de gestión de categorías y micro comandos",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!g", "!g Just Chatting" }
                    },
                    ["en"] = new CommandMetadata
                    {
                        Name = "g",
                        Description = "Category and micro commands management",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!g", "!g Just Chatting" }
                    }
                },
                ["dstart"] = new Dictionary<string, CommandMetadata>
                {
                    ["es"] = new CommandMetadata
                    {
                        Name = "dstart",
                        Description = "Inicia el timer con una duración específica",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!dstart 5m", "!dstart 1h30m", "!dstart 300" }
                    },
                    ["en"] = new CommandMetadata
                    {
                        Name = "dstart",
                        Description = "Start the timer with a specific duration",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!dstart 5m", "!dstart 1h30m", "!dstart 300" }
                    }
                },
                ["dpause"] = new Dictionary<string, CommandMetadata>
                {
                    ["es"] = new CommandMetadata
                    {
                        Name = "dpause",
                        Description = "Pausa el timer actual",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!dpause" }
                    },
                    ["en"] = new CommandMetadata
                    {
                        Name = "dpause",
                        Description = "Pause the current timer",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!dpause" }
                    }
                },
                ["dplay"] = new Dictionary<string, CommandMetadata>
                {
                    ["es"] = new CommandMetadata
                    {
                        Name = "dplay",
                        Description = "Resume o inicia el timer pausado",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!dplay" }
                    },
                    ["en"] = new CommandMetadata
                    {
                        Name = "dplay",
                        Description = "Resume or start the paused timer",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!dplay" }
                    }
                },
                ["dreset"] = new Dictionary<string, CommandMetadata>
                {
                    ["es"] = new CommandMetadata
                    {
                        Name = "dreset",
                        Description = "Reinicia el timer al tiempo total configurado",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!dreset" }
                    },
                    ["en"] = new CommandMetadata
                    {
                        Name = "dreset",
                        Description = "Reset the timer to the configured total time",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!dreset" }
                    }
                },
                ["dstop"] = new Dictionary<string, CommandMetadata>
                {
                    ["es"] = new CommandMetadata
                    {
                        Name = "dstop",
                        Description = "Detiene el timer completamente y lo oculta del overlay",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!dstop" }
                    },
                    ["en"] = new CommandMetadata
                    {
                        Name = "dstop",
                        Description = "Stop the timer completely and hide it from overlay",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!dstop" }
                    }
                },
                ["dtimer"] = new Dictionary<string, CommandMetadata>
                {
                    ["es"] = new CommandMetadata
                    {
                        Name = "dtimer",
                        Description = "Gestiona el timer: iniciar, añadir o remover tiempo",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!dtimer 5m", "!dtimer add 1h", "!dtimer remove 30s" }
                    },
                    ["en"] = new CommandMetadata
                    {
                        Name = "dtimer",
                        Description = "Manage timer: start, add or remove time",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!dtimer 5m", "!dtimer add 1h", "!dtimer remove 30s" }
                    }
                },
                ["so"] = new Dictionary<string, CommandMetadata>
                {
                    ["es"] = new CommandMetadata
                    {
                        Name = "so",
                        Description = "Hace shoutout a un usuario mostrando su último clip y perfil",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!so @username", "!so username" }
                    },
                    ["en"] = new CommandMetadata
                    {
                        Name = "so",
                        Description = "Shoutout a user showing their latest clip and profile",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!so @username", "!so username" }
                    }
                },
                ["raffle"] = new Dictionary<string, CommandMetadata>
                {
                    ["es"] = new CommandMetadata
                    {
                        Name = "raffle",
                        Description = "Sistema de sorteos con participación de chat",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!raffle join", "!raffle create Nombre del sorteo", "!raffle close", "!raffle draw" }
                    },
                    ["en"] = new CommandMetadata
                    {
                        Name = "raffle",
                        Description = "Raffle system with chat participation",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!raffle join", "!raffle create Raffle name", "!raffle close", "!raffle draw" }
                    }
                },
                ["ia"] = new Dictionary<string, CommandMetadata>
                {
                    ["es"] = new CommandMetadata
                    {
                        Name = "ia",
                        Description = "Pregunta a Decatron IA (desarrollado por AnthonyDeca)",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!ia ¿Cuál es el sentido de la vida?", "!ia dame un dato curioso" }
                    },
                    ["en"] = new CommandMetadata
                    {
                        Name = "ia",
                        Description = "Ask Decatron AI (developed by AnthonyDeca)",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!ia What is the meaning of life?", "!ia give me a fun fact" }
                    }
                },
                ["join"] = new Dictionary<string, CommandMetadata>
                {
                    ["es"] = new CommandMetadata
                    {
                        Name = "join",
                        Description = "Únete al giveaway activo en el canal",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!join" }
                    },
                    ["en"] = new CommandMetadata
                    {
                        Name = "join",
                        Description = "Join the active giveaway in the channel",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!join" }
                    }
                },
                ["hola"] = new Dictionary<string, CommandMetadata>
                {
                    ["es"] = new CommandMetadata
                    {
                        Name = "hola",
                        Description = "Saluda al usuario en el chat",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "hola" }
                    },
                    ["en"] = new CommandMetadata
                    {
                        Name = "hola",
                        Description = "Greet the user in chat",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "hola" }
                    }
                },
                ["followage"] = new Dictionary<string, CommandMetadata>
                {
                    ["es"] = new CommandMetadata
                    {
                        Name = "followage",
                        Description = "Muestra el tiempo que llevas siguiendo el canal",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!followage", "!followage @usuario" }
                    },
                    ["en"] = new CommandMetadata
                    {
                        Name = "followage",
                        Description = "Shows how long you've been following the channel",
                        Aliases = Array.Empty<string>(),
                        UsageExamples = new[] { "!followage", "!followage @user" }
                    }
                }
            };
        }
    }
}
