using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Decatron.Services.GameData;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Decatron.Controllers
{
    /// <summary>
    /// Cuentas de juego de la PERSONA logueada (no del canal): Settings -> Cuentas
    /// de juego. Generaliza /api/me/riot-accounts (que sigue vivo para Torneos) a
    /// todos los juegos del modulo Game Overlays. Ver GAME_OVERLAYS_PLAN.md §3.
    /// </summary>
    [ApiController]
    [Route("api/me/game-accounts")]
    [Authorize]
    public class GameAccountsController : ControllerBase
    {
        private readonly GameAccountService _accounts;

        public GameAccountsController(GameAccountService accounts)
        {
            _accounts = accounts;
        }

        private long GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(claim, out var id) ? id : 0;
        }

        [HttpGet]
        public async Task<IActionResult> List()
        {
            var userId = GetUserId();
            if (userId == 0) return Unauthorized();
            var accountId = await _accounts.EffectiveAccountIdAsync(userId);
            var list = await _accounts.ListAsync(accountId);
            return Ok(new { success = true, accounts = list.Select(_accounts.ToDto), catalog = _accounts.Catalog() });
        }

        [HttpGet("catalog")]
        public IActionResult Catalog() => Ok(new { success = true, catalog = _accounts.Catalog() });

        [HttpPost]
        public async Task<IActionResult> Link([FromBody] GameAccountService.LinkRequest req)
        {
            var userId = GetUserId();
            if (userId == 0) return Unauthorized();
            var (account, error) = await _accounts.LinkAsync(userId, req);
            if (account == null) return BadRequest(new { success = false, message = error });
            return Ok(new { success = true, account = _accounts.ToDto(account) });
        }

        [HttpPost("{id:long}/verify")]
        public async Task<IActionResult> Verify(long id)
        {
            var userId = GetUserId();
            if (userId == 0) return Unauthorized();
            var (ok, message) = await _accounts.VerifyAsync(userId, id);
            return ok ? Ok(new { success = true, message }) : BadRequest(new { success = false, message });
        }

        [HttpPut("{id:long}")]
        public async Task<IActionResult> Update(long id, [FromBody] GameAccountService.UpdateRequest req)
        {
            var userId = GetUserId();
            if (userId == 0) return Unauthorized();
            var (account, error) = await _accounts.UpdateAsync(userId, id, req);
            if (account == null) return NotFound(new { success = false, message = error });
            return Ok(new { success = true, account = _accounts.ToDto(account) });
        }

        [HttpDelete("{id:long}")]
        public async Task<IActionResult> Delete(long id)
        {
            var userId = GetUserId();
            if (userId == 0) return Unauthorized();
            var ok = await _accounts.DeleteAsync(userId, id);
            return ok ? Ok(new { success = true }) : NotFound(new { success = false, message = "Cuenta no encontrada" });
        }
    }
}
