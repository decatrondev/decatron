using System.Collections.Concurrent;

namespace Decatron.Core.Services
{
    /// <summary>
    /// Un turno de audio por canal: solo una voz a la vez entre Speak Chat y Event Alerts.
    ///
    /// Cada módulo pide el turno ANTES de sintetizar (lo que se descarta no se genera ni se cobra),
    /// lo conserva mientras el overlay reproduce y lo suelta cuando el overlay avisa que terminó
    /// (<see cref="Complete"/>) o, si el aviso nunca llega (overlay cerrado o con código viejo),
    /// cuando vence el tiempo con el que el módulo lo armó (<see cref="AudioTurn.Arm"/>).
    ///
    /// Orden de llegada. Cola de hasta <see cref="MaxQueued"/> esperando por canal: si se llena se
    /// descarta el más antiguo. Quien espera más de <see cref="MaxWait"/> también se descarta.
    /// </summary>
    public sealed class ChannelAudioGate
    {
        public const int MaxQueued = 10;
        public static readonly TimeSpan MaxWait = TimeSpan.FromSeconds(30);
        /// <summary>Tiempo máximo de un turno que nadie armó ni cerró.</summary>
        public static readonly TimeSpan DefaultHold = TimeSpan.FromSeconds(60);

        private readonly ConcurrentDictionary<string, Lane> _lanes = new();

        /// <summary>
        /// Pide el turno del canal. Devuelve null si hubo que descartar la petición (cola llena
        /// o demasiada espera): el módulo no debe sintetizar.
        /// </summary>
        public Task<AudioTurn?> RequestAsync(string channel, string source)
            => GetLane(channel).RequestAsync(source, MaxWait, MaxQueued);

        /// <summary>
        /// ¿Este texto ya lo dijo (o lo tiene en espera) OTRO módulo hace menos de <see cref="DedupeWindow"/>?
        /// Sirve para que dos módulos no lean el mismo mensaje (p. ej. el cheer en Event Alerts y en Speak
        /// Chat). El mismo módulo sí puede repetirse: un espectador que escribe «gg» dos veces se lee dos veces.
        /// </summary>
        public bool SpokenByOtherSource(string channel, string source, string? text)
            => GetLane(channel).SpokenByOtherSource(source, Normalize(text));

        /// <summary>Anota que <paramref name="source"/> va a leer <paramref name="text"/> (llamar tras pasar la comprobación).</summary>
        public void Remember(string channel, string source, string? text)
            => GetLane(channel).Remember(source, Normalize(text));

        /// <summary>Minúsculas, espacios colapsados y sin los «cheer100» que Twitch deja en el texto de los bits.</summary>
        public static string Normalize(string? text)
        {
            if (string.IsNullOrWhiteSpace(text)) return "";
            var t = System.Text.RegularExpressions.Regex.Replace(text.ToLowerInvariant(), @"\bcheer\d+\b", " ");
            return System.Text.RegularExpressions.Regex.Replace(t, @"\s+", " ").Trim();
        }

        public static readonly TimeSpan DedupeWindow = TimeSpan.FromSeconds(30);

        /// <summary>El overlay terminó de reproducir el turno <paramref name="turnId"/>.</summary>
        public void Complete(string channel, string turnId)
        {
            if (_lanes.TryGetValue(Key(channel), out var lane)) lane.Complete(turnId);
        }

        /// <summary>Para diagnóstico y pruebas: cuántos esperan y si hay un turno en curso.</summary>
        public (bool Busy, int Waiting) Snapshot(string channel)
            => _lanes.TryGetValue(Key(channel), out var lane) ? lane.Snapshot() : (false, 0);

        private Lane GetLane(string channel) => _lanes.GetOrAdd(Key(channel), _ => new Lane());
        private static string Key(string channel) => (channel ?? "").Trim().ToLowerInvariant();
    }

    public sealed class AudioTurn
    {
        private readonly Lane _lane;
        private Timer? _timer;
        private int _released;

        internal AudioTurn(Lane lane, string source)
        {
            _lane = lane;
            Source = source;
            Id = Guid.NewGuid().ToString("N");
            Arm(ChannelAudioGate.DefaultHold);
        }

