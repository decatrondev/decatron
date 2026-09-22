using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;

namespace Decatron.Core.Services.Moderation
{
    /// <summary>
    /// Últimos mensajes de cada canal, para !nuke. Solo en memoria y solo de quien puede ser
    /// sancionado (el streamer y los mods no entran). Guarda como mucho los últimos 5 minutos.
    /// </summary>
    public static class RecentChatBuffer
    {
        public record Entry(DateTime At, string Username, string Text);

        private const int MaxPerChannel = 3000;
        private static readonly TimeSpan MaxAge = TimeSpan.FromSeconds(ModerationCommandsConfig.NukeMaxWindowSeconds);
        private static readonly ConcurrentDictionary<string, Queue<Entry>> _channels = new();

        public static void Add(string channel, string username, string text)
        {
            var queue = _channels.GetOrAdd(channel.ToLower(), _ => new Queue<Entry>());
            lock (queue)
            {
                queue.Enqueue(new Entry(DateTime.UtcNow, username.ToLower(), text));
                Trim(queue);
            }
        }

        public static List<Entry> Since(string channel, TimeSpan window)
        {
            if (!_channels.TryGetValue(channel.ToLower(), out var queue))
                return new List<Entry>();

            var from = DateTime.UtcNow - window;
            lock (queue)
            {
                Trim(queue);
                return queue.Where(e => e.At >= from).ToList();
            }
        }

        private static void Trim(Queue<Entry> queue)
        {
            var oldest = DateTime.UtcNow - MaxAge;
            while (queue.Count > 0 && (queue.Count > MaxPerChannel || queue.Peek().At < oldest))
                queue.Dequeue();
        }
    }
}
