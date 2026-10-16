using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text.Json;
using Decatron.Attributes;
using Decatron.Core.Interfaces;
using Decatron.Core.Helpers;
using Decatron.Core.Models.LiveTranslation;
using Decatron.Data;
using Decatron.Services.LiveTranslation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    /// <summary>
    /// Traducción en vivo (doblaje por espectador). Plan: .dev/plans/REALTIME_TRANSLATION_PLAN.md
    ///
    /// Dos públicos: el streamer (config, estado, historial) y la extensión del espectador
    /// (estado público del canal, anónimo). La app de escritorio no pasa por aquí: se
    /// vincula en <see cref="DesktopController"/> y manda el audio por el canal
    /// <c>translation</c> del WebSocket de escritorio (TranslationDesktopChannel).
    /// </summary>
    [ApiController]
    [Route("api/live-translation")]
    [Decatron.Core.Interfaces.RequiresModule("module.live_translation")]
    public class LiveTranslationController : ControllerBase
    {
        private readonly DecatronDbContext _db;
        private readonly LiveTranslationSessionManager _mgr;
        private readonly ITtsCreditService _credits;
        private readonly Decatron.Services.Desktop.DesktopConnectionRegistry _desktop;
        private readonly Decatron.Services.AI.AiSettingsCache _aiSettings;
        private readonly ILogger<LiveTranslationController> _logger;
        private readonly Microsoft.Extensions.Options.IOptionsMonitor<LiveTranslationOptions> _optsMonitor;
        private readonly TranslationAccessService _access;
        private readonly IHubContext<Decatron.Hubs.TranslationHub> _hub;
        private readonly StreamerRoleService _roles;
        private readonly TranslationAccessRecheckService _recheck;
        private readonly TranslationAbuseGuard _abuse;

        public LiveTranslationController(
            DecatronDbContext db,
            LiveTranslationSessionManager mgr,
            ITtsCreditService credits,
            Decatron.Services.Desktop.DesktopConnectionRegistry desktop,
            Decatron.Services.AI.AiSettingsCache aiSettings,
            ILogger<LiveTranslationController> logger,
            Microsoft.Extensions.Options.IOptionsMonitor<LiveTranslationOptions> optsMonitor,
            TranslationAccessService access,
            IHubContext<Decatron.Hubs.TranslationHub> hub,
            StreamerRoleService roles,
            TranslationAccessRecheckService recheck,
            TranslationAbuseGuard abuse)
        {
            _roles = roles; _recheck = recheck; _abuse = abuse;
            _db = db; _mgr = mgr; _credits = credits; _desktop = desktop; _aiSettings = aiSettings; _logger = logger; _optsMonitor = optsMonitor;
            _access = access; _hub = hub;
        }

        // ─────────────────────────────────────────────────────────────────────
        // Público (extensión del espectador)
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>¿Este canal ofrece traducción y está traduciendo ahora mismo?</summary>
        [HttpGet("public/{login}")]
        [AllowAnonymous]
        [EnableCors("TournamentEmbed")]   // público y de solo lectura: lo consulta la extensión y páginas de terceros
        [EnableRateLimiting("live-translation-public")]
        public async Task<IActionResult> GetPublic(string login)
        {
            login = (login ?? "").Trim().ToLowerInvariant();
            if (login.Length is 0 or > 40) return BadRequest();

            var row = await (
                from u in _db.Users.AsNoTracking()
                join s in _db.LiveTranslationSettings.AsNoTracking() on u.Id equals s.UserId
                where u.Login.ToLower() == login && s.Enabled
                select new { u.Id, s.SourceLanguage, s.TargetLanguages, s.BackgroundVolume }
            ).FirstOrDefaultAsync();
            var paused = row != null && await _db.LiveTranslationAccess.AsNoTracking().AnyAsync(a => a.UserId == row.Id && a.Paused);

            if (row == null)
                return Ok(new { enabled = false, live = false, login });

            var status = _mgr.GetStatus(row.Id);
            return Ok(new
            {
                enabled = true,
                live = status != null,
                login,
                source = row.SourceLanguage,
                languages = row.TargetLanguages.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
                backgroundVolume = row.BackgroundVolume,
                paused,
                startedAt = status?.StartedAt,
                tuning = _optsMonitor.CurrentValue.ClientTuning.Sanitized(),
            });
        }

        /// <summary>Catálogo de voces por motor, para el dashboard.</summary>
        [HttpGet("voices")]
        [Authorize]
        public IActionResult GetVoices() => Ok(new
        {
            configured = _mgr.IsConfigured,
            engines = _mgr.Engines.Select(e => new
            {
                name = e.Name,
                configured = e.IsConfigured,
                supportsCloning = e.Name == "fish",
                voices = e.Voices,
            }),
            languages = LiveTranslator.SupportedLanguages,
        });

        // ─────────────────────────────────────────────────────────────────────
        // Streamer (dashboard)
        // ─────────────────────────────────────────────────────────────────────

        public record SettingsDto(
            bool Enabled,
            [MaxLength(10)] string SourceLanguage,
            List<string> TargetLanguages,
            [MaxLength(20)] string VoiceEngine,
            Dictionary<string, string>? Voices,
            bool AnnounceInChat,
            [MaxLength(400)] string? AnnounceMessage,
            [Range(0, 100)] int BackgroundVolume,
            bool RecordPhrases = false);

        [HttpGet("settings")]
        [Authorize]
        [RequirePermission("settings")]
        public async Task<IActionResult> GetSettings()
        {
            var userId = GetChannelOwnerId();
            var s = await _db.LiveTranslationSettings.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId)
                    ?? new LiveTranslationSettings { UserId = userId };
            return Ok(ToDto(s));
        }

        [HttpPut("settings")]
        [Authorize]
        [RequirePermission("settings", "control_total")]
        public async Task<IActionResult> UpdateSettings([FromBody] SettingsDto dto)
        {
            var userId = GetChannelOwnerId();
            var maxLangs = _mgr.Options.MaxLanguagesPerChannel;

            var source = (dto.SourceLanguage ?? "es").Trim().ToLowerInvariant();
            var targets = (dto.TargetLanguages ?? new()).Select(l => l.Trim().ToLowerInvariant())
                .Where(l => l.Length > 0 && l != source && LiveTranslator.SupportedLanguages.Contains(l))
                .Distinct().Take(maxLangs).ToList();
            if (dto.Enabled && targets.Count == 0)
                return BadRequest(new { success = false, message = "Elige al menos un idioma destino" });

            var engineName = _mgr.Engines.Any(e => e.Name == dto.VoiceEngine) ? dto.VoiceEngine : "deepgram";
            // Sin plan no hay créditos premium: la única voz posible es la estándar (Piper). Plan CREDITOS_UNIFICADOS.
            var tier = await Decatron.Core.Helpers.TierResolver.GetEffectiveTierAsync(_db, userId);
            if (string.Equals(tier, "free", StringComparison.OrdinalIgnoreCase) && _mgr.StandardEngine != null) engineName = "piper";
            var engine = _mgr.ResolveEngine(engineName);
            var voices = new Dictionary<string, string>();
            foreach (var lang in targets)
            {
                if (dto.Voices != null && dto.Voices.TryGetValue(lang, out var v) && !string.IsNullOrWhiteSpace(v))
                {
                    // Para motores con catálogo la voz tiene que existir; para Fish es un reference_id libre.
                    if (engine.Voices.Count == 0 || engine.Voices.Any(x => x.Id == v))
                        voices[lang] = v.Trim();
                }
            }

            var s = await _db.LiveTranslationSettings.FirstOrDefaultAsync(x => x.UserId == userId);
            if (s == null)
            {
                s = new LiveTranslationSettings { UserId = userId };
                _db.LiveTranslationSettings.Add(s);
            }
            s.Enabled = dto.Enabled;
            s.SourceLanguage = source;
            s.TargetLanguages = string.Join(",", targets);
            s.VoiceEngine = engineName;
            s.VoicesJson = JsonSerializer.Serialize(voices);
            s.AnnounceInChat = dto.AnnounceInChat;
            s.AnnounceMessage = string.IsNullOrWhiteSpace(dto.AnnounceMessage) ? null : dto.AnnounceMessage.Trim();
            s.BackgroundVolume = Math.Clamp(dto.BackgroundVolume, 0, 100);
            s.RecordPhrases = dto.RecordPhrases;
            s.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            // Si se apaga con la app conectada, se corta la sesión: la app verá el motivo.
            if (!s.Enabled && _mgr.IsActive(userId))
                await _mgr.StopAsync(userId, "stopped_by_user");
            // La app abierta se entera del cambio (activado/idiomas) sin reconectar.
            await _desktop.NotifyModuleChangedAsync(userId, "translation");

            return Ok(ToDto(s));
        }

        // ─────────────────────────────────────────────────────
        // Acceso y protección (.dev/plans/TRADUCCION_ACCESO_PLAN.md, Fase 1)
        // ─────────────────────────────────────────────────────

        public class AccessDto
        {
            /// <summary>null = el valor recomendado de tu plan</summary>
            public int? MaxListenersTotal { get; set; }
            public int? MaxListenersPerLanguage { get; set; }
            public int MaxActiveLanguages { get; set; } = 2;
            public int MaxConnectionsPerIp { get; set; } = 3;
            public bool Paused { get; set; }
            /// <summary>everyone | logged_in | followers | subscribers | vip | mods | list</summary>
            public string Mode { get; set; } = "everyone";
            public int MinFollowDays { get; set; } = 7;
            public int MinSubTier { get; set; } = 1;
            /// <summary>Usuarios separados por coma, espacio o línea</summary>
            public string? AllowList { get; set; }
            public string? BlockList { get; set; }
            /// <summary>Tope de créditos por transmisión; null = sin tope</summary>
            public long? CreditBudgetPerSession { get; set; }
        }

        private async Task<object> AccessViewAsync(long userId, LiveTranslationAccess? a)
        {
            var tier = await TierResolver.GetEffectiveTierAsync(_db, userId);
            var limits = LiveTranslationTierLimits.ForTier(tier);
            var login = await _db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => u.Login).FirstOrDefaultAsync() ?? "";
            var eff = TranslationAccessService.Resolve(userId, login, tier, a, _mgr.Options.MaxLanguagesPerChannel, Array.Empty<string>());
            var current = Decatron.Hubs.TranslationHub.ListenersByLanguage(login);
            var availability = await _roles.GetAvailabilityAsync(userId);

            // Cuánto cuesta una hora de voz según las últimas transmisiones reales (para que el tope se ponga con un número que se entienda)
            var recent = await _db.LiveTranslationSessions.AsNoTracking()
                .Where(x => x.UserId == userId && x.EndedAt != null && x.SpeechSeconds >= 120 && x.CreditsUsed > 0)
                .OrderByDescending(x => x.Id).Take(8).Select(x => new { x.SpeechSeconds, x.CreditsUsed }).ToListAsync();
            long? perSpeechHour = recent.Count >= 2 ? (long)Math.Round(recent.Sum(x => (double)x.CreditsUsed) / (recent.Sum(x => x.SpeechSeconds) / 3600.0)) : null;
            var hardened = _abuse.Active(login);

            return new
            {
                tier,
                cost = new { perSpeechHour, sessions = recent.Count },
                abuse = hardened == null ? null : new { since = hardened.Since, until = hardened.Until, reason = hardened.Reason, attempts = hardened.Attempts, rejections = hardened.Rejections },
                settings = new
                {
                    maxListenersTotal = a?.MaxListenersTotal,
                    maxListenersPerLanguage = a?.MaxListenersPerLanguage,
                    maxActiveLanguages = a?.MaxActiveLanguages ?? 2,
                    maxConnectionsPerIp = a?.MaxConnectionsPerIp ?? 3,
                    creditBudgetPerSession = a?.CreditBudgetPerSession,
                    paused = a?.Paused ?? false,
                    mode = eff.Mode,
                    minFollowDays = eff.MinFollowDays,
                    minSubTier = eff.MinSubTier,
                    allowList = string.Join("\n", eff.AllowList.OrderBy(x => x, StringComparer.Ordinal)),
                    blockList = string.Join("\n", eff.BlockList.OrderBy(x => x, StringComparer.Ordinal)),
                },
                // Qué niveles se pueden comprobar hoy con el token del streamer y qué permiso le falta a cada uno
                levels = new { availability.HasTwitch, availability.TokenValid, missing = availability.Missing },
                effective = new { eff.MaxListenersTotal, eff.MaxListenersPerLanguage, eff.MaxActiveLanguages, eff.MaxConnectionsPerIp, eff.Paused },
                ceilings = new { maxListeners = limits.MaxListeners, defaultListeners = limits.DefaultListeners, maxLanguages = _mgr.Options.MaxLanguagesPerChannel, maxConnectionsPerIp = TranslationAccessService.MaxConnectionsPerIpCeiling },
                now = new { listeners = current.Values.Sum(), byLanguage = current },
            };
        }

        [HttpGet("access")]
        [Authorize]
        [RequirePermission("settings")]
        public async Task<IActionResult> GetAccess()
        {
            var userId = GetChannelOwnerId();
            _roles.Invalidate(userId); // al abrir el panel se vuelven a validar los permisos (por si acaba de volver a autorizar con Twitch)
            var a = await _db.LiveTranslationAccess.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId);
            return Ok(await AccessViewAsync(userId, a));
        }

        [HttpPut("access")]
        [Authorize]
        [RequirePermission("settings", "control_total")]
        public async Task<IActionResult> UpdateAccess([FromBody] AccessDto dto)
        {
            var userId = GetChannelOwnerId();
            var tier = await TierResolver.GetEffectiveTierAsync(_db, userId);
            var limits = LiveTranslationTierLimits.ForTier(tier);
            var maxLangs = Math.Max(1, _mgr.Options.MaxLanguagesPerChannel);

            // Se recorta a lo que permite el plan y el sistema: un valor fuera de rango no se rechaza, se ajusta.
            int? total = dto.MaxListenersTotal.HasValue ? Math.Clamp(dto.MaxListenersTotal.Value, 1, limits.MaxListeners) : null;
            int? perLang = dto.MaxListenersPerLanguage.HasValue ? Math.Clamp(dto.MaxListenersPerLanguage.Value, 1, total ?? limits.MaxListeners) : null;

            // Nivel de acceso: solo uno de los conocidos, y los que se comprueban con Twitch solo si el token del streamer tiene el permiso
            // (si no, los espectadores se quedarían fuera sin poder entrar: se avisa en lugar de guardarlo).
            var mode = AccessEvaluator.Modes.Contains(dto.Mode) ? dto.Mode : "everyone";
            if (AccessEvaluator.NeedsTwitch(mode))
            {
                var availability = await _roles.GetAvailabilityAsync(userId);
                if (!availability.HasTwitch || availability.Missing.GetValueOrDefault(mode)?.Length > 0 || !availability.TokenValid)
                    return BadRequest(new { error = "unavailable", mode, hasTwitch = availability.HasTwitch, missing = availability.Missing.GetValueOrDefault(mode) ?? Array.Empty<string>() });
            }

            var a = await _db.LiveTranslationAccess.FirstOrDefaultAsync(x => x.UserId == userId);
            var wasPaused = a?.Paused ?? false;
            if (a == null) { a = new LiveTranslationAccess { UserId = userId }; _db.LiveTranslationAccess.Add(a); }
            a.MaxListenersTotal = total;
            a.MaxListenersPerLanguage = perLang;
            a.MaxActiveLanguages = Math.Clamp(dto.MaxActiveLanguages, 1, maxLangs);
            a.MaxConnectionsPerIp = Math.Clamp(dto.MaxConnectionsPerIp, 1, TranslationAccessService.MaxConnectionsPerIpCeiling);
            a.Paused = dto.Paused;
            a.Mode = mode;
            a.MinFollowDays = Math.Clamp(dto.MinFollowDays, 0, 3650);
            a.MinSubTier = Math.Clamp(dto.MinSubTier, 1, 3);
            a.AllowList = AccessEvaluator.NormalizeList(dto.AllowList);
            a.BlockList = AccessEvaluator.NormalizeList(dto.BlockList);
            a.CreditBudgetPerSession = dto.CreditBudgetPerSession is > 0 ? Math.Min(dto.CreditBudgetPerSession.Value, 1_000_000_000L) : null;
            a.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            var login = await _db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => u.Login).FirstOrDefaultAsync() ?? "";
            _access.Invalidate(login);
            // El botón de pánico también saca a quien ya escuchaba
            if (a.Paused && !wasPaused) await Decatron.Hubs.TranslationHub.EvictChannelAsync(_hub, login, "paused");
            // Quien ya escuchaba y no cumple el nivel nuevo (o quedó en bloqueados) sale ahora, sin esperar a la revisión periódica
            else await _recheck.RecheckAsync(login);
            _logger.LogInformation("[LiveTranslation] Acceso de {Login} actualizado (pausa: {Paused})", login, a.Paused);
            return Ok(await AccessViewAsync(userId, a));
        }

        /// <summary>Quién está escuchando ahora: la IP va enmascarada y el id es opaco (no sirve fuera de este canal).</summary>
        [HttpGet("access/listeners")]
        [Authorize]
        [RequirePermission("settings")]
        public async Task<IActionResult> GetListeners()
        {
            var login = await LoginOfAsync(GetChannelOwnerId());
            var list = Decatron.Hubs.TranslationHub.SnapshotChannel(login).Select(x => new
            {
                id = TranslationAbuseGuard.ListenerId(x.ConnectionId),
                lang = x.Lang,
                login = x.Who?.Login,
                ip = TranslationAbuseGuard.MaskIp(x.Ip),
                since = x.Since,
            });
            return Ok(new { listeners = list });
        }

        public class KickDto { public string? Id { get; set; } public bool Ban { get; set; } }

        /// <summary>Saca a un oyente. Con <c>ban</c>: si tiene sesión, entra en la lista de bloqueados; si es anónimo, se veta su IP 60 min.</summary>
        [HttpPost("access/kick")]
        [Authorize]
        [RequirePermission("settings", "control_total")]
        public async Task<IActionResult> KickListener([FromBody] KickDto dto)
        {
            var userId = GetChannelOwnerId();
            var login = await LoginOfAsync(userId);
            var target = Decatron.Hubs.TranslationHub.SnapshotChannel(login).FirstOrDefault(x => TranslationAbuseGuard.ListenerId(x.ConnectionId) == dto.Id);
            if (target.ConnectionId == null) return NotFound(new { error = "gone" });

            string how;
            if (dto.Ban && target.Who != null)
            {
                var a = await _db.LiveTranslationAccess.FirstOrDefaultAsync(x => x.UserId == userId);
                if (a == null) { a = new LiveTranslationAccess { UserId = userId }; _db.LiveTranslationAccess.Add(a); }
                a.BlockList = AccessEvaluator.NormalizeList(a.BlockList + "\n" + target.Who.Login);
                a.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                _access.Invalidate(login);
                how = "blocked";
            }
            else if (dto.Ban && target.Ip != "unknown") { _abuse.BanIp(login, target.Ip); how = "ip_banned"; }
            else how = "kicked";

            await Decatron.Hubs.TranslationHub.EvictConnectionAsync(_hub, target.ConnectionId, new Decatron.Hubs.ViewerCheckResult("blocked"));
            // Si se bloqueó a alguien con sesión, también salen sus otras pestañas
            if (how == "blocked") await _recheck.RecheckAsync(login);
            _logger.LogInformation("[LiveTranslation] {Login}: oyente {Id} sacado ({How})", login, dto.Id, how);
            return Ok(new { how });
        }

        /// <summary>Quita el endurecimiento automático: el canal vuelve al acceso que el streamer guardó.</summary>
        [HttpPost("access/abuse/clear")]
        [Authorize]
        [RequirePermission("settings", "control_total")]
        public async Task<IActionResult> ClearAbuse()
        {
            _abuse.Clear(await LoginOfAsync(GetChannelOwnerId()));
            return Ok(new { ok = true });
        }

        private async Task<string> LoginOfAsync(long userId) =>
            (await _db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => u.Login).FirstOrDefaultAsync() ?? "").ToLowerInvariant();

        /// <summary>Estado en vivo de la sesión actual (si hay) + saldo de créditos.</summary>
        [HttpGet("status")]
        [Authorize]
        [RequirePermission("settings")]
        public async Task<IActionResult> GetStatus()
        {
            var userId = GetChannelOwnerId();
            var balance = await _credits.GetBalanceAsync(userId);
            return Ok(new
            {
                configured = _mgr.IsConfigured,
                session = _mgr.GetStatus(userId),
                credits = new { balance.TotalAvailable, balance.IsUnlimited, balance.Tier },
            });
        }

        /// <summary>Corta la sesión en curso desde el dashboard.</summary>
        [HttpPost("stop")]
        [Authorize]
        [RequirePermission("settings", "control_total")]
        public async Task<IActionResult> Stop()
        {
            await _mgr.StopAsync(GetChannelOwnerId(), "stopped_by_user");
            return Ok(new { success = true });
        }

        [HttpGet("sessions")]
        [Authorize]
        [RequirePermission("settings")]
        public async Task<IActionResult> GetSessions([FromQuery] int limit = 30)
        {
            var userId = GetChannelOwnerId();
            var rows = await _db.LiveTranslationSessions.AsNoTracking()
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.StartedAt)
                .Take(Math.Clamp(limit, 1, 100))
                .ToListAsync();
            return Ok(rows.Select(ToDto));
        }

        // ─────────────────────────────────────────────────────────────────────
        // Admin
        // ─────────────────────────────────────────────────────────────────────

        [HttpGet("admin/active")]
        [Authorize]
        public IActionResult AdminActive()
        {
            if (!IsAdmin()) return Forbid();
            return Ok(new { configured = _mgr.IsConfigured, sessions = _mgr.GetAllStatuses() });
        }

        [HttpPost("admin/stop/{userId:long}")]
        [Authorize]
        public async Task<IActionResult> AdminStop(long userId)
        {
            if (!IsAdmin()) return Forbid();
            await _mgr.StopAsync(userId, "admin");
            return Ok(new { success = true });
        }

        /// <summary>
        /// Resumen para el admin: uso agregado, costo estimado por proveedor, límites vigentes
        /// y tarifas en créditos. Los precios de proveedor son estimaciones a tarifa de lista
        /// (Deepgram Nova-3 streaming ≈ $0.0077/min; Aura-2 ≈ $0.030/1k chars; Gemini Flash-Lite
        /// despreciable) — sirven para ver el orden de magnitud, no para contabilidad.
        /// </summary>
        [HttpGet("admin/overview")]
        [Authorize]
        public async Task<IActionResult> AdminOverview([FromQuery] int days = 30)
        {
            if (!IsAdmin()) return Forbid();
            var since = DateTime.UtcNow.AddDays(-Math.Clamp(days, 1, 365));
            var rows = await _db.LiveTranslationSessions.AsNoTracking()
                .Where(s => s.StartedAt >= since).ToListAsync();

            double connectedMin = rows.Sum(s => ((s.EndedAt ?? DateTime.UtcNow) - s.StartedAt).TotalMinutes);
            double speechMin = rows.Sum(s => s.SpeechSeconds) / 60.0;
            var chars = new Dictionary<string, long>();
            foreach (var s in rows)
            {
                try
                {
                    foreach (var (k, v) in JsonSerializer.Deserialize<Dictionary<string, long>>(s.CharsByLanguageJson ?? "{}") ?? new())
                        chars[k] = chars.GetValueOrDefault(k) + v;
                }
                catch { }
            }
            long totalChars = chars.Values.Sum();

            // Créditos realmente cobrados a los canales en el periodo (ledger).
            var credits = await _db.TtsCreditLedger.AsNoTracking()
                .Where(l => l.Feature == LiveTranslationCredits.Feature && l.Type == "consume" && l.CreatedAt >= since)
                .GroupBy(l => l.Engine)
                .Select(g => new { engine = g.Key, credits = -g.Sum(x => x.Credits), entries = g.Count(), chars = g.Sum(x => (long)(x.Chars ?? 0)) })
                .ToListAsync();

            var byStreamer = await (
                from s in _db.LiveTranslationSessions.AsNoTracking()
                join u in _db.Users.AsNoTracking() on s.UserId equals u.Id
                where s.StartedAt >= since
                group s by new { s.UserId, u.Login } into g
                orderby g.Sum(x => x.SpeechSeconds) descending
                select new { g.Key.UserId, g.Key.Login, sessions = g.Count(), speechSeconds = g.Sum(x => x.SpeechSeconds), credits = g.Sum(x => x.CreditsUsed), peakListeners = g.Max(x => x.PeakListeners) }
            ).Take(50).ToListAsync();

            var o = _mgr.Options;
            return Ok(new
            {
                days,
                sessions = rows.Count,
                connectedMinutes = Math.Round(connectedMin, 1),
                speechMinutes = Math.Round(speechMin, 1),
                charsByLanguage = chars,
                totalChars,
                creditsByEngine = credits,
                // Con audio continuo el STT se paga por minuto conectado, no por minuto hablado.
                estimatedCostUsd = new
                {
                    stt = Math.Round(connectedMin * 0.0077, 2),
                    tts = Math.Round(totalChars / 1000.0 * 0.030, 2),
                    total = Math.Round(connectedMin * 0.0077 + totalChars / 1000.0 * 0.030, 2),
                },
                byStreamer,
                active = _mgr.GetAllStatuses(),
                limits = new
                {
                    o.MaxConcurrentChannels, o.MaxLanguagesPerChannel, o.IdleLanguageStopSeconds,
                    o.IngestTimeoutSeconds, o.MaxQueuedUtterances, o.SttModel, translationModel = _aiSettings.TranslationModel, geminiFallbackModel = o.GeminiFallbackModel,
                },
                tariff = new
                {
                    sttCreditsPerSecond = o.SttCreditsPerSecond,
                    ttsCreditsPerChar = new { deepgram_aura = 8, fish = 4 },
                    note = "1 crédito = 1 carácter de voz estándar. El saldo es el mismo que usan Speak Chat, alertas, tips y timers; el tier define la cuota mensual y los paquetes se compran aparte.",
                },
            });
        }

        [HttpGet("admin/sessions")]
        [Authorize]
        public async Task<IActionResult> AdminSessions([FromQuery] int days = 30)
        {
            if (!IsAdmin()) return Forbid();
            var since = DateTime.UtcNow.AddDays(-Math.Clamp(days, 1, 365));
            var rows = await (
                from s in _db.LiveTranslationSessions.AsNoTracking()
                join u in _db.Users.AsNoTracking() on s.UserId equals u.Id
                where s.StartedAt >= since
                orderby s.StartedAt descending
                select new { s, u.Login }
            ).Take(500).ToListAsync();
            return Ok(rows.Select(r => new
            {
                r.Login,
                session = ToDto(r.s),
            }));
        }

        // ─────────────────────────────────────────────────────────────────────

        private static object ToDto(LiveTranslationSettings s)
        {
            Dictionary<string, string> voices;
            try { voices = JsonSerializer.Deserialize<Dictionary<string, string>>(s.VoicesJson ?? "{}") ?? new(); }
            catch { voices = new(); }
            return new
            {
                s.Enabled,
                s.SourceLanguage,
                TargetLanguages = s.TargetLanguageList,
                s.VoiceEngine,
                Voices = voices,
                s.AnnounceInChat,
                s.AnnounceMessage,
                s.BackgroundVolume,
                s.RecordPhrases,
                s.UpdatedAt,
            };
        }

        private static object ToDto(LiveTranslationSession s)
        {
            Dictionary<string, long> chars;
            try { chars = JsonSerializer.Deserialize<Dictionary<string, long>>(s.CharsByLanguageJson ?? "{}") ?? new(); }
            catch { chars = new(); }
            return new
            {
                s.Id, s.StartedAt, s.EndedAt, s.SpeechSeconds, s.Segments,
                CharsByLanguage = chars, s.PeakListeners, s.CreditsUsed, s.EndReason,
            };
        }

        private long GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(claim, out var id)) return id;
            throw new UnauthorizedAccessException("User not found");
        }

        private long GetChannelOwnerId()
        {
            var session = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(session) && long.TryParse(session, out var sid)) return sid;
            var claim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(claim, out var cid)) return cid;
            return GetUserId();
        }

        private bool IsAdmin()
        {
            var username = User.FindFirst("login")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(username)) return false;
            return _db.SystemAdmins.Any(a => a.Username.ToLower() == username.ToLower() && a.Role == "owner");
        }
    }
}
