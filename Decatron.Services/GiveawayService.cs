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
        private readonly Accounts.AccountChannelResolver _accountResolver;
        private readonly GiveawayOverlayService _overlay;
        private readonly Random _random;

        public GiveawayService(
            DecatronDbContext context,
            ILogger<GiveawayService> logger,
            OverlayNotificationService overlayNotificationService,
            IMessageSender messageSender,
            Accounts.AccountChannelResolver accountResolver,
            GiveawayOverlayService overlay)
        {
            _accountResolver = accountResolver;
            _overlay = overlay;
            _context = context;
            _logger = logger;
            _overlayNotificationService = overlayNotificationService;
            _messageSender = messageSender;
            _random = new Random();
        }

        // ========================================================================
        // MENSAJES CONFIGURABLES
        // ========================================================================

        /// <summary>
        /// Anuncio del bot en el chat del canal de Twitch y, si el streamer tiene Kick vinculado y Kick está activo en
        /// su giveaway, también en el de Kick. Todo anuncio del módulo pasa por aquí.
        /// </summary>
        public async Task AnnounceAsync(string channelName, string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return;
            await _messageSender.SendMessageAsync(channelName, text);
            try
            {
                var kickChatId = await KickChatIdAsync(channelName);
                if (kickChatId != null) await _messageSender.SendMessageAsync(kickChatId, text);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo anunciar el giveaway en el chat de Kick de {Channel}", channelName);
            }
        }

        /// <summary>Avisa al overlay de OBS del estado actual del giveaway (solo emite si cambió).</summary>
        private Task PublishOverlayAsync(string channelId) => _overlay.PublishIfChangedAsync(channelId);

        /// <summary>Respuesta a un viewer: solo en el chat de la plataforma desde la que escribió.</summary>
        public async Task ReplyAsync(string channelName, string platform, string text)
        {
            if (platform == "kick")
            {
                var resolved = await _accountResolver.ResolveLoginAsync(channelName);
                var kickId = resolved?.Account.KickId;
                if (kickId != null) await _messageSender.SendMessageAsync(kickId, text);
                return;
            }
            await AnnounceAsync(channelName, text);
        }

        /// <summary>Dónde se anuncia: el chat de Twitch y, si aplica, el de Kick (resuelto de antemano para poder enviar más tarde).</summary>
        private async Task<(string Twitch, string? Kick)> ResolveAnnounceTargetsAsync(string channelName)
        {
            string? kick = null;
            try { kick = await KickChatIdAsync(channelName); }
            catch (Exception ex) { _logger.LogWarning(ex, "No se pudo resolver el chat de Kick de {Channel}", channelName); }
            return (channelName, kick);
        }

        private async Task SendToTargetsAsync((string Twitch, string? Kick) targets, string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return;
            await _messageSender.SendMessageAsync(targets.Twitch, text);
            if (targets.Kick != null)
            {
                try { await _messageSender.SendMessageAsync(targets.Kick, text); }
                catch (Exception ex) { _logger.LogWarning(ex, "No se pudo anunciar en el chat de Kick de {Channel}", targets.Twitch); }
            }
        }

        /// <summary>Id de chat de Kick de la cuenta del canal, solo si Kick está activo en su último giveaway.</summary>
        private async Task<string?> KickChatIdAsync(string channelName)
        {
            var resolved = await _accountResolver.ResolveLoginAsync(channelName);
            var account = resolved?.Account;
            var twitchId = account?.TwitchId;
            var kickId = account?.KickId;
            if (twitchId == null || kickId == null) return null;
            // Una fila con las dos plataformas se atiende con un solo envío: el router ya decide por la fila
            if (account!.Members.Any(m => m.TwitchId != null && m.KickId != null)) return null;

            var snapshot = await _context.GiveawaySessions.AsNoTracking()
                .Where(x => x.ChannelId == twitchId)
                .OrderByDescending(x => x.UpdatedAt)
                .Select(x => x.ConfigSnapshot)
                .FirstOrDefaultAsync();
            if (snapshot == null) return null;
            var cfg = JsonSerializer.Deserialize<GiveawayConfig>(snapshot);
            return GiveawaySettings.Parse(cfg?.Settings).Platforms.Kick ? kickId : null;
        }

        /// <summary>Texto configurado por el streamer, o el de por defecto, con las {variables} ya sustituidas.</summary>
        private static string Say(string? custom, string fallback, params (string Key, string Value)[] vars)
        {
            var text = string.IsNullOrWhiteSpace(custom) ? fallback : custom;
            foreach (var (key, value) in vars)
                text = text.Replace("{" + key + "}", value);
            return text;
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
                existing.Settings = string.IsNullOrWhiteSpace(config.Settings) ? "{}" : config.Settings;
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
                InvalidateCommandRules(channelId);
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

            // Solo un giveaway EN CURSO impide iniciar otro. GetActiveSession también devuelve el recién cancelado o completado
            // (30 s) para que el panel muestre el resultado, y eso no debe bloquear: tras cancelar se puede crear otro enseguida
            var active = await _context.GiveawaySessions
                .Where(s => s.ChannelId == channelId && (s.Status == "active" || s.Status == "selecting_winners"))
                .OrderByDescending(s => s.UpdatedAt)
                .FirstOrDefaultAsync();
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
            InvalidateEntryRules(session.ChannelId);
            await PublishOverlayAsync(channelId);

            _logger.LogWarning($"[DEBUG] Sesión creada exitosamente: ID={session.Id}, ChannelId={session.ChannelId}, Status={session.Status}, EntryCommand en config={config.EntryCommand}");

            // Anunciar en el chat si está habilitado
            if (config.AnnounceOnStart)
            {
                var channelName = await GetChannelNameFromId(channelId);
                if (!string.IsNullOrEmpty(channelName))
                {
                    var message = ProcessMessageVariables(config.StartMessage, config, session, 0);
                    await AnnounceAsync(channelName, message);
                    _logger.LogInformation($"📢 Anuncio de inicio enviado al chat de {channelName}");
                }
            }

            return session;
        }

        // Canales con ganadores esperando respuesta (canal -> hasta cuándo mirar el chat). Evita
        // consultar la base por cada mensaje de chat de canales sin giveaway pendiente.
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, DateTime> _pendingWinnerChannels = new();

        // Reglas de entrada del giveaway activo por canal (comando de entrada y entrada automática),
        // con caché corta para no consultar la base en cada mensaje del chat.
        public record EntryRules(int SessionId, string Command, bool AutoEntry, GiveawayPlatformRules Platforms);
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, (DateTime At, EntryRules? Rules)> _entryRulesCache = new();
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, DateTime> _autoEntryAttempts = new();

        public async Task<EntryRules?> GetEntryRules(string channelId)
        {
            if (_entryRulesCache.TryGetValue(channelId, out var cached) && (DateTime.UtcNow - cached.At).TotalSeconds < 15)
                return cached.Rules;

            EntryRules? rules = null;
            var session = await _context.GiveawaySessions.AsNoTracking()
                .Where(s => s.ChannelId == channelId && !s.EntriesClosed && (s.Status == "active" || s.Status == "selecting_winners"))
                .OrderByDescending(s => s.UpdatedAt)
                .FirstOrDefaultAsync();
            if (session != null)
            {
                var config = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);
                if (config != null)
                {
                    var cmd = (config.EntryCommand ?? "!join").Trim().ToLower();
                    if (cmd.Length == 0) cmd = "!join";
                    if (!cmd.StartsWith("!")) cmd = "!" + cmd;
                    rules = new EntryRules(session.Id, cmd, config.AllowAutoEntry, GiveawaySettings.Parse(config.Settings).Platforms);
                }
            }
            _entryRulesCache[channelId] = (DateTime.UtcNow, rules);
            return rules;
        }

        public static void InvalidateEntryRules(string channelId) => _entryRulesCache.TryRemove(channelId, out _);

        // Entrada automática: un intento por usuario cada 60 s mientras no haya entrado; al entrar, no se repite.
        public static bool ShouldTryAutoEntry(int sessionId, string userId)
        {
            var key = $"{sessionId}:{userId}";
            var now = DateTime.UtcNow;
            if (_autoEntryAttempts.TryGetValue(key, out var until) && until > now) return false;
            _autoEntryAttempts[key] = now.AddSeconds(60);
            if (_autoEntryAttempts.Count > 20000)
                foreach (var k in _autoEntryAttempts.Where(kv => kv.Value < now).Select(kv => kv.Key).ToList())
                    _autoEntryAttempts.TryRemove(k, out _);
            return true;
        }

        public Task<bool> IsParticipant(int sessionId, string userId, string platform = "twitch") =>
            _context.GiveawayParticipants.AsNoTracking().AnyAsync(p => p.SessionId == sessionId && p.Platform == platform && p.UserId == userId);

        public static void MarkAutoEntered(int sessionId, string userId) =>
            _autoEntryAttempts[$"{sessionId}:{userId}"] = DateTime.MaxValue;

        public static bool HasPendingWinners(string channelId) =>
            _pendingWinnerChannels.TryGetValue(channelId, out var until) && until > DateTime.UtcNow;

        public async Task<GiveawaySession> EndGiveaway(string channelId, string? forcedWinnerUsername = null)
        {
            var session = await GetActiveSession(channelId);
            if (session == null)
            {
                throw new InvalidOperationException("No hay giveaway activo");
            }
            // Un sorteo ya hecho (o cancelado) no se vuelve a sortear: antes un segundo «Finalizar» elegía ganadores otra vez
            if (session.Status != "active")
            {
                throw new InvalidOperationException("El giveaway ya fue sorteado");
            }

            // Get config from snapshot
            var config = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);
            if (config == null)
            {
                throw new InvalidOperationException("Config snapshot inválido");
            }

            try
            {
                // Con el overlay de OBS conectado hay un revelado (la ruleta) antes de que el ganador aparezca. El plazo para
                // responder y el anuncio en el chat empiezan cuando termina, no al sortear: si no, el ganador se entera con
                // el contador ya andando (con 60 s, en 52). Sin overlay conectado no hay revelado ni espera.
                var appearance = await _overlay.LoadAppearanceAsync(channelId);
                var overlayKey = await _overlay.OverlayKeyAsync(channelId);
                var overlayConnected = overlayKey != null && Decatron.Hubs.OverlayHub.CountOverlays(overlayKey, "giveaway") > 0;
                var revealDelay = overlayConnected ? Math.Max(0, appearance.RevealSeconds) : 0;

                // Select winners
                var drawnNow = await SelectWinners(session, config, revealDelay, forcedWinnerUsername);

                // IMPORTANTE: Mantener status="active" para que el frontend siga viendo el giveaway
                // El background service lo cambiará a "completed" cuando se resuelvan los timeouts
                session.Status = "selecting_winners"; // Nuevo estado intermedio
                // Opción del streamer: por defecto la participación sigue abierta hasta «close»
                if (!GiveawaySettings.Parse(config.Settings).Draw.KeepEntriesOpen) session.EntriesClosed = true;
            InvalidateEntryRules(session.ChannelId);
                session.EndedAt = DateTime.UtcNow; // Marca cuando se finalizó
                session.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                var responseWindow = TimeSpan.FromSeconds(Math.Max(60, config.WinnerResponseTimeout) * (config.NumberOfWinners + config.NumberOfBackupWinners + 1));
                _pendingWinnerChannels[channelId] = DateTime.UtcNow + responseWindow;
                await PublishOverlayAsync(channelId);

                _logger.LogInformation($"Giveaway finalizó selección de ganadores en canal {channelId}: {session.Name}");

                // Anunciar ganadores en el chat
                var channelName = await GetChannelNameFromId(channelId);
                if (!string.IsNullOrEmpty(channelName))
                {
                    var winners = drawnNow.OrderBy(w => w.Position).ToList();

                    var winnerMessages = new List<(string Text, string User)>();
                    foreach (var winner in winners)
                    {
                        var participant = await _context.GiveawayParticipants
                            .FirstOrDefaultAsync(p => p.Id == winner.ParticipantId);

                        if (participant != null)
                            winnerMessages.Add((ProcessMessageVariables(config.WinnerMessage, config, session, session.TotalParticipants, participant.Username), participant.Username));
                    }

                    if (revealDelay <= 0)
                    {
                        foreach (var (text, user) in winnerMessages)
                        {
                            await AnnounceAsync(channelName, text);
                            _logger.LogInformation($"📢 Anuncio de ganador enviado: {user}");
                        }
                    }
                    else
                    {
                        // Se anuncia cuando la ruleta termina y el overlay muestra al ganador. Los destinos se resuelven ahora
                        // porque el contexto de la base se cierra con esta petición
                        var targets = await ResolveAnnounceTargetsAsync(channelName);
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                await Task.Delay(TimeSpan.FromSeconds(revealDelay));
                                foreach (var (text, user) in winnerMessages)
                                {
                                    await SendToTargetsAsync(targets, text);
                                    _logger.LogInformation($"📢 Anuncio de ganador enviado tras el revelado: {user}");
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, "Error anunciando a los ganadores del giveaway {SessionId} tras el revelado", session.Id);
                            }
                        });
                    }
                }

                return session;
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("No hay participantes"))
            {
                // Si no hay participantes válidos, cancelar el giveaway
                _logger.LogWarning($"⚠️ Giveaway sin participantes válidos. Cancelando automáticamente: {ex.Message}");

                session.Status = "cancelled";
            InvalidateEntryRules(session.ChannelId);
                session.CancelReason = ex.Message;
                session.EndedAt = DateTime.UtcNow;
                session.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                await PublishOverlayAsync(channelId);

                // Anunciar en el chat
                var channelName = await GetChannelNameFromId(channelId);
                if (!string.IsNullOrEmpty(channelName))
                {
                    var gs = GiveawaySettings.Parse(config.Settings);
                    await AnnounceAsync(channelName,
                        Say(gs.Messages.NoParticipants, GiveawayMessages.DefaultNoParticipants, ("reason", ex.Message), ("prize", config.PrizeName ?? "")));
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
            InvalidateEntryRules(session.ChannelId);
            session.CancelReason = reason;
            session.EndedAt = DateTime.UtcNow;
            session.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation($"Giveaway cancelado en canal {channelId}: {session.Name}");
            await PublishOverlayAsync(channelId);

            // Antes no se avisaba al chat: se mantiene así salvo que el streamer escriba un mensaje de cancelación
            try
            {
                var cfg = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);
                var gs = GiveawaySettings.Parse(cfg?.Settings);
                if (!string.IsNullOrWhiteSpace(gs.Messages.Cancelled))
                {
                    var channelName = await GetChannelNameFromId(channelId);
                    if (!string.IsNullOrEmpty(channelName))
                        await AnnounceAsync(channelName,
                            Say(gs.Messages.Cancelled, GiveawayMessages.DefaultCancelled, ("reason", reason ?? ""), ("prize", cfg?.PrizeName ?? "")));
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error avisando la cancelación del giveaway {SessionId}", session.Id);
            }

            return session;
        }

        // ========================================================================
        // PARTICIPANT METHODS
        // ========================================================================

        // Resultado de intentar entrar: o hay participante, o hay un código con el motivo del rechazo
        public record EntryResult(GiveawayParticipant? Participant, string? Reason)
        {
            public bool Joined => Participant != null;
            public static EntryResult Ok(GiveawayParticipant p) => new(p, null);
            public static EntryResult Rejected(string reason) => new(null, reason);
        }

        /// <summary>Rechazo reciente, para mostrarlo en el panel (en memoria: solo el sorteo en curso).</summary>
        public record RejectionEntry(DateTime At, string Username, string Reason, string Text);

        private static readonly System.Collections.Concurrent.ConcurrentDictionary<int, System.Collections.Concurrent.ConcurrentQueue<RejectionEntry>> _rejections = new();
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, DateTime> _rejectionReplies = new();
        private const int MaxRejectionsPerSession = 200;

        /// <summary>Últimos rechazos del giveaway activo del canal, el más reciente primero.</summary>
        public async Task<List<RejectionEntry>> GetRecentRejections(string channelId, int limit = 50)
        {
            var session = await GetActiveSession(channelId);
            if (session == null || !_rejections.TryGetValue(session.Id, out var queue)) return new List<RejectionEntry>();
            return queue.Reverse().Take(limit).ToList();
        }

        public async Task<EntryResult> AddParticipant(
            string channelId,
            string userId,
            string username,
            string displayName,
            Dictionary<string, object> userMetadata,
            string? ipAddress = null,
            string platform = "twitch")
        {
            var result = await AddParticipantCore(channelId, userId, username, displayName, userMetadata, ipAddress, platform);
            if (!result.Joined && result.Reason is not (null or "already_entered" or "no_active_giveaway"))
                await RecordRejectionAsync(channelId, userId, username, result.Reason, platform);
            return result;
        }

        private async Task RecordRejectionAsync(string channelId, string userId, string username, string reason, string platform = "twitch")
        {
            try
            {
                var session = await GetActiveSession(channelId);
                if (session == null) return;
                var config = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);
                var gs = GiveawaySettings.Parse(config?.Settings);
                var text = Say(gs.Rejections.TextFor(reason), "", ("user", username), ("prize", config?.PrizeName ?? ""), ("command", config?.EntryCommand ?? ""), ("count", session.TotalParticipants.ToString()));

                var queue = _rejections.GetOrAdd(session.Id, _ => new System.Collections.Concurrent.ConcurrentQueue<RejectionEntry>());
                queue.Enqueue(new RejectionEntry(DateTime.UtcNow, username, reason, text));
                while (queue.Count > MaxRejectionsPerSession) queue.TryDequeue(out _);

                // Respuesta en el chat (opcional): una vez por persona y motivo cada 2 minutos, para no llenar el chat
                if (gs.Rejections.AnnounceInChat && !string.IsNullOrWhiteSpace(text))
                {
                    var key = $"{session.Id}:{userId}:{reason}";
                    var now = DateTime.UtcNow;
                    if (!_rejectionReplies.TryGetValue(key, out var last) || now - last > TimeSpan.FromMinutes(2))
                    {
                        _rejectionReplies[key] = now;
                        if (_rejectionReplies.Count > 20000)
                            foreach (var k in _rejectionReplies.Where(kv => now - kv.Value > TimeSpan.FromHours(1)).Select(kv => kv.Key).ToList())
                                _rejectionReplies.TryRemove(k, out _);
                        var channelName = await GetChannelNameFromId(channelId);
                        if (!string.IsNullOrEmpty(channelName))
                            await ReplyAsync(channelName, platform, text);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error registrando el rechazo de {User} en el giveaway", username);
            }
        }

        private async Task<EntryResult> AddParticipantCore(
            string channelId,
            string userId,
            string username,
            string displayName,
            Dictionary<string, object> userMetadata,
            string? ipAddress = null,
            string platform = "twitch")
        {
            var session = await GetActiveSession(channelId);
            if (session == null || !EntriesOpen(session))
            {
                return EntryResult.Rejected("no_active_giveaway");
            }

            var config = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);
            if (config == null)
            {
                return EntryResult.Rejected("invalid_config");
            }

            // Dónde se puede participar (opción del streamer): una plataforma apagada no entra
            var gsEntry = GiveawaySettings.Parse(config.Settings);
            if (!gsEntry.Platforms.IsEnabled(platform))
                return EntryResult.Rejected("platform_disabled");

            // Check if max participants reached
            if (config.MaxParticipantsEnabled && session.TotalParticipants >= config.MaxParticipants)
            {
                _logger.LogInformation($"Máximo de participantes alcanzado en giveaway {session.Id}");
                return EntryResult.Rejected("full");
            }

            // Check if user already participated
            var existing = await _context.GiveawayParticipants
                .FirstOrDefaultAsync(p => p.SessionId == session.Id && p.Platform == platform && p.UserId == userId);

            if (existing != null)
            {
                if (!config.AllowMultipleEntries)
                {
                    return EntryResult.Rejected("already_entered");
                }

                // Increment entry count
                existing.EntryCount++;
                existing.CalculatedWeight = CalculateWeight(existing, config);
                await _context.SaveChangesAsync();

                // Update session weight
                await RecalculateSessionWeight(session.Id);

                return EntryResult.Ok(existing);
            }

            // Check cooldown FIRST (antes de validar requisitos)
            if (config.WinnerCooldownEnabled)
            {
                var now = DateTime.UtcNow;
                var isInCooldown = await _context.GiveawayWinnerCooldowns
                    .AnyAsync(c => c.ChannelId == channelId && c.Platform == platform && c.UserId == userId && c.CooldownUntil > now);

                if (isInCooldown)
                {
                    var cooldown = await _context.GiveawayWinnerCooldowns
                        .Where(c => c.ChannelId == channelId && c.Platform == platform && c.UserId == userId && c.CooldownUntil > now)
                        .OrderByDescending(c => c.CooldownUntil)
                        .FirstOrDefaultAsync();

                    _logger.LogInformation($"Usuario {username} está en cooldown hasta {cooldown?.CooldownUntil}");
                    return EntryResult.Rejected("cooldown");
                }
            }

            // Roles según las opciones del streamer: el Lead Moderator puede contar (o no) como moderador
            var roleRules = GiveawaySettings.Parse(config.Settings).Roles;
            if (roleRules.LeadModCountsAsMod && GetBool(userMetadata, "isLeadModerator"))
                userMetadata["isModerator"] = true;
            if (!roleRules.StreamerCanJoin && GetBool(userMetadata, "isBroadcaster"))
                return EntryResult.Rejected("streamer_not_allowed");

            // Validate requirements
            var requirements = JsonSerializer.Deserialize<JsonElement>(config.Requirements);
            if (requirements.ValueKind == JsonValueKind.Null || requirements.ValueKind == JsonValueKind.Undefined)
            {
                _logger.LogWarning($"Requirements inválidos en config {config.Id}");
                return EntryResult.Rejected("invalid_config");
            }

            var requirementFailure = await ValidateRequirements(userId, username, userMetadata, requirements, channelId, platform, gsEntry.Platforms);
            if (requirementFailure != null)
            {
                _logger.LogInformation($"Usuario {username} no cumple los requisitos del giveaway: {requirementFailure}");
                return EntryResult.Rejected(requirementFailure);
            }

            // Anti-cheat: Check IP duplication (si está habilitado)
            if (requirements.TryGetProperty("checkIpDuplication", out var checkIpDup) && checkIpDup.GetBoolean())
            {
                if (!string.IsNullOrEmpty(ipAddress))
                {
                    var ipHash = HashIp(ipAddress);
                    var duplicateIp = await _context.GiveawayParticipants
                        .AnyAsync(p => p.SessionId == session.Id && p.IpHash == ipHash && !(p.Platform == platform && p.UserId == userId));

                    if (duplicateIp)
                    {
                        _logger.LogWarning($"[ANTI-CHEAT] Usuario {username} rechazado: IP duplicada detectada");
                        return EntryResult.Rejected("duplicate_ip");
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
                var multi = GiveawaySettings.Parse(config.Settings).MultiAccount;

                if (accountCreatedAt.HasValue)
                {
                    var suspiciousParticipants = await _context.GiveawayParticipants
                        .Where(p => p.SessionId == session.Id && !(p.Platform == platform && p.UserId == userId))
                        .Where(p => p.AccountCreatedAt.HasValue)
                        .ToListAsync();

                    foreach (var suspect in suspiciousParticipants)
                    {
                        // Cuentas creadas con menos de 1 día de diferencia
                        if (suspect.AccountCreatedAt.HasValue)
                        {
                            var timeDiff = Math.Abs((accountCreatedAt.Value - suspect.AccountCreatedAt.Value).TotalDays);
                            if (timeDiff < multi.SameCreationDays)
                            {
                                _logger.LogWarning($"[ANTI-CHEAT] Usuario {username} rechazado: cuenta creada muy cerca de {suspect.Username} (diferencia: {timeDiff:F2} días)");
                                return EntryResult.Rejected("multi_account");
                            }
                        }

                        // Si ambos siguieron al canal con menos de 1 día de diferencia Y tienen cuentas nuevas (< 30 días)
                        if (followedAt.HasValue && suspect.FollowedAt.HasValue && accountCreatedAt.HasValue)
                        {
                            var accountAge = (DateTime.UtcNow - accountCreatedAt.Value).TotalDays;
                            var followDiff = Math.Abs((followedAt.Value - suspect.FollowedAt.Value).TotalDays);

                            if (accountAge < multi.NewAccountDays && followDiff < multi.SameFollowDays)
                            {
                                _logger.LogWarning($"[ANTI-CHEAT] Usuario {username} rechazado: patrón de follow sospechoso con {suspect.Username}");
                                return EntryResult.Rejected("multi_account");
                            }
                        }
                    }
                }
            }

            // Create participant
            var participant = new GiveawayParticipant
            {
                SessionId = session.Id,
                Platform = platform,
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
            await _overlayNotificationService.SendGiveawayParticipantJoinedAsync(await _overlay.OverlayKeyAsync(channelId) ?? channelId,
                new { participant.Username, participant.DisplayName, participant.Platform, participant.CalculatedWeight, participant.EnteredAt });
            await PublishOverlayAsync(channelId);

            // Anunciar en chat si está habilitado
            if (config.AnnounceParticipantCount)
            {
                var channelName = await GetChannelNameFromId(channelId);
                if (!string.IsNullOrEmpty(channelName))
                {
                    var message = Say(GiveawaySettings.Parse(config.Settings).Messages.Joined, GiveawayMessages.DefaultJoined,
                        ("user", username), ("count", session.TotalParticipants.ToString()), ("prize", config.PrizeName ?? ""), ("command", config.EntryCommand ?? ""));
                    await AnnounceAsync(channelName, message);
                }
            }

            return EntryResult.Ok(participant);
        }

        // ========================================================================
        // WINNER SELECTION
        // ========================================================================

        private static DrawWinnerRow ToRow(GiveawayWinner w) =>
            new(w.Position, w.ParticipantId, w.IsBackup, w.HasResponded, w.TimeoutProcessed, w.WasDisqualified);

        /// <summary>
        /// Elige ganadores para los lugares libres del sorteo (todos, o uno solo en modo «uno por uno»). Respeta las reglas de
        /// validación del streamer: quien está pendiente, confirmado o descartado no vuelve a salir si así lo configuró.
        /// Devuelve los ganadores NUEVOS (los respaldos se crean aparte y no se devuelven).
        /// </summary>
        private async Task<List<GiveawayWinner>> SelectWinners(GiveawaySession session, GiveawayConfig config, int revealDelaySeconds = 0,
            string? forcedWinnerUsername = null, bool allowBackups = true)
        {
            var rules = GiveawaySettings.Parse(config.Settings).Draw;
            var participants = await _context.GiveawayParticipants
                .Where(p => p.SessionId == session.Id)
                .ToListAsync();

            if (participants.Count == 0)
            {
                _logger.LogWarning($"No hay participantes en el giveaway {session.Id}");
                throw new InvalidOperationException("No hay participantes en el giveaway");
            }

            var existing = await _context.GiveawayWinners.Where(w => w.SessionId == session.Id).ToListAsync();
            var existingRows = existing.Select(ToRow).ToList();
            var positions = GiveawayDrawPlan.PositionsToDraw(existingRows, config.NumberOfWinners, rules);
            if (positions.Count == 0) throw new InvalidOperationException("places_full");

            var excluded = GiveawayDrawPlan.Excluded(existingRows, rules);
            var eligible = participants.Where(p => !excluded.Contains(p.Id)).ToList();

            // Remove participants on cooldown
            var validParticipants = await FilterCooldownParticipants(eligible, config, session.ChannelId);

            // Elección a mano del streamer o un moderador: ocupa el primer lugar aunque esté en espera de cooldown, pero no
            // si ya es ganador pendiente o confirmado. Queda en la auditoría como «manual» para no hacerla pasar por azar
            GiveawayParticipant? forced = null;
            if (!string.IsNullOrWhiteSpace(forcedWinnerUsername))
            {
                forced = participants.FirstOrDefault(p => string.Equals(p.Username, forcedWinnerUsername, StringComparison.OrdinalIgnoreCase));
                if (forced == null) throw new InvalidOperationException("pick_not_found");
                if (excluded.Contains(forced.Id)) throw new InvalidOperationException("already_winner");
                if (!validParticipants.Contains(forced)) validParticipants.Add(forced);
            }

            if (validParticipants.Count == 0)
            {
                _logger.LogWarning($"No hay participantes válidos (todos en cooldown o ya descartados) en giveaway {session.Id}");
                throw new InvalidOperationException("No hay participantes válidos (todos están en cooldown, ya ganaron o fueron descartados)");
            }

            var created = new List<GiveawayWinner>();
            var audit = new List<DrawAuditEntry>();

            for (int i = 0; i < positions.Count && validParticipants.Count > 0; i++)
            {
                var winner = i == 0 && forced != null ? forced : SelectRandomWeighted(validParticipants);
                if (winner == null) break;

                audit.Add(i == 0 && forced != null
                    ? ManualAudit("winner", positions[i], winner)
                    : AuditFor("winner", positions[i], winner, validParticipants));
                validParticipants.Remove(winner);

                var winnerRecord = new GiveawayWinner
                {
                    SessionId = session.Id,
                    ParticipantId = winner.Id,
                    Position = positions[i],
                    IsBackup = false,
                    // El plazo cuenta desde que se anuncia: al terminar el revelado
                    SelectedAt = DateTime.UtcNow.AddSeconds(revealDelaySeconds)
                };
                _context.GiveawayWinners.Add(winnerRecord);
                created.Add(winnerRecord);

                if (config.WinnerCooldownEnabled)
                {
                    await AddWinnerCooldown(session.ChannelId, winner.UserId, winner.Username, config.WinnerCooldownDays, session.Id, config.PrizeName, winner.Platform);
                }
            }

            // Respaldos: se eligen una sola vez, en el primer sorteo, y solo si se sortea todo de golpe
            if (allowBackups && config.HasBackupWinners && !rules.OneByOne && !existing.Any(w => w.IsBackup) && validParticipants.Count > 0)
            {
                var backupsToSelect = Math.Min(config.NumberOfBackupWinners, validParticipants.Count);
                for (int i = 0; i < backupsToSelect; i++)
                {
                    var backup = SelectRandomWeighted(validParticipants);
                    if (backup == null) break;
                    audit.Add(AuditFor("backup", i + 1, backup, validParticipants));
                    validParticipants.Remove(backup);
                    _context.GiveawayWinners.Add(new GiveawayWinner
                    {
                        SessionId = session.Id,
                        ParticipantId = backup.Id,
                        Position = i + 1,
                        IsBackup = true,
                        SelectedAt = DateTime.UtcNow.AddSeconds(revealDelaySeconds)
                    });
                }
            }

            session.DrawAudit = AppendAudit(session.DrawAudit, audit);
            await _context.SaveChangesAsync();

            _logger.LogInformation($"Ganadores seleccionados para giveaway {session.Id}: {created.Count} principales (modo {rules.Mode})");
            return created;
        }

        /// <summary>Número en [0,1) con azar criptográfico (53 bits, el mismo rango que Random.NextDouble).</summary>
        private static double SecureUnit()
        {
            Span<byte> bytes = stackalloc byte[8];
            System.Security.Cryptography.RandomNumberGenerator.Fill(bytes);
            return (BitConverter.ToUInt64(bytes) >> 11) / (double)(1UL << 53);
        }

        /// <summary>Qué se guardó de cada elección para poder explicarla: peso, probabilidad y total en ese momento.</summary>
        public record DrawAuditEntry(string Kind, int Position, string Platform, string UserId, string Username,
            double Weight, double TotalWeight, double Probability, int Candidates, DateTime At);

        private static DrawAuditEntry AuditFor(string kind, int position, GiveawayParticipant chosen, List<GiveawayParticipant> pool)
        {
            var total = pool.Sum(p => (double)p.CalculatedWeight);
            var weight = (double)chosen.CalculatedWeight;
            return new DrawAuditEntry(kind, position, chosen.Platform, chosen.UserId, chosen.Username,
                weight, total, total > 0 ? weight / total : 0, pool.Count, DateTime.UtcNow);
        }

        /// <summary>Elección a mano: sin probabilidad de azar (se registra 1 de 1 para que el registro no la confunda con un sorteo).</summary>
        private static DrawAuditEntry ManualAudit(string kind, int position, GiveawayParticipant chosen) =>
            new("manual-" + kind, position, chosen.Platform, chosen.UserId, chosen.Username,
                (double)chosen.CalculatedWeight, (double)chosen.CalculatedWeight, 1, 1, DateTime.UtcNow);

        private static string AppendAudit(string? existing, IEnumerable<DrawAuditEntry> entries)
        {
            var all = new List<DrawAuditEntry>();
            if (!string.IsNullOrWhiteSpace(existing))
            {
                try { all.AddRange(JsonSerializer.Deserialize<List<DrawAuditEntry>>(existing) ?? new()); } catch { /* registro viejo o dañado: se empieza de nuevo */ }
            }
            all.AddRange(entries);
            return JsonSerializer.Serialize(all);
        }

        private GiveawayParticipant? SelectRandomWeighted(List<GiveawayParticipant> participants)
        {
            if (participants.Count == 0)
                return null;

            var totalWeight = participants.Sum(p => (double)p.CalculatedWeight);
            var randomValue = SecureUnit() * totalWeight;

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

        public async Task<GiveawayWinner> RerollWinner(string channelId, int? position = null, int? sessionId = null, string? forcedWinnerUsername = null)
        {
            // El sorteo del que se re-sortea: el indicado, o el más reciente. Antes se tomaba CUALQUIERA del canal (sin
            // ordenar, y aceptando completados), o sea uno viejo de prueba: «no hay más participantes» aunque los hubiera
            var session = sessionId.HasValue
                ? await _context.GiveawaySessions.FirstOrDefaultAsync(s => s.Id == sessionId.Value && s.ChannelId == channelId)
                : await _context.GiveawaySessions
                    .Where(s => s.ChannelId == channelId &&
                        (s.Status == "completed" || s.Status == "active" || s.Status == "selecting_winners"))
                    .OrderByDescending(s => s.UpdatedAt)
                    .FirstOrDefaultAsync();

            if (session == null)
            {
                throw new InvalidOperationException("No hay giveaway activo o completado reciente");
            }

            var config = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);
            if (config == null)
            {
                throw new InvalidOperationException("Config snapshot inválido");
            }

            // Quién puede volver a salir lo deciden las reglas del streamer: el pendiente y el reservado nunca; el confirmado y
            // el que no respondió, según sus opciones (por defecto, ninguno)
            var winnerRows = (await _context.GiveawayWinners.Where(w => w.SessionId == session.Id).ToListAsync()).Select(ToRow).ToList();
            var excludedIds = GiveawayDrawPlan.Excluded(winnerRows, GiveawaySettings.Parse(config.Settings).Draw);

            var validParticipants = await _context.GiveawayParticipants
                .Where(p => p.SessionId == session.Id && !excludedIds.Contains(p.Id))
                .ToListAsync();

            validParticipants = await FilterCooldownParticipants(validParticipants, config, channelId);

            if (validParticipants.Count == 0 && string.IsNullOrWhiteSpace(forcedWinnerUsername))
            {
                throw new InvalidOperationException("No hay participantes disponibles para re-sorteo");
            }

            // Select new winner (o el que eligió a mano un moderador)
            var manual = string.IsNullOrWhiteSpace(forcedWinnerUsername)
                ? null
                : await _context.GiveawayParticipants.FirstOrDefaultAsync(p => p.SessionId == session.Id && p.Username.ToLower() == forcedWinnerUsername.ToLower());
            if (!string.IsNullOrWhiteSpace(forcedWinnerUsername) && manual == null)
                throw new InvalidOperationException("pick_not_found");
            if (manual != null && excludedIds.Contains(manual.Id))
                throw new InvalidOperationException("already_winner");
            var newWinner = manual ?? SelectRandomWeighted(validParticipants);
            if (newWinner == null)
            {
                throw new InvalidOperationException("Error al seleccionar nuevo ganador");
            }

            session.DrawAudit = AppendAudit(session.DrawAudit, new[] { manual != null ? ManualAudit("reroll", position ?? 1, newWinner) : AuditFor("reroll", position ?? 1, newWinner, validParticipants) });

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
                await AddWinnerCooldown(channelId, newWinner.UserId, newWinner.Username, config.WinnerCooldownDays, session.Id, config.PrizeName, newWinner.Platform);
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation($"Re-sorteo realizado en giveaway {session.Id}: {newWinner.Username}");
            await PublishOverlayAsync(channelId);

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
            await PublishOverlayAsync(channelId);

            _logger.LogInformation($"Ganador descalificado en giveaway {session.Id}: {username}");
        }

        // ========================================================================
        // COMANDOS DE CHAT (control del giveaway y comandos de los viewers)
        // ========================================================================

        // Reglas de comandos por canal, leídas de la configuración guardada (no de la copia de un sorteo: deben servir sin giveaway)
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, (DateTime At, GiveawayCommandRules Rules)> _commandRulesCache = new();

        public static void InvalidateCommandRules(string channelId) => _commandRulesCache.TryRemove(channelId, out _);

        /// <summary>Reglas ya en caché (sin crear servicio ni consultar la base): el chat de cada canal pasa por aquí con cada «!comando».</summary>
        public static bool TryGetCachedCommandRules(string channelId, out GiveawayCommandRules rules)
        {
            if (_commandRulesCache.TryGetValue(channelId, out var cached) && (DateTime.UtcNow - cached.At).TotalSeconds < 30)
            {
                rules = cached.Rules;
                return true;
            }
            rules = null!;
            return false;
        }

        public async Task<GiveawayCommandRules> GetCommandRules(string channelId)
        {
            if (_commandRulesCache.TryGetValue(channelId, out var cached) && (DateTime.UtcNow - cached.At).TotalSeconds < 30)
                return cached.Rules;
            var settings = await _context.GiveawayConfigs.AsNoTracking()
                .Where(c => c.ChannelId == channelId)
                .Select(c => c.Settings)
                .FirstOrDefaultAsync();
            var rules = GiveawaySettings.Parse(settings).Commands;
            _commandRulesCache[channelId] = (DateTime.UtcNow, rules);
            return rules;
        }

        /// <summary>El giveaway que los comandos manejan: el último en curso o ya sorteado esperando respuestas.</summary>
        private Task<GiveawaySession?> CurrentSessionAsync(string channelId) =>
            _context.GiveawaySessions
                .Where(s => s.ChannelId == channelId && (s.Status == "active" || s.Status == "selecting_winners"))
                .OrderByDescending(s => s.UpdatedAt)
                .FirstOrDefaultAsync();

        /// <summary>
        /// Inicia un giveaway desde el chat con la configuración guardada del panel. El premio y la duración del comando solo
        /// valen para ese sorteo: no se escriben en la configuración guardada.
        /// </summary>
        public async Task<GiveawaySession> StartFromChatAsync(string channelId, string? prize, int? durationSeconds, bool manualDuration)
        {
            var saved = await GetConfig(channelId) ?? throw new InvalidOperationException("no_config");
            var config = JsonSerializer.Deserialize<GiveawayConfig>(JsonSerializer.Serialize(saved))!;
            if (!string.IsNullOrWhiteSpace(prize)) config.PrizeName = prize.Trim();
            if (string.IsNullOrWhiteSpace(config.PrizeName)) throw new InvalidOperationException("no_prize");
            if (manualDuration) config.DurationType = "manual";
            else if (durationSeconds.HasValue) { config.DurationType = "timed"; config.DurationMinutes = Math.Max(1, (int)Math.Ceiling(durationSeconds.Value / 60.0)); }
            var started = await StartGiveaway(channelId, config);
            // La config guarda minutos; los segundos exactos del comando (p. ej. 90s) se aplican al cierre de esta sesión
            if (!manualDuration && durationSeconds.HasValue && started.EndsAt.HasValue)
            {
                started.EndsAt = (started.StartedAt ?? DateTime.UtcNow).AddSeconds(durationSeconds.Value);
                await _context.SaveChangesAsync();
                await PublishOverlayAsync(channelId);
            }
            return started;
        }

        public record CommandStatus(string Phase, string Prize, int Participants, int? MinutesLeft, string Command, bool EntriesOpen = true);

        public async Task<CommandStatus> GetCommandStatusAsync(string channelId)
        {
            var session = await CurrentSessionAsync(channelId);
            if (session == null) return new CommandStatus("none", "", 0, null, "");
            var cfg = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);
            var count = await _context.GiveawayParticipants.CountAsync(p => p.SessionId == session.Id);
            int? left = session.Status == "active" && session.EndsAt.HasValue
                ? Math.Max(0, (int)Math.Ceiling((session.EndsAt.Value - DateTime.UtcNow).TotalMinutes))
                : null;
            return new CommandStatus(session.Status == "active" ? "open" : "drawing", session.PrizeName ?? cfg?.PrizeName ?? "", count, left,
                GiveawayCommandRules.Normalize(cfg?.EntryCommand, "!join"), EntriesOpen(session));
        }

        /// <summary>El último sorteo ya hecho (esperando respuestas o recién completado, hasta 24 h): sobre él se re-sortea o se elige a mano.</summary>
        private Task<GiveawaySession?> DrawnSessionAsync(string channelId)
        {
            var since = DateTime.UtcNow.AddHours(-24);
            return _context.GiveawaySessions
                .Where(s => s.ChannelId == channelId && (s.Status == "selecting_winners" || (s.Status == "completed" && s.EndedAt >= since)))
                .OrderByDescending(s => s.UpdatedAt)
                .FirstOrDefaultAsync();
        }

        /// <summary>
        /// «reroll»: reemplaza al ganador que aún no respondió (haya vencido su plazo o no) y descarta al anterior para que el servicio de
        /// fondo no lo procese. Con la opción del streamer, sube primero a un ganador de respaldo; si no, sortea o elige a mano.
        /// </summary>
        public async Task<(string Username, bool FromBackup)> RerollFromChatAsync(string channelId, string? forcedUsername)
        {
            var session = await DrawnSessionAsync(channelId) ?? throw new InvalidOperationException("none_active");
            var config = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot) ?? throw new InvalidOperationException("Config snapshot inválido");
            var rules = GiveawaySettings.Parse(config.Settings).Draw;

            var rows = await _context.GiveawayWinners.Where(w => w.SessionId == session.Id).ToListAsync();
            var target = GiveawayDrawPlan.PendingToReplace(rows.Select(ToRow));
            if (target == null) throw new InvalidOperationException("all_responded");
            var pending = rows.First(w => !w.IsBackup && !w.WasDisqualified && !w.HasResponded && w.Position == target.Position && w.ParticipantId == target.ParticipantId);

            string name;
            var fromBackup = false;
            var backup = string.IsNullOrWhiteSpace(forcedUsername) && rules.BackupsOnReroll
                ? rows.Where(w => w.IsBackup && !w.WasDisqualified && !w.HasResponded && !w.TimeoutProcessed).OrderBy(w => w.Position).ThenBy(w => w.SelectedAt).FirstOrDefault()
                : null;
            if (backup != null)
            {
                // El respaldo toma el lugar y su plazo empieza ahora
                backup.IsBackup = false;
                backup.Position = pending.Position;
                backup.PromotedAt = DateTime.UtcNow;
                backup.SelectedAt = DateTime.UtcNow;
                backup.TimeoutProcessed = false;
                name = await _context.GiveawayParticipants.Where(p => p.Id == backup.ParticipantId).Select(p => p.Username).FirstAsync();
                fromBackup = true;
            }
            else
            {
                var winner = await RerollWinner(channelId, pending.Position, session.Id, forcedUsername);
                name = await _context.GiveawayParticipants.Where(p => p.Id == winner.ParticipantId).Select(p => p.Username).FirstAsync();
            }

            pending.WasDisqualified = true;
            pending.DisqualificationReason = fromBackup ? "Reemplazado por el ganador de respaldo" : string.IsNullOrWhiteSpace(forcedUsername) ? "Re-sorteo por comando" : "Reemplazado por elección manual";
            pending.DisqualifiedAt = DateTime.UtcNow;
            pending.TimeoutProcessed = true;

            // El nuevo ganador tiene su propio plazo: el sorteo vuelve a «esperando respuestas» para que el servicio de fondo lo vigile
            // y para que su respuesta en el chat se registre
            if (session.Status == "completed") session.Status = "selecting_winners";
            session.UpdatedAt = DateTime.UtcNow;
            _pendingWinnerChannels[channelId] = DateTime.UtcNow + TimeSpan.FromSeconds(Math.Max(60, config.WinnerResponseTimeout) * 2);
            await _context.SaveChangesAsync();
            await PublishOverlayAsync(channelId);
            return (name, fromBackup);
        }

        /// <summary>
        /// «pick &lt;usuario&gt;»: elige a mano. Con el giveaway abierto o con lugares libres, esa persona ocupa un lugar nuevo;
        /// si todos los lugares tienen ganador, reemplaza al que no respondió. Replaced = hubo reemplazo (lo anuncia quien llama).
        /// </summary>
        public async Task<(string Name, bool Replaced)> PickFromChatAsync(string channelId, string username)
        {
            var session = await CurrentSessionAsync(channelId) ?? await DrawnSessionAsync(channelId) ?? throw new InvalidOperationException("none_active");
            var participant = await _context.GiveawayParticipants.AsNoTracking()
                .FirstOrDefaultAsync(p => p.SessionId == session.Id && p.Username.ToLower() == username.TrimStart('@').ToLower());
            if (participant == null) throw new InvalidOperationException("pick_not_found");

            var config = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);
            var rows = (await _context.GiveawayWinners.AsNoTracking().Where(w => w.SessionId == session.Id).ToListAsync()).Select(ToRow).ToList();
            var hasFreePlace = session.Status == "active" || GiveawayDrawPlan.FreePositions(rows, config?.NumberOfWinners ?? 1).Count > 0;
            if (hasFreePlace)
            {
                await ChooseAsync(channelId, participant.Username);
                return (participant.Username, false);
            }
            var (name, _) = await RerollFromChatAsync(channelId, participant.Username);
            return (name, true);
        }

        /// <summary>Anuncio de un respaldo que sube a ganador (el mensaje «promovido» configurable del giveaway).</summary>
        public async Task<string?> PromotionAnnouncementAsync(string channelId, string winnerName)
        {
            var session = await DrawnSessionAsync(channelId);
            if (session == null) return null;
            var cfg = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);
            if (cfg == null) return null;
            var gs = GiveawaySettings.Parse(cfg.Settings);
            return (string.IsNullOrWhiteSpace(gs.Messages.Promoted) ? GiveawayMessages.DefaultPromoted : gs.Messages.Promoted)
                .Replace("{winner}", winnerName).Replace("{user}", winnerName)
                .Replace("{timeout}", cfg.WinnerResponseTimeout.ToString()).Replace("{prize}", cfg.PrizeName ?? "");
        }

        /// <summary>La participación acepta entradas: el sorteo está abierto o esperando respuestas, y nadie la cerró.</summary>
        private static bool EntriesOpen(GiveawaySession s) =>
            !s.EntriesClosed && (s.Status == "active" || s.Status == "selecting_winners");

        /// <summary>Cierra o reabre la participación sin tocar el sorteo («close» / «open»). Devuelve false si no hay giveaway.</summary>
        public async Task<bool> SetEntriesClosedAsync(string channelId, bool closed)
        {
            var session = await CurrentSessionAsync(channelId);
            if (session == null) return false;
            session.EntriesClosed = closed;
            session.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            InvalidateEntryRules(channelId);
            await PublishOverlayAsync(channelId);
            return true;
        }

        /// <summary>
        /// «choose»: con el giveaway abierto hace el primer sorteo; ya sorteado, elige a los ganadores de los lugares que
        /// aún no tienen ninguno (todos, o uno solo en modo «uno por uno»). Con un nombre, ese participante ocupa el lugar.
        /// Devuelve los nombres elegidos; el anuncio en el chat lo hace el propio servicio.
        /// </summary>
        public async Task<List<string>> ChooseAsync(string channelId, string? forcedUsername)
        {
            var open = await CurrentSessionAsync(channelId);
            if (open != null && open.Status == "active")
            {
                await EndGiveaway(channelId, forcedUsername);
                // EndGiveaway anuncia por su cuenta; aquí solo se informa a quién se eligió
                return await _context.GiveawayWinners.Where(w => w.SessionId == open.Id && !w.IsBackup).OrderBy(w => w.Position)
                    .Join(_context.GiveawayParticipants, w => w.ParticipantId, p => p.Id, (w, p) => p.Username).ToListAsync();
            }

            var session = await DrawnSessionAsync(channelId) ?? throw new InvalidOperationException("none_active");
            var config = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot) ?? throw new InvalidOperationException("Config snapshot inválido");
            var created = await SelectWinners(session, config, 0, forcedUsername, allowBackups: false);

            if (session.Status == "completed") session.Status = "selecting_winners";
            session.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            _pendingWinnerChannels[channelId] = DateTime.UtcNow + TimeSpan.FromSeconds(Math.Max(60, config.WinnerResponseTimeout) * 2);
            await PublishOverlayAsync(channelId);

            var names = new List<string>();
            var channelName = await GetChannelNameFromId(channelId);
            foreach (var w in created.OrderBy(x => x.Position))
            {
                var name = await _context.GiveawayParticipants.Where(p => p.Id == w.ParticipantId).Select(p => p.Username).FirstAsync();
                names.Add(name);
                if (!string.IsNullOrEmpty(channelName))
                    await AnnounceAsync(channelName, ProcessMessageVariables(config.WinnerMessage, config, session, session.TotalParticipants, name));
            }
            return names;
        }

        /// <summary>El viewer se retira del giveaway abierto. Devuelve "left", "not_in", "closed" o "none".</summary>
        public async Task<string> LeaveAsync(string channelId, string userId, string platform)
        {
            var session = await CurrentSessionAsync(channelId);
            if (session == null) return "none";
            if (!EntriesOpen(session)) return "closed";
            var participant = await _context.GiveawayParticipants.FirstOrDefaultAsync(p => p.SessionId == session.Id && p.Platform == platform && p.UserId == userId);
            if (participant == null) return "not_in";
            // Un ganador (o respaldo) no se va: borrarlo dejaría el sorteo sin ese lugar y sin explicación
            if (await _context.GiveawayWinners.AnyAsync(w => w.ParticipantId == participant.Id && !w.WasDisqualified)) return "winner_locked";

            _context.GiveawayParticipants.Remove(participant);
            await _context.SaveChangesAsync();
            session.TotalParticipants = await _context.GiveawayParticipants.CountAsync(p => p.SessionId == session.Id);
            await RecalculateSessionWeight(session.Id);
            InvalidateEntryRules(channelId);
            await PublishOverlayAsync(channelId);
            return "left";
        }

        /// <summary>Si el viewer participa en el giveaway en curso (null = no hay giveaway).</summary>
        public async Task<(bool Participating, string Prize, string Command)?> ParticipationAsync(string channelId, string userId, string platform)
        {
            var session = await CurrentSessionAsync(channelId);
            if (session == null) return null;
            var cfg = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);
            var yes = await IsParticipant(session.Id, userId, platform);
            return (yes, session.PrizeName ?? cfg?.PrizeName ?? "", GiveawayCommandRules.Normalize(cfg?.EntryCommand, "!join"));
        }

        public Task<string?> ChannelNameAsync(string channelId) => GetChannelNameFromId(channelId);

        /// <summary>Texto de anuncio para un ganador, con el mensaje de ganador configurado en el giveaway en curso.</summary>
        public async Task<string?> WinnerAnnouncementAsync(string channelId, string winnerName)
        {
            var session = await CurrentSessionAsync(channelId) ?? await DrawnSessionAsync(channelId);
            if (session == null) return null;
            var cfg = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);
            if (cfg == null) return null;
            return ProcessMessageVariables(cfg.WinnerMessage, cfg, session, session.TotalParticipants, winnerName);
        }

        /// <summary>Nombres de los últimos ganadores (sin repetir), del más reciente al más antiguo.</summary>
        public async Task<List<string>> RecentWinnerNamesAsync(string channelId, int limit = 5)
        {
            var rows = await (from w in _context.GiveawayWinners.AsNoTracking()
                              join s in _context.GiveawaySessions.AsNoTracking() on w.SessionId equals s.Id
                              join p in _context.GiveawayParticipants.AsNoTracking() on w.ParticipantId equals p.Id
                              where s.ChannelId == channelId && !w.IsBackup && !w.WasDisqualified
                                    && (s.Status == "completed" || s.Status == "selecting_winners")
                              orderby w.SelectedAt descending
                              select p.Username).Take(limit * 4).ToListAsync();
            return rows.Distinct(StringComparer.OrdinalIgnoreCase).Take(limit).ToList();
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

            // Cuentas en double con tope: un multiplicador exponencial grande ya no desborda (antes el desborde
            // caía al catch y dejaba el peso en 1, anulando TODOS los multiplicadores)
            var limits = GiveawaySettings.Parse(config.Settings).WeightLimits;
            double MaxWeight = Math.Max(1.0, limits.MaxPerFactor);
            double weight = 1.0;

            double Num(string name, double fallback) =>
                weights.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.Number ? el.GetDouble() : fallback;
            bool On(string name) =>
                weights.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.True;
            double Pow(double mult, double exp) => Math.Min(Math.Pow(Math.Max(mult, 0), exp), MaxWeight);

            try
            {
                // Subscription tier multiplier
                if (participant.IsSubscriber && participant.SubscriptionTier.HasValue)
                {
                    switch (participant.SubscriptionTier.Value)
                    {
                        case 1: weight *= Num("subTier1Multiplier", 1.0); break;
                        case 2: weight *= Num("subTier2Multiplier", 1.0); break;
                        case 3: weight *= Num("subTier3Multiplier", 1.0); break;
                    }
                }

                // VIP multiplier
                if (participant.IsVip)
                    weight *= Num("vipMultiplier", 1.0);

                // Watch time multiplier (por hora)
                if (On("watchTimeEnabled") && participant.WatchTimeMinutes > 0)
                    weight *= Pow(Num("watchTimeMultiplierPerHour", 1.0), participant.WatchTimeMinutes / 60.0);

                // Follow age multiplier (por mes)
                if (On("followAgeEnabled") && participant.FollowedAt.HasValue)
                    weight *= Pow(Num("followAgeMultiplierPerMonth", 1.0), (DateTime.UtcNow - participant.FollowedAt.Value).TotalDays / 30.0);

                // Bits multiplier (por cada 100)
                if (On("bitsEnabled") && participant.BitsTotal > 0)
                    weight *= Pow(Num("bitsMultiplierPer100", 1.0), participant.BitsTotal / 100.0);

                // Sub streak multiplier (por mes)
                if (On("subStreakEnabled") && participant.SubStreak > 0)
                    weight *= Pow(Num("subStreakMultiplierPerMonth", 1.0), participant.SubStreak);

                // Entradas múltiples: cada entrada es un boleto más
                if (participant.EntryCount > 1)
                    weight *= participant.EntryCount;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error calculating weight: {ex.Message}");
                return 1.0m;
            }

            return (decimal)Math.Clamp(weight, Math.Max(0.0001, limits.Min), Math.Max(limits.Min, limits.MaxTotal));
        }

        // Devuelve null si cumple los requisitos, o el código del motivo del rechazo
        private async Task<string?> ValidateRequirements(
            string userId,
            string username,
            Dictionary<string, object> userMetadata,
            JsonElement requirements,
            string channelId,
            string platform = "twitch",
            GiveawayPlatformRules? platformRules = null)
        {
            try
            {
                // Un requisito que la plataforma del viewer no permite comprobar (Kick no da seguidores, meses de sub ni
                // edad de cuenta) se omite o se rechaza según la opción del streamer. Twitch lo comprueba todo.
                var rejectUnverifiable = platformRules?.Unverifiable == "reject";
                string? unverifiableFail = null;
                bool Verifiable(string capability, string reason)
                {
                    if (GiveawayCapabilities.CanVerify(platform, capability)) return true;
                    if (rejectUnverifiable) unverifiableFail ??= reason;
                    return false;
                }

                _logger.LogDebug($"[REQUIREMENTS] Validando requisitos para {username}. Metadata: isFollower={GetBool(userMetadata, "isFollower")}, isSubscriber={GetBool(userMetadata, "isSubscriber")}, isVip={GetBool(userMetadata, "isVip")}, isMod={GetBool(userMetadata, "isModerator")}");

                // Check whitelist (si está habilitado, SOLO permite usuarios en la lista)
                var useWhitelist = requirements.TryGetProperty("useWhitelist", out var uwl) && uwl.GetBoolean();
                if (useWhitelist)
                {
                    _logger.LogDebug($"[REQUIREMENTS] useWhitelist=true. Verificando whitelist...");
                    var whitelistedUsers = new List<string>();
                    if (requirements.TryGetProperty("whitelistedUsers", out var wl) && wl.ValueKind == JsonValueKind.Array)
                    {
                        whitelistedUsers = JsonSerializer.Deserialize<List<string>>(wl.GetRawText()) ?? new List<string>();
                    }

                    var isInWhitelist = whitelistedUsers.Any(u => u.Equals(username, StringComparison.OrdinalIgnoreCase));
                    if (!isInWhitelist)
                    {
                        _logger.LogDebug($"[REQUIREMENTS] {username} rechazado: NO está en whitelist");
                        return "not_in_whitelist";
                    }
                    _logger.LogDebug($"[REQUIREMENTS] {username} está en whitelist - APROBADO");
                    return null; // Si está en whitelist, se acepta directamente
                }

                // Check blacklist (siempre se revisa): la lista del panel (en los requisitos) y la tabla del canal
                var isBlacklisted = false;
                if (requirements.TryGetProperty("blacklistedUsers", out var bl) && bl.ValueKind == JsonValueKind.Array)
                {
                    isBlacklisted = bl.EnumerateArray().Any(u => u.ValueKind == JsonValueKind.String
                        && string.Equals(u.GetString()?.Trim().TrimStart('@'), username, StringComparison.OrdinalIgnoreCase));
                }
                if (!isBlacklisted)
                    isBlacklisted = await _context.GiveawayBlacklists
                        .AnyAsync(b => b.ChannelId == channelId && b.Platform == platform && b.UserId == userId);

                if (isBlacklisted)
                {
                    _logger.LogDebug($"[REQUIREMENTS] {username} rechazado: está en BLACKLIST");
                    return "blacklisted";
                }

                // Check if VIPs are allowed
                var allowVips = !requirements.TryGetProperty("allowVips", out var av) || av.GetBoolean();
                if (!allowVips && GetBool(userMetadata, "isVip"))
                {
                    _logger.LogDebug($"[REQUIREMENTS] {username} rechazado: es VIP pero VIPs no permitidos");
                    return "vip_not_allowed";
                }

                // Check if moderators are allowed
                var allowModerators = !requirements.TryGetProperty("allowModerators", out var am) || am.GetBoolean();
                if (!allowModerators && GetBool(userMetadata, "isModerator"))
                {
                    _logger.LogDebug($"[REQUIREMENTS] {username} rechazado: es MOD pero MODs no permitidos");
                    return "mod_not_allowed";
                }

                // Must follow
                if (requirements.TryGetProperty("mustFollow", out var mustFollow) && mustFollow.GetBoolean()
                    && Verifiable(GiveawayCapabilities.Follower, "unverifiable_follower"))
                {
                    _logger.LogDebug($"[REQUIREMENTS] mustFollow=true requerido. Usuario isFollower={GetBool(userMetadata, "isFollower")}");
                    if (!GetBool(userMetadata, "isFollower"))
                    {
                        _logger.LogDebug($"[REQUIREMENTS] {username} rechazado: no es follower");
                        return "not_follower";
                    }
                }

                // Must subscribe
                if (requirements.TryGetProperty("mustSubscribe", out var mustSubscribe) && mustSubscribe.GetBoolean())
                {
                    _logger.LogDebug($"[REQUIREMENTS] mustSubscribe=true requerido. Usuario isSubscriber={GetBool(userMetadata, "isSubscriber")}");
                    if (!GetBool(userMetadata, "isSubscriber"))
                    {
                        _logger.LogDebug($"[REQUIREMENTS] {username} rechazado: no es subscriber");
                        return "not_subscriber";
                    }
                }

                // Minimum watch time
                if (requirements.TryGetProperty("minimumWatchTimeEnabled", out var minWatchEnabled) && minWatchEnabled.GetBoolean()
                    && Verifiable(GiveawayCapabilities.WatchTime, "unverifiable_watch_time"))
                {
                    var minWatchTime = requirements.TryGetProperty("minimumWatchTime", out var minWatch) ? minWatch.GetInt32() : 0;
                    var userWatchTime = GetInt(userMetadata, "watchTimeMinutes");
                    _logger.LogDebug($"[REQUIREMENTS] minimumWatchTime={minWatchTime} requerido. Usuario watchTime={userWatchTime}");
                    if (userWatchTime < minWatchTime)
                    {
                        _logger.LogDebug($"[REQUIREMENTS] {username} rechazado: watchTime insuficiente");
                        return "watch_time";
                    }
                }

                // Minimum account age
                if (requirements.TryGetProperty("minimumAccountAgeEnabled", out var minAcctAgeEnabled) && minAcctAgeEnabled.GetBoolean()
                    && Verifiable(GiveawayCapabilities.AccountAge, "unverifiable_account_age"))
                {
                    var minAccountAge = requirements.TryGetProperty("minimumAccountAge", out var minAcctAge) ? minAcctAge.GetInt32() : 0;
                    var accountAgeUnit = requirements.TryGetProperty("minimumAccountAgeUnit", out var ageUnit) ? ageUnit.GetString() : "days";

                    // Convertir a días según la unidad
                    var minAccountAgeDays = ConvertTimeUnitToDays(minAccountAge, accountAgeUnit);

                    var accountCreatedAt = GetNullableDateTime(userMetadata, "accountCreatedAt");
                    if (accountCreatedAt.HasValue)
                    {
                        var accountAgeDays = (DateTime.UtcNow - accountCreatedAt.Value).TotalDays;
                        _logger.LogDebug($"[REQUIREMENTS] minimumAccountAge={minAccountAge} {accountAgeUnit} ({minAccountAgeDays} días) requerido. Usuario accountAge={accountAgeDays:F1} días");
                        if (accountAgeDays < minAccountAgeDays)
                        {
                            _logger.LogDebug($"[REQUIREMENTS] {username} rechazado: cuenta muy nueva");
                            return "account_age";
                        }
                    }
                    else if (minAccountAge > 0)
                    {
                        _logger.LogDebug($"[REQUIREMENTS] {username} rechazado: no tiene datos de account age");
                        return "account_age_unknown";
                    }
                }

                // Minimum follow age
                if (requirements.TryGetProperty("minimumFollowAgeEnabled", out var minFollowAgeEnabled) && minFollowAgeEnabled.GetBoolean()
                    && Verifiable(GiveawayCapabilities.FollowAge, "unverifiable_follow_age"))
                {
                    var minFollowAge = requirements.TryGetProperty("minimumFollowAge", out var minFollow) ? minFollow.GetInt32() : 0;
                    var followAgeUnit = requirements.TryGetProperty("minimumFollowAgeUnit", out var fUnit) ? fUnit.GetString() : "days";

                    // Convertir a días según la unidad
                    var minFollowAgeDays = ConvertTimeUnitToDays(minFollowAge, followAgeUnit);

                    var followedAt = GetNullableDateTime(userMetadata, "followedAt");
                    if (followedAt.HasValue)
                    {
                        var followAgeDays = (DateTime.UtcNow - followedAt.Value).TotalDays;
                        _logger.LogDebug($"[REQUIREMENTS] minimumFollowAge={minFollowAge} {followAgeUnit} ({minFollowAgeDays} días) requerido. Usuario followAge={followAgeDays:F1} días");
                        if (followAgeDays < minFollowAgeDays)
                        {
                            _logger.LogDebug($"[REQUIREMENTS] {username} rechazado: follow muy reciente");
                            return "follow_age";
                        }
                    }
                    else if (minFollowAge > 0)
                    {
                        _logger.LogDebug($"[REQUIREMENTS] {username} rechazado: no tiene datos de follow age");
                        return "follow_age_unknown";
                    }
                }

                // Minimum chat messages
                if (requirements.TryGetProperty("minimumChatMessagesEnabled", out var minMsgEnabled) && minMsgEnabled.GetBoolean()
                    && Verifiable(GiveawayCapabilities.ChatMessages, "unverifiable_chat_messages"))
                {
                    var minMessages = requirements.TryGetProperty("minimumChatMessages", out var minMsg) ? minMsg.GetInt32() : 0;
                    var userMessages = GetInt(userMetadata, "chatMessagesCount");
                    _logger.LogDebug($"[REQUIREMENTS] minimumChatMessages={minMessages} requerido. Usuario messages={userMessages}");
                    if (userMessages < minMessages)
                    {
                        _logger.LogDebug($"[REQUIREMENTS] {username} rechazado: mensajes insuficientes");
                        return "chat_messages";
                    }
                }

                if (unverifiableFail != null)
                {
                    _logger.LogDebug($"[REQUIREMENTS] {username} rechazado: {unverifiableFail} (no verificable en {platform})");
                    return unverifiableFail;
                }

                _logger.LogDebug($"[REQUIREMENTS] {username} APROBADO - cumple todos los requisitos");
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error validating requirements: {ex.Message}");
                return "error";
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
                .Select(c => new { c.Platform, c.UserId })
                .ToListAsync();

            var blocked = cooldowns.Select(c => (c.Platform, c.UserId)).ToHashSet();
            return participants.Where(p => !blocked.Contains((p.Platform, p.UserId))).ToList();
        }

        private async Task AddWinnerCooldown(string channelId, string userId, string username, int days, int sessionId, string prizeName, string platform = "twitch")
        {
            var cooldown = new GiveawayWinnerCooldown
            {
                ChannelId = channelId,
                Platform = platform,
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
        // PARTICIPANTES DE PRUEBA (pestaña Debug)
        // ========================================================================

        private const string TestUserPrefix = "test_";

        /// <summary>Crea participantes falsos en el giveaway activo con datos variados, para probar pesos y sorteos.</summary>
        public async Task<int> GenerateTestParticipants(string channelId, int count, int vipPct, int modPct, int subPct, int followerPct, List<string>? names)
        {
            var session = await GetActiveSession(channelId)
                ?? throw new InvalidOperationException("No hay giveaway activo");
            var config = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot)
                ?? throw new InvalidOperationException("Config snapshot inválido");

            count = Math.Clamp(count, 1, 500);
            var existing = await _context.GiveawayParticipants.CountAsync(p => p.SessionId == session.Id && p.UserId.StartsWith(TestUserPrefix));
            var now = DateTime.UtcNow;
            var created = 0;

            for (var i = 0; i < count; i++)
            {
                var n = existing + i + 1;
                var name = names != null && i < names.Count ? names[i] : $"prueba_{n}";
                var isSub = _random.Next(100) < subPct;
                var isFollower = isSub || _random.Next(100) < followerPct;
                var participant = new GiveawayParticipant
                {
                    SessionId = session.Id,
                    UserId = $"{TestUserPrefix}{session.Id}_{n}",
                    Username = name.ToLowerInvariant(),
                    DisplayName = name,
                    IsFollower = isFollower,
                    IsSubscriber = isSub,
                    SubscriptionTier = isSub ? (byte)(_random.Next(100) < 70 ? 1 : _random.Next(100) < 70 ? 2 : 3) : null,
                    IsVip = _random.Next(100) < vipPct,
                    IsModerator = _random.Next(100) < modPct,
                    AccountCreatedAt = now.AddDays(-_random.Next(30, 3000)),
                    FollowedAt = isFollower ? now.AddDays(-_random.Next(1, 900)) : null,
                    WatchTimeMinutes = _random.Next(0, 6000),
                    ChatMessagesCount = _random.Next(0, 800),
                    BitsTotal = _random.Next(100) < 15 ? _random.Next(100, 5000) : 0,
                    SubStreak = isSub ? _random.Next(1, 36) : 0,
                    EnteredAt = now,
                    EntryCount = 1,
                };
                participant.CalculatedWeight = CalculateWeight(participant, config);
                _context.GiveawayParticipants.Add(participant);
                created++;
            }

            await _context.SaveChangesAsync();
            session.TotalParticipants += created;
            await RecalculateSessionWeight(session.Id);
            return created;
        }

        /// <summary>Borra solo los participantes de prueba del giveaway activo (los reales no se tocan).</summary>
        public async Task<int> ClearTestParticipants(string channelId)
        {
            var session = await GetActiveSession(channelId)
                ?? throw new InvalidOperationException("No hay giveaway activo");
            var fakes = await _context.GiveawayParticipants
                .Where(p => p.SessionId == session.Id && p.UserId.StartsWith(TestUserPrefix))
                .ToListAsync();
            if (fakes.Count == 0) return 0;

            _context.GiveawayParticipants.RemoveRange(fakes);
            session.TotalParticipants = Math.Max(0, session.TotalParticipants - fakes.Count);
            await _context.SaveChangesAsync();
            await RecalculateSessionWeight(session.Id);
            return fakes.Count;
        }

        // ========================================================================
        // RECORDATORIOS
        // ========================================================================

        private static readonly System.Collections.Concurrent.ConcurrentDictionary<int, DateTime> _lastReminder = new();

        /// <summary>
        /// Anuncia en el chat el recordatorio de los giveaways activos que lo tengan activado,
        /// cada "reminderIntervalMinutes" desde que empezó o desde el último recordatorio.
        /// </summary>
        public async Task SendDueRemindersAsync()
        {
            var now = DateTime.UtcNow;
            var sessions = await _context.GiveawaySessions.AsNoTracking()
                .Where(s => s.Status == "active")
                .ToListAsync();

            foreach (var session in sessions)
            {
                try
                {
                    var config = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);
                    if (config == null || !config.AnnounceReminders || config.ReminderIntervalMinutes <= 0) continue;
                    // Un sorteo olvidado (activo hace más de 24 h) no se recuerda por siempre en el chat
                    var reminderRules = GiveawaySettings.Parse(config.Settings).Reminders;
                    if (reminderRules.MaxAgeHours > 0 && session.StartedAt.HasValue && now - session.StartedAt.Value > TimeSpan.FromHours(reminderRules.MaxAgeHours)) continue;

                    var last = _lastReminder.GetOrAdd(session.Id, session.StartedAt ?? now);
                    if (now - last < TimeSpan.FromMinutes(config.ReminderIntervalMinutes)) continue;
                    _lastReminder[session.Id] = now;

                    // Si el sorteo termina antes del siguiente recordatorio, no tiene sentido avisar
                    if (session.EndsAt.HasValue && session.EndsAt.Value <= now.AddSeconds(reminderRules.StopBeforeEndSeconds)) continue;

                    var channelName = await GetChannelNameFromId(session.ChannelId);
                    if (string.IsNullOrEmpty(channelName)) continue;

                    var text = string.IsNullOrWhiteSpace(config.ReminderMessage)
                        ? $"🎁 Recordatorio: usa {config.EntryCommand} para participar en el giveaway de {config.PrizeName}. Participantes actuales: {session.TotalParticipants}"
                        : ProcessMessageVariables(config.ReminderMessage, config, session, session.TotalParticipants);
                    await AnnounceAsync(channelName, text);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error enviando recordatorio del giveaway {SessionId}", session.Id);
                }
            }

            // Limpieza por antigüedad. NO por "sesiones que ya no aparecen": el servicio de fondo corre una vez por tenant
            // y cada uno solo ve las suyas; borrar las ajenas hacía que el recordatorio saliera cada 5 s.
            if (_lastReminder.Count > 5000)
                foreach (var kv in _lastReminder.Where(kv => now - kv.Value > TimeSpan.FromDays(2)).ToList())
                    _lastReminder.TryRemove(kv.Key, out _);
        }

        // ========================================================================
        // WINNER RESPONSE TRACKING
        // ========================================================================

        /// <summary>
        /// Marca a un ganador como que ha respondido
        /// </summary>
        public async Task<bool> MarkWinnerAsResponded(string channelId, string username, string responseMessage, string platform = "twitch")
        {
            try
            {
                // Buscar sesión que está esperando respuestas de ganadores
                var session = await _context.GiveawaySessions
                    .Where(s => s.ChannelId == channelId && s.Status == "selecting_winners")
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
                        && p.Platform == platform
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
                        && !w.WasDisqualified
                        && !w.TimeoutProcessed);

                if (winner == null)
                {
                    _logger.LogDebug($"{username} no es un ganador sin respuesta en sesión {session.Id}");
                    return false;
                }

                // Fuera de plazo no cuenta (el servicio de fondo lo procesará como "no respondió")
                var sessionConfig = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);
                if (sessionConfig != null && DateTime.UtcNow > winner.SelectedAt.AddSeconds(sessionConfig.WinnerResponseTimeout))
                {
                    _logger.LogDebug($"{username} respondió fuera de plazo en sesión {session.Id}");
                    return false;
                }

                // Marcar como respondido
                winner.HasResponded = true;
                winner.RespondedAt = DateTime.UtcNow;
                winner.ResponseMessage = responseMessage;
                winner.TimeoutProcessed = true; // Para que el background service no lo procese

                await _context.SaveChangesAsync();

                _logger.LogInformation($"✅ Ganador {username} marcado como respondido en sesión {session.Id}");
                await PublishOverlayAsync(channelId);

                // Obtener nombre del canal para los anuncios
                var channelName = await GetChannelNameFromId(channelId);

                // Verificar si todos los ganadores han respondido
                var allWinners = await _context.GiveawayWinners
                    .Where(w => w.SessionId == session.Id && !w.IsBackup && !w.WasDisqualified)
                    .ToListAsync();

                var allResponded = allWinners.All(w => w.HasResponded);
                var gs = GiveawaySettings.Parse(sessionConfig?.Settings);
                var completed = false;

                if (allResponded && session.Status == "selecting_winners")
                {
                    _logger.LogInformation($"🎉 Todos los ganadores respondieron. Marcando sesión {session.Id} como completed");

                    session.Status = "completed";
                    session.UpdatedAt = DateTime.UtcNow;

                    await _context.SaveChangesAsync();
                    completed = true;
                }

                // Un solo mensaje: el de cierre si esta respuesta completó el giveaway; si no, la confirmación del ganador
                if (!string.IsNullOrEmpty(channelName))
                {
                    var text = completed
                        ? Say(gs.Messages.Completed, GiveawayMessages.DefaultCompleted,
                            ("responded", allWinners.Count(w => w.HasResponded).ToString()), ("total", allWinners.Count.ToString()),
                            ("winner", username), ("prize", sessionConfig?.PrizeName ?? ""))
                        : Say(gs.Messages.WinnerResponded, GiveawayMessages.DefaultWinnerResponded,
                            ("winner", username), ("user", username), ("prize", sessionConfig?.PrizeName ?? ""));
                    await AnnounceAsync(channelName, text);
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
