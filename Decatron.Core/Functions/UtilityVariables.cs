using System;
using System.Linq;
using Microsoft.Extensions.Logging;

namespace Decatron.Core.Functions
{
    /// <summary>
    /// Variables de utilidad: roll, time, date, flip, 8ball, choice
    /// </summary>
    public class UtilityVariables
    {
        private readonly ILogger<UtilityVariables> _logger;
        private readonly Random _random;

        private static readonly string[] _8BallResponses = new[]
        {
            // Afirmativas
            "Sí, definitivamente.",
            "Es cierto.",
            "Sin duda.",
            "Sí.",
            "Puedes contar con ello.",
            "Tal como lo veo, sí.",
            "Probablemente.",
            "Buena perspectiva.",
            "Todo apunta a que sí.",
            "Las señales dicen que sí.",

            // Neutrales
            "Respuesta confusa, intenta de nuevo.",
            "Pregunta de nuevo más tarde.",
            "Mejor no decírtelo ahora.",
            "No puedo predecirlo ahora.",
            "Concéntrate y vuelve a preguntar.",

            // Negativas
            "No cuentes con ello.",
            "Mi respuesta es no.",
            "Mis fuentes dicen que no.",
            "La perspectiva no es buena.",
            "Muy dudoso."
        };

        public UtilityVariables(ILogger<UtilityVariables> logger)
        {
            _logger = logger;
            _random = new Random();
        }

        /// <summary>
        /// Número aleatorio 1-100 o personalizado
        /// $(roll) o $(roll:1-6)
        /// </summary>
        public string Roll(string? range = null)
        {
            try
            {
                int min = 1, max = 100;

                if (!string.IsNullOrEmpty(range))
                {
                    var parts = range.Split('-');
                    if (parts.Length == 2 &&
                        int.TryParse(parts[0].Trim(), out int parsedMin) &&
                        int.TryParse(parts[1].Trim(), out int parsedMax) &&
                        parsedMin < parsedMax)
                    {
                        min = parsedMin;
                        max = parsedMax;
                    }
                }

                return _random.Next(min, max + 1).ToString();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en Roll");
                return "1";
            }
        }

        /// <summary>
        /// Hora actual
        /// $(time) o $(time:HH:mm:ss)
        /// </summary>
        public string Time(string? format = null)
        {
            try
            {
                if (string.IsNullOrEmpty(format))
                {
                    return DateTime.Now.ToString("HH:mm:ss");
                }
                return DateTime.Now.ToString(format);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en Time");
                return DateTime.Now.ToString("HH:mm:ss");
            }
        }

        /// <summary>
        /// Fecha actual
        /// $(date) o $(date:dd/MM/yyyy)
        /// </summary>
        public string Date(string? format = null)
        {
            try
            {
                if (string.IsNullOrEmpty(format))
                {
                    return DateTime.Now.ToString("dd/MM/yyyy");
                }
                return DateTime.Now.ToString(format);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en Date");
                return DateTime.Now.ToString("dd/MM/yyyy");
            }
        }

        /// <summary>
        /// Cara o cruz
        /// $(flip)
        /// </summary>
        public string Flip()
        {
            return _random.Next(2) == 0 ? "Cara" : "Cruz";
        }

        /// <summary>
        /// Respuesta mágica de bola 8
        /// $(8ball)
        /// </summary>
        public string EightBall()
        {
            return _8BallResponses[_random.Next(_8BallResponses.Length)];
        }

        /// <summary>
        /// Elige aleatoriamente entre opciones
        /// $(choice:A,B,C)
        /// </summary>
        public string Choice(string options)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(options))
                {
                    return "Error: Sin opciones";
                }

                var choices = options.Split(new[] { ',', '|' }, StringSplitOptions.RemoveEmptyEntries)
                                    .Select(c => c.Trim())
                                    .Where(c => !string.IsNullOrEmpty(c))
                                    .ToArray();

                if (choices.Length == 0)
                {
                    return "Error: Sin opciones válidas";
                }

                return choices[_random.Next(choices.Length)];
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en Choice");
                return "Error";
            }
        }

        /// <summary>
        /// Porcentaje aleatorio
        /// $(percent)
        /// </summary>
        public string Percent()
        {
            return $"{_random.Next(0, 101)}%";
        }
    }
}
