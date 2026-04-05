using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Security.Cryptography;
using System.Text.Json;

namespace Decatron.Services
{
    public interface IRaffleService
    {
        // CRUD Operations
        Task<List<Raffle>> GetAllByChannelAsync(string channelName);
        Task<Raffle?> GetByIdAsync(int id);
        Task<Raffle> CreateAsync(Raffle raffle);
        Task<Raffle> UpdateAsync(Raffle raffle);
        Task DeleteAsync(int id);

        // Raffle Status Management
        Task<Raffle> OpenRaffleAsync(int raffleId);
        Task<Raffle> CloseRaffleAsync(int raffleId);
        Task<Raffle> CancelRaffleAsync(int raffleId, string reason);

        // Participant Management
        Task<RaffleParticipant> AddParticipantAsync(int raffleId, string username, long? twitchUserId, string entryMethod, int tickets = 1, string? metadata = null);
        Task<List<RaffleParticipant>> GetParticipantsAsync(int raffleId, bool includeDisqualified = false);
        Task<RaffleParticipant?> GetParticipantByUsernameAsync(int raffleId, string username);
        Task DisqualifyParticipantAsync(int participantId, string reason);
        Task RemoveParticipantAsync(int participantId);

        // Winner Management
        Task<List<RaffleWinner>> DrawWinnersAsync(int raffleId, bool weighted = false);
        Task<RaffleWinner> RerollWinnerAsync(int winnerId, string reason, string channelName);
        Task<List<RaffleWinner>> GetWinnersAsync(int raffleId);
        Task ConfirmWinnerAsync(int winnerId);

        // Validation & Eligibility
        Task<bool> ValidateParticipantEligibilityAsync(int raffleId, string username, long? twitchUserId = null);
        Task<RaffleEligibilityResult> CheckEligibilityAsync(int raffleId, string username, long? twitchUserId = null);

        // Statistics
        Task<RaffleStatistics> GetStatisticsAsync(string channelName);
        Task<RaffleStatistics> GetRaffleStatisticsAsync(int raffleId);

        // Importación mejorada
        Task<ImportSessionResult> ImportParticipantsFromSessionAsync(int raffleId, ImportSessionRequest request);

        // Sesiones disponibles
        Task<List<TimerSessionInfo>> GetAvailableSessionsAsync(string channelName, int limit = 20);
    }

    public class RaffleService : IRaffleService
    {
        private readonly DecatronDbContext _context;
        private readonly ILogger<RaffleService> _logger;

        public RaffleService(DecatronDbContext context, ILogger<RaffleService> logger)
        {
            _context = context;
            _logger = logger;
        }

        // ========================================================================
        // CRUD OPERATIONS
        // ========================================================================

