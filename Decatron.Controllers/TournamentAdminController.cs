using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Decatron.Services;
using Decatron.Services.Tournament;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Security.Claims;
using Decatron.Services.GameData.Riot;

namespace Decatron.Controllers
{
    /// <summary>
    /// Milestone 0 del modulo de Torneos — CRUD minimo de ediciones y alta manual de
    /// participantes, para el modo SoloQ Climb. Sin roles de staff todavia (solo el
    /// dueno del canal puede escribir) — ver .dev/torneos/13-roles-permisos-multitenant.md.
    /// </summary>
    [ApiController]
    [Route("api/admin/tournament")]
    [Authorize]
    public class TournamentAdminController : TournamentControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly ILogger<TournamentAdminController> _logger;
        private readonly RiotApiClient _riotClient;
        private readonly TournamentRiotSyncService _riotSyncService;

        public TournamentAdminController(
            DecatronDbContext dbContext,
            ILogger<TournamentAdminController> logger,
            RiotApiClient riotClient,
            TournamentRiotSyncService riotSyncService,
            IPermissionService permissionService) : base(dbContext, permissionService)
        {
            _dbContext = dbContext;
            _logger = logger;
            _riotClient = riotClient;
            _riotSyncService = riotSyncService;
        }

        // ─── Ediciones ──────────────────────────────────────────────────────────────

        [HttpGet("editions")]
        public async Task<IActionResult> ListEditions()
        {
            var channelOwnerId = GetChannelOwnerId();
            var editions = await _dbContext.TournamentEditions
                .Where(e => e.ChannelOwnerId == channelOwnerId)
                .OrderByDescending(e => e.CreatedAt)
                .ToListAsync();

            // Se agrega el login del canal (no vive en TournamentEdition) para que el
            // panel pueda armar URLs publicas/embebibles sin un segundo pedido —
            // fase 12, snippet de embed en el Dashboard.
            var channelName = (await _dbContext.Users.FindAsync(channelOwnerId))?.Login;

            return Ok(new { success = true, editions, channelName });
        }

