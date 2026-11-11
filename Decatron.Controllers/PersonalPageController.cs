using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Security.Claims;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services;
using Decatron.Services.PersonalPages;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace Decatron.Controllers;

/// <summary>
/// Página personal del streamer (decatron.net/@handle), subfases 5.1 y 5.2: panel del streamer, página pública (+18 y denuncias) y administración.
/// Edita el dueño del canal o quien tenga control total (sección de permisos "personal_page"). Solo decatron.net por ahora:
/// en un tenant de la plataforma responde not_available. Plan: .dev/plans/pagina-personal/PLAN.md §9.
/// </summary>
[ApiController]
public class PersonalPageController(
    DecatronDbContext db,
    PersonalPageService pages,
    IPermissionService permissions,
    ITenantContext tenant,
    IConfiguration config,
    IHttpClientFactory httpFactory,
    ILogger<PersonalPageController> logger) : ControllerBase
{
    private const long MaxAvatarBytes = 10 * 1024 * 1024;
    private static readonly Regex AssetName = new("^avatar-[0-9a-f]{32}\\.webp$", RegexOptions.Compiled);

    private string AssetsPath => config["PersonalPages:PublicAssetsPath"] ?? "/var/www/html/decatron/personal-page-assets";
    /// <summary>Apagado hasta terminar la subfase 5.2 (+18, validación de destino y denuncias): mientras tanto solo la ven quienes la administran.</summary>
    private bool PublicOpen => config.GetValue<bool>("PersonalPages:PublicOpen");

    // ---------------- Panel del streamer ----------------

    public record CreateRequest(string Handle);
    public record DraftRequest(PersonalPageContent Content, long Revision);
    public record RevisionRequest(long Revision);
    public record HandleRequest(string Handle, long Revision);
    public record AppealRequest(string Handle, string Message);

    [Authorize, HttpGet("api/personal-page")]
    public async Task<IActionResult> Get()
    {
        var (channelId, denied) = await AuthorizeAsync();
        if (denied != null) return denied;
        var channel = await ChannelAsync(channelId);
        var page = await pages.ForChannelAsync(channelId);
        var now = DateTimeOffset.UtcNow;
        var policy = await pages.DomainPolicyAsync();
        Response.Headers.CacheControl = "no-store";
        return Ok(new
        {
            page = page == null ? null : PanelDto(page, now),
            suggestedHandle = page == null ? PersonalPageRules.SuggestHandle(channel?.Login) : null,
            channel = channel == null ? null : new { login = channel.Login, displayName = ChannelName(channel), photoUrl = ChannelPhoto(channel) },
            publicOpen = PublicOpen,
            platforms = PersonalPageRules.Platforms.Select(p => new { key = p.Key, name = p.Name, adult = p.Adult, example = $"https://{p.Hosts[0]}/" }),
            fonts = PersonalPageRules.Fonts,
            templates = PersonalPageRules.Templates,
            // Para marcar en el editor, mientras se escribe, lo que el servidor va a exigir (+18 forzado, bloqueados, acortadores)
            domains = new
            {
                adult = PersonalPageRules.BuiltInAdultDomains.Concat(policy.Adult).Distinct().OrderBy(d => d),
                blocked = policy.Blocked.OrderBy(d => d),
                shorteners = PersonalPageRules.Shorteners.OrderBy(d => d),
            },
            limits = new
            {
                handleMin = PersonalPageRules.HandleMin, handleMax = PersonalPageRules.HandleMax, displayName = PersonalPageRules.DisplayNameMax,
                bio = PersonalPageRules.BioMax, title = PersonalPageRules.TitleMax, links = PersonalPageRules.LinksMax, url = PersonalPageRules.UrlMax,
            },
        });
    }

    [Authorize, HttpGet("api/personal-page/handle-check")]
    public async Task<IActionResult> CheckHandle([FromQuery] string handle)
    {
        var (channelId, denied) = await AuthorizeAsync();
        if (denied != null) return denied;
        var page = await pages.ForChannelAsync(channelId);
        var normalized = PersonalPageRules.NormalizeHandle(handle);
        var code = normalized == page?.Handle ? null : await pages.AvailabilityAsync(normalized, page?.Id, DateTimeOffset.UtcNow);
        return Ok(new { handle = normalized, available = code == null, code });
    }

    [Authorize, HttpPost("api/personal-page")]
    public async Task<IActionResult> Create(CreateRequest request)
    {
        var (channelId, denied) = await AuthorizeAsync();
        if (denied != null) return denied;
        var channel = await ChannelAsync(channelId);
        if (channel == null) return NotFound(new { code = "channel_not_found" });
        var now = DateTimeOffset.UtcNow;
        var initial = PersonalPageRules.Initial(ChannelName(channel), await AccentFromUrlAsync(ChannelPhoto(channel)) ?? PersonalPageAccent.Fallback);
        return await Run(async () =>
        {
            var page = await pages.CreateAsync(channelId, PersonalPageRules.NormalizeHandle(request.Handle), initial, now);
            return Ok(new { page = PanelDto(page, now) });
        });
    }

    [Authorize, HttpPut("api/personal-page/draft"), RequestSizeLimit(128 * 1024)]
    public async Task<IActionResult> SaveDraft(DraftRequest request)
    {
        var (page, denied) = await OwnPageAsync();
        if (denied != null) return denied;
        var now = DateTimeOffset.UtcNow;
        return await Run(async () => { await pages.SaveDraftAsync(page!, request.Content, request.Revision, now); return Ok(new { page = PanelDto(page!, now) }); });
    }

    [Authorize, HttpPost("api/personal-page/publish")]
    public async Task<IActionResult> Publish(RevisionRequest request)
    {
        var (page, denied) = await OwnPageAsync();
        if (denied != null) return denied;
        var now = DateTimeOffset.UtcNow;
        return await Run(async () => { await pages.PublishAsync(page!, request.Revision, now); return Ok(new { page = PanelDto(page!, now) }); });
    }

    [Authorize, HttpPost("api/personal-page/discard")]
    public async Task<IActionResult> Discard(RevisionRequest request)
    {
        var (page, denied) = await OwnPageAsync();
        if (denied != null) return denied;
        var now = DateTimeOffset.UtcNow;
        return await Run(async () => { await pages.DiscardAsync(page!, request.Revision, now); return Ok(new { page = PanelDto(page!, now) }); });
    }

    [Authorize, HttpPut("api/personal-page/handle")]
    public async Task<IActionResult> ChangeHandle(HandleRequest request)
    {
        var (page, denied) = await OwnPageAsync();
        if (denied != null) return denied;
        var now = DateTimeOffset.UtcNow;
        return await Run(async () =>
        {
            await pages.ChangeHandleAsync(page!, PersonalPageRules.NormalizeHandle(request.Handle), request.Revision, now);
            return Ok(new { page = PanelDto(page!, now) });
        });
    }

    /// <summary>
    /// Sube la foto: se vuelve a codificar como WEBP (valida que sea imagen, quita metadatos, máximo 512 px), queda en el
    /// borrador y se devuelve el color sugerido sacado de la foto (el panel decide si lo aplica).
    /// </summary>
    [Authorize, HttpPost("api/personal-page/avatar"), Consumes("multipart/form-data"), RequestSizeLimit(MaxAvatarBytes + 64 * 1024)]
    public async Task<IActionResult> UploadAvatar([FromForm] IFormFile file, [FromForm] long revision)
    {
        var (page, denied) = await OwnPageAsync();
        if (denied != null) return denied;
        if (page!.Revision != revision) return Conflict(new { code = "stale_revision" });
        if (file == null || file.Length == 0) return BadRequest(new { code = "file_empty" });
        if (file.Length > MaxAvatarBytes) return BadRequest(new { code = "file_too_big" });

        Image<Rgba32> image;
        await using (var input = file.OpenReadStream())
        {
            try { image = await Image.LoadAsync<Rgba32>(input); }
            catch { return BadRequest(new { code = "file_not_image" }); }
        }

        string url, accent;
        using (image)
        {
            image.Metadata.ExifProfile = null;
            image.Metadata.XmpProfile = null;
            if (image.Width > 512 || image.Height > 512)
                image.Mutate(x => x.Resize(new ResizeOptions { Size = new Size(512, 512), Mode = ResizeMode.Max }));
            accent = AccentOf(image);
            var dir = Path.Combine(AssetsPath, page.Id.ToString());
            Directory.CreateDirectory(dir);
            var name = $"avatar-{Guid.NewGuid():N}.webp";
            await image.SaveAsWebpAsync(Path.Combine(dir, name), new WebpEncoder { Quality = 90 });
            url = $"/api/public/personal-pages/assets/{page.Id}/{name}";
        }

        var draft = PersonalPageService.Read(page.Draft);
        var previous = draft.AvatarUrl;
        var now = DateTimeOffset.UtcNow;
        var result = await Run(async () =>
        {
            await pages.SaveDraftAsync(page, draft with { AvatarUrl = url }, revision, now);
            return Ok(new { page = PanelDto(page, now), suggestedAccent = accent });
        });
        if (result is OkObjectResult) DeleteUnusedAvatar(page, previous);
        else DeleteUnusedAvatar(page, url);
        return result;
    }

    /// <summary>Color sugerido a partir de la foto actual del borrador (la subida o la del canal).</summary>
    [Authorize, HttpPost("api/personal-page/accent-from-photo")]
    public async Task<IActionResult> AccentFromPhoto()
    {
        var (page, denied) = await OwnPageAsync();
        if (denied != null) return denied;
        var draft = PersonalPageService.Read(page!.Draft);
        string? accent;
        if (TryOwnAsset(page, draft.AvatarUrl, out var path))
        {
            try { using var image = await Image.LoadAsync<Rgba32>(path); accent = AccentOf(image); }
            catch { accent = null; }
        }
        else
        {
            var channel = await ChannelAsync(page.ChannelUserId);
            accent = await AccentFromUrlAsync(string.IsNullOrEmpty(draft.AvatarUrl) ? ChannelPhoto(channel) : draft.AvatarUrl);
        }
        return accent == null ? UnprocessableEntity(new { code = "photo_unreadable" }) : Ok(new { accent });
    }

    [Authorize, HttpGet("api/personal-page/appeals")]
    public async Task<IActionResult> MyAppeals()
    {
        var (channelId, denied) = await AuthorizeAsync();
        if (denied != null) return denied;
        var list = await pages.MyAppealsAsync(channelId);
        return Ok(new { appeals = list.Select(a => new { a.Id, a.Handle, a.Message, a.Status, a.ReviewNote, a.CreatedAt, a.ReviewedAt }) });
    }

    [Authorize, HttpPost("api/personal-page/appeals"), RequestSizeLimit(16 * 1024)]
    public async Task<IActionResult> Appeal(AppealRequest request)
    {
        var (channelId, denied) = await AuthorizeAsync();
        if (denied != null) return denied;
        return await Run(async () =>
        {
            var appeal = await pages.AppealAsync(UserId(), channelId, PersonalPageRules.NormalizeHandle(request.Handle), request.Message ?? "", DateTimeOffset.UtcNow);
            return Ok(new { appeal = new { appeal.Id, appeal.Handle, appeal.Status } });
        });
    }

    [Authorize, HttpPost("api/personal-page/appeals/{id:long}/withdraw")]
    public async Task<IActionResult> WithdrawAppeal(long id)
    {
        var (channelId, denied) = await AuthorizeAsync();
        if (denied != null) return denied;
        return await Run(async () => { await pages.WithdrawAppealAsync(channelId, id, DateTimeOffset.UtcNow); return Ok(new { ok = true }); });
    }

    // ---------------- Página pública ----------------

    [AllowAnonymous, HttpGet("api/public/personal-pages/{handle}")]
    public async Task<IActionResult> Public(string handle)
    {
        Response.Headers.CacheControl = "no-store";
        if (tenant.TenantId != 1) return NotFound(new { code = "not_found" });
        var normalized = PersonalPageRules.NormalizeHandle(handle);
        if (PersonalPageRules.HandleError(normalized) is "length" or "chars" or "edge") return NotFound(new { code = "not_found" });
        var now = DateTimeOffset.UtcNow;
        var resolution = await pages.ResolveAsync(normalized, now);
        var page = resolution.Page;
        if (page == null)
            return resolution.RedirectTo != null && (PublicOpen || User.Identity?.IsAuthenticated == true)
                ? Ok(new { redirect = resolution.RedirectTo })
                : NotFound(new { code = "not_found" });

        var canManage = await CanManageAsync(page.ChannelUserId);
        if (!PublicOpen && !canManage) return NotFound(new { code = "not_open" });
        if (page.Status == "hidden" && !canManage) return NotFound(new { code = "hidden" });
        if (page.Published == null) return NotFound(new { code = canManage ? "not_published" : "not_found" });

        var channel = await ChannelAsync(page.ChannelUserId);
        var content = PersonalPageRules.PublicView(PersonalPageService.Read(page.Published), await pages.DomainPolicyAsync(), page.ForcedAdult);
        // Página +18: que los buscadores no la indexen (la app además pone la meta robots)
        if (content.Adult) Response.Headers["X-Robots-Tag"] = "noindex, nofollow";
        return Ok(new
        {
            handle = page.Handle,
            content,
            adult = content.Adult,
            channelPhotoUrl = ChannelPhoto(channel),
            preview = !PublicOpen,
            hidden = page.Status == "hidden",
            canManage,
            isOwner = UserId() == page.ChannelUserId,
            reportReasons = PersonalPageRules.ReportReasons,
        });
    }

    public record ReportRequest(string Reason, string? Detail, string? LinkId);

    /// <summary>
    /// Denunciar una página (o un enlace suyo). Con sesión obligatoria (decisión 2026-11-10) y límite por IP además del
    /// diario por persona. Solo páginas que quien denuncia puede ver.
    /// </summary>
    [Authorize, EnableRateLimiting("personal-page-report"), HttpPost("api/public/personal-pages/{handle}/report"), RequestSizeLimit(16 * 1024)]
    public async Task<IActionResult> Report(string handle, ReportRequest request)
    {
        if (tenant.TenantId != 1) return NotFound(new { code = "not_found" });
        var userId = UserId();
        if (userId == 0) return Unauthorized();
        var page = (await pages.ResolveAsync(PersonalPageRules.NormalizeHandle(handle), DateTimeOffset.UtcNow)).Page;
        if (page == null || page.Published == null) return NotFound(new { code = "not_found" });
        var canManage = await CanManageAsync(page.ChannelUserId);
        if ((!PublicOpen && !canManage) || (page.Status == "hidden" && !canManage)) return NotFound(new { code = "not_found" });
        var tracked = await db.PersonalPages.FirstAsync(p => p.Id == page.Id);
        return await Run(async () =>
        {
            var report = await pages.ReportAsync(tracked, userId, (request.Reason ?? "").Trim().ToLowerInvariant(), request.Detail ?? "", request.LinkId, DateTimeOffset.UtcNow);
            logger.LogInformation("personal_page.report {ReportId} page {PageId} reason {Reason}", report.Id, page.Id, report.Reason);
            return Ok(new { ok = true });
        });
    }

    /// <summary>Fotos subidas: públicas y con nombre único, se cachean mucho.</summary>
    [AllowAnonymous, HttpGet("api/public/personal-pages/assets/{pageId:long}/{file}")]
    public IActionResult Asset(long pageId, string file)
    {
        if (!AssetName.IsMatch(file)) return NotFound();
        var path = Path.Combine(AssetsPath, pageId.ToString(), file);
        if (!System.IO.File.Exists(path)) return NotFound();
        Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        return PhysicalFile(path, "image/webp");
    }

    // ---------------- Administración ----------------

    public record HideRequest(bool Hidden, string? Reason);
    public record ReservedRequest(string Handle, string? Note);
    public record ReviewRequest(string? Note);
    public record ForcedAdultRequest(bool Forced);
    public record DomainRequest(string Domain, string Kind, string? Note);
    public record ResolveRequest(string Action, string? Note);

    [Authorize, RequireSystemOwner, HttpGet("api/admin/personal-pages")]
    public async Task<IActionResult> AdminList([FromQuery] string? q)
    {
        var term = (q ?? "").Trim().ToLowerInvariant();
        var query = db.PersonalPages.AsNoTracking()
            .Join(db.Users.AsNoTracking(), p => p.ChannelUserId, u => u.Id, (p, u) => new { p, u.Login, u.DisplayName });
        if (term.Length > 0) query = query.Where(x => x.p.Handle.Contains(term) || x.Login.ToLower().Contains(term));
        var rows = await query.OrderByDescending(x => x.p.UpdatedAt).Take(200).ToListAsync();
        var ids = rows.Select(r => r.p.Id).ToList();
        var openReports = await db.PersonalPageReports.AsNoTracking().Where(r => ids.Contains(r.PageId) && r.Status == "open")
            .GroupBy(r => r.PageId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(g => g.Key, g => g.Count);
        return Ok(new
        {
            pages = rows.Select(x => new
            {
                x.p.Id, x.p.Handle, channel = x.Login, x.DisplayName, x.p.Status, x.p.HiddenReason, published = x.p.Published != null,
                x.p.PublishedAt, x.p.UpdatedAt, x.p.NeedsNewHandle, x.p.ForcedAdult,
                adult = x.p.ForcedAdult || (x.p.Published != null && PersonalPageService.Read(x.p.Published).Adult),
                openReports = openReports.GetValueOrDefault(x.p.Id),
            }),
        });
    }

    [Authorize, RequireSystemOwner, HttpPost("api/admin/personal-pages/{id:long}/visibility")]
    public Task<IActionResult> AdminVisibility(long id, HideRequest request) =>
        Run(async () => { await pages.SetHiddenAsync(id, request.Hidden, request.Reason ?? "", DateTimeOffset.UtcNow); return Ok(new { ok = true }); });

    [Authorize, RequireSystemOwner, HttpPost("api/admin/personal-pages/{id:long}/forced-adult")]
    public Task<IActionResult> AdminForcedAdult(long id, ForcedAdultRequest request) =>
        Run(async () => { await pages.SetForcedAdultAsync(id, request.Forced, DateTimeOffset.UtcNow); return Ok(new { ok = true }); });

    [Authorize, RequireSystemOwner, HttpGet("api/admin/personal-pages/reports")]
    public async Task<IActionResult> AdminReports([FromQuery] string? status)
    {
        var st = string.IsNullOrWhiteSpace(status) ? "open" : status.Trim().ToLowerInvariant();
        var rows = await db.PersonalPageReports.AsNoTracking()
            .Where(r => st == "all" || r.Status == st)
            .OrderBy(r => r.CreatedAt).Take(200)
            .Join(db.PersonalPages.AsNoTracking(), r => r.PageId, p => p.Id, (r, p) => new { r, p.Handle, p.Status, p.ForcedAdult, p.ChannelUserId })
            .Join(db.Users.AsNoTracking(), x => x.r.ReporterUserId, u => u.Id, (x, u) => new { x, reporter = u.Login })
            .ToListAsync();
        var ownerIds = rows.Select(r => r.x.ChannelUserId).Distinct().ToList();
        var owners = await db.Users.AsNoTracking().Where(u => ownerIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Login);
        return Ok(new
        {
            reports = rows.Select(r => new
            {
                r.x.r.Id, r.x.r.Reason, r.x.r.Detail, r.x.r.LinkUrl, r.x.r.Status, r.x.r.Resolution, r.x.r.ReviewNote, r.x.r.CreatedAt, r.x.r.ReviewedAt,
                r.x.r.PageId, handle = r.x.Handle, pageStatus = r.x.Status, forcedAdult = r.x.ForcedAdult, r.reporter,
                owner = owners.GetValueOrDefault(r.x.ChannelUserId),
                linkHost = PersonalPageRules.HostOf(r.x.r.LinkUrl),
                canBlockDomain = r.x.r.LinkUrl.Length > 0 && PersonalPageRules.NormalizeDomain(PersonalPageRules.HostOf(r.x.r.LinkUrl)) is { } d && !PersonalPageRules.IsProtectedHost(d),
            }),
        });
    }

    [Authorize, RequireSystemOwner, HttpPost("api/admin/personal-pages/reports/{id:long}/resolve")]
    public Task<IActionResult> AdminResolveReport(long id, ResolveRequest request) =>
        Run(async () => { await pages.ResolveReportAsync(id, (request.Action ?? "").Trim().ToLowerInvariant(), request.Note ?? "", UserId(), DateTimeOffset.UtcNow); return Ok(new { ok = true }); });

    [Authorize, RequireSystemOwner, HttpGet("api/admin/personal-pages/domains")]
    public async Task<IActionResult> AdminDomains() =>
        Ok(new
        {
            domains = await db.PersonalPageDomains.AsNoTracking().OrderBy(d => d.Kind).ThenBy(d => d.Domain).Select(d => new { d.Domain, d.Kind, d.Note, d.CreatedAt }).ToListAsync(),
            builtInAdult = PersonalPageRules.BuiltInAdultDomains.OrderBy(d => d),
            shorteners = PersonalPageRules.Shorteners.OrderBy(d => d),
        });

    [Authorize, RequireSystemOwner, HttpPost("api/admin/personal-pages/domains")]
    public Task<IActionResult> AdminAddDomain(DomainRequest request) =>
        Run(async () => { await pages.AddDomainAsync(request.Domain ?? "", (request.Kind ?? "").Trim().ToLowerInvariant(), request.Note ?? "", UserId(), DateTimeOffset.UtcNow); return Ok(new { ok = true }); });

    [Authorize, RequireSystemOwner, HttpDelete("api/admin/personal-pages/domains/{domain}")]
    public Task<IActionResult> AdminRemoveDomain(string domain) =>
        Run(async () => { await pages.RemoveDomainAsync(domain); return Ok(new { ok = true }); });

    [Authorize, RequireSystemOwner, HttpGet("api/admin/personal-pages/reserved")]
    public async Task<IActionResult> AdminReserved() =>
        Ok(new { reserved = await db.PersonalPageReservedHandles.AsNoTracking().OrderBy(r => r.Handle).Select(r => new { r.Handle, r.Note, r.CreatedAt }).ToListAsync(),
                 builtIn = PersonalPageRules.BuiltInReserved.OrderBy(x => x) });

    [Authorize, RequireSystemOwner, HttpPost("api/admin/personal-pages/reserved")]
    public Task<IActionResult> AdminAddReserved(ReservedRequest request) =>
        Run(async () => { await pages.AddReservedAsync(PersonalPageRules.NormalizeHandle(request.Handle), request.Note ?? "", UserId(), DateTimeOffset.UtcNow); return Ok(new { ok = true }); });

    [Authorize, RequireSystemOwner, HttpDelete("api/admin/personal-pages/reserved/{handle}")]
    public Task<IActionResult> AdminRemoveReserved(string handle) =>
        Run(async () => { await pages.RemoveReservedAsync(PersonalPageRules.NormalizeHandle(handle)); return Ok(new { ok = true }); });

    [Authorize, RequireSystemOwner, HttpGet("api/admin/personal-pages/appeals")]
    public async Task<IActionResult> AdminAppeals([FromQuery] string? status)
    {
        var st = string.IsNullOrWhiteSpace(status) ? "pending" : status.Trim().ToLowerInvariant();
        var rows = await db.PersonalPageHandleAppeals.AsNoTracking()
            .Where(a => st == "all" || a.Status == st)
            .OrderBy(a => a.CreatedAt).Take(200)
            .Join(db.Users.AsNoTracking(), a => a.RequesterChannelUserId, u => u.Id, (a, u) => new { a, requester = u.Login })
            .ToListAsync();
        var handles = rows.Select(r => r.a.Handle).Distinct().ToList();
        var owners = await db.PersonalPages.AsNoTracking().Where(p => handles.Contains(p.Handle))
            .Join(db.Users.AsNoTracking(), p => p.ChannelUserId, u => u.Id, (p, u) => new { p.Handle, u.Login, p.CreatedAt })
            .ToListAsync();
        return Ok(new
        {
            appeals = rows.Select(r => new
            {
                r.a.Id, r.a.Handle, r.a.Message, r.a.Status, r.a.ReviewNote, r.a.CreatedAt, r.a.ReviewedAt, r.requester,
                owner = owners.FirstOrDefault(o => o.Handle == r.a.Handle)?.Login,
                ownerSince = owners.FirstOrDefault(o => o.Handle == r.a.Handle)?.CreatedAt,
            }),
        });
    }

    [Authorize, RequireSystemOwner, HttpPost("api/admin/personal-pages/appeals/{id:long}/reject")]
    public Task<IActionResult> AdminReject(long id, ReviewRequest request) =>
        Run(async () => { await pages.RejectAppealAsync(id, UserId(), request.Note ?? "", DateTimeOffset.UtcNow); return Ok(new { ok = true }); });

    [Authorize, RequireSystemOwner, HttpPost("api/admin/personal-pages/appeals/{id:long}/transfer")]
    public Task<IActionResult> AdminTransfer(long id, ReviewRequest request) =>
        Run(async () =>
        {
            await pages.TransferAsync(id, UserId(), request.Note ?? "", async channelId =>
            {
                var channel = await ChannelAsync(channelId);
                return PersonalPageRules.Initial(ChannelName(channel), await AccentFromUrlAsync(ChannelPhoto(channel)) ?? PersonalPageAccent.Fallback);
            }, DateTimeOffset.UtcNow);
            return Ok(new { ok = true });
        });

    // ---------------- Ayudas ----------------

    private long UserId() => long.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;

    private long ChannelOwnerId()
    {
        var session = HttpContext.Session.GetString("ActiveChannelId");
        if (long.TryParse(session, out var sessionId)) return sessionId;
        if (long.TryParse(User.FindFirst("ChannelOwnerId")?.Value, out var claimId)) return claimId;
        return UserId();
    }

    /// <summary>Canal activo y si quien llama puede editar su página (dueño o control total). Solo en decatron.net.</summary>
    private async Task<(long channelId, IActionResult? denied)> AuthorizeAsync()
    {
        if (tenant.TenantId != 1) return (0, NotFound(new { code = "not_available" }));
        var userId = UserId();
        if (userId == 0) return (0, Unauthorized());
        var channelId = ChannelOwnerId();
        if (!await permissions.CanAccessAsync(userId, channelId, "personal_page"))
            return (0, StatusCode(403, new { code = "forbidden" }));
        return (channelId, null);
    }

    private async Task<(PersonalPage? page, IActionResult? denied)> OwnPageAsync()
    {
        var (channelId, denied) = await AuthorizeAsync();
        if (denied != null) return (null, denied);
        var page = await pages.ForChannelAsync(channelId);
        return page == null ? (null, NotFound(new { code = "no_page" })) : (page, null);
    }

    private async Task<bool> CanManageAsync(long channelUserId)
    {
        var userId = UserId();
        if (userId == 0) return false;
        try
        {
            if (await permissions.CanAccessAsync(userId, channelUserId, "personal_page")) return true;
            var login = (User.FindFirst("login")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value ?? "").ToLower();
            return await db.SystemAdmins.AsNoTracking().AnyAsync(a => a.Role == "owner" && (a.UserId == userId || (login != "" && a.Username.ToLower() == login)));
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "personal_page.can_manage_failed");
            return false;
        }
    }

    private Task<User?> ChannelAsync(long channelId) => db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == channelId);

    private static string ChannelName(User? u) =>
        u == null ? "" : !string.IsNullOrWhiteSpace(u.DisplayName) ? u.DisplayName : !string.IsNullOrWhiteSpace(u.KickUsername) ? u.KickUsername! : u.Login ?? "";

    private static string ChannelPhoto(User? u) =>
        u == null ? "" : !string.IsNullOrWhiteSpace(u.ProfileImageUrl) ? u.ProfileImageUrl : u.KickProfilePic ?? "";

    private object PanelDto(PersonalPage page, DateTimeOffset now) => new
    {
        id = page.Id,
        handle = page.Handle,
        draft = PersonalPageService.Read(page.Draft),
        published = page.Published != null,
        publishedAt = page.PublishedAt,
        hasUnpublishedChanges = PersonalPageService.HasUnpublishedChanges(page),
        status = page.Status,
        hiddenReason = page.HiddenReason,
        forcedAdult = page.ForcedAdult,
        needsNewHandle = page.NeedsNewHandle,
        canChangeHandle = page.NeedsNewHandle || PersonalPageRules.CanChangeHandle(page.HandleChangedAt, now),
        nextHandleChange = page.NeedsNewHandle ? null : PersonalPageRules.NextHandleChange(page.HandleChangedAt, now),
        revision = page.Revision,
    };

    private bool TryOwnAsset(PersonalPage page, string? url, out string path)
    {
        path = "";
        var prefix = $"/api/public/personal-pages/assets/{page.Id}/";
        if (string.IsNullOrEmpty(url) || !url.StartsWith(prefix)) return false;
        var file = url[prefix.Length..];
        if (!AssetName.IsMatch(file)) return false;
        path = Path.Combine(AssetsPath, page.Id.ToString(), file);
        return System.IO.File.Exists(path);
    }

    /// <summary>Borra una foto propia que ya no usan ni el borrador ni lo publicado.</summary>
    private void DeleteUnusedAvatar(PersonalPage page, string? url)
    {
        if (!TryOwnAsset(page, url, out var path)) return;
        if (PersonalPageService.Read(page.Draft).AvatarUrl == url || (page.Published != null && PersonalPageService.Read(page.Published).AvatarUrl == url)) return;
        try { System.IO.File.Delete(path); } catch { /* queda huérfana, no rompe nada */ }
    }

    private static string AccentOf(Image<Rgba32> image)
    {
        using var small = image.Clone(x => x.Resize(new ResizeOptions { Size = new Size(48, 48), Mode = ResizeMode.Max }));
        var pixels = new List<(byte, byte, byte, byte)>(small.Width * small.Height);
        small.ProcessPixelRows(rows =>
        {
            for (var y = 0; y < rows.Height; y++)
                foreach (var p in rows.GetRowSpan(y)) pixels.Add((p.R, p.G, p.B, p.A));
        });
        return PersonalPageAccent.FromPixels(pixels);
    }

    /// <summary>Color de una foto externa, solo de los CDN de Twitch y Kick (nada de pedir URLs arbitrarias desde el servidor).</summary>
    private async Task<string?> AccentFromUrlAsync(string? url)
    {
        if (string.IsNullOrWhiteSpace(url) || !Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps
            || !PersonalPageRules.AllowedPhotoHost(uri.IdnHost.ToLowerInvariant()))
            return null;
        try
        {
            var http = httpFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(5);
            using var response = await http.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead);
            if (!response.IsSuccessStatusCode || response.Content.Headers.ContentLength > MaxAvatarBytes) return null;
            await using var stream = await response.Content.ReadAsStreamAsync();
            using var image = await Image.LoadAsync<Rgba32>(stream);
            return AccentOf(image);
        }
        catch (Exception ex)
        {
            logger.LogInformation("personal_page.accent_photo_failed {Message}", ex.Message);
            return null;
        }
    }

    private async Task<IActionResult> Run(Func<Task<IActionResult>> action)
    {
        try { return await action(); }
        catch (PersonalPageException ex)
        {
            return ex.Code switch
            {
                "stale_revision" => Conflict(new { code = ex.Code }),
                "not_found" => NotFound(new { code = ex.Code }),
                _ => BadRequest(new { code = ex.Code, details = ex.Details }),
            };
        }
    }
}
