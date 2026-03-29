using System.Collections.Generic;
using System.Linq;

namespace Decatron.Services
{
    /// <summary>
    /// Servicio para obtener traducciones de mensajes de comandos basadas en el idioma del usuario
    /// </summary>
    public interface ICommandMessagesService
    {
        string GetMessage(string commandName, string messageKey, string language = "es", params object[] args);
    }

    public class CommandMessagesService : ICommandMessagesService
    {
        // Diccionario de traducciones: [commandName][messageKey][language] => message template
        private readonly Dictionary<string, Dictionary<string, Dictionary<string, string>>> _messages;

        public CommandMessagesService()
        {
            _messages = InitializeMessages();
        }

        public string GetMessage(string commandName, string messageKey, string language = "es", params object[] args)
        {
            var normalizedCommand = commandName.TrimStart('!').ToLower();
            var normalizedLanguage = language?.ToLower() ?? "es";

            // Intentar obtener el mensaje
            if (_messages.TryGetValue(normalizedCommand, out var commandMessages))
            {
                if (commandMessages.TryGetValue(messageKey, out var languageMessages))
                {
                    if (languageMessages.TryGetValue(normalizedLanguage, out var messageTemplate))
                    {
                        // Si hay argumentos, formatear el mensaje
                        if (args != null && args.Length > 0)
                        {
                            try
                            {
                                return string.Format(messageTemplate, args);
                            }
                            catch
                            {
                                // Si falla el formateo, retornar template sin formatear
                                return messageTemplate;
                            }
                        }
                        return messageTemplate;
                    }

                    // Fallback a español si no existe el idioma
                    if (languageMessages.TryGetValue("es", out var fallbackMessage))
                    {
                        if (args != null && args.Length > 0)
                        {
                            try { return string.Format(fallbackMessage, args); }
                            catch { return fallbackMessage; }
                        }
                        return fallbackMessage;
                    }
                }
            }

            // Fallback genérico si no se encuentra el mensaje
            return $"[Missing translation: {commandName}.{messageKey}.{language}]";
        }

