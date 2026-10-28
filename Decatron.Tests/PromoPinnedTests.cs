using Decatron.Core.Models.Promo;
using Decatron.Services.Promo;
using Xunit;

namespace Decatron.Tests;

/// <summary>Piezas fijas: con tarjetas propias en uso el streamer no puede apagarlas ni dejarlas más cortas o más chicas que el valor del dueño.</summary>
public class PromoPinnedTests
{
    private static PromoPiece P(long id, bool pinned) => new() { Id = id, IsPinned = pinned, DurationSeconds = 10, Zone = "corner", Status = "published", Weight = 1, TemplateId = 1 };
    private static readonly PromoOverlayLimits L = new() { MinDurationSeconds = 5, MaxDurationSeconds = 30, MinScalePercent = 60, MaxScalePercent = 150 };
    private static readonly PromoTemplate[] Tpls = { new() { Id = 1, Zone = "corner", IsEnabled = true } };

    [Fact(DisplayName = "Con tarjetas propias en uso, lo apagado no incluye las piezas fijas; sin ellas todo se respeta")]
    public void EffectiveDisabled_DropsPinnedOnlyWhenCardsInUse()
    {
        var pieces = new[] { P(1, true), P(2, false) };
        var off = new HashSet<long> { 1, 2 };
        Assert.Equal(new long[] { 2 }, PromoPlayback.EffectiveDisabled(off, pieces, true).ToArray());
        Assert.Equal(new long[] { 1, 2 }, PromoPlayback.EffectiveDisabled(off, pieces, false).OrderBy(x => x).ToArray());
    }

    [Fact(DisplayName = "Tarjetas propias en uso = encendidas y no ocultas por el dueño")]
    public void InUse_NeedsEnabledAndVisibleCard()
    {
        Assert.False(PromoOwnCards.InUse(new List<PromoOwnCard>()));
        Assert.False(PromoOwnCards.InUse(new[] { new PromoOwnCard { IsEnabled = false } }));
        Assert.False(PromoOwnCards.InUse(new[] { new PromoOwnCard { IsEnabled = true, HiddenByAdmin = true } }));
        Assert.True(PromoOwnCards.InUse(new[] { new PromoOwnCard { IsEnabled = true } }));
    }

    [Fact(DisplayName = "Una pieza fija bloqueada no baja de la duración ni del tamaño del dueño, pero puede subir")]
    public void ApplyToPiece_PinnedFloor()
    {
        var o = new PromoPieceOverride { DurationSeconds = 5, ScalePercent = 60 };
        var locked = PromoOverrides.ApplyToPiece(P(1, true), o, L, Tpls, pinnedLocked: true);
        Assert.Equal((10, 100), (locked.Piece.DurationSeconds, locked.ScalePercent));
        var up = PromoOverrides.ApplyToPiece(P(1, true), new PromoPieceOverride { DurationSeconds = 20, ScalePercent = 120 }, L, Tpls, pinnedLocked: true);
        Assert.Equal((20, 120), (up.Piece.DurationSeconds, up.ScalePercent));
        // Sin bloqueo, o si la pieza no es fija, el streamer decide.
        Assert.Equal((5, 60), (PromoOverrides.ApplyToPiece(P(1, true), o, L, Tpls).Piece.DurationSeconds, PromoOverrides.ApplyToPiece(P(1, true), o, L, Tpls).ScalePercent));
        Assert.Equal(5, PromoOverrides.ApplyToPiece(P(2, false), o, L, Tpls, pinnedLocked: true).Piece.DurationSeconds);
    }
}
