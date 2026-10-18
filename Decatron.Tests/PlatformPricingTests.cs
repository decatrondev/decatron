using Decatron.Services.Tenancy;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 7.2: la función única de precios. Pura, no necesita base de datos. Los valores esperados son los de la tabla decidida (FASE5_DISENO.md §7) y los de la siembra de plan_prices.</summary>
public class PlatformPricingTests
{
    [Theory]
    [InlineData(9, 1, 9.00)] [InlineData(9, 12, 86.40)]
    [InlineData(19, 3, 54.15)] [InlineData(19, 6, 102.60)] [InlineData(19, 9, 145.35)] [InlineData(19, 12, 182.40)]
    [InlineData(39, 12, 374.40)] [InlineData(79, 12, 758.40)]
    [InlineData(8, 3, 22.80)] [InlineData(8, 12, 76.80)]
    public void PeriodTotal_matches_the_seeded_prices(decimal monthly, int months, decimal expected)
        => Assert.Equal(expected, PlatformPricing.PeriodTotal(monthly, months));

    [Theory]
    [InlineData(0)] [InlineData(2)] [InlineData(24)]
    public void Invalid_periods_are_rejected(int months)
    {
        Assert.False(PlatformPricing.IsValidPeriod(months));
        Assert.Throws<ArgumentOutOfRangeException>(() => PlatformPricing.PeriodTotal(19, months));
    }

    [Fact]
    public void Build_without_cap_adds_the_addons()
    {
        // Semilla (9) + Song Request (4) + Overlays (3) = 16 < Creator (19)
        var q = PlatformPricing.Build(9m, new[] { ("module.song_request", 4m), ("module.overlays", 3m) }, 19m);
        Assert.Equal(16m, q.TotalUsd);
        Assert.Equal(7m, q.AddonsUsd);
        Assert.False(q.Capped);
    }

    [Fact]
    public void Build_caps_the_total_at_the_next_plan()
    {
        // Los 5 modulos de Creator suman 14: 9 + 14 = 23 > 19, asi que subir de plan sale mas barato y el total se recorta.
        var addons = new[] { ("module.song_request", 4m), ("module.overlays", 3m), ("module.clips", 3m), ("module.giveaways", 2m), ("module.roulette", 2m) };
        var q = PlatformPricing.Build(9m, addons, 19m);
        Assert.Equal(19m, q.TotalUsd);
        Assert.Equal(10m, q.AddonsUsd);
        Assert.True(q.Capped);
        Assert.Equal(5, q.Addons.Count);   // las lineas se conservan; solo el total se recorta
    }

    [Fact]
    public void Build_at_exactly_the_next_plan_is_not_capped()
    {
        var q = PlatformPricing.Build(9m, new[] { ("a", 10m) }, 19m);
        Assert.Equal(19m, q.TotalUsd);
        Assert.False(q.Capped);
    }

    [Fact]
    public void Build_without_next_plan_has_no_cap()
    {
        var q = PlatformPricing.Build(79m, new[] { ("module.lol_coach", 12m), ("feature.api_v1", 8m), ("x", 500m) }, null);
        Assert.Equal(599m, q.TotalUsd);
        Assert.False(q.Capped);
    }

    [Fact]
    public void Build_never_goes_below_the_plan_price()
    {
        // Un plan mas caro que el siguiente (dato corrupto) no debe dar complementos negativos.
        var q = PlatformPricing.Build(50m, new[] { ("a", 5m) }, 40m);
        Assert.Equal(50m, q.TotalUsd);
        Assert.Equal(0m, q.AddonsUsd);
    }

    [Fact]
    public void Igv_is_split_out_of_a_total_that_already_includes_it()
    {
        var t = PlatformPricing.Split(19m, "igv");
        Assert.Equal(16.10m, t.Base);
        Assert.Equal(2.90m, t.Igv);
        Assert.Equal(19m, t.Base + t.Igv);
    }

    [Fact]
    public void Export_charges_the_same_list_price_with_no_igv()
    {
        var t = PlatformPricing.Split(19m, "export");
        Assert.Equal(19m, t.Base);
        Assert.Equal(0m, t.Igv);
    }

    [Fact]
    public void Unknown_tax_treatment_is_rejected() => Assert.Throws<ArgumentOutOfRangeException>(() => PlatformPricing.Split(19m, "otro"));

    [Fact]
    public void Pen_amount_uses_the_rate_and_rounds_to_centimos()
    {
        Assert.Equal(72.20m, PlatformPricing.ToPen(19m, 3.80m));
        Assert.Equal(7220, PlatformPricing.ToCentimos(72.20m));
        Assert.Equal(34.20m, PlatformPricing.ToPen(9m, 3.80m));
        Assert.Throws<ArgumentOutOfRangeException>(() => PlatformPricing.ToPen(9m, 0m));
    }

    [Fact]
    public void Upgrade_charges_the_prorated_difference()
    {
        // Creator (19) a Pro (39) con 15 de 30 dias restantes: (39 - 19) * 15 / 30 = 10
        Assert.Equal(10m, PlatformPricing.UpgradeCharge(39m, 19m, 30, 15));
        Assert.Equal(20m, PlatformPricing.UpgradeCharge(39m, 19m, 30, 30));
        Assert.Equal(0m, PlatformPricing.UpgradeCharge(39m, 19m, 30, 0));
        Assert.Equal(20m, PlatformPricing.UpgradeCharge(39m, 19m, 30, 99));   // mas dias que el periodo se recorta al periodo
    }

    [Fact]
    public void Downgrade_never_refunds() => Assert.Equal(0m, PlatformPricing.UpgradeCharge(19m, 39m, 30, 15));
}
