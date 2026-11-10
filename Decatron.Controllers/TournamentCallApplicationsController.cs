using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Core.Helpers;
using Decatron.Services.Tournament;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Decatron.Controllers;

[ApiController, Authorize]
public class TournamentCallApplicationsController(TournamentCallApplicationService service) : ControllerBase
{
    public record RevisionRequest(long Revision);
    private long? UserId => long.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;

    [HttpGet("api/me/convocatorias/fortnite-streamers")]
    public Task<IActionResult> Me() => Execute(async id => Ok(await service.Me(id)));

    [HttpPut("api/me/convocatorias/fortnite-streamers")]
    [RequestSizeLimit(16 * 1024)]
    public Task<IActionResult> Submit(CallApplicationInput input) => Execute(async id => Ok(await service.Submit(id, input, DateTimeOffset.UtcNow)));

    [HttpPost("api/me/convocatorias/fortnite-streamers/{kind}/withdraw")]
    public Task<IActionResult> Withdraw(string kind, RevisionRequest request) => Execute(async id => Ok(await service.Withdraw(id, kind, request.Revision, DateTimeOffset.UtcNow)));

    [RequireSystemOwner, HttpGet("api/admin/convocatorias/fortnite-streamers/applications")]
    public Task<IActionResult> List([FromQuery] string kind = "participant", [FromQuery] string status = "pending", [FromQuery] int page = 1)
        => Execute(async _ => Ok(await service.List(kind, status, page)));

    [RequireSystemOwner, HttpPut("api/admin/convocatorias/fortnite-streamers/applications/{id:long}")]
    public Task<IActionResult> Review(long id, CallApplicationReview request)
        => Execute(async reviewer => Ok(await service.Review(id, reviewer, request, DateTimeOffset.UtcNow)));

    private async Task<IActionResult> Execute(Func<long, Task<IActionResult>> action)
    {
        Response.Headers["Cache-Control"] = "no-store";
        if (UserId is not long id) return Unauthorized();
        try { return await action(id); }
        catch (CallApplicationException ex)
        {
            var status = ex.Code switch {
                "identity_missing" => 401, "channel_not_owned" => 403, "not_found" => 404,
                "stale_revision" or "rules_changed" or "notice_changed" or "identity_conflict" or "applications_closed" or "application_withdrawn" => 409,
                _ => 400
            };
            return StatusCode(status, new { code = ex.Code });
        }
    }
}
