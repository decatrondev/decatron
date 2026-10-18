using System.Security.Claims;
using Decatron.Attributes;
using Decatron.Core.Interfaces;
using Decatron.Services.Finance;
using Decatron.Services.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Decatron.Controllers
{
    /// <summary>
    /// Plataforma, Fase 7.5: compra y renovación del plan del tenant. Solo el dueño (RequireBuyerOwner, rol leído de la base en cada llamada) y con el 2FA reciente si lo
    /// tiene activo. El servidor calcula todo (<see cref="PlatformPricing"/>): el front solo muestra el presupuesto y envía el token de la tarjeta. El tenant sale del Host.
    /// </summary>
    [ApiController]
    [Route("api/platform/buyer/billing")]
    [Authorize, RequireBuyerOwner]
    public class BuyerBillingController : ControllerBase
    {
        private readonly PlatformCheckout _checkout;
        private readonly IPaymentProvider _provider;
        private readonly ExchangeRate _rate;
        private readonly ILogger<BuyerBillingController> _log;
        private readonly Microsoft.Extensions.Configuration.IConfiguration _cfg;
        private readonly PlatformBillingReader _reader;
        private readonly Decatron.Services.ISupporterInvoiceService _invoiceFiles;
        private readonly Decatron.Services.IPaymentModeService _mode;

        public BuyerBillingController(PlatformCheckout checkout, IPaymentProvider provider, ExchangeRate rate, Microsoft.Extensions.Configuration.IConfiguration cfg,
            PlatformBillingReader reader, Decatron.Services.ISupporterInvoiceService invoiceFiles, Decatron.Services.IPaymentModeService mode, ILogger<BuyerBillingController> log)
        { _checkout = checkout; _provider = provider; _rate = rate; _cfg = cfg; _reader = reader; _invoiceFiles = invoiceFiles; _mode = mode; _log = log; }

        /// <summary>Apagado por defecto: cobrar de verdad solo se enciende con la autorización del dueño de la plataforma (<c>Platform:Billing:CheckoutEnabled</c>, recarga en caliente).</summary>
        private bool CheckoutEnabled => _cfg.GetValue<bool?>("Platform:Billing:CheckoutEnabled") ?? false;

        /// <summary>Apagado por defecto: guardar la tarjeta y renovar solo (<c>Platform:Billing:AutoRenewEnabled</c>, recarga en caliente).</summary>
        private bool AutoEnabled => _cfg.GetValue<bool?>("Platform:Billing:AutoRenewEnabled") ?? false;

        private long Tid => TenantAmbient.Current!.Value;

        public class QuoteBody
        {
            public string? PlanKey { get; set; }
            public int Months { get; set; }
            public List<string>? Addons { get; set; }
            public string? Country { get; set; }
        }

        public sealed class CheckoutBody : QuoteBody
        {
            public string? Token { get; set; }
            public string? Email { get; set; }
            public string? FirstName { get; set; }
            public string? LastName { get; set; }
            public string? LegalName { get; set; }
            public string? DocType { get; set; }
            public string? DocNumber { get; set; }
            public bool PreferFactura { get; set; }
            /// <summary>Guardar la tarjeta y renovar solo. El proveedor exige dirección, ciudad y teléfono para crear al cliente; solo se envían a él, no se guardan aquí.</summary>
            public bool AutoRenew { get; set; }
            public string? Address { get; set; }
            public string? City { get; set; }
            public string? Phone { get; set; }
        }

        private static PlatformCheckout.Request ToRequest(QuoteBody b)
            => new((b.PlanKey ?? "").Trim().ToLowerInvariant(), b.Months, (b.Addons ?? new()).Select(a => a.Trim()).Where(a => a.Length > 0).ToList(), b.Country ?? "");

        private IActionResult Error(string code) => BadRequest(new { success = false, code });

        [HttpPost("quote")]
        public async Task<IActionResult> Quote([FromBody] QuoteBody body)
        {
            var r = await _checkout.QuoteAsync(Tid, ToRequest(body));
            if (!r.Ok) return Error(r.Error!);
            var o = r.Value!;
            var rate = await _rate.PenPerUsdAsync(HttpContext.RequestAborted);
            return Ok(new
            {
                success = true, kind = o.Kind, plan = o.PlanKey, months = o.Months,
                planUsd = o.Quote.PlanUsd, addons = o.Quote.Addons.Select(a => new { key = a.Key, usd = a.Usd }), addonsUsd = o.Quote.AddonsUsd, capped = o.Quote.Capped,
                totalUsd = o.Quote.TotalUsd, taxTreatment = o.TaxTreatment, baseUsd = o.Tax.Base, igvUsd = o.Tax.Igv,
                totalPen = PlatformPricing.ToPen(o.Quote.TotalUsd, rate), penPerUsd = rate, startsAt = o.StartsAt, endsAt = o.EndsAt,
                proration = o.Proration is null ? null : new { newPeriodUsd = o.Proration.NewPeriodUsd, currentPeriodUsd = o.Proration.CurrentPeriodUsd, remainingDays = o.Proration.RemainingDays, periodDays = o.Proration.PeriodDays },
            });
        }

        /// <summary>Llave pública de Culqi del MISMO modo con el que se cobrará (prueba o real), para tokenizar la tarjeta en el navegador. El nginx de decatron.top no deja pasar /api/coins.</summary>
        [HttpGet("culqi-key")]
        public async Task<IActionResult> CulqiKey()
        {
            var (publicKey, _, isTest) = await _mode.GetLlavesAsync(HttpContext.RequestAborted);
            return Ok(new { success = true, publicKey, testMode = isTest, penPerUsd = await _rate.PenPerUsdAsync(HttpContext.RequestAborted) });
        }

        public sealed class ProfileBody
        {
            public string? LegalName { get; set; }
            public string? Country { get; set; }
            public string? DocType { get; set; }
            public string? DocNumber { get; set; }
            public string? Email { get; set; }
        }

        private static readonly string[] DocTypes = { "DNI", "RUC", "CE", "PASAPORTE", "OTRO" };

        /// <summary>Datos del comprobante. Se guardan aparte del cobro para que el comprador los deje listos antes de pagar.</summary>
        [HttpPut("profile")]
        public async Task<IActionResult> SaveProfile([FromBody] ProfileBody b)
        {
            var country = (b.Country ?? "").Trim().ToUpperInvariant();
            if (country.Length != 2) return Error("country_required");
            var name = b.LegalName?.Trim();
            if (string.IsNullOrEmpty(name) || name.Length > 200) return Error("name_required");
            var docType = b.DocType?.Trim().ToUpperInvariant();
            if (!string.IsNullOrEmpty(docType) && !DocTypes.Contains(docType)) return Error("doc_type_invalid");
            var doc = b.DocNumber?.Trim();
            if (doc is { Length: > 30 }) return Error("doc_number_invalid");
            if (docType == "RUC" && (doc is null || doc.Length != 11 || !doc.All(char.IsDigit))) return Error("ruc_invalid");
            if (docType == "DNI" && (doc is null || doc.Length != 8 || !doc.All(char.IsDigit))) return Error("dni_invalid");
            var email = b.Email?.Trim();
            if (string.IsNullOrEmpty(email) || email.Length > 254 || !System.Text.RegularExpressions.Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")) return Error("email_invalid");
            await _checkout.SaveProfileAsync(Tid, name, country, string.IsNullOrEmpty(docType) ? null : docType, string.IsNullOrEmpty(doc) ? null : doc, email);
            return Ok(new { success = true });
        }

        /// <summary>PDF, XML o CDR del comprobante de un pago del tenant (solo el del propio tenant: la fila pasa por RLS y se vuelve a filtrar por tenant).</summary>
        [HttpGet("payments/{paymentId:long}/download/{formato}")]
        public async Task<IActionResult> Download(long paymentId, string formato)
        {
            var documentId = await _reader.InvoiceDocumentIdAsync(Tid, paymentId, HttpContext.RequestAborted);
            if (documentId == null) return NotFound(new { success = false, code = "no_invoice" });
            var archivo = await _invoiceFiles.DescargarAsync(documentId.Value, formato, HttpContext.RequestAborted);
            if (archivo == null) return NotFound(new { success = false, code = "file_unavailable" });
            return File(archivo.Contenido, archivo.ContentType, archivo.NombreArchivo);
        }

        /// <summary>Cancela el cobro automático: es inmediato, borra la tarjeta guardada y el plan sigue hasta su fecha de fin (no se devuelve el periodo ya pagado).</summary>
        [HttpPost("auto/disable")]
        public async Task<IActionResult> DisableAuto()
        {
            var card = await _checkout.DisableAutoAsync(Tid);
            if (card is not null) await _provider.DeleteCardAsync(card);
            _log.LogInformation("tenant.billing.auto.off tenant={Tenant}", Tid);
            return Ok(new { success = true });
        }

        [HttpPost("checkout")]
        [RequireStepUp]
        public async Task<IActionResult> Checkout([FromBody] CheckoutBody body)
        {
            if (!CheckoutEnabled) return StatusCode(403, new { success = false, code = "checkout_disabled" });
            if (string.IsNullOrWhiteSpace(body.Token) || string.IsNullOrWhiteSpace(body.Email)) return Error("token_required");
            var r = await _checkout.QuoteAsync(Tid, ToRequest(body));
            if (!r.Ok) return Error(r.Error!);
            var o = r.Value!;

            if (body.AutoRenew)
            {
                if (!AutoEnabled) return StatusCode(403, new { success = false, code = "auto_disabled" });
                var addr = body.Address?.Trim(); var city = body.City?.Trim(); var phone = body.Phone?.Trim();
                if (addr is not { Length: >= 6 and <= 99 }) return Error("address_invalid");
                if (city is not { Length: >= 3 and <= 29 }) return Error("city_invalid");
                if (phone is not { Length: >= 6 and <= 14 }) return Error("phone_invalid");
            }

            var rate = await _rate.PenPerUsdAsync(HttpContext.RequestAborted);
            var pen = PlatformPricing.ToPen(o.Quote.TotalUsd, rate);
            await _checkout.SaveProfileAsync(Tid, body.LegalName, o.TaxCountry, body.DocType, body.DocNumber, body.Email);

            // El pendiente se crea antes de cobrar: si algo se corta entre el cobro y la confirmación queda rastro para revisar a mano.
            var paymentId = await _checkout.CreatePendingAsync(Tid, o, _provider.Name, rate, isTest: false,
                new PlatformCheckout.Customer(body.LegalName?.Trim(), body.DocType?.Trim(), body.DocNumber?.Trim(), body.Email!.Trim(), body.PreferFactura));
            var order = $"PLAT-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..8].ToUpper()}";

            // Con cobro automático la tarjeta se guarda ANTES de cobrar (el token se consume al guardarla) y el cobro sale de la tarjeta guardada.
            var source = body.Token!;
            ProviderCard? saved = null;
            if (body.AutoRenew)
            {
                var prior = await _checkout.GetAutoAsync(Tid);
                saved = await _provider.SaveCardAsync(new ProviderCustomer(prior?.CustomerId, string.IsNullOrWhiteSpace(body.FirstName) ? "Cliente" : body.FirstName!.Trim(),
                    string.IsNullOrWhiteSpace(body.LastName) ? "Decatron" : body.LastName!.Trim(), body.Email!.Trim(), body.Address!.Trim(), body.City!.Trim(), o.TaxCountry, body.Phone!.Trim()), source);
                if (!saved.Ok)
                {
                    await _checkout.MarkFailedAsync(Tid, paymentId, saved.IsTest);
                    return StatusCode(402, new { success = false, code = "card_failed", message = saved.UserMessage });
                }
                source = saved.CardId!;
            }
            var charge = await _provider.ChargeAsync(new ProviderChargeRequest(PlatformPricing.ToCentimos(pen), "PEN", body.Email!.Trim(), source,
                o.Kind is "upgrade" or "addons" ? $"Decatron Plataforma - cambio a plan {o.PlanKey} ({o.Proration!.RemainingDays} d)" : $"Decatron Plataforma - plan {o.PlanKey} ({o.Months} m)", order,
                string.IsNullOrWhiteSpace(body.FirstName) ? "Cliente" : body.FirstName!, string.IsNullOrWhiteSpace(body.LastName) ? "Decatron" : body.LastName!,
                new Dictionary<string, string> { ["tenant_id"] = Tid.ToString(), ["payment_id"] = paymentId.ToString(), ["platform"] = "decatron-platform" }));

            if (charge.NeedsReview)
            {
                _log.LogError("tenant.billing.review tenant={Tenant} payment={Payment}: cobro sin id; REVISAR A MANO", Tid, paymentId);
                return StatusCode(502, new { success = false, code = "needs_review" });
            }
            if (!charge.Ok)
            {
                if (saved?.CardId is { } orphan) await _provider.DeleteCardAsync(orphan);   // no se queda con una tarjeta que no llegó a cobrar
                await _checkout.MarkFailedAsync(Tid, paymentId, charge.IsTest);
                return StatusCode(402, new { success = false, code = "charge_failed", message = charge.UserMessage });
            }
            await _checkout.ConfirmAsync(Tid, paymentId, charge.ChargeId!, charge.IsTest);
            if (saved?.CardId is { } cardId)
            {
                var prior = await _checkout.GetAutoAsync(Tid);
                await _checkout.SaveAutoAsync(Tid, saved.CustomerId!, cardId, saved.Last4, saved.Brand);
                if (prior?.CardId is { } oldCard && oldCard != cardId) await _provider.DeleteCardAsync(oldCard);   // la tarjeta nueva reemplaza a la anterior
            }
            _log.LogInformation("tenant.billing.charged tenant={Tenant} payment={Payment} test={Test}", Tid, paymentId, charge.IsTest);
            return Ok(new { success = true, paymentId, plan = o.PlanKey, endsAt = o.EndsAt, totalUsd = o.Quote.TotalUsd, totalPen = pen, isTest = charge.IsTest, autoRenew = saved?.CardId != null });
        }
    }
}
