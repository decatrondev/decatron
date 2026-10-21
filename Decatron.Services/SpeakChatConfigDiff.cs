using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace Decatron.Services
{
    /// <summary>
    /// Diferencias entre dos configuraciones de Speak Chat, campo por campo (ruta, antes, después).
    /// Sirve para el historial de cambios: poder reconstruir quién activó o apagó qué y cuándo.
    /// </summary>
    public static class SpeakChatConfigDiff
    {
        public sealed record Change(string Path, string? Before, string? After);

        public const int MaxChanges = 60;
        private const int MaxValueLength = 80;

        public static List<Change> Compute(string? beforeJson, string? afterJson)
        {
            var before = new Dictionary<string, string?>();
            var after = new Dictionary<string, string?>();
            Flatten(Parse(beforeJson), "", before);
            Flatten(Parse(afterJson), "", after);

            var changes = new List<Change>();
            foreach (var path in before.Keys.Union(after.Keys).OrderBy(p => p, StringComparer.Ordinal))
            {
                before.TryGetValue(path, out var b);
                after.TryGetValue(path, out var a);
                if (before.ContainsKey(path) && after.ContainsKey(path) && b == a) continue;
                changes.Add(new Change(path, b, a));
                if (changes.Count >= MaxChanges) break;
            }
            return changes;
        }

        private static JsonElement? Parse(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            try { return JsonSerializer.Deserialize<JsonElement>(json); }
            catch { return null; }
        }

        private static void Flatten(JsonElement? el, string path, Dictionary<string, string?> into)
        {
            if (el is null) return;
            var e = el.Value;
            switch (e.ValueKind)
            {
                case JsonValueKind.Object:
                    foreach (var p in e.EnumerateObject())
                        Flatten(p.Value, path.Length == 0 ? p.Name : path + "." + p.Name, into);
                    break;
                case JsonValueKind.Array:
                    var i = 0;
                    foreach (var item in e.EnumerateArray()) Flatten(item, $"{path}[{i++}]", into);
                    break;
                case JsonValueKind.Null:
                    into[path] = null;
                    break;
                default:
                    var text = e.ValueKind == JsonValueKind.String ? e.GetString() ?? "" : e.GetRawText();
                    into[path] = text.Length > MaxValueLength ? text[..MaxValueLength] + "…" : text;
                    break;
            }
        }
    }
}
