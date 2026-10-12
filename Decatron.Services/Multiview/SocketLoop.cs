using System.Net.WebSockets;
using System.Text;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Multiview
{
    /// <summary>
    /// Conexión WebSocket que se reabre sola con espera creciente (1 s → 60 s) y entrega cada mensaje de texto completo.
    /// La usan el lector de IRC de Twitch y el de Pusher de Kick: si el tercero cae, el Multi-view solo se queda sin
    /// chat de esa plataforma hasta que vuelva, sin tumbar nada más.
    /// </summary>
    internal abstract class SocketLoop
    {
        private readonly SemaphoreSlim _sendLock = new(1, 1);
        private ClientWebSocket? _ws;
        protected readonly ILogger Logger;

        protected SocketLoop(ILogger logger) { Logger = logger; }

        protected abstract string Name { get; }
        protected abstract Uri Url { get; }
        /// <summary>Se llama al abrir (y reabrir) la conexión: saludo, y volver a unirse a lo que haya que escuchar.</summary>
        protected abstract Task OnOpenAsync(CancellationToken ct);
        protected abstract Task OnTextAsync(string text, CancellationToken ct);

        public bool IsOpen => _ws?.State == WebSocketState.Open;

        public async Task RunAsync(CancellationToken ct)
        {
            var wait = 1;
            while (!ct.IsCancellationRequested)
            {
                try
                {
                    using var ws = new ClientWebSocket();
                    ws.Options.SetRequestHeader("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36");
                    await ws.ConnectAsync(Url, ct);
                    _ws = ws;
                    wait = 1;
                    Logger.LogInformation("[Multiview] {Name} conectado", Name);
                    await OnOpenAsync(ct);
                    await ReadAsync(ws, ct);
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
                catch (Exception ex)
                {
                    Logger.LogWarning(ex, "[Multiview] {Name} se desconectó", Name);
                }
                finally { _ws = null; }

                try { await Task.Delay(TimeSpan.FromSeconds(wait), ct); }
                catch (OperationCanceledException) { break; }
                wait = Math.Min(wait * 2, 60);
            }
        }

        private async Task ReadAsync(ClientWebSocket ws, CancellationToken ct)
        {
            var buffer = new byte[16 * 1024];
            var text = new StringBuilder();
            while (ws.State == WebSocketState.Open && !ct.IsCancellationRequested)
            {
                text.Clear();
                WebSocketReceiveResult result;
                do
                {
                    result = await ws.ReceiveAsync(buffer, ct);
                    if (result.MessageType == WebSocketMessageType.Close) return;
                    text.Append(Encoding.UTF8.GetString(buffer, 0, result.Count));
                } while (!result.EndOfMessage);

                try { await OnTextAsync(text.ToString(), ct); }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    Logger.LogWarning(ex, "[Multiview] {Name}: no se pudo procesar un mensaje", Name);
                }
            }
        }

        protected async Task SendAsync(string text, CancellationToken ct = default)
        {
            var ws = _ws;
            if (ws is not { State: WebSocketState.Open }) return;
            await _sendLock.WaitAsync(ct);
            try { await ws.SendAsync(Encoding.UTF8.GetBytes(text), WebSocketMessageType.Text, true, ct); }
            catch (Exception ex) when (ex is WebSocketException or ObjectDisposedException or InvalidOperationException)
            {
                Logger.LogDebug(ex, "[Multiview] {Name}: envío fallido", Name);
            }
            finally { _sendLock.Release(); }
        }
    }
}
