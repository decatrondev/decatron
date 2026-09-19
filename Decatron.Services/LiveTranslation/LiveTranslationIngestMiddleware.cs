using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Services.LiveTranslation
{
    /// <summary>
    /// WebSocket de ingesta de audio: <c>/api/live-translation/ingest?token=…</c>.
    ///
    /// Protocolo (v1):
    ///  - Cliente → servidor, binario: PCM 16 kHz mono s16le, frames de 20–100 ms.
    ///    (Opus vendrá después; a 256 kbps de subida un streamer ni lo nota.)
    ///  - Cliente → servidor, texto JSON: {"type":"stop"} · {"type":"ping"}.
    ///  - Servidor → cliente, texto JSON: {"type":"ready",…} al abrir, {"type":"status",…}
    ///    cada 3 s, {"type":"error","message"} antes de cerrar por un motivo del servidor.
    ///
    /// Va en /api para reutilizar el proxy de nginx que ya pasa WebSockets.
    /// </summary>
    public class LiveTranslationIngestMiddleware
    {
        public const string Path = "/api/live-translation/ingest";

        private readonly RequestDelegate _next;
        private readonly LiveTranslationSessionManager _mgr;
        private readonly LiveTranslationOptions _opts;
        private readonly ILogger<LiveTranslationIngestMiddleware> _logger;

        private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);

        public LiveTranslationIngestMiddleware(RequestDelegate next, LiveTranslationSessionManager mgr,
            IOptions<LiveTranslationOptions> opts, ILogger<LiveTranslationIngestMiddleware> logger)
        {
            _next = next; _mgr = mgr; _opts = opts.Value; _logger = logger;
        }

        public async Task InvokeAsync(HttpContext ctx)
        {
            if (!ctx.Request.Path.Equals(Path, StringComparison.OrdinalIgnoreCase))
            {
                await _next(ctx);
                return;
            }
            if (!ctx.WebSockets.IsWebSocketRequest)
            {
                ctx.Response.StatusCode = StatusCodes.Status426UpgradeRequired;
                return;
            }

            var token = ctx.Request.Query["token"].ToString();
            if (string.IsNullOrEmpty(token) && ctx.Request.Headers.Authorization.ToString().StartsWith("Bearer "))
                token = ctx.Request.Headers.Authorization.ToString()["Bearer ".Length..];

            var devices = ctx.RequestServices.GetRequiredService<LiveTranslationDeviceService>();
            var device = await devices.ValidateTokenAsync(token);
            if (device == null)
            {
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return;
            }

            using var ws = await ctx.WebSockets.AcceptWebSocketAsync();
            var abort = ctx.RequestAborted;
            ChannelSession session;
            try
            {
                session = await _mgr.StartAsync(device.UserId, device.Id, abort);
            }
            catch (InvalidOperationException ex)
            {
                await SendAsync(ws, new { type = "error", message = ex.Message }, abort);
                await ws.CloseAsync(WebSocketCloseStatus.PolicyViolation, Trunc(ex.Message), CancellationToken.None);
                return;
            }

            var reason = "disconnected";
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(abort, session.Token);
            var statusLoop = StatusLoopAsync(ws, session, cts.Token);
            try
            {
                await SendAsync(ws, new { type = "ready", session = _mgr.GetStatus(session.UserId) }, cts.Token);

                var buf = new byte[32 * 1024];
                while (ws.State == WebSocketState.Open && !cts.IsCancellationRequested)
                {
                    var r = await ws.ReceiveAsync(buf, cts.Token);
                    if (r.MessageType == WebSocketMessageType.Close) break;

                    if (r.MessageType == WebSocketMessageType.Binary)
                    {
                        // Un frame de audio cabe entero en el buffer (100 ms = 3200 bytes);
                        // si viniera fragmentado se concatena igual porque es PCM crudo.
                        await session.PushAudioAsync(buf.AsMemory(0, r.Count), cts.Token);
                        continue;
                    }

                    var text = Encoding.UTF8.GetString(buf, 0, r.Count);
                    if (text.Contains("\"stop\"")) { reason = "stopped_by_user"; break; }
                    if (text.Contains("\"ping\"")) await SendAsync(ws, new { type = "pong" }, cts.Token);
                }
            }
            catch (OperationCanceledException) when (session.Token.IsCancellationRequested)
            {
                // La sesión la cerró el servidor (sin créditos, error de STT, admin).
                reason = "server";
            }
            catch (WebSocketException) { }
            catch (Exception ex) { _logger.LogWarning(ex, "[LiveTranslation] ingest de {Login}", session.Login); reason = "error"; }
            finally
            {
                cts.Cancel();
                try { await statusLoop; } catch { }
                if (!session.Token.IsCancellationRequested)
                    await _mgr.StopAsync(session.UserId, reason);
                else if (ws.State == WebSocketState.Open)
                {
                    var st = session.Snapshot();
                    try { await SendAsync(ws, new { type = "error", message = st.LastError ?? "Sesión cerrada por el servidor" }, CancellationToken.None); } catch { }
                }
                try { if (ws.State == WebSocketState.Open) await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None); } catch { }
            }
        }

        private async Task StatusLoopAsync(WebSocket ws, ChannelSession session, CancellationToken ct)
        {
            try
            {
                while (!ct.IsCancellationRequested && ws.State == WebSocketState.Open)
                {
                    await Task.Delay(TimeSpan.FromSeconds(3), ct);
                    if ((DateTime.UtcNow - session.LastAudioUtc).TotalSeconds > _opts.IngestTimeoutSeconds)
                    {
                        _logger.LogInformation("[LiveTranslation] {Login}: sin audio {N}s, cerrando", session.Login, _opts.IngestTimeoutSeconds);
                        await _mgr.StopAsync(session.UserId, "timeout");
                        return;
                    }
                    await SendAsync(ws, new { type = "status", session = _mgr.GetStatus(session.UserId) }, ct);
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex) { _logger.LogDebug(ex, "[LiveTranslation] status loop"); }
        }

        private static Task SendAsync(WebSocket ws, object payload, CancellationToken ct) =>
            ws.State == WebSocketState.Open
                ? ws.SendAsync(JsonSerializer.SerializeToUtf8Bytes(payload, _json), WebSocketMessageType.Text, true, ct)
                : Task.CompletedTask;

        private static string Trunc(string s) => s.Length > 120 ? s[..120] : s;
    }
}
