using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Decatron.Services
{
    /// <summary>
    /// Voz propia de cada comando de Speak Chat (!goku, !narrador…) y el tope de comandos por rango.
    /// Va aparte del servicio para poder probarlo sin base de datos.
    /// </summary>
    public static class SpeakChatCommandVoice
    {
        /// <summary>Tope técnico: «sin tope» (Fundador) igual tiene un máximo para no inflar la configuración.</summary>
        public const int HardMax = 500;

        /// <summary>Comandos con voz propia por rango (.dev/plans/speak-chat/LIMITES.md). Los rangos amplían cantidades, nunca bloquean funciones.</summary>
        public static int MaxVoiceCommandsFor(string? tier) => tier switch
        {
            "fundador" or "admin" => HardMax,
            "patrocinador" => 100,
            "premium" => 30,
            "supporter" => 10,
            _ => 3,
        };

        /// <summary>¿La regla es un comando con voz propia? (el motor tiene que ser uno conocido)</summary>
        public static bool HasOwnVoice(JsonElement rule)
        {
            if (rule.ValueKind != JsonValueKind.Object) return false;
            if (!rule.TryGetProperty("type", out var t) || t.GetString() != "command") return false;
            if (!rule.TryGetProperty("voice", out var v) || v.ValueKind != JsonValueKind.Object) return false;
            return v.TryGetProperty("engine", out var e) && e.GetString() is "piper" or "polly" or "fish";
        }

        /// <summary>Cuántos comandos de la configuración tienen voz propia.</summary>
        public static int CountVoiceCommands(string? configJson)
        {
            if (string.IsNullOrWhiteSpace(configJson)) return 0;
            try
            {
                using var doc = JsonDocument.Parse(configJson);
                if (!doc.RootElement.TryGetProperty("activation", out var act) ||
                    !act.TryGetProperty("rules", out var rules) || rules.ValueKind != JsonValueKind.Array) return 0;
                var n = 0;
                foreach (var r in rules.EnumerateArray()) if (HasOwnVoice(r)) n++;
                return n;
            }
            catch (JsonException) { return 0; }
        }

        /// <summary>
        /// ¿Se puede guardar? Una configuración que ya superaba el tope no se recorta: solo se bloquea
        /// agregar más comandos con voz propia.
        /// </summary>
        public static bool CanSave(int before, int after, int max) => after <= max || after <= before;

        /// <summary>Voz efectiva: la del canal con los campos que el comando define encima.</summary>
        public static JsonElement Merge(JsonElement channelVoice, JsonElement ruleVoice)
        {
            var merged = channelVoice.ValueKind == JsonValueKind.Object
                ? JsonNode.Parse(channelVoice.GetRawText())!.AsObject()
                : new JsonObject();
            if (ruleVoice.ValueKind == JsonValueKind.Object)
                foreach (var p in ruleVoice.EnumerateObject())
                    merged[p.Name] = JsonNode.Parse(p.Value.GetRawText());
            return JsonSerializer.Deserialize<JsonElement>(merged.ToJsonString());
        }

        /// <summary>Número entero opcional de la regla (null = no definido, hereda el del canal).</summary>
        public static int? OptionalSeconds(JsonElement rule, string name) =>
            rule.ValueKind == JsonValueKind.Object && rule.TryGetProperty(name, out var p) &&
            p.ValueKind == JsonValueKind.Number && p.TryGetInt32(out var n) && n >= 0 ? n : null;

        /// <summary>«silence» (por defecto): sin saldo no suena. «standard»: cae a la voz estándar.</summary>
        public static bool FallsBackToStandard(JsonElement rule) =>
            rule.ValueKind == JsonValueKind.Object && rule.TryGetProperty("noBalance", out var p) && p.GetString() == "standard";

        /// <summary>
        /// Restricción opcional de una regla concreta (<c>platform</c>: «all», «twitch» o «kick»). Sin el campo no
        /// restringe: mandan las Fuentes generales. El panel ya no la muestra; queda para configuraciones que la traigan.
        /// </summary>
        public static bool PlatformAllows(JsonElement rule, string platform)
        {
            var value = rule.ValueKind == JsonValueKind.Object && rule.TryGetProperty("platform", out var p) &&
                p.ValueKind == JsonValueKind.String ? p.GetString() : null;
            return (value ?? "all") switch
            {
                "all" => true,
                "kick" => platform == "kick",
                _ => platform == "twitch",
            };
        }

        private static readonly Dictionary<string, DateTime> _lastNotice = new();
        private static readonly object _noticeLock = new();

        /// <summary>El aviso de «sin saldo» sale como mucho una vez cada <paramref name="every"/> por canal y comando.</summary>
        public static bool ShouldNotify(string channel, string command, DateTime now, TimeSpan every)
        {
            var key = (channel + "|" + command).ToLowerInvariant();
            lock (_noticeLock)
            {
                if (_lastNotice.TryGetValue(key, out var last) && now - last < every) return false;
                _lastNotice[key] = now;
                return true;
            }
        }
    }
}
