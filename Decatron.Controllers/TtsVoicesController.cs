using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Decatron.Controllers
{
    /// <summary>
    /// Catálogo de voces estándar (Piper). Lo consultan los selectores de voz de las
    /// cuatro features, así que basta con estar autenticado: no expone nada sensible,
    /// solo qué modelos hay instalados en el servidor.
    /// </summary>
    [ApiController]
    [Route("api/tts")]
    [Authorize]
    public class TtsVoicesController : ControllerBase
    {
        private readonly PiperTtsService _piper;

        public TtsVoicesController(PiperTtsService piper)
        {
            _piper = piper;
        }

        /// <summary>Nombre legible del hablante, para no enseñar "hfc_male" en el panel.</summary>
        private static string PrettySpeaker(string speaker) =>
            string.Join(" ", speaker.Split('_')
                .Where(p => p.Length > 0)
                .Select(p => char.ToUpperInvariant(p[0]) + p[1..]));

        private static readonly Dictionary<string, string> _languageNames = new(StringComparer.OrdinalIgnoreCase)
        {
            ["es_ES"] = "Español (España)",
            ["es_MX"] = "Español (México)",
            ["es_AR"] = "Español (Argentina)",
            ["en_US"] = "Inglés (EE. UU.)",
            ["en_GB"] = "Inglés (Reino Unido)",
            ["pt_BR"] = "Portugués (Brasil)",
            ["pt_PT"] = "Portugués (Portugal)",
            ["fr_FR"] = "Francés",
            ["de_DE"] = "Alemán",
            ["it_IT"] = "Italiano",
        };

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
                    languageName = _languageNames.TryGetValue(v.Language, out var name) ? name : v.Language,
                    // Prefijo ISO para poder filtrar por el idioma que tenga configurado
                    // la feature sin tener que saber de variantes regionales
                    languagePrefix = v.Language.Split('_')[0].ToLowerInvariant()
                })
            });
        }
    }
}
