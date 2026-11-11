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

    public async Task SaveDraftAsync(PersonalPage page, PersonalPageContent content, long revision, DateTimeOffset now)
    {
        if (page.Revision != revision) throw new PersonalPageException("stale_revision");
        var normalized = PersonalPageRules.Normalize(content);
        var errors = PersonalPageRules.Errors(normalized, forPublish: false);
        if (errors.Count > 0) throw new PersonalPageException("invalid_content", errors);
        page.Draft = Write(normalized);
        Touch(page, now);
        await db.SaveChangesAsync();
    }

    public async Task PublishAsync(PersonalPage page, long revision, DateTimeOffset now)
    {
        if (page.Revision != revision) throw new PersonalPageException("stale_revision");
        var draft = PersonalPageRules.Normalize(Read(page.Draft));
        var errors = PersonalPageRules.Errors(draft, forPublish: true);
        if (errors.Count > 0) throw new PersonalPageException("incomplete_content", errors);
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
