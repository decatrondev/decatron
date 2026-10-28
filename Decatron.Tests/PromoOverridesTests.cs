using System.Collections.Generic;
using Decatron.Core.Models.Promo;
using Decatron.Services.Promo;
using Xunit;

namespace Decatron.Tests;

/// <summary>Promociones: mezcla del valor del dueño, lo del streamer y los límites (sin base de datos).</summary>
public class PromoOverridesTests
{
    private static readonly PromoOverlayLimits L = new() { MinDurationSeconds = 5, MaxDurationSeconds = 30, MinScalePercent = 60, MaxScalePercent = 150, MaxZoneMargin = 300 };
    private static readonly List<PromoTemplate> Tpls = new()
    {
        new() { Id = 1, Zone = "corner", IsEnabled = true }, new() { Id = 2, Zone = "corner", IsEnabled = true },
        new() { Id = 3, Zone = "banner", IsEnabled = true }, new() { Id = 4, Zone = "corner", IsEnabled = false },
    };
    private static PromoPiece P() => new() { Id = 10, Zone = "corner", TemplateId = 1, DurationSeconds = 8, Status = "published", Weight = 1 };

    [Fact(DisplayName = "Promo override: sin cambios del streamer queda el valor del dueño")]
    public void SinCambios()
    {
        var r = PromoOverrides.ApplyToPiece(P(), null, L, Tpls);
        Assert.Equal(8, r.Piece.DurationSeconds); Assert.Equal(100, r.ScalePercent);
    }

    [Fact(DisplayName = "Promo override: duración, plantilla y escala del streamer se aplican en una copia")]
    public void Aplica()
    {
        var orig = P();
        var r = PromoOverrides.ApplyToPiece(orig, new PromoPieceOverride { PieceId = 10, DurationSeconds = 20, TemplateId = 2, ScalePercent = 120 }, L, Tpls);
        Assert.Equal(20, r.Piece.DurationSeconds); Assert.Equal(2, r.Piece.TemplateId); Assert.Equal(120, r.ScalePercent);
        Assert.Equal(8, orig.DurationSeconds); Assert.Equal(1, orig.TemplateId);
    }

    [Fact(DisplayName = "Promo override: los límites mandan aunque lo guardado esté fuera de rango")]
    public void LimitesMandan()
    {
        var r = PromoOverrides.ApplyToPiece(P(), new PromoPieceOverride { DurationSeconds = 2, ScalePercent = 400 }, L, Tpls);
        Assert.Equal(5, r.Piece.DurationSeconds); Assert.Equal(150, r.ScalePercent);
        Assert.Equal(30, PromoOverrides.ApplyToPiece(P(), new PromoPieceOverride { DurationSeconds = 200 }, L, Tpls).Piece.DurationSeconds);
    }

    [Fact(DisplayName = "Promo override: una plantilla de otra zona, apagada o inexistente se ignora")]
    public void PlantillaInvalida()
    {
        foreach (var id in new long[] { 3, 4, 99 })
            Assert.Equal(1, PromoOverrides.ApplyToPiece(P(), new PromoPieceOverride { TemplateId = id }, L, Tpls).Piece.TemplateId);
    }

    [Fact(DisplayName = "Promo override: el valor del dueño fuera del rango no se toca si el streamer no cambió nada")]
    public void DuenoFueraDeRango()
    {
        var p = P(); p.DurationSeconds = 3;
        Assert.Equal(3, PromoOverrides.ApplyToPiece(p, new PromoPieceOverride { ScalePercent = 100 }, L, Tpls).Piece.DurationSeconds);
    }

    [Fact(DisplayName = "Promo override: la zona del streamer se aplica con márgenes recortados")]
    public void Zona()
    {
        var z = new PromoZone { Key = "corner", Anchor = "top-right", MarginX = 96, MarginY = 54 };
        Assert.Same(z, PromoOverrides.ApplyToZone(z, null, L));
        var r = PromoOverrides.ApplyToZone(z, new PromoZoneOverride { ZoneKey = "corner", Anchor = "bottom-left", MarginX = 500, MarginY = 40 }, L);
        Assert.Equal("bottom-left", r.Anchor); Assert.Equal(300, r.MarginX); Assert.Equal(40, r.MarginY);
        Assert.Same(z, PromoOverrides.ApplyToZone(z, new PromoZoneOverride { Anchor = "diagonal" }, L));
    }

    [Fact(DisplayName = "Promo override: al guardar se rechaza lo que sale de los límites")]
    public void Validacion()
    {
        Assert.Empty(PromoOverrides.ValidatePiece(10, 100, 2, P(), L, Tpls));
        Assert.Contains("durationRange", PromoOverrides.ValidatePiece(4, null, null, P(), L, Tpls));
        Assert.Contains("scaleRange", PromoOverrides.ValidatePiece(null, 200, null, P(), L, Tpls));
        Assert.Contains("templateInvalid", PromoOverrides.ValidatePiece(null, null, 3, P(), L, Tpls));
        Assert.Empty(PromoOverrides.ValidateZone("center", 0, 300, L));
        Assert.Contains("marginRange", PromoOverrides.ValidateZone("center", 301, 0, L));
        Assert.Contains("anchorInvalid", PromoOverrides.ValidateZone("x", 0, 0, L));
    }

    [Fact(DisplayName = "Promo override: coherencia de los límites del dueño")]
    public void LimitesDelDueno()
    {
        Assert.Empty(PromoOverrides.ValidateLimits(L));
        Assert.NotEmpty(PromoOverrides.ValidateLimits(new PromoOverlayLimits { MinDurationSeconds = 30, MaxDurationSeconds = 10 }));
        Assert.NotEmpty(PromoOverrides.ValidateLimits(new PromoOverlayLimits { MinScalePercent = 10 }));
        Assert.NotEmpty(PromoOverrides.ValidateLimits(new PromoOverlayLimits { MaxZoneMargin = 2000 }));
    }
}
