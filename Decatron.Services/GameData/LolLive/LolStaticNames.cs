using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.GameData.LolLive
{
    /// <summary>
    /// Nombres oficiales de ítems, runas y hechizos de invocador desde Data Dragon, en inglés
    /// y en español (es_MX). La IA del coach escribe siempre los nombres en inglés (así no
    /// se inventa traducciones como "Cañón Fuegosombrío") y aquí se traducen al idioma del
    /// canal con la tabla real del cliente. Se cachea un día en memoria.
    /// </summary>
    public class LolStaticNames
    {
        private readonly IHttpClientFactory _http;
        private readonly ILogger<LolStaticNames> _logger;
        private readonly SemaphoreSlim _lock = new(1, 1);
        private Catalog? _catalog;
        private DateTime _loadedAt;

        public LolStaticNames(IHttpClientFactory http, ILogger<LolStaticNames> logger) { _http = http; _logger = logger; }

        /// <summary>Inglés normalizado -> (nombre en inglés, nombre en español).</summary>
        private sealed record Catalog(Dictionary<string, (string En, string Es)> Items, Dictionary<string, (string En, string Es)> Runes, Dictionary<string, (string En, string Es)> Spells, string[] SortedKeys);

        private async Task<Catalog?> GetAsync(CancellationToken ct = default)
        {
            if (_catalog != null && DateTime.UtcNow - _loadedAt < TimeSpan.FromDays(1)) return _catalog;
            await _lock.WaitAsync(ct);
            try
            {
                if (_catalog != null && DateTime.UtcNow - _loadedAt < TimeSpan.FromDays(1)) return _catalog;
                var client = _http.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(15);
                var versions = JsonDocument.Parse(await client.GetStringAsync("https://ddragon.leagueoflegends.com/api/versions.json", ct));
                var ver = versions.RootElement[0].GetString() ?? "14.1.1";
                async Task<JsonDocument> Dd(string loc, string file) => JsonDocument.Parse(await client.GetStringAsync($"https://ddragon.leagueoflegends.com/cdn/{ver}/data/{loc}/{file}", ct));

                var items = new Dictionary<string, (string, string)>();
                var (itemEn, itemEs) = (await Dd("en_US", "item.json"), await Dd("es_MX", "item.json"));
                foreach (var it in itemEn.RootElement.GetProperty("data").EnumerateObject())
                {
                    // Solo ítems comprables en la Grieta (sin consumibles ni ítems de otros modos), para no traducir "Poción" a nada raro.
                    if (!it.Value.TryGetProperty("maps", out var maps) || !maps.TryGetProperty("11", out var sr) || !sr.GetBoolean()) continue;
                    var en = it.Value.GetProperty("name").GetString();
                    if (string.IsNullOrWhiteSpace(en)) continue;
                    var es = itemEs.RootElement.GetProperty("data").TryGetProperty(it.Name, out var esIt) ? esIt.GetProperty("name").GetString() ?? en : en;
                    items[Norm(en)] = (en, es);
                }

                var runes = new Dictionary<string, (string, string)>();
                var (runeEn, runeEs) = (await Dd("en_US", "runesReforged.json"), await Dd("es_MX", "runesReforged.json"));
                var esRunes = runeEs.RootElement.EnumerateArray().SelectMany(t => new[] { (t.GetProperty("id").GetInt32(), t.GetProperty("name").GetString() ?? "") }
                    .Concat(t.GetProperty("slots").EnumerateArray().SelectMany(s => s.GetProperty("runes").EnumerateArray()).Select(r => (r.GetProperty("id").GetInt32(), r.GetProperty("name").GetString() ?? ""))))
                    .ToDictionary(x => x.Item1, x => x.Item2);
                foreach (var tree in runeEn.RootElement.EnumerateArray())
                {
                    void Add(JsonElement e) { var en = e.GetProperty("name").GetString(); if (!string.IsNullOrWhiteSpace(en)) runes[Norm(en)] = (en, esRunes.GetValueOrDefault(e.GetProperty("id").GetInt32(), en)); }
                    Add(tree);
                    foreach (var slot in tree.GetProperty("slots").EnumerateArray()) foreach (var r in slot.GetProperty("runes").EnumerateArray()) Add(r);
                }

                var spells = new Dictionary<string, (string, string)>();
                var (spEn, spEs) = (await Dd("en_US", "summoner.json"), await Dd("es_MX", "summoner.json"));
                foreach (var sp in spEn.RootElement.GetProperty("data").EnumerateObject())
                {
                    var en = sp.Value.GetProperty("name").GetString();
                    if (string.IsNullOrWhiteSpace(en)) continue;
                    var es = spEs.RootElement.GetProperty("data").TryGetProperty(sp.Name, out var esSp) ? esSp.GetProperty("name").GetString() ?? en : en;
                    spells[Norm(en)] = (en, es);
                }

                // Los nombres más largos primero, para que "Infinity Edge" no pise "Edge of Night" a medias.
                var keys = items.Keys.Concat(runes.Keys).Concat(spells.Keys).Distinct().OrderByDescending(k => k.Length).ToArray();
                _catalog = new Catalog(items, runes, spells, keys);
                _loadedAt = DateTime.UtcNow;
                _logger.LogInformation("[LolNames] Data Dragon {Ver}: {Items} ítems, {Runes} runas, {Spells} hechizos", ver, items.Count, runes.Count, spells.Count);
                return _catalog;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[LolNames] no se pudo cargar Data Dragon");
                return _catalog;
            }
            finally { _lock.Release(); }
        }

        /// <summary>
        /// Traduce al idioma del canal los nombres en inglés que aparezcan en un texto libre
        /// (runas, hechizos o build). Lo que no se reconoce se deja tal cual.
        /// </summary>
        public async Task<string?> LocalizeAsync(string? text, string lang, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(text) || lang.StartsWith("en", StringComparison.OrdinalIgnoreCase)) return text;
            var cat = await GetAsync(ct);
            if (cat == null) return text;
            var result = text;
            foreach (var key in cat.SortedKeys)
            {
                var entry = cat.Items.TryGetValue(key, out var i) ? i : cat.Runes.TryGetValue(key, out var r) ? r : cat.Spells[key];
                if (entry.En == entry.Es) continue;
                // Coincidencia por palabra completa, sin distinguir mayúsculas ni acentos.
                result = Regex.Replace(result, @"(?<![\p{L}\p{N}])" + Regex.Escape(entry.En) + @"(?![\p{L}\p{N}])", entry.Es, RegexOptions.IgnoreCase);
            }
            return result;
        }

        /// <summary>
        /// Build: separa por comas/flechas, se queda solo con los ítems que existen de verdad
        /// (traducidos) y descarta lo inventado. Si no reconoce ninguno, devuelve el texto original.
        /// </summary>
        public async Task<string?> CleanBuildAsync(string? build, string lang, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(build)) return build;
            var cat = await GetAsync(ct);
            if (cat == null) return build;
            var en = lang.StartsWith("en", StringComparison.OrdinalIgnoreCase);
            var known = new List<string>();
            foreach (var raw in Regex.Split(build, @"\s*(?:,|>|→|->|/|\||\bthen\b|\bluego\b)\s*"))
            {
                var part = Regex.Replace(raw, @"\(.*?\)", "").Trim().TrimEnd('.');
                if (part.Length == 0) continue;
                if (cat.Items.TryGetValue(Norm(part), out var hit)) { known.Add(en ? hit.En : hit.Es); continue; }
                // "Boots of Swiftness (rush)" o "IE": buscar un ítem contenido en el fragmento.
                var inside = cat.SortedKeys.FirstOrDefault(k => cat.Items.ContainsKey(k) && k.Length > 4 && Norm(part).Contains(k));
                if (inside != null) known.Add(en ? cat.Items[inside].En : cat.Items[inside].Es);
            }
            return known.Count == 0 ? build : string.Join(", ", known.Distinct().Take(4));
        }

        internal static string Norm(string s)
        {
            var d = s.Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder(d.Length);
            foreach (var c in d) if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(char.ToLowerInvariant(c));
            return Regex.Replace(sb.ToString(), @"[^a-z0-9]+", " ").Trim();
        }
    }
}
