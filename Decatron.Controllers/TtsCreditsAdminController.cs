using Decatron.Attributes;
using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace Decatron.Controllers
{
    /// <summary>
    /// Gestión de créditos TTS desde el panel de administración: buscar un canal, ver su
    /// saldo y su historial, y otorgar o ajustar créditos a mano.
    ///
    /// Todo movimiento queda en el libro mayor con el id del admin que lo hizo. No hay
    /// forma de "poner un número": el saldo es siempre el resultado de los movimientos.
    ///
    /// </summary>
    [ApiController]
    [Route("api/admin/tts-credits")]
    [Authorize]
    [RequireSystemOwner]
    public class TtsCreditsAdminController : ControllerBase
    {
        private readonly DecatronDbContext _db;
        private readonly ITtsCreditService _credits;
        private readonly ILogger<TtsCreditsAdminController> _logger;

        public TtsCreditsAdminController(
            DecatronDbContext db,
            ITtsCreditService credits,
            ILogger<TtsCreditsAdminController> logger)
        {
            _db = db;
            _credits = credits;
            _logger = logger;
        }

        // La búsqueda de canales vive en AdminUsersController: la usan también las
        // pantallas de supporters y no tiene sentido tener dos copias.

        /// <summary>Saldo, tier y últimos movimientos de un canal.</summary>
        [HttpGet("{userId:long}")]
        public async Task<IActionResult> GetUserCredits(long userId, [FromQuery] int historyLimit = 30)
        {
            var user = await _db.Users
                .Where(u => u.Id == userId)
                .Select(u => new { u.Id, u.Login, u.DisplayName, u.ProfileImageUrl })
                .FirstOrDefaultAsync();

            if (user == null)
                return NotFound(new { success = false, message = "Usuario no encontrado" });

            var balance = await _credits.GetBalanceAsync(userId);
            var history = await _credits.GetHistoryAsync(userId, historyLimit);
            var tierExpiresAt = await TierResolver.GetTierExpiryAsync(_db, userId);

            // Quién otorgó cada movimiento manual, para que el historial diga un nombre
            // y no un número. Una sola consulta en vez de una por fila.
            var grantorIds = history.Where(h => h.GrantedBy.HasValue)
                .Select(h => h.GrantedBy!.Value).Distinct().ToList();
            var grantors = grantorIds.Count == 0
                ? new Dictionary<long, string>()
                : await _db.Users.Where(u => grantorIds.Contains(u.Id))
                    .ToDictionaryAsync(u => u.Id, u => u.DisplayName ?? u.Login);

            return Ok(new
            {
                success = true,
                user,
                tier = balance.Tier,
                tierExpiresAt,
                isUnlimited = balance.IsUnlimited,

                premium = new
                {
                    monthlyGranted = balance.MonthlyGranted,
                    monthlyUsed = balance.MonthlyUsed,
                    monthlyRemaining = balance.MonthlyRemaining,
                    purchasedBalance = balance.PurchasedBalance,
                    totalAvailable = balance.TotalAvailable
                },

                standard = new
                {
                    granted = balance.StandardGranted,
                    used = balance.StandardUsed,
                    remaining = balance.StandardRemaining
                },

                history = history.Select(h => new
                {
                    id = h.Id,
                    createdAt = h.CreatedAt,
                    type = h.Type,
                    credits = h.Credits,
                    bucket = h.Bucket,
                    feature = h.Feature,
                    engine = h.Engine,
                    chars = h.Chars,
                    voice = h.Voice,
                    note = h.Note,
                    grantedBy = h.GrantedBy.HasValue && grantors.TryGetValue(h.GrantedBy.Value, out var name)
                        ? name : null
                })
            });
        }

        /// <summary>
        /// Otorga o retira créditos. Cantidad negativa retira, y es la forma de corregir
        /// un error: nunca se edita ni se borra un movimiento anterior.
        /// </summary>
        [HttpPost("{userId:long}/grant")]
        public async Task<IActionResult> Grant(long userId, [FromBody] GrantCreditsRequest body)
        {
            if (body == null || body.Credits == 0)
                return BadRequest(new { success = false, message = "Cantidad requerida" });

            var note = (body.Note ?? "").Trim();
            if (note.Length < MinNoteLength)
                return BadRequest(new { success = false, message = NoteRequiredMessage });

            if (!await _db.Users.AnyAsync(u => u.Id == userId))
                return NotFound(new { success = false, message = "Usuario no encontrado" });

            var adminId = GetAdminId();

            var ok = await _credits.GrantAsync(
                userId,
                body.Credits,
                type: body.Credits > 0 ? "grant_gift" : "adjust",
                bucket: NormalizeBucket(body.Bucket),
                note: note,
                grantedBy: adminId);

            if (!ok)
                return Conflict(new { success = false, message = "El movimiento ya estaba registrado" });

            _logger.LogInformation(
                "[TtsCreditsAdmin] {Admin} otorgó {Credits} créditos ({Bucket}) a {UserId}",
                adminId, body.Credits, NormalizeBucket(body.Bucket), userId);

            var balance = await _credits.GetBalanceAsync(userId);

            return Ok(new
            {
                success = true,
                message = body.Credits > 0
                    ? $"{body.Credits:N0} créditos otorgados"
                    : $"{Math.Abs(body.Credits):N0} créditos retirados",
                totalAvailable = balance.TotalAvailable,
                standardRemaining = balance.StandardRemaining
            });
        }

        /// <summary>
        /// Otorga la misma cantidad a varios canales de una vez. Es lo que acredita el
        /// regalo de transición: hacerlo de uno en uno con treinta y tantos canales
        /// garantiza que se olvide alguno.
        ///
        /// Cada canal es su propio movimiento en el libro mayor. Si uno falla, los demás
        /// siguen: media acreditación es mejor que ninguna, y el resultado dice
        /// exactamente quién quedó fuera para poder reintentarlo.
        /// </summary>
        [HttpPost("grant-batch")]
        public async Task<IActionResult> GrantBatch([FromBody] GrantBatchRequest body)
        {
            if (body == null || body.Credits == 0)
                return BadRequest(new { success = false, message = "Cantidad requerida" });

            var note = (body.Note ?? "").Trim();
            if (note.Length < MinNoteLength)
                return BadRequest(new { success = false, message = NoteRequiredMessage });

            var bucket = NormalizeBucket(body.Bucket);
            var adminId = GetAdminId();

            var targets = await ResolveTargetsAsync(body);
            if (targets.Count == 0)
                return BadRequest(new { success = false, message = "Ningún canal coincide con ese criterio" });

            var applied = new List<object>();
            var failed = new List<object>();

            foreach (var target in targets)
            {
                try
                {
                    var ok = await _credits.GrantAsync(
                        target.Id, body.Credits,
                        type: body.Credits > 0 ? "grant_gift" : "adjust",
                        bucket: bucket, note: note, grantedBy: adminId);

                    if (ok) applied.Add(new { id = target.Id, login = target.Login });
                    else failed.Add(new { id = target.Id, login = target.Login, reason = "ya registrado" });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[TtsCreditsAdmin] Error acreditando en lote a {UserId}", target.Id);
                    failed.Add(new { id = target.Id, login = target.Login, reason = "error" });
                }
            }

            _logger.LogInformation(
                "[TtsCreditsAdmin] {Admin} acreditó {Credits} ({Bucket}) a {Count} canales: {Note}",
                adminId, body.Credits, bucket, applied.Count, note);

            return Ok(new
            {
                success = true,
                message = $"{body.Credits:N0} créditos a {applied.Count} de {targets.Count} canales",
                appliedCount = applied.Count,
                applied,
                failed
            });
        }

        /// <summary>Vista previa: a quién alcanzaría el lote, sin acreditar nada.</summary>
        [HttpPost("grant-batch/preview")]
        public async Task<IActionResult> PreviewBatch([FromBody] GrantBatchRequest body)
        {
            var targets = await ResolveTargetsAsync(body ?? new GrantBatchRequest(0, null, null, null, null));
            return Ok(new
            {
                success = true,
                count = targets.Count,
                users = targets.Select(t => new { id = t.Id, login = t.Login })
            });
        }

        private record BatchTarget(long Id, string Login);

        /// <summary>
        /// A qué canales alcanza el lote. O una lista explícita de ids, o un criterio:
        /// hoy el único que hace falta es "los que tienen el bot activo", que es el
        /// universo real de gente a la que hay que regalarle la transición.
        /// </summary>
        private async Task<List<BatchTarget>> ResolveTargetsAsync(GrantBatchRequest body)
        {
            if (body.UserIds is { Count: > 0 })
            {
                return await _db.Users
                    .Where(u => body.UserIds.Contains(u.Id))
                    .Select(u => new BatchTarget(u.Id, u.Login))
                    .ToListAsync();
            }

            var query = _db.Users.AsQueryable();

            if (body.Scope == "bot_enabled")
            {
                var enabled = _db.SystemSettings.Where(s => s.BotEnabled).Select(s => s.UserId);
                query = query.Where(u => enabled.Contains(u.Id));
            }
            else if (body.Scope != "all")
            {
                return new List<BatchTarget>();
            }

            return await query
                .OrderBy(u => u.Login)
                .Select(u => new BatchTarget(u.Id, u.Login))
                .ToListAsync();
        }

        private static string NormalizeBucket(string? bucket) => bucket?.ToLower() switch
        {
            "standard" => "standard",
            "monthly" => "monthly",
            _ => "purchased",
        };

        private long GetAdminId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(claim, out var id) ? id : 0;
        }

        /// <summary>
        /// Un movimiento sin motivo no sirve de nada dentro de tres meses, cuando haya que
        /// explicar por qué un canal tiene el saldo que tiene.
        /// </summary>
        private const int MinNoteLength = 3;

        private const string NoteRequiredMessage =
            "El motivo es obligatorio: sin él, dentro de unos meses nadie sabrá por qué se movió este saldo";
    }

    /// <param name="Bucket">standard · monthly · purchased (por defecto)</param>
    public record GrantCreditsRequest(long Credits, string? Bucket, string? Note);

    /// <param name="Scope">bot_enabled · all. Se ignora si viene UserIds.</param>
    public record GrantBatchRequest(
        long Credits,
        string? Bucket,
        string? Note,
        string? Scope,
        List<long>? UserIds);
}
