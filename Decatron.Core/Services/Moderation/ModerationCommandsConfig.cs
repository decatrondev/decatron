using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace Decatron.Core.Services.Moderation
{
    /// <summary>
    /// Interruptor, rol mínimo y parámetros de un comando de moderación
    /// </summary>
    public class ModerationCommandSetting
    {
        public bool Enabled { get; set; } = true;
        /// <summary>moderator | lead_moderator | broadcaster (broadcaster incluye control_total)</summary>
        public string MinRole { get; set; } = "moderator";

        // Solo !nuke
        /// <summary>Cuántos segundos hacia atrás mira</summary>
        public int WindowSeconds { get; set; } = 60;
        /// <summary>timeout | ban</summary>
        public string Action { get; set; } = "timeout";
        public int TimeoutSeconds { get; set; } = 600;
    }

    /// <summary>
    /// Configuración de los comandos de moderación de un canal (moderation_command_configs.settings).
    /// Por defecto están encendidos: solo los usan mods y superiores, no sancionan solos.
    /// </summary>
    public static class ModerationCommandsConfig
    {
        public const string Permit = "permit";
        public const string Strikes = "strikes";
        public const string ResetStrikes = "resetstrikes";
        public const string Words = "words";
        public const string Links = "links";
        public const string Nuke = "nuke";

        public const int NukeMaxWindowSeconds = 300;
        public const int NukeMaxUsers = 100;

        public static readonly string[] Roles = { "moderator", "lead_moderator", "broadcaster" };

        /// <summary>El mod reacciona, el Lead Mod administra</summary>
        private static readonly Dictionary<string, string> DefaultRoles = new()
        {
            [Permit] = "moderator",
            [Strikes] = "moderator",
            [Nuke] = "moderator",
            [ResetStrikes] = "lead_moderator",
            [Words] = "lead_moderator",
            [Links] = "lead_moderator",
        };

        public static IReadOnlyCollection<string> Keys => DefaultRoles.Keys;

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        /// <summary>
        /// Lee la config guardada y completa lo que falte con los valores por defecto.
        /// Valores fuera de rango se corrigen en vez de fallar.
        /// </summary>
        public static Dictionary<string, ModerationCommandSetting> Parse(string? json)
        {
            Dictionary<string, ModerationCommandSetting>? saved = null;
            try
            {
                if (!string.IsNullOrWhiteSpace(json))
                    saved = JsonSerializer.Deserialize<Dictionary<string, ModerationCommandSetting>>(json, JsonOptions);
            }
            catch (JsonException) { }

            var result = new Dictionary<string, ModerationCommandSetting>();
            foreach (var (key, defaultRole) in DefaultRoles)
            {
                var setting = saved != null && saved.TryGetValue(key, out var s) && s != null
                    ? s
                    : new ModerationCommandSetting { MinRole = defaultRole };

                if (!Roles.Contains(setting.MinRole)) setting.MinRole = defaultRole;
                setting.WindowSeconds = Math.Clamp(setting.WindowSeconds, 5, NukeMaxWindowSeconds);
                setting.TimeoutSeconds = Math.Clamp(setting.TimeoutSeconds, 1, 1209600);
                if (setting.Action is not ("timeout" or "ban")) setting.Action = "timeout";
                result[key] = setting;
            }
            return result;
        }

        public static string Serialize(Dictionary<string, ModerationCommandSetting> config) =>
            JsonSerializer.Serialize(config, JsonOptions);

        public static int RoleRank(string role) => role switch
        {
            "broadcaster" => 3,
            "lead_moderator" => 2,
            "moderator" => 1,
            _ => 0
        };
    }
}
