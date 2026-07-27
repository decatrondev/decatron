using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    /// <summary>
    /// Servicio unificado que maneja múltiples proveedores de IA con soporte de fallback
    /// </summary>
    public class AIProviderService
    {
        private readonly GeminiService _geminiService;
        private readonly OpenRouterService _openRouterService;
        private readonly ILogger<AIProviderService> _logger;

        public AIProviderService(
            GeminiService geminiService,
            OpenRouterService openRouterService,
            ILogger<AIProviderService> logger)
        {
            _geminiService = geminiService;
            _openRouterService = openRouterService;
            _logger = logger;
        }

        /// <summary>
        /// Genera una respuesta usando el provider configurado, con fallback opcional
        /// </summary>
        public async Task<AIResponse> GenerateResponseAsync(
            string prompt,
            string systemPrompt,
            DecatronAIGlobalConfig config,
            bool truncateForTwitch = true)
        {
            var primaryProvider = config.AIProvider?.ToLower() ?? "gemini";
            var fallbackEnabled = config.FallbackEnabled;

            _logger.LogInformation($"🤖 [AI-PROVIDER] Usando provider: {primaryProvider}, Fallback: {fallbackEnabled}");

            // Intentar con el provider principal
            var response = await CallProviderAsync(primaryProvider, prompt, systemPrompt, config, truncateForTwitch);

            // Si falló o respuesta vacía y fallback está habilitado, intentar con el otro provider
            if ((!response.Success || string.IsNullOrWhiteSpace(response.Text)) && fallbackEnabled)
            {
                var fallbackProvider = primaryProvider == "gemini" ? "openrouter" : "gemini";
                _logger.LogWarning($"⚠️ [AI-PROVIDER] Provider {primaryProvider} falló, intentando fallback a {fallbackProvider}");

                response = await CallProviderAsync(fallbackProvider, prompt, systemPrompt, config, truncateForTwitch);

                if (response.Success)
                {
                    _logger.LogInformation($"✅ [AI-PROVIDER] Fallback a {fallbackProvider} exitoso");
                }
            }

            return response;
        }

        /// <summary>
        /// Genera una respuesta en streaming. OpenRouter usa streaming real, Gemini fallback sin streaming.
        /// </summary>
        public async IAsyncEnumerable<string> GenerateStreamingResponseAsync(
            string prompt,
            string systemPrompt,
            DecatronAIGlobalConfig config,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var provider = config.AIProvider?.ToLower() ?? "gemini";
            _logger.LogInformation($"🤖 [AI-PROVIDER-STREAM] Usando provider: {provider}");

            if (provider == "openrouter")
            {
                await foreach (var token in _openRouterService.GenerateStreamingResponseAsync(
                    prompt, systemPrompt, config.OpenRouterModel, config.MaxTokens, cancellationToken))
                {
                    yield return token;
                }
            }
            else
            {
                // Fallback: llamar no-streaming y devolver todo de una vez
                var response = await CallProviderAsync(provider, prompt, systemPrompt, config, false);
                if (response.Success && !string.IsNullOrEmpty(response.Text))
                {
                    yield return response.Text;
                }
                else
                {
                    throw new InvalidOperationException(response.ErrorMessage ?? "Error generando respuesta");
                }
            }
        }

        private async Task<AIResponse> CallProviderAsync(
            string provider,
            string prompt,
            string systemPrompt,
            DecatronAIGlobalConfig config,
            bool truncateForTwitch)
        {
            try
            {
                switch (provider.ToLower())
                {
                    case "gemini":
                        return await _geminiService.GenerateResponseAsync(
                            prompt,
                            systemPrompt,
                            config.Model,
                            config.MaxTokens,
                            truncateForTwitch);

                    case "openrouter":
                        return await _openRouterService.GenerateResponseAsync(
                            prompt,
                            systemPrompt,
                            config.OpenRouterModel,
                            config.MaxTokens,
                            truncateForTwitch);

                    default:
                        _logger.LogError($"❌ [AI-PROVIDER] Provider desconocido: {provider}");
                        return new AIResponse
                        {
                            Success = false,
                            ErrorMessage = $"Provider desconocido: {provider}",
                            Provider = provider
                        };
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ [AI-PROVIDER] Error llamando a {provider}");
                return new AIResponse
                {
                    Success = false,
                    ErrorMessage = ex.Message,
                    Provider = provider
                };
            }
        }
    }
}
