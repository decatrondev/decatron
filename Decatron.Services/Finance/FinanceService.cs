using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models.Finance;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.Finance
{
    /// <summary>Un cobro real de la plataforma, venga de donde venga.</summary>
    public sealed record IncomeRow(
        string Source, long Id, long? UserId, string? Login, DateTime At,
        decimal AmountPen, decimal AmountUsd, string Gateway, string? ChargeId,
        string? InvoiceStatus, string? InvoiceType, string? InvoiceNumber, int? InvoiceDocumentId,
        string Concept);

    public sealed record PnlLine(string Key, decimal Pen, decimal Usd, int Count);

    /// <summary>
    /// El P&L de la plataforma. Une los tres orígenes de cobro (tiers y donaciones de
    /// supporters, DecaCoins y créditos) sin migrar nada: cada uno guarda lo suyo, esto
    /// solo lee. Siempre fuera lo marcado como prueba.
    ///
    /// Los tips de los espectadores NO entran: el PayPal que los recibe es el del
    /// streamer (tips_configs.paypal_email), así que es dinero de terceros que nunca pasa
    /// por la cuenta de la plataforma. Se exponen aparte, como informativo.
    ///
    /// Plan: .dev/plans/FINANZAS_PLAN.md
    /// </summary>
    public class FinanceService
    {
        private readonly DecatronDbContext _db;

        public FinanceService(DecatronDbContext db) => _db = db;

        public async Task<FinanceSettings> GetSettingsAsync(CancellationToken ct = default) =>
            await _db.FinanceSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Id == 1, ct) ?? new FinanceSettings();

        /// <summary>Todos los cobros reales del rango, ordenados del más nuevo al más viejo.</summary>
        public async Task<List<IncomeRow>> IncomeAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct = default)
        {
            var settings = await GetSettingsAsync(ct);
            var rate = settings.PenPerUsd <= 0 ? 3.8m : settings.PenPerUsd;
            var rows = new List<IncomeRow>();

            // 1. Supporters: tiers y donaciones de la página pública (Culqi o PayPal).
            var sup = await _db.SupporterPayments.AsNoTracking()
                .Where(p => !p.IsTest && p.CapturedAt >= fromUtc && p.CapturedAt < toUtc)
                .ToListAsync(ct);
            var supIds = sup.Where(p => p.UserId != null).Select(p => p.UserId!.Value).Distinct().ToList();
            var logins = await _db.Users.AsNoTracking().Where(u => supIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Login, ct);
            foreach (var p in sup)
            {
                // ChargedAmount es lo que cobró la pasarela (soles). Los pagos viejos de
                // PayPal solo tienen el importe en dólares: se convierte al tipo de cambio.
                var pen = p.ChargedAmount ?? p.Amount * rate;
                var isDonation = string.Equals(p.PaymentType, "donation", StringComparison.OrdinalIgnoreCase);
                rows.Add(new IncomeRow(
                    isDonation ? "donation" : "tier", p.Id, p.UserId,
                    p.UserId != null ? logins.GetValueOrDefault(p.UserId.Value) : p.TwitchLogin,
                    DateTime.SpecifyKind(p.CapturedAt, DateTimeKind.Utc),
                    pen, pen / rate, p.Provider ?? "paypal", p.PaypalOrderId,
                    p.InvoiceStatus, p.InvoiceType, Number(p.InvoiceSeries, p.InvoiceNumber), p.InvoiceDocumentId,
                    isDonation ? "Donación" : $"Tier {p.Tier}"));
            }

            // 2. DecaCoins.
            var coins = await _db.CoinPurchases.AsNoTracking()
                .Where(p => !p.IsTest && p.CreatedAt >= fromUtc && p.CreatedAt < toUtc)
                .ToListAsync(ct);
            var coinIds = coins.Select(p => p.UserId).Distinct().ToList();
            var coinLogins = await _db.Users.AsNoTracking().Where(u => coinIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Login, ct);
            foreach (var p in coins)
            {
                var pen = p.ChargedAmount ?? p.AmountPaidUsd * rate;
                rows.Add(new IncomeRow("coins", p.Id, p.UserId, coinLogins.GetValueOrDefault(p.UserId),
                    DateTime.SpecifyKind(p.CreatedAt, DateTimeKind.Utc), pen, pen / rate,
                    p.PaypalOrderId != null && p.PaypalOrderId.StartsWith("chr_") ? "culqi" : "paypal", p.PaypalOrderId,
                    p.InvoiceStatus, p.InvoiceType, Number(p.InvoiceSeries, p.InvoiceNumber), p.InvoiceDocumentId,
                    $"{p.CoinsReceived:N0} DecaCoins"));
            }

            // 3. Créditos.
            var credits = await _db.CreditPurchases.AsNoTracking()
                .Where(p => !p.IsTest && p.CreatedAt >= fromUtc && p.CreatedAt < toUtc)
                .ToListAsync(ct);
            var credIds = credits.Select(p => p.UserId).Distinct().ToList();
            var credLogins = await _db.Users.AsNoTracking().Where(u => credIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Login, ct);
            foreach (var p in credits)
            {
                var pen = p.ChargedAmount ?? p.AmountPaidUsd * rate;
                rows.Add(new IncomeRow("credits", p.Id, p.UserId, credLogins.GetValueOrDefault(p.UserId),
                    DateTime.SpecifyKind(p.CreatedAt, DateTimeKind.Utc), pen, pen / rate, "culqi", p.ChargeId,
                    p.InvoiceStatus, p.InvoiceType, Number(p.InvoiceSeries, p.InvoiceNumber), p.InvoiceDocumentId,
                    $"{p.CreditsReceived:N0} créditos"));
            }

            return rows.OrderByDescending(r => r.At).ToList();
        }

        private static string? Number(string? series, int? number) =>
            series == null || number == null ? null : $"{series}-{number.Value:D8}";

        /// <summary>Costos variables del rango, en dólares: lo que le cuesta a la plataforma atender a sus canales.</summary>
        public async Task<List<PnlLine>> VariableCostsAsync(DateTime fromUtc, DateTime toUtc, decimal rate, CancellationToken ct = default)
        {
            // IA: el costo ya viene estimado (o real) por llamada.
            var ai = await _db.AiUsageLogs.AsNoTracking()
                .Where(l => l.Success && l.UsedAt >= fromUtc && l.UsedAt < toUtc)
                .GroupBy(l => 1)
                .Select(g => new { usd = g.Sum(l => l.EstimatedCostUsd), n = g.Count() })
                .FirstOrDefaultAsync(ct);

            // Voz y STT: los créditos consumidos del bucket premium equivalen a dólares
            // reales por la misma ancla que usa AiCreditGate (1 crédito = $0.000004).
            var creditUsd = Decatron.Services.AI.AiCreditGate.CreditUsd;
            var fromOffset = new DateTimeOffset(fromUtc, TimeSpan.Zero);
            var toOffset = new DateTimeOffset(toUtc, TimeSpan.Zero);
            var byFeature = await _db.TtsCreditLedger.AsNoTracking()
                .Where(e => e.Type == "consume" && (e.Bucket == "monthly" || e.Bucket == "purchased")
                            && e.CreatedAt >= fromOffset && e.CreatedAt < toOffset)
                .GroupBy(e => e.Feature)
                .Select(g => new { feature = g.Key ?? "other", credits = -g.Sum(e => e.Credits), n = g.Count() })
                .ToListAsync(ct);

            var lines = new List<PnlLine>();
            if (ai != null && ai.usd > 0)
                lines.Add(new PnlLine("ai", ai.usd * rate, ai.usd, ai.n));
            foreach (var f in byFeature.Where(f => f.credits > 0))
            {
                // La IA ya se contó arriba por su costo real: sus créditos no se vuelven a sumar.
                if (f.feature.EndsWith("_ai", StringComparison.Ordinal)) continue;
                var usd = f.credits * creditUsd;
                lines.Add(new PnlLine(f.feature, usd * rate, usd, f.n));
            }
            return lines.OrderByDescending(l => l.Usd).ToList();
        }

        /// <summary>Costos fijos prorrateados a los meses que toca el rango.</summary>
        public async Task<List<PnlLine>> FixedCostsAsync(DateTime fromUtc, DateTime toUtc, decimal rate, CancellationToken ct = default)
        {
            var from = DateOnly.FromDateTime(fromUtc);
            var to = DateOnly.FromDateTime(toUtc.AddDays(-1));
            var costs = await _db.FixedCosts.AsNoTracking()
                .Where(c => c.StartsOn <= to && (c.EndsOn == null || c.EndsOn >= from))
                .ToListAsync(ct);

            var months = MonthsBetween(from, to);
            var lines = new List<PnlLine>();
            foreach (var c in costs)
            {
                var monthly = c.Periodicity switch
                {
                    "yearly" => c.Amount / 12m,
                    "one_time" => 0m, // los únicos se cuentan enteros en su mes, abajo
                    _ => c.Amount,
                };
                var amount = c.Periodicity == "one_time"
                    ? (c.StartsOn >= from && c.StartsOn <= to ? c.Amount : 0m)
                    : monthly * months;
                if (amount <= 0) continue;
                var usd = c.Currency == "PEN" ? amount / rate : amount;
                lines.Add(new PnlLine(c.Concept, usd * rate, usd, 1));
            }
            return lines.OrderByDescending(l => l.Usd).ToList();
        }

        /// <summary>Meses (con decimales) que cubre el rango, para prorratear lo fijo.</summary>
        private static decimal MonthsBetween(DateOnly from, DateOnly to) =>
            Math.Max(0m, (decimal)(to.ToDateTime(TimeOnly.MinValue) - from.ToDateTime(TimeOnly.MinValue)).TotalDays + 1m) / 30.4375m;

        /// <summary>
        /// Comisión de la pasarela por un cobro. Culqi cobra un % del importe más una parte
        /// fija, y sobre esa comisión va IGV. PayPal no está parametrizado: se usa la misma
        /// fórmula, que es la que el usuario puede ajustar.
        /// </summary>
        public static decimal GatewayFee(decimal amountPen, FinanceSettings s)
        {
            var fee = amountPen * (s.GatewayPercent / 100m) + s.GatewayFixedPen;
            if (s.GatewayFeeHasIgv) fee *= 1 + s.IgvPercent / 100m;
            return Math.Round(fee, 2);
        }

        /// <summary>
        /// IGV contenido en un importe cobrado. En Perú el precio al público ya lo incluye:
        /// de S/ 118 cobrados, S/ 18 son impuesto y S/ 100 son ingreso.
        /// </summary>
        public static decimal IgvIncluded(decimal amountPen, FinanceSettings s)
        {
            var f = s.IgvPercent / 100m;
            return Math.Round(amountPen - amountPen / (1 + f), 2);
        }
    }
}
