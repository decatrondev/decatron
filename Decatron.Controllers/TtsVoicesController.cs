using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;

namespace Decatron.Controllers
{
    /// <summary>
    /// Catálogo de voces, estándar y premium. Lo consultan los selectores de todas las
    /// features, así que basta con estar autenticado: no expone nada sensible, solo qué
    /// voces existen.
    ///
    /// Es la única fuente. Antes cada pantalla llevaba su propia lista escrita a mano y
    /// ninguna coincidía con las demás: Speak Chat tenía 16 voces y las alertas 21.
    /// </summary>
    [ApiController]
    [Route("api/tts")]
    [Authorize]
    public class TtsVoicesController : ControllerBase
    {
        private readonly PiperTtsService _piper;
        private readonly PollyVoiceCatalogService _pollyCatalog;

        public TtsVoicesController(PiperTtsService piper, PollyVoiceCatalogService pollyCatalog)
        {
            _piper = piper;
            _pollyCatalog = pollyCatalog;
        }

        /// <summary>Nombre legible del hablante, para no enseñar "hfc_male" en el panel.</summary>
        private static string PrettySpeaker(string speaker) =>
            string.Join(" ", speaker.Split('_')
                .Where(p => p.Length > 0)
                .Select(p => char.ToUpperInvariant(p[0]) + p[1..]));

        /// <summary>
        /// Excepciones al nombre que da el sistema. Solo para los códigos que .NET no
        /// reconoce o que queremos redactar distinto; el resto se traduce solo.
        /// </summary>
        private static readonly Dictionary<string, string> _languageOverrides = new(StringComparer.OrdinalIgnoreCase)
        {
            ["es-US"]     = "Español (EE. UU.)",   // .NET dice "Estados Unidos", más largo
            ["en-US"]     = "Inglés (EE. UU.)",
            ["en-GB-WLS"] = "Inglés (Gales)",      // código propio de AWS, .NET no lo traduce
            ["arb"]       = "Árabe estándar",
            ["cmn-CN"]    = "Chino mandarín",
            ["yue-CN"]    = "Chino cantonés",
        };

        /// <summary>
        /// Nombre legible de un idioma, en español.
        ///
        /// Antes esto era una tabla escrita a mano con 14 entradas. AWS devuelve 41
        /// idiomas, así que los 27 restantes salían en pantalla como "en-IN". Traducirlos
        /// a mano solo aplaza el problema: en cuanto AWS añada una voz vuelve a pasar.
        ///
        /// El sistema ya sabe traducir estos códigos, así que se le pregunta a él y se
        /// cachea. La tabla de arriba queda solo para las excepciones.
        /// </summary>
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, string> _languageLabelCache = new();
        private static readonly object _cultureLock = new();

        private static string LanguageLabel(string code, string? fallback = null)
        {
            if (string.IsNullOrWhiteSpace(code)) return fallback ?? "";
            if (_languageOverrides.TryGetValue(code, out var custom)) return custom;

            return _languageLabelCache.GetOrAdd(code, c =>
            {
                try
                {
                    // DisplayName se traduce según la cultura del hilo, y no hay forma de
                    // pedirlo en un idioma concreto sin cambiarla. Se hace bajo cerrojo y
                    // se restaura; como el resultado se cachea, pasa una vez por idioma.
                    lock (_cultureLock)
                    {
                        var original = CultureInfo.CurrentUICulture;
                        try
                        {
                            CultureInfo.CurrentUICulture = new CultureInfo("es");
                            var name = new CultureInfo(c).DisplayName;

                            // .NET devuelve "inglés (India)" en minúscula inicial.
                            if (!string.IsNullOrEmpty(name) && char.IsLower(name[0]))
                                name = char.ToUpperInvariant(name[0]) + name[1..];

                            return name;
                        }
                        finally { CultureInfo.CurrentUICulture = original; }
                    }
                }
                catch
                {
                    // Código que .NET no conoce. Mejor el nombre en inglés de AWS que el
                    // código pelado, y el código solo como último recurso.
                    return string.IsNullOrWhiteSpace(fallback) ? c : fallback;
                }
            });
        }

        /// <summary>
        /// Piper usa "es_MX" y Polly "es-MX". Sin unificarlos, el mismo idioma aparecería
        /// dos veces en la lista y el filtro no cruzaría los dos proveedores.
        /// </summary>
        private static string NormalizeLanguage(string code) => (code ?? "").Replace('_', '-');

