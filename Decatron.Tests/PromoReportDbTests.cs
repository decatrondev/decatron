using Decatron.Data;
using Decatron.Services.Promo;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace Decatron.Tests;

/// <summary>
/// Promociones, Fase 6: la consulta del informe de publicidad de terceros (solo piezas de tercero, filtro por anunciante sin mayúsculas, rango de fechas).
/// Corre contra `decatron_schema` con el rol de la aplicación (DECATRON_APP_CONN) dentro de una transacción que se revierte; sin la variable se omite.
/// </summary>
public class PromoReportDbTests
{
    private static string? Conn => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");

    private static DecatronDbContext NewContext()
    {
        var options = new DbContextOptionsBuilder<DecatronDbContext>().UseNpgsql(Decatron.Core.Interfaces.TenantNpgsql.Create(Conn, 1)).Options;
        return new DecatronDbContext(options);
    }

    private const long User = 987654321;

    [Fact(DisplayName = "El informe de anunciante solo trae piezas de terceros, filtra por anunciante y respeta el rango")]
    public async Task Report_FiltersByAdvertiserAndRange()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        using var db = NewContext();
        await using var tx = await db.Database.BeginTransactionAsync();
        var sol = (await db.Database.SqlQueryRaw<long>("INSERT INTO promo_pieces (origin, advertiser_name, title_es) VALUES ('tercero', 'Tienda Sol', 'Oferta') RETURNING id AS \"Value\"").ToListAsync()).Single();
        var luna = (await db.Database.SqlQueryRaw<long>("INSERT INTO promo_pieces (origin, advertiser_name, title_es) VALUES ('tercero', 'Luna', 'Otra') RETURNING id AS \"Value\"").ToListAsync()).Single();
        var bot = (await db.Database.SqlQueryRaw<long>("INSERT INTO promo_pieces (origin, title_es) VALUES ('bot', 'Propia') RETURNING id AS \"Value\"").ToListAsync()).Single();
        var svc = new PromoCatalogService(db, new MemoryCache(new MemoryCacheOptions()));
        await svc.CountViewAsync(User, sol, 8); await svc.CountViewAsync(User, sol, 8);
        await svc.CountViewAsync(User, luna, 6);
        await svc.CountViewAsync(User, bot, 8);
        await svc.CountClickAsync(User, sol);

        var today = DateTime.UtcNow.Date;
        var all = await svc.GetAdvertiserReportAsync(null, today.AddDays(-29), today);
        Assert.Equal(new[] { luna, sol }.OrderBy(i => i), all.Select(r => r.PieceId).OrderBy(i => i)); // el de la propia pieza del bot no entra

        var onlySol = await svc.GetAdvertiserReportAsync("  tienda sol ", today.AddDays(-29), today);
        var row = Assert.Single(onlySol);
        Assert.Equal(("Tienda Sol", sol, "Oferta", 2L, 16L, 1L), (row.Advertiser, row.PieceId, row.Title, row.Views, row.Seconds, row.Clicks));

        Assert.Empty(await svc.GetAdvertiserReportAsync(null, today.AddDays(-10), today.AddDays(-5))); // rango sin datos
        await tx.RollbackAsync();
    }
}
