using System.Threading.Channels;

namespace Decatron.Services.LiveTranslation
{
    /// <summary>
    /// Dos etapas encadenadas que trabajan a la vez: mientras la etapa de entrega (voz) emite la
    /// frase N, la etapa de preparación (traducción) ya trabaja en la N+1. El orden de salida se
    /// mantiene porque cada etapa tiene un único lector y las frases pasan por una cola FIFO.
    ///
    /// Antes todo iba en serie (traducir → sintetizar → siguiente) y la latencia de cada frase se
    /// sumaba a la de las anteriores. Sin I/O propio: las etapas son delegados, así que se prueba
    /// con retardos simulados.
    /// </summary>
    internal sealed class TwoStageWorker<TIn, TMid> : IDisposable where TMid : class
    {
        private readonly Channel<TIn> _in;
        private readonly Channel<TMid> _mid;
        private readonly Func<TIn, CancellationToken, Task<TMid?>> _prepare;
        private readonly Func<TMid, CancellationToken, Task> _deliver;
        private readonly Action<object, Exception> _onError;
        private readonly CancellationToken _ct;
        private int _inFlight;

        /// <param name="queueCapacity">Frases esperando para entrar; si se llena se descarta la más vieja.</param>
        /// <param name="readyCapacity">Frases ya preparadas esperando su turno de entrega; si se llena, la preparación espera.</param>
        /// <param name="prepare">Etapa A. Devuelve null para saltarse la frase (no se entrega).</param>
        /// <param name="deliver">Etapa B, en orden.</param>
        public TwoStageWorker(int queueCapacity, int readyCapacity,
            Func<TIn, CancellationToken, Task<TMid?>> prepare, Func<TMid, CancellationToken, Task> deliver,
            Action<TIn> onDropped, Action<object, Exception> onError, CancellationToken ct)
        {
            _prepare = prepare; _deliver = deliver; _onError = onError; _ct = ct;
            _in = Channel.CreateBounded<TIn>(new BoundedChannelOptions(Math.Max(1, queueCapacity))
            {
                FullMode = BoundedChannelFullMode.DropOldest,
                SingleReader = true,
            }, dropped => onDropped(dropped));
            _mid = Channel.CreateBounded<TMid>(new BoundedChannelOptions(Math.Max(1, readyCapacity))
            {
                FullMode = BoundedChannelFullMode.Wait,
                SingleReader = true,
                SingleWriter = true,
            });
            _ = Task.Run(PrepareLoopAsync);
            _ = Task.Run(DeliverLoopAsync);
        }

        public void Enqueue(TIn item) => _in.Writer.TryWrite(item);

        /// <summary>Frases que entraron y todavía no terminaron de entregarse (en cola, preparándose, listas o sonando).</summary>
        public int InFlight => Volatile.Read(ref _inFlight);
        public int Queued => _in.Reader.Count;
        public bool Busy => Queued > 0 || InFlight > 0;

        /// <summary>
        /// Frases atrasadas de verdad: las que esperan en cola más las que van acumuladas dentro del
        /// pipeline. Una en preparación y otra sonando es el funcionamiento normal y no cuenta.
        /// </summary>
        public int Pending => Queued + Math.Max(0, InFlight - 1);

        private async Task PrepareLoopAsync()
        {
            try
            {
                await foreach (var item in _in.Reader.ReadAllAsync(_ct))
                {
                    Interlocked.Increment(ref _inFlight);
                    bool handedOver = false;
                    try
                    {
                        var mid = await _prepare(item, _ct);
                        if (mid != null) { await _mid.Writer.WriteAsync(mid, _ct); handedOver = true; }
                    }
                    catch (OperationCanceledException) when (_ct.IsCancellationRequested) { return; }
                    catch (Exception ex) { _onError(item!, ex); }
                    finally { if (!handedOver) Interlocked.Decrement(ref _inFlight); }
                }
            }
            catch (OperationCanceledException) { }
            finally { _mid.Writer.TryComplete(); }
        }

        private async Task DeliverLoopAsync()
        {
            try
            {
                await foreach (var mid in _mid.Reader.ReadAllAsync(_ct))
                {
                    try { await _deliver(mid, _ct); }
                    catch (OperationCanceledException) when (_ct.IsCancellationRequested) { return; }
                    catch (Exception ex) { _onError(mid, ex); }
                    finally { Interlocked.Decrement(ref _inFlight); }
                }
            }
            catch (OperationCanceledException) { }
        }

        public void Dispose() => _in.Writer.TryComplete();
    }
}
