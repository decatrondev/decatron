using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Core.Helpers;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Decatron.Services.PersonalPages;

/// <summary>
/// Acceso a datos de la página personal (subfase 5.1): crear, borrador/publicar, cambio de nombre cada 30 días con
/// redirección, apelaciones y lo que hace admin. Las reglas puras están en <see cref="PersonalPageRules"/>.
/// Los errores salen como códigos estables (<see cref="PersonalPageException.Code"/>) que el panel traduce.
/// </summary>
public class PersonalPageService(DecatronDbContext db)
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static PersonalPageContent Read(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new PersonalPageContent(Links: new());
        try { return JsonSerializer.Deserialize<PersonalPageContent>(json, Json) ?? new PersonalPageContent(Links: new()); }
        catch (JsonException) { return new PersonalPageContent(Links: new()); }
    }

    public static string Write(PersonalPageContent content) => JsonSerializer.Serialize(content, Json);

    public Task<PersonalPage?> ForChannelAsync(long channelUserId) =>
        db.PersonalPages.FirstOrDefaultAsync(p => p.ChannelUserId == channelUserId);

    public async Task<HashSet<string>> AdminReservedAsync() =>
        (await db.PersonalPageReservedHandles.AsNoTracking().Select(r => r.Handle).ToListAsync()).ToHashSet(StringComparer.Ordinal);

    /// <summary>
    /// null si el nombre está libre para esta página; si no: length/chars/edge/reserved (forma o reserva), taken (lo usa otra
    /// página) o redirecting (es el nombre viejo de otra página y todavía redirige).
    /// </summary>
    public async Task<string?> AvailabilityAsync(string handle, long? pageId, DateTimeOffset now)
    {
        var error = PersonalPageRules.HandleError(handle, await AdminReservedAsync());
        if (error != null) return error;
        if (await db.PersonalPages.AsNoTracking().AnyAsync(p => p.Handle == handle && p.Id != pageId)) return "taken";
        if (await db.PersonalPageHandleHistory.AsNoTracking().AnyAsync(h => h.Handle == handle && h.ValidUntil > now && h.PageId != pageId)) return "redirecting";
        return null;
    }

    public async Task<PersonalPage> CreateAsync(long channelUserId, string handle, PersonalPageContent initial, DateTimeOffset now)
    {
        if (await ForChannelAsync(channelUserId) != null) throw new PersonalPageException("already_exists");
        var problem = await AvailabilityAsync(handle, null, now);
        if (problem != null) throw new PersonalPageException(problem);
        var page = new PersonalPage
        {
            ChannelUserId = channelUserId,
            Handle = handle,
            Draft = Write(initial),
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.PersonalPages.Add(page);
        await SaveUniqueAsync();
        return page;
    }

    /// <summary>Dominios de admin (adultos y bloqueados) como política para las reglas.</summary>
    public async Task<PersonalPageDomainPolicy> DomainPolicyAsync()
    {
        var rows = await db.PersonalPageDomains.AsNoTracking().Select(d => new { d.Domain, d.Kind }).ToListAsync();
        return new PersonalPageDomainPolicy(
            rows.Where(r => r.Kind == "adult").Select(r => r.Domain).ToHashSet(StringComparer.Ordinal),
            rows.Where(r => r.Kind == "blocked").Select(r => r.Domain).ToHashSet(StringComparer.Ordinal));
    }

    /// <summary>
    /// Archivos de la Galería de medios del canal (la misma de Timer, Alertas, Metas…): URL pública → tipo (image, gif,
    /// video, sound). La galería guarda un solo nombre por cuenta: el login de Twitch, o el usuario de Kick si no hay Twitch.
    /// </summary>
    public async Task<Dictionary<string, string>> GalleryAsync(long channelUserId)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == channelUserId);
        if (user == null) return new();
        var linked = user.AccountId != null ? await db.Users.AsNoTracking().Where(u => u.AccountId == user.AccountId).ToListAsync() : new List<User> { user };
        var name = (linked.FirstOrDefault(u => u.TwitchId != null)?.Login ?? linked.FirstOrDefault(u => u.KickUsername != null)?.KickUsername ?? user.Login ?? "").ToLower();
        if (name.Length == 0) return new();
        var files = await db.TimerMediaFiles.AsNoTracking().Where(f => f.ChannelName == name).Select(f => new { f.FilePath, f.FileType }).ToListAsync();
        var map = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var f in files) map[MediaPathHelpers.ToPublicPath(f.FilePath)] = f.FileType;
        return map;
    }

    public async Task SaveDraftAsync(PersonalPage page, PersonalPageContent content, long revision, DateTimeOffset now)
    {
        if (page.Revision != revision) throw new PersonalPageException("stale_revision");
        var policy = await DomainPolicyAsync();
        var normalized = PersonalPageRules.Normalize(content);
        var errors = PersonalPageRules.Errors(normalized, forPublish: false, policy, await GalleryAsync(page.ChannelUserId));
        if (errors.Count > 0) throw new PersonalPageException("invalid_content", errors);
        page.Draft = Write(PersonalPageRules.ApplyForced(normalized, policy, page.ForcedAdult));
        Touch(page, now);
        await db.SaveChangesAsync();
    }

    public async Task PublishAsync(PersonalPage page, long revision, DateTimeOffset now)
    {
        if (page.Revision != revision) throw new PersonalPageException("stale_revision");
        var policy = await DomainPolicyAsync();
        var draft = PersonalPageRules.Normalize(Read(page.Draft));
        var errors = PersonalPageRules.Errors(draft, forPublish: true, policy, await GalleryAsync(page.ChannelUserId));
        if (errors.Count > 0) throw new PersonalPageException("incomplete_content", errors);
        draft = PersonalPageRules.ApplyForced(draft, policy, page.ForcedAdult);
        page.Draft = Write(draft);
        page.Published = Write(draft);
        page.PublishedAt = now;
        Touch(page, now);
        await db.SaveChangesAsync();
    }

    public async Task DiscardAsync(PersonalPage page, long revision, DateTimeOffset now)
    {
        if (page.Revision != revision) throw new PersonalPageException("stale_revision");
        if (page.Published == null) throw new PersonalPageException("nothing_published");
        page.Draft = page.Published;
        Touch(page, now);
        await db.SaveChangesAsync();
    }

    /// <summary>Hay cambios sin publicar (compara el contenido, no el texto JSON).</summary>
    public static bool HasUnpublishedChanges(PersonalPage page) =>
        page.Published == null || Write(PersonalPageRules.Normalize(Read(page.Draft))) != Write(PersonalPageRules.Normalize(Read(page.Published)));

    /// <summary>
    /// Cambia el nombre. Espera 30 días desde el último cambio salvo que haya perdido el nombre por una apelación. El nombre
    /// viejo redirige 30 días. Volver a un nombre propio que todavía redirige lo recupera sin esperar a que venza.
    /// </summary>
    public async Task ChangeHandleAsync(PersonalPage page, string newHandle, long revision, DateTimeOffset now)
    {
        if (page.Revision != revision) throw new PersonalPageException("stale_revision");
        if (newHandle == page.Handle) throw new PersonalPageException("same_handle");
        if (!page.NeedsNewHandle && !PersonalPageRules.CanChangeHandle(page.HandleChangedAt, now)) throw new PersonalPageException("cooldown");
        var problem = await AvailabilityAsync(newHandle, page.Id, now);
        if (problem != null) throw new PersonalPageException(problem);

        var ownOld = await db.PersonalPageHandleHistory.Where(h => h.PageId == page.Id && h.Handle == newHandle).ToListAsync();
        db.PersonalPageHandleHistory.RemoveRange(ownOld);
        if (!page.NeedsNewHandle)
            db.PersonalPageHandleHistory.Add(new PersonalPageHandleHistory { PageId = page.Id, Handle = page.Handle, ValidUntil = now + PersonalPageRules.RedirectWindow, CreatedAt = now });
        page.Handle = newHandle;
        page.HandleChangedAt = now;
        page.NeedsNewHandle = false;
        Touch(page, now);
        await SaveUniqueAsync();
    }

    public sealed record Resolution(PersonalPage? Page, string? RedirectTo);

    /// <summary>Página por nombre, o el nombre nuevo si es uno viejo que todavía redirige.</summary>
    public async Task<Resolution> ResolveAsync(string handle, DateTimeOffset now)
    {
        var page = await db.PersonalPages.AsNoTracking().FirstOrDefaultAsync(p => p.Handle == handle);
        if (page != null) return new(page, null);
        var target = await db.PersonalPageHandleHistory.AsNoTracking()
            .Where(h => h.Handle == handle && h.ValidUntil > now)
            .Join(db.PersonalPages.AsNoTracking(), h => h.PageId, p => p.Id, (h, p) => p.Handle)
            .FirstOrDefaultAsync();
        return new(null, target);
    }

    // ---------- Apelaciones ----------

    public async Task<PersonalPageHandleAppeal> AppealAsync(long requesterUserId, long requesterChannelUserId, string handle, string message, DateTimeOffset now)
    {
        message = PersonalPageRules.Clean(message, multiline: true);
        if (message.Length < 10 || message.Length > 1000) throw new PersonalPageException("appeal_message");
        if (PersonalPageRules.HandleError(handle) is { } shape and not "reserved") throw new PersonalPageException(shape);
        var owner = await db.PersonalPages.AsNoTracking().FirstOrDefaultAsync(p => p.Handle == handle);
        if (owner == null) throw new PersonalPageException("not_taken");
        if (owner.ChannelUserId == requesterChannelUserId) throw new PersonalPageException("own_handle");
        if (await db.PersonalPageHandleAppeals.AnyAsync(a => a.RequesterChannelUserId == requesterChannelUserId && a.Handle == handle && a.Status == "pending"))
            throw new PersonalPageException("appeal_pending");
        var appeal = new PersonalPageHandleAppeal
        {
            Handle = handle, RequesterUserId = requesterUserId, RequesterChannelUserId = requesterChannelUserId, Message = message, CreatedAt = now,
        };
        db.PersonalPageHandleAppeals.Add(appeal);
        await SaveUniqueAsync("appeal_pending");
        return appeal;
    }

    public Task<List<PersonalPageHandleAppeal>> MyAppealsAsync(long requesterChannelUserId) =>
        db.PersonalPageHandleAppeals.AsNoTracking().Where(a => a.RequesterChannelUserId == requesterChannelUserId)
            .OrderByDescending(a => a.CreatedAt).Take(50).ToListAsync();

    public async Task WithdrawAppealAsync(long requesterChannelUserId, long appealId, DateTimeOffset now)
    {
        var appeal = await db.PersonalPageHandleAppeals.FirstOrDefaultAsync(a => a.Id == appealId && a.RequesterChannelUserId == requesterChannelUserId)
            ?? throw new PersonalPageException("not_found");
        if (appeal.Status != "pending") throw new PersonalPageException("appeal_closed");
        appeal.Status = "withdrawn";
        appeal.ReviewedAt = now;
        await db.SaveChangesAsync();
    }

    // ---------- Admin ----------

    public async Task RejectAppealAsync(long appealId, long adminUserId, string note, DateTimeOffset now)
    {
        var appeal = await db.PersonalPageHandleAppeals.FirstOrDefaultAsync(a => a.Id == appealId) ?? throw new PersonalPageException("not_found");
        if (appeal.Status != "pending") throw new PersonalPageException("appeal_closed");
        appeal.Status = "rejected";
        appeal.ReviewNote = PersonalPageRules.Clean(note, multiline: true) is var n && n.Length > 1000 ? n[..1000] : PersonalPageRules.Clean(note, multiline: true);
        appeal.ReviewedBy = adminUserId;
        appeal.ReviewedAt = now;
        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Da el nombre a quien apeló. El dueño actual queda con un nombre provisional (pagina-{id}) y el aviso de elegir otro sin
    /// esperar 30 días; su nombre no redirige (pasa al otro). Si quien apeló no tiene página, se le crea con el contenido inicial.
    /// Las demás apelaciones pendientes por ese nombre se cierran como rechazadas.
    /// </summary>
    public async Task TransferAsync(long appealId, long adminUserId, string note, Func<long, Task<PersonalPageContent>> initialFor, DateTimeOffset now)
    {
        // Dentro de una transacción ya abierta (pruebas) se usa esa; si no, una propia
        await using var tx = db.Database.CurrentTransaction == null ? await db.Database.BeginTransactionAsync() : null;
        var appeal = await db.PersonalPageHandleAppeals.FirstOrDefaultAsync(a => a.Id == appealId) ?? throw new PersonalPageException("not_found");
        if (appeal.Status != "pending") throw new PersonalPageException("appeal_closed");
        var handle = appeal.Handle;
        var current = await db.PersonalPages.FirstOrDefaultAsync(p => p.Handle == handle);
        if (current != null && current.ChannelUserId != appeal.RequesterChannelUserId)
        {
            current.Handle = $"pagina-{current.Id}";
            current.NeedsNewHandle = true;
            Touch(current, now);
            await db.SaveChangesAsync();
        }
        // El nombre deja de redirigir a cualquier otra página
        db.PersonalPageHandleHistory.RemoveRange(await db.PersonalPageHandleHistory.Where(h => h.Handle == handle).ToListAsync());

        var target = await db.PersonalPages.FirstOrDefaultAsync(p => p.ChannelUserId == appeal.RequesterChannelUserId);
        if (target == null)
        {
            target = new PersonalPage
            {
                ChannelUserId = appeal.RequesterChannelUserId, Handle = handle, Draft = Write(await initialFor(appeal.RequesterChannelUserId)),
                HandleChangedAt = now, CreatedAt = now, UpdatedAt = now,
            };
            db.PersonalPages.Add(target);
        }
        else if (target.Handle != handle)
        {
            db.PersonalPageHandleHistory.Add(new PersonalPageHandleHistory { PageId = target.Id, Handle = target.Handle, ValidUntil = now + PersonalPageRules.RedirectWindow, CreatedAt = now });
            target.Handle = handle;
            target.HandleChangedAt = now;
            target.NeedsNewHandle = false;
            Touch(target, now);
        }

        appeal.Status = "transferred";
        appeal.ReviewNote = PersonalPageRules.Clean(note, multiline: true);
        appeal.ReviewedBy = adminUserId;
        appeal.ReviewedAt = now;
        foreach (var other in await db.PersonalPageHandleAppeals.Where(a => a.Handle == handle && a.Status == "pending" && a.Id != appeal.Id).ToListAsync())
        {
            other.Status = "rejected";
            other.ReviewNote = "El nombre se asignó a otra apelación.";
            other.ReviewedBy = adminUserId;
            other.ReviewedAt = now;
        }
        await SaveUniqueAsync();
        if (tx != null) await tx.CommitAsync();
    }

    public async Task SetHiddenAsync(long pageId, bool hidden, string reason, DateTimeOffset now)
    {
        var page = await db.PersonalPages.FirstOrDefaultAsync(p => p.Id == pageId) ?? throw new PersonalPageException("not_found");
        page.Status = hidden ? "hidden" : "active";
        var clean = PersonalPageRules.Clean(reason);
        page.HiddenReason = hidden ? (clean.Length > 500 ? clean[..500] : clean) : "";
        Touch(page, now);
        await db.SaveChangesAsync();
    }

    public async Task AddReservedAsync(string handle, string note, long adminUserId, DateTimeOffset now)
    {
        if (PersonalPageRules.HandleError(handle) is { } error and not "reserved") throw new PersonalPageException(error);
        if (await db.PersonalPageReservedHandles.AnyAsync(r => r.Handle == handle)) throw new PersonalPageException("already_reserved");
        var clean = PersonalPageRules.Clean(note);
        db.PersonalPageReservedHandles.Add(new PersonalPageReservedHandle { Handle = handle, Note = clean.Length > 300 ? clean[..300] : clean, CreatedBy = adminUserId, CreatedAt = now });
        await SaveUniqueAsync("already_reserved");
    }

    public async Task RemoveReservedAsync(string handle)
    {
        var row = await db.PersonalPageReservedHandles.FirstOrDefaultAsync(r => r.Handle == handle) ?? throw new PersonalPageException("not_found");
        db.PersonalPageReservedHandles.Remove(row);
        await db.SaveChangesAsync();
    }

    public async Task SetForcedAdultAsync(long pageId, bool forced, DateTimeOffset now)
    {
        var page = await db.PersonalPages.FirstOrDefaultAsync(p => p.Id == pageId) ?? throw new PersonalPageException("not_found");
        page.ForcedAdult = forced;
        Touch(page, now);
        await db.SaveChangesAsync();
    }

    // ---------- Dominios (admin) ----------

    public async Task AddDomainAsync(string input, string kind, string note, long adminUserId, DateTimeOffset now)
    {
        var domain = PersonalPageRules.NormalizeDomain(input) ?? throw new PersonalPageException("domain_invalid");
        if (!PersonalPageRules.DomainKinds.Contains(kind)) throw new PersonalPageException("domain_kind");
        if (PersonalPageRules.IsProtectedHost(domain)) throw new PersonalPageException("domain_protected");
        var clean = PersonalPageRules.Clean(note);
        var row = await db.PersonalPageDomains.FirstOrDefaultAsync(d => d.Domain == domain);
        if (row == null)
            db.PersonalPageDomains.Add(new PersonalPageDomain { Domain = domain, Kind = kind, Note = Cut(clean, PersonalPageRules.DomainNoteMax), CreatedBy = adminUserId, CreatedAt = now });
        else
        {
            // Volver a agregarlo cambia el tipo (de adulto a bloqueado o al revés)
            row.Kind = kind;
            if (clean.Length > 0) row.Note = Cut(clean, PersonalPageRules.DomainNoteMax);
        }
        await SaveUniqueAsync("domain_exists");
    }

    public async Task RemoveDomainAsync(string input)
    {
        var domain = PersonalPageRules.NormalizeDomain(input) ?? throw new PersonalPageException("not_found");
        var row = await db.PersonalPageDomains.FirstOrDefaultAsync(d => d.Domain == domain) ?? throw new PersonalPageException("not_found");
        db.PersonalPageDomains.Remove(row);
        await db.SaveChangesAsync();
    }

    // ---------- Denuncias ----------

    /// <summary>
    /// Denuncia de una página publicada (o de un enlace suyo). Solo con sesión; no la propia; una abierta por persona y página
    /// y hasta <see cref="PersonalPageRules.ReportsPerDay"/> por día. El enlace se guarda como estaba al denunciar.
    /// </summary>
    public async Task<PersonalPageReport> ReportAsync(PersonalPage page, long reporterUserId, string reason, string detail, string? linkId, DateTimeOffset now)
    {
        if (page.ChannelUserId == reporterUserId) throw new PersonalPageException("own_page");
        if (!PersonalPageRules.ReportReasons.Contains(reason)) throw new PersonalPageException("report_reason");
        var clean = PersonalPageRules.Clean(detail, multiline: true);
        if (clean.Length > PersonalPageRules.ReportDetailMax) throw new PersonalPageException("report_detail");
        if (await db.PersonalPageReports.AnyAsync(r => r.PageId == page.Id && r.ReporterUserId == reporterUserId && r.Status == "open"))
            throw new PersonalPageException("report_pending");
        var since = now - TimeSpan.FromDays(1);
        if (await db.PersonalPageReports.CountAsync(r => r.ReporterUserId == reporterUserId && r.CreatedAt > since) >= PersonalPageRules.ReportsPerDay)
            throw new PersonalPageException("report_limit");

        var link = string.IsNullOrEmpty(linkId) ? null : (Read(page.Published).Links ?? new()).FirstOrDefault(l => l.Id == linkId);
        var report = new PersonalPageReport
        {
            PageId = page.Id, ReporterUserId = reporterUserId, Reason = reason, Detail = clean,
            LinkId = link?.Id ?? "", LinkUrl = Cut(link?.Url ?? "", PersonalPageRules.UrlMax), CreatedAt = now,
        };
        db.PersonalPageReports.Add(report);
        await SaveUniqueAsync("report_pending");
        return report;
    }

    /// <summary>
    /// Decide una denuncia abierta. dismiss: se descarta. hide: oculta la página (motivo = la nota) y cierra todas sus denuncias
    /// abiertas. force_adult: la página queda +18 sin que el dueño pueda desmarcarla. block_domain: bloquea el dominio del enlace
    /// denunciado (nunca el de una red de la lista ni decatron.net).
    /// </summary>
    public async Task ResolveReportAsync(long reportId, string action, string note, long adminUserId, DateTimeOffset now)
    {
        // La acción y el cierre de la denuncia van juntos (dentro de una transacción ya abierta, como en las pruebas, se usa esa)
        await using var tx = db.Database.CurrentTransaction == null ? await db.Database.BeginTransactionAsync() : null;
        var report = await db.PersonalPageReports.FirstOrDefaultAsync(r => r.Id == reportId) ?? throw new PersonalPageException("not_found");
        if (report.Status != "open") throw new PersonalPageException("report_closed");
        if (!PersonalPageRules.ReportActions.Contains(action)) throw new PersonalPageException("report_action");
        var cleanNote = Cut(PersonalPageRules.Clean(note, multiline: true), 1000);
        var closeAll = false;
        switch (action)
        {
            case "dismiss":
                report.Status = "dismissed";
                break;
            case "hide":
                await SetHiddenAsync(report.PageId, true, cleanNote, now);
                report.Status = "resolved"; report.Resolution = "hidden";
                closeAll = true;
                break;
            case "force_adult":
                await SetForcedAdultAsync(report.PageId, true, now);
                report.Status = "resolved"; report.Resolution = "forced_adult";
                break;
            case "block_domain":
                var domain = PersonalPageRules.NormalizeDomain(PersonalPageRules.HostOf(report.LinkUrl)) ?? throw new PersonalPageException("report_no_link");
                await AddDomainAsync(domain, "blocked", cleanNote.Length > 0 ? cleanNote : $"Denuncia #{report.Id}", adminUserId, now);
                report.Status = "resolved"; report.Resolution = "domain_blocked";
                break;
        }
        report.ReviewNote = cleanNote;
        report.ReviewedBy = adminUserId;
        report.ReviewedAt = now;
        if (closeAll)
            foreach (var other in await db.PersonalPageReports.Where(r => r.PageId == report.PageId && r.Status == "open" && r.Id != report.Id).ToListAsync())
            {
                other.Status = "resolved"; other.Resolution = "hidden"; other.ReviewNote = cleanNote; other.ReviewedBy = adminUserId; other.ReviewedAt = now;
            }
        await db.SaveChangesAsync();
        if (tx != null) await tx.CommitAsync();
    }

    // ---------- Enlaces del bot (5.5) ----------

    /// <summary>Un enlace del bot disponible: clave (sr, tip, sprites) y ruta pública en decatron.net.</summary>
    public sealed record BotLink(string Key, string Path);

    /// <summary>
    /// Páginas del bot que el canal tiene activas: pedir canciones (Song Request encendido), propinas (encendidas) y la
    /// colección de Sprites (al menos uno marcado). La ruta es la misma que usa cada módulo.
    /// </summary>
    public async Task<List<BotLink>> AvailableBotLinksAsync(long channelUserId)
    {
        var list = new List<BotLink>();
        var sr = await db.SongRequestConfigs.AsNoTracking().Where(c => c.UserId == channelUserId && c.Enabled).Select(c => c.ChannelName).FirstOrDefaultAsync();
        if (!string.IsNullOrWhiteSpace(sr)) list.Add(new("sr", $"/sr/{Uri.EscapeDataString(sr.ToLowerInvariant())}"));
        var tip = await db.TipsConfigs.AsNoTracking().Where(c => c.UserId == channelUserId && c.IsEnabled).Select(c => c.ChannelName).FirstOrDefaultAsync();
        if (!string.IsNullOrWhiteSpace(tip)) list.Add(new("tip", $"/tip/{Uri.EscapeDataString(tip.ToLowerInvariant())}"));
        if (await db.UserFortniteSprites.AsNoTracking().AnyAsync(x => x.UserId == channelUserId))
        {
            var login = await db.Users.AsNoTracking().Where(u => u.Id == channelUserId).Select(u => u.Login).FirstOrDefaultAsync();
            if (!string.IsNullOrWhiteSpace(login)) list.Add(new("sprites", $"/sprites/{Uri.EscapeDataString(login.ToLowerInvariant())}"));
        }
        return list;
    }

    /// <summary>Los enlaces del bot que el streamer agregó y que siguen activos (los apagados o sin módulo no salen).</summary>
    public static List<BotLink> ChosenBotLinks(PersonalPageBotLinks? chosen, List<BotLink> available) =>
        chosen == null ? new() : available.Where(b => b.Key switch { "sr" => chosen.SongRequest, "tip" => chosen.Tips, "sprites" => chosen.Sprites, _ => false }).ToList();

    // ---------- Estadísticas (5.5) ----------

    /// <summary>Suma una visita al día (una sola sentencia, sin carrera entre dos visitas a la vez).</summary>
    public Task RecordVisitAsync(long pageId, DateOnly day) =>
        db.Database.ExecuteSqlInterpolatedAsync($@"INSERT INTO personal_page_daily_stats (page_id, day, visits) VALUES ({pageId}, {day}, 1)
            ON CONFLICT (page_id, day) DO UPDATE SET visits = personal_page_daily_stats.visits + 1");

    public Task RecordClickAsync(long pageId, DateOnly day, string target) =>
        db.Database.ExecuteSqlInterpolatedAsync($@"INSERT INTO personal_page_click_stats (page_id, day, target, clicks) VALUES ({pageId}, {day}, {target}, 1)
            ON CONFLICT (page_id, day, target) DO UPDATE SET clicks = personal_page_click_stats.clicks + 1");

    public sealed record StatsDay(DateOnly Day, int Visits);
    public sealed record StatsTarget(string Target, int Clicks);
    public sealed record Stats(List<StatsDay> Days, int TotalVisits, List<StatsTarget> Clicks, int TotalClicks);

    /// <summary>
    /// Visitas por día (los días sin visitas van en 0) y clics por destino de los últimos <paramref name="days"/> días hasta
    /// <paramref name="today"/>. De paso borra los contadores de más de 12 meses de esa página.
    /// </summary>
    public async Task<Stats> StatsAsync(long pageId, int days, DateOnly today)
    {
        var cutoff = today.AddDays(-PersonalPageRules.StatsRetentionDays);
        await db.PersonalPageDailyStats.Where(x => x.PageId == pageId && x.Day < cutoff).ExecuteDeleteAsync();
        await db.PersonalPageClickStats.Where(x => x.PageId == pageId && x.Day < cutoff).ExecuteDeleteAsync();
        var from = today.AddDays(-(days - 1));
        var visits = await db.PersonalPageDailyStats.AsNoTracking().Where(x => x.PageId == pageId && x.Day >= from && x.Day <= today)
            .ToDictionaryAsync(x => x.Day, x => x.Visits);
        var series = Enumerable.Range(0, days).Select(i => from.AddDays(i)).Select(d => new StatsDay(d, visits.GetValueOrDefault(d))).ToList();
        var grouped = await db.PersonalPageClickStats.AsNoTracking().Where(x => x.PageId == pageId && x.Day >= from && x.Day <= today)
            .GroupBy(x => x.Target).Select(g => new { g.Key, Clicks = g.Sum(x => x.Clicks) }).ToListAsync();
        var clicks = grouped.Select(g => new StatsTarget(g.Key, g.Clicks)).OrderByDescending(x => x.Clicks).ThenBy(x => x.Target, StringComparer.Ordinal).ToList();
        return new Stats(series, series.Sum(x => x.Visits), clicks, clicks.Sum(x => x.Clicks));
    }

    private static string Cut(string value, int max) => value.Length > max ? value[..max] : value;

    private static void Touch(PersonalPage page, DateTimeOffset now)
    {
        page.UpdatedAt = now;
        page.Revision++;
    }

    /// <summary>Guarda y convierte una violación de único (dos personas pidiendo el mismo nombre a la vez) en un código claro.</summary>
    private async Task SaveUniqueAsync(string code = "taken")
    {
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new PersonalPageException(code);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new PersonalPageException("stale_revision");
        }
    }
}

public class PersonalPageException(string code, List<string>? details = null) : Exception(code)
{
    public string Code { get; } = code;
    public List<string> Details { get; } = details ?? new();
}
