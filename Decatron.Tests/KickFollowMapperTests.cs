using Decatron.Core.Helpers;
using Xunit;

namespace Decatron.Tests;

/// <summary>Follows de Kick: qué eventos se guardan como seguidor y con qué datos (reglas puras).</summary>
public class KickFollowMapperTests
{
    private static readonly DateTime Now = new(2026, 11, 3, 20, 0, 0, DateTimeKind.Utc);

    private static PlatformEvent Ev(PlatformEventType type = PlatformEventType.Follow, string? userId = "77", string? name = "Ana_Kick",
        bool anon = false, string broadcaster = "555", DateTime? at = null) =>
        new("id1", "kick", type, broadcaster, userId, name, anon, 0, 0, null, null, null, at);

    [Fact]
    public void FollowNormal_SeGuarda_ConLoginEnMinusculas()
    {
        var r = KickFollowMapper.FromEvent(Ev(at: new DateTime(2026, 11, 3, 19, 0, 0, DateTimeKind.Utc)), Now);
        Assert.NotNull(r);
        Assert.Equal("555", r!.BroadcasterId);
        Assert.Equal("77", r.UserId);
        Assert.Equal("Ana_Kick", r.UserName);
        Assert.Equal("ana_kick", r.UserLogin);
        Assert.Equal(new DateTime(2026, 11, 3, 19, 0, 0, DateTimeKind.Utc), r.FollowedAtUtc);
    }

    [Fact]
    public void SinFecha_UsaLaHoraActual()
        => Assert.Equal(Now, KickFollowMapper.FromEvent(Ev(), Now)!.FollowedAtUtc);

    [Fact]
    public void FechaSinZona_SeTrataComoUtc()
        => Assert.Equal(DateTimeKind.Utc, KickFollowMapper.FromEvent(Ev(at: new DateTime(2026, 11, 3, 10, 0, 0, DateTimeKind.Unspecified)), Now)!.FollowedAtUtc.Kind);

    [Theory]
    [InlineData(PlatformEventType.Subscription)]
    [InlineData(PlatformEventType.Kicks)]
    [InlineData(PlatformEventType.StreamStatus)]
    public void OtrosEventos_NoSeGuardan(PlatformEventType type)
        => Assert.Null(KickFollowMapper.FromEvent(Ev(type), Now));

    [Fact]
    public void Anonimo_NoSeGuarda()
        => Assert.Null(KickFollowMapper.FromEvent(Ev(anon: true), Now));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public void SinIdDeUsuario_NoSeGuarda(string? id)
        => Assert.Null(KickFollowMapper.FromEvent(Ev(userId: id), Now));

    [Fact]
    public void SinNombre_UsaElId()
    {
        var r = KickFollowMapper.FromEvent(Ev(name: null), Now)!;
        Assert.Equal("77", r.UserName);
        Assert.Equal("77", r.UserLogin);
    }

    [Fact]
    public void Nulo_NoSeGuarda() => Assert.Null(KickFollowMapper.FromEvent(null, Now));
}
