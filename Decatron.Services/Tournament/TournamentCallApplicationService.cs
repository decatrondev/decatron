using System.Text.Json;
using Decatron.Core.Helpers;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Decatron.Services.Tournament;

public sealed class CallApplicationException(string code) : Exception(code)
{
    public string Code { get; } = code;
}

public record CallChannel(long Id, string Name, string Url, string AvatarUrl, bool? BotEnabled);
public record CallApplicationView(long Id, long ChannelUserId, string Kind, string DisplayName, string ChannelUrl,
    string AvatarUrl, string Contact, string Notes, string ContributionType, decimal? Amount, string Currency,
    bool PublicListing, bool UsesBot, bool WillStream, string Status, string ReviewNote, long Revision,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, string Origin = "form", bool CustodyAccepted = false,
    bool PublicOffer = false, CallLinkedContribution[]? Contributions = null, bool? BotEnabled = null);
// BotEnabled: solo bandeja del organizador; true = bot encendido en el canal del solicitante (no prueba que lo use), null = sin dato.
/// <summary>Resumen privado (solo bandeja del organizador) de los aportes ligados a una solicitud.</summary>
public record CallLinkedContribution(long Id, string Reference, string Status, bool IsTest, string Currency,
    decimal? GrossAmount, decimal? ReceivedAmount, DateTimeOffset CreatedAt);
public record CallPublicProfile(string Kind, string DisplayName, string ChannelUrl, string AvatarUrl);
public record CallCustodyOffer(string DisplayName, string ChannelUrl, string AvatarUrl, string ContributionType, decimal Amount, string Currency);
public record CallMeView(CallChannel[] Channels, string Contact, CallApplicationView[] Applications);
public record CallApplicationPage(CallApplicationView[] Items, int Total, int Page, int PageSize);

/// <summary>Convocatoria global: identidad propia, nunca ActiveChannelId ni permisos de moderación.</summary>
public sealed class TournamentCallApplicationService(DecatronDbContext db)
{
    private record Person(string Key, long[] UserIds, CallChannel[] Channels, string Contact);

    private async Task<Person> Identity(long userId)
    {
        var own = await db.Users.AsNoTracking().Where(u => u.Id == userId && u.IsActive)
            .Select(u => new { u.Id, u.AccountId, u.Email }).SingleOrDefaultAsync();
        if (own == null) throw new CallApplicationException("identity_missing");
        var users = await db.Users.AsNoTracking()
            .Where(u => u.IsActive && (u.Id == userId || (own.AccountId != null && u.AccountId == own.AccountId)))
            .Select(u => new { u.Id, u.TwitchId, u.KickId, u.Login, u.KickUsername, u.DisplayName, u.ProfileImageUrl, u.KickProfilePic }).ToArrayAsync();
        var ids = users.Select(u => u.Id).ToArray();
        var settings = await db.SystemSettings.AsNoTracking().Where(s => ids.Contains(s.UserId))
            .Select(s => new { s.UserId, s.BotEnabled }).ToArrayAsync();
        var channels = users.Where(u => !string.IsNullOrWhiteSpace(u.TwitchId) || !string.IsNullOrWhiteSpace(u.KickId))
            .OrderBy(u => u.Id).Select(u => new CallChannel(u.Id, string.IsNullOrWhiteSpace(u.DisplayName) ? u.Login : u.DisplayName,
                !string.IsNullOrWhiteSpace(u.TwitchId) ? "https://www.twitch.tv/" + Uri.EscapeDataString(u.Login) : "https://kick.com/" + Uri.EscapeDataString(u.KickUsername ?? u.Login),
                SafeAvatar(!string.IsNullOrWhiteSpace(u.TwitchId) ? u.ProfileImageUrl : u.KickProfilePic),
                settings.FirstOrDefault(s => s.UserId == u.Id)?.BotEnabled)).ToArray();
        return new Person(own.AccountId.HasValue ? $"account:{own.AccountId}" : $"user:{userId}", ids, channels, own.Email ?? "");
    }

