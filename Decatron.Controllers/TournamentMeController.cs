using Decatron.Core.Models;
using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Decatron.Services.Tournament;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using Decatron.Services.GameData.Riot;
using Decatron.Core.Models.GameOverlays;

namespace Decatron.Controllers
{
    /// <summary>
    /// Panel del propio participante — inscripcion autenticada (su propia sesion de
    /// Twitch de la plataforma, no la del dueno del canal), eleccion de cual de sus
    /// cuentas de Riot ya vinculadas (Settings, ver RiotAccountController) usar en
    /// esta edicion puntual, y su link de overlay personal.
    ///
    /// Antes esto lo hacia todo el organizador a mano (alta manual + generar overlay
    /// el mismo) — pedido explicito del usuario (15-08-2026): "todos los
    /// participantes deben estar logeando al bot con su cuenta de twitch y luego
    /// vincular su cuenta de riot games... asi cada quien tiene sus propios links de
    /// los overlays". Correccion del mismo dia: el vinculo/verificacion de Riot NO
    /// es por-torneo (eso vivia acá antes) — es a nivel de cuenta de plataforma, en
    /// Settings, reutilizable en cualquier torneo, con soporte para varias cuentas
    /// (smurfs, otro server). Acá solo se elige cual usar para esta edicion.
    ///
    /// El alta manual de admin (ParticipantsPanel) se mantiene como fallback para
    /// participantes menos tecnicos.
    /// </summary>
    [ApiController]
    [Route("api/me/tournament")]
    [Authorize]
    public class TournamentMeController : ControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly TournamentRegistrationService _registrationService;
        private readonly RiotApiClient _riotClient;
        private readonly TournamentTeamService _teamService;

        private static readonly string[] ValidWidgets = { "lp-actual", "shell-inventory", "castigo-activo", "racha" };

        // Orden de tiers para comparar elo entre cuentas — usado solo para el aviso
        // de "tenes otra cuenta de mas elo" al organizador, no se persiste en ningun
        // lado mas que la nota en el participante.
        private static readonly string[] TierOrder = { "IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER" };
        private static readonly string[] RankOrder = { "IV", "III", "II", "I" };

        public TournamentMeController(
            DecatronDbContext dbContext, TournamentRegistrationService registrationService, RiotApiClient riotClient, TournamentTeamService teamService)
        {
            _dbContext = dbContext;
            _registrationService = registrationService;
            _riotClient = riotClient;
            _teamService = teamService;
        }

