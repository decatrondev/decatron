using Decatron.Core.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 5.3/5.4: [RequiresModule] responde 403 module_not_included cuando el plan no trae el módulo, y deja pasar si lo trae.</summary>
public class RequiresModuleTests
{
    private sealed class Ent(bool has) : IEntitlements
    {
        public string? AskedFlag; public long? AskedTenant;
        public Task<bool> IsOperationalAsync(long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult(true);
        public Task<bool> HasAsync(string f, long? t = null, bool live = false, CancellationToken ct = default) { AskedFlag = f; AskedTenant = t; return Task.FromResult(has); }
        public Task<(bool Operational, decimal? Limit)> LimitAsync(string k, long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult((true, (decimal?)null));
        public Task<EntitlementResult> TryConsumeAsync(string k, long a = 1, long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult(EntitlementResult.Ok());
        public Task<EntitlementResult> CheckGaugeAsync(string k, long c, long a = 1, long? t = null, CancellationToken ct = default) => Task.FromResult(EntitlementResult.Ok());
        public void Invalidate(long? t = null) { }
    }

    private sealed class Ctx(long id) : ITenantContext
    {
        public long TenantId => id; public bool IsResolved => true; public TenantSource Source => TenantSource.User;
        public void Set(TenantResolution r) { }
    }

    private static async Task<(ActionExecutingContext ctx, bool nextCalled)> Run(Ent ent, long tenant)
    {
        var sp = new ServiceCollection().AddSingleton<IEntitlements>(ent).AddSingleton<ITenantContext>(new Ctx(tenant)).BuildServiceProvider();
        var http = new DefaultHttpContext { RequestServices = sp };
        var ac = new ActionContext(http, new RouteData(), new ActionDescriptor());
        var ctx = new ActionExecutingContext(ac, new List<IFilterMetadata>(), new Dictionary<string, object?>(), new object());
        var called = false;
        await new RequiresModuleAttribute("module.song_request").OnActionExecutionAsync(ctx, () =>
        {
            called = true;
            return Task.FromResult(new ActionExecutedContext(ac, new List<IFilterMetadata>(), new object()));
        });
        return (ctx, called);
    }

    [Fact(DisplayName = "Módulo no incluido: 403 module_not_included y la acción no corre")]
    public async Task SinModulo_403()
    {
        var ent = new Ent(false);
        var (ctx, called) = await Run(ent, 2);
        Assert.False(called);
        var res = Assert.IsType<ObjectResult>(ctx.Result);
        Assert.Equal(403, res.StatusCode);
        Assert.Contains("module_not_included", System.Text.Json.JsonSerializer.Serialize(res.Value));
        Assert.Equal("module.song_request", ent.AskedFlag);
        Assert.Equal(2, ent.AskedTenant);
    }

    [Fact(DisplayName = "Módulo incluido: la acción corre")]
    public async Task ConModulo_Pasa()
    {
        var (ctx, called) = await Run(new Ent(true), 2);
        Assert.True(called);
        Assert.Null(ctx.Result);
    }
}
