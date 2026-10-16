using System.Security.Claims;
using Decatron.Core.Helpers;
using Decatron.Core.Models.Multiview;
using Decatron.Data;
using Decatron.Services.Accounts;
using Decatron.Services.Multiview;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    /// <summary>
    /// Layouts guardados del Multi-view de quien inició sesión (qué canales y qué distribución). Son de la persona, no de
    /// una plataforma: se guardan en la fila principal de su cuenta. Plan: .dev/plans/MULTIVIEW_PLAN.md, Fase 5.
    /// </summary>
    [Route("api/multiview/layouts")]
    [ApiController]
    [Authorize]
    [Decatron.Core.Interfaces.RequiresModule("module.multiview")]
    public class MultiviewLayoutsController : ControllerBase
    {
        private const int NameMax = 60;
        private static readonly string[] Layouts = { "grid", "focus", "stack" };

        private readonly DecatronDbContext _db;
        private readonly AccountChannelResolver _accounts;
        private readonly ILogger<MultiviewLayoutsController> _logger;

        public MultiviewLayoutsController(DecatronDbContext db, AccountChannelResolver accounts, ILogger<MultiviewLayoutsController> logger)
        {
            _db = db;
            _accounts = accounts;
            _logger = logger;
        }

        public record LayoutRequest(string? Name, string[]? Slots, string? Layout);

        private long? CurrentUserId() =>
            long.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;

        /// <summary>La fila dueña de los layouts: la principal de la cuenta (así se ven con Twitch y con Kick).</summary>
        private async Task<long?> OwnerAsync()
        {
            var userId = CurrentUserId();
            if (userId == null) return null;
            var account = await _accounts.ResolveByUserIdAsync(userId.Value);
            return account?.Principal.UserId ?? userId;
        }

        private static object Dto(MultiviewLayout l) => new
        {
            id = l.Id,
            name = l.Name,
            slots = l.Slots.Split(',', StringSplitOptions.RemoveEmptyEntries),
            layout = l.Layout,
            updatedAt = l.UpdatedAt
        };

        /// <summary>Normaliza y valida; null si algo no es válido.</summary>
        private static (string Name, string Slots, string Layout)? Validate(LayoutRequest r)
        {
            var name = (r.Name ?? "").Trim();
            if (name.Length is 0 or > NameMax) return null;
            var keys = (r.Slots ?? Array.Empty<string>())
                .Select(k => (k ?? "").Trim().ToLowerInvariant())
                .Where(k => MultiviewChatService.TryParseKey(k, out _, out _))
                .Distinct()
                .Take(MultiviewTierLimits.HardMaxSlots)
                .ToArray();
            if (keys.Length == 0) return null;
            var layout = (r.Layout ?? "grid").ToLowerInvariant();
            if (!Layouts.Contains(layout)) layout = "grid";
            return (name, string.Join(',', keys), layout);
        }

        [HttpGet]
        public async Task<IActionResult> List()
        {
            var owner = await OwnerAsync();
            if (owner == null) return Unauthorized();
            var userId = CurrentUserId()!.Value;
            var items = await _db.MultiviewLayouts.AsNoTracking().Where(l => l.OwnerUserId == owner).OrderBy(l => l.Name).ToListAsync();
            var tier = await TierResolver.GetEffectiveTierAsync(_db, userId);
            return Ok(new { max = MultiviewTierLimits.ForTier(tier).MaxLayouts, items = items.Select(Dto) });
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] LayoutRequest request)
        {
            var owner = await OwnerAsync();
            if (owner == null) return Unauthorized();
            var v = Validate(request ?? new LayoutRequest(null, null, null));
            if (v == null) return BadRequest(new { error = "invalid" });

            var tier = await TierResolver.GetEffectiveTierAsync(_db, CurrentUserId()!.Value);
            var max = MultiviewTierLimits.ForTier(tier).MaxLayouts;
            var existing = await _db.MultiviewLayouts.Where(l => l.OwnerUserId == owner).Select(l => new { l.Id, l.Name }).ToListAsync();
            var same = existing.FirstOrDefault(l => string.Equals(l.Name, v.Value.Name, StringComparison.OrdinalIgnoreCase));
            if (same != null) return Conflict(new { error = "exists", id = same.Id });
            if (existing.Count >= max) return StatusCode(StatusCodes.Status403Forbidden, new { error = "limit", max });

            var now = DateTime.UtcNow;
            var layout = new MultiviewLayout { OwnerUserId = owner.Value, Name = v.Value.Name, Slots = v.Value.Slots, Layout = v.Value.Layout, CreatedAt = now, UpdatedAt = now };
            _db.MultiviewLayouts.Add(layout);
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateException ex)
            {
                _logger.LogWarning(ex, "No se pudo guardar un layout del Multi-view");
                return Conflict(new { error = "exists" });
            }
            return Ok(Dto(layout));
        }

        /// <summary>Reemplaza un layout propio (nombre, canales y distribución).</summary>
        [HttpPut("{id:long}")]
        public async Task<IActionResult> Update(long id, [FromBody] LayoutRequest request)
        {
            var owner = await OwnerAsync();
            if (owner == null) return Unauthorized();
            var v = Validate(request ?? new LayoutRequest(null, null, null));
            if (v == null) return BadRequest(new { error = "invalid" });
            var layout = await _db.MultiviewLayouts.FirstOrDefaultAsync(l => l.Id == id && l.OwnerUserId == owner);
            if (layout == null) return NotFound();

            var clash = await _db.MultiviewLayouts.AnyAsync(l => l.OwnerUserId == owner && l.Id != id && l.Name.ToLower() == v.Value.Name.ToLower());
            if (clash) return Conflict(new { error = "exists" });
            layout.Name = v.Value.Name;
            layout.Slots = v.Value.Slots;
            layout.Layout = v.Value.Layout;
            layout.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(Dto(layout));
        }

        [HttpDelete("{id:long}")]
        public async Task<IActionResult> Delete(long id)
        {
            var owner = await OwnerAsync();
            if (owner == null) return Unauthorized();
            var layout = await _db.MultiviewLayouts.FirstOrDefaultAsync(l => l.Id == id && l.OwnerUserId == owner);
            if (layout == null) return NotFound();
            _db.MultiviewLayouts.Remove(layout);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}
