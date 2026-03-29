using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    public class GeminiService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<GeminiService> _logger;
        private readonly string _apiKey;

        public GeminiService(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<GeminiService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
            _apiKey = configuration["GeminiSettings:ApiKey"] ?? "";
        }

        /// <summary>
        /// Genera una respuesta usando la API de Gemini
        /// </summary>
        public async Task<AIResponse> GenerateResponseAsync(
            string prompt,
            string systemPrompt,
            string model = "gemini-2.0-flash-lite",
            int maxTokens = 60,
            bool truncateForTwitch = true)
        {
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();

            try
            {
                if (string.IsNullOrEmpty(_apiKey))
                {
                    _logger.LogError("❌ API Key de Gemini no configurada");
                    return new AIResponse
                    {
                        Success = false,
                        ErrorMessage = "API Key no configurada",
                        Provider = "gemini"
                    };
                }

                var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={_apiKey}";

                var requestBody = new
                {
                    contents = new[]
                    {
                        new
                        {
                            parts = new[]
                            {
                                new { text = prompt }
                            }
                        }
                    },
                    systemInstruction = new
                    {
                        parts = new[]
                        {
                            new { text = systemPrompt }
                        }
                    },
                    generationConfig = new
                    {
                        maxOutputTokens = maxTokens,
                        temperature = 0.7,
                        topP = 0.95,
                        topK = 40
                    },
                    safetySettings = new[]
                    {
                        new { category = "HARM_CATEGORY_HARASSMENT", threshold = "BLOCK_MEDIUM_AND_ABOVE" },
                        new { category = "HARM_CATEGORY_HATE_SPEECH", threshold = "BLOCK_MEDIUM_AND_ABOVE" },
                        new { category = "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold = "BLOCK_MEDIUM_AND_ABOVE" },
                        new { category = "HARM_CATEGORY_DANGEROUS_CONTENT", threshold = "BLOCK_MEDIUM_AND_ABOVE" }
                    }
                };

                var jsonContent = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

                _logger.LogInformation($"🤖 [GEMINI] Enviando prompt: '{prompt.Substring(0, Math.Min(50, prompt.Length))}...'");

                var response = await _httpClient.PostAsync(url, content);
                var responseBody = await response.Content.ReadAsStringAsync();

                stopwatch.Stop();

                if (response.IsSuccessStatusCode)
                {
                    var geminiResponse = JsonSerializer.Deserialize<JsonElement>(responseBody);

                    // Extraer el texto de la respuesta
                    if (geminiResponse.TryGetProperty("candidates", out var candidates) &&
                        candidates.GetArrayLength() > 0)
                    {
                        var candidate = candidates[0];
                        if (candidate.TryGetProperty("content", out var contentProp) &&
                            contentProp.TryGetProperty("parts", out var parts) &&
                            parts.GetArrayLength() > 0)
                        {
                            var text = parts[0].GetProperty("text").GetString() ?? "";

                            // Truncar si es muy largo para Twitch (máx ~450 chars para dejar espacio al prefix)
                            if (truncateForTwitch && text.Length > 400)
                            {
                                text = text.Substring(0, 397) + "...";
                            }

                            // Obtener tokens usados si está disponible
                            int tokensUsed = 0;
                            if (geminiResponse.TryGetProperty("usageMetadata", out var usage) &&
                                usage.TryGetProperty("totalTokenCount", out var tokenCount))
                            {
                                tokensUsed = tokenCount.GetInt32();
                            }

                            _logger.LogInformation($"✅ [GEMINI] Respuesta recibida ({stopwatch.ElapsedMilliseconds}ms, {tokensUsed} tokens)");

                            return new AIResponse
                            {
                                Success = true,
                                Text = text,
                                TokensUsed = tokensUsed,
                                ResponseTimeMs = (int)stopwatch.ElapsedMilliseconds,
                                Provider = "gemini"
                            };
                        }
                    }

                    _logger.LogWarning($"⚠️ [GEMINI] Respuesta sin contenido válido: {responseBody}");
                    return new AIResponse
                    {
                        Success = false,
                        ErrorMessage = "Respuesta sin contenido válido",
                        ResponseTimeMs = (int)stopwatch.ElapsedMilliseconds,
                        Provider = "gemini"
                    };
                }
                else
                {
                    _logger.LogError($"❌ [GEMINI] Error API: {response.StatusCode} - {responseBody}");
                    return new AIResponse
                    {
                        Success = false,
                        ErrorMessage = $"Error API: {response.StatusCode}",
                        ResponseTimeMs = (int)stopwatch.ElapsedMilliseconds,
                        Provider = "gemini"
                    };
                }
            }
            catch (Exception ex)
            {
                stopwatch.Stop();
                _logger.LogError(ex, "❌ [GEMINI] Excepción al llamar API");
                return new AIResponse
                {
                    Success = false,
                    ErrorMessage = ex.Message,
                    ResponseTimeMs = (int)stopwatch.ElapsedMilliseconds,
                    Provider = "gemini"
                };
            }
        }
    }
}
