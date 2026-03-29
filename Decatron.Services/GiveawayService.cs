using Decatron.Core.Models;
using Decatron.Core.Interfaces;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace Decatron.Services
{
    public class GiveawayService
    {
        private readonly DecatronDbContext _context;
        private readonly ILogger<GiveawayService> _logger;
        private readonly OverlayNotificationService _overlayNotificationService;
        private readonly IMessageSender _messageSender;
        private readonly Random _random;

        public GiveawayService(
            DecatronDbContext context,
            ILogger<GiveawayService> logger,
            OverlayNotificationService overlayNotificationService,
            IMessageSender messageSender)
        {
            _context = context;
            _logger = logger;
            _overlayNotificationService = overlayNotificationService;
            _messageSender = messageSender;
            _random = new Random();
        }

        // ========================================================================
        // CONFIG METHODS
        // ========================================================================

        public async Task<GiveawayConfig?> GetConfig(string channelId)
        {
            return await _context.GiveawayConfigs
                .FirstOrDefaultAsync(c => c.ChannelId == channelId);
        }

        public async Task<GiveawayConfig> SaveConfig(string channelId, GiveawayConfig config)
        {
            // Asegurar que Requirements y Weights son strings JSON válidos
            if (string.IsNullOrWhiteSpace(config.Requirements))
            {
                config.Requirements = "{}";
            }
            if (string.IsNullOrWhiteSpace(config.Weights))
            {
                config.Weights = "{}";
            }

            var existing = await GetConfig(channelId);

            if (existing != null)
            {
                // Update existing
                existing.Name = config.Name;
                existing.PrizeName = config.PrizeName;
                existing.PrizeDescription = config.PrizeDescription;
                existing.DurationType = config.DurationType;
                existing.DurationMinutes = config.DurationMinutes;
                existing.MaxParticipants = config.MaxParticipants;
                existing.MaxParticipantsEnabled = config.MaxParticipantsEnabled;
                existing.AllowMultipleEntries = config.AllowMultipleEntries;
                existing.NumberOfWinners = config.NumberOfWinners;
                existing.HasBackupWinners = config.HasBackupWinners;
                existing.NumberOfBackupWinners = config.NumberOfBackupWinners;
                existing.EntryCommand = config.EntryCommand;
                existing.AllowAutoEntry = config.AllowAutoEntry;
                existing.Requirements = config.Requirements;
                existing.Weights = config.Weights;
                existing.WinnerCooldownEnabled = config.WinnerCooldownEnabled;
                existing.WinnerCooldownDays = config.WinnerCooldownDays;
                existing.AnnounceOnStart = config.AnnounceOnStart;
                existing.AnnounceReminders = config.AnnounceReminders;
                existing.ReminderIntervalMinutes = config.ReminderIntervalMinutes;
                existing.AnnounceParticipantCount = config.AnnounceParticipantCount;
                existing.StartMessage = config.StartMessage;
                existing.ReminderMessage = config.ReminderMessage;
                existing.WinnerMessage = config.WinnerMessage;
                existing.NoResponseMessage = config.NoResponseMessage;
                existing.WinnerResponseTimeout = config.WinnerResponseTimeout;
                existing.AutoRerollOnTimeout = config.AutoRerollOnTimeout;
                existing.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                return existing;
            }
            else
            {
                // Create new
                config.ChannelId = channelId;
                config.CreatedAt = DateTime.UtcNow;
                config.UpdatedAt = DateTime.UtcNow;

                _context.GiveawayConfigs.Add(config);
                await _context.SaveChangesAsync();
                return config;
            }
        }

        // ========================================================================
        // SESSION METHODS
        // ========================================================================

        public async Task<GiveawaySession?> GetActiveSession(string channelId)
        {
            // Buscar sesión activa, en proceso de selección, o recién finalizada (últimos 30 segundos)
            var now = DateTime.UtcNow;
            var recentThreshold = now.AddSeconds(-30);

            var session = await _context.GiveawaySessions
                .Where(s => s.ChannelId == channelId)
                .Where(s => s.Status == "active"
                    || s.Status == "selecting_winners"
                    || (s.Status == "completed" && s.EndedAt >= recentThreshold)
                    || (s.Status == "cancelled" && s.EndedAt >= recentThreshold))
                .OrderByDescending(s => s.UpdatedAt)
                .FirstOrDefaultAsync();

            _logger.LogWarning($"[DEBUG] GetActiveSession para ChannelId={channelId}: {(session != null ? $"Encontrada (ID={session.Id}, Status={session.Status})" : "No encontrada")}");

            return session;
        }

        public async Task<GiveawaySession> StartGiveaway(string channelId, GiveawayConfig config)
        {
            _logger.LogWarning($"[DEBUG] StartGiveaway llamado con ChannelId={channelId}, ConfigName={config.Name}, EntryCommand={config.EntryCommand}");

            // Check if there's already an active giveaway
            var active = await GetActiveSession(channelId);
            if (active != null)
            {
                _logger.LogError($"[DEBUG] Ya existe sesión activa: ID={active.Id}, Status={active.Status}");
                throw new InvalidOperationException("Ya hay un giveaway activo");
            }

            // Log config timeout antes de guardar
            _logger.LogInformation($"[START GIVEAWAY] WinnerResponseTimeout configurado: {config.WinnerResponseTimeout} segundos");

            // Create new session
            var session = new GiveawaySession
            {
                ChannelId = channelId,
                ConfigId = config.Id,
                Name = config.Name,
                PrizeName = config.PrizeName,
                PrizeDescription = config.PrizeDescription,
                ConfigSnapshot = JsonSerializer.Serialize(config),
                Status = "active",
                StartedAt = DateTime.UtcNow,
                EndsAt = config.DurationType == "timed"
                    ? DateTime.UtcNow.AddMinutes(config.DurationMinutes)
                    : null,
                TotalParticipants = 0,
                TotalWeight = 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.GiveawaySessions.Add(session);
            await _context.SaveChangesAsync();

            _logger.LogWarning($"[DEBUG] Sesión creada exitosamente: ID={session.Id}, ChannelId={session.ChannelId}, Status={session.Status}, EntryCommand en config={config.EntryCommand}");

            // Anunciar en el chat si está habilitado
            if (config.AnnounceOnStart)
            {
                var channelName = await GetChannelNameFromId(channelId);
                if (!string.IsNullOrEmpty(channelName))
                {
                    var message = ProcessMessageVariables(config.StartMessage, config, session, 0);
                    await _messageSender.SendMessageAsync(channelName, message);
                    _logger.LogInformation($"📢 Anuncio de inicio enviado al chat de {channelName}");
                }
            }

            return session;
        }

        public async Task<GiveawaySession> EndGiveaway(string channelId)
        {
            var session = await GetActiveSession(channelId);
            if (session == null)
            {
                throw new InvalidOperationException("No hay giveaway activo");
            }

            // Get config from snapshot
            var config = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);
            if (config == null)
            {
                throw new InvalidOperationException("Config snapshot inválido");
            }

            try
            {
                // Select winners
                await SelectWinners(session, config);

                // IMPORTANTE: Mantener status="active" para que el frontend siga viendo el giveaway
                // El background service lo cambiará a "completed" cuando se resuelvan los timeouts
                session.Status = "selecting_winners"; // Nuevo estado intermedio
                session.EndedAt = DateTime.UtcNow; // Marca cuando se finalizó
                session.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                _logger.LogInformation($"Giveaway finalizó selección de ganadores en canal {channelId}: {session.Name}");

                // Anunciar ganadores en el chat
                var channelName = await GetChannelNameFromId(channelId);
                if (!string.IsNullOrEmpty(channelName))
                {
                    var winners = await _context.GiveawayWinners
                        .Where(w => w.SessionId == session.Id && !w.IsBackup)
                        .OrderBy(w => w.Position)
                        .ToListAsync();

                    foreach (var winner in winners)
                    {
                        var participant = await _context.GiveawayParticipants
                            .FirstOrDefaultAsync(p => p.Id == winner.ParticipantId);

                        if (participant != null)
                        {
                            var message = ProcessMessageVariables(config.WinnerMessage, config, session, session.TotalParticipants, participant.Username);
                            await _messageSender.SendMessageAsync(channelName, message);
                            _logger.LogInformation($"📢 Anuncio de ganador enviado: {participant.Username}");
                        }
                    }
                }

                return session;
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("No hay participantes"))
            {
                // Si no hay participantes válidos, cancelar el giveaway
                _logger.LogWarning($"⚠️ Giveaway sin participantes válidos. Cancelando automáticamente: {ex.Message}");

                session.Status = "cancelled";
                session.CancelReason = ex.Message;
                session.EndedAt = DateTime.UtcNow;
                session.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                // Anunciar en el chat
                var channelName = await GetChannelNameFromId(channelId);
                if (!string.IsNullOrEmpty(channelName))
                {
                    await _messageSender.SendMessageAsync(channelName,
                        $"❌ El giveaway ha sido cancelado: {ex.Message}");
                }

                return session;
            }
        }

        public async Task<GiveawaySession> CancelGiveaway(string channelId, string? reason)
        {
            var session = await GetActiveSession(channelId);
            if (session == null)
            {
                throw new InvalidOperationException("No hay giveaway activo");
            }

            session.Status = "cancelled";
            session.CancelReason = reason;
            session.EndedAt = DateTime.UtcNow;
            session.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation($"Giveaway cancelado en canal {channelId}: {session.Name}");

            return session;
        }

        // ========================================================================
        // PARTICIPANT METHODS
        // ========================================================================

        public async Task<GiveawayParticipant?> AddParticipant(
            string channelId,
            string userId,
            string username,
            string displayName,
            Dictionary<string, object> userMetadata,
            string? ipAddress = null)
        {
            var session = await GetActiveSession(channelId);
            if (session == null)
            {
                return null; // No active giveaway
            }

            var config = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);
            if (config == null)
            {
                return null;
            }

            // Check if max participants reached
            if (config.MaxParticipantsEnabled && session.TotalParticipants >= config.MaxParticipants)
            {
                _logger.LogWarning($"Máximo de participantes alcanzado en giveaway {session.Id}");
                return null;
            }

            // Check if user already participated
            var existing = await _context.GiveawayParticipants
                .FirstOrDefaultAsync(p => p.SessionId == session.Id && p.UserId == userId);

            if (existing != null)
            {
                if (!config.AllowMultipleEntries)
                {
                    return null; // Already participated
                }

                // Increment entry count
                existing.EntryCount++;
                existing.CalculatedWeight = CalculateWeight(existing, config);
                await _context.SaveChangesAsync();

                // Update session weight
                await RecalculateSessionWeight(session.Id);

                return existing;
            }

            // Check cooldown FIRST (antes de validar requisitos)
            if (config.WinnerCooldownEnabled)
            {
                var now = DateTime.UtcNow;
                var isInCooldown = await _context.GiveawayWinnerCooldowns
                    .AnyAsync(c => c.ChannelId == channelId && c.UserId == userId && c.CooldownUntil > now);

                if (isInCooldown)
                {
                    var cooldown = await _context.GiveawayWinnerCooldowns
                        .Where(c => c.ChannelId == channelId && c.UserId == userId && c.CooldownUntil > now)
                        .OrderByDescending(c => c.CooldownUntil)
                        .FirstOrDefaultAsync();

                    _logger.LogWarning($"Usuario {username} está en cooldown hasta {cooldown?.CooldownUntil}");
                    return null;
                }
            }

            // Validate requirements
            var requirements = JsonSerializer.Deserialize<JsonElement>(config.Requirements);
            if (requirements.ValueKind == JsonValueKind.Null || requirements.ValueKind == JsonValueKind.Undefined)
            {
                _logger.LogWarning($"Requirements inválidos en config {config.Id}");
                return null;
            }

            if (!await ValidateRequirements(userId, username, userMetadata, requirements, channelId))
            {
                _logger.LogInformation($"Usuario {username} no cumple los requisitos del giveaway");
                return null;
            }

            // Anti-cheat: Check IP duplication (si está habilitado)
            if (requirements.TryGetProperty("checkIpDuplication", out var checkIpDup) && checkIpDup.GetBoolean())
            {
                if (!string.IsNullOrEmpty(ipAddress))
                {
                    var ipHash = HashIp(ipAddress);
                    var duplicateIp = await _context.GiveawayParticipants
                        .AnyAsync(p => p.SessionId == session.Id && p.IpHash == ipHash && p.UserId != userId);

                    if (duplicateIp)
                    {
                        _logger.LogWarning($"[ANTI-CHEAT] Usuario {username} rechazado: IP duplicada detectada");
                        return null;
                    }
                }
            }

            // Anti-cheat: Block multiple accounts (detección por patrón de comportamiento)
            if (requirements.TryGetProperty("blockMultipleAccounts", out var blockMulti) && blockMulti.GetBoolean())
            {
                // Verificar si hay participantes con características sospechosamente similares:
                // - Cuenta creada en fechas muy cercanas
                // - Mismo patrón de follow (siguió al canal en fechas muy cercanas)
                // - Mismo nivel de actividad (watch time/mensajes muy similares)

                var accountCreatedAt = GetNullableDateTime(userMetadata, "accountCreatedAt");
                var followedAt = GetNullableDateTime(userMetadata, "followedAt");

                if (accountCreatedAt.HasValue)
                {
                    var suspiciousParticipants = await _context.GiveawayParticipants
                        .Where(p => p.SessionId == session.Id && p.UserId != userId)
                        .Where(p => p.AccountCreatedAt.HasValue)
                        .ToListAsync();

                    foreach (var suspect in suspiciousParticipants)
                    {
                        // Cuentas creadas con menos de 1 día de diferencia
                        if (suspect.AccountCreatedAt.HasValue)
                        {
                            var timeDiff = Math.Abs((accountCreatedAt.Value - suspect.AccountCreatedAt.Value).TotalDays);
                            if (timeDiff < 1)
                            {
                                _logger.LogWarning($"[ANTI-CHEAT] Usuario {username} rechazado: cuenta creada muy cerca de {suspect.Username} (diferencia: {timeDiff:F2} días)");
                                return null;
                            }
                        }

                        // Si ambos siguieron al canal con menos de 1 día de diferencia Y tienen cuentas nuevas (< 30 días)
                        if (followedAt.HasValue && suspect.FollowedAt.HasValue && accountCreatedAt.HasValue)
                        {
                            var accountAge = (DateTime.UtcNow - accountCreatedAt.Value).TotalDays;
                            var followDiff = Math.Abs((followedAt.Value - suspect.FollowedAt.Value).TotalDays);

                            if (accountAge < 30 && followDiff < 1)
                            {
                                _logger.LogWarning($"[ANTI-CHEAT] Usuario {username} rechazado: patrón de follow sospechoso con {suspect.Username}");
                                return null;
                            }
                        }
                    }
                }
            }

            // Create participant
            var participant = new GiveawayParticipant
            {
                SessionId = session.Id,
                UserId = userId,
                Username = username,
                DisplayName = displayName,
                IsFollower = GetBool(userMetadata, "isFollower"),
                IsSubscriber = GetBool(userMetadata, "isSubscriber"),
                SubscriptionTier = GetNullableByte(userMetadata, "subscriptionTier"),
                IsVip = GetBool(userMetadata, "isVip"),
                IsModerator = GetBool(userMetadata, "isModerator"),
                AccountCreatedAt = GetNullableDateTime(userMetadata, "accountCreatedAt"),
                FollowedAt = GetNullableDateTime(userMetadata, "followedAt"),
                WatchTimeMinutes = GetInt(userMetadata, "watchTimeMinutes"),
                ChatMessagesCount = GetInt(userMetadata, "chatMessagesCount"),
                BitsTotal = GetInt(userMetadata, "bitsTotal"),
                SubStreak = GetInt(userMetadata, "subStreak"),
                EnteredAt = DateTime.UtcNow,
                EntryCount = 1,
                CalculatedWeight = 1.0m, // Will be calculated next
                IpHash = !string.IsNullOrEmpty(ipAddress) ? HashIp(ipAddress) : null
            };

            // Calculate weight
            participant.CalculatedWeight = CalculateWeight(participant, config);

            _context.GiveawayParticipants.Add(participant);
            await _context.SaveChangesAsync();

            // Update session totals
            session.TotalParticipants++;
            await RecalculateSessionWeight(session.Id);

            _logger.LogInformation($"Participante añadido al giveaway {session.Id}: {username} (peso: {participant.CalculatedWeight})");

            // Notificar al overlay
            await _overlayNotificationService.SendGiveawayParticipantJoinedAsync(channelId, participant);

            // Anunciar en chat si está habilitado
            if (config.AnnounceParticipantCount)
            {
                var channelName = await GetChannelNameFromId(channelId);
                if (!string.IsNullOrEmpty(channelName))
                {
                    var message = $"✅ {username} se ha unido al giveaway! Total de participantes: {session.TotalParticipants}";
                    await _messageSender.SendMessageAsync(channelName, message);
                }
            }

            return participant;
        }

        // ========================================================================
        // WINNER SELECTION
        // ========================================================================

        private async Task SelectWinners(GiveawaySession session, GiveawayConfig config)
        {
            var participants = await _context.GiveawayParticipants
                .Where(p => p.SessionId == session.Id)
                .ToListAsync();

            if (participants.Count == 0)
            {
                _logger.LogWarning($"No hay participantes en el giveaway {session.Id}");
                throw new InvalidOperationException("No hay participantes en el giveaway");
            }

            // Remove participants on cooldown
            var validParticipants = await FilterCooldownParticipants(participants, config, session.ChannelId);

            if (validParticipants.Count == 0)
            {
                _logger.LogWarning($"No hay participantes válidos (todos en cooldown) en giveaway {session.Id}");
                throw new InvalidOperationException("No hay participantes válidos (todos están en cooldown o ya ganaron recientemente)");
            }

            // Select main winners
            var selectedWinners = new List<GiveawayParticipant>();
            var winnersToSelect = Math.Min(config.NumberOfWinners, validParticipants.Count);

            for (int i = 0; i < winnersToSelect; i++)
            {
                var winner = SelectRandomWeighted(validParticipants);
                if (winner != null)
                {
                    selectedWinners.Add(winner);
                    validParticipants.Remove(winner);

                    // Create winner record
                    var winnerRecord = new GiveawayWinner
                    {
                        SessionId = session.Id,
                        ParticipantId = winner.Id,
                        Position = i + 1,
                        IsBackup = false,
                        SelectedAt = DateTime.UtcNow
                    };

                    _context.GiveawayWinners.Add(winnerRecord);

                    // Add to cooldown
                    if (config.WinnerCooldownEnabled)
                    {
                        await AddWinnerCooldown(session.ChannelId, winner.UserId, winner.Username, config.WinnerCooldownDays, session.Id, config.PrizeName);
                    }
                }
            }

            // Select backup winners
            if (config.HasBackupWinners && validParticipants.Count > 0)
            {
                var backupsToSelect = Math.Min(config.NumberOfBackupWinners, validParticipants.Count);

                for (int i = 0; i < backupsToSelect; i++)
                {
                    var backup = SelectRandomWeighted(validParticipants);
                    if (backup != null)
                    {
                        validParticipants.Remove(backup);

                        var backupRecord = new GiveawayWinner
                        {
                            SessionId = session.Id,
                            ParticipantId = backup.Id,
                            Position = i + 1,
                            IsBackup = true,
                            SelectedAt = DateTime.UtcNow
                        };

                        _context.GiveawayWinners.Add(backupRecord);
                    }
                }
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation($"Ganadores seleccionados para giveaway {session.Id}: {selectedWinners.Count} principales, {config.NumberOfBackupWinners} respaldo");
        }

        private GiveawayParticipant? SelectRandomWeighted(List<GiveawayParticipant> participants)
        {
            if (participants.Count == 0)
                return null;

            var totalWeight = participants.Sum(p => (double)p.CalculatedWeight);
            var randomValue = _random.NextDouble() * totalWeight;

            double cumulative = 0;
            foreach (var participant in participants)
            {
                cumulative += (double)participant.CalculatedWeight;
                if (randomValue <= cumulative)
                {
                    return participant;
                }
            }

            return participants.Last();
        }

        public async Task<GiveawayWinner> RerollWinner(string channelId, int? position = null)
        {
            var session = await _context.GiveawaySessions
                .FirstOrDefaultAsync(s => s.ChannelId == channelId &&
                    (s.Status == "completed" || s.Status == "active" || s.Status == "selecting_winners"));

            if (session == null)
            {
                throw new InvalidOperationException("No hay giveaway activo o completado reciente");
            }

            var config = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);
            if (config == null)
            {
                throw new InvalidOperationException("Config snapshot inválido");
            }

            // Get all participants except current winners
            var currentWinnerIds = await _context.GiveawayWinners
                .Where(w => w.SessionId == session.Id && !w.IsBackup)
                .Select(w => w.ParticipantId)
                .ToListAsync();

            var validParticipants = await _context.GiveawayParticipants
                .Where(p => p.SessionId == session.Id && !currentWinnerIds.Contains(p.Id))
                .ToListAsync();

            validParticipants = await FilterCooldownParticipants(validParticipants, config, channelId);

            if (validParticipants.Count == 0)
            {
                throw new InvalidOperationException("No hay participantes disponibles para re-sorteo");
            }

            // Select new winner
            var newWinner = SelectRandomWeighted(validParticipants);
            if (newWinner == null)
            {
                throw new InvalidOperationException("Error al seleccionar nuevo ganador");
            }

            var newWinnerRecord = new GiveawayWinner
            {
                SessionId = session.Id,
                ParticipantId = newWinner.Id,
                Position = position ?? 1,
                IsBackup = false,
                SelectedAt = DateTime.UtcNow
            };

            _context.GiveawayWinners.Add(newWinnerRecord);

            // Add to cooldown
            if (config.WinnerCooldownEnabled)
            {
                await AddWinnerCooldown(channelId, newWinner.UserId, newWinner.Username, config.WinnerCooldownDays, session.Id, config.PrizeName);
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation($"Re-sorteo realizado en giveaway {session.Id}: {newWinner.Username}");

            return newWinnerRecord;
        }

        public async Task DisqualifyWinner(string channelId, string username, string? reason)
        {
            var session = await GetActiveSession(channelId);
            if (session == null)
            {
                var recentSession = await _context.GiveawaySessions
                    .Where(s => s.ChannelId == channelId
                        && (s.Status == "completed" || s.Status == "selecting_winners"))
                    .OrderByDescending(s => s.EndedAt)
                    .FirstOrDefaultAsync();

                session = recentSession ?? throw new InvalidOperationException("No hay giveaway activo o completado reciente");
            }

            var participant = await _context.GiveawayParticipants
                .FirstOrDefaultAsync(p => p.SessionId == session.Id && p.Username.ToLower() == username.ToLower());

            if (participant == null)
            {
                throw new InvalidOperationException($"Participante {username} no encontrado");
            }

            var winner = await _context.GiveawayWinners
                .FirstOrDefaultAsync(w => w.SessionId == session.Id && w.ParticipantId == participant.Id && !w.IsBackup);

            if (winner == null)
            {
                throw new InvalidOperationException($"{username} no es un ganador del giveaway");
            }

            winner.WasDisqualified = true;
            winner.DisqualificationReason = reason;
            winner.DisqualifiedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation($"Ganador descalificado en giveaway {session.Id}: {username}");
        }

        // ========================================================================
        // HISTORY & STATISTICS
        // ========================================================================

        public async Task<List<GiveawaySession>> GetHistory(string channelId, int limit = 50)
        {
            return await _context.GiveawaySessions
                .Where(s => s.ChannelId == channelId && (s.Status == "completed" || s.Status == "cancelled"))
                .OrderByDescending(s => s.StartedAt)
                .Take(limit)
                .ToListAsync();
        }

        public async Task<object> GetStatistics(string channelId)
        {
            var sessions = await _context.GiveawaySessions
                .Where(s => s.ChannelId == channelId && s.Status == "completed")
                .ToListAsync();

            var totalGiveaways = sessions.Count;
            var totalParticipations = sessions.Sum(s => s.TotalParticipants);
            var totalWinners = await _context.GiveawayWinners
                .Where(w => sessions.Select(s => s.Id).Contains(w.SessionId) && !w.IsBackup)
                .CountAsync();

            // Top winners
            var topWinners = await _context.GiveawayWinners
                .Where(w => sessions.Select(s => s.Id).Contains(w.SessionId) && !w.IsBackup)
                .Join(_context.GiveawayParticipants,
                    w => w.ParticipantId,
                    p => p.Id,
                    (w, p) => p.Username)
                .GroupBy(u => u)
                .Select(g => new { Username = g.Key, WinCount = g.Count() })
                .OrderByDescending(x => x.WinCount)
                .Take(10)
                .ToListAsync();

            return new
            {
                totalGiveaways,
                totalParticipations,
                totalWinners,
                averageParticipantsPerGiveaway = totalGiveaways > 0 ? (double)totalParticipations / totalGiveaways : 0,
                topWinners
            };
        }

        // ========================================================================
        // HELPER METHODS
        // ========================================================================

        private decimal CalculateWeight(GiveawayParticipant participant, GiveawayConfig config)
        {
            var weights = JsonSerializer.Deserialize<JsonElement>(config.Weights);
            if (weights.ValueKind == JsonValueKind.Null || weights.ValueKind == JsonValueKind.Undefined)
                return 1.0m;

            decimal weight = 1.0m;

            try
            {
                // Subscription tier multiplier
                if (participant.IsSubscriber && participant.SubscriptionTier.HasValue)
                {
                    switch (participant.SubscriptionTier.Value)
                    {
                        case 1:
                            weight *= weights.TryGetProperty("subTier1Multiplier", out var tier1) ? (decimal)tier1.GetDouble() : 1.0m;
                            break;
                        case 2:
                            weight *= weights.TryGetProperty("subTier2Multiplier", out var tier2) ? (decimal)tier2.GetDouble() : 1.0m;
                            break;
                        case 3:
                            weight *= weights.TryGetProperty("subTier3Multiplier", out var tier3) ? (decimal)tier3.GetDouble() : 1.0m;
                            break;
                    }
                }

                // VIP multiplier
                if (participant.IsVip)
                {
                    weight *= weights.TryGetProperty("vipMultiplier", out var vip) ? (decimal)vip.GetDouble() : 1.0m;
                }

                // Watch time multiplier
                if (weights.TryGetProperty("watchTimeEnabled", out var watchEnabled) && watchEnabled.GetBoolean() && participant.WatchTimeMinutes > 0)
                {
                    var hours = participant.WatchTimeMinutes / 60.0;
                    var multiplierPerHour = weights.TryGetProperty("watchTimeMultiplierPerHour", out var watchMult) ? (decimal)watchMult.GetDouble() : 1.0m;
                    weight *= (decimal)Math.Pow((double)multiplierPerHour, hours);
                }

                // Follow age multiplier
                if (weights.TryGetProperty("followAgeEnabled", out var followEnabled) && followEnabled.GetBoolean() && participant.FollowedAt.HasValue)
                {
                    var months = (DateTime.UtcNow - participant.FollowedAt.Value).TotalDays / 30.0;
                    var multiplierPerMonth = weights.TryGetProperty("followAgeMultiplierPerMonth", out var followMult) ? (decimal)followMult.GetDouble() : 1.0m;
                    weight *= (decimal)Math.Pow((double)multiplierPerMonth, months);
                }

                // Bits multiplier
                if (weights.TryGetProperty("bitsEnabled", out var bitsEnabled) && bitsEnabled.GetBoolean() && participant.BitsTotal > 0)
                {
                    var hundreds = participant.BitsTotal / 100.0;
                    var multiplierPer100 = weights.TryGetProperty("bitsMultiplierPer100", out var bitsMult) ? (decimal)bitsMult.GetDouble() : 1.0m;
                    weight *= (decimal)Math.Pow((double)multiplierPer100, hundreds);
                }

                // Sub streak multiplier
                if (weights.TryGetProperty("subStreakEnabled", out var streakEnabled) && streakEnabled.GetBoolean() && participant.SubStreak > 0)
                {
                    var multiplierPerMonth = weights.TryGetProperty("subStreakMultiplierPerMonth", out var streakMult) ? (decimal)streakMult.GetDouble() : 1.0m;
                    weight *= (decimal)Math.Pow((double)multiplierPerMonth, participant.SubStreak);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error calculating weight: {ex.Message}");
                return 1.0m;
            }

            return Math.Max(weight, 1.0m);
        }

        private async Task<bool> ValidateRequirements(
            string userId,
            string username,
            Dictionary<string, object> userMetadata,
            JsonElement requirements,
            string channelId)
        {
            try
            {
                _logger.LogWarning($"[DEBUG REQUIREMENTS] Validando requisitos para {username}. Metadata: isFollower={GetBool(userMetadata, "isFollower")}, isSubscriber={GetBool(userMetadata, "isSubscriber")}, isVip={GetBool(userMetadata, "isVip")}, isMod={GetBool(userMetadata, "isModerator")}");

                // Check whitelist (si está habilitado, SOLO permite usuarios en la lista)
                var useWhitelist = requirements.TryGetProperty("useWhitelist", out var uwl) && uwl.GetBoolean();
                if (useWhitelist)
                {
                    _logger.LogWarning($"[DEBUG REQUIREMENTS] useWhitelist=true. Verificando whitelist...");
                    var whitelistedUsers = new List<string>();
                    if (requirements.TryGetProperty("whitelistedUsers", out var wl) && wl.ValueKind == JsonValueKind.Array)
                    {
                        whitelistedUsers = JsonSerializer.Deserialize<List<string>>(wl.GetRawText()) ?? new List<string>();
                    }

                    var isInWhitelist = whitelistedUsers.Any(u => u.Equals(username, StringComparison.OrdinalIgnoreCase));
                    if (!isInWhitelist)
                    {
                        _logger.LogWarning($"[DEBUG REQUIREMENTS] {username} rechazado: NO está en whitelist");
                        return false;
                    }
                    _logger.LogWarning($"[DEBUG REQUIREMENTS] {username} está en whitelist - APROBADO");
                    return true; // Si está en whitelist, se acepta directamente
                }

                // Check blacklist (siempre se revisa)
                var isBlacklisted = await _context.GiveawayBlacklists
                    .AnyAsync(b => b.ChannelId == channelId && b.UserId == userId);

                if (isBlacklisted)
                {
                    _logger.LogWarning($"[DEBUG REQUIREMENTS] {username} rechazado: está en BLACKLIST");
                    return false;
                }

                // Check if VIPs are allowed
                var allowVips = !requirements.TryGetProperty("allowVips", out var av) || av.GetBoolean();
                if (!allowVips && GetBool(userMetadata, "isVip"))
                {
                    _logger.LogWarning($"[DEBUG REQUIREMENTS] {username} rechazado: es VIP pero VIPs no permitidos");
                    return false;
                }

                // Check if moderators are allowed
                var allowModerators = !requirements.TryGetProperty("allowModerators", out var am) || am.GetBoolean();
                if (!allowModerators && GetBool(userMetadata, "isModerator"))
                {
                    _logger.LogWarning($"[DEBUG REQUIREMENTS] {username} rechazado: es MOD pero MODs no permitidos");
                    return false;
                }

                // Must follow
                if (requirements.TryGetProperty("mustFollow", out var mustFollow) && mustFollow.GetBoolean())
                {
                    _logger.LogWarning($"[DEBUG REQUIREMENTS] mustFollow=true requerido. Usuario isFollower={GetBool(userMetadata, "isFollower")}");
                    if (!GetBool(userMetadata, "isFollower"))
                    {
                        _logger.LogWarning($"[DEBUG REQUIREMENTS] {username} rechazado: no es follower");
                        return false;
                    }
                }

                // Must subscribe
                if (requirements.TryGetProperty("mustSubscribe", out var mustSubscribe) && mustSubscribe.GetBoolean())
                {
                    _logger.LogWarning($"[DEBUG REQUIREMENTS] mustSubscribe=true requerido. Usuario isSubscriber={GetBool(userMetadata, "isSubscriber")}");
                    if (!GetBool(userMetadata, "isSubscriber"))
                    {
                        _logger.LogWarning($"[DEBUG REQUIREMENTS] {username} rechazado: no es subscriber");
                        return false;
                    }
                }

                // Minimum watch time
                if (requirements.TryGetProperty("minimumWatchTimeEnabled", out var minWatchEnabled) && minWatchEnabled.GetBoolean())
                {
                    var minWatchTime = requirements.TryGetProperty("minimumWatchTime", out var minWatch) ? minWatch.GetInt32() : 0;
                    var userWatchTime = GetInt(userMetadata, "watchTimeMinutes");
                    _logger.LogWarning($"[DEBUG REQUIREMENTS] minimumWatchTime={minWatchTime} requerido. Usuario watchTime={userWatchTime}");
                    if (userWatchTime < minWatchTime)
                    {
                        _logger.LogWarning($"[DEBUG REQUIREMENTS] {username} rechazado: watchTime insuficiente");
                        return false;
                    }
                }

                // Minimum account age
                if (requirements.TryGetProperty("minimumAccountAgeEnabled", out var minAcctAgeEnabled) && minAcctAgeEnabled.GetBoolean())
                {
                    var minAccountAge = requirements.TryGetProperty("minimumAccountAge", out var minAcctAge) ? minAcctAge.GetInt32() : 0;
                    var accountAgeUnit = requirements.TryGetProperty("minimumAccountAgeUnit", out var ageUnit) ? ageUnit.GetString() : "days";

                    // Convertir a días según la unidad
                    var minAccountAgeDays = ConvertTimeUnitToDays(minAccountAge, accountAgeUnit);

                    var accountCreatedAt = GetNullableDateTime(userMetadata, "accountCreatedAt");
                    if (accountCreatedAt.HasValue)
                    {
                        var accountAgeDays = (DateTime.UtcNow - accountCreatedAt.Value).TotalDays;
                        _logger.LogWarning($"[DEBUG REQUIREMENTS] minimumAccountAge={minAccountAge} {accountAgeUnit} ({minAccountAgeDays} días) requerido. Usuario accountAge={accountAgeDays:F1} días");
                        if (accountAgeDays < minAccountAgeDays)
                        {
                            _logger.LogWarning($"[DEBUG REQUIREMENTS] {username} rechazado: cuenta muy nueva");
                            return false;
                        }
                    }
                    else if (minAccountAge > 0)
                    {
                        _logger.LogWarning($"[DEBUG REQUIREMENTS] {username} rechazado: no tiene datos de account age");
                        return false;
                    }
                }

                // Minimum follow age
                if (requirements.TryGetProperty("minimumFollowAgeEnabled", out var minFollowAgeEnabled) && minFollowAgeEnabled.GetBoolean())
                {
                    var minFollowAge = requirements.TryGetProperty("minimumFollowAge", out var minFollow) ? minFollow.GetInt32() : 0;
                    var followAgeUnit = requirements.TryGetProperty("minimumFollowAgeUnit", out var fUnit) ? fUnit.GetString() : "days";

                    // Convertir a días según la unidad
                    var minFollowAgeDays = ConvertTimeUnitToDays(minFollowAge, followAgeUnit);

                    var followedAt = GetNullableDateTime(userMetadata, "followedAt");
                    if (followedAt.HasValue)
                    {
                        var followAgeDays = (DateTime.UtcNow - followedAt.Value).TotalDays;
                        _logger.LogWarning($"[DEBUG REQUIREMENTS] minimumFollowAge={minFollowAge} {followAgeUnit} ({minFollowAgeDays} días) requerido. Usuario followAge={followAgeDays:F1} días");
                        if (followAgeDays < minFollowAgeDays)
                        {
                            _logger.LogWarning($"[DEBUG REQUIREMENTS] {username} rechazado: follow muy reciente");
                            return false;
                        }
                    }
                    else if (minFollowAge > 0)
                    {
                        _logger.LogWarning($"[DEBUG REQUIREMENTS] {username} rechazado: no tiene datos de follow age");
                        return false;
                    }
                }

                // Minimum chat messages
                if (requirements.TryGetProperty("minimumChatMessagesEnabled", out var minMsgEnabled) && minMsgEnabled.GetBoolean())
                {
                    var minMessages = requirements.TryGetProperty("minimumChatMessages", out var minMsg) ? minMsg.GetInt32() : 0;
                    var userMessages = GetInt(userMetadata, "chatMessagesCount");
                    _logger.LogWarning($"[DEBUG REQUIREMENTS] minimumChatMessages={minMessages} requerido. Usuario messages={userMessages}");
                    if (userMessages < minMessages)
                    {
                        _logger.LogWarning($"[DEBUG REQUIREMENTS] {username} rechazado: mensajes insuficientes");
                        return false;
                    }
                }

                _logger.LogWarning($"[DEBUG REQUIREMENTS] {username} APROBADO - cumple todos los requisitos");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error validating requirements: {ex.Message}");
                return false;
            }
        }

        private async Task<List<GiveawayParticipant>> FilterCooldownParticipants(
            List<GiveawayParticipant> participants,
            GiveawayConfig config,
            string channelId)
        {
            if (!config.WinnerCooldownEnabled)
                return participants;

            var userIds = participants.Select(p => p.UserId).ToList();
            var now = DateTime.UtcNow;

            var cooldowns = await _context.GiveawayWinnerCooldowns
                .Where(c => c.ChannelId == channelId && userIds.Contains(c.UserId) && c.CooldownUntil > now)
                .Select(c => c.UserId)
                .ToListAsync();

            return participants.Where(p => !cooldowns.Contains(p.UserId)).ToList();
        }

        private async Task AddWinnerCooldown(string channelId, string userId, string username, int days, int sessionId, string prizeName)
        {
            var cooldown = new GiveawayWinnerCooldown
            {
                ChannelId = channelId,
                UserId = userId,
                Username = username,
                WonAt = DateTime.UtcNow,
                CooldownUntil = DateTime.UtcNow.AddDays(days),
                SessionId = sessionId,
                PrizeName = prizeName
            };

            _context.GiveawayWinnerCooldowns.Add(cooldown);
            await _context.SaveChangesAsync();
        }

        private async Task RecalculateSessionWeight(int sessionId)
        {
            var session = await _context.GiveawaySessions.FindAsync(sessionId);
            if (session == null)
                return;

            var totalWeight = await _context.GiveawayParticipants
                .Where(p => p.SessionId == sessionId)
                .SumAsync(p => p.CalculatedWeight);

            session.TotalWeight = totalWeight;
            session.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
        }

        /// <summary>
        /// Actualiza los bits donados por un participante durante un giveaway activo
        /// y recalcula su peso total
        /// </summary>
        public async Task<bool> UpdateParticipantBits(string channelId, string userId, int bitsAmount)
        {
            try
            {
                // Obtener giveaway activo
                var session = await GetActiveSession(channelId);
                if (session == null)
                {
                    _logger.LogDebug($"No hay giveaway activo para actualizar bits de {userId} en canal {channelId}");
                    return false;
                }

                // Buscar participante
                var participant = await _context.GiveawayParticipants
                    .FirstOrDefaultAsync(p => p.SessionId == session.Id && p.UserId == userId);

                if (participant == null)
                {
                    _logger.LogDebug($"Usuario {userId} no es participante del giveaway activo en {channelId}");
                    return false;
                }

                // Incrementar bits
                participant.BitsTotal += bitsAmount;
                // participant.UpdatedAt = DateTime.UtcNow;

                // Recalcular peso
                var config = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);
                if (config != null)
                {
                    participant.CalculatedWeight = CalculateWeight(participant, config);
                }

                await _context.SaveChangesAsync();

                // Recalcular peso total de la sesión
                await RecalculateSessionWeight(session.Id);

                _logger.LogInformation($"✅ Bits actualizados para {participant.Username}: +{bitsAmount} bits (Total: {participant.BitsTotal}, Nuevo peso: {participant.CalculatedWeight:F2})");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error actualizando bits para usuario {userId} en canal {channelId}");
                return false;
            }
        }

        private string HashIp(string ipAddress)
        {
            using (var sha256 = SHA256.Create())
            {
                var bytes = Encoding.UTF8.GetBytes(ipAddress);
                var hash = sha256.ComputeHash(bytes);
                return Convert.ToBase64String(hash);
            }
        }

        // Helper methods for metadata extraction
        private bool GetBool(Dictionary<string, object> dict, string key)
        {
            return dict.ContainsKey(key) && dict[key] is bool b && b;
        }

        private int GetInt(Dictionary<string, object> dict, string key)
        {
            return dict.ContainsKey(key) && dict[key] is int i ? i : 0;
        }

        private byte? GetNullableByte(Dictionary<string, object> dict, string key)
        {
            if (dict.ContainsKey(key) && dict[key] != null)
            {
                if (dict[key] is byte b)
                    return b;
                if (int.TryParse(dict[key].ToString(), out int result))
                    return (byte)result;
            }
            return null;
        }

        /// <summary>
        /// Convierte una cantidad de tiempo en una unidad específica a días
        /// </summary>
        /// <param name="amount">Cantidad de tiempo</param>
        /// <param name="unit">Unidad: "days", "months", "years"</param>
        /// <returns>Cantidad convertida a días</returns>
        private double ConvertTimeUnitToDays(int amount, string unit)
        {
            return unit?.ToLower() switch
            {
                "months" => amount * 30.0,  // 1 mes = 30 días
                "years" => amount * 365.0,  // 1 año = 365 días
                _ => amount                  // Default: días
            };
        }

        private DateTime? GetNullableDateTime(Dictionary<string, object> dict, string key)
        {
            if (dict.ContainsKey(key) && dict[key] is DateTime dt)
                return dt;
            return null;
        }

        // Helper para obtener el nombre del canal desde TwitchId
        private async Task<string?> GetChannelNameFromId(string channelId)
        {
            try
            {
                var user = await _context.Users
                    .AsNoTracking()
                    .FirstOrDefaultAsync(u => u.TwitchId == channelId);

                return user?.Login;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error obteniendo nombre de canal para ID {channelId}");
                return null;
            }
        }

        // Helper para procesar variables en mensajes
        private string ProcessMessageVariables(string message, GiveawayConfig config, GiveawaySession session, int participantCount, string? winnerName = null)
        {
            if (string.IsNullOrEmpty(message))
            {
                // Mensaje por defecto si no hay configurado
                if (!string.IsNullOrEmpty(winnerName))
                    return $"🎉 ¡Felicidades {winnerName}! Has ganado: {config.PrizeName}";
                else
                    return $"🎁 Giveaway iniciado! Participa escribiendo {config.EntryCommand} en el chat para ganar: {config.PrizeName}";
            }

            var processed = message;

            // Reemplazar variables
            processed = processed.Replace("{command}", config.EntryCommand ?? "!join");
            processed = processed.Replace("{prize}", config.PrizeName ?? "un premio");
            processed = processed.Replace("{count}", participantCount.ToString());
            processed = processed.Replace("{winner}", winnerName ?? "");
            processed = processed.Replace("{timeout}", config.WinnerResponseTimeout.ToString());

            return processed;
        }

        // ========================================================================
        // WINNER RESPONSE TRACKING
        // ========================================================================

        /// <summary>
        /// Marca a un ganador como que ha respondido
        /// </summary>
        public async Task<bool> MarkWinnerAsResponded(string channelId, string username, string responseMessage)
        {
            try
            {
                // Buscar sesión que está esperando respuestas de ganadores
                var session = await _context.GiveawaySessions
                    .Where(s => s.ChannelId == channelId
                        && (s.Status == "selecting_winners" || s.Status == "completed"))
                    .OrderByDescending(s => s.EndedAt)
                    .FirstOrDefaultAsync();

                if (session == null)
                {
                    _logger.LogDebug($"No hay sesión esperando respuestas para canal {channelId}");
                    return false;
                }

                // Buscar participante
                var usernameLower = username.ToLower();
                var participant = await _context.GiveawayParticipants
                    .FirstOrDefaultAsync(p => p.SessionId == session.Id
                        && p.Username.ToLower() == usernameLower);

                if (participant == null)
                {
                    _logger.LogDebug($"Participante {username} no encontrado en sesión {session.Id}");
                    return false;
                }

                // Buscar si es un ganador sin respuesta
                var winner = await _context.GiveawayWinners
                    .FirstOrDefaultAsync(w => w.SessionId == session.Id
                        && w.ParticipantId == participant.Id
                        && !w.IsBackup
                        && !w.HasResponded
                        && !w.WasDisqualified);

                if (winner == null)
                {
                    _logger.LogDebug($"{username} no es un ganador sin respuesta en sesión {session.Id}");
                    return false;
                }

                // Marcar como respondido
                winner.HasResponded = true;
                winner.RespondedAt = DateTime.UtcNow;
                winner.ResponseMessage = responseMessage;
                winner.TimeoutProcessed = true; // Para que el background service no lo procese

                await _context.SaveChangesAsync();

                _logger.LogInformation($"✅ Ganador {username} marcado como respondido en sesión {session.Id}");

                // Obtener nombre del canal para los anuncios
                var channelName = await GetChannelNameFromId(channelId);

                // Verificar si todos los ganadores han respondido
                var allWinners = await _context.GiveawayWinners
                    .Where(w => w.SessionId == session.Id && !w.IsBackup && !w.WasDisqualified)
                    .ToListAsync();

                var allResponded = allWinners.All(w => w.HasResponded);

                if (allResponded && session.Status == "selecting_winners")
                {
                    _logger.LogInformation($"🎉 Todos los ganadores respondieron. Marcando sesión {session.Id} como completed");

                    session.Status = "completed";
                    session.UpdatedAt = DateTime.UtcNow;

                    await _context.SaveChangesAsync();

                    // Anunciar en el chat
                    if (!string.IsNullOrEmpty(channelName))
                    {
                        await _messageSender.SendMessageAsync(channelName,
                            $"🎉 ¡Giveaway completado! Todos los ganadores respondieron correctamente.");
                    }
                }

                // Anunciar confirmación en el chat
                if (!string.IsNullOrEmpty(channelName))
                {
                    await _messageSender.SendMessageAsync(channelName,
                        $"✅ ¡Perfecto @{username}! Tu respuesta ha sido registrada. ¡Felicidades por tu premio!");
                }

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al marcar ganador como respondido: {username}");
                return false;
            }
        }
    }
}
