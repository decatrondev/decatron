using Decatron.Attributes;
using Decatron.Core.Interfaces;
using Decatron.Services.Finance;
using Decatron.Services.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Decatron.Controllers
{
    /// <summary>
    /// Plataforma, Fase 7.7: lectura del estado de facturación (plan, vencimiento, gracia, complementos, perfil e historial de pagos). La pueden ver el dueño y los admins;
    /// comprar, guardar el perfil y descargar comprobantes es solo del dueño (<see cref="BuyerBillingController"/>).
    /// </summary>
    [ApiController]
    [Route("api/platform/buyer/billing")]
    [Authorize, RequireBuyerMember]
    public class BuyerBillingReadController : ControllerBase
    {
        private readonly PlatformBillingReader _reader;
        private readonly ExchangeRate _rate;
        private readonly Microsoft.Extensions.Configuration.IConfiguration _cfg;

        public BuyerBillingReadController(PlatformBillingReader reader, ExchangeRate rate, Microsoft.Extensions.Configuration.IConfiguration cfg)
        { _reader = reader; _rate = rate; _cfg = cfg; }

        private long Tid => TenantAmbient.Current!.Value;

        [HttpGet("state")]
        public async Task<IActionResult> State()
        {
            var s = await _reader.GetStateAsync(Tid, HttpContext.RequestAborted);
            var now = DateTime.UtcNow;
            var sub = s.Subscription;
            // «grace»: venció pero sigue operativo; «expired»: venció y la gracia terminó; «sandbox»: prueba; «active»: pago al día.
            string phase = sub is null ? "none"
                : sub.PlanKey == "internal" ? "internal"
                : sub.Status == "sandbox" ? "sandbox"
                : sub.Status == "suspended" ? "suspended"
                : sub.EndsAt is null ? "active"
                : sub.EndsAt > now ? "active"
                : sub.GraceUntil > now ? "grace" : "expired";
            return Ok(new
            {
                success = true,
                phase,
                subscription = sub is null ? null : new
                {
                    plan = sub.PlanKey, planName = sub.PlanName, status = sub.Status, periodMonths = sub.PeriodMonths,
                    startsAt = sub.StartsAt, endsAt = sub.EndsAt, graceUntil = sub.GraceUntil, sandboxEndsAt = sub.SandboxEndsAt,
                    daysLeft = sub.EndsAt is { } e && e > now ? (int)Math.Ceiling((e - now).TotalDays) : (int?)null,
                    graceDaysLeft = phase == "grace" ? (int)Math.Ceiling((sub.GraceUntil!.Value - now).TotalDays) : (int?)null,
                },
                addons = s.Addons.Select(a => new { key = a.Key, endsAt = a.EndsAt }),
                profile = s.Profile is null ? null : new
                {
                    legalName = s.Profile.LegalName, country = s.Profile.Country, docType = s.Profile.DocType, docNumber = s.Profile.DocNumber,
                    email = s.Profile.BillingEmail, payMode = s.Profile.PayMode, hasSavedCard = s.Profile.HasSavedCard, cardLast4 = s.Profile.CardLast4, cardBrand = s.Profile.CardBrand, autoSince = s.Profile.AutoEnabledAt,
                },
                billable = sub is not null && sub.PlanKey != "internal",
                checkoutEnabled = _cfg.GetValue<bool?>("Platform:Billing:CheckoutEnabled") ?? false,
                autoAvailable = _cfg.GetValue<bool?>("Platform:Billing:AutoRenewEnabled") ?? false,
                penPerUsd = await _rate.PenPerUsdAsync(HttpContext.RequestAborted),
            });
        }

        [HttpGet("payments")]
        public async Task<IActionResult> Payments()
        {
            var list = await _reader.ListPaymentsAsync(Tid, 100, HttpContext.RequestAborted);
            return Ok(new
            {
                success = true,
                payments = list.Select(p => new
                {
                    id = p.Id, purpose = p.Purpose, plan = p.PlanKey, periodMonths = p.PeriodMonths, amountUsd = p.AmountUsd, amountPen = p.AmountPen,
                    status = p.Status, isTest = p.IsTest, createdAt = p.CreatedAt, paidAt = p.PaidAt, periodEnds = p.PeriodEnds, addons = p.Addons,
                    invoiceType = p.InvoiceType, invoiceNumber = p.InvoiceNumber, canDownload = p.CanDownload,
                }),
            });
        }
    }
}
