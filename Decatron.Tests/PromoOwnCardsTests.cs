using System;
using System.Collections.Generic;
using System.Linq;
using Decatron.Core.Models.Promo;
using Decatron.Services.Promo;
using Xunit;

namespace Decatron.Tests;

/// <summary>Promociones F3a: tarjetas propias del streamer (cantidades por tier, validación, proporción con el bot e intervalo).</summary>
public class PromoOwnCardsTests
{
    private static readonly PromoOverlayLimits L = new() { MinDurationSeconds = 5, MaxDurationSeconds = 60, BotPerOwn = 1, OwnMinIntervalMinutes = 5, MinGapSeconds = 60, HourlyCapSeconds = 600 };
    private static readonly List<PromoZone> Zones = new() { new PromoZone { Key = "corner", IsEnabled = true } };
    private static readonly List<PromoTemplate> Templates = new() { new PromoTemplate { Id = 7, Zone = "corner", IsEnabled = true } };
    private static readonly DateTime Now = new(2026, 10, 29, 12, 0, 0, DateTimeKind.Utc);

    private static PromoOwnCard Card(long id = 1) => new() { Id = id, Title = "Sígueme", Body = "Hola a todos", Zone = "corner", DurationSeconds = 8, IntervalMinutes = 10, IsEnabled = true };

    [Theory(DisplayName = "Promo tarjetas propias: cantidades por tier (solo cantidades)")]
    [InlineData(null, 3)] [InlineData("free", 3)] [InlineData("supporter", 10)] [InlineData("premium", 25)] [InlineData("patrocinador", 50)] [InlineData("fundador", 200)] [InlineData("admin", 200)]
    public void Cantidades(string? tier, int max) => Assert.Equal(max, PromoOwnCards.MaxCards(tier));

    [Fact(DisplayName = "Promo tarjetas propias: una tarjeta sana pasa la validación")]
    public void Sana() => Assert.Empty(PromoOwnCards.Validate(Card(), L, Zones));

    [Fact(DisplayName = "Promo tarjetas propias: se rechaza lo que llegaría a HTML, enlaces o fuera de rango")]
    public void Mala()
    {
        void Has(PromoOwnCard c, string code) { PromoOwnCards.Normalize(c); Assert.Contains(code, PromoOwnCards.Validate(c, L, Zones)); }
        Has(new PromoOwnCard { Title = "<b>x</b>", Zone = "corner", DurationSeconds = 8, IntervalMinutes = 10 }, "noAngleBrackets");
        Has(new PromoOwnCard { Title = "x", LinkUrl = "http://x.com", Zone = "corner", DurationSeconds = 8, IntervalMinutes = 10 }, "linkInvalid");
        Has(new PromoOwnCard { Title = "x", LinkUrl = "javascript:alert(1)", Zone = "corner", DurationSeconds = 8, IntervalMinutes = 10 }, "linkInvalid");
        Has(new PromoOwnCard { Title = "x", ShowQr = true, Zone = "corner", DurationSeconds = 8, IntervalMinutes = 10 }, "qrNeedsLink");
        Has(new PromoOwnCard { Title = "{{secreto}}", Zone = "corner", DurationSeconds = 8, IntervalMinutes = 10 }, "unknownVariable");
        Has(new PromoOwnCard { Title = "x", Icon = "no-existe", Zone = "corner", DurationSeconds = 8, IntervalMinutes = 10 }, "iconInvalid");
        Has(new PromoOwnCard { Title = "x", Zone = "nada", DurationSeconds = 8, IntervalMinutes = 10 }, "zoneInvalid");
        Has(new PromoOwnCard { Title = "x", Zone = "corner", DurationSeconds = 1, IntervalMinutes = 10 }, "durationRange");
        Has(new PromoOwnCard { Title = "x", Zone = "corner", DurationSeconds = 8, IntervalMinutes = 1 }, "intervalRange");
        Has(new PromoOwnCard { Title = "", Body = "", Zone = "corner", DurationSeconds = 8, IntervalMinutes = 10 }, "titleOrBodyRequired");
        Has(new PromoOwnCard { Title = new string('a', 81), Zone = "corner", DurationSeconds = 8, IntervalMinutes = 10 }, "titleTooLong");
    }

