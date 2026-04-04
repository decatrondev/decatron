using System.Globalization;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Decatron.Attributes;
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

        // ─── POST /api/coins/validate-code ─────────────────────────────────────

        [HttpPost("validate-code")]
        public async Task<IActionResult> ValidateCode([FromBody] CoinValidateCodeRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Code))
                return BadRequest(new { error = "Codigo es obligatorio" });

            var userId = GetUserId();

            // If packageId is 0 or not provided, validate generically with price 0
            // The frontend may call this before selecting a package
            decimal packagePrice = 0;
            if (req.PackageId > 0)
            {
                var pkg = await _db.CoinPackages.FindAsync(req.PackageId);
                if (pkg == null)
                    return BadRequest(new { error = "Paquete no encontrado" });
                packagePrice = pkg.PriceUsd;
            }

            var result = await _coinService.ValidateDiscountCodeAsync(req.Code, userId, req.PackageId, packagePrice);
            return Ok(result);
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

            // 3. Validate discount code if provided
            DiscountValidation? discountValidation = null;
            long? discountCodeId = null;

            if (!string.IsNullOrWhiteSpace(req.DiscountCode))
            {
                discountValidation = await _coinService.ValidateDiscountCodeAsync(
                    req.DiscountCode, userId, req.PackageId, finalPrice);

                if (!discountValidation.Valid)
                    return BadRequest(new { error = discountValidation.Error });

                discountCodeId = discountValidation.CodeId;
                finalPrice = discountValidation.FinalPrice;
            }

            // 4. If price is 0 (free with coupon): skip PayPal, credit directly
            if (finalPrice <= 0m)
            {
                var pending = await _coinService.CreatePendingOrderAsync(userId, package.Id == 0 ? null : package.Id, discountCodeId, 0m, req.CustomCoins);
                var purchase = await _coinService.CompletePurchaseAsync(userId, pending.Id, "FREE", "COMPLETED");

                // Apply discount code usage
                if (discountCodeId.HasValue && discountValidation != null)
                {
                    await _coinService.ApplyDiscountCodeAsync(discountCodeId.Value, userId, purchase.Id, package.PriceUsd);

                    if (discountValidation.DiscountType == "bonus_coins" && discountValidation.BonusCoins > 0)
                    {
                        purchase.BonusCoinsFromCoupon = discountValidation.BonusCoins;
                        purchase.BonusCouponScheduledAt = DateTime.UtcNow;
                        await _db.SaveChangesAsync();
                    }
                }

                var newBalance = await _coinService.GetBalanceAsync(userId);
                return Ok(new { free = true, coinsReceived = purchase.CoinsReceived, newBalance });
            }

            // 5. Create PayPal order
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

                // 6. Save pending order with discount code
                var pendingOrder = await _coinService.CreatePendingOrderAsync(userId, isCustom ? null : package.Id, discountCodeId, finalPrice, req.CustomCoins);
                pendingOrder.PaypalOrderId = orderId;

                // Store discount info for capture phase
                if (discountValidation != null)
                {
                    pendingOrder.DiscountCodeId = discountCodeId;
                }

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

                // 4. Apply discount code if used
                if (pending.DiscountCodeId.HasValue)
                {
                    var originalPrice = pending.FinalPriceUsd; // This is already the discounted price
                    // Get original package price for discount amount calculation
                    decimal discountApplied = 0;
                    if (pending.PackageId.HasValue)
                    {
                        var pkg = await _db.CoinPackages.FindAsync(pending.PackageId.Value);
                        if (pkg != null)
                            discountApplied = pkg.PriceUsd - pending.FinalPriceUsd;
                    }

                    await _coinService.ApplyDiscountCodeAsync(
                        pending.DiscountCodeId.Value, userId, purchase.Id, discountApplied);

                    // Check if bonus_coins type — look up the code
                    var discCode = await _db.CoinDiscountCodes.FindAsync(pending.DiscountCodeId.Value);
                    if (discCode != null && discCode.DiscountType == "bonus_coins")
                    {
                        purchase.BonusCoinsFromCoupon = (int)discCode.DiscountValue;
                        purchase.BonusCouponScheduledAt = DateTime.UtcNow;
                        purchase.DiscountCodeId = discCode.Id;
                        await _db.SaveChangesAsync();
                    }
                }

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

        // ─── GET /api/coins/search-users?q=xxx ──────────────────────────────────

        [HttpGet("search-users")]
        public async Task<IActionResult> SearchUsers([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
                return Ok(Array.Empty<object>());

            var query = q.ToLower();
            var users = await _db.Users
                .Where(u => u.IsActive && (
                    (u.Login != null && u.Login.ToLower().Contains(query)) ||
                    (u.DiscordUsername != null && u.DiscordUsername.ToLower().Contains(query)) ||
                    (u.DisplayName != null && u.DisplayName.ToLower().Contains(query))
                ))
                .Take(10)
                .Select(u => new {
                    id = u.Id,
                    login = u.Login,
                    displayName = u.DisplayName,
                    discordUsername = u.DiscordUsername,
                    profileImage = u.ProfileImageUrl ?? u.DiscordAvatar
                })
                .ToListAsync();

            return Ok(users);
        }

        // ─── POST /api/coins/transfer ───────────────────────────────────────────

        [HttpPost("transfer")]
        public async Task<IActionResult> Transfer([FromBody] CoinTransferRequest req)
        {
            var userId = GetUserId();

            if (string.IsNullOrWhiteSpace(req.Username))
                return BadRequest(new { error = "Username es obligatorio" });
            if (req.Amount <= 0)
                return BadRequest(new { error = "Cantidad debe ser mayor a 0" });

            // Find receiver
            var receiverId = await _coinService.FindUserIdByUsernameAsync(req.Username);
            if (receiverId == null)
                return NotFound(new { error = "Usuario no encontrado" });

            try
            {
                var transfer = await _coinService.TransferCoinsAsync(userId, receiverId.Value, req.Amount, req.Message);
                var newBalance = await _coinService.GetBalanceAsync(userId);
                return Ok(new { success = true, newBalance, transfer });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // ─── GET /api/coins/referral ────────────────────────────────────────────

        [HttpGet("referral")]
        public async Task<IActionResult> GetReferral()
        {
            var userId = GetUserId();
            try
            {
                var stats = await _coinService.GetReferralStatsAsync(userId);
                return Ok(stats);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting referral stats for user {UserId}", userId);
                return StatusCode(500, new { error = "Error al obtener datos de referido" });
            }
        }

        // ─── POST /api/coins/referral/apply ─────────────────────────────────────

        [HttpPost("referral/apply")]
        public async Task<IActionResult> ApplyReferral([FromBody] CoinApplyReferralRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Code))
                return BadRequest(new { error = "Codigo es obligatorio" });

            var userId = GetUserId();
            try
            {
                await _coinService.CreateReferralAsync(userId, req.Code.Trim().ToUpper());

                // Check if eligible for immediate completion
                await _coinService.CompleteReferralIfEligible(userId);

                return Ok(new { success = true, message = "Codigo de referido aplicado correctamente" });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error applying referral code for user {UserId}", userId);
                return StatusCode(500, new { error = "Error al aplicar codigo de referido" });
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

    public class CoinTransferRequest
    {
        public string Username { get; set; } = string.Empty;
        public int Amount { get; set; }
        public string? Message { get; set; }
    }

    public class CoinApplyReferralRequest
    {
        public string Code { get; set; } = string.Empty;
    }

    public class CoinValidateCodeRequest
    {
        public string Code { get; set; } = string.Empty;
        public long PackageId { get; set; }
    }

    // ─── Admin Coins Controller ─────────────────────────────────────────────────

    [ApiController]
    [Route("api/admin/coins")]
    [Authorize]
    [RequireSystemOwner]
    public class AdminCoinController : ControllerBase
    {
        private readonly CoinService _coinService;
        private readonly DecatronDbContext _db;

        public AdminCoinController(CoinService coinService, DecatronDbContext db)
        {
            _coinService = coinService;
            _db          = db;
        }

        private long GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(userIdClaim, out var userId))
                return userId;
            throw new UnauthorizedAccessException("User ID not found in token");
        }

        [HttpPost("give")]
        public async Task<IActionResult> Give([FromBody] AdminCoinGiveRemoveRequest req)
        {
            var adminId = GetUserId();
            await _coinService.GiveCoinsAsync(req.UserId, req.Amount, req.Description ?? "Admin give", adminId);
            var balance = await _coinService.GetBalanceAsync(req.UserId);
            return Ok(new { success = true, newBalance = balance });
        }

        [HttpPost("remove")]
        public async Task<IActionResult> Remove([FromBody] AdminCoinGiveRemoveRequest req)
        {
            var adminId = GetUserId();
            await _coinService.RemoveCoinsAsync(req.UserId, req.Amount, req.Description ?? "Admin remove", adminId);
            var balance = await _coinService.GetBalanceAsync(req.UserId);
            return Ok(new { success = true, newBalance = balance });
        }

        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUser(long userId)
        {
            var uc = await _db.UserCoins.FirstOrDefaultAsync(x => x.UserId == userId);
            if (uc == null)
                return NotFound(new { error = "Usuario no tiene cuenta de economia" });

            return Ok(new
            {
                userId          = uc.UserId,
                balance         = uc.Balance,
                economyStatus   = uc.EconomyStatus,
                totalEarned     = uc.TotalEarned,
                totalSpent      = uc.TotalSpent,
                totalTransferredIn  = uc.TotalTransferredIn,
                totalTransferredOut = uc.TotalTransferredOut,
                firstPurchaseAt = uc.FirstPurchaseAt,
                createdAt       = uc.CreatedAt,
            });
        }

        [HttpPost("user/{userId}/status")]
        public async Task<IActionResult> UpdateStatus(long userId, [FromBody] AdminCoinStatusRequest req)
        {
            var validStatuses = new[] { "normal", "flagged", "banned_economy" };
            if (!validStatuses.Contains(req.Status))
                return BadRequest(new { error = "Status invalido. Opciones: normal, flagged, banned_economy" });

            await _coinService.UpdateEconomyStatusAsync(userId, req.Status);
            return Ok(new { success = true, status = req.Status });
        }

        // ─── Stats ──────────────────────────────────────────────────────────────

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            var totalCoinsInCirculation = await _db.UserCoins.SumAsync(x => x.Balance);
            var totalCoinsSold = await _db.CoinPurchases.SumAsync(x => (long)x.CoinsReceived);
            var totalRevenue = await _db.CoinPurchases.SumAsync(x => x.AmountPaidUsd);

            var firstOfMonth = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var revenueThisMonth = await _db.CoinPurchases
                .Where(p => p.CreatedAt >= firstOfMonth)
                .SumAsync(x => x.AmountPaidUsd);

            var today = DateTime.UtcNow.Date;
            var transactionsToday = await _db.CoinTransactions.CountAsync(t => t.CreatedAt >= today);
            var totalUsers = await _db.UserCoins.CountAsync();
            var flaggedUsers = await _db.UserCoins.CountAsync(x => x.EconomyStatus == "flagged");
            var pendingReferrals = await _db.CoinReferrals.CountAsync(x => x.Status == "pending");

            return Ok(new
            {
                totalCoinsInCirculation,
                totalCoinsSold,
                totalRevenue,
                revenueThisMonth,
                transactionsToday,
                totalUsers,
                flaggedUsers,
                pendingReferrals,
            });
        }

        // ─── Transactions Audit Log ─────────────────────────────────────────────

        [HttpGet("transactions")]
        public async Task<IActionResult> GetTransactions([FromQuery] int page = 1, [FromQuery] string? type = null, [FromQuery] long? userId = null)
        {
            if (page < 1) page = 1;
            const int pageSize = 20;

            var query = _db.CoinTransactions.AsQueryable();

            if (!string.IsNullOrWhiteSpace(type))
                query = query.Where(t => t.Type == type);
            if (userId.HasValue)
                query = query.Where(t => t.UserId == userId.Value);

            var total = await query.CountAsync();

            var transactions = await query
                .OrderByDescending(t => t.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var userIds = transactions.Select(t => t.UserId).Distinct().ToList();
            var users = await _db.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.DisplayName, u.Login, u.DiscordUsername })
                .ToDictionaryAsync(u => u.Id);

            var result = transactions.Select(t => new
            {
                t.Id,
                t.UserId,
                userName = users.ContainsKey(t.UserId)
                    ? (users[t.UserId].DisplayName ?? users[t.UserId].Login ?? users[t.UserId].DiscordUsername ?? $"#{t.UserId}")
                    : $"#{t.UserId}",
                t.Amount,
                t.BalanceAfter,
                t.Type,
                t.Description,
                t.RelatedUserId,
                t.CreatedAt,
            });

            return Ok(new { items = result, total, page, pageSize, totalPages = (int)Math.Ceiling((double)total / pageSize) });
        }

        // ─── Settings ───────────────────────────────────────────────────────────

        [HttpGet("settings")]
        public async Task<IActionResult> GetSettings()
        {
            var settings = await _coinService.GetSettingsAsync();
            return Ok(settings);
        }

        [HttpPut("settings")]
        public async Task<IActionResult> UpdateSettings([FromBody] AdminCoinSettingsRequest req)
        {
            var settings = await _db.CoinSettings.FirstOrDefaultAsync();
            if (settings == null)
                return NotFound(new { error = "Settings not found" });

            settings.CurrencyName                = req.CurrencyName ?? settings.CurrencyName;
            settings.CurrencyIcon                = req.CurrencyIcon ?? settings.CurrencyIcon;
            settings.MaxTransferPerDay            = req.MaxTransferPerDay ?? settings.MaxTransferPerDay;
            settings.MaxTransfersPerDay           = req.MaxTransfersPerDay ?? settings.MaxTransfersPerDay;
            settings.MinTransferAmount            = req.MinTransferAmount ?? settings.MinTransferAmount;
            settings.MinAccountAgeToTransferDays  = req.MinAccountAgeToTransferDays ?? settings.MinAccountAgeToTransferDays;
            settings.MinAccountAgeToReceiveDays   = req.MinAccountAgeToReceiveDays ?? settings.MinAccountAgeToReceiveDays;
            settings.MaxReferralsPerUser          = req.MaxReferralsPerUser;
            settings.ReferralBonusReferrer        = req.ReferralBonusReferrer ?? settings.ReferralBonusReferrer;
            settings.ReferralBonusReferred        = req.ReferralBonusReferred ?? settings.ReferralBonusReferred;
            settings.ReferralMinActivityDays      = req.ReferralMinActivityDays ?? settings.ReferralMinActivityDays;
            settings.FirstPurchaseBonusPercent    = req.FirstPurchaseBonusPercent ?? settings.FirstPurchaseBonusPercent;
            settings.Enabled                      = req.Enabled ?? settings.Enabled;
            settings.UpdatedAt                    = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            _coinService.ClearSettingsCache();

            return Ok(new { success = true });
        }

        // ─── Packages Admin ─────────────────────────────────────────────────────

        [HttpGet("packages")]
        public async Task<IActionResult> GetAllPackages()
        {
            var packages = await _db.CoinPackages
                .OrderBy(p => p.SortOrder)
                .ToListAsync();
            return Ok(packages);
        }

        [HttpPost("packages")]
        public async Task<IActionResult> CreatePackage([FromBody] AdminCoinPackageRequest req)
        {
            var package_ = new CoinPackage
            {
                Name              = req.Name ?? "New Package",
                Description       = req.Description,
                Coins             = req.Coins,
                BonusCoins        = req.BonusCoins,
                PriceUsd          = req.PriceUsd,
                Icon              = req.Icon,
                IsOffer           = req.IsOffer,
                OfferStartsAt     = req.OfferStartsAt,
                OfferExpiresAt    = req.OfferExpiresAt,
                FirstPurchaseOnly = req.FirstPurchaseOnly,
                MaxPerTransaction = req.MaxPerTransaction,
                SortOrder         = req.SortOrder,
                Enabled           = req.Enabled,
                CreatedAt         = DateTime.UtcNow,
                UpdatedAt         = DateTime.UtcNow,
            };

            _db.CoinPackages.Add(package_);
            await _db.SaveChangesAsync();
            return Ok(new { success = true, id = package_.Id });
        }

        [HttpPut("packages/{id}")]
        public async Task<IActionResult> UpdatePackage(long id, [FromBody] AdminCoinPackageRequest req)
        {
            var package_ = await _db.CoinPackages.FindAsync(id);
            if (package_ == null)
                return NotFound(new { error = "Paquete no encontrado" });

            package_.Name              = req.Name ?? package_.Name;
            package_.Description       = req.Description;
            package_.Coins             = req.Coins;
            package_.BonusCoins        = req.BonusCoins;
            package_.PriceUsd          = req.PriceUsd;
            package_.Icon              = req.Icon;
            package_.IsOffer           = req.IsOffer;
            package_.OfferStartsAt     = req.OfferStartsAt;
            package_.OfferExpiresAt    = req.OfferExpiresAt;
            package_.FirstPurchaseOnly = req.FirstPurchaseOnly;
            package_.MaxPerTransaction = req.MaxPerTransaction;
            package_.SortOrder         = req.SortOrder;
            package_.Enabled           = req.Enabled;
            package_.UpdatedAt         = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("packages/{id}")]
        public async Task<IActionResult> DeletePackage(long id)
        {
            var package_ = await _db.CoinPackages.FindAsync(id);
            if (package_ == null)
                return NotFound(new { error = "Paquete no encontrado" });

            package_.Enabled = false;
            package_.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }

        // ─── Discount Codes CRUD ────────────────────────────────────────────────

        [HttpGet("discounts")]
        public async Task<IActionResult> GetDiscounts()
        {
            var codes = await _db.CoinDiscountCodes
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();

            var codeIds = codes.Select(c => c.Id).ToList();
            var usageCounts = await _db.CoinDiscountUses
                .Where(u => codeIds.Contains(u.CodeId))
                .GroupBy(u => u.CodeId)
                .Select(g => new { CodeId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.CodeId, x => x.Count);

            var result = codes.Select(c => new
            {
                c.Id,
                c.Code,
                c.DiscountType,
                c.DiscountValue,
                c.AssignedUserId,
                c.MaxUses,
                c.CurrentUses,
                c.MaxUsesPerUser,
                c.MinPurchaseUsd,
                c.ApplicablePackageId,
                c.CombinableWithFirstPurchase,
                c.StartsAt,
                c.ExpiresAt,
                c.Enabled,
                c.CreatedBy,
                c.CreatedAt,
                TotalUses = usageCounts.GetValueOrDefault(c.Id, 0),
            });

            return Ok(result);
        }

        [HttpPost("discounts")]
        public async Task<IActionResult> CreateDiscount([FromBody] AdminDiscountCodeRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Code))
                return BadRequest(new { error = "Codigo es obligatorio" });

            var validTypes = new[] { "percentage", "fixed_amount", "bonus_coins" };
            if (!validTypes.Contains(req.DiscountType))
                return BadRequest(new { error = "Tipo de descuento invalido" });

            // Check for duplicate code
            var existing = await _db.CoinDiscountCodes
                .AnyAsync(c => c.Code.ToLower() == req.Code.ToLower());
            if (existing)
                return BadRequest(new { error = "Ya existe un codigo con ese nombre" });

            var adminId = GetUserId();
            var code = new CoinDiscountCode
            {
                Code                      = req.Code.Trim(),
                DiscountType              = req.DiscountType,
                DiscountValue             = req.DiscountValue,
                AssignedUserId            = req.AssignedUserId,
                MaxUses                   = req.MaxUses,
                CurrentUses               = 0,
                MaxUsesPerUser            = req.MaxUsesPerUser,
                MinPurchaseUsd            = req.MinPurchaseUsd,
                ApplicablePackageId       = req.ApplicablePackageId,
                CombinableWithFirstPurchase = req.CombinableWithFirstPurchase,
                StartsAt                  = req.StartsAt,
                ExpiresAt                 = req.ExpiresAt,
                Enabled                   = true,
                CreatedBy                 = adminId,
                CreatedAt                 = DateTime.UtcNow,
            };

            _db.CoinDiscountCodes.Add(code);
            await _db.SaveChangesAsync();

            return Ok(new { success = true, id = code.Id });
        }

        [HttpPut("discounts/{id}")]
        public async Task<IActionResult> UpdateDiscount(long id, [FromBody] AdminDiscountCodeRequest req)
        {
            var code = await _db.CoinDiscountCodes.FindAsync(id);
            if (code == null)
                return NotFound(new { error = "Codigo no encontrado" });

            var validTypes = new[] { "percentage", "fixed_amount", "bonus_coins" };
            if (!validTypes.Contains(req.DiscountType))
                return BadRequest(new { error = "Tipo de descuento invalido" });

            // Check duplicate (exclude self)
            var duplicate = await _db.CoinDiscountCodes
                .AnyAsync(c => c.Code.ToLower() == req.Code.ToLower() && c.Id != id);
            if (duplicate)
                return BadRequest(new { error = "Ya existe otro codigo con ese nombre" });

            code.Code                      = req.Code.Trim();
            code.DiscountType              = req.DiscountType;
            code.DiscountValue             = req.DiscountValue;
            code.AssignedUserId            = req.AssignedUserId;
            code.MaxUses                   = req.MaxUses;
            code.MaxUsesPerUser            = req.MaxUsesPerUser;
            code.MinPurchaseUsd            = req.MinPurchaseUsd;
            code.ApplicablePackageId       = req.ApplicablePackageId;
            code.CombinableWithFirstPurchase = req.CombinableWithFirstPurchase;
            code.StartsAt                  = req.StartsAt;
            code.ExpiresAt                 = req.ExpiresAt;

            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("discounts/{id}")]
        public async Task<IActionResult> DeleteDiscount(long id)
        {
            var code = await _db.CoinDiscountCodes.FindAsync(id);
            if (code == null)
                return NotFound(new { error = "Codigo no encontrado" });

            code.Enabled = false;
            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }

        // ─── Referrals Admin ────────────────────────────────────────────────────

        [HttpGet("referrals")]
        public async Task<IActionResult> GetReferrals()
        {
            var referrals = await _db.CoinReferrals
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            var userIds = referrals
                .SelectMany(r => new[] { r.ReferrerUserId, r.ReferredUserId })
                .Distinct()
                .ToList();

            var users = await _db.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.Login, u.DisplayName, u.DiscordUsername })
                .ToDictionaryAsync(u => u.Id);

            var result = referrals.Select(r => new
            {
                r.Id,
                r.ReferrerUserId,
                referrerName = users.ContainsKey(r.ReferrerUserId)
                    ? (users[r.ReferrerUserId].DisplayName ?? users[r.ReferrerUserId].Login ?? users[r.ReferrerUserId].DiscordUsername ?? $"#{r.ReferrerUserId}")
                    : $"#{r.ReferrerUserId}",
                r.ReferredUserId,
                referredName = users.ContainsKey(r.ReferredUserId)
                    ? (users[r.ReferredUserId].DisplayName ?? users[r.ReferredUserId].Login ?? users[r.ReferredUserId].DiscordUsername ?? $"#{r.ReferredUserId}")
                    : $"#{r.ReferredUserId}",
                r.ReferralCode,
                r.Status,
                r.BonusGivenToReferrer,
                r.BonusGivenToReferred,
                r.CompletedAt,
                r.CreatedAt,
            });

            return Ok(result);
        }

        [HttpPost("referrals/{id}/reject")]
        public async Task<IActionResult> RejectReferral(long id)
        {
            var referral = await _db.CoinReferrals.FindAsync(id);
            if (referral == null)
                return NotFound(new { error = "Referido no encontrado" });

            if (referral.Status != "pending")
                return BadRequest(new { error = $"No se puede rechazar un referido con estado '{referral.Status}'" });

            referral.Status = "rejected";
            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }
    }

    public class AdminCoinGiveRemoveRequest
    {
        public long UserId { get; set; }
        public int Amount { get; set; }
        public string? Description { get; set; }
    }

    public class AdminCoinStatusRequest
    {
        public string Status { get; set; } = string.Empty;
    }

    public class AdminCoinSettingsRequest
    {
        public string? CurrencyName { get; set; }
        public string? CurrencyIcon { get; set; }
        public long? MaxTransferPerDay { get; set; }
        public int? MaxTransfersPerDay { get; set; }
        public int? MinTransferAmount { get; set; }
        public int? MinAccountAgeToTransferDays { get; set; }
        public int? MinAccountAgeToReceiveDays { get; set; }
        public int? MaxReferralsPerUser { get; set; }
        public int? ReferralBonusReferrer { get; set; }
        public int? ReferralBonusReferred { get; set; }
        public int? ReferralMinActivityDays { get; set; }
        public int? FirstPurchaseBonusPercent { get; set; }
        public bool? Enabled { get; set; }
    }

    public class AdminCoinPackageRequest
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public int Coins { get; set; }
        public int BonusCoins { get; set; }
        public decimal PriceUsd { get; set; }
        public string? Icon { get; set; }
        public bool IsOffer { get; set; }
        public DateTime? OfferStartsAt { get; set; }
        public DateTime? OfferExpiresAt { get; set; }
        public bool FirstPurchaseOnly { get; set; }
        public int MaxPerTransaction { get; set; } = 1;
        public int SortOrder { get; set; }
        public bool Enabled { get; set; } = true;
    }

    public class AdminDiscountCodeRequest
    {
        public string Code { get; set; } = string.Empty;
        public string DiscountType { get; set; } = string.Empty;
        public decimal DiscountValue { get; set; }
        public long? AssignedUserId { get; set; }
        public int? MaxUses { get; set; }
        public int MaxUsesPerUser { get; set; } = 1;
        public decimal MinPurchaseUsd { get; set; }
        public long? ApplicablePackageId { get; set; }
        public bool CombinableWithFirstPurchase { get; set; } = true;
        public DateTime? StartsAt { get; set; }
        public DateTime? ExpiresAt { get; set; }
    }
}
