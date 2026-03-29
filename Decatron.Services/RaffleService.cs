using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
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
        Task<RaffleWinner> RerollWinnerAsync(int winnerId, string reason);
        Task<List<RaffleWinner>> GetWinnersAsync(int raffleId);
        Task ConfirmWinnerAsync(int winnerId);

        // Validation & Eligibility
        Task<bool> ValidateParticipantEligibilityAsync(int raffleId, string username, long? twitchUserId = null);
        Task<RaffleEligibilityResult> CheckEligibilityAsync(int raffleId, string username, long? twitchUserId = null);

        // Statistics
        Task<RaffleStatistics> GetStatisticsAsync(string channelName);
        Task<RaffleStatistics> GetRaffleStatisticsAsync(int raffleId);

        // Importación
        Task<int> ImportParticipantsFromSessionAsync(int raffleId);
    }

    public class RaffleService : IRaffleService
    {
        private readonly DecatronDbContext _context;
        private readonly ILogger<RaffleService> _logger;
        private readonly Random _random;

        public RaffleService(DecatronDbContext context, ILogger<RaffleService> logger)
        {
            _context = context;
            _logger = logger;
            _random = new Random();
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
        // WINNER MANAGEMENT
        // ========================================================================

        public async Task<List<RaffleWinner>> DrawWinnersAsync(int raffleId, bool weighted = false)
        {
            var raffle = await GetByIdAsync(raffleId);
            if (raffle == null) throw new KeyNotFoundException($"Sorteo {raffleId} no encontrado");
            if (raffle.Status != "closed") throw new InvalidOperationException("El sorteo debe estar cerrado antes de sortear");

            var participants = await GetParticipantsAsync(raffleId, includeDisqualified: false);
            if (participants.Count == 0) throw new InvalidOperationException("No hay participantes elegibles");

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

        public async Task<RaffleWinner> RerollWinnerAsync(int winnerId, string reason)
        {
            var winner = await _context.RaffleWinners.Include(w => w.Raffle).FirstOrDefaultAsync(w => w.Id == winnerId);
            if (winner == null) throw new KeyNotFoundException($"Ganador {winnerId} no encontrado");

            winner.WasRerolled = true;
            winner.RerollReason = reason;

            var allWinnerIds = await _context.RaffleWinners
                .Where(w => w.RaffleId == winner.RaffleId && !w.WasRerolled)
                .Select(w => w.ParticipantId)
                .ToListAsync();

            var eligible = await _context.RaffleParticipants
                .Where(p => p.RaffleId == winner.RaffleId && !p.IsDisqualified && !allWinnerIds.Contains(p.Id))
                .ToListAsync();

            if (eligible.Count == 0) throw new InvalidOperationException("No hay más participantes elegibles");

            var newWinnerPart = eligible[_random.Next(eligible.Count)];
            var newWinner = new RaffleWinner
            {
                RaffleId = winner.RaffleId,
                ParticipantId = newWinnerPart.Id,
                Username = newWinnerPart.Username,
                Position = winner.Position,
                WonAt = DateTime.UtcNow
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
        // IMPORTATION LOGIC
        // ========================================================================

        public async Task<int> ImportParticipantsFromSessionAsync(int raffleId)
        {
            var raffle = await GetByIdAsync(raffleId);
            if (raffle == null) throw new KeyNotFoundException("Sorteo no encontrado");
            if (raffle.Status != "open") throw new InvalidOperationException("El sorteo debe estar abierto para importar");

            // Configuración
            var config = JsonSerializer.Deserialize<JsonElement>(raffle.ConfigJson);
            
            bool bitsEnabled = true, subsEnabled = true, giftSubsEnabled = true, followsEnabled = true;
            int minBits = 100;

            try {
                if (config.TryGetProperty("methods", out var methods)) {
                    if (methods.TryGetProperty("bits", out var b)) {
                        if (b.TryGetProperty("enabled", out var e)) bitsEnabled = e.GetBoolean();
                        if (b.TryGetProperty("minAmount", out var m)) minBits = m.GetInt32();
                    }
                    if (methods.TryGetProperty("subscription", out var s)) {
                        if (s.TryGetProperty("enabled", out var e)) subsEnabled = e.GetBoolean();
                    }
                    if (methods.TryGetProperty("giftSubscription", out var g)) {
                        if (g.TryGetProperty("enabled", out var e)) giftSubsEnabled = e.GetBoolean();
                    }
                    if (methods.TryGetProperty("follow", out var f)) {
                        if (f.TryGetProperty("enabled", out var e)) followsEnabled = e.GetBoolean();
                    }
                }
            } catch { _logger.LogWarning("Error leyendo config"); }

            // Exclusiones (Mods/VIPs)
            var excludedUsers = new HashSet<string>();
            bool excludeMods = true, excludeVips = true, excludeBroadcaster = true;

            try {
                if (config.TryGetProperty("requirements", out var req)) {
                    if (req.TryGetProperty("excludeMods", out var em)) excludeMods = em.GetBoolean();
                    if (req.TryGetProperty("excludeVips", out var ev)) excludeVips = ev.GetBoolean();
                    if (req.TryGetProperty("excludeBroadcaster", out var eb)) excludeBroadcaster = eb.GetBoolean();
                }
            } catch { }

            if (excludeBroadcaster) excludedUsers.Add(raffle.ChannelName.ToLower());

            if (excludeMods || excludeVips)
            {
                var owner = await _context.Users.FirstOrDefaultAsync(u => u.Login == raffle.ChannelName);
                if (owner != null)
                {
                    var perms = await _context.UserChannelPermissions
                        .Include(p => p.GrantedUser)
                        .Where(p => p.ChannelOwnerId == owner.Id && p.IsActive)
                        .ToListAsync();
                    
                    foreach(var p in perms) {
                        if (excludeMods && p.AccessLevel == "moderator") excludedUsers.Add(p.GrantedUser.Login.ToLower());
                        if (excludeVips && p.AccessLevel == "vip") excludedUsers.Add(p.GrantedUser.Login.ToLower());
                    }
                }
            }

            // Obtener Sesión
            var lastSession = await _context.TimerSessions
                .Where(s => s.ChannelName == raffle.ChannelName)
                .OrderByDescending(s => s.StartedAt)
                .FirstOrDefaultAsync();

            if (lastSession == null) return 0;

            var logs = await _context.TimerEventLogs
                .Where(l => l.TimerSessionId == lastSession.Id)
                .ToListAsync();

            // Filtrar Logs
            var candidates = new Dictionary<string, int>();

            foreach (var log in logs)
            {
                string user = log.Username.ToLower();
                if (excludedUsers.Contains(user)) continue;

                string type = log.EventType.ToLower();
                int tickets = 0;

                if (bitsEnabled && (type.Contains("bits") || type.Contains("cheer"))) tickets = 1;
                else if (subsEnabled && (type == "subscribe" || type == "sub" || type.Contains("tier"))) tickets = 1;
                else if (giftSubsEnabled && (type.Contains("gift") || type.Contains("regalo"))) tickets = 1;
                else if (followsEnabled && type == "follow") tickets = 1;

                if (tickets > 0)
                {
                    if (candidates.ContainsKey(user)) candidates[user] += tickets;
                    else candidates[user] = tickets;
                }
            }

            // Insertar
            int count = 0;
            var existing = await _context.RaffleParticipants.Where(p => p.RaffleId == raffleId).Select(p => p.Username).ToListAsync();
            var existingSet = new HashSet<string>(existing);

            foreach (var c in candidates)
            {
                if (!existingSet.Contains(c.Key))
                {
                    _context.RaffleParticipants.Add(new RaffleParticipant
                    {
                        RaffleId = raffleId,
                        Username = c.Key,
                        Tickets = c.Value,
                        EntryMethod = "automatic",
                        JoinedAt = DateTime.UtcNow
                    });
                    raffle.TotalParticipants++;
                    raffle.TotalTickets += c.Value;
                    count++;
                }
            }

            if (count > 0)
            {
                raffle.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            return count;
        }

        // ========================================================================
        // PRIVATE HELPER METHODS
        // ========================================================================

        private void ValidateRaffle(Raffle raffle)
        {
            if (string.IsNullOrWhiteSpace(raffle.Name)) throw new ArgumentException("Nombre requerido");
            if (raffle.WinnersCount < 1 || raffle.WinnersCount > 100) throw new ArgumentException("Ganadores entre 1 y 100");
        }

        private RaffleParticipant WeightedRandomSelection(List<RaffleParticipant> participants, HashSet<int> excludedIds)
        {
            var eligible = participants.Where(p => !excludedIds.Contains(p.Id)).ToList();
            var weighted = new List<RaffleParticipant>();
            foreach (var p in eligible)
            {
                for (int i = 0; i < p.Tickets; i++) weighted.Add(p);
            }
            return weighted[_random.Next(weighted.Count)];
        }

        private RaffleParticipant RandomSelection(List<RaffleParticipant> participants, HashSet<int> excludedIds)
        {
            var eligible = participants.Where(p => !excludedIds.Contains(p.Id)).ToList();
            return eligible[_random.Next(eligible.Count)];
        }
    }

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
}
