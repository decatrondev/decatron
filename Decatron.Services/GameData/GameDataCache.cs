using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models.GameOverlays;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.GameData
{
    /// <summary>
    /// Cache de dos niveles por (provider, external_id, kind): memoria (rapida) +
    /// tabla game_data_cache (sobrevive reinicios). Dos canales mostrando la misma
    /// cuenta = una sola consulta al proveedor. Las partidas terminadas se guardan
    /// con TTL largo porque no cambian nunca.
    /// </summary>
    public class GameDataCache
    {
        private readonly IMemoryCache _memory;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<GameDataCache> _logger;

        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        public GameDataCache(IMemoryCache memory, IServiceScopeFactory scopeFactory, ILogger<GameDataCache> logger)
        {
            _memory = memory;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        private static string Key(string provider, string externalId, string kind) => $"gdc:{provider}:{externalId}:{kind}";

        /// <summary>Devuelve el valor cacheado o lo produce con factory y lo guarda con ttl.</summary>
        public async Task<T?> GetOrFetchAsync<T>(string provider, string externalId, string kind, TimeSpan ttl,
            Func<Task<T?>> factory, CancellationToken ct = default) where T : class
        {
            var key = Key(provider, externalId, kind);
            if (_memory.TryGetValue(key, out T? hit) && hit != null) return hit;

            var fromDb = await ReadDbAsync<T>(provider, externalId, kind, ct);
            if (fromDb != null)
            {
                _memory.Set(key, fromDb.Value.value, fromDb.Value.expiresAt);
                return fromDb.Value.value;
            }

            // Una sola produccion por clave a la vez: dos pollers/requests que piden lo
            // mismo comparten el fetch (ahorra rate limit y evita el INSERT duplicado).
            var inflight = _inflight.GetOrAdd(key, _ => new Lazy<Task<object?>>(async () =>
            {
                try
                {
                    var produced = await factory();
                    if (produced == null) return null;
                    var expires = DateTime.UtcNow + ttl;
                    _memory.Set(key, produced, expires);
                    await WriteDbAsync(provider, externalId, kind, produced, expires, CancellationToken.None);
                    return produced;
                }
                finally { _inflight.TryRemove(key, out Lazy<Task<object?>>? _); }
            }));
            return (T?)await inflight.Value;
        }

        private readonly System.Collections.Concurrent.ConcurrentDictionary<string, Lazy<Task<object?>>> _inflight = new();

        /// <summary>Ultimo valor conocido aunque haya vencido (para no dejar el overlay en blanco si el proveedor falla).</summary>
        public async Task<T?> GetStaleAsync<T>(string provider, string externalId, string kind, CancellationToken ct = default) where T : class
        {
            var key = Key(provider, externalId, kind);
            if (_memory.TryGetValue(key, out T? hit) && hit != null) return hit;
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var row = await db.GameDataCache.AsNoTracking()
                    .FirstOrDefaultAsync(c => c.Provider == provider && c.ExternalId == externalId && c.Kind == kind, ct);
                return row == null ? null : JsonSerializer.Deserialize<T>(row.Payload, Json);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "GameDataCache stale read {Provider}/{Kind}", provider, kind);
                return null;
            }
        }

        public void Invalidate(string provider, string externalId, string kind) => _memory.Remove(Key(provider, externalId, kind));

        private async Task<(T value, DateTime expiresAt)?> ReadDbAsync<T>(string provider, string externalId, string kind, CancellationToken ct) where T : class
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var row = await db.GameDataCache.AsNoTracking()
                    .FirstOrDefaultAsync(c => c.Provider == provider && c.ExternalId == externalId && c.Kind == kind, ct);
                if (row == null || row.ExpiresAt <= DateTime.UtcNow) return null;
                var value = JsonSerializer.Deserialize<T>(row.Payload, Json);
                return value == null ? null : (value, row.ExpiresAt);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "GameDataCache read {Provider}/{Kind}", provider, kind);
                return null;
            }
        }

        private async Task WriteDbAsync<T>(string provider, string externalId, string kind, T value, DateTime expiresAt, CancellationToken ct)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var payload = JsonSerializer.Serialize(value, Json);
                // Upsert atomico: dos escritores concurrentes no pueden chocar con el unique (provider, external_id, kind).
                await db.Database.ExecuteSqlInterpolatedAsync($@"
                    INSERT INTO game_data_cache (provider, external_id, kind, payload, fetched_at, expires_at)
                    VALUES ({provider}, {externalId}, {kind}, {payload}::jsonb, {DateTime.UtcNow}, {expiresAt})
                    ON CONFLICT (provider, external_id, kind)
                    DO UPDATE SET payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at, expires_at = EXCLUDED.expires_at", ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "GameDataCache write {Provider}/{Kind}", provider, kind);
            }
        }

        /// <summary>Borra filas vencidas hace mas de un dia (lo llama el poller cada tanto).</summary>
        public async Task PurgeExpiredAsync(CancellationToken ct = default)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var cutoff = DateTime.UtcNow.AddDays(-1);
                await db.GameDataCache.Where(c => c.ExpiresAt < cutoff).ExecuteDeleteAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "GameDataCache purge");
            }
        }
    }
}
