using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Platforms.Kick
{
    /// <summary>
    /// Resuelve el nombre que escribió alguien en el chat a una categoría de Kick: alias (game_aliases, los mismos de Twitch,
    /// que dan un nombre) → caché propio (kick_category_cache) → API de Kick → se guarda lo encontrado. Plan:
    /// .dev/plans/KICK_TITULO_CATEGORIA_PLAN.md
    /// </summary>
    public class KickCategoryService
    {
        private readonly DecatronDbContext _db;
        private readonly IKickApiService _kick;
        private readonly ILogger<KickCategoryService> _logger;

        public KickCategoryService(DecatronDbContext db, IKickApiService kick, ILogger<KickCategoryService> logger)
        {
            _db = db;
            _kick = kick;
            _logger = logger;
        }

        /// <summary>Minúsculas, sin espacios de más y sin un paréntesis final: «Grand Theft Auto V (GTA)» → «grand theft auto v».</summary>
        public static string Normalize(string name)
        {
            var n = (name ?? "").Trim().ToLowerInvariant();
            var open = n.LastIndexOf('(');
            if (open > 0 && n.EndsWith(')')) n = n[..open].Trim();
            return n;
        }

        /// <summary>Elige de una lista: la exacta (ignorando mayúsculas y un paréntesis final), si no la primera. Es lo que pasa en el chat.</summary>
        public static KickCategory? Pick(IReadOnlyList<KickCategory> results, string term)
        {
            if (results.Count == 0) return null;
            var t = Normalize(term);
            return results.FirstOrDefault(r => string.Equals(r.Name, term.Trim(), StringComparison.OrdinalIgnoreCase))
                   ?? results.FirstOrDefault(r => Normalize(r.Name) == t)
                   ?? results[0];
        }

        public async Task<KickCategory?> ResolveAsync(string query, string accessToken)
        {
            query = (query ?? "").Trim();
            if (query.Length == 0) return null;

            try
            {
                // 1. Alias: «lol» → «League of Legends» (es el nombre; el id de Kick se busca aparte)
                var alias = await _db.GameAliases.AsNoTracking()
                    .Where(a => a.Alias == query.ToLower())
                    .Select(a => a.GameName).FirstOrDefaultAsync();
                var term = string.IsNullOrWhiteSpace(alias) ? query : alias!;

                // 2. Caché: solo si es exacta o por prefijo; una mera coincidencia parcial se le pregunta a la API
                var cached = await FindInCacheAsync(term, includeContains: false);
                if (cached != null) return await UsedAsync(cached);

                // 3. API (v2 y, si no hay nada, v1) y se guarda lo que traiga
                var results = await _kick.SearchCategoriesAsync(accessToken, term);
                if (results.Count == 0 && !string.Equals(term, query, StringComparison.OrdinalIgnoreCase))
                    results = await _kick.SearchCategoriesAsync(accessToken, query);
                if (results.Count > 0)
                {
                    await SaveAsync(results);
                    var pick = Pick(results, term);
                    return pick == null ? null : await UsedAsync(new KickCategoryCache { CategoryId = pick.Id, Name = pick.Name, Thumbnail = pick.Thumbnail });
                }

                // 4. Último recurso: coincidencia parcial en el caché
                cached = await FindInCacheAsync(term, includeContains: true);
                return cached == null ? null : await UsedAsync(cached);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Kick] Error resolviendo la categoría '{Query}'", query);
                return null;
            }
        }

        /// <summary>Para el autocompletado del panel: coincidencias del caché y de la API, la exacta y las que empiezan igual primero.</summary>
        public async Task<List<KickCategory>> SearchAsync(string query, string accessToken, int limit = 10)
        {
            query = (query ?? "").Trim();
            if (query.Length < 2) return new List<KickCategory>();
            try
            {
                var t = query.ToLowerInvariant();
                var results = (await _db.KickCategoryCache.AsNoTracking().Where(c => c.Name.ToLower().Contains(t))
                    .OrderByDescending(c => c.UsageCount).Take(limit).ToListAsync())
                    .Select(c => new KickCategory(c.CategoryId, c.Name, c.Thumbnail)).ToList();

                if (results.Count < limit)
                {
                    var api = await _kick.SearchCategoriesAsync(accessToken, query);
                    if (api.Count > 0) await SaveAsync(api);
                    foreach (var r in api.Where(a => results.All(x => x.Id != a.Id))) results.Add(r);
                }

                var n = Normalize(query);
                return results
                    .OrderBy(r => Normalize(r.Name) == n ? 0 : r.Name.StartsWith(query, StringComparison.OrdinalIgnoreCase) ? 1 : 2)
                    .Take(limit).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Kick] Error buscando categorías '{Query}'", query);
                return new List<KickCategory>();
            }
        }

        private async Task<KickCategoryCache?> FindInCacheAsync(string term, bool includeContains)
        {
            var t = term.Trim().ToLowerInvariant();
            var candidates = await _db.KickCategoryCache.AsNoTracking()
                .Where(c => includeContains ? c.Name.ToLower().Contains(t) : c.Name.ToLower().StartsWith(t))
                .OrderByDescending(c => c.UsageCount).Take(25).ToListAsync();
            if (candidates.Count == 0) return null;
            var n = Normalize(term);
            return candidates.FirstOrDefault(c => Normalize(c.Name) == n)
                   ?? (includeContains ? null : candidates.FirstOrDefault(c => c.Name.StartsWith(term.Trim(), StringComparison.OrdinalIgnoreCase)))
                   ?? (includeContains ? candidates[0] : null);
        }

        private async Task SaveAsync(IEnumerable<KickCategory> results)
        {
            foreach (var r in results)
            {
                var row = await _db.KickCategoryCache.FirstOrDefaultAsync(c => c.CategoryId == r.Id);
                if (row == null)
                    _db.KickCategoryCache.Add(new KickCategoryCache { CategoryId = r.Id, Name = r.Name, Thumbnail = r.Thumbnail });
                else { row.Name = r.Name; row.Thumbnail = r.Thumbnail ?? row.Thumbnail; row.LastUpdated = DateTime.UtcNow; }
            }
            await _db.SaveChangesAsync();
        }

        private async Task<KickCategory> UsedAsync(KickCategoryCache c)
        {
            await _db.KickCategoryCache.Where(x => x.CategoryId == c.CategoryId)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.UsageCount, x => x.UsageCount + 1));
            return new KickCategory(c.CategoryId, c.Name, c.Thumbnail);
        }
    }
}