    [Fact(DisplayName = "Promo tarjetas propias: la pieza lleva id negativo, origen propio y la plantilla de su zona")]
    public void APieza()
    {
        var p = PromoOwnCards.ToPiece(Card(5), Templates, L);
        Assert.Equal(-5, p.Id);
        Assert.True(PromoOwnCards.IsOwnPieceId(p.Id));
        Assert.Equal("own", p.Origin);
        Assert.Equal(7, p.TemplateId);
        Assert.Null(PromoOwnCards.ToPiece(Card(), new List<PromoTemplate>(), L).TemplateId);
    }

    [Theory(DisplayName = "Promo tarjetas propias: solo toca una propia después de las del bot que fija el dueño, y nunca sin pieza del bot")]
    [InlineData(0, 3, 1, false)] // la primera siempre es del bot
    [InlineData(1, 3, 1, true)]
    [InlineData(1, 0, 1, false)] // sin nada del bot activo no hay propias
    [InlineData(2, 3, 3, false)]
    [InlineData(3, 3, 3, true)]
    public void Turno(int sinceOwn, int botCount, int ratio, bool turn) =>
        Assert.Equal(turn, PromoOwnCards.OwnTurn(sinceOwn, botCount, new PromoOverlayLimits { BotPerOwn = ratio }));

    [Fact(DisplayName = "Promo tarjetas propias: respeta el intervalo, lo apagado y lo oculto por el dueño")]
    public void Elegibles()
    {
        var a = Card(1); var b = Card(2); b.IsEnabled = false; var c = Card(3); c.HiddenByAdmin = true; var d = Card(4);
        var last = new Dictionary<long, DateTime> { [4] = Now.AddMinutes(-3) };
        var ids = PromoOwnCards.Eligible(new[] { a, b, c, d }, "corner", L, Templates, last, Now).Select(x => x.Id).ToList();
        Assert.Equal(new long[] { 1 }, ids);
        last[4] = Now.AddMinutes(-11);
        Assert.Contains(4, PromoOwnCards.Eligible(new[] { d }, "corner", L, Templates, last, Now).Select(x => x.Id));
    }

    [Fact(DisplayName = "Promo tarjetas propias: no repite la anterior si hay otra")]
    public void NoRepite()
    {
        var cards = new List<PromoOwnCard> { Card(1), Card(2) };
        Assert.Equal(2, PromoOwnCards.Pick(cards, -1, 0.0)!.Id);
        Assert.Equal(1, PromoOwnCards.Pick(new List<PromoOwnCard> { Card(1) }, -1, 0.0)!.Id);
        Assert.Null(PromoOwnCards.Pick(new List<PromoOwnCard>(), null, 0.5));
    }

    [Fact(DisplayName = "Promo tarjetas propias: la rotación alterna bot y propia y el contador se reinicia")]
    public void Alterna()
    {
        var s = new PromoPlayback.State();
        var bot = new PromoPiece { Id = 10, Zone = "corner", DurationSeconds = 8 };
        var own = PromoOwnCards.ToPiece(Card(3), Templates, L);
        Assert.False(PromoOwnCards.OwnTurn(s.BotSinceOwn, 1, L));
        PromoPlayback.MarkShown(s, bot, L, Now);
        Assert.True(PromoOwnCards.OwnTurn(s.BotSinceOwn, 1, L));
        PromoPlayback.MarkShown(s, own, L, Now.AddMinutes(1));
        Assert.False(PromoOwnCards.OwnTurn(s.BotSinceOwn, 1, L));
        Assert.Equal(Now.AddMinutes(1), s.OwnLastShown[3]);
    }
}
