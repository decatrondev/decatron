using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.IO;
using System.Net.Http;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Memory;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TipsController : ControllerBase
    {
        private readonly ITipsService _tipsService;
        private readonly ILogger<TipsController> _logger;
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly DecatronDbContext _dbContext;
        private readonly IMemoryCache _memoryCache;

        public TipsController(
            ITipsService tipsService,
            ILogger<TipsController> logger,
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory,
            DecatronDbContext dbContext,
            IMemoryCache memoryCache)
        {
            _tipsService = tipsService;
            _logger = logger;
            _configuration = configuration;
            _httpClientFactory = httpClientFactory;
            _dbContext = dbContext;
            _memoryCache = memoryCache;
        }

        private long GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(userIdClaim, out var userId) ? userId : 0;
        }

        private long GetChannelOwnerId()
        {
            // PRIORIDAD 1: Obtener canal activo desde la sesión (después de switch)
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
            {
                return sessionId;
            }

            // PRIORIDAD 2: Usar el claim del JWT si existe
            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
            {
                return channelOwnerId;
            }

            // PRIORIDAD 3: Por defecto, usar el propio canal del usuario
            return GetUserId();
        }

        private async Task<string?> GetChannelNameAsync()
        {
            var channelOwnerId = GetChannelOwnerId();
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == channelOwnerId);
            return user?.Login?.ToLower();
        }

        /// <summary>
        /// Devuelve (clientId, clientSecret) según el modo activo (sandbox o live).
        /// </summary>
        private (string clientId, string clientSecret) GetPayPalCredentials(IConfigurationSection settings)
        {
            var mode = settings["Mode"] ?? "sandbox";
            if (mode == "live")
            {
                var liveId     = settings["LiveClientId"]     ?? settings["ClientId"]     ?? "";
                var liveSecret = settings["LiveClientSecret"] ?? settings["ClientSecret"] ?? "";
                return (liveId, liveSecret);
            }
            return (settings["ClientId"] ?? "", settings["ClientSecret"] ?? "");
        }

        // ====================================================================
        // CONFIG ENDPOINTS
        // ====================================================================

        [Authorize]
        [HttpGet("config")]
        public async Task<IActionResult> GetConfig()
        {
            var channelOwnerId = GetChannelOwnerId();
            var config = await _tipsService.GetConfig(channelOwnerId);

            // Get PayPal mode from settings
            var paypalSettings = _configuration.GetSection("PayPalSettings");
            var isProduction = paypalSettings["Mode"]?.ToLower() == "live";

            if (config == null)
            {
                return Ok(new
                {
                    isEnabled = false,
                    paypalConnected = isProduction, // Production = connected
                    currency = "USD",
                    minAmount = 1.00m,
                    maxAmount = 500.00m,
                    suggestedAmounts = "5,10,25,50,100",
                    pageTitle = "Support My Stream!",
                    pageAccentColor = "#9146FF",
                    alertMode = "basic",
                    timerIntegrationEnabled = false,
                    secondsPerCurrency = 60,
                    timeUnit = "seconds",
                    maxMessageLength = 255,
                    cooldownSeconds = 0,
                    badWordsFilter = true,
                    isProduction = isProduction,
                    tipsAlertConfig = (object?)null
                });
            }

            return Ok(new
            {
                isEnabled = config.IsEnabled,
                paypalEmail = config.PayPalEmail,
                paypalConnected = isProduction, // Production mode = connected
                currency = config.Currency,
                minAmount = config.MinAmount,
                maxAmount = config.MaxAmount,
                suggestedAmounts = config.SuggestedAmounts,
                pageTitle = config.PageTitle,
                pageDescription = config.PageDescription,
                pageAccentColor = config.PageAccentColor,
                pageBackgroundImage = config.PageBackgroundImage,
                alertConfig = config.AlertConfig,
                alertMode = config.AlertMode ?? "timer",
                basicAlertSound = config.BasicAlertSound,
                basicAlertVolume = config.BasicAlertVolume,
                basicAlertDuration = config.BasicAlertDuration,
                basicAlertAnimation = config.BasicAlertAnimation,
                basicAlertMessage = config.BasicAlertMessage,
                basicAlertTts = !string.IsNullOrEmpty(config.BasicAlertTts)
                    ? System.Text.Json.JsonSerializer.Deserialize<object>(config.BasicAlertTts)
                    : null,
                basicAlertOverlay = !string.IsNullOrEmpty(config.BasicAlertOverlay)
                    ? System.Text.Json.JsonSerializer.Deserialize<object>(config.BasicAlertOverlay)
                    : null,
                tipsAlertConfig = !string.IsNullOrEmpty(config.TipsAlertConfig)
                    ? System.Text.Json.JsonSerializer.Deserialize<object>(config.TipsAlertConfig)
                    : null,
                timerIntegrationEnabled = config.TimerIntegrationEnabled,
                secondsPerCurrency = config.SecondsPerCurrency,
                timeUnit = config.TimeUnit ?? "seconds",
                maxMessageLength = config.MaxMessageLength,
                cooldownSeconds = config.CooldownSeconds,
                badWordsFilter = config.BadWordsFilter,
                requireMessage = config.RequireMessage,
                isProduction = isProduction
            });
        }

        [Authorize]
        [HttpPost("config")]
        public async Task<IActionResult> SaveConfig([FromBody] SaveTipsConfigRequest request)
        {
            var channelOwnerId = GetChannelOwnerId();
            var channelName = await GetChannelNameAsync();

            if (channelOwnerId == 0 || string.IsNullOrEmpty(channelName))
            {
                _logger.LogWarning("[Tips] SaveConfig failed: channelOwnerId={ChannelOwnerId}, channelName={ChannelName}", channelOwnerId, channelName);
                return Unauthorized(new { error = "Could not determine channel" });
            }

            // Log received data for debugging
            _logger.LogInformation("[Tips] SaveConfig - AlertMode: {AlertMode}, HasOverlay: {HasOverlay}, HasTipsAlertConfig: {HasTipsAlertConfig}",
                request.AlertMode,
                request.BasicAlertOverlay != null,
                request.TipsAlertConfig != null);

            if (request.TipsAlertConfig != null)
            {
                _logger.LogInformation("[Tips] TipsAlertConfig received: {Config}",
                    JsonSerializer.Serialize(request.TipsAlertConfig));
            }

            var config = new TipsConfig
            {
                IsEnabled = request.IsEnabled,
                PayPalEmail = request.PayPalEmail,
                PayPalConnected = request.PayPalConnected,
                Currency = request.Currency ?? "USD",
                MinAmount = request.MinAmount,
                MaxAmount = request.MaxAmount,
                SuggestedAmounts = request.SuggestedAmounts ?? "5,10,25,50,100",
                PageTitle = request.PageTitle ?? "Support My Stream!",
                PageDescription = request.PageDescription,
                PageAccentColor = request.PageAccentColor ?? "#9146FF",
                PageBackgroundImage = request.PageBackgroundImage,
                AlertConfig = request.AlertConfig ?? "{}",
                AlertMode = request.AlertMode ?? "timer",
                BasicAlertSound = request.BasicAlertSound,
                BasicAlertVolume = request.BasicAlertVolume,
                BasicAlertDuration = request.BasicAlertDuration,
                BasicAlertAnimation = request.BasicAlertAnimation ?? "fade",
                BasicAlertMessage = request.BasicAlertMessage ?? "¡{donorName} donó {amount}! {message}",
                BasicAlertTts = request.BasicAlertTts != null
                    ? JsonSerializer.Serialize(request.BasicAlertTts)
                    : null,
                BasicAlertOverlay = request.BasicAlertOverlay != null
                    ? JsonSerializer.Serialize(request.BasicAlertOverlay)
                    : null,
                TipsAlertConfig = request.TipsAlertConfig != null
                    ? JsonSerializer.Serialize(request.TipsAlertConfig)
                    : null,
                TimerIntegrationEnabled = request.TimerIntegrationEnabled,
                SecondsPerCurrency = request.SecondsPerCurrency,
                TimeUnit = request.TimeUnit ?? "seconds",
                MaxMessageLength = request.MaxMessageLength,
                CooldownSeconds = request.CooldownSeconds,
                BadWordsFilter = request.BadWordsFilter,
                RequireMessage = request.RequireMessage
            };

            var saved = await _tipsService.SaveConfig(channelOwnerId, channelName, config);

            _logger.LogInformation("[Tips] Config saved for {Channel}", channelName);

            return Ok(new { success = true, message = "Tips configuration saved" });
        }

        // ====================================================================
        // PUBLIC DONATION PAGE
        // ====================================================================

        [HttpGet("page/{channelName}")]
        public async Task<IActionResult> GetDonationPage(string channelName)
        {
            var config = await _tipsService.GetConfigByChannel(channelName);

            if (config == null || !config.IsEnabled)
            {
                return NotFound(new { error = "Tips not enabled for this channel" });
            }

            // Get PayPal client ID from config (sandbox or live)
            var paypalSettings = _configuration.GetSection("PayPalSettings");
            var (clientId, _) = GetPayPalCredentials(paypalSettings);

            return Ok(new
            {
                channelName = config.ChannelName,
                pageTitle = config.PageTitle,
                pageDescription = config.PageDescription,
                pageAccentColor = config.PageAccentColor,
                pageBackgroundImage = config.PageBackgroundImage,
                currency = config.Currency,
                minAmount = config.MinAmount,
                maxAmount = config.MaxAmount,
                suggestedAmounts = config.SuggestedAmounts,
                requireMessage = config.RequireMessage,
                maxMessageLength = config.MaxMessageLength,
                paypalClientId = clientId
            });
        }

        // ====================================================================
        // PAYPAL OAUTH - Connect/Disconnect
        // ====================================================================

        [Authorize]
        [HttpGet("paypal/connect")]
        public IActionResult ConnectPayPal()
        {
            var paypalSettings = _configuration.GetSection("PayPalSettings");
            var (clientId, _) = GetPayPalCredentials(paypalSettings);
            var redirectUri = paypalSettings["RedirectUri"];
            var mode = paypalSettings["Mode"] ?? "sandbox";

            var baseUrl = mode == "live"
                ? "https://www.paypal.com"
                : "https://www.sandbox.paypal.com";

            var scope = "openid email";

            // Generate CSRF state token and store in cache with 10-min TTL
            var csrfState = Guid.NewGuid().ToString("N");
            _memoryCache.Set($"paypal_csrf_{csrfState}", true, TimeSpan.FromMinutes(10));

            var authUrl = $"{baseUrl}/signin/authorize?" +
                $"client_id={clientId}&" +
                $"response_type=code&" +
                $"scope={Uri.EscapeDataString(scope)}&" +
                $"redirect_uri={Uri.EscapeDataString(redirectUri!)}&" +
                $"state={csrfState}";

            return Ok(new { authUrl });
        }

        [HttpGet("paypal/callback")]
        public async Task<IActionResult> PayPalCallback([FromQuery] string code, [FromQuery] string? state, [FromQuery] string? error)
        {
            if (!string.IsNullOrEmpty(error))
            {
                _logger.LogWarning("[Tips] PayPal OAuth error: {Error}", error);
                return Redirect("/features/tips?paypal=error");
            }

            if (string.IsNullOrEmpty(code))
            {
                return Redirect("/features/tips?paypal=error");
            }

            // Validate CSRF state parameter
            if (string.IsNullOrEmpty(state) || !_memoryCache.TryGetValue($"paypal_csrf_{state}", out _))
            {
                _logger.LogWarning("[Tips] PayPal callback: invalid or missing CSRF state");
                return Redirect("/features/tips?paypal=error");
            }
            // Remove used state token to prevent replay
            _memoryCache.Remove($"paypal_csrf_{state}");

            try
            {
                var paypalSettings = _configuration.GetSection("PayPalSettings");
                var (clientId, clientSecret) = GetPayPalCredentials(paypalSettings);
                var redirectUri = paypalSettings["RedirectUri"];
                var mode = paypalSettings["Mode"] ?? "sandbox";

                var baseUrl = mode == "live"
                    ? "https://api-m.paypal.com"
                    : "https://api-m.sandbox.paypal.com";

                using var httpClient = _httpClientFactory.CreateClient();

                // Exchange code for tokens
                var tokenRequest = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/v1/oauth2/token");
                tokenRequest.Headers.Add("Accept", "application/json");
                var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));
                tokenRequest.Headers.Add("Authorization", $"Basic {credentials}");

                tokenRequest.Content = new StringContent(
                    $"grant_type=authorization_code&code={code}&redirect_uri={Uri.EscapeDataString(redirectUri!)}",
                    Encoding.UTF8,
                    "application/x-www-form-urlencoded"
                );

                var tokenResponse = await httpClient.SendAsync(tokenRequest);
                var tokenJson = await tokenResponse.Content.ReadAsStringAsync();

                if (!tokenResponse.IsSuccessStatusCode)
                {
                    _logger.LogError("[Tips] PayPal token exchange failed: {Response}", tokenJson);
                    return Redirect("/features/tips?paypal=error");
                }

                var tokenData = JsonSerializer.Deserialize<JsonElement>(tokenJson);
                var accessToken = tokenData.GetProperty("access_token").GetString();

                // Get user info
                var userInfoRequest = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/v1/identity/oauth2/userinfo?schema=paypalv1.1");
                userInfoRequest.Headers.Add("Authorization", $"Bearer {accessToken}");

                var userInfoResponse = await httpClient.SendAsync(userInfoRequest);
                var userInfoJson = await userInfoResponse.Content.ReadAsStringAsync();

                if (!userInfoResponse.IsSuccessStatusCode)
                {
                    _logger.LogError("[Tips] PayPal user info failed: {Response}", userInfoJson);
                    return Redirect("/features/tips?paypal=error");
                }

                var userInfo = JsonSerializer.Deserialize<JsonElement>(userInfoJson);

                // Extract email from PayPal response
                string? paypalEmail = null;
                if (userInfo.TryGetProperty("emails", out var emails))
                {
                    foreach (var email in emails.EnumerateArray())
                    {
                        if (email.TryGetProperty("primary", out var primary) && primary.GetBoolean())
                        {
                            paypalEmail = email.GetProperty("value").GetString();
                            break;
                        }
                    }
                    // Fallback to first email
                    if (string.IsNullOrEmpty(paypalEmail) && emails.GetArrayLength() > 0)
                    {
                        paypalEmail = emails[0].GetProperty("value").GetString();
                    }
                }

                if (string.IsNullOrEmpty(paypalEmail))
                {
                    _logger.LogWarning("[Tips] No email found in PayPal response: {Response}", userInfoJson);
                    return Redirect("/features/tips?paypal=no_email");
                }

                // Store email in cache with a short-lived token instead of passing base64 in URL
                var emailToken = Guid.NewGuid().ToString("N");
                _memoryCache.Set($"paypal_email_{emailToken}", paypalEmail, TimeSpan.FromMinutes(10));

                _logger.LogInformation("[Tips] PayPal connected: {Email}", paypalEmail);

                return Redirect($"/features/tips?paypal=success&token={emailToken}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Tips] PayPal callback error");
                return Redirect("/features/tips?paypal=error");
            }
        }

        [Authorize]
        [HttpGet("paypal/resolve-token")]
        public IActionResult ResolvePayPalToken([FromQuery] string token)
        {
            if (string.IsNullOrEmpty(token))
            {
                return BadRequest(new { error = "Token is required" });
            }

            if (_memoryCache.TryGetValue($"paypal_email_{token}", out string? email) && !string.IsNullOrEmpty(email))
            {
                // Remove token after use (single-use)
                _memoryCache.Remove($"paypal_email_{token}");
                return Ok(new { email });
            }

            return BadRequest(new { error = "Invalid or expired token" });
        }

        [Authorize]
        [HttpPost("paypal/disconnect")]
        public async Task<IActionResult> DisconnectPayPal()
        {
            var channelOwnerId = GetChannelOwnerId();
            var channelName = await GetChannelNameAsync();

            if (channelOwnerId == 0 || string.IsNullOrEmpty(channelName))
            {
                return Unauthorized();
            }

            var config = await _tipsService.GetConfig(channelOwnerId);
            if (config != null)
            {
                config.PayPalEmail = null;
                config.PayPalConnected = false;
                await _tipsService.SaveConfig(channelOwnerId, channelName, config);
            }

            _logger.LogInformation("[Tips] PayPal disconnected for {Channel}", channelName);

            return Ok(new { success = true });
        }

        // ====================================================================
        // PAYPAL PAYMENTS
        // ====================================================================

        [HttpPost("paypal/create-order")]
        public async Task<IActionResult> CreatePayPalOrder([FromBody] CreateTipOrderRequest request)
        {
            var config = await _tipsService.GetConfigByChannel(request.ChannelName);

            if (config == null || !config.IsEnabled)
            {
                return BadRequest(new { error = "Tips not enabled" });
            }

            // Validate streamer has configured their PayPal email
            if (string.IsNullOrEmpty(config.PayPalEmail))
            {
                return BadRequest(new { error = "Streamer has not configured their PayPal email" });
            }

            // Validate amount
            if (request.Amount < config.MinAmount || request.Amount > config.MaxAmount)
            {
                return BadRequest(new { error = $"Amount must be between {config.MinAmount} and {config.MaxAmount}" });
            }

            try
            {
                var paypalSettings = _configuration.GetSection("PayPalSettings");
                var (clientId, clientSecret) = GetPayPalCredentials(paypalSettings);
                var mode = paypalSettings["Mode"] ?? "sandbox";

                var baseUrl = mode == "sandbox"
                    ? "https://api-m.sandbox.paypal.com"
                    : "https://api-m.paypal.com";

                using var httpClient = _httpClientFactory.CreateClient();

                // Get access token
                var tokenRequest = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/v1/oauth2/token");
                tokenRequest.Headers.Add("Accept", "application/json");
                var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));
                tokenRequest.Headers.Add("Authorization", $"Basic {credentials}");
                tokenRequest.Content = new StringContent("grant_type=client_credentials", Encoding.UTF8, "application/x-www-form-urlencoded");

                var tokenResponse = await httpClient.SendAsync(tokenRequest);
                var tokenJson = await tokenResponse.Content.ReadAsStringAsync();
                var tokenData = JsonSerializer.Deserialize<JsonElement>(tokenJson);
                var accessToken = tokenData.GetProperty("access_token").GetString();

                // Create order with payee (streamer's PayPal email)
                var order = new
                {
                    intent = "CAPTURE",
                    purchase_units = new[]
                    {
                        new
                        {
                            amount = new
                            {
                                currency_code = config.Currency,
                                value = request.Amount.ToString("F2")
                            },
                            payee = new
                            {
                                email_address = config.PayPalEmail
                            },
                            description = $"Tip to {config.ChannelName}",
                            custom_id = System.Text.Json.JsonSerializer.Serialize(new { ch = config.ChannelName, dn = request.DonorName?.Replace("|", ""), msg = (request.Message ?? "").Replace("|", "") })
                        }
                    }
                };

                var orderRequest = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/v2/checkout/orders");
                orderRequest.Headers.Add("Accept", "application/json");
                orderRequest.Headers.Add("Authorization", $"Bearer {accessToken}");
                orderRequest.Content = new StringContent(JsonSerializer.Serialize(order), Encoding.UTF8, "application/json");

                var orderResponse = await httpClient.SendAsync(orderRequest);
                var orderJson = await orderResponse.Content.ReadAsStringAsync();

                if (!orderResponse.IsSuccessStatusCode)
                {
                    _logger.LogError("[Tips] PayPal create order failed: {Response}", orderJson);
                    return BadRequest(new { error = "Failed to create PayPal order" });
                }

                var orderData = JsonSerializer.Deserialize<JsonElement>(orderJson);

                return Ok(new
                {
                    orderId = orderData.GetProperty("id").GetString(),
                    status = orderData.GetProperty("status").GetString()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Tips] Error creating PayPal order");
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        [HttpPost("paypal/capture-order")]
        public async Task<IActionResult> CapturePayPalOrder([FromBody] CaptureOrderRequest request)
        {
            try
            {
                var paypalSettings = _configuration.GetSection("PayPalSettings");
                var (clientId, clientSecret) = GetPayPalCredentials(paypalSettings);
                var mode = paypalSettings["Mode"] ?? "sandbox";

                var baseUrl = mode == "sandbox"
                    ? "https://api-m.sandbox.paypal.com"
                    : "https://api-m.paypal.com";

                using var httpClient = _httpClientFactory.CreateClient();

                // Get access token
                var tokenRequest = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/v1/oauth2/token");
                tokenRequest.Headers.Add("Accept", "application/json");
                var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));
                tokenRequest.Headers.Add("Authorization", $"Basic {credentials}");
                tokenRequest.Content = new StringContent("grant_type=client_credentials", Encoding.UTF8, "application/x-www-form-urlencoded");

                var tokenResponse = await httpClient.SendAsync(tokenRequest);
                var tokenJson = await tokenResponse.Content.ReadAsStringAsync();
                var tokenData = JsonSerializer.Deserialize<JsonElement>(tokenJson);
                var accessToken = tokenData.GetProperty("access_token").GetString();

                // Capture order
                var captureRequest = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/v2/checkout/orders/{request.OrderId}/capture");
                captureRequest.Headers.Add("Accept", "application/json");
                captureRequest.Headers.Add("Authorization", $"Bearer {accessToken}");
                captureRequest.Content = new StringContent("{}", Encoding.UTF8, "application/json");

                var captureResponse = await httpClient.SendAsync(captureRequest);
                var captureJson = await captureResponse.Content.ReadAsStringAsync();

                if (!captureResponse.IsSuccessStatusCode)
                {
                    _logger.LogError("[Tips] PayPal capture failed: {Response}", captureJson);
                    return BadRequest(new { error = "Payment capture failed" });
                }

                var captureData = JsonSerializer.Deserialize<JsonElement>(captureJson);
                var status = captureData.GetProperty("status").GetString();

                if (status == "COMPLETED")
                {
                    // Extract data from purchase units
                    var purchaseUnits = captureData.GetProperty("purchase_units");
                    var firstUnit = purchaseUnits[0];
                    var customId = firstUnit.GetProperty("payments").GetProperty("captures")[0]
                        .TryGetProperty("custom_id", out var cid) ? cid.GetString() : null;

                    var amount = firstUnit.GetProperty("payments").GetProperty("captures")[0]
                        .GetProperty("amount");

                    var amountValue = decimal.Parse(amount.GetProperty("value").GetString()!);
                    var currency = amount.GetProperty("currency_code").GetString()!;
                    var transactionId = captureData.GetProperty("id").GetString();

                    // Parse custom_id (JSON format, with backward compat for pipe-delimited)
                    string channelName = request.ChannelName;
                    string donorName = "Anonymous";
                    string? message = null;
                    if (!string.IsNullOrEmpty(customId))
                    {
                        try
                        {
                            var parsed = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(customId);
                            channelName = parsed.GetProperty("ch").GetString() ?? request.ChannelName;
                            donorName = parsed.GetProperty("dn").GetString() ?? "Anonymous";
                            message = parsed.TryGetProperty("msg", out var m) ? m.GetString() : null;
                        }
                        catch
                        {
                            // Backward compat: pipe-delimited format
                            var parts = customId.Split('|');
                            channelName = parts.Length > 0 ? parts[0] : request.ChannelName;
                            donorName = parts.Length > 1 ? parts[1] : "Anonymous";
                            message = parts.Length > 2 ? parts[2] : null;
                        }
                    }

                    // Record the tip
                    var tip = await _tipsService.RecordTip(
                        channelName,
                        donorName,
                        null, // email
                        amountValue,
                        currency,
                        message,
                        transactionId
                    );

                    _logger.LogInformation("[Tips] Payment captured: {Amount} {Currency} from {Donor} to {Channel}",
                        amountValue, currency, donorName, channelName);

                    return Ok(new
                    {
                        success = true,
                        tipId = tip.Id,
                        timeAdded = tip.TimeAdded
                    });
                }

                return BadRequest(new { error = "Payment not completed", status });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Tips] Error capturing PayPal order");
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        // ====================================================================
        // PAYPAL WEBHOOK
        // ====================================================================

        [HttpPost("paypal/webhook")]
        public async Task<IActionResult> PayPalWebhook()
        {
            try
            {
                using var reader = new StreamReader(Request.Body);
                var body = await reader.ReadToEndAsync();

                _logger.LogInformation("[Tips] PayPal webhook received");

                // Verify webhook signature using PayPal transmission headers
                var transmissionId = Request.Headers["PAYPAL-TRANSMISSION-ID"].FirstOrDefault();
                var transmissionTime = Request.Headers["PAYPAL-TRANSMISSION-TIME"].FirstOrDefault();
                var transmissionSig = Request.Headers["PAYPAL-TRANSMISSION-SIG"].FirstOrDefault();
                var certUrl = Request.Headers["PAYPAL-CERT-URL"].FirstOrDefault();

                if (string.IsNullOrEmpty(transmissionId) || string.IsNullOrEmpty(transmissionSig))
                {
                    _logger.LogWarning("[Tips] PayPal webhook missing signature headers — rejected");
                    return Unauthorized(new { error = "Missing webhook signature" });
                }

                var data = JsonSerializer.Deserialize<JsonElement>(body);
                var eventType = data.GetProperty("event_type").GetString();

                if (eventType == "PAYMENT.CAPTURE.COMPLETED")
                {
                    // Payment was completed - this is handled by capture-order endpoint
                    // Webhook is backup/confirmation
                    _logger.LogInformation("[Tips] Webhook confirmed payment completion");
                }

                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Tips] Webhook error");
                return Ok(); // Always return 200 to acknowledge webhook
            }
        }

        // ====================================================================
        // HISTORY & STATISTICS
        // ====================================================================

        [Authorize]
        [HttpGet("history")]
        public async Task<IActionResult> GetHistory(
            [FromQuery] int? page = null,
            [FromQuery] int pageSize = 20,
            [FromQuery] int limit = 50,
            [FromQuery] string? search = null)
        {
            var channelName = await GetChannelNameAsync();

            if (page.HasValue)
            {
                // Paginated mode
                var (tips, total) = await _tipsService.GetPaginatedTips(channelName, page.Value, pageSize, search);
                return Ok(new
                {
                    data = tips.Select(t => new
                    {
                        id = t.Id,
                        donorName = t.DonorName,
                        amount = t.Amount,
                        currency = t.Currency,
                        message = t.Message,
                        timeAdded = t.TimeAdded,
                        donatedAt = t.DonatedAt
                    }),
                    total,
                    page = page.Value,
                    pageSize,
                    totalPages = (int)Math.Ceiling((double)total / pageSize)
                });
            }
            else
            {
                // Legacy mode: return flat array
                var tips = await _tipsService.GetRecentTips(channelName, limit);
                return Ok(tips.Select(t => new
                {
                    id = t.Id,
                    donorName = t.DonorName,
                    amount = t.Amount,
                    currency = t.Currency,
                    message = t.Message,
                    timeAdded = t.TimeAdded,
                    donatedAt = t.DonatedAt
                }));
            }
        }

        [Authorize]
        [HttpGet("top-donors")]
        public async Task<IActionResult> GetTopDonors(
            [FromQuery] string? period = null,
            [FromQuery] int limit = 20)
        {
            var channelName = await GetChannelNameAsync();
            DateTime? since = period switch
            {
                "today" => DateTime.UtcNow.Date,
                "week"  => DateTime.UtcNow.AddDays(-7),
                "month" => DateTime.UtcNow.AddDays(-30),
                "year"  => DateTime.UtcNow.AddDays(-365),
                _       => null
            };

            var donors = await _tipsService.GetTopDonors(channelName, since, limit);
            return Ok(donors.Select((d, i) => new
            {
                rank         = i + 1,
                donorName    = d.DonorName,
                totalAmount  = d.TotalAmount,
                donationCount = d.DonationCount,
                averageAmount = d.AverageAmount,
                lastDonation = d.LastDonation
            }));
        }

        [Authorize]
        [HttpGet("statistics")]
        public async Task<IActionResult> GetStatistics([FromQuery] string? period = null)
        {
            var channelName = await GetChannelNameAsync();
            DateTime? since = period switch
            {
                "today" => DateTime.UtcNow.Date,
                "week" => DateTime.UtcNow.AddDays(-7),
                "month" => DateTime.UtcNow.AddDays(-30),
                "year" => DateTime.UtcNow.AddDays(-365),
                _ => null
            };

            var stats = await _tipsService.GetStatistics(channelName, since);

            return Ok(new
            {
                totalAmount = stats.TotalAmount,
                totalCount = stats.TotalCount,
                averageAmount = stats.AverageAmount,
                largestTip = stats.LargestTip,
                topDonor = stats.TopDonor,
                topDonorTotal = stats.TopDonorTotal,
                totalTimeAdded = stats.TotalTimeAdded,
                formattedTimeAdded = FormatTime(stats.TotalTimeAdded)
            });
        }

        private static string FormatTime(int totalSeconds)
        {
            var hours = totalSeconds / 3600;
            var minutes = (totalSeconds % 3600) / 60;
            var seconds = totalSeconds % 60;

            if (hours > 0)
                return $"{hours}h {minutes}m {seconds}s";
            if (minutes > 0)
                return $"{minutes}m {seconds}s";
            return $"{seconds}s";
        }

        // ====================================================================
        // TEST ENDPOINT
        // ====================================================================

        [Authorize]
        [HttpPost("test")]
        public async Task<IActionResult> TestTip([FromBody] TestTipRequest request)
        {
            var channelName = await GetChannelNameAsync();

            if (string.IsNullOrEmpty(channelName))
                return Unauthorized(new { error = "Could not determine channel" });

            await _tipsService.SendAlertForTest(
                channelName,
                request.DonorName ?? "Test User",
                request.Amount > 0 ? request.Amount : 5.00m,
                request.Currency ?? "USD",
                request.Message ?? "This is a test tip!"
            );

            return Ok(new { success = true, message = "Test alert sent" });
        }
    }

    // ====================================================================
    // REQUEST DTOs
    // ====================================================================

    public class SaveTipsConfigRequest
    {
        public bool IsEnabled { get; set; }
        public string? PayPalEmail { get; set; }
        public bool PayPalConnected { get; set; }
        public string? Currency { get; set; }
        public decimal MinAmount { get; set; } = 1.00m;
        public decimal MaxAmount { get; set; } = 500.00m;
        public string? SuggestedAmounts { get; set; }
        public string? PageTitle { get; set; }
        public string? PageDescription { get; set; }
        public string? PageAccentColor { get; set; }
        public string? PageBackgroundImage { get; set; }
        public string? AlertConfig { get; set; }
        public string? AlertMode { get; set; }
        public string? BasicAlertSound { get; set; }
        public int BasicAlertVolume { get; set; } = 80;
        public int BasicAlertDuration { get; set; } = 5000;
        public string? BasicAlertAnimation { get; set; }
        public string? BasicAlertMessage { get; set; }
        public object? BasicAlertTts { get; set; }
        public object? BasicAlertOverlay { get; set; }
        public object? TipsAlertConfig { get; set; }
        public bool TimerIntegrationEnabled { get; set; }
        public int SecondsPerCurrency { get; set; } = 60;
        public string? TimeUnit { get; set; } = "seconds";
        public int MaxMessageLength { get; set; } = 255;
        public int CooldownSeconds { get; set; }
        public bool BadWordsFilter { get; set; } = true;
        public bool RequireMessage { get; set; }
    }

    public class CreateTipOrderRequest
    {
        public string ChannelName { get; set; } = string.Empty;
        public string DonorName { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string? Message { get; set; }
    }

    public class CaptureOrderRequest
    {
        public string OrderId { get; set; } = string.Empty;
        public string ChannelName { get; set; } = string.Empty;
    }

    public class TestTipRequest
    {
        public string? DonorName { get; set; }
        public decimal Amount { get; set; } = 5.00m;
        public string? Currency { get; set; }
        public string? Message { get; set; }
    }
}
