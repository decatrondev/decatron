using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Decatron.Services.Promo
{
    /// <summary>
    /// Ajustes que el streamer puede cambiar de una plantilla (colores, textos fijos, tipografía). El dueño los declara en el diseño
    /// (`slots`, ver ClientApp/src/components/promo-overlay/slots.ts); el streamer guarda un valor por ajuste. Todo pasa por listas cerradas:
    /// qué propiedad de qué elemento puede recibir cada tipo, colores con la misma expresión estricta del diseño y tipografías de la lista.
    /// </summary>
    public static class PromoSlots
    {
        public const int MaxSlots = 12;
        public const int MaxTargets = 8;
        public const int MaxTextLength = 200;

        private static readonly Regex IdRx = new(@"^[A-Za-z0-9_-]{1,40}$", RegexOptions.Compiled);

        /// <summary>Propiedades que acepta cada tipo de ajuste, por tipo de elemento. Misma tabla que SLOT_PROPS en slots.ts.</summary>
        public static readonly Dictionary<string, Dictionary<string, string[]>> Props = new()
        {
            ["color"] = new()
            {
                ["shape"] = new[] { "fill.color", "fill.gradient.color1", "fill.gradient.color2", "border.color", "glow.color" },
                ["image"] = new[] { "border.color", "glow.color" },
                ["icon"] = new[] { "color", "glow.color" },
                ["text"] = new[] { "color", "glowColor", "fill.color", "border.color" },
                ["qr"] = new[] { "color", "background", "border.color" },
            },
            ["text"] = new() { ["text"] = new[] { "template" } },
            ["font"] = new() { ["text"] = new[] { "fontFamily" } },
        };

        public sealed record Slot(string Id, string Kind, int MaxLength);

        /// <summary>Los ajustes declarados en un diseño ya validado (vacío si no tiene).</summary>
        public static List<Slot> Read(string? designJson)
        {
            var list = new List<Slot>();
            if (string.IsNullOrWhiteSpace(designJson)) return list;
            try
            {
                using var doc = JsonDocument.Parse(designJson);
                if (!doc.RootElement.TryGetProperty("slots", out var s) || s.ValueKind != JsonValueKind.Array) return list;
                foreach (var e in s.EnumerateArray())
                {
                    var id = e.TryGetProperty("id", out var i) && i.ValueKind == JsonValueKind.String ? i.GetString() : null;
                    var kind = e.TryGetProperty("kind", out var k) && k.ValueKind == JsonValueKind.String ? k.GetString() : null;
                    var max = e.TryGetProperty("maxLength", out var m) && m.TryGetInt32(out var mv) ? mv : 40;
                    if (id != null && kind != null) list.Add(new Slot(id, kind, Math.Clamp(max, 1, MaxTextLength)));
                }
            }
            catch (JsonException) { }
            return list;
        }

        /// <summary>Valida la sección `slots` del diseño: elementos que existen y propiedad permitida para ese tipo de elemento.</summary>
        public static void ValidateDeclaration(JsonElement root, Action<string> bad)
        {
            if (!root.TryGetProperty("slots", out var slots)) return;
            if (slots.ValueKind != JsonValueKind.Array || slots.GetArrayLength() > MaxSlots) { bad("designSlotsInvalid"); return; }
            var kinds = new Dictionary<string, string>();
            if (root.TryGetProperty("elements", out var els) && els.ValueKind == JsonValueKind.Array)
                foreach (var e in els.EnumerateArray())
                    if (e.ValueKind == JsonValueKind.Object && e.TryGetProperty("id", out var id) && e.TryGetProperty("kind", out var k)
                        && id.ValueKind == JsonValueKind.String && k.ValueKind == JsonValueKind.String) kinds[id.GetString()!] = k.GetString()!;
            var seen = new HashSet<string>();
            foreach (var s in slots.EnumerateArray())
            {
                if (s.ValueKind != JsonValueKind.Object) { bad("designSlotsInvalid"); continue; }
                var id = Str(s, "id"); var kind = Str(s, "kind");
                if (id == null || !IdRx.IsMatch(id) || !seen.Add(id) || kind == null || !Props.ContainsKey(kind)) { bad("designSlotsInvalid"); continue; }
                foreach (var label in new[] { "labelEs", "labelEn" })
                {
                    var l = Str(s, label);
                    if (l == null || l.Length > 60 || l.Contains('<') || l.Contains('>') || l.Any(char.IsControl)) bad("designSlotsInvalid");
                }
                if (kind == "text" && !(s.TryGetProperty("maxLength", out var ml) && ml.TryGetInt32(out var mlv) && mlv >= 1 && mlv <= MaxTextLength)) bad("designSlotsInvalid");
                if (!s.TryGetProperty("targets", out var targets) || targets.ValueKind != JsonValueKind.Array || targets.GetArrayLength() == 0 || targets.GetArrayLength() > MaxTargets) { bad("designSlotsInvalid"); continue; }
                foreach (var t in targets.EnumerateArray())
                {
                    var el = Str(t, "elementId"); var prop = Str(t, "prop");
                    if (el == null || prop == null || !kinds.TryGetValue(el, out var ek) || !Props[kind].TryGetValue(ek, out var allowed) || !allowed.Contains(prop)) bad("designSlotsInvalid");
                }
            }
        }

        private static string? Str(JsonElement o, string name) =>
            o.ValueKind == JsonValueKind.Object && o.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;

        /// <summary>Errores al guardar los valores del streamer. Un ajuste que la plantilla no declara, o un valor fuera de la lista, se rechaza.</summary>
        public static List<string> ValidateValues(string? designJson, IReadOnlyDictionary<string, string>? values)
        {
            var errors = new HashSet<string>();
            if (values == null) return errors.ToList();
            var slots = Read(designJson).ToDictionary(s => s.Id);
            if (values.Count > MaxSlots) errors.Add("slotValuesInvalid");
            foreach (var (id, v) in values)
            {
                if (!slots.TryGetValue(id, out var slot)) { errors.Add("slotUnknown"); continue; }
                if (!IsValid(slot, v)) errors.Add("slotValueInvalid");
            }
            return errors.ToList();
        }

        /// <summary>El JSON guardado en la base como diccionario (vacío si está dañado).</summary>
        public static Dictionary<string, string> ParseStyle(string? json)
        {
            try { return JsonSerializer.Deserialize<Dictionary<string, string>>(json ?? "{}") ?? new(); }
            catch (JsonException) { return new(); }
        }

        /// <summary>Deja solo los valores que siguen siendo válidos para el diseño de hoy (el dueño pudo cambiar o quitar ajustes después).</summary>
        public static Dictionary<string, string> Sanitize(string? designJson, IReadOnlyDictionary<string, string>? values)
        {
            var result = new Dictionary<string, string>();
            if (values == null) return result;
            var slots = Read(designJson).ToDictionary(s => s.Id);
            foreach (var (id, v) in values)
                if (slots.TryGetValue(id, out var slot) && IsValid(slot, v)) result[id] = v;
            return result;
        }

        public static bool IsValid(Slot slot, string v) => slot.Kind switch
        {
            "color" => PromoDesignValidator.IsColor(v),
            "font" => PromoDesignValidator.Fonts.ContainsKey(v),
            "text" => PromoDesignValidator.IsTemplateText(v, slot.MaxLength),
            _ => false,
        };
    }
}
