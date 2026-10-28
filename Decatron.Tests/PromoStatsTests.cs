using Decatron.Data;
using Decatron.Services.Promo;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace Decatron.Tests;

/// <summary>
/// Promociones, Fase 4: conteo de entregas (pieza del bot y tarjeta propia, con tiempo en pantalla) y estadísticas del canal y globales.
/// Corre contra `decatron_schema` con el rol de la aplicación (DECATRON_APP_CONN) dentro de una transacción que se revierte; sin la variable se omite.
/// </summary>
public class PromoStatsTests
{
    private static string? Conn => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");

    private static DecatronDbContext NewContext()
    {
        var options = new DbContextOptionsBuilder<DecatronDbContext>().UseNpgsql(Decatron.Core.Interfaces.TenantNpgsql.Create(Conn, 1)).Options;
        return new DecatronDbContext(options);
    }

    private const long User = 987654321;

    [Fact(DisplayName = "Las entregas de piezas y tarjetas propias suman vistas y segundos, y las estadísticas las devuelven")]
    public async Task CountsAndStats_RoundTrip()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        using var db = NewContext();
        await using var tx = await db.Database.BeginTransactionAsync();
        var pieceId = (await db.Database.SqlQueryRaw<long>("INSERT INTO promo_pieces DEFAULT VALUES RETURNING id AS \"Value\"").ToListAsync()).Single();
        var cardId = (await db.Database.SqlQueryRaw<long>($"INSERT INTO promo_own_cards (user_id) VALUES ({User}) RETURNING id AS \"Value\"").ToListAsync()).Single();
        var svc = new PromoCatalogService(db, new MemoryCache(new MemoryCacheOptions()));

        await svc.CountViewAsync(User, pieceId, 8);
        await svc.CountViewAsync(User, pieceId, 8);
        await svc.CountViewAsync(User, -cardId, 5);
        await svc.CountClickAsync(User, pieceId);
        await svc.CountClickAsync(User, pieceId);
        await svc.CountClickAsync(User, -cardId);

        var s = await svc.GetChannelStatsAsync(User, 30);
        Assert.Equal(30, s.PerDay.Count);
        Assert.Equal(DateTime.UtcNow.ToString("yyyy-MM-dd"), s.PerDay[^1].Day);
        Assert.Equal(3, s.PerDay[^1].Views);
        Assert.Equal(21, s.PerDay[^1].Seconds);
        var p = Assert.Single(s.Pieces); Assert.Equal((pieceId, 2L, 16L), (p.Id, p.Views, p.Seconds));
        var c = Assert.Single(s.Cards); Assert.Equal((cardId, 1L, 5L), (c.Id, c.Views, c.Seconds));
        Assert.Equal((3L, 21L, 3L, 21L), (s.WeekViews, s.WeekSeconds, s.TotalViews, s.TotalSeconds));
        Assert.Equal((3L, 3L, 3L), (s.PerDay[^1].Clicks, s.WeekClicks, s.TotalClicks));
        Assert.Equal((2L, 1L), (p.Clicks, c.Clicks));

        // Un rango que no existe se normaliza al de 30 días.
        Assert.Equal(30, (await svc.GetChannelStatsAsync(User, 5)).Days);

        var g = await svc.GetGlobalStatsAsync(30);
        var gp = g.Pieces.Single(x => x.Id == pieceId);
        Assert.Equal((2L, 16L, 2L), (gp.Views, gp.Seconds, gp.Clicks));
        await tx.RollbackAsync();
    }

    [Fact(DisplayName = "El borrado diario quita solo el historial por canal con más de 90 días y deja el global")]
    public async Task Purge_KeepsGlobal()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        using var db = NewContext();
        await using var tx = await db.Database.BeginTransactionAsync();
        var pieceId = (await db.Database.SqlQueryRaw<long>("INSERT INTO promo_pieces DEFAULT VALUES RETURNING id AS \"Value\"").ToListAsync()).Single();
        await db.Database.ExecuteSqlRawAsync($"INSERT INTO promo_view_counts (user_id, piece_id, day, views) VALUES ({User}, {pieceId}, (now() AT TIME ZONE 'utc')::date - 120, 4), ({User}, {pieceId}, (now() AT TIME ZONE 'utc')::date - 10, 1)");
        await db.Database.ExecuteSqlRawAsync($"INSERT INTO promo_piece_daily (piece_id, day, views) VALUES ({pieceId}, (now() AT TIME ZONE 'utc')::date - 120, 4)");

        await db.Database.ExecuteSqlRawAsync($"SELECT promo_purge_old_views({PromoCatalogService.ChannelHistoryDays})");

        Assert.Equal(1, await db.PromoViewCounts.CountAsync(v => v.PieceId == pieceId));
        Assert.Equal(1, await db.PromoPieceDaily.CountAsync(v => v.PieceId == pieceId));
        await tx.RollbackAsync();
    }

    [Fact(DisplayName = "El dueño quita la imagen de una tarjeta: se borra la fila de la biblioteca (libera cuota) y la función devuelve la ruta")]
    public async Task ClearOwnCardImage_FreesMediaRow()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        using var db = NewContext();
        await using var tx = await db.Database.BeginTransactionAsync();
        // El esquema de pruebas no trae usuarios: se crea uno dentro de la transacción (se revierte).
        await db.Database.ExecuteSqlRawAsync("INSERT INTO users (id, display_name, email, profile_image_url, offline_image_url, broadcaster_type, view_count, description, access_token, refresh_token, token_expiration, created_at, updated_at, is_active, unique_id) VALUES (987654322, 'zz', 'zz@x', '', '', '', 0, '', '', '', now(), now(), now(), true, 'zz-987654322')");
        var mediaId = (await db.Database.SqlQueryRaw<int>("INSERT INTO timer_media_files (channel_name, user_id, file_type, file_path, original_file_name, file_name, category, file_size, usage_count, uploaded_at, created_at) VALUES ('zz_prueba', 987654322, 'image', '/x/timerextensible/zz_prueba/promo/a.webp', 'a.webp', 'a.webp', 'promo', 1234, 1, now(), now()) RETURNING id AS \"Value\"").ToListAsync()).Single();
        var cardId = (await db.Database.SqlQueryRaw<long>($"INSERT INTO promo_own_cards (user_id, image_media_id, image_url) VALUES ({User}, {mediaId}, '/timerextensible/zz_prueba/promo/a.webp') RETURNING id AS \"Value\"").ToListAsync()).Single();
        var svc = new PromoCatalogService(db, new MemoryCache(new MemoryCacheOptions()));

        var path = await svc.ClearOwnCardImageAsync(cardId);

        Assert.Equal("/x/timerextensible/zz_prueba/promo/a.webp", path);
        Assert.Equal(0, await db.TimerMediaFiles.CountAsync(m => m.Id == mediaId));
        var card = await db.PromoOwnCards.AsNoTracking().SingleAsync(c => c.Id == cardId);
        Assert.Null(card.ImageMediaId); Assert.Null(card.ImageUrl);
        Assert.Null(await svc.ClearOwnCardImageAsync(cardId)); // sin imagen: nada que borrar
        await tx.RollbackAsync();
    }
}
