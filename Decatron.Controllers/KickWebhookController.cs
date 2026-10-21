using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    /// <summary>
    /// Recibe los webhooks reales de Kick. Ver
    /// .dev/plans/UNIFICACION_MULTIPLATAFORMA_PLAN.md seccion 8.8.
    ///
    /// A diferencia de DecatronKick (el proyecto viejo), este endpoint SI verifica
    /// la firma — DecatronKick no lo hacia, cualquiera podia mandar un POST
    /// fingiendo ser Kick y hacerle decir lo que sea al bot.
    /// </summary>
    // La app de Kick ya tenia esta URL cargada como webhook (de antes, del
    // proyecto viejo DecatronKick) — se hace coincidir la ruta en vez de pedir
    // que cambien algo en el panel de Kick.
    [Route("api/webhooks/kick")]
    [ApiController]
    public class KickWebhookController : ControllerBase
    {
        private readonly DecatronDbContext _db;
        private readonly CommandService _commandService;
        private readonly Services.Platforms.Kick.KickConnector _kickConnector;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ISoundAlertTriggerService _soundAlertTriggerService;
        private readonly ILogger<KickWebhookController> _logger;

        // La clave publica de Kick no rota seguido — se cachea en memoria del
        // proceso en vez de pedirla en cada webhook.
        private static string? _cachedPublicKeyPem;
        private static readonly SemaphoreSlim _publicKeyLock = new(1, 1);

        private readonly Services.ChatOverlay.ChatOverlayService _chatOverlay;

        private readonly Services.Tenancy.TenantShadow _tenantShadow;
        private readonly ISpeakChatService _speakChat;
        private readonly Services.Accounts.AccountChannelResolver _accounts;
        private readonly IBotListService _botList;

        public KickWebhookController(
            DecatronDbContext db,
            CommandService commandService,
            Services.Platforms.Kick.KickConnector kickConnector,
            IHttpClientFactory httpClientFactory,
            ISoundAlertTriggerService soundAlertTriggerService,
            Services.ChatOverlay.ChatOverlayService chatOverlay,
            ILogger<KickWebhookController> logger,
            Services.Tenancy.TenantShadow tenantShadow,
            ISpeakChatService speakChat,
            Services.Accounts.AccountChannelResolver accounts,
            IBotListService botList)
        {
            _speakChat = speakChat;
            _accounts = accounts;
            _botList = botList;
            _tenantShadow = tenantShadow;
            _chatOverlay = chatOverlay;
            _db = db;
            _commandService = commandService;
            _kickConnector = kickConnector;
            _httpClientFactory = httpClientFactory;
            _soundAlertTriggerService = soundAlertTriggerService;
            _logger = logger;
        }

        [HttpPost("events")]
        public async Task<IActionResult> Webhook()
        {
            Request.EnableBuffering();
            using var reader = new StreamReader(Request.Body, Encoding.UTF8, leaveOpen: true);
            var rawBody = await reader.ReadToEndAsync();
            Request.Body.Position = 0;

            if (!await VerifySignatureAsync(rawBody))
            {
                _logger.LogWarning("[Kick Webhook] Firma invalida — posible intento de spoofing");
                return Unauthorized();
            }

            if (!Request.Headers.TryGetValue("Kick-Event-Type", out var eventType))
                return BadRequest("Missing Kick-Event-Type header");

            JsonElement payload;
            try
            {
                payload = JsonSerializer.Deserialize<JsonElement>(rawBody);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Kick Webhook] Payload invalido");
                return BadRequest();
            }

            // Plataforma Fase 2 (sombra): tenant del canal que originó el evento (cualquier tipo de evento de Kick)
            try
            {
                string? kickBroadcaster = null;
                if (payload.ValueKind == JsonValueKind.Object && payload.TryGetProperty("broadcaster", out var bc) &&
                    bc.ValueKind == JsonValueKind.Object && bc.TryGetProperty("user_id", out var bid))
                    kickBroadcaster = bid.ToString();
                _tenantShadow.Observe("Kick." + eventType.ToString(), kickBroadcaster);
            }
            catch { /* la sombra nunca rompe el webhook */ }

            if (eventType == "chat.message.sent")
            {
                var msg = _kickConnector.ParseChatMessage(payload);
                if (msg == null)
                {
                    _logger.LogWarning("[Kick Webhook] chat.message.sent sin broadcaster_id, ignorado");
                    return Ok();
                }

                // Overlay de chat (no espera: si no hay overlay conectado no hace nada)
                _ = _chatOverlay.PublishKickAsync(payload);

                // channel = kick_id numerico del broadcaster — ChannelResolver ya
                // sabe resolver esto (seccion 8.8).
                await _commandService.ProcessMessageAsync(
                    msg.Username, msg.Channel, msg.Message, msg.UserId, msg.MessageId,
                    isModerator: msg.IsModerator, isLeadModerator: false, isVip: msg.IsVip,
                    isSubscriber: msg.IsSubscriber, isBroadcaster: msg.IsBroadcaster,
                    metadata: KickMessageMetadata(msg.Message));

                await SpeakChatFromKickAsync(msg);
            }

            if (eventType == "channel.reward.redemption.updated")
            {
                await HandleRewardRedemptionAsync(payload);
            }

            return Ok();
        }

        /// <summary>
        /// Speak Chat con los mensajes de Kick. La cuenta se resuelve por el id de Kick y se lee con la configuración y
        /// los créditos de su fila principal, igual que en Twitch; el audio sale al grupo del overlay de la cuenta.
        /// Nunca rompe el webhook.
        /// </summary>
        private async Task SpeakChatFromKickAsync(IncomingChatMessage msg)
        {
            try
            {
                var resolved = await _accounts.ResolveKickIdAsync(msg.Channel);
                if (resolved == null) return;
                var account = resolved.Account;

                var botFx = await _botList.GetEffectsAsync("kick", resolved.Matched.UserId, msg.Username);
                if (botFx is { SkipSpeech: true }) return;

                await _speakChat.ProcessChatMessageAsync(
                    channelName: account.OverlayKey,
                    username: msg.Username,
                    userId: msg.UserId,
                    message: msg.Message,
                    isBroadcaster: msg.IsBroadcaster,
                    isModerator: msg.IsModerator,
                    isVip: msg.IsVip,
                    isSubscriber: msg.IsSubscriber,
                    bitsAmount: 0,
                    channelPointsRewardId: null,
                    metadata: KickMessageMetadata(msg.Message),
                    platform: "kick",
                    replyChannel: msg.Channel);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Kick Webhook] Error en Speak Chat");
            }
        }

        // Kick escribe los emotes dentro del texto como [emote:37226:KEKW]
        private static readonly System.Text.RegularExpressions.Regex KickEmote =
            new(@"\[emote:\d+:[^\]]*\]", System.Text.RegularExpressions.RegexOptions.Compiled);

        /// <summary>
        /// Plataforma y emotes para la moderación: cuántos hay y el texto sin ellos, así un
        /// "KEKW KEKW" no cuenta como gritar en mayúsculas (igual que en Twitch).
        /// </summary>
        private static Dictionary<string, object> KickMessageMetadata(string text)
        {
            var metadata = new Dictionary<string, object> { ["platform"] = "kick" };
            var emotes = KickEmote.Matches(text).Count;
            if (emotes > 0)
            {
                metadata["emote-count"] = emotes;
                metadata["text-without-emotes"] = KickEmote.Replace(text, "");
            }
            return metadata;
        }

        /// <summary>
        /// Kick no manda un evento "fulfilled" aparte (confirmado probando
        /// contra una cuenta real, 7 ago 2026) — se dispara la alerta con este
        /// mismo evento, igual que Twitch dispara con "...redemption.add" sin
        /// esperar ningun cambio de estado. Ver plan seccion 8, item 3.
        /// </summary>
        private async Task HandleRewardRedemptionAsync(JsonElement payload)
        {
            try
            {
                if (!payload.TryGetProperty("broadcaster", out var broadcaster) ||
                    !broadcaster.TryGetProperty("user_id", out var broadcasterIdProp))
                {
                    _logger.LogWarning("[Kick Webhook] channel.reward.redemption.updated sin broadcaster, ignorado");
                    return;
                }

                var broadcasterId = broadcasterIdProp.ToString();
                var user = await _db.Users.FirstOrDefaultAsync(u => u.KickId == broadcasterId);
                if (user == null)
                {
                    _logger.LogWarning("[Kick Webhook] Canje para broadcaster {BroadcasterId} sin canal registrado", broadcasterId);
                    return;
                }

                var reward = payload.GetProperty("reward");
                var redeemer = payload.GetProperty("redeemer");

                var redeemedAt = payload.TryGetProperty("redeemed_at", out var redeemedAtProp)
                    && DateTimeOffset.TryParse(redeemedAtProp.GetString(), out var parsedDate)
                        ? parsedDate
                        : DateTimeOffset.UtcNow;

                await _soundAlertTriggerService.TriggerAsync(new SoundAlertRedemption(
                    ChannelUserId: user.Id,
                    OverlayGroupKey: user.KickId!,
                    RewardId: reward.GetProperty("id").GetString() ?? "",
                    RewardTitle: reward.GetProperty("title").GetString() ?? "",
                    RedeemerUsername: redeemer.GetProperty("username").GetString() ?? "",
                    RedeemerId: redeemer.TryGetProperty("user_id", out var redeemerIdProp) ? redeemerIdProp.ToString() : null,
                    RedeemedAt: redeemedAt));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Kick Webhook] Error procesando channel.reward.redemption.updated");
            }
        }

        private async Task<bool> VerifySignatureAsync(string rawBody)
        {
            if (!Request.Headers.TryGetValue("Kick-Event-Message-Id", out var messageId) ||
                !Request.Headers.TryGetValue("Kick-Event-Message-Timestamp", out var timestamp) ||
                !Request.Headers.TryGetValue("Kick-Event-Signature", out var signatureHeader))
            {
                return false;
            }

            byte[] signatureBytes;
            try
            {
                signatureBytes = Convert.FromBase64String(signatureHeader!);
            }
            catch
            {
                return false;
            }

            var signedString = $"{messageId}.{timestamp}.{rawBody}";
            var publicKeyPem = await GetPublicKeyAsync();

            using var rsa = RSA.Create();
            rsa.ImportFromPem(publicKeyPem);

            return rsa.VerifyData(
                Encoding.UTF8.GetBytes(signedString),
                signatureBytes,
                HashAlgorithmName.SHA256,
                RSASignaturePadding.Pkcs1);
        }

        private async Task<string> GetPublicKeyAsync()
        {
            if (_cachedPublicKeyPem != null)
                return _cachedPublicKeyPem;

            await _publicKeyLock.WaitAsync();
            try
            {
                if (_cachedPublicKeyPem != null)
                    return _cachedPublicKeyPem;

                var client = _httpClientFactory.CreateClient();
                var response = await client.GetStringAsync("https://api.kick.com/public/v1/public-key");
                using var doc = JsonDocument.Parse(response);
                _cachedPublicKeyPem = doc.RootElement.GetProperty("data").GetProperty("public_key").GetString();
                return _cachedPublicKeyPem!;
            }
            finally
            {
                _publicKeyLock.Release();
            }
        }
    }
}
