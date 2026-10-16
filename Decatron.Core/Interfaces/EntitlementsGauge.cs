namespace Decatron.Core.Interfaces;

/// <summary>Fase 5.4: atajo para los topes de «cuántos hay» (comandos, timers…) en el punto donde se CREA algo.</summary>
public static class EntitlementsGauge
{
    /// <summary>
    /// ¿Cabe uno más? El #1 y los topes ilimitados pasan sin contar (no se consulta la base). Sin servicio registrado (pruebas) no se bloquea nada.
    /// <paramref name="current"/> solo se ejecuta si hay tope: cuenta lo que el tenant ya tiene.
    /// </summary>
    public static async Task<EntitlementResult> CheckNewAsync(this IEntitlements? ent, string key, Func<Task<long>> current, long? tenantId = null, CancellationToken ct = default)
    {
        if (ent is null) return EntitlementResult.Ok();
        var tenant = tenantId ?? TenantAmbient.Current ?? 1;
        if (tenant == 1) return EntitlementResult.Ok();
        var (operational, limit) = await ent.LimitAsync(key, tenant, live: false, ct);
        if (operational && limit is null) return EntitlementResult.Ok();
        return await ent.CheckGaugeAsync(key, operational ? await current() : 0, 1, tenant, ct);
    }
}
