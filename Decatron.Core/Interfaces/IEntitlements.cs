using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;

namespace Decatron.Core.Interfaces;

/// <summary>Resultado de consumir o comprobar una capacidad.</summary>
public enum EntitlementOutcome { Allowed, AllowedWarn80, Blocked }

public readonly record struct EntitlementResult(EntitlementOutcome Outcome, long Used, decimal? Limit, string? Reason = null)
{
    public bool IsAllowed => Outcome != EntitlementOutcome.Blocked;
    public static EntitlementResult Ok(long used = 0, decimal? limit = null) => new(EntitlementOutcome.Allowed, used, limit);
}

/// <summary>
/// Plataforma, Fase 5: UN solo punto de cumplimiento de planes y capacidades. Valor = override vigente > complemento vigente > plan > default de la capacidad.
/// El tenant #1 (plan interno) siempre pasa sin tocar la base. Sin <c>tenantId</c> se usa el tenant ambiente (<see cref="TenantAmbient"/>, 1 si no hay).
/// Falla cerrado para altas y abierto para lo que ya funciona en vivo (<c>live: true</c>): si la base no responde y no hay valor en caché,
/// lo nuevo se niega y lo en vivo se permite (y se registra).
/// </summary>
public interface IEntitlements
{
    /// <summary>El tenant puede operar (sandbox vigente, activo, o vencido dentro de la gracia). Suspendido/cancelado/sandbox vencido = false.</summary>
    Task<bool> IsOperationalAsync(long? tenantId = null, bool live = false, CancellationToken ct = default);

    /// <summary>Capacidad de tipo bandera (módulos, features, byo.*). Falso si el tenant no puede operar.</summary>
    Task<bool> HasAsync(string flag, long? tenantId = null, bool live = false, CancellationToken ct = default);

    /// <summary>Tope vigente de una cuota. null = ilimitado. <c>(false, _)</c> si el tenant no puede operar.</summary>
    Task<(bool Operational, decimal? Limit)> LimitAsync(string key, long? tenantId = null, bool live = false, CancellationToken ct = default);

    /// <summary>Contadores por periodo (mensajes, correos…): suma <paramref name="amount"/> de forma atómica si cabe; al pasar el 80 % avisa (una vez) y al 100 % bloquea.</summary>
    Task<EntitlementResult> TryConsumeAsync(string key, long amount = 1, long? tenantId = null, bool live = false, CancellationToken ct = default);

    /// <summary>Topes de «cuántos hay» (canales, admins, comandos…): el llamador entrega cuántos hay hoy y se compara con el tope; <paramref name="adding"/> = cuántos quiere agregar.</summary>
    Task<EntitlementResult> CheckGaugeAsync(string key, long current, long adding = 1, long? tenantId = null, CancellationToken ct = default);

    /// <summary>
    /// Cuenta uso sin esperar ni bloquear (mensajes de chat, etc.): se acumula en memoria y se escribe en lotes cada pocos segundos. No corta nada por sí mismo;
    /// al pasar el 80 % o el tope deja el evento correspondiente. El #1 no cuenta. Por defecto no hace nada (pruebas).
    /// </summary>
    void Count(string key, long amount = 1, long? tenantId = null) { }

    /// <summary>Escribe lo acumulado por <see cref="Count"/> (lo llama el servicio de fondo y el cierre del proceso).</summary>
    Task FlushAsync(CancellationToken ct = default) => Task.CompletedTask;

    /// <summary>Olvida el valor en caché (al cambiar suscripción, complemento o ajuste).</summary>
    void Invalidate(long? tenantId = null);
}

/// <summary>Exige un módulo del plan. Sin él responde 403 <c>module_not_included</c> (la UI muestra «agregar módulo»).</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class RequiresModuleAttribute : Attribute, IAsyncActionFilter
{
    public string Capability { get; }
    public RequiresModuleAttribute(string capability) { Capability = capability; }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var sp = context.HttpContext.RequestServices;
        var ent = sp.GetService<IEntitlements>();
        if (ent is null) { await next(); return; } // sin servicio registrado (pruebas) no se bloquea nada
        var tenant = sp.GetService<ITenantContext>()?.TenantId;
        if (!await ent.HasAsync(Capability, tenant, live: false, context.HttpContext.RequestAborted))
        {
            context.Result = new ObjectResult(new { error = "module_not_included", module = Capability }) { StatusCode = StatusCodes.Status403Forbidden };
            return;
        }
        await next();
    }
}
