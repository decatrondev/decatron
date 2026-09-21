using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services.Tournament;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Security.Claims;
using Decatron.Services.GameData.Riot;
using Decatron.Core.Models.GameOverlays;

namespace Decatron.Controllers
{
    /// <summary>
    /// Cuentas de Riot vinculadas a nivel plataforma (Settings), no por torneo —
    /// pedido explicito del usuario (15-08-2026): "el panel de inscripcion... luego
    /// en el panel de cada quien debe vincular su cuenta de riot en settings", y
    /// soporta varias cuentas por persona (smurfs, otro server) con verificacion
    /// individual. Ver LinkedGameAccount y TournamentMeController (que consume estas
    /// cuentas al elegir cual usar para una edicion puntual).
    ///
    /// Verificacion: metodo del icono de invocador (RSO real todavia no disponible,
    /// ver .dev/torneos/03-riot-api-integracion.md #2 y memoria del proyecto sobre
    /// la key de produccion pendiente de aprobacion de Riot).
    /// </summary>
    [ApiController]
    [Route("api/me/riot-accounts")]
    [Authorize]
    public class RiotAccountController : ControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly RiotApiClient _riotClient;
        private readonly RiotApiKeys _riotKeys;

        private static readonly int[] ChallengeIconPool = { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 23, 24, 25, 26, 27, 28 };
        private static readonly Random _random = new();

        public RiotAccountController(DecatronDbContext dbContext, RiotApiClient riotClient, RiotApiKeys riotKeys)
        {
            _dbContext = dbContext;
            _riotClient = riotClient;
            _riotKeys = riotKeys;
        }

