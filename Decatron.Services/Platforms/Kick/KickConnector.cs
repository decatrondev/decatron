using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Decatron.Core.Interfaces;
using Decatron.Core.Settings;
using Microsoft.Extensions.Options;

namespace Decatron.Services.Platforms.Kick
{
    /// <summary>
    /// Conector de Kick sobre <see cref="IPlatformConnector"/>. Porta la logica ya escrita y
    /// probada en el proyecto separado <c>DecatronKick</c>
    /// (<c>KickWebhookController.cs</c> y <c>CommandService.SendKickChatMessageAsync</c>) al
    /// formato comun que el resto del bot ya entiende — ver
    /// .dev/plans/UNIFICACION_MULTIPLATAFORMA_PLAN.md seccion 8.
    ///
    /// IMPORTANTE — lo que este archivo NO resuelve todavia: <c>CommandService.ProcessMessageAsync</c>
    /// (el del proyecto principal, Decatron.Services) resuelve el canal contra la tabla
    /// <c>users</c> via <c>ChannelResolver</c>, que hoy solo sabe buscar por columnas de Twitch.
    /// Sin una fila de canal para Kick (tarea pendiente de la sesion dedicada al modelo de
    /// cuentas), este conector puede traducir mensajes entrantes y mandar mensajes salientes,
    /// pero todavia no hay a que canal real conectarlo end-to-end en produccion.
    /// </summary>
    public class KickConnector : IPlatformConnector
    {
        private readonly ILogger<KickConnector> _logger;
        private readonly IHttpClientFactory _httpFactory;
        private readonly KickSettings _kickSettings;

        public string PlatformName => "kick";

        public KickConnector(
            ILogger<KickConnector> logger,
            IHttpClientFactory httpFactory,
            IOptions<KickSettings> kickSettings)
        {
            _logger = logger;
            _httpFactory = httpFactory;
            _kickSettings = kickSettings.Value;
        }

        /// <summary>
        /// Envia un mensaje al chat de Kick. Porta <c>CommandService.SendKickChatMessageAsync</c>
        /// de DecatronKick — misma llamada a <c>POST /public/v1/chat</c>, mismo formato de payload.
        /// </summary>
        /// <param name="channel">Sin usar todavia: hoy el token de acceso es 1:1 con el
        /// broadcaster porque no hay tabla de canales de Kick en este proyecto. Cuando exista,
        /// el token se busca por canal en vez de recibirlo aparte.</param>
        public async Task SendMessageAsync(string channel, string message)
        {
            await SendMessageAsync(channel, message, broadcasterAccessToken: null, broadcasterUserId: null);
        }

