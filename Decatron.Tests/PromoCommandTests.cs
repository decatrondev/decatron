using System;
using System.Collections.Generic;
using Decatron.Core.Models.Promo;
using Decatron.Services.Promo;
using Xunit;

namespace Decatron.Tests;

/// <summary>Promociones: reglas puras del comando de chat (!dpromo): nombre, permisos, búsqueda por nombre y pieza pedida.</summary>
public class PromoCommandTests
{
    private static readonly DateTime Now = new(2026, 10, 28, 12, 0, 0, DateTimeKind.Utc);

    private static PromoPiece P(long id, string es, string en = "") => new() { Id = id, Zone = "corner", TitleEs = es, TitleEn = en };

    [Theory(DisplayName = "Promo cmd: nombre válido")]
    [InlineData("dpromo", "dpromo")]
    [InlineData("!Promos", "promos")]
    [InlineData("  !mi_promo ", "mi_promo")]
    [InlineData("a", null)]
    [InlineData("con espacio", null)]
    [InlineData("tildeñ", null)]
    [InlineData("", null)]
    public void Nombre(string raw, string? esperado) => Assert.Equal(esperado, PromoCommand.NormalizeName(raw));

    [Fact(DisplayName = "Promo cmd: streamer y Lead Moderator siempre pueden")]
    public void SiempreStreamer()
    {
        Assert.True(PromoCommand.IsAllowed("moderator", true, false, false, false, false));
        Assert.True(PromoCommand.IsAllowed("moderator", false, true, false, false, false));
    }

    [Fact(DisplayName = "Promo cmd: el rol mínimo se respeta")]
    public void Roles()
    {
        Assert.True(PromoCommand.IsAllowed("moderator", false, false, true, false, false));
        Assert.False(PromoCommand.IsAllowed("moderator", false, false, false, true, true));
        Assert.True(PromoCommand.IsAllowed("vip", false, false, false, true, false));
        Assert.False(PromoCommand.IsAllowed("vip", false, false, false, false, true));
        Assert.True(PromoCommand.IsAllowed("subscriber", false, false, false, false, true));
        Assert.False(PromoCommand.IsAllowed("subscriber", false, false, false, false, false));
        Assert.True(PromoCommand.IsAllowed("everyone", false, false, false, false, false));
    }

    [Fact(DisplayName = "Promo cmd: busca por nombre sin mayúsculas ni tildes, exacto antes que parcial")]
    public void Busqueda()
    {
        var piezas = new List<PromoPiece> { P(1, "Discord de la comunidad"), P(2, "Discord"), P(3, "Síguenos en redes", "Follow us") };
        Assert.Equal(2, PromoCommand.FindByName(piezas, "DISCORD")!.Id);
        Assert.Equal(3, PromoCommand.FindByName(piezas, "siguenos")!.Id);
        Assert.Equal(3, PromoCommand.FindByName(piezas, "follow")!.Id);
        Assert.Equal(1, PromoCommand.FindByName(piezas, "comunidad")!.Id);
        Assert.Null(PromoCommand.FindByName(piezas, "youtube"));
        Assert.Null(PromoCommand.FindByName(piezas, "  "));
    }

    [Fact(DisplayName = "Promo cmd: sin título se usa el comienzo del texto")]
    public void NombreVisible()
    {
        var p = P(1, ""); p.BodyEs = "Únete al Discord y participa";
        Assert.Equal("Únete al Discord y participa", PromoCommand.DisplayName(p, false));
        Assert.Equal("Hola", PromoCommand.DisplayName(P(2, "Hola", "Hi"), false));
        Assert.Equal("Hi", PromoCommand.DisplayName(P(2, "Hola", "Hi"), true));
    }

    [Fact(DisplayName = "Promo cmd: la pieza pedida sale una vez y vence")]
    public void Pedida()
    {
        var st = new PromoPlayback.State();
        PromoCommand.Force(st, P(7, "x"), Now);
        Assert.Equal(7, PromoCommand.TakeForced(st, "corner", Now.AddSeconds(5)));
        Assert.Null(PromoCommand.TakeForced(st, "corner", Now.AddSeconds(6)));
        PromoCommand.Force(st, P(8, "y"), Now);
        Assert.Null(PromoCommand.TakeForced(st, "banner", Now));
        Assert.Null(PromoCommand.TakeForced(st, "corner", Now.AddMinutes(5)));
    }
}
