using System.Text.Json.Nodes;
using Decatron.Core.Interfaces;
using Decatron.Data;
using Decatron.Services.Desktop;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Services.LiveTranslation
{
    /// <summary>
    /// Canal <c>translation</c> del WebSocket de escritorio.
    ///
    /// Cliente → servidor: <c>start</c>, <c>stop</c>; binario 0x01 = PCM 16 kHz mono.
    /// Servidor → cliente: <c>started</c>, <c>status</c> cada 3 s mientras hay sesión,
    /// <c>stopped{reason}</c>, <c>error{message}</c>.
    /// </summary>
    public class TranslationDesktopChannel : IDesktopChannel
    {
        private const string SessionKey = "translation.session";
        private const string LoopKey = "translation.loop";

        private readonly LiveTranslationSessionManager _mgr;
        private readonly IServiceScopeFactory _scopes;
        private readonly LiveTranslationOptions _opts;
        private readonly ILogger<TranslationDesktopChannel> _logger;

        public TranslationDesktopChannel(LiveTranslationSessionManager mgr, IServiceScopeFactory scopes,
            IOptions<LiveTranslationOptions> opts, ILogger<TranslationDesktopChannel> logger)
        {
            _mgr = mgr; _scopes = scopes; _opts = opts.Value; _logger = logger;
        }

        public string Name => "translation";
        public byte? BinaryChannelId => DesktopWsMiddleware.BinaryChannel.TranslationAudio;

        public async Task<object?> DescribeAsync(DesktopConnection conn)
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var s = await db.LiveTranslationSettings.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == conn.UserId);
            return new
            {
                available = _mgr.IsConfigured,
                enabled = s?.Enabled ?? false,
                source = s?.SourceLanguage,
                languages = s?.TargetLanguageList ?? Array.Empty<string>(),
                credits = await CreditsAsync(scope, conn.UserId),
                audio = new { encoding = "pcm_s16le", sampleRate = 16000, channels = 1, binaryChannel = BinaryChannelId },
            };
        }

        /// <summary>Saldo del canal, para que la app muestre cuánto queda y no solo lo gastado.</summary>
        private static async Task<object> CreditsAsync(IServiceScope scope, long userId)
        {
            var b = await scope.ServiceProvider.GetRequiredService<ITtsCreditService>().GetBalanceAsync(userId);
            return new { available = b.TotalAvailable, unlimited = b.IsUnlimited };
        }

        private async Task<object> StatusAsync(long userId)
        {
            using var scope = _scopes.CreateScope();
            return new { session = _mgr.GetStatus(userId), credits = await CreditsAsync(scope, userId) };
        }

        public async Task OnMessageAsync(DesktopConnection conn, string type, JsonNode msg)
        {
            switch (type)
            {
                case "start":
                {
                    if (conn.Items.ContainsKey(SessionKey)) await StopAsync(conn, "restarted");
                    try
                    {
                        var session = await _mgr.StartAsync(conn.UserId, conn.Device.Id, conn.Token);
                        conn.Items[SessionKey] = session;
                        conn.Items[LoopKey] = StatusLoopAsync(conn, session);
                        await conn.SendAsync(Name, "started", await StatusAsync(conn.UserId));
                    }
                    catch (InvalidOperationException ex)
                    {
                        await conn.SendAsync(Name, "error", new { message = ex.Message });
                    }
                    return;
                }
                case "stop":
                    await StopAsync(conn, "stopped_by_user");
                    return;
                case "status":
                    await conn.SendAsync(Name, "status", await StatusAsync(conn.UserId));
                    return;
            }
        }

        public Task OnBinaryAsync(DesktopConnection conn, ReadOnlyMemory<byte> payload) =>
            conn.Items.TryGetValue(SessionKey, out var s) && s is ChannelSession session
                ? session.PushAudioAsync(payload, conn.Token)
                : Task.CompletedTask;

        public Task OnDisconnectedAsync(DesktopConnection conn) => StopAsync(conn, "disconnected");

        private async Task StopAsync(DesktopConnection conn, string reason)
        {
            if (!conn.Items.Remove(SessionKey, out var s) || s is not ChannelSession session) return;
            conn.Items.Remove(LoopKey);
            if (!session.Token.IsCancellationRequested)
                await _mgr.StopAsync(session.UserId, reason);
            await conn.SendAsync(Name, "stopped", new { reason = session.Snapshot().LastError != null && reason == "disconnected" ? "error" : reason, error = session.Snapshot().LastError });
        }

        private async Task StatusLoopAsync(DesktopConnection conn, ChannelSession session)
        {
            try
            {
                while (!conn.Token.IsCancellationRequested && !session.Token.IsCancellationRequested)
                {
                    await Task.Delay(TimeSpan.FromSeconds(3), conn.Token);
                    if ((DateTime.UtcNow - session.LastAudioUtc).TotalSeconds > _opts.IngestTimeoutSeconds)
                    {
                        _logger.LogInformation("[LiveTranslation] {Login}: sin audio {N}s, cerrando", session.Login, _opts.IngestTimeoutSeconds);
                        await _mgr.StopAsync(session.UserId, "timeout");
                        break;
                    }
                    await conn.SendAsync(Name, "status", await StatusAsync(conn.UserId));
                }

                // La sesión la cerró el servidor (sin créditos, STT caído, admin, timeout):
                // avisar a la app con el motivo real para que lo muestre.
                if (session.Token.IsCancellationRequested && conn.Items.Remove(SessionKey))
                {
                    conn.Items.Remove(LoopKey);
                    var snap = session.Snapshot();
                    await conn.SendAsync(Name, "stopped", new { reason = snap.LastError == "Sin créditos" ? "no_credits" : "server", error = snap.LastError });
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex) { _logger.LogDebug(ex, "[LiveTranslation] status loop"); }
        }
    }
}
