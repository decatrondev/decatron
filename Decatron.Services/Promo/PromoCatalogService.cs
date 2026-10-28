using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Decatron.Core.Models.Promo;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Decatron.Services.Promo
{
    /// <summary>
    /// Catálogo global del overlay de Promociones (piezas, plantillas y topes), administrado desde /admin/promo.
    /// Mismo patrón que GameOverlayPromoService (que es otro sistema y no se toca): caché de 60 s que se limpia al guardar.
    /// Plan: .dev/plans/overlay-promo/PLAN.md §4
    /// </summary>
    public class PromoCatalogService
    {
        private const string CacheKey = "promo-published";
        private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(60);

        private readonly DecatronDbContext _db;
        private readonly IMemoryCache _cache;

        public PromoCatalogService(DecatronDbContext db, IMemoryCache cache)
        {
            _db = db;
            _cache = cache;
        }

        public record TemplateRow(PromoTemplate Template, int PieceCount);
        public record Overview(List<PromoPiece> Pieces, List<TemplateRow> Templates, List<ZoneRow> Zones, PromoOverlayLimits Limits);
        public record ZoneRow(PromoZone Zone, int PieceCount, int TemplateCount);
        public record PublishedSnapshot(List<PromoPiece> Pieces, List<PromoTemplate> Templates, List<PromoZone> Zones, PromoOverlayLimits Limits);
        public record Result<T>(T? Value, List<string> Errors) where T : class
        {
            public bool Ok => Errors.Count == 0 && Value != null;
        }

        public void Invalidate() => _cache.Remove(CacheKey);

        // ─── Vistas (contadores agregados, sin identificar personas) ─────────

        public record ViewTotals(long Last7, long Last30, long Total);

        /// <summary>Días de historial por canal (piezas y tarjetas propias). El total global de piezas no se borra.</summary>
        public const int ChannelHistoryDays = 90;
        private static DateOnly _lastPurge;

        /// <summary>Suma una entrega al overlay de una cuenta: pieza del bot (contador del canal y global) o tarjeta propia (id negativo). Nunca rompe la rotación.</summary>
        public async Task CountViewAsync(long principalUserId, long pieceId, int seconds = 0)
        {
            try
            {
                var day = DateOnly.FromDateTime(DateTime.UtcNow);
                seconds = Math.Max(0, seconds);
                if (PromoOwnCards.IsOwnPieceId(pieceId))
                {
                    var cardId = -pieceId;
                    await _db.Database.ExecuteSqlInterpolatedAsync($@"INSERT INTO promo_own_card_counts (user_id, card_id, day, views, seconds) VALUES ({principalUserId}, {cardId}, {day}, 1, {seconds})
                        ON CONFLICT (user_id, card_id, day) DO UPDATE SET views = promo_own_card_counts.views + 1, seconds = promo_own_card_counts.seconds + {seconds}");
                }
                else
                {
                    await _db.Database.ExecuteSqlInterpolatedAsync($@"INSERT INTO promo_view_counts (user_id, piece_id, day, views, seconds) VALUES ({principalUserId}, {pieceId}, {day}, 1, {seconds})
                        ON CONFLICT (user_id, piece_id, day) DO UPDATE SET views = promo_view_counts.views + 1, seconds = promo_view_counts.seconds + {seconds}");
                    await _db.Database.ExecuteSqlInterpolatedAsync($@"INSERT INTO promo_piece_daily (piece_id, day, views, seconds) VALUES ({pieceId}, {day}, 1, {seconds})
                        ON CONFLICT (piece_id, day) DO UPDATE SET views = promo_piece_daily.views + 1, seconds = promo_piece_daily.seconds + {seconds}");
                }
                await PurgeOldAsync(day);
            }
            catch (Exception) { /* el conteo es accesorio: si falla, la promoción sale igual */ }
        }

        /// <summary>Suma un clic del QR o del enlace corto (agregado, sin identificar a nadie) a la pieza o tarjeta propia de una cuenta. Nunca lanza.</summary>
        public async Task CountClickAsync(long principalUserId, long pieceId)
        {
            try
            {
                var day = DateOnly.FromDateTime(DateTime.UtcNow);
                if (PromoOwnCards.IsOwnPieceId(pieceId))
                {
                    var cardId = -pieceId;
                    await _db.Database.ExecuteSqlInterpolatedAsync($@"INSERT INTO promo_own_card_counts (user_id, card_id, day, views, seconds, clicks) VALUES ({principalUserId}, {cardId}, {day}, 0, 0, 1)
                        ON CONFLICT (user_id, card_id, day) DO UPDATE SET clicks = promo_own_card_counts.clicks + 1");
                }
                else
                {
                    await _db.Database.ExecuteSqlInterpolatedAsync($@"INSERT INTO promo_view_counts (user_id, piece_id, day, views, seconds, clicks) VALUES ({principalUserId}, {pieceId}, {day}, 0, 0, 1)
                        ON CONFLICT (user_id, piece_id, day) DO UPDATE SET clicks = promo_view_counts.clicks + 1");
                    await _db.Database.ExecuteSqlInterpolatedAsync($@"INSERT INTO promo_piece_daily (piece_id, day, views, seconds, clicks) VALUES ({pieceId}, {day}, 0, 0, 1)
                        ON CONFLICT (piece_id, day) DO UPDATE SET clicks = promo_piece_daily.clicks + 1");
                }
            }
            catch (Exception) { /* el conteo es accesorio: la persona llega a su destino igual */ }
        }

        /// <summary>Una vez al día (por proceso) borra el historial por canal con más de 90 días; sin tarea de fondo aparte.</summary>
        private async Task PurgeOldAsync(DateOnly today)
        {
            if (_lastPurge == today) return;
            _lastPurge = today;
            await _db.Database.ExecuteSqlInterpolatedAsync($"SELECT promo_purge_old_views({ChannelHistoryDays})");
        }

        // ─── Estadísticas ────────────────────────────────────────────────────

        public record DayStat(string Day, long Views, long Seconds, long Clicks);
        public record ItemStat(long Id, long Views, long Seconds, long Clicks);
        public record ChannelStats(int Days, List<DayStat> PerDay, List<ItemStat> Pieces, List<ItemStat> Cards, long WeekViews, long WeekSeconds, long TotalViews, long TotalSeconds, long WeekClicks, long TotalClicks);
        public record GlobalPieceStat(long Id, long Views, long Seconds, long Clicks, int DisabledIn);
        public record GlobalStats(int Days, List<DayStat> PerDay, List<GlobalPieceStat> Pieces, long TotalViews, long TotalSeconds, long TotalClicks);

        private static List<DayStat> Fill(int days, Dictionary<DateTime, (long v, long s, long c)> byDay)
        {
            var today = DateTime.UtcNow.Date;
            return Enumerable.Range(0, days).Select(i => today.AddDays(i - days + 1))
                .Select(d => byDay.TryGetValue(d, out var x) ? new DayStat(d.ToString("yyyy-MM-dd"), x.v, x.s, x.c) : new DayStat(d.ToString("yyyy-MM-dd"), 0, 0, 0)).ToList();
        }

        /// <summary>Estadísticas del canal (últimos 7, 30 o 90 días): por día, ranking de piezas y de tarjetas propias, y lo de la semana.</summary>
        public async Task<ChannelStats> GetChannelStatsAsync(long principalUserId, int days)
        {
            days = NormalizeDays(days, 7, 30, ChannelHistoryDays);
            var today = DateTime.UtcNow.Date;
            var since = today.AddDays(-days + 1);
            var pieces = await _db.PromoViewCounts.AsNoTracking().Where(v => v.UserId == principalUserId && v.Day >= since).ToListAsync();
            var cards = await _db.PromoOwnCardCounts.AsNoTracking().Where(v => v.UserId == principalUserId && v.Day >= since).ToListAsync();
            var all = pieces.Select(p => (p.Day, V: (long)p.Views, S: (long)p.Seconds, C: (long)p.Clicks)).Concat(cards.Select(c => (c.Day, V: (long)c.Views, S: (long)c.Seconds, C: (long)c.Clicks))).ToList();
            var byDay = all.GroupBy(x => x.Day.Date).ToDictionary(g => g.Key, g => (g.Sum(x => x.V), g.Sum(x => x.S), g.Sum(x => x.C)));
            var week = all.Where(x => x.Day.Date > today.AddDays(-7)).ToList();
            return new ChannelStats(days, Fill(days, byDay),
                pieces.GroupBy(p => p.PieceId).Select(g => new ItemStat(g.Key, g.Sum(x => (long)x.Views), g.Sum(x => (long)x.Seconds), g.Sum(x => (long)x.Clicks))).OrderByDescending(x => x.Views).ThenByDescending(x => x.Clicks).ToList(),
                cards.GroupBy(c => c.CardId).Select(g => new ItemStat(g.Key, g.Sum(x => (long)x.Views), g.Sum(x => (long)x.Seconds), g.Sum(x => (long)x.Clicks))).OrderByDescending(x => x.Views).ThenByDescending(x => x.Clicks).ToList(),
                week.Sum(x => x.V), week.Sum(x => x.S), all.Sum(x => x.V), all.Sum(x => x.S), week.Sum(x => x.C), all.Sum(x => x.C));
        }

        /// <summary>Estadísticas globales para el dueño (30, 90 o 365 días, sin límite de historial): por día, piezas y en cuántos canales está apagada cada una.</summary>
        public async Task<GlobalStats> GetGlobalStatsAsync(int days)
        {
            days = NormalizeDays(days, 30, 90, 365);
            var since = DateTime.UtcNow.Date.AddDays(-days + 1);
            var rows = await _db.PromoPieceDaily.AsNoTracking().Where(r => r.Day >= since).ToListAsync();
            var disabled = (await _db.Database.SqlQueryRaw<DisabledRow>(@"SELECT piece_id AS ""PieceId"", channels AS ""Channels"" FROM promo_disabled_counts()").ToListAsync())
                .ToDictionary(r => r.PieceId, r => r.Channels);
            var pieceIds = await _db.PromoPieces.AsNoTracking().Select(p => p.Id).ToListAsync();
            var perPiece = rows.GroupBy(r => r.PieceId).ToDictionary(g => g.Key, g => (v: g.Sum(x => (long)x.Views), s: g.Sum(x => x.Seconds), c: g.Sum(x => x.Clicks)));
            return new GlobalStats(days,
                Fill(days, rows.GroupBy(r => r.Day.Date).ToDictionary(g => g.Key, g => (g.Sum(x => (long)x.Views), g.Sum(x => x.Seconds), g.Sum(x => x.Clicks)))),
                pieceIds.Select(id => new GlobalPieceStat(id, perPiece.GetValueOrDefault(id).v, perPiece.GetValueOrDefault(id).s, perPiece.GetValueOrDefault(id).c, disabled.GetValueOrDefault(id))).OrderByDescending(p => p.Views).ThenByDescending(p => p.Clicks).ToList(),
                rows.Sum(r => (long)r.Views), rows.Sum(r => r.Seconds), rows.Sum(r => r.Clicks));
        }

        private record DisabledRow(long PieceId, int Channels);
        private static int NormalizeDays(int days, params int[] allowed) => allowed.Contains(days) ? days : allowed[1];

        /// <summary>Entregas por pieza de todos los canales (para el dueño): últimos 7 y 30 días y total.</summary>
        public async Task<Dictionary<long, ViewTotals>> GetGlobalViewsAsync()
        {
            var today = DateTime.UtcNow.Date;
            var rows = await _db.PromoPieceDaily.AsNoTracking().ToListAsync();
            return rows.GroupBy(r => r.PieceId).ToDictionary(g => g.Key, g => new ViewTotals(
                g.Where(r => r.Day > today.AddDays(-7)).Sum(r => (long)r.Views),
                g.Where(r => r.Day > today.AddDays(-30)).Sum(r => (long)r.Views),
                g.Sum(r => (long)r.Views)));
        }

        /// <summary>Entregas por pieza de una cuenta en los últimos 30 días (para su panel).</summary>
        public async Task<Dictionary<long, long>> GetChannelViewsAsync(long principalUserId)
        {
            var since = DateTime.UtcNow.Date.AddDays(-30);
            var rows = await _db.PromoViewCounts.AsNoTracking().Where(v => v.UserId == principalUserId && v.Day > since).ToListAsync();
            return rows.GroupBy(r => r.PieceId).ToDictionary(g => g.Key, g => g.Sum(r => (long)r.Views));
        }

        // ─── Tarjetas propias de todos los canales (solo el dueño) ───────────

        public record OwnCardAdminRow(long Id, long UserId, string Login, long TenantId, string Title, string Body, string? Icon, string? LinkUrl, bool ShowQr,
            string Zone, bool IsEnabled, bool HiddenByAdmin, DateTime CreatedAt, string? ImageUrl);

        /// <summary>promo_own_cards tiene RLS y el admin corre como tenant 1: la lectura cruza tenants solo por la función promo_own_cards_all.</summary>
        public Task<List<OwnCardAdminRow>> GetAllOwnCardsAsync() => _db.Database.SqlQueryRaw<OwnCardAdminRow>(
            @"SELECT id AS ""Id"", user_id AS ""UserId"", login AS ""Login"", tenant_id AS ""TenantId"", title AS ""Title"", body AS ""Body"", icon AS ""Icon"",
                     link_url AS ""LinkUrl"", show_qr AS ""ShowQr"", zone AS ""Zone"", is_enabled AS ""IsEnabled"", hidden_by_admin AS ""HiddenByAdmin"", created_at AS ""CreatedAt"", image_url AS ""ImageUrl""
              FROM promo_own_cards_all()").ToListAsync();

        /// <summary>Oculta o muestra una tarjeta de cualquier canal (función promo_own_card_set_hidden). False si no existe.</summary>
        /// <summary>El dueño quita la imagen de una tarjeta de cualquier canal: la función borra la fila de la biblioteca y devuelve la ruta del archivo para borrarlo del disco.</summary>
        public async Task<string?> ClearOwnCardImageAsync(long id)
            => (await _db.Database.SqlQueryRaw<string?>(@"SELECT promo_own_card_clear_image({0}) AS ""Value""", id).ToListAsync()).FirstOrDefault();

        public async Task<bool> SetOwnCardHiddenAsync(long id, bool hidden)
            => (await _db.Database.SqlQueryRaw<bool>(@"SELECT promo_own_card_set_hidden({0}, {1}) AS ""Value""", id, hidden).ToListAsync()).FirstOrDefault();

        // ─── Lectura ─────────────────────────────────────────────────────────

        public async Task<Overview> GetOverviewAsync()
        {
            var pieces = await _db.PromoPieces.AsNoTracking().OrderBy(p => p.SortOrder).ThenBy(p => p.Id).ToListAsync();
            var templates = await _db.PromoTemplates.AsNoTracking().OrderBy(t => t.SortOrder).ThenBy(t => t.Id).ToListAsync();
            var counts = pieces.Where(p => p.TemplateId != null).GroupBy(p => p.TemplateId!.Value).ToDictionary(g => g.Key, g => g.Count());
            var zones = await _db.PromoZones.AsNoTracking().OrderBy(z => z.SortOrder).ThenBy(z => z.Id).ToListAsync();
            return new Overview(pieces,
                templates.Select(t => new TemplateRow(t, counts.TryGetValue(t.Id, out var c) ? c : 0)).ToList(),
                zones.Select(z => new ZoneRow(z, pieces.Count(p => p.Zone == z.Key), templates.Count(t => t.Zone == z.Key))).ToList(),
                await GetLimitsAsync());
        }

        /// <summary>Lo publicado y las plantillas activas, en caché (lo pide cada overlay abierto; lo usa la fase 2).</summary>
        public async Task<PublishedSnapshot> GetPublishedAsync()
        {
            if (_cache.TryGetValue(CacheKey, out PublishedSnapshot? cached) && cached != null) return cached;
            var pieces = await _db.PromoPieces.AsNoTracking().Where(p => p.Status == "published" && p.Weight > 0)
                .OrderBy(p => p.SortOrder).ThenBy(p => p.Id).ToListAsync();
            var templates = await _db.PromoTemplates.AsNoTracking().Where(t => t.IsEnabled).OrderBy(t => t.SortOrder).ToListAsync();
            var zones = await _db.PromoZones.AsNoTracking().Where(z => z.IsEnabled).OrderBy(z => z.SortOrder).ToListAsync();
            var snap = new PublishedSnapshot(pieces, templates, zones, await GetLimitsAsync());
            _cache.Set(CacheKey, snap, CacheTtl);
            return snap;
        }

        public async Task<PromoOverlayLimits> GetLimitsAsync()
        {
            var s = await _db.PromoLimits.AsNoTracking().FirstOrDefaultAsync(x => x.Id == 1);
            return s ?? new PromoOverlayLimits();
        }

        // ─── Piezas ──────────────────────────────────────────────────────────

        /// <summary>Crea (Id = 0) o edita una pieza. Devuelve los códigos de error si no pasa las reglas.</summary>
        public async Task<Result<PromoPiece>> UpsertPieceAsync(PromoPiece input, long? adminUserId)
        {
            PromoValidator.NormalizePiece(input);
            var errors = PromoValidator.ValidatePiece(input);
            if (input.TemplateId != null && !await _db.PromoTemplates.AnyAsync(t => t.Id == input.TemplateId))
                errors.Add("templateNotFound");
            if (PromoValidator.IsKey(input.Zone) && !await _db.PromoZones.AnyAsync(z => z.Key == input.Zone))
                errors.Add("zoneNotFound");
            if (errors.Count > 0) return new Result<PromoPiece>(null, errors);

            var p = input.Id > 0 ? await _db.PromoPieces.FirstOrDefaultAsync(x => x.Id == input.Id) : null;
            if (input.Id > 0 && p == null) return new Result<PromoPiece>(null, new List<string> { "pieceNotFound" });
            if (p == null)
            {
                p = new PromoPiece { CreatedBy = adminUserId };
                _db.PromoPieces.Add(p);
            }
            p.Kind = input.Kind; p.Origin = input.Origin;
            p.TitleEs = input.TitleEs; p.TitleEn = input.TitleEn; p.BodyEs = input.BodyEs; p.BodyEn = input.BodyEn;
            p.LinkUrl = input.LinkUrl; p.ShowQr = input.ShowQr; p.ImageUrl = input.ImageUrl; p.Icon = input.Icon;
            p.TemplateId = input.TemplateId; p.Zone = input.Zone;
            p.Priority = input.Priority; p.Weight = input.Weight; p.DurationSeconds = input.DurationSeconds; p.IsPinned = input.IsPinned;
            p.StartsAt = input.StartsAt; p.EndsAt = input.EndsAt;
            p.Platforms = input.Platforms; p.OnlyChannels = input.OnlyChannels;
            p.Status = input.Status; p.SortOrder = input.SortOrder;
            p.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            Invalidate();
            return new Result<PromoPiece>(p, new List<string>());
        }

        /// <summary>Copia una pieza como borrador, al final de la lista.</summary>
        public async Task<Result<PromoPiece>> DuplicatePieceAsync(long id, long? adminUserId)
        {
            var src = await _db.PromoPieces.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            if (src == null) return new Result<PromoPiece>(null, new List<string> { "pieceNotFound" });
            var max = await _db.PromoPieces.MaxAsync(x => (int?)x.SortOrder) ?? 0;
            var copy = new PromoPiece
            {
                Kind = src.Kind, Origin = src.Origin,
                TitleEs = Suffix(src.TitleEs, " (copia)", 120), TitleEn = Suffix(src.TitleEn, " (copy)", 120),
                BodyEs = src.BodyEs, BodyEn = src.BodyEn, LinkUrl = src.LinkUrl, ShowQr = src.ShowQr, ImageUrl = src.ImageUrl, Icon = src.Icon,
                TemplateId = src.TemplateId, Zone = src.Zone, Priority = src.Priority, Weight = src.Weight, DurationSeconds = src.DurationSeconds,
                StartsAt = src.StartsAt, EndsAt = src.EndsAt, Platforms = src.Platforms, OnlyChannels = src.OnlyChannels,
                Status = "draft", SortOrder = max + 1, CreatedBy = adminUserId,
            };
            _db.PromoPieces.Add(copy);
            await _db.SaveChangesAsync();
            Invalidate();
            return new Result<PromoPiece>(copy, new List<string>());
        }

        private static string Suffix(string s, string suffix, int max)
        {
            if (s.Length == 0) return s;
            return s.Length + suffix.Length <= max ? s + suffix : s.Substring(0, max - suffix.Length) + suffix;
        }

        public async Task<Result<PromoPiece>> SetStatusAsync(long id, string status)
        {
            status = (status ?? "").Trim().ToLowerInvariant();
            if (!PromoValidator.Statuses.Contains(status)) return new Result<PromoPiece>(null, new List<string> { "statusInvalid" });
            var p = await _db.PromoPieces.FirstOrDefaultAsync(x => x.Id == id);
            if (p == null) return new Result<PromoPiece>(null, new List<string> { "pieceNotFound" });
            p.Status = status;
            p.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            Invalidate();
            return new Result<PromoPiece>(p, new List<string>());
        }

        public async Task<bool> DeletePieceAsync(long id)
        {
            var p = await _db.PromoPieces.FirstOrDefaultAsync(x => x.Id == id);
            if (p == null) return false;
            _db.PromoPieces.Remove(p);
            await _db.SaveChangesAsync();
            Invalidate();
            return true;
        }

        // ─── Plantillas ──────────────────────────────────────────────────────

        public async Task<Result<PromoTemplate>> UpsertTemplateAsync(PromoTemplate input)
        {
            PromoValidator.NormalizeTemplate(input);
            var t = input.Id > 0 ? await _db.PromoTemplates.FirstOrDefaultAsync(x => x.Id == input.Id) : null;
            if (input.Id > 0 && t == null) return new Result<PromoTemplate>(null, new List<string> { "templateNotFound" });
            // La clave no cambia una vez creada (otras cosas pueden apuntar a ella).
            if (t != null) input.Key = t.Key;
            var errors = PromoValidator.ValidateTemplate(input);
            if (t == null && await _db.PromoTemplates.AnyAsync(x => x.Key == input.Key)) errors.Add("keyTaken");
            if (PromoValidator.IsKey(input.Zone) && !await _db.PromoZones.AnyAsync(x => x.Key == input.Zone)) errors.Add("zoneNotFound");
            if (errors.Count > 0) return new Result<PromoTemplate>(null, errors);

            if (t == null) { t = new PromoTemplate { Key = input.Key }; _db.PromoTemplates.Add(t); }
            t.NameEs = input.NameEs; t.NameEn = input.NameEn;
            t.Zone = input.Zone; t.Design = input.Design;
            t.IsEnabled = input.IsEnabled; t.SortOrder = input.SortOrder;
            t.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            Invalidate();
            return new Result<PromoTemplate>(t, new List<string>());
        }

        /// <summary>Borra una plantilla; las piezas que la usaban quedan sin plantilla (el overlay usa la primera activa).</summary>
        public async Task<bool> DeleteTemplateAsync(long id)
        {
            var t = await _db.PromoTemplates.FirstOrDefaultAsync(x => x.Id == id);
            if (t == null) return false;
            _db.PromoTemplates.Remove(t);
            await _db.SaveChangesAsync();
            Invalidate();
            return true;
        }

        // ─── Zonas ───────────────────────────────────────────────────────────

        public async Task<Result<PromoZone>> UpsertZoneAsync(PromoZone input)
        {
            PromoValidator.NormalizeZone(input);
            var z = input.Id > 0 ? await _db.PromoZones.FirstOrDefaultAsync(x => x.Id == input.Id) : null;
            if (input.Id > 0 && z == null) return new Result<PromoZone>(null, new List<string> { "zoneNotFound" });
            // La clave no cambia una vez creada (piezas y plantillas apuntan a ella).
            if (z != null) input.Key = z.Key;
            var errors = PromoValidator.ValidateZone(input);
            if (z == null && await _db.PromoZones.AnyAsync(x => x.Key == input.Key)) errors.Add("keyTaken");
            if (errors.Count > 0) return new Result<PromoZone>(null, errors);

            if (z == null) { z = new PromoZone { Key = input.Key }; _db.PromoZones.Add(z); }
            z.NameEs = input.NameEs; z.NameEn = input.NameEn; z.Anchor = input.Anchor; z.MarginX = input.MarginX; z.MarginY = input.MarginY;
            z.IsEnabled = input.IsEnabled; z.SortOrder = input.SortOrder;
            z.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            Invalidate();
            return new Result<PromoZone>(z, new List<string>());
        }

        /// <summary>Borra una zona solo si ninguna pieza ni plantilla la usa.</summary>
        public async Task<List<string>> DeleteZoneAsync(long id)
        {
            var z = await _db.PromoZones.FirstOrDefaultAsync(x => x.Id == id);
            if (z == null) return new List<string> { "zoneNotFound" };
            if (await _db.PromoPieces.AnyAsync(p => p.Zone == z.Key) || await _db.PromoTemplates.AnyAsync(t => t.Zone == z.Key)) return new List<string> { "zoneInUse" };
            _db.PromoZones.Remove(z);
            await _db.SaveChangesAsync();
            Invalidate();
            return new List<string>();
        }

        // ─── Topes ───────────────────────────────────────────────────────────

        public async Task<Result<PromoOverlayLimits>> UpdateLimitsAsync(PromoOverlayLimits req)
        {
            var errors = PromoValidator.ValidateLimits(req.MinGapSeconds, req.HourlyCapSeconds);
            errors.AddRange(PromoOverrides.ValidateLimits(req));
            if (errors.Count > 0) return new Result<PromoOverlayLimits>(null, errors);
            var s = await _db.PromoLimits.FirstOrDefaultAsync(x => x.Id == 1);
            if (s == null) { s = new PromoOverlayLimits { Id = 1 }; _db.PromoLimits.Add(s); }
            s.MinGapSeconds = req.MinGapSeconds;
            s.HourlyCapSeconds = req.HourlyCapSeconds;
            s.MinDurationSeconds = req.MinDurationSeconds;
            s.MaxDurationSeconds = req.MaxDurationSeconds;
            s.MinScalePercent = req.MinScalePercent;
            s.MaxScalePercent = req.MaxScalePercent;
            s.MaxZoneMargin = req.MaxZoneMargin;
            s.BotPerOwn = req.BotPerOwn;
            s.OwnMinIntervalMinutes = req.OwnMinIntervalMinutes;
            s.OneAtATime = req.OneAtATime;
            s.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            Invalidate();
            return new Result<PromoOverlayLimits>(s, new List<string>());
        }
    }
}
