using Microsoft.Extensions.Logging;

namespace Decatron.Core.Helpers
{
    /// <summary>
    /// Helper para llamadas a id.twitch.tv con fallback a proxy de Cloudflare
    /// si Twitch no responde.
    /// </summary>
    public static class TwitchAuthHelper
    {
        private const string PrimaryBaseUrl = "https://id.twitch.tv";
        private const string FallbackBaseUrl = "https://twitch-auth.decatron.net";
        private static readonly TimeSpan PrimaryTimeout = TimeSpan.FromSeconds(5);

        /// <summary>
        /// Ejecuta un POST a id.twitch.tv, si falla por timeout usa el proxy.
        /// </summary>
        public static async Task<HttpResponseMessage> PostWithFallbackAsync(
            HttpClient client, string path, HttpContent content, ILogger? logger = null)
        {
            var primaryUrl = $"{PrimaryBaseUrl}{path}";
            var fallbackUrl = $"{FallbackBaseUrl}{path}";

            try
            {
                using var cts = new CancellationTokenSource(PrimaryTimeout);
                var response = await client.PostAsync(primaryUrl, content, cts.Token);
                return response;
            }
            catch (Exception ex) when (ex is TaskCanceledException or HttpRequestException)
            {
                logger?.LogWarning("id.twitch.tv no responde, usando proxy fallback para POST {Path}", path);
            }

            // Fallback: recrear el content porque ya se consumió
            return await client.PostAsync(fallbackUrl, content);
        }

        /// <summary>
        /// Ejecuta un POST (con query string) a id.twitch.tv, si falla por timeout usa el proxy.
        /// </summary>
        public static async Task<HttpResponseMessage> SendWithFallbackAsync(
            HttpClient client, HttpRequestMessage request, ILogger? logger = null)
        {
            var originalUri = request.RequestUri!;
            var primaryUrl = $"{PrimaryBaseUrl}{originalUri.PathAndQuery}";
            var fallbackUrl = $"{FallbackBaseUrl}{originalUri.PathAndQuery}";

            try
            {
                using var cts = new CancellationTokenSource(PrimaryTimeout);
                var primaryRequest = CloneRequest(request, new Uri(primaryUrl));
                var response = await client.SendAsync(primaryRequest, cts.Token);
                return response;
            }
            catch (Exception ex) when (ex is TaskCanceledException or HttpRequestException)
            {
                logger?.LogWarning("id.twitch.tv no responde, usando proxy fallback para {Method} {Path}", request.Method, originalUri.PathAndQuery);
            }

            var fallbackRequest = CloneRequest(request, new Uri(fallbackUrl));
            return await client.SendAsync(fallbackRequest);
        }

        /// <summary>
        /// Ejecuta un GET a id.twitch.tv, si falla por timeout usa el proxy.
        /// </summary>
        public static async Task<HttpResponseMessage> GetWithFallbackAsync(
            HttpClient client, string path, ILogger? logger = null)
        {
            var primaryUrl = $"{PrimaryBaseUrl}{path}";
            var fallbackUrl = $"{FallbackBaseUrl}{path}";

            try
            {
                using var cts = new CancellationTokenSource(PrimaryTimeout);
                var response = await client.GetAsync(primaryUrl, cts.Token);
                return response;
            }
            catch (Exception ex) when (ex is TaskCanceledException or HttpRequestException)
            {
                logger?.LogWarning("id.twitch.tv no responde, usando proxy fallback para GET {Path}", path);
            }

            return await client.GetAsync(fallbackUrl);
        }

        private static HttpRequestMessage CloneRequest(HttpRequestMessage original, Uri newUri)
        {
            var clone = new HttpRequestMessage(original.Method, newUri);
            if (original.Content != null)
                clone.Content = original.Content;
            foreach (var header in original.Headers)
                clone.Headers.TryAddWithoutValidation(header.Key, header.Value);
            return clone;
        }
    }
}