        public string Id { get; }
        public string Source { get; }

        /// <summary>Vence solo en <paramref name="holdFor"/> si el overlay no avisa antes.</summary>
        public void Arm(TimeSpan holdFor)
        {
            if (Volatile.Read(ref _released) == 1) return;
            var old = Interlocked.Exchange(ref _timer, new Timer(_ => Release(), null, holdFor, Timeout.InfiniteTimeSpan));
            old?.Dispose();
            // Si se soltó mientras armábamos, no dejar un temporizador huérfano
            if (Volatile.Read(ref _released) == 1) Interlocked.Exchange(ref _timer, null)?.Dispose();
        }

        /// <summary>Suelta el turno (idempotente) y deja pasar al siguiente.</summary>
        public void Release()
        {
            if (Interlocked.Exchange(ref _released, 1) == 1) return;
            Interlocked.Exchange(ref _timer, null)?.Dispose();
            _lane.Next(this);
        }
    }

    internal sealed class Lane
    {
        private sealed class Waiter
        {
            public readonly string Source;
            public readonly TaskCompletionSource<AudioTurn?> Tcs = new(TaskCreationOptions.RunContinuationsAsynchronously);
            public Waiter(string source) { Source = source; }
        }

        private readonly object _lock = new();
        private readonly LinkedList<Waiter> _queue = new();
        private AudioTurn? _current;
        private readonly List<(string Source, string Text, DateTime At)> _recent = new();

        public bool SpokenByOtherSource(string source, string text)
        {
            if (text.Length < 3) return false;
            lock (_lock)
            {
                var limit = DateTime.UtcNow - ChannelAudioGate.DedupeWindow;
                _recent.RemoveAll(r => r.At < limit);
                // Igual, o uno es el comienzo del otro (uno de los módulos corta el texto a su máximo de caracteres)
                return _recent.Any(r => r.Source != source &&
                    (r.Text == text || r.Text.StartsWith(text, StringComparison.Ordinal) || text.StartsWith(r.Text, StringComparison.Ordinal)));
            }
        }

        public void Remember(string source, string text)
        {
            if (text.Length < 3) return;
            lock (_lock) _recent.Add((source, text, DateTime.UtcNow));
        }

        public async Task<AudioTurn?> RequestAsync(string source, TimeSpan maxWait, int maxQueued)
        {
            Waiter waiter;
            lock (_lock)
            {
                if (_current == null)
                {
                    _current = new AudioTurn(this, source);
                    return _current;
                }

                if (_queue.Count >= maxQueued)
                {
                    var oldest = _queue.First!.Value;
                    _queue.RemoveFirst();
                    oldest.Tcs.TrySetResult(null);
                }

                waiter = new Waiter(source);
                _queue.AddLast(waiter);
            }

            using var cts = new CancellationTokenSource(maxWait);
            using var reg = cts.Token.Register(() =>
            {
                lock (_lock)
                {
                    for (var n = _queue.First; n != null; n = n.Next)
                    {
                        if (ReferenceEquals(n.Value, waiter)) { _queue.Remove(n); break; }
                    }
                }
                waiter.Tcs.TrySetResult(null);
            });

            return await waiter.Tcs.Task.ConfigureAwait(false);
        }

        public void Complete(string turnId)
        {
            AudioTurn? turn;
            lock (_lock) turn = _current;
            if (turn != null && turn.Id == turnId) turn.Release();
        }

        /// <summary>Un turno terminó: pasa el siguiente que siga esperando.</summary>
        internal void Next(AudioTurn finished)
        {
            lock (_lock)
            {
                if (!ReferenceEquals(_current, finished)) return;
                _current = null;

                while (_queue.First != null)
                {
                    var next = _queue.First.Value;
                    _queue.RemoveFirst();
                    var turn = new AudioTurn(this, next.Source);
                    if (next.Tcs.TrySetResult(turn)) { _current = turn; return; }
                    // Ya se había descartado por tiempo: su turno no sirve
                    turn.Release();
                    _current = null;
                }
            }
        }

        public (bool Busy, int Waiting) Snapshot()
        {
            lock (_lock) return (_current != null, _queue.Count);
        }
    }
}
