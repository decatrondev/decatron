using System.Collections.Concurrent;
using System.Text.Json;
using System.Threading.Channels;
using Decatron.Core.Interfaces;
using Decatron.Core.Models.LiveTranslation;
using Decatron.Data;
using Decatron.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Services.LiveTranslation
{
    public static class LiveTranslationCredits
    {
        /// <summary>Valor de <c>feature</c> en tts_credit_ledger.</summary>
        public const string Feature = "live_translation";
    }

    /// <summary>
    /// Estado que se manda a la app de escritorio y al dashboard cada pocos segundos.
    /// </summary>
    public record ChannelStatus(
        bool Active, string Login, string SourceLanguage, IReadOnlyList<string> Languages,
        IReadOnlyDictionary<string, int> Listeners, IReadOnlyList<string> ActivePipelines,
        double SpeechSeconds, int Segments, long CreditsUsed, DateTime? StartedAt, string? LastError);

    /// <summary>
    /// Dueño de todas las sesiones de traducción en vivo del servidor. Singleton.
    ///
    /// Una sesión por canal (la app de escritorio conectada), y dentro de ella un pipeline
    /// por idioma destino que solo existe mientras alguien lo escucha. El audio entra por
    /// <see cref="PushAudioAsync"/>, el STT emite frases, cada frase se cobra una vez
    /// (STT) y se reparte a los pipelines, que traducen, cobran (TTS) y emiten al grupo de
    /// SignalR de ese canal+idioma.
    /// </summary>
    public class LiveTranslationSessionManager : ITranslationListenerNotifier
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly IHubContext<TranslationHub> _hub;
        private readonly LiveTranslator _translator;
        private readonly IReadOnlyDictionary<string, ITranslationTtsEngine> _engines;
        private readonly IMessageSender _chat;
        private readonly LiveTranslationOptions _opts;
        private readonly string _deepgramKey;
        private readonly ILogger<LiveTranslationSessionManager> _logger;

        private readonly ConcurrentDictionary<long, ChannelSession> _byUser = new();
        private readonly ConcurrentDictionary<string, ChannelSession> _byLogin = new();

        public LiveTranslationSessionManager(
            IServiceScopeFactory scopes,
            IHubContext<TranslationHub> hub,
            LiveTranslator translator,
            IEnumerable<ITranslationTtsEngine> engines,
            IMessageSender chat,
            IOptions<LiveTranslationOptions> opts,
            IConfiguration config,
            ILogger<LiveTranslationSessionManager> logger)
        {
            _scopes = scopes;
            _hub = hub;
            _translator = translator;
            _engines = engines.ToDictionary(e => e.Name, StringComparer.OrdinalIgnoreCase);
            _chat = chat;
            _opts = opts.Value;
            _deepgramKey = config["Deepgram:ApiKey"] ?? "";
            _logger = logger;
        }

        public bool IsConfigured => !string.IsNullOrWhiteSpace(_deepgramKey) && _translator.IsConfigured;

        public IReadOnlyList<ITranslationTtsEngine> Engines => _engines.Values.ToList();

        public ITranslationTtsEngine ResolveEngine(string? name)
        {
            if (name != null && _engines.TryGetValue(name, out var e) && e.IsConfigured) return e;
            return _engines["deepgram"];
        }

        // ─────────────────────────────────────────────────────────────────────
        // Ciclo de vida de la sesión (lo llama el WebSocket de ingesta)
        // ─────────────────────────────────────────────────────────────────────

        public bool IsActive(long userId) => _byUser.ContainsKey(userId);
        public bool IsActive(string login) => _byLogin.ContainsKey(login.ToLowerInvariant());

        public IReadOnlyList<ChannelStatus> GetAllStatuses() => _byUser.Values.Select(s => s.Snapshot()).ToList();

        public ChannelStatus? GetStatus(long userId) => _byUser.TryGetValue(userId, out var s) ? s.Snapshot() : null;

        /// <summary>
        /// Abre una sesión para un canal. Lanza <see cref="InvalidOperationException"/> con
        /// un mensaje apto para la app si no se puede (deshabilitado, sin créditos, ya hay
        /// otra app conectada, servidor lleno).
        /// </summary>
        public async Task<ChannelSession> StartAsync(long userId, long? deviceId, CancellationToken ct)
        {
            if (!IsConfigured) throw new InvalidOperationException("La traducción en vivo no está configurada en el servidor");
            if (_byUser.TryGetValue(userId, out var previous))
            {
                // La app se reconectó (o se abrió en otra PC) mientras la sesión anterior
                // seguía viva del lado del servidor por una conexión a medio cerrar. El canal
                // es el mismo streamer: la nueva releva a la vieja en vez de quedarse fuera.
                _logger.LogInformation("[LiveTranslation] {Login}: nueva app releva a la sesión {Id}", previous.Login, previous.SessionId);
                await StopAsync(userId, "replaced");
            }
            if (_byUser.Count >= _opts.MaxConcurrentChannels) throw new InvalidOperationException("El servidor está al máximo de canales traduciendo; intenta más tarde");

            LiveTranslationSettings settings;
            string login;
            long sessionId;
            using (var scope = _scopes.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
                    ?? throw new InvalidOperationException("Canal no encontrado");
                login = user.Login.ToLowerInvariant();

                settings = await db.LiveTranslationSettings.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == userId, ct)
                    ?? throw new InvalidOperationException("Activa la traducción en vivo desde el dashboard primero");
                if (!settings.Enabled) throw new InvalidOperationException("La traducción en vivo está desactivada en el dashboard");
                if (settings.TargetLanguageList.Count == 0) throw new InvalidOperationException("No hay idiomas destino configurados");

                var credits = scope.ServiceProvider.GetRequiredService<ITtsCreditService>();
                var balance = await credits.GetBalanceAsync(userId);
                if (!balance.IsUnlimited && balance.TotalAvailable <= 0)
                    throw new InvalidOperationException("Sin créditos. Compra un paquete en el dashboard para traducir en vivo");

                var row = new LiveTranslationSession { UserId = userId, DeviceId = deviceId };
                db.LiveTranslationSessions.Add(row);
                await db.SaveChangesAsync(ct);
                sessionId = row.Id;
            }

            var session = new ChannelSession(this, userId, login, sessionId, settings);
            if (!_byUser.TryAdd(userId, session))
                throw new InvalidOperationException("Dos apps intentaron iniciar a la vez; vuelve a pulsar Iniciar");
            _byLogin[login] = session;

            try
            {
                await session.OpenSttAsync(ct);
            }
            catch (Exception ex)
            {
                _byUser.TryRemove(userId, out _);
                _byLogin.TryRemove(login, out _);
                await PersistEndAsync(session, "error");
                throw new InvalidOperationException("No se pudo conectar con el servicio de transcripción: " + ex.Message);
            }

            // Pipelines para los idiomas que ya tienen gente esperando (la extensión se
            // conecta antes de que el streamer arranque la app).
            foreach (var (lang, n) in TranslationHub.ListenersByLanguage(login))
                if (n > 0) session.EnsurePipeline(lang);

            await BroadcastStatusAsync(session);
            _ = AnnounceAsync(session);
            _logger.LogInformation("[LiveTranslation] {Login} inició sesión {Id} → {Langs}", login, sessionId, settings.TargetLanguages);
            return session;
        }

        public async Task StopAsync(long userId, string reason)
        {
            if (!_byUser.TryRemove(userId, out var session)) return;
            _byLogin.TryRemove(session.Login, out _);
            await session.CloseAsync();
            await PersistEndAsync(session, reason);
            await BroadcastStatusAsync(session, ended: true);
            _logger.LogInformation("[LiveTranslation] {Login} cerró sesión {Id} ({Reason}): {Secs:F0}s de voz, {Segs} frases, {Credits} créditos",
                session.Login, session.SessionId, reason, session.SpeechSeconds, session.Segments, session.CreditsUsed);
        }

        public Task PushAudioAsync(long userId, ReadOnlyMemory<byte> pcm16, CancellationToken ct) =>
            _byUser.TryGetValue(userId, out var s) ? s.PushAudioAsync(pcm16, ct) : Task.CompletedTask;

        // ─────────────────────────────────────────────────────────────────────
        // Oyentes (lo llama el hub)
        // ─────────────────────────────────────────────────────────────────────

        public Task<object> OnListenerChangedAsync(string login, string lang, int listeners, bool joined)
        {
            if (_byLogin.TryGetValue(login.ToLowerInvariant(), out var session))
            {
                if (joined && listeners > 0) session.EnsurePipeline(lang);
                session.TouchPeak();
                return Task.FromResult<object>(session.PublicStatus());
            }
            return Task.FromResult<object>(new { active = false, login, languages = Array.Empty<string>() });
        }

        // ─────────────────────────────────────────────────────────────────────
        // Internos usados por ChannelSession
        // ─────────────────────────────────────────────────────────────────────

        internal IHubContext<TranslationHub> Hub => _hub;
        internal LiveTranslator Translator => _translator;
        public LiveTranslationOptions Options => _opts;
        internal string DeepgramKey => _deepgramKey;
        internal ILogger Logger => _logger;

        /// <summary>Cobra créditos. Devuelve false si no alcanzó (no descuenta nada).</summary>
        internal async Task<(bool ok, long charged)> ChargeAsync(long userId, int units, string engine, string? voice, string? language)
        {
            using var scope = _scopes.CreateScope();
            var credits = scope.ServiceProvider.GetRequiredService<ITtsCreditService>();
            var r = await credits.TryConsumeAsync(userId, units, engine, LiveTranslationCredits.Feature, voice, language);
            return (r.Allowed, r.Allowed ? r.CreditsCharged : 0);
        }

        internal async Task PersistProgressAsync(ChannelSession s)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var row = await db.LiveTranslationSessions.FindAsync(s.SessionId);
                if (row == null) return;
                s.FillRow(row);
                await db.SaveChangesAsync();
            }
            catch (Exception ex) { _logger.LogWarning(ex, "[LiveTranslation] no se pudo guardar progreso de sesión {Id}", s.SessionId); }
        }

        private async Task PersistEndAsync(ChannelSession s, string reason)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var row = await db.LiveTranslationSessions.FindAsync(s.SessionId);
                if (row == null) return;
                s.FillRow(row);
                row.EndedAt = DateTime.UtcNow;
                row.EndReason = reason;
                await db.SaveChangesAsync();
            }
            catch (Exception ex) { _logger.LogWarning(ex, "[LiveTranslation] no se pudo cerrar sesión {Id}", s.SessionId); }
        }

        internal Task BroadcastStatusAsync(ChannelSession s, bool ended = false)
        {
            var status = ended ? new { active = false, login = s.Login, languages = Array.Empty<string>() } : (object)s.PublicStatus();
            var tasks = s.Settings.TargetLanguageList
                .Select(lang => _hub.Clients.Group(TranslationHub.GroupName(s.Login, lang)).SendAsync("Status", status));
            return Task.WhenAll(tasks);
        }

        private async Task AnnounceAsync(ChannelSession s)
        {
            if (!s.Settings.AnnounceInChat) return;
            try
            {
                var langs = string.Join(", ", s.Settings.TargetLanguageList.Select(l => l.ToUpperInvariant()));
                var msg = string.IsNullOrWhiteSpace(s.Settings.AnnounceMessage)
                    ? $"🌐 Este stream se puede escuchar en {langs} con la extensión Decatron Translate: https://decatron.net/translate"
                    : s.Settings.AnnounceMessage.Replace("{languages}", langs).Replace("{idiomas}", langs);
                await _chat.SendMessageAsync(s.Login, msg);
            }
            catch (Exception ex) { _logger.LogDebug(ex, "[LiveTranslation] no se pudo anunciar en chat de {Login}", s.Login); }
        }

        /// <summary>Corte por falta de créditos u otro motivo iniciado desde dentro de la sesión.</summary>
        internal void RequestStop(ChannelSession s, string reason) => _ = StopAsync(s.UserId, reason);
    }

    // ═════════════════════════════════════════════════════════════════════════

    /// <summary>La app de un streamer conectada: su STT y sus pipelines por idioma.</summary>
    public sealed class ChannelSession
    {
        private readonly LiveTranslationSessionManager _mgr;
        private readonly ConcurrentDictionary<string, LanguagePipeline> _pipelines = new(StringComparer.OrdinalIgnoreCase);
        private readonly CancellationTokenSource _cts = new();
        private readonly Dictionary<string, string> _voices;
        private DeepgramLiveSttClient? _stt;
        private long _seq;
        private long _creditsUsed;
        private int _segments;
        private double _speechSeconds;
        private int _peakListeners;
        private string? _lastError;
        private DateTime _lastPersistUtc = DateTime.UtcNow;
        private readonly ConcurrentDictionary<string, long> _charsByLang = new(StringComparer.OrdinalIgnoreCase);

        public long UserId { get; }
        public string Login { get; }
        public long SessionId { get; }
        public LiveTranslationSettings Settings { get; }
        public DateTime StartedAt { get; } = DateTime.UtcNow;
        public DateTime LastAudioUtc { get; private set; } = DateTime.UtcNow;
        /// <summary>Cuándo llegó el primer frame de audio: reloj de referencia para el eje de tiempo de Deepgram.</summary>
        public DateTime? FirstAudioUtc { get; private set; }
        public CancellationToken Token => _cts.Token;

        public double SpeechSeconds => _speechSeconds;
        public int Segments => _segments;
        public long CreditsUsed => Interlocked.Read(ref _creditsUsed);

        internal ChannelSession(LiveTranslationSessionManager mgr, long userId, string login, long sessionId, LiveTranslationSettings settings)
        {
            _mgr = mgr; UserId = userId; Login = login; SessionId = sessionId; Settings = settings;
            try { _voices = JsonSerializer.Deserialize<Dictionary<string, string>>(settings.VoicesJson ?? "{}") ?? new(); }
            catch { _voices = new(); }
        }

        internal async Task OpenSttAsync(CancellationToken ct)
        {
            _stt = new DeepgramLiveSttClient(_mgr.DeepgramKey, _mgr.Options.SttModel, Settings.SourceLanguage, _mgr.Logger);
            _stt.UtteranceReady += OnUtterance;
            _stt.Closed += OnSttClosed;
            await _stt.ConnectAsync(ct);
        }

        private void OnSttClosed(Exception? ex)
        {
            if (_cts.IsCancellationRequested) return;
            _lastError = "STT cerrado" + (ex != null ? ": " + ex.Message : "");
            _mgr.Logger.LogWarning(ex, "[LiveTranslation] STT de {Login} se cerró", Login);
            _mgr.RequestStop(this, "error");
        }

        public Task PushAudioAsync(ReadOnlyMemory<byte> pcm16, CancellationToken ct)
        {
            LastAudioUtc = DateTime.UtcNow;
            FirstAudioUtc ??= LastAudioUtc;
            return _stt?.SendAudioAsync(pcm16, ct) ?? Task.CompletedTask;
        }

        internal void EnsurePipeline(string lang)
        {
            lang = lang.ToLowerInvariant();
            if (!Settings.TargetLanguageList.Contains(lang)) return;
            _pipelines.GetOrAdd(lang, l =>
            {
                var engine = _mgr.ResolveEngine(Settings.VoiceEngine);
                var voice = _voices.TryGetValue(l, out var v) && !string.IsNullOrWhiteSpace(v) ? v : engine.DefaultVoiceFor(l);
                _mgr.Logger.LogInformation("[LiveTranslation] {Login}: pipeline {Lang} con {Engine}/{Voice}", Login, l, engine.Name, voice);
                return new LanguagePipeline(this, _mgr, l, engine, voice);
            });
        }

        internal void TouchPeak()
        {
            var n = TranslationHub.CountListeners(Login);
            if (n > _peakListeners) _peakListeners = n;
        }

        private void OnUtterance(Utterance u)
        {
            _ = HandleUtteranceAsync(u);
        }

        private async Task HandleUtteranceAsync(Utterance u)
        {
            if (_cts.IsCancellationRequested) return;
            var seconds = Math.Max(0.5, u.EndSec - u.StartSec);

            // El STT se cobra una vez por frase aunque haya cinco idiomas. Se cobra
            // siempre, haya oyentes o no, porque Deepgram ya lo transcribió.
            var units = (int)Math.Ceiling(seconds * _mgr.Options.SttCreditsPerSecond);
            var (ok, charged) = await _mgr.ChargeAsync(UserId, units, "live_stt", null, Settings.SourceLanguage);
            if (!ok)
            {
                _lastError = "Sin créditos";
                _mgr.RequestStop(this, "no_credits");
                return;
            }
            Interlocked.Add(ref _creditsUsed, charged);
            _speechSeconds += seconds;
            Interlocked.Increment(ref _segments);
            TouchPeak();

            var seq = Interlocked.Increment(ref _seq);
            foreach (var p in _pipelines.Values)
                p.Enqueue(new QueuedUtterance(seq, u));

            // Apagar pipelines sin oyentes desde hace rato: se hace aquí porque es el
            // momento en que gastaríamos dinero en ellos.
            foreach (var (lang, p) in _pipelines)
            {
                if (TranslationHub.CountListeners(Login, lang) > 0) { p.LastListenerUtc = DateTime.UtcNow; continue; }
                if ((DateTime.UtcNow - p.LastListenerUtc).TotalSeconds > _mgr.Options.IdleLanguageStopSeconds && _pipelines.TryRemove(lang, out var dead))
                {
                    dead.Dispose();
                    _mgr.Logger.LogInformation("[LiveTranslation] {Login}: pipeline {Lang} apagado por falta de oyentes", Login, lang);
                }
            }

            if ((DateTime.UtcNow - _lastPersistUtc).TotalSeconds > 30)
            {
                _lastPersistUtc = DateTime.UtcNow;
                await _mgr.PersistProgressAsync(this);
            }
        }

        internal void AddTtsUsage(string lang, int chars, long credits)
        {
            _charsByLang.AddOrUpdate(lang, chars, (_, c) => c + chars);
            Interlocked.Add(ref _creditsUsed, credits);
        }

        internal void SetError(string msg) => _lastError = msg;

        internal async Task CloseAsync()
        {
            // Primero se cierra el STT (que vacía la última frase hacia los pipelines) y
            // se les da un momento para terminar lo que tengan; recién después se cancela.
            if (_stt != null) { _stt.Closed -= OnSttClosed; await _stt.CloseAsync(); }
            await WaitForPipelinesAsync(TimeSpan.FromSeconds(8));
            _cts.Cancel();
            foreach (var p in _pipelines.Values) p.Dispose();
            _pipelines.Clear();
            if (_stt != null) await _stt.DisposeAsync();
        }

        private async Task WaitForPipelinesAsync(TimeSpan max)
        {
            var until = DateTime.UtcNow + max;
            while (DateTime.UtcNow < until && _pipelines.Values.Any(p => p.Busy))
                await Task.Delay(100);
        }

        internal void FillRow(LiveTranslationSession row)
        {
            row.SpeechSeconds = _speechSeconds;
            row.Segments = _segments;
            row.CharsByLanguageJson = JsonSerializer.Serialize(_charsByLang);
            row.PeakListeners = _peakListeners;
            row.CreditsUsed = CreditsUsed;
        }

        public ChannelStatus Snapshot() => new(
            true, Login, Settings.SourceLanguage, Settings.TargetLanguageList,
            TranslationHub.ListenersByLanguage(Login), _pipelines.Keys.ToList(),
            _speechSeconds, _segments, CreditsUsed, StartedAt, _lastError);

        /// <summary>Lo que ve la extensión: sin créditos ni errores internos.</summary>
        public object PublicStatus() => new
        {
            active = true,
            login = Login,
            source = Settings.SourceLanguage,
            languages = Settings.TargetLanguageList,
            listeners = TranslationHub.ListenersByLanguage(Login),
            backgroundVolume = Settings.BackgroundVolume,
            startedAt = StartedAt,
        };
    }

    // ═════════════════════════════════════════════════════════════════════════

    internal record QueuedUtterance(long Seq, Utterance U);

    /// <summary>
    /// Traduce y sintetiza en orden para un idioma. Un solo worker por idioma para que
    /// los segmentos salgan en el orden en que se dijeron; si el streamer habla más
    /// rápido de lo que el pipeline procesa, se descartan las frases más viejas y se
    /// avisa al espectador, antes que acumular retraso.
    /// </summary>
    internal sealed class LanguagePipeline : IDisposable
    {
        private readonly ChannelSession _session;
        private readonly LiveTranslationSessionManager _mgr;
        private readonly string _lang;
        private readonly ITranslationTtsEngine _engine;
        private readonly string _voice;
        private readonly Channel<QueuedUtterance> _queue;
        private readonly CancellationTokenSource _cts;
        private readonly string _group;

        public DateTime LastListenerUtc { get; set; } = DateTime.UtcNow;

        /// <summary>Hay frases en cola o una en proceso.</summary>
        public bool Busy => _queue.Reader.Count > 0 || _processing;
        private volatile bool _processing;

        public LanguagePipeline(ChannelSession session, LiveTranslationSessionManager mgr, string lang, ITranslationTtsEngine engine, string voice)
        {
            _session = session; _mgr = mgr; _lang = lang; _engine = engine; _voice = voice;
            _group = TranslationHub.GroupName(session.Login, lang);
            _cts = CancellationTokenSource.CreateLinkedTokenSource(session.Token);
            _queue = Channel.CreateBounded<QueuedUtterance>(new BoundedChannelOptions(mgr.Options.MaxQueuedUtterances)
            {
                FullMode = BoundedChannelFullMode.DropOldest,
                SingleReader = true,
            }, dropped => _ = Notify("SegmentDropped", new { seq = dropped.Seq, lang = _lang }));
            _ = Task.Run(WorkerAsync);
        }

        public void Enqueue(QueuedUtterance q) => _queue.Writer.TryWrite(q);

        private async Task WorkerAsync()
        {
            var ct = _cts.Token;
            try
            {
                await foreach (var q in _queue.Reader.ReadAllAsync(ct))
                {
                    _processing = true;
                    try { await ProcessAsync(q, ct); }
                    catch (OperationCanceledException) when (ct.IsCancellationRequested) { return; }
                    catch (Exception ex)
                    {
                        _session.SetError($"{_lang}: {ex.Message}");
                        _mgr.Logger.LogWarning(ex, "[LiveTranslation] {Login}/{Lang} falló seq {Seq}", _session.Login, _lang, q.Seq);
                    }
                    finally { _processing = false; }
                }
            }
            catch (OperationCanceledException) { }
        }

        private async Task ProcessAsync(QueuedUtterance q, CancellationToken ct)
        {
            var u = q.U;
            var translated = await _mgr.Translator.TranslateAsync(u.Text, _session.Settings.SourceLanguage, _lang, ct);

            var (ok, charged) = await _mgr.ChargeAsync(_session.UserId, translated.Length, _engine.CreditEngine, _voice, _lang);
            if (!ok)
            {
                _session.SetError("Sin créditos");
                _mgr.RequestStop(_session, "no_credits");
                return;
            }
            _session.AddTtsUsage(_lang, translated.Length, charged);

            // Cuánto tardó Deepgram en cerrar la frase desde que el streamer calló: el audio
            // llega en tiempo real, así que "fin de habla" ≈ primer frame + t1.
            double? sttLag = _session.FirstAudioUtc is { } f0 ? (u.FinalAtUtc - f0).TotalSeconds - u.EndSec : null;
            var start = new
            {
                seq = q.Seq, lang = _lang, t0 = u.StartSec, t1 = u.EndSec,
                source = u.Text, text = translated, sttAt = u.FinalAtUtc, sttLag,
            };
            await Notify("SegmentStart", start);

            long bytes = 0;
            try
            {
                await foreach (var chunk in _engine.SynthesizeAsync(translated, _voice, ct))
                {
                    bytes += chunk.Length;
                    await Notify("SegmentChunk", new { seq = q.Seq, data = Convert.ToBase64String(chunk.Span) });
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // El texto ya salió (SegmentStart) así que el espectador al menos lee el subtítulo.
                await Notify("SegmentEnd", new { seq = q.Seq, bytes, error = true });
                throw;
            }
            await Notify("SegmentEnd", new { seq = q.Seq, bytes, error = false });
        }

        private Task Notify(string method, object payload) =>
            _mgr.Hub.Clients.Group(_group).SendAsync(method, payload, _cts.Token);

        public void Dispose()
        {
            _cts.Cancel();
            _queue.Writer.TryComplete();
            _cts.Dispose();
        }
    }
}
