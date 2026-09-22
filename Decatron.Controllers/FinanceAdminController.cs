using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Core.Models.Finance;
using Decatron.Data;
using Decatron.Services.Finance;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    /// <summary>
    /// Finanzas de la plataforma: qué entra, qué sale y qué queda. Une los tres orígenes de
    /// cobro sin migrar datos y descuenta comisión de pasarela, IGV, costos variables
    /// (IA + voz/STT) y costos fijos. Plan: .dev/plans/FINANZAS_PLAN.md
    /// </summary>
    [ApiController]
    [Route("api/admin/finance")]
    [Authorize]
    [RequireSystemOwner]
    public class FinanceAdminController : ControllerBase
    {
        private readonly DecatronDbContext _db;
        private readonly FinanceService _finance;

        public FinanceAdminController(DecatronDbContext db, FinanceService finance)
        {
            _db = db;
            _finance = finance;
        }

        /// <summary>P&L del rango: ingresos, deducciones, costos y beneficio neto.</summary>
        [HttpGet("summary")]
        public async Task<IActionResult> Summary([FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null, [FromQuery] int months = 12)
        {
            var (fromUtc, toUtc) = Range(from, to, months);
            var s = await _finance.GetSettingsAsync(HttpContext.RequestAborted);
            var rate = s.PenPerUsd <= 0 ? 3.8m : s.PenPerUsd;

            var income = await _finance.IncomeAsync(fromUtc, toUtc, HttpContext.RequestAborted);
            var grossPen = income.Sum(i => i.AmountPen);
            var feesPen = income.Sum(i => FinanceService.GatewayFee(i.AmountPen, s));
            // El IGV solo aplica a lo que se factura en Perú; las donaciones y lo cobrado
            // sin comprobante no se declaran como venta, así que no se les descuenta.
            var taxedPen = income.Where(i => i.InvoiceStatus != null && i.InvoiceStatus != "VOIDED").Sum(i => i.AmountPen);
            var igvPen = FinanceService.IgvIncluded(taxedPen, s);
            var netSalesPen = grossPen - feesPen - igvPen;

            var variable = await _finance.VariableCostsAsync(fromUtc, toUtc, rate, HttpContext.RequestAborted);
            var fixedCosts = await _finance.FixedCostsAsync(fromUtc, toUtc, rate, HttpContext.RequestAborted);
            var variablePen = variable.Sum(v => v.Pen);
            var fixedPen = fixedCosts.Sum(f => f.Pen);
            var grossMarginPen = netSalesPen - variablePen;
            var netProfitPen = grossMarginPen - fixedPen;

            var bySource = income.GroupBy(i => i.Source)
                .Select(g => new { source = g.Key, pen = g.Sum(x => x.AmountPen), usd = g.Sum(x => x.AmountUsd), count = g.Count() })
                .OrderByDescending(x => x.pen).ToList();

            // Serie mensual del rango, para ver tendencia.
            var byMonth = income.GroupBy(i => new DateTime(i.At.Year, i.At.Month, 1))
                .Select(g => new { month = g.Key.ToString("yyyy-MM"), pen = g.Sum(x => x.AmountPen), count = g.Count() })
                .OrderBy(x => x.month).ToList();

            // Tips de los espectadores: dinero de terceros (va al PayPal del streamer),
            // se muestra solo como referencia y nunca suma al resultado.
            var tips = await _db.Database.SqlQueryRaw<decimal?>(
                "SELECT SUM(amount)::numeric AS \"Value\" FROM tips_history WHERE status = 'completed' AND created_at >= {0} AND created_at < {1}",
                fromUtc, toUtc).FirstOrDefaultAsync(HttpContext.RequestAborted);

            return Ok(new
            {
                success = true,
                from = fromUtc, to = toUtc,
                settings = new { s.GatewayPercent, s.GatewayFixedPen, s.GatewayFeeHasIgv, s.IgvPercent, s.PenPerUsd, s.PrimaryCurrency, s.CreditUsd, s.TargetMarginPercent },
                income = new
                {
                    grossPen, grossUsd = grossPen / rate, count = income.Count, bySource, byMonth,
                },
                deductions = new
                {
                    gatewayFeesPen = feesPen, gatewayFeesUsd = feesPen / rate,
                    igvPen, igvUsd = igvPen / rate, taxedPen,
                },
                netSalesPen, netSalesUsd = netSalesPen / rate,
                costs = new
                {
                    variablePen, variableUsd = variablePen / rate, variable,
                    fixedPen, fixedUsd = fixedPen / rate, @fixed = fixedCosts,
                },
                grossMarginPen, grossMarginUsd = grossMarginPen / rate,
                netProfitPen, netProfitUsd = netProfitPen / rate,
                marginPercent = grossPen > 0 ? Math.Round(netProfitPen / grossPen * 100m, 1) : 0m,
                thirdParty = new { tipsPen = tips ?? 0m },
            });
        }

        /// <summary>
        /// Unidad económica de los créditos: cuánto se vendió, cuánto se consumió, qué
        /// queda debiendo la plataforma (créditos pagados y todavía no gastados) y qué
        /// paga vs. qué consume cada canal. Es lo que dice si los precios y las cuotas
        /// de los tiers están bien.
        /// </summary>
        [HttpGet("credits")]
        public async Task<IActionResult> Credits([FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null, [FromQuery] int months = 12)
        {
            var (fromUtc, toUtc) = Range(from, to, months);
            var s = await _finance.GetSettingsAsync(HttpContext.RequestAborted);
            var rate = s.PenPerUsd <= 0 ? 3.8m : s.PenPerUsd;
            var creditUsd = Decatron.Services.AI.AiCreditGate.CreditUsd;
            var fromOffset = new DateTimeOffset(fromUtc, TimeSpan.Zero);
            var toOffset = new DateTimeOffset(toUtc, TimeSpan.Zero);

            // Vendidos en paquetes: lo único con un precio directo por crédito.
            var sold = await _db.CreditPurchases.AsNoTracking()
                .Where(p => !p.IsTest && p.CreatedAt >= fromUtc && p.CreatedAt < toUtc)
                .GroupBy(_ => 1)
                .Select(g => new { credits = g.Sum(p => (long)p.CreditsReceived), usd = g.Sum(p => p.AmountPaidUsd), n = g.Count() })
                .FirstOrDefaultAsync(HttpContext.RequestAborted);

            // Otorgados por el plan (cuota mensual) y regalados por el admin: no tienen
            // precio propio, pero son créditos que la plataforma va a tener que servir.
            var granted = await _db.TtsCreditLedger.AsNoTracking()
                .Where(e => e.Credits > 0 && e.Bucket != "standard" && e.CreatedAt >= fromOffset && e.CreatedAt < toOffset)
                .GroupBy(e => e.Type)
                .Select(g => new { type = g.Key, credits = g.Sum(e => e.Credits), n = g.Count() })
                .ToListAsync(HttpContext.RequestAborted);

            var consumed = await _db.TtsCreditLedger.AsNoTracking()
                .Where(e => e.Type == "consume" && (e.Bucket == "monthly" || e.Bucket == "purchased")
                            && e.CreatedAt >= fromOffset && e.CreatedAt < toOffset)
                .GroupBy(_ => 1)
                .Select(g => new { credits = -g.Sum(e => e.Credits), n = g.Count() })
                .FirstOrDefaultAsync(HttpContext.RequestAborted);

            // Pasivo: créditos comprados que nadie gastó todavía. Es plata ya cobrada por
            // un servicio que falta prestar; los del plan no cuentan porque vencen al mes.
            var liability = await _db.TtsCreditBalances.AsNoTracking()
                .Where(b => b.PurchasedBalance > 0)
                .GroupBy(_ => 1)
                .Select(g => new { credits = g.Sum(b => b.PurchasedBalance), channels = g.Count() })
                .FirstOrDefaultAsync(HttpContext.RequestAborted);

            // Por canal: lo que pagó en el período contra lo que consumió.
            var income = await _finance.IncomeAsync(fromUtc, toUtc, HttpContext.RequestAborted);
            var paidByUser = income.Where(i => i.UserId != null)
                .GroupBy(i => i.UserId!.Value)
                .ToDictionary(g => g.Key, g => new { pen = g.Sum(x => x.AmountPen), n = g.Count() });
            var usedByUser = await _db.TtsCreditLedger.AsNoTracking()
                .Where(e => e.Type == "consume" && (e.Bucket == "monthly" || e.Bucket == "purchased")
                            && e.CreatedAt >= fromOffset && e.CreatedAt < toOffset)
                .GroupBy(e => e.UserId)
                .Select(g => new { userId = g.Key, credits = -g.Sum(e => e.Credits) })
                .ToListAsync(HttpContext.RequestAborted);

            var ids = paidByUser.Keys.Union(usedByUser.Select(u => u.userId)).Distinct().ToList();
            var users = await _db.Users.AsNoTracking().Where(u => ids.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Login, HttpContext.RequestAborted);
            var tiers = new Dictionary<long, string>();
            foreach (var id in ids) tiers[id] = await Decatron.Core.Helpers.TierResolver.GetEffectiveTierAsync(_db, id);

            var byChannel = ids.Select(id =>
            {
                var paid = paidByUser.GetValueOrDefault(id);
                var usedCredits = usedByUser.FirstOrDefault(u => u.userId == id)?.credits ?? 0;
                var costPen = usedCredits * creditUsd * rate;
                return new
                {
                    userId = id, login = users.GetValueOrDefault(id), tier = tiers.GetValueOrDefault(id),
                    paidPen = paid?.pen ?? 0m, payments = paid?.n ?? 0,
                    usedCredits, costPen, costUsd = usedCredits * creditUsd,
                    marginPen = (paid?.pen ?? 0m) - costPen,
                };
            }).OrderByDescending(c => c.costPen).ThenByDescending(c => c.paidPen).Take(50).ToList();

            var soldCredits = sold?.credits ?? 0;
            var soldUsd = sold?.usd ?? 0m;
            return Ok(new
            {
                success = true,
                from = fromUtc, to = toUtc, creditUsd,
                sold = new { credits = soldCredits, usd = soldUsd, pen = soldUsd * rate, purchases = sold?.n ?? 0,
                    pricePerMillionUsd = soldCredits > 0 ? Math.Round(soldUsd * 1_000_000m / soldCredits, 2) : 0m,
                    costPerMillionUsd = Math.Round(creditUsd * 1_000_000m, 2) },
                granted,
                consumed = new { credits = consumed?.credits ?? 0, entries = consumed?.n ?? 0,
                    costUsd = (consumed?.credits ?? 0) * creditUsd, costPen = (consumed?.credits ?? 0) * creditUsd * rate },
                liability = new { credits = liability?.credits ?? 0, channels = liability?.channels ?? 0,
                    costUsd = (liability?.credits ?? 0) * creditUsd, costPen = (liability?.credits ?? 0) * creditUsd * rate },
                byChannel,
            });
        }

        /// <summary>Cobros uno por uno, con su comprobante. Para revisar y conciliar.</summary>
        [HttpGet("income")]
        public async Task<IActionResult> Income([FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null,
            [FromQuery] int months = 12, [FromQuery] string? source = null, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            var (fromUtc, toUtc) = Range(from, to, months);
            var rows = await _finance.IncomeAsync(fromUtc, toUtc, HttpContext.RequestAborted);
            if (!string.IsNullOrWhiteSpace(source)) rows = rows.Where(r => r.Source == source).ToList();
            pageSize = Math.Clamp(pageSize, 10, 200);
            page = Math.Max(1, page);
            var s = await _finance.GetSettingsAsync(HttpContext.RequestAborted);
            return Ok(new
            {
                success = true,
                total = rows.Count,
                page, pageSize,
                totalPages = (int)Math.Ceiling(rows.Count / (double)pageSize),
                items = rows.Skip((page - 1) * pageSize).Take(pageSize)
                    .Select(r => new { r.Source, r.Id, r.UserId, r.Login, r.At, r.AmountPen, r.AmountUsd, r.Gateway, r.ChargeId, r.InvoiceStatus, r.InvoiceType, r.InvoiceNumber, r.Concept, feePen = FinanceService.GatewayFee(r.AmountPen, s) }),
            });
        }

        /// <summary>El mismo detalle en CSV, para llevarlo a una hoja de cálculo.</summary>
        [HttpGet("income.csv")]
        public async Task<IActionResult> IncomeCsv([FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null, [FromQuery] int months = 12)
        {
            var (fromUtc, toUtc) = Range(from, to, months);
            var rows = await _finance.IncomeAsync(fromUtc, toUtc, HttpContext.RequestAborted);
            var s = await _finance.GetSettingsAsync(HttpContext.RequestAborted);
            var sb = new StringBuilder("fecha,fuente,canal,concepto,pen,usd,comision_pen,pasarela,cargo,comprobante\n");
            foreach (var r in rows)
            {
                var num = r.InvoiceNumber ?? r.InvoiceStatus ?? "";
                sb.AppendLine(string.Join(',', new[]
                {
                    r.At.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture),
                    r.Source, Csv(r.Login), Csv(r.Concept),
                    r.AmountPen.ToString("0.00", CultureInfo.InvariantCulture),
                    r.AmountUsd.ToString("0.00", CultureInfo.InvariantCulture),
                    FinanceService.GatewayFee(r.AmountPen, s).ToString("0.00", CultureInfo.InvariantCulture),
                    r.Gateway, Csv(r.ChargeId), Csv(num),
                }));
            }
            return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", $"decatron-ingresos-{DateTime.UtcNow:yyyyMMdd}.csv");
        }

        private static string Csv(string? v) => v == null ? "" : v.Contains(',') ? $"\"{v.Replace("\"", "\"\"")}\"" : v;

        // ── Parámetros ─────────────────────────────────────────────────────────

        [HttpGet("settings")]
        public async Task<IActionResult> GetSettings() => Ok(await _finance.GetSettingsAsync(HttpContext.RequestAborted));

        public record SettingsInput(decimal GatewayPercent, decimal GatewayFixedPen, bool GatewayFeeHasIgv, decimal IgvPercent, decimal PenPerUsd, string PrimaryCurrency, decimal? CreditUsd, decimal? TargetMarginPercent);

        [HttpPut("settings")]
        public async Task<IActionResult> SaveSettings([FromBody] SettingsInput input)
        {
            if (input.PenPerUsd <= 0) return BadRequest(new { success = false, message = "El tipo de cambio tiene que ser mayor que cero" });
            var s = await _db.FinanceSettings.FirstOrDefaultAsync(x => x.Id == 1);
            if (s == null) { s = new FinanceSettings(); _db.FinanceSettings.Add(s); }
            s.GatewayPercent = Math.Clamp(input.GatewayPercent, 0m, 50m);
            s.GatewayFixedPen = Math.Max(0m, input.GatewayFixedPen);
            s.GatewayFeeHasIgv = input.GatewayFeeHasIgv;
            s.IgvPercent = Math.Clamp(input.IgvPercent, 0m, 50m);
            s.PenPerUsd = input.PenPerUsd;
            s.PrimaryCurrency = input.PrimaryCurrency == "USD" ? "USD" : "PEN";
            if (input.CreditUsd is > 0) s.CreditUsd = input.CreditUsd.Value;
            if (input.TargetMarginPercent is >= 0) s.TargetMarginPercent = Math.Clamp(input.TargetMarginPercent.Value, 0m, 500m);
            s.UpdatedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(s);
        }

        // ── Tarifas de créditos ────────────────────────────────────────────────

        /// <summary>
        /// Lo que se le cobra al canal por cada motor y lo que cuesta de verdad, con el
        /// margen resultante y la tarifa sugerida para el margen objetivo.
        /// </summary>
        [HttpGet("rates")]
        public async Task<IActionResult> GetRates()
        {
            var s = await _finance.GetSettingsAsync(HttpContext.RequestAborted);
            var rates = await _db.CreditRates.AsNoTracking().OrderBy(r => r.Label).ToListAsync();
            var creditUsd = s.CreditUsd > 0 ? s.CreditUsd : 0.000004m;
            return Ok(new
            {
                success = true,
                creditUsd,
                targetMarginPercent = s.TargetMarginPercent,
                rates = rates.Select(r =>
                {
                    // Lo que cobramos por unidad, en dólares. Para el motor "ai" la unidad
                    // es el propio dólar de costo, así que el multiplicador ya es el margen.
                    var chargedUsd = r.Unit == "usd" ? r.CreditsPerUnit : r.CreditsPerUnit * creditUsd;
                    var cost = r.Unit == "usd" ? 1m : r.ProviderUsdPerUnit;
                    var margin = cost > 0 ? Math.Round((chargedUsd / cost - 1m) * 100m, 1) : (decimal?)null;
                    var suggested = cost > 0
                        ? Math.Round(cost * (1 + s.TargetMarginPercent / 100m) / (r.Unit == "usd" ? 1m : creditUsd), 4)
                        : (decimal?)null;
                    return new
                    {
                        r.Engine, r.Label, r.Unit, r.CreditsPerUnit, r.ProviderUsdPerUnit, r.Enabled, r.Notes, r.UpdatedAt,
                        chargedUsdPerUnit = chargedUsd,
                        marginPercent = margin,
                        suggestedCreditsPerUnit = suggested,
                        // Referencias legibles: por millón de caracteres o por minuto.
                        perMillionCharsUsd = r.Unit == "char" ? Math.Round(chargedUsd * 1_000_000m, 2) : (decimal?)null,
                        providerPerMillionCharsUsd = r.Unit == "char" ? Math.Round(r.ProviderUsdPerUnit * 1_000_000m, 2) : (decimal?)null,
                        perMinuteUsd = r.Unit == "second" ? Math.Round(chargedUsd * 60m, 5) : (decimal?)null,
                        providerPerMinuteUsd = r.Unit == "second" ? Math.Round(r.ProviderUsdPerUnit * 60m, 5) : (decimal?)null,
                    };
                }),
            });
        }

        public record RateInput(string Label, string Unit, decimal CreditsPerUnit, decimal ProviderUsdPerUnit, bool Enabled, string? Notes);

        [HttpPut("rates/{engine}")]
        public async Task<IActionResult> SaveRate(string engine, [FromBody] RateInput input)
        {
            if (input.CreditsPerUnit <= 0) return BadRequest(new { success = false, message = "La tarifa tiene que ser mayor que cero" });
            var r = await _db.CreditRates.FirstOrDefaultAsync(x => x.Engine == engine);
            if (r == null)
            {
                r = new Decatron.Core.Models.Finance.CreditRate { Engine = engine };
                _db.CreditRates.Add(r);
            }
            r.Label = string.IsNullOrWhiteSpace(input.Label) ? engine : input.Label.Trim();
            r.Unit = input.Unit is "second" or "usd" ? input.Unit : "char";
            r.CreditsPerUnit = input.CreditsPerUnit;
            r.ProviderUsdPerUnit = Math.Max(0m, input.ProviderUsdPerUnit);
            r.Enabled = input.Enabled;
            r.Notes = input.Notes?.Trim();
            r.UpdatedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(r);
        }

        /// <summary>Pone todas las tarifas al margen objetivo de una vez.</summary>
        [HttpPost("rates/apply-margin")]
        public async Task<IActionResult> ApplyMargin()
        {
            var s = await _finance.GetSettingsAsync(HttpContext.RequestAborted);
            var creditUsd = s.CreditUsd > 0 ? s.CreditUsd : 0.000004m;
            var rates = await _db.CreditRates.ToListAsync();
            var changed = 0;
            foreach (var r in rates)
            {
                if (r.Unit == "usd") { r.CreditsPerUnit = 1 + s.TargetMarginPercent / 100m; r.UpdatedAt = DateTimeOffset.UtcNow; changed++; continue; }
                if (r.ProviderUsdPerUnit <= 0) continue; // Piper y demás: no cuestan dinero
                r.CreditsPerUnit = Math.Round(r.ProviderUsdPerUnit * (1 + s.TargetMarginPercent / 100m) / creditUsd, 4);
                r.UpdatedAt = DateTimeOffset.UtcNow;
                changed++;
            }
            await _db.SaveChangesAsync();
            return Ok(new { success = true, changed, marginPercent = s.TargetMarginPercent });
        }

        // ── Costos fijos ───────────────────────────────────────────────────────

        [HttpGet("fixed-costs")]
        public async Task<IActionResult> GetFixedCosts() =>
            Ok(await _db.FixedCosts.AsNoTracking().OrderBy(c => c.Concept).ToListAsync());

        public record FixedCostInput(string Concept, decimal Amount, string Currency, string Periodicity, DateOnly StartsOn, DateOnly? EndsOn, string? Notes);

        [HttpPost("fixed-costs")]
        public async Task<IActionResult> CreateFixedCost([FromBody] FixedCostInput input)
        {
            if (string.IsNullOrWhiteSpace(input.Concept) || input.Amount <= 0) return BadRequest(new { success = false, message = "Concepto y monto (> 0) son obligatorios" });
            var c = Apply(new FixedCost(), input);
            _db.FixedCosts.Add(c);
            await _db.SaveChangesAsync();
            return Ok(c);
        }

        [HttpPut("fixed-costs/{id:long}")]
        public async Task<IActionResult> UpdateFixedCost(long id, [FromBody] FixedCostInput input)
        {
            var c = await _db.FixedCosts.FirstOrDefaultAsync(x => x.Id == id);
            if (c == null) return NotFound();
            if (string.IsNullOrWhiteSpace(input.Concept) || input.Amount <= 0) return BadRequest(new { success = false, message = "Concepto y monto (> 0) son obligatorios" });
            Apply(c, input);
            c.UpdatedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(c);
        }

        [HttpDelete("fixed-costs/{id:long}")]
        public async Task<IActionResult> DeleteFixedCost(long id)
        {
            var c = await _db.FixedCosts.FirstOrDefaultAsync(x => x.Id == id);
            if (c == null) return NotFound();
            _db.FixedCosts.Remove(c);
            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }

        private static FixedCost Apply(FixedCost c, FixedCostInput i)
        {
            c.Concept = i.Concept.Trim();
            c.Amount = i.Amount;
            c.Currency = i.Currency == "PEN" ? "PEN" : "USD";
            c.Periodicity = i.Periodicity is "yearly" or "one_time" ? i.Periodicity : "monthly";
            c.StartsOn = i.StartsOn == default ? DateOnly.FromDateTime(DateTime.UtcNow) : i.StartsOn;
            c.EndsOn = i.EndsOn;
            c.Notes = i.Notes?.Trim();
            return c;
        }

        /// <summary>Rango pedido, o los últimos N meses completos más el actual.</summary>
        private static (DateTime from, DateTime to) Range(DateTime? from, DateTime? to, int months)
        {
            months = Math.Clamp(months, 1, 60);
            var toUtc = to.HasValue ? DateTime.SpecifyKind(to.Value.Date.AddDays(1), DateTimeKind.Utc) : DateTime.UtcNow.Date.AddDays(1);
            var fromUtc = from.HasValue
                ? DateTime.SpecifyKind(from.Value.Date, DateTimeKind.Utc)
                : new DateTime(toUtc.Year, toUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-(months - 1));
            return (fromUtc, toUtc);
        }
    }
}
