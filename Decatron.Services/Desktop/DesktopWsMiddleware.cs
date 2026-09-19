using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Decatron.Core.Models.Desktop;
using Decatron.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Services.Desktop
{
    /// <summary>
    /// Conexión única de Decatron Desktop: <c>wss://decatron.net/api/desktop/ws?token=…</c>.
    /// Todos los módulos de la app hablan por aquí, multiplexados por canal, en vez de
    /// abrir un WebSocket por función.
    ///
    /// Protocolo (v1):
    ///  - Texto JSON en ambos sentidos: <c>{"ch":"core|translation|…","type":"…",…}</c>.
    ///  - Binario cliente→servidor: primer byte = canal (<see cref="BinaryChannel"/>), el
    ///    resto es la carga. Hoy solo 0x01 = audio PCM 16 kHz mono s16le para traducción.
    ///  - Al abrir, el servidor manda <c>core/hello</c> con el canal y qué módulos tiene
    ///    habilitados el streamer. <c>core/ping</c> ↔ <c>core/pong</c>.
    ///
    /// Va en /api para reutilizar el proxy de nginx que ya pasa WebSockets.
    /// Cada canal es un <see cref="IDesktopChannel"/>; agregar un módulo = un canal más.
    /// </summary>
    public class DesktopWsMiddleware
    {
        public const string Path = "/api/desktop/ws";

        public static class BinaryChannel
        {
            public const byte TranslationAudio = 0x01;
        }

        private readonly RequestDelegate _next;
        private readonly IReadOnlyDictionary<string, IDesktopChannel> _channels;
        private readonly DesktopOptions _opts;
        private readonly ILogger<DesktopWsMiddleware> _logger;

        private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);

        public DesktopWsMiddleware(RequestDelegate next, IEnumerable<IDesktopChannel> channels,
            IOptions<DesktopOptions> opts, ILogger<DesktopWsMiddleware> logger)
        {
            _next = next;
            _channels = channels.ToDictionary(c => c.Name, StringComparer.OrdinalIgnoreCase);
            _opts = opts.Value;
            _logger = logger;
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
            var auth = ctx.Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(token) && auth.StartsWith("Bearer ")) token = auth["Bearer ".Length..];
            var appVersion = ctx.Request.Query["v"].ToString();
            var platform = ctx.Request.Query["os"].ToString();

            var devices = ctx.RequestServices.GetRequiredService<DesktopDeviceService>();
            var device = await devices.ValidateTokenAsync(token, appVersion, platform);
            if (device == null)
            {
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return;
            }

            string login;
            using (var scope = ctx.RequestServices.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                login = await db.Users.AsNoTracking().Where(u => u.Id == device.UserId).Select(u => u.Login).FirstOrDefaultAsync() ?? "";
            }

            using var ws = await ctx.WebSockets.AcceptWebSocketAsync();
            var conn = new DesktopConnection(ws, device, login.ToLowerInvariant(), ctx.RequestAborted, _json);
            _logger.LogInformation("[Desktop] {Login} conectó ({Device} v{Version} {Os})", conn.Login, device.Name, appVersion, platform);

            try
            {
                var modules = new Dictionary<string, object?>();
                foreach (var ch in _channels.Values)
                    modules[ch.Name] = await ch.DescribeAsync(conn);
                await conn.SendAsync("core", "hello", new { login = conn.Login, deviceId = device.Id, minAppVersion = _opts.MinAppVersion, modules });

                var buf = new byte[32 * 1024];
                var text = new StringBuilder();
                while (ws.State == WebSocketState.Open && !conn.Token.IsCancellationRequested)
                {
                    WebSocketReceiveResult r;
                    // Los frames de audio caben enteros; los de texto pueden venir partidos.
                    r = await ws.ReceiveAsync(buf, conn.Token);
                    if (r.MessageType == WebSocketMessageType.Close) break;

                    if (r.MessageType == WebSocketMessageType.Binary)
                    {
                        if (r.Count < 2) continue;
                        var chId = buf[0];
                        var payload = buf.AsMemory(1, r.Count - 1);
                        var target = _channels.Values.FirstOrDefault(c => c.BinaryChannelId == chId);
                        if (target != null) await target.OnBinaryAsync(conn, payload);
                        continue;
                    }

                    text.Append(Encoding.UTF8.GetString(buf, 0, r.Count));
                    if (!r.EndOfMessage) continue;
                    var msg = text.ToString(); text.Clear();
                    await DispatchTextAsync(conn, msg);
                }
            }
            catch (OperationCanceledException) { }
            catch (WebSocketException) { }
            catch (Exception ex) { _logger.LogWarning(ex, "[Desktop] conexión de {Login}", conn.Login); }
            finally
            {
                conn.Cancel();
                foreach (var ch in _channels.Values)
                {
                    try { await ch.OnDisconnectedAsync(conn); }
                    catch (Exception ex) { _logger.LogDebug(ex, "[Desktop] cierre de canal {Ch}", ch.Name); }
                }
                try { if (ws.State == WebSocketState.Open) await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None); } catch { }
                _logger.LogInformation("[Desktop] {Login} desconectó", conn.Login);
            }
        }

        private async Task DispatchTextAsync(DesktopConnection conn, string msg)
        {
            JsonNode? j;
            try { j = JsonNode.Parse(msg); } catch { return; }
            var ch = j?["ch"]?.GetValue<string>() ?? "";
            var type = j?["type"]?.GetValue<string>() ?? "";

            if (ch == "core")
            {
                if (type == "ping") await conn.SendAsync("core", "pong", new { t = j?["t"]?.GetValue<long>() });
                return;
            }
            if (_channels.TryGetValue(ch, out var handler))
            {
                try { await handler.OnMessageAsync(conn, type, j!); }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[Desktop] {Login} {Ch}/{Type} falló", conn.Login, ch, type);
                    await conn.SendAsync(ch, "error", new { message = ex.Message });
                }
            }
        }
    }

    /// <summary>Un módulo del lado servidor: recibe los mensajes de su canal y puede responder.</summary>
    public interface IDesktopChannel
    {
        string Name { get; }

        /// <summary>Id del canal para frames binarios, o null si el canal no recibe binario.</summary>
        byte? BinaryChannelId { get; }

        /// <summary>Lo que va en <c>core/hello</c> bajo <c>modules[Name]</c>: si está habilitado, con qué config.</summary>
        Task<object?> DescribeAsync(DesktopConnection conn);

        Task OnMessageAsync(DesktopConnection conn, string type, JsonNode msg);
        Task OnBinaryAsync(DesktopConnection conn, ReadOnlyMemory<byte> payload);
        Task OnDisconnectedAsync(DesktopConnection conn);
    }

    /// <summary>Una app conectada. Los canales guardan su estado por conexión en <see cref="Items"/>.</summary>
    public sealed class DesktopConnection
    {
        private readonly WebSocket _ws;
        private readonly SemaphoreSlim _sendLock = new(1, 1);
        private readonly CancellationTokenSource _cts;
        private readonly JsonSerializerOptions _json;

        public DesktopDevice Device { get; }
        public long UserId => Device.UserId;
        public string Login { get; }
        public CancellationToken Token => _cts.Token;
        public Dictionary<string, object> Items { get; } = new();

        internal DesktopConnection(WebSocket ws, DesktopDevice device, string login, CancellationToken abort, JsonSerializerOptions json)
        {
            _ws = ws; Device = device; Login = login; _json = json;
            _cts = CancellationTokenSource.CreateLinkedTokenSource(abort);
        }

        public async Task SendAsync(string channel, string type, object? payload = null)
        {
            if (_ws.State != WebSocketState.Open) return;
            var node = payload == null ? new JsonObject() : JsonSerializer.SerializeToNode(payload, _json)!.AsObject();
            node["ch"] = channel;
            node["type"] = type;
            var bytes = Encoding.UTF8.GetBytes(node.ToJsonString(_json));
            await _sendLock.WaitAsync(Token);
            try
            {
                if (_ws.State == WebSocketState.Open)
                    await _ws.SendAsync(bytes, WebSocketMessageType.Text, true, Token);
            }
            catch (OperationCanceledException) { }
            catch (WebSocketException) { }
            finally { _sendLock.Release(); }
        }

        internal void Cancel() => _cts.Cancel();
    }
}
