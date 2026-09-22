using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Core.Interfaces;
using Decatron.Core.Models.Credits;
using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Controllers
{
    /// <summary>
    /// Compra de paquetes de créditos con Culqi, calcada del flujo de DecaCoins
    /// (CoinController.Buy): cobro en soles con tipo de cambio fijo, comprobante SUNAT por
    /// CoinInvoiceService (fuente "credits") y acreditación al bucket comprado del ledger.
    /// Solo compra el dueño del canal: los créditos son del canal y el comprobante va a
    /// nombre de quien paga. Plan CREDITOS_UNIFICADOS, fase 4.
    /// </summary>
    [ApiController]
    [Route("api/tts-credits")]
    [Authorize]
    public class CreditPurchaseController : ControllerBase
    {
        private readonly DecatronDbContext _db;
        private readonly ITtsCreditService _credits;
        private readonly IBillingProfileService _billing;
        private readonly IPaymentModeService _paymentMode;
        private readonly ICoinInvoiceService _invoices;
        private readonly ISupporterInvoiceService _invoiceFiles;
        private readonly IHttpClientFactory _httpFactory;
        private readonly Decatron.Services.Finance.ExchangeRate _rate;
        private readonly ILogger<CreditPurchaseController> _logger;

        public CreditPurchaseController(DecatronDbContext db, ITtsCreditService credits, IBillingProfileService billing,
            IPaymentModeService paymentMode, ICoinInvoiceService invoices, ISupporterInvoiceService invoiceFiles,
            IHttpClientFactory httpFactory, Decatron.Services.Finance.ExchangeRate rate, ILogger<CreditPurchaseController> logger)
        {
            _db = db; _credits = credits; _billing = billing; _paymentMode = paymentMode;
            _invoices = invoices; _invoiceFiles = invoiceFiles; _httpFactory = httpFactory; _rate = rate; _logger = logger;
        }

        [HttpGet("packages")]
        public async Task<IActionResult> Packages()
        {
            var packages = await _db.CreditPackages.AsNoTracking().Where(p => p.Enabled).OrderBy(p => p.SortOrder).ThenBy(p => p.Id).ToListAsync();
            return Ok(packages.Select(p => new { p.Id, p.Name, p.Description, p.Credits, p.BonusCredits, total = p.Credits + p.BonusCredits, p.PriceUsd, p.Highlight, perMillionUsd = p.Credits + p.BonusCredits > 0 ? Math.Round(p.PriceUsd * 1_000_000m / (p.Credits + p.BonusCredits), 2) : 0m }));
        }

        [HttpPost("billing-preview")]
        public async Task<IActionResult> BillingPreview([FromBody] CreditBillingPreviewRequest req)
        {
            var (userId, error) = await GetBuyerAsync();
            if (error != null) return error;

            var perfil = await _billing.GetAsync(userId);
            if (perfil == null)
                return BadRequest(new { error = "PROFILE_REQUIRED", message = "Completa tus datos de facturación antes de comprar." });

            var package = await _db.CreditPackages.AsNoTracking().FirstOrDefaultAsync(p => p.Id == req.PackageId && p.Enabled);
            if (package == null) return BadRequest(new { error = "Paquete no disponible" });

            var totalPen = decimal.Round(package.PriceUsd * await _rate.PenPerUsdAsync(HttpContext.RequestAborted), 2);
            var preview = _billing.Preview(perfil, totalPen, "PEN", req.PrefiereFactura);
            return Ok(new { success = true, preview, priceUsd = package.PriceUsd, credits = package.Credits + package.BonusCredits });
        }

        [HttpPost("buy")]
        public async Task<IActionResult> Buy([FromBody] CreditBuyRequest req)
        {
            var (userId, error) = await GetBuyerAsync();
            if (error != null) return error;

            var package = await _db.CreditPackages.AsNoTracking().FirstOrDefaultAsync(p => p.Id == req.PackageId && p.Enabled);
            if (package == null) return BadRequest(new { error = "Paquete no disponible" });
            if (string.IsNullOrWhiteSpace(req.CulqiToken) || string.IsNullOrWhiteSpace(req.CulqiEmail))
                return BadRequest(new { error = "Token y email de Culqi son requeridos" });

            var totalCredits = package.Credits + package.BonusCredits;
            var amountPen = package.PriceUsd * await _rate.PenPerUsdAsync(HttpContext.RequestAborted);
            var amountCentavos = (int)Math.Round(amountPen * 100);

            try
            {
                var (_, secretKey, esTest) = await _paymentMode.GetLlavesAsync();
                using var client = _httpFactory.CreateClient();
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", secretKey);

                var orderNumber = $"CRED-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..8].ToUpper()}";
                var payload = new
                {
                    amount = amountCentavos,
                    currency_code = "PEN",
                    email = req.CulqiEmail,
                    source_id = req.CulqiToken,
                    description = $"Créditos Decatron — {package.Name} ({totalCredits:N0})",
                    order_number = orderNumber,
                    antifraud_details = new
                    {
                        first_name = string.IsNullOrWhiteSpace(req.FirstName) ? "Cliente" : req.FirstName,
                        last_name = string.IsNullOrWhiteSpace(req.LastName) ? "Decatron" : req.LastName,
                    },
                    metadata = new Dictionary<string, string> { ["package_id"] = package.Id.ToString(), ["platform"] = "decatron-credits" },
                };
                var response = await client.PostAsync("https://api.culqi.com/v2/charges", new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"));
                var body = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Culqi charge failed for credits: {Body}", body);
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
                if (!chargeDoc.RootElement.TryGetProperty("id", out var chargeIdEl))
                {
                    _logger.LogError("Culqi respondió {Code} sin id de cargo en compra de créditos. REVISAR A MANO. Cuerpo: {Body}", (int)response.StatusCode, body);
                    return StatusCode(502, new { error = "El pago no se pudo confirmar. Si te llegó el cargo, escribe a soporte con tu comprobante y se resuelve — no vuelvas a pagar." });
                }
                var chargeId = chargeIdEl.GetString() ?? "";
                // El id del cargo manda sobre el modo configurado: un chr_test_ nunca se factura.
                esTest = Decatron.Services.CargoDePrueba.Es(esTest, chargeId);

                // Cargo confirmado: registrar la compra y acreditar. Los datos del comprobante
                // van congelados con la compra, no se leen del perfil al emitir.
                var perfil = await _billing.GetAsync(userId);
                var purchase = new CreditPurchase
                {
                    UserId = userId, PackageId = package.Id, CreditsReceived = (int)Math.Min(totalCredits, int.MaxValue),
                    AmountPaidUsd = package.PriceUsd, ChargeId = chargeId, ChargeStatus = "culqi_completed",
                    ChargedAmount = amountPen, ChargedCurrency = "PEN", IsTest = esTest,
                    CustomerName = perfil?.LegalName, CustomerEmail = perfil?.Email ?? req.CulqiEmail, CustomerCountry = perfil?.Country,
                    CustomerDocType = perfil?.DocType, CustomerDocNumber = perfil?.DocNumber,
                    PreferFactura = perfil?.PuedeFactura == true && req.PrefiereFactura,
                    // Una compra de prueba no entra a la cola de comprobantes (sería declarar una venta inexistente).
                    InvoiceStatus = esTest ? null : "PENDING",
                };
                _db.CreditPurchases.Add(purchase);
                await _db.SaveChangesAsync();

                var granted = await _credits.GrantAsync(userId, totalCredits, "purchase", "purchased",
                    note: $"Paquete {package.Name} (compra #{purchase.Id})", gateway: "culqi", externalId: chargeId);
                if (!granted)
                    _logger.LogError("Compra de créditos {Id} cobrada (Culqi {ChargeId}) pero NO acreditada. REVISAR A MANO.", purchase.Id, chargeId);

                var balance = await _credits.GetBalanceAsync(userId);
                _logger.LogInformation("Compra de créditos completada: User={UserId}, Credits={Credits}, ChargeId={ChargeId}", userId, totalCredits, chargeId);
                return Ok(new { success = true, creditsReceived = totalCredits, newBalance = balance.TotalAvailable, purchaseId = purchase.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing Culqi charge for credits");
                return StatusCode(500, new { error = "Error interno al procesar el pago" });
            }
        }

        /// <summary>Compras del canal con el estado de su comprobante.</summary>
        [HttpGet("purchases")]
        public async Task<IActionResult> Purchases()
        {
            var userId = GetChannelOwnerId();
            if (userId == 0) return Unauthorized();
            var compras = await _db.CreditPurchases.AsNoTracking().Where(p => p.UserId == userId).OrderByDescending(p => p.CreatedAt).Take(100).ToListAsync();
            return Ok(compras.Select(p => new
            {
                purchaseId = p.Id,
                creditsReceived = p.CreditsReceived,
                createdAt = DateTime.SpecifyKind(p.CreatedAt, DateTimeKind.Utc),
                amount = p.ChargedAmount ?? p.AmountPaidUsd,
                currency = p.ChargedCurrency ?? "USD",
                priceUsd = p.AmountPaidUsd,
                isTest = p.IsTest,
                status = p.InvoiceStatus,
                type = p.InvoiceType,
                number = p.InvoiceSeries == null || p.InvoiceNumber == null ? null : $"{p.InvoiceSeries}-{p.InvoiceNumber.Value:D8}",
                canDownload = p.InvoiceDocumentId != null,
            }));
        }

        [HttpGet("purchases/{purchaseId:long}/download/{formato}")]
        public async Task<IActionResult> Download(long purchaseId, string formato)
        {
            var userId = GetChannelOwnerId();
            if (userId == 0) return Unauthorized();
            var documentId = await _invoices.ObtenerDocumentIdAsync(purchaseId, userId, HttpContext.RequestAborted, "credits");
            if (documentId == null) return NotFound(new { message = "Esta compra todavía no tiene comprobante" });
            var archivo = await _invoiceFiles.DescargarAsync(documentId.Value, formato, HttpContext.RequestAborted);
            if (archivo == null) return NotFound(new { message = "El archivo no está disponible" });
            return File(archivo.Contenido, archivo.ContentType, archivo.NombreArchivo);
        }

        // ─── Helpers ───────────────────────────────────────────────────────────

        /// <summary>El comprador tiene que ser el dueño del canal activo: el cobro y el comprobante son suyos.</summary>
        private Task<(long userId, IActionResult? error)> GetBuyerAsync()
        {
            var channelOwnerId = GetChannelOwnerId();
            var actingId = long.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var a) ? a : 0;
            if (channelOwnerId == 0 || actingId == 0) return Task.FromResult<(long, IActionResult?)>((0, Unauthorized(new { error = "No se pudo identificar el canal" })));
            if (channelOwnerId != actingId) return Task.FromResult<(long, IActionResult?)>((0, StatusCode(403, new { error = "Solo el dueño del canal puede comprar créditos" })));
            return Task.FromResult<(long, IActionResult?)>((channelOwnerId, null));
        }

        private long GetChannelOwnerId()
        {
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId)) return sessionId;
            if (long.TryParse(User.FindFirst("ChannelOwnerId")?.Value, out var channelOwnerId)) return channelOwnerId;
            return long.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId) ? userId : 0;
        }
    }

    public class CreditBuyRequest
    {
        public long PackageId { get; set; }
        public string? CulqiToken { get; set; }
        public string? CulqiEmail { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public bool PrefiereFactura { get; set; }
    }

    public class CreditBillingPreviewRequest
    {
        public long PackageId { get; set; }
        public bool PrefiereFactura { get; set; }
    }
}
