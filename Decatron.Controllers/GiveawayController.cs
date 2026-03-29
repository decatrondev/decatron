using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Decatron.Services;
using Decatron.Core.Models;
using Decatron.Attributes;
using Decatron.Controllers.Dtos;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using System;
using System.Security.Claims;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Text.Json;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class GiveawayController : ControllerBase
    {
        private readonly GiveawayService _giveawayService;
        private readonly ILogger<GiveawayController> _logger;
        private readonly DecatronDbContext _context;

        public GiveawayController(
            GiveawayService giveawayService,
            ILogger<GiveawayController> logger,
            DecatronDbContext context)
        {
            _giveawayService = giveawayService;
            _logger = logger;
            _context = context;
        }

        // ========================================================================
        // CONFIG ENDPOINTS
        // ========================================================================

        [HttpGet("config")]
        [RequirePermission("giveaways")]
        public async Task<IActionResult> GetConfig()
        {
            try
            {
                var twitchId = User.FindFirst("TwitchId")?.Value;
                if (string.IsNullOrEmpty(twitchId))
                    return Unauthorized(new { success = false, message = "No autenticado" });

                var config = await _giveawayService.GetConfig(twitchId);

                return Ok(new { success = true, config });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener config de giveaway");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        [HttpPost("config")]
        [RequirePermission("giveaways")]
        public async Task<IActionResult> SaveConfig([FromBody] GiveawayConfigInput input)
        {
            try
            {
                _logger.LogInformation("=== GIVEAWAY CONFIG SAVE REQUEST ===");

                // Check ModelState first
                if (!ModelState.IsValid)
                {
                    var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).ToList();
                    _logger.LogError($"ModelState is invalid: {string.Join(", ", errors)}");
                    return BadRequest(new { success = false, message = "Errores de validación", errors });
                }

                _logger.LogInformation($"Config received: Name={input?.Name}, Prize={input?.PrizeName}");

                var twitchId = User.FindFirst("TwitchId")?.Value;
                if (string.IsNullOrEmpty(twitchId))
                    return Unauthorized(new { success = false, message = "No autenticado" });

                if (input == null)
                {
                    _logger.LogError("Config is null");
                    return BadRequest(new { success = false, message = "Config no puede ser null" });
                }

                // Map DTO to Entity
                var config = new GiveawayConfig
                {
                    Name = input.Name,
                    PrizeName = input.PrizeName,
                    PrizeDescription = input.PrizeDescription,
                    DurationType = input.DurationType,
                    DurationMinutes = input.DurationMinutes,
                    MaxParticipants = input.MaxParticipants,
                    MaxParticipantsEnabled = input.MaxParticipantsEnabled,
                    AllowMultipleEntries = input.AllowMultipleEntries,
                    NumberOfWinners = input.NumberOfWinners,
                    HasBackupWinners = input.HasBackupWinners,
                    NumberOfBackupWinners = input.NumberOfBackupWinners,
                    EntryCommand = input.EntryCommand,
                    AllowAutoEntry = input.AllowAutoEntry,
                    Requirements = input.Requirements.ValueKind != JsonValueKind.Undefined ? input.Requirements.ToString() : "{}",
                    Weights = input.Weights.ValueKind != JsonValueKind.Undefined ? input.Weights.ToString() : "{}",
                    WinnerCooldownEnabled = input.WinnerCooldownEnabled,
                    WinnerCooldownDays = input.WinnerCooldownDays,
                    AnnounceOnStart = input.AnnounceOnStart,
                    AnnounceReminders = input.AnnounceReminders,
                    ReminderIntervalMinutes = input.ReminderIntervalMinutes,
                    AnnounceParticipantCount = input.AnnounceParticipantCount,
                    StartMessage = input.StartMessage,
                    ReminderMessage = input.ReminderMessage,
                    WinnerMessage = input.WinnerMessage,
                    NoResponseMessage = input.NoResponseMessage,
                    WinnerResponseTimeout = input.WinnerResponseTimeout,
                    AutoRerollOnTimeout = input.AutoRerollOnTimeout
                };

                var savedConfig = await _giveawayService.SaveConfig(twitchId, config);

                return Ok(new { success = true, config = savedConfig });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al guardar config de giveaway");
                return BadRequest(new { success = false, message = "Error saving giveaway configuration. Please try again." });
            }
        }

        // ========================================================================
        // GIVEAWAY CONTROL ENDPOINTS
        // ========================================================================

        [HttpPost("start")]
        [RequirePermission("giveaways")]
        public async Task<IActionResult> StartGiveaway([FromBody] GiveawayConfigInput input)
        {
            try
            {
                var twitchId = User.FindFirst("TwitchId")?.Value;
                if (string.IsNullOrEmpty(twitchId))
                    return Unauthorized(new { success = false, message = "No autenticado" });

                if (input == null)
                    return BadRequest(new { success = false, message = "Config requerida" });

                // Map DTO to Entity
                var config = new GiveawayConfig
                {
                    Name = input.Name,
                    PrizeName = input.PrizeName,
                    PrizeDescription = input.PrizeDescription,
                    DurationType = input.DurationType,
                    DurationMinutes = input.DurationMinutes,
                    MaxParticipants = input.MaxParticipants,
                    MaxParticipantsEnabled = input.MaxParticipantsEnabled,
                    AllowMultipleEntries = input.AllowMultipleEntries,
                    NumberOfWinners = input.NumberOfWinners,
                    HasBackupWinners = input.HasBackupWinners,
                    NumberOfBackupWinners = input.NumberOfBackupWinners,
                    EntryCommand = input.EntryCommand,
                    AllowAutoEntry = input.AllowAutoEntry,
                    Requirements = input.Requirements.ValueKind != JsonValueKind.Undefined ? input.Requirements.ToString() : "{}",
                    Weights = input.Weights.ValueKind != JsonValueKind.Undefined ? input.Weights.ToString() : "{}",
                    WinnerCooldownEnabled = input.WinnerCooldownEnabled,
                    WinnerCooldownDays = input.WinnerCooldownDays,
                    AnnounceOnStart = input.AnnounceOnStart,
                    AnnounceReminders = input.AnnounceReminders,
                    ReminderIntervalMinutes = input.ReminderIntervalMinutes,
                    AnnounceParticipantCount = input.AnnounceParticipantCount,
                    StartMessage = input.StartMessage,
                    ReminderMessage = input.ReminderMessage,
                    WinnerMessage = input.WinnerMessage,
                    NoResponseMessage = input.NoResponseMessage,
                    WinnerResponseTimeout = input.WinnerResponseTimeout,
                    AutoRerollOnTimeout = input.AutoRerollOnTimeout
                };

                // CRITICAL FIX: Save config first to get a valid ID for the foreign key
                var savedConfig = await _giveawayService.SaveConfig(twitchId, config);

                // Start giveaway using the saved config (which has an ID)
                var session = await _giveawayService.StartGiveaway(twitchId, savedConfig);

                // Deserialize snapshot for response
                var configObj = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);

                return Ok(new { 
                    success = true, 
                    giveaway = new {
                        giveawayId = session.Id.ToString(),
                        config = configObj,
                        status = session.Status,
                        startedAt = session.StartedAt,
                        endsAt = session.EndsAt,
                        totalParticipants = session.TotalParticipants,
                        totalWeight = session.TotalWeight,
                        selectedWinners = new List<object>(),
                        backupWinners = new List<object>()
                    }
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al iniciar giveaway");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        [HttpPost("end")]
        [RequirePermission("giveaways")]
        public async Task<IActionResult> EndGiveaway()
        {
            try
            {
                var twitchId = User.FindFirst("TwitchId")?.Value;
                if (string.IsNullOrEmpty(twitchId))
                    return Unauthorized(new { success = false, message = "No autenticado" });

                var session = await _giveawayService.EndGiveaway(twitchId);

                // Deserialize snapshot
                var configObj = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);

                return Ok(new { 
                    success = true, 
                    giveaway = new {
                        giveawayId = session.Id.ToString(),
                        config = configObj,
                        status = session.Status,
                        startedAt = session.StartedAt,
                        endsAt = session.EndsAt,
                        totalParticipants = session.TotalParticipants,
                        totalWeight = session.TotalWeight,
                        selectedWinners = new List<object>(), // Placeholder
                        backupWinners = new List<object>()
                    }
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al finalizar giveaway");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        [HttpPost("cancel")]
        [RequirePermission("giveaways")]
        public async Task<IActionResult> CancelGiveaway([FromBody] CancelRequest request)
        {
            try
            {
                var twitchId = User.FindFirst("TwitchId")?.Value;
                if (string.IsNullOrEmpty(twitchId))
                    return Unauthorized(new { success = false, message = "No autenticado" });

                var session = await _giveawayService.CancelGiveaway(twitchId, request.Reason);

                return Ok(new { success = true, session });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al cancelar giveaway");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        [HttpPost("reroll")]
        [RequirePermission("giveaways")]
        public async Task<IActionResult> RerollWinner([FromBody] RerollRequest request)
        {
            try
            {
                var twitchId = User.FindFirst("TwitchId")?.Value;
                if (string.IsNullOrEmpty(twitchId))
                    return Unauthorized(new { success = false, message = "No autenticado" });

                var winner = await _giveawayService.RerollWinner(twitchId, request.Position);

                return Ok(new { success = true, winner });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al re-sortear ganador");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        [HttpPost("disqualify")]
        [RequirePermission("giveaways")]
        public async Task<IActionResult> DisqualifyWinner([FromBody] DisqualifyRequest request)
        {
            try
            {
                var twitchId = User.FindFirst("TwitchId")?.Value;
                if (string.IsNullOrEmpty(twitchId))
                    return Unauthorized(new { success = false, message = "No autenticado" });

                await _giveawayService.DisqualifyWinner(twitchId, request.Username, request.Reason);

                return Ok(new { success = true, message = "Ganador descalificado correctamente" });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = "An internal error occurred. Please try again later." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al descalificar ganador");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ========================================================================
        // STATE ENDPOINTS
        // ========================================================================

        [HttpGet("active")]
        [RequirePermission("giveaways")]
        public async Task<IActionResult> GetActiveGiveaway()
        {
            try
            {
                var twitchId = User.FindFirst("TwitchId")?.Value;
                if (string.IsNullOrEmpty(twitchId))
                    return Unauthorized(new { success = false, message = "No autenticado" });

                var session = await _giveawayService.GetActiveSession(twitchId);

                if (session == null)
                {
                    return Ok(new { success = true, giveaway = (object?)null });
                }

                // Deserialize config snapshot
                var configObj = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);

                // Load participants from database
                var participants = await _context.GiveawayParticipants
                    .Where(p => p.SessionId == session.Id)
                    .OrderByDescending(p => p.CalculatedWeight)
                    .ToListAsync();

                // Load winners
                var winners = await _context.GiveawayWinners
                    .Where(w => w.SessionId == session.Id && !w.IsBackup)
                    .OrderBy(w => w.Position)
                    .ToListAsync();

                var backupWinners = await _context.GiveawayWinners
                    .Where(w => w.SessionId == session.Id && w.IsBackup)
                    .OrderBy(w => w.Position)
                    .ToListAsync();

                // Load participant data for winners
                var winnerData = new List<object>();
                foreach (var w in winners)
                {
                    var participant = await _context.GiveawayParticipants
                        .FirstOrDefaultAsync(p => p.Id == w.ParticipantId);

                    if (participant != null)
                    {
                        winnerData.Add(new {
                            participant = participant,
                            position = w.Position,
                            selectedAt = w.SelectedAt,
                            isBackup = w.IsBackup,
                            hasResponded = w.HasResponded,
                            wasDisqualified = w.WasDisqualified
                        });
                    }
                }

                var backupWinnerData = new List<object>();
                foreach (var w in backupWinners)
                {
                    var participant = await _context.GiveawayParticipants
                        .FirstOrDefaultAsync(p => p.Id == w.ParticipantId);

                    if (participant != null)
                    {
                        backupWinnerData.Add(new {
                            participant = participant,
                            position = w.Position,
                            selectedAt = w.SelectedAt,
                            isBackup = w.IsBackup
                        });
                    }
                }

                return Ok(new {
                    success = true,
                    giveaway = new {
                        giveawayId = session.Id.ToString(),
                        config = configObj,
                        status = session.Status,
                        startedAt = session.StartedAt,
                        endsAt = session.EndsAt,
                        totalParticipants = session.TotalParticipants,
                        totalWeight = session.TotalWeight,
                        participants = participants,
                        selectedWinners = winnerData,
                        backupWinners = backupWinnerData,
                        cancelReason = session.CancelReason
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener giveaway activo");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        [HttpGet("participants")]
        [RequirePermission("giveaways")]
        public async Task<IActionResult> GetParticipants()
        {
            try
            {
                var twitchId = User.FindFirst("TwitchId")?.Value;
                if (string.IsNullOrEmpty(twitchId))
                    return Unauthorized(new { success = false, message = "No autenticado" });

                var session = await _giveawayService.GetActiveSession(twitchId);
                if (session == null)
                    return Ok(new { success = true, participants = new List<object>() });

                // Get participants from database
                var participants = await _context.GiveawayParticipants
                    .Where(p => p.SessionId == session.Id)
                    .OrderByDescending(p => p.CalculatedWeight)
                    .ToListAsync();

                _logger.LogInformation($"Devolviendo {participants.Count} participantes para sesión {session.Id}");

                return Ok(new { success = true, participants });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener participantes");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // ========================================================================
        // HISTORY ENDPOINTS
        // ========================================================================

        [HttpGet("history")]
        [RequirePermission("giveaways")]
        public async Task<IActionResult> GetHistory([FromQuery] int limit = 50)
        {
            try
            {
                var twitchId = User.FindFirst("TwitchId")?.Value;
                if (string.IsNullOrEmpty(twitchId))
                    return Unauthorized(new { success = false, message = "No autenticado" });

                var sessions = await _giveawayService.GetHistory(twitchId, limit);

                // Transform to frontend format
                var history = new List<object>();
                foreach (var session in sessions)
                {
                    var config = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);

                    // Load winners for this session
                    var winners = await _context.GiveawayWinners
                        .Where(w => w.SessionId == session.Id && !w.IsBackup)
                        .OrderBy(w => w.Position)
                        .ToListAsync();

                    var winnerData = new List<object>();
                    foreach (var w in winners)
                    {
                        var participant = await _context.GiveawayParticipants
                            .FirstOrDefaultAsync(p => p.Id == w.ParticipantId);

                        if (participant != null)
                        {
                            winnerData.Add(new
                            {
                                participant = participant,
                                position = w.Position,
                                selectedAt = w.SelectedAt
                            });
                        }
                    }

                    var durationMinutes = (session.EndedAt.HasValue && session.StartedAt.HasValue)
                        ? (int)(session.EndedAt.Value - session.StartedAt.Value).TotalMinutes
                        : 0;

                    history.Add(new
                    {
                        id = session.Id.ToString(),
                        config = config,
                        totalParticipants = session.TotalParticipants,
                        totalWeight = session.TotalWeight,
                        startedAt = session.StartedAt,
                        endedAt = session.EndedAt,
                        durationMinutes = durationMinutes,
                        winners = winnerData,
                        status = session.Status,
                        cancelReason = session.CancelReason
                    });
                }

                return Ok(new { success = true, history });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener historial");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        [HttpDelete("history/{id}")]
        [RequirePermission("giveaways")]
        public Task<IActionResult> DeleteHistoryEntry(int id)
        {
            return Task.FromResult<IActionResult>(
                StatusCode(501, new { success = false, message = "Delete history not implemented yet" }));
        }

        [HttpGet("statistics")]
        [RequirePermission("giveaways")]
        public async Task<IActionResult> GetStatistics()
        {
            try
            {
                var twitchId = User.FindFirst("TwitchId")?.Value;
                if (string.IsNullOrEmpty(twitchId))
                    return Unauthorized(new { success = false, message = "No autenticado" });

                var statistics = await _giveawayService.GetStatistics(twitchId);

                // If no statistics, return empty data
                if (statistics == null)
                {
                    return Ok(new
                    {
                        success = true,
                        statistics = new
                        {
                            totalGiveaways = 0,
                            totalParticipations = 0,
                            totalWinners = 0,
                            averageParticipantsPerGiveaway = 0.0,
                            topWinners = new List<object>(),
                            averageEngagementRate = 0.0,
                            peakParticipationTime = ""
                        }
                    });
                }

                return Ok(new { success = true, statistics });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener estadísticas");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        [HttpGet("export")]
        [RequirePermission("giveaways")]
        public Task<IActionResult> ExportHistory([FromQuery] string format = "json")
        {
            return Task.FromResult<IActionResult>(
                StatusCode(501, new { success = false, message = "Export functionality not implemented yet" }));
        }

        // ========================================================================
        // DTOs
        // ========================================================================

        public class CancelRequest
        {
            public string? Reason { get; set; }
        }

        public class RerollRequest
        {
            public int? Position { get; set; }
        }

        public class DisqualifyRequest
        {
            public string Username { get; set; } = string.Empty;
            public string? Reason { get; set; }
        }
    }
}
