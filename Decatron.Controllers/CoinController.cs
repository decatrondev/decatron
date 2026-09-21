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
        private readonly IBillingProfileService _billing;
        private readonly ICoinInvoiceService _invoices;
        private readonly ISupporterInvoiceService _invoiceFiles;
        private readonly IPaymentModeService _paymentMode;

        public CoinController(
            CoinService coinService,
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory,
            ILogger<CoinController> logger,
            DecatronDbContext db,
            IBillingProfileService billing,
            ICoinInvoiceService invoices,
            ISupporterInvoiceService invoiceFiles,
            IPaymentModeService paymentMode)
        {
            _coinService       = coinService;
            _configuration     = configuration;
            _httpClientFactory = httpClientFactory;
            _logger            = logger;
            _db                = db;
            _billing           = billing;
            _invoices          = invoices;
            // Bajar el PDF/XML de un comprobante solo depende del id de documento, no de
            // qué se vendió: se reusa el de supporters en vez de duplicar el cliente HTTP.
            _invoiceFiles      = invoiceFiles;
            _paymentMode       = paymentMode;
        }

        // ─── GET /api/coins/packages ─────────────────────────────────────────────

        [HttpGet("packages")]
        public async Task<IActionResult> GetPackages()
        {
            var userId = await GetAccountOwnerIdAsync();
            var packages = await _coinService.GetAvailablePackagesAsync(userId);
            return Ok(packages);
        }

        // ─── GET /api/coins/balance ──────────────────────────────────────────────

        [HttpGet("balance")]
        public async Task<IActionResult> GetBalance()
        {
            var userId   = await GetAccountOwnerIdAsync();
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
            var userId = await GetAccountOwnerIdAsync();
            var history = await _coinService.GetHistoryAsync(userId, page);
            return Ok(history);
        }

        // ─── POST /api/coins/validate-code ─────────────────────────────────────

        [HttpPost("validate-code")]
        public async Task<IActionResult> ValidateCode([FromBody] CoinValidateCodeRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Code))
                return BadRequest(new { error = "Codigo es obligatorio" });

            var userId = await GetAccountOwnerIdAsync();

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

        private const decimal PEN_PER_USD = 3.80m; // mismo tipo de cambio fijo que ya usa Culqi en Supporters

        [HttpGet("culqi-public-key")]
        [AllowAnonymous]
        public async Task<IActionResult> GetCulqiPublicKey()
        {
            // La publica tiene que salir del MISMO modo con el que se va a cobrar: si el
            // navegador tokeniza con la de live y el backend cobra con la secreta de test,
            // Culqi rechaza el cargo con un error que no dice nada.
            var (publicKey, _, esTest) = await _paymentMode.GetLlavesAsync(HttpContext.RequestAborted);
            return Ok(new { publicKey, testMode = esTest });
        }

        // Culqi cobra en un solo paso (token del frontend + cargo directo), no hay
        // "crear orden" + "capturar" como PayPal — por eso este es el único endpoint
        // de compra, no hace falta un /capture aparte.
        [HttpPost("buy")]
        public async Task<IActionResult> Buy([FromBody] CoinBuyRequest req)
        {
            var userId = await GetAccountOwnerIdAsync();

            // 1. Handle custom coins purchase
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

            var isCustom = req.CustomCoins.HasValue && req.CustomCoins.Value > 0;

            // 2. Validate discount code if provided
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

            // 3. If price is 0 (free with coupon): skip Culqi, credit directly
            if (finalPrice <= 0m)
            {
                var freePending = await _coinService.CreatePendingOrderAsync(userId, isCustom ? null : package.Id, discountCodeId, 0m, req.CustomCoins);
                var freePurchase = await _coinService.CompletePurchaseAsync(userId, freePending.Id, "FREE", "COMPLETED");

                if (discountCodeId.HasValue && discountValidation != null)
                {
                    await _coinService.ApplyDiscountCodeAsync(discountCodeId.Value, userId, freePurchase.Id, package.PriceUsd);

                    if (discountValidation.DiscountType == "bonus_coins" && discountValidation.BonusCoins > 0)
                    {
                        freePurchase.BonusCoinsFromCoupon = discountValidation.BonusCoins;
                        freePurchase.BonusCouponScheduledAt = DateTime.UtcNow;
                        await _db.SaveChangesAsync();
                    }
                }

                var freeBalance = await _coinService.GetBalanceAsync(userId);
                return Ok(new { free = true, coinsReceived = freePurchase.CoinsReceived, newBalance = freeBalance });
            }

            // 4. Precio en dolares, pero Culqi cobra en soles — mismo criterio que Supporters
            if (string.IsNullOrWhiteSpace(req.CulqiToken) || string.IsNullOrWhiteSpace(req.CulqiEmail))
                return BadRequest(new { error = "Token y email de Culqi son requeridos" });

            var amountPen      = finalPrice * PEN_PER_USD;
            var amountCentavos = (int)Math.Round(amountPen * 100);

            try
            {
                var (_, secretKey, esTest) = await _paymentMode.GetLlavesAsync();
                var description = $"DecaCoins — {package.Name} ({package.Coins}+{package.BonusCoins})";

                using var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", secretKey);

                var orderNumber = $"COIN-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..8].ToUpper()}";
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
                        ["package_id"] = package.Id.ToString(),
                        ["platform"]   = "decatron-coins",
                    },
                };

                var json     = JsonSerializer.Serialize(chargePayload);
                var content  = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await client.PostAsync("https://api.culqi.com/v2/charges", content);
                var body     = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Culqi charge failed for coins: {Body}", body);
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
                // de cargo no hay como acreditar coins ni como reclamarle nada a Culqi.
                if (!chargeDoc.RootElement.TryGetProperty("id", out var chargeIdEl))
                {
                    _logger.LogError(
                        "Culqi respondio {Code} sin id de cargo en compra de coins. REVISAR A MANO, el cobro puede haberse hecho. Cuerpo: {Body}",
                        (int)response.StatusCode, body);
                    return StatusCode(502, new
                    {
                        error = "El pago no se pudo confirmar. Si te llegó el cargo, escribe a soporte con tu comprobante y se resuelve — no vuelvas a pagar.",
                    });
                }

                var chargeId = chargeIdEl.GetString() ?? "";

                // 5. Cargo confirmado — crear y completar la orden en el mismo paso.
                // paypal_order_id/paypal_status son nombres heredados de cuando esto era
                // PayPal; se reusan para guardar el id/estado de Culqi en vez de agregar
                // una migracion de rename sobre una tabla que ya tiene compras reales.
                var pending = await _coinService.CreatePendingOrderAsync(userId, isCustom ? null : package.Id, discountCodeId, finalPrice, req.CustomCoins);
                pending.PaypalOrderId = chargeId;
                await _db.SaveChangesAsync();

                var purchase = await _coinService.CompletePurchaseAsync(userId, pending.Id, chargeId, "culqi_completed");

                if (discountCodeId.HasValue && discountValidation != null)
                {
                    var discountApplied = isCustom ? 0m : package.PriceUsd - finalPrice;
                    await _coinService.ApplyDiscountCodeAsync(discountCodeId.Value, userId, purchase.Id, discountApplied);

                    if (discountValidation.DiscountType == "bonus_coins" && discountValidation.BonusCoins > 0)
                    {
                        purchase.BonusCoinsFromCoupon = discountValidation.BonusCoins;
                        purchase.BonusCouponScheduledAt = DateTime.UtcNow;
                        await _db.SaveChangesAsync();
                    }
                }

                // Datos para el comprobante. Se guardan CONGELADOS con la compra, no se leen
                // del perfil al emitir: si mañana cambia su RUC, este comprobante tiene que
                // seguir reflejando a quién se le vendió hoy.
                //
                // El perfil NO se exige: el dinero ya se movió, y perder el registro de un
                // cobro sería mucho peor que emitir el comprobante tarde. Si falta, queda
                // PENDING igual y se resuelve cuando complete sus datos.
                try
                {
                    var perfil = await _billing.GetAsync(userId);

                    purchase.CustomerName      = perfil?.LegalName;
                    purchase.CustomerEmail     = perfil?.Email ?? req.CulqiEmail;
                    purchase.CustomerCountry   = perfil?.Country;
                    purchase.CustomerDocType   = perfil?.DocType;
                    purchase.CustomerDocNumber = perfil?.DocNumber;
                    purchase.PreferFactura     = perfil?.PuedeFactura == true && req.PrefiereFactura;
                    purchase.ChargedAmount     = amountPen;
                    purchase.ChargedCurrency   = "PEN";
                    purchase.IsTest            = esTest;

                    // Una compra de prueba NO entra a la cola de comprobantes: emitir por
                    // un cobro que nunca ocurrió sería declarar ante SUNAT una venta
                    // inexistente, y eso no se arregla borrando una fila.
                    purchase.InvoiceStatus     = esTest ? null : "PENDING";

                    await _db.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    // Que falle el registro fiscal no puede tumbar una compra ya cobrada y
                    // acreditada. Queda en el log para resolverlo a mano.
                    _logger.LogError(ex,
                        "Compra de coins {Id} cobrada y acreditada, pero no se pudieron guardar sus datos de facturación",
                        purchase.Id);
                }

                var newBalance = await _coinService.GetBalanceAsync(userId);

                _logger.LogInformation(
                    "Coin purchase completed via Culqi: User={UserId}, Coins={Coins}, ChargeId={ChargeId}",
                    userId, purchase.CoinsReceived, chargeId);

                return Ok(new
                {
                    success       = true,
                    coinsReceived = purchase.CoinsReceived,
                    newBalance,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing Culqi charge for coins");
                return StatusCode(500, new { error = "Error interno al procesar el pago" });
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
            var userId = await GetAccountOwnerIdAsync();

            if (string.IsNullOrWhiteSpace(req.Username))
                return BadRequest(new { error = "Username es obligatorio" });
            if (req.Amount <= 0)
                return BadRequest(new { error = "Cantidad debe ser mayor a 0" });

            // Find receiver
            var receiverId = await _coinService.FindUserIdByUsernameAsync(req.Username);
            if (receiverId == null)
                return NotFound(new { error = "Usuario no encontrado" });

            // El destinatario también se resuelve a su cuenta: si se busca por su login
            // de Kick pero su saldo vive en la fila de Twitch, los coins irían a una fila
            // secundaria donde el propio dueño nunca los vería.
            var receiverAccountId = await Decatron.Services.Helpers.AccountResolver
                .GetAccountOwnerIdAsync(_db, receiverId.Value);

            if (receiverAccountId == userId)
                return BadRequest(new { error = "No podés transferirte coins a vos mismo" });

            try
            {
                var transfer = await _coinService.TransferCoinsAsync(userId, receiverAccountId, req.Amount, req.Message);
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
            var userId = await GetAccountOwnerIdAsync();
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

            var userId = await GetAccountOwnerIdAsync();
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

        // ─── POST /api/coins/billing-preview ─────────────────────────────────────
        // Qué comprobante le va a salir y cómo se desglosa, ANTES de pagar. Mismo
        // criterio que en supporters: nadie paga sin saber qué documento recibe.

        [HttpPost("billing-preview")]
        public async Task<IActionResult> BillingPreview([FromBody] CoinBillingPreviewRequest req)
        {
            var userId = await GetAccountOwnerIdAsync();

            var perfil = await _billing.GetAsync(userId);
            if (perfil == null)
                return BadRequest(new { error = "PROFILE_REQUIRED", message = "Completa tus datos de facturación antes de comprar." });

            // Mismo cálculo de precio que /buy, para que lo que se muestra acá sea
            // exactamente lo que se va a cobrar y a facturar.
            decimal finalPrice;
            int coins;

            if (req.CustomCoins is > 0)
            {
                if (req.CustomCoins < 100 || req.CustomCoins > 5000)
                    return BadRequest(new { error = "Cantidad de coins fuera de rango" });

                coins      = req.CustomCoins.Value;
                finalPrice = Math.Round((decimal)coins / 100m, 2);
            }
            else
            {
                var packages = await _coinService.GetAvailablePackagesAsync(userId);
                var package  = packages.FirstOrDefault(p => p.Id == req.PackageId);
                if (package == null)
                    return BadRequest(new { error = "Paquete no disponible" });

                coins      = package.Coins + package.BonusCoins;
                finalPrice = package.PriceUsd;
            }

            if (!string.IsNullOrWhiteSpace(req.DiscountCode))
            {
                var validation = await _coinService.ValidateDiscountCodeAsync(
                    req.DiscountCode, userId, req.PackageId, finalPrice);
                if (validation.Valid) finalPrice = validation.FinalPrice;
            }

            // Culqi cobra en soles, así que el comprobante va en soles por lo cobrado.
            var totalPen = decimal.Round(finalPrice * PEN_PER_USD, 2);
            var preview = _billing.Preview(perfil, totalPen, "PEN", req.PrefiereFactura);

            return Ok(new { success = true, preview, priceUsd = finalPrice, coins });
        }

        // ─── GET /api/coins/my-invoices ──────────────────────────────────────────
        // Los comprobantes de las compras de DecaCoins del usuario.

        [HttpGet("my-invoices")]
        public async Task<IActionResult> GetMyInvoices()
        {
            var userId = await GetAccountOwnerIdAsync();

            var compras = await _db.CoinPurchases
                .Where(p => p.UserId == userId && p.InvoiceStatus != null)
                .OrderByDescending(p => p.CreatedAt)
                .Take(100)
                .ToListAsync();

            return Ok(compras.Select(p => new
            {
                purchaseId    = p.Id,
                coinsReceived = p.CoinsReceived,
                createdAt     = DateTime.SpecifyKind(p.CreatedAt, DateTimeKind.Utc),
                amount        = p.ChargedAmount ?? p.AmountPaidUsd,
                currency      = p.ChargedCurrency ?? "USD",
                status        = p.InvoiceStatus,
                type          = p.InvoiceType,
                // El número ya formateado: es como aparece en el papel y como SUNAT lo
                // pide en su consulta pública.
                number        = p.InvoiceSeries == null || p.InvoiceNumber == null
                    ? null
                    : $"{p.InvoiceSeries}-{p.InvoiceNumber.Value:D8}",
                customerName  = p.CustomerName,
                customerDoc   = p.CustomerDocNumber,
                canDownload   = p.InvoiceDocumentId != null,
            }));
        }

        // ─── GET /api/coins/my-invoices/{id}/download/{formato} ──────────────────

        [HttpGet("my-invoices/{purchaseId:long}/download/{formato}")]
        public async Task<IActionResult> DownloadMyInvoice(long purchaseId, string formato)
        {
            var userId = await GetAccountOwnerIdAsync();

            // La comprobación de dueño va dentro de la consulta, no después: pedir la
            // compra y luego comparar deja la puerta abierta a devolver la de otro.
            var documentId = await _invoices.ObtenerDocumentIdAsync(purchaseId, userId, HttpContext.RequestAborted);
            if (documentId == null)
                return NotFound(new { message = "Esta compra todavía no tiene comprobante" });

            var archivo = await _invoiceFiles.DescargarAsync(documentId.Value, formato, HttpContext.RequestAborted);
            if (archivo == null)
                return NotFound(new { message = "El archivo no está disponible" });

            return File(archivo.Contenido, archivo.ContentType, archivo.NombreArchivo);
        }

        // ─── Helpers ─────────────────────────────────────────────────────────────

        /// <summary>
        /// El dueno de cuenta detras del login del token. El saldo de DecaCoins es de la
        /// persona, no de la plataforma: entrando por Kick o por Twitch tiene que ser el
        /// mismo. Ver AccountResolver.
        /// </summary>
        private async Task<long> GetAccountOwnerIdAsync()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!long.TryParse(userIdClaim, out var userId))
                throw new UnauthorizedAccessException("User ID not found in token");

            return await Decatron.Services.Helpers.AccountResolver.GetAccountOwnerIdAsync(_db, userId);
        }
    }

    // ─── Request DTOs ────────────────────────────────────────────────────────────

    public class CoinBuyRequest
    {
        public long PackageId { get; set; }
        public int? CustomCoins { get; set; }
        public string? DiscountCode { get; set; }
        public string? CulqiToken { get; set; }
        public string? CulqiEmail { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }

        /// <summary>
        /// El comprador con RUC eligió factura en vez de boleta. Tener RUC no obliga:
        /// un RUC 10 es persona natural con negocio y muchas veces prefiere boleta.
        /// </summary>
        public bool PrefiereFactura { get; set; }
    }

    public class CoinBillingPreviewRequest
    {
        public long PackageId { get; set; }
        public int? CustomCoins { get; set; }
        public string? DiscountCode { get; set; }
        public bool PrefiereFactura { get; set; }
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