    private static string SafeAvatar(string? url) => Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme == "https" ? url! : "";
    private IQueryable<TournamentCallApplication> Owned(Person person) => db.TournamentCallApplications
        .Where(a => a.IdentityKey == person.Key || person.UserIds.Contains(a.UserId));
    private static CallApplicationView View(TournamentCallApplication a) => new(a.Id, a.ChannelUserId, a.Kind, a.DisplayName,
        a.ChannelUrl, a.AvatarUrl, a.Contact, a.Notes, a.ContributionType, a.Amount, a.Currency, a.PublicListing,
        a.UsesBot, a.WillStream, a.Status, a.ReviewNote, a.Revision, a.CreatedAt, a.UpdatedAt, a.Origin,
        a.CustodyAcceptedAt.HasValue, a.PublicOffer);

    public async Task<CallMeView> Me(long userId)
    {
        var person = await Identity(userId);
        var rows = await Owned(person).AsNoTracking().OrderBy(a => a.Id).ToArrayAsync();
        return new(person.Channels, person.Contact, rows.Select(View).ToArray());
    }

    public async Task<CallApplicationView> Submit(long userId, CallApplicationInput input, DateTimeOffset now)
    {
        var error = TournamentCallApplicationRules.Validate(input);
        if (error != null) throw new CallApplicationException(error);
        var page = await db.TournamentCallPages.AsNoTracking().SingleOrDefaultAsync(p => p.Id == 1);
        if (page?.Published == null || !page.ApplicationsOpen) throw new CallApplicationException("applications_closed");
        if (TournamentCallApplicationRules.Version(page.Published) != input.PageVersion) throw new CallApplicationException("rules_changed");
        var person = await Identity(userId);
        var channel = person.Channels.SingleOrDefault(c => c.Id == input.ChannelUserId);
        if (channel == null) throw new CallApplicationException("channel_not_owned");
        var matches = await Owned(person).Where(a => a.Kind == input.Kind).OrderBy(a => a.Id).ToArrayAsync();
        if (matches.Length > 1) throw new CallApplicationException("identity_conflict");
        var row = matches.SingleOrDefault();
        if ((row?.Revision ?? 0) != input.Revision) throw new CallApplicationException("stale_revision");
        // El dinero se aporta pagando, sin esperar aprobacion. Solo se conservan las solicitudes de dinero que ya existian.
        if (input.Kind == "collaborator" && input.ContributionType == "money" && row?.ContributionType != "money")
            throw new CallApplicationException("money_via_payment");
        if (row == null)
        {
            row = new TournamentCallApplication { IdentityKey = person.Key, UserId = userId, Kind = input.Kind, CreatedAt = now };
            db.TournamentCallApplications.Add(row);
        }
        row.ChannelUserId = channel.Id;
        row.DisplayName = channel.Name;
        row.ChannelUrl = channel.Url;
        row.AvatarUrl = channel.AvatarUrl;
        row.Contact = input.Contact.Trim();
        row.Notes = input.Notes.Trim();
        row.ContributionType = input.Kind == "collaborator" ? input.ContributionType : "";
        row.Amount = input.Kind == "collaborator" ? input.Amount : null;
        row.Currency = input.Kind == "collaborator" && input.ContributionType != "vbucks" ? input.Currency : "";
        row.PublicListing = input.PublicListing;
        var custody = input.Kind == "collaborator" && TournamentCallApplicationRules.UnderCustody(input.ContributionType);
        row.CustodyAcceptedAt = custody ? now : null;
        row.CustodyNoticeVersion = custody ? TournamentCallApplicationRules.CustodyNoticeVersion : "";
        row.PublicOffer = custody && input.PublicListing && input.PublicOffer;
        row.Origin = "form"; // quien edita pasa a gestionar su solicitud; ya no se aprueba sola con el pago
        row.UsesBot = input.Kind == "participant" && input.UsesBot;
        row.WillStream = input.Kind == "participant" && input.WillStream;
        row.AcceptedAt = now;
        row.RulesSnapshot = page.Published;
        row.Status = "pending";
        row.ReviewNote = "";
        row.ReviewedAt = null;
        row.ReviewedBy = null;
        row.UpdatedAt = now;
        row.Revision++;
        await Save();
        return View(row);
    }

