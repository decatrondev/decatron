using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    /// <summary>
    /// Service for retrieving localized bot command messages.
    /// Messages are loaded from JSON files in Resources/bot-messages/{language}.json
    /// To add a new language, simply create a new JSON file (e.g., jp.json, pt.json).
    /// </summary>
    public interface ICommandMessagesService
    {
        string GetMessage(string commandName, string messageKey, string language = "es", params object[] args);
    }

    public class CommandMessagesService : ICommandMessagesService
    {
        // [language][command][messageKey] => message template
        private readonly Dictionary<string, Dictionary<string, Dictionary<string, string>>> _messages;
        private readonly ILogger<CommandMessagesService> _logger;

        public CommandMessagesService(ILogger<CommandMessagesService> logger)
        {
            _logger = logger;
            _messages = LoadAllLanguages();
        }

        public string GetMessage(string commandName, string messageKey, string language = "es", params object[] args)
        {
            var normalizedCommand = commandName.TrimStart('!').ToLower();
            var normalizedLanguage = language?.ToLower() ?? "es";

            // Try requested language
            var template = FindMessage(normalizedLanguage, normalizedCommand, messageKey);

            // Fallback to Spanish
            if (template == null && normalizedLanguage != "es")
            {
                template = FindMessage("es", normalizedCommand, messageKey);
            }

            if (template == null)
            {
                return $"[Missing: {commandName}.{messageKey}.{language}]";
            }

            if (args != null && args.Length > 0)
            {
                try { return string.Format(template, args); }
                catch { return template; }
            }

            return template;
        }

        private string? FindMessage(string language, string command, string key)
        {
            if (_messages.TryGetValue(language, out var commands) &&
                commands.TryGetValue(command, out var keys) &&
                keys.TryGetValue(key, out var template))
            {
                return template;
            }
            return null;
        }

        private Dictionary<string, Dictionary<string, Dictionary<string, string>>> LoadAllLanguages()
        {
            var result = new Dictionary<string, Dictionary<string, Dictionary<string, string>>>();

            // Look for JSON files in Resources/bot-messages/
            var basePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Resources", "bot-messages");

            // Also check the project root (for development)
            if (!Directory.Exists(basePath))
            {
                basePath = Path.Combine(Directory.GetCurrentDirectory(), "Resources", "bot-messages");
            }

            if (!Directory.Exists(basePath))
            {
                _logger.LogWarning("Bot messages directory not found at {Path}. Using empty messages.", basePath);
                return result;
            }

            foreach (var file in Directory.GetFiles(basePath, "*.json"))
            {
                var language = Path.GetFileNameWithoutExtension(file).ToLower();
                try
                {
                    var json = File.ReadAllText(file);
                    var messages = JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, string>>>(json);
                    if (messages != null)
                    {
                        result[language] = messages;
                        _logger.LogInformation("Loaded {Count} command groups for language '{Lang}'",
                            messages.Count, language);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error loading bot messages for language '{Lang}' from {File}", language, file);
                }
            }

            if (result.Count == 0)
            {
                _logger.LogWarning("No bot message files loaded. Bot responses will show [Missing] placeholders.");
            }

            return result;
        }
    }
}
