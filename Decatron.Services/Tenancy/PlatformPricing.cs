namespace Decatron.Services.Tenancy;

/// <summary>
/// Plataforma, Fase 7.2: la única función de precios (FASE7_DISENO.md, FASE5_DISENO.md §7). Pura: no toca la base ni la red.
/// Los precios de lista son USD con IGV incluido; el cobro se hace en soles al tipo de cambio de <c>finance_settings</c>.
/// El front solo muestra lo que esta clase calcula; nunca recalcula.
/// </summary>
public static class PlatformPricing
{
    public const decimal IgvRate = 0.18m;
    public static readonly int[] Periods = { 1, 3, 6, 9, 12 };

    public sealed record QuoteLine(string Key, decimal Usd);

    /// <param name="Capped">true cuando los complementos se recortaron para no superar el siguiente plan.</param>
    public sealed record Quote(decimal PlanUsd, IReadOnlyList<QuoteLine> Addons, decimal AddonsUsd, decimal TotalUsd, bool Capped);

    public sealed record TaxSplit(decimal Total, decimal Base, decimal Igv);

    public static bool IsValidPeriod(int months) => Array.IndexOf(Periods, months) >= 0;

    /// <summary>Descuento por periodo: 3 meses 5 %, 6 meses 10 %, 9 meses 15 %, 12 meses 20 %.</summary>
    public static decimal Discount(int months) => months switch
    {
        1 => 0m, 3 => 0.05m, 6 => 0.10m, 9 => 0.15m, 12 => 0.20m,
        _ => throw new ArgumentOutOfRangeException(nameof(months), months, "Periodo no válido (1, 3, 6, 9 o 12).")
    };

    /// <summary>Total de un periodo a partir del precio mensual de lista (igual que la siembra de plan_prices/addon_prices).</summary>
    public static decimal PeriodTotal(decimal monthlyUsd, int months)
        => Math.Round(monthlyUsd * months * (1 - Discount(months)), 2, MidpointRounding.AwayFromZero);

    /// <summary>
    /// Total de una compra: plan + complementos. Regla: la suma de complementos nunca hace que el total supere el precio del
    /// siguiente plan (mismo periodo); si lo supera, se recorta y <see cref="Quote.Capped"/> queda en true. Sin siguiente plan
    /// (Studio y Exclusivo) no hay tope.
    /// </summary>
    public static Quote Build(decimal planTotalUsd, IEnumerable<(string Key, decimal Usd)> addons, decimal? nextPlanTotalUsd)
    {
        var lines = addons.Select(a => new QuoteLine(a.Key, a.Usd)).ToList();
        var addonsSum = lines.Sum(l => l.Usd);
        var capped = false;
        if (nextPlanTotalUsd is { } next && planTotalUsd + addonsSum > next)
        {
            addonsSum = Math.Max(0m, next - planTotalUsd);
            capped = true;
        }
        return new Quote(planTotalUsd, lines, addonsSum, planTotalUsd + addonsSum, capped);
    }

    /// <summary>
    /// Separa el IGV de un total que ya lo incluye. <c>igv</c> (Perú): base = total / 1,18 e IGV = total − base.
    /// <c>export</c> (fuera de Perú): se cobra el mismo precio de lista, sin IGV.
    /// </summary>
    public static TaxSplit Split(decimal totalUsd, string taxTreatment)
    {
        if (taxTreatment == "export") return new TaxSplit(totalUsd, totalUsd, 0m);
        if (taxTreatment != "igv") throw new ArgumentOutOfRangeException(nameof(taxTreatment), taxTreatment, "Tratamiento no válido (igv o export).");
        var baseUsd = Math.Round(totalUsd / (1 + IgvRate), 2, MidpointRounding.AwayFromZero);
        return new TaxSplit(totalUsd, baseUsd, totalUsd - baseUsd);
    }

    /// <summary>Soles a cobrar: USD × tipo de cambio, a céntimos (igual que CreditPurchaseController).</summary>
    public static decimal ToPen(decimal usd, decimal penPerUsd)
    {
        if (penPerUsd <= 0) throw new ArgumentOutOfRangeException(nameof(penPerUsd), "Tipo de cambio no válido.");
        return Math.Round(usd * penPerUsd, 2, MidpointRounding.AwayFromZero);
    }

    public static int ToCentimos(decimal pen) => (int)Math.Round(pen * 100, MidpointRounding.AwayFromZero);

    /// <summary>
    /// Subir de plan a mitad de periodo: se cobra la diferencia entre el periodo nuevo y el actual, prorrateada por los días que
    /// faltan. Bajar nunca devuelve dinero (aplica al siguiente periodo): aquí da 0.
    /// </summary>
    public static decimal UpgradeCharge(decimal newPeriodUsd, decimal currentPeriodUsd, int periodDays, int remainingDays)
    {
        if (periodDays <= 0) throw new ArgumentOutOfRangeException(nameof(periodDays));
        var remaining = Math.Clamp(remainingDays, 0, periodDays);
        var diff = newPeriodUsd - currentPeriodUsd;
        return diff <= 0 ? 0m : Math.Round(diff * remaining / periodDays, 2, MidpointRounding.AwayFromZero);
    }
}