        private Dictionary<string, Dictionary<string, Dictionary<string, string>>> InitializeMessages()
        {
            return new Dictionary<string, Dictionary<string, Dictionary<string, string>>>
            {
                // ============================================
                // GAME COMMAND
                // ============================================
                ["game"] = new Dictionary<string, Dictionary<string, string>>
                {
                    ["error_channel_info"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error: No se pudo obtener información del canal.",
                        ["en"] = "Error: Could not get channel information."
                    },
                    ["current_category"] = new Dictionary<string, string>
                    {
                        ["es"] = "Categoría actual: {0}",
                        ["en"] = "Current category: {0}"
                    },
                    ["error_get_category"] = new Dictionary<string, string>
                    {
                        ["es"] = "No se pudo obtener la categoría actual del stream.",
                        ["en"] = "Could not get current stream category."
                    },
                    ["permission_denied"] = new Dictionary<string, string>
                    {
                        ["es"] = "Solo los moderadores o el propietario del canal pueden cambiar la categoría del stream.",
                        ["en"] = "Only moderators or the channel owner can change the stream category."
                    },
                    ["error_validation"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error: {0}",
                        ["en"] = "Error: {0}"
                    },
                    ["success"] = new Dictionary<string, string>
                    {
                        ["es"] = "¡Categoría cambiada a: {0}!",
                        ["en"] = "Category changed to: {0}!"
                    },
                    ["error_change"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error al cambiar la categoría del stream.",
                        ["en"] = "Error changing stream category."
                    },
                    ["error_generic"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error al procesar el comando de categoría.",
                        ["en"] = "Error processing category command."
                    }
                },

                // ============================================
                // DECATRON AI COMMAND
                // ============================================
                ["ia"] = new Dictionary<string, Dictionary<string, string>>
                {
                    ["channel_cooldown"] = new Dictionary<string, string>
                    {
                        ["es"] = "@{0}, debes esperar {1} antes de usar !ia de nuevo.",
                        ["en"] = "@{0}, you must wait {1} before using !ia again."
                    },
                    ["user_cooldown"] = new Dictionary<string, string>
                    {
                        ["es"] = "@{0}, debes esperar {1} antes de usar !ia de nuevo.",
                        ["en"] = "@{0}, you must wait {1} before using !ia again."
                    },
                    ["usage"] = new Dictionary<string, string>
                    {
                        ["es"] = "@{0}, uso: !ia <tu pregunta>",
                        ["en"] = "@{0}, usage: !ia <your question>"
                    },
                    ["prompt_too_long"] = new Dictionary<string, string>
                    {
                        ["es"] = "@{0}, tu pregunta es muy larga (máx {1} caracteres).",
                        ["en"] = "@{0}, your question is too long (max {1} characters)."
                    },
                    ["error_processing"] = new Dictionary<string, string>
                    {
                        ["es"] = "@{0}, no pude procesar tu pregunta. Intenta de nuevo.",
                        ["en"] = "@{0}, I couldn't process your question. Try again."
                    },
                    ["error_generic"] = new Dictionary<string, string>
                    {
                        ["es"] = "@{0}, ocurrió un error. Intenta más tarde.",
                        ["en"] = "@{0}, an error occurred. Try again later."
                    },
                    ["permission_denied_broadcaster"] = new Dictionary<string, string>
                    {
                        ["es"] = "@{0}, solo el streamer puede usar !ia en este canal.",
                        ["en"] = "@{0}, only the streamer can use !ia in this channel."
                    },
                    ["permission_denied_level"] = new Dictionary<string, string>
                    {
                        ["es"] = "@{0}, no tienes el nivel de permiso requerido para usar !ia.",
                        ["en"] = "@{0}, you don't have the required permission level to use !ia."
                    }
                },

                // ============================================
                // TITLE COMMAND
                // ============================================
                ["title"] = new Dictionary<string, Dictionary<string, string>>
                {
                    ["error_channel_info"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error: No se pudo obtener información del canal.",
                        ["en"] = "Error: Could not get channel information."
                    },
                    ["current_title"] = new Dictionary<string, string>
                    {
                        ["es"] = "Título actual: {0}",
                        ["en"] = "Current title: {0}"
                    },
                    ["error_get_title"] = new Dictionary<string, string>
                    {
                        ["es"] = "No se pudo obtener el título actual del stream.",
                        ["en"] = "Could not get current stream title."
                    },
                    ["permission_denied"] = new Dictionary<string, string>
                    {
                        ["es"] = "Solo los moderadores o el propietario del canal pueden cambiar el título del stream.",
                        ["en"] = "Only moderators or the channel owner can change the stream title."
                    },
                    ["error_validation"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error: {0}",
                        ["en"] = "Error: {0}"
                    },
                    ["success"] = new Dictionary<string, string>
                    {
                        ["es"] = "¡Título cambiado a: {0}!",
                        ["en"] = "Title changed to: {0}!"
                    },
                    ["error_change"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error al cambiar el título del stream.",
                        ["en"] = "Error changing stream title."
                    },
                    ["error_generic"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error al procesar el comando de título.",
                        ["en"] = "Error processing title command."
                    }
                },

                // ============================================
                // TIMER COMMANDS (dstart, dpause, dplay, dreset, dstop, dtimer)
                // ============================================
                ["dstart"] = new Dictionary<string, Dictionary<string, string>>
                {
                    ["usage"] = new Dictionary<string, string>
                    {
                        ["es"] = "Uso: !dstart <duración> (ej: !dstart 5m, !dstart 1h30m, !dstart 300)",
                        ["en"] = "Usage: !dstart <duration> (e.g.: !dstart 5m, !dstart 1h30m, !dstart 300)"
                    },
                    ["error_parse"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error: Formato de tiempo inválido. Usa: 5m, 1h30m, o segundos (300)",
                        ["en"] = "Error: Invalid time format. Use: 5m, 1h30m, or seconds (300)"
                    },
                    ["success"] = new Dictionary<string, string>
                    {
                        ["es"] = "Timer iniciado: {0}",
                        ["en"] = "Timer started: {0}"
                    },
                    ["error_generic"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error al iniciar el timer.",
                        ["en"] = "Error starting timer."
                    }
                },

                ["dpause"] = new Dictionary<string, Dictionary<string, string>>
                {
                    ["success"] = new Dictionary<string, string>
                    {
                        ["es"] = "Timer pausado",
                        ["en"] = "Timer paused"
                    },
                    ["error_not_running"] = new Dictionary<string, string>
                    {
                        ["es"] = "No hay timer en ejecución.",
                        ["en"] = "No timer is running."
                    },
                    ["error_generic"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error al pausar el timer.",
                        ["en"] = "Error pausing timer."
                    }
                },

                ["dplay"] = new Dictionary<string, Dictionary<string, string>>
                {
                    ["success"] = new Dictionary<string, string>
                    {
                        ["es"] = "Timer reanudado",
                        ["en"] = "Timer resumed"
                    },
                    ["error_not_paused"] = new Dictionary<string, string>
                    {
                        ["es"] = "El timer no está pausado.",
                        ["en"] = "Timer is not paused."
                    },
                    ["error_generic"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error al reanudar el timer.",
                        ["en"] = "Error resuming timer."
                    }
                },

                ["dreset"] = new Dictionary<string, Dictionary<string, string>>
                {
                    ["success"] = new Dictionary<string, string>
                    {
                        ["es"] = "Timer reiniciado",
                        ["en"] = "Timer reset"
                    },
                    ["error_generic"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error al reiniciar el timer.",
                        ["en"] = "Error resetting timer."
                    }
                },

                ["dstop"] = new Dictionary<string, Dictionary<string, string>>
                {
                    ["success"] = new Dictionary<string, string>
                    {
                        ["es"] = "Timer detenido",
                        ["en"] = "Timer stopped"
                    },
                    ["error_generic"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error al detener el timer.",
                        ["en"] = "Error stopping timer."
                    }
                },

                ["dtimer"] = new Dictionary<string, Dictionary<string, string>>
                {
                    ["usage"] = new Dictionary<string, string>
                    {
                        ["es"] = "Uso: !dtimer <duración>, !dtimer add <tiempo>, !dtimer remove <tiempo>",
                        ["en"] = "Usage: !dtimer <duration>, !dtimer add <time>, !dtimer remove <time>"
                    },
                    ["time_added"] = new Dictionary<string, string>
                    {
                        ["es"] = "Tiempo añadido: {0}",
                        ["en"] = "Time added: {0}"
                    },
                    ["time_removed"] = new Dictionary<string, string>
                    {
                        ["es"] = "Tiempo removido: {0}",
                        ["en"] = "Time removed: {0}"
                    },
                    ["error_generic"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error al gestionar el timer.",
                        ["en"] = "Error managing timer."
                    }
                },

                // ============================================
                // SHOUTOUT COMMAND
                // ============================================
                ["so"] = new Dictionary<string, Dictionary<string, string>>
                {
                    ["usage"] = new Dictionary<string, string>
                    {
                        ["es"] = "Uso: !so @usuario o !so usuario",
                        ["en"] = "Usage: !so @username or !so username"
                    },
                    ["error_user_not_found"] = new Dictionary<string, string>
                    {
                        ["es"] = "No se pudo encontrar al usuario {0}",
                        ["en"] = "Could not find user {0}"
                    },
                    ["error_generic"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error al hacer shoutout.",
                        ["en"] = "Error performing shoutout."
                    }
                },

                // ============================================
                // RAFFLE COMMAND
                // ============================================
                ["raffle"] = new Dictionary<string, Dictionary<string, string>>
                {
                    ["usage"] = new Dictionary<string, string>
                    {
                        ["es"] = "Uso: !raffle <create|join|close|draw|status>",
                        ["en"] = "Usage: !raffle <create|join|close|draw|status>"
                    },
                    ["created"] = new Dictionary<string, string>
                    {
                        ["es"] = "¡Sorteo creado! Usa !raffle join para participar.",
                        ["en"] = "Raffle created! Use !raffle join to participate."
                    },
                    ["joined"] = new Dictionary<string, string>
                    {
                        ["es"] = "@{0}, te has unido al sorteo.",
                        ["en"] = "@{0}, you joined the raffle."
                    },
                    ["already_joined"] = new Dictionary<string, string>
                    {
                        ["es"] = "@{0}, ya estás participando.",
                        ["en"] = "@{0}, you're already participating."
                    },
                    ["no_active_raffle"] = new Dictionary<string, string>
                    {
                        ["es"] = "No hay sorteo activo.",
                        ["en"] = "No active raffle."
                    },
                    ["winner"] = new Dictionary<string, string>
                    {
                        ["es"] = "🎉 ¡Ganador del sorteo: @{0}!",
                        ["en"] = "🎉 Raffle winner: @{0}!"
                    },
                    ["error_generic"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error al procesar el comando de sorteo.",
                        ["en"] = "Error processing raffle command."
                    }
                },

                // ============================================
                // GIVEAWAY COMMAND (join)
                // ============================================
                ["join"] = new Dictionary<string, Dictionary<string, string>>
                {
                    ["success"] = new Dictionary<string, string>
                    {
                        ["es"] = "@{0}, te has unido al giveaway.",
                        ["en"] = "@{0}, you joined the giveaway."
                    },
                    ["already_joined"] = new Dictionary<string, string>
                    {
                        ["es"] = "@{0}, ya estás participando.",
                        ["en"] = "@{0}, you're already participating."
                    },
                    ["no_active_giveaway"] = new Dictionary<string, string>
                    {
                        ["es"] = "No hay giveaway activo.",
                        ["en"] = "No active giveaway."
                    },
                    ["error_generic"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error al unirse al giveaway.",
                        ["en"] = "Error joining giveaway."
                    }
                },

                // ============================================
                // HOLA COMMAND
                // ============================================
                ["hola"] = new Dictionary<string, Dictionary<string, string>>
                {
                    ["greeting"] = new Dictionary<string, string>
                    {
                        ["es"] = "¡Hola @{0}! 👋 ¿Cómo estás?",
                        ["en"] = "Hello @{0}! 👋 How are you?"
                    }
                },

                // ============================================
                // G COMMAND (!g) - Gestión de categorías y micro comandos
                // ============================================
                ["g"] = new Dictionary<string, Dictionary<string, string>>
                {
                    ["error_channel_info"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error: No se pudo obtener información del canal.",
                        ["en"] = "Error: Could not get channel information."
                    },
                    ["current_category"] = new Dictionary<string, string>
                    {
                        ["es"] = "Categoría actual: {0}",
                        ["en"] = "Current category: {0}"
                    },
                    ["error_get_category"] = new Dictionary<string, string>
                    {
                        ["es"] = "No se pudo obtener la categoría actual del stream.",
                        ["en"] = "Could not get current stream category."
                    },
                    ["permission_denied"] = new Dictionary<string, string>
                    {
                        ["es"] = "Solo los moderadores o el propietario del canal pueden cambiar la categoría.",
                        ["en"] = "Only moderators or the channel owner can change the category."
                    },
                    ["permission_denied_micro"] = new Dictionary<string, string>
                    {
                        ["es"] = "Solo los moderadores o el propietario del canal pueden gestionar micro comandos.",
                        ["en"] = "Only moderators or the channel owner can manage micro commands."
                    },
                    ["error_validation"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error: {0}",
                        ["en"] = "Error: {0}"
                    },
                    ["success"] = new Dictionary<string, string>
                    {
                        ["es"] = "¡Categoría cambiada a: {0}!",
                        ["en"] = "Category changed to: {0}!"
                    },
                    ["error_change"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error al cambiar la categoría.",
                        ["en"] = "Error changing category."
                    },
                    ["error_generic"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error al procesar el comando !g.",
                        ["en"] = "Error processing !g command."
                    },
                    ["help"] = new Dictionary<string, string>
                    {
                        ["es"] = "Uso: !g = categoría actual | !g [categoría] = cambiar | !g help | !g list | !g set [!cmd] [categoría] | !g remove [!cmd]",
                        ["en"] = "Usage: !g = current category | !g [category] = change | !g help | !g list | !g set [!cmd] [category] | !g remove [!cmd]"
                    },
                    ["micro_list"] = new Dictionary<string, string>
                    {
                        ["es"] = "Micro comandos disponibles: {0}",
                        ["en"] = "Available micro commands: {0}"
                    },
                    ["micro_list_empty"] = new Dictionary<string, string>
                    {
                        ["es"] = "No hay micro comandos configurados. Usa !g set [!comando] [categoría] para crear uno.",
                        ["en"] = "No micro commands configured. Use !g set [!command] [category] to create one."
                    },
                    ["micro_set_usage"] = new Dictionary<string, string>
                    {
                        ["es"] = "Uso: !g set [!comando] [categoría]. Ejemplo: !g set !apex Apex Legends",
                        ["en"] = "Usage: !g set [!command] [category]. Example: !g set !apex Apex Legends"
                    },
                    ["micro_reserved"] = new Dictionary<string, string>
                    {
                        ["es"] = "'{0}' es una palabra reservada y no se puede usar.",
                        ["en"] = "'{0}' is a reserved word and cannot be used."
                    },
                    ["micro_created"] = new Dictionary<string, string>
                    {
                        ["es"] = "Micro comando {0} creado para: {1}",
                        ["en"] = "Micro command {0} created for: {1}"
                    },
                    ["micro_updated"] = new Dictionary<string, string>
                    {
                        ["es"] = "Micro comando {0} actualizado a: {1}",
                        ["en"] = "Micro command {0} updated to: {1}"
                    },
                    ["micro_error_create"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error al crear el micro comando.",
                        ["en"] = "Error creating micro command."
                    },
                    ["micro_remove_usage"] = new Dictionary<string, string>
                    {
                        ["es"] = "Uso: !g remove [!comando]. Ejemplo: !g remove !apex",
                        ["en"] = "Usage: !g remove [!command]. Example: !g remove !apex"
                    },
                    ["micro_not_found"] = new Dictionary<string, string>
                    {
                        ["es"] = "Micro comando {0} no encontrado.",
                        ["en"] = "Micro command {0} not found."
                    },
                    ["micro_removed"] = new Dictionary<string, string>
                    {
                        ["es"] = "Micro comando {0} eliminado.",
                        ["en"] = "Micro command {0} deleted."
                    },
                    ["micro_error_remove"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error al eliminar el micro comando.",
                        ["en"] = "Error deleting micro command."
                    },
                    ["micro_error_list"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error al listar micro comandos.",
                        ["en"] = "Error listing micro commands."
                    }
                },

                // ============================================
                // MICRO COMMANDS (ejecución de micro comandos)
                // ============================================
                ["micro"] = new Dictionary<string, Dictionary<string, string>>
                {
                    ["permission_denied"] = new Dictionary<string, string>
                    {
                        ["es"] = "Solo los moderadores o el propietario del canal pueden usar {0}.",
                        ["en"] = "Only moderators or the channel owner can use {0}."
                    },
                    ["error_validation"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error: La categoría '{0}' no es válida.",
                        ["en"] = "Error: Category '{0}' is not valid."
                    },
                    ["success"] = new Dictionary<string, string>
                    {
                        ["es"] = "¡Categoría cambiada a: {0}! (usando {1})",
                        ["en"] = "Category changed to: {0}! (using {1})"
                    },
                    ["error_change"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error al cambiar la categoría usando {0}.",
                        ["en"] = "Error changing category using {0}."
                    },
                    ["error_generic"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error al procesar el micro comando.",
                        ["en"] = "Error processing micro command."
                    },
                    ["error_channel_info"] = new Dictionary<string, string>
                    {
                        ["es"] = "Error: No se pudo obtener información del canal.",
                        ["en"] = "Error: Could not get channel information."
                    }
                }
            };
        }
    }
}
