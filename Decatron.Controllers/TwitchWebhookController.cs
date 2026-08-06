using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/twitch")]
    public class TwitchWebhookController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<TwitchWebhookController> _logger;
        private readonly EventSubService _eventSubService;
        private readonly EventSubNotificationHandler _notificationHandler;

        public TwitchWebhookController(
            IConfiguration configuration,
            ILogger<TwitchWebhookController> logger,
            EventSubService eventSubService,
            EventSubNotificationHandler notificationHandler)
        {
            _configuration = configuration;
            _logger = logger;
            _eventSubService = eventSubService;
            _notificationHandler = notificationHandler;
        }

        private void LogToFile(string message)
        {
            _logger.LogInformation("[Webhook] {Message}", message);
        }

        /// <summary>
        /// Transporte webhook apagado el 6 ago 2026 (Fase B.5 de la migración a
        /// Conduits, sección 2.1 del roadmap). Cero suscripciones activas apuntan
        /// acá — verificado contra la API de Twitch antes de apagarlo (416/416 por
        /// conduit). Se deja el endpoint respondiendo 200 en vez de removerlo, para
        /// no generar 404 si Twitch reintenta algo residual, y para poder revertir
        /// sin desplegar si hiciera falta. WebhookSecret/EventSubWebhookSecret/
        /// WebhookCallbackUrl quedan huérfanos en secrets, sin borrar.
        /// </summary>
        [HttpPost("webhook")]
        public IActionResult ManejadorWebhook()
        {
            _logger.LogWarning("⚠️ Webhook de EventSub recibió una llamada, pero el transporte está apagado desde el 6 ago 2026 (todo migrado a conduit). No se procesa.");
            return Ok();
        }

        [Obsolete("Transporte webhook apagado (Fase B.5). Se conserva el código de verificación/dispatch por si hiciera falta revertir, pero ya no se invoca desde ManejadorWebhook.")]
        private async Task<IActionResult> ManejadorWebhookLegacy()
        {
            string cuerpo;
            using (var lector = new StreamReader(Request.Body, Encoding.UTF8))
            {
                cuerpo = await lector.ReadToEndAsync();
            }

            var tipoMensaje = Request.Headers["Twitch-Eventsub-Message-Type"].ToString();
            var idMensaje = Request.Headers["Twitch-Eventsub-Message-Id"].ToString();
            var marcaTiempo = Request.Headers["Twitch-Eventsub-Message-Timestamp"].ToString();
            var encabezadoFirma = Request.Headers["Twitch-Eventsub-Message-Signature"].ToString();

            if (!VerificarFirma(idMensaje, marcaTiempo, cuerpo, encabezadoFirma))
            {
                LogToFile("ERROR: Verificación de firma fallida");
                _logger.LogWarning("❌ Verificación de firma fallida");
                return Unauthorized();
            }

            var json = JObject.Parse(cuerpo);

            switch (tipoMensaje)
            {
                case "webhook_callback_verification":
                    var desafio = json["challenge"].ToString();
                    LogToFile($"✅ Respondiendo desafío de verificación");
                    _logger.LogInformation($"✅ Webhook verificado correctamente");
                    return Content(desafio);

                case "notification":
                    var tipoEvento = json["subscription"]["type"].ToString();
                    var datosEvento = json["event"] as JObject;
                    await _notificationHandler.ManejarEvento(tipoEvento, datosEvento);
                    return Ok();

                default:
                    LogToFile($"ALERTA: Tipo de mensaje desconocido: {tipoMensaje}");
                    _logger.LogWarning($"⚠️ Tipo de mensaje desconocido: {tipoMensaje}");
                    return BadRequest();
            }
        }

        private bool VerificarFirma(string idMensaje, string marcaTiempo, string cuerpo, string encabezadoFirma)
        {
            var secreto = _configuration["TwitchSettings:WebhookSecret"];
            if (string.IsNullOrEmpty(secreto))
            {
                LogToFile("ERROR: WebhookSecret no configurado");
                _logger.LogError("❌ WebhookSecret no configurado");
                return false;
            }
            var mensaje = idMensaje + marcaTiempo + cuerpo;
            using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secreto)))
            {
                var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(mensaje));
                var firmaCalculada = BitConverter.ToString(hash).Replace("-", "").ToLower();
                return encabezadoFirma == $"sha256={firmaCalculada}";
            }
        }

        // ==================== ENDPOINTS EVENTSUB ====================

        /// <summary>
        /// Resuelve el conduit activo para que las suscripciones creadas desde estos
        /// endpoints usen conduit en vez de caer al webhook por defecto de EventSubService.
        /// </summary>
        private async Task<string?> GetActiveConduitIdAsync()
        {
            var conduitsResult = await _eventSubService.GetConduitsAsync();
            if (!conduitsResult.Success || string.IsNullOrEmpty(conduitsResult.ResponseBody))
                return null;

            try
            {
                var conduitsJson = System.Text.Json.JsonDocument.Parse(conduitsResult.ResponseBody);
                var conduitsData = conduitsJson.RootElement.GetProperty("data");
                return conduitsData.GetArrayLength() > 0 ? conduitsData[0].GetProperty("id").GetString() : null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error parseando la lista de conduits");
                return null;
            }
        }

        /// <summary>
        /// Registra una suscripción EventSub para channel.chat.message
        /// </summary>
        [HttpPost("eventsub/subscribe/chat")]
        [RequirePermission("settings", "control_total")]
        public async Task<IActionResult> SubscribeToChatMessages([FromBody] EventSubSubscribeRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.BroadcasterUserId))
                {
                    return BadRequest(new { error = "broadcaster_user_id es requerido" });
                }

                var conduitId = await GetActiveConduitIdAsync();
                var transportMode = conduitId != null ? EventSubTransportMode.Conduit : EventSubTransportMode.Webhook;
                var result = await _eventSubService.SubscribeToChatMessagesAsync(request.BroadcasterUserId, transportMode, conduitId);

                if (result.Success)
                {
                    return Ok(new
                    {
                        message = result.Message,
                        data = result.ResponseBody != null ? JsonConvert.DeserializeObject(result.ResponseBody) : null
                    });
                }
                else
                {
                    return BadRequest(new
                    {
                        message = result.Message,
                        error = result.ResponseBody != null ? JsonConvert.DeserializeObject(result.ResponseBody) : null
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en SubscribeToChatMessages");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Registra una suscripción EventSub para channel.channel_points_custom_reward_redemption.add
        /// </summary>
        [HttpPost("eventsub/subscribe/channel-points")]
        [RequirePermission("settings", "control_total")]
        public async Task<IActionResult> SubscribeToChannelPoints([FromBody] EventSubSubscribeRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.BroadcasterUserId))
                {
                    return BadRequest(new { error = "broadcaster_user_id es requerido" });
                }

                var conduitId = await GetActiveConduitIdAsync();
                var transportMode = conduitId != null ? EventSubTransportMode.Conduit : EventSubTransportMode.Webhook;
                var result = await _eventSubService.EnsureChannelPointsSubscriptionAsync(request.BroadcasterUserId, transportMode, conduitId);

                if (result.Success)
                {
                    return Ok(new
                    {
                        message = result.Message,
                        data = result.ResponseBody != null ? JsonConvert.DeserializeObject(result.ResponseBody) : null
                    });
                }
                else
                {
                    return BadRequest(new
                    {
                        message = result.Message,
                        error = result.ResponseBody != null ? JsonConvert.DeserializeObject(result.ResponseBody) : null
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en SubscribeToChannelPoints");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Registra una suscripción EventSub para channel.follow
        /// </summary>
        [HttpPost("eventsub/subscribe/follow")]
        [RequirePermission("settings", "control_total")]
        public async Task<IActionResult> SubscribeToFollows([FromBody] EventSubSubscribeFollowRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.BroadcasterUserId))
                {
                    return BadRequest(new { error = "broadcaster_user_id es requerido" });
                }

                if (string.IsNullOrEmpty(request.ModeratorUserId))
                {
                    return BadRequest(new { error = "moderator_user_id es requerido" });
                }

                var conduitId = await GetActiveConduitIdAsync();
                var transportMode = conduitId != null ? EventSubTransportMode.Conduit : EventSubTransportMode.Webhook;
                var result = await _eventSubService.SubscribeToFollowsAsync(request.BroadcasterUserId, request.ModeratorUserId, transportMode, conduitId);

                if (result.Success)
                {
                    return Ok(new
                    {
                        message = result.Message,
                        data = result.ResponseBody != null ? JsonConvert.DeserializeObject(result.ResponseBody) : null
                    });
                }
                else
                {
                    return BadRequest(new
                    {
                        message = result.Message,
                        error = result.ResponseBody != null ? JsonConvert.DeserializeObject(result.ResponseBody) : null
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en SubscribeToFollows");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Lista todas las suscripciones EventSub activas
        /// </summary>
        [HttpGet("eventsub/subscriptions")]
        [RequirePermission("settings", "control_total")]
        public async Task<IActionResult> ListSubscriptions()
        {
            try
            {
                var result = await _eventSubService.ListSubscriptionsAsync();

                if (result.Success)
                {
                    return Ok(new
                    {
                        message = result.Message,
                        data = result.ResponseBody != null ? JsonConvert.DeserializeObject(result.ResponseBody) : null
                    });
                }
                else
                {
                    return BadRequest(new
                    {
                        message = result.Message,
                        error = result.ResponseBody != null ? JsonConvert.DeserializeObject(result.ResponseBody) : null
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en ListSubscriptions");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Elimina una suscripción EventSub por ID
        /// </summary>
        [HttpDelete("eventsub/subscriptions/{subscriptionId}")]
        [RequirePermission("settings", "control_total")]
        public async Task<IActionResult> DeleteSubscription(string subscriptionId)
        {
            try
            {
                if (string.IsNullOrEmpty(subscriptionId))
                {
                    return BadRequest(new { error = "subscription_id es requerido" });
                }

                var result = await _eventSubService.DeleteSubscriptionAsync(subscriptionId);

                if (result.Success)
                {
                    return Ok(new { message = result.Message });
                }
                else
                {
                    return BadRequest(new
                    {
                        message = result.Message,
                        error = result.ResponseBody != null ? JsonConvert.DeserializeObject(result.ResponseBody) : null
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en DeleteSubscription");
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }

    // Modelos de request para EventSub
    public class EventSubSubscribeRequest
    {
        public string BroadcasterUserId { get; set; }
    }

    public class EventSubSubscribeFollowRequest
    {
        public string BroadcasterUserId { get; set; }
        public string ModeratorUserId { get; set; }
    }
}
