using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    public class OpenRouterService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<OpenRouterService> _logger;
        private readonly string _apiKey;

        public OpenRouterService(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<OpenRouterService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
            _apiKey = configuration["OpenRouterSettings:ApiKey"] ?? "";
        }

        /// <summary>
        /// Genera una respuesta usando la API de OpenRouter
        /// </summary>
        public async Task<AIResponse> GenerateResponseAsync(
            string prompt,
            string systemPrompt,
            string model = "x-ai/grok-4.1-fast:free",
            int maxTokens = 60,
            bool truncateForTwitch = true)
        {
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();

            try
            {
                if (string.IsNullOrEmpty(_apiKey))
                {
                    _logger.LogError("❌ API Key de OpenRouter no configurada");
                    return new AIResponse
                    {
                        Success = false,
                        ErrorMessage = "API Key de OpenRouter no configurada",
                        Provider = "openrouter"
                    };
                }

                var url = "https://openrouter.ai/api/v1/chat/completions";

                var requestBody = new
                {
                    model = model,
                    max_tokens = maxTokens,
                    messages = new object[]
                    {
                        new { role = "system", content = systemPrompt },
                        new { role = "user", content = prompt }
                    }
                };

                var jsonContent = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

                // Agregar headers requeridos por OpenRouter
                using var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Content = content;
                request.Headers.Add("Authorization", $"Bearer {_apiKey}");
                request.Headers.Add("HTTP-Referer", "https://decatron.stream");
                request.Headers.Add("X-Title", "Decatron IA");

                _logger.LogInformation($"🤖 [OPENROUTER] Enviando prompt: '{prompt.Substring(0, Math.Min(50, prompt.Length))}...'");

                var response = await _httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                stopwatch.Stop();

                if (response.IsSuccessStatusCode)
                {
                    var jsonResponse = JsonSerializer.Deserialize<JsonElement>(responseBody);

                    // Extraer el texto de la respuesta (formato OpenAI)
                    if (jsonResponse.TryGetProperty("choices", out var choices) &&
                        choices.GetArrayLength() > 0)
                    {
                        var choice = choices[0];
                        if (choice.TryGetProperty("message", out var message) &&
                            message.TryGetProperty("content", out var contentProp))
                        {
                            var text = contentProp.GetString() ?? "";

                            // Truncar si es muy largo para Twitch
                            if (truncateForTwitch && text.Length > 400)
                            {
                                text = text.Substring(0, 397) + "...";
                            }

                            // Obtener tokens usados si está disponible
                            int tokensUsed = 0;
                            if (jsonResponse.TryGetProperty("usage", out var usage))
                            {
                                if (usage.TryGetProperty("total_tokens", out var totalTokens))
                                {
                                    tokensUsed = totalTokens.GetInt32();
                                }
                            }

                            _logger.LogInformation($"✅ [OPENROUTER] Respuesta recibida ({stopwatch.ElapsedMilliseconds}ms, {tokensUsed} tokens)");

                            return new AIResponse
                            {
                                Success = true,
                                Text = text,
                                TokensUsed = tokensUsed,
                                ResponseTimeMs = (int)stopwatch.ElapsedMilliseconds,
                                Provider = "openrouter"
                            };
                        }
                    }

                    _logger.LogWarning($"⚠️ [OPENROUTER] Respuesta sin contenido válido: {responseBody}");
                    return new AIResponse
                    {
                        Success = false,
                        ErrorMessage = "Respuesta sin contenido válido",
                        ResponseTimeMs = (int)stopwatch.ElapsedMilliseconds,
                        Provider = "openrouter"
                    };
                }
                else
                {
                    _logger.LogError($"❌ [OPENROUTER] Error API: {response.StatusCode} - {responseBody}");
                    return new AIResponse
                    {
                        Success = false,
                        ErrorMessage = $"Error API: {response.StatusCode}",
                        ResponseTimeMs = (int)stopwatch.ElapsedMilliseconds,
                        Provider = "openrouter"
                    };
                }
            }
            catch (Exception ex)
            {
                stopwatch.Stop();
                _logger.LogError(ex, "❌ [OPENROUTER] Excepción al llamar API");
                return new AIResponse
                {
                    Success = false,
                    ErrorMessage = ex.Message,
                    ResponseTimeMs = (int)stopwatch.ElapsedMilliseconds,
                    Provider = "openrouter"
                };
            }
        }
    }

    /// <summary>
    /// Respuesta unificada para servicios de IA
    /// </summary>
    public class AIResponse
    {
        public bool Success { get; set; }
        public string? Text { get; set; }
        public string? ErrorMessage { get; set; }
        public int TokensUsed { get; set; }
        public int ResponseTimeMs { get; set; }
        public string Provider { get; set; } = "unknown";
    }
}
