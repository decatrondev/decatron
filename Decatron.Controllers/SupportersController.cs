using System;
using System.Collections.Generic;
using System.Linq;
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

        private readonly IBillingProfileService _billing;
        private readonly ISupporterInvoiceService _invoices;

        public SupportersController(
            ISupportersService service,
            DecatronDbContext db,
            ILogger<SupportersController> logger,
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory,
            IBillingProfileService billing,
            ISupporterInvoiceService invoices)
        {
            _invoices           = invoices;
            _service            = service;
            _db                 = db;
            _logger             = logger;
            _configuration      = configuration;
            _httpClientFactory  = httpClientFactory;
            _billing            = billing;
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

        /// <summary>
        /// Crea la orden de PayPal de un tier. Devuelve orderId + approvalUrl.
        ///
        /// <para>Exige sesión y perfil de facturación completo. Antes admitía compras
        /// anónimas, pero una venta que no se puede facturar no debería existir: el
        /// comprobante se emite sobre plata que ya se movió, y sin datos del comprador no
        /// hay a quién emitírselo.</para>
        /// </summary>
        [Authorize]
        [HttpPost("create-paypal-order")]
        public async Task<IActionResult> CreatePayPalOrder([FromBody] CreateSupporterOrderRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Tier) || string.IsNullOrWhiteSpace(req.BillingType))
                return BadRequest(new { error = "Tier y billingType son obligatorios" });

            var compradorPaypalId = await ResolveCurrentUserIdAsync();
            if (compradorPaypalId == null)
                return Unauthorized(new { error = "Sesión no válida" });

            if (await _billing.GetAsync(compradorPaypalId.Value) == null)
            {
                return BadRequest(new
                {
                    error = "PROFILE_REQUIRED",
                    message = "Completa tus datos de facturación antes de comprar.",
                });
            }

            var evaluacionPaypal = await EvaluarTierAsync(compradorPaypalId, req.Tier, req.BillingType);
            if (!evaluacionPaypal.Permitida)
                return BadRequest(new { error = "TIER_CONFLICT", message = evaluacionPaypal.Motivo });

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

                // El custom_id lo escribe este servidor al crear la orden, con el tier que
                // él mismo tarificó, y PayPal lo devuelve intacto. Es el único dato de
                // aquí en el que se puede confiar.
                //
                // Antes, si faltaba, se caía a `req.Tier` y `req.BillingType`, que vienen
                // del cuerpo de la petición: cualquiera podía capturar una orden de un
                // dólar declarando tier "fundador" y facturación "permanent". Un pago
                // tiene que valer lo que el servidor decidió, no lo que diga el cliente.
                var parts = customId?.Split('|');
                if (parts == null || parts.Length < 2 || string.IsNullOrWhiteSpace(parts[0]))
                {
                    _logger.LogError(
                        "Captura de {Order} sin custom_id utilizable ({Custom}). No se acredita nada.",
                        req.OrderId, customId ?? "ausente");
                    return BadRequest(new
                    {
                        error = "No se pudo verificar qué se compró. El cobro está hecho: escribe a soporte y se resuelve a mano."
                    });
                }

                var tier        = parts[0];
                var billingType = parts[1];
                var codeIdStr   = parts.Length >= 3 ? parts[2] : null;
                int.TryParse(codeIdStr, out var codeId);

                // Si lo declarado en la petición no coincide con lo que se cobró, manda el
                // custom_id — pero queda escrito, porque o es un error del panel o es un
                // intento de colarse.
                if ((!string.IsNullOrEmpty(req.Tier) && !string.Equals(req.Tier, tier, StringComparison.OrdinalIgnoreCase)) ||
                    (!string.IsNullOrEmpty(req.BillingType) && !string.Equals(req.BillingType, billingType, StringComparison.OrdinalIgnoreCase)))
                {
                    _logger.LogWarning(
                        "Captura de {Order}: la petición decía {ReqTier}/{ReqBilling} y la orden era {Tier}/{Billing}. Se usa la orden.",
                        req.OrderId, req.Tier, req.BillingType, tier, billingType);
                }

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

                var payer = ExtractPayPalPayer(doc);

                // Acá el dinero ya se movió, así que el perfil NO se exige: si falta, se
                // registra igual con lo que devolvió PayPal y el comprobante se resuelve
                // después. Perder el registro de un cobro sería mucho peor que emitir tarde.
                var compradorCapturaId = await ResolveCurrentUserIdAsync();
                var perfilCaptura = compradorCapturaId != null
                    ? await _billing.GetAsync(compradorCapturaId.Value)
                    : null;

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

                    var evalCreditoPaypal = await EvaluarTierAsync(resolvedUserId, tier!, billingType);

                    await _service.AssignTierAsync(
                        userLogin, tier!, isPermanent, duration, unit,
                        source: "paypal", sourceReference: req.OrderId,
                        amountPaid: capturedAmount, currency: "USD",
                        expiresAtOverride: evalCreditoPaypal.NuevoVencimiento);

                    _logger.LogInformation(
                        "Tier '{Tier}' assigned to @{Login} via PayPal order {OrderId} ({Billing}, {Duration} {Unit})",
                        tier, userLogin, req.OrderId, billingType, duration, unit);

                    // Record payment
                    await _service.RecordPaymentAsync(new RecordPaymentInput
                    {
                        UserId = resolvedUserId, TwitchLogin = userLogin, Amount = capturedAmount,
                        Tier = tier, BillingType = billingType, OrderId = req.OrderId,
                        DiscountCodeId = codeId > 0 ? codeId : null, PaymentType = "tier",
                        ChargedAmount = capturedAmount, ChargedCurrency = "USD", Provider = "paypal",
                        // El perfil manda; lo de PayPal solo cubre el hueco si falta.
                        CustomerEmail = perfilCaptura?.Email ?? payer.Email,
                        CustomerName = perfilCaptura?.LegalName ?? payer.Name,
                        CustomerCountry = perfilCaptura?.Country ?? payer.Country,
                        CustomerDocType = perfilCaptura?.DocType,
                        CustomerDocNumber = perfilCaptura?.DocNumber,
                        PreferFactura = perfilCaptura?.PuedeFactura == true && req.PrefiereFactura,
                        InvoiceStatus = "PENDING",
                    });

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

                    await _service.RecordPaymentAsync(new RecordPaymentInput
                    {
                        Amount = capturedAmount, Tier = tier, BillingType = billingType,
                        OrderId = req.OrderId, DiscountCodeId = codeId > 0 ? codeId : null,
                        PaymentType = "tier",
                        ChargedAmount = capturedAmount, ChargedCurrency = "USD", Provider = "paypal",
                        // El perfil manda; lo de PayPal solo cubre el hueco si falta.
                        CustomerEmail = perfilCaptura?.Email ?? payer.Email,
                        CustomerName = perfilCaptura?.LegalName ?? payer.Name,
                        CustomerCountry = perfilCaptura?.Country ?? payer.Country,
                        CustomerDocType = perfilCaptura?.DocType,
                        CustomerDocNumber = perfilCaptura?.DocNumber,
                        PreferFactura = perfilCaptura?.PuedeFactura == true && req.PrefiereFactura,
                        InvoiceStatus = "PENDING",
                    });

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

                var donorPayer = ExtractPayPalPayer(doc);

                // Sin InvoiceStatus: una donación es una liberalidad, no venta de servicio,
                // así que no lleva comprobante.
                await _service.RecordPaymentAsync(new RecordPaymentInput
                {
                    TwitchLogin = userLogin, Amount = capturedAmount,
                    BillingType = "donation", OrderId = req.OrderId, PaymentType = "donation",
                    ChargedAmount = capturedAmount, ChargedCurrency = "USD", Provider = "paypal",
                    CustomerEmail = donorPayer.Email, CustomerName = donorPayer.Name,
                    CustomerCountry = donorPayer.Country,
                });

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

        // ── Perfil de facturación ────────────────────────────────────────────────
        //
        // Los datos con los que se emite el comprobante se completan una sola vez, acá, y
        // no en medio del pago: un comprobante se emite sobre un cobro ya hecho, así que
        // si el documento está mal o falta, después ya no hay a quién preguntarle.

        [Authorize]
        [HttpGet("billing-profile")]
        public async Task<IActionResult> GetBillingProfile()
        {
            var userId = await ResolveCurrentUserIdAsync();
            if (userId == null) return Unauthorized(new { error = "Sesión no válida" });

            var perfil = await _billing.GetAsync(userId.Value);
            if (perfil == null)
                return Ok(new { complete = false, profile = (object?)null });

            return Ok(new { complete = true, profile = Publico(perfil) });
        }

        [Authorize]
        [HttpPut("billing-profile")]
        public async Task<IActionResult> SaveBillingProfile([FromBody] BillingProfileInput input)
        {
            var userId = await ResolveCurrentUserIdAsync();
            if (userId == null) return Unauthorized(new { error = "Sesión no válida" });

            var error = _billing.Validar(input);
            if (error != null) return BadRequest(new { error });

            try
            {
                var perfil = await _billing.SaveAsync(userId.Value, input);
                return Ok(new { success = true, profile = Publico(perfil) });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando el perfil de facturación del usuario {UserId}", userId);
                return StatusCode(500, new { error = "No se pudo guardar. Intenta de nuevo." });
            }
        }

        /// <summary>Trae la razón social desde SUNAT para que nadie la escriba a mano.</summary>
        [Authorize]
        [HttpGet("billing-profile/ruc/{ruc}")]
        public async Task<IActionResult> LookupRuc(string ruc)
        {
            var resultado = await _billing.LookupRucAsync(ruc);
            if (!resultado.Found)
                return NotFound(new { error = resultado.Error ?? "No se encontró el RUC" });

            return Ok(new
            {
                found = true,
                razonSocial = resultado.RazonSocial,
                direccion = resultado.Direccion,
                estado = resultado.Estado,
            });
        }

        /// <summary>
        /// Cómo va a salir el comprobante de esta compra, antes de cobrar nada.
        ///
        /// El precio se calcula del lado del servidor, igual que en el cobro: lo que venga
        /// en el cuerpo es solo qué tier y si prefiere factura.
        /// </summary>
        [Authorize]
        [HttpPost("billing-preview")]
        public async Task<IActionResult> BillingPreview([FromBody] BillingPreviewRequest req)
        {
            var userId = await ResolveCurrentUserIdAsync();
            if (userId == null) return Unauthorized(new { error = "Sesión no válida" });

            var perfil = await _billing.GetAsync(userId.Value);
            if (perfil == null)
                return BadRequest(new { error = "PROFILE_REQUIRED", message = "Completa tus datos de facturación antes de comprar." });

            if (string.IsNullOrWhiteSpace(req.Tier) || !TierPrices.TryGetValue(req.Tier, out var prices))
                return BadRequest(new { error = $"Tier inválido: {req.Tier}" });

            if (!prices.TryGetValue(req.BillingType ?? "monthly", out var baseAmountUsd))
                return BadRequest(new { error = $"El tier '{req.Tier}' no tiene opción '{req.BillingType}'" });

            var finalAmountUsd = baseAmountUsd;
            if (!string.IsNullOrWhiteSpace(req.DiscountCode))
            {
                var validation = await _service.ValidateDiscountCodeAsync(
                    req.DiscountCode, req.Tier, req.BillingType ?? "monthly", baseAmountUsd);
                if (validation.Valid) finalAmountUsd = validation.DiscountedAmount;
            }

            // Culqi cobra en soles, así que el comprobante va en soles por lo que se cobra.
            var totalPen = decimal.Round(finalAmountUsd * PEN_PER_USD, 2);
            var preview = _billing.Preview(perfil, totalPen, "PEN", req.PrefiereFactura);

            // Qué le hace esta compra al tier que ya tiene. Se le dice antes de pagar: si la
            // compra está bloqueada, el modal lo muestra en vez de dejarlo llegar al cobro.
            var evaluacion = await EvaluarTierAsync(userId, req.Tier, req.BillingType);

            return Ok(new
            {
                success = true,
                preview,
                priceUsd = finalAmountUsd,
                tierChange = new
                {
                    allowed      = evaluacion.Permitida,
                    action       = evaluacion.Accion.ToString().ToLowerInvariant(),
                    reason       = evaluacion.Motivo,
                    currentTier  = evaluacion.Actual?.Tier,
                    currentExpiresAt = evaluacion.Actual?.ExpiresAt,
                    currentIsPermanent = evaluacion.Actual?.EsPermanente ?? false,
                    newExpiresAt = evaluacion.NuevoVencimiento,
                },
            });
        }

        /// <summary>Lo que se le puede devolver al navegador del perfil.</summary>
        private static object Publico(Decatron.Core.Models.BillingProfile p) => new
        {
            country = p.Country,
            docType = p.DocType,
            docNumber = p.DocNumber,
            legalName = p.LegalName,
            address = p.Address,
            email = p.Email,
            nameFromSunat = p.NameSource == "sunat",
            canChooseFactura = p.PuedeFactura,
            isForeign = p.EsExtranjero,
        };

        /// <summary>
        /// Qué le haría al tier vigente comprar <paramref name="tier"/>. La duración sale de
        /// la config de la página, igual que al acreditarlo, para que la fecha que se le
        /// promete al comprador en la vista previa sea la que después se guarda.
        /// </summary>
        private async Task<EvaluacionCompra> EvaluarTierAsync(long? userId, string tier, string? billingType)
        {
            var isPermanent = billingType == "permanent";
            var (duration, unit) = await DuracionDelTierAsync(tier, isPermanent);
            return await _service.EvaluarCompraAsync(userId, tier, isPermanent, duration, unit);
        }

        /// <summary>Duración configurada de un tier. 30 días si no hay nada dicho.</summary>
        private async Task<(int? Duration, string? Unit)> DuracionDelTierAsync(string tier, bool isPermanent)
        {
            if (isPermanent) return (null, null);

            var pageConfig = await _service.GetConfigAsync();
            return pageConfig.Config.TierDurations.TryGetValue(tier, out var d)
                ? (d.Duration, d.Unit)
                : (30, "days");
        }

        /// <summary>El id interno del usuario de la sesión, o null si no se pudo resolver.</summary>
        private async Task<long?> ResolveCurrentUserIdAsync()
        {
            var login = User.FindFirst("login")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrWhiteSpace(login)) return null;
            return await _service.ResolveUserIdAsync(login);
        }

        // ═══════════════════════════════════════════════════════════════
        // COMPROBANTES
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// Los comprobantes de quien está en sesión. Solo compras de tier: las donaciones
        /// no llevan comprobante y no tienen nada que mostrar acá.
        /// </summary>
        [Authorize]
        [HttpGet("my-invoices")]
        public async Task<IActionResult> GetMyInvoices()
        {
            var userId = await ResolveCurrentUserIdAsync();
            if (userId == null) return Unauthorized();

            var pagos = await _db.SupporterPayments
                .Where(p => p.UserId == userId && p.PaymentType == "tier")
                .OrderByDescending(p => p.CapturedAt)
                .Take(100)
                .ToListAsync();

            return Ok(pagos.Select(p => new
            {
                paymentId  = p.Id,
                tier       = p.Tier,
                billingType = p.BillingType,
                capturedAt = p.CapturedAt,
                amount     = p.ChargedAmount ?? p.Amount,
                currency   = p.ChargedCurrency ?? p.Currency,
                status     = p.InvoiceStatus,
                type       = p.InvoiceType,
                // El número del comprobante ya formateado: es como aparece en el papel y
                // como SUNAT lo pide en su consulta pública.
                number     = p.InvoiceSeries == null || p.InvoiceNumber == null
                    ? null
                    : $"{p.InvoiceSeries}-{p.InvoiceNumber.Value:D8}",
                customerName   = p.CustomerName,
                customerDoc    = p.CustomerDocNumber,
                // Solo hay archivos cuando el documento existe del lado de DecatronAPI.
                canDownload    = p.InvoiceDocumentId != null,
            }));
        }

        /// <summary>
        /// Descarga un archivo del comprobante propio. <c>formato</c> es pdf, xml o cdr.
        /// </summary>
        [Authorize]
        [HttpGet("my-invoices/{paymentId:int}/download/{formato}")]
        public async Task<IActionResult> DownloadMyInvoice(int paymentId, string formato)
        {
            var userId = await ResolveCurrentUserIdAsync();
            if (userId == null) return Unauthorized();

            // La condición de dueño va en el WHERE a propósito: pedir el pago y después
            // comparar deja la puerta abierta a devolver el comprobante de otro.
            var pago = await _db.SupporterPayments
                .FirstOrDefaultAsync(p => p.Id == paymentId && p.UserId == userId);

            if (pago?.InvoiceDocumentId == null)
                return NotFound(new { message = "Este pago todavía no tiene comprobante" });

            return await DevolverArchivoAsync(pago.InvoiceDocumentId.Value, formato);
        }

        // ── Vista del dueño ───────────────────────────────────────────────────────

        /// <summary>
        /// Todos los comprobantes, con su estado. Es la única forma de enterarse de que uno
        /// quedó en ERROR: el job lo reintenta 5 veces y después se queda callado.
        /// </summary>
        [Authorize]
        [HttpGet("admin/invoices")]
        public async Task<IActionResult> GetAdminInvoices(
            [FromQuery] string? status = null,
            [FromQuery] string? q = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 25)
        {
            if (!await IsOwnerAsync()) return Forbid();

            if (page < 1) page = 1;
            pageSize = Math.Clamp(pageSize, 1, 100);

            var baseQuery = _db.SupporterPayments.Where(p => p.PaymentType == "tier");

            // Los contadores salen sin filtrar por estado: son el semáforo de la pantalla y
            // tienen que seguir diciendo la verdad aunque estés mirando solo los ERROR.
            var resumen = await baseQuery
                .GroupBy(p => p.InvoiceStatus)
                .Select(g => new { Estado = g.Key, Total = g.Count() })
                .ToListAsync();

            var query = baseQuery;

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(p => p.InvoiceStatus == status);

            if (!string.IsNullOrWhiteSpace(q))
            {
                var termino = $"%{q.Trim()}%";
                query = query.Where(p =>
                    EF.Functions.ILike(p.TwitchLogin ?? "", termino) ||
                    EF.Functions.ILike(p.CustomerName ?? "", termino) ||
                    EF.Functions.ILike(p.CustomerDocNumber ?? "", termino) ||
                    EF.Functions.ILike(p.InvoiceSeries ?? "", termino) ||
                    EF.Functions.ILike(p.PaypalOrderId ?? "", termino));
            }

            var total = await query.CountAsync();

            var pagos = await query
                .OrderByDescending(p => p.CapturedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new
            {
                total,
                page,
                pageSize,
                counts = new
                {
                    accepted = resumen.FirstOrDefault(r => r.Estado == "ACCEPTED")?.Total ?? 0,
                    pending  = resumen.FirstOrDefault(r => r.Estado == "PENDING")?.Total ?? 0,
                    rejected = resumen.FirstOrDefault(r => r.Estado == "REJECTED")?.Total ?? 0,
                    error    = resumen.FirstOrDefault(r => r.Estado == "ERROR")?.Total ?? 0,
                    none     = resumen.FirstOrDefault(r => r.Estado == null)?.Total ?? 0,
                },
                items = pagos.Select(p => new
                {
                    paymentId   = p.Id,
                    twitchLogin = p.TwitchLogin,
                    tier        = p.Tier,
                    billingType = p.BillingType,
                    capturedAt  = p.CapturedAt,
                    provider    = p.Provider,
                    orderId     = p.PaypalOrderId,
                    amount      = p.ChargedAmount ?? p.Amount,
                    currency    = p.ChargedCurrency ?? p.Currency,
                    customerName    = p.CustomerName,
                    customerDocType = p.CustomerDocType,
                    customerDoc     = p.CustomerDocNumber,
                    customerCountry = p.CustomerCountry,
                    status      = p.InvoiceStatus,
                    type        = p.InvoiceType,
                    number      = p.InvoiceSeries == null || p.InvoiceNumber == null
                        ? null
                        : $"{p.InvoiceSeries}-{p.InvoiceNumber.Value:D8}",
                    documentId  = p.InvoiceDocumentId,
                    error       = p.InvoiceError,
                    attempts    = p.InvoiceAttempts,
                    lastAttempt = p.InvoiceLastAttemptAt,
                    canDownload = p.InvoiceDocumentId != null,
                })
            });
        }

        /// <summary>Descarga cualquier comprobante. Solo el dueño.</summary>
        [Authorize]
        [HttpGet("admin/invoices/{paymentId:int}/download/{formato}")]
        public async Task<IActionResult> DownloadAdminInvoice(int paymentId, string formato)
        {
            if (!await IsOwnerAsync()) return Forbid();

            var pago = await _db.SupporterPayments.FirstOrDefaultAsync(p => p.Id == paymentId);
            if (pago?.InvoiceDocumentId == null)
                return NotFound(new { message = "Este pago no tiene comprobante" });

            return await DevolverArchivoAsync(pago.InvoiceDocumentId.Value, formato);
        }

        /// <summary>
        /// Reintenta el comprobante de un pago. Si ya se emitió no vuelve a emitir: solo
        /// consulta en qué quedó, porque un segundo comprobante por la misma venta se
        /// arregla con una nota de crédito y no con un botón.
        /// </summary>
        [Authorize]
        [HttpPost("admin/invoices/{paymentId:int}/retry")]
        public async Task<IActionResult> RetryInvoice(int paymentId)
        {
            if (!await IsOwnerAsync()) return Forbid();

            var ok = await _invoices.ReintentarAsync(paymentId, HttpContext.RequestAborted);

            var pago = await _db.SupporterPayments.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == paymentId);

            return Ok(new
            {
                accepted = ok,
                status   = pago?.InvoiceStatus,
                error    = pago?.InvoiceError,
                number   = pago?.InvoiceSeries == null || pago.InvoiceNumber == null
                    ? null
                    : $"{pago.InvoiceSeries}-{pago.InvoiceNumber.Value:D8}",
            });
        }

        // ── Emisor ────────────────────────────────────────────────────────────────

        /// <summary>
        /// Con qué empresa se está facturando y si eso es real o es beta. Es el dato más
        /// importante de toda la pantalla: en beta nada de lo emitido existe para SUNAT.
        /// </summary>
        [Authorize]
        [HttpGet("admin/invoicing-status")]
        public async Task<IActionResult> GetInvoicingStatus()
        {
            if (!await IsOwnerAsync()) return Forbid();

            var estado = await _invoices.ObtenerEstadoAsync(HttpContext.RequestAborted);

            return Ok(new
            {
                configured = estado.Configurado,
                companyId  = estado.CompanyId,
                error      = estado.Error,
                active     = estado.Activa == null ? null : Empresa(estado.Activa),
                companies  = estado.Disponibles.Select(Empresa),
            });
        }

        /// <summary>Elige con qué empresa emitir. El modo beta/producción es de la empresa.</summary>
        [Authorize]
        [HttpPut("admin/invoicing-company")]
        public async Task<IActionResult> SetInvoicingCompany([FromBody] SetInvoicingCompanyRequest req)
        {
            if (!await IsOwnerAsync()) return Forbid();

            var quien = User.FindFirst("login")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value;
            var (ok, error) = await _invoices.CambiarEmpresaAsync(req.CompanyId, quien, HttpContext.RequestAborted);

            if (!ok) return BadRequest(new { message = error });

            return Ok(new { message = "Empresa emisora actualizada" });
        }

        private static object Empresa(EmpresaEmisora e) => new
        {
            id           = e.Id,
            ruc          = e.Ruc,
            razonSocial  = e.RazonSocial,
            alias        = e.Alias,
            isBeta       = e.EsBeta,
            boletaSeries = e.SerieBoleta,
            facturaSeries = e.SerieFactura,
            // Sin una de las dos cosas la empresa no puede firmar ni enviar nada a SUNAT.
            hasCert          = e.TieneCertificado,
            hasSolCredentials = e.TieneClaveSol,
            ready            = e.TieneCertificado && e.TieneClaveSol,
        };

        public class SetInvoicingCompanyRequest
        {
            public int CompanyId { get; set; }
        }

        private async Task<IActionResult> DevolverArchivoAsync(int documentId, string formato)
        {
            var archivo = await _invoices.DescargarAsync(documentId, formato, HttpContext.RequestAborted);

            if (archivo == null)
                return NotFound(new { message = "El archivo no está disponible" });

            return File(archivo.Contenido, archivo.ContentType, archivo.NombreArchivo);
        }

        // ── Culqi endpoints ─────────────────────────────────────────────────────

        private const decimal PEN_PER_USD = 3.80m; // Fixed conversion rate for Culqi (PEN)

        [HttpGet("culqi-public-key")]
        public IActionResult GetCulqiPublicKey()
        {
            var pk = _configuration["CulqiSettings:PublicKey"] ?? "";
            return Ok(new { publicKey = pk });
        }

        [Authorize]
        [HttpPost("create-culqi-charge")]
        public async Task<IActionResult> CreateCulqiCharge([FromBody] CulqiChargeRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.CulqiToken) || string.IsNullOrWhiteSpace(req.CulqiEmail))
                return BadRequest(new { error = "Token y email de Culqi son requeridos" });

            if (string.IsNullOrWhiteSpace(req.Tier) || string.IsNullOrWhiteSpace(req.BillingType))
                return BadRequest(new { error = "Tier y billingType son obligatorios" });

            if (!TierPrices.TryGetValue(req.Tier, out var prices))
                return BadRequest(new { error = $"Tier inválido: {req.Tier}" });

            if (!prices.TryGetValue(req.BillingType, out var baseAmountUsd))
                return BadRequest(new { error = $"El tier '{req.Tier}' no tiene opción '{req.BillingType}'" });

            // El perfil de facturación se exige ANTES de cobrar. Después del cargo ya no se
            // puede pedir nada: el comprobante se emite sobre plata que ya se movió, y si
            // faltan los datos la única salida es una nota de crédito.
            var compradorId = await ResolveCurrentUserIdAsync();
            if (compradorId == null)
                return Unauthorized(new { error = "Sesión no válida" });

            var perfil = await _billing.GetAsync(compradorId.Value);
            if (perfil == null)
            {
                return BadRequest(new
                {
                    error = "PROFILE_REQUIRED",
                    message = "Completa tus datos de facturación antes de comprar.",
                });
            }

            // Y acá se mira qué le haría esta compra al tier que ya tiene. Va antes del cargo
            // a propósito: cobrar y recién después descubrir que lo dejamos peor que antes se
            // arregla con una devolución y una nota de crédito, o sea no se arregla.
            var evaluacion = await EvaluarTierAsync(compradorId, req.Tier, req.BillingType);
            if (!evaluacion.Permitida)
                return BadRequest(new { error = "TIER_CONFLICT", message = evaluacion.Motivo });

            // Apply discount code if provided
            var finalAmountUsd = baseAmountUsd;
            int? appliedCodeId = null;

            if (!string.IsNullOrWhiteSpace(req.DiscountCode))
            {
                var validation = await _service.ValidateDiscountCodeAsync(req.DiscountCode, req.Tier, req.BillingType, baseAmountUsd);
                if (!validation.Valid)
                    return BadRequest(new { error = validation.Error ?? "Código de descuento inválido" });

                finalAmountUsd = validation.DiscountedAmount;
                appliedCodeId  = validation.CodeId;
            }

            // Convert USD to PEN for Culqi (amount in centavos)
            var amountPen = finalAmountUsd * PEN_PER_USD;
            var amountCentavos = (int)Math.Round(amountPen * 100);

            try
            {
                var secretKey = _configuration["CulqiSettings:SecretKey"] ?? "";
                var description = $"Decatron {req.Tier} — {(req.BillingType == "permanent" ? "Permanente" : "1 mes")}";

                using var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", secretKey);

                var orderNumber = $"DEC-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..8].ToUpper()}";
                var chargePayload = new
                {
                    amount        = amountCentavos,
                    currency_code = "PEN",
                    email         = req.CulqiEmail,
                    source_id     = req.CulqiToken,
                    description,
                    order_number  = orderNumber,
                    antifraud_details = new
                    {
                        first_name = string.IsNullOrWhiteSpace(req.FirstName) ? "Cliente" : req.FirstName,
                        last_name  = string.IsNullOrWhiteSpace(req.LastName)  ? "Decatron" : req.LastName,
                    },
                    metadata = new Dictionary<string, string>
                    {
                        ["tier"]         = req.Tier,
                        ["billing_type"] = req.BillingType,
                        ["platform"]     = "decatron",
                    },
                };

                var json = JsonSerializer.Serialize(chargePayload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await client.PostAsync("https://api.culqi.com/v2/charges", content);
                var body = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Culqi charge failed: {Body}", body);
                    // Try to extract user-friendly message
                    try
                    {
                        using var errDoc = JsonDocument.Parse(body);
                        var userMsg = errDoc.RootElement.TryGetProperty("user_message", out var um) ? um.GetString()
                            : errDoc.RootElement.TryGetProperty("merchant_message", out var mm) ? mm.GetString()
                            : "Error al procesar el pago con tarjeta";
                        return StatusCode(502, new { error = userMsg });
                    }
                    catch
                    {
                        return StatusCode(502, new { error = "Error al procesar el pago con tarjeta" });
                    }
                }

                using var chargeDoc = JsonDocument.Parse(body);

                // Un 2xx sin `id` no deberia pasar, pero si pasa no se puede seguir: sin id
                // de cargo no hay como registrar el pago ni como reclamarle nada a Culqi.
                //
                // Antes esto reventaba con KeyNotFoundException y el usuario veia un 500,
                // sin que quedara rastro en la base — y el cobro pudo haberse hecho igual.
                // Ahora queda escrito el cuerpo entero para poder resolverlo a mano.
                if (!chargeDoc.RootElement.TryGetProperty("id", out var chargeIdEl))
                {
                    _logger.LogError(
                        "Culqi respondio {Code} sin id de cargo para el tier {Tier}. REVISAR A MANO, el cobro puede haberse hecho. Cuerpo: {Body}",
                        (int)response.StatusCode, req.Tier, body);
                    return StatusCode(502, new
                    {
                        error = "El pago no se pudo confirmar. Si te llegó el cargo, escribe a soporte con tu comprobante y se resuelve — no vuelvas a pagar.",
                    });
                }

                var chargeId = chargeIdEl.GetString() ?? "";

                // Increment discount code usage
                if (appliedCodeId.HasValue && appliedCodeId > 0)
                {
                    try { await _service.IncrementCodeUsageAsync(appliedCodeId.Value); }
                    catch (Exception ex) { _logger.LogWarning(ex, "Failed to increment usage for code {Id}", appliedCodeId); }
                }

                // Identify user from JWT
                var userLogin = User.FindFirst("login")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value;
                long? resolvedUserId = await _service.ResolveUserIdAsync(userLogin);

                var isPermanent = req.BillingType == "permanent";

                if (!string.IsNullOrEmpty(userLogin))
                {
                    var pageConfig = await _service.GetConfigAsync();
                    int? duration; string? unit;
                    if (isPermanent)
                    {
                        duration = null; unit = null;
                    }
                    else if (pageConfig.Config.TierDurations.TryGetValue(req.Tier, out var tierDur))
                    {
                        duration = tierDur.Duration; unit = tierDur.Unit;
                    }
                    else
                    {
                        duration = 30; unit = "days";
                    }

                    // Se reevalúa acá y no se reusa la evaluación previa al cargo: entre una
                    // cosa y otra el tier pudo cambiar. Lo que importa es el vencimiento, que
                    // suma sobre lo que ya tenía en vez de reiniciar desde hoy.
                    var evalCredito = await EvaluarTierAsync(resolvedUserId, req.Tier, req.BillingType);

                    await _service.AssignTierAsync(
                        userLogin, req.Tier, isPermanent, duration, unit,
                        source: "culqi", sourceReference: chargeId,
                        // Lo cobrado, no el precio de lista: Culqi cobra en soles.
                        amountPaid: amountCentavos / 100m, currency: "PEN",
                        expiresAtOverride: evalCredito.NuevoVencimiento);

                    _logger.LogInformation(
                        "Tier '{Tier}' assigned to @{Login} via Culqi charge {ChargeId} ({Billing})",
                        req.Tier, userLogin, chargeId, req.BillingType);

                    await _service.RecordPaymentAsync(new RecordPaymentInput
                    {
                        UserId = resolvedUserId, TwitchLogin = userLogin, Amount = finalAmountUsd,
                        Tier = req.Tier, BillingType = req.BillingType, OrderId = chargeId,
                        DiscountCodeId = appliedCodeId, PaymentType = "tier",
                        ChargedAmount = amountCentavos / 100m, ChargedCurrency = "PEN", Provider = "culqi",
                        // Los datos se COPIAN del perfil, no se referencian: el comprobante
                        // tiene que seguir diciendo lo que decía el día que se emitió,
                        // aunque el usuario cambie su RUC el mes que viene.
                        CustomerEmail = perfil.Email ?? req.CulqiEmail,
                        CustomerName = perfil.LegalName,
                        CustomerCountry = perfil.Country,
                        CustomerDocType = perfil.DocType, CustomerDocNumber = perfil.DocNumber,
                        PreferFactura = perfil.PuedeFactura && req.PrefiereFactura,
                        InvoiceStatus = "PENDING",
                    });

                    return Ok(new
                    {
                        success = true,
                        tierAssigned = true,
                        tier = req.Tier,
                        billingType = req.BillingType,
                        isPermanent,
                        message = $"¡Gracias! Tier '{req.Tier}' activado{(isPermanent ? " permanentemente" : $" por {duration} {TranslateUnit(unit, duration)}")}.",
                        duration,
                        unit,
                    });
                }
                else
                {
                    await _service.RecordPaymentAsync(new RecordPaymentInput
                    {
                        Amount = finalAmountUsd, Tier = req.Tier, BillingType = req.BillingType,
                        OrderId = chargeId, DiscountCodeId = appliedCodeId, PaymentType = "tier",
                        ChargedAmount = amountCentavos / 100m, ChargedCurrency = "PEN", Provider = "culqi",
                        CustomerEmail = perfil.Email ?? req.CulqiEmail,
                        CustomerName = perfil.LegalName,
                        CustomerCountry = perfil.Country,
                        CustomerDocType = perfil.DocType, CustomerDocNumber = perfil.DocNumber,
                        PreferFactura = perfil.PuedeFactura && req.PrefiereFactura,
                        InvoiceStatus = "PENDING",
                    });

                    return Ok(new
                    {
                        success = true,
                        tierAssigned = false,
                        message = "Pago recibido. Iniciá sesión para activar tu tier.",
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing Culqi charge for tier {Tier}", req.Tier);
                return StatusCode(500, new { error = "Error interno al procesar el pago" });
            }
        }

        /// <summary>Creates a Culqi charge for a free-amount donation (no tier).</summary>
        [AllowAnonymous]
        [HttpPost("create-culqi-donation")]
        public async Task<IActionResult> CreateCulqiDonation([FromBody] CulqiDonationRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.CulqiToken) || string.IsNullOrWhiteSpace(req.CulqiEmail))
                return BadRequest(new { error = "Token y email de Culqi son requeridos" });

            if (req.AmountUsd < 1m)
                return BadRequest(new { error = "El monto mínimo es $1" });

            var amountCentavos = (int)Math.Round(req.AmountUsd * PEN_PER_USD * 100);

            try
            {
                var secretKey = _configuration["CulqiSettings:SecretKey"] ?? "";

                using var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", secretKey);

                var donationOrderNumber = $"DON-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..8].ToUpper()}";
                var chargePayload = new
                {
                    amount        = amountCentavos,
                    currency_code = "PEN",
                    email         = req.CulqiEmail,
                    source_id     = req.CulqiToken,
                    description   = $"Donación Decatron ${req.AmountUsd:F2} USD",
                    order_number  = donationOrderNumber,
                    antifraud_details = new
                    {
                        first_name = string.IsNullOrWhiteSpace(req.FirstName) ? "Donante" : req.FirstName,
                        last_name  = string.IsNullOrWhiteSpace(req.LastName)  ? "Decatron" : req.LastName,
                    },
                    metadata = new Dictionary<string, string>
                    {
                        ["type"]       = "donation",
                        ["amount_usd"] = req.AmountUsd.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
                        ["platform"]   = "decatron",
                    },
                };

                var json    = JsonSerializer.Serialize(chargePayload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await client.PostAsync("https://api.culqi.com/v2/charges", content);
                var body     = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Culqi donation charge failed: {Body}", body);
                    try
                    {
                        using var errDoc = JsonDocument.Parse(body);
                        var userMsg = errDoc.RootElement.TryGetProperty("user_message", out var um) ? um.GetString()
                            : errDoc.RootElement.TryGetProperty("merchant_message", out var mm) ? mm.GetString()
                            : "Error al procesar el pago con tarjeta";
                        return StatusCode(502, new { error = userMsg });
                    }
                    catch { return StatusCode(502, new { error = "Error al procesar el pago con tarjeta" }); }
                }

                using var chargeDoc = JsonDocument.Parse(body);
                // Mismo caso que en el cargo de tier: sin id no hay como registrar nada.
                if (!chargeDoc.RootElement.TryGetProperty("id", out var donationIdEl))
                {
                    _logger.LogError(
                        "Culqi respondio {Code} sin id de cargo en una donacion. REVISAR A MANO. Cuerpo: {Body}",
                        (int)response.StatusCode, body);
                    return StatusCode(502, new
                    {
                        error = "El pago no se pudo confirmar. Si te llegó el cargo, escribe a soporte y se resuelve — no vuelvas a pagar.",
                    });
                }

                var chargeId = donationIdEl.GetString() ?? "";

                var userLogin = User.Identity?.IsAuthenticated == true
                    ? (User.FindFirst("login")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value)
                    : null;
                long? resolvedUserId = userLogin != null ? await _service.ResolveUserIdAsync(userLogin) : null;

                // Sin InvoiceStatus: donación, no venta de servicio.
                await _service.RecordPaymentAsync(new RecordPaymentInput
                {
                    UserId = resolvedUserId, TwitchLogin = userLogin, Amount = req.AmountUsd,
                    BillingType = "donation", OrderId = chargeId, PaymentType = "donation",
                    ChargedAmount = amountCentavos / 100m, ChargedCurrency = "PEN", Provider = "culqi",
                    CustomerEmail = req.CulqiEmail,
                    CustomerName = $"{req.FirstName} {req.LastName}".Trim(),
                });

                _logger.LogInformation(
                    "Free Culqi donation ${Amount} charged {ChargeId}. User: {Login}",
                    req.AmountUsd, chargeId, userLogin ?? "anonymous");

                return Ok(new
                {
                    success = true,
                    amount  = req.AmountUsd,
                    message = $"¡Muchas gracias por tu donación de ${req.AmountUsd:F2}! ❤️",
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing Culqi donation");
                return StatusCode(500, new { error = "Error interno al procesar el pago" });
            }
        }

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

        /// <summary>
        /// Saca del cuerpo de una captura de PayPal lo que se sabe del comprador.
        ///
        /// PayPal no pide documento de identidad, así que de acá nunca sale un RUC ni un
        /// DNI: solo nombre, correo y país. El país es lo que decide si la venta es
        /// interna o exportación de servicios, y es el único de los tres que importa
        /// para el comprobante.
        /// </summary>
        private static (string? Email, string? Name, string? Country) ExtractPayPalPayer(JsonDocument doc)
        {
            try
            {
                if (!doc.RootElement.TryGetProperty("payer", out var payer))
                    return (null, null, null);

                string? email = payer.TryGetProperty("email_address", out var e) ? e.GetString() : null;

                string? name = null;
                if (payer.TryGetProperty("name", out var n))
                {
                    var given   = n.TryGetProperty("given_name", out var g) ? g.GetString() : null;
                    var surname = n.TryGetProperty("surname",    out var s) ? s.GetString() : null;
                    name = $"{given} {surname}".Trim();
                    if (name.Length == 0) name = null;
                }

                string? country = payer.TryGetProperty("address", out var addr)
                    && addr.TryGetProperty("country_code", out var c)
                        ? c.GetString()
                        : null;

                return (email, name, country);
            }
            catch
            {
                // Que falte el comprador no puede tumbar un cobro ya hecho.
                return (null, null, null);
            }
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

    public class BillingPreviewRequest
    {
        public string  Tier            { get; set; } = string.Empty;
        public string? BillingType     { get; set; } = "monthly";
        public string? DiscountCode    { get; set; }
        /// <summary>Solo lo mira quien tiene RUC: sin RUC siempre va boleta.</summary>
        public bool    PrefiereFactura { get; set; }
    }

    public class CulqiChargeRequest
    {
        public string  CulqiToken   { get; set; } = string.Empty;
        public string  CulqiEmail   { get; set; } = string.Empty;
        public string  Tier         { get; set; } = string.Empty;
        public string  BillingType  { get; set; } = "monthly";
        public string? DiscountCode { get; set; }
        public string? FirstName    { get; set; }
        public string? LastName     { get; set; }

        // Los datos del comprobante ya no vienen de acá: salen del perfil de facturación
        // del comprador, que se completa una vez y no se puede falsear desde el navegador.
        // Lo único que se decide por compra es si quiere factura, y solo aplica con RUC.
        public bool PrefiereFactura { get; set; }
    }

    public class CulqiDonationRequest
    {
        public string  CulqiToken { get; set; } = string.Empty;
        public string  CulqiEmail { get; set; } = string.Empty;
        public decimal AmountUsd  { get; set; }
        public string? FirstName  { get; set; }
        public string? LastName   { get; set; }
    }

    public class CreateSupporterOrderRequest
    {
        public string  Tier         { get; set; } = string.Empty;
        public string  BillingType  { get; set; } = "monthly"; // "monthly" | "permanent"
        public string? DiscountCode { get; set; }
    }

    public class CaptureSupporterOrderRequest
    {
        /// <summary>Solo aplica con RUC: sin RUC siempre sale boleta.</summary>
        public bool   PrefiereFactura { get; set; }
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
