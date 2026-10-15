using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace Decatron.Data;

/// <summary>El modo estricto de tenant (filtros globales) cambia el modelo, así que EF no debe compartir el modelo en caché con el modo normal.</summary>
public sealed class TenantModelCacheKeyFactory : IModelCacheKeyFactory
{
    public object Create(DbContext context, bool designTime)
        => (context.GetType(), (context as DecatronDbContext)?.TenantStrictMode ?? false, designTime);
}