        /// <summary>Version explicita, usable ya mismo desde pruebas manuales sin esperar al modelo de cuentas.</summary>
        public async Task SendMessageAsync(string channel, string message, string? broadcasterAccessToken, string? broadcasterUserId)
        {
            try
            {
                if (string.IsNullOrEmpty(broadcasterAccessToken) || !long.TryParse(broadcasterUserId, out var broadcasterId))
                {
                    _logger.LogWarning("[KickConnector] Sin token o broadcaster_user_id valido para canal {Channel}", channel);
                    return;
                }

                var client = _httpFactory.CreateClient();
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", broadcasterAccessToken);
                client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

                var payload = new { broadcaster_user_id = broadcasterId, content = message, type = "bot" };
                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

                var response = await client.PostAsync("https://api.kick.com/public/v1/chat", content);
                if (!response.IsSuccessStatusCode)
                {
                    var body = await response.Content.ReadAsStringAsync();
                    _logger.LogError("❌ [KickConnector] Error al enviar mensaje a {Channel}: {Status} - {Body}", channel, response.StatusCode, body);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[KickConnector] Excepcion al enviar mensaje a {Channel}", channel);
            }
        }

        /// <summary>
        /// Traduce un payload de <c>chat.message.sent</c> de Kick al formato comun.
        /// Porta el parseo de <c>KickWebhookController.cs</c> — badges confirmados contra el
        /// codigo ya escrito ahi (no solo la documentacion publica, que no lista "vip" ni "og"
        /// con ejemplos): "broadcaster", "moderator", "vip", "subscriber", "og". Se conserva el
        /// respaldo de comparar sender.user_id contra broadcaster.user_id para "es el
        /// broadcaster", por si Kick alguna vez no manda ese badge.
        /// </summary>
        public IncomingChatMessage? ParseChatMessage(JsonElement rawPayload)
        {
            string? msgId = GetSafeString(rawPayload, "message_id");
            string content = GetSafeString(rawPayload, "content") ?? "";

            string senderId = "0";
            string senderName = "Unknown";
            bool isBroadcaster = false, isMod = false, isVip = false, isSub = false, isOg = false;

            if (rawPayload.TryGetProperty("sender", out var senderElem))
            {
                senderId = GetSafeString(senderElem, "user_id") ?? "0";
                senderName = GetSafeString(senderElem, "username") ?? "Unknown";

                if (senderElem.TryGetProperty("identity", out var identityElem) &&
                    identityElem.TryGetProperty("badges", out var badgesArr) &&
                    badgesArr.ValueKind == JsonValueKind.Array)
                {
                    foreach (var badge in badgesArr.EnumerateArray())
                    {
                        var type = GetSafeString(badge, "type")?.ToLower() ?? "";
                        if (type == "broadcaster") isBroadcaster = true;
                        if (type == "moderator") isMod = true;
                        if (type == "vip") isVip = true;
                        if (type == "subscriber") isSub = true;
                        if (type == "og") isOg = true;
                    }
                }
            }

            string broadcasterId = "";
            if (rawPayload.TryGetProperty("broadcaster", out var broadcasterElem))
                broadcasterId = GetSafeString(broadcasterElem, "user_id") ?? "";
            if (string.IsNullOrEmpty(broadcasterId))
                broadcasterId = GetSafeString(rawPayload, "broadcaster_user_id") ?? "";

            if (!string.IsNullOrEmpty(broadcasterId) && senderId == broadcasterId)
                isBroadcaster = true;

            if (string.IsNullOrEmpty(broadcasterId))
                return null;

            // Nota sobre IsSubscriber: en Kick, "og" es un viewer que ya no esta suscripto pero
            // lo estuvo antes (o fue reconocido a mano por el streamer) — no es lo mismo que
            // "subscriber" activo. CommandContext solo tiene un boolean IsSubscriber, asi que
            // por ahora OG cuenta como sub para efectos de permisos (igual que ya hacia
            // DecatronKick en su propio HasPermission: "sub" => isSub || isOg || isVip || isMod).
            // Si mas adelante hace falta distinguirlos, es un campo mas en CommandContext.Metadata,
            // no un cambio de esta interfaz.
            bool countsAsSubscriber = isSub || isOg;

            return new IncomingChatMessage(
                Username: senderName,
                Channel: broadcasterId,
                Message: content,
                UserId: senderId,
                MessageId: msgId,
                IsModerator: isMod,
                IsVip: isVip,
                IsSubscriber: countsAsSubscriber,
                IsBroadcaster: isBroadcaster
            );
        }

        /// <summary>
        /// Kick manda algunos IDs (user_id, sobre todo) como numero JSON, no como
        /// string. Bug real encontrado el 6 ago 2026: la version original solo
        /// aceptaba JsonValueKind.String y descartaba el payload entero
        /// silenciosamente ("sin broadcaster_id") cuando Kick mandaba un numero.
        /// Porta el mismo manejo que ya tenia KickWebhookController.cs de
        /// DecatronKick para este caso.
        /// </summary>
        private static string? GetSafeString(JsonElement element, string propertyName)
        {
            if (!element.TryGetProperty(propertyName, out var prop))
                return null;

            return prop.ValueKind switch
            {
                JsonValueKind.String => prop.GetString(),
                JsonValueKind.Number => prop.GetInt64().ToString(),
                _ => prop.ToString()
            };
        }
    }
}