        [HttpGet("editions/{id}")]
        public async Task<IActionResult> GetEdition(long id)
        {
            var channelOwnerId = GetChannelOwnerId();
            var edition = await GetOwnedEditionOrNullAsync(id, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            return Ok(new { success = true, edition });
        }

        /// <summary>
        /// Borrado real, no soft-delete — pensado para limpiar ediciones de prueba en
        /// Milestone 0. Participantes y snapshots se van solos por ON DELETE CASCADE
        /// (ver Add_Tournament_Core_Tables.sql). No hay confirmacion server-side de que
        /// sea una edicion "vacia" — el aviso de que borra todo va en el frontend.
        /// </summary>
        [HttpDelete("editions/{id}")]
        public async Task<IActionResult> DeleteEdition(long id)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede borrar ediciones" });

            var edition = await GetOwnedEditionOrNullAsync(id, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            _dbContext.TournamentEditions.Remove(edition);
            await _dbContext.SaveChangesAsync();

            _logger.LogInformation("Torneo: edicion {EditionId} ({Name}) borrada por el dueno del canal {ChannelOwnerId}", id, edition.Name, channelOwnerId);

            return Ok(new { success = true });
        }

        private static readonly string[] ValidEditionStatuses =
            { "draft", "registration_open", "check_in", "in_progress", "finished", "archived" };

        public class UpdateStatusRequest
        {
            public string Status { get; set; } = "";
        }

        /// <summary>
        /// El poller de Riot API (TournamentRiotPollingService) solo procesa ediciones
        /// con Status = "in_progress" — sin este endpoint no hay forma de que arranque
        /// el tracking de un torneo recien creado (nace en "draft").
        /// </summary>
        [HttpPut("editions/{id}/status")]
        public async Task<IActionResult> UpdateEditionStatus(long id, [FromBody] UpdateStatusRequest request)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede cambiar el estado de la edicion" });

            if (!ValidEditionStatuses.Contains(request.Status))
                return BadRequest(new { success = false, message = "Estado invalido" });

            var edition = await GetOwnedEditionOrNullAsync(id, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            edition.Status = request.Status;
            edition.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();

            _logger.LogInformation("Torneo: edicion {EditionId} paso a estado '{Status}'", id, request.Status);

            return Ok(new { success = true, edition });
        }

        public class UpdateMechanicNamesRequest
        {
            public string ShellItemName { get; set; } = "Ficha de Castigo";
            public string AegisMechanicName { get; set; } = "Factor Suerte";
        }

        /// <summary>
        /// Cada tenant nombra su propia mecanica de ficha-castigo y de factor de
        /// suerte de LP — nunca se usa un nombre de producto de terceros como
        /// default ni en ningun texto fijo del sistema, ver
        /// Add_Tournament_Custom_Mechanic_Names.sql.
        /// </summary>
        [HttpPut("editions/{id}/mechanic-names")]
        public async Task<IActionResult> UpdateMechanicNames(long id, [FromBody] UpdateMechanicNamesRequest request)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede renombrar las mecanicas" });

            if (string.IsNullOrWhiteSpace(request.ShellItemName) || string.IsNullOrWhiteSpace(request.AegisMechanicName))
                return BadRequest(new { success = false, message = "Los dos nombres son requeridos" });

            var edition = await GetOwnedEditionOrNullAsync(id, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            edition.ShellItemName = request.ShellItemName.Trim();
            edition.AegisMechanicName = request.AegisMechanicName.Trim();
            edition.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true, edition });
        }

        public class CreateEditionRequest
        {
            public string Name { get; set; } = "";
            public string Slug { get; set; } = "";
            public string? ShortLabel { get; set; }
            public string Mode { get; set; } = "solo_q_climb";
            public string Region { get; set; } = "euw1";
            public DateTime? StartsAt { get; set; }
            public DateTime? EndsAt { get; set; }
            public short? TeamSize { get; set; }
            public string? BracketFormat { get; set; }
        }

        [HttpPost("editions")]
        public async Task<IActionResult> CreateEdition([FromBody] CreateEditionRequest request)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede crear ediciones (Milestone 0)" });

            if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Slug))
                return BadRequest(new { success = false, message = "Nombre y slug son requeridos" });

            var slugTaken = await _dbContext.TournamentEditions
                .AnyAsync(e => e.ChannelOwnerId == channelOwnerId && e.Slug == request.Slug);
            if (slugTaken)
                return Conflict(new { success = false, message = "Ya existe una edicion con ese slug en este canal" });

            var edition = new TournamentEdition
            {
                ChannelOwnerId = channelOwnerId,
                Name = request.Name.Trim(),
                Slug = request.Slug.Trim().ToLowerInvariant(),
                ShortLabel = request.ShortLabel,
                Mode = request.Mode,
                Region = request.Region,
                StartsAt = request.StartsAt,
                EndsAt = request.EndsAt,
                TeamSize = request.Mode == "solo_q_climb" ? null : (request.Mode == "clash_5v5" ? (short)5 : request.TeamSize),
                BracketFormat = request.Mode == "solo_q_climb" ? null : (request.BracketFormat ?? "single_elimination"),
                Status = "draft"
            };

            _dbContext.TournamentEditions.Add(edition);
            await _dbContext.SaveChangesAsync();

            _logger.LogInformation("Torneo: edicion '{Name}' creada para canal {ChannelOwnerId}", edition.Name, channelOwnerId);

            return Ok(new { success = true, edition });
        }

        // ─── Participantes (alta manual — Milestone 0, sin form publico todavia) ──────

        [HttpGet("editions/{editionId}/participants")]
        public async Task<IActionResult> ListParticipants(long editionId)
        {
            var channelOwnerId = GetChannelOwnerId();
            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var participants = await _dbContext.TournamentParticipants
                .Where(p => p.TournamentEditionId == editionId)
                .OrderBy(p => p.DisplayName)
                .ToListAsync();

            return Ok(new { success = true, participants });
        }

        // ─── Ranking (lectura de lo que guarda el poller de Riot) ─────────────────────

        public class RankingSnapshotDto
        {
            public string RiotMatchId { get; set; } = "";
            public DateTime OccurredAt { get; set; }
            public string Result { get; set; } = "";
            public string? Champion { get; set; }
            public short Kills { get; set; }
            public short Deaths { get; set; }
            public short Assists { get; set; }
            public int? LpBefore { get; set; }
            public int? LpAfter { get; set; }
        }

        public class RankingRowDto
        {
            public long ParticipantId { get; set; }
            public string DisplayName { get; set; } = "";
            public string? RiotId { get; set; }
            public string? RiotTagLine { get; set; }
            public bool HasPuuid { get; set; }
            public int? CurrentLp { get; set; }
            public int Wins { get; set; }
            public int Losses { get; set; }
            public DateTime? LastMatchAt { get; set; }
            public List<RankingSnapshotDto> RecentMatches { get; set; } = new();
        }

        [HttpGet("editions/{editionId}/ranking")]
        public async Task<IActionResult> GetRanking(long editionId)
        {
            var channelOwnerId = GetChannelOwnerId();
            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var participants = await _dbContext.TournamentParticipants
                .Where(p => p.TournamentEditionId == editionId && p.Status != "rejected" && p.Status != "withdrawn")
                .ToListAsync();

            var rows = new List<RankingRowDto>();

            foreach (var p in participants)
            {
                var snapshots = await _dbContext.TournamentLpSnapshots
                    .Where(s => s.TournamentParticipantId == p.Id)
                    .OrderByDescending(s => s.OccurredAt)
                    .Take(10)
                    .ToListAsync();

                var wins = snapshots.Count(s => s.Result == "win");
                var losses = snapshots.Count(s => s.Result == "loss");

                rows.Add(new RankingRowDto
                {
                    ParticipantId = p.Id,
                    DisplayName = p.DisplayName,
                    RiotId = p.RiotId,
                    RiotTagLine = p.RiotTagLine,
                    HasPuuid = !string.IsNullOrEmpty(p.RiotPuuid),
                    CurrentLp = snapshots.FirstOrDefault()?.LpAfter,
                    Wins = wins,
                    Losses = losses,
                    LastMatchAt = snapshots.FirstOrDefault()?.OccurredAt,
                    RecentMatches = snapshots.Select(s => new RankingSnapshotDto
                    {
                        RiotMatchId = s.RiotMatchId,
                        OccurredAt = s.OccurredAt,
                        Result = s.Result,
                        Champion = s.Champion,
                        Kills = s.Kills,
                        Deaths = s.Deaths,
                        Assists = s.Assists,
                        LpBefore = s.LpBefore,
                        LpAfter = s.LpAfter,
                    }).ToList()
                });
            }

            // Sin LP todavia (nadie trackeado aun) quedan al final, no arriba con "null" ganando.
            var ordered = rows.OrderByDescending(r => r.CurrentLp ?? -1).ToList();

            return Ok(new { success = true, ranking = ordered });
        }

        /// <summary>
        /// Corre la misma sincronizacion que hace el poller automatico (cada 3 min),
        /// pero ahora mismo — para no tener que esperar mientras se prueba el modulo.
        /// Usa TournamentRiotSyncService, el mismo codigo que consume
        /// TournamentRiotPollingService, no una copia paralela.
        /// </summary>
        [HttpPost("editions/{editionId}/riot-resync")]
        public async Task<IActionResult> ResyncEdition(long editionId)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede resincronizar" });

            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            if (edition.Mode != "solo_q_climb")
                return BadRequest(new { success = false, message = "El motor de sincronizacion solo cubre el modo SoloQ Climb por ahora" });

            var riotConfig = await _dbContext.TournamentRiotConfigs
                .FirstOrDefaultAsync(c => c.ChannelOwnerId == channelOwnerId);
            if (riotConfig == null || !riotConfig.IsActive)
                return BadRequest(new { success = false, message = "No hay una Riot API key activa configurada para este canal" });

            var result = await _riotSyncService.SyncEditionAsync(_dbContext, riotConfig, edition);

            return Ok(new
            {
                success = !result.HadError,
                newSnapshots = result.NewSnapshots,
                message = result.HadError ? result.LastError : $"{result.NewSnapshots} partida(s) nueva(s) trackeada(s)"
            });
        }

        public class AddParticipantRequest
        {
            public string DisplayName { get; set; } = "";
            public string? RiotId { get; set; }
            public string? RiotTagLine { get; set; }
            public string? PrimaryRole { get; set; }
            public string? Nationality { get; set; }
            public string? TwitchChannel { get; set; }
            public string? KickChannel { get; set; }
        }

        [HttpPost("editions/{editionId}/participants")]
        public async Task<IActionResult> AddParticipant(long editionId, [FromBody] AddParticipantRequest request)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede administrar participantes (Milestone 0)" });

            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            if (string.IsNullOrWhiteSpace(request.DisplayName))
                return BadRequest(new { success = false, message = "DisplayName es requerido" });

            // Sin esto se podia cargar la misma cuenta de Riot dos veces por alta
            // manual siempre que el puuid no llegara a resolverse (sin key activa, o
            // dos altas antes de configurarla) — la constraint unica de la base solo
            // cubre riot_puuid, y trata cada NULL como distinto, asi que no frenaba
            // nada en ese caso. Bug reportado por el usuario 24-08-2026.
            if (!string.IsNullOrWhiteSpace(request.RiotId) && !string.IsNullOrWhiteSpace(request.RiotTagLine))
            {
                var riotId = request.RiotId.Trim();
                var riotTagLine = request.RiotTagLine.Trim();
                var alreadyByText = await _dbContext.TournamentParticipants.AnyAsync(p =>
                    p.TournamentEditionId == editionId
                    && p.RiotId != null && p.RiotTagLine != null
                    && p.RiotId.ToLower() == riotId.ToLower() && p.RiotTagLine.ToLower() == riotTagLine.ToLower());

                if (alreadyByText)
                    return BadRequest(new { success = false, message = $"Ya hay un participante inscripto con la cuenta '{riotId}#{riotTagLine}' en este torneo" });
            }

            // Resolver PUUID en el momento contra Riot API — SIEMPRE con la key propia
            // del canal (nunca la de plataforma, que es solo para vincular cuenta en
            // Settings). Antes, si no habia key activa configurada, el alta se
            // guardaba igual sin PUUID — eso es lo que permitia cargar la misma
            // cuenta de Riot mas de una vez (el checkeo de duplicados por texto de
            // arriba no existia todavia, y sin PUUID la constraint unica de la base
            // tampoco frenaba nada). Ahora se exige la key: sin ella no se puede
            // cargar un participante con cuenta de Riot. Bug reportado 24-08-2026.
            string? resolvedPuuid = null;
            if (!string.IsNullOrWhiteSpace(request.RiotId) && !string.IsNullOrWhiteSpace(request.RiotTagLine))
            {
                var riotConfig = await _dbContext.TournamentRiotConfigs
                    .FirstOrDefaultAsync(c => c.ChannelOwnerId == channelOwnerId && c.IsActive);

                if (riotConfig == null)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "No hay una Riot API key activa configurada para este canal — configurala en la pestaña 'Riot API' antes de cargar participantes con cuenta de Riot."
                    });
                }

                var (ok, puuid, error) = await _riotClient.ResolvePuuidAsync(
                    edition.Region, request.RiotId.Trim(), request.RiotTagLine.Trim(), riotConfig.ApiKey);

                if (!ok || string.IsNullOrEmpty(puuid))
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = $"No se encontro la cuenta de Riot '{request.RiotId}#{request.RiotTagLine}' en la region {edition.Region}. Verifica el nombre y el tag exactos.",
                        riotError = error
                    });
                }

                resolvedPuuid = puuid;
            }

            // Redundante con la constraint unica de la base para el caso de puuid
            // resuelto, pero da un mensaje claro en vez de un 500 generico si de
            // todas formas se llega a pisar (ej. condicion de carrera entre dos
            // altas simultaneas).
            if (resolvedPuuid != null)
            {
                var alreadyByPuuid = await _dbContext.TournamentParticipants
                    .AnyAsync(p => p.TournamentEditionId == editionId && p.RiotPuuid == resolvedPuuid);
                if (alreadyByPuuid)
                    return BadRequest(new { success = false, message = "Esa cuenta de Riot ya esta inscripta en este torneo" });
            }

            // Alta manual: entra directo como approved, sin pasar por el flujo de
            // aprobacion publico (eso es fase 5, todavia no implementada).
            var participant = new TournamentParticipant
            {
                TournamentEditionId = editionId,
                DisplayName = request.DisplayName.Trim(),
                RiotId = request.RiotId,
                RiotTagLine = request.RiotTagLine,
                RiotPuuid = resolvedPuuid,
                PrimaryRole = request.PrimaryRole,
                Nationality = request.Nationality,
                TwitchChannel = request.TwitchChannel,
                KickChannel = request.KickChannel,
                Status = "approved",
                RegisteredVia = "web",
                ApprovedAt = DateTime.UtcNow
            };

            _dbContext.TournamentParticipants.Add(participant);
            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true, participant });
        }

        public class SeedTestParticipantsRequest
        {
            public int Count { get; set; } = 50;
        }

        // Herramienta de desarrollo — simular una inscripcion masiva sin fabricar
        // sesiones de usuario (regla establecida en esta misma sesion de trabajo: no
        // actuar "como si fuera" el usuario). El dueno del canal la dispara con su
        // propia sesion real. Sin Riot ID: no hace falta resolverlo, ARAM carga
        // resultados a mano (ver .dev/torneos/02-motor-de-torneo-formatos.md seccion 6).
        [HttpPost("editions/{editionId}/participants/seed-test")]
        public async Task<IActionResult> SeedTestParticipants(long editionId, [FromBody] SeedTestParticipantsRequest? request)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede sembrar participantes de prueba" });

            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            if (edition == null)
                return NotFound(new { success = false, message = "Edicion no encontrada" });

            var count = request?.Count ?? 50;
            if (count < 1 || count > 200)
                return BadRequest(new { success = false, message = "Count tiene que estar entre 1 y 200" });

            var existingCount = await _dbContext.TournamentParticipants.CountAsync(p => p.TournamentEditionId == editionId);

            var participants = Enumerable.Range(1, count).Select(i => new TournamentParticipant
            {
                TournamentEditionId = editionId,
                DisplayName = $"Jugador de Prueba {existingCount + i:D2}",
                Status = "approved",
                RegisteredVia = "web",
                ApprovedAt = DateTime.UtcNow,
            }).ToList();

            _dbContext.TournamentParticipants.AddRange(participants);
            await _dbContext.SaveChangesAsync();

            return Ok(new { success = true, created = participants.Count });
        }

        // ─── Riot API config (una por canal, la key la trae el tenant) ────────────────

        public class RiotConfigResponse
        {
            public bool Configured { get; set; }
            public string? KeyType { get; set; }
            public bool IsActive { get; set; }
            public DateTime? LastValidatedAt { get; set; }
            public DateTime? LastErrorAt { get; set; }
            public string? LastErrorMessage { get; set; }
        }

        [HttpGet("riot-config")]
        public async Task<IActionResult> GetRiotConfig()
        {
            var channelOwnerId = GetChannelOwnerId();
            var config = await _dbContext.TournamentRiotConfigs
                .FirstOrDefaultAsync(c => c.ChannelOwnerId == channelOwnerId);

            if (config == null)
                return Ok(new { success = true, config = new RiotConfigResponse { Configured = false } });

            return Ok(new
            {
                success = true,
                config = new RiotConfigResponse
                {
                    Configured = true,
                    KeyType = config.KeyType,
                    IsActive = config.IsActive,
                    LastValidatedAt = config.LastValidatedAt,
                    LastErrorAt = config.LastErrorAt,
                    LastErrorMessage = config.LastErrorMessage
                }
            });
            // Nunca se devuelve ApiKey en la respuesta, ni siquiera al dueno del canal
            // una vez guardada — si necesita cambiarla, la vuelve a pegar entera.
        }

        public class SetRiotConfigRequest
        {
            public string ApiKey { get; set; } = "";
            public string KeyType { get; set; } = "development";
        }

        [HttpPost("riot-config")]
        public async Task<IActionResult> SetRiotConfig([FromBody] SetRiotConfigRequest request)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (!await IsChannelAuthorizedAsync(channelOwnerId))
                return StatusCode(403, new { success = false, message = "Solo el dueno del canal puede configurar la Riot API key" });

            if (string.IsNullOrWhiteSpace(request.ApiKey))
                return BadRequest(new { success = false, message = "ApiKey es requerida" });

            var trimmedKey = request.ApiKey.Trim();

            // Probar la key contra Riot ANTES de guardarla — antes se guardaba a
            // ciegas y recien se enteraban de que estaba mal cuando el poller
            // fallaba, minutos despues y sin que nadie lo viera. Bug reportado
            // 24-08-2026.
            var (valid, verifyError) = await _riotClient.VerifyApiKeyAsync(trimmedKey);
            if (!valid)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Riot rechazo esa key — revisa que la hayas copiado completa desde developer.riotgames.com (las de tipo development vencen cada 24hs, puede que sea una vieja).",
                    riotError = verifyError
                });
            }

            var config = await _dbContext.TournamentRiotConfigs
                .FirstOrDefaultAsync(c => c.ChannelOwnerId == channelOwnerId);

            if (config == null)
            {
                config = new TournamentRiotConfig { ChannelOwnerId = channelOwnerId };
                _dbContext.TournamentRiotConfigs.Add(config);
            }

            config.ApiKey = trimmedKey;
            config.KeyType = request.KeyType;
            config.IsActive = true;
            config.LastValidatedAt = DateTime.UtcNow;
            config.LastErrorAt = null;
            config.LastErrorMessage = null;
            config.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync();

            _logger.LogInformation("Torneo: Riot API key configurada y verificada para canal {ChannelOwnerId} (tipo {KeyType})", channelOwnerId, request.KeyType);

            return Ok(new { success = true });
        }
    }
}
