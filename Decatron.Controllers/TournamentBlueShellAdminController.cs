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

            if (edition.Game == TournamentGames.Fortnite)
            {
                await SeedFortniteDefaultsAsync(editionId);
                return Ok(new { success = true });
            }

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

        /// <summary>
        /// Valores de ejemplo para Fortnite (F6): castigos que se pueden cumplir en una
        /// personalizada y las cuatro condiciones acordadas. El streamer los edita o
        /// borra. Sin cooldown por puesto (las sesiones duran horas, no dias) y sin
        /// apagado al final (las ediciones de Fortnite suelen ser de un dia).
        /// </summary>
        private async Task SeedFortniteDefaultsAsync(long editionId)
        {
            if (!await _dbContext.TournamentPunishmentTypes.AnyAsync(p => p.TournamentEditionId == editionId))
            {
                var punishmentNames = new[]
                {
                    "Solo escopetas", "Sin curarse (ni escudos)", "Solo armas grises y verdes", "Sin vehículos",
                    "Aterrizar donde elija el rival", "Sin objetos de movilidad", "Jugar la partida sin construir",
                };
                foreach (var name in punishmentNames)
                    _dbContext.TournamentPunishmentTypes.Add(new TournamentPunishmentType { TournamentEditionId = editionId, Name = name, AllowsReverse = true });
            }

            if (!await _dbContext.TournamentShellTriggers.AnyAsync(t => t.TournamentEditionId == editionId))
            {
                _dbContext.TournamentShellTriggers.AddRange(
                    new TournamentShellTrigger { TournamentEditionId = editionId, Name = "Ganar una partida", ConditionType = "fn_win", ThresholdValue = 1, ShellsGranted = 1 },
                    new TournamentShellTrigger { TournamentEditionId = editionId, Name = "10 o más eliminaciones en una partida", ConditionType = "fn_eliminations", ThresholdValue = 10, ShellsGranted = 1 },
                    new TournamentShellTrigger { TournamentEditionId = editionId, Name = "Top 5 en 3 partidas seguidas", ConditionType = "fn_top_streak", ThresholdValue = 5, StreakLength = 3, ShellsGranted = 1 },
                    new TournamentShellTrigger { TournamentEditionId = editionId, Name = "Remontada: subir 5 puestos en una sesión", ConditionType = "fn_comeback", ThresholdValue = 5, ShellsGranted = 1 });
            }

            if (!await _dbContext.TournamentBlueShellRules.AnyAsync(r => r.TournamentEditionId == editionId))
            {
                _dbContext.TournamentBlueShellRules.Add(new TournamentBlueShellRules
                {
                    TournamentEditionId = editionId,
                    CooldownByRank = "[{\"minRank\":1,\"maxRank\":9999,\"cooldownHours\":0}]",
                    ReverseChanceByRank = "[{\"minRank\":1,\"maxRank\":1,\"reverseChancePercent\":1},{\"minRank\":2,\"maxRank\":2,\"reverseChancePercent\":2},{\"minRank\":3,\"maxRank\":3,\"reverseChancePercent\":3},{\"minRank\":4,\"maxRank\":4,\"reverseChancePercent\":4},{\"minRank\":5,\"maxRank\":5,\"reverseChancePercent\":5},{\"minRank\":6,\"maxRank\":9999,\"reverseChancePercent\":15}]",
                    MaxInventory = 3,
                    ThrowBlockWindowMinutes = 15,
                    DisableLastNHours = 0,
                });
            }

            await _dbContext.SaveChangesAsync();
        }

        // ─── Edicion del catalogo (castigos y condiciones) ──────────────────────────

        private static readonly string[] LolConditionTypes =
            { "stat_threshold", "streak_wins", "perfect_kda", "match_duration_min", "champion_variety", "win_with_active_punishment", "penta_kills" };

        private async Task<(TournamentEdition? edition, IActionResult? error)> ResolveWritableAsync(long editionId)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return (null, StatusCode(403, new { success = false, message = "Solo el dueño del canal o alguien con control total puede editar el catálogo" }));
            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            return edition == null ? (null, NotFound(new { success = false, message = "Edición no encontrada" })) : (edition, null);
        }

        public class PunishmentRequest
        {
            public string Name { get; set; } = "";
            public bool AllowsReverse { get; set; } = true;
            public bool IsActive { get; set; } = true;
        }

        [HttpPost("editions/{editionId}/blueshell/punishments")]
        public async Task<IActionResult> CreatePunishment(long editionId, [FromBody] PunishmentRequest request)
        {
            var (edition, error) = await ResolveWritableAsync(editionId);
            if (error != null) return error;
            if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 150)
                return BadRequest(new { success = false, message = "El nombre es requerido (máximo 150 caracteres)" });

            var p = new TournamentPunishmentType { TournamentEditionId = editionId, Name = request.Name.Trim(), AllowsReverse = request.AllowsReverse, IsActive = request.IsActive };
            _dbContext.TournamentPunishmentTypes.Add(p);
            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true, punishment = p });
        }

        [HttpPut("editions/{editionId}/blueshell/punishments/{id}")]
        public async Task<IActionResult> UpdatePunishment(long editionId, long id, [FromBody] PunishmentRequest request)
        {
            var (edition, error) = await ResolveWritableAsync(editionId);
            if (error != null) return error;
            var p = await _dbContext.TournamentPunishmentTypes.FirstOrDefaultAsync(x => x.Id == id && x.TournamentEditionId == editionId);
            if (p == null) return NotFound(new { success = false, message = "Castigo no encontrado" });
            if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 150)
                return BadRequest(new { success = false, message = "El nombre es requerido (máximo 150 caracteres)" });

            p.Name = request.Name.Trim();
            p.AllowsReverse = request.AllowsReverse;
            p.IsActive = request.IsActive;
            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true, punishment = p });
        }

        /// <summary>Si ya se uso en algun lanzamiento no se borra (queda en el historial): se desactiva.</summary>
        [HttpDelete("editions/{editionId}/blueshell/punishments/{id}")]
        public async Task<IActionResult> DeletePunishment(long editionId, long id)
        {
            var (edition, error) = await ResolveWritableAsync(editionId);
            if (error != null) return error;
            var p = await _dbContext.TournamentPunishmentTypes.FirstOrDefaultAsync(x => x.Id == id && x.TournamentEditionId == editionId);
            if (p == null) return NotFound(new { success = false, message = "Castigo no encontrado" });

            if (await _dbContext.TournamentShellEvents.AnyAsync(e => e.PunishmentTypeId == id))
            {
                p.IsActive = false;
                await _dbContext.SaveChangesAsync();
                return Ok(new { success = true, deactivated = true });
            }
            _dbContext.TournamentPunishmentTypes.Remove(p);
            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true, deactivated = false });
        }

        public class TriggerRequest
        {
            public string Name { get; set; } = "";
            public string ConditionType { get; set; } = "";
            public string? StatField { get; set; }
            public decimal ThresholdValue { get; set; } = 1;
            public short? StreakLength { get; set; }
            public short ShellsGranted { get; set; } = 1;
            public bool IsActive { get; set; } = true;
        }

        private static string? ValidateTrigger(TournamentEdition edition, TriggerRequest r)
        {
            if (string.IsNullOrWhiteSpace(r.Name) || r.Name.Trim().Length > 150) return "El nombre es requerido (máximo 150 caracteres)";
            var valid = edition.Game == TournamentGames.Fortnite ? TournamentFortniteShellService.ConditionTypes : LolConditionTypes;
            if (!valid.Contains(r.ConditionType)) return "Condición no válida para este juego";
            if (r.ThresholdValue < 0 || r.ThresholdValue > 100000) return "Valor fuera de rango";
            if (r.ShellsGranted < 1 || r.ShellsGranted > 10) return "Se otorgan entre 1 y 10 fichas";
            if (r.ConditionType == "fn_top_streak" && r.StreakLength is null or < 2 or > 20) return "La racha es de 2 a 20 partidas seguidas";
            if (r.ConditionType == "stat_threshold" && r.StatField is not ("kills" or "assists" or "deaths")) return "Elige la estadística (kills, asistencias o muertes)";
            return null;
        }

        private static void ApplyTrigger(TournamentShellTrigger t, TriggerRequest r)
        {
            t.Name = r.Name.Trim();
            t.ConditionType = r.ConditionType;
            t.StatField = r.ConditionType == "stat_threshold" ? r.StatField : null;
            t.ThresholdValue = r.ConditionType == "fn_win" ? 1 : r.ThresholdValue;
            t.StreakLength = r.ConditionType == "fn_top_streak" ? r.StreakLength : null;
            t.ShellsGranted = r.ShellsGranted;
            t.IsActive = r.IsActive;
        }

        [HttpPost("editions/{editionId}/blueshell/triggers")]
        public async Task<IActionResult> CreateTrigger(long editionId, [FromBody] TriggerRequest request)
        {
            var (edition, error) = await ResolveWritableAsync(editionId);
            if (error != null) return error;
            var validation = ValidateTrigger(edition!, request);
            if (validation != null) return BadRequest(new { success = false, message = validation });

            var t = new TournamentShellTrigger { TournamentEditionId = editionId };
            ApplyTrigger(t, request);
            _dbContext.TournamentShellTriggers.Add(t);
            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true, trigger = t });
        }

        [HttpPut("editions/{editionId}/blueshell/triggers/{id}")]
        public async Task<IActionResult> UpdateTrigger(long editionId, long id, [FromBody] TriggerRequest request)
        {
            var (edition, error) = await ResolveWritableAsync(editionId);
            if (error != null) return error;
            var t = await _dbContext.TournamentShellTriggers.FirstOrDefaultAsync(x => x.Id == id && x.TournamentEditionId == editionId);
            if (t == null) return NotFound(new { success = false, message = "Condición no encontrada" });
            var validation = ValidateTrigger(edition!, request);
            if (validation != null) return BadRequest(new { success = false, message = validation });

            ApplyTrigger(t, request);
            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true, trigger = t });
        }

        /// <summary>Si ya otorgo fichas no se borra (queda en el historial): se desactiva.</summary>
        [HttpDelete("editions/{editionId}/blueshell/triggers/{id}")]
        public async Task<IActionResult> DeleteTrigger(long editionId, long id)
        {
            var (edition, error) = await ResolveWritableAsync(editionId);
            if (error != null) return error;
            var t = await _dbContext.TournamentShellTriggers.FirstOrDefaultAsync(x => x.Id == id && x.TournamentEditionId == editionId);
            if (t == null) return NotFound(new { success = false, message = "Condición no encontrada" });

            if (await _dbContext.TournamentShellEvents.AnyAsync(e => e.TriggerId == id))
            {
                t.IsActive = false;
                await _dbContext.SaveChangesAsync();
                return Ok(new { success = true, deactivated = true });
            }
            _dbContext.TournamentShellTriggers.Remove(t);
            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true, deactivated = false });
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

            // Fortnite: una fila por equipo (las fichas las guarda el titular del equipo).
            if (edition.Game == TournamentGames.Fortnite)
            {
                var holders = await TournamentFortniteShellService.TeamHoldersAsync(_dbContext, editionId);
                var teamNames = await _dbContext.TournamentTeams.Where(t => t.TournamentEditionId == editionId).ToDictionaryAsync(t => t.Id, t => t.Name);
                var holderIds = holders.Values.ToList();
                var invs = await _dbContext.TournamentShellInventories.Where(i => holderIds.Contains(i.TournamentParticipantId)).ToDictionaryAsync(i => i.TournamentParticipantId);
                var teamRows = holders
                    .Select(h =>
                    {
                        invs.TryGetValue(h.Value, out var inv);
                        return new InventoryRowDto
                        {
                            ParticipantId = h.Value,
                            DisplayName = teamNames.GetValueOrDefault(h.Key, $"Equipo {h.Key}"),
                            Count = inv?.Count ?? 0,
                            TotalObtained = inv?.TotalObtained ?? 0,
                            TotalThrown = inv?.TotalThrown ?? 0,
                            TotalReceived = inv?.TotalReceived ?? 0,
                        };
                    })
                    .OrderBy(r => r.DisplayName)
                    .ToList();
                return Ok(new { success = true, inventory = teamRows });
            }

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
            // Fortnite: las fichas son del equipo, se muestra el nombre del equipo.
            if (edition.Game == TournamentGames.Fortnite)
            {
                var teamOf = await _dbContext.TournamentParticipants
                    .Where(p => p.TournamentEditionId == editionId && p.TeamId != null)
                    .Join(_dbContext.TournamentTeams, p => p.TeamId, t => t.Id, (p, t) => new { p.Id, t.Name })
                    .ToDictionaryAsync(x => x.Id, x => x.Name);
                foreach (var (id, name) in teamOf) participants[id] = name;
            }
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
