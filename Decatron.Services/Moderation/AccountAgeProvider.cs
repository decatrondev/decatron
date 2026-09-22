using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;
using Decatron.Core.Services.Moderation;
using Microsoft.Extensions.DependencyInjection;

namespace Decatron.Services.Moderation
{
    /// <summary>
    /// Fecha de creación de cuentas de Twitch con caché en memoria: no cambia nunca, así que
    /// cada cuenta se consulta una sola vez por vida del proceso.
    /// </summary>
    public class AccountAgeProvider : IAccountAgeProvider
    {
        private const int MaxEntries = 100_000;
        private static readonly ConcurrentDictionary<string, DateTime> _cache = new();

        private readonly IServiceScopeFactory _scopeFactory;

        public AccountAgeProvider(IServiceScopeFactory scopeFactory)
        {
            _scopeFactory = scopeFactory;
        }

        public async Task<DateTime?> GetCreatedAtAsync(string twitchUserId)
        {
            if (_cache.TryGetValue(twitchUserId, out var cached))
                return cached;

            using var scope = _scopeFactory.CreateScope();
            var twitch = scope.ServiceProvider.GetRequiredService<TwitchApiService>();
            var createdAt = await twitch.GetUserCreatedAtAsync(twitchUserId);
            if (createdAt == null)
                return null;

            if (_cache.Count >= MaxEntries) _cache.Clear();
            _cache[twitchUserId] = createdAt.Value;
            return createdAt;
        }
    }
}
