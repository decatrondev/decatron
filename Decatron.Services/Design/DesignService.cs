using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Decatron.Core.Models.Design;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Decatron.Services.Design
{
    /// <summary>
    /// Valores de diseño editables desde /admin/estilo. El backend NO conoce los colores de fábrica ni
    /// genera CSS (eso vive en ClientApp/src/components/ds/tokens.ts, una sola fuente): solo guarda,
    /// valida el formato y versiona. Sin versión publicada = el front usa los valores del código.
    /// </summary>
    public class DesignService
    {
        private const string CacheKey = "design-public";
        private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(10);
        public const int MaxValuesBytes = 16 * 1024;

        // Mismas claves que DsColors en tokens.ts.
        private static readonly string[] ColorKeys =
        {
            "bg", "surface", "raised", "input", "border", "borderSoft", "text", "soft", "faint",
            "accent", "accentHover", "accentText", "onAccent", "ok", "warn", "danger", "dangerSolid", "dangerHover",
            "syntaxKeyword", "syntaxString", "syntaxNumber",
        };
        private static readonly string[] Fonts = { "Onest", "Barlow", "system-ui" };
        private static readonly Regex HexRx = new("^#[0-9a-fA-F]{6}$", RegexOptions.Compiled);

        private readonly DecatronDbContext _db;
        private readonly IMemoryCache _cache;

        public DesignService(DecatronDbContext db, IMemoryCache cache) { _db = db; _cache = cache; }

        public record PublicDto(long Version, DateTime? PublishedAt, JsonElement Values);
        public record VersionDto(long Id, string Status, string Note, string AuthorLogin, DateTime CreatedAt, DateTime UpdatedAt, DateTime? PublishedAt, JsonElement Values);

        public class InvalidValuesException : Exception { public InvalidValuesException(string m) : base(m) { } }

        public async Task<PublicDto> GetPublicAsync()
        {
            if (_cache.TryGetValue(CacheKey, out PublicDto? cached) && cached != null) return cached;
            var p = await _db.DesignVersions.AsNoTracking().FirstOrDefaultAsync(v => v.Status == "published");
            var dto = p == null
                ? new PublicDto(0, null, Parse("{}"))
                : new PublicDto(p.Id, p.PublishedAt, Parse(p.ValuesJson));
            _cache.Set(CacheKey, dto, CacheTtl);
            return dto;
        }

        public async Task<(VersionDto? Draft, VersionDto? Published, List<VersionDto> History)> GetAdminAsync()
        {
            var all = await _db.DesignVersions.AsNoTracking().OrderByDescending(v => v.UpdatedAt).Take(60).ToListAsync();
            return (all.Where(v => v.Status == "draft").Select(ToDto).FirstOrDefault(),
                    all.Where(v => v.Status == "published").Select(ToDto).FirstOrDefault(),
                    all.Where(v => v.Status == "archived").Select(ToDto).ToList());
        }

        public async Task<VersionDto> SaveDraftAsync(JsonElement values, string note, string login)
        {
            var clean = Sanitize(values);
            var d = await _db.DesignVersions.FirstOrDefaultAsync(v => v.Status == "draft");
            if (d == null) { d = new DesignVersion { Status = "draft" }; _db.DesignVersions.Add(d); }
            d.ValuesJson = clean;
            d.Note = Trim(note, 200);
            d.AuthorLogin = login;
            d.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return ToDto(d);
        }

        public async Task DiscardDraftAsync()
        {
            var d = await _db.DesignVersions.FirstOrDefaultAsync(v => v.Status == "draft");
            if (d != null) { _db.DesignVersions.Remove(d); await _db.SaveChangesAsync(); }
        }

        /// <summary>El borrador pasa a publicado y el publicado anterior al historial.</summary>
        public async Task<VersionDto?> PublishAsync(string note, string login)
        {
            var d = await _db.DesignVersions.FirstOrDefaultAsync(v => v.Status == "draft");
            if (d == null) return null;
            await using var tx = await _db.Database.BeginTransactionAsync();
            var old = await _db.DesignVersions.FirstOrDefaultAsync(v => v.Status == "published");
            if (old != null) { old.Status = "archived"; old.UpdatedAt = DateTime.UtcNow; await _db.SaveChangesAsync(); }
            d.Status = "published";
            d.PublishedAt = DateTime.UtcNow;
            d.UpdatedAt = DateTime.UtcNow;
            d.AuthorLogin = login;
            if (!string.IsNullOrWhiteSpace(note)) d.Note = Trim(note, 200);
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
            _cache.Remove(CacheKey);
            return ToDto(d);
        }

        /// <summary>Vuelve a los valores de fábrica: archiva lo publicado y descarta el borrador.</summary>
        public async Task ResetAsync(string login)
        {
            var old = await _db.DesignVersions.FirstOrDefaultAsync(v => v.Status == "published");
            if (old != null)
            {
                old.Status = "archived";
                old.Note = Trim(string.IsNullOrWhiteSpace(old.Note) ? "Reemplazado por valores de fábrica" : old.Note, 200);
                old.UpdatedAt = DateTime.UtcNow;
            }
            var d = await _db.DesignVersions.FirstOrDefaultAsync(v => v.Status == "draft");
            if (d != null) _db.DesignVersions.Remove(d);
            await _db.SaveChangesAsync();
            _cache.Remove(CacheKey);
        }

        /// <summary>Copia los valores de una versión del historial al borrador (no publica).</summary>
        public async Task<VersionDto?> RestoreToDraftAsync(long id, string login)
        {
            var src = await _db.DesignVersions.AsNoTracking().FirstOrDefaultAsync(v => v.Id == id);
            if (src == null) return null;
            return await SaveDraftAsync(Parse(src.ValuesJson), $"Basado en la versión {id}", login);
        }

        // ── Validación ─────────────────────────────────────────────────────────

        /// <summary>Reconstruye el JSON con una lista blanca de claves y rangos; lo demás se rechaza.</summary>
        private static string Sanitize(JsonElement v)
        {
            if (v.ValueKind != JsonValueKind.Object) throw new InvalidValuesException("Formato inválido");
            if (v.GetRawText().Length > MaxValuesBytes) throw new InvalidValuesException("Demasiado grande");
            var o = new Dictionary<string, object>();
            foreach (var top in v.EnumerateObject())
            {
                if (top.Name == "colors" && top.Value.ValueKind == JsonValueKind.Object)
                {
                    var colors = new Dictionary<string, object>();
                    foreach (var theme in top.Value.EnumerateObject())
                    {
                        if (theme.Name != "dark" && theme.Name != "light") throw new InvalidValuesException($"Tema desconocido: {theme.Name}");
                        var set = new Dictionary<string, string>();
                        foreach (var c in theme.Value.EnumerateObject())
                        {
                            if (!ColorKeys.Contains(c.Name)) throw new InvalidValuesException($"Color desconocido: {c.Name}");
                            var s = c.Value.ValueKind == JsonValueKind.String ? c.Value.GetString() ?? "" : "";
                            if (!HexRx.IsMatch(s)) throw new InvalidValuesException($"Color inválido en {c.Name} (usa #rrggbb)");
                            set[c.Name] = s.ToLowerInvariant();
                        }
                        if (set.Count > 0) colors[theme.Name] = set;
                    }
                    if (colors.Count > 0) o["colors"] = colors;
                }
                else if (top.Name == "shape" && top.Value.ValueKind == JsonValueKind.Object)
                {
                    var shape = new Dictionary<string, object>();
                    foreach (var p in top.Value.EnumerateObject())
                    {
                        switch (p.Name)
                        {
                            case "radius": shape[p.Name] = Num(p, 0, 16); break;
                            case "radiusLg": shape[p.Name] = Num(p, 0, 24); break;
                            case "weight": shape[p.Name] = Num(p, 400, 900); break;
                            case "border": shape[p.Name] = Num(p, 1, 2); break;
                            case "gridOpacity": shape[p.Name] = Num(p, 0, 0.3); break;
                            case "glowOpacity": shape[p.Name] = Num(p, 0, 0.8); break;
                            case "fontUi":
                                var f = p.Value.ValueKind == JsonValueKind.String ? p.Value.GetString() ?? "" : "";
                                if (!Fonts.Contains(f)) throw new InvalidValuesException("Tipografía no permitida");
                                shape[p.Name] = f; break;
                            case "sizes":
                                var sizes = new Dictionary<string, object>();
                                foreach (var sz in p.Value.EnumerateObject())
                                {
                                    if (sz.Name != "sm" && sz.Name != "md" && sz.Name != "lg") throw new InvalidValuesException($"Tamaño desconocido: {sz.Name}");
                                    var one = new Dictionary<string, double>();
                                    foreach (var q in sz.Value.EnumerateObject())
                                    {
                                        one[q.Name] = q.Name switch
                                        {
                                            "height" => Num(q, 24, 64),
                                            "padX" => Num(q, 6, 40),
                                            "font" => Num(q, 11, 20),
                                            _ => throw new InvalidValuesException($"Campo desconocido: {q.Name}"),
                                        };
                                    }
                                    if (one.Count > 0) sizes[sz.Name] = one;
                                }
                                if (sizes.Count > 0) shape[p.Name] = sizes;
                                break;
                            default: throw new InvalidValuesException($"Campo desconocido: {p.Name}");
                        }
                    }
                    if (shape.Count > 0) o["shape"] = shape;
                }
                else throw new InvalidValuesException($"Sección desconocida: {top.Name}");
            }
            return JsonSerializer.Serialize(o);
        }

        private static double Num(JsonProperty p, double min, double max)
        {
            if (p.Value.ValueKind != JsonValueKind.Number || !p.Value.TryGetDouble(out var n) || double.IsNaN(n))
                throw new InvalidValuesException($"{p.Name} debe ser un número");
            if (n < min || n > max) throw new InvalidValuesException($"{p.Name} fuera de rango ({min.ToString(CultureInfo.InvariantCulture)}–{max.ToString(CultureInfo.InvariantCulture)})");
            return n;
        }

        private static string Trim(string? s, int max) { s = (s ?? "").Trim(); return s.Length <= max ? s : s[..max]; }
        private static JsonElement Parse(string json)
        {
            try { return JsonDocument.Parse(json).RootElement.Clone(); }
            catch (JsonException) { return JsonDocument.Parse("{}").RootElement.Clone(); }
        }
        private static VersionDto ToDto(DesignVersion v) =>
            new(v.Id, v.Status, v.Note, v.AuthorLogin, v.CreatedAt, v.UpdatedAt, v.PublishedAt, Parse(v.ValuesJson));
    }
}
