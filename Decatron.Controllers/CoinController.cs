using System.Globalization;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Decatron.Core.Models.Economy;
using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/coins")]
    [Authorize]
    public class CoinController : ControllerBase
    {
        private readonly CoinService _coinService;
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<CoinController> _logger;
        private readonly DecatronDbContext _db;

        public CoinController(
            CoinService coinService,
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory,
            ILogger<CoinController> logger,
            DecatronDbContext db)
        {
            _coinService       = coinService;
            _configuration     = configuration;
            _httpClientFactory = httpClientFactory;
            _logger            = logger;
            _db                = db;
        }

        // ─── GET /api/coins/packages ─────────────────────────────────────────────

        [HttpGet("packages")]
        public async Task<IActionResult> GetPackages()
        {
            var userId = GetUserId();
            var packages = await _coinService.GetAvailablePackagesAsync(userId);
            return Ok(packages);
        }

        // ─── GET /api/coins/balance ──────────────────────────────────────────────

        [HttpGet("balance")]
        public async Task<IActionResult> GetBalance()
        {
            var userId   = GetUserId();
            var balance  = await _coinService.GetBalanceAsync(userId);
            var settings = await _coinService.GetSettingsAsync();

            return Ok(new
            {
                balance,
                currencyName = settings.CurrencyName,
                currencyIcon = settings.CurrencyIcon,
            });
        }

        // ─── GET /api/coins/history ──────────────────────────────────────────────

        [HttpGet("history")]
        public async Task<IActionResult> GetHistory([FromQuery] int page = 1)
        {
            var userId = GetUserId();
            var history = await _coinService.GetHistoryAsync(userId, page);
            return Ok(history);
        }

        // ─── POST /api/coins/buy ─────────────────────────────────────────────────

        [HttpPost("buy")]
        public async Task<IActionResult> Buy([FromBody] CoinBuyRequest req)
        {
            var userId = GetUserId();

            // 1. Idempotency — check for existing pending order
            // Expire old pending orders (> 30 min)
            var oldPending = await _db.CoinPendingOrders
                .Where(o => o.UserId == userId && o.Status == "pending" && o.CreatedAt < DateTime.UtcNow.AddMinutes(-30))
                .ToListAsync();
            foreach (var old in oldPending)
                old.Status = "expired";
            if (oldPending.Count > 0)
                await _db.SaveChangesAsync();

            // Check for recent pending
            var existingPending = await _db.CoinPendingOrders
                .FirstOrDefaultAsync(o => o.UserId == userId && o.Status == "pending");

            if (existingPending != null)
            {
                // Return existing order so user can retry
                var (_, _, ppBaseUrl, _, _) = GetPayPalConfig();
                var ppCheckout = ppBaseUrl.Contains("sandbox") ? "https://www.sandbox.paypal.com" : "https://www.paypal.com";
                return Ok(new { orderId = existingPending.PaypalOrderId, approvalUrl = $"{ppCheckout}/checkoutnow?token={existingPending.PaypalOrderId}", finalPrice = existingPending.FinalPriceUsd, existing = true });
            }

            // 2. Handle custom coins purchase
            CoinPackage package;
            decimal finalPrice;

            if (req.CustomCoins.HasValue && req.CustomCoins.Value > 0)
            {
                var coins = req.CustomCoins.Value;
                if (coins < 100)
                    return BadRequest(new { error = "Minimo 100 coins ($1 USD)" });
                if (coins > 5000)
                    return BadRequest(new { error = "Maximo 5,000 coins ($50 USD) por compra custom" });

                finalPrice = Math.Round((decimal)coins / 100m, 2);
                // Create a virtual package for the pending order
                package = new CoinPackage
                {
                    Id = 0, // custom
                    Name = $"Custom ({coins} coins)",
                    Coins = coins,
                    BonusCoins = 0,
                    PriceUsd = finalPrice,
                };
            }
            else
            {
                // Standard package
                var packages = await _coinService.GetAvailablePackagesAsync(userId);
                package = packages.FirstOrDefault(p => p.Id == req.PackageId)!;
                if (package == null)
                    return BadRequest(new { error = "Paquete no disponible" });

                finalPrice = package.PriceUsd;
            }

            // 3. If price is 0 (free with coupon — future): skip PayPal, credit directly
            if (finalPrice <= 0m)
            {
                var pending = await _coinService.CreatePendingOrderAsync(userId, package.Id == 0 ? null : package.Id, null, 0m, req.CustomCoins);
                var purchase = await _coinService.CompletePurchaseAsync(userId, pending.Id, "FREE", "COMPLETED");
                var newBalance = await _coinService.GetBalanceAsync(userId);
                return Ok(new { free = true, coinsReceived = purchase.CoinsReceived, newBalance });
            }

            // 4. Create PayPal order
            try
            {
                var (clientId, clientSecret, baseUrl, returnUrl, cancelUrl) = GetPayPalConfig();
                var accessToken = await GetPayPalTokenAsync(clientId, clientSecret, baseUrl);

                var isCustom = req.CustomCoins.HasValue && req.CustomCoins.Value > 0;
                var customId = $"coins|{(isCustom ? "custom" : package.Id.ToString())}|{userId}";

                var orderPayload = new
                {
                    intent = "CAPTURE",
                    purchase_units = new[]
                    {
                        new
                        {
                            reference_id = $"coins_{package.Id}",
                            custom_id    = customId,
                            description  = $"DecaCoins — {package.Name} ({package.Coins}+{package.BonusCoins})",
                            amount = new
                            {
                                currency_code = "USD",
                                value         = finalPrice.ToString("F2", CultureInfo.InvariantCulture),
                            },
                        }
                    },
                    application_context = new
                    {
                        brand_name   = "Decatron",
                        landing_page = "BILLING",
                        user_action  = "PAY_NOW",
                        return_url   = $"{returnUrl}?status=return",
                        cancel_url   = $"{cancelUrl}?status=cancel",
                    }
                };

                using var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", accessToken);

                var json     = JsonSerializer.Serialize(orderPayload);
                var content  = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await client.PostAsync($"{baseUrl}/v2/checkout/orders", content);
                var body     = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("PayPal create order failed: {Body}", body);
                    return StatusCode(502, new { error = "Error al crear la orden en PayPal" });
                }

                using var doc   = JsonDocument.Parse(body);
                var orderId     = doc.RootElement.GetProperty("id").GetString() ?? "";
                var approvalUrl = "";

                foreach (var link in doc.RootElement.GetProperty("links").EnumerateArray())
                {
                    if (link.GetProperty("rel").GetString() == "approve")
                    {
                        approvalUrl = link.GetProperty("href").GetString() ?? "";
                        break;
                    }
                }

                // 5. Save pending order
                var pendingOrder = await _coinService.CreatePendingOrderAsync(userId, isCustom ? null : package.Id, null, finalPrice, req.CustomCoins);
                pendingOrder.PaypalOrderId = orderId;
                await _db.SaveChangesAsync();

                return Ok(new { orderId, approvalUrl, finalPrice });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating PayPal order for coins");
                return StatusCode(500, new { error = "Error interno al procesar la compra" });
            }
        }

        // ─── POST /api/coins/capture ─────────────────────────────────────────────

        [HttpPost("capture")]
        public async Task<IActionResult> Capture([FromBody] CoinCaptureRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.OrderId))
                return BadRequest(new { error = "orderId es obligatorio" });

            var userId = GetUserId();

            try
            {
                var (clientId, clientSecret, baseUrl, _, _) = GetPayPalConfig();
                var accessToken = await GetPayPalTokenAsync(clientId, clientSecret, baseUrl);

                // 1. Capture PayPal order
                using var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", accessToken);

                var captureResp = await client.PostAsync(
                    $"{baseUrl}/v2/checkout/orders/{req.OrderId}/capture",
                    new StringContent("{}", Encoding.UTF8, "application/json"));

                var captureBody = await captureResp.Content.ReadAsStringAsync();

                if (!captureResp.IsSuccessStatusCode)
                {
                    _logger.LogError("PayPal capture failed for coins order {Id}: {Body}", req.OrderId, captureBody);
                    return StatusCode(502, new { error = "Error al capturar el pago en PayPal" });
                }

                using var doc = JsonDocument.Parse(captureBody);
                var status    = doc.RootElement.GetProperty("status").GetString();

                if (status != "COMPLETED")
                    return BadRequest(new { error = $"El pago no se completó (estado: {status})" });

                // 2. Find pending order by paypal_order_id
                var pending = await _db.CoinPendingOrders
                    .FirstOrDefaultAsync(o => o.PaypalOrderId == req.OrderId && o.UserId == userId);

                if (pending == null)
                    return NotFound(new { error = "No se encontró la orden pendiente" });

                if (pending.Status != "pending")
                    return Conflict(new { error = "Esta orden ya fue procesada" });

                // 3. Complete purchase
                var purchase   = await _coinService.CompletePurchaseAsync(userId, pending.Id, req.OrderId, status);
                var newBalance = await _coinService.GetBalanceAsync(userId);

                return Ok(new
                {
                    success       = true,
                    coinsReceived = purchase.CoinsReceived,
                    newBalance,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error capturing PayPal order for coins: {OrderId}", req.OrderId);
                return StatusCode(500, new { error = "Error interno al capturar el pago" });
            }
        }

        // ─── PayPal Helpers ──────────────────────────────────────────────────────

        private (string clientId, string clientSecret, string baseUrl, string returnUrl, string cancelUrl) GetPayPalConfig()
        {
            var section = _configuration.GetSection("CoinsPayPal");
            var mode    = section["Mode"] ?? "sandbox";

            string clientId, clientSecret;
            if (mode == "live")
            {
                clientId     = section["LiveClientId"]     ?? section["ClientId"]     ?? "";
                clientSecret = section["LiveClientSecret"] ?? section["ClientSecret"] ?? "";
            }
            else
            {
                clientId     = section["ClientId"]     ?? "";
                clientSecret = section["ClientSecret"] ?? "";
            }

            var baseUrl   = mode == "live"
                ? "https://api-m.paypal.com"
                : "https://api-m.sandbox.paypal.com";
            var returnUrl = "https://twitch.decatron.net/me/coins";
            var cancelUrl = "https://twitch.decatron.net/me/coins";

            return (clientId, clientSecret, baseUrl, returnUrl, cancelUrl);
        }

        private async Task<string> GetPayPalTokenAsync(
            string clientId, string clientSecret, string baseUrl)
        {
            using var client = _httpClientFactory.CreateClient();
            var credentials  = Convert.ToBase64String(
                Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));
            client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Basic", credentials);

            var content  = new StringContent(
                "grant_type=client_credentials", Encoding.UTF8, "application/x-www-form-urlencoded");
            var response = await client.PostAsync($"{baseUrl}/v1/oauth2/token", content);
            var body     = await response.Content.ReadAsStringAsync();

            using var doc = JsonDocument.Parse(body);
            return doc.RootElement.GetProperty("access_token").GetString() ?? "";
        }

        // ─── Helpers ─────────────────────────────────────────────────────────────

        private long GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(userIdClaim, out var userId))
                return userId;
            throw new UnauthorizedAccessException("User ID not found in token");
        }
    }

    // ─── Request DTOs ────────────────────────────────────────────────────────────

    public class CoinBuyRequest
    {
        public long PackageId { get; set; }
        public int? CustomCoins { get; set; }
        public string? DiscountCode { get; set; }
    }

    public class CoinCaptureRequest
    {
        public string OrderId { get; set; } = string.Empty;
    }
}
