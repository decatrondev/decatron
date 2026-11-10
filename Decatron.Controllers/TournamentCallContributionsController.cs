using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Core.Helpers;
using Decatron.Services.Tournament;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Decatron.Controllers;

[ApiController, Authorize, RequireSystemOwner, Route("api/admin/convocatorias/fortnite-streamers/contributions")]
public class TournamentCallContributionsController(TournamentCallContributionService service) : ControllerBase
{
    [HttpGet] public Task<IActionResult> List([FromQuery] int page = 1) => Execute(async _ => Ok(await service.List(page)));
    [HttpPost, RequestSizeLimit(16 * 1024)] public Task<IActionResult> Create(CallContributionInput input) =>
        Execute(async actor => Ok(await service.Save(null, actor, input, DateTimeOffset.UtcNow)));
    [HttpPut("{id:long}"), RequestSizeLimit(16 * 1024)] public Task<IActionResult> Update(long id, CallContributionInput input) =>
        Execute(async actor => Ok(await service.Save(id, actor, input, DateTimeOffset.UtcNow)));
    [HttpGet("{id:long}/history")] public Task<IActionResult> History(long id) => Execute(async _ => Ok(await service.History(id)));
    [HttpGet("recovery")] public Task<IActionResult> Recovery() => Execute(async _ => Ok(await service.Recovery()));
    private async Task<IActionResult> Execute(Func<long, Task<IActionResult>> action)
    {
        Response.Headers["Cache-Control"] = "no-store";
        if (!long.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var actor)) return Unauthorized();
        try { return await action(actor); }
        catch (CallContributionException ex) { return StatusCode(ex.Code == "not_found" ? 404 : ex.Code is "stale_revision" or "duplicate_reference" ? 409 : 400, new { code = ex.Code }); }
    }
}
