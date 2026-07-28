using Amazon.Polly;
using Amazon.Polly.Model;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Decatron.Services
{
    /// <summary>
    /// Catálogo de voces premium, consultado a AWS en vez de escrito a mano.
    ///
    /// Existía en cinco copias pegadas por el frontend, y ninguna decía lo mismo: la de
    /// Speak Chat tenía 16 voces y la de alertas 21. Peor todavía, todas marcaban
    /// únicamente el motor estándar, así que las voces neurales no se podían elegir
    /// aunque el cobro ya supiera cobrarlas.
    ///
    /// AWS es la única fuente que sabe qué voces existen de verdad y qué motores admite
    /// cada una. La lista cambia pocas veces al año, así que se cachea un día entero:
    /// preguntar en cada carga del panel sería pagar una llamada por nada.
    /// </summary>
    public class PollyVoiceCatalogService
    {
        private readonly AmazonPollyClient _polly;
        private readonly IMemoryCache _cache;
        private readonly ILogger<PollyVoiceCatalogService> _logger;

        private const string CacheKey = "polly:voice-catalog";
        private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(24);

        /// <summary>
        /// Evita que veinte pestañas abiertas a la vez disparen veinte DescribeVoices
        /// cuando la caché acaba de expirar.
        /// </summary>
        private static readonly SemaphoreSlim _refreshLock = new(1, 1);

        public PollyVoiceCatalogService(
            AmazonPollyClient polly,
            IMemoryCache cache,
            ILogger<PollyVoiceCatalogService> logger)
        {
            _polly = polly;
            _cache = cache;
            _logger = logger;
        }

        /// <summary>
        /// Los motores que se pueden elegir hoy: estándar a 1 crédito por carácter y
        /// neural a 4.
        ///
        /// AWS ofrece además <c>generative</c> y <c>long-form</c>. La cartera ya sabe
        /// cobrarlos (8 y 25 créditos por carácter), pero el resto del sistema no los
        /// admite: el campo `engine` de las features está tipado como standard|neural y
        /// los selectores solo ofrecen esos dos. Una voz que solo admita los otros se
        /// descarta, porque elegirla terminaría en un fallo de síntesis en directo.
        ///
        /// Para habilitarlos hay que ampliar el tipo en el frontend y los selectores;
        /// añadirlos aquí solo no basta.
        /// </summary>
        private static readonly string[] BillableEngines = { "standard", "neural" };

        /// <param name="Engines">
        /// Solo los motores facturables que admite la voz. Es lo que decide el
        /// multiplicador de créditos, así que no puede salir de una lista escrita a mano:
        /// una voz que se anuncie como neural sin serlo cobraría cuatro veces de más.
        /// </param>
        public record PollyVoice(
            string Id,
            string Name,
            string LanguageCode,
            string LanguageName,
            string Gender,
            IReadOnlyList<string> Engines);

        /// <summary>
        /// El catálogo completo. Nunca lanza: si AWS no responde devuelve la lista de
        /// respaldo, porque un selector de voz vacío deja al streamer sin poder configurar
        /// nada, y eso es peor que enseñar una lista algo desactualizada.
        /// </summary>
        public async Task<IReadOnlyList<PollyVoice>> GetVoicesAsync()
        {
            if (_cache.TryGetValue<IReadOnlyList<PollyVoice>>(CacheKey, out var cached) && cached != null)
                return cached;

            await _refreshLock.WaitAsync();
            try
            {
                // Otra petición pudo haber refrescado mientras esperábamos el turno.
                if (_cache.TryGetValue(CacheKey, out cached) && cached != null)
                    return cached;

                var voices = await FetchFromAwsAsync();
                _cache.Set(CacheKey, voices, CacheDuration);
                return voices;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[PollyCatalog] No se pudo consultar DescribeVoices, usando respaldo");

                // El respaldo se cachea menos tiempo: si AWS estaba de paso caído, no tiene
                // sentido arrastrar la lista corta durante un día entero.
                _cache.Set(CacheKey, FallbackVoices, TimeSpan.FromMinutes(10));
                return FallbackVoices;
            }
            finally
            {
                _refreshLock.Release();
            }
        }

        /// <summary>Las voces de un idioma concreto ("es-MX"), o todas si no se indica.</summary>
        public async Task<IReadOnlyList<PollyVoice>> GetVoicesForLanguageAsync(string? languageCode)
        {
            var all = await GetVoicesAsync();
            if (string.IsNullOrWhiteSpace(languageCode)) return all;

            return all.Where(v => string.Equals(v.LanguageCode, languageCode, StringComparison.OrdinalIgnoreCase))
                      .ToList();
        }

        /// <summary>
        /// Si una voz admite el motor pedido. Lo consulta el cobro antes de aplicar el
        /// multiplicador neural, para no cobrar 4x por algo que AWS va a sintetizar en
        /// estándar de todos modos.
        /// </summary>
        public async Task<bool> SupportsEngineAsync(string voiceId, string engine)
        {
            var voices = await GetVoicesAsync();
            var voice = voices.FirstOrDefault(v => string.Equals(v.Id, voiceId, StringComparison.OrdinalIgnoreCase));

            // Una voz desconocida se deja pasar: puede ser nueva en AWS y estar aún en la
            // lista de respaldo. Que falle la síntesis y se devuelvan los créditos es mejor
            // que bloquear una voz que sí existe.
            if (voice == null) return true;

            return voice.Engines.Contains(engine, StringComparer.OrdinalIgnoreCase);
        }

        private async Task<IReadOnlyList<PollyVoice>> FetchFromAwsAsync()
        {
            var result = new List<PollyVoice>();
            var skipped = 0;
            string? nextToken = null;

            // DescribeVoices pagina. Sin el bucle se pierden voces sin ningún aviso.
            do
            {
                var response = await _polly.DescribeVoicesAsync(new DescribeVoicesRequest
                {
                    IncludeAdditionalLanguageCodes = true,
                    NextToken = nextToken
                });

                foreach (var v in response.Voices)
                {
                    var declared = v.SupportedEngines?
                        .Select(e => e?.ToString()?.ToLowerInvariant() ?? "")
                        .Where(e => e.Length > 0)
                        .ToList() ?? new List<string>();

                    // Sin motores declarados se asume el más barato en vez de descartar la
                    // voz: es lo que hacía AWS antes de publicar el campo.
                    if (declared.Count == 0) declared.Add("standard");

                    var engines = declared.Intersect(BillableEngines, StringComparer.OrdinalIgnoreCase).ToList();

                    // Voces solo generativas o long-form. Existen en AWS pero no se pueden
                    // cobrar todavía, así que no se enseñan.
                    if (engines.Count == 0) { skipped++; continue; }

                    result.Add(new PollyVoice(
                        Id: v.Id?.Value ?? "",
                        Name: v.Name ?? v.Id?.Value ?? "",
                        LanguageCode: v.LanguageCode?.Value ?? "",
                        LanguageName: v.LanguageName ?? "",
                        Gender: v.Gender?.Value ?? "",
                        Engines: engines));
                }

                nextToken = response.NextToken;
            }
            while (!string.IsNullOrEmpty(nextToken));

            var voices = result
                .Where(v => v.Id.Length > 0 && v.LanguageCode.Length > 0)
                .OrderBy(v => v.LanguageCode)
                .ThenBy(v => v.Name)
                .ToList();

            _logger.LogInformation(
                "[PollyCatalog] {Count} voces facturables de {Languages} idiomas ({Neural} neurales), {Skipped} descartadas por motor sin precio",
                voices.Count,
                voices.Select(v => v.LanguageCode).Distinct().Count(),
                voices.Count(v => v.Engines.Contains("neural")),
                skipped);

            return voices;
        }

        /// <summary>
        /// Lo mínimo para que los selectores no salgan vacíos si AWS no contesta. Son las
        /// voces que ya estaban escritas a mano en el frontend, que llevan años existiendo.
        /// </summary>
        private static readonly IReadOnlyList<PollyVoice> FallbackVoices = new List<PollyVoice>
        {
            new("Lupe",     "Lupe",     "es-US", "US Spanish",       "Female", new[] { "standard", "neural" }),
            new("Penelope", "Penelope", "es-US", "US Spanish",       "Female", new[] { "standard" }),
            new("Miguel",   "Miguel",   "es-US", "US Spanish",       "Male",   new[] { "standard" }),
            new("Lucia",    "Lucia",    "es-ES", "Castilian Spanish","Female", new[] { "standard", "neural" }),
            new("Conchita", "Conchita", "es-ES", "Castilian Spanish","Female", new[] { "standard" }),
            new("Enrique",  "Enrique",  "es-ES", "Castilian Spanish","Male",   new[] { "standard" }),
            new("Mia",      "Mia",      "es-MX", "Mexican Spanish",  "Female", new[] { "standard", "neural" }),
            new("Joanna",   "Joanna",   "en-US", "US English",       "Female", new[] { "standard", "neural" }),
            new("Matthew",  "Matthew",  "en-US", "US English",       "Male",   new[] { "standard", "neural" }),
            new("Kendra",   "Kendra",   "en-US", "US English",       "Female", new[] { "standard", "neural" }),
            new("Amy",      "Amy",      "en-GB", "British English",  "Female", new[] { "standard", "neural" }),
            new("Brian",    "Brian",    "en-GB", "British English",  "Male",   new[] { "standard", "neural" }),
            new("Camila",   "Camila",   "pt-BR", "Brazilian Portuguese", "Female", new[] { "standard", "neural" }),
            new("Ricardo",  "Ricardo",  "pt-BR", "Brazilian Portuguese", "Male",   new[] { "standard" }),
            new("Takumi",   "Takumi",   "ja-JP", "Japanese",         "Male",   new[] { "standard", "neural" }),
            new("Mizuki",   "Mizuki",   "ja-JP", "Japanese",         "Female", new[] { "standard" }),
        };
    }
}
