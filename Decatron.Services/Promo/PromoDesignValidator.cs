using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Decatron.Services.Promo
{
    /// <summary>
    /// Valida el JSON de diseño de una plantilla (ClientApp/src/components/promo-overlay/types.ts). Todo lo que acaba en CSS o en
    /// una dirección pasa por una lista cerrada o una expresión estricta: el diseño lo edita una persona (hoy el dueño, luego
    /// cada streamer) y se dibuja en OBS, así que nada de lo que traiga puede inyectar estilos, HTML ni direcciones.
    /// Devuelve códigos de error que el panel traduce.
    /// </summary>
    public static class PromoDesignValidator
    {
        public const int MaxBytes = 96 * 1024;
        public const int MaxElements = 60;

        /// <summary>Tipografías y los pesos que cada una realmente tiene. Misma lista que fonts.ts (una prueba lo comprueba).</summary>
        public static readonly Dictionary<string, int[]> Fonts = new()
        {
            ["Onest"] = new[] { 400, 500, 600, 700, 800 }, ["Inter"] = new[] { 400, 500, 600, 700, 800 }, ["Poppins"] = new[] { 400, 500, 600, 700, 800 },
            ["Montserrat"] = new[] { 400, 500, 600, 700, 800 }, ["Roboto"] = new[] { 400, 500, 700 }, ["Open Sans"] = new[] { 400, 500, 600, 700, 800 },
            ["Lato"] = new[] { 400, 700 }, ["Nunito"] = new[] { 400, 600, 700, 800 }, ["Rubik"] = new[] { 400, 500, 600, 700, 800 },
            ["Raleway"] = new[] { 400, 500, 600, 700, 800 }, ["Outfit"] = new[] { 400, 500, 600, 700, 800 }, ["Manrope"] = new[] { 400, 500, 600, 700, 800 },
            ["DM Sans"] = new[] { 400, 500, 700 }, ["Sora"] = new[] { 400, 600, 700, 800 }, ["Bricolage Grotesque"] = new[] { 400, 500, 600, 700, 800 },
            ["Syne"] = new[] { 400, 500, 600, 700, 800 }, ["Kanit"] = new[] { 400, 500, 600, 700, 800 }, ["Big Shoulders Display"] = new[] { 400, 600, 700, 800, 900 },
            ["Barlow Condensed"] = new[] { 400, 500, 600, 700, 800 }, ["Barlow"] = new[] { 400, 500, 600, 700, 800 }, ["Oswald"] = new[] { 400, 500, 600, 700 },
            ["Teko"] = new[] { 400, 500, 600, 700 }, ["Saira Condensed"] = new[] { 400, 500, 600, 700, 800 }, ["Bebas Neue"] = new[] { 400 },
            ["Anton"] = new[] { 400 }, ["Staatliches"] = new[] { 400 }, ["Archivo Black"] = new[] { 400 }, ["Passion One"] = new[] { 400, 700 },
            ["Chakra Petch"] = new[] { 400, 500, 600, 700 }, ["Rajdhani"] = new[] { 400, 500, 600, 700 }, ["Exo 2"] = new[] { 400, 500, 600, 700, 800 },
            ["Orbitron"] = new[] { 400, 500, 600, 700, 800 }, ["Russo One"] = new[] { 400 }, ["Audiowide"] = new[] { 400 }, ["Black Ops One"] = new[] { 400 },
            ["Unbounded"] = new[] { 400, 500, 600, 700, 800 }, ["Press Start 2P"] = new[] { 400 }, ["Righteous"] = new[] { 400 }, ["Titan One"] = new[] { 400 },
            ["Lilita One"] = new[] { 400 }, ["Fredoka"] = new[] { 400, 500, 600, 700 }, ["Comfortaa"] = new[] { 400, 500, 600, 700 }, ["Bangers"] = new[] { 400 },
            ["Pacifico"] = new[] { 400 }, ["Permanent Marker"] = new[] { 400 }, ["JetBrains Mono"] = new[] { 400, 500, 700 },
        };

        /// <summary>Sombras de caja que existen (las mismas del editor); cualquier otra cadena se rechaza.</summary>
        public static readonly string[] BoxShadows =
        {
            "", "0 6px 20px rgba(0,0,0,0.35)", "0 10px 32px rgba(0,0,0,0.5)", "0 16px 48px rgba(0,0,0,0.7)", "6px 6px 0 rgba(0,0,0,0.6)",
        };

        private static readonly string[] AnimTypes = { "none", "fade", "slide", "bounce", "zoom", "slide-bounce", "flip", "rotate", "glitch" };
        private static readonly string[] Directions = { "left", "right", "top", "bottom" };
        private static readonly string[] Easings = { "ease", "ease-in", "ease-out", "ease-in-out", "linear" };
        private static readonly string[] Loops = { "none", "pulse", "float", "breathe", "glow", "sway", "spin", "blink" };
        private static readonly string[] Cuts = { "none", "slant-right", "slant-left", "slant-both", "corners" };
        private static readonly string[] TextShadows = { "none", "soft", "normal", "strong", "glow" };
        private static readonly string[] Aligns = { "left", "center", "right" };
        private static readonly string[] VAligns = { "top", "center", "bottom" };
        private static readonly string[] Fits = { "cover", "contain", "fill" };
        private static readonly string[] FillTypes = { "color", "gradient", "transparent" };
        private static readonly string[] Kinds = { "shape", "image", "icon", "text", "qr" };

        private static readonly Regex ColorRx = new(
            @"^(#[0-9a-fA-F]{3,8}|transparent|rgba?\(\s*\d{1,3}(\.\d+)?\s*,\s*\d{1,3}(\.\d+)?\s*,\s*\d{1,3}(\.\d+)?\s*(,\s*(0|1|0?\.\d+|\d{1,3}%))?\s*\))$", RegexOptions.Compiled);
        private static readonly Regex IdRx = new(@"^[A-Za-z0-9_-]{1,40}$", RegexOptions.Compiled);
        private static readonly Regex RefRx = new(@"^(asset|builtin):[A-Za-z0-9_-]{1,40}$", RegexOptions.Compiled);
        private static readonly Regex VarRx = new(@"\{\{\s*([A-Za-z_]+)\s*\}\}", RegexOptions.Compiled);

        public static readonly string[] TextVariables = { "title", "body", "channel", "commands", "link" };

        private sealed class Ctx
        {
            public readonly HashSet<string> Errors = new();
            public void Bad(string code) => Errors.Add(code);
        }

        public static List<string> Validate(string? json)
        {
            var c = new Ctx();
            if (string.IsNullOrWhiteSpace(json)) { c.Bad("designInvalid"); return c.Errors.ToList(); }
            if (System.Text.Encoding.UTF8.GetByteCount(json) > MaxBytes) { c.Bad("designTooLarge"); return c.Errors.ToList(); }
            JsonDocument doc;
            try { doc = JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = 16 }); }
            catch (JsonException) { c.Bad("designInvalid"); return c.Errors.ToList(); }
            using (doc)
            {
                var root = doc.RootElement;
                if (root.ValueKind != JsonValueKind.Object) { c.Bad("designInvalid"); return c.Errors.ToList(); }
                if (!Int(root, "version", out var ver) || ver != 1) c.Bad("designInvalid");

                if (!root.TryGetProperty("canvas", out var canvas) || canvas.ValueKind != JsonValueKind.Object) c.Bad("designCanvasRange");
                else
                {
                    if (!Num(canvas, "width", 100, 3840, out _)) c.Bad("designCanvasRange");
                    if (!Num(canvas, "height", 40, 2160, out _)) c.Bad("designCanvasRange");
                }

                if (root.TryGetProperty("animation", out var a)) Animation(c, a); else c.Bad("designValueInvalid");
                PromoSlots.ValidateDeclaration(root, c.Bad);

                if (!root.TryGetProperty("elements", out var els) || els.ValueKind != JsonValueKind.Array) c.Bad("designInvalid");
                else if (els.GetArrayLength() > MaxElements) c.Bad("designTooManyElements");
                else
                {
                    var ids = new HashSet<string>();
                    foreach (var e in els.EnumerateArray())
                    {
                        if (e.ValueKind != JsonValueKind.Object) { c.Bad("designInvalid"); continue; }
                        Element(c, e, ids);
                    }
                }
            }
            return c.Errors.ToList();
        }

        // ── helpers ────────────────────────────────────────────────────────

        private static bool Num(JsonElement o, string name, double min, double max, out double v)
        {
            v = 0;
            return o.ValueKind == JsonValueKind.Object && o.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.Number
                && p.TryGetDouble(out v) && !double.IsNaN(v) && !double.IsInfinity(v) && v >= min && v <= max;
        }
        private static bool Int(JsonElement o, string name, out int v)
        {
            v = 0;
            return o.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.Number && p.TryGetInt32(out v);
        }
        private static bool Bool(JsonElement o, string name) => o.ValueKind == JsonValueKind.Object && o.TryGetProperty(name, out var p) && (p.ValueKind == JsonValueKind.True || p.ValueKind == JsonValueKind.False);
        private static string? Str(JsonElement o, string name) => o.ValueKind == JsonValueKind.Object && o.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;
        private static bool OneOf(JsonElement o, string name, string[] allowed) { var s = Str(o, name); return s != null && allowed.Contains(s); }

        private static void Color(Ctx c, JsonElement o, string name)
        {
            var s = Str(o, name);
            if (s == null || s.Length > 80 || !ColorRx.IsMatch(s)) c.Bad("designColorInvalid");
        }

        public static bool IsColor(string? s) => s != null && s.Length <= 80 && ColorRx.IsMatch(s);

        /// <summary>Texto libre con variables de la lista (el de un elemento de texto o el que escribe un streamer).</summary>
        public static bool IsTemplateText(string? s, int max) =>
            s != null && s.Length <= max && !s.Contains('<') && !s.Contains('>') && !s.Any(ch => char.IsControl(ch) && ch != '\n')
            && !VarRx.Matches(s).Any(m => !TextVariables.Contains(m.Groups[1].Value.ToLowerInvariant()));

        private static void Text(Ctx c, string? s, int max)
        {
            if (s == null || s.Length > max || s.Contains('<') || s.Contains('>') || s.Any(ch => char.IsControl(ch) && ch != '\n')) c.Bad("designTextInvalid");
        }

        private static void Step(Ctx c, JsonElement s)
        {
            if (s.ValueKind != JsonValueKind.Object) { c.Bad("designValueInvalid"); return; }
            if (!OneOf(s, "type", AnimTypes) || !OneOf(s, "direction", Directions) || !OneOf(s, "easing", Easings)
                || !Num(s, "durationMs", 0, 5000, out _) || !Num(s, "delayMs", 0, 10000, out _)) c.Bad("designAnimationInvalid");
        }

        private static void Animation(Ctx c, JsonElement a)
        {
            if (a.ValueKind != JsonValueKind.Object || !a.TryGetProperty("enter", out var en) || !a.TryGetProperty("exit", out var ex)) { c.Bad("designAnimationInvalid"); return; }
            Step(c, en); Step(c, ex);
        }

        private static void Fill(Ctx c, JsonElement o, string name)
        {
            if (!o.TryGetProperty(name, out var f) || f.ValueKind != JsonValueKind.Object || !OneOf(f, "type", FillTypes)) { c.Bad("designValueInvalid"); return; }
            Color(c, f, "color");
            if (!f.TryGetProperty("gradient", out var g) || g.ValueKind != JsonValueKind.Object) { c.Bad("designValueInvalid"); return; }
            Color(c, g, "color1"); Color(c, g, "color2");
            if (!Num(g, "angle", -360, 360, out _)) c.Bad("designValueInvalid");
        }

        private static void Border(Ctx c, JsonElement o, string name)
        {
            if (!o.TryGetProperty(name, out var b) || b.ValueKind != JsonValueKind.Object || !Bool(b, "enabled") || !Num(b, "width", 0, 50, out _)) { c.Bad("designValueInvalid"); return; }
            Color(c, b, "color");
        }

        private static void Glow(Ctx c, JsonElement o, string name)
        {
            if (!o.TryGetProperty(name, out var g) || g.ValueKind != JsonValueKind.Object || !Bool(g, "enabled") || !Num(g, "blur", 0, 200, out _)) { c.Bad("designValueInvalid"); return; }
            Color(c, g, "color");
        }

        private static void Shadow(Ctx c, JsonElement o, string name)
        {
            var s = Str(o, name);
            if (s == null || !BoxShadows.Contains(s)) c.Bad("designValueInvalid");
        }

        private static void Element(Ctx c, JsonElement e, HashSet<string> ids)
        {
            var kind = Str(e, "kind");
            if (kind == null || !Kinds.Contains(kind)) { c.Bad("designKindInvalid"); return; }

            var id = Str(e, "id");
            if (id == null || !IdRx.IsMatch(id) || !ids.Add(id)) c.Bad("designValueInvalid");
            Text(c, Str(e, "name"), 60);
            if (!Bool(e, "enabled")) c.Bad("designValueInvalid");
            if (!Num(e, "x", -2000, 4000, out _) || !Num(e, "y", -2000, 4000, out _) || !Num(e, "width", 1, 4000, out _) || !Num(e, "height", 1, 4000, out _)
                || !Num(e, "rotation", -360, 360, out _) || !Num(e, "opacity", 0, 100, out _)) c.Bad("designValueInvalid");
            if (e.TryGetProperty("animation", out var an)) Animation(c, an); else c.Bad("designAnimationInvalid");
            if (!e.TryGetProperty("loop", out var lp) || lp.ValueKind != JsonValueKind.Object || !OneOf(lp, "type", Loops) || !Num(lp, "durationMs", 200, 20000, out _) || !Num(lp, "delayMs", 0, 10000, out _)) c.Bad("designAnimationInvalid");

            switch (kind)
            {
                case "shape":
                    Fill(c, e, "fill"); Border(c, e, "border"); Glow(c, e, "glow"); Shadow(c, e, "shadow");
                    if (!Num(e, "radius", 0, 2000, out _) || !OneOf(e, "cut", Cuts) || !Num(e, "cutSize", 0, 500, out _) || !Num(e, "backdropBlur", 0, 60, out _)) c.Bad("designValueInvalid");
                    break;
                case "image":
                    Border(c, e, "border"); Glow(c, e, "glow"); Shadow(c, e, "shadow");
                    var src = Str(e, "source");
                    if (src != "library" && src != "piece") c.Bad("designValueInvalid");
                    var r = Str(e, "ref");
                    if (r == null || (r.Length > 0 && !RefRx.IsMatch(r))) c.Bad("designImageRefInvalid");
                    if (!OneOf(e, "fit", Fits) || !Num(e, "radius", 0, 2000, out _)) c.Bad("designValueInvalid");
                    break;
                case "icon":
                    Glow(c, e, "glow"); Color(c, e, "color");
                    var isrc = Str(e, "source");
                    if (isrc != "piece" && isrc != "fixed") c.Bad("designValueInvalid");
                    var icon = Str(e, "icon");
                    if (icon == null || (icon.Length > 0 && !PromoValidator.Icons.Contains(icon))) c.Bad("designIconInvalid");
                    if (!Num(e, "strokeWidth", 0.5, 6, out _)) c.Bad("designValueInvalid");
                    break;
                case "text":
                    Fill(c, e, "fill"); Border(c, e, "border"); Color(c, e, "color"); Color(c, e, "glowColor");
                    var tpl = Str(e, "template");
                    Text(c, tpl, 400);
                    if (tpl != null && VarRx.Matches(tpl).Any(m => !TextVariables.Contains(m.Groups[1].Value.ToLowerInvariant()))) c.Bad("designUnknownVariable");
                    var ff = Str(e, "fontFamily");
                    if (ff == null || !Fonts.ContainsKey(ff)) c.Bad("designFontInvalid");
                    if (!Num(e, "fontSize", 6, 400, out _) || !Num(e, "fontWeight", 100, 900, out _) || !Num(e, "lineHeight", 0.6, 3, out _) || !Num(e, "letterSpacing", -10, 40, out _)
                        || !Num(e, "maxLines", 0, 20, out _) || !Num(e, "radius", 0, 500, out _) || !Num(e, "padding", 0, 300, out _)
                        || !OneOf(e, "align", Aligns) || !OneOf(e, "verticalAlign", VAligns) || !OneOf(e, "shadow", TextShadows) || !Bool(e, "italic") || !Bool(e, "uppercase")) c.Bad("designValueInvalid");
                    break;
                case "qr":
                    Border(c, e, "border"); Color(c, e, "color"); Color(c, e, "background");
                    if (!Num(e, "radius", 0, 500, out _) || !Num(e, "padding", 0, 100, out _)) c.Bad("designValueInvalid");
                    break;
            }
        }
    }
}