    public async Task<CallApplicationView> Withdraw(long userId, string kind, long revision, DateTimeOffset now)
    {
        if (!TournamentCallApplicationRules.Kind(kind)) throw new CallApplicationException("invalid_application");
        var person = await Identity(userId);
        var row = await Owned(person).FirstOrDefaultAsync(a => a.Kind == kind);
        if (row == null) throw new CallApplicationException("not_found");
        if (row.Revision != revision) throw new CallApplicationException("stale_revision");
        row.Status = "withdrawn";
        row.PublicListing = false;
        row.PublicOffer = false;
        row.UpdatedAt = now;
        row.Revision++;
        await Save();
        return View(row);
    }

    public async Task<CallApplicationPage> List(string kind, string status, int page)
    {
        if (!TournamentCallApplicationRules.Kind(kind) || (status != "all" && !TournamentCallApplicationRules.ReviewStatus(status) && status != "withdrawn"))
            throw new CallApplicationException("invalid_application");
        page = Math.Clamp(page, 1, 1000000);
        const int size = 25;
        var query = db.TournamentCallApplications.AsNoTracking().Where(a => a.Kind == kind);
        if (status != "all") query = query.Where(a => a.Status == status);
        var total = await query.CountAsync();
        var rows = await query.OrderByDescending(a => a.CreatedAt).ThenByDescending(a => a.Id).Skip((page - 1) * size).Take(size).ToArrayAsync();
        var ids = rows.Select(a => a.Id).ToArray();
        var linked = await db.TournamentCallContributions.AsNoTracking().Where(c => c.ApplicationId.HasValue && ids.Contains(c.ApplicationId.Value))
            .OrderBy(c => c.Id).ToArrayAsync();
        var paymentIds = linked.Where(c => c.PaymentId.HasValue).Select(c => c.PaymentId!.Value).ToArray();
        var tests = await db.SupporterPayments.AsNoTracking().Where(p => paymentIds.Contains(p.Id) && p.IsTest).Select(p => p.Id).ToArrayAsync();
        CallLinkedContribution[] For(long id) => linked.Where(c => c.ApplicationId == id).Select(c => new CallLinkedContribution(c.Id, c.Reference,
            c.Status, c.PaymentId.HasValue && tests.Contains(c.PaymentId.Value), c.Currency, c.GrossAmount, c.ReceivedAmount, c.CreatedAt)).ToArray();
        var channelIds = rows.Select(a => a.ChannelUserId).Distinct().ToArray();
        var bots = await db.SystemSettings.AsNoTracking().Where(s => channelIds.Contains(s.UserId)).Select(s => new { s.UserId, s.BotEnabled }).ToArrayAsync();
        return new(rows.Select(a => View(a) with { Contributions = For(a.Id), BotEnabled = bots.Where(b => b.UserId == a.ChannelUserId).Select(b => (bool?)b.BotEnabled).FirstOrDefault() }).ToArray(), total, page, size);
    }

    public async Task<CallApplicationView> Review(long id, long reviewerId, CallApplicationReview review, DateTimeOffset now)
    {
        if (!TournamentCallApplicationRules.ReviewStatus(review.Status) || !TournamentCallApplicationRules.Text(review.Note, 1000))
            throw new CallApplicationException("invalid_application");
        var row = await db.TournamentCallApplications.SingleOrDefaultAsync(a => a.Id == id);
        if (row == null) throw new CallApplicationException("not_found");
        if (row.Revision != review.Revision) throw new CallApplicationException("stale_revision");
        if (row.Status == "withdrawn") throw new CallApplicationException("application_withdrawn");
        row.Status = review.Status;
        row.ReviewNote = review.Note.Trim();
        row.ReviewedBy = reviewerId;
        row.ReviewedAt = now;
        row.UpdatedAt = now;
        row.Revision++;
        await Save();
        return View(row);
    }

    public Task<CallPublicProfile[]> PublicProfiles() => db.TournamentCallApplications.AsNoTracking()
        .Where(a => a.Status == "approved" && a.PublicListing)
        .OrderBy(a => a.DisplayName).ThenBy(a => a.Id)
        .Select(a => new CallPublicProfile(a.Kind, a.DisplayName, a.ChannelUrl, a.AvatarUrl)).ToArrayAsync();

