using Microsoft.Extensions.Logging;

namespace Decatron.Services.Multiview
{
    /// <summary>
    /// Lector anónimo del chat de Twitch por IRC (usuario justinfan: solo lectura, sin cuenta). Una sola conexión
    /// reparte todos los canales abiertos; unirse y salir de un canal es JOIN/PART. Twitch limita los JOIN, por eso
    /// al reconectar se espacian.
    /// </summary>
    internal sealed class TwitchIrcReader : SocketLoop
    {
        private readonly object _gate = new();
        private readonly HashSet<string> _channels = new();
        private readonly Func<IrcLine, Task> _onLine;

        public TwitchIrcReader(Func<IrcLine, Task> onLine, ILogger logger) : base(logger) { _onLine = onLine; }

        protected override string Name => "Twitch IRC";
        protected override Uri Url => new("wss://irc-ws.chat.twitch.tv:443");

        public void Join(string login)
        {
            lock (_gate) { if (!_channels.Add(login)) return; }
            _ = SendAsync($"JOIN #{login}");
        }

        public void Part(string login)
        {
            lock (_gate) { if (!_channels.Remove(login)) return; }
            _ = SendAsync($"PART #{login}");
        }

        protected override async Task OnOpenAsync(CancellationToken ct)
        {
            await SendAsync("CAP REQ :twitch.tv/tags twitch.tv/commands", ct);
            await SendAsync("PASS SCHMOOPIIE", ct);
            await SendAsync($"NICK justinfan{Random.Shared.Next(10000, 99999)}", ct);
            string[] pending;
            lock (_gate) pending = _channels.ToArray();
            for (var i = 0; i < pending.Length; i++)
            {
                await SendAsync($"JOIN #{pending[i]}", ct);
                if ((i + 1) % 10 == 0) await Task.Delay(TimeSpan.FromSeconds(11), ct);
            }
        }

        protected override async Task OnTextAsync(string text, CancellationToken ct)
        {
            foreach (var raw in text.Split("\r\n", StringSplitOptions.RemoveEmptyEntries))
            {
                if (raw.StartsWith("PING", StringComparison.Ordinal)) { await SendAsync("PONG :tmi.twitch.tv", ct); continue; }
                var line = IrcLine.Parse(raw);
                if (line != null) await _onLine(line);
            }
        }
    }
}