        private long GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(claim, out var id) ? id : throw new UnauthorizedAccessException();
        }

        /// <summary>
        /// "Quien soy" a los efectos de un participante de torneo: si mi cuenta de
        /// Users ya esta vinculada a un Account (multi-canal), esa es la identidad
        /// estable a usar — si no, mi propio Users.Id alcanza (caso comun, cuenta sin
        /// vincular a nada mas). Mismo criterio que usa RiotAccountController para
        /// las cuentas de Riot vinculadas.
        /// </summary>
        private async Task<long> GetEffectiveAccountIdAsync()
        {
            var userId = GetUserId();
            var accountId = await _dbContext.Users.Where(u => u.Id == userId).Select(u => u.AccountId).FirstOrDefaultAsync();
            return accountId ?? userId;
        }

        private async Task<TournamentEdition?> ResolveEditionAsync(string channelName, string editionSlug)
        {
            var owner = await _dbContext.Users.FirstOrDefaultAsync(u => u.Login.ToLower() == channelName.ToLower());
            if (owner == null) return null;

            return await _dbContext.TournamentEditions.FirstOrDefaultAsync(e =>
                e.ChannelOwnerId == owner.Id && e.Slug == editionSlug && e.Status != "draft");
        }

        // Cuentas de LoL vinculadas en Settings (linked_game_accounts, antes
        // user_riot_accounts — ids conservados en la migracion del 18-09-2026).
        private IQueryable<LinkedGameAccount> LolAccounts =>
            _dbContext.LinkedGameAccounts.Where(a => a.Game == GameIds.Lol && a.Provider == GameProviders.Riot);

        private async Task<TournamentParticipant?> GetMyParticipantAsync(long editionId)
        {
            var effectiveAccountId = await GetEffectiveAccountIdAsync();
            return await _dbContext.TournamentParticipants.FirstOrDefaultAsync(p =>
                p.TournamentEditionId == editionId && p.AccountId == effectiveAccountId);
        }

        [HttpGet("{channelName}/{editionSlug}")]
        public async Task<IActionResult> GetMyStatus(string channelName, string editionSlug)
        {
            var edition = await ResolveEditionAsync(channelName, editionSlug);
            if (edition == null) return NotFound(new { success = false, message = "Torneo no encontrado" });

            var participant = await GetMyParticipantAsync(edition.Id);
            if (participant == null)
            {
                var effectiveAccountId = await GetEffectiveAccountIdAsync();
                var eligibleAccountsPreRegister = await LolAccounts
                    .Where(a => a.AccountId == effectiveAccountId && a.Region == edition.Region && a.VerifiedAt != null)
                    .Select(a => new { a.Id, riotId = a.ExternalName, riotTagLine = a.ExternalTag })
                    .ToListAsync();

                return Ok(new
                {
                    success = true,
                    registered = false,
                    registrationOpen = edition.Status == "registration_open",
                    region = edition.Region,
                    mode = edition.Mode,
                    eligibleRiotAccounts = eligibleAccountsPreRegister,
                });
            }

            var overlay = await _dbContext.TournamentOverlayConfigs.FirstOrDefaultAsync(c => c.TournamentParticipantId == participant.Id);

            object? group = null;
            if (participant.TeamId != null)
            {
                var team = await _dbContext.TournamentTeams.FirstOrDefaultAsync(t => t.Id == participant.TeamId);
                if (team != null)
                {
                    var roster = await _dbContext.TournamentParticipants
                        .Where(p => p.TeamId == team.Id)
                        .Select(p => p.DisplayName)
                        .ToListAsync();
                    group = new { team.Id, team.Name, team.JoinCode, roster, full = roster.Count >= (edition.TeamSize ?? 1) };
                }
            }

            var accountId = await GetEffectiveAccountIdAsync();
            var eligibleAccounts = await LolAccounts
                .Where(a => a.AccountId == accountId && a.Region == edition.Region && a.VerifiedAt != null)
                .Select(a => new { a.Id, riotId = a.ExternalName, riotTagLine = a.ExternalTag })
                .ToListAsync();

            return Ok(new
            {
                success = true,
                registered = true,
                region = edition.Region,
                mode = edition.Mode,
                teamSize = edition.TeamSize,
                participant = new
                {
                    participant.Id,
                    participant.DisplayName,
                    participant.Status,
                    participant.RiotId,
                    participant.RiotTagLine,
                    participant.LinkedRiotAccountId,
                    participant.SmurfFlagNote,
                },
                eligibleRiotAccounts = eligibleAccounts,
                group,
                overlay = overlay == null ? null : new
                {
                    url = $"/overlay/torneo/{overlay.Token}",
                    enabledWidgets = JsonSerializer.Deserialize<List<string>>(overlay.EnabledWidgets) ?? new List<string>(),
                    theme = overlay.Theme,
                },
            });
        }

        public class MyRegisterRequest
        {
            public string DisplayName { get; set; } = "";
            public string? PrimaryRole { get; set; }
            public string? Nationality { get; set; }
            public string? TwitchChannel { get; set; }
            public string? KickChannel { get; set; }
            public string? TwitterHandle { get; set; }
            public long? UserRiotAccountId { get; set; }
        }

        /// <summary>
        /// Reemplaza al viejo /api/public/tournament/.../register anonimo — ahora
        /// requiere sesion propia, la inscripcion queda atada a mi AccountId desde el
        /// arranque.
        ///
        /// Para ARAM (aram_teams), la cuenta de Riot es obligatoria DESDE la
        /// inscripcion (pedido explicito 24-08-2026, tras un bug real: alguien se
        /// anoto sin elegir cuenta y no quedo ninguna validacion de region ni
        /// anti-duplicado corriendo) — se elige entre las cuentas ya vinculadas y
        /// verificadas en Settings, se valida que sean de la region de esta edicion
        /// y que el PUUID no este ya inscripto con otro participante, todo antes de
        /// crear la inscripcion. Otros modos (solo_q_climb, hoy deshabilitados)
        /// mantienen el flujo viejo: se registran sin Riot y lo eligen despues via
        /// POST .../riot-account.
        /// </summary>
        [HttpPost("{channelName}/{editionSlug}/register")]
        [EnableRateLimiting("tournament-register")]
        public async Task<IActionResult> Register(string channelName, string editionSlug, [FromBody] MyRegisterRequest request)
        {
            var edition = await ResolveEditionAsync(channelName, editionSlug);
            if (edition == null) return NotFound(new { success = false, message = "Torneo no encontrado" });

            var effectiveAccountId = await GetEffectiveAccountIdAsync();

            string? riotId = null, riotTagLine = null, riotPuuid = null;
            long? linkedRiotAccountId = null;

            if (edition.Mode == "aram_teams")
            {
                if (request.UserRiotAccountId == null)
                    return BadRequest(new { success = false, message = "Elegí una cuenta de Riot verificada para inscribirte" });

                var chosen = await LolAccounts.FirstOrDefaultAsync(a => a.Id == request.UserRiotAccountId && a.AccountId == effectiveAccountId);
                if (chosen == null)
                    return NotFound(new { success = false, message = "Cuenta de Riot no encontrada" });

                if (chosen.VerifiedAt == null)
                    return BadRequest(new { success = false, message = "Esa cuenta todavía no está verificada — verificala en Settings primero" });

                if (chosen.Region != edition.Region)
                    return BadRequest(new { success = false, message = $"Esta edición es de región {edition.Region}, esa cuenta es de {chosen.Region}" });

                var alreadyByPuuid = await _dbContext.TournamentParticipants.AnyAsync(p =>
                    p.TournamentEditionId == edition.Id && p.RiotPuuid == chosen.ExternalId);
                if (alreadyByPuuid)
                    return BadRequest(new { success = false, message = "Esa cuenta de Riot ya está inscripta en este torneo con otro participante" });

                riotId = chosen.ExternalName;
                riotTagLine = chosen.ExternalTag;
                riotPuuid = chosen.ExternalId;
                linkedRiotAccountId = chosen.Id;
            }

            var result = await _registrationService.RegisterAsync(_dbContext, edition, new RegisterParticipantRequest
            {
                DisplayName = request.DisplayName,
                PrimaryRole = request.PrimaryRole,
                Nationality = request.Nationality,
                TwitchChannel = request.TwitchChannel,
                KickChannel = request.KickChannel,
                TwitterHandle = request.TwitterHandle,
                AccountId = effectiveAccountId,
                RiotId = riotId,
                RiotTagLine = riotTagLine,
                RiotPuuid = riotPuuid,
                LinkedRiotAccountId = linkedRiotAccountId,
            }, source: "web");

            if (!result.Success)
                return BadRequest(new { success = false, message = result.Error });

            return Ok(new { success = true, message = "Inscripción recibida — queda pendiente de aprobación del organizador.", participantId = result.Participant!.Id });
        }

        public class PickRiotAccountRequest
        {
            public long UserRiotAccountId { get; set; }
        }

        /// <summary>
        /// Elige, entre mis cuentas de Riot ya vinculadas y verificadas en Settings
        /// para la region de esta edicion, cual usar acá. Copia Riot ID/tag/PUUID al
        /// participante (el resto del modulo — sync de Riot, standings, ranking
        /// publico — sigue leyendo esos campos directo, sin joins nuevos). Si tengo
        /// otra cuenta verificada de la misma region con mas elo que la elegida, se
        /// lo marca al organizador (decision de producto 15-08-2026: "elige el
        /// participante, con aviso" — no bloquea).
        /// </summary>
        [HttpPost("{channelName}/{editionSlug}/riot-account")]
        [EnableRateLimiting("tournament-register")]
        public async Task<IActionResult> PickRiotAccount(string channelName, string editionSlug, [FromBody] PickRiotAccountRequest request)
        {
            var edition = await ResolveEditionAsync(channelName, editionSlug);
            if (edition == null) return NotFound(new { success = false, message = "Torneo no encontrado" });

            var participant = await GetMyParticipantAsync(edition.Id);
            if (participant == null)
                return NotFound(new { success = false, message = "Todavía no estás inscripto en este torneo" });

            var accountId = await GetEffectiveAccountIdAsync();
            var chosen = await LolAccounts.FirstOrDefaultAsync(a => a.Id == request.UserRiotAccountId && a.AccountId == accountId);
            if (chosen == null)
                return NotFound(new { success = false, message = "Cuenta de Riot no encontrada" });

            if (chosen.VerifiedAt == null)
                return BadRequest(new { success = false, message = "Esa cuenta todavía no está verificada — verificala en Settings primero" });

            if (chosen.Region != edition.Region)
                return BadRequest(new { success = false, message = $"Esta edición es de región {edition.Region}, esa cuenta es de {chosen.Region}" });

            var alreadyByPuuid = await _dbContext.TournamentParticipants.AnyAsync(p =>
                p.TournamentEditionId == edition.Id && p.RiotPuuid == chosen.ExternalId && p.Id != participant.Id);
            if (alreadyByPuuid)
                return BadRequest(new { success = false, message = "Esa cuenta de Riot ya está inscripta en este torneo con otro participante" });

            var riotConfig = await _dbContext.TournamentRiotConfigs.FirstOrDefaultAsync(c => c.ChannelOwnerId == edition.ChannelOwnerId && c.IsActive);

            participant.RiotId = chosen.ExternalName;
            participant.RiotTagLine = chosen.ExternalTag;
            participant.RiotPuuid = chosen.ExternalId;
            participant.LinkedRiotAccountId = chosen.Id;
            participant.SmurfFlagNote = riotConfig != null
                ? await BuildSmurfFlagNoteAsync(accountId, chosen, edition.Region, riotConfig.ApiKey)
                : null;

            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true, smurfFlagNote = participant.SmurfFlagNote });
        }

        /// <summary>
        /// Compara el LP actual de la cuenta elegida contra mis otras cuentas
        /// verificadas de la misma region — si alguna tiene mas elo, arma la nota
        /// para el organizador. Best-effort: si Riot no responde para alguna cuenta,
        /// simplemente no entra en la comparacion (no bloquea la inscripcion).
        /// </summary>
        private async Task<string?> BuildSmurfFlagNoteAsync(long accountId, LinkedGameAccount chosen, string region, string apiKey)
        {
            var others = await LolAccounts
                .Where(a => a.AccountId == accountId && a.Region == region && a.VerifiedAt != null && a.Id != chosen.Id)
                .ToListAsync();
            if (others.Count == 0) return null;

            var (chosenOk, chosenLp, chosenTier, chosenRank, _) = await _riotClient.GetCurrentSoloQLpAsync(region, chosen.ExternalId, apiKey);
            var chosenScore = chosenOk ? ScoreOf(chosenTier, chosenRank, chosenLp) : (int?)null;
            if (chosenScore == null) return null;

            foreach (var other in others)
            {
                var (ok, lp, tier, rank, _) = await _riotClient.GetCurrentSoloQLpAsync(region, other.ExternalId, apiKey);
                if (!ok) continue;
                var score = ScoreOf(tier, rank, lp);
                if (score == null) continue;

                if (score > chosenScore)
                    return $"Tiene otra cuenta vinculada ({other.ExternalName}#{other.ExternalTag}) con más elo ({tier} {rank}, {lp} LP) que la elegida para este torneo ({chosenTier} {chosenRank}, {chosenLp} LP).";
            }

            return null;
        }

        private static int? ScoreOf(string? tier, string? rank, int? lp)
        {
            if (tier == null || lp == null) return null;
            var tierIdx = Array.IndexOf(TierOrder, tier.ToUpperInvariant());
            if (tierIdx < 0) return null;
            var rankIdx = rank != null ? Array.IndexOf(RankOrder, rank.ToUpperInvariant()) : 0;
            if (rankIdx < 0) rankIdx = 0;
            return tierIdx * 10000 + rankIdx * 200 + lp.Value;
        }

        /// <summary>
        /// Armar un grupo parcial (dúo/trío/squad) con un codigo para compartir —
        /// ARAM N vs N con TeamSize >= 2, ver TournamentTeamService.CreateGroupAsync.
        /// Al generar el bracket, AutoAssignRandomTeamsAsync completa lo que falte con
        /// participantes que vinieron solos.
        /// </summary>
        [HttpPost("{channelName}/{editionSlug}/group")]
        [EnableRateLimiting("tournament-register")]
        public async Task<IActionResult> CreateGroup(string channelName, string editionSlug)
        {
            var edition = await ResolveEditionAsync(channelName, editionSlug);
            if (edition == null) return NotFound(new { success = false, message = "Torneo no encontrado" });

            var participant = await GetMyParticipantAsync(edition.Id);
            if (participant == null)
                return NotFound(new { success = false, message = "Todavía no estás inscripto en este torneo" });

            var result = await _teamService.CreateGroupAsync(_dbContext, edition, participant.Id);
            if (!result.Success)
                return BadRequest(new { success = false, message = result.Error });

            return Ok(new { success = true, joinCode = result.Team!.JoinCode });
        }

        public class JoinGroupRequest
        {
            public string JoinCode { get; set; } = "";
        }

        [HttpPost("{channelName}/{editionSlug}/group/join")]
        [EnableRateLimiting("tournament-register")]
        public async Task<IActionResult> JoinGroup(string channelName, string editionSlug, [FromBody] JoinGroupRequest request)
        {
            var edition = await ResolveEditionAsync(channelName, editionSlug);
            if (edition == null) return NotFound(new { success = false, message = "Torneo no encontrado" });

            var participant = await GetMyParticipantAsync(edition.Id);
            if (participant == null)
                return NotFound(new { success = false, message = "Todavía no estás inscripto en este torneo" });

            if (string.IsNullOrWhiteSpace(request.JoinCode))
                return BadRequest(new { success = false, message = "Falta el código de grupo" });

            var result = await _teamService.JoinGroupAsync(_dbContext, edition, participant.Id, request.JoinCode);
            if (!result.Success)
                return BadRequest(new { success = false, message = result.Error });

            return Ok(new { success = true });
        }

        public class UpdateOverlayRequest
        {
            public List<string> EnabledWidgets { get; set; } = new();
            public string Theme { get; set; } = "dark";
        }

        /// <summary>
        /// Mismo generador que el admin (TournamentOverlayAdminController) pero
        /// gateado por "es mi propio participante", no por ser dueno del canal — asi
        /// cada participante saca su propio link sin depender del organizador.
        /// </summary>
        [HttpPost("{channelName}/{editionSlug}/overlay")]
        public async Task<IActionResult> CreateOrRegenerateOverlay(string channelName, string editionSlug, [FromBody] UpdateOverlayRequest request)
        {
            var edition = await ResolveEditionAsync(channelName, editionSlug);
            if (edition == null) return NotFound(new { success = false, message = "Torneo no encontrado" });

            var participant = await GetMyParticipantAsync(edition.Id);
            if (participant == null)
                return NotFound(new { success = false, message = "Todavía no estás inscripto en este torneo" });

            var invalidWidgets = request.EnabledWidgets.Except(ValidWidgets).ToList();
            if (invalidWidgets.Count > 0)
                return BadRequest(new { success = false, message = $"Widget(s) invalido(s): {string.Join(", ", invalidWidgets)}" });

            var config = await _dbContext.TournamentOverlayConfigs.FirstOrDefaultAsync(c => c.TournamentParticipantId == participant.Id);
            var newToken = GenerateToken();

            if (config == null)
            {
                config = new TournamentOverlayConfig { TournamentParticipantId = participant.Id, Token = newToken };
                _dbContext.TournamentOverlayConfigs.Add(config);
            }
            else
            {
                config.Token = newToken;
            }

            config.EnabledWidgets = JsonSerializer.Serialize(request.EnabledWidgets.Count > 0 ? request.EnabledWidgets : ValidWidgets.Take(3).ToList());
            config.Theme = request.Theme;
            config.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true, url = $"/overlay/torneo/{config.Token}" });
        }

        private static string GenerateToken()
        {
            var bytes = RandomNumberGenerator.GetBytes(24);
            return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").Replace("=", "");
        }
    }
}
