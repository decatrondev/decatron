using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
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
    [Route("api/[controller]")]
    public class SupportersController : ControllerBase
    {
        private readonly ISupportersService _service;
        private readonly DecatronDbContext   _db;
        private readonly ILogger<SupportersController> _logger;
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;

        // Server-side pricing — never trust client amounts
        private static readonly Dictionary<string, Dictionary<string, decimal>> TierPrices = new()
        {
            ["supporter"] = new() { ["monthly"] = 5.00m },
            ["premium"]   = new() { ["monthly"] = 15.00m },
            ["fundador"]  = new() { ["monthly"] = 25.00m, ["permanent"] = 100.00m },
        };

        public SupportersController(
            ISupportersService service,
            DecatronDbContext db,
            ILogger<SupportersController> logger,
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory)
        {
            _service            = service;
            _db                 = db;
            _logger             = logger;
            _configuration      = configuration;
            _httpClientFactory  = httpClientFactory;
        }

        // ── Auth helper (same pattern as DecatronAIAdminController) ──────────────

        private async Task<bool> IsOwnerAsync()
        {
            var username = User.FindFirst("login")?.Value
                        ?? User.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(username)) return false;

            var admin = await _db.SystemAdmins.FirstOrDefaultAsync(
                a => a.Username.ToLower() == username.ToLower() && a.Role == "owner");

            return admin != null;
        }

        // ═══════════════════════════════════════════════════════════════
        // PUBLIC ENDPOINTS — no authentication required
        // ═══════════════════════════════════════════════════════════════

        /// <summary>Returns the public page config (title, tagline, hero colors, monthly progress)</summary>
        [HttpGet("public-config")]
        [AllowAnonymous]
        public async Task<IActionResult> GetPublicConfig()
        {
            try
            {
                var full   = await _service.GetConfigAsync();
                var config = full.Config;

                return Ok(new
                {
                    enabled             = config.Enabled,
                    title               = config.Title,
                    tagline             = config.Tagline,
                    description         = config.Description,
                    monthlyGoal         = config.MonthlyGoal,
                    monthlyRaised       = config.MonthlyRaised,
                    showProgressBar     = config.ShowProgressBar,
                    showSupportersWall  = config.ShowSupportersWall,
                    showFoundersSection = config.ShowFoundersSection,
                    heroFrom            = config.HeroFrom,
                    heroTo              = config.HeroTo,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting public supporters config");
                return StatusCode(500, new { error = "Error al obtener la configuración" });
            }
        }

        /// <summary>Returns the list of active supporters for the public wall</summary>
        [HttpGet("list-public")]
        [AllowAnonymous]
        public async Task<IActionResult> GetPublicSupporters()
        {
            try
            {
                var supporters = await _service.GetPublicSupportersAsync();
                return Ok(supporters);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting public supporters list");
                return StatusCode(500, new { error = "Error al obtener la lista de supporters" });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // ADMIN ENDPOINTS — owner only
        // ═══════════════════════════════════════════════════════════════

        /// <summary>Returns the full config + tiers for the admin editor</summary>
        [Authorize]
        [HttpGet("config")]
        public async Task<IActionResult> GetConfig()
        {
            if (!await IsOwnerAsync()) return Forbid();

            try
            {
                var full = await _service.GetConfigAsync();
                return Ok(full);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting supporters admin config");
                return StatusCode(500, new { error = "Error al obtener la configuración" });
            }
        }

        /// <summary>Saves the page config + tiers</summary>
        [Authorize]
        [HttpPost("config")]
        public async Task<IActionResult> SaveConfig([FromBody] SupportersFullConfig body)
        {
            if (!await IsOwnerAsync()) return Forbid();

            try
            {
                await _service.SaveConfigAsync(body.Config, body.Tiers);
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving supporters config");
                return StatusCode(500, new { error = "Error al guardar la configuración" });
            }
        }

        /// <summary>Paginated list of active supporters for the admin panel</summary>
        [Authorize]
        [HttpGet("list")]
        public async Task<IActionResult> GetSupportersList(
            [FromQuery] int page     = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string? search = null)
        {
            if (!await IsOwnerAsync()) return Forbid();

            try
            {
                page     = Math.Max(1, page);
                pageSize = Math.Clamp(pageSize, 1, 100);

                var (items, total) = await _service.GetSupportersListAsync(page, pageSize, search);

                return Ok(new
                {
                    data       = items,
                    total,
                    page,
                    pageSize,
                    totalPages = (int)Math.Ceiling(total / (double)pageSize),
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting supporters list");
                return StatusCode(500, new { error = "Error al obtener la lista" });
            }
        }

        /// <summary>Manually assign a tier to any Twitch user</summary>
        [Authorize]
        [HttpPost("assign-tier")]
        public async Task<IActionResult> AssignTier([FromBody] AssignTierRequest req)
        {
            if (!await IsOwnerAsync()) return Forbid();

            if (string.IsNullOrWhiteSpace(req.TwitchLogin))
                return BadRequest(new { error = "twitchLogin es obligatorio" });

            var validTiers = new[] { "free", "supporter", "premium", "fundador" };
            if (!Array.Exists(validTiers, t => t == req.Tier))
                return BadRequest(new { error = $"Tier inválido: {req.Tier}" });

            try
            {
                await _service.AssignTierAsync(
                    req.TwitchLogin,
                    req.Tier,
                    req.IsPermanent,
                    req.Duration,
                    req.Unit);

                var expiryInfo = req.IsPermanent
                    ? "permanente"
                    : $"{req.Duration} {req.Unit}";

                return Ok(new
                {
                    success = true,
                    message = $"Tier '{req.Tier}' asignado a @{req.TwitchLogin} ({expiryInfo})",
                });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error assigning tier to {Login}", req.TwitchLogin);
                return StatusCode(500, new { error = "Error al asignar el tier" });
            }
        }

        // ─── Discount Codes ───────────────────────────────────────────────────────

        [Authorize]
        [HttpGet("discount-codes")]
        public async Task<IActionResult> GetDiscountCodes()
        {
            if (!await IsOwnerAsync()) return Forbid();

            try
            {
                var codes = await _service.GetDiscountCodesAsync();
                return Ok(codes);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting discount codes");
                return StatusCode(500, new { error = "Error al obtener los códigos" });
            }
        }

        [Authorize]
        [HttpPost("discount-codes")]
        public async Task<IActionResult> CreateDiscountCode([FromBody] CreateDiscountCodeRequest req)
        {
            if (!await IsOwnerAsync()) return Forbid();

            if (string.IsNullOrWhiteSpace(req.Code))
                return BadRequest(new { error = "El código no puede estar vacío" });

            if (req.DiscountValue <= 0)
                return BadRequest(new { error = "El valor del descuento debe ser mayor a 0" });

            if (req.DiscountType == "percent" && req.DiscountValue > 100)
                return BadRequest(new { error = "El porcentaje no puede ser mayor a 100" });

            try
            {
                var created = await _service.CreateDiscountCodeAsync(req);
                return Ok(created);
            }
            catch (Exception ex) when (ex.Message.Contains("unique") || ex.Message.Contains("duplicate"))
            {
                return Conflict(new { error = $"El código '{req.Code.ToUpper()}' ya existe" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating discount code");
                return StatusCode(500, new { error = "Error al crear el código" });
            }
        }

        [Authorize]
        [HttpPatch("discount-codes/{id:int}")]
        public async Task<IActionResult> PatchDiscountCode(int id, [FromBody] PatchDiscountCodeRequest req)
        {
            if (!await IsOwnerAsync()) return Forbid();

            try
            {
                var ok = await _service.ToggleDiscountCodeAsync(id, req.Active);
                if (!ok) return NotFound(new { error = "Código no encontrado" });

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error toggling discount code {Id}", id);
                return StatusCode(500, new { error = "Error al actualizar el código" });
            }
        }

        [Authorize]
        [HttpDelete("discount-codes/{id:int}")]
        public async Task<IActionResult> DeleteDiscountCode(int id)
        {
            if (!await IsOwnerAsync()) return Forbid();

            try
            {
                await _service.DeleteDiscountCodeAsync(id);
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting discount code {Id}", id);
                return StatusCode(500, new { error = "Error al eliminar el código" });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // PAYPAL PAYMENT — Sandbox (separate from Tips which uses Live)
        // ═══════════════════════════════════════════════════════════════

        /// <summary>Validates a discount code for a given tier/billing. Public endpoint.</summary>
        [AllowAnonymous]
        [HttpGet("validate-code")]
        public async Task<IActionResult> ValidateCode(
            [FromQuery] string code,
            [FromQuery] string tier,
            [FromQuery] string billing)
        {
            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(tier) || string.IsNullOrWhiteSpace(billing))
                return BadRequest(new { error = "code, tier y billing son obligatorios" });

            if (!TierPrices.TryGetValue(tier, out var prices) || !prices.TryGetValue(billing, out var baseAmount))
                return BadRequest(new { error = "Tier o tipo de cobro inválido" });

            try
            {
                var result = await _service.ValidateDiscountCodeAsync(code, tier, billing, baseAmount);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating discount code {Code}", code);
                return StatusCode(500, new { error = "Error al validar el código" });
            }
        }

        /// <summary>Creates a PayPal order for a supporter tier. Returns orderId + approvalUrl. No auth required.</summary>
        [AllowAnonymous]
        [HttpPost("create-paypal-order")]
        public async Task<IActionResult> CreatePayPalOrder([FromBody] CreateSupporterOrderRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Tier) || string.IsNullOrWhiteSpace(req.BillingType))
                return BadRequest(new { error = "Tier y billingType son obligatorios" });

            if (!TierPrices.TryGetValue(req.Tier, out var prices))
                return BadRequest(new { error = $"Tier inválido: {req.Tier}" });

            if (!prices.TryGetValue(req.BillingType, out var baseAmount))
                return BadRequest(new { error = $"El tier '{req.Tier}' no tiene opción '{req.BillingType}'" });

            // Apply discount code if provided
            var finalAmount = baseAmount;
            int? appliedCodeId = null;

            if (!string.IsNullOrWhiteSpace(req.DiscountCode))
            {
                var validation = await _service.ValidateDiscountCodeAsync(req.DiscountCode, req.Tier, req.BillingType, baseAmount);
                if (!validation.Valid)
                    return BadRequest(new { error = validation.Error ?? "Código de descuento inválido" });

                finalAmount   = validation.DiscountedAmount;
                appliedCodeId = validation.CodeId;
            }

            try
            {
                var (clientId, clientSecret, baseUrl, returnUrl, cancelUrl) = GetPayPalConfig();
                var accessToken = await GetPayPalTokenAsync(clientId, clientSecret, baseUrl);

                // Encode tier + billing + codeId in return URL
                var codeParam     = appliedCodeId.HasValue ? $"&pp_code={appliedCodeId}" : "";
                var encodedReturn = $"{returnUrl}?pp_tier={req.Tier}&pp_billing={req.BillingType}&pp_status=return{codeParam}";
                var encodedCancel = $"{cancelUrl}?pp_status=cancel";

                // custom_id encodes tier|billingType|codeId (codeId=0 means no code)
                var customId = $"{req.Tier}|{req.BillingType}|{appliedCodeId ?? 0}";

                var orderPayload = new
                {
                    intent = "CAPTURE",
                    purchase_units = new[]
                    {
                        new
                        {
                            reference_id = $"{req.Tier}_{req.BillingType}",
                            custom_id    = customId,
                            description  = $"Decatron {req.Tier} — {(req.BillingType == "permanent" ? "Permanente" : "1 mes")}",
                            amount = new
                            {
                                currency_code = "USD",
                                value         = finalAmount.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
                            },
                        }
                    },
                    application_context = new
                    {
                        brand_name = "Decatron",
                        landing_page = "BILLING",
                        user_action  = "PAY_NOW",
                        return_url   = encodedReturn,
                        cancel_url   = encodedCancel,
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
                var orderId     = doc.RootElement.GetProperty("id").GetString();
                var approvalUrl = "";

                foreach (var link in doc.RootElement.GetProperty("links").EnumerateArray())
                {
                    if (link.GetProperty("rel").GetString() == "approve")
                    {
                        approvalUrl = link.GetProperty("href").GetString() ?? "";
                        break;
                    }
                }

                return Ok(new { orderId, approvalUrl, discountApplied = appliedCodeId.HasValue, finalAmount });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating PayPal order for tier {Tier}", req.Tier);
                return StatusCode(500, new { error = "Error interno al procesar el pago" });
            }
        }

        /// <summary>
        /// Captures an approved PayPal order.
        /// Auth is optional: if a JWT is present the tier is auto-assigned; otherwise the payment
        /// is still captured but no tier is assigned (caller should tell the user to log in).
        /// </summary>
        [Authorize]
        [HttpPost("capture-paypal-order")]
        public async Task<IActionResult> CapturePayPalOrder([FromBody] CaptureSupporterOrderRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.OrderId))
                return BadRequest(new { error = "orderId es obligatorio" });

            try
            {
                var (clientId, clientSecret, baseUrl, _, _) = GetPayPalConfig();
                var accessToken = await GetPayPalTokenAsync(clientId, clientSecret, baseUrl);

                using var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", accessToken);

                // Capture the order
                var captureResp = await client.PostAsync(
                    $"{baseUrl}/v2/checkout/orders/{req.OrderId}/capture",
                    new StringContent("{}", Encoding.UTF8, "application/json"));

                var captureBody = await captureResp.Content.ReadAsStringAsync();

                if (!captureResp.IsSuccessStatusCode)
                {
                    _logger.LogError("PayPal capture failed for order {Id}: {Body}", req.OrderId, captureBody);
                    return StatusCode(502, new { error = "Error al capturar el pago en PayPal" });
                }

                using var doc = JsonDocument.Parse(captureBody);
                var status    = doc.RootElement.GetProperty("status").GetString();

                if (status != "COMPLETED")
                    return BadRequest(new { error = $"El pago no se completó (estado: {status})" });

                // Read tier|billingType|codeId from custom_id in the capture response
                var customId = doc.RootElement
                    .GetProperty("purchase_units")[0]
                    .GetProperty("payments")
                    .GetProperty("captures")[0]
                    .TryGetProperty("custom_id", out var cidEl) ? cidEl.GetString() : null;

                var parts       = customId?.Split('|');
                var tier        = parts?.Length >= 1 ? parts[0] : req.Tier;
                var billingType = parts?.Length >= 2 ? parts[1] : req.BillingType;
                var codeIdStr   = parts?.Length >= 3 ? parts[2] : null;
                int.TryParse(codeIdStr, out var codeId);

                if (string.IsNullOrEmpty(tier))
                    return BadRequest(new { error = "No se pudo determinar el tier del pago" });

                var isPermanent = billingType == "permanent";

                // Get captured amount from PayPal response
                decimal capturedAmount = 0m;
                try
                {
                    var amountStr = doc.RootElement
                        .GetProperty("purchase_units")[0]
                        .GetProperty("payments")
                        .GetProperty("captures")[0]
                        .GetProperty("amount")
                        .GetProperty("value").GetString();
                    decimal.TryParse(amountStr, System.Globalization.NumberStyles.Any,
                        System.Globalization.CultureInfo.InvariantCulture, out capturedAmount);
                }
                catch { /* non-critical */ }

                // Increment discount code usage if one was applied
                if (codeId > 0)
                {
                    try { await _service.IncrementCodeUsageAsync(codeId); }
                    catch (Exception ex) { _logger.LogWarning(ex, "Failed to increment usage for code {Id}", codeId); }
                }

                // Try to identify the user from the JWT (optional — not required for payment)
                var userLogin = User.Identity?.IsAuthenticated == true
                    ? (User.FindFirst("login")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value)
                    : null;

                // Resolve user_id for payment record
                long? resolvedUserId = await _service.ResolveUserIdAsync(userLogin);

                if (!string.IsNullOrEmpty(userLogin))
                {
                    // Use configured tier durations from page config
                    var pageConfig = await _service.GetConfigAsync();
                    int? duration; string? unit;
                    if (isPermanent)
                    {
                        duration = null; unit = null;
                    }
                    else if (pageConfig.Config.TierDurations.TryGetValue(tier!, out var tierDur))
                    {
                        duration = tierDur.Duration; unit = tierDur.Unit;
                    }
                    else
                    {
                        duration = 30; unit = "days";
                    }

                    await _service.AssignTierAsync(userLogin, tier!, isPermanent, duration, unit, source: "paypal");

                    _logger.LogInformation(
                        "Tier '{Tier}' assigned to @{Login} via PayPal order {OrderId} ({Billing}, {Duration} {Unit})",
                        tier, userLogin, req.OrderId, billingType, duration, unit);

                    // Record payment
                    await _service.RecordPaymentAsync(resolvedUserId, userLogin, capturedAmount,
                        tier, billingType, req.OrderId, codeId > 0 ? codeId : null, "tier");

                    return Ok(new
                    {
                        success      = true,
                        tierAssigned = true,
                        tier,
                        billingType,
                        isPermanent,
                        message      = $"¡Gracias! Tier '{tier}' activado{(isPermanent ? " permanentemente" : $" por {duration} {TranslateUnit(unit, duration)}")}.",
                        duration,
                        unit,
                    });
                }
                else
                {
                    // Anonymous donor — payment captured, tier pending login
                    _logger.LogInformation(
                        "Anonymous PayPal order {OrderId} captured for tier '{Tier}' ({Billing}) — no account linked",
                        req.OrderId, tier, billingType);

                    await _service.RecordPaymentAsync(null, null, capturedAmount,
                        tier, billingType, req.OrderId, codeId > 0 ? codeId : null, "tier");

                    return Ok(new
                    {
                        success      = true,
                        tierAssigned = false,
                        tier,
                        billingType,
                        isPermanent,
                        message      = "¡Gracias por tu apoyo! Para activar los beneficios del tier, inicia sesión con tu cuenta de Decatron.",
                    });
                }
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error capturing PayPal order {OrderId}", req.OrderId);
                return StatusCode(500, new { error = "Error al procesar el pago" });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // FREE DONATION — any amount, no tier
        // ═══════════════════════════════════════════════════════════════

        /// <summary>Creates a PayPal order for a free-amount donation (no tier).</summary>
        [AllowAnonymous]
        [HttpPost("create-donation-order")]
        public async Task<IActionResult> CreateDonationOrder([FromBody] CreateDonationRequest req)
        {
            if (req.Amount < 1m)
                return BadRequest(new { error = "El monto mínimo es $1" });

            if (req.Amount > 10000m)
                return BadRequest(new { error = "El monto máximo es $10,000" });

            try
            {
                var (clientId, clientSecret, baseUrl, returnUrl, cancelUrl) = GetPayPalConfig();
                var accessToken = await GetPayPalTokenAsync(clientId, clientSecret, baseUrl);

                var encodedReturn = $"{returnUrl}?pp_status=donation-return&pp_amount={req.Amount.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)}";
                var encodedCancel = $"{cancelUrl}?pp_status=cancel";

                var orderPayload = new
                {
                    intent = "CAPTURE",
                    purchase_units = new[]
                    {
                        new
                        {
                            reference_id = "donation",
                            custom_id    = $"donation|{req.Amount.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)}",
                            description  = "Donación a Decatron",
                            amount = new
                            {
                                currency_code = "USD",
                                value         = req.Amount.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
                            },
                        }
                    },
                    application_context = new
                    {
                        brand_name   = "Decatron",
                        landing_page = "BILLING",
                        user_action  = "PAY_NOW",
                        return_url   = encodedReturn,
                        cancel_url   = encodedCancel,
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
                    _logger.LogError("PayPal create donation order failed: {Body}", body);
                    return StatusCode(502, new { error = "Error al crear la donación en PayPal" });
                }

                using var doc   = JsonDocument.Parse(body);
                var orderId     = doc.RootElement.GetProperty("id").GetString();
                var approvalUrl = "";

                foreach (var link in doc.RootElement.GetProperty("links").EnumerateArray())
                {
                    if (link.GetProperty("rel").GetString() == "approve")
                    {
                        approvalUrl = link.GetProperty("href").GetString() ?? "";
                        break;
                    }
                }

                return Ok(new { orderId, approvalUrl });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating donation PayPal order");
                return StatusCode(500, new { error = "Error interno al procesar la donación" });
            }
        }

        /// <summary>Captures an approved free-donation PayPal order.</summary>
        [AllowAnonymous]
        [HttpPost("capture-donation-order")]
        public async Task<IActionResult> CaptureDonationOrder([FromBody] CaptureDonationRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.OrderId))
                return BadRequest(new { error = "orderId es obligatorio" });

            try
            {
                var (clientId, clientSecret, baseUrl, _, _) = GetPayPalConfig();
                var accessToken = await GetPayPalTokenAsync(clientId, clientSecret, baseUrl);

                using var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", accessToken);

                var captureResp = await client.PostAsync(
                    $"{baseUrl}/v2/checkout/orders/{req.OrderId}/capture",
                    new StringContent("{}", Encoding.UTF8, "application/json"));

                var captureBody = await captureResp.Content.ReadAsStringAsync();

                if (!captureResp.IsSuccessStatusCode)
                {
                    _logger.LogError("PayPal capture donation failed for {Id}: {Body}", req.OrderId, captureBody);
                    return StatusCode(502, new { error = "Error al capturar la donación en PayPal" });
                }

                using var doc = JsonDocument.Parse(captureBody);
                var status    = doc.RootElement.GetProperty("status").GetString();

                if (status != "COMPLETED")
                    return BadRequest(new { error = $"El pago no se completó (estado: {status})" });

                // Get actual captured amount
                decimal capturedAmount = req.Amount;
                try
                {
                    var amountStr = doc.RootElement
                        .GetProperty("purchase_units")[0]
                        .GetProperty("payments")
                        .GetProperty("captures")[0]
                        .GetProperty("amount")
                        .GetProperty("value").GetString();
                    decimal.TryParse(amountStr, System.Globalization.NumberStyles.Any,
                        System.Globalization.CultureInfo.InvariantCulture, out capturedAmount);
                }
                catch { /* use req.Amount as fallback */ }

                var userLogin = User.Identity?.IsAuthenticated == true
                    ? (User.FindFirst("login")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value)
                    : null;

                await _service.RecordPaymentAsync(null, userLogin, capturedAmount,
                    null, "donation", req.OrderId, null, "donation");

                _logger.LogInformation(
                    "Free donation ${Amount} captured. PayPal order {OrderId}. User: {Login}",
                    capturedAmount, req.OrderId, userLogin ?? "anonymous");

                return Ok(new
                {
                    success = true,
                    amount  = capturedAmount,
                    message = $"¡Muchas gracias por tu donación de ${capturedAmount:F2}! ❤️",
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error capturing donation order {OrderId}", req.OrderId);
                return StatusCode(500, new { error = "Error al procesar la donación" });
            }
        }

        // ── PayPal Webhook ────────────────────────────────────────────────────────

        /// <summary>Receives PayPal webhook events for the Supporters system.</summary>
        [AllowAnonymous]
        [HttpPost("paypal/webhook")]
        public async Task<IActionResult> PayPalWebhook()
        {
            try
            {
                using var reader = new System.IO.StreamReader(Request.Body);
                var body = await reader.ReadToEndAsync();

                _logger.LogInformation("[Supporters] PayPal webhook received");

                // Verify webhook signature headers
                var transmissionId = Request.Headers["PAYPAL-TRANSMISSION-ID"].FirstOrDefault();
                var transmissionSig = Request.Headers["PAYPAL-TRANSMISSION-SIG"].FirstOrDefault();
                if (string.IsNullOrEmpty(transmissionId) || string.IsNullOrEmpty(transmissionSig))
                {
                    _logger.LogWarning("[Supporters] PayPal webhook missing signature headers — rejected");
                    return Unauthorized(new { error = "Missing webhook signature" });
                }

                var data = JsonDocument.Parse(body);
                var eventType = data.RootElement.TryGetProperty("event_type", out var et) ? et.GetString() : null;

                if (eventType == "PAYMENT.CAPTURE.COMPLETED")
                {
                    _logger.LogInformation("[Supporters] Webhook confirmed payment capture completed");
                }

                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Supporters] Webhook error");
                return Ok(); // Always return 200 to acknowledge
            }
        }

        // ── Helpers ───────────────────────────────────────────────────────────────

        private static string TranslateUnit(string? unit, int? duration)
        {
            var n = duration ?? 1;
            return unit switch
            {
                "minutes" => n == 1 ? "minuto"  : "minutos",
                "hours"   => n == 1 ? "hora"    : "horas",
                "days"    => n == 1 ? "día"     : "días",
                "weeks"   => n == 1 ? "semana"  : "semanas",
                "months"  => n == 1 ? "mes"     : "meses",
                "years"   => n == 1 ? "año"     : "años",
                _         => "días",
            };
        }

        // ── PayPal helpers ────────────────────────────────────────────────────────

        private (string clientId, string clientSecret, string baseUrl, string returnUrl, string cancelUrl)
            GetPayPalConfig()
        {
            var section = _configuration.GetSection("SupportersPayPal");
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
            var returnUrl = section["ReturnUrl"] ?? "https://twitch.decatron.net/supporters";
            var cancelUrl = section["CancelUrl"] ?? "https://twitch.decatron.net/supporters";

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
    }

    // ─── Request DTOs ─────────────────────────────────────────────────────────────

    public class AssignTierRequest
    {
        public string TwitchLogin { get; set; } = string.Empty;
        public string Tier        { get; set; } = "free";
        public bool   IsPermanent { get; set; } = false;
        public int?   Duration    { get; set; }
        public string? Unit       { get; set; }
    }

    public class CreateSupporterOrderRequest
    {
        public string  Tier         { get; set; } = string.Empty;
        public string  BillingType  { get; set; } = "monthly"; // "monthly" | "permanent"
        public string? DiscountCode { get; set; }
    }

    public class CaptureSupporterOrderRequest
    {
        public string OrderId     { get; set; } = string.Empty;
        public string Tier        { get; set; } = string.Empty;
        public string BillingType { get; set; } = "monthly";
    }

    public class CreateDonationRequest
    {
        public decimal Amount { get; set; } = 5m;
    }

    public class CaptureDonationRequest
    {
        public string  OrderId { get; set; } = string.Empty;
        public decimal Amount  { get; set; }
    }
}
