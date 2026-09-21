using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Decatron.Services;
using Decatron.Services.Tournament;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    /// <summary>
    /// Milestone 1 del modulo de Torneos — motor de castigos/suerte (nombre propio por tenant): catalogos,
    /// reglas por rango de posicion, inventarios, log de eventos. Ver
    /// .dev/torneos/04-motor-blue-shell-aegis.md.
    /// </summary>
    [ApiController]
    [Route("api/admin/tournament")]
    [Authorize]
    public class TournamentBlueShellAdminController : TournamentControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly ILogger<TournamentBlueShellAdminController> _logger;
        private readonly TournamentBlueShellService _blueShellService;

        public TournamentBlueShellAdminController(
            DecatronDbContext dbContext,
            ILogger<TournamentBlueShellAdminController> logger,
            TournamentBlueShellService blueShellService,
            IPermissionService permissionService) : base(dbContext, permissionService)
        {
            _dbContext = dbContext;
            _logger = logger;
            _blueShellService = blueShellService;
        }

        // ─── Seed de catalogos por defecto (del audit de soloqchallenge.gg) ───────────

        [HttpPost("editions/{editionId}/blueshell/seed-defaults")]
        public async Task<IActionResult> SeedDefaults(long editionId)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede configurar el sistema de castigos" });

            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var hasPunishments = await _dbContext.TournamentPunishmentTypes.AnyAsync(p => p.TournamentEditionId == editionId);
            if (!hasPunishments)
            {
                var punishmentNames = new[]
                {
                    "Sin botas y sin Pies Veloces", "Sensibilidad x2", "Autofill", "Campeon aleatorio",
                    "Sin Flash", "Sin tus 3 campeones mas jugados", "Hechizos cambiados",
                    "Runas predeterminadas", "Sin objetos completos hasta el min 15",
                };
                foreach (var name in punishmentNames)
                    _dbContext.TournamentPunishmentTypes.Add(new TournamentPunishmentType { TournamentEditionId = editionId, Name = name, AllowsReverse = true });
            }

            var hasTriggers = await _dbContext.TournamentShellTriggers.AnyAsync(t => t.TournamentEditionId == editionId);
            if (!hasTriggers)
            {
                var triggers = new[]
                {
                    new TournamentShellTrigger { TournamentEditionId = editionId, Name = "Pentakill", ConditionType = "penta_kills", ThresholdValue = 1, ShellsGranted = 2 },
                    new TournamentShellTrigger { TournamentEditionId = editionId, Name = "22 kills en una partida", ConditionType = "stat_threshold", StatField = "kills", ThresholdValue = 22, ShellsGranted = 1 },
                    new TournamentShellTrigger { TournamentEditionId = editionId, Name = "30 asistencias en una partida", ConditionType = "stat_threshold", StatField = "assists", ThresholdValue = 30, ShellsGranted = 1 },
                    new TournamentShellTrigger { TournamentEditionId = editionId, Name = "Racha de 6 victorias", ConditionType = "streak_wins", ThresholdValue = 6, ShellsGranted = 1 },
                    new TournamentShellTrigger { TournamentEditionId = editionId, Name = "KDA perfecto superior a 20", ConditionType = "perfect_kda", ThresholdValue = 20, ShellsGranted = 1 },
                    new TournamentShellTrigger { TournamentEditionId = editionId, Name = "Ganar una partida de 40+ minutos", ConditionType = "match_duration_min", ThresholdValue = 40, ShellsGranted = 1 },
                    new TournamentShellTrigger { TournamentEditionId = editionId, Name = "Cada 5 victorias con campeon distinto", ConditionType = "champion_variety", ThresholdValue = 5, ShellsGranted = 1 },
                    new TournamentShellTrigger { TournamentEditionId = editionId, Name = "Cada 5 victorias con castigo activo", ConditionType = "win_with_active_punishment", ThresholdValue = 5, ShellsGranted = 1 },
                };
                _dbContext.TournamentShellTriggers.AddRange(triggers);
            }

            var rules = await _dbContext.TournamentBlueShellRules.FirstOrDefaultAsync(r => r.TournamentEditionId == editionId);
            if (rules == null)
            {
                _dbContext.TournamentBlueShellRules.Add(new TournamentBlueShellRules
                {
                    TournamentEditionId = editionId,
                    CooldownByRank = "[{\"minRank\":1,\"maxRank\":1,\"cooldownHours\":0},{\"minRank\":2,\"maxRank\":2,\"cooldownHours\":4},{\"minRank\":3,\"maxRank\":5,\"cooldownHours\":6},{\"minRank\":6,\"maxRank\":9999,\"cooldownHours\":12}]",
                    ReverseChanceByRank = "[{\"minRank\":1,\"maxRank\":1,\"reverseChancePercent\":1},{\"minRank\":2,\"maxRank\":2,\"reverseChancePercent\":2},{\"minRank\":3,\"maxRank\":3,\"reverseChancePercent\":3},{\"minRank\":4,\"maxRank\":4,\"reverseChancePercent\":4},{\"minRank\":5,\"maxRank\":5,\"reverseChancePercent\":5},{\"minRank\":6,\"maxRank\":9999,\"reverseChancePercent\":15}]",
                    MaxInventory = 3,
                    ThrowBlockWindowMinutes = 15,
                    DisableLastNHours = 48,
                });
            }

            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true });
        }

        // ─── Catalogos ──────────────────────────────────────────────────────────────

        [HttpGet("editions/{editionId}/blueshell/catalogs")]
        public async Task<IActionResult> GetCatalogs(long editionId)
        {
            var channelOwnerId = GetChannelOwnerId();
            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var punishments = await _dbContext.TournamentPunishmentTypes.Where(p => p.TournamentEditionId == editionId).OrderBy(p => p.Name).ToListAsync();
            var triggers = await _dbContext.TournamentShellTriggers.Where(t => t.TournamentEditionId == editionId).OrderBy(t => t.Name).ToListAsync();

            return Ok(new { success = true, punishments, triggers });
        }

        // ─── Reglas ─────────────────────────────────────────────────────────────────

        [HttpGet("editions/{editionId}/blueshell/rules")]
        public async Task<IActionResult> GetRules(long editionId)
        {
            var channelOwnerId = GetChannelOwnerId();
            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var rules = await _dbContext.TournamentBlueShellRules.FirstOrDefaultAsync(r => r.TournamentEditionId == editionId);
            return Ok(new { success = true, rules });
        }

        public class UpdateRulesRequest
        {
            public short MaxInventory { get; set; } = 3;
            public short ThrowBlockWindowMinutes { get; set; } = 15;
            public short DisableLastNHours { get; set; } = 48;
            public bool DailyDropEnabled { get; set; }
            public string? DailyDropChallengeTemplate { get; set; }
        }

        [HttpPut("editions/{editionId}/blueshell/rules")]
        public async Task<IActionResult> UpdateRules(long editionId, [FromBody] UpdateRulesRequest request)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede editar las reglas" });

            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var rules = await _dbContext.TournamentBlueShellRules.FirstOrDefaultAsync(r => r.TournamentEditionId == editionId);
            if (rules == null)
                return BadRequest(new { success = false, message = "Corre primero 'sembrar valores por defecto' para esta edicion" });

            rules.MaxInventory = request.MaxInventory;
            rules.ThrowBlockWindowMinutes = request.ThrowBlockWindowMinutes;
            rules.DisableLastNHours = request.DisableLastNHours;
            rules.DailyDropEnabled = request.DailyDropEnabled;
            rules.DailyDropChallengeTemplate = request.DailyDropChallengeTemplate;
            rules.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true, rules });
        }

        // ─── Inventarios ────────────────────────────────────────────────────────────

        public class InventoryRowDto
        {
            public long ParticipantId { get; set; }
            public string DisplayName { get; set; } = "";
            public short Count { get; set; }
            public int TotalObtained { get; set; }
            public int TotalThrown { get; set; }
            public int TotalReceived { get; set; }
        }

        [HttpGet("editions/{editionId}/blueshell/inventory")]
        public async Task<IActionResult> GetInventory(long editionId)
        {
            var channelOwnerId = GetChannelOwnerId();
            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var rows = await (
                from p in _dbContext.TournamentParticipants
                where p.TournamentEditionId == editionId
                join inv in _dbContext.TournamentShellInventories on p.Id equals inv.TournamentParticipantId into invJoin
                from inv in invJoin.DefaultIfEmpty()
                orderby p.DisplayName
                select new InventoryRowDto
                {
                    ParticipantId = p.Id,
                    DisplayName = p.DisplayName,
                    Count = inv != null ? inv.Count : (short)0,
                    TotalObtained = inv != null ? inv.TotalObtained : 0,
                    TotalThrown = inv != null ? inv.TotalThrown : 0,
                    TotalReceived = inv != null ? inv.TotalReceived : 0,
                }).ToListAsync();

            return Ok(new { success = true, inventory = rows });
        }

        // ─── Log de eventos ─────────────────────────────────────────────────────────

        public class ShellEventDto
        {
            public long Id { get; set; }
            public string Type { get; set; } = "";
            public string SourceName { get; set; } = "";
            public string? TargetName { get; set; }
            public string? TriggerName { get; set; }
            public string? PunishmentName { get; set; }
            public bool WasReverse { get; set; }
            public bool WasLostFull { get; set; }
            public DateTime? FulfilledAt { get; set; }
            public DateTime CreatedAt { get; set; }
        }

        [HttpGet("editions/{editionId}/blueshell/events")]
        public async Task<IActionResult> GetEvents(long editionId, [FromQuery] int limit = 50)
        {
            var channelOwnerId = GetChannelOwnerId();
            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var participants = await _dbContext.TournamentParticipants
                .Where(p => p.TournamentEditionId == editionId)
                .ToDictionaryAsync(p => p.Id, p => p.DisplayName);
            var triggers = await _dbContext.TournamentShellTriggers
                .Where(t => t.TournamentEditionId == editionId)
                .ToDictionaryAsync(t => t.Id, t => t.Name);
            var punishments = await _dbContext.TournamentPunishmentTypes
                .Where(p => p.TournamentEditionId == editionId)
                .ToDictionaryAsync(p => p.Id, p => p.Name);

            var events = await _dbContext.TournamentShellEvents
                .Where(e => e.TournamentEditionId == editionId)
                .OrderByDescending(e => e.CreatedAt)
                .Take(Math.Clamp(limit, 1, 200))
                .ToListAsync();

            var dtos = events.Select(e => new ShellEventDto
            {
                Id = e.Id,
                Type = e.Type,
                SourceName = participants.GetValueOrDefault(e.SourceParticipantId, "?"),
                TargetName = e.TargetParticipantId.HasValue ? participants.GetValueOrDefault(e.TargetParticipantId.Value, "?") : null,
                TriggerName = e.TriggerId.HasValue ? triggers.GetValueOrDefault(e.TriggerId.Value, "?") : null,
                PunishmentName = e.PunishmentTypeId.HasValue ? punishments.GetValueOrDefault(e.PunishmentTypeId.Value, "?") : null,
                WasReverse = e.WasReverse,
                WasLostFull = e.WasLostFull,
                FulfilledAt = e.FulfilledAt,
                CreatedAt = e.CreatedAt,
            }).ToList();

            return Ok(new { success = true, events = dtos });
        }

        [HttpPost("blueshell/events/{eventId}/fulfill")]
        public async Task<IActionResult> FulfillEvent(long eventId)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede marcar castigos como cumplidos" });

            // Validar que el evento pertenece a una edicion de este canal antes de tocarlo.
            var ev = await _dbContext.TournamentShellEvents
                .Join(_dbContext.TournamentEditions, e => e.TournamentEditionId, ed => ed.Id, (e, ed) => new { e, ed })
                .Where(x => x.e.Id == eventId && x.ed.ChannelOwnerId == channelOwnerId)
                .Select(x => x.e)
                .FirstOrDefaultAsync();

            if (ev == null)
                return NotFound(new { success = false, message = "Evento no encontrado" });

            var ok = await _blueShellService.FulfillEventAsync(_dbContext, eventId, channelOwnerId);
            return Ok(new { success = ok });
        }

        // ─── Lanzar (admin-only por ahora — no hay login de participante todavia, fase 5) ─

        public class ThrowShellRequest
        {
            public long SourceParticipantId { get; set; }
            public long TargetParticipantId { get; set; }
            public long PunishmentTypeId { get; set; }
        }

        [HttpPost("editions/{editionId}/blueshell/throw")]
        public async Task<IActionResult> ThrowShell(long editionId, [FromBody] ThrowShellRequest request)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede lanzar fichas (Milestone 1 — sin login de participante todavia)" });

            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var result = await _blueShellService.ThrowShellAsync(
                _dbContext, edition, request.SourceParticipantId, request.TargetParticipantId, request.PunishmentTypeId);

            if (!result.Success)
                return BadRequest(new { success = false, message = result.Error });

            return Ok(new { success = true, wasReverse = result.WasReverse });
        }
    }
}
