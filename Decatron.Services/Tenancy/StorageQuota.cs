using Decatron.Core.Interfaces;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.Tenancy;

/// <summary>
/// Plataforma, Fase 5.4: tope de almacenamiento del plan (<c>quota.storage_mb</c>) en la biblioteca de medios (<c>timer_media_files</c>, que comparten
/// timers y Sound Alerts). Cuenta lo que ya sube el tenant (RLS limita las filas) y le suma el archivo nuevo, en MB redondeados hacia arriba.
/// Es un tope además del que ya tiene cada cuenta por su tier; el #1 y los topes ilimitados no cuentan.
/// </summary>
public static class StorageQuota
{
    private const long Mb = 1024 * 1024;

    public static Task<EntitlementResult> CheckUploadAsync(IEntitlements? ent, DecatronDbContext db, long fileBytes, long? tenantId = null, CancellationToken ct = default) =>
        ent.CheckNewAsync("quota.storage_mb",
            async () => (await db.TimerMediaFiles.SumAsync(f => (long?)f.FileSize, ct) ?? 0) / Mb,
            tenantId, ct, adding: Math.Max(1, (fileBytes + Mb - 1) / Mb));
}
