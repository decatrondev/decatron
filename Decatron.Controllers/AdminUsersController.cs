using Decatron.Attributes;
using Decatron.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading.Tasks;

namespace Decatron.Controllers
{
    /// <summary>
    /// Búsqueda de cuentas para las pantallas de administración. Existe aparte de cada
    /// feature porque todas necesitan lo mismo —encontrar un canal por nombre— y tenerlo
    /// duplicado significa que el día que cambie la consulta se arregla en un sitio y se
    /// olvida en el otro.
    /// </summary>
    [ApiController]
    [Route("api/admin/users")]
    [Authorize]
    [RequireSystemOwner]
    public class AdminUsersController : ControllerBase
    {
        private readonly DecatronDbContext _db;

        public AdminUsersController(DecatronDbContext db)
        {
            _db = db;
        }

        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string q = "", [FromQuery] int limit = 10)
        {
            var term = (q ?? "").Trim().ToLower();
            if (term.Length < 2)
                return Ok(new { success = true, users = Array.Empty<object>() });

            var users = await _db.Users
                .Where(u => u.Login.ToLower().Contains(term) ||
                            (u.DisplayName != null && u.DisplayName.ToLower().Contains(term)))
                // Los que empiezan por lo escrito primero: es casi siempre el que buscas
                .OrderByDescending(u => u.Login.ToLower().StartsWith(term))
                .ThenBy(u => u.Login)
                .Take(Math.Clamp(limit, 1, 25))
                .Select(u => new
                {
                    id = u.Id,
                    login = u.Login,
                    displayName = u.DisplayName,
                    profileImageUrl = u.ProfileImageUrl
                })
                .ToListAsync();

            return Ok(new { success = true, users });
        }
    }
}
