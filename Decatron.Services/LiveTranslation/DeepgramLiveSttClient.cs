using System.Net.WebSockets;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.LiveTranslation
{
    /// <summary>Una frase completa transcrita, con su posición en el reloj del audio del streamer.</summary>
    public record Utterance(string Text, double StartSec, double EndSec, DateTime FinalAtUtc);

    /// <summary>
    /// Cliente de Deepgram streaming. Recibe PCM 16 kHz mono s16le del streamer y emite
    /// frases completas. Junta los resultados finales parciales hasta que Deepgram marca
    /// <c>speech_final</c> (pausa de habla), que es la unidad que vale la pena traducir:
    /// por palabra el TTS no entona y por párrafo llega tarde.
    /// </summary>
    public sealed class DeepgramLiveSttClient : IAsyncDisposable
    {
        private readonly string _apiKey;
        private readonly string _model;
        private readonly string _language;
        private readonly ILogger _logger;
        private readonly ClientWebSocket _ws = new();
        private readonly CancellationTokenSource _cts = new();
        private Task? _recvLoop;
        private Task? _keepAlive;
        private DateTime _lastAudioUtc = DateTime.UtcNow;

        public event Action<Utterance>? UtteranceReady;
        public event Action<Exception?>? Closed;

        public bool IsOpen => _ws.State == WebSocketState.Open;

        public DeepgramLiveSttClient(string apiKey, string model, string language, ILogger logger)
        {
            _apiKey = apiKey; _model = model; _language = language; _logger = logger;
        }

        public async Task ConnectAsync(CancellationToken ct)
        {
            _ws.Options.SetRequestHeader("Authorization", $"Token {_apiKey}");
            var url = $"wss://api.deepgram.com/v1/listen?model={_model}&language={_language}" +
                      "&encoding=linear16&sample_rate=16000&channels=1" +
                      "&interim_results=true&smart_format=true&punctuate=true" +
                      "&endpointing=300&utterance_end_ms=1000&vad_events=true";
            await _ws.ConnectAsync(new Uri(url), ct);
            _recvLoop = Task.Run(ReceiveLoopAsync);
            _keepAlive = Task.Run(KeepAliveLoopAsync);
        }

        public async Task SendAudioAsync(ReadOnlyMemory<byte> pcm16, CancellationToken ct)
        {
            if (_ws.State != WebSocketState.Open) return;
            _lastAudioUtc = DateTime.UtcNow;
            await _ws.SendAsync(pcm16, WebSocketMessageType.Binary, true, ct);
        }

        public async Task CloseAsync()
        {
            try
            {
                if (_ws.State == WebSocketState.Open)
                {
                    // CloseStream hace que Deepgram procese lo que tenga en el buffer y
                    // mande los últimos finales antes de cerrar. Si cancelamos de una la
                    // última frase del streamer se pierde.
                    await _ws.SendAsync(Encoding.UTF8.GetBytes("{\"type\":\"CloseStream\"}"),
                        WebSocketMessageType.Text, true, CancellationToken.None);
                    if (_recvLoop != null) await Task.WhenAny(_recvLoop, Task.Delay(2500));
                    if (_ws.State == WebSocketState.Open)
                        await _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None);
                }
            }
            catch { /* ya cerrado */ }
            _cts.Cancel();
        }

        // Deepgram corta la conexión a los ~10 s sin datos. Cuando el streamer calla, la
        // app puede dejar de mandar audio (VAD), así que hay que mantenerla viva.
        private async Task KeepAliveLoopAsync()
        {
            var msg = Encoding.UTF8.GetBytes("{\"type\":\"KeepAlive\"}");
            try
            {
                while (!_cts.IsCancellationRequested && _ws.State == WebSocketState.Open)
                {
                    await Task.Delay(TimeSpan.FromSeconds(5), _cts.Token);
                    if ((DateTime.UtcNow - _lastAudioUtc).TotalSeconds >= 4)
                        await _ws.SendAsync(msg, WebSocketMessageType.Text, true, _cts.Token);
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex) { _logger.LogDebug(ex, "[LiveTranslation] keepalive STT"); }
        }

        private async Task ReceiveLoopAsync()
        {
            var buf = new byte[1 << 16];
            var sb = new StringBuilder();
            var pieces = new List<(string text, double start, double end)>();
            Exception? error = null;
            try
            {
                while (!_cts.IsCancellationRequested && _ws.State == WebSocketState.Open)
                {
                    sb.Clear();
                    WebSocketReceiveResult r;
                    do
                    {
                        r = await _ws.ReceiveAsync(buf, _cts.Token);
                        if (r.MessageType == WebSocketMessageType.Close) return;
                        sb.Append(Encoding.UTF8.GetString(buf, 0, r.Count));
                    } while (!r.EndOfMessage);

                    JsonNode? j;
                    try { j = JsonNode.Parse(sb.ToString()); } catch { continue; }
                    var type = j?["type"]?.GetValue<string>();

                    // Silencio largo sin que llegara speech_final (el streamer dejó la
                    // frase colgando, o se calló de golpe): lo acumulado sale igual.
                    if (type == "UtteranceEnd") { Flush(pieces); continue; }
                    if (type != "Results") continue;

                    var text = j["channel"]?["alternatives"]?[0]?["transcript"]?.GetValue<string>() ?? "";
                    bool isFinal = j["is_final"]?.GetValue<bool>() ?? false;
                    bool speechFinal = j["speech_final"]?.GetValue<bool>() ?? false;
                    double start = j["start"]?.GetValue<double>() ?? 0;
                    double dur = j["duration"]?.GetValue<double>() ?? 0;

                    if (!isFinal || string.IsNullOrWhiteSpace(text)) continue;
                    pieces.Add((text, start, start + dur));
                    if (speechFinal) Flush(pieces);
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex) { error = ex; }
            finally
            {
                Flush(pieces);   // lo que quedó al cerrar (CloseStream ya hizo que Deepgram lo mandara)
                Closed?.Invoke(error);
            }
        }

        private void Flush(List<(string text, double start, double end)> pieces)
        {
            if (pieces.Count == 0) return;
            var u = new Utterance(
                string.Join(" ", pieces.Select(p => p.text)).Trim(),
                pieces[0].start, pieces[^1].end, DateTime.UtcNow);
            pieces.Clear();
            UtteranceReady?.Invoke(u);
        }

        public async ValueTask DisposeAsync()
        {
            await CloseAsync();
            try { if (_recvLoop != null) await Task.WhenAny(_recvLoop, Task.Delay(2000)); } catch { }
            _ws.Dispose();
            _cts.Dispose();
        }
    }
}
