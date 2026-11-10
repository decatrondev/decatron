using System;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Core.Helpers;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services.Tournament;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers;

[ApiController]
public class TournamentCallController(DecatronDbContext db, TournamentCallApplicationService applications, TournamentCallContributionService contributions) : ControllerBase
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public record SaveRequest(TournamentCallContent Content, long Revision);
    public record RevisionRequest(long Revision);
    public record ApplicationsRequest(bool Open, long Revision);

    [AllowAnonymous, HttpGet("api/convocatorias/fortnite-streamers")]
    public async Task<IActionResult> Public()
    {
        Response.Headers["Cache-Control"] = "no-store";
        var page = await db.Set<TournamentCallPage>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == 1);
        return page?.Published == null ? NotFound() : Ok(new {
            content = JsonSerializer.Deserialize<TournamentCallContent>(page.Published, Json),
            applicationsOpen = page.ApplicationsOpen,
            donationsOpen = page.DonationsOpen,
            contributions = await contributions.Public(),
            pageVersion = TournamentCallApplicationRules.Version(page.Published),
            profiles = await applications.PublicProfiles(),
            custodyOffers = await applications.CustodyOffers(),
            custodyNoticeVersion = TournamentCallApplicationRules.CustodyNoticeVersion
        });
    }

    [Authorize, RequireSystemOwner, HttpGet("api/admin/convocatorias/fortnite-streamers")]
    public async Task<IActionResult> Admin()
    {
        var page = await db.Set<TournamentCallPage>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == 1);
        if (page == null) return StatusCode(503, new { code = "migration_required" });
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(new { content = JsonSerializer.Deserialize<TournamentCallContent>(page.Draft, Json), revision = page.Revision, published = page.Published != null, applicationsOpen = page.ApplicationsOpen, donationsOpen = page.DonationsOpen });
    }

    [Authorize, RequireSystemOwner, HttpPut("api/admin/convocatorias/fortnite-streamers")]
    [RequestSizeLimit(64 * 1024)]
    public async Task<IActionResult> Save(SaveRequest request)
    {
        if (!TournamentCallRules.Valid(request.Content, false)) return BadRequest(new { code = "invalid_content" });
        var page = await db.Set<TournamentCallPage>().SingleAsync(x => x.Id == 1);
        if (page.Revision != request.Revision) return Conflict(new { code = "stale_revision" });
        page.Draft = JsonSerializer.Serialize(request.Content, Json);
        return await Commit(page);
    }

    [Authorize, RequireSystemOwner, HttpPost("api/admin/convocatorias/fortnite-streamers/publish")]
    public async Task<IActionResult> Publish(RevisionRequest request)
    {
        var page = await db.Set<TournamentCallPage>().SingleAsync(x => x.Id == 1);
        if (page.Revision != request.Revision) return Conflict(new { code = "stale_revision" });
        if (!TournamentCallRules.Valid(JsonSerializer.Deserialize<TournamentCallContent>(page.Draft, Json), true)) return BadRequest(new { code = "incomplete_content" });
        // Registration is intentionally not opened by publishing this informational page.
        page.Published = page.Draft;
        return await Commit(page);
    }

    [Authorize, RequireSystemOwner, HttpPost("api/admin/convocatorias/fortnite-streamers/unpublish")]
    public async Task<IActionResult> Unpublish(RevisionRequest request)
    {
        var page = await db.Set<TournamentCallPage>().SingleAsync(x => x.Id == 1);
        if (page.Revision != request.Revision) return Conflict(new { code = "stale_revision" });
        page.Published = null;
        page.ApplicationsOpen = false;
        page.DonationsOpen = false;
        return await Commit(page);
    }

    private async Task<IActionResult> Commit(TournamentCallPage page)
    {
        page.Revision++;
        page.UpdatedAt = DateTimeOffset.UtcNow;
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateConcurrencyException) { return Conflict(new { code = "stale_revision" }); }
        return Ok(new { revision = page.Revision, published = page.Published != null, applicationsOpen = page.ApplicationsOpen, donationsOpen = page.DonationsOpen });
    }

    [Authorize, RequireSystemOwner, HttpPut("api/admin/convocatorias/fortnite-streamers/applications-open")]
    public async Task<IActionResult> SetApplications(ApplicationsRequest request)
    {
        var page = await db.TournamentCallPages.SingleAsync(p => p.Id == 1);
        if (page.Revision != request.Revision) return Conflict(new { code = "stale_revision" });
        if (request.Open && page.Published == null) return Conflict(new { code = "page_unpublished" });
        page.ApplicationsOpen = request.Open;
        return await Commit(page);
    }

    [Authorize, RequireSystemOwner, HttpPut("api/admin/convocatorias/fortnite-streamers/donations-open")]
    public async Task<IActionResult> SetDonations(ApplicationsRequest request)
    {
        var page = await db.TournamentCallPages.SingleAsync(p => p.Id == 1);
        if (page.Revision != request.Revision) return Conflict(new { code = "stale_revision" });
        if (request.Open && page.Published == null) return Conflict(new { code = "page_unpublished" });
        page.DonationsOpen = request.Open;
        return await Commit(page);
    }
}
