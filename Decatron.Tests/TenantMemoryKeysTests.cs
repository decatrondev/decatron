using Decatron.Core.Interfaces;
using Decatron.Core.Services.Moderation;
using Xunit;

namespace Decatron.Tests;

public class TenantMemoryKeysTests
{
    [Fact]
    public void Key_SinTenant_CaeAlUno_YNormalizaMayusculas()
    {
        Assert.Equal("1|canal", TenantAmbient.Key("Canal"));
    }

    [Fact]
    public void Key_DistingueTenants()
    {
        string a, b;
        using (TenantAmbient.Push(9101)) a = TenantAmbient.Key("canal");
        using (TenantAmbient.Push(9102)) b = TenantAmbient.Key("canal");
        Assert.NotEqual(a, b);
    }

    [Fact]
    public void ModoPanico_NoSeFiltraEntreTenants()
    {
        using (TenantAmbient.Push(9101)) PanicRegistry.Set("zzcanal", System.DateTime.Now.AddMinutes(5));
        using (TenantAmbient.Push(9102)) Assert.False(PanicRegistry.IsActive("zzcanal"));
        using (TenantAmbient.Push(9101)) { Assert.True(PanicRegistry.IsActive("zzcanal")); PanicRegistry.Clear("zzcanal"); }
    }

    [Fact]
    public void ChatReciente_NoSeMezclaEntreTenants()
    {
        using (TenantAmbient.Push(9101)) RecentChatBuffer.Add("zzchat", "ana", "hola");
        using (TenantAmbient.Push(9102)) Assert.Empty(RecentChatBuffer.Since("zzchat", System.TimeSpan.FromMinutes(1)));
        using (TenantAmbient.Push(9101)) Assert.Single(RecentChatBuffer.Since("zzchat", System.TimeSpan.FromMinutes(1)));
    }
}
