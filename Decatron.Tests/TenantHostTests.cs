using Decatron.Services.Tenancy;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 8: slug.decatron.top elige el tenant; cualquier otro Host no.</summary>
public class TenantHostTests
{
    [Theory]
    [InlineData("prueba.decatron.top", "prueba")]
    [InlineData("PRUEBA.Decatron.Top", "prueba")]
    [InlineData("prueba.decatron.top.", "prueba")]
    [InlineData("mi-canal-2.decatron.top", "mi-canal-2")]
    public void HostDeTenant_DevuelveElSlug(string host, string slug) => Assert.Equal(slug, TenantResolver.SlugFromHost(host));

    [Theory]
    [InlineData("decatron.top")]
    [InlineData("www.decatron.top")]
    [InlineData("decatron.net")]
    [InlineData("prueba.decatron.net")]
    [InlineData("a.b.decatron.top")]
    [InlineData("-malo.decatron.top")]
    [InlineData("malo-.decatron.top")]
    [InlineData("mal_o.decatron.top")]
    [InlineData("evildecatron.top")]
    [InlineData("prueba.decatron.top.evil.com")]
    [InlineData("")]
    [InlineData(null)]
    public void OtrosHosts_NoEligenTenant(string? host) => Assert.Null(TenantResolver.SlugFromHost(host));
}