        private long GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(claim, out var id) ? id : throw new UnauthorizedAccessException();
        }

        private async Task<long> GetEffectiveAccountIdAsync()
        {
            var userId = GetUserId();
            var accountId = await _dbContext.Users.Where(u => u.Id == userId).Select(u => u.AccountId).FirstOrDefaultAsync();
            return accountId ?? userId;
        }

        /// <summary>
        /// Key de PLATAFORMA (appsettings.Secrets.json "RiotApi:PlatformApiKey") —
        /// vincular una cuenta de Riot en Settings pasa antes de elegir cualquier
        /// canal/torneo, asi que no puede depender de la key de un canal puntual.
        /// Hasta el 24-08-2026 esto se resolvia pidiendo prestada la key del canal
        /// del dueno de la plataforma (RiotApi:PlatformKeyChannelOwnerId), lo cual
        /// mezclaba dos cosas conceptualmente distintas y generaba confusion real
        /// ("¿por que tengo que tocar Torneos para vincular MI cuenta?"). Separado
        /// en su propia key — cada canal sigue trayendo la suya en Torneos -> Riot
        /// API para trackear SUS PROPIOS torneos, sin relacion con esto. Desde el
        /// 18-09-2026 la resuelve RiotApiKeys (una key por juego; este controller
        /// solo maneja LoL — el resto de juegos entra por GameAccountsController en
        /// la Fase 1 de GAME_OVERLAYS_PLAN.md).
        /// </summary>
        private Task<string?> GetPlatformApiKeyAsync() => Task.FromResult(_riotKeys.ForGame(GameIds.Lol));

        private IQueryable<LinkedGameAccount> LolAccounts =>
            _dbContext.LinkedGameAccounts.Where(a => a.Game == GameIds.Lol && a.Provider == GameProviders.Riot);

        [HttpGet]
        public async Task<IActionResult> List()
        {
            var accountId = await GetEffectiveAccountIdAsync();
            var accounts = await LolAccounts
                .Where(a => a.AccountId == accountId)
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => new
                {
                    a.Id,
                    riotId = a.ExternalName,
                    riotTagLine = a.ExternalTag,
                    a.Region,
                    verified = a.VerifiedAt != null,
                    verificationPending = a.VerificationChallengeIconId != null,
                    a.VerificationChallengeIconId,
                })
                .ToListAsync();

            return Ok(new { success = true, accounts });
        }

        public class AddRiotAccountRequest
        {
            public string RiotId { get; set; } = "";
            public string RiotTagLine { get; set; } = "";
            public string Region { get; set; } = "";
        }

        [HttpPost]
        public async Task<IActionResult> Add([FromBody] AddRiotAccountRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.RiotId) || string.IsNullOrWhiteSpace(request.RiotTagLine) || string.IsNullOrWhiteSpace(request.Region))
                return BadRequest(new { success = false, message = "Riot ID, tag y region son requeridos" });

            var apiKey = await GetPlatformApiKeyAsync();
            if (apiKey == null)
                return BadRequest(new { success = false, message = "La plataforma todavía no tiene una Riot API key configurada — intenta más tarde" });

            var (ok, puuid, error) = await _riotClient.ResolvePuuidAsync(request.Region, request.RiotId.Trim(), request.RiotTagLine.Trim(), apiKey);
            if (!ok || string.IsNullOrEmpty(puuid))
            {
                // Distinguir "la cuenta no existe" (404 real de Riot) de cualquier otra
                // falla (401 key invalida/vencida, 429 rate limit, etc.) — antes se
                // mostraba siempre "no se encontró la cuenta" aunque el problema fuera
                // la Riot API key, lo cual confundía mas de lo que ayudaba.
                var message = error != null && error.StartsWith("HTTP 404")
                    ? $"No se encontró la cuenta '{request.RiotId}#{request.RiotTagLine}' en la región {request.Region}"
                    : $"No se pudo verificar la cuenta contra Riot ahora mismo ({error}) — intenta de nuevo en un rato";
                return BadRequest(new { success = false, message });
            }

            var accountId = await GetEffectiveAccountIdAsync();

            var alreadyMine = await LolAccounts.AnyAsync(a => a.AccountId == accountId && a.ExternalId == puuid);
            if (alreadyMine)
                return BadRequest(new { success = false, message = "Esa cuenta ya está vinculada" });

            var alreadyVerifiedByOther = await LolAccounts.AnyAsync(a => a.ExternalId == puuid && a.VerifiedAt != null && a.AccountId != accountId);
            if (alreadyVerifiedByOther)
                return BadRequest(new { success = false, message = "Esa cuenta de Riot ya está verificada por otro usuario" });

            var account = new LinkedGameAccount
            {
                AccountId = accountId,
                Game = GameIds.Lol,
                Provider = GameProviders.Riot,
                ExternalName = request.RiotId.Trim(),
                ExternalTag = request.RiotTagLine.Trim(),
                Region = request.Region,
                ExternalId = puuid,
                VerificationChallengeIconId = ChallengeIconPool[_random.Next(ChallengeIconPool.Length)],
                VerificationStartedAt = DateTime.UtcNow,
            };
            _dbContext.LinkedGameAccounts.Add(account);
            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true, id = account.Id, challengeIconId = account.VerificationChallengeIconId });
        }

        [HttpPost("{id}/verify")]
        public async Task<IActionResult> Verify(long id)
        {
            var accountId = await GetEffectiveAccountIdAsync();
            var account = await LolAccounts.FirstOrDefaultAsync(a => a.Id == id && a.AccountId == accountId);
            if (account == null) return NotFound(new { success = false, message = "Cuenta no encontrada" });

            if (account.VerifiedAt != null)
                return Ok(new { success = true, message = "Ya estaba verificada" });

            if (account.VerificationChallengeIconId == null)
                return BadRequest(new { success = false, message = "Esta cuenta no tiene una verificación en curso" });

            var apiKey = await GetPlatformApiKeyAsync();
            if (apiKey == null)
                return BadRequest(new { success = false, message = "La plataforma todavía no tiene una Riot API key configurada — intenta más tarde" });

            var (ok, currentIconId, error) = await _riotClient.GetProfileIconIdAsync(account.Region ?? "", account.ExternalId, apiKey);
            if (!ok)
                return BadRequest(new { success = false, message = "No se pudo consultar la cuenta en Riot ahora mismo — intenta de nuevo en un rato" });

            if (currentIconId != account.VerificationChallengeIconId)
                return BadRequest(new { success = false, message = $"Todavía no vemos ese icono en la cuenta (vemos el {currentIconId}, se pidió el {account.VerificationChallengeIconId}) — verifica que sea el icono correcto y que se haya guardado en el cliente de League." });

            var alreadyVerifiedByOther = await LolAccounts.AnyAsync(a => a.ExternalId == account.ExternalId && a.VerifiedAt != null && a.Id != account.Id);
            if (alreadyVerifiedByOther)
                return BadRequest(new { success = false, message = "Esa cuenta de Riot ya está verificada por otro usuario" });

            account.VerifiedAt = DateTime.UtcNow;
            account.VerificationChallengeIconId = null;
            account.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true, message = "Cuenta de Riot verificada" });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(long id)
        {
            var accountId = await GetEffectiveAccountIdAsync();
            var account = await LolAccounts.FirstOrDefaultAsync(a => a.Id == id && a.AccountId == accountId);
            if (account == null) return NotFound(new { success = false, message = "Cuenta no encontrada" });

            _dbContext.LinkedGameAccounts.Remove(account);
            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true });
        }
    }
}
