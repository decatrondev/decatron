using System.Collections.Concurrent;
using System.Net.Http;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Multiview
{
    /// <summary>Estado de una casilla de Kick tal como lo ve el Multi-view.</summary>
    public sealed record KickChannelStatus(string Slug, bool Exists, bool Live, int? Viewers, long? ChatroomId, string? Title, long? UserId = null);

    /// <summary>
    /// Consulta pública de un canal de Kick (existe, en vivo, espectadores, sala de chat) sin sesión y con caché corta,
    /// para que el Multi-view no dependa del navegador del espectador. Usa el endpoint web de Kick (no es la API
    /// oficial: puede cambiar sin aviso), por eso vive aislado aquí y, si falla, devuelve null y la página cae a
    /// "player + chat oficial". Plan: .dev/plans/MULTIVIEW_PLAN.md, Fase 0 (resultados).
    /// </summary>
    public sealed class MultiviewStatusService
    {
        private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(30);
        private const string UserAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

        private readonly IHttpClientFactory _http;
        private readonly IMemoryCache _cache;
        private readonly ILogger<MultiviewStatusService> _logger;

        public MultiviewStatusService(IHttpClientFactory http, IMemoryCache cache, ILogger<MultiviewStatusService> logger)
        {
            _http = http;
            _cache = cache;
            _logger = logger;
        }

        /// <summary>Un usuario de Kick válido: letras, números, guion y guion bajo.</summary>
        public static bool IsValidSlug(string? slug) =>
            !string.IsNullOrEmpty(slug) && slug.Length <= 25 && slug.All(c => char.IsAsciiLetterOrDigit(c) || c is '_' or '-');

        public async Task<KickChannelStatus?> GetKickAsync(string slug, CancellationToken ct = default)
        {
            slug = slug.ToLowerInvariant();
            if (!IsValidSlug(slug)) return null;
            var key = $"multiview:kick:{slug}";
            if (_cache.TryGetValue(key, out KickChannelStatus? hit)) return hit;

            KickChannelStatus? result = null;
            try
            {
                var client = _http.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(8);
                using var req = new HttpRequestMessage(HttpMethod.Get, $"https://kick.com/api/v2/channels/{Uri.EscapeDataString(slug)}");
                req.Headers.TryAddWithoutValidation("User-Agent", UserAgent);
                req.Headers.TryAddWithoutValidation("Accept", "application/json");
                using var res = await client.SendAsync(req, ct);
                if (res.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    result = new KickChannelStatus(slug, false, false, null, null, null);
                }
                else if (res.IsSuccessStatusCode)
                {
                    using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
                    var root = doc.RootElement;
                    long? chatroom = root.TryGetProperty("chatroom", out var c) && c.ValueKind == JsonValueKind.Object && c.TryGetProperty("id", out var cid) && cid.TryGetInt64(out var cv) ? cv : null;
                    var live = root.TryGetProperty("livestream", out var ls) && ls.ValueKind == JsonValueKind.Object;
                    int? viewers = live && ls.TryGetProperty("viewer_count", out var vc) && vc.TryGetInt32(out var vv) ? vv : null;
                    string? title = live && ls.TryGetProperty("session_title", out var st) && st.ValueKind == JsonValueKind.String ? st.GetString() : null;
                    long? userId = root.TryGetProperty("user_id", out var uid) && uid.TryGetInt64(out var uv) ? uv : null;
                    result = new KickChannelStatus(slug, true, live, viewers, chatroom, title, userId);
                }
                else
                {
                    _logger.LogWarning("Kick respondió {Status} al consultar el canal {Slug} para el Multi-view", (int)res.StatusCode, slug);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "No se pudo consultar el canal de Kick {Slug} para el Multi-view", slug);
            }

            // También se guarda el fallo (null) un rato para no martillar a Kick cuando está caído.
            _cache.Set(key, result, result == null ? TimeSpan.FromSeconds(15) : Ttl);
            return result;
        }
    }
}