    /// <summary>Ofertas bajo custodia del colaborador que aceptaron el aviso y consintieron mostrar la cantidad. No suman a premios.</summary>
    public Task<CallCustodyOffer[]> CustodyOffers() => db.TournamentCallApplications.AsNoTracking()
        .Where(a => a.Kind == "collaborator" && a.Status == "approved" && a.PublicListing && a.PublicOffer &&
            a.CustodyAcceptedAt != null && (a.ContributionType == "vbucks" || a.ContributionType == "giftcard") && a.Amount > 0)
        .OrderBy(a => a.DisplayName).ThenBy(a => a.Id)
        .Select(a => new CallCustodyOffer(a.DisplayName, a.ChannelUrl, a.AvatarUrl, a.ContributionType, a.Amount!.Value, a.Currency)).ToArrayAsync();

    /// <summary>Cuentas (ids de usuario) de la misma persona. Para listar sus aportes sin depender del recibo de una pestaña.</summary>
    public async Task<long[]> PersonUserIds(long userId) => (await Identity(userId)).UserIds;

    /// <summary>Canal con el que se prepara un pago con sesion. Sin canal pedido se usa el propio, o el primero vinculado.</summary>
    public async Task<long> ResolveChannel(long userId, long? requested)
    {
        var person = await Identity(userId);
        if (requested.HasValue) return person.Channels.Any(c => c.Id == requested) ? requested.Value : throw new CallApplicationException("channel_not_owned");
        return (person.Channels.FirstOrDefault(c => c.Id == userId) ?? person.Channels.FirstOrDefault())?.Id ?? throw new CallApplicationException("channel_not_owned");
    }

    /// <summary>
    /// Ficha de colaborador ligada a un pago. Si la persona ya tiene una solicitud de colaborador, solo la devuelve sin modificarla.
    /// Si no, crea una de origen "payment" pendiente: se aprueba al confirmar el organizador la recepcion.
    /// Nunca lanza por conflicto de unicidad: devuelve la existente.
    /// </summary>
    public async Task<long?> EnsureCollaboratorForPayment(long userId, long channelUserId, bool publicListing, string email, decimal amountUsd, DateTimeOffset now)
    {
        var person = await Identity(userId);
        var channel = person.Channels.SingleOrDefault(c => c.Id == channelUserId) ?? throw new CallApplicationException("channel_not_owned");
        var matches = await Owned(person).Where(a => a.Kind == "collaborator").OrderBy(a => a.Id).ToArrayAsync();
        if (matches.Length > 1) return null; // identidad ambigua: no se adivina, el organizador asocia a mano
        if (matches.Length == 1) return matches[0].Id;
        var page = await db.TournamentCallPages.AsNoTracking().SingleOrDefaultAsync(p => p.Id == 1);
        var row = new TournamentCallApplication {
            IdentityKey = person.Key, UserId = userId, ChannelUserId = channel.Id, Kind = "collaborator", Origin = "payment",
            DisplayName = channel.Name, ChannelUrl = channel.Url, AvatarUrl = channel.AvatarUrl,
            Contact = string.IsNullOrWhiteSpace(person.Contact) ? email.Trim() : person.Contact, Notes = "",
            ContributionType = "money", Amount = amountUsd, Currency = "USD", PublicListing = publicListing,
            AcceptedAt = now, RulesSnapshot = page?.Published ?? "{}", Status = "pending", ReviewNote = "",
            CreatedAt = now, UpdatedAt = now, Revision = 1 };
        db.TournamentCallApplications.Add(row);
        try { await db.SaveChangesAsync(); return row.Id; }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            db.Entry(row).State = EntityState.Detached;
            return (await Owned(person).AsNoTracking().Where(a => a.Kind == "collaborator").OrderBy(a => a.Id).FirstOrDefaultAsync())?.Id;
        }
    }

    private async Task Save()
    {
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateConcurrencyException) { throw new CallApplicationException("stale_revision"); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        { throw new CallApplicationException("stale_revision"); }
    }
}