        public async Task<List<Raffle>> GetAllByChannelAsync(string channelName)
        {
            return await _context.Raffles
                .Where(r => r.ChannelName == channelName.ToLower())
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        public async Task<Raffle?> GetByIdAsync(int id)
        {
            return await _context.Raffles
                .FirstOrDefaultAsync(r => r.Id == id);
        }

        public async Task<Raffle> CreateAsync(Raffle raffle)
        {
            raffle.ChannelName = raffle.ChannelName.ToLower();
            ValidateRaffle(raffle);

            var activeRafflesCount = await _context.Raffles
                .Where(r => r.ChannelName == raffle.ChannelName && r.Status == "open")
                .CountAsync();

            if (activeRafflesCount >= 5)
            {
                throw new InvalidOperationException("Has alcanzado el límite máximo de 5 sorteos activos simultáneamente");
            }

            raffle.CreatedAt = DateTime.UtcNow;
            raffle.UpdatedAt = DateTime.UtcNow;
            raffle.Status = "open";

            _context.Raffles.Add(raffle);
            await _context.SaveChangesAsync();

            _logger.LogInformation($"✅ Sorteo creado: {raffle.Name} en canal {raffle.ChannelName}");
            return raffle;
        }

        public async Task<Raffle> UpdateAsync(Raffle raffle)
        {
            var existing = await _context.Raffles.FindAsync(raffle.Id);
            if (existing == null) throw new KeyNotFoundException($"Sorteo {raffle.Id} no encontrado");

            if (existing.Status == "completed" || existing.Status == "cancelled")
            {
                throw new InvalidOperationException("No puedes editar un sorteo completado o cancelado");
            }

            ValidateRaffle(raffle);

            existing.Name = raffle.Name;
            existing.Description = raffle.Description;
            existing.WinnersCount = raffle.WinnersCount;
            existing.ConfigJson = raffle.ConfigJson;
            existing.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return existing;
        }

        public async Task DeleteAsync(int id)
        {
            var raffle = await _context.Raffles.FindAsync(id);
            if (raffle == null) throw new KeyNotFoundException($"Sorteo {id} no encontrado");

            if (raffle.Status == "completed")
            {
                throw new InvalidOperationException("No puedes eliminar un sorteo completado. Considera cancelarlo.");
            }

            _context.Raffles.Remove(raffle);
            await _context.SaveChangesAsync();
        }

        // ========================================================================
        // RAFFLE STATUS MANAGEMENT
        // ========================================================================

        public async Task<Raffle> OpenRaffleAsync(int raffleId)
        {
            var raffle = await GetByIdAsync(raffleId);
            if (raffle == null) throw new KeyNotFoundException($"Sorteo {raffleId} no encontrado");
            if (raffle.Status == "open") throw new InvalidOperationException("El sorteo ya está abierto");

            raffle.Status = "open";
            raffle.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return raffle;
        }

        public async Task<Raffle> CloseRaffleAsync(int raffleId)
        {
            var raffle = await GetByIdAsync(raffleId);
            if (raffle == null) throw new KeyNotFoundException($"Sorteo {raffleId} no encontrado");
            if (raffle.Status != "open") throw new InvalidOperationException("Solo puedes cerrar sorteos abiertos");

            raffle.Status = "closed";
            raffle.ClosedAt = DateTime.UtcNow;
            raffle.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return raffle;
        }

        public async Task<Raffle> CancelRaffleAsync(int raffleId, string reason)
        {
            var raffle = await GetByIdAsync(raffleId);
            if (raffle == null) throw new KeyNotFoundException($"Sorteo {raffleId} no encontrado");

            raffle.Status = "cancelled";
            raffle.UpdatedAt = DateTime.UtcNow;

            var config = string.IsNullOrEmpty(raffle.ConfigJson)
                ? new Dictionary<string, object>()
                : JsonSerializer.Deserialize<Dictionary<string, object>>(raffle.ConfigJson) ?? new Dictionary<string, object>();

            config["cancellationReason"] = reason;
            config["cancelledAt"] = DateTime.UtcNow.ToString("O");
            raffle.ConfigJson = JsonSerializer.Serialize(config);

            await _context.SaveChangesAsync();
            return raffle;
        }

        // ========================================================================
        // PARTICIPANT MANAGEMENT
        // ========================================================================

        public async Task<RaffleParticipant> AddParticipantAsync(int raffleId, string username, long? twitchUserId, string entryMethod, int tickets = 1, string? metadata = null)
        {
            var raffle = await GetByIdAsync(raffleId);
            if (raffle == null) throw new KeyNotFoundException($"Sorteo {raffleId} no encontrado");
            if (raffle.Status != "open") throw new InvalidOperationException("El sorteo no está abierto");

            username = username.ToLower();

            var existing = await GetParticipantByUsernameAsync(raffleId, username);
            if (existing != null)
            {
                existing.Tickets += tickets;
                existing.MetadataJson = metadata ?? existing.MetadataJson;
                raffle.TotalTickets += tickets;
                await _context.SaveChangesAsync();
                return existing;
            }

            var participant = new RaffleParticipant
            {
                RaffleId = raffleId,
                Username = username,
                TwitchUserId = twitchUserId,
                Tickets = tickets,
                EntryMethod = entryMethod,
                MetadataJson = metadata,
                JoinedAt = DateTime.UtcNow
            };

            _context.RaffleParticipants.Add(participant);
            raffle.TotalParticipants++;
            raffle.TotalTickets += tickets;
            raffle.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return participant;
        }

        public async Task<List<RaffleParticipant>> GetParticipantsAsync(int raffleId, bool includeDisqualified = false)
        {
            var query = _context.RaffleParticipants.Where(p => p.RaffleId == raffleId);
            if (!includeDisqualified) query = query.Where(p => !p.IsDisqualified);
            return await query.OrderBy(p => p.JoinedAt).ToListAsync();
        }

        public async Task<RaffleParticipant?> GetParticipantByUsernameAsync(int raffleId, string username)
        {
            return await _context.RaffleParticipants.FirstOrDefaultAsync(p => p.RaffleId == raffleId && p.Username == username.ToLower());
        }

        public async Task DisqualifyParticipantAsync(int participantId, string reason)
        {
            var participant = await _context.RaffleParticipants.FindAsync(participantId);
            if (participant == null) throw new KeyNotFoundException($"Participante {participantId} no encontrado");

            participant.IsDisqualified = true;
            participant.DisqualificationReason = reason;

            var raffle = await _context.Raffles.FindAsync(participant.RaffleId);
            if (raffle != null)
            {
                raffle.TotalParticipants--;
                raffle.TotalTickets -= participant.Tickets;
                raffle.UpdatedAt = DateTime.UtcNow;
            }
            await _context.SaveChangesAsync();
        }

        public async Task RemoveParticipantAsync(int participantId)
        {
            var participant = await _context.RaffleParticipants.FindAsync(participantId);
            if (participant == null) throw new KeyNotFoundException($"Participante {participantId} no encontrado");

            var raffle = await _context.Raffles.FindAsync(participant.RaffleId);
            if (raffle != null && raffle.Status == "open")
            {
                raffle.TotalParticipants--;
                raffle.TotalTickets -= participant.Tickets;
                raffle.UpdatedAt = DateTime.UtcNow;
            }

            _context.RaffleParticipants.Remove(participant);
            await _context.SaveChangesAsync();
        }

        // ========================================================================
        // WINNER MANAGEMENT (RNG Criptográfico)
        // ========================================================================

        public async Task<List<RaffleWinner>> DrawWinnersAsync(int raffleId, bool weighted = false)
        {
            var raffle = await GetByIdAsync(raffleId);
            if (raffle == null) throw new KeyNotFoundException($"Sorteo {raffleId} no encontrado");
            if (raffle.Status != "closed") throw new InvalidOperationException("El sorteo debe estar cerrado antes de sortear");

            var participants = await GetParticipantsAsync(raffleId, includeDisqualified: false);
            if (participants.Count == 0) throw new InvalidOperationException("No hay participantes elegibles");

            // Cooldown: excluir ganadores recientes
            var cooldownDays = GetCooldownDays(raffle);
            if (cooldownDays > 0)
            {
                var recentWinnerUsernames = await GetRecentWinnerUsernamesAsync(raffle.ChannelName, cooldownDays);
                var before = participants.Count;
                participants = participants.Where(p => !recentWinnerUsernames.Contains(p.Username)).ToList();

                if (before != participants.Count)
                {
                    _logger.LogInformation($"Cooldown: {before - participants.Count} participantes excluidos por haber ganado en los últimos {cooldownDays} días");
                }

                if (participants.Count == 0) throw new InvalidOperationException("No hay participantes elegibles después de aplicar el cooldown de ganadores recientes");
            }

            var winnersCount = Math.Min(raffle.WinnersCount, participants.Count);
            var winners = new List<RaffleWinner>();
            var selectedParticipants = new HashSet<int>();

            for (int position = 1; position <= winnersCount; position++)
            {
                RaffleParticipant winner;
                if (weighted) winner = WeightedRandomSelection(participants, selectedParticipants);
                else winner = RandomSelection(participants, selectedParticipants);

                selectedParticipants.Add(winner.Id);

                var raffleWinner = new RaffleWinner
                {
                    RaffleId = raffleId,
                    ParticipantId = winner.Id,
                    Username = winner.Username,
                    Position = position,
                    WonAt = DateTime.UtcNow
                };

                _context.RaffleWinners.Add(raffleWinner);
                winners.Add(raffleWinner);
            }

            raffle.Status = "completed";
            raffle.DrawnAt = DateTime.UtcNow;
            raffle.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return winners;
        }

        public async Task<RaffleWinner> RerollWinnerAsync(int winnerId, string reason, string channelName)
        {
            var winner = await _context.RaffleWinners
                .Include(w => w.Raffle)
                .FirstOrDefaultAsync(w => w.Id == winnerId);

            if (winner == null) throw new KeyNotFoundException($"Ganador {winnerId} no encontrado");

            // Validar ownership del raffle
            if (winner.Raffle == null || !winner.Raffle.ChannelName.Equals(channelName, StringComparison.OrdinalIgnoreCase))
            {
                throw new UnauthorizedAccessException("No tienes permiso para hacer reroll en este sorteo");
            }

            var raffleId = winner.RaffleId;
            var position = winner.Position;
            var oldUsername = winner.Username;

            // Obtener participantes que ya son ganadores activos (excluyendo el que se va a rerollear)
            var currentWinnerParticipantIds = await _context.RaffleWinners
                .Where(w => w.RaffleId == raffleId && w.Id != winnerId)
                .Select(w => w.ParticipantId)
                .ToListAsync();

            var eligible = await _context.RaffleParticipants
                .Where(p => p.RaffleId == raffleId && !p.IsDisqualified && !currentWinnerParticipantIds.Contains(p.Id))
                .ToListAsync();

            // Excluir también al participante del winner que se rerollea
            eligible = eligible.Where(p => p.Id != winner.ParticipantId).ToList();

            if (eligible.Count == 0) throw new InvalidOperationException("No hay más participantes elegibles para reroll");

            var newWinnerPart = eligible[CryptoRandomInt(eligible.Count)];

            // Eliminar el winner viejo (constraint UNIQUE en raffle_id + position)
            _context.RaffleWinners.Remove(winner);
            await _context.SaveChangesAsync();

            // Crear el nuevo winner con la misma position
            var newWinner = new RaffleWinner
            {
                RaffleId = raffleId,
                ParticipantId = newWinnerPart.Id,
                Username = newWinnerPart.Username,
                Position = position,
                WonAt = DateTime.UtcNow,
                RerollReason = $"Reroll de {oldUsername}: {reason}"
            };

            _context.RaffleWinners.Add(newWinner);
            await _context.SaveChangesAsync();
            return newWinner;
        }

        public async Task<List<RaffleWinner>> GetWinnersAsync(int raffleId)
        {
            return await _context.RaffleWinners
                .Where(w => w.RaffleId == raffleId && !w.WasRerolled)
                .OrderBy(w => w.Position)
                .Include(w => w.Participant)
                .ToListAsync();
        }

        public async Task ConfirmWinnerAsync(int winnerId)
        {
            var winner = await _context.RaffleWinners.FindAsync(winnerId);
            if (winner == null) throw new KeyNotFoundException($"Ganador {winnerId} no encontrado");
            winner.HasConfirmed = true;
            winner.ConfirmedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        // ========================================================================
        // VALIDATION
        // ========================================================================

        public async Task<bool> ValidateParticipantEligibilityAsync(int raffleId, string username, long? twitchUserId = null)
        {
            var result = await CheckEligibilityAsync(raffleId, username, twitchUserId);
            return result.IsEligible;
        }

        public async Task<RaffleEligibilityResult> CheckEligibilityAsync(int raffleId, string username, long? twitchUserId = null)
        {
            var raffle = await GetByIdAsync(raffleId);
            if (raffle == null) return new RaffleEligibilityResult { IsEligible = false, Reason = "Sorteo no encontrado" };
            if (raffle.Status != "open") return new RaffleEligibilityResult { IsEligible = false, Reason = "Sorteo cerrado" };

            // Verificar cooldown de ganadores recientes
            var cooldownDays = GetCooldownDays(raffle);
            if (cooldownDays > 0)
            {
                var recentWinners = await GetRecentWinnerUsernamesAsync(raffle.ChannelName, cooldownDays);
                if (recentWinners.Contains(username.ToLower()))
                {
                    return new RaffleEligibilityResult
                    {
                        IsEligible = false,
                        Reason = $"Ganaste un sorteo recientemente. Debes esperar {cooldownDays} días para participar."
                    };
                }
            }

            return new RaffleEligibilityResult { IsEligible = true };
        }

        public async Task<RaffleStatistics> GetStatisticsAsync(string channelName)
        {
            var raffles = await _context.Raffles.Where(r => r.ChannelName == channelName.ToLower()).ToListAsync();
            var ids = raffles.Select(r => r.Id).ToList();

            var participations = await _context.RaffleParticipants.CountAsync(p => ids.Contains(p.RaffleId));
            var winners = await _context.RaffleWinners.CountAsync(w => ids.Contains(w.RaffleId) && !w.WasRerolled);

            return new RaffleStatistics
            {
                TotalRaffles = raffles.Count,
                CompletedRaffles = raffles.Count(r => r.Status == "completed"),
                ActiveRaffles = raffles.Count(r => r.Status == "open"),
                TotalParticipations = participations,
                TotalWinners = winners
            };
        }

        public async Task<RaffleStatistics> GetRaffleStatisticsAsync(int raffleId)
        {
            var raffle = await GetByIdAsync(raffleId);
            if (raffle == null) throw new KeyNotFoundException($"Sorteo {raffleId} no encontrado");

            return new RaffleStatistics
            {
                TotalRaffles = 1,
                CompletedRaffles = raffle.Status == "completed" ? 1 : 0,
                ActiveRaffles = raffle.Status == "open" ? 1 : 0,
                TotalParticipations = raffle.TotalParticipants,
                TotalWinners = raffle.Winners?.Count(w => !w.WasRerolled) ?? 0
            };
        }

        // ========================================================================
        // SESIONES DISPONIBLES
        // ========================================================================

        public async Task<List<TimerSessionInfo>> GetAvailableSessionsAsync(string channelName, int limit = 20)
        {
            var sessions = await _context.TimerSessions
                .Where(s => s.ChannelName == channelName.ToLower())
                .OrderByDescending(s => s.StartedAt)
                .Take(limit)
                .ToListAsync();

            var result = new List<TimerSessionInfo>();
            foreach (var s in sessions)
            {
                var eventCount = await _context.TimerEventLogs
                    .CountAsync(l => l.TimerSessionId == s.Id);

                var uniqueUsers = await _context.TimerEventLogs
                    .Where(l => l.TimerSessionId == s.Id)
                    .Select(l => l.Username.ToLower())
                    .Distinct()
                    .CountAsync();

                result.Add(new TimerSessionInfo
                {
                    Id = s.Id,
                    StartedAt = s.StartedAt,
                    EndedAt = s.EndedAt,
                    InitialDuration = s.InitialDuration,
                    TotalAddedTime = s.TotalAddedTime,
                    IsActive = s.EndedAt == null,
                    TotalEvents = eventCount,
                    UniqueParticipants = uniqueUsers
                });
            }

            return result;
        }

        // ========================================================================
        // IMPORTACIÓN MEJORADA
        // ========================================================================

        public async Task<ImportSessionResult> ImportParticipantsFromSessionAsync(int raffleId, ImportSessionRequest request)
        {
            var raffle = await GetByIdAsync(raffleId);
            if (raffle == null) throw new KeyNotFoundException("Sorteo no encontrado");
            if (raffle.Status != "open") throw new InvalidOperationException("El sorteo debe estar abierto para importar");

            // Configuración del raffle
            var raffleConfig = ParseRaffleConfig(raffle.ConfigJson);

            // Determinar sesiones a importar
            List<int> sessionIds;
            if (request.SessionIds != null && request.SessionIds.Count > 0)
            {
                // Merge de múltiples sesiones
                sessionIds = request.SessionIds;
            }
            else if (request.SessionId.HasValue)
            {
                // Sesión específica por ID
                sessionIds = new List<int> { request.SessionId.Value };
            }
            else
            {
                // Auto: última sesión que tenga eventos registrados
                var session = await _context.TimerSessions
                    .Where(s => s.ChannelName == raffle.ChannelName
                             && _context.TimerEventLogs.Any(l => l.TimerSessionId == s.Id))
                    .OrderByDescending(s => s.StartedAt)
                    .FirstOrDefaultAsync();

                if (session == null)
                    return new ImportSessionResult { ImportedCount = 0, SkippedDuplicates = 0, Message = "No hay sesiones con eventos para importar" };

                sessionIds = new List<int> { session.Id };
            }

            // Validar que las sesiones pertenecen al canal
            var validSessions = await _context.TimerSessions
                .Where(s => sessionIds.Contains(s.Id) && s.ChannelName == raffle.ChannelName)
                .Select(s => s.Id)
                .ToListAsync();

            if (validSessions.Count == 0)
                return new ImportSessionResult { ImportedCount = 0, Message = "No se encontraron sesiones válidas para este canal" };

            // Protección anti-duplicados: verificar sesiones ya importadas
            var importedSessionIds = GetImportedSessionIds(raffleConfig);
            var newSessionIds = validSessions.Where(id => !importedSessionIds.Contains(id)).ToList();

            if (newSessionIds.Count == 0 && !request.ForceReimport)
            {
                return new ImportSessionResult
                {
                    ImportedCount = 0,
                    SkippedDuplicates = 0,
                    Message = "Todas las sesiones seleccionadas ya fueron importadas. Usa forceReimport=true para reimportar.",
                    AlreadyImportedSessionIds = validSessions
                };
            }

            var sessionsToImport = request.ForceReimport ? validSessions : newSessionIds;

            // Configuración de filtros (del request o del raffle config)
            bool bitsEnabled = request.Methods?.BitsEnabled ?? raffleConfig.BitsEnabled;
            bool subsEnabled = request.Methods?.SubsEnabled ?? raffleConfig.SubsEnabled;
            bool giftSubsEnabled = request.Methods?.GiftSubsEnabled ?? raffleConfig.GiftSubsEnabled;
            bool followsEnabled = request.Methods?.FollowsEnabled ?? raffleConfig.FollowsEnabled;
            int minBits = request.Methods?.MinBits ?? raffleConfig.MinBits;
            int minGifts = request.Methods?.MinGifts ?? raffleConfig.MinGifts;
            bool weightByContribution = request.Methods?.WeightByContribution ?? raffleConfig.WeightByContribution;
            List<string>? allowedSubTiers = request.Methods?.AllowedSubTiers ?? raffleConfig.AllowedSubTiers;

            // Exclusiones (Mods/VIPs/Broadcaster)
            var excludedUsers = await BuildExclusionListAsync(raffle, raffleConfig);

            // Cooldown de ganadores recientes
            var cooldownDays = request.WinnerCooldownDays ?? raffleConfig.WinnerCooldownDays;
            if (cooldownDays > 0)
            {
                var recentWinners = await GetRecentWinnerUsernamesAsync(raffle.ChannelName, cooldownDays);
                foreach (var rw in recentWinners) excludedUsers.Add(rw);
            }

            // Obtener todos los logs de las sesiones
            var logs = await _context.TimerEventLogs
                .Where(l => sessionsToImport.Contains(l.TimerSessionId ?? 0))
                .ToListAsync();

            // Filtrar y ponderar
            var candidates = new Dictionary<string, CandidateInfo>();

            foreach (var log in logs)
            {
                string user = log.Username.ToLower();
                if (string.IsNullOrWhiteSpace(user)) continue;
                if (excludedUsers.Contains(user)) continue;

                string type = log.EventType.ToLower();
                int tickets = 0;
                string entryType = "";

                if (bitsEnabled && (type.Contains("bits") || type.Contains("cheer")))
                {
                    int bitsAmount = ExtractAmount(log.EventData, "bits", log.Details);
                    if (bitsAmount < minBits && minBits > 0) continue;

                    tickets = weightByContribution ? Math.Max(1, bitsAmount / 100) : 1;
                    entryType = "bits";
                }
                else if (subsEnabled && (type == "subscribe" || type == "sub" || type.Contains("tier")))
                {
                    if (allowedSubTiers != null && allowedSubTiers.Count > 0)
                    {
                        string tier = ExtractSubTier(type, log.EventData);
                        if (!allowedSubTiers.Contains(tier)) continue;
                    }

                    int tierMultiplier = weightByContribution ? GetSubTierMultiplier(type, log.EventData) : 1;
                    tickets = tierMultiplier;
                    entryType = "subscription";
                }
                else if (giftSubsEnabled && (type.Contains("gift") || type.Contains("regalo")))
                {
                    int giftCount = ExtractAmount(log.EventData, "gifts", log.Details);
                    if (giftCount < minGifts && minGifts > 0) continue;

                    tickets = weightByContribution ? Math.Max(1, giftCount) : 1;
                    entryType = "gift_sub";
                }
                else if (followsEnabled && type == "follow")
                {
                    tickets = 1;
                    entryType = "follow";
                }

                if (tickets > 0)
                {
                    if (candidates.ContainsKey(user))
                    {
                        candidates[user].Tickets += tickets;
                        if (!candidates[user].EntryTypes.Contains(entryType))
                            candidates[user].EntryTypes.Add(entryType);
                    }
                    else
                    {
                        candidates[user] = new CandidateInfo
                        {
                            Tickets = tickets,
                            EntryTypes = new List<string> { entryType }
                        };
                    }
                }
            }

            // Insertar participantes (sin duplicados con los existentes)
            var existingUsernames = await _context.RaffleParticipants
                .Where(p => p.RaffleId == raffleId)
                .Select(p => p.Username)
                .ToListAsync();
            var existingSet = new HashSet<string>(existingUsernames);

            int importedCount = 0;
            int skippedDuplicates = 0;
            int updatedTickets = 0;

            foreach (var c in candidates)
            {
                if (existingSet.Contains(c.Key))
                {
                    if (request.MergeTickets)
                    {
                        // Sumar tickets al participante existente
                        var existingParticipant = await _context.RaffleParticipants
                            .FirstOrDefaultAsync(p => p.RaffleId == raffleId && p.Username == c.Key);
                        if (existingParticipant != null)
                        {
                            var oldTickets = existingParticipant.Tickets;
                            existingParticipant.Tickets += c.Value.Tickets;
                            raffle.TotalTickets += c.Value.Tickets;
                            updatedTickets++;
                        }
                    }
                    else
                    {
                        skippedDuplicates++;
                    }
                    continue;
                }

                _context.RaffleParticipants.Add(new RaffleParticipant
                {
                    RaffleId = raffleId,
                    Username = c.Key,
                    Tickets = c.Value.Tickets,
                    EntryMethod = "automatic",
                    MetadataJson = JsonSerializer.Serialize(new { sessionIds = sessionsToImport, entryTypes = c.Value.EntryTypes }),
                    JoinedAt = DateTime.UtcNow
                });
                raffle.TotalParticipants++;
                raffle.TotalTickets += c.Value.Tickets;
                importedCount++;
            }

            // Registrar sesiones importadas en el config
            TrackImportedSessions(raffle, sessionsToImport);

            if (importedCount > 0 || updatedTickets > 0)
            {
                raffle.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            return new ImportSessionResult
            {
                ImportedCount = importedCount,
                SkippedDuplicates = skippedDuplicates,
                UpdatedTickets = updatedTickets,
                ImportedSessionIds = sessionsToImport,
                Message = $"Se importaron {importedCount} participantes de {sessionsToImport.Count} sesión(es). " +
                          (skippedDuplicates > 0 ? $"{skippedDuplicates} duplicados omitidos. " : "") +
                          (updatedTickets > 0 ? $"{updatedTickets} participantes actualizaron tickets." : "")
            };
        }

        // ========================================================================
        // PRIVATE HELPER METHODS
        // ========================================================================

        private void ValidateRaffle(Raffle raffle)
        {
            if (string.IsNullOrWhiteSpace(raffle.Name)) throw new ArgumentException("Nombre requerido");
            if (raffle.WinnersCount < 1 || raffle.WinnersCount > 100) throw new ArgumentException("Ganadores entre 1 y 100");
        }

        /// <summary>
        /// Selección aleatoria criptográficamente segura (probabilidad uniforme)
        /// </summary>
        private RaffleParticipant RandomSelection(List<RaffleParticipant> participants, HashSet<int> excludedIds)
        {
            var eligible = participants.Where(p => !excludedIds.Contains(p.Id)).ToList();
            return eligible[CryptoRandomInt(eligible.Count)];
        }

        /// <summary>
        /// Selección ponderada criptográficamente segura (por tickets)
        /// </summary>
        private RaffleParticipant WeightedRandomSelection(List<RaffleParticipant> participants, HashSet<int> excludedIds)
        {
            var eligible = participants.Where(p => !excludedIds.Contains(p.Id)).ToList();
            int totalWeight = eligible.Sum(p => p.Tickets);
            int target = CryptoRandomInt(totalWeight);
            int cumulative = 0;

            foreach (var p in eligible)
            {
                cumulative += p.Tickets;
                if (target < cumulative) return p;
            }

            return eligible[^1];
        }

        /// <summary>
        /// Genera un entero aleatorio criptográficamente seguro en [0, maxExclusive)
        /// </summary>
        private static int CryptoRandomInt(int maxExclusive)
        {
            if (maxExclusive <= 1) return 0;
            return RandomNumberGenerator.GetInt32(maxExclusive);
        }

        /// <summary>
        /// Obtiene usernames de ganadores recientes del canal
        /// </summary>
        private async Task<HashSet<string>> GetRecentWinnerUsernamesAsync(string channelName, int cooldownDays)
        {
            var cutoff = DateTime.UtcNow.AddDays(-cooldownDays);
            var recentWinners = await _context.RaffleWinners
                .Include(w => w.Raffle)
                .Where(w => w.Raffle.ChannelName == channelName.ToLower()
                         && !w.WasRerolled
                         && w.WonAt >= cutoff)
                .Select(w => w.Username.ToLower())
                .Distinct()
                .ToListAsync();

            return new HashSet<string>(recentWinners);
        }

        private int GetCooldownDays(Raffle raffle)
        {
            return ParseRaffleConfig(raffle.ConfigJson).WinnerCooldownDays;
        }

        private RaffleConfigParsed ParseRaffleConfig(string? configJson)
        {
            var result = new RaffleConfigParsed();
            if (string.IsNullOrEmpty(configJson)) return result;

            try
            {
                var config = JsonSerializer.Deserialize<JsonElement>(configJson);

                if (config.TryGetProperty("winnerCooldownDays", out var cd))
                    result.WinnerCooldownDays = cd.GetInt32();

                if (config.TryGetProperty("methods", out var methods))
                {
                    if (methods.TryGetProperty("bits", out var bits))
                    {
                        if (bits.TryGetProperty("enabled", out var e)) result.BitsEnabled = e.GetBoolean();
                        if (bits.TryGetProperty("minAmount", out var m)) result.MinBits = m.GetInt32();
                    }
                    if (methods.TryGetProperty("subscription", out var sub))
                    {
                        if (sub.TryGetProperty("enabled", out var e)) result.SubsEnabled = e.GetBoolean();
                        if (sub.TryGetProperty("allowedTiers", out var tiers))
                        {
                            result.AllowedSubTiers = new List<string>();
                            foreach (var t in tiers.EnumerateArray())
                                result.AllowedSubTiers.Add(t.GetString() ?? "");
                        }
                    }
                    if (methods.TryGetProperty("giftSubscription", out var gift))
                    {
                        if (gift.TryGetProperty("enabled", out var e)) result.GiftSubsEnabled = e.GetBoolean();
                        if (gift.TryGetProperty("minAmount", out var m)) result.MinGifts = m.GetInt32();
                    }
                    if (methods.TryGetProperty("follow", out var follow))
                    {
                        if (follow.TryGetProperty("enabled", out var e)) result.FollowsEnabled = e.GetBoolean();
                    }
                    if (methods.TryGetProperty("weightByContribution", out var wbc))
                        result.WeightByContribution = wbc.GetBoolean();
                }

                if (config.TryGetProperty("requirements", out var req))
                {
                    if (req.TryGetProperty("excludeMods", out var em)) result.ExcludeMods = em.GetBoolean();
                    if (req.TryGetProperty("excludeVips", out var ev)) result.ExcludeVips = ev.GetBoolean();
                    if (req.TryGetProperty("excludeBroadcaster", out var eb)) result.ExcludeBroadcaster = eb.GetBoolean();
                }

                if (config.TryGetProperty("importedSessionIds", out var imported))
                {
                    foreach (var id in imported.EnumerateArray())
                        result.ImportedSessionIds.Add(id.GetInt32());
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error parseando config del raffle");
            }

            return result;
        }

        private HashSet<int> GetImportedSessionIds(RaffleConfigParsed config)
        {
            return config.ImportedSessionIds;
        }

        private void TrackImportedSessions(Raffle raffle, List<int> sessionIds)
        {
            try
            {
                var config = string.IsNullOrEmpty(raffle.ConfigJson)
                    ? new Dictionary<string, JsonElement>()
                    : JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(raffle.ConfigJson) ?? new Dictionary<string, JsonElement>();

                var existing = new List<int>();
                if (config.TryGetValue("importedSessionIds", out var imported))
                {
                    foreach (var id in imported.EnumerateArray())
                        existing.Add(id.GetInt32());
                }

                existing.AddRange(sessionIds.Where(id => !existing.Contains(id)));

                var mutable = new Dictionary<string, object>();
                foreach (var kvp in config)
                {
                    if (kvp.Key != "importedSessionIds")
                        mutable[kvp.Key] = kvp.Value;
                }
                mutable["importedSessionIds"] = existing;
                mutable["lastImportAt"] = DateTime.UtcNow.ToString("O");

                raffle.ConfigJson = JsonSerializer.Serialize(mutable);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error registrando sesiones importadas");
            }
        }

        private async Task<HashSet<string>> BuildExclusionListAsync(Raffle raffle, RaffleConfigParsed config)
        {
            var excludedUsers = new HashSet<string>();

            if (config.ExcludeBroadcaster)
                excludedUsers.Add(raffle.ChannelName.ToLower());

            if (config.ExcludeMods || config.ExcludeVips)
            {
                var owner = await _context.Users.FirstOrDefaultAsync(u => u.Login == raffle.ChannelName);
                if (owner != null)
                {
                    var perms = await _context.UserChannelPermissions
                        .Include(p => p.GrantedUser)
                        .Where(p => p.ChannelOwnerId == owner.Id && p.IsActive)
                        .ToListAsync();

                    foreach (var p in perms)
                    {
                        if (config.ExcludeMods && p.AccessLevel == "moderator")
                            excludedUsers.Add(p.GrantedUser.Login.ToLower());
                        if (config.ExcludeVips && p.AccessLevel == "vip")
                            excludedUsers.Add(p.GrantedUser.Login.ToLower());
                    }
                }
            }

            return excludedUsers;
        }

        private int ExtractAmount(string? eventData, string field, string? details)
        {
            if (!string.IsNullOrEmpty(eventData))
            {
                try
                {
                    var data = JsonSerializer.Deserialize<JsonElement>(eventData);
                    if (data.TryGetProperty(field, out var val)) return val.GetInt32();
                    if (data.TryGetProperty("amount", out var amt)) return amt.GetInt32();
                    if (data.TryGetProperty("quantity", out var qty)) return qty.GetInt32();
                    if (data.TryGetProperty("count", out var cnt)) return cnt.GetInt32();
                }
                catch { }
            }

            // Intentar extraer número del details
            if (!string.IsNullOrEmpty(details))
            {
                var match = System.Text.RegularExpressions.Regex.Match(details, @"(\d+)");
                if (match.Success && int.TryParse(match.Groups[1].Value, out var num))
                    return num;
            }

            return 1;
        }

        private string ExtractSubTier(string eventType, string? eventData)
        {
            if (eventType.Contains("tier3") || eventType.Contains("3000")) return "tier3";
            if (eventType.Contains("tier2") || eventType.Contains("2000")) return "tier2";
            if (eventType.Contains("prime")) return "prime";

            if (!string.IsNullOrEmpty(eventData))
            {
                try
                {
                    var data = JsonSerializer.Deserialize<JsonElement>(eventData);
                    if (data.TryGetProperty("tier", out var tier))
                    {
                        var tierStr = tier.ToString().ToLower();
                        if (tierStr.Contains("3") || tierStr == "3000") return "tier3";
                        if (tierStr.Contains("2") || tierStr == "2000") return "tier2";
                        if (tierStr.Contains("prime")) return "prime";
                    }
                }
                catch { }
            }

            return "tier1";
        }

        private int GetSubTierMultiplier(string eventType, string? eventData)
        {
            var tier = ExtractSubTier(eventType, eventData);
            return tier switch
            {
                "tier3" => 4,
                "tier2" => 2,
                "prime" => 1,
                _ => 1
            };
        }
    }

    // ========================================================================
    // DTOs & Models
    // ========================================================================

    public class RaffleEligibilityResult
    {
        public bool IsEligible { get; set; }
        public string? Reason { get; set; }
    }

    public class RaffleStatistics
    {
        public int TotalRaffles { get; set; }
        public int CompletedRaffles { get; set; }
        public int ActiveRaffles { get; set; }
        public int TotalParticipations { get; set; }
        public int TotalWinners { get; set; }
    }

    public class TimerSessionInfo
    {
        public int Id { get; set; }
        public DateTime StartedAt { get; set; }
        public DateTime? EndedAt { get; set; }
        public int InitialDuration { get; set; }
        public int TotalAddedTime { get; set; }
        public bool IsActive { get; set; }
        public int TotalEvents { get; set; }
        public int UniqueParticipants { get; set; }
    }

    public class ImportSessionRequest
    {
        /// <summary>Sesión específica por ID (null = auto-detectar última)</summary>
        public int? SessionId { get; set; }

        /// <summary>Múltiples sesiones para merge</summary>
        public List<int>? SessionIds { get; set; }

        /// <summary>Forzar reimportar sesiones ya importadas</summary>
        public bool ForceReimport { get; set; } = false;

        /// <summary>Si un usuario ya existe, sumar tickets de la nueva sesión</summary>
        public bool MergeTickets { get; set; } = false;

        /// <summary>Override de métodos de entrada (null = usar config del raffle)</summary>
        public ImportMethodsOverride? Methods { get; set; }

        /// <summary>Override de cooldown de ganadores (null = usar config del raffle)</summary>
        public int? WinnerCooldownDays { get; set; }
    }

    public class ImportMethodsOverride
    {
        public bool? BitsEnabled { get; set; }
        public bool? SubsEnabled { get; set; }
        public bool? GiftSubsEnabled { get; set; }
        public bool? FollowsEnabled { get; set; }
        public int? MinBits { get; set; }
        public int? MinGifts { get; set; }
        public bool? WeightByContribution { get; set; }
        public List<string>? AllowedSubTiers { get; set; }
    }

    public class ImportSessionResult
    {
        public int ImportedCount { get; set; }
        public int SkippedDuplicates { get; set; }
        public int UpdatedTickets { get; set; }
        public string Message { get; set; } = "";
        public List<int>? ImportedSessionIds { get; set; }
        public List<int>? AlreadyImportedSessionIds { get; set; }
    }

    internal class RaffleConfigParsed
    {
        public bool BitsEnabled { get; set; } = true;
        public bool SubsEnabled { get; set; } = true;
        public bool GiftSubsEnabled { get; set; } = true;
        public bool FollowsEnabled { get; set; } = true;
        public int MinBits { get; set; } = 0;
        public int MinGifts { get; set; } = 0;
        public bool WeightByContribution { get; set; } = false;
        public List<string>? AllowedSubTiers { get; set; }
        public bool ExcludeMods { get; set; } = true;
        public bool ExcludeVips { get; set; } = true;
        public bool ExcludeBroadcaster { get; set; } = true;
        public int WinnerCooldownDays { get; set; } = 0;
        public HashSet<int> ImportedSessionIds { get; set; } = new();
    }

    internal class CandidateInfo
    {
        public int Tickets { get; set; }
        public List<string> EntryTypes { get; set; } = new();
    }
}
