using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using Microsoft.Extensions.Logging;

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

    /// <summary>
    /// JSON DTO that mirrors the structure in Resources/bot-metadata/{lang}.json.
    /// Each command key maps to one of these entries.
    /// </summary>
    internal class CommandMetadataJson
    {
        public string Description { get; set; } = string.Empty;
        public string[] Aliases { get; set; } = Array.Empty<string>();
        public string[] UsageExamples { get; set; } = Array.Empty<string>();
    }

    /// <summary>
    /// Loads command metadata from JSON files in Resources/bot-metadata/.
    /// To add a new language, simply create a new JSON file (e.g., pt.json, fr.json).
    /// </summary>
    public class CommandTranslationService : ICommandTranslationService
    {
        // [language][commandName] => CommandMetadata
        private readonly Dictionary<string, Dictionary<string, CommandMetadata>> _metadata;
        private readonly ILogger<CommandTranslationService> _logger;

        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNameCaseInsensitive = true
        };

        public CommandTranslationService(ILogger<CommandTranslationService> logger)
        {
            _logger = logger;
            _metadata = LoadAllLanguages();
        }

        public CommandMetadata GetCommandMetadata(string commandName, string language = "es")
        {
            var normalizedName = commandName.TrimStart('!').ToLower();
            var normalizedLanguage = language?.ToLower() ?? "es";

            // Try requested language
            if (_metadata.TryGetValue(normalizedLanguage, out var commands) &&
                commands.TryGetValue(normalizedName, out var metadata))
            {
                return metadata;
            }

            // Fallback to Spanish
            if (normalizedLanguage != "es" &&
                _metadata.TryGetValue("es", out var esCommands) &&
                esCommands.TryGetValue(normalizedName, out var esFallback))
            {
                return esFallback;
            }

            // Generic fallback
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
            var normalizedLanguage = language?.ToLower() ?? "es";

            // Determine which language to iterate over (requested or fallback to es)
            Dictionary<string, CommandMetadata>? commands = null;
            if (_metadata.TryGetValue(normalizedLanguage, out var langCommands))
            {
                commands = langCommands;
            }
            else if (_metadata.TryGetValue("es", out var esCommands))
            {
                commands = esCommands;
            }

            if (commands == null)
            {
                return new List<CommandMetadata>();
            }

            // Use GetCommandMetadata so fallback logic is consistent
            var result = new List<CommandMetadata>();
            foreach (var commandName in commands.Keys)
            {
                result.Add(GetCommandMetadata(commandName, normalizedLanguage));
            }

            return result;
        }

        private Dictionary<string, Dictionary<string, CommandMetadata>> LoadAllLanguages()
        {
            var result = new Dictionary<string, Dictionary<string, CommandMetadata>>();

            // Look for JSON files in Resources/bot-metadata/
            var basePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Resources", "bot-metadata");

            // Also check the project root (for development)
            if (!Directory.Exists(basePath))
            {
                basePath = Path.Combine(Directory.GetCurrentDirectory(), "Resources", "bot-metadata");
            }

            if (!Directory.Exists(basePath))
            {
                _logger.LogWarning("Bot metadata directory not found at {Path}. Command metadata will use fallback values.", basePath);
                return result;
            }

            foreach (var file in Directory.GetFiles(basePath, "*.json"))
            {
                var language = Path.GetFileNameWithoutExtension(file).ToLower();
                try
                {
                    var json = File.ReadAllText(file);
                    var entries = JsonSerializer.Deserialize<Dictionary<string, CommandMetadataJson>>(json, _jsonOptions);
                    if (entries != null)
                    {
                        var commandDict = new Dictionary<string, CommandMetadata>();
                        foreach (var (name, entry) in entries)
                        {
                            commandDict[name.ToLower()] = new CommandMetadata
                            {
                                Name = name,
                                Description = entry.Description,
                                Aliases = entry.Aliases ?? Array.Empty<string>(),
                                UsageExamples = entry.UsageExamples ?? Array.Empty<string>()
                            };
                        }

                        result[language] = commandDict;
                        _logger.LogInformation("Loaded {Count} command metadata entries for language '{Lang}'",
                            commandDict.Count, language);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error loading bot metadata for language '{Lang}' from {File}", language, file);
                }
            }

            if (result.Count == 0)
            {
                _logger.LogWarning("No bot metadata files loaded. Command descriptions will use fallback values.");
            }

            return result;
        }
    }
}