        /// <summary>
        /// Todo lo que necesita un selector de voz en una sola petición: las dos listas y
        /// los idiomas que resultan de ellas.
        ///
        /// Los idiomas salen del catálogo, no de una lista fija. Así deja de ser posible
        /// elegir un idioma para el que no hay ninguna voz, que es de donde salían las
        /// configuraciones con voz japonesa e idioma español.
        /// </summary>
        [HttpGet("voices")]
        public async Task<IActionResult> GetVoices()
        {
            var piperVoices = _piper.ListVoices();
            var pollyVoices = await _pollyCatalog.GetVoicesAsync();

            var standard = piperVoices.Select(v =>
            {
                var lang = NormalizeLanguage(v.Language);
                return new
                {
                    id = v.Id,
                    name = PrettySpeaker(v.Speaker),
                    quality = v.Quality,
                    language = lang,
                    languageName = LanguageLabel(lang),
                    languagePrefix = lang.Split('-')[0].ToLowerInvariant()
                };
            }).ToList();

            var premium = pollyVoices.Select(v => new
            {
                id = v.Id,
                name = v.Name,
                gender = v.Gender,
                language = v.LanguageCode,
                languageName = LanguageLabel(v.LanguageCode, v.LanguageName),
                languagePrefix = v.LanguageCode.Split('-')[0].ToLowerInvariant(),
                engines = v.Engines,
                // El multiplicador vive en el cobro; aquí solo se dice si la voz puede
                // hacerlo, para que el panel avise de que costará más.
                supportsNeural = v.Engines.Contains("neural", StringComparer.OrdinalIgnoreCase)
            }).ToList();

            // Un idioma por código, diciendo exactamente qué se puede hacer con él.
            //
            // Los dos últimos campos hacen falta porque la calidad recorta el catálogo de
            // verdad: 13 idiomas existen solo en neural y 6 solo en normal — el ruso, sin
            // ir más lejos. Sin distinguirlos, el panel ofrece un idioma para el que luego
            // no hay ninguna voz, y el streamer se queda mirando una lista vacía.
            var languages = standard.Select(v => v.language)
                .Concat(premium.Select(v => v.language))
                .Where(c => !string.IsNullOrWhiteSpace(c))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Select(code => new
                {
                    code,
                    label = LanguageLabel(code),
                    // Voz estándar = Piper, auto-alojada. No confundir con el motor
                    // "standard" de Polly, que es otra cosa y va justo debajo.
                    hasStandard = standard.Any(v => string.Equals(v.language, code, StringComparison.OrdinalIgnoreCase)),
                    hasPremium = premium.Any(v => string.Equals(v.language, code, StringComparison.OrdinalIgnoreCase)),
                    hasPremiumNormal = premium.Any(v => string.Equals(v.language, code, StringComparison.OrdinalIgnoreCase)
                        && v.engines.Contains("standard", StringComparer.OrdinalIgnoreCase)),
                    hasPremiumHigh = premium.Any(v => string.Equals(v.language, code, StringComparison.OrdinalIgnoreCase)
                        && v.engines.Contains("neural", StringComparer.OrdinalIgnoreCase))
                })
                .OrderBy(l => l.label, StringComparer.CurrentCulture)
                .ToList();

            return Ok(new
            {
                success = true,
                standard = new { available = _piper.IsAvailable && standard.Count > 0, voices = standard },
                premium = new { available = premium.Count > 0, voices = premium },
                languages
            });
        }

        /// <summary>
        /// Solo las voces estándar. Se mantiene porque los selectores de voz estándar ya
        /// la consumen y no necesitan cargar además el catálogo de Polly.
        /// </summary>
        [HttpGet("standard-voices")]
        public IActionResult GetStandardVoices()
        {
            var voices = _piper.ListVoices();

            return Ok(new
            {
                success = true,
                available = _piper.IsAvailable && voices.Count > 0,
                voices = voices.Select(v => new
                {
                    id = v.Id,
                    speaker = PrettySpeaker(v.Speaker),
                    quality = v.Quality,
                    language = v.Language,
                    languageName = LanguageLabel(NormalizeLanguage(v.Language)),
                    // Prefijo ISO para poder filtrar por el idioma que tenga configurado
                    // la feature sin tener que saber de variantes regionales
                    languagePrefix = v.Language.Split('_')[0].ToLowerInvariant()
                })
            });
        }

        /// <summary>Solo las voces premium, opcionalmente filtradas por idioma.</summary>
        [HttpGet("premium-voices")]
        public async Task<IActionResult> GetPremiumVoices([FromQuery] string? language = null)
        {
            var voices = await _pollyCatalog.GetVoicesForLanguageAsync(language);

            return Ok(new
            {
                success = true,
                available = voices.Count > 0,
                voices = voices.Select(v => new
                {
                    id = v.Id,
                    name = v.Name,
                    gender = v.Gender,
                    language = v.LanguageCode,
                    languageName = LanguageLabel(v.LanguageCode, v.LanguageName),
                    languagePrefix = v.LanguageCode.Split('-')[0].ToLowerInvariant(),
                    engines = v.Engines,
                    supportsNeural = v.Engines.Contains("neural", StringComparer.OrdinalIgnoreCase)
                })
            });
        }
    }
}
